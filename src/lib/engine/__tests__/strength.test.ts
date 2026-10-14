import { describe, expect, it } from "vitest";
import { prescribeStrength, type StrengthInput } from "../strength/progression";
import { roundDown } from "../strength/rounding";
import { shouldDeload } from "../strength/deload";
import { warmupSets } from "../strength/warmup";
import { DEFAULT_EQUIPMENT, type Exposure, type ProgramExercise } from "../types";
import { EXERCISES } from "@/lib/program/exercises";

const bench = EXERCISES["bench-press"];
const cfg: ProgramExercise = { exerciseId: "bench-press", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, restSec: 120 };

const exp = (weight: number, reps: number[], rir: number | null = 2, date = "2026-10-01"): Exposure => ({
  date,
  weight,
  sets: reps.map((r) => ({ weight, reps: r, rir })),
});

const run = (history: Exposure[], extra: Partial<StrengthInput> = {}) =>
  prescribeStrength({ exercise: bench, config: cfg, history, equipment: DEFAULT_EQUIPMENT, ...extra });

describe("double progression", () => {
  it("follows Johan's bench example: reps first, then weight", () => {
    const w1 = run([exp(80, [8, 8, 7])]);
    expect(w1.weight).toBe(80);
    expect(w1.reason.code).toBe("add_reps");
    expect(w1.sets.map((s) => s.reps)).toEqual([9, 9, 8]);

    const w2 = run([exp(80, [8, 8, 7]), exp(80, [8, 8, 8])]);
    expect(w2.weight).toBe(80);
    expect(w2.sets.map((s) => s.reps)).toEqual([9, 9, 9]);

    const w3 = run([exp(80, [9, 9, 8])]);
    expect(w3.weight).toBe(80);

    const top = run([exp(80, [10, 10, 10], 2)]);
    expect(top.reason.code).toBe("increase_weight");
    expect(top.weight).toBe(82.5);
    expect(top.sets.every((s) => s.reps >= cfg.repMin && s.reps <= cfg.repMax)).toBe(true);
  });

  it("does not increase when top reps were grinded below target RIR", () => {
    const p = run([exp(80, [10, 10, 10], 0)]);
    expect(p.weight).toBe(80);
    expect(p.reason.code).toBe("consolidate");
  });

  it("does not increase when technique was not approved", () => {
    const e = exp(80, [10, 10, 10]);
    e.sets[2].techniqueOk = false;
    expect(run([e]).weight).toBe(80);
  });

  it("takes a double step when far too easy, but caps unreasonable jumps", () => {
    expect(run([exp(80, [10, 10, 10], 4)]).weight).toBe(85);
    // 2 × 2.5 on 22.5 kg is >10 % → single step only
    expect(run([exp(22.5, [10, 10, 10], 4)]).weight).toBe(25);
  });

  it("holds after one miss and reduces after two consecutive misses", () => {
    const one = run([exp(82.5, [8, 7, 6])]);
    expect(one.weight).toBe(82.5);
    expect(one.reason.code).toBe("hold_after_miss");

    const two = run([exp(82.5, [8, 7, 6]), exp(82.5, [8, 6, 6])]);
    expect(two.reason.code).toBe("reduce_after_misses");
    expect(two.weight).toBeLessThan(82.5);
    expect(two.weight).toBe(75);
  });
});

describe("calibration", () => {
  it("never invents a weight without data", () => {
    const p = run([]);
    expect(p.status).toBe("needs_calibration");
    expect(p.weight).toBeNull();
    expect(p.sets.every((s) => s.weight === null)).toBe(true);
  });

  it("derives working weight from a recent performance, rounded down", () => {
    const p = run([], { calibration: { weight: 80, reps: 8, rir: 2 } });
    expect(p.status).toBe("ready");
    // e1RM 106.7 → 8 reps @ RIR 2 → 80 kg
    expect(p.weight).toBe(80);
  });
});

describe("rounding", () => {
  it("rounds to available equipment steps", () => {
    expect(roundDown(83.7, bench, DEFAULT_EQUIPMENT)).toBe(82.5);
    expect(roundDown(15, bench, DEFAULT_EQUIPMENT)).toBe(20); // never below the bar
    expect(roundDown(23.9, EXERCISES["incline-db-press"], DEFAULT_EQUIPMENT)).toBe(22);
    expect(roundDown(43, EXERCISES["lat-pulldown"], DEFAULT_EQUIPMENT)).toBe(42.5);
    expect(roundDown(118, EXERCISES["leg-press"], DEFAULT_EQUIPMENT)).toBe(115);
  });

  it("uses 5 kg steps only for heavy lower-body barbell lifts", () => {
    const rdl = EXERCISES["romanian-deadlift"];
    const cfgRdl = { ...cfg, exerciseId: rdl.id };
    const heavy = prescribeStrength({ exercise: rdl, config: cfgRdl, history: [exp(120, [10, 10, 10])], equipment: DEFAULT_EQUIPMENT });
    expect(heavy.weight).toBe(125);
    const light = prescribeStrength({ exercise: rdl, config: cfgRdl, history: [exp(60, [10, 10, 10])], equipment: DEFAULT_EQUIPMENT });
    expect(light.weight).toBe(62.5);
  });
});

describe("plateau, readiness and deload", () => {
  it("detects a plateau after 3 exposures without progress", () => {
    const flat = [exp(80, [9, 9, 9]), exp(80, [9, 9, 8]), exp(80, [9, 9, 9]), exp(80, [9, 8, 8])];
    const p = run(flat);
    expect(p.plateau?.action).toBe("change_rep_range");
  });

  it("postpones weight increases and drops a set on low readiness", () => {
    const p = run([exp(80, [10, 10, 10])], { readiness: { sleep: 2, energy: 2, soreness: 2 } });
    expect(p.weight).toBe(80);
    expect(p.sets).toHaveLength(2);
  });

  it("deload lowers load, volume and intensity", () => {
    const p = run([exp(80, [9, 9, 9])], { deload: true });
    expect(p.weight).toBe(70);
    expect(p.sets).toHaveLength(2);
    expect(p.sets[0].rirMin).toBe(3);
  });

  it("deload exposures do not count as progression history", () => {
    const hist = [exp(80, [10, 10, 10]), { ...exp(72.5, [8, 8]), isDeload: true }];
    expect(run(hist).weight).toBe(82.5);
  });

  it("triggers deload when ≥30 % of exercises stall", () => {
    const stalled = [exp(80, [9, 9, 9]), exp(80, [9, 9, 9]), exp(80, [9, 9, 9]), exp(80, [9, 9, 9])];
    const growing = [exp(80, [8, 8, 8]), exp(80, [9, 9, 9]), exp(80, [10, 10, 10]), exp(82.5, [9, 9, 9])];
    const r = shouldDeload({ exerciseHistories: [stalled, growing, growing], weeklyReadiness: [4, 4], weeksSinceDeload: 2 });
    expect(r.deload).toBe(true);
    expect(shouldDeload({ exerciseHistories: [growing, growing, growing], weeklyReadiness: [4, 4], weeksSinceDeload: 2 }).deload).toBe(false);
    expect(shouldDeload({ exerciseHistories: [], weeklyReadiness: [4], weeksSinceDeload: 6 }).deload).toBe(true);
  });
});

describe("warm-up", () => {
  it("ramps compound lifts to plate-rounded weights", () => {
    expect(warmupSets(bench, DEFAULT_EQUIPMENT, 80)).toEqual([
      { weight: 30, reps: 10 },
      { weight: 47.5, reps: 5 },
      { weight: 62.5, reps: 3 },
    ]);
    expect(warmupSets(EXERCISES["cable-fly"], DEFAULT_EQUIPMENT, 20)).toEqual([]);
  });
});

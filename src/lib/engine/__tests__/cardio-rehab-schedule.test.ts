import { describe, expect, it } from "vitest";
import { planCardioWeek, prescribeCardio, type CardioInput } from "../cardio/progression";
import { allowedModalities, hrZones } from "../cardio/zones";
import { achillesAllowed, planRehab } from "../rehab/achilles";
import { planWeek } from "../weekly/scheduler";
import type { CardioLog, RehabLog, RehabState } from "../types";
import { PROGRAM } from "@/lib/program/program";

const rehabEarly = { phase: 2, runningCleared: false };
const z2 = (durationMin: number, rpe: number, extra: Partial<CardioLog> = {}): CardioLog => ({
  date: "2026-10-01",
  slot: "A",
  kind: "z2",
  modality: "bike",
  durationMin,
  completed: true,
  rpe,
  talkTestOk: true,
  ...extra,
});
const input = (history: CardioLog[], extra: Partial<CardioInput> = {}): CardioInput => ({ history, rehab: rehabEarly, ...extra });

describe("cardio progression", () => {
  it("starts at 25 min Zone 2 without inventing intensity", () => {
    const p = prescribeCardio("A", input([]));
    expect(p.durationMin).toBe(25);
    expect(p.intensity).toBeNull();
  });

  it("adds time while Zone 2 feels easy: 25 → 28 → 30", () => {
    expect(prescribeCardio("A", input([z2(25, 3)])).durationMin).toBe(28);
    expect(prescribeCardio("A", input([z2(28, 4)])).durationMin).toBe(30);
  });

  it("switches to intensity once the time cap is reached", () => {
    const p = prescribeCardio("A", input([z2(45, 3, { intensity: 120 })]));
    expect(p.durationMin).toBe(45);
    expect(p.intensity).toBe(130);
  });

  it("holds after one hard session and reduces after two", () => {
    expect(prescribeCardio("A", input([z2(30, 6)])).durationMin).toBe(30);
    expect(prescribeCardio("A", input([z2(30, 6), z2(30, 7)])).durationMin).toBe(27);
  });

  it("caps weekly load increase at 10 %", () => {
    const history = [z2(30, 3), z2(30, 3, { slot: "B", modality: "crosstrainer" }), z2(40, 3, { slot: "C", kind: "long_z2" })];
    const plan = planCardioWeek(["A", "B", "C"], input(history, { prevWeeklyLoads: [300, 300, 300, 300] }));
    const load = (["A", "B", "C"] as const).reduce((s, k) => s + plan[k]!.durationMin * 3.5, 0);
    expect(load).toBeLessThanOrEqual(330 + 1e-9 + 3.5 * 40);
    expect(plan.C!.reason.code).toBe("cardio_load_cap");
  });

  it("unlocks intervals only after an aerobic base and never before legs", () => {
    expect(prescribeCardio("C", input([])).kind).toBe("long_z2");
    const base = [z2(30, 3), z2(32, 3), z2(30, 3), z2(34, 3)];
    expect(prescribeCardio("C", input(base)).kind).toBe("intervals");
    expect(prescribeCardio("C", input(base, { dayBeforeLegs: { C: true } })).kind).toBe("long_z2");
  });

  it("never offers running during Achilles rehab", () => {
    expect(allowedModalities({ phase: 3, runningCleared: false })).not.toContain("run");
    expect(allowedModalities({ phase: 1, runningCleared: false })).not.toContain("crosstrainer");
    expect(allowedModalities({ phase: 5, runningCleared: true })).toContain("run");
    expect(prescribeCardio("A", input([], { preferred: { A: "run" } })).modality).toBe("bike");
  });

  it("computes Karvonen zones", () => {
    const z = hrZones(40, 60);
    expect(z[1].min).toBeGreaterThan(z[0].min);
  });
});

describe("Achilles rehab", () => {
  const state: RehabState = { phase: 2, phaseStartedAt: "2026-10-01", baselineMorningPain: 2, runningCleared: false, approvedPhases: [1, 2] };
  const log = (date: string, painDuring: number, painNextMorning: number | null, level = 1): RehabLog => ({
    date,
    phase: 2,
    level,
    completed: true,
    painDuring,
    painNextMorning,
  });

  it("progresses after two well tolerated sessions", () => {
    expect(planRehab(state, [log("2026-10-02", 3, 2), log("2026-10-04", 3, 2)]).level).toBe(2);
  });

  it("regresses when next-morning pain is worse than baseline", () => {
    const logs = [log("2026-10-02", 3, 2), log("2026-10-04", 3, 2), log("2026-10-06", 4, 5)];
    expect(planRehab(state, logs).level).toBe(1);
  });

  it("waits for the morning check before progressing", () => {
    const p = planRehab(state, [log("2026-10-02", 3, 2), log("2026-10-04", 3, null)]);
    expect(p.level).toBe(1);
    expect(p.needsMorningCheck).toBe(true);
  });

  it("suggests next phase at top level but requires approval", () => {
    const logs = Array.from({ length: 6 }, (_, i) => log(`2026-10-${String(2 + i * 2).padStart(2, "0")}`, 2, 2));
    const p = planRehab(state, logs);
    expect(p.level).toBe(3);
    expect(p.suggestPhaseAdvance).toBe(true);
    expect(p.phase.phase).toBe(2);
  });

  it("gates strength exercises by Achilles load", () => {
    expect(achillesAllowed("low", { phase: 1, runningCleared: false })).toBe(true);
    expect(achillesAllowed("moderate", { phase: 3, runningCleared: false })).toBe(false);
    expect(achillesAllowed("high", { phase: 5, runningCleared: false })).toBe(false);
  });
});

describe("week scheduler", () => {
  it("plans the normal week on its weekdays", () => {
    const plan = planWeek(PROGRAM, [], "2026-10-12"); // Monday
    expect(plan.days.map((d) => d.programDayId)).toEqual(["cb-a", "legs-a", "sa-a", "cb-b", "legs-b", "sa-b", null]);
    expect(plan.next?.programDayId).toBe("cb-a");
  });

  it("slides a missed Monday forward and uses Sunday", () => {
    const plan = planWeek(PROGRAM, [], "2026-10-13"); // Tuesday, Monday missed
    expect(plan.days.slice(1).map((d) => d.programDayId)).toEqual(["cb-a", "legs-a", "sa-a", "cb-b", "legs-b", "sa-b"]);
    expect(plan.dropped).toEqual([]);
  });

  it("respects 48 h between same category and drops what does not fit", () => {
    const done = [{ programDayId: "cb-a", date: "2026-10-12" }];
    const plan = planWeek(PROGRAM, done, "2026-10-15"); // Thursday, Tue+Wed missed
    for (let i = 1; i < plan.days.length; i++) {
      const a = plan.days[i - 1].programDayId;
      const b = plan.days[i].programDayId;
      if (a && b) expect(a.split("-")[0]).not.toBe(b.split("-")[0]);
    }
    expect(plan.dropped.length).toBe(1);
  });
});

describe("rest day", () => {
  it("keeps the session in the queue when the user rests today", () => {
    const plan = planWeek(PROGRAM, [], "2026-10-12", ["2026-10-12"]);
    expect(plan.days[0].programDayId).toBeNull();
    expect(plan.days[1].programDayId).toBe("cb-a");
  });
});

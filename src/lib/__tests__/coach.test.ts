import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cardioProjection, exposuresByExercise, prescribeDay, todayParts, weekPlan, type Snapshot } from "../coach";
import { fromRow, toRow, upsertTolerant } from "../db/supabase";
import { SETTINGS_ID, type SettingsRec, type SetLogRec } from "../db/records";
import { DEFAULT_EQUIPMENT } from "../engine/types";
import { ACHILLES_PHASES } from "../engine/rehab/achilles";
import { EXERCISE_LIST } from "../program/exercises";
import { MOBILITY, PREHAB } from "../program/prehab";
import { PROGRAM, PROGRAM_BY_ID } from "../program/program";

const T = "2026-10-01T10:00:00.000Z";
const settings: SettingsRec = {
  id: SETTINGS_ID,
  createdAt: T,
  updatedAt: T,
  onboarded: true,
  name: "Test",
  birthYear: 1990,
  bodyWeightKg: 80,
  restingHr: 60,
  maxHr: null,
  experience: "intermediate",
  goal: "hypertrophy",
  equipment: { ...DEFAULT_EQUIPMENT },
  rehab: { phase: 2, phaseStartedAt: "2026-09-01", baselineMorningPain: 2, runningCleared: false, approvedPhases: [1, 2] },
  substitutions: {},
  volumeModifiers: {},
  deloadWeeks: [],
  cardioPreferred: {},
};
const empty = (): Snapshot => ({ settings, sessions: [], sessionExercises: [], sets: [], cardio: [], rehab: [], calibrations: [], body: [], photos: [], mobility: [] });

function addSession(s: Snapshot, id: string, date: string, startedAt: string, exerciseId: string, weight: number, reps: number[]) {
  s.sessions.push({ id, createdAt: T, updatedAt: T, date, programDayId: "cb-a", status: "completed", readiness: null, sessionRpe: 7, deload: false, startedAt, completedAt: startedAt, notes: null });
  const seId = `${id}-se`;
  s.sessionExercises.push({ id: seId, createdAt: T, updatedAt: T, sessionId: id, exerciseId, slotExerciseId: exerciseId, position: 0, prescription: {} as never });
  reps.forEach((r, i) =>
    s.sets.push({ id: `${id}-${i}`, createdAt: T, updatedAt: T, sessionId: id, sessionExerciseId: seId, exerciseId, setIndex: i, kind: "working", targetWeight: weight, targetReps: r, targetRirMin: 1, targetRirMax: 2, weight, reps: r, rir: 2, techniqueOk: true, completedAt: startedAt } satisfies SetLogRec),
  );
}

describe("coach layer", () => {
  it("orders same-day exposures by session start, not by record id", () => {
    const s = empty();
    // ids sort opposite to chronological order
    addSession(s, "zzz", "2026-10-05", "2026-10-05T08:00:00Z", "bench-press", 80, [8, 8, 8]);
    addSession(s, "aaa", "2026-10-05", "2026-10-05T18:00:00Z", "bench-press", 82.5, [6, 6, 6]);
    const list = exposuresByExercise(s).get("bench-press")!;
    expect(list.map((e) => e.weight)).toEqual([80, 82.5]);
  });

  it("ignores sets from discarded or unfinished sessions", () => {
    const s = empty();
    addSession(s, "a", "2026-10-05", "2026-10-05T08:00:00Z", "bench-press", 80, [8, 8, 8]);
    s.sessions[0].status = "in_progress";
    expect(exposuresByExercise(s).get("bench-press")).toBeUndefined();
    s.sessions[0].status = "completed";
    s.sessions[0].deletedAt = T;
    expect(exposuresByExercise(s).get("bench-press")).toBeUndefined();
  });

  it("swaps exercises the rehab phase forbids", () => {
    const s = empty();
    s.settings = { ...settings, substitutions: { "hack-squat": "back-squat" } };
    const legs = prescribeDay(s, PROGRAM_BY_ID["legs-a"], "2026-10-13");
    expect(legs[0].exercise.id).not.toBe("back-squat");
  });

  it("treats a skipped day as rest and keeps the session in the queue", () => {
    const s = empty();
    s.sessions.push({ id: "x", createdAt: T, updatedAt: T, date: "2026-10-12", programDayId: "cb-a", status: "skipped", readiness: null, sessionRpe: null, deload: false, startedAt: T, completedAt: null, notes: null });
    const plan = weekPlan(s, "2026-10-12");
    expect(plan.days[0].programDayId).toBeNull();
    expect(plan.next?.programDayId).toBe("cb-a");
  });

  it("projects the next cardio session from the current prescription", () => {
    const s = empty();
    const next = cardioProjection(s, "2026-10-12", {
      slot: "A", kind: "z2", modality: "bike", durationMin: 25, rpeMin: 3, rpeMax: 4, intensity: null, reason: { code: "", text: "" }, notes: [],
    });
    expect(next.durationMin).toBe(28);
  });
});

describe("sync mapping", () => {
  it("round-trips every record field through snake_case rows", () => {
    const row = toRow(settings, "user-1");
    expect(row.user_id).toBe("user-1");
    expect(row.body_weight_kg).toBe(80);
    expect(row.volume_modifiers).toEqual({});
    expect(fromRow(row)).toEqual(settings);
  });

  it("matches the migrations' columns", () => {
    // All migrations together: create table + later "add column".
    const dir = path.join(process.cwd(), "supabase/migrations");
    const sql = fs.readdirSync(dir).sort().map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    const columns = (table: string) => {
      const body = sql.split(`create table public.${table} (`)[1].split(");")[0];
      const cols = new Set(body.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((c) => c && c !== "primary"));
      for (const m of sql.matchAll(new RegExp(`alter table public\\.${table} add column if not exists (\\w+)`, "g"))) cols.add(m[1]);
      return cols;
    };
    const fullSettings = { ...settings, heightCm: 180, sex: "male" as const, aiPhotoConsent: false };
    for (const key of Object.keys(toRow(fullSettings, "u"))) expect(columns("settings")).toContain(key);
    const photo = { id: "p", createdAt: T, updatedAt: T, deletedAt: null, date: "2026-10-05", pose: "front", width: 1, height: 1, storagePath: null, aiEstimate: null };
    for (const key of Object.keys(toRow(photo, "u"))) expect(columns("progress_photos")).toContain(key);
    const body = { id: "b", createdAt: T, updatedAt: T, deletedAt: null, date: "2026-10-05", weightKg: 80, bodyFatPct: null, muscleMassKg: null, waistCm: null, chestCm: null, armCm: null, thighCm: null, hipsCm: null, notes: null };
    for (const key of Object.keys(toRow(body, "u"))) expect(columns("body_measurements")).toContain(key);
    const mob = { id: "m", createdAt: T, updatedAt: T, deletedAt: null, date: "2026-10-05", kind: "mobility", itemIds: [], completed: true };
    for (const key of Object.keys(toRow(mob, "u"))) expect(columns("mobility_logs")).toContain(key);
    for (const key of Object.keys(toRow(settings, "u"))) expect(columns("settings")).toContain(key);
    const s = empty();
    addSession(s, "a", "2026-10-05", "2026-10-05T08:00:00Z", "bench-press", 80, [8]);
    for (const key of Object.keys(toRow(s.sessions[0], "u"))) expect(columns("workout_sessions")).toContain(key);
    for (const key of Object.keys(toRow(s.sets[0], "u"))) expect(columns("set_logs")).toContain(key);
    for (const key of Object.keys(toRow(s.sessionExercises[0], "u"))) expect(columns("session_exercises")).toContain(key);
    const cardio = { id: "c", createdAt: T, updatedAt: T, deletedAt: null, date: "2026-10-05", workoutSessionId: null, slot: "A", kind: "z2", modality: "bike", durationMin: 25, completed: true, rpe: 4, talkTestOk: true, intensity: null, inclinePct: null, distanceKm: null, avgHr: null, intervals: null, prescription: null };
    const rehab = { id: "r", createdAt: T, updatedAt: T, deletedAt: null, date: "2026-10-05", phase: 1, level: 1, completed: true, painDuring: 2, painNextMorning: null };
    const cal = { id: "k", createdAt: T, updatedAt: T, deletedAt: null, exerciseId: "bench-press", date: "2026-10-05", weight: 80, reps: 8, rir: 2 };
    for (const key of Object.keys(toRow(cardio, "u"))) expect(columns("cardio_sessions")).toContain(key);
    for (const key of Object.keys(toRow(rehab, "u"))) expect(columns("rehab_logs")).toContain(key);
    for (const key of Object.keys(toRow(cal, "u"))) expect(columns("calibrations")).toContain(key);
  });
});

describe("image slots", () => {
  const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/lib/images/slots.json"), "utf8"));
  const idsFor = (prefix: string) => {
    const fam = config.families.find((f: { prefix: string }) => f.prefix === prefix);
    const files = Array.isArray(fam.idSource) ? fam.idSource : [fam.idSource];
    const ids = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(path.join(process.cwd(), f), "utf8").matchAll(new RegExp(fam.idPattern, "g"))) ids.add(m[1]);
    return ids;
  };

  it("finds exactly the app's exercise ids", () => {
    expect([...idsFor("exercise")].sort()).toEqual(EXERCISE_LIST.map((e) => e.id).sort());
  });

  it("finds exactly the rehab, prehab and mobility ids", () => {
    const expected = new Set([...ACHILLES_PHASES.flatMap((p) => p.levels.flat().map((e) => e.id)), ...PREHAB.map((e) => e.id), ...MOBILITY.map((e) => e.id)]);
    expect([...idsFor("rehab-exercise")].sort()).toEqual([...expected].sort());
  });

  it("covers every schedule category", () => {
    const cats = new Set(PROGRAM.map((d) => d.category).filter((c) => c !== "rest"));
    for (const c of cats) expect(config.slots.some((s: { key: string }) => s.key === `schedule/${c}`)).toBe(true);
  });
});

describe("sync against an older schema", () => {
  it("drops a column the database lacks, retries, and reports it", async () => {
    const calls: Array<Record<string, unknown>[]> = [];
    const sb = {
      from: () => ({
        upsert: async (rows: Record<string, unknown>[]) => {
          calls.push(rows);
          return "ai_estimate" in rows[0]
            ? { error: { code: "PGRST204", message: "Could not find the 'ai_estimate' column of 'progress_photos' in the schema cache" } }
            : { error: null };
        },
      }),
    };
    const missing = new Set<string>();
    const res = await upsertTolerant(sb as never, "progress_photos", [{ id: "1", ai_estimate: { x: 1 }, date: "2026-10-05" }], missing);
    expect(res.error).toBeNull();
    expect(res.dropped).toBe(true); // caller keeps the record dirty
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).not.toHaveProperty("ai_estimate");
    expect(missing).toContain("progress_photos.ai_estimate");
  });

  it("does not loop on unrelated errors", async () => {
    const sb = { from: () => ({ upsert: async () => ({ error: { code: "42501", message: "permission denied" } }) }) };
    const res = await upsertTolerant(sb as never, "settings", [{ id: "1" }], new Set());
    expect(res.error?.code).toBe("42501");
    expect(res.dropped).toBe(false);
  });
});

describe("today's parts", () => {
  const MON = "2026-10-19";
  const TUE = "2026-10-20";

  it("splits a strength day with cardio into strength, cardio and rehab", () => {
    const parts = todayParts(empty(), MON);
    expect(parts.strength?.day.id).toBe("cb-a");
    expect(parts.strength?.done).toBe(false);
    expect(parts.cardio).toEqual({ slot: "A", done: false });
    expect(parts.rehab.done).toBe(false);
  });

  it("has no cardio part on a strength-only day", () => {
    const s = empty();
    addSession(s, "mon", MON, `${MON}T18:00:00Z`, "bench-press", 80, [8, 8, 8]);
    const parts = todayParts(s, TUE);
    expect(parts.strength?.day.id).toBe("legs-a");
    expect(parts.cardio).toBeNull();
  });

  it("moves the cardio part with a strength day the planner shifted", () => {
    // Monday was missed, so Bröst + Rygg A (with cardio A) moves to Tuesday.
    const parts = todayParts(empty(), TUE);
    expect(parts.strength?.day.id).toBe("cb-a");
    expect(parts.cardio?.slot).toBe("A");
  });

  it("marks cardio and rehab done once logged today (e.g. in the morning)", () => {
    const s = empty();
    s.cardio.push({ id: "c1", createdAt: T, updatedAt: T, date: MON, slot: "A", kind: "z2", modality: "bike", durationMin: 30, completed: true, rpe: 4 } as never);
    s.rehab.push({ id: "r1", createdAt: T, updatedAt: T, date: MON, phase: 2, level: 1, completed: true, painDuring: 2, painNextMorning: null } as never);
    const parts = todayParts(s, MON);
    expect(parts.cardio).toEqual({ slot: "A", done: true });
    expect(parts.rehab.done).toBe(true);
    expect(parts.strength?.done).toBe(false);
  });
});

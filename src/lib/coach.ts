// Application layer: turns stored records into engine inputs and engine outputs into the
// numbers the UI shows. Pure functions over a snapshot of the data.

import { planCardioWeek, prescribeCardio, type CardioInput } from "./engine/cardio/progression";
import { sessionLoad } from "./engine/cardio/load";
import { achillesAllowed, planRehab, type RehabPlan } from "./engine/rehab/achilles";
import { shouldDeload } from "./engine/strength/deload";
import { isLowReadiness, prescribeStrength, readinessScore } from "./engine/strength/progression";
import { addDays, daysBetween, weekStart } from "./engine/weekly/dates";
import { weeklyReview, type WeekData, type WeeklyReview } from "./engine/weekly/review";
import { planWeek, type WeekPlan } from "./engine/weekly/scheduler";
import type {
  CardioLog,
  CardioModality,
  CardioPrescription,
  CardioSlot,
  Exercise,
  Exposure,
  ProgramDay,
  ProgramExercise,
  Readiness,
  RehabLog,
  StrengthPrescription,
} from "./engine/types";
import type {
  CalibrationRec,
  CardioSessionRec,
  RehabLogRec,
  SessionExerciseRec,
  SetLogRec,
  SettingsRec,
  WorkoutSessionRec,
} from "./db/records";
import { EXERCISES } from "./program/exercises";
import { PROGRAM, PROGRAM_BY_ID } from "./program/program";

export interface Snapshot {
  settings: SettingsRec;
  sessions: WorkoutSessionRec[];
  sessionExercises: SessionExerciseRec[];
  sets: SetLogRec[];
  cardio: CardioSessionRec[];
  rehab: RehabLogRec[];
  calibrations: CalibrationRec[];
}

const alive = <T extends { deletedAt?: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

export function completedSessions(s: Snapshot) {
  return alive(s.sessions)
    .filter((x) => x.status === "completed")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
}

/** Most frequent weight among working sets (ties → heaviest). */
function modeWeight(sets: SetLogRec[]): number {
  const count = new Map<number, number>();
  for (const s of sets) count.set(s.weight, (count.get(s.weight) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
}

/** Exposures per exercise, oldest first, built from completed sessions only. */
export function exposuresByExercise(s: Snapshot): Map<string, Exposure[]> {
  const sessions = completedSessions(s);
  const sessionById = new Map(sessions.map((x) => [x.id, x]));
  const setsBySe = new Map<string, SetLogRec[]>();
  for (const set of alive(s.sets)) {
    if (set.kind !== "working") continue;
    const arr = setsBySe.get(set.sessionExerciseId) ?? [];
    arr.push(set);
    setsBySe.set(set.sessionExerciseId, arr);
  }
  // Chronological by session start, so two sessions on the same day keep their real order.
  const keyed = new Map<string, Array<{ key: string; exp: Exposure }>>();
  for (const se of alive(s.sessionExercises)) {
    const session = sessionById.get(se.sessionId);
    const sets = (setsBySe.get(se.id) ?? []).sort((a, b) => a.setIndex - b.setIndex);
    if (!session || sets.length === 0) continue;
    const exp: Exposure = {
      date: session.date,
      weight: modeWeight(sets),
      isDeload: session.deload,
      sets: sets.map((x) => ({ weight: x.weight, reps: x.reps, rir: x.rir, techniqueOk: x.techniqueOk })),
    };
    const arr = keyed.get(se.exerciseId) ?? [];
    arr.push({ key: `${session.date}|${session.startedAt}|${se.position}`, exp });
    keyed.set(se.exerciseId, arr);
  }
  const out = new Map<string, Exposure[]>();
  for (const [id, arr] of keyed) out.set(id, arr.sort((a, b) => a.key.localeCompare(b.key)).map((x) => x.exp));
  return out;
}

export function latestCalibration(s: Snapshot, exerciseId: string) {
  return alive(s.calibrations)
    .filter((c) => c.exerciseId === exerciseId)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .at(-1);
}

/** Exercise actually used for a program slot (after permanent swap and Achilles gating). */
export function resolveExercise(s: Snapshot, slot: ProgramExercise): Exercise {
  const swapped = EXERCISES[s.settings.substitutions[slot.exerciseId] ?? slot.exerciseId];
  const ex = swapped ?? EXERCISES[slot.exerciseId];
  if (achillesAllowed(ex.achillesLoad, s.settings.rehab)) return ex;
  const alt = ex.alternatives.map((id) => EXERCISES[id]).find((a) => a && achillesAllowed(a.achillesLoad, s.settings.rehab));
  return alt ?? ex;
}

/** Alternatives offered when swapping an exercise, filtered by the Achilles rehab phase. */
export function swapOptions(s: Snapshot, exercise: Exercise): Exercise[] {
  const ids = new Set([...exercise.alternatives, ...Object.values(EXERCISES).filter((e) => e.primary === exercise.primary).map((e) => e.id)]);
  ids.delete(exercise.id);
  return [...ids]
    .map((id) => EXERCISES[id])
    .filter((e) => e && achillesAllowed(e.achillesLoad, s.settings.rehab));
}

export function isDeloadWeek(s: Snapshot, date: string) {
  return s.settings.deloadWeeks.includes(weekStart(date));
}

export function prescribeFor(
  s: Snapshot,
  slot: ProgramExercise,
  opts: { exercise?: Exercise; readiness?: Readiness | null; date: string; exposures?: Map<string, Exposure[]> },
): StrengthPrescription {
  const exercise = opts.exercise ?? resolveExercise(s, slot);
  const exposures = opts.exposures ?? exposuresByExercise(s);
  const cal = latestCalibration(s, exercise.id);
  return prescribeStrength({
    exercise,
    config: { ...slot, exerciseId: exercise.id },
    history: exposures.get(exercise.id) ?? [],
    equipment: s.settings.equipment,
    readiness: opts.readiness,
    deload: isDeloadWeek(s, opts.date),
    calibration: cal ? { weight: cal.weight, reps: cal.reps, rir: cal.rir } : null,
    setModifier: s.settings.volumeModifiers[slot.exerciseId] ?? 0,
  });
}

export function prescribeDay(s: Snapshot, day: ProgramDay, date: string, readiness?: Readiness | null) {
  const exposures = exposuresByExercise(s);
  return day.exercises.map((slot) => {
    const exercise = resolveExercise(s, slot);
    return { slot, exercise, prescription: prescribeFor(s, slot, { exercise, readiness, date, exposures }) };
  });
}

// ---------- Week / schedule ----------

export function weekPlan(s: Snapshot, today: string): WeekPlan {
  const done = completedSessions(s).map((x) => ({ programDayId: x.programDayId, date: x.date }));
  const restDates = alive(s.sessions)
    .filter((x) => x.status === "skipped")
    .map((x) => x.date);
  return planWeek(PROGRAM, done, today, restDates);
}

export function inProgressSession(s: Snapshot) {
  return alive(s.sessions).find((x) => x.status === "in_progress");
}

// ---------- Cardio ----------

export function cardioLogs(s: Snapshot): CardioLog[] {
  return alive(s.cardio)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((c) => ({
      date: c.date,
      slot: c.slot,
      kind: c.kind,
      modality: c.modality,
      durationMin: c.durationMin,
      completed: c.completed,
      rpe: c.rpe,
      talkTestOk: c.talkTestOk ?? undefined,
      intensity: c.intensity,
      inclinePct: c.inclinePct ?? undefined,
      distanceKm: c.distanceKm ?? undefined,
      avgHr: c.avgHr ?? undefined,
      intervals: c.intervals ?? undefined,
    }));
}

export function weeklyCardioLoads(s: Snapshot, today: string, weeks = 4): number[] {
  const logs = cardioLogs(s);
  const start = weekStart(today);
  const out: number[] = [];
  for (let w = weeks; w >= 1; w--) {
    const from = addDays(start, -7 * w);
    const to = addDays(from, 6);
    const load = logs.filter((l) => l.date >= from && l.date <= to).reduce((a, l) => a + sessionLoad(l), 0);
    if (load > 0) out.push(load);
  }
  return out;
}

export function lastReadiness(s: Snapshot): Readiness | null {
  return completedSessions(s).filter((x) => x.readiness).at(-1)?.readiness ?? null;
}

export interface CardioWeek {
  pending: CardioSlot[];
  done: CardioSessionRec[];
  plan: Record<CardioSlot, CardioPrescription | undefined>;
  /** Date each slot is planned on, from the week plan. */
  dates: Partial<Record<CardioSlot, string>>;
}

function cardioContext(s: Snapshot, today: string) {
  const start = weekStart(today);
  const done = alive(s.cardio).filter((c) => c.date >= start && c.date <= addDays(start, 6));
  const plan = weekPlan(s, today);
  const dates: Partial<Record<CardioSlot, string>> = {};
  const dayBeforeLegs: Partial<Record<CardioSlot, boolean>> = {};
  plan.days.forEach((d, i) => {
    const slot = d.programDayId ? PROGRAM_BY_ID[d.programDayId]?.cardioSlot : undefined;
    if (!slot) return;
    dates[slot] = d.date;
    const nextId = plan.days[i + 1]?.programDayId;
    dayBeforeLegs[slot] = !!nextId && PROGRAM_BY_ID[nextId]?.category === "legs";
  });
  const input: CardioInput = {
    history: cardioLogs(s),
    rehab: s.settings.rehab,
    lowReadiness: isLowReadiness(lastReadiness(s)),
    prevWeeklyLoads: weeklyCardioLoads(s, today),
    thisWeekLoad: done.reduce((a, c) => a + c.durationMin * c.rpe, 0),
    dayBeforeLegs,
    preferred: s.settings.cardioPreferred,
  };
  return { done, dates, input };
}

export function cardioWeek(s: Snapshot, today: string): CardioWeek {
  const { done, dates, input } = cardioContext(s, today);
  const doneSlots = new Set(done.map((c) => c.slot));
  const pending = (["A", "B", "C"] as CardioSlot[]).filter((x) => !doneSlots.has(x));
  return { pending, done, plan: planCardioWeek(pending, input), dates };
}

/** Prescription for one slot, optionally forcing a modality (user picked another machine). */
export function cardioPrescriptionFor(s: Snapshot, today: string, slot: CardioSlot, modality?: CardioModality): CardioPrescription {
  const { input, done } = cardioContext(s, today);
  const doneSlots = new Set(done.map((c) => c.slot));
  const pending = (["A", "B", "C"] as CardioSlot[]).filter((x) => !doneSlots.has(x) || x === slot);
  const plan = planCardioWeek(pending, modality ? { ...input, preferred: { ...input.preferred, [slot]: modality } } : input);
  return plan[slot]!;
}

/** What the engine will prescribe next time if this session is completed as planned. */
export function cardioProjection(s: Snapshot, today: string, p: CardioPrescription): CardioPrescription {
  const { input } = cardioContext(s, today);
  const done: CardioLog = {
    date: today,
    slot: p.slot,
    kind: p.kind,
    modality: p.modality,
    durationMin: p.durationMin,
    completed: true,
    rpe: p.kind === "intervals" ? 8 : 4,
    talkTestOk: true,
    intensity: p.intensity,
    intervals: p.intervals,
  };
  return prescribeCardio(p.slot, { ...input, history: [...input.history, done], preferred: { ...input.preferred, [p.slot]: p.modality } });
}

// ---------- Rehab ----------

export function rehabLogs(s: Snapshot): RehabLog[] {
  return alive(s.rehab).map((r) => ({
    date: r.date,
    phase: r.phase,
    level: r.level,
    completed: r.completed,
    painDuring: r.painDuring,
    painNextMorning: r.painNextMorning,
  }));
}

export function rehabPlan(s: Snapshot): RehabPlan {
  return planRehab(s.settings.rehab, rehabLogs(s));
}

/** Latest rehab log still waiting for its morning-after check (from an earlier day). */
export function pendingMorningCheck(s: Snapshot, today: string) {
  return alive(s.rehab)
    .filter((r) => r.painNextMorning == null && r.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}

// ---------- Deload & weekly review ----------

export function deloadRecommendation(s: Snapshot, today: string) {
  const exposures = exposuresByExercise(s);
  const sessions = completedSessions(s);
  const start = weekStart(today);
  const weeklyReadiness: number[] = [];
  for (let w = 2; w >= 1; w--) {
    const from = addDays(start, -7 * w);
    const to = addDays(from, 6);
    const scores = sessions.filter((x) => x.date >= from && x.date <= to && x.readiness).map((x) => readinessScore(x.readiness!));
    if (scores.length) weeklyReadiness.push(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const lastDeload = [...s.settings.deloadWeeks].sort().at(-1);
  const first = sessions[0]?.date;
  const since = lastDeload ?? (first ? weekStart(first) : start);
  const weeksSinceDeload = Math.floor(daysBetween(since, start) / 7);
  return shouldDeload({ exerciseHistories: [...exposures.values()], weeklyReadiness, weeksSinceDeload });
}

function weekData(s: Snapshot, from: string): WeekData {
  const to = addDays(from, 6);
  const sessions = completedSessions(s).filter((x) => x.date >= from && x.date <= to);
  const ids = new Set(sessions.map((x) => x.id));
  const exposures: WeekData["exposures"] = [];
  for (const [exerciseId, list] of exposuresByExercise(s)) {
    for (const e of list) if (e.date >= from && e.date <= to) exposures.push({ exerciseId, exposure: e });
  }
  return {
    exposures,
    cardio: cardioLogs(s).filter((c) => c.date >= from && c.date <= to),
    readiness: sessions.map((x) => x.readiness).filter((r): r is Readiness => !!r),
    sessionsDone: ids.size,
    sessionsPlanned: PROGRAM.filter((d) => d.category !== "rest").length,
  };
}

/** Review of the week containing `date` versus the week before. */
export function reviewWeek(s: Snapshot, date: string): WeeklyReview {
  const start = weekStart(date);
  const next = PROGRAM.flatMap((d) => prescribeDay(s, d, addDays(start, 7)).map((x) => x.prescription));
  const rehab = rehabPlan(s);
  return weeklyReview({
    exercises: EXERCISES,
    thisWeek: weekData(s, start),
    lastWeek: weekData(s, addDays(start, -7)),
    next,
    deload: deloadRecommendation(s, addDays(start, 7)),
    rehabNote: rehab.suggestPhaseAdvance ? rehab.reason.text : `Hälsena: fas ${rehab.phase.phase}, nivå ${rehab.level} – ${rehab.reason.text}`,
  });
}

// ---------- Stats ----------

export interface WeekStat {
  weekStart: string;
  tonnage: number;
  workingSets: number;
  sessions: number;
  cardioMin: number;
  cardioLoad: number;
  cardioKm: number;
}

/** Per-week totals for the last `weeks` weeks (oldest first), including the current week. */
export function weeklyStats(s: Snapshot, today: string, weeks: number): WeekStat[] {
  const start = weekStart(today);
  const sessions = completedSessions(s);
  const sessionDate = new Map(sessions.map((x) => [x.id, x.date]));
  const out: WeekStat[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    out.push({ weekStart: addDays(start, -7 * w), tonnage: 0, workingSets: 0, sessions: 0, cardioMin: 0, cardioLoad: 0, cardioKm: 0 });
  }
  const idx = (date: string) => out.findIndex((x) => date >= x.weekStart && date <= addDays(x.weekStart, 6));
  for (const set of alive(s.sets)) {
    if (set.kind !== "working") continue;
    const date = sessionDate.get(set.sessionId);
    if (!date) continue;
    const i = idx(date);
    if (i === -1) continue;
    out[i].tonnage += set.weight * set.reps;
    out[i].workingSets += 1;
  }
  for (const x of sessions) {
    const i = idx(x.date);
    if (i !== -1) out[i].sessions += 1;
  }
  for (const c of alive(s.cardio)) {
    const i = idx(c.date);
    if (i === -1) continue;
    out[i].cardioMin += c.durationMin;
    out[i].cardioLoad += c.durationMin * c.rpe;
    out[i].cardioKm += c.distanceKm ?? 0;
  }
  return out;
}

// Application layer: turns stored records into engine inputs and engine outputs into the
// numbers the UI shows. Pure functions over a snapshot of the data.

import { planCardioWeek, prescribeCardio, type CardioInput } from "./engine/cardio/progression";
import { sessionLoad } from "./engine/cardio/load";
import { achillesAllowed, planRehab, type RehabPlan } from "./engine/rehab/achilles";
import { shouldDeload } from "./engine/strength/deload";
import { isLowReadiness, prescribeStrength, readinessScore } from "./engine/strength/progression";
import { addDays, daysBetween, weekStart } from "./engine/weekly/dates";
import { acwr, estimateMinutes, injuryRisk, loadStatus, type DailyLoad } from "./engine/weekly/insights";
import { exposureE1rm } from "./engine/strength/e1rm";
import { setsPerMuscle } from "./engine/strength/volume";
import { weeklyReview, type WeekData, type WeeklyReview } from "./engine/weekly/review";
import { planWeek, type WeekPlan } from "./engine/weekly/scheduler";
import type {
  CardioLog,
  CardioModality,
  CardioPrescription,
  CardioSlot,
  Exercise,
  Exposure,
  Muscle,
  ProgramDay,
  ProgramExercise,
  Readiness,
  RehabLog,
  StrengthPrescription,
} from "./engine/types";
import type {
  BodyMeasurementRec,
  CalibrationRec,
  CardioSessionRec,
  MobilityLogRec,
  ProgressPhotoRec,
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
  body: BodyMeasurementRec[];
  photos: ProgressPhotoRec[];
  mobility: MobilityLogRec[];
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

// ---------- Dark-design dashboard / insights helpers ----------

/** Estimated session length range for a program day, from its actual prescriptions. */
export function dayMinutes(s: Snapshot, day: ProgramDay, date: string): [number, number] {
  return estimateMinutes(
    prescribeDay(s, day, date).map(({ exercise, prescription }) => ({
      sets: prescription.sets.length,
      restSec: prescription.restSec,
      isCompound: exercise.isCompound,
    })),
  );
}

/** Weekly counters for the dashboard chips. */
export function weekCounts(s: Snapshot, today: string) {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const inWeek = (d: string) => d >= start && d <= end;
  const strengthDone = completedSessions(s).filter((x) => inWeek(x.date)).length;
  const planned = PROGRAM.filter((d) => d.category !== "rest");
  const dueToDate = planned.filter((d) => addDays(start, d.weekday - 1) <= today).length;
  const cardioDone = alive(s.cardio).filter((c) => inWeek(c.date)).length;
  const mobilityDone = new Set(alive(s.mobility).filter((m) => m.completed && inWeek(m.date)).map((m) => m.date)).size;
  return {
    strengthDone,
    strengthPlanned: planned.length,
    strengthDueToDate: Math.max(dueToDate, strengthDone),
    cardioDone,
    cardioPlanned: 3,
    mobilityDone,
    mobilityPlanned: 3,
  };
}

/** Training volume (kg) per weekday of the current week, Monday first. */
export function dailyVolumeThisWeek(s: Snapshot, today: string): Array<{ date: string; tonnage: number; trained: boolean }> {
  const start = weekStart(today);
  const sessions = completedSessions(s);
  const dateOf = new Map(sessions.map((x) => [x.id, x.date]));
  const out = Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), tonnage: 0, trained: false }));
  for (const x of sessions) {
    const i = daysBetween(start, x.date);
    if (i >= 0 && i < 7) out[i].trained = true;
  }
  for (const c of alive(s.cardio)) {
    const i = daysBetween(start, c.date);
    if (i >= 0 && i < 7) out[i].trained = true;
  }
  for (const set of alive(s.sets)) {
    if (set.kind !== "working") continue;
    const d = dateOf.get(set.sessionId);
    if (!d) continue;
    const i = daysBetween(start, d);
    if (i >= 0 && i < 7) out[i].tonnage += set.weight * set.reps;
  }
  return out;
}

/** Session-RPE load per day: strength (duration × session RPE) + cardio (minutes × RPE). */
export function dailyLoads(s: Snapshot): DailyLoad[] {
  const byDate = new Map<string, number>();
  const add = (date: string, load: number) => byDate.set(date, (byDate.get(date) ?? 0) + load);
  for (const x of completedSessions(s)) {
    const minutes =
      x.completedAt && x.startedAt ? Math.min(150, Math.max(20, (Date.parse(x.completedAt) - Date.parse(x.startedAt)) / 60000)) : 60;
    add(x.date, minutes * (x.sessionRpe ?? 7));
  }
  for (const c of alive(s.cardio)) add(c.date, c.durationMin * c.rpe);
  return [...byDate.entries()].map(([date, load]) => ({ date, load }));
}

export type InsightPeriod = "week" | "month" | "year";
const PERIOD_DAYS: Record<InsightPeriod, number> = { week: 7, month: 28, year: 365 };

/** Average relative change in best e1RM, current window vs the window before (or first vs last within it). */
function strengthChange(s: Snapshot, today: string, days: number): number | null {
  const from = addDays(today, -days);
  const prevFrom = addDays(today, -2 * days);
  const changes: number[] = [];
  for (const list of exposuresByExercise(s).values()) {
    const work = list.filter((e) => !e.isDeload);
    const cur = work.filter((e) => e.date > from && e.date <= today);
    if (!cur.length) continue;
    const prev = work.filter((e) => e.date > prevFrom && e.date <= from);
    const base = prev.length ? Math.max(...prev.map(exposureE1rm)) : cur.length > 1 ? exposureE1rm(cur[0]) : null;
    if (!base) continue;
    changes.push(Math.max(...cur.map(exposureE1rm)) / base - 1);
  }
  return changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null;
}

/** Strength index per bucket: mean of (best e1RM in bucket / exercise's first e1RM). */
function strengthSeries(s: Snapshot, today: string, bucketDays: number, buckets: number): Array<number | null> {
  const lists = [...exposuresByExercise(s).values()].map((l) => l.filter((e) => !e.isDeload)).filter((l) => l.length);
  return Array.from({ length: buckets }, (_, i) => {
    const to = addDays(today, -bucketDays * (buckets - 1 - i));
    const from = addDays(to, -bucketDays);
    const vals = lists
      .map((l) => {
        const inB = l.filter((e) => e.date > from && e.date <= to);
        return inB.length ? Math.max(...inB.map(exposureE1rm)) / exposureE1rm(l[0]) : null;
      })
      .filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
}

function cardioMetric(s: Snapshot) {
  const logs = cardioLogs(s).filter((l) => l.kind !== "intervals" && l.completed);
  const counts = new Map<string, number>();
  for (const l of logs) if (l.intensity != null) counts.set(l.modality, (counts.get(l.modality) ?? 0) + 1);
  const modality = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  // Zone 2 capacity: intensity you hold at easy effort (falls back to minutes when intensity isn't logged).
  return modality
    ? { logs: logs.filter((l) => l.modality === modality && l.intensity != null), value: (l: CardioLog) => l.intensity! }
    : { logs, value: (l: CardioLog) => l.durationMin };
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function insights(s: Snapshot, today: string, period: InsightPeriod) {
  const days = PERIOD_DAYS[period];
  const from = addDays(today, -days);
  const bucketDays = period === "year" ? 30 : 7;
  const buckets = period === "year" ? 12 : 8;

  const cm = cardioMetric(s);
  const cur = avg(cm.logs.filter((l) => l.date > from && l.date <= today).map(cm.value));
  const prevLogs = cm.logs.filter((l) => l.date > addDays(today, -2 * days) && l.date <= from);
  const prev = prevLogs.length ? avg(prevLogs.map(cm.value)) : null;
  const cardioPct = cur != null && prev ? cur / prev - 1 : null;
  const cardioSeries = Array.from({ length: buckets }, (_, i) => {
    const to = addDays(today, -bucketDays * (buckets - 1 - i));
    return avg(cm.logs.filter((l) => l.date > addDays(to, -bucketDays) && l.date <= to).map(cm.value));
  });

  const sessionsInPeriod = completedSessions(s).filter((x) => x.date > from && x.date <= today);
  const readiness = sessionsInPeriod.map((x) => x.readiness).filter((r): r is Readiness => !!r);
  const recovery = avg(readiness.map(readinessScore));
  const sleep = avg(readiness.map((r) => r.sleepHours).filter((h): h is number => typeof h === "number"));

  const { ratio } = acwr(dailyLoads(s), today);
  const week = addDays(today, -7);
  const rehabWeek = alive(s.rehab).filter((r) => r.date > week && r.date <= today);
  const morning = rehabWeek.map((r) => r.painNextMorning).filter((p): p is number => p != null);
  const lastWeekReadiness = avg(
    completedSessions(s)
      .filter((x) => x.date > week && x.readiness)
      .map((x) => readinessScore(x.readiness!)),
  );
  const risk = injuryRisk({
    ratio,
    morningPainOverBaseline: morning.length ? Math.max(...morning) - s.settings.rehab.baselineMorningPain : null,
    maxPainDuring: rehabWeek.length ? Math.max(...rehabWeek.map((r) => r.painDuring)) : null,
    readiness: lastWeekReadiness,
  });

  return {
    strength: { pct: strengthChange(s, today, days), series: strengthSeries(s, today, bucketDays, buckets) },
    cardio: { pct: cardioPct, series: cardioSeries },
    /** 0–10 (readiness 1–5 mapped). */
    recovery: recovery == null ? null : (recovery - 1) * 2.5,
    sleepHours: sleep,
    load: { status: loadStatus(ratio), ratio },
    risk,
  };
}

/** Weekly working sets per muscle group vs a target range (Muskelgrupper screen). */
export const GROUP_TARGETS: Record<"chest" | "back" | "shoulders" | "arms" | "legs", { label: string; muscles: Muscle[]; target: number }> = {
  chest: { label: "Bröst", muscles: ["chest"], target: 16 },
  back: { label: "Rygg", muscles: ["back"], target: 18 },
  shoulders: { label: "Axlar", muscles: ["front_delts", "side_delts", "rear_delts"], target: 16 },
  arms: { label: "Armar", muscles: ["biceps", "triceps"], target: 20 },
  legs: { label: "Ben", muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"], target: 28 },
};

export function groupVolume(s: Snapshot, today: string, weeks: number) {
  const from = addDays(weekStart(today), -7 * (weeks - 1));
  const prevFrom = addDays(from, -7 * weeks);
  const entries = (a: string, b: string) => {
    const out: Array<{ exerciseId: string; sets: number }> = [];
    for (const [id, list] of exposuresByExercise(s)) for (const e of list) if (e.date >= a && e.date < b) out.push({ exerciseId: id, sets: e.sets.length });
    return setsPerMuscle(out, EXERCISES);
  };
  const now = entries(from, "9999");
  const before = entries(prevFrom, from);
  return (Object.keys(GROUP_TARGETS) as Array<keyof typeof GROUP_TARGETS>).map((key) => {
    const g = GROUP_TARGETS[key];
    const sum = (x: Partial<Record<Muscle, number>>) => g.muscles.reduce((a, m) => a + (x[m] ?? 0), 0);
    const perWeek = sum(now) / weeks;
    const prevPerWeek = sum(before) / weeks;
    const pct = perWeek / g.target;
    return {
      key,
      label: g.label,
      perWeek,
      pct,
      change: prevPerWeek > 0 ? perWeek / prevPerWeek - 1 : null,
      status: (pct < 0.7 ? "low" : pct > 1.15 ? "high" : "optimal") as "low" | "optimal" | "high",
    };
  });
}

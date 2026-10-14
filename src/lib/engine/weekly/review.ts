import type { CardioLog, Exercise, Exposure, Muscle, Readiness, Reason, StrengthPrescription } from "../types";
import { exposureE1rm, tonnage } from "../strength/e1rm";
import { readinessScore } from "../strength/progression";
import { setsPerMuscle, volumeAdjustment } from "../strength/volume";
import { sessionLoad } from "../cardio/load";

export interface WeekData {
  exposures: Array<{ exerciseId: string; exposure: Exposure }>;
  cardio: CardioLog[];
  readiness: Readiness[];
  sessionsDone: number;
  sessionsPlanned: number;
}

export interface ReviewInput {
  exercises: Record<string, Exercise>;
  thisWeek: WeekData;
  lastWeek: WeekData;
  /** Upcoming prescriptions, used to list what changes next week. */
  next: StrengthPrescription[];
  deload?: { deload: boolean; reason: Reason | null };
  rehabNote?: string;
}

export interface WeeklyReview {
  sessionsDone: number;
  sessionsPlanned: number;
  tonnage: number;
  prevTonnage: number;
  tonnageDeltaPct: number | null;
  volumeByMuscle: Array<{ muscle: Muscle; sets: number; prevSets: number }>;
  e1rmChanges: Array<{ exerciseId: string; pct: number }>;
  increaseWeight: Array<{ exerciseId: string; from: number; to: number }>;
  addReps: string[];
  plateaus: Array<{ exerciseId: string; text: string }>;
  volumeChanges: Array<{ muscle: Muscle; delta: -1 | 1; text: string }>;
  cardio: { minutes: number; prevMinutes: number; load: number; prevLoad: number; sessions: number };
  recovery: { score: number | null; prevScore: number | null; flag: boolean; text: string };
  deload: Reason | null;
  focus: string[];
}

const pct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function bestByExercise(week: WeekData) {
  const best = new Map<string, number>();
  for (const { exerciseId, exposure } of week.exposures) {
    best.set(exerciseId, Math.max(best.get(exerciseId) ?? 0, exposureE1rm(exposure)));
  }
  return best;
}

function weekSets(week: WeekData, exercises: Record<string, Exercise>) {
  return setsPerMuscle(
    week.exposures.map(({ exerciseId, exposure }) => ({ exerciseId, sets: exposure.sets.length })),
    exercises,
  );
}

export function weeklyReview(input: ReviewInput): WeeklyReview {
  const { exercises, thisWeek, lastWeek } = input;
  const ton = thisWeek.exposures.reduce((s, e) => s + tonnage(e.exposure.sets), 0);
  const prevTon = lastWeek.exposures.reduce((s, e) => s + tonnage(e.exposure.sets), 0);

  const now = weekSets(thisWeek, exercises);
  const prev = weekSets(lastWeek, exercises);
  const muscles = Array.from(new Set([...Object.keys(now), ...Object.keys(prev)])) as Muscle[];
  const volumeByMuscle = muscles
    .map((m) => ({ muscle: m, sets: now[m] ?? 0, prevSets: prev[m] ?? 0 }))
    .sort((a, b) => b.sets - a.sets);

  const bestNow = bestByExercise(thisWeek);
  const bestPrev = bestByExercise(lastWeek);
  const e1rmChanges: WeeklyReview["e1rmChanges"] = [];
  for (const [id, v] of bestNow) {
    const p = bestPrev.get(id);
    if (p) e1rmChanges.push({ exerciseId: id, pct: v / p - 1 });
  }

  const sorenessScores = thisWeek.readiness.map((r) => r.soreness);
  const soreness = avg(sorenessScores) ?? 3;
  const volumeChanges: WeeklyReview["volumeChanges"] = [];
  for (const m of muscles) {
    const changes = e1rmChanges.filter((c) => exercises[c.exerciseId]?.primary === m).map((c) => c.pct);
    const trend = avg(changes);
    if (trend == null) continue;
    const adj = volumeAdjustment({ muscle: m, performanceTrend: trend, soreness, currentSets: now[m] ?? 0 });
    if (adj.delta !== 0) volumeChanges.push({ muscle: m, delta: adj.delta, text: adj.reason.text });
  }

  const increaseWeight = input.next
    .filter((p) => p.reason.code.startsWith("increase_weight") && p.lastExposure && p.weight != null)
    .map((p) => ({ exerciseId: p.exerciseId, from: p.lastExposure!.weight, to: p.weight! }));
  const addReps = input.next.filter((p) => p.reason.code === "add_reps").map((p) => p.exerciseId);
  const plateaus = input.next.filter((p) => p.plateau).map((p) => ({ exerciseId: p.exerciseId, text: p.plateau!.text }));

  const cardio = {
    minutes: thisWeek.cardio.reduce((s, c) => s + c.durationMin, 0),
    prevMinutes: lastWeek.cardio.reduce((s, c) => s + c.durationMin, 0),
    load: thisWeek.cardio.reduce((s, c) => s + sessionLoad(c), 0),
    prevLoad: lastWeek.cardio.reduce((s, c) => s + sessionLoad(c), 0),
    sessions: thisWeek.cardio.length,
  };

  const score = avg(thisWeek.readiness.map(readinessScore));
  const prevScore = avg(lastWeek.readiness.map(readinessScore));
  const flag = score != null && (score <= 2.5 || (prevScore != null && score < prevScore - 0.75));
  const recovery = {
    score,
    prevScore,
    flag,
    text:
      score == null
        ? "Ingen återhämtningsdata – fyll i dagsformen före passen."
        : flag
          ? "Tecken på otillräcklig återhämtning – prioritera sömn, och appen håller belastningen."
          : "Återhämtningen ser bra ut.",
  };

  const focus: string[] = [];
  const name = (id: string) => exercises[id]?.name ?? id;
  const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
  if (input.deload?.deload && input.deload.reason) focus.push(input.deload.reason.text);
  if (flag) focus.push(recovery.text);
  for (const w of increaseWeight.slice(0, 2)) focus.push(`Öka ${name(w.exerciseId).toLowerCase()} till ${fmt(w.to)} kg (+${fmt(w.to - w.from)} kg).`);
  if (plateaus[0]) focus.push(`${name(plateaus[0].exerciseId)}: ${plateaus[0].text}`);
  if (input.rehabNote) focus.push(input.rehabNote);
  if (thisWeek.sessionsDone < thisWeek.sessionsPlanned) {
    focus.push(`${thisWeek.sessionsDone} av ${thisWeek.sessionsPlanned} pass genomförda – fokusera på att få in alla pass.`);
  }
  if (focus.length < 3 && addReps.length) focus.push(`Öka reps i ${addReps.length} övningar med samma vikt.`);
  if (focus.length < 3) focus.push("Fortsätt som planerat – cardio i Zone 2 ska kännas lugnt.");

  return {
    sessionsDone: thisWeek.sessionsDone,
    sessionsPlanned: thisWeek.sessionsPlanned,
    tonnage: ton,
    prevTonnage: prevTon,
    tonnageDeltaPct: pct(ton, prevTon),
    volumeByMuscle,
    e1rmChanges,
    increaseWeight,
    addReps,
    plateaus,
    volumeChanges,
    cardio,
    recovery,
    deload: input.deload?.reason ?? null,
    focus: focus.slice(0, 4),
  };
}

import type { Exercise, Muscle, ProgramDay, Reason } from "../types";

export const VOLUME_MIN_SETS = 6;
export const VOLUME_MAX_SETS = 22;

/** Weekly sets per muscle: primary counts 1, secondary 0.5. */
export function setsPerMuscle(
  entries: Array<{ exerciseId: string; sets: number }>,
  exercises: Record<string, Exercise>,
): Partial<Record<Muscle, number>> {
  const out: Partial<Record<Muscle, number>> = {};
  for (const { exerciseId, sets } of entries) {
    const ex = exercises[exerciseId];
    if (!ex) continue;
    out[ex.primary] = (out[ex.primary] ?? 0) + sets;
    for (const m of ex.secondary) out[m] = (out[m] ?? 0) + sets * 0.5;
  }
  return out;
}

export function plannedSetsPerMuscle(days: ProgramDay[], exercises: Record<string, Exercise>) {
  return setsPerMuscle(
    days.flatMap((d) => d.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets }))),
    exercises,
  );
}

export interface MuscleSignal {
  muscle: Muscle;
  /** Mean relative e1RM change this week vs last for exercises of this muscle. */
  performanceTrend: number;
  /** Mean soreness score (1–5, 5 = fresh) on sessions training this muscle. */
  soreness: number;
  currentSets: number;
}

export function volumeAdjustment(sig: MuscleSignal): { delta: -1 | 0 | 1; reason: Reason } {
  if (sig.currentSets > VOLUME_MAX_SETS) {
    return { delta: -1, reason: { code: "volume_cap", text: "Över volymtaket – ett set mindre." } };
  }
  if (sig.performanceTrend < -0.01 && sig.soreness <= 2.5) {
    return {
      delta: -1,
      reason: { code: "volume_down", text: "Prestationen sjunker och ömheten är hög – ett set mindre per vecka." },
    };
  }
  if (sig.performanceTrend > 0.005 && sig.soreness >= 3.5 && sig.currentSets + 1 <= VOLUME_MAX_SETS) {
    return {
      delta: 1,
      reason: { code: "volume_up", text: "Bra utveckling och god återhämtning – ett set till per vecka." },
    };
  }
  return { delta: 0, reason: { code: "volume_hold", text: "Volymen behålls." } };
}

import type { EquipmentProfile, Exercise, WarmupSet } from "../types";
import { roundDown } from "./rounding";

const RAMP: Array<[number, number]> = [
  [0.4, 10],
  [0.6, 5],
  [0.8, 3],
];

/** Ramp-up sets for compound lifts. Isolation work gets none. */
export function warmupSets(exercise: Exercise, eq: EquipmentProfile, workWeight: number | null): WarmupSet[] {
  if (!exercise.isCompound || !workWeight || workWeight <= 0) return [];
  if (exercise.equipment === "bodyweight") return [];
  const floor = exercise.equipment === "barbell" ? eq.barbellKg : 0;
  const out: WarmupSet[] = [];
  for (const [pct, reps] of RAMP) {
    const w = roundDown(workWeight * pct, exercise, eq);
    if (w < floor || w >= workWeight) continue;
    if (out.some((s) => s.weight === w)) continue;
    out.push({ weight: w, reps });
  }
  if (exercise.equipment === "barbell" && out.length === 0 && workWeight > eq.barbellKg) {
    out.push({ weight: eq.barbellKg, reps: 10 });
  }
  return out;
}

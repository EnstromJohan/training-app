import type { EquipmentProfile, Exercise } from "../types";

/** Default load increment for an exercise, before any percentage cap. */
export function loadStep(exercise: Exercise, eq: EquipmentProfile): number {
  switch (exercise.equipment) {
    case "barbell":
      return eq.barbellStepKg;
    case "dumbbell":
      return eq.dumbbellStepKg;
    case "cable":
      return eq.cableStepKg;
    case "machine":
      return eq.machineStepKg;
    case "plate_machine":
      return eq.plateMachineStepKg;
    case "bodyweight":
      return eq.barbellStepKg;
  }
}

/**
 * Increment used when progressing weight. Lower-body barbell lifts may jump 5 kg,
 * but never more than ~5 % of the working weight; never below the smallest step.
 */
export function progressionIncrement(exercise: Exercise, eq: EquipmentProfile, weight: number): number {
  const step = loadStep(exercise, eq);
  if (exercise.incrementKg) return Math.max(exercise.incrementKg, step);
  if (exercise.equipment === "barbell" && exercise.lowerBody) {
    const big = step * 2;
    return weight * 0.05 >= big ? big : step;
  }
  return step;
}

/** Round down to a weight that actually exists for the equipment. */
export function roundDown(weight: number, exercise: Exercise, eq: EquipmentProfile): number {
  const step = loadStep(exercise, eq);
  if (exercise.equipment === "barbell") {
    if (weight <= eq.barbellKg) return eq.barbellKg;
    return round2(eq.barbellKg + Math.floor((weight - eq.barbellKg) / step + 1e-9) * step);
  }
  if (exercise.equipment === "bodyweight") {
    // Added load, may be 0.
    return Math.max(0, round2(Math.floor(weight / step + 1e-9) * step));
  }
  return Math.max(step, round2(Math.floor(weight / step + 1e-9) * step));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

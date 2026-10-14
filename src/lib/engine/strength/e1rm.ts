import type { Exposure, LoggedSet } from "../types";

/** RIR-adjusted Epley: reps the lifter *could* have done = reps + RIR. */
export function e1rm(weight: number, reps: number, rir: number | null = 0): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + (reps + (rir ?? 0)) / 30);
}

export function bestSetE1rm(sets: LoggedSet[]): number {
  return sets.reduce((best, s) => Math.max(best, e1rm(s.weight, s.reps, s.rir)), 0);
}

export function exposureE1rm(exposure: Exposure): number {
  return bestSetE1rm(exposure.sets);
}

/** Weight that should allow `reps` with `rir` in reserve. */
export function weightFor(e1rmValue: number, reps: number, rir: number): number {
  return e1rmValue / (1 + (reps + rir) / 30);
}

/** Reps achievable at `weight` while leaving `rir` in reserve. */
export function repsFor(e1rmValue: number, weight: number, rir: number): number {
  if (weight <= 0) return 0;
  return Math.floor((e1rmValue / weight - 1) * 30 - rir + 1e-9);
}

export function tonnage(sets: LoggedSet[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

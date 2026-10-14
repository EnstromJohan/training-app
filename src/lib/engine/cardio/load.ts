import type { CardioKind, CardioLog } from "../types";

/** Session-RPE load (Foster): minutes × RPE. */
export function sessionLoad(log: Pick<CardioLog, "durationMin" | "rpe">): number {
  return log.durationMin * log.rpe;
}

/** Expected RPE for planning purposes. */
export function plannedRpe(kind: CardioKind): number {
  return kind === "intervals" ? 6 : 3.5;
}

export const WEEKLY_LOAD_MAX_INCREASE = 1.1;

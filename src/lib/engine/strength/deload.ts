import type { Exposure, Reason } from "../types";
import { stalledExposures } from "./plateau";

export interface DeloadInput {
  /** Per exercise: exposures oldest first. */
  exerciseHistories: Exposure[][];
  /** Average readiness score (1–5) per completed week, oldest first. */
  weeklyReadiness: number[];
  weeksSinceDeload: number;
}

export const DELOAD_INTERVAL_WEEKS = 6;
export const STALL_SHARE_TRIGGER = 0.3;

export function shouldDeload(input: DeloadInput): { deload: boolean; reason: Reason | null } {
  const evaluated = input.exerciseHistories.filter((h) => h.filter((e) => !e.isDeload).length >= 4);
  const stalled = evaluated.filter((h) => stalledExposures(h) >= 3).length;
  if (evaluated.length >= 3 && stalled / evaluated.length >= STALL_SHARE_TRIGGER) {
    return {
      deload: true,
      reason: {
        code: "deload_stall",
        text: `${stalled} av ${evaluated.length} övningar har stagnerat – en deloadvecka låter tröttheten släppa.`,
      },
    };
  }
  const lastTwo = input.weeklyReadiness.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((r) => r <= 2.5)) {
    return {
      deload: true,
      reason: { code: "deload_readiness", text: "Låg återhämtning två veckor i rad – dags för deload." },
    };
  }
  if (input.weeksSinceDeload >= DELOAD_INTERVAL_WEEKS) {
    return {
      deload: true,
      reason: {
        code: "deload_scheduled",
        text: `${input.weeksSinceDeload} veckor sedan senaste deload – planerad lättare vecka.`,
      },
    };
  }
  return { deload: false, reason: null };
}

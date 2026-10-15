import { addDays, daysBetween } from "./dates";

export interface DailyLoad {
  date: string;
  /** Session-RPE load: minutes × RPE. */
  load: number;
}

export type LoadStatus = "unknown" | "low" | "optimal" | "high" | "very_high";
export type RiskLevel = "low" | "moderate" | "high";

export const LOAD_LABEL: Record<LoadStatus, string> = {
  unknown: "För lite data",
  low: "Låg",
  optimal: "Optimal",
  high: "Hög",
  very_high: "Mycket hög",
};

export const RISK_LABEL: Record<RiskLevel, string> = { low: "Låg", moderate: "Måttlig", high: "Hög" };

/** Minimum history before the acute:chronic ratio is meaningful. */
export const ACWR_MIN_DAYS = 21;

/**
 * Acute:chronic workload ratio: last 7 days vs the weekly average of the last 28 days.
 * Returns null until there are ≥ 21 days of history.
 */
export function acwr(loads: DailyLoad[], today: string): { acute: number; chronic: number; ratio: number | null } {
  const inRange = (from: string) => loads.filter((l) => l.date > from && l.date <= today).reduce((a, l) => a + l.load, 0);
  const acute = inRange(addDays(today, -7));
  const chronic = inRange(addDays(today, -28)) / 4;
  const first = loads.map((l) => l.date).sort()[0];
  const enough = !!first && daysBetween(first, today) >= ACWR_MIN_DAYS;
  return { acute, chronic, ratio: enough && chronic > 0 ? acute / chronic : null };
}

export function loadStatus(ratio: number | null): LoadStatus {
  if (ratio == null) return "unknown";
  if (ratio < 0.8) return "low";
  if (ratio <= 1.3) return "optimal";
  if (ratio <= 1.5) return "high";
  return "very_high";
}

export interface RiskInput {
  ratio: number | null;
  /** Rehab: worst next-morning pain minus baseline in the last 7 days (null = no data). */
  morningPainOverBaseline: number | null;
  /** Rehab: worst pain during rehab in the last 7 days. */
  maxPainDuring: number | null;
  /** Average readiness (1–5) in the last 7 days. */
  readiness: number | null;
}

/** Rule-based estimate – a prompt to ease off, not a diagnosis. */
export function injuryRisk(i: RiskInput): { level: RiskLevel; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (i.ratio != null && i.ratio > 1.5) {
    score += 2;
    reasons.push("Belastningen har ökat kraftigt mot de senaste veckorna.");
  } else if (i.ratio != null && i.ratio > 1.3) {
    score += 1;
    reasons.push("Belastningen ligger i övre delen av intervallet.");
  }
  if (i.morningPainOverBaseline != null && i.morningPainOverBaseline > 1) {
    score += 2;
    reasons.push("Hälsenan har varit stelare än vanligt på morgonen.");
  }
  if (i.maxPainDuring != null && i.maxPainDuring > 5) {
    score += 1;
    reasons.push("Smärta över 5/10 under rehab senaste veckan.");
  }
  if (i.readiness != null && i.readiness <= 2.5) {
    score += 1;
    reasons.push("Låg återhämtning senaste veckan.");
  }
  return { level: score >= 3 ? "high" : score >= 1 ? "moderate" : "low", reasons };
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/**
 * Session length from the prescription: ~45 s work per set + prescribed rest, ramp-up sets on
 * compound lifts and a few minutes of setup. Returned as a ±10 % range in 5-minute steps.
 */
export function estimateMinutes(exercises: Array<{ sets: number; restSec: number; isCompound: boolean }>): [number, number] {
  if (exercises.length === 0) return [0, 0];
  let sec = 5 * 60;
  for (const e of exercises) {
    sec += e.sets * 45 + Math.max(0, e.sets - 1) * e.restSec + 90; // work + rest + change-over (plates, machine)
    if (e.isCompound) sec += 4 * 60; // ramp-up sets
  }
  const min = sec / 60;
  return [round5(min * 0.9), round5(min * 1.1)];
}

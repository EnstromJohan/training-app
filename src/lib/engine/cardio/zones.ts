import type { CardioModality } from "../types";

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  min: number;
  max: number;
  rpe: string;
  label: string;
}

const ZONE_BOUNDS: Array<[number, number, string, string]> = [
  [0.5, 0.6, "1–2", "Återhämtning"],
  [0.6, 0.7, "3–4", "Aerob bas – kan prata i hela meningar"],
  [0.7, 0.8, "5–6", "Tempo – korta meningar"],
  [0.8, 0.9, "7–8", "Tröskel – enstaka ord"],
  [0.9, 1.0, "9–10", "Max"],
];

/** Tanaka estimate, used only when no measured max is known. */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/** Karvonen (heart-rate reserve) zones. Estimates – RPE and talk test rule without an HR monitor. */
export function hrZones(age: number, restingHr: number, maxHr?: number | null): HrZone[] {
  const max = maxHr ?? estimateMaxHr(age);
  const reserve = max - restingHr;
  return ZONE_BOUNDS.map(([lo, hi, rpe, label], i) => ({
    zone: (i + 1) as HrZone["zone"],
    min: Math.round(restingHr + reserve * lo),
    max: Math.round(restingHr + reserve * hi),
    rpe,
    label,
  }));
}

export const MODALITY_LABEL: Record<CardioModality, string> = {
  bike: "Cykel",
  crosstrainer: "Crosstrainer",
  rower: "Rodd",
  walk: "Promenad",
  incline_walk: "Lutande gång",
  run: "Löpning",
};

export const INTENSITY_UNIT: Record<CardioModality, string> = {
  bike: "W",
  crosstrainer: "nivå",
  rower: "W",
  walk: "km/h",
  incline_walk: "km/h",
  run: "km/h",
};

/** Achilles-aware gating of cardio modalities. */
export function allowedModalities(rehab: { phase: number; runningCleared: boolean }): CardioModality[] {
  const out: CardioModality[] = ["bike", "walk"];
  if (rehab.phase >= 2) out.push("crosstrainer", "rower");
  if (rehab.phase >= 3) out.push("incline_walk");
  if (rehab.runningCleared) out.push("run");
  return out;
}

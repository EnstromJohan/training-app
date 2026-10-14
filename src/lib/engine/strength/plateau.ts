import type { Exposure, PlateauInfo } from "../types";
import { exposureE1rm } from "./e1rm";

/** Minimum relative e1RM improvement that counts as progress. */
const PROGRESS_THRESHOLD = 1.005;

/** Number of consecutive exposures (newest last) without a new best e1RM. */
export function stalledExposures(history: Exposure[]): number {
  const hist = history.filter((e) => !e.isDeload);
  if (hist.length === 0) return 0;
  let best = exposureE1rm(hist[0]);
  let stall = 0;
  for (let i = 1; i < hist.length; i++) {
    const e = exposureE1rm(hist[i]);
    if (e > best * PROGRESS_THRESHOLD) {
      best = e;
      stall = 0;
    } else {
      stall++;
    }
  }
  return stall;
}

/** Plateau = 3+ exposures without progress. Escalating actions. */
export function detectPlateau(history: Exposure[]): PlateauInfo | undefined {
  const stall = stalledExposures(history);
  if (stall < 3) return undefined;
  if (stall <= 4) {
    return {
      exposures: stall,
      action: "change_rep_range",
      text: `Ingen förbättring på ${stall} pass. Byt repintervall en period (t.ex. 6–8 → 10–12).`,
    };
  }
  if (stall <= 6) {
    return {
      exposures: stall,
      action: "swap_variation",
      text: `Platå i ${stall} pass. Byt till en närliggande variant av övningen.`,
    };
  }
  return {
    exposures: stall,
    action: "reduce_volume",
    text: `Långvarig platå (${stall} pass). Minska volymen eller kör en deloadvecka.`,
  };
}

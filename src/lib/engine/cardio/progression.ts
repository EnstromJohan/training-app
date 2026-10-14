import type {
  CardioKind,
  CardioLog,
  CardioModality,
  CardioPrescription,
  CardioSlot,
  IntervalSpec,
  Reason,
} from "../types";
import { plannedRpe, WEEKLY_LOAD_MAX_INCREASE } from "./load";
import { allowedModalities, INTENSITY_UNIT, MODALITY_LABEL } from "./zones";

export interface CardioInput {
  history: CardioLog[]; // oldest first
  rehab: { phase: number; runningCleared: boolean };
  lowReadiness?: boolean;
  /** Load (min × RPE) of the last completed weeks, oldest first. */
  prevWeeklyLoads?: number[];
  /** Load already done this week. */
  thisWeekLoad?: number;
  /** Slot C is never intervals the day before a leg session. */
  dayBeforeLegs?: Partial<Record<CardioSlot, boolean>>;
  preferred?: Partial<Record<CardioSlot, CardioModality>>;
}

export const START_MIN: Record<CardioKind, number> = { z2: 25, long_z2: 35, intervals: 0 };
export const CAP_MIN: Record<CardioKind, number> = { z2: 45, long_z2: 60, intervals: 0 };
export const START_INTERVALS: IntervalSpec = { reps: 4, workSec: 60, restSec: 120 };
const WARMUP_MIN = 8;
const COOLDOWN_MIN = 5;

const DEFAULT_ORDER: Record<CardioSlot, CardioModality[]> = {
  A: ["bike", "rower", "walk"],
  B: ["crosstrainer", "rower", "bike", "walk"],
  C: ["bike", "rower", "crosstrainer", "walk"],
};

export function intervalDuration(spec: IntervalSpec): number {
  return Math.round(WARMUP_MIN + COOLDOWN_MIN + (spec.reps * (spec.workSec + spec.restSec)) / 60);
}

function intensityStep(modality: CardioModality, rpe: number): number {
  switch (modality) {
    case "bike":
    case "rower":
      return rpe <= 3 ? 10 : 5;
    case "crosstrainer":
      return 1;
    case "walk":
    case "incline_walk":
      return 0.3;
    case "run":
      return 0.2;
  }
}

function chooseModality(slot: CardioSlot, kind: CardioKind, input: CardioInput): CardioModality {
  const allowed = allowedModalities(input.rehab);
  const pref = input.preferred?.[slot];
  if (pref && allowed.includes(pref)) return pref;
  const last = [...input.history].reverse().find((l) => l.slot === slot && l.kind === kind);
  if (last && allowed.includes(last.modality)) return last.modality;
  const order = kind === "intervals" ? ["bike", "rower"] as CardioModality[] : DEFAULT_ORDER[slot];
  return order.find((m) => allowed.includes(m)) ?? "bike";
}

function chooseKindC(input: CardioInput): { kind: CardioKind; note?: Reason } {
  const base = input.history.filter((l) => l.kind === "z2" && l.completed && l.durationMin >= 30).length;
  if (input.lowReadiness) {
    return { kind: "long_z2", note: { code: "c_readiness", text: "Låg återhämtning – lugnt distanspass istället för intervaller." } };
  }
  if (input.dayBeforeLegs?.C) {
    return { kind: "long_z2", note: { code: "c_legs", text: "Benpass imorgon – inga intervaller idag." } };
  }
  if (base < 4) {
    return { kind: "long_z2", note: { code: "c_base", text: `Intervaller låses upp efter 4 genomförda Zone 2-pass på minst 30 min (${base}/4).` } };
  }
  const lastC = [...input.history].reverse().find((l) => l.slot === "C");
  return { kind: lastC?.kind === "intervals" ? "long_z2" : "intervals" };
}

function consecutiveOvers(logs: CardioLog[], rpeLimit: number): number {
  let n = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (!logs[i].completed || logs[i].rpe > rpeLimit) n++;
    else break;
  }
  return n;
}

function prescribeSteady(slot: CardioSlot, kind: CardioKind, modality: CardioModality, input: CardioInput): CardioPrescription {
  const same = input.history.filter((l) => l.slot === slot && l.kind === kind);
  const last = same[same.length - 1];
  const lastSameModality = [...same].reverse().find((l) => l.modality === modality);
  const intensity = lastSameModality?.intensity ?? null;
  const notes: Reason[] = [];
  const cap = CAP_MIN[kind];
  const base: Omit<CardioPrescription, "durationMin" | "reason" | "intensity"> = {
    slot,
    kind,
    modality,
    rpeMin: 3,
    rpeMax: 4,
    notes,
  };
  if (modality === "incline_walk") base.inclinePct = lastSameModality?.inclinePct ?? 4;

  if (!last) {
    return {
      ...base,
      durationMin: START_MIN[kind],
      intensity: null,
      reason: { code: "cardio_start", text: "Första passet – välj en nivå där du kan prata i hela meningar (RPE 3–4)." },
    };
  }

  const overs = consecutiveOvers(same, 5);
  if (overs >= 2) {
    return {
      ...base,
      durationMin: Math.max(15, Math.round(last.durationMin * 0.9)),
      intensity,
      reason: { code: "cardio_reduce", text: "För tungt två pass i rad – tiden minskas 10 %." },
    };
  }
  if (overs === 1 || last.rpe === 5 || last.talkTestOk === false) {
    return {
      ...base,
      durationMin: last.durationMin,
      intensity,
      reason: { code: "cardio_hold", text: "Över Zone 2 senast – samma belastning tills det känns lugnt." },
    };
  }
  if (input.lowReadiness) {
    return {
      ...base,
      durationMin: last.durationMin,
      intensity,
      reason: { code: "cardio_readiness", text: "Låg återhämtning – samma tid som senast." },
    };
  }
  if (last.durationMin < cap) {
    const d = Math.min(cap, last.durationMin + (last.durationMin < 28 ? 3 : 2));
    return {
      ...base,
      durationMin: d,
      intensity,
      reason: { code: "cardio_more_time", text: `Lugnt senast (RPE ${last.rpe}) – tiden ökar ${last.durationMin} → ${d} min.` },
    };
  }
  if (intensity == null) {
    notes.push({ code: "cardio_need_intensity", text: `Logga ${INTENSITY_UNIT[modality]} så kan appen öka intensiteten.` });
    return {
      ...base,
      durationMin: cap,
      intensity,
      reason: { code: "cardio_at_cap", text: `Maxtiden ${cap} min nådd – nästa steg är högre intensitet.` },
    };
  }
  const next = Math.round((intensity + intensityStep(modality, last.rpe)) * 10) / 10;
  return {
    ...base,
    durationMin: cap,
    intensity: next,
    reason: {
      code: "cardio_more_intensity",
      text: `Maxtiden nådd och fortfarande Zone 2 – ${MODALITY_LABEL[modality].toLowerCase()} ${intensity} → ${next} ${INTENSITY_UNIT[modality]}.`,
    },
  };
}

function prescribeIntervals(modality: CardioModality, input: CardioInput): CardioPrescription {
  const same = input.history.filter((l) => l.kind === "intervals");
  const last = same[same.length - 1];
  const lastSameModality = [...same].reverse().find((l) => l.modality === modality);
  let intensity = lastSameModality?.intensity ?? null;
  let spec: IntervalSpec = { ...START_INTERVALS };
  let reason: Reason = { code: "intervals_start", text: "Första intervallpasset – arbetsperioder på RPE 7–8, lugn vila emellan." };

  if (last?.intervals) {
    const prev = last.intervals;
    const overs = consecutiveOvers(same, 8);
    if (overs >= 2) {
      spec = { ...prev, reps: Math.max(3, prev.reps - 1) };
      reason = { code: "intervals_reduce", text: "För tungt två gånger – en intervall mindre." };
    } else if (overs === 1) {
      spec = { ...prev };
      reason = { code: "intervals_hold", text: "Tungt senast – samma upplägg igen." };
    } else if (prev.reps < 8) {
      spec = { ...prev, reps: prev.reps + 1 };
      reason = { code: "intervals_more_reps", text: `Klarade alla ${prev.reps} – en intervall till.` };
    } else if (prev.workSec < 120) {
      spec = { reps: 6, workSec: prev.workSec + 30, restSec: prev.restSec };
      reason = { code: "intervals_longer", text: `8 intervaller klara – längre arbetsperioder (${prev.workSec + 30} s).` };
    } else if (intensity != null) {
      spec = { ...prev };
      intensity = Math.round((intensity + intensityStep(modality, 3)) * 10) / 10;
      reason = { code: "intervals_harder", text: `Volymen maxad – högre intensitet (${intensity} ${INTENSITY_UNIT[modality]}).` };
    } else {
      spec = { ...prev };
      reason = { code: "intervals_hold", text: `Logga ${INTENSITY_UNIT[modality]} så kan intensiteten ökas.` };
    }
  }
  return {
    slot: "C",
    kind: "intervals",
    modality,
    durationMin: intervalDuration(spec),
    rpeMin: 7,
    rpeMax: 8,
    intensity,
    intervals: spec,
    reason,
    notes: [{ code: "intervals_structure", text: `${WARMUP_MIN} min uppvärmning, ${COOLDOWN_MIN} min nedvarvning.` }],
  };
}

export function prescribeCardio(slot: CardioSlot, input: CardioInput): CardioPrescription {
  let kind: CardioKind = "z2";
  let note: Reason | undefined;
  if (slot === "C") ({ kind, note } = chooseKindC(input));
  const modality = chooseModality(slot, kind, input);
  const p = kind === "intervals" ? prescribeIntervals(modality, input) : prescribeSteady(slot, kind, modality, input);
  if (note) p.notes.push(note);
  return p;
}

/**
 * Plans the remaining cardio slots of the week and caps the total so weekly load
 * never rises more than 10 % above the recent 4-week average.
 */
export function planCardioWeek(slots: CardioSlot[], input: CardioInput): Record<CardioSlot, CardioPrescription | undefined> {
  const out: Record<CardioSlot, CardioPrescription | undefined> = { A: undefined, B: undefined, C: undefined };
  for (const s of slots) out[s] = prescribeCardio(s, input);

  const prev = (input.prevWeeklyLoads ?? []).slice(-4);
  if (prev.length < 2) return out;
  const limit = (prev.reduce((a, b) => a + b, 0) / prev.length) * WEEKLY_LOAD_MAX_INCREASE;
  const total = () =>
    (input.thisWeekLoad ?? 0) +
    slots.reduce((sum, s) => sum + (out[s] ? out[s]!.durationMin * plannedRpe(out[s]!.kind) : 0), 0);

  for (const s of ["C", "B", "A"] as CardioSlot[]) {
    if (total() <= limit) break;
    const p = out[s];
    if (!p || p.kind === "intervals") continue;
    const last = [...input.history].reverse().find((l) => l.slot === s && l.kind === p.kind);
    if (last && p.durationMin > last.durationMin) {
      p.durationMin = last.durationMin;
      p.reason = { code: "cardio_load_cap", text: "Veckobelastningen skulle öka mer än 10 % – samma tid som senast." };
    }
  }
  return out;
}

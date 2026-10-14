import type {
  CalibrationInput,
  EquipmentProfile,
  Exercise,
  Exposure,
  LoggedSet,
  ProgramExercise,
  Readiness,
  Reason,
  StrengthPrescription,
  StrengthReasonCode,
} from "../types";
import { bestSetE1rm, e1rm, repsFor, weightFor } from "./e1rm";
import { detectPlateau } from "./plateau";
import { progressionIncrement, round2, roundDown } from "./rounding";
import { warmupSets } from "./warmup";

export interface StrengthInput {
  exercise: Exercise;
  config: ProgramExercise;
  /** Earlier exposures of this exercise, oldest first. */
  history: Exposure[];
  equipment: EquipmentProfile;
  readiness?: Readiness | null;
  deload?: boolean;
  calibration?: CalibrationInput | null;
  /** Weekly volume adjustment (+/- sets) for this exercise. */
  setModifier?: number;
}

interface Base {
  weight: number;
  reps: number[];
  code: StrengthReasonCode;
  text: string;
}

export function readinessScore(r: Readiness): number {
  return (r.sleep + r.energy + r.soreness) / 3;
}

export function isLowReadiness(r?: Readiness | null): boolean {
  return !!r && readinessScore(r) <= 2.34;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });

/** A session counts as missed when one set is 2+ reps short or several sets fall below the range. */
export function isMiss(sets: LoggedSet[], repMin: number): boolean {
  const below = sets.filter((s) => s.reps < repMin);
  return below.length >= 2 || below.some((s) => s.reps <= repMin - 2);
}

function calibrate(input: StrengthInput, cal: CalibrationInput): Base {
  const { exercise, config, equipment } = input;
  const est = e1rm(cal.weight, cal.reps, cal.rir);
  let weight: number;
  if (exercise.equipment === "bodyweight" && cal.weight === 0) {
    weight = 0;
  } else {
    weight = roundDown(weightFor(est, config.repMin, config.rirMax), exercise, equipment);
  }
  return {
    weight,
    reps: [config.repMin],
    code: "calibrated",
    text: `Kalibrerad från ${fmt(cal.weight)} kg × ${cal.reps} @ RIR ${cal.rir}. Justera om det känns fel.`,
  };
}

function progress(input: StrengthInput, hist: Exposure[]): Base {
  const { exercise, config, equipment } = input;
  const last = hist[hist.length - 1];
  const working = last.sets;
  const w = last.weight;
  const rirOf = (s: LoggedSet) => s.rir ?? config.rirMin;

  // 1. Missed reps (clearly below the range; one rep short on a single set is normal fatigue).
  if (isMiss(working, config.repMin)) {
    let consecutive = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i];
      if (e.weight === w && isMiss(e.sets, config.repMin)) consecutive++;
      else break;
    }
    if (consecutive >= 2 && w > 0) {
      let newW = roundDown(w * 0.925, exercise, equipment);
      if (newW >= w) newW = Math.max(0, round2(w - progressionIncrement(exercise, equipment, w)));
      return {
        weight: newW,
        reps: [config.repMin],
        code: "reduce_after_misses",
        text: `Under ${config.repMin} reps två pass i rad – vikten sänks ${fmt(w)} → ${fmt(newW)} kg för att bygga upp igen.`,
      };
    }
    return {
      weight: w,
      reps: working.map((s) => Math.max(config.repMin, Math.min(config.repMax, s.reps))),
      code: "hold_after_miss",
      text: `Några set hamnade under ${config.repMin} reps – samma vikt, sikta på minst ${config.repMin}.`,
    };
  }

  const enoughSets = working.length >= Math.max(1, config.sets - 1);
  const allTop = enoughSets && working.every((s) => s.reps >= config.repMax);
  const rirOk = working.every((s) => rirOf(s) >= config.rirMin);
  const techOk = working.every((s) => s.techniqueOk !== false);

  // 2. Top of range reached with good reps in reserve → add load.
  if (allTop && rirOk && techOk) {
    const avgRir = working.reduce((a, s) => a + rirOf(s), 0) / working.length;
    const inc = progressionIncrement(exercise, equipment, w);
    let steps = avgRir >= config.rirMax + 2 ? 2 : 1;
    if (steps === 2 && w > 0 && (inc * 2) / w > 0.1) steps = 1;
    let newW = roundDown(w + inc * steps, exercise, equipment);
    if (newW <= w) newW = round2(w + inc * steps);
    const est = bestSetE1rm(working);
    const reps = clamp(repsFor(est, newW, config.rirMax), config.repMin, config.repMax);
    return {
      weight: newW,
      reps: [reps],
      code: steps === 2 ? "increase_weight_double" : "increase_weight",
      text:
        steps === 2
          ? `Alla set nådde ${config.repMax} reps med gott om marginal – dubbelt viktsteg ${fmt(w)} → ${fmt(newW)} kg.`
          : `Alla set nådde ${config.repMax} reps @ RIR ≥ ${config.rirMin} – vikten ökar ${fmt(w)} → ${fmt(newW)} kg.`,
    };
  }

  // 3. Top reached but too close to failure or poor technique → consolidate.
  if (allTop) {
    return {
      weight: w,
      reps: [config.repMax],
      code: "consolidate",
      text: !techOk
        ? `Topp av intervallet men tekniken var inte godkänd – samma vikt igen.`
        : `Topp av intervallet men under mål-RIR – samma vikt igen för att befästa.`,
    };
  }

  // 4. Double progression: add reps within the range.
  const reps = working.map((s) => {
    const r = rirOf(s);
    const add = r >= config.rirMax + 2 ? 2 : r < config.rirMin ? 0 : 1;
    return clamp(s.reps + add, config.repMin, config.repMax);
  });
  return {
    weight: w,
    reps,
    code: "add_reps",
    text: `Samma vikt – öka reps. Vikten höjs när alla set når ${config.repMax} reps.`,
  };
}

export function prescribeStrength(input: StrengthInput): StrengthPrescription {
  const { exercise, config, equipment } = input;
  const hist = input.history.filter((e) => !e.isDeload);
  const lastExposure = input.history[input.history.length - 1];
  let setCount = clamp(config.sets + (input.setModifier ?? 0), 1, 6);
  const notes: Reason[] = [];

  if (hist.length === 0 && !input.calibration) {
    return {
      exerciseId: exercise.id,
      status: "needs_calibration",
      weight: null,
      sets: Array.from({ length: setCount }, () => ({
        weight: null,
        reps: config.repMin,
        rirMin: config.rirMin,
        rirMax: config.rirMax,
      })),
      warmups: [],
      restSec: config.restSec,
      reason: {
        code: "needs_calibration",
        text: `Ingen historik. Välj en vikt du klarar ca ${config.repMin + config.rirMax} gånger, eller ange en nylig prestation.`,
      },
      notes,
      lastExposure,
      e1rm: null,
    };
  }

  let base = hist.length === 0 ? calibrate(input, input.calibration!) : progress(input, hist);
  let rirMin = config.rirMin;
  let rirMax = config.rirMax;

  if (input.deload) {
    base = {
      weight: roundDown(base.weight * 0.9, exercise, equipment),
      reps: [config.repMin],
      code: "deload",
      text: "Deloadvecka – lättare vikt, färre set och mer marginal. Progressionen fortsätter nästa vecka.",
    };
    setCount = Math.max(1, Math.round(setCount * 0.55));
    rirMin = 3;
    rirMax = 4;
  } else if (isLowReadiness(input.readiness)) {
    if ((base.code === "increase_weight" || base.code === "increase_weight_double") && lastExposure) {
      base = {
        weight: lastExposure.weight,
        reps: lastExposure.sets.map((s) => clamp(s.reps, config.repMin, config.repMax)),
        code: "low_readiness",
        text: "Låg återhämtning idag – viktökningen skjuts upp ett pass.",
      };
    }
    if (exercise.isCompound && setCount >= 3) {
      setCount -= 1;
      notes.push({ code: "low_readiness", text: "Ett set mindre idag p.g.a. låg återhämtning." });
    }
  }

  const sets = Array.from({ length: setCount }, (_, i) => ({
    weight: base.weight,
    reps: base.reps[Math.min(i, base.reps.length - 1)],
    rirMin,
    rirMax,
  }));

  const plateau = input.deload ? undefined : detectPlateau(hist);
  if (plateau) notes.push({ code: `plateau_${plateau.action}`, text: plateau.text });

  return {
    exerciseId: exercise.id,
    status: "ready",
    weight: base.weight,
    sets,
    warmups: warmupSets(exercise, equipment, base.weight),
    restSec: config.restSec,
    reason: { code: base.code, text: base.text },
    notes,
    plateau,
    lastExposure,
    e1rm: hist.length ? bestSetE1rm(hist[hist.length - 1].sets) : null,
  };
}

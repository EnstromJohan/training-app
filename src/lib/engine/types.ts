// Domain types shared by all engines. Engines are pure functions: data in, recommendation out.

export type Muscle =
  | "chest"
  | "back"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "adductors"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "calves"
  | "core";

export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "plate_machine" | "bodyweight";

/** How much the exercise loads the Achilles tendon. Gated by rehab phase. */
export type AchillesLoad = "none" | "low" | "moderate" | "high";

export interface Exercise {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  isCompound: boolean;
  lowerBody: boolean;
  achillesLoad: AchillesLoad;
  /** Overrides the default load increment for the equipment type. */
  incrementKg?: number;
  alternatives: string[];
  instructions: string[];
  tips: string[];
}

export interface EquipmentProfile {
  barbellKg: number;
  /** Smallest total increment possible on a barbell (two smallest plates). */
  barbellStepKg: number;
  dumbbellStepKg: number;
  cableStepKg: number;
  machineStepKg: number;
  plateMachineStepKg: number;
  /** Where training happens; informational for now (stored with equipment). */
  environment?: "gym" | "home" | "outdoor";
}

export const DEFAULT_EQUIPMENT: EquipmentProfile = {
  barbellKg: 20,
  barbellStepKg: 2.5,
  dumbbellStepKg: 2,
  cableStepKg: 2.5,
  machineStepKg: 5,
  plateMachineStepKg: 5,
};

/** One prescribed slot in a program day. */
export interface ProgramExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSec: number;
  supersetGroup?: string;
}

export type SessionCategory = "chest_back" | "legs" | "shoulders_arms";

export interface ProgramDay {
  id: string;
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  name: string;
  subtitle: string;
  category: SessionCategory | "rest";
  cardioSlot?: CardioSlot;
  exercises: ProgramExercise[];
}

export interface LoggedSet {
  weight: number;
  reps: number;
  /** null = not reported, interpreted as "on target". */
  rir: number | null;
  techniqueOk?: boolean;
}

/** All working sets of one exercise in one session. */
export interface Exposure {
  date: string; // ISO date
  weight: number;
  sets: LoggedSet[];
  isDeload?: boolean;
}

export interface Readiness {
  sleep: number; // 1–5
  energy: number; // 1–5
  soreness: number; // 1–5, 5 = no soreness
  /** Hours slept last night (optional, for the sleep insight). */
  sleepHours?: number | null;
}

export interface CalibrationInput {
  weight: number;
  reps: number;
  rir: number;
}

export type StrengthReasonCode =
  | "needs_calibration"
  | "calibrated"
  | "increase_weight"
  | "increase_weight_double"
  | "add_reps"
  | "consolidate"
  | "hold_after_miss"
  | "reduce_after_misses"
  | "deload"
  | "low_readiness";

export interface Reason {
  code: string;
  text: string;
}

export type PlateauAction = "change_rep_range" | "swap_variation" | "reduce_volume";

export interface PlateauInfo {
  exposures: number;
  action: PlateauAction;
  text: string;
}

export interface PrescribedSet {
  weight: number | null;
  reps: number;
  rirMin: number;
  rirMax: number;
}

export interface WarmupSet {
  weight: number;
  reps: number;
}

export interface StrengthPrescription {
  exerciseId: string;
  status: "needs_calibration" | "ready";
  weight: number | null;
  sets: PrescribedSet[];
  warmups: WarmupSet[];
  restSec: number;
  reason: Reason;
  /** Extra notes (readiness, plateau etc.) */
  notes: Reason[];
  plateau?: PlateauInfo;
  lastExposure?: Exposure;
  e1rm: number | null;
}

// ---------- Cardio ----------

export type CardioSlot = "A" | "B" | "C";
export type CardioKind = "z2" | "long_z2" | "intervals";
export type CardioModality = "bike" | "crosstrainer" | "rower" | "walk" | "incline_walk" | "run";

export interface IntervalSpec {
  reps: number;
  workSec: number;
  restSec: number;
}

export interface CardioPrescription {
  slot: CardioSlot;
  kind: CardioKind;
  modality: CardioModality;
  durationMin: number;
  rpeMin: number;
  rpeMax: number;
  /** Watts on bike/rower, level on crosstrainer, km/h on treadmill. null = pick by feel. */
  intensity: number | null;
  inclinePct?: number;
  intervals?: IntervalSpec;
  reason: Reason;
  notes: Reason[];
}

export interface CardioLog {
  date: string;
  slot: CardioSlot;
  kind: CardioKind;
  modality: CardioModality;
  durationMin: number;
  completed: boolean;
  rpe: number; // 1–10, whole session (or work bouts for intervals)
  talkTestOk?: boolean;
  intensity?: number | null;
  inclinePct?: number;
  distanceKm?: number;
  avgHr?: number;
  intervals?: IntervalSpec;
}

// ---------- Rehab ----------

export interface RehabLog {
  date: string;
  phase: number;
  level: number;
  completed: boolean;
  painDuring: number; // 0–10
  /** Filled in next morning; null until then. */
  painNextMorning: number | null;
}

export interface RehabState {
  phase: number;
  /** ISO date the current phase started; logs before it don't count. */
  phaseStartedAt: string;
  /** Morning pain/stiffness baseline 0–10. */
  baselineMorningPain: number;
  runningCleared: boolean;
  /** Phases the physio has approved (user confirmed). */
  approvedPhases: number[];
}

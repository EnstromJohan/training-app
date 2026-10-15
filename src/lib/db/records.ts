import type {
  CardioKind,
  CardioModality,
  CardioPrescription,
  CardioSlot,
  EquipmentProfile,
  IntervalSpec,
  Readiness,
  RehabState,
  StrengthPrescription,
} from "../engine/types";

/** Every persisted record. Logs are append-only; deletion is soft. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WorkoutSessionRec extends BaseRecord {
  date: string;
  programDayId: string;
  status: "in_progress" | "completed" | "skipped";
  readiness: Readiness | null;
  sessionRpe: number | null;
  deload: boolean;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
}

export interface SessionExerciseRec extends BaseRecord {
  sessionId: string;
  exerciseId: string;
  /** Exercise originally in the program slot (differs when substituted). */
  slotExerciseId: string;
  position: number;
  /** Snapshot of what the engine recommended, so history shows the advice given. */
  prescription: StrengthPrescription;
}

export interface SetLogRec extends BaseRecord {
  sessionId: string;
  sessionExerciseId: string;
  exerciseId: string;
  setIndex: number;
  kind: "warmup" | "working";
  targetWeight: number | null;
  targetReps: number | null;
  targetRirMin: number | null;
  targetRirMax: number | null;
  weight: number;
  reps: number;
  rir: number | null;
  techniqueOk: boolean;
  completedAt: string;
}

export interface CardioSessionRec extends BaseRecord {
  date: string;
  workoutSessionId: string | null;
  slot: CardioSlot;
  kind: CardioKind;
  modality: CardioModality;
  durationMin: number;
  completed: boolean;
  rpe: number;
  talkTestOk: boolean | null;
  intensity: number | null;
  inclinePct: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  intervals: IntervalSpec | null;
  prescription: CardioPrescription | null;
}

export interface RehabLogRec extends BaseRecord {
  date: string;
  phase: number;
  level: number;
  completed: boolean;
  painDuring: number;
  painNextMorning: number | null;
}

export interface CalibrationRec extends BaseRecord {
  exerciseId: string;
  date: string;
  weight: number;
  reps: number;
  rir: number;
}

export interface SettingsRec extends BaseRecord {
  onboarded: boolean;
  name: string;
  birthYear: number | null;
  bodyWeightKg: number | null;
  restingHr: number | null;
  maxHr: number | null;
  experience: "beginner" | "intermediate" | "advanced";
  goal: "hypertrophy" | "strength" | "conditioning" | "recovery" | "performance" | "health";
  equipment: EquipmentProfile;
  rehab: RehabState;
  /** Permanent swaps: program exercise id → replacement exercise id. */
  substitutions: Record<string, string>;
  /** Weekly volume adjustments: exercise id → +/- sets. */
  volumeModifiers: Record<string, number>;
  /** Week starts (ISO Monday) marked as deload weeks. */
  deloadWeeks: string[];
  cardioPreferred: Partial<Record<CardioSlot, CardioModality>>;
}

export interface BodyMeasurementRec extends BaseRecord {
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  hipsCm: number | null;
  notes: string | null;
}

export type PhotoPose = "front" | "side" | "back";

/** Progress photo metadata. The image itself lives in IndexedDB (photo_blobs) and Supabase Storage. */
export interface ProgressPhotoRec extends BaseRecord {
  date: string;
  pose: PhotoPose;
  width: number;
  height: number;
  /** Path in the private `progress-photos` bucket once uploaded. */
  storagePath: string | null;
}

export interface MobilityLogRec extends BaseRecord {
  date: string;
  kind: "mobility" | "prehab";
  itemIds: string[];
  completed: boolean;
}

export interface Tables {
  workout_sessions: WorkoutSessionRec;
  session_exercises: SessionExerciseRec;
  set_logs: SetLogRec;
  cardio_sessions: CardioSessionRec;
  rehab_logs: RehabLogRec;
  calibrations: CalibrationRec;
  settings: SettingsRec;
  body_measurements: BodyMeasurementRec;
  progress_photos: ProgressPhotoRec;
  mobility_logs: MobilityLogRec;
}

export type TableName = keyof Tables;

export const TABLES: TableName[] = [
  "workout_sessions",
  "session_exercises",
  "set_logs",
  "cardio_sessions",
  "rehab_logs",
  "calibrations",
  "settings",
  "body_measurements",
  "progress_photos",
  "mobility_logs",
];

export const SETTINGS_ID = "00000000-0000-4000-8000-000000000001";

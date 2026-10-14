import type { ProgramDay, ProgramExercise } from "../engine/types";

const p = (
  exerciseId: string,
  sets: number,
  repMin: number,
  repMax: number,
  rirMin: number,
  rirMax: number,
  restSec: number,
  supersetGroup?: string,
): ProgramExercise => ({ exerciseId, sets, repMin, repMax, rirMin, rirMax, restSec, supersetGroup });

/** The 6-day split. A = heavier (6–10), B = hypertrophy (8–15) with different angles. */
export const PROGRAM: ProgramDay[] = [
  {
    id: "cb-a",
    weekday: 1,
    name: "Bröst + Rygg A",
    subtitle: "Styrka + Cardio",
    category: "chest_back",
    cardioSlot: "A",
    exercises: [
      p("bench-press", 4, 6, 8, 1, 2, 150),
      p("chest-supported-row", 4, 6, 8, 1, 2, 150),
      p("incline-db-press", 3, 8, 12, 1, 2, 120),
      p("lat-pulldown", 3, 8, 12, 1, 2, 120),
      p("cable-fly", 2, 12, 15, 1, 1, 75),
    ],
  },
  {
    id: "legs-a",
    weekday: 2,
    name: "Ben A",
    subtitle: "Styrka",
    category: "legs",
    exercises: [
      p("hack-squat", 4, 6, 10, 2, 2, 150),
      p("romanian-deadlift", 3, 8, 10, 2, 2, 150),
      p("leg-extension", 3, 10, 15, 1, 1, 90),
      p("lying-leg-curl", 3, 10, 12, 1, 1, 90),
      p("adductor-machine", 2, 12, 15, 1, 1, 75),
    ],
  },
  {
    id: "sa-a",
    weekday: 3,
    name: "Axlar + Armar A",
    subtitle: "Styrka + Cardio",
    category: "shoulders_arms",
    cardioSlot: "B",
    exercises: [
      p("seated-bb-press", 3, 6, 8, 1, 2, 150),
      p("db-lateral-raise", 4, 12, 20, 1, 1, 60),
      p("barbell-curl", 3, 8, 10, 1, 1, 90),
      p("close-grip-bench", 3, 8, 10, 1, 2, 120),
      p("reverse-pec-deck", 3, 12, 20, 1, 1, 60),
      p("hammer-curl", 2, 10, 15, 1, 1, 60, "ss1"),
      p("triceps-pushdown", 2, 10, 15, 1, 1, 60, "ss1"),
    ],
  },
  {
    id: "cb-b",
    weekday: 4,
    name: "Bröst + Rygg B",
    subtitle: "Styrka",
    category: "chest_back",
    exercises: [
      p("incline-bb-press", 3, 8, 10, 1, 2, 120),
      p("chin-up", 3, 6, 10, 1, 2, 120),
      p("machine-chest-press", 3, 10, 12, 1, 1, 90),
      p("seated-cable-row", 3, 10, 12, 1, 1, 90),
      p("pec-deck", 2, 12, 15, 0, 1, 75),
      p("one-arm-db-row", 2, 10, 12, 1, 1, 90),
    ],
  },
  {
    id: "legs-b",
    weekday: 5,
    name: "Ben B",
    subtitle: "Styrka",
    category: "legs",
    exercises: [
      p("leg-press", 3, 10, 15, 1, 2, 120),
      p("hip-thrust", 3, 8, 12, 1, 2, 120),
      p("seated-leg-curl", 3, 10, 15, 1, 1, 90),
      p("single-leg-extension", 2, 12, 15, 1, 1, 75),
      p("back-extension", 2, 10, 15, 2, 2, 75),
    ],
  },
  {
    id: "sa-b",
    weekday: 6,
    name: "Axlar + Armar B",
    subtitle: "Styrka + Cardio",
    category: "shoulders_arms",
    cardioSlot: "C",
    exercises: [
      p("seated-db-press", 3, 8, 12, 1, 2, 120),
      p("cable-lateral-raise", 3, 12, 20, 1, 1, 60),
      p("incline-db-curl", 3, 10, 12, 1, 1, 75),
      p("overhead-cable-triceps", 3, 10, 15, 1, 1, 75),
      p("face-pull", 2, 12, 15, 1, 1, 60),
      p("preacher-curl", 2, 12, 15, 0, 1, 60),
    ],
  },
  {
    id: "rest",
    weekday: 7,
    name: "Vila / Återhämtning",
    subtitle: "Promenad + rehab",
    category: "rest",
    exercises: [],
  },
];

export const PROGRAM_BY_ID: Record<string, ProgramDay> = Object.fromEntries(PROGRAM.map((d) => [d.id, d]));

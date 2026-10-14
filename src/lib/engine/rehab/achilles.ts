import type { AchillesLoad, Reason, RehabLog, RehabState } from "../types";

export interface RehabExercise {
  id: string;
  name: string;
  dose: string;
  sets: number;
  reps?: number;
  holdSec?: number;
  cue: string;
}

export interface RehabPhase {
  phase: number;
  name: string;
  goal: string;
  requiresClearance: boolean;
  levels: RehabExercise[][];
}

const ex = (id: string, name: string, sets: number, amount: { reps?: number; holdSec?: number }, cue: string): RehabExercise => ({
  id,
  name,
  sets,
  ...amount,
  dose: amount.holdSec ? `${sets} × ${amount.holdSec} s` : `${sets} × ${amount.reps} reps`,
  cue,
});

/**
 * Standard, conservative post-op Achilles loading ladder (isometric → bilateral →
 * unilateral → heavy slow → plyometric prep). Must be approved by a physio.
 */
export const ACHILLES_PHASES: RehabPhase[] = [
  {
    phase: 1,
    name: "Isometrisk start",
    goal: "Smärtfri tolerans och rörlighet",
    requiresClearance: false,
    levels: [
      [ex("iso-seated", "Isometrisk sittande vadpress", 5, { holdSec: 30 }, "Ca 50 % ansträngning, jämn press."), ex("ankle-rom", "Aktiv fotledsrörlighet", 2, { reps: 15 }, "Lugna rörelser i smärtfritt rörelseomfång.")],
      [ex("iso-seated", "Isometrisk sittande vadpress", 5, { holdSec: 45 }, "Ca 50–60 % ansträngning."), ex("ankle-rom", "Aktiv fotledsrörlighet", 2, { reps: 15 }, "Lugna rörelser.")],
      [ex("iso-seated", "Isometrisk sittande vadpress", 5, { holdSec: 45 }, "Ca 70 % ansträngning."), ex("seated-raise", "Sittande tåhävningar", 3, { reps: 15 }, "Full rörelse, 2 s upp och 2 s ner.")],
    ],
  },
  {
    phase: 2,
    name: "Tåhävningar två ben",
    goal: "Bygga grundstyrka bilateralt",
    requiresClearance: false,
    levels: [
      [ex("bilateral-raise", "Tåhävningar två ben, golv", 3, { reps: 10 }, "Jämn vikt på båda fötterna."), ex("iso-standing", "Isometrisk hållning, stående", 3, { holdSec: 30 }, "Halvvägs upp, håll stilla.")],
      [ex("bilateral-raise", "Tåhävningar två ben, golv", 3, { reps: 15 }, "3 s upp, 3 s ner."), ex("iso-standing", "Isometrisk hållning, stående", 3, { holdSec: 30 }, "Halvvägs upp.")],
      [ex("bilateral-step", "Tåhävningar två ben på steg", 3, { reps: 15 }, "Sänk hälen kontrollerat under stegnivå."), ex("iso-standing", "Isometrisk hållning, stående", 3, { holdSec: 45 }, "Halvvägs upp.")],
    ],
  },
  {
    phase: 3,
    name: "Enbensstyrka",
    goal: "Lika stark som friska sidan",
    requiresClearance: false,
    levels: [
      [ex("single-raise", "Enbens tåhävningar, golv", 3, { reps: 8 }, "Stöd med händerna för balans."), ex("seated-calf", "Sittande vadpress med vikt", 3, { reps: 12 }, "Kontrollerat, full rörelse.")],
      [ex("single-raise", "Enbens tåhävningar, golv", 3, { reps: 12 }, "3 s upp, 3 s ner."), ex("seated-calf", "Sittande vadpress med vikt", 3, { reps: 12 }, "Öka vikten när 12 reps är lätt.")],
      [ex("single-step", "Enbens tåhävningar på steg", 3, { reps: 15 }, "Full rörelse under stegnivå."), ex("seated-calf", "Sittande vadpress med vikt", 3, { reps: 10 }, "Tyngre.")],
    ],
  },
  {
    phase: 4,
    name: "Tung, långsam belastning",
    goal: "Senans kapacitet och styvhet",
    requiresClearance: false,
    levels: [
      [ex("standing-calf", "Stående vadpress, maskin", 3, { reps: 15 }, "3 s upp, 3 s ner."), ex("eccentric-step", "Excentriska tåhävningar på steg", 3, { reps: 12 }, "Upp på två ben, ner på ett.")],
      [ex("standing-calf", "Stående vadpress, maskin", 3, { reps: 12 }, "Tyngre, 3 s upp och 3 s ner."), ex("eccentric-step", "Excentriska tåhävningar på steg", 3, { reps: 12 }, "Med lätt extra vikt.")],
      [ex("standing-calf", "Stående vadpress, maskin", 4, { reps: 8 }, "Tungt, långsamt."), ex("iso-standing", "Isometrisk hållning", 3, { holdSec: 30 }, "Tungt, halvvägs upp.")],
    ],
  },
  {
    phase: 5,
    name: "Plyometrisk förberedelse",
    goal: "Tåla hopp och löpning",
    requiresClearance: true,
    levels: [
      [ex("pogo", "Pogo-hopp, två ben", 3, { holdSec: 20 }, "Låga, snabba studsar.")],
      [ex("rope", "Hopprep", 3, { holdSec: 30 }, "Mjuka landningar.")],
      [ex("pogo-single", "Pogo-hopp, ett ben", 3, { reps: 10 }, "Bara vid full kontroll.")],
    ],
  },
];

export const ACCEPTABLE_PAIN_DURING = 5;

export interface RehabPlan {
  phase: RehabPhase;
  level: number; // 1-based
  exercises: RehabExercise[];
  reason: Reason;
  /** Morning-after check pending for the latest session. */
  needsMorningCheck: boolean;
  /** At top level with good tolerance – suggest next phase (requires physio approval). */
  suggestPhaseAdvance: boolean;
}

function isBad(log: RehabLog, baseline: number) {
  return log.painDuring > ACCEPTABLE_PAIN_DURING || (log.painNextMorning != null && log.painNextMorning > baseline + 1);
}

/**
 * Silbernagel-style pain monitoring, replayed over the logs of the current phase so the
 * level is always derivable from history: two tolerated sessions → next level,
 * one poorly tolerated session → one level down.
 */
export function planRehab(state: RehabState, logs: RehabLog[]): RehabPlan {
  const phase = ACHILLES_PHASES.find((p) => p.phase === state.phase) ?? ACHILLES_PHASES[0];
  const maxLevel = phase.levels.length;
  const relevant = logs
    .filter((l) => l.completed && l.phase === phase.phase && l.date >= state.phaseStartedAt)
    .sort((a, b) => a.date.localeCompare(b.date));

  let level = 1;
  let okStreak = 0;
  let reason: Reason = { code: "rehab_start", text: `Fas ${phase.phase}: ${phase.goal.toLowerCase()}. Smärta upp till 5/10 under övningen är ok.` };
  for (const log of relevant) {
    if (isBad(log, state.baselineMorningPain)) {
      const was = level;
      level = Math.max(1, level - 1);
      okStreak = 0;
      reason = {
        code: "rehab_regress",
        text:
          was > 1
            ? "Senan reagerade (smärta > 5 eller sämre morgonen efter) – ett steg tillbaka."
            : "Senan reagerade – håll nivån. Kontakta fysio om det kvarstår.",
      };
    } else if (log.painNextMorning != null) {
      okStreak++;
      if (okStreak >= 2 && level < maxLevel) {
        level++;
        okStreak = 0;
        reason = { code: "rehab_progress", text: "Två pass väl tolererade – nästa nivå." };
      } else {
        reason = { code: "rehab_hold", text: "Väl tolererat – samma nivå ett pass till." };
      }
    }
  }

  const last = relevant[relevant.length - 1];
  const nextPhase = ACHILLES_PHASES.find((p) => p.phase === phase.phase + 1);
  const suggestPhaseAdvance =
    !!nextPhase && level === maxLevel && okStreak >= 2 && !!last && !isBad(last, state.baselineMorningPain);

  return {
    phase,
    level,
    exercises: phase.levels[level - 1],
    reason: suggestPhaseAdvance
      ? { code: "rehab_phase_ready", text: `Redo för fas ${nextPhase!.phase} (${nextPhase!.name}) – kräver godkännande från fysio.` }
      : reason,
    needsMorningCheck: !!last && last.painNextMorning == null,
    suggestPhaseAdvance,
  };
}

/** Whether a strength or cardio exercise with this Achilles load is allowed now. */
export function achillesAllowed(load: AchillesLoad, rehab: Pick<RehabState, "phase" | "runningCleared">): boolean {
  switch (load) {
    case "none":
    case "low":
      return true;
    case "moderate":
      return rehab.phase >= 4;
    case "high":
      return rehab.phase >= 5 && rehab.runningCleared;
  }
}

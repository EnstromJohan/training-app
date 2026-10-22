import type { Transition } from "motion/react";

/** Shared motion tokens – use these instead of ad-hoc values so the app moves consistently. */
export const spring = {
  /** Controls reacting to a press or drag: fast, barely any overshoot. */
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  /** Larger surfaces (overlays, figures): calmer settle. */
  soft: { type: "spring", stiffness: 200, damping: 26 },
} satisfies Record<string, Transition>;

export const ease = {
  out: [0.2, 0.7, 0.2, 1],
} as const;

/** Screen change (app/template.tsx). */
export const pageIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: ease.out },
} as const;

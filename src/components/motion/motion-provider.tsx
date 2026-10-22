"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

const loadFeatures = () => import("./features").then((r) => r.default);

/**
 * App-wide motion setup: honours the OS "reduce motion" setting, and loads Motion's feature code
 * lazily (components use the light `m.*` elements from "motion/react-m").
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

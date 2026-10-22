"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../ui";

const format = (n: number, decimals: number) =>
  n.toLocaleString("sv-SE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * A number that counts to its new value (from the previous one) instead of jumping – and up from 0
 * when it first appears. Writes the text straight to the DOM while animating, so React doesn't
 * re-render ~60 times a second.
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 0.7,
  fromZero = true,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  /** Count up from 0 on mount (screen entrance). */
  fromZero?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(fromZero ? 0 : value);
  const reduce = useReducedMotion();
  // React renders only the first value; later values are written by the effect, so React never
  // fights the animation over the text node.
  const [initial] = useState(() => format(fromZero ? 0 : value, decimals));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current;
    if (from === value || reduce) {
      shown.current = value;
      el.textContent = format(value, decimals);
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = format(v, decimals);
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => controls.stop();
  }, [value, decimals, duration, reduce]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {initial}
    </span>
  );
}

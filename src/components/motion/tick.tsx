"use client";

import * as m from "motion/react-m";
import { useState, type ReactNode } from "react";
import { spring } from "@/lib/motion";

/**
 * Small "tick" when a value changes: the new value slides in from the direction it moved
 * (up when it increased) – transform and opacity only.
 */
export function Tick({ value, children, className }: { value: number; children: ReactNode; className?: string }) {
  // Remember the previous value in state (updated during render, React's pattern for "derive from
  // the last prop"), so the direction survives double rendering in development.
  const [last, setLast] = useState({ value, dir: 0 });
  if (last.value !== value) setLast({ value, dir: value > last.value ? 1 : -1 });
  const dir = last.value !== value ? (value > last.value ? 1 : -1) : last.dir;
  return (
    <m.span
      key={value}
      initial={dir === 0 ? false : { y: dir * 8, opacity: 0.35, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={spring.snappy}
      className={className ?? "inline-block"}
    >
      {children}
    </m.span>
  );
}

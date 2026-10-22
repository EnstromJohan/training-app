"use client";

import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useId, useState, type ReactNode } from "react";
import type { Muscle } from "@/lib/engine/types";
import { BACK, FRONT, SKIN_PARTS, type Part } from "../anatomy";
import { Segmented } from "../ui";

export type HeatGroup = { key: string; label: string; muscles: Muscle[]; sets: number };

const MIN_OPACITY = 0.12;

/**
 * Anatomy heatmap: each muscle group's fill strength follows its sets relative to the busiest
 * group. Tapping a muscle selects its group (shared with the list below); the selected group
 * pulses – the only continuous motion in the app. Front/back flips with a rotateY.
 */
export function MuscleHeatmap({
  data,
  selected,
  onSelect,
  className,
  children,
}: {
  data: HeatGroup[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Figure height area, e.g. "h-[340px]". */
  className?: string;
  /** Overlays positioned over the figure (labels). */
  children?: ReactNode;
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const max = Math.max(1, ...data.map((g) => g.sets));
  const groupOf = new Map<Muscle, HeatGroup>();
  for (const g of data) for (const mu of g.muscles) groupOf.set(mu, g);
  const parts = view === "front" ? FRONT : BACK;

  const draw = (p: Part, i: number) => {
    const g = p.m ? groupOf.get(p.m) : undefined;
    const level = g ? MIN_OPACITY + (1 - MIN_OPACITY) * Math.min(1, g.sets / max) : 0;
    const on = !!g && g.key === selected;
    const dimmed = selected != null && !on;
    return (
      <g key={i}>
        <path d={p.d} fill="var(--muscle)" />
        {g && (
          <m.path
            d={p.d}
            fill="var(--accent)"
            filter={g.sets > 0 ? `url(#glow-${uid})` : undefined}
            initial={{ fillOpacity: 0 }}
            animate={{ fillOpacity: dimmed ? level * 0.45 : level, opacity: on && !reduce ? [1, 0.7, 1] : 1 }}
            transition={{
              fillOpacity: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] },
              opacity: on && !reduce ? { duration: 1.6, ease: "easeInOut", repeat: Infinity } : { duration: 0.2 },
            }}
            onClick={() => onSelect(on ? null : g.key)}
            className="cursor-pointer"
          />
        )}
        <path d={p.d} fill={`url(#shade-${uid})`} stroke="#0b0b0b" strokeWidth={1.3} strokeLinejoin="round" pointerEvents="none" />
      </g>
    );
  };

  return (
    <div>
      <div className={`relative ${className ?? "h-[340px]"}`} style={{ perspective: 900 }}>
        <AnimatePresence mode="wait" initial={false}>
          <m.svg
            key={view}
            viewBox="24 6 152 400"
            role="img"
            aria-label={`Muskelkarta, ${view === "front" ? "framsida" : "baksida"}`}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
            className="mx-auto h-full w-auto"
          >
            <defs>
              <linearGradient id={`shade-${uid}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity={0.35} />
              </linearGradient>
              <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g fill="#232120">{SKIN_PARTS}</g>
            <g>{parts.map(draw)}</g>
            <g transform="translate(200,0) scale(-1,1)">{parts.map(draw)}</g>
          </m.svg>
        </AnimatePresence>
        {children}
      </div>
      <div className="mt-2 flex justify-center">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "front", label: "Framsida" },
            { value: "back", label: "Baksida" },
          ]}
        />
      </div>
    </div>
  );
}

"use client";

import * as m from "motion/react-m";
import type { Variants } from "motion/react";
import { spring } from "@/lib/motion";
import { cn } from "../ui";

export type WeekBar = {
  key: string;
  label: string;
  /** Accessible name, e.g. "Måndag". */
  name: string;
  value: number;
  today?: boolean;
  /** Trained but without volume (cardio/rehab only): shown as a dot. */
  marked?: boolean;
  future?: boolean;
};

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
// Bars grow from the baseline with scaleY (transform), not height, to stay on the compositor.
const bar: Variants = { hidden: { scaleY: 0 }, show: (s: number) => ({ scaleY: s, transition: spring.soft }) };

/** Week of bars. Tapping one selects that day (tap again to go back to the whole week). */
export function WeekBars({ data, selected, onSelect }: { data: WeekBar[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <m.ul variants={list} initial="hidden" animate="show" className="grid grid-cols-7 gap-1.5">
      {data.map((d) => {
        const on = selected === d.key;
        const dim = selected != null && !on;
        const scale = d.value > 0 ? Math.max(0.22, d.value / max) : 0;
        return (
          <li key={d.key}>
            <button
              type="button"
              aria-pressed={on}
              aria-label={`${d.name}${d.value > 0 ? `, ${Math.round(d.value).toLocaleString("sv-SE")} kg` : ""}`}
              onClick={() => onSelect(on ? null : d.key)}
              className="flex w-full flex-col items-center gap-1.5"
            >
              <div
                className={cn(
                  "relative flex h-16 w-full items-end justify-center overflow-hidden rounded-[9px] border bg-[#101010] transition-colors",
                  on ? "border-accent" : d.today ? "border-accent/50" : "border-line",
                )}
              >
                {d.value > 0 ? (
                  <m.div
                    variants={bar}
                    custom={scale}
                    style={{ originY: 1 }}
                    className={cn("bg-accent-grad absolute inset-x-0 bottom-0 h-full rounded-[7px] transition-opacity", on && "glow-soft", dim && "opacity-45")}
                  />
                ) : (
                  <span className={cn("mb-3 size-1.5 rounded-full", d.marked ? "bg-accent" : d.future ? "bg-[#3a3a3a]" : "bg-[#2a2a2a]")} />
                )}
              </div>
              <span className={cn("text-[11px]", on || d.today ? "font-semibold text-accent" : "text-muted")}>{d.label}</span>
            </button>
          </li>
        );
      })}
    </m.ul>
  );
}

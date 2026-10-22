"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Dumbbell, Footprints, HeartPulse } from "lucide-react";
import { SwipeToConfirm } from "@/components/motion/swipe-to-confirm";
import { cardioPrescriptionFor, dayMinutes, rehabPlan, type TodayParts } from "@/lib/coach";
import { pickParts, type DayPart } from "@/lib/day-parts";
import { MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import { useStore, today } from "@/lib/store";
import { cn } from "./ui";

const KIND_LABEL = { z2: "Zone 2", long_z2: "Långpass", intervals: "Intervaller" } as const;

/**
 * Today's strength, cardio and rehab as separate parts. Pick the ones to do now – e.g. cardio and
 * rehab in the morning, strength in the evening – or all of them in one go.
 */
export function DayPartsCard({ parts, onStartStrength }: { parts: TodayParts; onStartStrength: () => void }) {
  const { s } = useStore();
  const router = useRouter();
  const t = today();

  const rows: { part: DayPart; icon: typeof Dumbbell; title: string; sub: string; done: boolean }[] = [];
  if (parts.strength) {
    const [lo, hi] = dayMinutes(s, parts.strength.day, t);
    rows.push({ part: "strength", icon: Dumbbell, title: parts.strength.day.name, sub: hi > 0 ? `Styrka · ${lo}–${hi} min` : "Styrka", done: parts.strength.done });
  }
  if (parts.cardio) {
    const p = parts.cardio.done ? null : cardioPrescriptionFor(s, t, parts.cardio.slot);
    rows.push({
      part: "cardio",
      icon: HeartPulse,
      title: `Cardio ${parts.cardio.slot}`,
      sub: p ? `${KIND_LABEL[p.kind]} · ${MODALITY_LABEL[p.modality]} · ${p.durationMin} min` : "Cardio",
      done: parts.cardio.done,
    });
  }
  const rehab = rehabPlan(s);
  rows.push({
    part: "rehab",
    icon: Footprints,
    title: "Hälsene-rehab",
    sub: `Fas ${rehab.phase.phase} · ${rehab.exercises.length} övningar`,
    done: parts.rehab.done,
  });

  const open = rows.filter((r) => !r.done).map((r) => r.part);
  const [picked, setPicked] = useState<DayPart[]>(open);
  const chosen = picked.filter((p) => open.includes(p));
  const toggle = (part: DayPart) => setPicked(picked.includes(part) ? picked.filter((p) => p !== part) : [...picked, part]);

  const start = () => {
    pickParts(t, chosen);
    // Strength first (rehab fits between sets, cardio follows); otherwise cardio warms up for the rehab.
    if (chosen.includes("strength")) onStartStrength();
    else if (chosen.includes("cardio")) router.push("/cardio");
    else router.push("/rehab");
  };

  return (
    <div className="surface rounded-[20px] p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold">Dagens träning</h2>
        {open.length > 1 && <span className="text-[12px] text-muted">Välj vad du kör nu</span>}
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(({ part, icon: Icon, title, sub, done }) => {
          const on = !done && chosen.includes(part);
          return (
            <button
              key={part}
              disabled={done}
              aria-pressed={on}
              onClick={() => toggle(part)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[16px] border p-3 text-left transition-colors",
                on ? "border-accent/60 bg-accent-soft" : "border-line bg-card-2",
                done && "opacity-60",
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full border", on ? "border-accent/50 text-accent" : "border-line text-ink-2")}>
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{title}</span>
                <span className="block truncate text-[12px] text-muted">
                  {done ? "Klart idag" : part === "rehab" && on && chosen.includes("strength") ? `${sub} · mellan seten` : sub}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  done ? "border-good bg-good text-[#06140b]" : on ? "border-accent bg-accent text-on-accent" : "border-line",
                )}
              >
                {(done || on) && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      {open.length > 0 && (
        <SwipeToConfirm
          className="mt-4"
          disabled={chosen.length === 0}
          label={chosen.length === 0 ? "Välj minst en del" : chosen.length === open.length ? "Svep för att starta" : `Svep för att starta ${chosen.length === 1 ? "1 del" : `${chosen.length} delar`}`}
          onConfirm={start}
        />
      )}
    </div>
  );
}

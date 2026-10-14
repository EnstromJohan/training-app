"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { rehabPlan } from "@/lib/coach";
import { useStore, today } from "@/lib/store";
import { Sheet, cn } from "../ui";

export function RehabSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s } = useStore();
  const plan = rehabPlan(s);
  const storageKey = `rehab-done:${today()}`;
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Rehab · fas ${plan.phase.phase}, nivå ${plan.level}`}>
      <p className="mb-3 text-sm text-ink-2">{plan.reason.text}</p>
      <div className="space-y-2">
        {plan.exercises.map((e, i) => (
          <button key={e.id + i} onClick={() => toggle(e.id)} className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left">
            <span className="tabular flex size-8 items-center justify-center rounded-full bg-card-2 text-sm">{i + 1}</span>
            <div className="flex-1">
              <div className="text-sm font-medium">{e.name}</div>
              <div className="text-xs text-muted">{e.dose} · {e.cue}</div>
            </div>
            <span className={cn("flex size-6 items-center justify-center rounded-full", done.includes(e.id) ? "bg-good text-white" : "border border-line")}>
              {done.includes(e.id) && <Check size={14} />}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Smärta upp till 5/10 under övningen är ok. Du anger smärtan när du avslutar passet, och morgonen efter.</p>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { rehabPlan } from "@/lib/coach";
import { useStore, today } from "@/lib/store";
import { IMAGES, Photo } from "../photo";
import { CheckDot, Sheet } from "../ui";

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
          <button key={e.id + i} onClick={() => toggle(e.id)} className="surface flex w-full items-center gap-3 rounded-2xl p-2 text-left">
            <Photo
              slot={IMAGES.rehabExercise(e.id)}
              crop="square"
              sizes="48px"
              alt=""
              className="size-12 shrink-0 rounded-[10px]"
              fallback={<span className="tabular flex size-full items-center justify-center bg-card-2 text-sm">{i + 1}</span>}
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{e.name}</div>
              <div className="text-xs text-muted">{e.dose} · {e.cue}</div>
            </div>
            <span className="pr-1">
              <CheckDot state={done.includes(e.id) ? "done" : "todo"} size={24} />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Smärta upp till 5/10 under övningen är ok. Du anger smärtan när du avslutar passet, och morgonen efter.</p>
    </Sheet>
  );
}

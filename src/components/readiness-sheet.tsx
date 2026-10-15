"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completedSessions } from "@/lib/coach";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";
import { Button, Sheet, Stepper, cn } from "./ui";

const QUESTIONS = [
  { key: "sleep", label: "Sömnkvalitet", low: "Dålig", high: "Utmärkt" },
  { key: "energy", label: "Energi", low: "Slut", high: "Full" },
  { key: "soreness", label: "Träningsvärk", low: "Mycket", high: "Ingen" },
] as const;

/** Quick pre-session readiness check (1–5 + hours slept) that feeds the fatigue rules, then starts the session. */
export function ReadinessSheet({ programDayId, open, onClose }: { programDayId: string | null; open: boolean; onClose: () => void }) {
  const { s, startSession } = useStore();
  const router = useRouter();
  const lastHours = completedSessions(s)
    .map((x) => x.readiness?.sleepHours)
    .filter((h): h is number => typeof h === "number")
    .at(-1);
  const [r, setR] = useState({ sleep: 4, energy: 4, soreness: 4 });
  const [hours, setHours] = useState(lastHours ?? 7.5);
  const [busy, setBusy] = useState(false);
  if (!programDayId) return null;

  const start = async () => {
    setBusy(true);
    try {
      const id = await startSession(programDayId, today(), { ...r, sleepHours: hours });
      router.push(`/workout/session?id=${id}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Dagsform · ${PROGRAM_BY_ID[programDayId]?.name}`}>
      <div className="space-y-4">
        <Stepper label="Sömn i natt" value={hours} onChange={(v) => setHours(Math.min(14, v))} step={0.5} unit="h" />
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">{q.label}</span>
              <span className="text-muted">
                {q.low} → {q.high}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  aria-pressed={r[q.key] === n}
                  onClick={() => setR({ ...r, [q.key]: n })}
                  className={cn(
                    "h-11 flex-1 rounded-xl text-sm font-medium",
                    r[q.key] === n ? "bg-accent-grad text-on-accent" : "border border-line bg-card-2 text-ink-2",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted">Låg dagsform skjuter upp viktökningar och tar bort ett set på basövningarna.</p>
        <Button size="lg" className="w-full" disabled={busy} onClick={start}>
          Starta pass →
        </Button>
      </div>
    </Sheet>
  );
}

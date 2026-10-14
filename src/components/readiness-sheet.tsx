"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";
import { Button, Sheet, cn } from "./ui";

const QUESTIONS = [
  { key: "sleep", label: "Sömn", low: "Dålig", high: "Utmärkt" },
  { key: "energy", label: "Energi", low: "Slut", high: "Full" },
  { key: "soreness", label: "Träningsvärk", low: "Mycket", high: "Ingen" },
] as const;

/** Quick pre-session readiness check (1–5) that feeds the fatigue rules, then starts the session. */
export function ReadinessSheet({ programDayId, open, onClose }: { programDayId: string | null; open: boolean; onClose: () => void }) {
  const { startSession } = useStore();
  const router = useRouter();
  const [r, setR] = useState({ sleep: 4, energy: 4, soreness: 4 });
  const [busy, setBusy] = useState(false);
  if (!programDayId) return null;

  const start = async () => {
    setBusy(true);
    const id = await startSession(programDayId, today(), r);
    router.push(`/workout/session?id=${id}`);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Dagsform · ${PROGRAM_BY_ID[programDayId]?.name}`}>
      <div className="space-y-4">
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
                  onClick={() => setR({ ...r, [q.key]: n })}
                  className={cn("h-11 flex-1 rounded-xl text-sm font-medium", r[q.key] === n ? "bg-ink text-white" : "bg-card")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted">Låg dagsform skjuter upp viktökningar och tar bort ett set på basövningarna.</p>
        <Button variant="accent" size="lg" className="w-full" disabled={busy} onClick={start}>
          Starta pass →
        </Button>
      </div>
    </Sheet>
  );
}

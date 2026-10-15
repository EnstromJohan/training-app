"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, HeartPulse } from "lucide-react";
import { IMAGES, Photo } from "@/components/photo";
import { ReadinessSheet } from "@/components/readiness-sheet";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { Button, Card, Chip, IconCircle, PillTabs, ScreenHeader, kg } from "@/components/ui";
import { dayMinutes, inProgressSession, prescribeDay, weekPlan } from "@/lib/coach";
import { PROGRAM, PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";

export default function WorkoutIndex() {
  const { s } = useStore();
  const router = useRouter();
  const active = inProgressSession(s);
  const t = today();
  const plan = weekPlan(s, t);
  const queue = plan.days.filter((d) => d.status === "planned").map((d) => d.programDayId!);
  const defaultId = plan.days.find((d) => d.date === t && d.status === "planned")?.programDayId ?? plan.next?.programDayId ?? PROGRAM[0].id;
  const [dayId, setDayId] = useState(defaultId);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (active) router.replace(`/workout/session?id=${active.id}`);
  }, [active, router]);
  if (active) return null;

  const day = PROGRAM_BY_ID[dayId];
  const items = prescribeDay(s, day, t);
  const minutes = dayMinutes(s, day, t);
  const options = Array.from(new Set([defaultId, ...queue, ...PROGRAM.filter((d) => d.category !== "rest").map((d) => d.id)]));

  return (
    <div>
      <ScreenHeader title="Träna" />
      <Link href="/cardio" className="surface mb-3 flex items-center gap-3 rounded-[18px] p-3">
        <IconCircle className="text-accent">
          <HeartPulse size={18} />
        </IconCircle>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">Cardio</div>
          <div className="text-[12px] text-muted">Zone 2, intervaller och långpass</div>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </Link>
      <PillTabs value={dayId} onChange={setDayId} options={options.map((id) => ({ value: id, label: PROGRAM_BY_ID[id].name }))} />
      {dayId !== defaultId && <p className="mt-2 text-xs text-muted">Du kör ett annat pass än det planerade – veckan planeras om automatiskt.</p>}
      <div className="mt-4 space-y-2">
        {minutes[1] > 0 && (
          <p className="flex items-center gap-1.5 px-1 text-[12px] text-ink-2">
            <Clock size={13} className="text-accent" /> {minutes[0]}–{minutes[1]} min · {items.length} övningar
          </p>
        )}
        {items.map(({ exercise, prescription: p }) => (
          <Card key={exercise.id} className="flex items-center justify-between gap-3 p-2.5">
            <Photo slot={IMAGES.exercise(exercise.id)} crop="square" sizes="48px" alt="" className="size-12 shrink-0 rounded-[10px]" fallback={<div className="size-full bg-card-2" />} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{exercise.name}</div>
              <div className="text-xs text-muted">{MUSCLE_LABEL[exercise.primary]} · vila {p.restSec}s</div>
            </div>
            <div className="text-right">
              {p.status === "needs_calibration" ? (
                <Chip tone="accent">Kalibrera</Chip>
              ) : (
                <>
                  <div className="tabular text-sm font-semibold">
                    {p.sets.length} × {p.sets.map((x) => x.reps).join("/")} · {kg(p.weight)} kg
                  </div>
                  <div className="text-xs text-muted">RIR {p.sets[0].rirMin}–{p.sets[0].rirMax}</div>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Button variant="accent" size="lg" className="mt-5 w-full" onClick={() => setSheet(true)}>
        Starta {day.name} →
      </Button>
      <ReadinessSheet programDayId={dayId} open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

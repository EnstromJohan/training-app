"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { SessionThumb } from "@/components/anatomy";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { CheckDot, cn } from "@/components/ui";
import { dayMinutes, weekPlan } from "@/lib/coach";
import { addDays, fromIso, isoWeek, weekStart } from "@/lib/engine/weekly/dates";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";
import { useRouter } from "next/navigation";

const WD_SHORT = ["MÅN", "TIS", "ONS", "TOR", "FRE", "LÖR", "SÖN"];
const WD_LONG = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

export default function Schedule() {
  const store = useStore();
  const { s } = store;
  const router = useRouter();
  const t = today();
  const [offset, setOffset] = useState(0);
  const ref = addDays(weekStart(t), offset * 7);
  const plan = weekPlan(s, offset === 0 ? t : ref);
  const isDeload = s.settings.deloadWeeks.includes(ref);

  return (
    <div>
      <header className="flex items-center gap-2 pb-3 pt-3">
        <button aria-label="Tillbaka" onClick={() => router.back()} className="flex size-10 items-center justify-center rounded-full border border-line bg-card">
          <ChevronLeft size={20} />
        </button>
        <div className="mx-auto flex h-10 items-center rounded-full border border-line bg-card px-1">
          <button aria-label="Föregående vecka" onClick={() => setOffset(offset - 1)} className="flex size-8 items-center justify-center text-ink-2">
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[96px] text-center text-[15px] font-semibold">Vecka {isoWeek(ref)}</span>
          <button aria-label="Nästa vecka" onClick={() => setOffset(offset + 1)} className="flex size-8 items-center justify-center text-ink-2">
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          aria-label="Till denna vecka"
          onClick={() => setOffset(0)}
          disabled={offset === 0}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card disabled:opacity-40"
        >
          <CalendarCheck size={18} />
        </button>
      </header>
      {isDeload && <p className="-mt-1 mb-2 text-center text-[12px] font-medium text-accent-ink">Deloadvecka</p>}

      {/* Day strip */}
      <div className="mb-3 grid grid-cols-7 gap-1">
        {plan.days.map((d, i) => {
          const isToday = d.date === t;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <span className={cn("text-[10px] font-medium", isToday ? "text-accent" : "text-muted")}>{WD_SHORT[i]}</span>
              <span
                className={cn(
                  "tabular flex size-9 items-center justify-center rounded-[10px] text-[16px] font-semibold",
                  isToday ? "glow-soft border border-accent text-accent" : d.status === "completed" ? "text-ink" : "text-ink-2",
                )}
              >
                {fromIso(d.date).getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {plan.days.map((d, i) => {
          const day = d.programDayId ? PROGRAM_BY_ID[d.programDayId] : null;
          const isToday = d.date === t;
          const completed = d.status === "completed";
          const minutes = day ? dayMinutes(s, day, d.date) : null;

          if (!day) {
            // Rest day (Sunday shows the landscape card from the design)
            return (
              <div
                key={d.date}
                className={cn("relative flex h-[68px] items-center gap-3 overflow-hidden rounded-[16px] border px-3", isToday ? "border-accent/50" : "border-line")}
              >
                {i === 6 && <Photo slot={IMAGES.restDay} sizes="400px" alt="" className="absolute inset-0" fallback={<HeroArt />} />}
                {i === 6 && <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent" />}
                {i !== 6 && <div className="absolute inset-0 bg-card" />}
                <span className="relative">
                  <CheckDot state="todo" size={24} />
                </span>
                <div className="relative">
                  <div className="text-[11px] text-muted">{WD_LONG[i]}</div>
                  <div className="text-[16px] font-semibold">{i === 6 ? "Vila / Återhämtning" : "Vila"}</div>
                </div>
              </div>
            );
          }

          const row = (
            <div className={cn("surface relative flex h-[84px] items-stretch overflow-hidden rounded-[16px]", isToday && "border-accent/60 glow-soft")}>
              <div className="flex w-12 shrink-0 items-center justify-center">
                <CheckDot state={completed ? "done" : isToday ? "current" : "todo"} size={24} />
              </div>
              <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-center">
                <div className="text-[11px] text-muted">
                  {WD_LONG[i]}
                  {d.moved && " · flyttat"}
                </div>
                <div className="truncate text-[17px] font-bold">{day.name}</div>
                {minutes && (
                  <div className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-2">
                    <Clock size={12} className={isToday ? "text-accent" : "text-muted"} /> {minutes[0]}–{minutes[1]} min
                  </div>
                )}
              </div>
              {day.category !== "rest" && (
                <div className="relative w-[120px] shrink-0">
                  <Photo slot={IMAGES.schedule(day.category)} sizes="120px" alt="" className="absolute inset-0" fallback={<SessionThumb category={day.category} />} />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#151515] via-[#151515]/30 to-transparent" />
                </div>
              )}
            </div>
          );
          return isToday && !completed ? (
            <Link key={d.date} href="/workout" className="block">
              {row}
            </Link>
          ) : (
            <div key={d.date}>{row}</div>
          );
        })}
      </div>

      {plan.dropped.length > 0 && (
        <p className="mt-3 rounded-[16px] border border-accent/25 bg-accent-soft p-3 text-[13px] text-ink-2">
          Ryms inte denna vecka: {plan.dropped.map((id) => PROGRAM_BY_ID[id].name).join(", ")}. Progressionen påverkas inte.
        </p>
      )}

      {offset === 0 && plan.next && plan.next.date === t && (
        <button
          onClick={() => confirm("Vila idag? Passet flyttas fram i veckans kö.") && store.skipDay(plan.next!.programDayId, t)}
          className="mt-3 w-full py-2 text-center text-[12px] text-muted"
        >
          Vila idag – flytta fram passet
        </button>
      )}
    </div>
  );
}

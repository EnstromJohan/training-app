"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SessionThumb } from "@/components/anatomy";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { CheckDot, ScreenHeader, cn } from "@/components/ui";
import { weekPlan } from "@/lib/coach";
import { addDays, fromIso, isoWeek, weekStart } from "@/lib/engine/weekly/dates";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";

const WD = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export default function Schedule() {
  const store = useStore();
  const { s } = store;
  const t = today();
  const [offset, setOffset] = useState(0);
  const ref = addDays(weekStart(t), offset * 7);
  const plan = weekPlan(s, offset === 0 ? t : ref);
  const isDeload = s.settings.deloadWeeks.includes(ref);

  return (
    <div>
      <ScreenHeader title="Veckoschema" serif back />
      <div className="mb-3 flex items-center justify-between rounded-full bg-card px-1 py-1">
        <button aria-label="Föregående vecka" onClick={() => setOffset(offset - 1)} className="flex size-8 items-center justify-center">
          <ChevronLeft size={18} />
        </button>
        <span className="text-[14px] font-semibold">
          Vecka {isoWeek(ref)}
          {isDeload && <span className="ml-1.5 text-[12px] font-medium text-accent-ink">· deload</span>}
        </span>
        <button aria-label="Nästa vecka" onClick={() => setOffset(offset + 1)} className="flex size-8 items-center justify-center">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="space-y-2">
        {plan.days.map((d, i) => {
          const day = d.programDayId ? PROGRAM_BY_ID[d.programDayId] : null;
          const isToday = d.date === t;
          const completed = d.status === "completed";
          const isRest = !day;
          const href = isToday && day && !completed ? "/workout" : undefined;
          const row = (
            <div className={cn("flex h-[60px] items-stretch overflow-hidden rounded-[16px]", isToday ? "bg-ink text-white" : "bg-card")}>
              <div className="flex w-[52px] shrink-0 flex-col items-center justify-center">
                <span className={cn("text-[10px]", isToday ? "text-white/70" : "text-muted")}>{WD[i]}</span>
                <span className="tabular text-[17px] font-semibold leading-tight">{fromIso(d.date).getDate()}</span>
              </div>
              <div className={cn("my-2 w-px", isToday ? "bg-white/15" : "bg-line")} />
              {isRest && i === 6 ? (
                <div className="relative flex flex-1 items-center pl-3">
                  <Photo slot={IMAGES.restDay} sizes="320px" alt="" className="absolute inset-0" fallback={<RestArt dark={isToday} />} />
                  <span className="relative text-[14px] font-semibold">Vila / Återhämtning</span>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col justify-center pl-3">
                    <div className="truncate text-[14px] font-semibold">{day ? day.name : "Vila"}</div>
                    <div className={cn("truncate text-[11px]", isToday ? "text-white/60" : "text-muted")}>
                      {day ? day.subtitle : "Promenad + rehab"}
                      {d.moved && " · flyttat"}
                    </div>
                  </div>
                  {day && day.category !== "rest" && (
                    <div className="relative w-[88px] shrink-0">
                      <Photo slot={IMAGES.schedule(day.category)} sizes="88px" alt="" className="absolute inset-0" fallback={<SessionThumb category={day.category} />} />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${isToday ? "var(--ink)" : "var(--card)"} 0%, transparent 45%)` }} />
                      {completed && (
                        <span className="absolute right-2 top-2">
                          <CheckDot state="done" size={18} />
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
          return href ? (
            <Link key={d.date} href={href} className="block">
              {row}
            </Link>
          ) : (
            <div key={d.date}>{row}</div>
          );
        })}
      </div>

      {plan.dropped.length > 0 && (
        <p className="mt-3 rounded-[16px] bg-accent-soft p-3 text-[13px] text-ink-2">
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

function RestArt({ dark }: { dark?: boolean }) {
  return (
    <div className={cn("h-full w-full", dark ? "opacity-60" : "opacity-40")}>
      <HeroArt />
    </div>
  );
}

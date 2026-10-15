"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Clock, Dumbbell, Footprints, HeartPulse } from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { ReadinessSheet } from "@/components/readiness-sheet";
import { SessionThumb } from "@/components/anatomy";
import { IconCircle, Ring, Scale, cn } from "@/components/ui";
import {
  dailyVolumeThisWeek,
  dayMinutes,
  deloadRecommendation,
  inProgressSession,
  pendingMorningCheck,
  weekCounts,
  weekPlan,
} from "@/lib/coach";
import { addDays, fromIso, isoWeek, weekStart, weekday } from "@/lib/engine/weekly/dates";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";

const WD_LETTER = ["M", "T", "O", "T", "F", "L", "S"];
const WD_LONG = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"];

function greeting() {
  const h = new Date().getHours();
  return h < 10 ? "God morgon," : h < 17 ? "Hej," : "God kväll,";
}

function dateLine(iso: string) {
  const d = fromIso(iso);
  const day = WD_LONG[weekday(iso) - 1];
  const month = d.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
  return `${day[0].toUpperCase()}${day.slice(1)} ${d.getDate()} ${month} · Vecka ${isoWeek(iso)}`;
}

export default function Dashboard() {
  const store = useStore();
  const { s } = store;
  const t = today();
  const plan = weekPlan(s, t);
  const active = inProgressSession(s);
  const todayPlan = plan.days.find((d) => d.date === t);
  const todayDay = todayPlan?.programDayId && todayPlan.status === "planned" ? PROGRAM_BY_ID[todayPlan.programDayId] : null;
  const nextDay = active ? PROGRAM_BY_ID[active.programDayId] : (todayDay ?? (plan.next ? PROGRAM_BY_ID[plan.next.programDayId] : null));
  const nextIsToday = !!active || !!todayDay;
  const counts = weekCounts(s, t);
  const volume = dailyVolumeThisWeek(s, t);
  const maxVol = Math.max(1, ...volume.map((v) => v.tonnage));
  const minutes = nextDay ? dayMinutes(s, nextDay, plan.next?.date ?? t) : null;
  const morning = pendingMorningCheck(s, t);
  const deload = deloadRecommendation(s, t);
  const isDeload = s.settings.deloadWeeks.includes(weekStart(t));
  const [sheet, setSheet] = useState(false);
  const [pain, setPain] = useState<number | null>(null);

  const stats = [
    { icon: Dumbbell, label: "Styrka", value: `${counts.strengthDone}/${counts.strengthDueToDate || counts.strengthPlanned}`, href: "/workout" },
    { icon: HeartPulse, label: "Cardio", value: `${counts.cardioDone}/${counts.cardioPlanned}`, href: "/cardio" },
    { icon: Footprints, label: "Rörlighet", value: `${counts.mobilityDone}/${counts.mobilityPlanned}`, href: "/rehab" },
  ];

  return (
    <div className="-mx-4">
      {/* Hero */}
      <section className="relative h-[430px] overflow-hidden px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <Photo slot={IMAGES.heroHome} priority sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 via-40% to-bg" />
        <div className="relative flex items-start justify-between pt-6">
          <div>
            <h1 className="text-[30px] font-bold leading-[1.08] tracking-tight drop-shadow">
              {greeting()}
              <br />
              {s.settings.name || "du"}
            </h1>
            <p className="mt-2 text-[13px] text-ink-2">{dateLine(t)}</p>
            {isDeload && <p className="mt-1 text-[12px] font-medium text-accent-ink">Deloadvecka – lättare belastning</p>}
          </div>
          <Link href="/schedule" className="flex flex-col items-center" aria-label="Veckans pass">
            <Ring progress={counts.strengthDone / counts.strengthPlanned} size={92} stroke={6} track="rgba(255,255,255,0.12)" glow>
              <span className="tabular text-[24px] font-bold leading-none">
                {counts.strengthDone}/{counts.strengthPlanned}
              </span>
              <span className="mt-0.5 text-[9px] text-ink-2">träningspass</span>
            </Ring>
            <span className="mt-1.5 text-[11px] text-ink-2">Veckans pass</span>
          </Link>
        </div>
      </section>

      <div className="relative -mt-20 space-y-4 px-4">
        {/* Weekly counters */}
        <div className="grid grid-cols-3 divide-x divide-line">
          {stats.map(({ icon: Icon, label, value, href }) => (
            <Link key={label} href={href} className="flex items-center justify-center gap-2.5 px-1">
              <IconCircle>
                <Icon size={18} strokeWidth={1.7} />
              </IconCircle>
              <span>
                <span className="block text-[12px] text-ink-2">{label}</span>
                <span className="tabular block text-[15px] font-semibold">{value}</span>
              </span>
            </Link>
          ))}
        </div>

        {/* Next session */}
        {nextDay ? (
          <div className="surface rounded-[20px] p-4">
            <div className="flex items-center gap-3">
              <div className="h-[72px] w-[60px] shrink-0 overflow-hidden rounded-[12px] border border-line bg-[#111]">
                {nextDay.category !== "rest" && (
                  <Photo
                    slot={IMAGES.schedule(nextDay.category)}
                    sizes="60px"
                    alt=""
                    className="size-full"
                    fallback={<SessionThumb category={nextDay.category} />}
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] text-muted">
                  {active ? "Pågående pass" : nextIsToday ? "Dagens pass" : `Nästa pass · ${WD_LONG[weekday(plan.next!.date) - 1]}`}
                </div>
                <div className="truncate text-[20px] font-bold">{nextDay.name}</div>
                {minutes && minutes[1] > 0 && (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-2">
                    <Clock size={13} className="text-accent" /> {minutes[0]}–{minutes[1]} min
                  </div>
                )}
              </div>
            </div>
            {active ? (
              <Link href={`/workout/session?id=${active.id}`} className="bg-accent-grad glow relative mt-4 flex h-[52px] items-center justify-center rounded-full text-[16px] font-semibold text-on-accent">
                Fortsätt pass <ArrowRight size={18} className="absolute right-5" />
              </Link>
            ) : nextIsToday ? (
              <button onClick={() => setSheet(true)} className="bg-accent-grad glow relative mt-4 flex h-[52px] w-full items-center justify-center rounded-full text-[16px] font-semibold text-on-accent active:scale-[0.99]">
                Starta pass <ArrowRight size={18} className="absolute right-5" />
              </button>
            ) : (
              <Link href="/schedule" className="relative mt-4 flex h-[52px] items-center justify-center rounded-full border border-line bg-card-2 text-[15px] font-semibold">
                Se veckoschemat <ArrowRight size={18} className="absolute right-5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="surface rounded-[20px] p-4 text-[14px] text-ink-2">Veckans pass är klara. Vila, rörlighet och rehab står på schemat.</div>
        )}

        {/* This week */}
        <div>
          <h2 className="mb-2 text-[16px] font-semibold">Denna vecka</h2>
          <div className="surface grid grid-cols-7 gap-1.5 rounded-[18px] p-2.5">
            {volume.map((v, i) => {
              const isToday = v.date === t;
              const future = v.date > t;
              const h = v.tonnage ? Math.max(28, (v.tonnage / maxVol) * 100) : 0;
              return (
                <Link key={v.date} href="/schedule" className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "relative flex h-12 w-full items-end justify-center overflow-hidden rounded-[9px] border",
                      isToday ? "border-accent/60" : "border-line",
                      "bg-[#101010]",
                    )}
                  >
                    {v.tonnage > 0 ? (
                      <div className="bg-accent-grad glow-soft w-full rounded-[7px]" style={{ height: `${h}%` }} />
                    ) : (
                      <span className={cn("mb-3 size-1.5 rounded-full", v.trained ? "bg-accent" : future ? "bg-[#3a3a3a]" : "bg-[#2a2a2a]")} />
                    )}
                  </div>
                  <span className={cn("text-[11px]", isToday ? "font-semibold text-accent" : "text-muted")}>{WD_LETTER[i]}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {morning && (
          <div className="surface rounded-[18px] p-4">
            <div className="text-[14px] font-semibold">Hälsenan i morse?</div>
            <p className="mb-3 text-[12px] text-muted">Smärta/stelhet efter rehabpasset {morning.date}. Styr nästa rehabnivå.</p>
            <Scale value={pain} onChange={setPain} labels={["Ingen", "Värsta"]} />
            <button
              disabled={pain == null}
              onClick={() => pain != null && store.setMorningPain(morning.id, pain)}
              className="bg-accent-grad mt-3 h-10 w-full rounded-full text-[14px] font-semibold text-on-accent disabled:opacity-40"
            >
              Spara
            </button>
          </div>
        )}

        {deload.deload && !isDeload && (
          <div className="rounded-[18px] border border-accent/30 bg-accent-soft p-4">
            <div className="text-[14px] font-semibold text-accent-ink">Deload rekommenderas</div>
            <p className="mt-1 text-[13px] text-ink-2">{deload.reason?.text}</p>
            <div className="mt-3 flex gap-2">
              <button className="bg-accent-grad h-9 rounded-full px-4 text-[13px] font-semibold text-on-accent" onClick={() => store.updateSettings({ deloadWeeks: [...s.settings.deloadWeeks, weekStart(t)] })}>
                Denna vecka
              </button>
              <button className="h-9 rounded-full border border-line bg-card-2 px-4 text-[13px]" onClick={() => store.updateSettings({ deloadWeeks: [...s.settings.deloadWeeks, addDays(weekStart(t), 7)] })}>
                Nästa vecka
              </button>
            </div>
          </div>
        )}
      </div>

      <ReadinessSheet programDayId={todayDay?.id ?? null} open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

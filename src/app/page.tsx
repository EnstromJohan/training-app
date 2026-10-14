"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Dumbbell, Footprints, HeartPulse } from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { ReadinessSheet } from "@/components/readiness-sheet";
import { Scale, cn } from "@/components/ui";
import {
  cardioWeek,
  deloadRecommendation,
  inProgressSession,
  pendingMorningCheck,
  reviewWeek,
  weekPlan,
  weeklyStats,
} from "@/lib/coach";
import { addDays, fromIso, weekStart } from "@/lib/engine/weekly/dates";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";

const WD = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function greeting() {
  const h = new Date().getHours();
  return h < 10 ? "God morgon," : h < 17 ? "Hej," : "God kväll,";
}

export default function Dashboard() {
  const store = useStore();
  const { s } = store;
  const t = today();
  const plan = weekPlan(s, t);
  const active = inProgressSession(s);
  const todayPlan = plan.days.find((d) => d.date === t);
  const todayDay = todayPlan?.programDayId ? PROGRAM_BY_ID[todayPlan.programDayId] : null;
  const doneToday = todayPlan?.status === "completed";
  const nextDay = plan.next ? PROGRAM_BY_ID[plan.next.programDayId] : null;
  const shown = active ? PROGRAM_BY_ID[active.programDayId] : todayDay ?? nextDay;
  const cardio = cardioWeek(s, t);
  const slot = shown?.cardioSlot;
  const cardioPlan = slot && cardio.pending.includes(slot) ? cardio.plan[slot] : undefined;
  const morning = pendingMorningCheck(s, t);
  const deload = deloadRecommendation(s, t);
  const isDeload = s.settings.deloadWeeks.includes(weekStart(t));
  const stats = weeklyStats(s, t, 16);
  const review = reviewWeek(s, t);
  const [sheet, setSheet] = useState(false);
  const [pain, setPain] = useState<number | null>(null);

  const maxTon = Math.max(1, ...stats.map((x) => x.tonnage));
  // Compare the last full week with the week before (the current week is still in progress).
  const last = stats.at(-2)?.tonnage ?? 0;
  const prev = stats.at(-3)?.tonnage ?? 0;
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null;
  const initials = (s.settings.name || "?").slice(0, 1).toUpperCase();

  const subline = active ? "Pågående pass" : doneToday ? "Dagens pass är klart" : todayDay ? "Dags att köra" : nextDay ? `Nästa pass · ${WD[(fromIso(plan.next!.date).getDay() + 6) % 7].toLowerCase()}` : "Veckan är klar";

  return (
    <div className="-mx-4 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <Photo slot={IMAGES.heroHome} priority sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-hero" />
        <div className="relative">
          <div className="flex items-start justify-between pt-3">
            <h1 className="font-serif text-[40px] leading-[0.92]">
              {greeting()}
              <br />
              <span className="text-[50px]">{s.settings.name || "du"}</span>
            </h1>
            <Link href="/settings" aria-label="Profil" className="mt-1 block size-11 overflow-hidden rounded-full ring-2 ring-white/80">
              <Photo slot={IMAGES.avatar} sizes="44px" alt="" className="size-full" fallback={<div className="flex size-full items-center justify-center bg-accent text-lg font-semibold text-ink">{initials}</div>} />
            </Link>
          </div>

          <p className="mt-10 text-[13px] text-white/75">{subline}</p>
          <p className="text-[19px] font-semibold">{doneToday && !active ? "Bra jobbat" : shown?.name ?? "Vila"}</p>
          {isDeload && <p className="mt-1 text-[12px] text-accent">Deloadvecka – lättare belastning</p>}

          <div className="mt-24 grid grid-cols-7 gap-1.5">
            {plan.days.map((d, i) => {
              const isToday = d.date === t;
              return (
                <div key={d.date} className={cn("flex flex-col items-center gap-1 rounded-full py-2.5", isToday ? "bg-accent text-ink" : "text-white")}>
                  <span className={cn("text-[11px]", isToday ? "font-semibold" : "text-white/70")}>{WD[i]}</span>
                  <span className="tabular text-[17px] font-semibold">{fromIso(d.date).getDate()}</span>
                  <span className={cn("size-1 rounded-full", d.status === "completed" ? (isToday ? "bg-ink" : "bg-accent") : "bg-transparent")} />
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            {active ? (
              <Link href={`/workout/session?id=${active.id}`} className="relative flex h-14 items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-ink">
                Fortsätt pass <ArrowRight size={18} className="absolute right-6" />
              </Link>
            ) : todayDay && !doneToday ? (
              <button onClick={() => setSheet(true)} className="relative flex h-14 w-full items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-ink active:scale-[0.99]">
                Starta pass <ArrowRight size={18} className="absolute right-6" />
              </button>
            ) : cardioPlan ? (
              <Link href="/cardio" className="relative flex h-14 items-center justify-center rounded-full bg-accent text-[16px] font-semibold text-ink">
                Starta cardio <ArrowRight size={18} className="absolute right-6" />
              </Link>
            ) : (
              <Link href="/schedule" className="relative flex h-14 items-center justify-center rounded-full bg-white/10 text-[16px] font-semibold">
                Se veckoschemat <ArrowRight size={18} className="absolute right-6" />
              </Link>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {[
              { icon: Dumbbell, label: "Styrka", sub: shown ? `${shown.exercises.length} övningar` : "Vila", href: "/workout" },
              { icon: HeartPulse, label: "Cardio", sub: cardioPlan ? `${cardioPlan.durationMin} min` : "–", href: "/cardio" },
              { icon: Footprints, label: "Rehab", sub: shown ? "Mellan set" : "Fristående", href: "/rehab" },
            ].map(({ icon: Icon, label, sub, href }) => (
              <Link key={label} href={href} className="flex items-center gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/30">
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold">{label}</span>
                  <span className="block text-[11px] text-white/55">{sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-3 px-5">
        {morning && (
          <div className="rounded-[18px] bg-white/[0.06] p-4">
            <div className="text-[14px] font-semibold">Hälsenan i morse?</div>
            <p className="mb-3 text-[12px] text-white/55">Smärta/stelhet efter rehabpasset {morning.date}. Styr nästa rehabnivå.</p>
            <div className="[&_button]:bg-white/10 [&_button]:text-white">
              <Scale value={pain} onChange={setPain} labels={["Ingen", "Värsta"]} />
            </div>
            <button disabled={pain == null} onClick={() => pain != null && store.setMorningPain(morning.id, pain)} className="mt-3 h-10 w-full rounded-full bg-white text-[14px] font-semibold text-ink disabled:opacity-40">
              Spara
            </button>
          </div>
        )}

        {deload.deload && !isDeload && (
          <div className="rounded-[18px] bg-accent/15 p-4">
            <div className="text-[14px] font-semibold text-accent">Deload rekommenderas</div>
            <p className="mt-1 text-[13px] text-white/75">{deload.reason?.text}</p>
            <div className="mt-3 flex gap-2">
              <button className="h-9 rounded-full bg-accent px-4 text-[13px] font-semibold text-ink" onClick={() => store.updateSettings({ deloadWeeks: [...s.settings.deloadWeeks, weekStart(t)] })}>
                Denna vecka
              </button>
              <button className="h-9 rounded-full bg-white/10 px-4 text-[13px]" onClick={() => store.updateSettings({ deloadWeeks: [...s.settings.deloadWeeks, addDays(weekStart(t), 7)] })}>
                Nästa vecka
              </button>
            </div>
          </div>
        )}

        {/* Veckans progression */}
        <Link href="/progress" className="block pt-3">
          <div className="text-[13px] text-white/70">Veckans progression</div>
          <div className="mt-1 text-[30px] font-semibold text-accent">{delta == null ? "–" : `${delta >= 0 ? "+" : ""}${delta}%`}</div>
          <div className="mt-3 flex h-28 items-end gap-[5px]" role="img" aria-label="Total volym per vecka, 16 veckor">
            {stats.map((w, i) => {
              const ratio = i / (stats.length - 1);
              return (
                <div
                  key={w.weekStart}
                  title={`${Math.round(w.tonnage)} kg`}
                  className="flex-1 rounded-t-[4px]"
                  style={{
                    height: `${Math.max(4, (w.tonnage / maxTon) * 108)}px`,
                    background: `linear-gradient(to top, rgba(245,168,119,${0.15 + ratio * 0.25}), rgba(245,168,119,${0.35 + ratio * 0.65}))`,
                    opacity: w.tonnage ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-[10px] text-white/45">
            <span>16 v sedan</span>
            <span>Denna vecka</span>
          </div>
        </Link>

        <Link href="/coach" className="block rounded-[18px] bg-white/[0.06] p-4">
          <div className="mb-2 text-[13px] text-white/70">Coach</div>
          {review.focus.slice(0, 2).map((f, i) => (
            <p key={i} className="text-[13px] leading-snug text-white/85">
              {i + 1}. {f}
            </p>
          ))}
        </Link>
      </div>

      <ReadinessSheet programDayId={todayDay?.id ?? null} open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}

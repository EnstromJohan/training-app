"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronUp, Heart, Lock, LockOpen, Music, Pause, Play, RotateCcw } from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, Scale, SectionTitle, Sheet, Stepper, cn, kg } from "@/components/ui";
import { mmss } from "@/components/workout/rest-timer";
import { cardioPrescriptionFor, cardioProjection, cardioWeek, insights, weeklyStats } from "@/lib/coach";
import { allowedModalities, hrZones, INTENSITY_UNIT, MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import { isoWeek } from "@/lib/engine/weekly/dates";
import type { CardioModality, CardioPrescription, CardioSlot } from "@/lib/engine/types";
import { useStore, today } from "@/lib/store";
import { useWakeLock } from "@/lib/use-wake-lock";

type Tab = "z2" | "intervals" | "hill" | "long";
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "z2", label: "Zone 2" },
  { value: "intervals", label: "Intervaller" },
  { value: "hill", label: "Backe" },
  { value: "long", label: "Långpass" },
];
const TAB_TITLE: Record<Tab, string> = { z2: "Zone 2", intervals: "Intervaller", hill: "Backe", long: "Långpass" };
const TAB_TEXT: Record<Tab, string> = {
  z2: "Bygg kondition och förbättra återhämtning.",
  intervals: "Korta, hårda arbetsperioder som höjer din maxkapacitet.",
  hill: "Lutande gång – tungt för benen, lugnt för pulsen.",
  long: "Längre lugnt pass som bygger uthållighet.",
};
const ZONE_COLORS = ["#2c4a52", "#1f3d2b", "#4a3d1d", "#4d2c17", "#4a1f22"];
const ZONE_ACTIVE = ["#5eb5c9", "#4ade80", "#fcd34d", "#fb923c", "#f87171"];

interface Plan {
  slot: CardioSlot | null;
  p: CardioPrescription | null;
  done: boolean;
  lockedReason: string | null;
}

/** Map a session type tab to this week's prescription (or explain why it isn't available). */
function planFor(tab: Tab, s: ReturnType<typeof useStore>["s"], t: string, modality: CardioModality | null): Plan {
  const week = cardioWeek(s, t);
  const allowed = allowedModalities(s.settings.rehab);
  const z2Slot = (["A", "B"] as CardioSlot[]).find((x) => week.pending.includes(x)) ?? null;
  if (tab === "z2" || tab === "hill") {
    if (tab === "hill" && !allowed.includes("incline_walk")) {
      return { slot: null, p: null, done: false, lockedReason: `Låst till rehabfas 3 (du är i fas ${s.settings.rehab.phase}). Lutning belastar hälsenan mer.` };
    }
    if (!z2Slot) return { slot: "B", p: null, done: true, lockedReason: null };
    const m = tab === "hill" ? "incline_walk" : modality && allowed.includes(modality) && modality !== "incline_walk" ? modality : undefined;
    return { slot: z2Slot, p: cardioPrescriptionFor(s, t, z2Slot, m), done: false, lockedReason: null };
  }
  if (!week.pending.includes("C")) return { slot: "C", p: null, done: true, lockedReason: null };
  const c = cardioPrescriptionFor(s, t, "C", modality && allowed.includes(modality) ? modality : undefined);
  const wantIntervals = tab === "intervals";
  if (wantIntervals !== (c.kind === "intervals")) {
    const why = c.notes.find((n) => n.code.startsWith("c_"))?.text;
    return {
      slot: "C",
      p: null,
      done: false,
      lockedReason: wantIntervals
        ? (why ?? "Veckans pass C är ett långpass.")
        : "Veckans pass C är intervaller – långpasset kommer nästa vecka.",
    };
  }
  return { slot: "C", p: c, done: false, lockedReason: null };
}

export default function CardioPage() {
  const { s } = useStore();
  const t = today();
  const week = cardioWeek(s, t);
  const cWeekKind = week.pending.includes("C") ? cardioPrescriptionFor(s, t, "C").kind : null;
  const [tab, setTab] = useState<Tab>(week.pending.some((x) => x !== "C") ? "z2" : cWeekKind === "intervals" ? "intervals" : "long");
  const [modality, setModality] = useState<CardioModality | null>(null);
  const [active, setActive] = useState<CardioPrescription | null>(null);
  const [pick, setPick] = useState(false);
  const plan = planFor(tab, s, t, modality);
  const allowed = allowedModalities(s.settings.rehab);

  if (active) return <CardioSession p={active} onExit={() => setActive(null)} />;

  const age = s.settings.birthYear ? new Date().getFullYear() - s.settings.birthYear : null;
  const zones = age && s.settings.restingHr ? hrZones(age, s.settings.restingHr, s.settings.maxHr) : null;
  const p = plan.p;
  const hr = p ? (p.kind === "intervals" ? zones?.[3] : zones?.[1]) : null;
  const unit = p ? INTENSITY_UNIT[p.modality] : "";

  const stats = weeklyStats(s, t, 5);
  const maxMin = Math.max(1, ...stats.map((w) => w.cardioMin));
  const trend = insights(s, t, "month").cardio.pct;

  return (
    <div>
      {/* Hero */}
      <section className="relative -mx-4 h-[330px] overflow-hidden">
        <Photo slot={IMAGES.cardio} crop="hero" priority sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-bg" />
        <h1 className="absolute left-5 top-[max(1.5rem,env(safe-area-inset-top))] text-[32px] font-bold tracking-tight drop-shadow">Cardio</h1>
        <div role="tablist" className="no-scrollbar absolute inset-x-0 bottom-3 flex gap-1.5 overflow-x-auto px-4">
          {TABS.map((x) => (
            <button
              key={x.value}
              role="tab"
              aria-selected={tab === x.value}
              onClick={() => setTab(x.value)}
              className={cn(
                "h-9 shrink-0 rounded-[12px] border px-3.5 text-[13px] font-medium backdrop-blur",
                tab === x.value ? "glow-soft border-accent bg-black/50 text-ink" : "border-white/15 bg-black/40 text-ink-2",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </section>

      {/* Session card */}
      <div className="surface mt-3 rounded-[20px] p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[20px] font-bold">
            {TAB_TITLE[tab]}
            {p && ` – ${MODALITY_LABEL[p.modality]}`}
          </h2>
          {p && tab !== "hill" && (
            <button onClick={() => setPick(true)} className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-card-2 px-3 text-[12px] text-ink-2">
              Byt <ChevronDown size={13} />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[13px] text-ink-2">{TAB_TEXT[tab]}</p>

        {plan.done ? (
          <div className="mt-4 flex items-center gap-2 rounded-[14px] border border-good/30 bg-good-soft p-3 text-[14px] text-good-ink">
            <Check size={18} /> Veckans {TAB_TITLE[tab].toLowerCase()}pass är klart.
          </div>
        ) : plan.lockedReason || !p ? (
          <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-line bg-card-2 p-3 text-[13px] text-ink-2">
            <Lock size={16} className="mt-0.5 shrink-0 text-muted" /> {plan.lockedReason}
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-4 divide-x divide-line">
              <div className="pr-2">
                <div className="text-[11px] text-muted">Tid</div>
                <div className="tabular whitespace-nowrap text-[15px] font-semibold">{p.durationMin} min</div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-muted">Puls</div>
                <div className="tabular whitespace-nowrap text-[15px] font-semibold">{hr ? `${hr.min}–${hr.max}` : "RPE"}</div>
              </div>
              <div className="px-2">
                <div className="text-[11px] text-muted">{unit === "W" ? "Watt" : unit === "nivå" ? "Nivå" : "Tempo"}</div>
                <div className="tabular whitespace-nowrap text-[15px] font-semibold">{p.intensity != null ? `${kg(p.intensity)}${unit === "km/h" ? " km/h" : ""}` : "Känsla"}</div>
              </div>
              <div className="pl-2">
                <div className="text-[11px] text-muted">{p.inclinePct != null ? "Lutning" : p.intervals ? "Intervaller" : "RPE"}</div>
                <div className="tabular whitespace-nowrap text-[15px] font-semibold">
                  {p.inclinePct != null ? `${p.inclinePct}%` : p.intervals ? `${p.intervals.reps}×${p.intervals.workSec}s` : `${p.rpeMin}–${p.rpeMax}`}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted">{p.reason.text}</p>
            <Button size="lg" className="mt-4 w-full" onClick={() => setActive(p)}>
              <Play size={18} fill="currentColor" /> Starta
            </Button>
          </>
        )}
      </div>

      {/* Progression */}
      <div className="surface mt-3 rounded-[20px] p-4">
        <div className="flex items-start justify-between">
          <h2 className="text-[16px] font-semibold">Progression</h2>
          <div className="text-right">
            <div className={cn("tabular text-[22px] font-bold", trend == null ? "text-muted" : trend >= 0 ? "text-good" : "text-bad")}>
              {trend == null ? "–" : `${trend >= 0 ? "+" : ""}${Math.round(trend * 100)}%`}
            </div>
            <div className="text-[11px] text-muted">Senaste 4 veckor</div>
          </div>
        </div>
        <div className="mt-2 flex h-20 items-end gap-3" role="img" aria-label="Cardiominuter per vecka">
          {stats.map((w, i) => (
            <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-7 rounded-t-[4px]"
                style={{
                  height: `${w.cardioMin ? Math.max(8, (w.cardioMin / maxMin) * 64) : 4}px`,
                  background: `linear-gradient(to top, rgba(140,150,200,${0.25 + i * 0.12}), rgba(190,198,240,${0.45 + i * 0.12}))`,
                }}
              />
              <span className="text-[10px] text-muted">v{isoWeek(w.weekStart)}</span>
            </div>
          ))}
        </div>
      </div>

      <Zones />
      <History />

      <Sheet open={pick} onClose={() => setPick(false)} title="Välj maskin">
        <div className="space-y-2">
          {(["bike", "crosstrainer", "rower", "walk", "run"] as CardioModality[]).map((m) => {
            const ok = allowed.includes(m);
            return (
              <button
                key={m}
                disabled={!ok}
                onClick={() => {
                  setModality(m);
                  setPick(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-[14px] border p-3 text-left text-[14px] disabled:opacity-45",
                  p?.modality === m ? "border-accent/60 bg-accent-soft" : "border-line bg-card",
                )}
              >
                <span>{MODALITY_LABEL[m]}</span>
                {!ok && (
                  <span className="flex items-center gap-1 text-[12px] text-muted">
                    <Lock size={12} /> {m === "run" ? "Kräver klartecken" : "Låst i rehabfasen"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

function beep(freq = 880) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {
    /* audio unavailable */
  }
}

const hhmmss = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, "0")}:${mmss(sec % 3600)}`;

function intervalPhase(p: CardioPrescription, elapsed: number) {
  if (!p.intervals) return null;
  const warm = 8 * 60;
  const { reps, workSec, restSec } = p.intervals;
  if (elapsed < warm) return { work: false, n: 0, label: "Uppvärmning" };
  const t = elapsed - warm;
  const cycle = workSec + restSec;
  const n = Math.floor(t / cycle);
  if (n >= reps) return { work: false, n: reps, label: "Nedvarvning" };
  const inCycle = t % cycle;
  return inCycle < workSec ? { work: true, n, label: `Intervall ${n + 1}/${reps}` } : { work: false, n, label: "Vila" };
}

function CardioSession({ p, onExit }: { p: CardioPrescription; onExit: () => void }) {
  const { s } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [sound, setSound] = useState(true);
  const [logging, setLogging] = useState(false);
  const lastPhase = useRef<string | null>(null);
  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const started = Date.now() - elapsed * 1000;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const total = p.durationMin * 60;
  const phase = intervalPhase(p, elapsed);
  useEffect(() => {
    const key = phase ? `${phase.work}-${phase.n}` : elapsed >= total ? "done" : null;
    if (sound && running && key && lastPhase.current !== null && key !== lastPhase.current) beep(phase?.work ? 990 : 660);
    lastPhase.current = key;
  }, [phase, elapsed, total, sound, running]);

  const age = s.settings.birthYear ? new Date().getFullYear() - s.settings.birthYear : null;
  const zones = age && s.settings.restingHr ? hrZones(age, s.settings.restingHr, s.settings.maxHr) : null;
  const target = p.kind === "intervals" ? zones?.[3] : zones?.[1];
  const next = cardioProjection(s, today(), p);
  const unit = INTENSITY_UNIT[p.modality];
  const activeZone = p.kind === "intervals" ? 4 : 2;
  const C = 2 * Math.PI * 80;

  return (
    <div>
      <header className="flex items-center gap-2 pb-3 pt-3">
        <button
          aria-label="Tillbaka"
          onClick={() => (elapsed > 0 && !confirm("Lämna passet? Tiden sparas inte om du inte loggar.") ? undefined : onExit())}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <div className="text-[17px] font-bold">
            {p.kind === "intervals" ? "Intervaller" : p.kind === "long_z2" ? "Långpass" : "Zone 2"} – {MODALITY_LABEL[p.modality]}
          </div>
          <div className="text-[12px] text-muted">Pass {p.slot}</div>
        </div>
        <div className="w-10" />
      </header>

      <div className="relative h-[250px] overflow-hidden rounded-[22px] border border-line">
        <Photo slot={IMAGES.cardio} crop="hero" sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute left-[8%] top-1/2 -translate-y-1/2">
          <div className="relative size-[196px]">
            <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90" style={{ filter: "drop-shadow(0 0 6px rgba(255,138,61,0.55))" }}>
              <circle cx="88" cy="88" r="80" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
              {elapsed > 0 && (
                <circle
                  cx="88"
                  cy="88"
                  r="80"
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - Math.min(1, elapsed / total))}
                  style={{ transition: "stroke-dashoffset 0.5s linear" }}
                />
              )}
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ff8a3d" />
                  <stop offset="1" stopColor="#4ade80" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[13px] font-medium">{phase ? phase.label : p.kind === "intervals" ? "Intervaller" : "Zone 2"}</span>
              <span className="tabular text-[32px] font-bold leading-tight drop-shadow">{hhmmss(elapsed)}</span>
              <span className="text-[12px] text-ink-2">av {mmss(total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-line">
        <div className="pr-3">
          <div className="text-[11px] text-muted">Puls</div>
          <div className="flex items-center gap-1 text-[22px] font-semibold">
            <Heart size={13} className="text-bad" fill="currentColor" />–
          </div>
          <div className="text-[11px] text-muted">{target ? `${target.min}–${target.max} bpm` : "RPE styr"}</div>
        </div>
        <div className="px-3">
          <div className="text-[11px] text-muted">{unit === "W" ? "Watt" : unit === "nivå" ? "Nivå" : "Fart"}</div>
          <div className="tabular text-[22px] font-semibold">{p.intensity != null ? kg(p.intensity) : "Känsla"}</div>
          <div className="text-[11px] text-muted">{p.intensity != null ? (unit === "nivå" ? "motstånd" : unit) : "välj nivå"}</div>
        </div>
        <div className="pl-3">
          <div className="text-[11px] text-muted">{p.intervals ? "Intervaller" : "Ansträngning"}</div>
          <div className="tabular text-[22px] font-semibold">{p.intervals ? `${p.intervals.reps}×${p.intervals.workSec}s` : `${p.rpeMin}–${p.rpeMax}`}</div>
          <div className="text-[11px] text-muted">{p.intervals ? `RPE ${p.rpeMin}–${p.rpeMax}` : "RPE · hela meningar"}</div>
        </div>
      </div>

      {/* Zone bar */}
      <div className="mt-4">
        <div className="flex h-4 items-center">
          {ZONE_COLORS.map((c, i) => {
            const on = i + 1 === activeZone;
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-1 items-center justify-center text-[10px] font-bold text-[#08130c]",
                  on ? "z-10 h-[22px] rounded-[6px] shadow-[0_0_12px_rgba(74,222,128,0.5)]" : "h-4",
                  i === 0 && "rounded-l-full",
                  i === ZONE_COLORS.length - 1 && "rounded-r-full",
                )}
                style={{ background: on ? ZONE_ACTIVE[i] : c }}
              >
                {on ? `Z${i + 1}` : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex">
          {ZONE_COLORS.map((_, i) => (
            <span key={i} className={cn("flex-1 text-center text-[10px]", i + 1 === activeZone ? "font-semibold text-good-ink" : "text-muted")}>
              Z{i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-between px-6">
        <button
          aria-label={locked ? "Lås upp" : "Lås skärmen"}
          onClick={() => setLocked(!locked)}
          className="relative z-40 flex size-12 items-center justify-center rounded-full border border-line bg-card"
        >
          {locked ? <Lock size={18} /> : <LockOpen size={18} />}
        </button>
        <button
          aria-label={running ? "Pausa" : "Starta"}
          disabled={locked}
          onClick={() => setRunning(!running)}
          className="bg-accent-grad glow flex size-[72px] items-center justify-center rounded-full text-on-accent active:scale-95 disabled:opacity-60"
        >
          {running ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
        </button>
        <button
          aria-label={sound ? "Stäng av ljud" : "Slå på ljud"}
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
          className={cn("flex size-12 items-center justify-center rounded-full border border-line", sound ? "bg-card text-ink" : "bg-card-2 text-muted")}
        >
          <Music size={18} />
        </button>
      </div>
      {!running && elapsed > 0 && !locked && (
        <button onClick={() => setElapsed(0)} className="mx-auto mt-2 flex items-center gap-1 text-[12px] text-muted">
          <RotateCcw size={12} /> Nollställ
        </button>
      )}
      {locked && <div className="fixed inset-0 z-30" aria-hidden />}

      <button
        onClick={() => {
          setRunning(false);
          setLogging(true);
        }}
        disabled={locked}
        className="surface relative z-40 mt-5 flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left"
      >
        <Photo slot={IMAGES.cardio} crop="thumb" sizes="52px" alt="" className="size-[52px] shrink-0 rounded-[12px]" fallback={<HeroArt />} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-muted">Nästa steg</div>
          <div className="text-[14px] font-semibold">
            Nästa gång: {next.kind === "intervals" && next.intervals ? `${next.intervals.reps}×${next.intervals.workSec} s intervaller` : `${next.durationMin} minuter`}
          </div>
          <div className="text-[12px] text-muted">
            {next.intensity != null && next.intensity !== p.intensity
              ? `Högre intensitet (${kg(next.intensity)} ${INTENSITY_UNIT[next.modality]})`
              : `Samma intensitet (${next.kind === "intervals" ? "intervaller" : "Zone 2"})`}
          </div>
        </div>
        <ChevronUp size={18} className="mr-1 text-muted" />
      </button>
      <p className="mt-2 px-1 text-[12px] text-muted">Tryck på kortet när du är klar för att logga passet.</p>
      {p.notes.map((n) => (
        <p key={n.code} className="px-1 text-[12px] text-muted">
          {n.text}
        </p>
      ))}

      <Sheet open={logging} onClose={() => setLogging(false)} title="Logga cardio">
        <CardioLogForm
          p={p}
          elapsedMin={Math.round(elapsed / 60)}
          onDone={() => {
            setLogging(false);
            onExit();
          }}
        />
      </Sheet>
    </div>
  );
}

function CardioLogForm({ p, elapsedMin, onDone }: { p: CardioPrescription; elapsedMin: number; onDone: () => void }) {
  const store = useStore();
  const [duration, setDuration] = useState(elapsedMin >= 5 ? elapsedMin : p.durationMin);
  const [intensity, setIntensity] = useState<number>(p.intensity ?? (p.modality === "crosstrainer" ? 8 : p.modality === "bike" || p.modality === "rower" ? 110 : 5));
  const [distance, setDistance] = useState(0);
  const [hr, setHr] = useState(0);
  const [rpe, setRpe] = useState<number | null>(null);
  const [talk, setTalk] = useState<boolean | null>(p.kind === "intervals" ? null : true);
  const [completed, setCompleted] = useState(true);
  const [reps, setReps] = useState(p.intervals?.reps ?? 0);
  const [busy, setBusy] = useState(false);
  const unit = INTENSITY_UNIT[p.modality];
  const step = unit === "W" ? 5 : unit === "nivå" ? 1 : 0.1;

  const save = async () => {
    setBusy(true);
    try {
      await store.logCardio({
        date: today(),
        workoutSessionId: null,
        slot: p.slot,
        kind: p.kind,
        modality: p.modality,
        durationMin: duration,
        completed,
        rpe: rpe!,
        talkTestOk: talk,
        intensity,
        inclinePct: p.inclinePct ?? null,
        distanceKm: distance || null,
        avgHr: hr || null,
        intervals: p.intervals ? { ...p.intervals, reps } : null,
        prescription: p,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <Stepper label="Tid (min)" value={duration} onChange={setDuration} step={1} min={1} unit="min" />
      <Stepper label={unit === "nivå" ? "Nivå" : unit === "W" ? "Snitt-watt" : "Fart"} value={intensity} onChange={setIntensity} step={step} unit={unit === "nivå" ? "" : unit} />
      {p.intervals && <Stepper label="Genomförda intervaller" value={reps} onChange={setReps} step={1} />}
      <Stepper label="Distans (valfritt)" value={distance} onChange={setDistance} step={0.1} unit="km" />
      <Stepper label="Snittpuls (valfritt)" value={hr} onChange={setHr} step={1} unit="bpm" />
      <div className="pt-1">
        <div className="mb-1.5 text-[13px] font-medium">Ansträngning (RPE)</div>
        <Scale value={rpe} onChange={setRpe} min={1} max={10} labels={["Mycket lätt", "Max"]} />
      </div>
      {p.kind !== "intervals" && (
        <div>
          <div className="mb-1.5 text-[13px] font-medium">Kunde du prata i hela meningar?</div>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                aria-pressed={talk === v}
                onClick={() => setTalk(v)}
                className={cn("h-10 flex-1 rounded-full text-[13px]", talk === v ? "bg-accent-grad text-on-accent" : "border border-line bg-card-2 text-ink-2")}
              >
                {v ? "Ja" : "Nej"}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="size-4 accent-[#ff8a3d]" />
        Genomförde hela passet
      </label>
      <Button className="w-full" disabled={rpe == null || busy} onClick={save}>
        Spara cardio
      </Button>
    </div>
  );
}

function Zones() {
  const { s } = useStore();
  const age = s.settings.birthYear ? new Date().getFullYear() - s.settings.birthYear : null;
  if (!age || !s.settings.restingHr) return null;
  const zones = hrZones(age, s.settings.restingHr, s.settings.maxHr);
  return (
    <>
      <SectionTitle>Uppskattade pulszoner</SectionTitle>
      <Card className="divide-y divide-line py-1">
        {zones.map((z, i) => (
          <div key={z.zone} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="h-3 w-3 rounded-full" style={{ background: ZONE_ACTIVE[i] }} />
            <span className="w-7 font-semibold">Z{z.zone}</span>
            <span className="flex-1 text-muted">{z.label}</span>
            <span className="tabular">
              {z.min}–{z.max}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

function History() {
  const { s } = useStore();
  const recent = s.cardio
    .filter((c) => !c.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  if (!recent.length) return null;
  return (
    <>
      <SectionTitle>Senaste passen</SectionTitle>
      <Card className="divide-y divide-line px-3 py-1">
        {recent.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2.5 text-[13px]">
            <div>
              <div className="font-medium">
                {MODALITY_LABEL[c.modality]} · {c.durationMin} min
              </div>
              <div className="text-[11px] text-muted">
                {c.date} · Pass {c.slot}
              </div>
            </div>
            <div className="tabular text-right text-[12px] text-muted">
              RPE {c.rpe}
              {c.intensity != null && (
                <div>
                  {kg(c.intensity)} {INTENSITY_UNIT[c.modality]}
                </div>
              )}
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

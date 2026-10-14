"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, Heart, Lock, LockOpen, Music, Pause, Play, RotateCcw } from "lucide-react";
import { HeroArt } from "@/components/hero-art";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, PillTabs, Scale, ScreenHeader, SectionTitle, Sheet, Stepper, cn, kg } from "@/components/ui";
import { mmss } from "@/components/workout/rest-timer";
import { cardioPrescriptionFor, cardioProjection, cardioWeek, weeklyStats } from "@/lib/coach";
import { allowedModalities, hrZones, INTENSITY_UNIT, MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import type { CardioModality, CardioPrescription, CardioSlot } from "@/lib/engine/types";
import { useStore, today } from "@/lib/store";
import { useWakeLock } from "@/lib/use-wake-lock";

const TABS: CardioModality[] = ["run", "bike", "crosstrainer", "rower", "walk", "incline_walk"];
const TAB_LABEL: Record<CardioModality, string> = { ...MODALITY_LABEL, run: "Löpning" };
const KIND_LABEL = { z2: "Zone 2", long_z2: "Zone 2 · långt", intervals: "Intervaller" };
const ZONE_COLORS = ["#c9dcef", "#5cb87a", "#f2c879", "#f2a77e", "#e98a8f"];

export default function CardioPage() {
  const { s } = useStore();
  const t = today();
  const week = cardioWeek(s, t);
  const firstPending = week.pending.find((x) => week.dates[x] === t) ?? week.pending[0] ?? "A";
  const [slot, setSlot] = useState<CardioSlot>(firstPending);
  const [modality, setModality] = useState<CardioModality | null>(null);
  const [menu, setMenu] = useState(false);
  const allowed = allowedModalities(s.settings.rehab);
  const p = cardioPrescriptionFor(s, t, slot, modality ?? undefined);
  const done = week.done.find((c) => c.slot === slot);

  return (
    <div>
      <ScreenHeader title="Cardio" back onMenu={() => setMenu(true)} />
      <PillTabs
        size="sm"
        value={p.modality}
        onChange={(m) => setModality(m)}
        options={TABS.filter((m) => m !== "incline_walk" || allowed.includes(m)).map((m) => ({
          value: m,
          label: TAB_LABEL[m],
          disabled: !allowed.includes(m),
          icon: !allowed.includes(m) ? <Lock size={11} /> : undefined,
        }))}
      />

      {done ? (
        <DoneCard slot={slot} />
      ) : (
        <CardioSession key={`${slot}-${p.modality}-${p.kind}`} p={p} />
      )}

      <Zones />
      <History />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Veckans cardiopass">
        <div className="space-y-2">
          {(["A", "B", "C"] as CardioSlot[]).map((x) => {
            const isDone = week.done.some((c) => c.slot === x);
            return (
              <button
                key={x}
                onClick={() => { setSlot(x); setModality(null); setMenu(false); }}
                className={cn("flex w-full items-center justify-between rounded-[14px] p-3 text-left text-[14px]", slot === x ? "bg-ink text-white" : "bg-card")}
              >
                <span>Pass {x}{week.dates[x] === t ? " · idag" : week.dates[x] ? ` · ${week.dates[x]!.slice(5).replace("-", "/")}` : ""}</span>
                {isDone && <Check size={16} />}
              </button>
            );
          })}
          {!allowed.includes("run") && <p className="px-1 text-[12px] text-muted">Löpning och hopp låses upp när fysio gett klartecken (Inställningar → Skador).</p>}
        </div>
      </Sheet>
    </div>
  );
}

function DoneCard({ slot }: { slot: CardioSlot }) {
  const { s } = useStore();
  const c = cardioWeek(s, today()).done.find((x) => x.slot === slot)!;
  return (
    <div className="relative mt-3 h-[220px] overflow-hidden rounded-[22px] text-white">
      <Photo slot={IMAGES.cardio} crop="hero" sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
        <span className="flex size-12 items-center justify-center rounded-full bg-good"><Check size={24} /></span>
        <div className="mt-2 text-[18px] font-semibold">Pass {slot} klart</div>
        <div className="text-[13px] text-white/75">
          {MODALITY_LABEL[c.modality]} {c.durationMin} min · RPE {c.rpe}
          {c.intensity != null && ` · ${kg(c.intensity)} ${INTENSITY_UNIT[c.modality]}`}
        </div>
      </div>
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

function CardioSession({ p }: { p: CardioPrescription }) {
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

  return (
    <>
      {/* Hero with ring */}
      <div className="relative mt-3 h-[230px] overflow-hidden rounded-[22px] text-white">
        <Photo slot={IMAGES.cardio} crop="hero" sizes="(max-width: 448px) 100vw, 448px" alt="" className="absolute inset-0" fallback={<HeroArt />} />
        <div className="absolute inset-0 bg-black/15" />
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <div className="relative size-[176px]">
            <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90">
              <circle cx="88" cy="88" r="80" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.25)" strokeWidth="6" />
              <circle
                cx="88" cy="88" r="80" fill="none" stroke="url(#ringGrad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 80}
                strokeDashoffset={2 * Math.PI * 80 * (1 - Math.min(1, elapsed / total))}
                style={{ transition: "stroke-dashoffset 0.5s linear" }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f5a877" />
                  <stop offset="1" stopColor="#5cb87a" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[13px] font-medium">{phase ? phase.label : KIND_LABEL[p.kind]}</span>
              <span className="tabular text-[30px] font-semibold leading-tight">{hhmmss(running || elapsed ? elapsed : 0)}</span>
              <span className="text-[12px] text-white/80">av {mmss(total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-line">
        <div className="pr-3">
          <div className="text-[11px] text-muted">Puls</div>
          <div className="flex items-center gap-1 text-[22px] font-semibold"><Heart size={13} className="text-bad" fill="currentColor" />–</div>
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
      <div className="mt-4 flex items-center gap-1">
        {ZONE_COLORS.map((c, i) => (
          <div key={i} className="flex-1">
            <div
              className={cn("flex h-[18px] items-center justify-center rounded-[4px] text-[9px] font-semibold", i + 1 === activeZone && "ring-2 ring-ink/80")}
              style={{ background: c, opacity: i + 1 === activeZone ? 1 : 0.7 }}
            >
              {i + 1 === activeZone ? `Z${i + 1}` : ""}
            </div>
            <div className={cn("mt-1 text-center text-[10px]", i + 1 === activeZone ? "font-semibold text-ink" : "text-muted")}>Z{i + 1}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mt-5 flex items-center justify-between px-6">
        <button aria-label={locked ? "Lås upp" : "Lås skärmen"} onClick={() => setLocked(!locked)} className="relative z-40 flex size-11 items-center justify-center rounded-full bg-card">
          {locked ? <Lock size={18} /> : <LockOpen size={18} />}
        </button>
        <button
          aria-label={running ? "Pausa" : "Starta"}
          disabled={locked}
          onClick={() => setRunning(!running)}
          className="flex size-[68px] items-center justify-center rounded-full bg-ink text-white active:scale-95 disabled:opacity-60"
        >
          {running ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
        </button>
        <button aria-label={sound ? "Stäng av ljud" : "Slå på ljud"} onClick={() => setSound(!sound)} className={cn("flex size-11 items-center justify-center rounded-full", sound ? "bg-card" : "bg-card-2 text-muted")}>
          <Music size={18} />
        </button>
      </div>
      {!running && elapsed > 0 && !locked && (
        <button onClick={() => { setElapsed(0); }} className="mx-auto mt-2 flex items-center gap-1 text-[12px] text-muted">
          <RotateCcw size={12} /> Nollställ
        </button>
      )}
      {locked && <div className="fixed inset-0 z-30" onClick={() => {}} aria-hidden />}

      {/* Next step */}
      <button onClick={() => { setRunning(false); setLogging(true); }} disabled={locked} className="relative z-40 mt-5 flex w-full items-center gap-3 rounded-[18px] bg-card p-2.5 text-left">
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
      <p className="mt-2 px-1 text-[12px] text-muted">{p.reason.text} Tryck på kortet för att logga passet.</p>
      {p.notes.map((n) => <p key={n.code} className="px-1 text-[12px] text-muted">{n.text}</p>)}

      <Sheet open={logging} onClose={() => setLogging(false)} title="Logga cardio">
        <CardioLogForm p={p} elapsedMin={Math.round(elapsed / 60)} onDone={() => setLogging(false)} />
      </Sheet>
    </>
  );
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
  const unit = INTENSITY_UNIT[p.modality];
  const step = unit === "W" ? 5 : unit === "nivå" ? 1 : 0.1;

  const save = async () => {
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
  };

  return (
    <div className="space-y-2.5">
      <Stepper label="Tid (min)" value={duration} onChange={setDuration} step={1} unit="min" />
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
              <button key={String(v)} onClick={() => setTalk(v)} className={cn("h-10 flex-1 rounded-full text-[13px]", talk === v ? "bg-ink text-white" : "bg-card")}>
                {v ? "Ja" : "Nej"}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="size-4 accent-black" />
        Genomförde hela passet
      </label>
      <Button variant="accent" className="w-full" disabled={rpe == null} onClick={save}>
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
            <span className="h-3 w-3 rounded-full" style={{ background: ZONE_COLORS[i] }} />
            <span className="w-7 font-semibold">Z{z.zone}</span>
            <span className="flex-1 text-muted">{z.label}</span>
            <span className="tabular">{z.min}–{z.max}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function History() {
  const { s } = useStore();
  const stats = weeklyStats(s, today(), 8);
  const max = Math.max(1, ...stats.map((x) => x.cardioMin));
  return (
    <>
      <SectionTitle right={<Link href="/progress?tab=cardio" className="text-[12px] text-muted">Utveckling</Link>}>Minuter per vecka</SectionTitle>
      <Card>
        <div className="flex h-20 items-end gap-2" role="img" aria-label="Cardiominuter per vecka, 8 veckor">
          {stats.map((w, i) => (
            <div key={w.weekStart} className="flex flex-1 flex-col items-center gap-1">
              <span className="tabular text-[10px] text-muted">{w.cardioMin ? Math.round(w.cardioMin) : ""}</span>
              <div className={cn("w-full rounded-t-[4px]", i === stats.length - 1 ? "bg-accent" : "bg-ink-2")} style={{ height: `${Math.max(3, (w.cardioMin / max) * 60)}px`, opacity: w.cardioMin ? 1 : 0.15 }} />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Dumbbell, Footprints, History, Lightbulb, Plus, Repeat, Trophy, Video } from "lucide-react";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { AnatomyFigure, type Fills } from "@/components/anatomy";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, Chip, Scale, ScreenHeader, Sheet, Stepper, cn, kg } from "@/components/ui";
import { RestTimer, loadTimer, saveTimer, type TimerState } from "@/components/workout/rest-timer";
import { RehabSheet } from "@/components/workout/rehab-sheet";
import { cardioWeek, exposuresByExercise, prescribeFor, rehabPlan, swapOptions } from "@/lib/coach";
import { loadStep } from "@/lib/engine/strength/rounding";
import { e1rm, exposureE1rm } from "@/lib/engine/strength/e1rm";
import type { Exercise } from "@/lib/engine/types";
import type { SessionExerciseRec, SetLogRec } from "@/lib/db/records";
import { EXERCISES } from "@/lib/program/exercises";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";
import { haptic, useWakeLock } from "@/lib/use-wake-lock";

const RIR_OPTIONS = [0, 1, 2, 3, 4];

function exerciseFills(ex: Exercise): Fills {
  const f: Fills = {};
  for (const m of ex.secondary) f[m] = "#9a4d1e";
  f[ex.primary] = "#ff8a3d";
  return f;
}

interface Draft {
  key: string;
  weight: number;
  reps: number;
  rir: number;
}

function useElapsed(startedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

export function WorkoutView() {
  const id = useSearchParams().get("id") ?? "";
  const store = useStore();
  const { s } = store;
  const session = s.sessions.find((x) => x.id === id && !x.deletedAt);

  if (!session) {
    return (
      <div className="pt-20 text-center">
        <p className="mb-4 text-muted">Passet hittades inte.</p>
        <Link href="/" className="text-accent underline">
          Till startsidan
        </Link>
      </div>
    );
  }
  if (session.status === "completed") return <Summary sessionId={session.id} />;
  return <ActiveWorkout sessionId={session.id} />;
}

function useSessionData(sessionId: string) {
  const { s } = useStore();
  const items = useMemo(
    () => s.sessionExercises.filter((x) => x.sessionId === sessionId && !x.deletedAt).sort((a, b) => a.position - b.position),
    [s.sessionExercises, sessionId],
  );
  const setsBySe = useMemo(() => {
    const m = new Map<string, SetLogRec[]>();
    for (const set of s.sets) {
      if (set.sessionId !== sessionId || set.deletedAt) continue;
      const arr = m.get(set.sessionExerciseId) ?? [];
      arr.push(set);
      m.set(set.sessionExerciseId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.setIndex - b.setIndex);
    return m;
  }, [s.sets, sessionId]);
  return { items, setsBySe };
}

function ActiveWorkout({ sessionId }: { sessionId: string }) {
  const store = useStore();
  const { s } = store;
  const router = useRouter();
  const session = s.sessions.find((x) => x.id === sessionId)!;
  const day = PROGRAM_BY_ID[session.programDayId];
  const { items, setsBySe } = useSessionData(sessionId);
  const working = (se: SessionExerciseRec) => (setsBySe.get(se.id) ?? []).filter((x) => x.kind === "working");
  const isDone = (se: SessionExerciseRec) => working(se).length >= se.prescription.sets.length;

  const [idx, setIdx] = useState(() => Math.max(0, items.findIndex((se) => !isDone(se))));
  const [timer, setTimerState] = useState<TimerState | null>(() => loadTimer());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [sheet, setSheet] = useState<null | "menu" | "swap" | "rehab" | "finish" | "tips" | "history">(null);
  const [selfCalibrate, setSelfCalibrate] = useState<Record<string, boolean>>({});
  const elapsed = useElapsed(session.startedAt);
  useWakeLock(true);

  const setTimer = (t: TimerState | null) => {
    saveTimer(t);
    setTimerState(t);
  };

  const current = items[Math.min(idx, items.length - 1)];
  if (!current) {
    return <div className="pt-20 text-center text-muted">Inga övningar i passet.</div>;
  }
  const ex = EXERCISES[current.exerciseId];
  const p = current.prescription;
  const logged = working(current);
  const warmupsLogged = (setsBySe.get(current.id) ?? []).filter((x) => x.kind === "warmup");
  const totalSets = Math.max(p.sets.length, logged.length);
  const activeIndex = editing ?? logged.length;
  const allDone = logged.length >= p.sets.length;
  const target = p.sets[Math.min(activeIndex, p.sets.length - 1)];
  const step = loadStep(ex, s.settings.equipment);
  const needsCalibration = p.status === "needs_calibration" && logged.length === 0 && !selfCalibrate[current.id];
  const nextItem = items[idx + 1];
  const isLastExercise = idx >= items.length - 1;

  const key = `${current.id}:${activeIndex}`;
  const editingSet = editing != null ? logged.find((x) => x.setIndex === editing) : undefined;
  const lastLogged = logged.at(-1);
  const defaults: Draft = {
    key,
    weight: editingSet?.weight ?? lastLogged?.weight ?? target.weight ?? (ex.equipment === "barbell" ? s.settings.equipment.barbellKg : 0),
    reps: editingSet?.reps ?? target.reps,
    rir: editingSet?.rir ?? target.rirMin,
  };
  const d = draft?.key === key ? draft : defaults;
  const patch = (x: Partial<Draft>) => setDraft({ ...d, ...x });

  const completeSet = async () => {
    haptic();
    await store.logSet({
      id: editingSet?.id,
      sessionId,
      sessionExerciseId: current.id,
      exerciseId: current.exerciseId,
      setIndex: activeIndex,
      kind: "working",
      targetWeight: target.weight,
      targetReps: target.reps,
      targetRirMin: target.rirMin,
      targetRirMax: target.rirMax,
      weight: d.weight,
      reps: d.reps,
      rir: d.rir,
      techniqueOk: true,
    });
    setDraft(null);
    setEditorOpen(false);
    const wasEditing = editing != null;
    setEditing(null);
    if (wasEditing) return;
    const doneNow = activeIndex + 1 >= p.sets.length;
    if (!(doneNow && isLastExercise)) {
      setTimer({ endsAt: Date.now() + p.restSec * 1000, total: p.restSec, pausedLeft: null });
    }
    if (doneNow && !isLastExercise) setIdx(idx + 1);
  };

  const toggleWarmup = async (i: number) => {
    const existing = warmupsLogged.find((x) => x.setIndex === i);
    if (existing) return store.removeSet(existing.id);
    const w = p.warmups[i];
    await store.logSet({
      sessionId,
      sessionExerciseId: current.id,
      exerciseId: current.exerciseId,
      setIndex: i,
      kind: "warmup",
      targetWeight: w.weight,
      targetReps: w.reps,
      targetRirMin: null,
      targetRirMax: null,
      weight: w.weight,
      reps: w.reps,
      rir: null,
      techniqueOk: true,
    });
  };

  const goTo = (i: number) => {
    setIdx(i);
    setEditing(null);
    setDraft(null);
  };

  const openEditor = (setIndex: number | null) => {
    setEditing(setIndex);
    setEditorOpen(true);
  };

  const superset = day.exercises.find((x) => x.exerciseId === current.slotExerciseId)?.supersetGroup;
  const supersetPartner = superset
    ? items.find((se) => se.id !== current.id && day.exercises.find((x) => x.exerciseId === se.slotExerciseId)?.supersetGroup === superset)
    : undefined;
  const prev = p.lastExposure;
  const increasing = p.reason.code.startsWith("increase");
  const rehab = rehabPlan(s);
  const rirLabel = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

  return (
    <div className="pb-4">
      <ScreenHeader title={day.name} subtitle={elapsed} back={() => router.push("/")} onMenu={() => setSheet("menu")} center />

      {/* Exercise progress */}
      <div className="relative mb-4 flex items-center justify-between px-1">
        <div className="absolute inset-x-4 top-1/2 h-px bg-line" />
        {items.map((se, i) => {
          const done = isDone(se);
          const on = i === idx;
          return (
            <button
              key={se.id}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}. ${EXERCISES[se.exerciseId]?.name}${done ? " (klar)" : ""}`}
              aria-current={on ? "step" : undefined}
              className={cn(
                "tabular relative z-10 flex size-7 items-center justify-center rounded-full text-[11px] font-semibold transition",
                done ? "bg-accent-grad text-on-accent" : on ? "glow-soft border-2 border-accent bg-bg text-accent" : "border border-line bg-card-2 text-muted",
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </button>
          );
        })}
        <button aria-label="Övningar i passet" onClick={() => setSheet("menu")} className="relative z-10 flex size-7 items-center justify-center rounded-full bg-bg text-muted">
          <Plus size={16} />
        </button>
      </div>

      {/* Exercise header */}
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-line bg-card text-accent">
          <Dumbbell size={22} strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-bold leading-tight">{ex.name}</h2>
          <p className="text-[13px] text-muted">
            {MUSCLE_LABEL[ex.primary]}
            {supersetPartner && ` · superset med ${EXERCISES[supersetPartner.exerciseId]?.name.toLowerCase()}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} teknik`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-medium text-ink-2"
        >
          <Video size={13} /> Video
        </a>
        <button onClick={() => setSheet("tips")} className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-medium text-ink-2">
          <Lightbulb size={13} /> Tips
        </button>
        <button onClick={() => setSheet("history")} className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12px] font-medium text-ink-2">
          <History size={13} /> Historik
        </button>
        <button onClick={() => setSheet("swap")} aria-label="Byt övning" className="ml-auto flex size-8 items-center justify-center rounded-full border border-line bg-card text-ink-2">
          <Repeat size={14} />
        </button>
      </div>

      <Photo
        slot={IMAGES.exercise(ex.id)}
        crop="wide"
        sizes="(max-width: 448px) 100vw, 448px"
        alt={ex.name}
        className="mt-3 h-[190px] rounded-[18px] border border-line bg-[#111]"
        fallback={
          <div className="flex h-full items-center justify-center gap-2 bg-[#111] py-3">
            <AnatomyFigure view="front" fills={exerciseFills(ex)} className="h-full w-auto" />
            <AnatomyFigure view="back" fills={exerciseFills(ex)} className="h-full w-auto" />
          </div>
        }
      />

      {needsCalibration ? (
        <div className="mt-4">
          <Calibration
            exercise={ex}
            repTarget={p.sets[0].reps}
            onSave={(w, r, rir) => store.saveCalibration(ex.id, w, r, rir)}
            onSelf={() => setSelfCalibrate({ ...selfCalibrate, [current.id]: true })}
          />
        </div>
      ) : (
        <>
          {/* Target + progression note */}
          <div className="mt-4 flex items-center justify-between text-[13px]">
            <span className="text-ink-2">
              Mål: <b className="text-ink">{target.reps} reps</b> @ <b className="text-ink">{target.weight == null ? "valfri vikt" : `${kg(target.weight)} kg`}</b>
            </span>
            <span className="rounded-full bg-good-soft px-2.5 py-1 text-[12px] font-semibold text-good-ink">RIR {rirLabel(target.rirMin, target.rirMax)}</span>
          </div>
          {(increasing || p.reason.code === "reduce_after_misses" || p.reason.code === "deload" || p.notes.length > 0) && (
            <div className="mt-1.5 space-y-0.5 text-[12px]">
              {(increasing || p.reason.code === "reduce_after_misses" || p.reason.code === "deload") && (
                <p className={increasing ? "text-good-ink" : "text-accent-ink"}>
                  {increasing ? "↑ " : ""}
                  {p.reason.text}
                </p>
              )}
              {p.notes.map((n) => (
                <p key={n.code} className="text-muted">
                  {n.text}
                </p>
              ))}
            </div>
          )}

          {/* Set table */}
          <div className="surface mt-3 overflow-hidden rounded-[18px]">
            <div className="grid grid-cols-[44px_1fr_1.3fr_1fr_44px] px-1 pb-1 pt-2.5 text-[11px] text-muted">
              <span className="text-center">Set</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Vikt (kg)</span>
              <span className="text-center">RIR</span>
              <span />
            </div>
            {Array.from({ length: totalSets }, (_, i) => {
              const set = logged.find((x) => x.setIndex === i);
              const t = p.sets[i] ?? p.sets.at(-1)!;
              const isCurrent = i === activeIndex && (!allDone || editing != null);
              const reps = set ? set.reps : isCurrent ? d.reps : t.reps;
              const weight = set ? set.weight : isCurrent ? d.weight : t.weight;
              const rir = set ? set.rir : isCurrent ? d.rir : null;
              return (
                <div
                  key={i}
                  className={cn(
                    "relative grid h-[52px] grid-cols-[44px_1fr_1.3fr_1fr_44px] items-center px-1 text-[16px]",
                    isCurrent && "bg-gradient-to-r from-accent/25 via-accent/10 to-transparent",
                    i > 0 && "border-t border-line/60",
                  )}
                >
                  {isCurrent && <span className="absolute left-0 top-2 h-9 w-[3px] rounded-r bg-accent shadow-[0_0_10px_rgba(255,138,61,0.9)]" />}
                  <span className={cn("tabular text-center font-semibold", isCurrent ? "text-accent" : "text-ink-2")}>{i + 1}</span>
                  <button
                    onClick={() => (set || isCurrent ? openEditor(set ? i : null) : undefined)}
                    disabled={!set && !isCurrent}
                    className={cn("tabular text-center font-semibold", isCurrent && "text-glow text-ink")}
                  >
                    {reps}
                  </button>
                  <button
                    onClick={() => (set || isCurrent ? openEditor(set ? i : null) : undefined)}
                    disabled={!set && !isCurrent}
                    className={cn("tabular text-center font-semibold", isCurrent && "text-glow text-accent")}
                  >
                    {kg(weight ?? null)}
                  </button>
                  <button
                    onClick={() => (set || isCurrent ? openEditor(set ? i : null) : undefined)}
                    disabled={!set && !isCurrent}
                    className="tabular flex items-center justify-center gap-0.5 text-center text-ink-2"
                  >
                    {rir ?? "–"}
                    {(set || isCurrent) && <ChevronRight size={13} className="text-muted" />}
                  </button>
                  <span className="flex justify-center">
                    {set && !isCurrent ? (
                      <span role="img" aria-label={`Set ${i + 1} klart`} className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-card-2 text-ink">
                        <Check size={16} strokeWidth={2.4} />
                      </span>
                    ) : isCurrent ? (
                      <span role="img" aria-label={`Set ${i + 1} pågår`} className="relative size-8">
                        <span className="absolute inset-0 rounded-full border-[3px] border-accent/25" />
                        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-accent [animation-duration:2.4s] motion-reduce:animate-none" />
                      </span>
                    ) : (
                      <span className="size-8 rounded-full border border-[#333]" />
                    )}
                  </span>
                </div>
              );
            })}
            {allDone && editing == null && (
              <button onClick={() => openEditor(logged.length)} className="w-full border-t border-line/60 py-2.5 text-center text-[12px] text-muted">
                + Extra set
              </button>
            )}
          </div>

          {p.warmups.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="text-muted">Uppvärmning</span>
              {p.warmups.map((w, i) => {
                const done = warmupsLogged.some((x) => x.setIndex === i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleWarmup(i)}
                    aria-pressed={done}
                    className={cn("tabular rounded-full border px-2.5 py-1", done ? "border-good/40 bg-good-soft text-good-ink line-through" : "border-line bg-card text-ink-2")}
                  >
                    {kg(w.weight)}×{w.reps}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Rest · complete · next */}
      <div className="mt-4 grid grid-cols-[auto_auto_1fr] items-center gap-3">
        <RestTimer timer={timer} restSec={p.restSec} onChange={setTimer} />
        <button
          aria-label="Markera set som klart"
          onClick={() => (needsCalibration ? undefined : allDone && editing == null ? (isLastExercise ? setSheet("finish") : goTo(idx + 1)) : completeSet())}
          disabled={needsCalibration}
          className="glow-soft flex size-[68px] items-center justify-center rounded-full border border-accent/50 bg-card-2 text-ink transition active:scale-95 disabled:opacity-40"
        >
          <Check size={30} strokeWidth={2.2} />
        </button>
        {nextItem ? (
          <button onClick={() => goTo(idx + 1)} className="surface flex min-w-0 items-center gap-2 overflow-hidden rounded-[16px] p-2 text-left">
            <div className="min-w-0 flex-1 pl-1">
              <div className="text-[11px] text-muted">Nästa övning</div>
              <div className="truncate text-[14px] font-semibold">{EXERCISES[nextItem.exerciseId]?.name}</div>
            </div>
            <Photo
              slot={IMAGES.exercise(nextItem.exerciseId)}
              crop="square"
              sizes="48px"
              alt=""
              className="size-12 shrink-0 rounded-[10px]"
              fallback={<div className="size-full bg-card-2" />}
            />
          </button>
        ) : (
          <Button onClick={() => setSheet("finish")} className="h-[68px] rounded-[18px]">
            Avsluta pass
          </Button>
        )}
      </div>

      {/* Rehab between sets */}
      <button onClick={() => setSheet("rehab")} className="surface mt-3 flex w-full items-center gap-3 rounded-[16px] p-3 text-left">
        <span className="flex size-10 items-center justify-center rounded-full border border-line bg-card-2 text-accent">
          <Footprints size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">Hälsene-rehab</div>
          <div className="truncate text-[12px] text-muted">
            {timer ? "Kör under vilan" : "Mellan seten"} · {rehab.exercises.map((e) => e.name).join(", ")}
          </div>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </button>

      {prev && (
        <p className="mt-3 px-1 text-[12px] text-muted">
          Förra passet ({prev.date.slice(5).replace("-", "/")}): {kg(prev.weight)} kg × {prev.sets.map((x) => x.reps).join(", ")}
        </p>
      )}
      {!isLastExercise && (
        <button onClick={() => setSheet("finish")} className="mt-2 w-full py-2 text-center text-[12px] text-muted">
          Avsluta passet tidigt
        </button>
      )}

      {/* Set editor */}
      <Sheet open={editorOpen} onClose={() => { setEditorOpen(false); setEditing(null); }} title={editing != null && editing < logged.length ? `Ändra set ${editing + 1}` : `Set ${activeIndex + 1}`}>
        <div className="space-y-2.5">
          <Stepper label="Reps" value={d.reps} onChange={(v) => patch({ reps: v })} step={1} />
          <Stepper label="Vikt" value={d.weight} onChange={(v) => patch({ weight: v })} step={step} unit="kg" tint />
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-9 text-[11px] text-muted">RIR</span>
            {RIR_OPTIONS.map((r) => (
              <button
                key={r}
                aria-pressed={d.rir === r}
                onClick={() => patch({ rir: r })}
                className={cn(
                  "tabular h-10 flex-1 rounded-full text-[14px] font-medium",
                  d.rir === r ? "bg-accent-grad text-on-accent" : r >= target.rirMin && r <= target.rirMax ? "border border-good/40 bg-good-soft text-good-ink" : "border border-line bg-card-2 text-ink-2",
                )}
              >
                {r === 4 ? "4+" : r}
              </button>
            ))}
          </div>
          <Button size="lg" className="mt-2 w-full" onClick={completeSet}>
            <Check size={18} /> {editing != null && editing < logged.length ? "Spara ändring" : "Klart set"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title={day.name}>
        <div className="space-y-1.5">
          {items.map((se, i) => (
            <button
              key={se.id}
              onClick={() => {
                goTo(i);
                setSheet(null);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[14px] p-3 text-left text-[14px]",
                i === idx ? "border border-accent/50 bg-accent-soft" : "border border-line bg-card",
              )}
            >
              <span>
                {i + 1}. {EXERCISES[se.exerciseId]?.name}
              </span>
              <span className="tabular text-[12px] text-muted">
                {working(se).length}/{se.prescription.sets.length} set
              </span>
            </button>
          ))}
          <div className="h-2" />
          <Button variant="secondary" className="w-full" onClick={() => setSheet("swap")}>
            <Repeat size={16} /> Byt {ex.name.toLowerCase()}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setSheet("finish")}>
            Avsluta pass
          </Button>
          <Button
            variant="ghost"
            className="w-full text-bad"
            onClick={async () => {
              if (!confirm("Avbryta passet? Loggade set sparas inte som genomfört pass.")) return;
              await store.discardSession(sessionId);
              setTimer(null);
              router.push("/");
            }}
          >
            Avbryt pass
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === "tips"} onClose={() => setSheet(null)} title={`Tips · ${ex.name}`}>
        <div className="space-y-2 text-[14px]">
          <Card className="text-ink-2">{p.reason.text}</Card>
          <ol className="surface space-y-2 rounded-[18px] p-4">
            {ex.instructions.map((x, i) => (
              <li key={i} className="flex gap-3">
                <span className="tabular font-semibold text-accent">{i + 1}</span>
                <span className="text-ink-2">{x}</span>
              </li>
            ))}
          </ol>
          {ex.tips.map((t) => (
            <Card key={t} className="text-ink-2">
              💡 {t}
            </Card>
          ))}
          <p className="px-1 text-[12px] text-muted">Vila {p.restSec} s mellan seten. RIR = reps kvar i tanken.</p>
        </div>
      </Sheet>

      <HistorySheet open={sheet === "history"} onClose={() => setSheet(null)} exercise={ex} />
      <SwapSheet open={sheet === "swap"} onClose={() => setSheet(null)} current={current} />
      <RehabSheet open={sheet === "rehab"} onClose={() => setSheet(null)} />
      <FinishSheet
        open={sheet === "finish"}
        onClose={() => setSheet(null)}
        onFinish={async (rpe, pain) => {
          await store.finishSession(sessionId, rpe, pain);
          setTimer(null);
          setSheet(null);
        }}
        doneSets={items.reduce((a, se) => a + working(se).length, 0)}
        plannedSets={items.reduce((a, se) => a + se.prescription.sets.length, 0)}
      />
    </div>
  );
}

function HistorySheet({ open, onClose, exercise }: { open: boolean; onClose: () => void; exercise: Exercise }) {
  const { s } = useStore();
  const list = (exposuresByExercise(s).get(exercise.id) ?? []).slice().reverse().slice(0, 12);
  return (
    <Sheet open={open} onClose={onClose} title={`Historik · ${exercise.name}`}>
      {list.length === 0 ? (
        <p className="text-[14px] text-muted">Ingen historik ännu – första passet sätter grunden.</p>
      ) : (
        <div className="surface divide-y divide-line rounded-[18px] px-3">
          {list.map((e, i) => (
            <div key={i} className="tabular flex items-center justify-between py-2.5 text-[13px]">
              <span className="text-ink-2">
                {e.date}
                {e.isDeload ? " · deload" : ""}
              </span>
              <span className="font-semibold">
                {kg(e.weight)} kg × {e.sets.map((x) => x.reps).join(", ")}
              </span>
              <span className="text-muted">e1RM {kg(Math.round(exposureE1rm(e)))}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function Calibration({ exercise, repTarget, onSave, onSelf }: { exercise: Exercise; repTarget: number; onSave: (w: number, r: number, rir: number) => void; onSelf: () => void }) {
  const { s } = useStore();
  const [w, setW] = useState(exercise.equipment === "barbell" ? s.settings.equipment.barbellKg : 0);
  const [r, setR] = useState(repTarget);
  const [rir, setRir] = useState(2);
  const step = loadStep(exercise, s.settings.equipment);
  return (
    <div className="space-y-3 rounded-[18px] border border-accent/30 bg-accent-soft p-4">
      <div>
        <div className="font-semibold text-accent-ink">Kalibrering</div>
        <p className="text-sm text-ink-2">
          Ingen historik för {exercise.name.toLowerCase()}. Ange en nylig prestation, så räknar appen fram arbetsvikten. Vi gissar inte.
        </p>
      </div>
      <Stepper label="Vikt" value={w} onChange={setW} step={step} unit="kg" />
      <Stepper label="Reps" value={r} onChange={setR} step={1} min={1} />
      <div className="flex items-center gap-1">
        <span className="w-10 text-[10px] uppercase text-muted">RIR</span>
        {RIR_OPTIONS.map((x) => (
          <button
            key={x}
            aria-pressed={rir === x}
            onClick={() => setRir(x)}
            className={cn("h-9 flex-1 rounded-xl text-sm", rir === x ? "bg-accent-grad text-on-accent" : "border border-line bg-card-2 text-ink-2")}
          >
            {x === 4 ? "4+" : x}
          </button>
        ))}
      </div>
      {w > 0 || exercise.equipment === "bodyweight" ? <p className="text-xs text-muted">Uppskattad 1RM: {kg(Math.round(e1rm(w, r, rir) * 10) / 10)} kg</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(w, r, rir)}>
          Beräkna arbetsvikt
        </Button>
        <Button variant="secondary" onClick={onSelf}>
          Testa fram
        </Button>
      </div>
      <p className="text-xs text-muted">&bdquo;Testa fram&rdquo;: välj en vikt du klarar ca {repTarget + 2} gånger och logga ärligt – nästa pass utgår från det.</p>
    </div>
  );
}

function SwapSheet({ open, onClose, current }: { open: boolean; onClose: () => void; current: SessionExerciseRec }) {
  const store = useStore();
  const [permanent, setPermanent] = useState(false);
  const ex = EXERCISES[current.exerciseId];
  const options = swapOptions(store.s, ex);
  const original = EXERCISES[current.slotExerciseId];
  return (
    <Sheet open={open} onClose={onClose} title={`Byt ut ${ex.name.toLowerCase()}`}>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="size-4 accent-[#ff8a3d]" />
        Byt permanent i programmet
      </label>
      <div className="space-y-2">
        {current.exerciseId !== current.slotExerciseId && original && (
          <OptionRow
            ex={original}
            label="Original"
            onClick={async () => {
              await store.substitute(current.id, original.id, permanent);
              onClose();
            }}
          />
        )}
        {options.map((o) => (
          <OptionRow
            key={o.id}
            ex={o}
            onClick={async () => {
              await store.substitute(current.id, o.id, permanent);
              onClose();
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Övningar som belastar hälsenan för mycket i din nuvarande rehabfas visas inte.</p>
    </Sheet>
  );
}

function OptionRow({ ex, onClick, label }: { ex: Exercise; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="surface flex w-full items-center gap-3 rounded-[16px] p-2 text-left">
      <Photo slot={IMAGES.exercise(ex.id)} crop="square" sizes="48px" alt="" className="size-12 shrink-0 rounded-[10px]" fallback={<div className="size-full bg-card-2" />} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{ex.name}</div>
        <div className="truncate text-xs text-muted">
          {MUSCLE_LABEL[ex.primary]}
          {ex.secondary.length ? ` · ${ex.secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}` : ""}
        </div>
      </div>
      {label && <Chip>{label}</Chip>}
    </button>
  );
}

function FinishSheet({
  open,
  onClose,
  onFinish,
  doneSets,
  plannedSets,
}: {
  open: boolean;
  onClose: () => void;
  onFinish: (rpe: number, pain: number | null) => void;
  doneSets: number;
  plannedSets: number;
}) {
  const [rpe, setRpe] = useState<number | null>(7);
  const [rehabDone, setRehabDone] = useState(true);
  const [pain, setPain] = useState<number | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Avsluta pass">
      <div className="space-y-5">
        <p className="text-sm text-ink-2">
          {doneSets} av {plannedSets} arbetsset genomförda.
          {doneSets < plannedSets && " Ej loggade set räknas inte – progressionen utgår från det du faktiskt gjorde."}
        </p>
        <div>
          <div className="mb-2 text-sm font-medium">Hur tungt var passet totalt? (RPE)</div>
          <Scale value={rpe} onChange={setRpe} min={1} max={10} labels={["Lätt", "Max"]} />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={rehabDone} onChange={(e) => setRehabDone(e.target.checked)} className="size-4 accent-[#ff8a3d]" />
            Jag gjorde hälsene-rehaben
          </label>
          {rehabDone && (
            <>
              <div className="mb-2 text-xs text-muted">Högsta smärta i hälsenan under rehaben (0–10)</div>
              <Scale value={pain} onChange={setPain} labels={["Ingen", "Värsta"]} />
            </>
          )}
        </div>
        <Button size="lg" className="w-full" disabled={rpe == null || (rehabDone && pain == null)} onClick={() => onFinish(rpe!, rehabDone ? pain : null)}>
          Spara pass
        </Button>
      </div>
    </Sheet>
  );
}

function Summary({ sessionId }: { sessionId: string }) {
  const { s } = useStore();
  const router = useRouter();
  const session = s.sessions.find((x) => x.id === sessionId)!;
  const day = PROGRAM_BY_ID[session.programDayId];
  const { items, setsBySe } = useSessionData(sessionId);
  const cardio = cardioWeek(s, today());
  const slot = day.cardioSlot;
  const cardioPending = slot && cardio.pending.includes(slot) && session.date === today();

  const rows = items.map((se) => {
    const sets = (setsBySe.get(se.id) ?? []).filter((x) => x.kind === "working");
    const slotCfg = day.exercises.find((x) => x.exerciseId === se.slotExerciseId)!;
    const next = prescribeFor(s, slotCfg, { exercise: EXERCISES[se.exerciseId], date: today() });
    const beatTarget =
      sets.length >= se.prescription.sets.length &&
      sets.every((x, i) => x.reps >= (se.prescription.sets[i]?.reps ?? 0) && x.weight >= (se.prescription.sets[i]?.weight ?? 0));
    return { se, sets, next, beatTarget };
  });
  const tonnage = rows.reduce((a, r) => a + r.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);

  return (
    <div className="space-y-4">
      <ScreenHeader title="Pass klart" subtitle={`${day.name} · ${session.date}`} back={() => router.push("/")} />
      <div className="surface grid grid-cols-3 gap-2 rounded-[18px] p-4">
        <div>
          <div className="tabular text-[24px] font-bold">{Math.round(tonnage).toLocaleString("sv-SE")}</div>
          <div className="text-[12px] text-muted">kg volym</div>
        </div>
        <div>
          <div className="tabular text-[24px] font-bold">{rows.reduce((a, r) => a + r.sets.length, 0)}</div>
          <div className="text-[12px] text-muted">arbetsset</div>
        </div>
        <div>
          <div className="tabular text-[24px] font-bold">{session.sessionRpe ?? "–"}</div>
          <div className="text-[12px] text-muted">RPE</div>
        </div>
      </div>

      {cardioPending && (
        <Link href="/cardio" className="bg-accent-grad glow flex h-[52px] items-center justify-center rounded-full text-[16px] font-semibold text-on-accent">
          Fortsätt till cardio {slot} →
        </Link>
      )}

      <h2 className="text-[16px] font-semibold">Nästa pass är uppdaterat</h2>
      <div className="space-y-2">
        {rows.map(({ se, sets, next, beatTarget }) => (
          <Card key={se.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{EXERCISES[se.exerciseId]?.name}</div>
                <div className="tabular text-xs text-muted">Idag: {sets.length ? sets.map((x) => `${kg(x.weight)}×${x.reps}`).join(", ") : "ej genomförd"}</div>
              </div>
              {beatTarget && (
                <Chip tone="good">
                  <Trophy size={12} /> Mål nått
                </Chip>
              )}
            </div>
            <div className="mt-2 rounded-xl border border-line bg-card-2 p-2.5 text-sm">
              <div className="tabular font-semibold">
                Nästa: {next.weight == null ? "kalibrering" : `${kg(next.weight)} kg × ${next.sets.map((x) => x.reps).join(", ")}`}
              </div>
              <div className="text-xs text-muted">{next.reason.text}</div>
            </div>
          </Card>
        ))}
      </div>
      <Link href="/" className="flex h-12 items-center justify-center rounded-full border border-line bg-card-2 text-[15px] font-semibold">
        Till startsidan
      </Link>
    </div>
  );
}

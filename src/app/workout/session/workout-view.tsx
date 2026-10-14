"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Info, Lightbulb, Repeat, Trophy } from "lucide-react";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { AnatomyFigure, type Fills } from "@/components/anatomy";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, CheckDot, Chip, Scale, ScreenHeader, Sheet, Stepper, cn, kg } from "@/components/ui";
import { RestTimer, loadTimer, saveTimer, type TimerState } from "@/components/workout/rest-timer";
import { RehabSheet } from "@/components/workout/rehab-sheet";
import { cardioWeek, prescribeFor, rehabPlan, swapOptions } from "@/lib/coach";
import { loadStep } from "@/lib/engine/strength/rounding";
import { e1rm } from "@/lib/engine/strength/e1rm";
import type { Exercise } from "@/lib/engine/types";
import type { SessionExerciseRec, SetLogRec } from "@/lib/db/records";
import { EXERCISES } from "@/lib/program/exercises";
import { PROGRAM_BY_ID } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";
import { haptic, useWakeLock } from "@/lib/use-wake-lock";

const RIR_OPTIONS = [0, 1, 2, 3, 4];

function exerciseFills(ex: Exercise): Fills {
  const f: Fills = {};
  for (const m of ex.secondary) f[m] = "#f7caa8";
  f[ex.primary] = "var(--accent)";
  return f;
}

interface Draft {
  key: string;
  weight: number;
  reps: number;
  rir: number;
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
        <Link href="/" className="underline">Till startsidan</Link>
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
  const [sheet, setSheet] = useState<null | "menu" | "swap" | "rehab" | "finish" | "info" | "tips">(null);
  const [selfCalibrate, setSelfCalibrate] = useState<Record<string, boolean>>({});
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
    const wasEditing = editing != null;
    setEditing(null);
    if (wasEditing) return;
    const doneNow = activeIndex + 1 >= p.sets.length;
    const isLastExercise = idx >= items.length - 1;
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

  const superset = day.exercises.find((x) => x.exerciseId === current.slotExerciseId)?.supersetGroup;
  const supersetPartner = superset
    ? items.find((se) => se.id !== current.id && day.exercises.find((x) => x.exerciseId === se.slotExerciseId)?.supersetGroup === superset)
    : undefined;
  const prev = p.lastExposure;
  const increasing = p.reason.code.startsWith("increase");
  const rehab = rehabPlan(s);
  const rehabMin = Math.max(1, Math.round(rehab.exercises.reduce((a, e) => a + e.sets * ((e.holdSec ?? (e.reps ?? 10) * 3) + 20), 0) / 60));
  const rirLabel = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

  return (
    <div className="pb-4">
      <ScreenHeader
        title={ex.name}
        subtitle={`${MUSCLE_LABEL[ex.primary]} · övning ${idx + 1} av ${items.length}`}
        back={() => router.push("/")}
        onMenu={() => setSheet("menu")}
      />

      <div className="grid grid-cols-3 gap-2">
        {[
          { key: "info" as const, icon: Info, label: "Instruktion" },
          { key: "tips" as const, icon: Lightbulb, label: "Tips" },
          { key: "swap" as const, icon: Repeat, label: "Alternativ" },
        ].map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setSheet(key)} className="flex h-8 items-center justify-center gap-1.5 rounded-full border border-line bg-card text-[12px] text-ink-2">
            <Icon size={13} strokeWidth={1.8} /> {label}
          </button>
        ))}
      </div>

      <Photo
        slot={IMAGES.exercise(ex.id)}
        crop="wide"
        sizes="(max-width: 448px) 100vw, 448px"
        alt={ex.name}
        className="-mx-4 mt-3 h-[180px] bg-[#e9e5df]"
        fallback={
          <div className="flex h-full items-center justify-center gap-2 bg-[#e9e5df] py-3">
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
          <div className="mt-4 flex items-start justify-between">
            <div>
              <div className="text-[20px] font-semibold leading-tight">
                {allDone && editing == null ? "Alla set klara" : `Set ${activeIndex + 1} av ${p.sets.length}`}
              </div>
              <div className="text-[13px] text-muted">
                Mål: {target.reps} reps @ {target.weight == null ? "valfri vikt" : `${kg(target.weight)} kg`}
              </div>
            </div>
            <Chip tone="good" className="mt-1">RIR {rirLabel(target.rirMin, target.rirMax)}</Chip>
          </div>

          {(increasing || p.reason.code === "reduce_after_misses" || p.reason.code === "deload" || p.notes.length > 0 || supersetPartner) && (
            <div className="mt-2 space-y-0.5 text-[12px]">
              {(increasing || p.reason.code === "reduce_after_misses" || p.reason.code === "deload") && (
                <p className={increasing ? "text-good-ink" : "text-accent-ink"}>{increasing ? "↑ " : ""}{p.reason.text}</p>
              )}
              {p.notes.map((n) => <p key={n.code} className="text-muted">{n.text}</p>)}
              {supersetPartner && <p className="text-muted">Superset med {EXERCISES[supersetPartner.exerciseId]?.name.toLowerCase()}</p>}
            </div>
          )}

          {(!allDone || editing != null) && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <Stepper label="Reps" value={d.reps} onChange={(v) => patch({ reps: v })} step={1} />
                <Stepper label="Vikt" value={d.weight} onChange={(v) => patch({ weight: v })} step={step} unit="kg" tint />
              </div>
              <button
                aria-label="Markera set som klart"
                onClick={completeSet}
                className="flex size-[78px] shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] active:scale-95"
              >
                <Check size={34} strokeWidth={2} />
              </button>
            </div>
          )}

          {(!allDone || editing != null) && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-9 text-[11px] text-muted">RIR</span>
              {RIR_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => patch({ rir: r })}
                  className={cn(
                    "tabular h-8 flex-1 rounded-full text-[13px] font-medium",
                    d.rir === r ? "bg-ink text-white" : r >= target.rirMin && r <= target.rirMax ? "bg-good-soft text-good-ink" : "bg-card text-ink-2",
                  )}
                >
                  {r === 4 ? "4+" : r}
                </button>
              ))}
            </div>
          )}

          {p.warmups.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-[12px]">
              <span className="text-muted">Uppvärmning</span>
              {p.warmups.map((w, i) => {
                const done = warmupsLogged.some((x) => x.setIndex === i);
                return (
                  <button key={i} onClick={() => toggleWarmup(i)} className={cn("tabular rounded-full px-2.5 py-1", done ? "bg-good-soft text-good-ink line-through" : "bg-card text-ink-2")}>
                    {kg(w.weight)}×{w.reps}
                  </button>
                );
              })}
            </div>
          )}

          {/* Set table */}
          <div className="mt-3 rounded-[18px] bg-card p-1.5">
            {Array.from({ length: totalSets }, (_, i) => {
              const set = logged.find((x) => x.setIndex === i);
              const t = p.sets[i] ?? p.sets.at(-1)!;
              const isCurrent = i === activeIndex && (!allDone || editing != null);
              return (
                <button
                  key={i}
                  disabled={!set}
                  onClick={() => set && setEditing(i)}
                  className={cn(
                    "tabular grid h-10 w-full grid-cols-[30px_1fr_1fr_1fr_24px] items-center rounded-[12px] px-3 text-left text-[13px]",
                    isCurrent ? "bg-accent-soft font-semibold" : "text-ink-2",
                  )}
                >
                  <span className={isCurrent ? "" : "text-muted"}>{i + 1}</span>
                  <span>{set ? set.reps : isCurrent ? d.reps : t.reps} reps</span>
                  <span>{kg(set ? set.weight : isCurrent ? d.weight : (t.weight ?? null))} kg</span>
                  <span className="text-muted">{set ? `RIR ${set.rir ?? "–"}` : isCurrent ? `RIR ${d.rir}` : "–"}</span>
                  <CheckDot state={set && !isCurrent ? "done" : isCurrent ? "current" : "todo"} size={20} />
                </button>
              );
            })}
            {allDone && editing == null && (
              <button onClick={() => setEditing(logged.length)} className="w-full py-2 text-center text-[12px] text-muted">
                + Extra set
              </button>
            )}
          </div>

          {prev && (
            <p className="mt-2 px-1 text-[12px] text-muted">
              Förra passet ({prev.date.slice(5).replace("-", "/")}): {kg(prev.weight)} kg × {prev.sets.map((x) => x.reps).join(", ")}
            </p>
          )}
        </>
      )}

      {/* Rest ring + rehab card */}
      <div className="mt-4 flex items-center gap-3">
        <RestTimer timer={timer} restSec={p.restSec} onChange={setTimer} />
        <button onClick={() => setSheet("rehab")} className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] bg-card p-2.5 text-left">
          <Photo
            slot={IMAGES.rehab}
            crop="card"
            sizes="60px"
            alt=""
            className="h-[72px] w-[60px] shrink-0 rounded-[12px]"
            fallback={
              <div className="h-full bg-[#e9e5df]">
                <AnatomyFigure view="back" fills={{ calves: "var(--accent)" }} viewBox="56 270 88 130" className="h-full w-full" />
              </div>
            }
          />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">Hälsene rehab</div>
            <div className="text-[12px] text-muted">{timer ? "Kör under vilan" : "Mellan seten"}</div>
            <div className="text-[12px] text-muted">
              {rehab.exercises.length} övningar · {rehabMin} min
            </div>
          </div>
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {idx > 0 && (
          <Button variant="soft" onClick={() => { setIdx(idx - 1); setEditing(null); }}>
            <ChevronLeft size={18} />
          </Button>
        )}
        {idx < items.length - 1 ? (
          <Button variant={allDone ? "dark" : "soft"} className="flex-1" onClick={() => { setIdx(idx + 1); setEditing(null); }}>
            Nästa: {EXERCISES[items[idx + 1].exerciseId]?.name}
          </Button>
        ) : (
          <Button variant="accent" className="flex-1" onClick={() => setSheet("finish")}>
            Avsluta pass
          </Button>
        )}
      </div>

      <Sheet open={sheet === "menu"} onClose={() => setSheet(null)} title={day.name}>
        <div className="space-y-1.5">
          {items.map((se, i) => (
            <button
              key={se.id}
              onClick={() => { setIdx(i); setEditing(null); setSheet(null); }}
              className={cn("flex w-full items-center justify-between rounded-[14px] p-3 text-left text-[14px]", i === idx ? "bg-ink text-white" : "bg-card")}
            >
              <span>{i + 1}. {EXERCISES[se.exerciseId]?.name}</span>
              <span className="tabular text-[12px] opacity-70">{working(se).length}/{se.prescription.sets.length} set</span>
            </button>
          ))}
          <div className="h-2" />
          {idx < items.length - 1 && (
            <Button variant="soft" className="w-full" onClick={() => setSheet("finish")}>
              Avsluta passet tidigt
            </Button>
          )}
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

      <Sheet open={sheet === "tips"} onClose={() => setSheet(null)} title="Tips & progression">
        <div className="space-y-2 text-[14px]">
          <Card className="text-ink-2">{p.reason.text}</Card>
          {p.notes.map((n) => <Card key={n.code} className="text-ink-2">{n.text}</Card>)}
          {ex.tips.map((t) => <Card key={t} className="text-ink-2">💡 {t}</Card>)}
          <p className="px-1 text-[12px] text-muted">Vila {p.restSec} s mellan seten. RIR = reps kvar i tanken.</p>
        </div>
      </Sheet>

      <SwapSheet open={sheet === "swap"} onClose={() => setSheet(null)} current={current} />
      <RehabSheet open={sheet === "rehab"} onClose={() => setSheet(null)} />
      <InfoSheet open={sheet === "info"} onClose={() => setSheet(null)} exercise={ex} />
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

function Calibration({ exercise, repTarget, onSave, onSelf }: { exercise: Exercise; repTarget: number; onSave: (w: number, r: number, rir: number) => void; onSelf: () => void }) {
  const { s } = useStore();
  const [w, setW] = useState(exercise.equipment === "barbell" ? s.settings.equipment.barbellKg : 0);
  const [r, setR] = useState(repTarget);
  const [rir, setRir] = useState(2);
  const step = loadStep(exercise, s.settings.equipment);
  return (
    <Card className="space-y-3 bg-accent-soft">
      <div>
        <div className="font-semibold">Kalibrering</div>
        <p className="text-sm text-ink-2">
          Ingen historik för {exercise.name.toLowerCase()}. Ange en nylig prestation, så räknar appen fram arbetsvikten. Vi gissar inte.
        </p>
      </div>
      <Stepper label="Vikt" value={w} onChange={setW} step={step} unit="kg" />
      <Stepper label="Reps" value={r} onChange={setR} step={1} min={1} />
      <div className="flex items-center gap-1">
        <span className="w-10 text-[10px] uppercase text-muted">RIR</span>
        {RIR_OPTIONS.map((x) => (
          <button key={x} onClick={() => setRir(x)} className={cn("h-9 flex-1 rounded-xl text-sm", rir === x ? "bg-ink text-white" : "bg-card")}>
            {x === 4 ? "4+" : x}
          </button>
        ))}
      </div>
      {w > 0 || exercise.equipment === "bodyweight" ? (
        <p className="text-xs text-muted">Uppskattad 1RM: {kg(Math.round(e1rm(w, r, rir) * 10) / 10)} kg</p>
      ) : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(w, r, rir)}>
          Beräkna arbetsvikt
        </Button>
        <Button variant="ghost" onClick={onSelf}>
          Testa fram
        </Button>
      </div>
      <p className="text-xs text-muted">&bdquo;Testa fram&rdquo;: välj en vikt du klarar ca {repTarget + 2} gånger och logga ärligt – nästa pass utgår från det.</p>
    </Card>
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
        <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} className="size-4 accent-black" />
        Byt permanent i programmet
      </label>
      <div className="space-y-2">
        {current.exerciseId !== current.slotExerciseId && original && (
          <OptionRow ex={original} label="Original" onClick={async () => { await store.substitute(current.id, original.id, permanent); onClose(); }} />
        )}
        {options.map((o) => (
          <OptionRow key={o.id} ex={o} onClick={async () => { await store.substitute(current.id, o.id, permanent); onClose(); }} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Övningar som belastar hälsenan för mycket i din nuvarande rehabfas visas inte.</p>
    </Sheet>
  );
}

function OptionRow({ ex, onClick, label }: { ex: Exercise; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-card p-3 text-left">
      <div>
        <div className="text-sm font-medium">{ex.name}</div>
        <div className="text-xs text-muted">
          {MUSCLE_LABEL[ex.primary]}
          {ex.secondary.length ? ` · ${ex.secondary.map((m) => MUSCLE_LABEL[m]).join(", ")}` : ""}
        </div>
      </div>
      {label && <Chip>{label}</Chip>}
    </button>
  );
}

function InfoSheet({ open, onClose, exercise }: { open: boolean; onClose: () => void; exercise: Exercise }) {
  return (
    <Sheet open={open} onClose={onClose} title={exercise.name}>
      <div className="space-y-3">
        <ol className="space-y-2">
          {exercise.instructions.map((x, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="tabular font-semibold">{i + 1}</span>
              <span className="text-ink-2">{x}</span>
            </li>
          ))}
        </ol>
        {exercise.tips.map((t) => (
          <p key={t} className="rounded-2xl bg-card p-3 text-sm text-ink-2">💡 {t}</p>
        ))}
        <Link href={`/library/${exercise.id}`} className="block text-sm underline">Öppna i övningsbiblioteket</Link>
      </div>
    </Sheet>
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
            <input type="checkbox" checked={rehabDone} onChange={(e) => setRehabDone(e.target.checked)} className="size-4 accent-black" />
            Jag gjorde hälsene-rehaben
          </label>
          {rehabDone && (
            <>
              <div className="mb-2 text-xs text-muted">Högsta smärta i hälsenan under rehaben (0–10)</div>
              <Scale value={pain} onChange={setPain} labels={["Ingen", "Värsta"]} />
            </>
          )}
        </div>
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          disabled={rpe == null || (rehabDone && pain == null)}
          onClick={() => onFinish(rpe!, rehabDone ? pain : null)}
        >
          Spara pass
        </Button>
      </div>
    </Sheet>
  );
}

function Summary({ sessionId }: { sessionId: string }) {
  const { s } = useStore();
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
    const beatTarget = sets.length >= se.prescription.sets.length && sets.every((x, i) => x.reps >= (se.prescription.sets[i]?.reps ?? 0) && x.weight >= (se.prescription.sets[i]?.weight ?? 0));
    return { se, sets, next, beatTarget };
  });
  const tonnage = rows.reduce((a, r) => a + r.sets.reduce((b, x) => b + x.weight * x.reps, 0), 0);

  return (
    <div className="space-y-4 pt-2">
      <header className="flex items-center gap-3">
        <Link href="/" aria-label="Till startsidan" className="flex size-9 items-center justify-center rounded-full bg-card">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="flex-1 font-serif text-[34px] leading-none">Pass klart</h1>
      </header>
      <Card className="bg-hero text-white">
        <div className="text-sm text-white/60">{day.name} · {session.date}</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <div className="tabular text-2xl font-semibold">{Math.round(tonnage).toLocaleString("sv-SE")}</div>
            <div className="text-xs text-white/50">kg volym</div>
          </div>
          <div>
            <div className="tabular text-2xl font-semibold">{rows.reduce((a, r) => a + r.sets.length, 0)}</div>
            <div className="text-xs text-white/50">arbetsset</div>
          </div>
          <div>
            <div className="tabular text-2xl font-semibold">{session.sessionRpe ?? "–"}</div>
            <div className="text-xs text-white/50">RPE</div>
          </div>
        </div>
      </Card>

      {cardioPending && (
        <Link href="/cardio" className="block">
          <Button variant="accent" size="lg" className="w-full">Fortsätt till cardio {slot} →</Button>
        </Link>
      )}

      <h2 className="text-[15px] font-semibold">Nästa pass är uppdaterat</h2>
      <div className="space-y-2">
        {rows.map(({ se, sets, next, beatTarget }) => (
          <Card key={se.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{EXERCISES[se.exerciseId]?.name}</div>
                <div className="tabular text-xs text-muted">
                  Idag: {sets.length ? sets.map((x) => `${kg(x.weight)}×${x.reps}`).join(", ") : "ej genomförd"}
                </div>
              </div>
              {beatTarget && <Chip tone="good"><Trophy size={12} /> Mål nått</Chip>}
            </div>
            <div className="mt-2 rounded-xl bg-card-2/70 p-2.5 text-sm">
              <div className="tabular font-semibold">
                Nästa: {next.weight == null ? "kalibrering" : `${kg(next.weight)} kg × ${next.sets.map((x) => x.reps).join(", ")}`}
              </div>
              <div className="text-xs text-muted">{next.reason.text}</div>
            </div>
          </Card>
        ))}
      </div>
      <Link href="/" className="block">
        <Button variant="soft" className="w-full">Till startsidan</Button>
      </Link>
    </div>
  );
}

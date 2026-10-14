"use client";

import { useState } from "react";
import { AnatomyFigure } from "@/components/anatomy";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, CheckDot, Chip, PillTabs, Scale, ScreenHeader, SectionTitle } from "@/components/ui";
import { pendingMorningCheck, rehabPlan } from "@/lib/coach";
import { ACHILLES_PHASES, type RehabExercise } from "@/lib/engine/rehab/achilles";
import { MOBILITY, PREHAB } from "@/lib/program/prehab";
import { useStore, today } from "@/lib/store";

type Tab = "rehab" | "prehab" | "mobility";

function useDoneToday(key: string) {
  const storageKey = `${key}:${today()}`;
  const [done, setDone] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    } catch {
      return [];
    }
  });
  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id];
    setDone(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  return [done, toggle] as const;
}

function ExerciseList({ items, storeKey }: { items: RehabExercise[]; storeKey: string }) {
  const [done, toggle] = useDoneToday(storeKey);
  return (
    <div className="mt-3 space-y-2">
      {items.map((e, i) => (
        <button key={e.id + i} onClick={() => toggle(e.id)} className="flex w-full items-center gap-3 rounded-[16px] bg-card p-2 text-left">
          <span className="tabular w-5 text-center text-[13px] text-muted">{i + 1}</span>
          <Photo
            slot={IMAGES.rehabExercise(e.id)}
            crop="square"
            sizes="48px"
            alt=""
            className="size-12 shrink-0 rounded-[10px]"
            fallback={
              <div className="h-full bg-[#e9e5df]">
                <AnatomyFigure view="back" fills={{ calves: "var(--accent)" }} viewBox="56 270 88 130" className="h-full w-full" />
              </div>
            }
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">{e.name}</div>
            <div className="text-[12px] text-muted">{e.dose}</div>
          </div>
          <span className="pr-2">
            <CheckDot state={done.includes(e.id) ? "done" : "todo"} size={22} />
          </span>
        </button>
      ))}
    </div>
  );
}

export default function RehabPage() {
  const store = useStore();
  const { s } = store;
  const t = today();
  const [tab, setTab] = useState<Tab>("rehab");
  const plan = rehabPlan(s);
  const morning = pendingMorningCheck(s, t);
  const [pain, setPain] = useState<number | null>(null);
  const [morningPain, setMorningPain] = useState<number | null>(null);
  const loggedToday = s.rehab.some((r) => r.date === t && !r.deletedAt);
  const logs = s.rehab.filter((r) => !r.deletedAt).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const nextPhase = ACHILLES_PHASES.find((p) => p.phase === plan.phase.phase + 1);

  const advance = async () => {
    if (!nextPhase || !confirm(`Har din fysioterapeut godkänt fas ${nextPhase.phase} (${nextPhase.name})?`)) return;
    await store.updateSettings({
      rehab: {
        ...s.settings.rehab,
        phase: nextPhase.phase,
        phaseStartedAt: t,
        approvedPhases: Array.from(new Set([...s.settings.rehab.approvedPhases, nextPhase.phase])),
      },
    });
  };

  return (
    <div>
      <ScreenHeader title="Rehab & Prehab" back />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "rehab", label: "Aktiv rehab" },
          { value: "prehab", label: "Förebyggande" },
          { value: "mobility", label: "Rörlighet" },
        ]}
      />

      {tab === "rehab" && (
        <>
          <div className="relative mt-3 h-[150px] overflow-hidden rounded-[20px] text-white">
            <Photo
              slot={IMAGES.rehab}
              crop="hero"
              sizes="(max-width: 448px) 100vw, 448px"
              alt=""
              className="absolute inset-0"
              fallback={
                <div className="flex h-full justify-end bg-[#2a2725] pr-6">
                  <AnatomyFigure view="back" dark fills={{ calves: "var(--accent)", hamstrings: "#6b5244" }} viewBox="50 200 100 200" className="h-full w-auto" />
                </div>
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute left-4 top-3">
              <Chip tone="accent">Fas {plan.phase.phase} · nivå {plan.level}</Chip>
            </div>
            <div className="absolute bottom-3 left-4">
              <div className="text-[22px] font-semibold leading-tight">Hälsene rehab</div>
              <div className="text-[12px] text-white/80">Kör mellan seten (2–3 min)</div>
            </div>
          </div>
          <p className="mt-2 px-1 text-[12px] text-muted">{plan.phase.name} – {plan.reason.text}</p>

          <ExerciseList items={plan.exercises} storeKey="rehab-done" />

          {plan.suggestPhaseAdvance && nextPhase && (
            <Card className="mt-3 bg-good-soft">
              <div className="text-[14px] font-semibold">Redo för fas {nextPhase.phase}</div>
              <p className="mt-1 text-[13px] text-ink-2">Högsta nivån tolereras väl. Gå vidare först när fysio har godkänt.</p>
              <Button size="sm" className="mt-3" onClick={advance}>Godkänt av fysio – gå vidare</Button>
            </Card>
          )}

          {morning && (
            <Card className="mt-3">
              <div className="text-[14px] font-semibold">Morgonkoll · pass {morning.date}</div>
              <p className="mb-2 text-[12px] text-muted">Smärta/stelhet i hälsenan i morse (0–10). Baslinje: {s.settings.rehab.baselineMorningPain}.</p>
              <Scale value={morningPain} onChange={setMorningPain} labels={["Ingen", "Värsta"]} />
              <Button size="sm" className="mt-3 w-full" disabled={morningPain == null} onClick={() => morningPain != null && store.setMorningPain(morning.id, morningPain)}>
                Spara
              </Button>
            </Card>
          )}

          {!loggedToday && (
            <Card className="mt-3">
              <div className="text-[14px] font-semibold">Logga rehab utan styrkepass</div>
              <p className="mb-2 text-[12px] text-muted">Högsta smärta under övningarna (0–10). Upp till 5 är ok.</p>
              <Scale value={pain} onChange={setPain} labels={["Ingen", "Värsta"]} />
              <Button size="sm" className="mt-3 w-full" disabled={pain == null} onClick={() => pain != null && store.logRehab(pain)}>
                Spara rehabpass
              </Button>
            </Card>
          )}

          {logs.length > 0 && (
            <>
              <SectionTitle>Historik</SectionTitle>
              <Card className="divide-y divide-line px-3 py-1">
                {logs.map((r) => (
                  <div key={r.id} className="tabular flex justify-between py-2 text-[13px]">
                    <span>{r.date} · fas {r.phase}/{r.level}</span>
                    <span className="text-muted">under {r.painDuring} · morgon {r.painNextMorning ?? "–"}</span>
                  </div>
                ))}
              </Card>
            </>
          )}
          <p className="mt-3 px-1 text-[11px] text-muted">Standardprotokoll med belastningsprogression och smärtmonitorering. Stäm av fasbyten med din fysioterapeut.</p>
        </>
      )}

      {tab === "prehab" && (
        <>
          <p className="mt-3 px-1 text-[13px] text-ink-2">Skadeförebyggande styrka 1–2 gånger i veckan, gärna efter benpassen. Inga hopp.</p>
          <ExerciseList items={PREHAB} storeKey="prehab-done" />
        </>
      )}
      {tab === "mobility" && (
        <>
          <p className="mt-3 px-1 text-[13px] text-ink-2">Lugn rörlighet på vilodagar eller efter cardio. Stanna inom smärtfritt omfång.</p>
          <ExerciseList items={MOBILITY} storeKey="mobility-done" />
        </>
      )}
    </div>
  );
}

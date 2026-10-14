"use client";

import { useState } from "react";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { Sun } from "lucide-react";
import { Button, Card, Chip, Gauge, PillTabs, ScreenHeader, SectionTitle, cn, kg } from "@/components/ui";
import { reviewWeek } from "@/lib/coach";
import { addDays, isoWeek, weekStart } from "@/lib/engine/weekly/dates";
import type { Muscle } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/program/exercises";
import { PROGRAM } from "@/lib/program/program";
import { useStore, today } from "@/lib/store";

type Tab = "report" | "insights" | "recs";

/** Slot that receives a weekly +/- set for a muscle: its last isolation exercise in the program. */
function volumeSlotFor(muscle: Muscle): string | undefined {
  const slots = PROGRAM.flatMap((d) => d.exercises).filter((e) => EXERCISES[e.exerciseId]?.primary === muscle);
  return (slots.filter((e) => !EXERCISES[e.exerciseId].isCompound).at(-1) ?? slots.at(-1))?.exerciseId;
}

export default function CoachPage() {
  const store = useStore();
  const { s } = store;
  const [tab, setTab] = useState<Tab>("report");
  const [offset, setOffset] = useState(0);
  const date = offset === 0 ? today() : addDays(weekStart(today()), -7 * offset);
  const r = reviewWeek(s, date);
  const pct = (x: number | null) => (x == null ? "–" : `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`);
  const name = (id: string) => EXERCISES[id]?.name ?? id;

  const summary =
    r.tonnageDeltaPct == null
      ? `Du har genomfört ${r.sessionsDone} av ${r.sessionsPlanned} pass. När du har två veckors data jämför coachen din utveckling vecka för vecka.`
      : `Din totala träningsvolym ${r.tonnageDeltaPct >= 0 ? "ökade" : "minskade"} med ${Math.abs(Math.round(r.tonnageDeltaPct * 100))} % jämfört med förra veckan (${r.sessionsDone} av ${r.sessionsPlanned} pass).` +
        (r.increaseWeight.length ? ` ${r.increaseWeight.length} övningar är redo för högre vikt.` : "") +
        (r.plateaus.length ? ` ${r.plateaus.length} övningar har stagnerat.` : "");

  const applyVolume = async (muscle: Muscle, delta: number) => {
    const slot = volumeSlotFor(muscle);
    if (!slot) return;
    const cur = s.settings.volumeModifiers[slot] ?? 0;
    await store.updateSettings({ volumeModifiers: { ...s.settings.volumeModifiers, [slot]: Math.max(-2, Math.min(2, cur + delta)) } });
  };

  return (
    <div className="space-y-3">
      <ScreenHeader title="Coach" subtitle={`Vecka ${isoWeek(date)}`} />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "report", label: "Veckorapport" },
          { value: "insights", label: "Insikter" },
          { value: "recs", label: "Rekommendationer" },
        ]}
      />
      <div className="flex items-center justify-between text-[12px] text-muted">
        <button onClick={() => setOffset(offset + 1)}>‹ Föregående vecka</button>
        <button disabled={offset === 0} onClick={() => setOffset(offset - 1)} className="disabled:opacity-30">Nästa ›</button>
      </div>

      {tab === "report" && (
        <>
          <Card className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Sun size={20} />
            </span>
            <p className="text-[15px] leading-snug">{summary}</p>
          </Card>
          <SectionTitle>Fokus nästa vecka</SectionTitle>
          <Card className="divide-y divide-line px-3 py-1">
            {r.focus.map((f, i) => (
              <div key={i} className="flex gap-3 py-2.5 text-[13px]">
                <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-card-2 text-[11px]">{i + 1}</span>
                <span className="text-ink-2">{f}</span>
              </div>
            ))}
          </Card>
          <Card>
            <div className="mb-2 text-[15px] font-semibold">Återhämtning</div>
            <div className="flex items-end gap-4">
              <Gauge value={r.recovery.score ? (r.recovery.score - 1) * 2.5 : 0} size={132}>
                <span className="tabular text-[24px] font-semibold leading-none">
                  {r.recovery.score ? kg(Math.round((r.recovery.score - 1) * 25) / 10) : "–"}
                  <span className="text-[13px] font-normal text-muted">/10</span>
                </span>
              </Gauge>
              <div className="pb-1">
                <div className="text-[14px] font-semibold">{r.recovery.flag ? "Var uppmärksam" : r.recovery.score ? "Bra slag!" : "Ingen data än"}</div>
                <p className="text-[12px] text-muted">{r.recovery.flag ? r.recovery.text : r.recovery.score ? "Du är redo för nästa pass." : "Fyll i dagsformen före passen."}</p>
              </div>
            </div>
          </Card>
          <SectionTitle>Cardio</SectionTitle>
          <Card className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="tabular text-[20px] font-semibold">{Math.round(r.cardio.minutes)}</div>
              <div className="text-[11px] text-muted">min ({r.cardio.prevMinutes ? pct((r.cardio.minutes - r.cardio.prevMinutes) / r.cardio.prevMinutes) : "–"})</div>
            </div>
            <div>
              <div className="tabular text-[20px] font-semibold">{r.cardio.sessions}/3</div>
              <div className="text-[11px] text-muted">pass</div>
            </div>
            <div>
              <div className="tabular text-[20px] font-semibold">{Math.round(r.cardio.load)}</div>
              <div className="text-[11px] text-muted">belastning</div>
            </div>
          </Card>
        </>
      )}

      {tab === "insights" && (
        <>
          <SectionTitle>Styrka (estimerad 1RM mot förra veckan)</SectionTitle>
          <Card className="divide-y divide-line p-2">
            {r.e1rmChanges.length === 0 && <p className="p-2 text-sm text-muted">Behöver två veckor med samma övningar.</p>}
            {[...r.e1rmChanges].sort((a, b) => b.pct - a.pct).map((c) => (
              <div key={c.exerciseId} className="flex justify-between px-2 py-2 text-sm">
                <span>{name(c.exerciseId)}</span>
                <span className={cn("tabular font-medium", c.pct > 0.005 ? "text-good" : c.pct < -0.01 ? "text-bad" : "text-muted")}>{pct(c.pct)}</span>
              </div>
            ))}
          </Card>
          <SectionTitle>Volym per muskelgrupp (set)</SectionTitle>
          <Card className="divide-y divide-line p-2">
            {r.volumeByMuscle.map((v) => (
              <div key={v.muscle} className="tabular flex justify-between px-2 py-2 text-sm">
                <span>{MUSCLE_LABEL[v.muscle]}</span>
                <span>
                  {kg(v.sets)} <span className="text-muted">(förra {kg(v.prevSets)})</span>
                </span>
              </div>
            ))}
          </Card>
          {r.plateaus.length > 0 && (
            <>
              <SectionTitle>Platåer</SectionTitle>
              {r.plateaus.map((p) => (
                <Card key={p.exerciseId} className="text-sm">
                  <div className="font-medium">{name(p.exerciseId)}</div>
                  <div className="text-ink-2">{p.text}</div>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {tab === "recs" && (
        <>
          <SectionTitle>Högre vikt nästa pass</SectionTitle>
          <Card className="divide-y divide-line p-2">
            {r.increaseWeight.length === 0 && <p className="p-2 text-sm text-muted">Inga viktökningar ännu – fortsätt öka reps.</p>}
            {r.increaseWeight.map((w) => (
              <div key={w.exerciseId} className="tabular flex justify-between px-2 py-2 text-sm">
                <span>{name(w.exerciseId)}</span>
                <span className="font-medium text-good">{kg(w.from)} → {kg(w.to)} kg</span>
              </div>
            ))}
          </Card>
          <SectionTitle>Öka reps, samma vikt</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {r.addReps.map((id) => <Chip key={id}>{name(id)}</Chip>)}
          </div>
          <SectionTitle>Volymjusteringar</SectionTitle>
          {r.volumeChanges.length === 0 && <Card className="text-sm text-muted">Volymen ser balanserad ut.</Card>}
          {r.volumeChanges.map((v) => (
            <Card key={v.muscle} className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{MUSCLE_LABEL[v.muscle]} {v.delta > 0 ? "+1 set" : "−1 set"}</div>
                <div className="text-xs text-muted">{v.text}</div>
              </div>
              <Button size="sm" onClick={() => applyVolume(v.muscle, v.delta)}>Tillämpa</Button>
            </Card>
          ))}
          {r.deload && (
            <Card className="bg-accent-soft text-sm">
              <div className="font-semibold">Deload</div>
              {r.deload.text}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

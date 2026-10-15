"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import { AnatomyFigure, MuscleMap, type Fills } from "@/components/anatomy";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { IMAGES, Photo } from "@/components/photo";
import { Button, Card, Chip, PillTabs, ScreenHeader, SectionTitle, Sheet, Stepper, cn, kg } from "@/components/ui";
import { exposuresByExercise, latestCalibration } from "@/lib/coach";
import { achillesAllowed } from "@/lib/engine/rehab/achilles";
import { exposureE1rm } from "@/lib/engine/strength/e1rm";
import { loadStep } from "@/lib/engine/strength/rounding";
import type { Exercise } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/program/exercises";
import { PROGRAM } from "@/lib/program/program";
import { useStore } from "@/lib/store";
import { useFavorites } from "@/lib/favorites";

const ACHILLES_TEXT = { none: "Ingen", low: "Låg", moderate: "Måttlig – låst till rehabfas 4", high: "Hög – kräver klartecken" };
const fillsFor = (ex: Exercise): Fills => {
  const f: Fills = {};
  for (const m of ex.secondary) f[m] = "#9a4d1e";
  f[ex.primary] = "#ff8a3d";
  return f;
};

export function ExerciseDetail({ id }: { id: string }) {
  const store = useStore();
  const { s } = store;
  const ex = EXERCISES[id];
  const [tab, setTab] = useState<"overview" | "how" | "muscles" | "alt">("overview");
  const { favorites, toggle } = useFavorites();
  const fav = favorites.includes(id);
  const toggleFav = () => toggle(id);
  const [addOpen, setAddOpen] = useState(false);
  const [w, setW] = useState(0);
  const [r, setR] = useState(8);
  const [rir, setRir] = useState(2);
  if (!ex) return <p className="pt-20 text-center text-muted">Okänd övning.</p>;

  const history = exposuresByExercise(s).get(ex.id) ?? [];
  const cal = latestCalibration(s, ex.id);
  const locked = !achillesAllowed(ex.achillesLoad, s.settings.rehab);
  const usedIn = PROGRAM.filter((d) => d.exercises.some((e) => (s.settings.substitutions[e.exerciseId] ?? e.exerciseId) === ex.id));
  const slots = PROGRAM.flatMap((d) => d.exercises.map((e) => ({ day: d, slot: e }))).filter(({ slot }) => EXERCISES[slot.exerciseId]?.primary === ex.primary);
  const showFront = !["back", "rear_delts", "triceps", "hamstrings", "glutes"].includes(ex.primary);
  const fills = fillsFor(ex);

  return (
    <div>
      <ScreenHeader title={ex.name} subtitle={MUSCLE_LABEL[ex.primary]} back />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Översikt" },
          { value: "how", label: "Utförande" },
          { value: "muscles", label: "Muskler" },
          { value: "alt", label: "Alternativ" },
        ]}
      />

      {tab === "overview" && (
        <>
          <Photo
            slot={IMAGES.exercise(ex.id)}
            crop="wide"
            sizes="(max-width: 448px) 100vw, 448px"
            alt={ex.name}
            className="mt-3 h-[190px] rounded-[18px]"
            fallback={
              <div className="flex h-full items-center justify-center bg-[#111]">
                <AnatomyFigure view={showFront ? "front" : "back"} fills={fills} viewBox="28 30 144 210" className="h-full w-auto" />
              </div>
            }
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["front", "back"] as const).map((v) => (
              <div key={v} className="flex h-[100px] items-center justify-center overflow-hidden rounded-[14px] bg-[#111]">
                <AnatomyFigure view={v} fills={fills} viewBox="28 30 144 230" className="h-full w-auto" />
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] text-muted">Primära muskler</div>
              <Chip tone="accent" className="px-4 py-1.5">{MUSCLE_LABEL[ex.primary]}</Chip>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-muted">Sekundära muskler</div>
              <div className="flex flex-wrap gap-1.5">
                {ex.secondary.length ? ex.secondary.map((m) => <Chip key={m} className="bg-card px-3 py-1.5">{MUSCLE_LABEL[m]}</Chip>) : <span className="text-[13px] text-muted">–</span>}
              </div>
            </div>
          </div>

          <Card className="mt-4">
            <div className="mb-2 text-[14px] font-semibold">Utförande</div>
            <ol className="space-y-1.5">
              {ex.instructions.map((x, i) => (
                <li key={i} className="flex gap-3 text-[12px]">
                  <span className="tabular w-3 font-semibold">{i + 1}</span>
                  <span className="text-ink-2">{x}</span>
                </li>
              ))}
            </ol>
          </Card>

          {locked && <Card className="mt-3 border-bad/40 bg-bad-soft text-[13px]">Låst i din nuvarande rehabfas – appen väljer automatiskt ett alternativ.</Card>}

          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={() => setAddOpen(true)} disabled={locked}>
              Lägg till i pass
            </Button>
            <button
              aria-label={fav ? "Ta bort favorit" : "Spara som favorit"}
              onClick={toggleFav}
              className={cn("flex size-12 items-center justify-center rounded-full border", fav ? "border-accent/60 bg-accent-soft text-accent" : "border-line bg-card")}
            >
              <Bookmark size={18} fill={fav ? "currentColor" : "none"} />
            </button>
          </div>

          <SectionTitle>Historik</SectionTitle>
          <Card className="divide-y divide-line px-3 py-1">
            {history.length === 0 && <p className="py-2 text-[13px] text-muted">Ingen historik ännu.</p>}
            {[...history].reverse().slice(0, 8).map((h, i) => (
              <div key={i} className="tabular flex justify-between py-2 text-[12px]">
                <span>{h.date}{h.isDeload ? " · deload" : ""}</span>
                <span>{kg(h.weight)} kg × {h.sets.map((x) => x.reps).join(", ")}</span>
                <span className="text-muted">e1RM {kg(Math.round(exposureE1rm(h)))}</span>
              </div>
            ))}
          </Card>

          <SectionTitle>Kalibrering</SectionTitle>
          <Card className="space-y-2 p-2">
            <p className="px-2 pt-1 text-[12px] text-ink-2">
              {cal ? `Senast: ${kg(cal.weight)} kg × ${cal.reps} @ RIR ${cal.rir} (${cal.date}).` : "Ange en nylig prestation om övningen saknar historik här."}
            </p>
            <Stepper label="Vikt" value={w} onChange={setW} step={loadStep(ex, s.settings.equipment)} unit="kg" />
            <Stepper label="Reps" value={r} onChange={setR} step={1} min={1} />
            <Stepper label="RIR" value={rir} onChange={setRir} step={1} />
            <Button size="sm" variant="soft" className="w-full" onClick={() => store.saveCalibration(ex.id, w, r, rir)}>Spara kalibrering</Button>
          </Card>
        </>
      )}

      {tab === "how" && (
        <Card className="mt-3">
          <ol className="space-y-2.5">
            {ex.instructions.map((x, i) => (
              <li key={i} className="flex gap-3 text-[14px]">
                <span className="tabular font-semibold">{i + 1}</span>
                <span className="text-ink-2">{x}</span>
              </li>
            ))}
          </ol>
          {ex.tips.map((t) => <p key={t} className="mt-3 rounded-[14px] border border-line bg-card-2 p-3 text-[13px]">💡 {t}</p>)}
        </Card>
      )}

      {tab === "muscles" && (
        <>
          <Card className="mt-3">
            <MuscleMap primary={[ex.primary]} secondary={ex.secondary} />
          </Card>
          <Card className="mt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-muted">Hälsenebelastning</span><span>{ACHILLES_TEXT[ex.achillesLoad]}</span></div>
            <div className="flex justify-between"><span className="text-muted">Viktsteg</span><span>{kg(ex.incrementKg ?? loadStep(ex, s.settings.equipment))} kg</span></div>
            <div className="flex justify-between"><span className="text-muted">I programmet</span><span>{usedIn.map((d) => d.name).join(", ") || "–"}</span></div>
          </Card>
        </>
      )}

      {tab === "alt" && (
        <div className="mt-3 space-y-2">
          {ex.alternatives.map((a) => EXERCISES[a]).filter(Boolean).map((a) => (
            <Link key={a.id} href={`/library/${a.id}`} className="surface flex items-center gap-3 rounded-[16px] p-2">
              <Photo
                slot={IMAGES.exercise(a.id)}
                crop="square"
                sizes="48px"
                alt=""
                className="h-12 w-12 shrink-0 rounded-[10px]"
                fallback={
                  <div className="h-full bg-[#111]">
                    <AnatomyFigure view="front" fills={fillsFor(a)} viewBox="40 40 120 120" className="h-full w-full" />
                  </div>
                }
              />
              <div className="flex-1 text-[13px]">
                <div className="font-semibold">{a.name}</div>
                <div className="text-muted">{MUSCLE_LABEL[a.primary]}{!achillesAllowed(a.achillesLoad, s.settings.rehab) ? " · låst under rehab" : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Lägg till i pass">
        <p className="mb-3 text-[13px] text-ink-2">Välj vilken övning {ex.name.toLowerCase()} ska ersätta. Bytet gäller tills du återställer det under Inställningar → Övrigt.</p>
        <div className="space-y-2">
          {slots.length === 0 && <p className="text-[13px] text-muted">Ingen övning i programmet tränar {MUSCLE_LABEL[ex.primary].toLowerCase()} som primär muskel.</p>}
          {slots.map(({ day, slot }) => {
            const current = EXERCISES[s.settings.substitutions[slot.exerciseId] ?? slot.exerciseId];
            const isSame = current?.id === ex.id;
            return (
              <button
                key={day.id + slot.exerciseId}
                disabled={isSame}
                onClick={async () => {
                  const subs = { ...s.settings.substitutions };
                  if (slot.exerciseId === ex.id) delete subs[slot.exerciseId];
                  else subs[slot.exerciseId] = ex.id;
                  await store.updateSettings({ substitutions: subs });
                  setAddOpen(false);
                }}
                className={cn("surface flex w-full items-center justify-between rounded-[14px] p-3 text-left text-[13px]", isSame && "opacity-50")}
              >
                <span>
                  <span className="block font-semibold">{day.name}</span>
                  <span className="text-muted">Ersätter {current?.name}</span>
                </span>
                <span className="text-muted">{slot.sets} × {slot.repMin}–{slot.repMax}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

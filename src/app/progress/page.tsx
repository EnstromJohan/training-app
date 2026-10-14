"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnatomyFigure, GROUP_COLORS, type Fills } from "@/components/anatomy";
import { AreaTrend, BarSeries, LineSeries, MiniBars } from "@/components/charts";
import { Card, PillTabs, ScreenHeader, SectionTitle, Segmented, cn, kg } from "@/components/ui";
import { cardioLogs, completedSessions, exposuresByExercise, weeklyStats, type Snapshot } from "@/lib/coach";
import { INTENSITY_UNIT, MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import { exposureE1rm } from "@/lib/engine/strength/e1rm";
import { stalledExposures } from "@/lib/engine/strength/plateau";
import { setsPerMuscle } from "@/lib/engine/strength/volume";
import { addDays, isoWeek, weekStart } from "@/lib/engine/weekly/dates";
import type { CardioModality, Exposure, Muscle } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/program/exercises";
import { useStore, today } from "@/lib/store";

type Tab = "overview" | "strength" | "cardio" | "body";
type Range = "4" | "8" | "12" | "all";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const signed = (n: number | null) => (n == null ? "–" : `${n >= 0 ? "+" : ""}${n}%`);
const dateLabel = (d: string, weeks: number) => (weeks > 12 ? MONTHS[Number(d.slice(5, 7)) - 1] : `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`);

export default function ProgressPage() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}

function rangeWeeks(s: Snapshot, range: Range) {
  if (range !== "all") return Number(range);
  const first = completedSessions(s)[0]?.date ?? s.cardio[0]?.date;
  if (!first) return 12;
  return Math.max(4, Math.ceil((new Date(today()).getTime() - new Date(weekStart(first)).getTime()) / (7 * 86_400_000)) + 1);
}

function Progress() {
  const { s } = useStore();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "overview");
  const [range, setRange] = useState<Range>("12");
  const weeks = rangeWeeks(s, range);
  const from = addDays(weekStart(today()), -7 * (weeks - 1));
  const rangeControl = (
    <Segmented
      value={range}
      onChange={setRange}
      options={[
        { value: "4", label: "4v" },
        { value: "8", label: "8v" },
        { value: "12", label: "12v" },
        { value: "all", label: "Allt" },
      ]}
    />
  );

  return (
    <div>
      <ScreenHeader title={tab === "body" ? "Muskelgrupper" : "Min utveckling"} />
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Översikt" },
          { value: "strength", label: "Styrka" },
          { value: "cardio", label: "Cardio" },
          { value: "body", label: "Kropp" },
        ]}
      />
      <div className="mt-4">
        {tab === "overview" && <Overview weeks={weeks} from={from} rangeControl={rangeControl} />}
        {tab === "strength" && <Strength from={from} weeks={weeks} rangeControl={rangeControl} />}
        {tab === "cardio" && <Cardio weeks={weeks} from={from} rangeControl={rangeControl} />}
        {tab === "body" && <Body weeks={weeks} from={from} rangeControl={rangeControl} />}
      </div>
    </div>
  );
}

function Tile({ label, value, bars, tone }: { label: string; value: string; bars: number[]; tone?: "good" | "bad" }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("tabular mt-0.5 text-[20px] font-semibold", tone === "bad" && "text-bad")}>{value}</div>
      <div className="mt-2">
        <MiniBars values={bars} />
      </div>
    </Card>
  );
}

function prsOf(all: Map<string, Exposure[]>) {
  const out: Array<{ id: string; max: number; e1rm: number }> = [];
  for (const [id, list] of all) {
    out.push({ id, max: Math.max(...list.flatMap((e) => e.sets.map((x) => x.weight))), e1rm: Math.max(...list.map(exposureE1rm)) });
  }
  return out.sort((a, b) => b.e1rm - a.e1rm);
}

function avgE1rmChange(all: Map<string, Exposure[]>, from: string, filter?: (id: string) => boolean) {
  const changes: number[] = [];
  for (const [id, list] of all) {
    if (filter && !filter(id)) continue;
    const inRange = list.filter((e) => e.date >= from && !e.isDeload);
    if (inRange.length < 2) continue;
    changes.push(exposureE1rm(inRange.at(-1)!) / exposureE1rm(inRange[0]) - 1);
  }
  return changes.length ? Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 100) : null;
}

function StrengthChart({ from, weeks, rangeControl }: { from: string; weeks: number; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const all = exposuresByExercise(s);
  const ids = [...all.keys()].sort((a, b) => (EXERCISES[a]?.name ?? a).localeCompare(EXERCISES[b]?.name ?? b, "sv"));
  const [id, setId] = useState(ids.includes("bench-press") ? "bench-press" : ids[0]);
  const list = (id ? all.get(id) ?? [] : []).filter((e) => e.date >= from);
  const data = list.map((e) => ({ d: dateLabel(e.date, weeks), w: e.weight }));
  return (
    <>
      <SectionTitle>Styrkeutveckling</SectionTitle>
      <Card className="px-3 pb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="relative">
            <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Övning" className="h-9 appearance-none rounded-[10px] bg-card-2/70 pl-3 pr-8 text-[16px] font-medium outline-none">
              {ids.length === 0 && <option>Ingen data</option>}
              {ids.map((x) => <option key={x} value={x}>{EXERCISES[x]?.name ?? x}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </label>
          {rangeControl}
        </div>
        {data.length < 2 ? (
          <p className="py-10 text-center text-[13px] text-muted">Grafen visas efter två pass med övningen.</p>
        ) : (
          <AreaTrend data={data} x="d" y="w" unit="kg" label={`${EXERCISES[id]?.name} – arbetsvikt`} />
        )}
      </Card>
    </>
  );
}

function Overview({ weeks, from, rangeControl }: { weeks: number; from: string; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const t = today();
  const stats = weeklyStats(s, t, weeks * 2);
  const cur = stats.slice(weeks);
  const prev = stats.slice(0, weeks);
  const sum = (xs: typeof stats, k: "tonnage" | "cardioMin") => xs.reduce((a, x) => a + x[k], 0);
  const all = exposuresByExercise(s);
  const volDelta = pct(sum(cur, "tonnage"), sum(prev, "tonnage"));
  const strength = avgE1rmChange(all, from);
  const cardioDelta = pct(sum(cur, "cardioMin"), sum(prev, "cardioMin"));
  const prs = prsOf(all);
  const tail = (k: "tonnage" | "cardioMin") => cur.slice(-8).map((w) => w[k]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="Total volym" value={volDelta == null ? `${(sum(cur, "tonnage") / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} t` : signed(volDelta)} bars={tail("tonnage")} tone={volDelta != null && volDelta < 0 ? "bad" : undefined} />
        <Tile label="Styrka" value={signed(strength)} bars={cur.slice(-8).map((w) => w.workingSets)} tone={strength != null && strength < 0 ? "bad" : undefined} />
        <Tile label="Cardio" value={cardioDelta == null ? `${Math.round(sum(cur, "cardioMin"))} min` : signed(cardioDelta)} bars={tail("cardioMin")} />
      </div>

      <StrengthChart from={from} weeks={weeks} rangeControl={rangeControl} />

      <SectionTitle>Personliga rekord</SectionTitle>
      {prs.length === 0 ? (
        <Card className="text-[13px] text-muted">Rekord visas när du har loggat pass.</Card>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {prs.slice(0, 3).map((p) => (
            <Card key={p.id} className="p-3 text-center">
              <div className="truncate text-[11px] text-muted">{EXERCISES[p.id]?.name}</div>
              <div className="tabular mt-0.5 text-[16px] font-semibold">{kg(p.max)} kg</div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function Strength({ from, weeks, rangeControl }: { from: string; weeks: number; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const all = exposuresByExercise(s);
  const rows = [...all.entries()]
    .map(([id, list]) => {
      const inRange = list.filter((e) => e.date >= from);
      const first = inRange[0];
      const last = inRange.at(-1);
      return { id, last, change: first && last && inRange.length > 1 ? pct(exposureE1rm(last), exposureE1rm(first)) : null, stalled: stalledExposures(list) >= 3 };
    })
    .filter((r) => r.last)
    .sort((a, b) => (b.change ?? -99) - (a.change ?? -99));
  return (
    <>
      <StrengthChart from={from} weeks={weeks} rangeControl={rangeControl} />
      <SectionTitle>Progression per övning</SectionTitle>
      <Card className="divide-y divide-line px-3 py-1">
        {rows.length === 0 && <p className="py-3 text-[13px] text-muted">Ingen data i perioden.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2.5 text-[13px]">
            <div>
              <div className="font-medium">{EXERCISES[r.id]?.name}</div>
              <div className="tabular text-[11px] text-muted">
                {kg(r.last!.weight)} kg × {r.last!.sets.map((x) => x.reps).join(", ")} · e1RM {kg(Math.round(exposureE1rm(r.last!)))}
              </div>
            </div>
            <span className={cn("tabular text-[13px] font-semibold", r.stalled ? "text-bad" : (r.change ?? 0) > 0 ? "text-good" : "text-muted")}>
              {r.stalled ? "Platå" : signed(r.change)}
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

function Cardio({ weeks, from, rangeControl }: { weeks: number; from: string; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const stats = weeklyStats(s, today(), weeks);
  const logs = cardioLogs(s).filter((l) => l.date >= from);
  const modalities = [...new Set(logs.map((l) => l.modality))] as CardioModality[];
  const [mod, setMod] = useState<CardioModality | undefined>(modalities[0]);
  const m = mod && modalities.includes(mod) ? mod : modalities[0];
  const trend = logs.filter((l) => l.modality === m && l.intensity != null && l.kind !== "intervals").map((l) => ({ d: dateLabel(l.date, weeks), v: l.intensity! }));
  const totalMin = logs.reduce((a, l) => a + l.durationMin, 0);
  const km = logs.reduce((a, l) => a + (l.distanceKm ?? 0), 0);
  const hrLogs = logs.filter((l) => l.avgHr);
  const avgHr = hrLogs.length ? Math.round(hrLogs.reduce((a, l) => a + l.avgHr!, 0) / hrLogs.length) : null;
  const z2 = logs.filter((l) => l.kind !== "intervals").reduce((a, l) => a + l.durationMin, 0);

  return (
    <>
      <div className="flex justify-end">{rangeControl}</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="Total tid" value={`${Math.round(totalMin)} min`} bars={stats.slice(-8).map((w) => w.cardioMin)} />
        <Tile label="Distans" value={km ? `${kg(Math.round(km * 10) / 10)} km` : "–"} bars={stats.slice(-8).map((w) => w.cardioKm)} />
        <Tile label="Snittpuls" value={avgHr ? `${avgHr}` : "–"} bars={stats.slice(-8).map((w) => w.cardioLoad)} />
      </div>
      <SectionTitle>Tid per intensitet</SectionTitle>
      <Card>
        <div className="flex h-3 overflow-hidden rounded-full bg-card-2">
          <div style={{ width: `${totalMin ? (z2 / totalMin) * 100 : 0}%`, background: "#5cb87a" }} />
          {totalMin > z2 && <div className="ml-0.5 flex-1" style={{ background: "#f2a77e" }} />}
        </div>
        <div className="tabular mt-2 flex justify-between text-[12px]">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-[#5cb87a]" />Zone 2 · {Math.round(z2)} min</span>
          <span><span className="mr-1 inline-block size-2 rounded-full bg-[#f2a77e]" />Intervaller · {Math.round(totalMin - z2)} min</span>
        </div>
      </Card>
      <SectionTitle>Minuter per vecka</SectionTitle>
      <Card><BarSeries data={stats.map((w) => ({ v: `v${isoWeek(w.weekStart)}`, min: Math.round(w.cardioMin) }))} x="v" y="min" unit="min" label="Cardiominuter" /></Card>
      <SectionTitle>Belastning per vecka</SectionTitle>
      <Card><BarSeries data={stats.map((w) => ({ v: `v${isoWeek(w.weekStart)}`, load: Math.round(w.cardioLoad) }))} x="v" y="load" unit="(min × RPE)" label="Veckobelastning" /></Card>
      <SectionTitle>Konditionsutveckling</SectionTitle>
      {modalities.length > 1 && <PillTabs size="sm" value={m!} onChange={setMod} options={modalities.map((x) => ({ value: x, label: MODALITY_LABEL[x] }))} className="mb-2" />}
      <Card>
        {trend.length < 2 ? (
          <p className="text-[13px] text-muted">Logga {m ? INTENSITY_UNIT[m] : "watt/nivå"} på minst två Zone 2-pass för att se hur mycket mer du orkar på samma ansträngning.</p>
        ) : (
          <LineSeries data={trend} x="d" unit={INTENSITY_UNIT[m!]} label="Intensitet vid Zone 2" lines={[{ key: "v", name: `${MODALITY_LABEL[m!]} (${INTENSITY_UNIT[m!]})`, color: "#ef9662" }]} />
        )}
      </Card>
    </>
  );
}

const GROUPS: Array<{ key: keyof typeof GROUP_COLORS; label: string; muscles: Muscle[] }> = [
  { key: "chest", label: "Bröst", muscles: ["chest"] },
  { key: "back", label: "Rygg", muscles: ["back"] },
  { key: "shoulders", label: "Axlar", muscles: ["front_delts", "side_delts", "rear_delts"] },
  { key: "arms", label: "Armar", muscles: ["biceps", "triceps"] },
  { key: "legs", label: "Ben", muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"] },
];

function Body({ weeks, from, rangeControl }: { weeks: number; from: string; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const [sub, setSub] = useState<"volume" | "progress" | "symmetry">("volume");
  const all = exposuresByExercise(s);
  const prevFrom = addDays(from, -7 * weeks);
  const entries = (a: string, b: string) => {
    const out: Array<{ exerciseId: string; sets: number }> = [];
    for (const [id, list] of all) for (const e of list) if (e.date >= a && e.date < b) out.push({ exerciseId: id, sets: e.sets.length });
    return setsPerMuscle(out, EXERCISES);
  };
  const now = entries(from, "9999");
  const before = entries(prevFrom, from);
  const sumOf = (x: Partial<Record<Muscle, number>>, ms: Muscle[]) => ms.reduce((a, m) => a + (x[m] ?? 0), 0);
  const fills: Fills = {};
  for (const g of GROUPS) for (const m of g.muscles) fills[m] = GROUP_COLORS[g.key];

  const rows = GROUPS.map((g) => {
    const sets = sumOf(now, g.muscles) / weeks;
    const prevSets = sumOf(before, g.muscles) / weeks;
    const strength = avgE1rmChange(all, from, (id) => g.muscles.includes(EXERCISES[id]?.primary));
    return { ...g, sets, delta: pct(sets, prevSets), strength };
  });
  const push = sumOf(now, ["chest", "front_delts", "triceps"]);
  const pull = sumOf(now, ["back", "rear_delts", "biceps"]);
  const quads = sumOf(now, ["quads"]);
  const posterior = sumOf(now, ["hamstrings", "glutes"]);
  const upper = sumOf(now, ["chest", "back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps"]);
  const lower = sumOf(now, ["quads", "hamstrings", "glutes", "adductors", "calves"]);

  return (
    <>
      <div className="mb-2 flex justify-end">{rangeControl}</div>
      <div>
        <PillTabs
          size="sm"
          value={sub}
          onChange={setSub}
          options={[
            { value: "volume", label: "Volym" },
            { value: "progress", label: "Utveckling" },
            { value: "symmetry", label: "Symmetri" },
          ]}
        />
      </div>
      <div className="mt-3 flex justify-center gap-3 rounded-[18px] bg-card py-3">
        <AnatomyFigure view="front" fills={fills} className="h-64 w-auto" />
        <AnatomyFigure view="back" fills={fills} className="h-64 w-auto" />
      </div>

      {sub !== "symmetry" ? (
        <Card className="mt-3 divide-y divide-line px-3 py-1">
          {rows.map((r) => {
            const value = sub === "volume" ? r.delta : r.strength;
            return (
              <div key={r.key} className="grid grid-cols-[16px_1fr_auto_64px] items-center gap-2 py-2.5 text-[13px]">
                <span className="size-2.5 rounded-full" style={{ background: GROUP_COLORS[r.key] }} />
                <span>{r.label}</span>
                <span className="tabular text-ink-2">{sub === "volume" ? `${kg(Math.round(r.sets * 10) / 10)} set/v` : "e1RM"}</span>
                <span className={cn("tabular text-right font-medium", value == null ? "text-muted" : value >= 0 ? "text-good" : "text-bad")}>{signed(value)}</span>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="mt-3 space-y-4">
          {[
            { a: "Press", b: "Drag", x: push, y: pull },
            { a: "Framsida lår", b: "Baksida + säte", x: quads, y: posterior },
            { a: "Överkropp", b: "Underkropp", x: upper, y: lower },
          ].map((r) => {
            const tot = r.x + r.y || 1;
            return (
              <div key={r.a}>
                <div className="mb-1 flex justify-between text-[12px]">
                  <span>{r.a} · {Math.round((r.x / tot) * 100)}%</span>
                  <span>{Math.round((r.y / tot) * 100)}% · {r.b}</span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  <div style={{ width: `${(r.x / tot) * 100}%`, background: "#ef8f6b" }} />
                  <div className="flex-1" style={{ background: "#6aa6d6" }} />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted">Set i perioden. Sekundära muskler räknas som ½ set. Balans runt 50/50 för press/drag skyddar axlarna.</p>
        </Card>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Target } from "lucide-react";
import { AreaTrend, BarSeries, LineSeries, MiniBars } from "@/components/charts";
import { Card, PillTabs, ScreenHeader, SectionTitle, Segmented, cn, kg } from "@/components/ui";
import { cardioLogs, completedSessions, exposuresByExercise, weeklyStats, type Snapshot } from "@/lib/coach";
import { INTENSITY_UNIT, MODALITY_LABEL } from "@/lib/engine/cardio/zones";
import { exposureE1rm } from "@/lib/engine/strength/e1rm";
import { stalledExposures } from "@/lib/engine/strength/plateau";
import { addDays, isoWeek, weekStart } from "@/lib/engine/weekly/dates";
import type { CardioModality, Exposure } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/program/exercises";
import { useStore, today } from "@/lib/store";

type Tab = "overview" | "strength" | "cardio" | "body";
type Range = "4" | "8" | "12" | "all";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const signed = (n: number | null, unit = "%") => (n == null ? "–" : `${n >= 0 ? "+" : ""}${n.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}${unit === "%" ? "%" : ` ${unit}`}`);
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
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as Tab) ?? "overview";
  const [tab, setTab] = useState<Tab>(initial === "body" ? "overview" : initial);
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
      <ScreenHeader title="Min utveckling" />
      <PillTabs
        value={tab}
        onChange={(v) => (v === "body" ? router.push("/body") : setTab(v))}
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
      </div>
    </div>
  );
}

function Tile({ label, value, bars, tone, sub }: { label: string; value: string; bars: number[]; tone?: "good" | "bad"; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="truncate text-[11px] text-muted">{label}</div>
      <div className={cn("tabular mt-0.5 text-[20px] font-bold", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="truncate text-[10px] text-muted">{sub}</div>}
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

function avgE1rmChange(all: Map<string, Exposure[]>, from: string) {
  const changes: number[] = [];
  for (const list of all.values()) {
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
  const [metric, setMetric] = useState<"e1rm" | "weight">("e1rm");
  const list = (id ? (all.get(id) ?? []) : []).filter((e) => e.date >= from);
  const data = list.map((e) => ({ d: dateLabel(e.date, weeks), v: metric === "e1rm" ? Math.round(exposureE1rm(e) * 2) / 2 : e.weight }));
  return (
    <Card className="mt-3 px-3 pb-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="relative">
          <select
            value={id}
            onChange={(e) => setId(e.target.value)}
            aria-label="Övning"
            className="h-9 max-w-[180px] appearance-none truncate bg-transparent pr-6 text-[16px] font-semibold text-ink outline-none"
          >
            {ids.length === 0 && <option>Ingen data</option>}
            {ids.map((x) => (
              <option key={x} value={x} className="bg-[#141414]">
                {EXERCISES[x]?.name ?? x}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted" />
        </label>
        <label className="relative">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as "e1rm" | "weight")}
            aria-label="Mått"
            className="h-8 appearance-none rounded-full border border-line bg-card-2 pl-3 pr-7 text-[16px] text-ink outline-none"
          >
            <option value="e1rm">1RM</option>
            <option value="weight">Vikt</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>
      </div>
      <div className="mb-1 flex justify-end">{rangeControl}</div>
      {data.length < 2 ? (
        <p className="py-10 text-center text-[13px] text-muted">Grafen visas efter två pass med övningen.</p>
      ) : (
        <AreaTrend data={data} x="d" y="v" unit="kg" label={`${EXERCISES[id]?.name} – ${metric === "e1rm" ? "estimerad 1RM" : "arbetsvikt"}`} />
      )}
    </Card>
  );
}

function Overview({ weeks, from, rangeControl }: { weeks: number; from: string; rangeControl: React.ReactNode }) {
  const { s } = useStore();
  const t = today();
  const stats = weeklyStats(s, t, weeks * 2);
  const cur = stats.slice(weeks);
  const prev = stats.slice(0, weeks);
  const sum = (xs: typeof stats, k: "tonnage" | "sessions" | "cardioMin") => xs.reduce((a, x) => a + x[k], 0);
  const all = exposuresByExercise(s);
  const volDelta = pct(sum(cur, "tonnage"), sum(prev, "tonnage"));
  const strength = avgE1rmChange(all, from);
  const prs = prsOf(all);
  const body = s.body.filter((b) => !b.deletedAt && b.muscleMassKg != null && b.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const muscleDelta = body.length >= 2 ? body.at(-1)!.muscleMassKg! - body[0].muscleMassKg! : null;
  const freq = sum(cur, "sessions") / weeks;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile
          label="Total volym"
          value={volDelta == null ? `${(sum(cur, "tonnage") / 1000).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} t` : signed(volDelta)}
          bars={cur.slice(-8).map((w) => w.tonnage)}
          tone={volDelta != null && volDelta < 0 ? "bad" : undefined}
        />
        <Tile label="Styrka" value={signed(strength)} bars={cur.slice(-8).map((w) => w.workingSets)} tone={strength != null && strength < 0 ? "bad" : undefined} />
        {muscleDelta != null ? (
          <Tile label="Muskelmassa" value={signed(Math.round(muscleDelta * 10) / 10, "kg")} bars={body.slice(-8).map((b) => b.muscleMassKg ?? 0)} sub={`${freq.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} pass/vecka`} />
        ) : (
          <Tile label="Träningsfrekvens" value={`${freq.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}/v`} bars={cur.slice(-8).map((w) => w.sessions)} sub="pass per vecka" />
        )}
      </div>

      <SectionTitle>Styrkeutveckling</SectionTitle>
      <StrengthChart from={from} weeks={weeks} rangeControl={rangeControl} />

      <SectionTitle>Personliga rekord</SectionTitle>
      {prs.length === 0 ? (
        <Card className="text-[13px] text-muted">Rekord visas när du har loggat pass.</Card>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {prs.slice(0, 3).map((p) => (
            <Card key={p.id} className="p-3 text-center">
              <div className="truncate text-[11px] text-muted">{EXERCISES[p.id]?.name}</div>
              <div className="tabular mt-0.5 text-[16px] font-bold">{kg(p.max)} kg</div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/insights" className="surface flex items-center gap-2 rounded-[16px] p-3 text-[13px] font-medium">
          <Sparkles size={16} className="text-accent" /> Insikter <ChevronRight size={15} className="ml-auto text-muted" />
        </Link>
        <Link href="/muscles" className="surface flex items-center gap-2 rounded-[16px] p-3 text-[13px] font-medium">
          <Target size={16} className="text-accent" /> Muskelgrupper <ChevronRight size={15} className="ml-auto text-muted" />
        </Link>
      </div>
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
          <div style={{ width: `${totalMin ? (z2 / totalMin) * 100 : 0}%`, background: "#4ade80" }} />
          {totalMin > z2 && <div className="ml-0.5 flex-1" style={{ background: "#fb923c" }} />}
        </div>
        <div className="tabular mt-2 flex justify-between text-[12px]">
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#4ade80]" />
            Zone 2 · {Math.round(z2)} min
          </span>
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-[#fb923c]" />
            Intervaller · {Math.round(totalMin - z2)} min
          </span>
        </div>
      </Card>
      <SectionTitle>Minuter per vecka</SectionTitle>
      <Card>
        <BarSeries data={stats.map((w) => ({ v: `v${isoWeek(w.weekStart)}`, min: Math.round(w.cardioMin) }))} x="v" y="min" unit="min" label="Cardiominuter" />
      </Card>
      <SectionTitle>Konditionsutveckling</SectionTitle>
      {modalities.length > 1 && <PillTabs size="sm" value={m!} onChange={setMod} options={modalities.map((x) => ({ value: x, label: MODALITY_LABEL[x] }))} className="mb-2" />}
      <Card>
        {trend.length < 2 ? (
          <p className="text-[13px] text-muted">Logga {m ? INTENSITY_UNIT[m] : "watt/nivå"} på minst två Zone 2-pass för att se hur mycket mer du orkar på samma ansträngning.</p>
        ) : (
          <LineSeries data={trend} x="d" unit={INTENSITY_UNIT[m!]} label="Intensitet vid Zone 2" lines={[{ key: "v", name: `${MODALITY_LABEL[m!]} (${INTENSITY_UNIT[m!]})`, color: "#ff8a3d" }]} />
        )}
      </Card>
    </>
  );
}

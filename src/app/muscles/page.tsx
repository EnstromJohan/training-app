"use client";

import { useState } from "react";
import { AnatomyFigure, type Fills } from "@/components/anatomy";
import { Card, PillTabs, ScreenHeader, Segmented, cn, kg } from "@/components/ui";
import { exposuresByExercise, GROUP_TARGETS, groupVolume } from "@/lib/coach";
import { exposureE1rm } from "@/lib/engine/strength/e1rm";
import { setsPerMuscle } from "@/lib/engine/strength/volume";
import { addDays, weekStart } from "@/lib/engine/weekly/dates";
import type { Muscle } from "@/lib/engine/types";
import { EXERCISES } from "@/lib/program/exercises";
import { useStore, today } from "@/lib/store";

type Tab = "volume" | "progress" | "symmetry";
type GroupKey = keyof typeof GROUP_TARGETS;
const STATUS_COLOR = { optimal: "#4ade80", low: "#ff8a3d", high: "#8a8580" } as const;
const STATUS_LABEL = { optimal: "Optimal", low: "Låg volym", high: "Hög volym" } as const;
// Label positions around the figure (design: shoulders/arms/legs left, chest/back right).
const POS: Record<GroupKey, string> = {
  shoulders: "left-0 top-[16%]",
  arms: "left-0 top-[42%]",
  legs: "left-0 top-[70%]",
  chest: "right-0 top-[20%] text-right",
  back: "right-0 top-[46%] text-right",
};

export default function MusclesPage() {
  const { s } = useStore();
  const t = today();
  const [tab, setTab] = useState<Tab>("volume");
  const [weeks, setWeeks] = useState<"4" | "8" | "12">("4");
  const w = Number(weeks);
  const groups = groupVolume(s, t, w);
  const from = addDays(weekStart(t), -7 * (w - 1));

  // Strength change per group (first vs last exposure in the window, averaged over exercises).
  const progress: Record<string, number | null> = {};
  const all = exposuresByExercise(s);
  for (const key of Object.keys(GROUP_TARGETS) as GroupKey[]) {
    const ch: number[] = [];
    for (const [id, list] of all) {
      if (!GROUP_TARGETS[key].muscles.includes(EXERCISES[id]?.primary)) continue;
      const inR = list.filter((e) => e.date >= from && !e.isDeload);
      if (inR.length >= 2) ch.push(exposureE1rm(inR.at(-1)!) / exposureE1rm(inR[0]) - 1);
    }
    progress[key] = ch.length ? ch.reduce((a, b) => a + b, 0) / ch.length : null;
  }

  const fills: Fills = {};
  for (const g of groups) {
    const intensity = Math.min(1, Math.max(0.25, g.pct));
    const color = `rgba(255,138,61,${intensity})`;
    for (const m of GROUP_TARGETS[g.key].muscles) fills[m] = color;
  }

  const valueFor = (key: GroupKey) => {
    const g = groups.find((x) => x.key === key)!;
    if (tab === "progress") {
      const p = progress[key];
      return p == null ? "–" : `${p >= 0 ? "+" : ""}${Math.round(p * 100)}%`;
    }
    return `${Math.round(g.pct * 100)}%`;
  };

  // Symmetry (sets in window)
  const entries: Array<{ exerciseId: string; sets: number }> = [];
  for (const [id, list] of all) for (const e of list) if (e.date >= from) entries.push({ exerciseId: id, sets: e.sets.length });
  const per = setsPerMuscle(entries, EXERCISES);
  const sumOf = (ms: Muscle[]) => ms.reduce((a, m) => a + (per[m] ?? 0), 0);
  const pairs = [
    { a: "Press", b: "Drag", x: sumOf(["chest", "front_delts", "triceps"]), y: sumOf(["back", "rear_delts", "biceps"]) },
    { a: "Framsida lår", b: "Baksida + säte", x: sumOf(["quads"]), y: sumOf(["hamstrings", "glutes"]) },
    { a: "Överkropp", b: "Underkropp", x: sumOf(["chest", "back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps"]), y: sumOf(["quads", "hamstrings", "glutes", "adductors", "calves"]) },
  ];

  return (
    <div>
      <ScreenHeader title="Muskelgrupper" back />
      <PillTabs
        stretch
        value={tab}
        onChange={setTab}
        options={[
          { value: "volume", label: "Volym" },
          { value: "progress", label: "Utveckling" },
          { value: "symmetry", label: "Symmetri" },
        ]}
      />
      <div className="mt-3 flex justify-center">
        <Segmented
          value={weeks}
          onChange={setWeeks}
          options={[
            { value: "4", label: "4v" },
            { value: "8", label: "8v" },
            { value: "12", label: "12v" },
          ]}
        />
      </div>

      {tab !== "symmetry" ? (
        <>
          <div className="relative mx-auto mt-2 h-[380px] max-w-[360px]">
            <div className="absolute inset-0 flex justify-center">
              <AnatomyFigure view="front" fills={fills} viewBox="24 6 152 400" className="h-full w-auto drop-shadow-[0_0_24px_rgba(255,138,61,0.25)]" />
            </div>
            {(Object.keys(GROUP_TARGETS) as GroupKey[]).map((key) => {
              const g = groups.find((x) => x.key === key)!;
              return (
                <div key={key} className={cn("absolute", POS[key])}>
                  <div className="text-[13px] text-ink-2">{g.label}</div>
                  <div className="tabular flex items-center gap-1.5 text-[22px] font-bold" style={{ justifyContent: POS[key].includes("right") ? "flex-end" : undefined }}>
                    {tab === "volume" && <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[g.status] }} />}
                    {valueFor(key)}
                  </div>
                </div>
              );
            })}
          </div>
          {tab === "volume" && (
            <div className="mt-1 flex justify-center gap-4 text-[12px] text-ink-2">
              {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[k] }} />
                  {STATUS_LABEL[k]}
                </span>
              ))}
            </div>
          )}

          <Card className="mt-4 divide-y divide-line px-3 py-1">
            {groups.map((g) => (
              <div key={g.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-[13px]">
                <span>{g.label}</span>
                <span className="tabular text-ink-2">
                  {kg(Math.round(g.perWeek * 10) / 10)} / {GROUP_TARGETS[g.key].target} set/v
                </span>
                <span className={cn("tabular w-14 text-right font-medium", g.change == null ? "text-muted" : g.change >= 0 ? "text-good" : "text-bad")}>
                  {g.change == null ? "–" : `${g.change >= 0 ? "+" : ""}${Math.round(g.change * 100)}%`}
                </span>
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-[11px] text-muted">
            Procent av veckomålet i set (sekundära muskler räknas som ½ set). Under 70 % = låg volym, över 115 % = hög. Höger kolumn: förändring mot perioden innan.
          </p>
        </>
      ) : (
        <Card className="mt-4 space-y-5">
          {pairs.map((r) => {
            const tot = r.x + r.y || 1;
            return (
              <div key={r.a}>
                <div className="mb-1.5 flex justify-between text-[12px]">
                  <span>
                    {r.a} · {Math.round((r.x / tot) * 100)}%
                  </span>
                  <span>
                    {Math.round((r.y / tot) * 100)}% · {r.b}
                  </span>
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full">
                  <div style={{ width: `${(r.x / tot) * 100}%`, background: "#ff8a3d" }} />
                  <div className="flex-1" style={{ background: "#5eb5c9" }} />
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted">Balans runt 50/50 mellan press och drag skyddar axlarna.</p>
        </Card>
      )}
    </div>
  );
}

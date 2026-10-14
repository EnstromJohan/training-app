"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Lock, Search } from "lucide-react";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { AnatomyFigure } from "@/components/anatomy";
import { IMAGES, Photo } from "@/components/photo";
import { PillTabs, ScreenHeader } from "@/components/ui";
import { achillesAllowed } from "@/lib/engine/rehab/achilles";
import type { Muscle } from "@/lib/engine/types";
import { EXERCISE_LIST } from "@/lib/program/exercises";
import { useStore } from "@/lib/store";

const GROUPS: Array<{ value: string; label: string; muscles: Muscle[] }> = [
  { value: "all", label: "Alla", muscles: [] },
  { value: "chest", label: "Bröst", muscles: ["chest"] },
  { value: "back", label: "Rygg", muscles: ["back"] },
  { value: "legs", label: "Ben", muscles: ["quads", "hamstrings", "glutes", "adductors", "calves"] },
  { value: "shoulders", label: "Axlar", muscles: ["front_delts", "side_delts", "rear_delts"] },
  { value: "arms", label: "Armar", muscles: ["biceps", "triceps"] },
];

export default function Library() {
  const { s } = useStore();
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const g = GROUPS.find((x) => x.value === group)!;
  const list = EXERCISE_LIST.filter((e) => (group === "all" || g.muscles.includes(e.primary)) && e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <ScreenHeader title="Övningsbibliotek" back />
      <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-card px-4">
        <Search size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök övning" aria-label="Sök övning" type="search" className="flex-1 bg-transparent text-[16px] outline-none" />
      </label>
      <PillTabs value={group} onChange={setGroup} options={GROUPS.map(({ value, label }) => ({ value, label }))} />
      <div className="mt-3 space-y-2">
        {list.map((e) => {
          const locked = !achillesAllowed(e.achillesLoad, s.settings.rehab);
          return (
            <Link key={e.id} href={`/library/${e.id}`} className="block">
              <div className="flex items-center gap-3 rounded-[16px] bg-card p-2">
                <Photo
                  slot={IMAGES.exercise(e.id)}
                  crop="square"
                  sizes="48px"
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-[10px]"
                  fallback={
                    <div className="h-full bg-[#e9e5df]">
                      <AnatomyFigure
                        view={["back", "rear_delts", "triceps", "hamstrings", "glutes"].includes(e.primary) ? "back" : "front"}
                        fills={{ [e.primary]: "var(--accent)" }}
                        viewBox={e.lowerBody ? "56 180 88 120" : "36 46 128 120"}
                        className="h-full w-full"
                      />
                    </div>
                  }
                />
                <div className="flex-1 text-[13px]">
                  <div className="flex items-center gap-1.5 font-medium">
                    {e.name}
                    {locked && <Lock size={12} className="text-muted" />}
                  </div>
                  <div className="text-xs text-muted">
                    {MUSCLE_LABEL[e.primary]}
                    {e.isCompound ? " · basövning" : ""}
                  </div>
                </div>
                <ChevronRight size={18} className="mr-1 text-muted" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Search, SlidersHorizontal, Star } from "lucide-react";
import { AnatomyFigure } from "@/components/anatomy";
import { MUSCLE_LABEL } from "@/components/muscle-labels";
import { IMAGES, Photo } from "@/components/photo";
import { PillTabs, ScreenHeader, cn } from "@/components/ui";
import { useFavorites } from "@/lib/favorites";
import { achillesAllowed } from "@/lib/engine/rehab/achilles";
import type { Muscle } from "@/lib/engine/types";
import { EXERCISE_LIST } from "@/lib/program/exercises";
import { useStore } from "@/lib/store";

const GROUPS: Array<{ value: string; label: string; muscles: Muscle[] }> = [
  { value: "all", label: "Alla", muscles: [] },
  { value: "fav", label: "Favoriter", muscles: [] },
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
  const [onlyAllowed, setOnlyAllowed] = useState(false);
  const { favorites, toggle } = useFavorites();
  const g = GROUPS.find((x) => x.value === group)!;
  const list = EXERCISE_LIST.filter(
    (e) =>
      (group === "all" || (group === "fav" ? favorites.includes(e.id) : g.muscles.includes(e.primary))) &&
      e.name.toLowerCase().includes(q.trim().toLowerCase()) &&
      (!onlyAllowed || achillesAllowed(e.achillesLoad, s.settings.rehab)),
  );

  return (
    <div>
      <ScreenHeader title="Övningar" />
      <div className="mb-3 flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-line bg-card px-4">
          <Search size={16} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök övning…"
            aria-label="Sök övning"
            type="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
        </label>
        <button
          aria-label="Visa bara övningar som är tillåtna i rehabfasen"
          aria-pressed={onlyAllowed}
          onClick={() => setOnlyAllowed(!onlyAllowed)}
          className={cn("flex size-11 items-center justify-center rounded-full border", onlyAllowed ? "border-accent/60 bg-accent-soft text-accent" : "border-line bg-card text-ink-2")}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      <PillTabs size="sm" value={group} onChange={setGroup} options={GROUPS.map(({ value, label }) => ({ value, label }))} />

      {list.length === 0 && <p className="mt-6 text-center text-[14px] text-muted">{group === "fav" ? "Inga favoriter än – tryck på stjärnan på en övning." : "Inga övningar matchar."}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {list.map((e) => {
          const locked = !achillesAllowed(e.achillesLoad, s.settings.rehab);
          const fav = favorites.includes(e.id);
          return (
            <div key={e.id} className="surface relative overflow-hidden rounded-[16px]">
              <Link href={`/library/${e.id}`} className="block">
                <Photo
                  slot={IMAGES.exercise(e.id)}
                  crop="square"
                  sizes="(max-width: 448px) 50vw, 220px"
                  alt=""
                  className="aspect-[4/3] w-full"
                  fallback={
                    <div className="flex h-full items-center justify-center bg-[#111]">
                      <AnatomyFigure
                        view={["back", "rear_delts", "triceps", "hamstrings", "glutes"].includes(e.primary) ? "back" : "front"}
                        fills={{ [e.primary]: "#ff8a3d" }}
                        viewBox={e.lowerBody ? "56 180 88 120" : "36 46 128 120"}
                        className="h-full w-auto"
                      />
                    </div>
                  }
                />
                <div className="px-2.5 pb-2.5 pt-2">
                  <div className="flex items-center gap-1 truncate text-[13px] font-semibold">
                    {e.name}
                    {locked && <Lock size={11} className="shrink-0 text-muted" />}
                  </div>
                  <div className="text-[11px] text-muted">{MUSCLE_LABEL[e.primary]}</div>
                </div>
              </Link>
              <button
                onClick={() => toggle(e.id)}
                aria-label={fav ? `Ta bort ${e.name} från favoriter` : `Spara ${e.name} som favorit`}
                aria-pressed={fav}
                className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/40 backdrop-blur"
              >
                <Star size={15} className={fav ? "fill-accent text-accent" : "text-ink-2"} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

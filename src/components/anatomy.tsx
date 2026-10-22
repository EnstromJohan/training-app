import { useId } from "react";
import type { Muscle, SessionCategory } from "@/lib/engine/types";

// Stylised anatomy (front/back). Left-half paths are mirrored for the right side.
export type Part = { m: Muscle | null; d: string };

export const FRONT: Part[] = [
  { m: "back", d: "M90 60 Q78 66 66 70 L92 70 Z" },
  { m: "side_delts", d: "M66 70 Q50 72 46 92 Q48 100 54 98 Q56 84 64 77 Z" },
  { m: "front_delts", d: "M67 71 Q78 70 82 76 Q74 86 66 100 Q58 98 58 88 Q60 78 67 71 Z" },
  { m: "chest", d: "M83 74 Q92 72 99 74 L99 110 Q88 116 76 112 Q66 106 67 99 Q72 84 83 74 Z" },
  { m: "biceps", d: "M50 101 Q44 117 46 136 Q52 142 58 138 Q62 120 62 105 Q56 99 50 101 Z" },
  { m: null, d: "M46 142 Q40 160 38 186 Q44 190 48 188 Q56 166 58 144 Z" },
  { m: "core", d: "M86 117 L98 117 L98 184 Q90 188 86 182 L84 123 Z" },
  { m: "core", d: "M74 117 Q80 119 83 123 L85 182 Q76 176 72 160 Q70 136 74 117 Z" },
  { m: "adductors", d: "M92 200 Q99 214 99 246 L92 258 Q89 230 92 200 Z" },
  { m: "quads", d: "M72 196 Q66 228 70 272 Q78 284 88 278 Q95 246 91 204 Q84 194 72 196 Z" },
  { m: "calves", d: "M72 302 Q67 336 74 380 L84 380 Q90 340 88 304 Z" },
];

export const BACK: Part[] = [
  { m: "back", d: "M90 52 Q78 64 64 72 Q80 80 99 96 L99 52 Z" },
  { m: "side_delts", d: "M64 70 Q50 70 46 86 L52 89 Q56 78 66 74 Z" },
  { m: "rear_delts", d: "M66 76 Q54 80 52 92 Q54 100 59 98 Q62 86 72 81 Z" },
  { m: "back", d: "M72 83 Q85 93 99 101 L99 150 Q88 150 80 140 Q70 120 69 97 Z" },
  { m: "back", d: "M84 151 L99 153 L99 182 L86 180 Z" },
  { m: "triceps", d: "M50 101 Q44 117 46 136 Q52 142 58 138 Q62 120 60 103 Z" },
  { m: null, d: "M46 142 Q40 160 38 186 Q44 190 48 188 Q56 166 58 144 Z" },
  { m: "glutes", d: "M76 185 Q90 181 99 187 L99 218 Q86 226 76 216 Q70 200 76 185 Z" },
  { m: "hamstrings", d: "M72 223 Q68 250 72 276 Q80 284 90 280 Q96 252 96 227 Q86 225 72 223 Z" },
  { m: "calves", d: "M70 297 Q64 320 70 350 Q78 360 86 352 Q92 324 88 299 Z" },
];

export const SKIN_PARTS = (
  <>
    <ellipse cx="100" cy="34" rx="15" ry="19" />
    <path d="M92 50 L108 50 L110 62 L90 62 Z" />
    <ellipse cx="42" cy="199" rx="6" ry="10" />
    <ellipse cx="158" cy="199" rx="6" ry="10" />
    <ellipse cx="80" cy="290" rx="8" ry="7" />
    <ellipse cx="120" cy="290" rx="8" ry="7" />
    <ellipse cx="79" cy="392" rx="10" ry="6" />
    <ellipse cx="121" cy="392" rx="10" ry="6" />
  </>
);

export type Fills = Partial<Record<Muscle, string>>;

export function AnatomyFigure({
  view,
  fills,
  dark,
  viewBox = "28 8 144 396",
  className,
  label,
}: {
  view: "front" | "back";
  fills: Fills;
  dark?: boolean;
  viewBox?: string;
  className?: string;
  label?: string;
}) {
  // Unique ids per instance: shared gradient ids break when another SVG on the page is hidden.
  const uid = useId().replace(/:/g, "");
  const parts = view === "front" ? FRONT : BACK;
  // Dark theme: charcoal muscles, near-black gaps; highlighted muscles glow (design).
  void dark;
  const base = "var(--muscle)";
  const skin = "#232120";
  const gap = "#0b0b0b";
  const draw = (p: Part, i: number) => (
    <g key={i}>
      <path
        d={p.d}
        fill={(p.m && fills[p.m]) || base}
        style={p.m && fills[p.m] ? { filter: `drop-shadow(0 0 3px ${fills[p.m]})` } : undefined}
      />
      {/* Volume: light from top-left, shadow bottom-right */}
      <path d={p.d} fill={`url(#shade-${uid})`} stroke={gap} strokeWidth={1.3} strokeLinejoin="round" />
    </g>
  );
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={label ?? (view === "front" ? "Framsida" : "Baksida")}>
      <defs>
        <linearGradient id={`shade-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.16} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={0.35} />
        </linearGradient>
        <radialGradient id={`skin-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity={0.08} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill={skin}>{SKIN_PARTS}</g>
      <g fill={`url(#skin-${uid})`}>{SKIN_PARTS}</g>
      <g>{parts.map(draw)}</g>
      <g transform="translate(200,0) scale(-1,1)">{parts.map(draw)}</g>
    </svg>
  );
}

export function MuscleMap({ primary, secondary = [], dark, className }: { primary: Muscle[]; secondary?: Muscle[]; dark?: boolean; className?: string }) {
  const fills: Fills = {};
  for (const m of secondary) fills[m] = "#9a4d1e";
  for (const m of primary) fills[m] = "#ff8a3d";
  return (
    <div className={`flex justify-center gap-4 ${className ?? ""}`}>
      <AnatomyFigure view="front" fills={fills} dark={dark} className="h-56 w-auto" />
      <AnatomyFigure view="back" fills={fills} dark={dark} className="h-56 w-auto" />
    </div>
  );
}

const THUMB: Record<SessionCategory, { view: "front" | "back"; box: string; muscles: Muscle[]; color: string }> = {
  chest_back: { view: "front", box: "40 46 120 110", muscles: ["chest", "front_delts"], color: "#e98a52" },
  legs: { view: "front", box: "56 180 88 120", muscles: ["quads", "adductors"], color: "#e98a52" },
  shoulders_arms: { view: "front", box: "30 56 140 100", muscles: ["side_delts", "front_delts", "biceps"], color: "#4fa3b8" },
};

/** Cropped anatomy thumbnail for schedule rows (stands in for the design's anatomy renders). */
export function SessionThumb({ category, done }: { category: SessionCategory | "rest"; done?: boolean }) {
  if (category === "rest") return null;
  const t = THUMB[category];
  const fills: Fills = Object.fromEntries(t.muscles.map((m) => [m, t.color]));
  return (
    <div className="relative h-full w-full overflow-hidden">
      <AnatomyFigure view={t.view} fills={fills} viewBox={t.box} className="absolute inset-0 h-full w-full" />
      {done && <span className="sr-only">Genomfört</span>}
    </div>
  );
}

export const GROUP_COLORS: Record<string, string> = {
  chest: "#ff8a3d",
  back: "#ff8a3d",
  shoulders: "#ff8a3d",
  arms: "#ff8a3d",
  legs: "#ff8a3d",
};

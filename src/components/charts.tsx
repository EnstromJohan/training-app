"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Shared chart styling: thin marks, recessive grid, text in ink tokens, hover tooltip by default.
const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "#1a1a1a", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--ink)" },
  itemStyle: { color: "var(--ink)" },
  labelStyle: { color: "var(--muted)" },
};
const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

export function BarSeries({
  data,
  x,
  y,
  unit,
  height = 180,
  highlightLast = true,
  label,
}: {
  data: Array<Record<string, number | string>>;
  x: string;
  y: string;
  unit: string;
  height?: number;
  highlightLast?: boolean;
  label: string;
}) {
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} {...axis} />
          <YAxis {...axis} tickFormatter={(v) => (v >= 1000 ? `${fmt(v / 1000)}k` : fmt(v))} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [`${fmt(Number(v))} ${unit}`, label]} />
          <Bar
            isAnimationActive={false}
            dataKey={y}
            radius={[4, 4, 0, 0]}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; index: number };
              const last = highlightLast && p.index === data.length - 1;
              const h = Math.max(0, p.height);
              const r = Math.min(4, h, p.width / 2);
              return (
                <path
                  d={`M${p.x},${p.y + h} v${-(h - r)} q0,${-r} ${r},${-r} h${p.width - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                  fill={last ? "var(--accent)" : "#4a4744"}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineSeries({
  data,
  x,
  lines,
  unit,
  height = 200,
  label,
}: {
  data: Array<Record<string, number | string | null>>;
  x: string;
  lines: Array<{ key: string; name: string; color: string; dashed?: boolean }>;
  unit: string;
  height?: number;
  label: string;
}) {
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} {...axis} minTickGap={16} />
          <YAxis {...axis} domain={["auto", "auto"]} />
          <Tooltip {...tooltipStyle} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} formatter={(v, n) => [`${fmt(Number(v))} ${unit}`, n]} />
          {lines.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: "var(--ink-2)" }} />}
          {lines.map((l) => (
            <Line
              isAnimationActive={false}
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color}
              strokeWidth={2}
              strokeDasharray={l.dashed ? "4 4" : undefined}
              dot={{ r: 3, strokeWidth: 1.5, stroke: "#141414", fill: l.color }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#141414" }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Area trend as in the design: peach line, soft fill, dark value pill on the active point. */
export function AreaTrend({
  data,
  x,
  y,
  unit,
  height = 190,
  label,
}: {
  data: Array<Record<string, number | string>>;
  x: string;
  y: string;
  unit: string;
  height?: number;
  label: string;
}) {
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 28, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff8a3d" stopOpacity={0.35} />
              <stop offset="1" stopColor="#ff8a3d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} {...axis} minTickGap={12} />
          <YAxis {...axis} domain={["auto", "auto"]} width={44} />
          <Tooltip
            defaultIndex={data.length - 1}
            cursor={{ stroke: "var(--ink-2)", strokeDasharray: "3 3" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-line bg-[#1a1a1a] px-2 py-1 text-[11px] font-semibold text-ink">
                  {fmt(Number(payload[0].value))} {unit}
                </div>
              ) : null
            }
          />
          <Area isAnimationActive={false} type="monotone" dataKey={y} stroke="#ff8a3d" strokeWidth={2} fill="url(#areaFill)" dot={{ r: 2.5, fill: "#ff8a3d", stroke: "#141414", strokeWidth: 1 }} activeDot={{ r: 5, fill: "#141414", stroke: "#ff8a3d", strokeWidth: 2 }} style={{ filter: "drop-shadow(0 0 4px rgba(255,138,61,0.6))" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny bar sparkline for stat tiles. */
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${v > 0 ? Math.max(18, (v / max) * 100) : 14}%`,
            background: `rgba(210,205,200,${v > 0 ? 0.18 + (i / Math.max(1, n - 1)) * 0.45 : 0.08})`,
          }}
        />
      ))}
    </div>
  );
}

/** Tiny trend line for insight tiles (no axes). */
export function Sparkline({ values, color = "#ff8a3d", height = 36 }: { values: Array<number | null>; color?: string; height?: number }) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v != null);
  if (pts.length < 2) return <div style={{ height }} className="flex items-end text-[10px] text-muted">För lite data</div>;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const w = 100;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => (max === min ? height / 2 : height - 4 - ((v - min) / (max - min)) * (height - 8));
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const id = `sp${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${x(last.i)},${height} L${x(pts[0].i)},${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.i)} cy={y(last.v)} r="2" fill={color} />
    </svg>
  );
}

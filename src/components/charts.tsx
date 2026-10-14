"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Shared chart styling: thin marks, recessive grid, text in ink tokens, hover tooltip by default.
const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--ink)" },
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
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--card-2)" }} formatter={(v) => [`${fmt(Number(v))} ${unit}`, label]} />
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
                  fill={last ? "var(--accent)" : "var(--ink-2)"}
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
              dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--card)", fill: l.color }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
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
              <stop offset="0" stopColor="#f5a877" stopOpacity={0.35} />
              <stop offset="1" stopColor="#f5a877" stopOpacity={0} />
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
                <div className="rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white">
                  {fmt(Number(payload[0].value))} {unit}
                </div>
              ) : null
            }
          />
          <Area isAnimationActive={false} type="monotone" dataKey={y} stroke="#ef9662" strokeWidth={2} fill="url(#areaFill)" dot={{ r: 2.5, fill: "#ef9662", stroke: "var(--card)", strokeWidth: 1 }} activeDot={{ r: 5, fill: "var(--card)", stroke: "#ef9662", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny bar sparkline for stat tiles. */
export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-7 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <div key={i} className={i === values.length - 1 ? "w-[5px] rounded-t-[2px] bg-ink-2" : "w-[5px] rounded-t-[2px] bg-[#cfc9c1]"} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

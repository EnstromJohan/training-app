"use client";

import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronLeft, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cn = (...xs: ClassValue[]) => twMerge(clsx(xs));

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("rounded-[18px] bg-card p-4", className)}>
      {children}
    </div>
  );
}

export function Button({
  variant = "dark",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "dark" | "accent" | "ghost" | "soft" | "outline"; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-40",
        size === "sm" && "h-9 px-4 text-[13px]",
        size === "md" && "h-12 px-5 text-[15px]",
        size === "lg" && "h-[52px] px-6 text-[16px]",
        variant === "dark" && "bg-ink text-white",
        variant === "accent" && "bg-accent text-ink",
        variant === "ghost" && "bg-transparent text-ink",
        variant === "soft" && "bg-card-2 text-ink",
        variant === "outline" && "border border-line bg-card text-ink",
        className,
      )}
    />
  );
}

/** Pill tabs: black active pill, soft grey inactive pills (as in the design). */
export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean; icon?: ReactNode }>;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full font-medium transition disabled:opacity-40",
            size === "md" ? "h-[34px] px-4 text-[13px]" : "h-7 px-3 text-[12px]",
            value === o.value ? "bg-ink text-white" : "bg-card-2 text-ink-2",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Segmented control (4v / 8v / 12v). */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full bg-card-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-7 rounded-full px-3 text-[12px] font-medium", value === o.value ? "bg-[#d9d4cd] text-ink" : "text-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Stepper row: small label top-left, − value + (design's reps/weight rows). */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  unit,
  big,
  tint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  unit?: string;
  big?: boolean;
  tint?: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 2, useGrouping: false });
  return (
    <div className={cn("relative flex items-center justify-between rounded-[16px] px-2", big ? "h-[62px]" : "h-[54px]", tint ? "bg-accent-soft/70" : "bg-card")}>
      <span className="absolute left-3 top-1.5 text-[9px] text-muted">{label}</span>
      <button
        aria-label={`Minska ${label}`}
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
        className="flex size-9 items-center justify-center rounded-full text-ink active:bg-card-2"
      >
        <Minus size={18} strokeWidth={1.8} />
      </button>
      <span className={cn("tabular font-semibold leading-none", big ? "text-[26px]" : "text-[24px]")}>
        {fmt(value)}
        {unit && <span className="ml-1 text-[13px] font-medium">{unit}</span>}
      </span>
      <button
        aria-label={`Öka ${label}`}
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
        className="flex size-9 items-center justify-center rounded-full text-ink active:bg-card-2"
      >
        <Plus size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "bad" | "dark"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium",
        tone === "neutral" && "bg-card-2 text-ink-2",
        tone === "accent" && "bg-accent-soft text-accent-ink",
        tone === "good" && "bg-good-soft text-good-ink",
        tone === "bad" && "bg-bad-soft text-bad",
        tone === "dark" && "bg-ink text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button aria-label="Stäng" onClick={onClose} className="flex size-8 items-center justify-center rounded-full bg-card-2">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Ring({ progress, size = 120, stroke = 8, color = "var(--accent)", track = "var(--line)", children }: { progress: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Semicircle gauge (recovery score). */
export function Gauge({ value, max = 10, size = 120, children }: { value: number; max?: number; size?: number; children?: ReactNode }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const half = Math.PI * r;
  const p = Math.min(1, Math.max(0, value / max));
  return (
    <div className="relative" style={{ width: size, height: size / 2 + stroke }}>
      <svg width={size} height={size / 2 + stroke}>
        <path d={`M${stroke / 2},${size / 2} a${r},${r} 0 0 1 ${2 * r},0`} fill="none" stroke="var(--card-2)" strokeWidth={stroke} strokeLinecap="round" />
        {p > 0 && <path
          d={`M${stroke / 2},${size / 2} a${r},${r} 0 0 1 ${2 * r},0`}
          fill="none"
          stroke="var(--good)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${half * p} ${half}`}
        />}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">{children}</div>
    </div>
  );
}

/** Screen header: plain chevron back, title, optional ••• menu (design header). */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onMenu,
  serif,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean | (() => void);
  onMenu?: () => void;
  serif?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-2 pb-3 pt-3">
      {back && (
        <button aria-label="Tillbaka" onClick={typeof back === "function" ? back : () => router.back()} className="-ml-1.5 flex size-9 items-center justify-center">
          <ChevronLeft size={24} strokeWidth={1.8} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className={cn("truncate leading-tight tracking-tight", serif ? "font-serif text-[32px]" : "text-[24px] font-semibold")}>{title}</h1>
        {subtitle && <p className="text-[12px] text-muted">{subtitle}</p>}
      </div>
      {right}
      {onMenu && (
        <button aria-label="Meny" onClick={onMenu} className="flex size-9 items-center justify-center">
          <MoreHorizontal size={22} />
        </button>
      )}
    </header>
  );
}

/** Back-compat alias used by older screens. */
export function PageHeader({ title, back, right }: { title: string; back?: () => void; right?: ReactNode }) {
  return <ScreenHeader title={title} back={back} right={right} />;
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 mt-5 flex items-end justify-between", className)}>
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function Scale({ value, onChange, max = 10, min = 0, labels }: { value: number | null; onChange: (v: number) => void; max?: number; min?: number; labels?: [string, string] }) {
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <div>
      <div className="flex gap-1">
        {items.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn("tabular h-10 flex-1 rounded-xl text-sm font-medium transition", value === n ? "bg-ink text-white" : "bg-card-2 text-ink-2")}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Check circle used in lists (done = green, current = dark, todo = outline). */
export function CheckDot({ state, size = 22 }: { state: "done" | "current" | "todo"; size?: number }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-good text-white",
        state === "current" && "bg-ink text-white",
        state === "todo" && "border-[1.5px] border-[#cfc9c1]",
      )}
      style={{ width: size, height: size }}
    >
      {state !== "todo" && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2 5 8.6l4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export const kg = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("sv-SE", { maximumFractionDigits: 2 }));

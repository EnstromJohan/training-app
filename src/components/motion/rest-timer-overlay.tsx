"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { spring } from "@/lib/motion";
import { mmss, timeLeft, type TimerState } from "../workout/rest-timer";

const SIZE = 264;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Full-screen rest countdown, opened after a completed set. Uses the same persisted timer state as
 * the small ring in the workout view, so minimising, reloading or locking the phone loses nothing.
 */
export function RestTimerOverlay({
  open,
  timer,
  onChange,
  onClose,
  onDone,
  next,
  extra,
}: {
  open: boolean;
  timer: TimerState | null;
  onChange: (t: TimerState | null) => void;
  /** Minimise: the timer keeps running in the small ring. */
  onClose: () => void;
  /** Rest is over (ran out or skipped). */
  onDone: () => void;
  next?: ReactNode;
  extra?: ReactNode;
}) {
  const visible = open && !!timer;
  return <AnimatePresence>{visible && <Overlay key="rest" timer={timer!} onChange={onChange} onClose={onClose} onDone={onDone} next={next} extra={extra} />}</AnimatePresence>;
}

function Overlay({
  timer,
  onChange,
  onClose,
  onDone,
  next,
  extra,
}: {
  timer: TimerState;
  onChange: (t: TimerState | null) => void;
  onClose: () => void;
  onDone: () => void;
  next?: ReactNode;
  extra?: ReactNode;
}) {
  const [, tick] = useState(0);
  const left = timeLeft(timer);
  const done = left === 0;
  const skip = useRef<HTMLButtonElement>(null);
  // While fading out it must not swallow taps meant for the workout underneath.
  const present = useIsPresent();

  useEffect(() => {
    if (done || timer.pausedLeft != null) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [done, timer.pausedLeft]);

  // Close shortly after reaching zero, so "Kör!" registers first.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => doneRef.current(), 1400);
    return () => clearTimeout(id);
  }, [done]);

  useEffect(() => {
    skip.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const add = (sec: number) => {
    const base = timer.pausedLeft ?? left;
    const nextLeft = base + sec;
    onChange(
      timer.pausedLeft != null
        ? { ...timer, pausedLeft: nextLeft, total: Math.max(timer.total, nextLeft) }
        : { ...timer, endsAt: Date.now() + nextLeft * 1000, total: Math.max(timer.total, nextLeft) },
    );
  };

  const progress = timer.total > 0 ? left / timer.total : 0;

  return (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label="Vila"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: present ? "auto" : "none" }}
      className="fixed inset-0 z-[70] flex flex-col bg-bg/95 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-md"
    >
      <div className="flex justify-end">
        <button onClick={onClose} aria-label="Minimera vilotimer" className="flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink-2">
          <ChevronDown size={20} />
        </button>
      </div>

      <m.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.15 } }}
        transition={spring.soft}
        className="flex flex-1 flex-col items-center justify-center"
      >
        <div
          className="relative transition-[filter] duration-300"
          style={{ width: SIZE, height: SIZE, filter: `drop-shadow(0 0 12px ${done ? "rgba(74,222,128,0.45)" : "rgba(255,138,61,0.45)"})` }}
        >
          <svg width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--card-2)" strokeWidth={STROKE} />
            <m.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={done ? "var(--good)" : "var(--accent)"}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C * (1 - progress) }}
              animate={{ strokeDashoffset: C * (1 - progress) }}
              transition={{ duration: 0.3, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[14px] text-ink-2">{done ? "Kör!" : timer.pausedLeft != null ? "Pausad" : "Vila"}</span>
            <span role="timer" aria-live="off" className="tabular text-[64px] font-bold leading-none tracking-tight">
              {mmss(left)}
            </span>
          </div>
        </div>
        {next && <div className="mt-6 text-center text-[14px] text-ink-2">{next}</div>}
      </m.div>

      {extra}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => add(15)} className="h-14 rounded-full border border-line bg-card-2 text-[16px] font-semibold active:scale-[0.98]">
          +15 s
        </button>
        <button
          ref={skip}
          onClick={() => {
            onChange(null);
            onDone();
          }}
          className="bg-accent-grad glow h-14 rounded-full text-[16px] font-semibold text-on-accent active:scale-[0.98]"
        >
          Hoppa över
        </button>
      </div>
    </m.div>
  );
}

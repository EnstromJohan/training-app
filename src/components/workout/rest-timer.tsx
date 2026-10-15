"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Ring } from "../ui";

export interface TimerState {
  endsAt: number;
  total: number;
  pausedLeft: number | null;
}

const KEY = "rest-timer";

export function loadTimer(): TimerState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

export function saveTimer(t: TimerState | null) {
  try {
    if (t) sessionStorage.setItem(KEY, JSON.stringify(t));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function timeLeft(t: TimerState, now = Date.now()) {
  return t.pausedLeft ?? Math.max(0, Math.ceil((t.endsAt - now) / 1000));
}

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** Rest ring as in the design: "Vila", mm:ss and a small play/pause button. Idle shows the planned rest. */
export function RestTimer({ timer, restSec, onChange }: { timer: TimerState | null; restSec: number; onChange: (t: TimerState | null) => void }) {
  const [, tick] = useState(0);
  const left = timer ? timeLeft(timer) : restSec;
  const running = !!timer && timer.pausedLeft == null && left > 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (timer && left === 0 && timer.pausedLeft == null) {
      try {
        navigator.vibrate?.([250, 120, 250]);
      } catch {
        /* unsupported */
      }
    }
  }, [left, timer]);

  const toggle = () => {
    if (!timer || left === 0) return onChange({ endsAt: Date.now() + restSec * 1000, total: restSec, pausedLeft: null });
    onChange(timer.pausedLeft != null ? { ...timer, endsAt: Date.now() + timer.pausedLeft * 1000, pausedLeft: null } : { ...timer, pausedLeft: left });
  };

  return (
    <Ring progress={timer ? left / timer.total : 0} size={100} stroke={6} color={timer && left === 0 ? "var(--good)" : "var(--accent)"} track="var(--card-2)" glow={!!timer}>
      <span className="text-[11px] text-ink-2">{timer && left === 0 ? "Kör!" : "Vila"}</span>
      <span className="tabular text-[24px] font-bold leading-tight">{mmss(left)}</span>
      <button
        aria-label={running ? "Pausa vila" : "Starta vila"}
        onClick={toggle}
        className="bg-accent-grad mt-0.5 flex size-6 items-center justify-center rounded-full text-on-accent"
      >
        {running ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}
      </button>
    </Ring>
  );
}

import type { ProgramDay, SessionCategory } from "../types";
import { addDays, daysBetween, weekStart } from "./dates";

export interface DoneSession {
  programDayId: string;
  date: string;
}

export interface PlannedDay {
  date: string;
  programDayId: string | null;
  status: "completed" | "planned" | "rest";
  /** True when the session was moved from its original weekday. */
  moved: boolean;
}

export interface WeekPlan {
  days: PlannedDay[];
  /** Session to do next (today or later). */
  next: { date: string; programDayId: string } | null;
  /** Sessions that no longer fit this week. */
  dropped: string[];
}

/** Minimum days between two sessions of the same category (48 h). */
export const MIN_DAYS_SAME_CATEGORY = 2;

/**
 * The week is a queue, not fixed days: missed sessions slide forward (Sunday can absorb one),
 * the same category is never trained twice within 48 h, and whatever does not fit is dropped.
 * Progression is per exposure, so dropping a session never breaks it.
 */
/** `restDates`: days the user chose to rest – the session stays in the queue and slides forward. */
export function planWeek(days: ProgramDay[], done: DoneSession[], today: string, restDates: string[] = []): WeekPlan {
  const start = weekStart(today);
  const training = days.filter((d) => d.category !== "rest").sort((a, b) => a.weekday - b.weekday);
  const byId = Object.fromEntries(days.map((d) => [d.id, d]));
  const thisWeek = done.filter((s) => s.date >= start && s.date <= addDays(start, 6));
  const doneIds = new Set(thisWeek.map((s) => s.programDayId));

  const lastByCat = new Map<SessionCategory, string>();
  for (const s of [...done].sort((a, b) => a.date.localeCompare(b.date))) {
    const cat = byId[s.programDayId]?.category;
    if (cat && cat !== "rest" && s.date <= today) lastByCat.set(cat, s.date);
  }

  const queue = training.filter((d) => !doneIds.has(d.id));
  const out: PlannedDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i);
    const completed = thisWeek.find((s) => s.date === date);
    if (completed) {
      out.push({ date, programDayId: completed.programDayId, status: "completed", moved: false });
      continue;
    }
    if (date < today || restDates.includes(date)) {
      out.push({ date, programDayId: null, status: "rest", moved: false });
      continue;
    }
    const idx = queue.findIndex((d) => {
      const last = lastByCat.get(d.category as SessionCategory);
      return !last || daysBetween(last, date) >= MIN_DAYS_SAME_CATEGORY;
    });
    if (idx === -1) {
      out.push({ date, programDayId: null, status: "rest", moved: false });
      continue;
    }
    const [pick] = queue.splice(idx, 1);
    lastByCat.set(pick.category as SessionCategory, date);
    out.push({ date, programDayId: pick.id, status: "planned", moved: pick.weekday !== i + 1 });
  }

  const nextDay = out.find((d) => d.status === "planned" && d.date >= today);
  return {
    days: out,
    next: nextDay ? { date: nextDay.date, programDayId: nextDay.programDayId! } : null,
    dropped: queue.map((d) => d.id),
  };
}

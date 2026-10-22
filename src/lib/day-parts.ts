export type DayPart = "strength" | "cardio" | "rehab";

// The parts picked on the dashboard for the block being trained now (e.g. cardio + rehab in the
// morning, strength in the evening). Kept per day in localStorage so it survives the app being
// closed between sets; null means nothing was picked, and every part is offered as before.
const KEY = "training-app:day-parts";

export function pickedParts(date: string): DayPart[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v?.date === date && Array.isArray(v.parts) ? v.parts : null;
  } catch {
    return null;
  }
}

export function pickParts(date: string, parts: DayPart[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ date, parts }));
  } catch {
    /* storage unavailable – every part is offered */
  }
}

/** Whether a part belongs to the block being trained now. */
export const isPicked = (date: string, part: DayPart) => pickedParts(date)?.includes(part) ?? true;

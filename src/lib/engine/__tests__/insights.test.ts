import { describe, expect, it } from "vitest";
import { acwr, estimateMinutes, injuryRisk, loadStatus } from "../weekly/insights";
import { addDays } from "../weekly/dates";

const series = (days: number, perDay: (i: number) => number, end = "2026-10-15") =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(end, -(days - 1 - i)), load: perDay(i) }));

describe("acute:chronic workload", () => {
  it("needs three weeks of history", () => {
    expect(acwr(series(14, () => 300), "2026-10-15").ratio).toBeNull();
    expect(loadStatus(null)).toBe("unknown");
  });

  it("is ~1.0 for steady training", () => {
    const r = acwr(series(35, () => 300), "2026-10-15").ratio!;
    expect(r).toBeCloseTo(1, 1);
    expect(loadStatus(r)).toBe("optimal");
  });

  it("flags a sudden spike", () => {
    const r = acwr(series(35, (i) => (i >= 28 ? 900 : 300)), "2026-10-15").ratio!;
    expect(r).toBeGreaterThan(1.5);
    expect(loadStatus(r)).toBe("very_high");
  });

  it("flags a big drop as low", () => {
    const r = acwr(series(35, (i) => (i >= 28 ? 50 : 300)), "2026-10-15").ratio!;
    expect(loadStatus(r)).toBe("low");
  });
});

describe("injury risk", () => {
  it("is low with steady load and no symptoms", () => {
    expect(injuryRisk({ ratio: 1, morningPainOverBaseline: 0, maxPainDuring: 3, readiness: 4 }).level).toBe("low");
  });
  it("is high with a load spike and worse morning stiffness", () => {
    const r = injuryRisk({ ratio: 1.7, morningPainOverBaseline: 3, maxPainDuring: 4, readiness: 4 });
    expect(r.level).toBe("high");
    expect(r.reasons.length).toBe(2);
  });
  it("is moderate with only low readiness", () => {
    expect(injuryRisk({ ratio: null, morningPainOverBaseline: null, maxPainDuring: null, readiness: 2 }).level).toBe("moderate");
  });
});

describe("session length", () => {
  it("estimates a 5-exercise chest/back day at roughly 60–90 min", () => {
    const [lo, hi] = estimateMinutes([
      { sets: 4, restSec: 150, isCompound: true },
      { sets: 4, restSec: 150, isCompound: true },
      { sets: 3, restSec: 120, isCompound: true },
      { sets: 3, restSec: 120, isCompound: true },
      { sets: 2, restSec: 75, isCompound: false },
    ]);
    expect(lo).toBeGreaterThanOrEqual(50);
    expect(hi).toBeLessThanOrEqual(95);
    expect(hi - lo).toBeGreaterThanOrEqual(5);
    expect(lo % 5).toBe(0);
  });
  it("is zero for a rest day", () => {
    expect(estimateMinutes([])).toEqual([0, 0]);
  });
});

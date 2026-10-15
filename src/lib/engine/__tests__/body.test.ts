import { describe, expect, it } from "vitest";
import { rfm } from "../body/rfm";

describe("Relative Fat Mass", () => {
  it("matches the published formula", () => {
    // 180 cm, 85 cm waist, man: 64 − 20 × 2.1176 = 21.6
    expect(rfm(180, 85, "male")).toBe(21.6);
    // 168 cm, 75 cm waist, woman: 76 − 20 × 2.24 = 31.2
    expect(rfm(168, 75, "female")).toBe(31.2);
  });

  it("falls when the waist shrinks", () => {
    expect(rfm(180, 80, "male")!).toBeLessThan(rfm(180, 85, "male")!);
  });

  it("needs height, waist and sex, and rejects implausible values", () => {
    expect(rfm(null, 85, "male")).toBeNull();
    expect(rfm(180, null, "male")).toBeNull();
    expect(rfm(180, 85, null)).toBeNull();
    expect(rfm(18, 85, "male")).toBeNull(); // metres typed as cm
    expect(rfm(180, 8.5, "male")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { bmi, estimatedMuscleMass, fatFreeMass, ffmi, waistToHeight, waistToHip } from "../metrics";

describe("body metrics", () => {
  it("fat-free mass is weight minus fat", () => {
    expect(fatFreeMass(80, 15)).toBe(68);
    expect(fatFreeMass(80, null)).toBeNull();
    expect(fatFreeMass(80, 0)).toBeNull();
  });

  it("estimates muscle mass as a share of fat-free mass by sex", () => {
    expect(estimatedMuscleMass(68, "male")).toBe(36);
    expect(estimatedMuscleMass(50, "female")).toBe(24);
    expect(estimatedMuscleMass(68, null)).toBeNull();
  });

  it("BMI and normalised FFMI", () => {
    expect(bmi(80, 180)).toBe(24.7);
    expect(ffmi(68, 180)).toBe(21); // 68 / 1.8² = 20.99, no height correction at 1.8 m
    expect(ffmi(60, 170)).toBe(21.4); // 20.76 + 6.1 × 0.1
  });

  it("waist ratios", () => {
    expect(waistToHeight(85, 180)).toBe(0.47);
    expect(waistToHip(85, 98)).toBe(0.87);
    expect(waistToHip(85, null)).toBeNull();
  });
});

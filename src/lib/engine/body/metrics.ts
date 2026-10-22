/**
 * Helper calculations shown while logging a measurement. All take raw inputs and return null when
 * an input is missing, so the UI can show whatever is computable.
 */

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Fat-free mass (everything but fat: muscle, bone, water, organs). */
export function fatFreeMass(weightKg: number | null | undefined, bodyFatPct: number | null | undefined): number | null {
  if (!weightKg || bodyFatPct == null || bodyFatPct <= 0 || bodyFatPct >= 70) return null;
  return round(weightKg * (1 - bodyFatPct / 100));
}

/**
 * Rough skeletal muscle mass from fat-free mass. Skeletal muscle is about half of fat-free mass in
 * trained adults (≈53 % men, ≈48 % women; Janssen et al. 2000, Kim et al. 2004). Expect ±3 kg vs a
 * bioimpedance scale; a scale that measures it directly is better.
 */
export function estimatedMuscleMass(fatFreeKg: number | null, sex: "male" | "female" | null | undefined): number | null {
  if (fatFreeKg == null || !sex) return null;
  return round(fatFreeKg * (sex === "male" ? 0.53 : 0.48));
}

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null;
  return round(weightKg / (heightCm / 100) ** 2);
}

/**
 * Fat-free mass index, normalised to 1.8 m (Kouri et al. 1995). Unlike BMI it ignores fat, so it
 * tracks muscle gain: ~18–20 average trained man, 22+ very muscular (women ≈ 3–4 lower).
 */
export function ffmi(fatFreeKg: number | null, heightCm: number | null | undefined): number | null {
  if (fatFreeKg == null || !heightCm) return null;
  const m = heightCm / 100;
  return round(fatFreeKg / m ** 2 + 6.1 * (1.8 - m));
}

/** Waist-to-height ratio: below 0.5 is the common healthy threshold for both sexes. */
export function waistToHeight(waistCm: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!waistCm || !heightCm) return null;
  return round(waistCm / heightCm, 2);
}

/** Waist-to-hip ratio: WHO marks increased risk at ≥ 0.90 (men) / ≥ 0.85 (women). */
export function waistToHip(waistCm: number | null | undefined, hipsCm: number | null | undefined): number | null {
  if (!waistCm || !hipsCm) return null;
  return round(waistCm / hipsCm, 2);
}

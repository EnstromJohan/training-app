/**
 * Relative Fat Mass (Woolcott & Bergman, 2018): body-fat % from height and waist circumference.
 * Validated against DXA (error comparable to bioimpedance scales); no photo or scale needed.
 *   men:   64 − 20 × (height / waist)
 *   women: 76 − 20 × (height / waist)
 * Waist measured at the navel, standing, relaxed, after exhaling.
 */
export function rfm(heightCm: number | null | undefined, waistCm: number | null | undefined, sex: "male" | "female" | null | undefined): number | null {
  if (!heightCm || !waistCm || !sex) return null;
  if (heightCm < 120 || heightCm > 230 || waistCm < 45 || waistCm > 200) return null; // implausible input
  const v = (sex === "male" ? 64 : 76) - 20 * (heightCm / waistCm);
  return Math.round(v * 10) / 10;
}

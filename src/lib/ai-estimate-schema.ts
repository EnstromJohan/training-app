import { z } from "zod";

// Shared between the API route and tests (Next.js route files may only export handlers).

export const MAX_BASE64_CHARS = 2_000_000; // ~1.5 MB JPEG; the client sends ≤1024 px

export const EstimateSchema = z.object({
  assessable: z.boolean(),
  bodyFatLow: z.number().nullable(),
  bodyFatHigh: z.number().nullable(),
  bodyFatMid: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  cues: z.array(z.string()),
  limitations: z.string(),
});

export const RequestSchema = z.object({
  image: z.string().min(100).max(MAX_BASE64_CHARS),
  pose: z.enum(["front", "side", "back"]),
  context: z.object({
    sex: z.enum(["male", "female"]).nullable(),
    heightCm: z.number().nullable(),
    weightKg: z.number().nullable(),
    waistCm: z.number().nullable(),
    rfm: z.number().nullable(),
  }),
});


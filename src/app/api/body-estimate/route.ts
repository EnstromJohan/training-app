import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { createClient } from "@supabase/supabase-js";
import { EstimateSchema, RequestSchema } from "@/lib/ai-estimate-schema";

// Estimates a body-fat range from one progress photo with Claude (vision + structured output).
// Server-side only: the API key never reaches the browser. Requires a signed-in Supabase user,
// is rate-limited, and the photo is not stored by this route.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const DAILY_LIMIT = 20;

const SYSTEM = `You estimate body-fat percentage from a single progress photo for a personal strength-training app. The user owns the photo and has explicitly consented to this analysis.

Base the estimate on what is visible: definition of the abdominal and oblique muscles, separation in shoulders, arms and chest, vascularity, and how fat is distributed at the waist, hips and lower back. Visual estimates typically differ from DEXA by 3–5 percentage points, so always give a range at least 4 points wide, and wider when lighting, clothing, posture, angle or image quality make the assessment harder. Use the supplied measurements (height, weight, waist, the waist-based RFM estimate) only as supporting context; let the photo drive the estimate, and widen the range if the photo and the measurements disagree.

If the photo does not show enough of a person's torso to judge (heavily clothed, cropped, blurry, or not a body photo), set assessable to false, leave the numbers null, and explain why in limitations.

Write cues and limitations in Swedish: short, neutral and factual. At most four cues. Do not comment on attractiveness and give no diet, health or medical advice.`;

// Per-instance daily counter – enough for a personal app; resets on redeploy.
const usage = new Map<string, { day: string; count: number }>();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "AI-analys är inte aktiverad: ANTHROPIC_API_KEY saknas på servern." }, 503);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return json({ error: "AI-analys kräver inloggning (Supabase är inte konfigurerat)." }, 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Logga in för att använda AI-analys." }, 401);
  const sb = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await sb.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Inloggningen har gått ut – logga in igen." }, 401);

  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(auth.user.id);
  const count = u && u.day === day ? u.count : 0;
  if (count >= DAILY_LIMIT) return json({ error: `Max ${DAILY_LIMIT} analyser per dag.` }, 429);

  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Ogiltig förfrågan." }, 400);
  const { image, pose, context } = parsed.data;
  if (!image.startsWith("/9j/")) return json({ error: "Bilden måste vara JPEG." }, 400); // base64 JPEG magic bytes
  usage.set(auth.user.id, { day, count: count + 1 });

  const facts = [
    `Pose: ${pose === "front" ? "front" : pose === "side" ? "side" : "back"}`,
    context.sex && `Sex: ${context.sex}`,
    context.heightCm && `Height: ${context.heightCm} cm`,
    context.weightKg && `Weight: ${context.weightKg} kg`,
    context.waistCm && `Waist: ${context.waistCm} cm`,
    context.rfm != null && `Waist-based RFM estimate: ${context.rfm} %`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(EstimateSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
            { type: "text", text: `Estimate body-fat percentage from this progress photo.\n\n${facts}` },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return json({ error: "AI:n kunde inte analysera bilden. Prova ett annat foto." }, 422);
    const out = response.parsed_output;
    if (!out) return json({ error: "Kunde inte tolka AI-svaret. Försök igen." }, 502);

    // Sanity-bound the numbers and enforce low ≤ mid ≤ high with a meaningful width.
    const clamp = (n: number | null) => (n == null ? null : Math.round(Math.min(60, Math.max(3, n)) * 10) / 10);
    let low = clamp(out.bodyFatLow);
    let high = clamp(out.bodyFatHigh);
    let mid = clamp(out.bodyFatMid);
    if (!out.assessable || low == null || high == null) {
      low = high = mid = null;
    } else {
      if (low > high) [low, high] = [high, low];
      if (high - low < 4) {
        const c = (low + high) / 2;
        low = clamp(c - 2);
        high = clamp(c + 2);
      }
      mid = mid == null || mid < low! || mid > high! ? Math.round(((low! + high!) / 2) * 10) / 10 : mid;
    }

    return json({
      assessable: out.assessable && low != null,
      bodyFatLow: low,
      bodyFatHigh: high,
      bodyFatMid: mid,
      confidence: out.confidence,
      cues: out.cues.slice(0, 4),
      limitations: out.limitations,
      model: response.model,
      at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "AI-tjänsten är tillfälligt överbelastad. Försök igen om en stund." }, 429);
    if (error instanceof Anthropic.AuthenticationError) return json({ error: "Fel API-nyckel på servern." }, 500);
    if (error instanceof Anthropic.BadRequestError) return json({ error: "Bilden kunde inte skickas för analys." }, 400);
    if (error instanceof Anthropic.APIError) return json({ error: `AI-tjänsten svarade med fel (${error.status}).` }, 502);
    return json({ error: "Kunde inte nå AI-tjänsten." }, 502);
  }
}

"use client";

import { getBlob } from "./db/local";
import { photoUrl, supabase } from "./db/supabase";
import type { AiBodyEstimate, ProgressPhotoRec } from "./db/records";

export interface EstimateContext {
  sex: "male" | "female" | null;
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
  rfm: number | null;
}

/** Whether the AI estimate can be used at all right now (and why not). */
export function aiAvailability(): { ok: true } | { ok: false; reason: string } {
  if (!supabase()) return { ok: false, reason: "Kräver inloggning – aktivera synk med Supabase först." };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, reason: "Kräver internetanslutning." };
  return { ok: true };
}

async function toBase64Jpeg(blob: Blob, maxSide = 1024): Promise<string> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/** Sends one progress photo (downscaled to ≤1024 px) to the server route for a body-fat range. */
export async function requestBodyEstimate(photo: ProgressPhotoRec, context: EstimateContext): Promise<AiBodyEstimate> {
  const sb = supabase();
  if (!sb) throw new Error("Kräver inloggning.");
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Logga in under Inställningar → Övrigt för att använda AI-analys.");

  let blob = await getBlob(photo.id);
  if (!blob && photo.storagePath) {
    const url = await photoUrl(photo.storagePath);
    if (url) blob = await (await fetch(url)).blob();
  }
  if (!blob) throw new Error("Fotot finns inte på den här enheten.");

  const res = await fetch("/api/body-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ image: await toBase64Jpeg(blob), pose: photo.pose, context }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `Analysen misslyckades (${res.status}).`);
  return body as AiBodyEstimate;
}

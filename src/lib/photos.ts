"use client";

/**
 * Downscale + re-encode a picked photo on the device: max 1600 px, JPEG. Re-encoding through a
 * canvas applies EXIF orientation and strips all metadata (incl. GPS) before anything is stored.
 */
export async function compressPhoto(file: File, maxSide = 1600): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte behandla bilden");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Kunde inte spara bilden");
  return { blob, width, height };
}

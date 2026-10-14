"use client";

import { useState, type ReactNode } from "react";
import manifest from "@/lib/images/manifest.json";
import { cn } from "./ui";

interface CropInfo {
  aspect: number;
  widths: number[];
  blur: string;
  v: string;
}

const MANIFEST = manifest as Record<string, { crops: Record<string, CropInfo> } | undefined>;

/** Image slot keys (see src/lib/images/slots.json and public/images/README.md). */
export const IMAGES = {
  heroHome: "hero-home",
  avatar: "avatar",
  cardio: "cardio",
  rehab: "rehab",
  restDay: "rest-day",
  schedule: (category: string) => `schedule/${category}`,
  exercise: (id: string) => `exercise/${id}`,
  rehabExercise: (id: string) => `rehab-exercise/${id}`,
};

export function hasImage(slot: string, crop: string) {
  return !!MANIFEST[slot]?.crops[crop];
}

/**
 * Responsive, pre-optimised photo (AVIF → WebP) with a blur placeholder. If the slot has no
 * image yet, or it fails to load (e.g. offline and not cached), the generated fallback is shown –
 * no request is made for images that don't exist.
 */
export function Photo({
  slot,
  crop = "main",
  alt,
  sizes = "100vw",
  priority,
  className,
  imgClassName,
  fallback,
}: {
  slot: string;
  crop?: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  fallback: ReactNode;
}) {
  const info = MANIFEST[slot]?.crops[crop];
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  if (!info || state === "error") {
    return <div className={cn("relative overflow-hidden", className)}>{fallback}</div>;
  }

  const base = `/images/opt/${slot}/${crop}`;
  const set = (ext: string) => info.widths.map((w) => `${base}-${w}.${ext}?v=${info.v} ${w}w`).join(", ");
  const largest = info.widths[info.widths.length - 1];

  return (
    <div
      className={cn("relative overflow-hidden bg-cover bg-center", className)}
      style={state === "ok" ? undefined : { backgroundImage: `url("${info.blur}")` }}
    >
      <picture>
        <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
        <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
        <img
          src={`${base}-${largest}.webp?v=${info.v}`}
          alt={alt}
          width={largest}
          height={Math.round(largest / info.aspect)}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          ref={(img) => {
            // A cached image can finish loading before React attaches onLoad.
            if (img?.complete && img.naturalWidth > 0 && state === "loading") setState("ok");
          }}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            state === "ok" ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      </picture>
    </div>
  );
}

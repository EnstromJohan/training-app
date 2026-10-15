"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getBlob } from "@/lib/db/local";
import { photoUrl } from "@/lib/db/supabase";
import type { ProgressPhotoRec } from "@/lib/db/records";
import { cn } from "./ui";

/** Shows a progress photo from the device, or from the private cloud bucket on other devices. */
export function ProgressPhoto({ photo, className }: { photo: ProgressPhotoRec; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const blob = await getBlob(photo.id).catch(() => undefined);
      if (cancelled) return;
      if (blob) {
        url = URL.createObjectURL(blob);
        setSrc(url);
        return;
      }
      const remote = photo.storagePath ? await photoUrl(photo.storagePath) : null;
      if (cancelled) return;
      if (remote) setSrc(remote);
      else setMissing(true);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo.id, photo.storagePath]);

  return (
    <div className={cn("relative overflow-hidden bg-card-2", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user photo from IndexedDB / signed URL
        <img src={src} alt={`Progressionsfoto ${photo.date}`} className="absolute inset-0 h-full w-full object-cover" />
      ) : missing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] text-muted">
          <ImageOff size={18} /> Inte synkad
        </div>
      ) : null}
    </div>
  );
}

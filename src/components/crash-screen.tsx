"use client";

import { useEffect, useState } from "react";
import { exportAll } from "@/lib/db/local";

/** Shown by error boundaries. Data lives in IndexedDB, so it is safe – offer a backup anyway. */
export function CrashScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);

  const backup = async () => {
    try {
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, data: await exportAll() }, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `traning-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-[20px] font-semibold">Något gick fel</h1>
      <p className="text-[14px] text-ink-2">Din träningshistorik är sparad på enheten och påverkas inte.</p>
      <div className="mt-2 flex gap-2">
        <button onClick={reset} className="bg-accent-grad h-11 rounded-full px-6 text-[14px] font-semibold text-on-accent">
          Försök igen
        </button>
        <button onClick={backup} className="h-11 rounded-full border border-line bg-card-2 px-5 text-[14px] font-medium">
          {saved ? "Backup sparad" : "Spara backup"}
        </button>
      </div>
      {error.digest && <p className="text-[11px] text-muted">Felkod: {error.digest}</p>}
    </div>
  );
}

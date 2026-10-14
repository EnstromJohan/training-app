"use client";

import { CrashScreen } from "@/components/crash-screen";
import "./globals.css";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="sv">
      <body>
        <CrashScreen error={error} reset={reset} />
      </body>
    </html>
  );
}

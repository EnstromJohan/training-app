"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { logIn, type LoginError } from "@/lib/auth";
import { Button } from "./ui";

const MESSAGES: Record<LoginError, string> = {
  credentials: "Fel användarnamn eller lösenord.",
  offline: "Ingen anslutning. Du behöver vara online för att logga in.",
  rate_limited: "För många försök. Vänta en stund och försök igen.",
  unknown: "Det gick inte att logga in just nu. Försök igen.",
};

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const ready = username.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const err = await logIn(username, password);
    // On success the auth listener swaps this screen for the app.
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div className="mb-10">
          <div className="bg-accent-grad glow mb-6 flex size-14 items-center justify-center rounded-[18px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-14 rounded-[18px]" />
          </div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight">Välkommen tillbaka</h1>
          <p className="mt-2 text-[15px] text-ink-2">Logga in för att se din träning, dina resultat och din progression.</p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Användarnamn
            </label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="h-13 w-full rounded-[16px] border border-line bg-card px-4 text-[16px] outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              Lösenord
            </label>
            <div className="relative">
              <input
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                className="h-13 w-full rounded-[16px] border border-line bg-card pl-4 pr-12 text-[16px] outline-none transition-colors focus:border-accent"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Dölj lösenord" : "Visa lösenord"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[13px] text-bad">
              {MESSAGES[error]}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={!ready || busy}>
            {busy ? "Loggar in…" : "Logga in"}
          </Button>
        </form>
      </main>
    </div>
  );
}

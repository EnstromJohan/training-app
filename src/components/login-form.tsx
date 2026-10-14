"use client";

import { useState } from "react";
import { supabase } from "@/lib/db/supabase";
import { Button } from "./ui";

/** Magic-link login. Renders nothing when Supabase isn't configured. */
export function LoginForm({ intro }: { intro?: string }) {
  const sb = supabase();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  if (!sb) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    setState("sending");
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) {
      setState("error");
      setMsg(error.status === 429 ? "För många försök – vänta en stund och försök igen." : error.message);
    } else {
      setState("sent");
      setMsg("Kolla din e-post och öppna länken i den här webbläsaren.");
    }
  };

  return (
    <div className="space-y-2">
      {intro && <p className="text-[13px] text-ink-2">{intro}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && state !== "sending") send();
        }}
      >
        <label className="sr-only" htmlFor="login-email">E-post</label>
        <input
          id="login-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@epost.se"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="h-11 min-w-0 flex-1 rounded-full bg-card px-4 text-[16px] outline-none"
        />
        <Button type="submit" size="sm" className="h-11" disabled={!valid || state === "sending"}>
          {state === "sending" ? "Skickar…" : "Logga in"}
        </Button>
      </form>
      {msg && <p className={state === "error" ? "text-[12px] text-bad" : "text-[12px] text-muted"}>{msg}</p>}
    </div>
  );
}

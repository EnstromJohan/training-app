"use client";

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./db/supabase";
import { USERNAME_DOMAIN, usernameToEmail } from "./username";

export type User = { id: string; username: string };

function toUser(u: SupabaseUser): User {
  const fromMeta = typeof u.user_metadata?.username === "string" ? u.user_metadata.username : null;
  return { id: u.id, username: fromMeta ?? u.email?.replace(`@${USERNAME_DOMAIN}`, "") ?? "" };
}

// The last logged-in account, so the app opens straight into it offline (when the session can't be
// refreshed). Cleared on logout. The data itself stays protected server-side by RLS.
const REMEMBER_KEY = "training-app:user";

function remembered(): User | null {
  try {
    const v = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "null");
    return v && typeof v.id === "string" && typeof v.username === "string" ? v : null;
  } catch {
    return null;
  }
}

function remember(u: User | null) {
  try {
    if (u) localStorage.setItem(REMEMBER_KEY, JSON.stringify(u));
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage unavailable – the session still works for this visit */
  }
}

export type AuthState =
  | { status: "loading" }
  | { status: "local" } // Supabase not configured: everything stays on this device
  | { status: "signed_out" }
  | { status: "signed_in"; user: User };

const AuthCtx = createContext<User | null>(null);

/** The logged-in account (null in local-only mode). */
export const useUser = () => useContext(AuthCtx);

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() => (supabase() ? { status: "loading" } : { status: "local" }));

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    const signIn = (u: User) => {
      remember(u);
      // Same account again (token refresh etc.): keep the state object so nothing remounts.
      setState((cur) => (cur.status === "signed_in" && cur.user.id === u.id && cur.user.username === u.username ? cur : { status: "signed_in", user: u }));
    };
    const signOut = () => {
      remember(null);
      setState({ status: "signed_out" });
    };

    const saved = remembered();
    if (saved) setState({ status: "signed_in", user: saved });
    sb.auth
      .getSession()
      .then(({ data, error }) => {
        if (data.session) signIn(toUser(data.session.user));
        // No session and no error: really logged out. With an error (offline) keep the saved account.
        else if (!error || !saved) signOut();
      })
      .catch(() => {
        if (!saved) signOut();
      });

    const sub = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") signOut();
      else if (session?.user) signIn(toUser(session.user));
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  return state;
}

export function UserProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <AuthCtx.Provider value={user}>{children}</AuthCtx.Provider>;
}

export type LoginError = "credentials" | "offline" | "rate_limited" | "unknown";

export async function logIn(username: string, password: string): Promise<LoginError | null> {
  const sb = supabase();
  if (!sb) return "unknown";
  try {
    const { error } = await sb.auth.signInWithPassword({ email: usernameToEmail(username), password });
    if (!error) return null;
    if (error.status === 429) return "rate_limited";
    if (error.status === 400 || error.code === "invalid_credentials") return "credentials";
    if (!navigator.onLine || error.name === "AuthRetryableFetchError") return "offline";
    return "unknown";
  } catch {
    return navigator.onLine ? "unknown" : "offline";
  }
}

/** Ends the session on this device only (works offline). Local data stays in the account's own database. */
export async function logOut(): Promise<void> {
  await supabase()?.auth.signOut({ scope: "local" });
}

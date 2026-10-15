"use client";

import type { ReactNode } from "react";
import { UserProvider, useAuthState } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { LoginScreen } from "./login-screen";

/**
 * Login comes first: with Supabase configured nothing is shown or stored until someone is logged in,
 * and each account gets its own store. Without Supabase the app runs local-only, as before.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  if (auth.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Laddar">
        <span className="size-6 animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none" />
      </div>
    );
  }
  if (auth.status === "signed_out") return <LoginScreen />;
  const user = auth.status === "signed_in" ? auth.user : null;
  return (
    <UserProvider user={user}>
      <StoreProvider key={user?.id ?? "local"} userId={user?.id ?? null}>
        {children}
      </StoreProvider>
    </UserProvider>
  );
}

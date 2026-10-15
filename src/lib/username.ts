/**
 * Accounts are Supabase Auth users. People log in with a username; under the hood that is the
 * address "<username>@training-app.local" (never mailed – it only has to be unique).
 */
export const USERNAME_DOMAIN = "training-app.local";

export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${USERNAME_DOMAIN}`;
}

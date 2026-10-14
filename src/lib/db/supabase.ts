import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDirty, getMeta, getOne, markClean, putLocal, setMeta } from "./local";
import { SETTINGS_ID, TABLES, type BaseRecord, type SettingsRec, type TableName } from "./records";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey, { auth: { persistSession: true } });
  return client;
}

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRow(rec: BaseRecord, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  for (const [k, v] of Object.entries(rec)) row[toSnake(k)] = v;
  return row;
}

export function fromRow(row: Record<string, unknown>): BaseRecord {
  const rec: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (k !== "user_id") rec[toCamel(k)] = v;
  return rec as unknown as BaseRecord;
}

export type SyncResult = { pushed: number; pulled: number } | { error: string };

/**
 * Push local dirty records (idempotent upsert by id), then pull anything newer from
 * other devices. Last write (updatedAt) wins; nothing is ever hard-deleted.
 */
export async function sync(): Promise<SyncResult> {
  const sb = supabase();
  if (!sb) return { error: "Supabase är inte konfigurerat" };
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Inte inloggad" };

  let pushed = 0;
  let pulled = 0;

  // First sync on this device: settings already in the cloud win over a fresh local onboarding,
  // so logging in on a new phone never overwrites rehab phase, swaps or deload weeks.
  const firstKey = `firstSyncDone:${userId}`;
  const firstSync = !(await getMeta<boolean>(firstKey));
  if (firstSync) {
    const { data, error } = await sb.from("settings").select("*").eq("id", SETTINGS_ID).maybeSingle();
    if (error) return { error: `settings: ${error.message}` };
    if (data && (data as { onboarded?: boolean }).onboarded) {
      await putLocal("settings", fromRow(data) as SettingsRec, false);
      pulled++;
    }
  }

  for (const t of TABLES) {
    const dirty = await getDirty(t);
    if (dirty.length) {
      const { error } = await sb.from(t).upsert(dirty.map((r) => toRow(r, userId)), { onConflict: "user_id,id" });
      if (error) return { error: `${t}: ${error.message}` };
      await markClean(t, dirty);
      pushed += dirty.length;
    }
  }
  for (const t of TABLES) {
    const key = `pulledAt:${t}`;
    const since = (await getMeta<string>(key)) ?? "1970-01-01T00:00:00Z";
    const { data, error } = await sb.from(t).select("*").gt("updated_at", since).order("updated_at");
    if (error) return { error: `${t}: ${error.message}` };
    let max = since;
    for (const row of data ?? []) {
      const rec = fromRow(row);
      await mergeRemote(t, rec);
      if (rec.updatedAt > max) max = rec.updatedAt;
      pulled++;
    }
    await setMeta(key, max);
  }
  if (firstSync) await setMeta(firstKey, true);
  return { pushed, pulled };
}

async function mergeRemote(table: TableName, rec: BaseRecord) {
  const local = await getOne(table, rec.id);
  if (!local || local.updatedAt < rec.updatedAt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await putLocal(table, rec as any, false);
  }
}

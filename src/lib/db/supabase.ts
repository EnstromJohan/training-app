import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAll, getBlob, getDirty, getMeta, getOne, markClean, putLocal, setMeta } from "./local";
import { SETTINGS_ID, TABLES, type BaseRecord, type ProgressPhotoRec, type SettingsRec, type TableName } from "./records";

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

export type SyncResult = { pushed: number; pulled: number; warning?: string } | { error: string };

/** PostgREST / Postgres codes for "table does not exist" (migration not run yet). */
const isMissingTable = (e: { code?: string; message?: string }) =>
  e.code === "PGRST205" || e.code === "42P01" || /could not find the table|does not exist/i.test(e.message ?? "");

/**
 * Push local dirty records (idempotent upsert by id), then pull anything newer from
 * other devices. Last write (updatedAt) wins; nothing is ever hard-deleted.
 */
export async function sync(expectedUserId: string): Promise<SyncResult> {
  const sb = supabase();
  if (!sb) return { error: "Supabase är inte konfigurerat" };
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Inte inloggad" };
  // The local database belongs to one account: never push it into another one.
  if (userId !== expectedUserId) return { error: "Inloggad som en annan användare" };

  let pushed = 0;
  let pulled = 0;
  const missing = new Set<string>();
  const missingColumns = new Set<string>();

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

  // Progress photos: upload new images, remove deleted ones from the private bucket.
  pulled += await syncPhotoFiles(sb, userId);

  for (const t of TABLES) {
    const dirty = await getDirty(t);
    if (dirty.length) {
      const { error, dropped } = await upsertTolerant(sb, t, dirty.map((r) => toRow(r, userId)), missingColumns);
      if (error && isMissingTable(error)) {
        missing.add(t); // stays dirty locally and is pushed once the migration has been run
        continue;
      }
      if (error) return { error: `${t}: ${error.message}` };
      // Records sent without some columns stay dirty, so they go up in full once the migration has run.
      if (!dropped) await markClean(t, dirty);
      pushed += dirty.length;
    }
  }
  for (const t of TABLES) {
    const key = `pulledAt:${t}`;
    const since = (await getMeta<string>(key)) ?? "1970-01-01T00:00:00Z";
    if (missing.has(t)) continue;
    const { data, error } = await sb.from(t).select("*").gt("updated_at", since).order("updated_at");
    if (error && isMissingTable(error)) {
      missing.add(t);
      continue;
    }
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
  const warning =
    missing.size || missingColumns.size
      ? `Databasen saknar ${[...missing, ...missingColumns].join(", ")} – kör den senaste migrationen i Supabase. Datan ligger kvar på enheten.`
      : undefined;
  return { pushed, pulled, warning };
}

async function mergeRemote(table: TableName, rec: BaseRecord) {
  const local = await getOne(table, rec.id);
  if (!local || local.updatedAt < rec.updatedAt) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await putLocal(table, rec as any, false);
  }
}

/**
 * Upsert that survives a newer client talking to an older schema: a column the database doesn't
 * have yet (migration not run) is dropped from the rows and the upsert retried, so the rest still
 * syncs. The value stays in the local record and is pushed in full once the migration has run.
 */
export async function upsertTolerant(sb: SupabaseClient, table: string, rows: Record<string, unknown>[], missingColumns: Set<string>) {
  let current = rows;
  let dropped = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { error } = await sb.from(table).upsert(current, { onConflict: "user_id,id" });
    const col = error && error.code === "PGRST204" ? /'([^']+)' column/.exec(error.message)?.[1] : undefined;
    if (!col || !current.some((r) => col in r)) return { error, dropped };
    missingColumns.add(`${table}.${col}`);
    current = current.map((r) => {
      const copy = { ...r };
      delete copy[col];
      return copy;
    });
    dropped = true;
  }
  return { error: { message: `${table}: för många saknade kolumner`, code: "client" }, dropped };
}

export const PHOTO_BUCKET = "progress-photos";

/** Uploads pending photo files and deletes removed ones. Returns how many records changed. */
async function syncPhotoFiles(sb: SupabaseClient, userId: string): Promise<number> {
  let changed = 0;
  for (const photo of await getAll("progress_photos")) {
    if (photo.deletedAt && photo.storagePath) {
      const { error } = await sb.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
      if (!error) {
        await putLocal("progress_photos", { ...photo, storagePath: null, updatedAt: new Date().toISOString() });
        changed++;
      }
    } else if (!photo.deletedAt && !photo.storagePath) {
      const blob = await getBlob(photo.id);
      if (!blob) continue; // created on another device; its file is uploaded there
      const path = `${userId}/${photo.id}.jpg`;
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (!error) {
        await putLocal("progress_photos", { ...photo, storagePath: path, updatedAt: new Date().toISOString() } as ProgressPhotoRec);
        changed++;
      }
    }
  }
  return changed;
}

/** Short-lived URL for a photo stored in the cloud (used on devices without the local copy). */
export async function photoUrl(path: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

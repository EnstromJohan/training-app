import { openDB, type IDBPDatabase } from "idb";
import { TABLES, type BaseRecord, type TableName, type Tables } from "./records";

function strip<T>(row: Stored<T>): T {
  const copy = { ...row };
  delete copy._dirty;
  return copy as T;
}

/**
 * Local-first store in IndexedDB. Every write is kept on the device immediately and
 * marked dirty until the sync layer has pushed it to Supabase.
 *
 * Each logged-in user gets their own database ("training-app:<userId>"), so two accounts on the
 * same device never see – or sync – each other's history. Without Supabase the app runs in
 * local-only mode on the original "training-app" database.
 */
const LEGACY_DB = "training-app";
const VERSION = 2;
const BLOBS = "photo_blobs";
const META = "meta";

export type Stored<T> = T & { _dirty?: number };

let dbName = LEGACY_DB;
let dbPromise: Promise<IDBPDatabase> | null = null;

/** Fired when an open tab running an older version blocks a schema upgrade. */
export const DB_BLOCKED_EVENT = "training-db-blocked";

function upgrade(d: IDBPDatabase) {
  for (const t of TABLES) {
    if (!d.objectStoreNames.contains(t)) {
      const store = d.createObjectStore(t, { keyPath: "id" });
      store.createIndex("_dirty", "_dirty");
    }
  }
  if (!d.objectStoreNames.contains(META)) d.createObjectStore(META);
  if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS);
}

function db() {
  if (!dbPromise) {
    dbPromise = openDB(dbName, VERSION, {
      // Another tab still has the previous version open: tell the UI instead of hanging silently.
      // The upgrade continues by itself as soon as that tab closes or reloads.
      blocked() {
        window.dispatchEvent(new Event(DB_BLOCKED_EVENT));
      },
      // This tab is the old one: let the newer version upgrade, then reload into the new code.
      blocking() {
        void dbPromise?.then((d) => d.close());
        dbPromise = null;
        window.location.reload();
      },
      terminated() {
        dbPromise = null;
      },
      upgrade,
    });
  }
  return dbPromise;
}

/** Point all reads and writes at this user's database (null = local-only mode). */
export function selectDatabase(userId: string | null) {
  const name = userId ? `${LEGACY_DB}:${userId}` : LEGACY_DB;
  if (name === dbName) return;
  void dbPromise?.then((d) => d.close());
  dbPromise = null;
  dbName = name;
}

/**
 * History logged before accounts existed lives in the shared local-only database. The first account
 * that logs in on this device (with an empty database of its own) takes it over once: everything is
 * copied in as unsynced, so it is uploaded to that account, and the old database is marked as claimed.
 */
export async function adoptLegacyData(userId: string): Promise<number> {
  if (dbName === LEGACY_DB) return 0;
  // Don't create the old database just to find it empty.
  if (typeof indexedDB.databases === "function") {
    const names = (await indexedDB.databases()).map((x) => x.name);
    if (!names.includes(LEGACY_DB)) return 0;
  }
  const target = await db();
  if ((await target.count("settings")) > 0) return 0;
  const legacy = await openDB(LEGACY_DB, VERSION, {
    upgrade,
    blocking() {
      void legacy.close();
    },
  });
  try {
    if (await legacy.get(META, "claimedBy")) return 0;
    let n = 0;
    for (const t of TABLES) {
      const rows = (await legacy.getAll(t)) as BaseRecord[];
      if (!rows.length) continue;
      const tx = target.transaction(t, "readwrite");
      for (const r of rows) void tx.store.put({ ...r, _dirty: 1 });
      await tx.done;
      n += rows.length;
    }
    const blobKeys = await legacy.getAllKeys(BLOBS);
    for (const k of blobKeys) {
      const blob = await legacy.get(BLOBS, k);
      if (blob) await target.put(BLOBS, blob, k);
    }
    await legacy.put(META, userId, "claimedBy");
    return n;
  } finally {
    legacy.close();
  }
}

export async function getAll<T extends TableName>(table: T): Promise<Tables[T][]> {
  const rows = (await (await db()).getAll(table)) as Stored<Tables[T]>[];
  return rows.map((r) => strip(r));
}

export async function getOne<T extends TableName>(table: T, id: string): Promise<Tables[T] | undefined> {
  const row = (await (await db()).get(table, id)) as Stored<Tables[T]> | undefined;
  if (!row) return undefined;
  return strip(row);
}

export async function putLocal<T extends TableName>(table: T, rec: Tables[T], dirty = true): Promise<void> {
  await (await db()).put(table, { ...rec, _dirty: dirty ? 1 : 0 });
}

export async function getDirty<T extends TableName>(table: T): Promise<Tables[T][]> {
  const rows = (await (await db()).getAllFromIndex(table, "_dirty", 1)) as Stored<Tables[T]>[];
  return rows.map((r) => strip(r));
}

export async function markClean<T extends TableName>(table: T, recs: Tables[T][]): Promise<void> {
  const tx = (await db()).transaction(table, "readwrite");
  for (const r of recs) {
    const cur = (await tx.store.get(r.id)) as (BaseRecord & { _dirty?: number }) | undefined;
    // Only clean if not modified again since the push started.
    if (cur && cur.updatedAt === r.updatedAt) await tx.store.put({ ...cur, _dirty: 0 });
  }
  await tx.done;
}

/** Progress-photo image data (kept out of the synced tables). */
export async function putBlob(id: string, blob: Blob): Promise<void> {
  await (await db()).put(BLOBS, blob, id);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return (await db()).get(BLOBS, id);
}

export async function deleteBlob(id: string): Promise<void> {
  await (await db()).delete(BLOBS, id);
}

export async function getMeta<V>(key: string): Promise<V | undefined> {
  return (await db()).get(META, key);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put(META, value, key);
}

export async function exportAll(): Promise<Record<TableName, unknown[]>> {
  const out = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) out[t] = await getAll(t);
  return out;
}

/** Import merges by id; newer updatedAt wins. Never deletes anything. */
export async function importAll(data: Partial<Record<TableName, BaseRecord[]>>): Promise<number> {
  let n = 0;
  const d = await db();
  for (const t of TABLES) {
    for (const rec of data[t] ?? []) {
      const cur = (await d.get(t, rec.id)) as BaseRecord | undefined;
      if (!cur || cur.updatedAt < rec.updatedAt) {
        await d.put(t, { ...rec, _dirty: 1 });
        n++;
      }
    }
  }
  return n;
}

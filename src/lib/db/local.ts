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
 */
const DB_NAME = "training-app";
const VERSION = 2;
const BLOBS = "photo_blobs";
const META = "meta";

export type Stored<T> = T & { _dirty?: number };

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(d) {
        for (const t of TABLES) {
          if (!d.objectStoreNames.contains(t)) {
            const store = d.createObjectStore(t, { keyPath: "id" });
            store.createIndex("_dirty", "_dirty");
          }
        }
        if (!d.objectStoreNames.contains(META)) d.createObjectStore(META);
        if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS);
      },
    });
  }
  return dbPromise;
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

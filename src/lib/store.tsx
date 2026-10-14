"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_EQUIPMENT, type Readiness } from "./engine/types";
import { toIso } from "./engine/weekly/dates";
import { exportAll, getAll, importAll, putLocal } from "./db/local";
import { supabase, sync } from "./db/supabase";
import {
  SETTINGS_ID,
  type BaseRecord,
  type CalibrationRec,
  type CardioSessionRec,
  type RehabLogRec,
  type SessionExerciseRec,
  type SetLogRec,
  type SettingsRec,
  type TableName,
  type Tables,
  type WorkoutSessionRec,
} from "./db/records";
import { prescribeDay, prescribeFor, rehabPlan, type Snapshot } from "./coach";
import { EXERCISES } from "./program/exercises";
import { PROGRAM_BY_ID } from "./program/program";

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
export const today = () => toIso(new Date());

function defaultSettings(): SettingsRec {
  const t = now();
  return {
    id: SETTINGS_ID,
    createdAt: t,
    updatedAt: t,
    onboarded: false,
    name: "",
    birthYear: null,
    bodyWeightKg: null,
    restingHr: null,
    maxHr: null,
    experience: "intermediate",
    goal: "hypertrophy",
    equipment: { ...DEFAULT_EQUIPMENT },
    rehab: { phase: 1, phaseStartedAt: toIso(new Date()), baselineMorningPain: 2, runningCleared: false, approvedPhases: [1] },
    substitutions: {},
    volumeModifiers: {},
    deloadWeeks: [],
    cardioPreferred: {},
  };
}

const KEY: Record<TableName, keyof Snapshot> = {
  workout_sessions: "sessions",
  session_exercises: "sessionExercises",
  set_logs: "sets",
  cardio_sessions: "cardio",
  rehab_logs: "rehab",
  calibrations: "calibrations",
  settings: "settings",
};

export type SyncState = "off" | "idle" | "syncing" | "error" | "signed_out";

interface Store {
  s: Snapshot;
  syncState: SyncState;
  syncMessage: string | null;
  updateSettings(patch: Partial<SettingsRec>): Promise<void>;
  startSession(programDayId: string, date: string, readiness: Readiness | null): Promise<string>;
  logSet(input: Omit<SetLogRec, keyof BaseRecord | "completedAt"> & { id?: string }): Promise<void>;
  removeSet(id: string): Promise<void>;
  substitute(sessionExerciseId: string, exerciseId: string, permanent: boolean): Promise<void>;
  saveCalibration(exerciseId: string, weight: number, reps: number, rir: number): Promise<void>;
  finishSession(sessionId: string, sessionRpe: number | null, rehabPainDuring: number | null): Promise<void>;
  discardSession(sessionId: string): Promise<void>;
  skipDay(programDayId: string, date: string): Promise<void>;
  logCardio(rec: Omit<CardioSessionRec, keyof BaseRecord>): Promise<void>;
  logRehab(painDuring: number): Promise<void>;
  setMorningPain(rehabLogId: string, pain: number): Promise<void>;
  exportJson(): Promise<string>;
  importJson(json: string): Promise<number>;
  syncNow(): Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore utanför StoreProvider");
  return v;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Snapshot | null>(null);
  const ref = useRef<Snapshot | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(supabase() ? "idle" : "off");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const load = useCallback(async () => {
    const [settings, sessions, sessionExercises, sets, cardio, rehab, calibrations] = await Promise.all([
      getAll("settings"),
      getAll("workout_sessions"),
      getAll("session_exercises"),
      getAll("set_logs"),
      getAll("cardio_sessions"),
      getAll("rehab_logs"),
      getAll("calibrations"),
    ]);
    const snap: Snapshot = {
      settings: settings.find((x) => x.id === SETTINGS_ID) ?? defaultSettings(),
      sessions,
      sessionExercises,
      sets,
      cardio,
      rehab,
      calibrations,
    };
    ref.current = snap;
    setS(snap);
  }, []);

  const runSync = useCallback(async () => {
    if (!supabase()) return;
    // Never run two syncs at once; coalesce requests that arrive meanwhile into one more run.
    if (syncing.current) {
      syncAgain.current = true;
      return;
    }
    syncing.current = true;
    try {
      do {
        syncAgain.current = false;
        setSyncState("syncing");
        const r = await sync();
        if ("error" in r) {
          setSyncState(r.error === "Inte inloggad" ? "signed_out" : "error");
          setSyncMessage(r.error);
          break;
        }
        setSyncState("idle");
        setSyncMessage(null);
        if (r.pulled) await load();
      } while (syncAgain.current);
    } catch (e) {
      setSyncState("error");
      setSyncMessage(e instanceof Error ? e.message : "Okänt synkfel");
    } finally {
      syncing.current = false;
    }
  }, [load]);

  const scheduleSync = useCallback(() => {
    if (!supabase()) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(runSync, 1500);
  }, [runSync]);

  useEffect(() => {
    load()
      .then(() => {
        // Ask the browser not to evict our data (Safari otherwise may after a period of non-use).
        navigator.storage?.persist?.().catch(() => {});
        return runSync();
      })
      .catch((e) => setFatal(e instanceof Error ? e.message : String(e)));
    const online = () => runSync();
    window.addEventListener("online", online);
    const sub = supabase()?.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") runSync();
    });
    return () => {
      window.removeEventListener("online", online);
      sub?.data.subscription.unsubscribe();
    };
  }, [load, runSync]);

  /** Write locally first (never lost), update memory, then sync in the background. */
  const put = useCallback(
    async <T extends TableName>(table: T, rec: Tables[T]) => {
      try {
        await putLocal(table, rec);
      } catch (e) {
        setToast("Kunde inte spara på enheten. Kontrollera lagringsutrymmet och försök igen.");
        throw e;
      }
      const cur = ref.current!;
      const key = KEY[table];
      let next: Snapshot;
      if (key === "settings") next = { ...cur, settings: rec as SettingsRec };
      else {
        const list = cur[key] as unknown as BaseRecord[];
        const idx = list.findIndex((x) => x.id === rec.id);
        const copy = idx === -1 ? [...list, rec] : list.map((x, i) => (i === idx ? rec : x));
        next = { ...cur, [key]: copy };
      }
      ref.current = next;
      setS(next);
      scheduleSync();
    },
    [scheduleSync],
  );

  const store = useMemo<Store | null>(() => {
    if (!s) return null;
    const cur = () => ref.current!;
    const stamp = <T extends object>(rec: T, existing?: BaseRecord) =>
      ({ ...rec, id: existing?.id ?? uuid(), createdAt: existing?.createdAt ?? now(), updatedAt: now() }) as T & BaseRecord;

    const logRehab = async (painDuring: number) => {
      // One rehab session per day: a second log the same day updates the first (keeps the worst pain).
      const existing = cur().rehab.find((r) => r.date === today() && !r.deletedAt);
      if (existing) {
        await put("rehab_logs", { ...existing, painDuring: Math.max(existing.painDuring, painDuring), updatedAt: now() });
        return;
      }
      const plan = rehabPlan(cur());
      await put(
        "rehab_logs",
        stamp({ date: today(), phase: plan.phase.phase, level: plan.level, completed: true, painDuring, painNextMorning: null }) as RehabLogRec,
      );
    };

    return {
      s,
      syncState,
      syncMessage,

      async updateSettings(patch) {
        await put("settings", { ...cur().settings, ...patch, updatedAt: now() });
      },

      async startSession(programDayId, date, readiness) {
        const snap = cur();
        const day = PROGRAM_BY_ID[programDayId];
        const session = stamp<Omit<WorkoutSessionRec, keyof BaseRecord>>({
          date,
          programDayId,
          status: "in_progress",
          readiness,
          sessionRpe: null,
          deload: false,
          startedAt: now(),
          completedAt: null,
          notes: null,
        }) as WorkoutSessionRec;
        const items = prescribeDay(snap, day, date, readiness);
        session.deload = items.some((x) => x.prescription.reason.code === "deload");
        await put("workout_sessions", session);
        let position = 0;
        for (const { slot, exercise, prescription } of items) {
          await put(
            "session_exercises",
            stamp({
              sessionId: session.id,
              exerciseId: exercise.id,
              slotExerciseId: slot.exerciseId,
              position: position++,
              prescription,
            }) as SessionExerciseRec,
          );
        }
        return session.id;
      },

      async logSet(input) {
        const existing = input.id
          ? cur().sets.find((x) => x.id === input.id)
          : cur().sets.find(
              (x) => !x.deletedAt && x.sessionExerciseId === input.sessionExerciseId && x.setIndex === input.setIndex && x.kind === input.kind,
            );
        const rest = { ...input };
        delete rest.id;
        await put("set_logs", { ...stamp(rest, existing), completedAt: now(), deletedAt: null } as SetLogRec);
      },

      async removeSet(id) {
        const rec = cur().sets.find((x) => x.id === id);
        if (rec) await put("set_logs", { ...rec, deletedAt: now(), updatedAt: now() });
      },

      async substitute(sessionExerciseId, exerciseId, permanent) {
        const snap = cur();
        const se = snap.sessionExercises.find((x) => x.id === sessionExerciseId);
        if (!se) return;
        const session = snap.sessions.find((x) => x.id === se.sessionId)!;
        const slot = PROGRAM_BY_ID[session.programDayId].exercises.find((x) => x.exerciseId === se.slotExerciseId)!;
        const prescription = prescribeFor(snap, slot, { exercise: EXERCISES[exerciseId], readiness: session.readiness, date: session.date });
        // Drop sets logged for the old exercise in this slot.
        for (const set of snap.sets.filter((x) => x.sessionExerciseId === se.id && !x.deletedAt)) {
          await put("set_logs", { ...set, deletedAt: now(), updatedAt: now() });
        }
        await put("session_exercises", { ...se, exerciseId, prescription, updatedAt: now() });
        if (permanent) {
          const subs = { ...cur().settings.substitutions };
          if (exerciseId === se.slotExerciseId) delete subs[se.slotExerciseId];
          else subs[se.slotExerciseId] = exerciseId;
          await put("settings", { ...cur().settings, substitutions: subs, updatedAt: now() });
        }
      },

      async saveCalibration(exerciseId, weight, reps, rir) {
        await put("calibrations", stamp({ exerciseId, date: today(), weight, reps, rir }) as CalibrationRec);
        // Refresh prescriptions for not-yet-started exercises in the active session.
        const snap = cur();
        for (const se of snap.sessionExercises.filter((x) => x.exerciseId === exerciseId && !x.deletedAt)) {
          const session = snap.sessions.find((x) => x.id === se.sessionId);
          if (!session || session.status !== "in_progress") continue;
          const slot = PROGRAM_BY_ID[session.programDayId].exercises.find((x) => x.exerciseId === se.slotExerciseId);
          if (!slot) continue;
          const prescription = prescribeFor(snap, slot, { exercise: EXERCISES[exerciseId], readiness: session.readiness, date: session.date });
          await put("session_exercises", { ...se, prescription, updatedAt: now() });
        }
      },

      async finishSession(sessionId, sessionRpe, rehabPainDuring) {
        const session = cur().sessions.find((x) => x.id === sessionId);
        if (!session) return;
        await put("workout_sessions", { ...session, status: "completed", sessionRpe, completedAt: now(), updatedAt: now() });
        if (rehabPainDuring != null) await logRehab(rehabPainDuring);
      },

      async discardSession(sessionId) {
        const session = cur().sessions.find((x) => x.id === sessionId);
        if (session) await put("workout_sessions", { ...session, deletedAt: now(), updatedAt: now() });
      },

      async skipDay(programDayId, date) {
        await put(
          "workout_sessions",
          stamp({
            date,
            programDayId,
            status: "skipped",
            readiness: null,
            sessionRpe: null,
            deload: false,
            startedAt: now(),
            completedAt: null,
            notes: null,
          }) as WorkoutSessionRec,
        );
      },

      async logCardio(rec) {
        await put("cardio_sessions", stamp(rec) as CardioSessionRec);
      },

      logRehab,

      async setMorningPain(id, pain) {
        const rec = cur().rehab.find((x) => x.id === id);
        if (rec) await put("rehab_logs", { ...rec, painNextMorning: pain, updatedAt: now() });
      },

      async exportJson() {
        return JSON.stringify({ exportedAt: now(), version: 1, data: await exportAll() }, null, 2);
      },

      async importJson(json) {
        const parsed = JSON.parse(json);
        const n = await importAll(parsed.data ?? parsed);
        await load();
        scheduleSync();
        return n;
      },

      async syncNow() {
        await runSync();
      },
    };
  }, [s, syncState, syncMessage, put, load, runSync, scheduleSync]);

  if (fatal) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-[20px] font-semibold">Lagringen är inte tillgänglig</h1>
        <p className="text-[14px] text-ink-2">
          Appen sparar din träning på enheten, men webbläsaren tillåter det inte just nu. Det händer oftast i privat läge eller om webbplatsdata är blockerad.
        </p>
        <p className="text-[12px] text-muted">{fatal}</p>
        <button onClick={() => location.reload()} className="mt-2 h-11 rounded-full bg-ink px-6 text-[14px] font-medium text-white">
          Försök igen
        </button>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Laddar">
        <span className="size-6 animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none" />
      </div>
    );
  }
  return (
    <Ctx.Provider value={store}>
      {children}
      {toast && (
        <div role="alert" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-[16px] bg-ink px-4 py-3 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}

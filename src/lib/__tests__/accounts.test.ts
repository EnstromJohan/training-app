import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { usernameToEmail } from "../username";
import { adoptLegacyData, getAll, getBlob, getDirty, putBlob, putLocal, selectDatabase } from "../db/local";
import { SETTINGS_ID, type BodyMeasurementRec, type SettingsRec } from "../db/records";

const t = "2026-10-01T10:00:00.000Z";
const settings = { id: SETTINGS_ID, createdAt: t, updatedAt: t, onboarded: true, name: "Johan" } as SettingsRec;
const body = (id: string) => ({ id, createdAt: t, updatedAt: t, date: "2026-10-01", weightKg: 82 }) as BodyMeasurementRec;

describe("usernameToEmail", () => {
  it("maps a username to the internal address, case- and space-insensitive", () => {
    expect(usernameToEmail(" Enstrom ")).toBe("enstrom@training-app.local");
  });
  it("leaves a real e-mail address alone", () => {
    expect(usernameToEmail("Johan@Example.se")).toBe("johan@example.se");
  });
});

describe("per-account local databases", () => {
  it("keeps each account's data apart and hands pre-account data to the first account once", async () => {
    // Data logged before accounts existed (local-only database).
    selectDatabase(null);
    await putLocal("settings", settings, false);
    await putLocal("body_measurements", body("b1"), false);
    await putBlob("p1", new Blob(["jpeg"]));

    // First account takes it over, unsynced, so it is uploaded to that account.
    selectDatabase("user-a");
    expect(await adoptLegacyData("user-a")).toBe(2);
    expect((await getAll("body_measurements")).map((x) => x.id)).toEqual(["b1"]);
    expect((await getDirty("body_measurements")).length).toBe(1);
    expect(await getBlob("p1")).toBeDefined();
    await putLocal("body_measurements", body("a-only"));

    // A second account on the same device starts empty and gets nothing of the above.
    selectDatabase("user-b");
    expect(await adoptLegacyData("user-b")).toBe(0);
    expect(await getAll("body_measurements")).toEqual([]);
    expect(await getAll("settings")).toEqual([]);

    // Back to the first account: its data is still there.
    selectDatabase("user-a");
    expect((await getAll("body_measurements")).map((x) => x.id).sort()).toEqual(["a-only", "b1"]);
  });
});

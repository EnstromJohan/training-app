import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// npm on macOS sometimes drops other platforms' native packages from the lockfile, which makes
// `npm ci` on the Linux build machine (Cloudflare) fail with "not in sync". Fix: delete
// node_modules and package-lock.json, then `npm install`.
describe("package-lock.json", () => {
  const lock = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../../package-lock.json"), "utf8"));
  it.each(["@rolldown/binding-linux-x64-gnu", "lightningcss-linux-x64-gnu", "@next/swc-linux-x64-gnu", "@img/sharp-linux-x64"])(
    "includes the Linux build of %s",
    (name) => {
      expect(lock.packages[`node_modules/${name}`]).toBeDefined();
    },
  );
});

#!/usr/bin/env node
// Runs after `next build`: writes public/sw.js with this build's id and every pre-rendered route.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const buildId = fs.readFileSync(path.join(ROOT, ".next/BUILD_ID"), "utf8").trim();
const prerender = JSON.parse(fs.readFileSync(path.join(ROOT, ".next/prerender-manifest.json"), "utf8"));
const routes = Object.keys(prerender.routes)
  .filter((r) => !r.startsWith("/_") && !r.includes("["))
  .sort();
if (!routes.includes("/")) throw new Error("build-sw: '/' saknas bland förrenderade sidor – avbryter.");

const template = fs.readFileSync(path.join(ROOT, "scripts/sw.template.js"), "utf8");
const out = template.replace("__VERSION__", buildId).replace("__ROUTES__", JSON.stringify(routes));
if (out.includes("__VERSION__") || out.includes("__ROUTES__")) throw new Error("build-sw: platshållare kvar i sw.js");
fs.writeFileSync(path.join(ROOT, "public/sw.js"), out);
console.log(`sw.js: version ${buildId}, ${routes.length} sidor förcachas`);

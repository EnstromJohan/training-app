#!/usr/bin/env node
// Generates PWA / iOS icons from one full-bleed artwork. Run: npm run icons
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/icons");
fs.mkdirSync(OUT, { recursive: true });

// Full-bleed artwork (no rounded corners – iOS/Android apply their own mask).
// `pad` shrinks the motif into the maskable safe zone (inner 80 %).
const art = (pad = 0) => {
  const s = 512;
  const k = 1 - pad * 2;
  const t = (v) => (s * pad + v * k).toFixed(1);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2724"/><stop offset="1" stop-color="#141312"/></linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7b386"/><stop offset="1" stop-color="#e58a54"/></linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  ${[
    [118, 300, 0.35],
    [196, 248, 0.55],
    [274, 186, 0.78],
    [352, 112, 1],
  ]
    .map(([x, y, o]) => `<rect x="${t(x)}" y="${t(y)}" width="${(54 * k).toFixed(1)}" height="${(400 - y) * k}" rx="${(14 * k).toFixed(1)}" fill="url(#m)" opacity="${o}"/>`)
    .join("")}
</svg>`);
};

const jobs = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["maskable-512.png", 512, 0.1],
  ["apple-touch-icon.png", 180, 0.04],
];
for (const [name, size, pad] of jobs) {
  await sharp(art(pad)).resize(size, size).flatten({ background: "#141312" }).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  console.log(`✓ icons/${name}`);
}
// Rounded variant for the browser tab.
const rounded = Buffer.from(
  art(0).toString().replace('<rect width="512" height="512" fill="url(#bg)"/>', '<rect width="512" height="512" rx="112" fill="url(#bg)"/>'),
);
fs.writeFileSync(path.join(ROOT, "public/icon.svg"), rounded);
console.log("✓ icon.svg");

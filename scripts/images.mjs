#!/usr/bin/env node
// Image pipeline: assets/images/** → public/images/opt/** (AVIF + WebP, several widths)
// and src/lib/images/manifest.json (sizes + blur placeholders).
//
//   npm run images            build everything
//   npm run images -- --check list which slots have / lack a source image
//
// Rules (fail loudly rather than ship something wrong):
// - Unknown source files (typos, removed exercises) are an error.
// - Images are never upscaled; widths larger than the source are skipped.
// - EXIF orientation is applied, all metadata (incl. GPS) is stripped.
// - Output is rebuilt from scratch every run, so removed sources disappear.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
// Overridable for tests; defaults are the real locations.
const SRC_DIR = process.env.IMAGES_SRC ?? path.join(ROOT, "assets/images");
const OUT_DIR = process.env.IMAGES_OUT ?? path.join(ROOT, "public/images/opt");
const MANIFEST = process.env.IMAGES_MANIFEST ?? path.join(ROOT, "src/lib/images/manifest.json");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/images/slots.json"), "utf8"));
const EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".heif", ".tif", ".tiff"];
const checkOnly = process.argv.includes("--check");

/** Every slot the app can show, including one per exercise / rehab exercise. */
function allSlots() {
  const slots = [...CONFIG.slots];
  for (const fam of CONFIG.families) {
    const files = Array.isArray(fam.idSource) ? fam.idSource : [fam.idSource];
    const ids = new Set();
    for (const f of files) {
      const text = fs.readFileSync(path.join(ROOT, f), "utf8");
      for (const m of text.matchAll(new RegExp(fam.idPattern, "g"))) ids.add(m[1]);
    }
    if (ids.size === 0) throw new Error(`Inga id:n hittades för ${fam.prefix} i ${files.join(", ")}`);
    for (const id of [...ids].sort()) {
      slots.push({ key: `${fam.prefix}/${id}`, source: `${fam.dir}/${id}`, label: `${fam.label}: ${id}`, guide: fam.guide, crops: fam.crops, grade: fam.grade });
    }
  }
  return slots;
}

/** Map of source name (without extension, relative to assets/images) → absolute file path. */
function findSources() {
  const out = new Map();
  if (!fs.existsSync(SRC_DIR)) return out;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (EXTS.includes(path.extname(entry.name).toLowerCase())) {
        const rel = path.relative(SRC_DIR, abs).replace(/\\/g, "/");
        const name = rel.slice(0, -path.extname(rel).length);
        if (out.has(name)) throw new Error(`Två källfiler för samma bild: ${name} (${path.basename(out.get(name))} och ${entry.name})`);
        out.set(name, abs);
      }
    }
  };
  walk(SRC_DIR);
  return out;
}

async function blurDataUri(input, aspect, position) {
  const w = 24;
  const buf = await sharp(input).resize(w, Math.round(w / aspect), { fit: "cover", position }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}

/**
 * Dark-theme grade: per-channel x² (darkens the bright backdrop far more than mid-tones and
 * keeps tone order – no solarising), scaled by `gain`, then an optional warm tint (B&W images only).
 */
async function applyGrade(file, grade) {
  const rgb = await sharp(file).rotate().removeAlpha().png().toBuffer();
  if (!grade) return rgb;
  const sq = await sharp(rgb).composite([{ input: rgb, blend: "multiply" }]).linear(grade.gain, 0).png().toBuffer();
  // tint() makes a duotone – right for the B&W studio shots, wrong for colour photos.
  if (!grade.tint) return sq;
  const [r, g, b] = grade.tint;
  return sharp(sq).tint({ r, g, b }).png().toBuffer();
}

function vignetteSvg(w, h, strength) {
  return Buffer.from(
    `<svg width="${w}" height="${h}"><defs><radialGradient id="v" cx="0.5" cy="0.48" r="0.72"><stop offset="0.38" stop-color="#0b0b0b" stop-opacity="0"/><stop offset="1" stop-color="#0b0b0b" stop-opacity="${strength}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`,
  );
}

async function main() {
  const slots = allSlots();
  const sources = findSources();
  const known = new Set(slots.map((s) => s.source));
  const unknown = [...sources.keys()].filter((k) => !known.has(k));
  if (unknown.length) {
    console.error("✗ Okända källfiler (stavfel eller borttagen övning?):");
    for (const u of unknown) console.error(`   assets/images/${u}`);
    console.error("  Giltiga namn: npm run images -- --check");
    process.exit(1);
  }

  if (checkOnly) {
    for (const s of slots) console.log(`${sources.has(s.source) ? "✓" : "·"} assets/images/${s.source}.jpg  – ${s.label}`);
    console.log(`\n${[...sources.keys()].length} av ${slots.length} bilder finns.`);
    return;
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {};
  let files = 0;

  for (const slot of slots) {
    const file = sources.get(slot.source);
    if (!file) continue;
    const meta = await sharp(file).rotate().metadata();
    // metadata() reports pre-rotation size; swap for 90°/270° EXIF orientations.
    const rotated = (meta.orientation ?? 1) >= 5;
    const srcW = rotated ? meta.height : meta.width;
    const srcH = rotated ? meta.width : meta.height;
    const entry = { crops: {} };
    const bytes = fs.readFileSync(file);
    const grade = slot.grade ? CONFIG.grades[slot.grade] : null;
    if (slot.grade && !grade) throw new Error(`Okänd gradering "${slot.grade}" för ${slot.key}`);
    const graded = await applyGrade(file, grade);

    for (const crop of slot.crops) {
      // Largest crop that fits inside the source at this aspect ratio.
      const maxW = Math.floor(Math.min(srcW, srcH * crop.aspect));
      let widths = crop.widths.filter((w) => w <= maxW);
      if (widths.length === 0) {
        widths = [maxW];
        console.warn(`! ${slot.source}: källan är liten (${srcW}×${srcH}) – ${crop.name} blir bara ${maxW}px bred. Rekommenderat minst ${crop.widths.at(-1)}px.`);
      } else if (widths.length < crop.widths.length) {
        // Use the full source width as the top size rather than stopping at the previous step.
        if (maxW > widths.at(-1)) widths = [...widths, maxW];
        console.warn(`! ${slot.source}: mindre än rekommenderat (${crop.widths.at(-1)}px för ${crop.name}); största storlek blir ${widths.at(-1)}px.`);
      }
      const dir = path.join(OUT_DIR, slot.key);
      fs.mkdirSync(dir, { recursive: true });
      for (const w of widths) {
        const h = Math.round(w / crop.aspect);
        let base = sharp(graded).resize(w, h, { fit: "cover", position: crop.position ?? "attention" });
        if (grade?.vignette) base = sharp(await base.png().toBuffer()).composite([{ input: vignetteSvg(w, h, grade.vignette) }]);
        await base.clone().avif({ quality: 55, effort: 6 }).toFile(path.join(dir, `${crop.name}-${w}.avif`));
        await base.clone().webp({ quality: 80, effort: 6 }).toFile(path.join(dir, `${crop.name}-${w}.webp`));
        files += 2;
      }
      entry.crops[crop.name] = {
        aspect: crop.aspect,
        widths,
        blur: await blurDataUri(graded, crop.aspect, crop.position ?? "attention"),
        // Content version: changes when the source or crop settings change (images are cached immutably).
        v: crypto.createHash("sha1").update(bytes).update(JSON.stringify({ ...crop, widths, grade })).digest("hex").slice(0, 10),
      };
    }
    manifest[slot.key] = entry;
    console.log(`✓ ${slot.key}`);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n${Object.keys(manifest).length} bilder → ${files} filer i ${path.relative(ROOT, OUT_DIR)}. Manifest: ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

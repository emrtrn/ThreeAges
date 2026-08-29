#!/usr/bin/env node
/**
 * PNG -> WebP for the standalone material textures.
 *
 * These are not glTF-embedded maps: they are loaded by id through
 * `loadTextureByAssetId` (src/scene/materialAssets.ts) with a plain
 * `TextureLoader`, which goes through the browser's own image decoder. WebP is
 * therefore a drop-in - no loader change - while KTX2 would not be, since
 * `TextureLoader` cannot read it. (KTX2 remains the better answer for GPU
 * memory; it needs the material texture path taught to use `KTX2Loader`.)
 *
 * Materials name textures by manifest id, never by path, so nothing outside the
 * manifest has to change when the extension does.
 *
 * Quality is chosen per map kind, because only the albedo is a picture:
 *   _BC  colour         - plain lossy; that is what it is for
 *   _N   normal vectors - near-lossless
 *   _ORM packed masks   - near-lossless
 *
 * The _N/_ORM choice is about chroma, not about ratio. libwebp's lossy mode
 * always encodes YUV 4:2:0, and half-resolution chroma is fine for a picture
 * but not for maps whose channels are independent signals: it smears a normal's
 * X against its Y, and bleeds an ORM's roughness into its metalness. WebP's
 * near-lossless mode preprocesses inside the *lossless* RGB pipeline, so every
 * channel keeps full resolution. It buys less (-52% on these maps against -76%
 * for plain lossy) and that difference is the price of not corrupting data.
 *
 * Already-lossy sources are skipped. Re-encoding a JPEG near-losslessly asks the
 * encoder to preserve that JPEG's own artefacts exactly, which costs *more* than
 * the original: the Worker's three .jpg maps grew from 0.32 MB to 0.71 MB when
 * this ran over them. Pass --include-lossy to override.
 *
 *   node tools/compress-textures.mjs                       # measure the default dir
 *   node tools/compress-textures.mjs --write
 *   node tools/compress-textures.mjs public/assets/ThreeAges/Characters --write
 */
import { readdirSync, readFileSync, writeFileSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. It ships transitively with @gltf-transform/cli;");
  console.error("run `npm install` (or `npm install --save-dev sharp`) and retry.");
  process.exit(1);
}

const MANIFEST = "public/assets/manifest.json";
const args = process.argv.slice(2);
const write = args.includes("--write");
const includeLossy = args.includes("--include-lossy");
const dirs = args.filter((a) => !a.startsWith("--"));
if (dirs.length === 0) dirs.push("public/assets/ThreeAges/Textures");

/** Lossy only where the map is a picture; the data maps keep full-res channels. */
function encoderFor(name) {
  if (/_BC\.[a-z]+$/i.test(name)) return { label: "lossy q90", options: { quality: 90, effort: 6 } };
  return { label: "near-lossless", options: { nearLossless: true, quality: 40, effort: 6 } };
}

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const candidates = [];
const skipped = [];
for (const dir of dirs) {
  for (const p of walk(dir)) {
    if (/\.png$/i.test(p)) candidates.push(p);
    else if (/\.jpe?g$/i.test(p)) (includeLossy ? candidates : skipped).push(p);
  }
}
if (candidates.length === 0) {
  console.log("donusturulecek doku bulunamadi");
  process.exit(0);
}

const results = [];
for (const src of candidates.sort()) {
  const file = src.split(/[\\/]/).pop();
  const before = statSync(src).size;
  const { label, options } = encoderFor(file);
  const buffer = await sharp(src).webp(options).toBuffer();
  results.push({ src, file, before, after: buffer.length, label, buffer });
}

const mb = (bytes) => (bytes / 1048576).toFixed(2);
const totalBefore = results.reduce((sum, r) => sum + r.before, 0);
const totalAfter = results.reduce((sum, r) => sum + r.after, 0);

console.log("dosya".padEnd(34) + "PNG".padStart(9) + "WebP".padStart(10) + "  mod");
for (const r of results) {
  console.log(r.file.padEnd(34) + mb(r.before).padStart(9) + mb(r.after).padStart(10) + `  ${r.label}`);
}
console.log("\n" + "TOPLAM".padEnd(34) + mb(totalBefore).padStart(9) + mb(totalAfter).padStart(10)
  + `   (-${(100 - (totalAfter / totalBefore) * 100).toFixed(0)}%)`);

if (!write) {
  console.log("\nkuru calisma (--write ile uygula)");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const byPath = new Map();
for (const asset of manifest.assets ?? []) {
  if (typeof asset.path === "string") byPath.set(asset.path.replace(/^\/+/, ""), asset);
}

let repointed = 0;
for (const r of results) {
  const webpName = r.file.replace(/\.png$/i, ".webp");
  writeFileSync(join(DIR, webpName), r.buffer);
  rmSync(join(DIR, r.file), { force: true });

  const oldRel = `assets/ThreeAges/Textures/${r.file}`;
  const newRel = `assets/ThreeAges/Textures/${webpName}`;
  for (const asset of manifest.assets ?? []) {
    if (typeof asset.path === "string" && asset.path.replace(/^\/+/, "") === oldRel) {
      asset.path = asset.path.startsWith("/") ? `/${newRel}` : newRel;
      if (asset.runtime && typeof asset.runtime.bytes === "number") asset.runtime.bytes = r.after;
      repointed += 1;
    }
    if (typeof asset.thumbnail === "string" && asset.thumbnail.replace(/^\/+/, "") === oldRel) {
      asset.thumbnail = asset.thumbnail.startsWith("/") ? `/${newRel}` : newRel;
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nYAZILDI: ${results.length} doku donusturuldu, ${repointed} manifest yolu guncellendi`);
void byPath;

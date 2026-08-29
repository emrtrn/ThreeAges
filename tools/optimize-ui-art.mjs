#!/usr/bin/env node
/**
 * UI art optimizer — the HUD skin and the notification icons.
 *
 * These are painted at source resolution and shipped that way: a 9-slice button
 * arrived 2172x724 and 2.4 MB, and five notification icons arrived 1254x1254
 * and ~1 MB each to be drawn at 30 CSS pixels. Together the `ui/` folder was
 * 25 MB of a 183 MB build — the cheapest third of the download, and the one a
 * player pays for before the menu can paint.
 *
 * Two different operations, because the two groups fail differently:
 *
 *   1. SKIN -> WebP, dimensions untouched. `border-image-slice` is measured in
 *      *source pixels* (`150 fill`, `180 fill`, …), so resizing a 9-slice would
 *      silently move every frame's corners. The size is not the problem anyway:
 *      PNG is, for painted gradients with alpha. Re-encoding at q95 is ~85% off
 *      with the geometry bit-for-bit intact.
 *
 *   2. ICONS -> resized, still PNG. `UiAssetPath` (src/game/data/gameDataTypes)
 *      types these as `/assets/ui/icons/*.{svg,png}`, `balance/*.json` names them
 *      by that path, `validateGameData` refuses anything else and the engine
 *      tests pin the rows. Keeping the name and the extension makes this a pure
 *      asset change: no type, no validator, no test, no fallback chain moves.
 *
 * Both update `public/assets/manifest.json` (`path`, `thumbnail`,
 * `runtime.bytes`), and the WebP pass rewrites `src/style.css`'s `url()`s for
 * exactly the files it converted. Idempotent: a file already in the target shape
 * is skipped, so a second run is a no-op.
 *
 *   node tools/optimize-ui-art.mjs            # measure, write nothing
 *   node tools/optimize-ui-art.mjs --write
 */
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("sharp is not installed. It ships transitively with @gltf-transform/cli;");
  console.error("run `npm install` and retry.");
  process.exit(1);
}

const write = process.argv.includes("--write");

const SKIN_DIRS = ["public/assets/ui/skin"];
const SKIN_FILES = ["public/assets/ui/panel.png", "public/assets/ui/panleHUD-9slice.png"];
const ICON_DIR = "public/assets/ui/icons";
const MANIFEST = "public/assets/manifest.json";
const STYLESHEET = "src/style.css";

/**
 * q95, not the q88 that would halve the result again. This skin is read at
 * arm's length on every frame the game is on screen, and the 1.1 MB between the
 * two settings is not worth a debate about a gradient edge on a 183 MB build.
 */
const WEBP_QUALITY = 95;

/**
 * The notification art is drawn into a 30x30 box (`.rts-notification-icon img`).
 * 256 matches every other icon in the folder and still has room for a 3x display;
 * it is the folder's existing convention rather than a number invented here.
 */
const ICON_MAX = 256;

const pngSize = (file) => {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
};

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function skinSources() {
  const files = [...SKIN_FILES];
  for (const dir of SKIN_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.toLowerCase().endsWith(".png")) files.push(join(dir, name).replace(/\\/g, "/"));
    }
  }
  return files.filter((f) => existsSync(f));
}

function oversizedIcons() {
  if (!existsSync(ICON_DIR)) return [];
  const out = [];
  for (const name of readdirSync(ICON_DIR)) {
    if (!name.toLowerCase().endsWith(".png")) continue;
    const file = join(ICON_DIR, name).replace(/\\/g, "/");
    const { width, height } = pngSize(file);
    if (width > ICON_MAX || height > ICON_MAX) out.push({ file, width, height });
  }
  return out;
}

const converted = []; // { from, to, before, after }
const resized = []; // { file, before, after, from, to }

// --- 1. skin -> WebP -------------------------------------------------------
for (const file of skinSources()) {
  const target = file.replace(/\.png$/i, ".webp");
  const before = statSync(file).size;
  const buffer = await sharp(file).webp({ quality: WEBP_QUALITY }).toBuffer();
  converted.push({ from: file, to: target, before, after: buffer.length });
  if (write) {
    writeFileSync(target, buffer);
    rmSync(file, { force: true });
  }
}

// --- 2. oversized icons -> ICON_MAX ---------------------------------------
for (const { file, width, height } of oversizedIcons()) {
  const before = statSync(file).size;
  const buffer = await sharp(file)
    .resize(ICON_MAX, ICON_MAX, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  resized.push({ file, before, after: buffer.length, from: `${width}x${height}`, to: `${ICON_MAX}px` });
  if (write) writeFileSync(file, buffer);
}

// --- 3. manifest + stylesheet ---------------------------------------------
// Both are rewritten from the operations actually performed, never from a
// pattern: a path is replaced only because this run converted that exact file.
if (write && (converted.length > 0 || resized.length > 0)) {
  let manifest = readFileSync(MANIFEST, "utf8");
  const rel = (p) => p.replace(/^public\//, "");
  for (const { from, to, after } of converted) {
    manifest = manifest.split(JSON.stringify(rel(from))).join(JSON.stringify(rel(to)));
    manifest = retargetBytes(manifest, rel(to), after);
  }
  for (const { file, after } of resized) manifest = retargetBytes(manifest, rel(file), after);
  writeFileSync(MANIFEST, manifest);

  let css = readFileSync(STYLESHEET, "utf8");
  for (const { from, to } of converted) {
    css = css.split(`url("/${rel(from)}")`).join(`url("/${rel(to)}")`);
  }
  writeFileSync(STYLESHEET, css);
}

/**
 * Point one asset's `runtime.bytes` at its new size.
 *
 * Textual rather than a parse-and-restringify, because the manifest is a large
 * hand-and-tool-edited file whose formatting is part of its diff history;
 * rewriting all of it to change one number would bury the change. The window is
 * anchored on the asset's own `"path"` so a shared byte count cannot be moved on
 * the wrong entry.
 */
function retargetBytes(manifest, path, bytes) {
  const anchor = manifest.indexOf(`"path": ${JSON.stringify(path)}`);
  if (anchor < 0) return manifest;
  const window = manifest.slice(anchor, anchor + 1200);
  const replaced = window.replace(/"bytes":\s*\d+/, `"bytes": ${bytes}`);
  return manifest.slice(0, anchor) + replaced + manifest.slice(anchor + 1200);
}

// --- report ----------------------------------------------------------------
const sum = (rows, key) => rows.reduce((t, r) => t + r[key], 0);

console.log(`[ui-art] skin -> WebP q${WEBP_QUALITY} (${converted.length} file(s)):`);
for (const { from, before, after } of converted) {
  console.log(`  ${kb(before).padStart(8)} -> ${kb(after).padStart(8)}  ${basename(from)}`);
}
console.log(`[ui-art] icons > ${ICON_MAX}px resized (${resized.length} file(s)):`);
for (const { file, before, after, from } of resized) {
  console.log(`  ${kb(before).padStart(8)} -> ${kb(after).padStart(8)}  ${from} -> ${ICON_MAX}px  ${basename(file)}`);
}

const before = sum(converted, "before") + sum(resized, "before");
const after = sum(converted, "after") + sum(resized, "after");
console.log(
  `[ui-art] ${mb(before)} -> ${mb(after)} ` +
    `(-${(100 - (after / before) * 100).toFixed(0)}%)${write ? "" : "  — dry run, pass --write"}`,
);

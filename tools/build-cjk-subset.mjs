#!/usr/bin/env node
/**
 * Rebuild the shipped Simplified Chinese font subsets from the shipped strings.
 *
 * Why this exists: `public/assets/ui/fonts/NotoSansSC-cjk-{400,700}.ttf` are not
 * fonts, they are *subsets* — a few hundred glyphs cut down from Noto Sans SC so
 * a web build does not ship ten megabytes of CJK. That trade has one sharp edge,
 * and it is the reason for this file: **adding a single new Chinese string can
 * introduce a character the subset does not contain**, which renders as a blank
 * box for players and fails `npm run test:locales` for everyone else.
 *
 * That happened on 2026-08-20: nine new audio-settings keys pulled in seven Han
 * characters (音 乐 效 劳 斗 背 景 …) that the previous subset had never needed,
 * and there was no tool in the repo to regenerate it. This is that tool.
 *
 * What it does:
 *   1. reads every character used by `public/game-data/locales/zh-CN/*.json`;
 *   2. asks the Google Fonts CSS API for a subset covering exactly those;
 *   3. downloads the woff2 it points at and converts it to TTF.
 *
 * Requires network access, plus Python with `fonttools` and `brotli` for the
 * woff2 → TTF step (`pip install fonttools brotli`). It is a maintenance tool,
 * not part of the build: run it when `test:locales` reports missing glyphs.
 *
 *   node tools/build-cjk-subset.mjs           # rebuild in place
 *   node tools/build-cjk-subset.mjs --check   # report coverage, write nothing
 */

import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCALE_DIR = "public/game-data/locales/zh-CN";
const FONT_DIR = "public/assets/ui/fonts";
const WEIGHTS = [400, 700];
const FAMILY = "Noto Sans SC";
/** Mirrors the bound `test:engine` asserts, so a bad rebuild fails here first. */
const SIZE_LIMITS = { min: 100_000, max: 250_000 };

const checkOnly = process.argv.includes("--check");

/** Every distinct character the shipped zh-CN strings actually use. */
function requiredCharacters() {
  const chars = new Set();
  for (const file of readdirSync(LOCALE_DIR)) {
    if (!file.endsWith(".json")) continue;
    const table = JSON.parse(readFileSync(join(LOCALE_DIR, file), "utf8"));
    for (const value of Object.values(table)) {
      for (const ch of String(value)) chars.add(ch);
    }
  }
  return [...chars].sort().join("");
}

/** Codepoints a TTF's cmap answers, read through fonttools. */
function coverageOf(path) {
  const out = execFileSync(
    "python",
    [
      "-c",
      "import sys,json;from fontTools.ttLib import TTFont;"
      + "print(json.dumps(sorted(TTFont(sys.argv[1]).getBestCmap())))",
      path,
    ],
    { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  );
  return new Set(JSON.parse(out));
}

function missingIn(path, text) {
  const cmap = coverageOf(path);
  return [...new Set(text)].filter((ch) => !cmap.has(ch.codePointAt(0)));
}

async function fetchSubset(weight, text, workDir) {
  const query = new URLSearchParams({
    family: `${FAMILY}:wght@${weight}`,
    text,
    display: "swap",
  });
  // A browser UA is not optional: the CSS API serves legacy TTF `src` rules to
  // clients it does not recognise, and this pipeline wants the woff2.
  const css = await fetch(`https://fonts.googleapis.com/css2?${query}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
  });
  if (!css.ok) throw new Error(`CSS API refused weight ${weight}: ${css.status}`);
  const body = await css.text();
  const url = body.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/)?.[0];
  if (!url) throw new Error(`No font URL in the CSS for weight ${weight}`);
  const font = await fetch(url);
  if (!font.ok) throw new Error(`Font download failed for weight ${weight}: ${font.status}`);
  const woff2 = join(workDir, `noto-sc-${weight}.woff2`);
  writeFileSync(woff2, Buffer.from(await font.arrayBuffer()));
  const ttf = join(workDir, `NotoSansSC-cjk-${weight}.ttf`);
  // Decompress rather than re-subset: the API already cut it to `text`, so
  // clearing the flavour and saving is the whole conversion.
  execFileSync(
    "python",
    [
      "-c",
      "import sys;from fontTools.ttLib import TTFont;"
      + "f=TTFont(sys.argv[1]);f.flavor=None;f.save(sys.argv[2])",
      woff2,
      ttf,
    ],
    { stdio: "inherit" },
  );
  return ttf;
}

const text = requiredCharacters();
console.log(`[cjk-subset] zh-CN needs ${new Set(text).size} distinct characters`);

if (checkOnly) {
  let gaps = 0;
  for (const weight of WEIGHTS) {
    const path = join(FONT_DIR, `NotoSansSC-cjk-${weight}.ttf`);
    const missing = missingIn(path, text);
    gaps += missing.length;
    console.log(
      missing.length === 0
        ? `[cjk-subset] ${weight}: covers everything`
        : `[cjk-subset] ${weight}: MISSING ${missing.length} — ${missing.join("")}`,
    );
  }
  process.exit(gaps === 0 ? 0 : 1);
}

const workDir = mkdtempSync(join(tmpdir(), "cjk-subset-"));
for (const weight of WEIGHTS) {
  const built = await fetchSubset(weight, text, workDir);
  const bytes = readFileSync(built);
  if (bytes.length < SIZE_LIMITS.min || bytes.length > SIZE_LIMITS.max) {
    throw new Error(
      `weight ${weight} came back at ${bytes.length} bytes, outside the shipped bound `
      + `[${SIZE_LIMITS.min}, ${SIZE_LIMITS.max}] — refusing to install it`,
    );
  }
  const target = join(FONT_DIR, `NotoSansSC-cjk-${weight}.ttf`);
  writeFileSync(target, bytes);
  const missing = missingIn(target, text);
  if (missing.length > 0) {
    throw new Error(`weight ${weight} still misses ${missing.length}: ${missing.join("")}`);
  }
  console.log(`[cjk-subset] ${weight}: wrote ${target} (${bytes.length} bytes, full coverage)`);
}
console.log("[cjk-subset] done — run `npm run test:locales` to confirm");

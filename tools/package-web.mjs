#!/usr/bin/env node
/**
 * Package `dist/` as an itch.io HTML5 upload.
 *
 * Written rather than shelled out to, for three reasons this repo actually hit:
 *
 *   1. There is no `zip` or `7z` on this machine, and PowerShell 5.1's
 *      `Compress-Archive` has historically written nested entry names with
 *      backslashes. itch unzips on Linux, where `assets\ui\panel.webp` is not a
 *      path but a filename containing backslashes — the upload "succeeds" and
 *      the game 404s on every asset. Writing the central directory here means
 *      the separator is a decision, not a platform accident.
 *   2. itch serves the zip's *contents*, so `index.html` must sit at the archive
 *      root. Zipping the folder gives `dist/index.html` and a blank page.
 *   3. Most of the payload (webp, ogg, glb, png) is already compressed. Deflating
 *      it again costs minutes and gives back kilobytes, so those are STOREd and
 *      only the text — js, css, json, html, svg — is deflated.
 *
 * The archive is checked after it is written: every entry is read back out of
 * the central directory and its CRC verified against the source file, because a
 * silently corrupt upload is the one failure that looks like success.
 *
 *   node tools/package-web.mjs            # dist/ -> builds/<name>-web-<stamp>.zip
 *   node tools/package-web.mjs --out x.zip
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const DIST = "dist";
const OUT_DIR = "builds";

/** Text compresses; media is already compressed and only costs time. */
const DEFLATE_EXT = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".map", ".wasm"]);

const outArg = process.argv.indexOf("--out");
if (!existsSync(DIST)) {
  console.error(`[package] ${DIST}/ does not exist. Run \`npm run build\` first.`);
  process.exit(1);
}
if (!existsSync(join(DIST, "index.html"))) {
  console.error(`[package] ${DIST}/index.html is missing — that is what itch.io opens.`);
  process.exit(1);
}

/**
 * Turkish letters first, then NFD for everything else.
 *
 * `ı`, `ğ`, `ş` are letters in their own right, not accented Latin ones, so NFD
 * leaves them whole and a bare `[^a-z0-9]` strip turns "Sınır Krallıkları" into
 * "s-n-r-krall-klar". NFD alone handles the languages where the accent really is
 * a combining mark (é, ü, ñ), which is why both passes are here.
 */
const TRANSLITERATE = { ı: "i", İ: "i", ğ: "g", Ğ: "g", ş: "s", Ş: "s", ç: "c", Ç: "c", ö: "o", Ö: "o", ü: "u", Ü: "u" };

function slug(value) {
  return [...value]
    .map((ch) => TRANSLITERATE[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function projectSlug() {
  // The published name, not package.json's template name ("forge").
  // ProjectName.txt may carry several names separated by "|"; the first that
  // still has letters after transliteration wins, so a project named only in a
  // non-Latin script falls through to the next name rather than to "game".
  try {
    for (const part of readFileSync("ProjectName.txt", "utf8").split("|")) {
      const candidate = slug(part.trim());
      if (candidate) return candidate;
    }
  } catch {
    /* fall through */
  }
  return "game";
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const info = statSync(abs);
    if (info.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

/** DOS date/time, the only timestamp a plain zip entry carries. */
function dosStamp(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const files = walk(DIST).sort();
const stamp = new Date();
const local = [];
const central = [];
let offset = 0;
let rawTotal = 0;

for (const file of files) {
  // Forward slashes, always: this is the fix in reason (1) above.
  const name = relative(DIST, file).split(/[\\/]/).join("/");
  const data = readFileSync(file);
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const deflate = DEFLATE_EXT.has(ext) && data.length > 0;
  const body = deflate ? deflateRawSync(data, { level: 9 }) : data;
  const method = deflate ? 8 : 0;
  const sum = crc32(data);
  const { time, day } = dosStamp(stamp);
  const nameBytes = Buffer.from(name, "utf8");
  rawTotal += data.length;

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(method, 8);
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(sum, 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  local.push(header, nameBytes, body);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6); // version needed
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(method, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(day, 14);
  entry.writeUInt32LE(sum, 16);
  entry.writeUInt32LE(body.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBytes.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, nameBytes);

  offset += header.length + nameBytes.length + body.length;
}

const centralBuffer = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuffer.length, 12);
end.writeUInt32LE(offset, 16);

const outPath =
  outArg > -1 && process.argv[outArg + 1]
    ? process.argv[outArg + 1]
    : join(OUT_DIR, `${projectSlug()}-web-${stamp.toISOString().slice(0, 10)}.zip`);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(outPath, Buffer.concat([...local, centralBuffer, end]));

// --- read the archive back -------------------------------------------------
// Parsed from the central directory rather than trusting what was just built:
// this is the artefact that gets uploaded, and a wrong separator or a bad CRC
// is invisible until a player opens the page.
const zip = readFileSync(outPath);
const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
let cursor = zip.readUInt32LE(eocd + 16);
const count = zip.readUInt16LE(eocd + 10);
const problems = [];
let seenIndex = false;
for (let i = 0; i < count; i += 1) {
  const nameLen = zip.readUInt16LE(cursor + 28);
  const extraLen = zip.readUInt16LE(cursor + 30);
  const commentLen = zip.readUInt16LE(cursor + 32);
  const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLen);
  const stored = zip.readUInt32LE(cursor + 16);
  if (name.includes("\\")) problems.push(`backslash in entry name: ${name}`);
  if (name === "index.html") seenIndex = true;
  const actual = crc32(readFileSync(join(DIST, name)));
  if (actual !== stored) problems.push(`CRC mismatch: ${name}`);
  cursor += 46 + nameLen + extraLen + commentLen;
}
if (!seenIndex) problems.push("index.html is not at the archive root");

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
console.log(`[package] ${outPath}`);
console.log(`[package] ${count} entries, ${mb(rawTotal)} raw -> ${mb(zip.length)} archived`);
if (problems.length > 0) {
  for (const p of problems.slice(0, 10)) console.error(`[FAIL] ${p}`);
  process.exit(1);
}
console.log(`[package] verified: index.html at root, POSIX separators, ${count} CRCs match.`);
console.log(`[package] upload ${basename(outPath)} to itch.io and tick "This file will be played in the browser".`);

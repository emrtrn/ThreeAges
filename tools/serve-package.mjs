#!/usr/bin/env node
/**
 * Serve a packaged build the way itch.io does, straight out of the zip.
 *
 * Opening `index.html` from disk does not work and never will: under `file://`
 * a browser refuses ES module imports and `fetch` as cross-origin, so the page
 * paints and the bundle never loads. A web game needs a web server.
 *
 * A plain server at the origin root is not enough either. itch serves a project
 * under `html-classic.itch.zone/html/<id>/`, and every bug this repo hit on the
 * way to publishing was invisible from the root: a root-absolute `/assets/...`
 * resolves past the game to the host's own root and 404s only on a subpath. So
 * this mounts under `/html/local/` and refuses to serve anything outside it —
 * a URL that works here works on itch.
 *
 * It reads the *archive*, not `dist/`, because the archive is what gets
 * uploaded. Serving the folder you built would skip the packaging step, which
 * is exactly where a wrong separator or a missing `index.html` at the root
 * hides.
 *
 * A already-extracted folder is accepted too, since that is what you have if you
 * unzipped it to look inside. Prefer the zip when you have both: it is the file
 * that gets uploaded.
 *
 *   npm run preview:package                       # newest zip in builds/
 *   npm run preview:package -- <klasor>           # or an extracted folder
 *   node tools/serve-package.mjs <file.zip> [--port 8080]
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { createServer } from "node:http";
import { inflateRawSync } from "node:zlib";

const BUILDS = "builds";
const MOUNT = "/html/local";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const port = portArg > -1 && args[portArg + 1] ? Number(args[portArg + 1]) : 8080;
const explicit = args.find((a, i) => a !== "--port" && args[i - 1] !== "--port" && !a.startsWith("--"));

function newestZip() {
  if (!existsSync(BUILDS)) return null;
  const zips = readdirSync(BUILDS)
    .filter((n) => n.toLowerCase().endsWith(".zip"))
    .map((n) => join(BUILDS, n))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return zips[0] ?? null;
}

const source = explicit ?? newestZip();
if (!source || !existsSync(source)) {
  console.error("[serve] Ne bir arsiv ne bir klasor bulundu.");
  console.error("[serve]   npm run package:web            -> builds/ altina zip uretir");
  console.error("[serve]   npm run preview:package -- <klasor>   -> cikardigin klasoru servis eder");
  process.exit(1);
}
const fromFolder = statSync(source).isDirectory();

/** name -> { method, start, compSize } for a zip; name -> { file } for a folder. */
const entries = new Map();
let zip = null;

if (fromFolder) {
  const walk = (dir, prefix) => {
    for (const child of readdirSync(dir)) {
      const abs = join(dir, child);
      const name = prefix ? `${prefix}/${child}` : child;
      if (statSync(abs).isDirectory()) walk(abs, name);
      else entries.set(name, { file: abs });
    }
  };
  walk(source, "");
} else {
  zip = readFileSync(source);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) {
    console.error(`[serve] ${source} bir zip arsivi degil.`);
    process.exit(1);
  }
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const method = zip.readUInt16LE(cursor + 10);
    const compSize = zip.readUInt32LE(cursor + 20);
    const nameLen = zip.readUInt16LE(cursor + 28);
    const extraLen = zip.readUInt16LE(cursor + 30);
    const commentLen = zip.readUInt16LE(cursor + 32);
    const localOff = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLen);
    const lNameLen = zip.readUInt16LE(localOff + 26);
    const lExtraLen = zip.readUInt16LE(localOff + 28);
    entries.set(name, { method, start: localOff + 30 + lNameLen + lExtraLen, compSize });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
}

if (!entries.has("index.html")) {
  console.error(`[serve] ${source} icinde kokte index.html yok.`);
  console.error("[serve] itch de ayni sekilde bos sayfa acardi — arsivin kokunde durmali.");
  process.exit(1);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".bin": "application/octet-stream",
};

/** Decompressed lazily and kept, so a re-read of the same file is not re-inflated. */
const cache = new Map();
function bodyOf(name) {
  if (cache.has(name)) return cache.get(name);
  const e = entries.get(name);
  const body = e.file
    ? readFileSync(e.file)
    : e.method === 8
      ? inflateRawSync(zip.subarray(e.start, e.start + e.compSize))
      : zip.subarray(e.start, e.start + e.compSize);
  cache.set(name, body);
  return body;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  let path = decodeURIComponent(url.pathname);

  // Convenience only: the game itself must never depend on this.
  if (path === "/" || path === "") {
    res.writeHead(302, { location: `${MOUNT}/` });
    res.end();
    return;
  }
  if (!path.startsWith(MOUNT)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(
      `Bu yol oyunun kökünün dışında — itch'te de 404 verirdi.\nOyun: http://localhost:${port}${MOUNT}/\n`,
    );
    return;
  }

  let name = path.slice(MOUNT.length).replace(/^\/+/, "");
  if (name === "") name = "index.html";
  if (!entries.has(name)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`404 ${name}\n`);
    console.log(`  404  ${name}`);
    return;
  }

  const body = bodyOf(name);
  const type = TYPES[extname(name).toLowerCase()] ?? "application/octet-stream";

  // Media needs ranges: Chrome asks for them when streaming the music, and a
  // server that answers 200 to a Range request can stall playback.
  const range = req.headers.range;
  if (range && /^bytes=\d*-\d*$/.test(range)) {
    const [rawStart, rawEnd] = range.replace("bytes=", "").split("-");
    const start = rawStart === "" ? body.length - Number(rawEnd) : Number(rawStart);
    const end = rawEnd === "" || rawStart === "" ? body.length - 1 : Math.min(Number(rawEnd), body.length - 1);
    if (start >= 0 && start <= end) {
      res.writeHead(206, {
        "content-type": type,
        "content-range": `bytes ${start}-${end}/${body.length}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
      });
      res.end(body.subarray(start, end + 1));
      return;
    }
  }

  res.writeHead(200, {
    "content-type": type,
    "content-length": body.length,
    "accept-ranges": "bytes",
    // No caching: this exists to test a fresh upload, and a cached bundle is how
    // you end up looking at yesterday's build and trusting it.
    "cache-control": "no-store",
  });
  res.end(body);
});

server.listen(port, () => {
  const kind = fromFolder ? "klasor" : `${(statSync(source).size / 1048576).toFixed(1)} MB arsiv`;
  console.log(`[serve] ${source}  (${kind}, ${entries.size} dosya)`);
  console.log(`[serve] itch gibi bir alt yolda:  http://localhost:${port}${MOUNT}/`);
  if (fromFolder) {
    console.log("[serve] NOT: klasor servis ediliyor. Yuklenecek dosya zip, tercihen onu ver.");
  }
  console.log("[serve] 404'ler asagida listelenir. Durdurmak icin Ctrl+C.");
});

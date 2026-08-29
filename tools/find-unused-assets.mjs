#!/usr/bin/env node
/**
 * Reachability analysis over public/assets.
 *
 * Roots = what the shipped game actually boots from:
 *   public/project.3dgame.json, public/game-data/**, and every asset path or
 *   manifest asset id that appears as a literal in src/ engine/ game/ builder/.
 *
 * Edges are followed conservatively (over-inclusive on purpose - a false
 * "used" costs disk, a false "unused" costs a deleted asset):
 *   - any "assets/..." substring inside a reachable JSON / TS file
 *   - any string equal to a manifest asset id -> that entry's path
 *   - .gltf  -> its `uri` fields (buffers + images), resolved relative
 *   - .glb   -> external `uri`s in the embedded JSON chunk
 *   - a reachable model -> its sidecars (they live and die with the model)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, resolve, sep } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const PUBLIC = join(ROOT, "public");
const ASSETS = join(PUBLIC, "assets");

const SIDECAR_SUFFIXES = [
  ".materials.json", ".collision.json", ".uvw.json", ".vertexcolors.json",
  ".skeleton.json", ".meshpaint.json", ".foliage.json", ".foliagetype.json",
  ".thumb.png",
];
const EDITOR_ONLY_SIDECARS = [".uvw.json", ".vertexcolors.json"];
const BINARY_ASSET_EXT = new Set([
  ".glb", ".gltf", ".bin", ".png", ".jpg", ".jpeg", ".webp", ".ktx2",
  ".ogg", ".mp3", ".wav", ".ttf", ".otf", ".woff", ".woff2", ".hdr", ".exr",
]);

const walk = (dir, out = []) => {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const posix = (p) => p.split(sep).join("/");
const publicRel = (abs) => posix(relative(PUBLIC, abs));
const ext = (p) => { const i = p.lastIndexOf("."); return i < 0 ? "" : p.slice(i).toLowerCase(); };

// ---------------------------------------------------------------- manifest
const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const idToPath = new Map();
for (const a of manifest.assets ?? []) {
  if (a?.id && typeof a.path === "string") idToPath.set(a.id, a.path.replace(/^\/+/, ""));
}

// ------------------------------------------------------------- file census
const allFiles = walk(PUBLIC);
const knownPublicPaths = new Set(allFiles.map(publicRel));
// case-insensitive lookup: authored refs disagree with disk casing in places
const ciIndex = new Map();
for (const p of knownPublicPaths) {
  const k = p.toLowerCase();
  if (!ciIndex.has(k)) ciIndex.set(k, p);
}
const resolveRef = (raw) => {
  if (!raw) return null;
  let p = raw.replace(/^\/+/, "").split("?")[0].split("#")[0];
  try { p = decodeURIComponent(p); } catch { /* keep raw */ }
  if (knownPublicPaths.has(p)) return p;
  return ciIndex.get(p.toLowerCase()) ?? null;
};

// --------------------------------------------------------------- extractors
const PATH_RE = /(?:\.{0,2}\/)?(?:assets|game-data|layouts|landscapes|locales)\/[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+/g;
const STRING_RE = /"([^"\\\n]{1,160})"|'([^'\\\n]{1,160})'|`([^`\\\n]{1,160})`/g;
// A bare `Name.ext` token. Source composes asset paths out of template literals
// (`${STATIC_MESH_ROOT}/Resource_Tree1.glb`), so the directory half never appears
// next to the file half and PATH_RE alone cannot see the reference. Missing this
// is what once reported the two choppable tree models as dead.
const BASENAME_RE = /[A-Za-z0-9_\-]+\.(?:glb|gltf|bin|png|jpg|jpeg|webp|ktx2|ogg|mp3|wav|ttf|otf|hdr|exr)\b/gi;

const byBasename = new Map();
for (const p of knownPublicPaths) {
  const base = p.slice(p.lastIndexOf("/") + 1).toLowerCase();
  if (!byBasename.has(base)) byBasename.set(base, []);
  byBasename.get(base).push(p);
}

function refsFromText(text, fromPublicRel) {
  const found = new Set();
  for (const m of text.matchAll(PATH_RE)) {
    let cand = m[0].replace(/^\.\//, "");
    if (cand.startsWith("../") && fromPublicRel) {
      cand = posix(join(dirname(fromPublicRel), cand));
    }
    const r = resolveRef(cand);
    if (r) found.add(r);
  }
  for (const m of text.matchAll(STRING_RE)) {
    const s = m[1] ?? m[2] ?? m[3];
    if (s && idToPath.has(s)) {
      const r = resolveRef(idToPath.get(s));
      if (r) found.add(r);
    }
  }
  for (const m of text.matchAll(BASENAME_RE)) {
    for (const p of byBasename.get(m[0].toLowerCase()) ?? []) found.add(p);
  }
  return found;
}

function refsFromGltf(abs, fromPublicRel) {
  const found = new Set();
  try {
    const doc = JSON.parse(readFileSync(abs, "utf8"));
    for (const list of [doc.buffers ?? [], doc.images ?? []]) {
      for (const item of list) {
        if (typeof item?.uri === "string" && !item.uri.startsWith("data:")) {
          const r = resolveRef(posix(join(dirname(fromPublicRel), item.uri)));
          if (r) found.add(r);
        }
      }
    }
  } catch { /* unparseable: leave to text scan */ }
  return found;
}

function refsFromGlb(abs, fromPublicRel) {
  const found = new Set();
  try {
    const buf = readFileSync(abs);
    if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) return found;
    const jsonLen = buf.readUInt32LE(12);
    const doc = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
    for (const list of [doc.buffers ?? [], doc.images ?? []]) {
      for (const item of list) {
        if (typeof item?.uri === "string" && !item.uri.startsWith("data:")) {
          const r = resolveRef(posix(join(dirname(fromPublicRel), item.uri)));
          if (r) found.add(r);
        }
      }
    }
  } catch { /* not a parseable glb */ }
  return found;
}

const sidecarsOf = (ownerPublicRel) => {
  // ".level.json" -> base is the whole stem before ".level"
  const base = ownerPublicRel.endsWith(".level.json")
    ? ownerPublicRel.slice(0, -".level.json".length)
    : ownerPublicRel.replace(/\.[^./]+$/, "");
  return SIDECAR_SUFFIXES.map((s) => base + s).filter((p) => knownPublicPaths.has(p));
};

// manifest.json is an index, not a consumer: it names every asset in the
// project, so following its paths marks the entire tree reachable. It
// contributes id -> path lookups only.
const INDEX_FILES = new Set(["assets/manifest.json"]);

// -------------------------------------------------------------------- roots
// Two root sets, so the report can separate "nothing references this" from
// "only the test suite references this" - the second still must not be
// deleted, but it has no business shipping in dist/.
const gameRoots = new Set();
const roots = new Set();
const addRoot = (p) => { const r = resolveRef(p); if (r) { roots.add(r); gameRoots.add(r); } };

addRoot("project.3dgame.json");
for (const f of allFiles) {
  const rel = publicRel(f);
  if (rel.startsWith("game-data/")) { roots.add(rel); gameRoots.add(rel); }
}

// Source literals. `tools/` counts: engine-tests.ts pins authored data files by
// path, so a file only the suite reads is still load-bearing - leaving tools/
// out here is what once reported the M_TA_* material library as dead.
const SRC_DIRS = ["src", "engine", "game", "builder", "project", "tools"];
const srcFiles = SRC_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .filter((p) => /\.(ts|tsx|js|mjs|json|html|css)$/i.test(p));
for (const f of srcFiles) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  const isTooling = posix(relative(ROOT, f)).startsWith("tools/");
  for (const r of refsFromText(text, null)) {
    roots.add(r);
    if (!isTooling) gameRoots.add(r);
  }
}
// index.html + the project's own entry html/css
for (const f of ["index.html"]) {
  try { for (const r of refsFromText(readFileSync(join(ROOT, f), "utf8"), null)) roots.add(r); } catch {}
}

// ---------------------------------------------------------------------- BFS
function reach(startRoots) {
  const seen = new Set();
  const queue = [];
  const push = (p) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    queue.push(p);
  };
  for (const r of startRoots) push(r);

  while (queue.length) {
    const cur = queue.shift();
    const abs = join(PUBLIC, cur);
    const e = ext(cur);
    let next = new Set();

    if (INDEX_FILES.has(cur)) next = new Set();
    else if (e === ".glb") next = refsFromGlb(abs, cur);
    else if (e === ".gltf") next = refsFromGltf(abs, cur);
    else if (!BINARY_ASSET_EXT.has(e)) {
      try { next = refsFromText(readFileSync(abs, "utf8"), cur); } catch { /* binary-ish */ }
    }

    for (const n of next) push(n);
    if (e === ".glb" || e === ".gltf" || cur.endsWith(".level.json")) {
      for (const s of sidecarsOf(cur)) push(s);
    }
  }
  return seen;
}

const reachable = reach(roots);
const gameReachable = reach(gameRoots);

// ------------------------------------------------------------------ report
const assetFiles = allFiles.map(publicRel).filter((p) => p.startsWith("assets/"));
const unused = assetFiles.filter((p) => !reachable.has(p));
const used = assetFiles.filter((p) => reachable.has(p));

const sizeOf = (p) => { try { return statSync(join(PUBLIC, p)).size; } catch { return 0; } };
const mb = (b) => (b / 1048576).toFixed(1);
const sum = (list) => list.reduce((s, p) => s + sizeOf(p), 0);

const isEditorOnlySidecar = (p) => EDITOR_ONLY_SIDECARS.some((s) => p.endsWith(s));
// Reached only through tools/ (engine-tests pins it): keep it in the repo, but
// it has no reason to ship.
const testOnly = assetFiles.filter((p) => reachable.has(p) && !gameReachable.has(p));

const groupOf = (p) => {
  const parts = p.split("/");
  return parts.slice(0, Math.min(3, parts.length - 1)).join("/") || "assets";
};
const byGroup = new Map();
for (const p of unused) {
  const g = groupOf(p);
  if (!byGroup.has(g)) byGroup.set(g, []);
  byGroup.get(g).push(p);
}

const out = {
  totals: {
    assetFiles: assetFiles.length,
    usedFiles: used.length,
    unusedFiles: unused.length,
    totalMB: +mb(sum(assetFiles)),
    usedMB: +mb(sum(used)),
    unusedMB: +mb(sum(unused)),
  },
  editorOnlySidecars: {
    files: assetFiles.filter(isEditorOnlySidecar).length,
    MB: +mb(sum(assetFiles.filter(isEditorOnlySidecar))),
  },
  testOnly: {
    files: testOnly.length,
    MB: +mb(sum(testOnly)),
    paths: testOnly.sort((a, b) => sizeOf(b) - sizeOf(a)),
  },
  unusedByGroup: [...byGroup.entries()]
    .map(([g, list]) => ({ group: g, files: list.length, MB: +mb(sum(list)) }))
    .sort((a, b) => b.MB - a.MB),
  unusedFiles: unused
    .map((p) => ({ path: p, MB: +mb(sizeOf(p)) }))
    .sort((a, b) => b.MB - a.MB),
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`\n=== TOPLAM ===`);
  console.log(`${out.totals.assetFiles} dosya / ${out.totals.totalMB} MB`);
  console.log(`kullanilan : ${out.totals.usedFiles} dosya / ${out.totals.usedMB} MB`);
  console.log(`KULLANILMAYAN: ${out.totals.unusedFiles} dosya / ${out.totals.unusedMB} MB`);
  console.log(`\n(ayrica editor-only sidecar: ${out.editorOnlySidecars.files} dosya / ${out.editorOnlySidecars.MB} MB)`);
  console.log(`(yalnizca testlerden erisilen: ${out.testOnly.files} dosya / ${out.testOnly.MB} MB - repoda kalir, dist'e girmemeli)`);
  console.log(`\n=== KULLANILMAYANLAR (klasore gore) ===`);
  for (const g of out.unusedByGroup) {
    console.log(`${String(g.MB).padStart(7)} MB  ${String(g.files).padStart(4)} dosya  ${g.group}`);
  }
  console.log(`\n=== EN BUYUK 40 KULLANILMAYAN DOSYA ===`);
  for (const f of out.unusedFiles.slice(0, 40)) {
    console.log(`${String(f.MB).padStart(7)} MB  ${f.path}`);
  }
}

#!/usr/bin/env node
/**
 * Remove `instances` entries that declare an asset but place no copies of it.
 *
 * An entry with an empty `placements` array cannot draw anything - the mounting
 * loop in `src/scene/authoredWorld.ts` skips it outright. But the preload set in
 * `sceneModelAssetIds` (src/scene/SceneRuntimeCore.ts) is built from the entry
 * list alone, without consulting `placements`, so every such declaration still
 * costs one model download and parse per level load. Dropping them is a pure
 * data cleanup: nothing that rendered before stops rendering.
 *
 * Defaults to the project's own default scene. Pass paths to target other
 * levels. Reports without touching anything unless `--write` is given.
 *
 *   node tools/prune-empty-level-instances.mjs            # dry run
 *   node tools/prune-empty-level-instances.mjs --write
 */
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const PUBLIC = join(ROOT, "public");

const args = process.argv.slice(2);
const write = args.includes("--write");
const targets = args.filter((a) => !a.startsWith("--"));

function defaultScene() {
  const project = JSON.parse(readFileSync(join(PUBLIC, "project.3dgame.json"), "utf8"));
  const scene = project?.editor?.defaultScene;
  if (typeof scene !== "string" || !scene) {
    throw new Error("project.3dgame.json has no editor.defaultScene to fall back on");
  }
  return join(PUBLIC, scene);
}

const files = targets.length ? targets.map((p) => resolve(p)) : [defaultScene()];

// Manifest lookup, so the report can say how much download the removal saves.
let sizeOfAsset = () => 0;
try {
  const manifest = JSON.parse(readFileSync(join(PUBLIC, "assets/manifest.json"), "utf8"));
  const byId = new Map((manifest.assets ?? []).map((a) => [a.id, a.path]));
  sizeOfAsset = (id) => {
    const path = byId.get(id);
    if (typeof path !== "string") return 0;
    try {
      return statSync(join(PUBLIC, path.replace(/^\/+/, ""))).size;
    } catch {
      return 0;
    }
  };
} catch {
  // No manifest: the report just loses its byte column.
}

const mb = (bytes) => (bytes / 1048576).toFixed(1);
let totalRemoved = 0;
let totalBytes = 0;

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const level = JSON.parse(raw);
  const instances = level.instances;
  if (!Array.isArray(instances)) {
    console.log(`${file}: no instances array, skipped`);
    continue;
  }

  const empty = instances.filter((entry) => (entry?.placements ?? []).length === 0);
  const kept = instances.filter((entry) => (entry?.placements ?? []).length > 0);
  const bytes = empty.reduce((sum, entry) => sum + sizeOfAsset(entry?.assetId), 0);
  totalRemoved += empty.length;
  totalBytes += bytes;

  const keptCopies = kept.reduce((sum, entry) => sum + entry.placements.length, 0);
  console.log(`\n${file.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
  console.log(`  instances: ${instances.length} -> ${kept.length}`);
  console.log(`  bos kayit kaldirildi: ${empty.length} (${mb(bytes)} MB yukleme)`);
  console.log(`  kalan gercek kopya: ${keptCopies}`);
  if (empty.length && !write) {
    const preview = empty.slice(0, 8).map((e) => e?.assetId).join(", ");
    console.log(`  ornek: ${preview}${empty.length > 8 ? ", ..." : ""}`);
  }

  if (!write || empty.length === 0) continue;

  level.instances = kept;
  // The authored levels are written as 2-space JSON with a trailing newline;
  // matching that keeps the diff to the removed entries alone.
  writeFileSync(file, `${JSON.stringify(level, null, 2)}\n`, "utf8");
  console.log(`  YAZILDI`);
}

console.log(
  `\ntoplam: ${totalRemoved} bos kayit, ${mb(totalBytes)} MB${write ? " kaldirildi" : " kaldirilabilir (--write ile uygula)"}`,
);

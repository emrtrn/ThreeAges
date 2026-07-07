import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STATE_DIR = resolve(".playwright-smoke");
const STATE_FILE = resolve(STATE_DIR, "state.json");
const MANIFEST_PATH = resolve("public/project.3dgame.json");
const ASSET_MANIFEST_PATH = resolve("public/assets/manifest.json");

export default async function globalTeardown() {
  let state;
  try {
    state = JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return;
  }

  if (typeof state.manifestRaw === "string") {
    await writeFile(MANIFEST_PATH, state.manifestRaw, "utf8");
  }
  if (typeof state.assetManifestRaw === "string") {
    await writeFile(ASSET_MANIFEST_PATH, state.assetManifestRaw, "utf8");
  }
  const restoredSmokeFiles = new Set();
  if (Array.isArray(state.smokeFileBackups)) {
    for (const backup of state.smokeFileBackups) {
      if (!backup || typeof backup.path !== "string") continue;
      const target = resolve("public", backup.path);
      restoredSmokeFiles.add(backup.path);
      if (typeof backup.raw === "string") {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, backup.raw, "utf8");
      } else {
        await rm(target, { force: true });
      }
    }
  }
  if (Array.isArray(state.smokeScenes)) {
    for (const smokeScene of state.smokeScenes) {
      if (typeof smokeScene === "string") {
        if (restoredSmokeFiles.has(smokeScene)) continue;
        await rm(resolve("public", smokeScene), { force: true });
      }
    }
  }
  if (Array.isArray(state.smokeFiles)) {
    for (const smokeFile of state.smokeFiles) {
      if (typeof smokeFile === "string") {
        if (restoredSmokeFiles.has(smokeFile)) continue;
        await rm(resolve("public", smokeFile), { force: true });
      }
    }
  }
  if (typeof state.smokeScene === "string") {
    await rm(resolve("public", state.smokeScene), { force: true });
  }
  await rm(STATE_DIR, { recursive: true, force: true });
}

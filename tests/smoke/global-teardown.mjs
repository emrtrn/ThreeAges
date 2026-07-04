import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const STATE_DIR = resolve(".playwright-smoke");
const STATE_FILE = resolve(STATE_DIR, "state.json");
const MANIFEST_PATH = resolve("public/project.3dgame.json");

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
  if (typeof state.smokeScene === "string") {
    await rm(resolve("public", state.smokeScene), { force: true });
  }
  await rm(STATE_DIR, { recursive: true, force: true });
}

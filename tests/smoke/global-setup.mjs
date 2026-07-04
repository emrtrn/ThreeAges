import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STATE_DIR = resolve(".playwright-smoke");
const STATE_FILE = resolve(STATE_DIR, "state.json");
const MANIFEST_PATH = resolve("public/project.3dgame.json");
const SMOKE_SCENE = "layouts/__playwright-smoke.level.json";
const SMOKE_SCENE_PATH = resolve("public", SMOKE_SCENE);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export default async function globalSetup() {
  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(dirname(SMOKE_SCENE_PATH), { recursive: true });

  const manifestRaw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const defaultScene = manifest?.editor?.defaultScene;
  if (typeof defaultScene !== "string" || defaultScene.length === 0) {
    throw new Error("project manifest is missing editor.defaultScene");
  }

  const sourceScenePath = resolve("public", defaultScene);
  const sourceSceneRaw = await readFile(sourceScenePath, "utf8");
  const sourceScene = JSON.parse(sourceSceneRaw);

  await writeFile(
    STATE_FILE,
    `${JSON.stringify({ manifestRaw, smokeScene: SMOKE_SCENE }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(SMOKE_SCENE_PATH, `${JSON.stringify(sourceScene, null, 2)}\n`, "utf8");

  const smokeManifest = await readJson(MANIFEST_PATH);
  smokeManifest.editor = {
    ...smokeManifest.editor,
    defaultScene: SMOKE_SCENE,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(smokeManifest, null, 2)}\n`, "utf8");
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const STATE_DIR = resolve(".playwright-smoke");
const STATE_FILE = resolve(STATE_DIR, "state.json");
const MANIFEST_PATH = resolve("public/project.3dgame.json");
const ASSET_MANIFEST_PATH = resolve("public/assets/manifest.json");
const MENU_PATH = resolve("public/assets/starter-content/UI/SaveLoadMenu.ui.json");
const SMOKE_SCENE = "layouts/__playwright-smoke.level.json";
const SMOKE_TARGET_SCENE = "layouts/__playwright-smoke-target.level.json";
const SMOKE_PATROL_SCENE = "layouts/__playwright-smoke-patrol.level.json";
const SMOKE_MENU = "assets/__playwright-smoke-menu.ui.json";
const SMOKE_SCENE_PATH = resolve("public", SMOKE_SCENE);
const SMOKE_TARGET_SCENE_PATH = resolve("public", SMOKE_TARGET_SCENE);
const SMOKE_PATROL_SCENE_PATH = resolve("public", SMOKE_PATROL_SCENE);
const SMOKE_MENU_PATH = resolve("public", SMOKE_MENU);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function ensureInstanceGroup(scene, assetId) {
  if (!Array.isArray(scene.instances)) scene.instances = [];
  let group = scene.instances.find((entry) => entry?.assetId === assetId);
  if (!group) {
    group = { assetId, placements: [] };
    scene.instances.push(group);
  }
  if (!Array.isArray(group.placements)) group.placements = [];
  return group;
}

function prepareSmokeSourceScene(scene) {
  const copy = structuredClone(scene);
  copy.name = "__playwright-smoke";
  copy.characters = [];
  copy.actors = [];
  // Editor authoring smokes assume a clean base scene: they add one actor and
  // assert on it by count or by name filter. Drop every authored placeable the
  // source level (Playground) ships — Target Points, volumes and reflective
  // surfaces — so an inherited "AI Navigation Volume"/"Target Point" row can't
  // collide with the one the test adds, and the play step loads a light scene.
  copy.targetPoints = [];
  copy.aiNavigationVolumes = [];
  copy.blockingVolumes = [];
  copy.reflectiveSurfaces = [];
  copy.reflectionPlanes = [];
  copy.reflectionCaptures = [];
  copy.worldSettings = {
    ...(copy.worldSettings ?? {}),
    gameMode: "assets/starter-content/Gameplay/Script_GameMode.actor.json",
    hudWidget: "hud",
    pauseMenuWidget: "menu",
    locale: "en",
  };

  const starts = ensureInstanceGroup(copy, "marker:playerStart");
  starts.placements = [
    {
      position: [0, 0, 0],
      name: "Player Start",
      collision: false,
      rotationYDeg: 0,
      scale: 1,
    },
  ];

  const floor = ensureInstanceGroup(copy, "floor-400x400");
  floor.placements = [
    {
      position: [0, 0, -1.5],
      rotationYDeg: 0,
      scale: 3,
      scaleLocked: true,
    },
  ];

  // Two runtime gameplay sensors on the pawn's forward (-Z) walk line, both off
  // the origin so the non-moving smokes (runtime-playflow, ai-patrol, editor) never
  // trip them at boot. The locomotion smoke only nudges the pawn ~1m, so it never
  // reaches the checkpoint at z=-4; the checkpoint/portal smokes walk into them.
  const triggers = ensureInstanceGroup(copy, "shape:cube");
  triggers.placements = [
    {
      position: [0, 1, -4],
      name: "Smoke Checkpoint",
      scale: [12, 4, 3],
      sensor: true,
      collisionPreset: "trigger",
      behavior: { script: "checkpoint", params: { slot: "quick" } },
    },
    {
      position: [0, 1, -10],
      name: "Smoke Portal",
      scale: [12, 4, 3],
      sensor: true,
      collisionPreset: "trigger",
      behavior: {
        script: "level-travel",
        params: {
          targetLevel: "layouts/__playwright-smoke-target.level.json",
          targetSpawn: "arrival",
        },
      },
    },
  ];

  return copy;
}

function prepareSmokeTargetScene(scene) {
  const copy = structuredClone(scene);
  copy.name = "__playwright-smoke-target";
  copy.characters = [];
  copy.actors = [];
  copy.worldSettings = {
    ...(copy.worldSettings ?? {}),
    gameMode: "assets/starter-content/Gameplay/Script_GameMode.actor.json",
    hudWidget: "hud",
    pauseMenuWidget: "menu",
    locale: "en",
  };

  const starts = ensureInstanceGroup(copy, "marker:playerStart");
  starts.placements = [
    {
      position: [0, 0, 0],
      name: "Player Start",
      collision: false,
      rotationYDeg: 0,
      scale: 1,
      metadata: { spawnTag: "arrival" },
    },
  ];

  const floor = ensureInstanceGroup(copy, "floor-400x400");
  floor.placements = [
    {
      position: [0, 0, 0],
      rotationYDeg: 0,
      scale: 3,
      scaleLocked: true,
    },
  ];

  // Return portal on the arrival scene's forward (-Z) walk line: travelling into it
  // sends the pawn back to the source smoke level, letting the portal round-trip
  // smoke prove a second `level-travel` sensor fires in the same session (behavior
  // registry freshness — the same trigger id can fire again in a new scene visit).
  const returnPortal = ensureInstanceGroup(copy, "shape:cube");
  returnPortal.placements = [
    {
      position: [0, 1, -6],
      name: "Smoke Return Portal",
      scale: [12, 4, 3],
      sensor: true,
      collisionPreset: "trigger",
      behavior: {
        script: "level-travel",
        params: { targetLevel: "layouts/__playwright-smoke.level.json" },
      },
    },
  ];

  return copy;
}

/**
 * Runtime AI patrol smoke scene: unlike the other smoke scenes it deliberately
 * keeps the source `actors` (the `AI_Test` controller) and `targetPoints` so the
 * runtime spawns a real patrolling agent. This is the destination the pause-menu
 * `smoke-patrol` travel button reaches, letting the patrol spec observe the AI
 * controller + nav follower come alive on the authored Target Point route.
 */
function prepareSmokePatrolScene(scene) {
  const copy = structuredClone(scene);
  copy.name = "__playwright-smoke-patrol";
  copy.worldSettings = {
    ...(copy.worldSettings ?? {}),
    hudWidget: "hud",
    pauseMenuWidget: "menu",
    locale: "en",
  };
  return copy;
}

function prepareSmokeMenu(menu) {
  const copy = structuredClone(menu);
  copy.name = "Playwright Smoke Menu";
  const panel = copy.root?.children?.find((child) => child?.id === "panel");
  const footer = panel?.children?.find((child) => child?.id === "footer");
  if (!footer || !Array.isArray(footer.children)) {
    throw new Error("SaveLoadMenu smoke fixture is missing footer children");
  }
  footer.children.unshift({
    id: "smoke-travel",
    widget: "Button",
    props: {
      text: "Travel",
      onClick: {
        type: "message",
        message: `travel:${SMOKE_TARGET_SCENE}#arrival`,
      },
    },
  });
  footer.children.unshift({
    id: "smoke-patrol",
    widget: "Button",
    props: {
      text: "Patrol",
      onClick: {
        type: "message",
        message: `travel:${SMOKE_PATROL_SCENE}`,
      },
    },
  });
  return copy;
}

export default async function globalSetup() {
  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(dirname(SMOKE_SCENE_PATH), { recursive: true });

  const manifestRaw = await readFile(MANIFEST_PATH, "utf8");
  const assetManifestRaw = await readFile(ASSET_MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(manifestRaw);
  const defaultScene = manifest?.editor?.defaultScene;
  if (typeof defaultScene !== "string" || defaultScene.length === 0) {
    throw new Error("project manifest is missing editor.defaultScene");
  }

  const sourceScenePath = resolve("public", defaultScene);
  const sourceSceneRaw = await readFile(sourceScenePath, "utf8");
  const sourceScene = JSON.parse(sourceSceneRaw);
  const smokeMenu = prepareSmokeMenu(await readJson(MENU_PATH));

  await writeFile(
    STATE_FILE,
    `${JSON.stringify({
      manifestRaw,
      assetManifestRaw,
      smokeFileBackups: [
        { path: SMOKE_SCENE, raw: await readOptionalText(SMOKE_SCENE_PATH) },
        { path: SMOKE_TARGET_SCENE, raw: await readOptionalText(SMOKE_TARGET_SCENE_PATH) },
        { path: SMOKE_PATROL_SCENE, raw: await readOptionalText(SMOKE_PATROL_SCENE_PATH) },
        { path: SMOKE_MENU, raw: await readOptionalText(SMOKE_MENU_PATH) },
      ],
      smokeScenes: [SMOKE_SCENE, SMOKE_TARGET_SCENE, SMOKE_PATROL_SCENE],
      smokeFiles: [SMOKE_MENU],
    }, null, 2)}\n`,
    "utf8",
  );

  await writeFile(
    SMOKE_SCENE_PATH,
    `${JSON.stringify(prepareSmokeSourceScene(sourceScene), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    SMOKE_TARGET_SCENE_PATH,
    `${JSON.stringify(prepareSmokeTargetScene(sourceScene), null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    SMOKE_PATROL_SCENE_PATH,
    `${JSON.stringify(prepareSmokePatrolScene(sourceScene), null, 2)}\n`,
    "utf8",
  );
  await writeFile(SMOKE_MENU_PATH, `${JSON.stringify(smokeMenu, null, 2)}\n`, "utf8");

  const smokeManifest = await readJson(MANIFEST_PATH);
  smokeManifest.editor = {
    ...smokeManifest.editor,
    defaultScene: SMOKE_SCENE,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(smokeManifest, null, 2)}\n`, "utf8");

  const smokeAssetManifest = await readJson(ASSET_MANIFEST_PATH);
  const menuAsset = smokeAssetManifest.assets?.find((asset) => asset?.id === "menu");
  if (!menuAsset) throw new Error("asset manifest is missing menu asset");
  menuAsset.path = SMOKE_MENU;
  if (menuAsset.runtime) {
    menuAsset.runtime.bytes = Buffer.byteLength(JSON.stringify(smokeMenu), "utf8");
  }
  await writeFile(ASSET_MANIFEST_PATH, `${JSON.stringify(smokeAssetManifest, null, 2)}\n`, "utf8");
}

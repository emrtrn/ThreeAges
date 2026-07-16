/**
 * Entry point: wires the DOM (canvas + UI overlay) to the scene layer.
 * Keep this file thin — composition only, no game or render logic.
 *
 * Routes (single codebase, one SceneApp):
 *   (default)  game mode — runtime render, no editor UI.
 *   ?editor    editor mode — same SceneApp + dynamically-imported EditorUi overlay
 *              (the editor bundle is a separate chunk, never loaded in game mode).
 *   ?debug     attaches the perf overlay in any mode.
 */
import { RuntimeSceneApp } from "@/scene/RuntimeSceneApp";
import { attachDebugStats } from "@/scene/debugStats";
import { installGlobalErrorHandlers } from "@/game/core/errorHandler";
import { setLogLevel, logger } from "@/game/core/logger";
import {
  createRuntimeConfig,
  readBootOptionsFromUrl,
  snapshotRuntimeConfig,
} from "@/game/core/runtimeConfig";
import { loadAgeBalance, loadAiBalance, loadBuildingBalance, loadGamePreset, loadResourceBalance, loadRoadBalance, loadUnitBalance } from "@/game/data/gameDataLoader";
import type { GamePreset } from "@/game/data/gameDataTypes";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}

/**
 * Faz 0 production-foundation boot: install runtime error capture, resolve the
 * active preset + feature flags, and (in dev) expose a read-only snapshot for
 * the debug panel. Simulation-speed application lands with the Faz 1 game loop;
 * here the value is only resolved and logged.
 */
async function bootFoundation(): Promise<GamePreset | null> {
  installGlobalErrorHandlers();
  const isDev = import.meta.env.DEV;
  setLogLevel(isDev ? "debug" : "warn");

  const params = new URLSearchParams(location.search);
  const presetId = params.get("preset") ?? "gameplay_proof";
  const log = logger("System");

  let preset: GamePreset | null = null;
  try {
    preset = await loadGamePreset(presetId);
  } catch (error) {
    // A bad/missing preset must not stop the app from booting; log and fall
    // back to defaults so the runtime stays playable (plan §12).
    log.warn(`Preset "${presetId}" unavailable; using defaults`, error);
  }

  const config = createRuntimeConfig(preset, readBootOptionsFromUrl(isDev));
  log.info(`runtime config ready (preset ${config.presetId})`);

  if (isDev) {
    (window as unknown as { __forge?: unknown }).__forge = {
      config: snapshotRuntimeConfig(config),
    };
  }
  return preset;
}

async function main(): Promise<void> {
  const preset = await bootFoundation();

  const params = new URLSearchParams(location.search);
  const canvas = requireElement<HTMLCanvasElement>("game-canvas");
  const editorEnabled = params.has("editor");
  const scriptMessageTraceLimit = import.meta.env.DEV && params.has("debug") ? 20 : 0;

  // RTS game route (Vertical Slice Plan v0.2 Faz 1). Gated behind ?rts so the
  // character runtime + editor stay the default until the RTS is promoted. Its
  // own lightweight runtime — never mixes with the character SceneApp above.
  if (!editorEnabled && params.has("rts")) {
    const { RtsApp } = await import("@/game/rts/RtsApp");
    const [unitBalance, buildingBalance, resourceBalance, ageBalance, roadBalance, aiBalance] = await Promise.all([
      loadUnitBalance(),
      loadBuildingBalance(),
      loadResourceBalance(),
      loadAgeBalance(),
      loadRoadBalance(),
      loadAiBalance(),
    ]);
    const rts = new RtsApp(canvas, {
      debug: params.has("debug"),
      testSandbox: params.has("testSandbox"),
      unitBalance,
      buildingBalance,
      resourceBalance,
      ageBalance,
      roadBalance,
      aiBalance,
      // §72: the preset picks the AI profile; normal is the fair baseline.
      aiProfile: preset?.aiProfile ?? "normal",
      // A bad preset must not turn the fallback RTS route into an unwinnable
      // no-build state; mirror the gameplay-proof stockpile from Faz 0.
      startingResources: preset?.startingResources ?? { food: 1000, wood: 1000 },
    });
    rts.start();
    return;
  }

  // The editor is a dev-time authoring tool (it also needs the dev save server).
  // Gating on import.meta.env.DEV lets Vite dead-code-eliminate the whole editor
  // — including the dynamic import — from the production game build, so the
  // package ships no editor UI at all. In dev, ?editor still loads it on demand.
  if (editorEnabled && import.meta.env.DEV) {
    const [
      { SceneApp },
      { EditorUi },
      { saveLayoutViaDevEndpoint },
      { setGameEditorCatalog },
      { GAME_EDITOR_CATALOG },
    ] = await Promise.all([
      import("@/scene/SceneApp"),
      import("@/editor/EditorUi"),
      import("@/editor/layoutSaver"),
      import("@/editor/gameEditorRegistry"),
      import("@/game/editorCatalog"),
    ]);
    // Inversion of control: the game supplies its editor catalogs here so the
    // editor stays generic (never imports @/game). This composition root is the
    // only module allowed to see both layers, so the contract check lives here.
    setGameEditorCatalog(GAME_EDITOR_CATALOG);
    const app = new SceneApp(canvas, { enabled: true, scriptMessageTraceLimit });
    app.setLayoutSaver(saveLayoutViaDevEndpoint);
    // EditorUi owns the perf overlay in editor mode: it exposes a Show > Stats
    // toggle and defaults the overlay on when the URL carried ?debug.
    new EditorUi(app);
    app.start();
    return;
  }

  const app = new RuntimeSceneApp(canvas, { scriptMessageTraceLimit, debug: params.has("debug") });

  // Perf readout (qa-poki standard) behind ?debug — invisible in production.
  if (params.has("debug")) {
    attachDebugStats(app, requireElement("debug-stats"));
  }

  app.start();
}

void main();

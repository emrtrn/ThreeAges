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

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const canvas = requireElement<HTMLCanvasElement>("game-canvas");
  const editorEnabled = params.has("editor");
  const scriptMessageTraceLimit = import.meta.env.DEV && params.has("debug") ? 20 : 0;

  // The editor is a dev-time authoring tool (it also needs the dev save server).
  // Gating on import.meta.env.DEV lets Vite dead-code-eliminate the whole editor
  // — including the dynamic import — from the production game build, so the
  // package ships no editor UI at all. In dev, ?editor still loads it on demand.
  if (editorEnabled && import.meta.env.DEV) {
    const [{ SceneApp }, { EditorUi }, { saveLayoutViaDevEndpoint }] = await Promise.all([
      import("@/scene/SceneApp"),
      import("@/editor/EditorUi"),
      import("@/editor/layoutSaver"),
    ]);
    const app = new SceneApp(canvas, { enabled: true, scriptMessageTraceLimit });
    app.setLayoutSaver(saveLayoutViaDevEndpoint);
    new EditorUi(app);
    if (params.has("debug")) {
      attachDebugStats(app, requireElement("debug-stats"));
    }
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

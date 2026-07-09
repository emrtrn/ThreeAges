export type EditorTool = "select" | "move" | "rotate" | "scale";
export type TransformSpace = "world" | "local";

/** Viewport camera presets exposed by the editor Camera menu. */
export type CameraView = "perspective" | "top" | "left" | "front";

/** Viewport shading modes exposed by the editor View Mode menu. */
export type ViewMode = "lit" | "wireframe";

/**
 * Combined viewport view state the runtime reports to the editor UI so the
 * Camera and View Mode menu labels stay in sync (e.g. an orthographic preset
 * also switches shading to wireframe).
 */
export interface ViewportViewState {
  view: CameraView;
  mode: ViewMode;
}

export function nextTransformTool(tool: EditorTool): EditorTool {
  if (tool === "move") return "rotate";
  if (tool === "rotate") return "scale";
  return "move";
}

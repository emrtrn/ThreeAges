export type EditorTool = "select" | "move" | "rotate" | "scale";
export type TransformSpace = "world" | "local";

export function nextTransformTool(tool: EditorTool): EditorTool {
  if (tool === "move") return "rotate";
  if (tool === "rotate") return "scale";
  return "move";
}

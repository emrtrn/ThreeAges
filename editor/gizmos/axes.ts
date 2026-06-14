export type GizmoAxis = "x" | "y" | "z" | "xy" | "yz" | "xz" | "xyz" | "uniform";
export type GizmoVectorAxis = Extract<GizmoAxis, "x" | "y" | "z">;
export type GizmoPlaneAxis = Extract<GizmoAxis, "xy" | "yz" | "xz">;

/** Maps a gizmo axis to its rotation/scale vector index (defaults to Y). */
export function axisToIndex(axis: GizmoAxis): 0 | 1 | 2 {
  if (axis === "x") return 0;
  if (axis === "z") return 2;
  return 1;
}

export function isPlaneAxis(axis: GizmoAxis): axis is GizmoPlaneAxis {
  return axis === "xy" || axis === "yz" || axis === "xz";
}

/** The two transform-component indices a plane handle edits. */
export function planeAxisIndices(axis: GizmoPlaneAxis): [0 | 1 | 2, 0 | 1 | 2] {
  if (axis === "xy") return [0, 1];
  if (axis === "yz") return [1, 2];
  return [0, 2];
}

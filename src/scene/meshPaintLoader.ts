/** Best-effort loader for a layout's placement-scoped Mesh Paint sidecar. */
import { createEmptyMeshPaintData, meshPaintDataPath, normalizeMeshPaintData, type LayoutMeshPaintData } from "@engine/scene/meshPaint";
import { projectFileUrl } from "@/project/ProjectSystem";

export async function loadMeshPaintData(scenePath: string): Promise<LayoutMeshPaintData> {
  try {
    const response = await fetch(projectFileUrl(meshPaintDataPath(scenePath)), { cache: "no-cache" });
    if (!response.ok) return createEmptyMeshPaintData();
    return normalizeMeshPaintData(await response.json());
  } catch {
    return createEmptyMeshPaintData();
  }
}

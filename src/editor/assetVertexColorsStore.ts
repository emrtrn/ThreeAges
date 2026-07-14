/** Editor-side persistence for asset-level Mesh Paint defaults. */
import {
  assetVertexColorsSidecarPath,
  normalizeAssetVertexColors,
  type AssetVertexColorsDef,
} from "@engine/scene/assetVertexColors";
import { projectFileUrl } from "@/project/ProjectSystem";

export {
  assetVertexColorsSidecarPath,
  createEmptyAssetVertexColors,
  normalizeAssetVertexColors,
  upsertAssetVertexColorMesh,
} from "@engine/scene/assetVertexColors";
export type { AssetVertexColorMesh, AssetVertexColorsDef } from "@engine/scene/assetVertexColors";

export async function loadAssetVertexColors(modelPath: string): Promise<AssetVertexColorsDef> {
  try {
    const response = await fetch(projectFileUrl(assetVertexColorsSidecarPath(modelPath)), { cache: "no-cache" });
    if (!response.ok) return normalizeAssetVertexColors(undefined);
    return normalizeAssetVertexColors(await response.json());
  } catch {
    return normalizeAssetVertexColors(undefined);
  }
}

export async function saveAssetVertexColors(
  modelPath: string,
  vertexColors: AssetVertexColorsDef,
): Promise<{ path: string; changed: boolean }> {
  const path = assetVertexColorsSidecarPath(modelPath);
  const response = await fetch("/__save-vertexcolors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, vertexColors: normalizeAssetVertexColors(vertexColors) }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Vertex Color save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

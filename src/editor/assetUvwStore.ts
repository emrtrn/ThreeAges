/**
 * Editor-side saving of asset-level UVW map sidecars (`*.uvw.json`).
 */
import {
  normalizeAssetUvw,
  uvwSidecarPath,
  type AssetUvwDef,
} from "@/scene/assetUvwLoader";

export {
  applyAssetUvwMapping,
  defaultAssetUvw,
  loadAssetUvw,
  normalizeAssetUvw,
  restoreAssetUvs,
  uvwSidecarPath,
  UVW_MAP_TYPES,
} from "@/scene/assetUvwLoader";
export type { AssetUvwDef, UvwMapType } from "@/scene/assetUvwLoader";

export async function saveAssetUvw(
  modelPath: string,
  uvw: AssetUvwDef,
): Promise<{ path: string; changed: boolean }> {
  const path = uvwSidecarPath(modelPath);
  const response = await fetch("/__save-uvw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, uvw: normalizeAssetUvw(uvw) }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `UVW save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

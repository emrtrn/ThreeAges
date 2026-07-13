/**
 * Foliage asset loaders (runtime + editor scene load).
 *
 * Two static fetches from `public/`: the per-layout `<layout>.foliage.json`
 * instance sidecar, and the `*.foliagetype.json` Foliage Type assets its groups
 * reference (resolved id → path via the manifest). Both normalize through
 * `engine/scene/foliage` so a malformed/older file degrades gracefully instead of
 * crashing scene boot. Editor-only writes go through `src/editor/foliageStore.ts`.
 */
import type { AssetManifest } from "@engine/assets/manifest";
import { assetPath, assetRecordById } from "@engine/assets/manifest";
import {
  createEmptyFoliageData,
  foliageDataPath,
  normalizeFoliageData,
  normalizeFoliageType,
  type ForgeFoliageTypeDef,
  type LayoutFoliageData,
} from "@engine/scene/foliage";
import { projectFileUrl } from "@/project/ProjectSystem";

/** Loads a layout's foliage sidecar; empty data on any failure (missing = no foliage). */
export async function loadFoliageData(scenePath: string): Promise<LayoutFoliageData> {
  try {
    const response = await fetch(projectFileUrl(foliageDataPath(scenePath)), { cache: "no-cache" });
    if (!response.ok) return createEmptyFoliageData();
    return normalizeFoliageData(await response.json());
  } catch {
    return createEmptyFoliageData();
  }
}

/** Loads a single Foliage Type asset from its public-relative path; null on failure. */
export async function loadFoliageTypeByPath(path: string): Promise<ForgeFoliageTypeDef | null> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return null;
    return normalizeFoliageType(await response.json());
  } catch {
    return null;
  }
}

/**
 * Loads every Foliage Type referenced by a foliage sidecar, keyed by asset id.
 * Types whose asset is missing from the manifest or fails to load are omitted;
 * the render binding then skips those groups (a missing type = nothing drawn).
 */
export async function loadFoliageTypesForData(
  data: LayoutFoliageData,
  manifest: AssetManifest,
): Promise<Map<string, ForgeFoliageTypeDef>> {
  const ids = new Set(data.groups.map((group) => group.foliageTypeId));
  const map = new Map<string, ForgeFoliageTypeDef>();
  await Promise.all(
    [...ids].map(async (id) => {
      const record = assetRecordById(manifest, id);
      if (!record) return;
      const type = await loadFoliageTypeByPath(assetPath(record));
      if (type) map.set(id, type);
    }),
  );
  return map;
}

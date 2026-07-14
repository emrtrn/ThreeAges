import { LOD, Object3D } from "three";

/** Stable user-data key retaining unscaled distances across quality changes. */
export const FORGE_LOD_TEMPLATE_DISTANCES = "forgeLodTemplateDistances";

/** One authored alternative mesh and the distance at which it becomes active. */
export interface LodTemplateLevel {
  readonly distance: number;
  readonly object: Object3D;
  readonly hysteresis?: number;
}

/** A multiplier below one selects lower-detail meshes sooner; invalid values are neutral. */
export function normalizeLodBias(lodBias: number | undefined): number {
  return typeof lodBias === "number" && Number.isFinite(lodBias) && lodBias > 0 ? lodBias : 1;
}

/** Applies a normalized quality bias without admitting negative transition distances. */
export function biasedLodDistance(distance: number, lodBias: number | undefined): number {
  return Math.max(0, distance) * normalizeLodBias(lodBias);
}

/**
 * Builds an opt-in Three.js LOD node from fork-provided mesh alternatives.
 *
 * Forge deliberately does not invent or decimate low-poly meshes: a game fork
 * supplies its authored variants, while this template records the source
 * distances so {@link applyLodBias} can safely retune them at runtime.
 */
export function createLodTemplate(
  levels: readonly LodTemplateLevel[],
  lodBias?: number,
): LOD {
  const lod = new LOD();
  const normalized = levels
    .filter((level) => Number.isFinite(level.distance) && level.distance >= 0)
    .slice()
    .sort((left, right) => left.distance - right.distance);
  lod.userData[FORGE_LOD_TEMPLATE_DISTANCES] = normalized.map((level) => level.distance);
  for (const level of normalized) {
    lod.addLevel(level.object, biasedLodDistance(level.distance, lodBias), level.hysteresis ?? 0);
  }
  return lod;
}

/**
 * Retunes every Three.js LOD below a root. Existing LODs without Forge metadata
 * adopt their current distances exactly once, making the helper safe for a
 * fork that assembled an LOD manually.
 */
export function applyLodBias(root: Object3D, lodBias: number | undefined): number {
  let updated = 0;
  root.traverse((object) => {
    if (!(object instanceof LOD)) return;
    const saved = object.userData[FORGE_LOD_TEMPLATE_DISTANCES];
    const sourceDistances = Array.isArray(saved) && saved.length === object.levels.length && saved.every(
      (distance): distance is number => typeof distance === "number" && Number.isFinite(distance) && distance >= 0,
    )
      ? saved
      : object.levels.map((level) => Math.max(0, level.distance));
    object.userData[FORGE_LOD_TEMPLATE_DISTANCES] = [...sourceDistances];
    object.levels.forEach((level, index) => {
      level.distance = biasedLodDistance(sourceDistances[index] ?? 0, lodBias);
    });
    updated += 1;
  });
  return updated;
}

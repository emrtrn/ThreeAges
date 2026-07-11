import type { LayoutLandscape } from "./layout";

/**
 * Render-agnostic Landscape model: resolved settings + defaults, the sidecar
 * height/layer data shape, and size presets — shared by the editor view-models
 * and the three.js render binding (`engine/render-three/landscape.ts`). Kept
 * free of three.js so editor core and the save validator can read it without
 * pulling in the renderer.
 *
 * A Landscape is the web/three counterpart to Unreal's Landscape actor: a
 * level-owned heightfield terrain. Faz 1 supports only a flat heightfield
 * (create + render + save/reload); sculpt (Faz 2) and layer paint (Faz 3)
 * write into the same sidecar shape without needing a migration.
 */
export interface ResolvedLandscape {
  name: string;
  hidden: boolean;
  /** Runtime collision. Rebuilt on Save/Play, not live during sculpt. */
  collision: boolean;
}

export const LANDSCAPE_DEFAULTS: ResolvedLandscape = {
  name: "Landscape",
  hidden: false,
  collision: true,
};

/** Fills every Landscape actor field with its default, decoupled from the layout. */
export function resolveLandscape(actor: LayoutLandscape | null | undefined): ResolvedLandscape {
  const defaults = LANDSCAPE_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    collision: actor.collision ?? defaults.collision,
  };
}

/** A stable, collision-free id for a new landscape (`landscape-<n>`). */
export function uniqueLandscapeId(landscapes: LayoutLandscape[]): string {
  const existing = new Set(landscapes.map((landscape) => landscape.id));
  let index = 1;
  while (existing.has(`landscape-${index}`)) index += 1;
  return `landscape-${index}`;
}

/** A unique display name for a new landscape, suffixing on collision. */
export function uniqueLandscapeName(baseName: string, landscapes: LayoutLandscape[]): string {
  const existing = new Set(landscapes.map((landscape) => landscape.name ?? landscape.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

// --- Sidecar data (`*.landscape.json`) --------------------------------------

/** Faz 1 preset sizes: `small`/`medium` are the safe range, `large` the Faz 1 upper bound. */
export type LandscapeSizePreset = "small" | "medium" | "large";

export interface LandscapeSize {
  verticesX: number;
  verticesZ: number;
  spacing: number;
  heightScale: number;
}

/** Minimum/maximum vertex grid dimension accepted by the Faz 1 save validator. */
export const LANDSCAPE_MIN_VERTICES = 65;
export const LANDSCAPE_MAX_VERTICES = 257;

const LANDSCAPE_SIZE_PRESETS: Record<LandscapeSizePreset, LandscapeSize> = {
  small: { verticesX: 65, verticesZ: 65, spacing: 1, heightScale: 1 },
  medium: { verticesX: 129, verticesZ: 129, spacing: 1, heightScale: 1 },
  large: { verticesX: 257, verticesZ: 257, spacing: 1, heightScale: 1 },
};

export function landscapeSizeForPreset(preset: LandscapeSizePreset): LandscapeSize {
  return { ...LANDSCAPE_SIZE_PRESETS[preset] };
}

/** Vertex-grid subdivision used to split a landscape's mesh into render chunks. */
export const LANDSCAPE_QUADS_PER_CHUNK = 32;

export interface LandscapeLayerWeights {
  id: string;
  name: string;
  /** `verticesX * verticesZ` weights, `0..1`. Empty in Faz 1 (paint is Faz 3). */
  weights: number[];
}

export interface ForgeLandscapeData {
  schema: 1;
  type: "landscape";
  size: LandscapeSize;
  chunks: {
    quadsPerChunk: number;
  };
  /** `verticesX * verticesZ` world-space heights (Y). Flat (all zero) in Faz 1. */
  heights: number[];
  /** Paint layers (Grass/Dirt/Rock/Snow). Empty in Faz 1 — populated starting Faz 3. */
  layers: LandscapeLayerWeights[];
}

/** Builds a flat (all-zero-height, no paint layers) landscape sidecar for a preset. */
export function createFlatLandscapeData(preset: LandscapeSizePreset): ForgeLandscapeData {
  const size = landscapeSizeForPreset(preset);
  return {
    schema: 1,
    type: "landscape",
    size,
    chunks: { quadsPerChunk: LANDSCAPE_QUADS_PER_CHUNK },
    heights: new Array(size.verticesX * size.verticesZ).fill(0),
    layers: [],
  };
}

/** Default public-root-relative sidecar path for a landscape id. */
export function landscapeDataPath(landscapeId: string): string {
  return `landscapes/${landscapeId}.landscape.json`;
}

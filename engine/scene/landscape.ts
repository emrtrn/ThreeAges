import type { ColliderPrimitive } from "./components";
import type { LayoutLandscape, Vec3 } from "./layout";

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

export type LandscapeLayerId = "grass" | "dirt" | "rock" | "snow";

export interface LandscapeDefaultLayer {
  id: LandscapeLayerId;
  name: string;
  color: string;
}

export const LANDSCAPE_DEFAULT_LAYERS: readonly LandscapeDefaultLayer[] = [
  { id: "grass", name: "Grass", color: "#5f9449" },
  { id: "dirt", name: "Dirt", color: "#8a6441" },
  { id: "rock", name: "Rock", color: "#7f8485" },
  { id: "snow", name: "Snow", color: "#dce7ec" },
];

export interface LandscapeLayerWeights {
  id: string;
  /** Base/placeholder layer name (Grass/Dirt/Rock/Snow). The display name follows
   * the assigned material when `material` is set. */
  name: string;
  /**
   * Assigned material asset id, or `null`/absent for the built-in preset look.
   * When set, the paint layer displays that material's name and its base color
   * tints the terrain in place of the default swatch.
   */
  material?: string | null;
  /** `verticesX * verticesZ` weights, `0..1`. Empty in Faz 1 (paint is Faz 3). */
  weights: number[];
}

export interface ForgeLandscapeMaterialDef {
  schema: 1;
  type: "landscapeMaterial";
  name: string;
  layers: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

/** Persistent source metadata for a PNG imported into this landscape. */
export interface LandscapeHeightmapImport {
  source: string;
  height: number;
}

export const DEFAULT_LANDSCAPE_MATERIAL: ForgeLandscapeMaterialDef = {
  schema: 1,
  type: "landscapeMaterial",
  name: "Default Landscape",
  layers: LANDSCAPE_DEFAULT_LAYERS.map((layer) => ({ ...layer })),
};

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
  heightmapImport?: LandscapeHeightmapImport;
}

export interface LandscapeColliderPrimitive extends ColliderPrimitive {
  shape: "trimesh";
  vertices: Vec3[];
  indices: number[];
}

export function landscapeVertexCount(data: Pick<ForgeLandscapeData, "size">): number {
  return data.size.verticesX * data.size.verticesZ;
}

export function createDefaultLandscapeLayers(vertexCount: number): LandscapeLayerWeights[] {
  return LANDSCAPE_DEFAULT_LAYERS.map((layer, index) => ({
    id: layer.id,
    name: layer.name,
    weights: new Array(vertexCount).fill(index === 0 ? 1 : 0),
  }));
}

export function normalizeLandscapeLayerWeights(
  data: ForgeLandscapeData,
  vertexIndex?: number,
): void {
  const vertexCount = landscapeVertexCount(data);
  const start = vertexIndex ?? 0;
  const end = vertexIndex === undefined ? vertexCount : Math.min(vertexIndex + 1, vertexCount);
  const base = data.layers[0];
  if (!base) return;

  for (let index = start; index < end; index += 1) {
    let total = 0;
    for (const layer of data.layers) {
      const weight = Math.min(1, Math.max(0, layer.weights[index] ?? 0));
      layer.weights[index] = weight;
      total += weight;
    }
    if (total <= 0.000001) {
      base.weights[index] = 1;
      for (let layerIndex = 1; layerIndex < data.layers.length; layerIndex += 1) {
        data.layers[layerIndex]!.weights[index] = 0;
      }
      continue;
    }
    for (const layer of data.layers) {
      layer.weights[index] = Math.round((layer.weights[index]! / total) * 10_000) / 10_000;
    }
  }
}

/**
 * Backfills/normalizes the default four paint layers in-place. Old Faz 1/2
 * sidecars with `layers: []` remain loadable and become paint-ready on first use.
 */
export function ensureLandscapeLayers(data: ForgeLandscapeData): boolean {
  const vertexCount = landscapeVertexCount(data);
  let changed = false;
  const byId = new Map(data.layers.map((layer) => [layer.id, layer]));
  const nextLayers: LandscapeLayerWeights[] = [];

  for (const [defaultIndex, defaults] of LANDSCAPE_DEFAULT_LAYERS.entries()) {
    const existing = byId.get(defaults.id);
    if (!existing) {
      nextLayers.push({
        id: defaults.id,
        name: defaults.name,
        weights: new Array(vertexCount).fill(defaultIndex === 0 ? 1 : 0),
      });
      changed = true;
      continue;
    }

    const weights = existing.weights.slice(0, vertexCount).map((weight) =>
      Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0,
    );
    while (weights.length < vertexCount) weights.push(defaultIndex === 0 ? 1 : 0);
    if (
      existing.name !== defaults.name ||
      existing.weights.length !== vertexCount ||
      existing.weights.some((weight, index) => weights[index] !== weight)
    ) {
      changed = true;
    }
    const layer: LandscapeLayerWeights = { id: defaults.id, name: defaults.name, weights };
    if (typeof existing.material === "string" && existing.material.length > 0) {
      layer.material = existing.material;
    }
    nextLayers.push(layer);
  }

  if (data.layers.length !== nextLayers.length) changed = true;
  data.layers = nextLayers;
  normalizeLandscapeLayerWeights(data);
  return changed;
}

/** Builds a flat (all-zero-height, default paint layers) landscape sidecar for a preset. */
export function createFlatLandscapeData(preset: LandscapeSizePreset): ForgeLandscapeData {
  const size = landscapeSizeForPreset(preset);
  const vertexCount = size.verticesX * size.verticesZ;
  return {
    schema: 1,
    type: "landscape",
    size,
    chunks: { quadsPerChunk: LANDSCAPE_QUADS_PER_CHUNK },
    heights: new Array(vertexCount).fill(0),
    layers: createDefaultLandscapeLayers(vertexCount),
  };
}

/**
 * Resamples an RGBA heightmap into the landscape vertex grid. Pixel luminance
 * is interpreted as a normalized height (black = 0, white = `heightRange`).
 * Bilinear sampling keeps a source PNG independent of the current terrain
 * resolution, so imports never need to mutate the level's grid shape.
 */
export function resampleLandscapeHeightmap(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  target: Pick<LandscapeSize, "verticesX" | "verticesZ">,
  heightRange: number,
): number[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Heightmap image dimensions must be positive integers.");
  }
  if (rgba.length < width * height * 4) throw new Error("Heightmap pixel data is incomplete.");
  if (!Number.isFinite(heightRange) || heightRange < 0) {
    throw new Error("Heightmap height range must be a non-negative finite number.");
  }
  const luminanceAt = (x: number, z: number): number => {
    const offset = (z * width + x) * 4;
    return (0.2126 * (rgba[offset] ?? 0) + 0.7152 * (rgba[offset + 1] ?? 0) + 0.0722 * (rgba[offset + 2] ?? 0)) / 255;
  };
  const samples: number[] = [];
  for (let z = 0; z < target.verticesZ; z += 1) {
    const sourceZ = target.verticesZ <= 1 ? 0 : (z * (height - 1)) / (target.verticesZ - 1);
    const z0 = Math.floor(sourceZ);
    const z1 = Math.min(height - 1, z0 + 1);
    const tz = sourceZ - z0;
    for (let x = 0; x < target.verticesX; x += 1) {
      const sourceX = target.verticesX <= 1 ? 0 : (x * (width - 1)) / (target.verticesX - 1);
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(width - 1, x0 + 1);
      const tx = sourceX - x0;
      const top = luminanceAt(x0, z0) + (luminanceAt(x1, z0) - luminanceAt(x0, z0)) * tx;
      const bottom = luminanceAt(x0, z1) + (luminanceAt(x1, z1) - luminanceAt(x0, z1)) * tx;
      samples.push(Math.round((top + (bottom - top) * tz) * heightRange * 1_000_000) / 1_000_000);
    }
  }
  return samples;
}

/** Builds an 8-bit grayscale preview/export buffer from the current heights. */
export function landscapeHeightsToGrayscale(data: Pick<ForgeLandscapeData, "size" | "heights">): Uint8ClampedArray {
  const count = landscapeVertexCount(data);
  const values = data.heights.slice(0, count);
  while (values.length < count) values.push(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const pixels = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index += 1) {
    const value = range > 0.000001 ? Math.round(((values[index]! - min) / range) * 255) : 0;
    const offset = index * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return pixels;
}

function resampleLandscapeGrid(
  values: readonly number[],
  source: Pick<LandscapeSize, "verticesX" | "verticesZ">,
  target: Pick<LandscapeSize, "verticesX" | "verticesZ">,
): number[] {
  const at = (x: number, z: number): number => values[z * source.verticesX + x] ?? 0;
  const output: number[] = [];
  for (let z = 0; z < target.verticesZ; z += 1) {
    const sourceZ = target.verticesZ <= 1 ? 0 : (z * (source.verticesZ - 1)) / (target.verticesZ - 1);
    const z0 = Math.floor(sourceZ);
    const z1 = Math.min(source.verticesZ - 1, z0 + 1);
    const tz = sourceZ - z0;
    for (let x = 0; x < target.verticesX; x += 1) {
      const sourceX = target.verticesX <= 1 ? 0 : (x * (source.verticesX - 1)) / (target.verticesX - 1);
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(source.verticesX - 1, x0 + 1);
      const tx = sourceX - x0;
      const top = at(x0, z0) + (at(x1, z0) - at(x0, z0)) * tx;
      const bottom = at(x0, z1) + (at(x1, z1) - at(x0, z1)) * tx;
      output.push(Math.round((top + (bottom - top) * tz) * 1_000_000) / 1_000_000);
    }
  }
  return output;
}

/**
 * Changes a landscape's vertex density while preserving its world-space X/Z
 * footprint. Heights and paint weights are bilinearly resampled together.
 */
export function resampleLandscapeData(
  data: ForgeLandscapeData,
  target: Pick<LandscapeSize, "verticesX" | "verticesZ">,
): ForgeLandscapeData {
  if (!Number.isInteger(target.verticesX) || !Number.isInteger(target.verticesZ) || target.verticesX < 2 || target.verticesZ < 2) {
    throw new Error("Landscape resolution must contain at least 2 vertices per axis.");
  }
  const source = data.size;
  const vertexCount = target.verticesX * target.verticesZ;
  const result: ForgeLandscapeData = {
    schema: 1,
    type: "landscape",
    size: {
      verticesX: target.verticesX,
      verticesZ: target.verticesZ,
      // Preserve the terrain's width/depth rather than growing it with the grid.
      spacing: ((source.verticesX - 1) * source.spacing) / (target.verticesX - 1),
      heightScale: source.heightScale,
    },
    chunks: { ...data.chunks },
    heights: resampleLandscapeGrid(data.heights, source, target),
    layers: data.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      ...(layer.material ? { material: layer.material } : {}),
      weights: resampleLandscapeGrid(layer.weights, source, target),
    })),
    ...(data.heightmapImport ? { heightmapImport: { ...data.heightmapImport } } : {}),
  };
  ensureLandscapeLayers(result);
  if (result.heights.length !== vertexCount) result.heights = new Array(vertexCount).fill(0);
  return result;
}

/** Default public-root-relative sidecar path for a landscape id. */
export function landscapeDataPath(landscapeId: string): string {
  return `landscapes/${landscapeId}.landscape.json`;
}

function landscapeHeightAt(data: ForgeLandscapeData, x: number, z: number): number {
  const { verticesX, verticesZ } = data.size;
  const cx = Math.min(Math.max(x, 0), verticesX - 1);
  const cz = Math.min(Math.max(z, 0), verticesZ - 1);
  return data.heights[cz * verticesX + cx] ?? 0;
}

function landscapePointAabb(points: readonly Vec3[]): { size: Vec3; center: Vec3 } {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxZ = Math.max(maxZ, point[2]);
  }
  return {
    size: [maxX - minX, maxY - minY, maxZ - minZ],
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
  };
}

/**
 * Builds the static runtime collider primitive for a Landscape heightfield.
 * Vertices are body-local (centered exactly like the render mesh); the actor's
 * Transform component supplies world position/rotation when physics bakes it.
 */
export function createLandscapeColliderPrimitive(data: ForgeLandscapeData): LandscapeColliderPrimitive {
  const { spacing, heightScale, verticesX, verticesZ } = data.size;
  const originX = ((verticesX - 1) * spacing) / 2;
  const originZ = ((verticesZ - 1) * spacing) / 2;
  const vertices: Vec3[] = [];

  for (let z = 0; z < verticesZ; z += 1) {
    for (let x = 0; x < verticesX; x += 1) {
      vertices.push([
        x * spacing - originX,
        landscapeHeightAt(data, x, z) * heightScale,
        z * spacing - originZ,
      ]);
    }
  }

  const indices: number[] = [];
  for (let z = 0; z < verticesZ - 1; z += 1) {
    for (let x = 0; x < verticesX - 1; x += 1) {
      const a = z * verticesX + x;
      const b = a + 1;
      const c = a + verticesX;
      const d = c + 1;
      // Same winding as the landscape render mesh: flat terrain is up-facing.
      indices.push(a, c, b, b, c, d);
    }
  }

  const aabb = landscapePointAabb(vertices);
  return {
    shape: "trimesh",
    size: aabb.size,
    center: aabb.center,
    vertices,
    indices,
  };
}

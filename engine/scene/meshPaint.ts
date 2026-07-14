/**
 * Placement-scoped vertex-color paint data and CPU paint primitives.
 *
 * Mesh Paint never rewrites the source GLB. A `<layout>.meshpaint.json` sidecar
 * keeps one RGBA array per placed mesh primitive, so another placement of the
 * same asset remains independent. This module intentionally has no Three.js
 * dependency; SceneApp adapts its BufferAttributes to these pure functions.
 */

export type MeshPaintChannel = "r" | "g" | "b" | "a";

export const MESH_PAINT_CHANNELS: readonly MeshPaintChannel[] = ["r", "g", "b", "a"];
const MAX_MESH_PAINT_VERTICES = 2_000_000;

export interface MeshPaintTarget {
  assetId: string;
  placementIndex: number;
  meshName: string;
  primitiveIndex: number;
}

export interface LayoutMeshPaintPlacement {
  target: MeshPaintTarget;
  vertexCount: number;
  /** RGBA floats, one item per vertex, in the range 0..1. */
  colors: number[];
  /** Original local-space vertex positions, retained for reimport repair. */
  positions?: number[];
}

export interface LayoutMeshPaintData {
  schema: 1;
  type: "meshPaint";
  placements: LayoutMeshPaintPlacement[];
}

export interface MeshPaintBrush {
  radius: number;
  strength: number;
  /** Exponent used for the radial falloff curve; 1 is linear. */
  falloff: number;
  color: readonly [number, number, number, number];
  channels: readonly MeshPaintChannel[];
}

export interface MeshPaintStrokeResult {
  colors: Float32Array;
  changedVertices: number;
}

export interface MeshPaintTopologyRepair {
  colors: number[];
  positions: number[];
}

export function createEmptyMeshPaintData(): LayoutMeshPaintData {
  return { schema: 1, type: "meshPaint", placements: [] };
}

/** Returns the sibling sidecar path: `layouts/Foo.level.json` -> `layouts/Foo.meshpaint.json`. */
export function meshPaintDataPath(scenePath: string): string {
  const normalized = scenePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const base = normalized.replace(/(\.level|\.layout)?\.json$/i, "");
  return `${base}.meshpaint.json`;
}

export function meshPaintTargetKey(target: MeshPaintTarget): string {
  return [target.assetId, target.placementIndex, target.meshName, target.primitiveIndex].join("\u0000");
}

export function findMeshPaintPlacement(
  data: LayoutMeshPaintData,
  target: MeshPaintTarget,
): LayoutMeshPaintPlacement | undefined {
  const key = meshPaintTargetKey(target);
  return data.placements.find((placement) => meshPaintTargetKey(placement.target) === key);
}

/** Replaces one primitive's paint data, or appends it when the primitive was not yet painted. */
export function upsertMeshPaintPlacement(
  data: LayoutMeshPaintData,
  placement: LayoutMeshPaintPlacement,
): LayoutMeshPaintData {
  const normalized = normalizeMeshPaintPlacement(placement);
  if (!normalized) return data;
  const key = meshPaintTargetKey(normalized.target);
  const placements = data.placements.filter((entry) => meshPaintTargetKey(entry.target) !== key);
  placements.push(normalized);
  return { schema: 1, type: "meshPaint", placements };
}

/** Removes all painted primitives belonging to one selected placement. */
export function removeMeshPaintPlacement(
  data: LayoutMeshPaintData,
  assetId: string,
  placementIndex: number,
): LayoutMeshPaintData {
  return {
    schema: 1,
    type: "meshPaint",
    placements: data.placements.filter(
      (entry) =>
        entry.target.assetId !== assetId || entry.target.placementIndex !== placementIndex,
    ),
  };
}

/**
 * Normalizes untrusted sidecar data. A color array must match its declared
 * vertex count exactly: accepting a partial array would silently shift colors
 * onto the wrong vertices after a reimport.
 */
export function normalizeMeshPaintData(raw: unknown): LayoutMeshPaintData {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Partial<LayoutMeshPaintData>)
    : {};
  const placements = Array.isArray(source.placements) ? source.placements : [];
  const unique = new Set<string>();
  const normalized: LayoutMeshPaintPlacement[] = [];
  for (const rawPlacement of placements) {
    const placement = normalizeMeshPaintPlacement(rawPlacement);
    if (!placement) continue;
    const key = meshPaintTargetKey(placement.target);
    if (unique.has(key)) continue;
    unique.add(key);
    normalized.push(placement);
  }
  return { schema: 1, type: "meshPaint", placements: normalized };
}

/**
 * Blends a brush colour into vertices within `radius` of the local-space center.
 * The result is a fresh Float32Array so caller-owned geometry can decide when to
 * upload it to the GPU. Alpha is treated exactly like RGB.
 */
export function paintMeshVertexColors(
  positions: ArrayLike<number>,
  existingColors: ArrayLike<number> | null | undefined,
  center: readonly [number, number, number],
  brush: MeshPaintBrush,
): MeshPaintStrokeResult {
  const vertexCount = Math.floor(positions.length / 3);
  const colors = colorBuffer(vertexCount, existingColors);
  const radius = finiteClamp(brush.radius, 0.0001, 100000);
  const strength = finiteClamp(brush.strength, 0, 1);
  const falloff = finiteClamp(brush.falloff, 0.01, 32);
  const channels = new Set(brush.channels.filter((channel) => MESH_PAINT_CHANNELS.includes(channel)));
  if (strength === 0 || channels.size === 0) return { colors, changedVertices: 0 };

  const radiusSquared = radius * radius;
  let changedVertices = 0;
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const positionOffset = vertex * 3;
    const dx = finiteNumber(positions[positionOffset]) - center[0];
    const dy = finiteNumber(positions[positionOffset + 1]) - center[1];
    const dz = finiteNumber(positions[positionOffset + 2]) - center[2];
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > radiusSquared) continue;
    const radialWeight = Math.pow(Math.max(0, 1 - Math.sqrt(distanceSquared) / radius), falloff);
    const amount = strength * radialWeight;
    let changed = false;
    for (const channel of channels) {
      const index = channelIndex(channel);
      const offset = vertex * 4 + index;
      const next = colors[offset]! + (finiteClamp(brush.color[index], 0, 1) - colors[offset]!) * amount;
      if (Math.abs(next - colors[offset]!) > 1e-7) changed = true;
      colors[offset] = next;
    }
    if (changed) changedVertices += 1;
  }
  return { colors, changedVertices };
}

/** Fills just the selected channels, preserving the others for Vertex Weights workflows. */
export function fillMeshVertexColors(
  vertexCount: number,
  existingColors: ArrayLike<number> | null | undefined,
  color: readonly [number, number, number, number],
  channels: readonly MeshPaintChannel[],
): Float32Array {
  const colors = colorBuffer(Math.max(0, Math.floor(vertexCount)), existingColors);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    for (const channel of channels) {
      if (!MESH_PAINT_CHANNELS.includes(channel)) continue;
      colors[vertex * 4 + channelIndex(channel)] = finiteClamp(color[channelIndex(channel)], 0, 1);
    }
  }
  return colors;
}

function normalizeMeshPaintPlacement(raw: unknown): LayoutMeshPaintPlacement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Partial<LayoutMeshPaintPlacement>;
  const target = source.target;
  if (!target || typeof target !== "object") return null;
  const assetId = readNonEmptyString(target.assetId);
  const meshName = readNonEmptyString(target.meshName);
  const placementIndex = readIndex(target.placementIndex);
  const primitiveIndex = readIndex(target.primitiveIndex);
  const vertexCount = readVertexCount(source.vertexCount);
  if (!assetId || !meshName || placementIndex === null || primitiveIndex === null || vertexCount === null) {
    return null;
  }
  if (!Array.isArray(source.colors) || source.colors.length !== vertexCount * 4) return null;
  const colors: number[] = [];
  for (const value of source.colors) {
    if (!Number.isFinite(value)) return null;
    colors.push(finiteClamp(value, 0, 1));
  }
  const positions = normalizePositions(source.positions, vertexCount);
  return {
    target: { assetId, placementIndex, meshName, primitiveIndex },
    vertexCount,
    colors,
    ...(positions ? { positions } : {}),
  };
}

/**
 * Transfers RGBA data from an old primitive to a reimported primitive by its
 * nearest old local-space vertex. Old sidecars without positions cannot be
 * repaired safely and return null instead of guessing from colour order alone.
 */
export function repairMeshPaintTopology(
  source: Pick<LayoutMeshPaintPlacement, "vertexCount" | "colors" | "positions">,
  targetPositions: ArrayLike<number>,
): MeshPaintTopologyRepair | null {
  const sourcePositions = normalizePositions(source.positions, source.vertexCount);
  const targetCount = Math.floor(targetPositions.length / 3);
  if (!sourcePositions || targetCount <= 0 || targetPositions.length !== targetCount * 3) return null;
  if (source.colors.length !== source.vertexCount * 4) return null;
  // A deliberately bounded V1 nearest-neighbour transfer. Larger meshes need a
  // spatial index / barycentric pass rather than a UI-blocking quadratic scan.
  if (source.vertexCount * targetCount > 10_000_000) return null;
  const colors = new Array<number>(targetCount * 4);
  for (let target = 0; target < targetCount; target += 1) {
    const tx = targetPositions[target * 3]!;
    const ty = targetPositions[target * 3 + 1]!;
    const tz = targetPositions[target * 3 + 2]!;
    if (!Number.isFinite(tx) || !Number.isFinite(ty) || !Number.isFinite(tz)) return null;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let candidate = 0; candidate < source.vertexCount; candidate += 1) {
      const dx = sourcePositions[candidate * 3]! - tx;
      const dy = sourcePositions[candidate * 3 + 1]! - ty;
      const dz = sourcePositions[candidate * 3 + 2]! - tz;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    const sourceOffset = nearest * 4;
    const targetOffset = target * 4;
    colors[targetOffset] = finiteClamp(source.colors[sourceOffset], 0, 1);
    colors[targetOffset + 1] = finiteClamp(source.colors[sourceOffset + 1], 0, 1);
    colors[targetOffset + 2] = finiteClamp(source.colors[sourceOffset + 2], 0, 1);
    colors[targetOffset + 3] = finiteClamp(source.colors[sourceOffset + 3], 0, 1);
  }
  return { colors, positions: Array.from(targetPositions) };
}

function normalizePositions(value: unknown, vertexCount: number): number[] | null {
  if (!Array.isArray(value) || value.length !== vertexCount * 3) return null;
  const positions: number[] = [];
  for (const entry of value) {
    if (!Number.isFinite(entry)) return null;
    positions.push(entry);
  }
  return positions;
}

function colorBuffer(vertexCount: number, existing: ArrayLike<number> | null | undefined): Float32Array {
  const colors = new Float32Array(vertexCount * 4);
  if (!existing) return colors;
  for (let index = 0; index < colors.length && index < existing.length; index += 1) {
    colors[index] = finiteClamp(existing[index], 0, 1);
  }
  return colors;
}

function channelIndex(channel: MeshPaintChannel): number {
  if (channel === "g") return 1;
  if (channel === "b") return 2;
  if (channel === "a") return 3;
  return 0;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000
    ? value
    : null;
}

function readVertexCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_MESH_PAINT_VERTICES
    ? value
    : null;
}

function finiteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function finiteClamp(value: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value)));
}

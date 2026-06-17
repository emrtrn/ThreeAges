/**
 * Loads and saves asset-level collision definitions (`*.collision.json`
 * sidecars). Reads are plain static fetches of `public/`; writes go through the
 * dev-only `/__save-collision` endpoint (see vite.config.ts). In a production
 * build the sidecars still load (static), but saving is unavailable.
 */
import {
  COLLISION_COMPLEXITY_VALUES,
  COLLISION_PRESET_IDS,
  COLLISION_PRIMITIVE_SHAPES,
  COLLISION_RESPONSE_VALUES,
  COLLISION_CHANNELS,
  defaultAssetCollisionDef,
  type AssetCollisionDef,
  type CollisionChannel,
  type CollisionComplexity,
  type CollisionPresetId,
  type CollisionPrimitive,
  type CollisionPrimitiveShape,
  type CollisionResponse,
  type CollisionResponseMap,
} from "@engine/scene/collision";
import type { Vec3 } from "@engine/scene/layout";
import { projectFileUrl } from "@/project/ProjectSystem";

/** Maps a model file path to its collision sidecar path. */
export function collisionSidecarPath(modelPath: string): string {
  const normalized = modelPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const withoutExt = normalized.replace(/\.[^./]+$/, "");
  return `${withoutExt}.collision.json`;
}

/**
 * Fetches and parses an asset's collision sidecar. A missing sidecar (404) or a
 * malformed one resolves to a fresh default definition, so callers always get a
 * usable def.
 */
export async function loadAssetCollision(modelPath: string): Promise<AssetCollisionDef> {
  const url = projectFileUrl(collisionSidecarPath(modelPath));
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) return defaultAssetCollisionDef();
    const raw = (await response.json()) as unknown;
    return normalizeAssetCollisionDef(raw);
  } catch {
    return defaultAssetCollisionDef();
  }
}

/** Posts an asset collision definition to the dev save endpoint. */
export async function saveAssetCollision(
  modelPath: string,
  def: AssetCollisionDef,
): Promise<{ path: string; changed: boolean }> {
  const path = collisionSidecarPath(modelPath);
  const response = await fetch("/__save-collision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, collision: def }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Collision save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

function asVec3(value: unknown): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  return [x, y, z];
}

function normalizePrimitive(value: unknown): CollisionPrimitive | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!COLLISION_PRIMITIVE_SHAPES.includes(input.shape as CollisionPrimitiveShape)) return null;
  const size = asVec3(input.size);
  if (!size) return null;
  const primitive: CollisionPrimitive = { shape: input.shape as CollisionPrimitiveShape, size };
  const center = asVec3(input.center);
  if (center) primitive.center = center;
  const rotation = asVec3(input.rotation);
  if (rotation) primitive.rotation = rotation;
  if (Array.isArray(input.points)) {
    const points = input.points.map(asVec3).filter((point): point is Vec3 => point !== undefined);
    if (points.length > 0) primitive.points = points;
  }
  return primitive;
}

function normalizeResponses(value: unknown): CollisionResponseMap | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const responses: CollisionResponseMap = {};
  for (const channel of COLLISION_CHANNELS) {
    const response = input[channel];
    if (COLLISION_RESPONSE_VALUES.includes(response as CollisionResponse)) {
      responses[channel as CollisionChannel] = response as CollisionResponse;
    }
  }
  return Object.keys(responses).length > 0 ? responses : undefined;
}

/** Coerces arbitrary parsed JSON into a valid `AssetCollisionDef`. */
export function normalizeAssetCollisionDef(value: unknown): AssetCollisionDef {
  const def = defaultAssetCollisionDef();
  if (!value || typeof value !== "object") return def;
  const input = value as Record<string, unknown>;
  if (COLLISION_COMPLEXITY_VALUES.includes(input.complexity as CollisionComplexity)) {
    def.complexity = input.complexity as CollisionComplexity;
  }
  if (COLLISION_PRESET_IDS.includes(input.preset as CollisionPresetId)) {
    def.preset = input.preset as CollisionPresetId;
  }
  if (Array.isArray(input.primitives)) {
    def.primitives = input.primitives
      .map(normalizePrimitive)
      .filter((primitive): primitive is CollisionPrimitive => primitive !== null);
  }
  const responses = normalizeResponses(input.responses);
  if (responses) def.responses = responses;
  if (typeof input.physicalMaterialId === "string" && input.physicalMaterialId.length > 0) {
    def.physicalMaterialId = input.physicalMaterialId;
  }
  if (input.doubleSided === true) def.doubleSided = true;
  return def;
}

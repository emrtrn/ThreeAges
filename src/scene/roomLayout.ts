export type Vec3 = [number, number, number];
export type LayoutLightType = "directional" | "point" | "spot";

/**
 * Generic, project-defined gameplay metadata value. The base editor stays
 * schema-agnostic: it stores whatever scalar/list a project's metadata schema
 * declares (e.g. price, comfort, style tags) without knowing the semantics.
 */
export type MetadataValue = string | number | boolean | string[];
export type LayoutMetadata = Record<string, MetadataValue>;

export interface LayoutPlacement {
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Legacy Y-only rotation in degrees. Read as a fallback when `rotation` is absent. */
  rotationYDeg?: number;
  /** Full Euler rotation (XYZ order) in degrees. Preferred over `rotationYDeg`. */
  rotation?: Vec3;
  /**
   * Authoring pivot: a point in the object's local (model) space that rotation
   * and scale gizmos act around. Absent/`[0,0,0]` means the model origin.
   * Editor-only — the baked world transform is what runtime renders.
   */
  pivot?: Vec3;
  /** Uniform scalar (legacy) or per-axis scale. */
  scale?: number | Vec3;
  /** Editor hint: keep scale axes proportional when editing. */
  scaleLocked?: boolean;
  /** Legacy/runtime hint. Editor renderer controls instanced static shadows centrally. */
  castShadow?: boolean;
  /** Runtime hint: object participates in collision. Absent means true (default on). */
  collision?: boolean;
  /** Project-defined gameplay metadata (schema-driven; omitted when empty). */
  metadata?: LayoutMetadata;
}

export interface LayoutModelInstances {
  assetId: string;
  placements: LayoutPlacement[];
}

export interface LayoutCharacter {
  assetId: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Legacy Y-only rotation in degrees. Read as a fallback when `rotation` is absent. */
  rotationYDeg?: number;
  /** Full Euler rotation (XYZ order) in degrees. Preferred over `rotationYDeg`. */
  rotation?: Vec3;
  /**
   * Authoring pivot: a point in the object's local (model) space that rotation
   * and scale gizmos act around. Absent/`[0,0,0]` means the model origin.
   * Editor-only — the baked world transform is what runtime renders.
   */
  pivot?: Vec3;
  /** Uniform scalar (legacy) or per-axis scale. */
  scale?: number | Vec3;
  /** Editor hint: keep scale axes proportional when editing. */
  scaleLocked?: boolean;
  /** Runtime hint: character casts shadows. Absent means true (default on). */
  castShadow?: boolean;
  /** Runtime hint: object participates in collision. Absent means true (default on). */
  collision?: boolean;
  /** Project-defined gameplay metadata (schema-driven; omitted when empty). */
  metadata?: LayoutMetadata;
  animation?: string;
}

export interface LayoutWorldSettings {
  /** Central static/instanced shadow casting. Absent means false. */
  staticObjectsCastShadow?: boolean;
  /** Central static/instanced shadow receiving. Absent means true. */
  staticObjectsReceiveShadow?: boolean;
  /** Scene background color (hex). Absent means the default. */
  backgroundColor?: string;
  /** Ambient light color (hex). Absent means the default white. */
  ambientColor?: string;
  /** Ambient light intensity. Absent means 0 (no ambient). */
  ambientIntensity?: number;
}

export interface LayoutLightActor {
  id: string;
  type: LayoutLightType;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  scaleLocked?: boolean;
  groupId?: string;
  /** Stable id assigned when this object becomes a parent (referenced by children). */
  nodeId?: string;
  /** This object's parent, referencing the parent's `nodeId`. */
  parentId?: string;
  position: Vec3;
  /** Full Euler rotation (XYZ order) in degrees. */
  rotation?: Vec3;
  color?: string;
  intensity?: number;
  castShadow?: boolean;
  distance?: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
}

export interface RoomLayout {
  schema: 1;
  name: string;
  loadGroups: string[];
  worldSettings?: LayoutWorldSettings;
  lights?: LayoutLightActor[];
  instances: LayoutModelInstances[];
  characters: LayoutCharacter[];
}

const BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export async function loadRoomLayout(pathOrName: string): Promise<RoomLayout> {
  // A ".json" value is a public-relative path (served by Vite from public/);
  // a bare name resolves to the bundled layouts/ folder.
  const url = pathOrName.endsWith(".json")
    ? `/${pathOrName.replace(/\\/g, "/").replace(/^\/+/, "")}`
    : `${BASE_URL}layouts/${pathOrName}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Room layout failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as RoomLayout;
}

export function degreesToRadians(degrees: number | undefined): number {
  return ((degrees ?? 0) * Math.PI) / 180;
}

/** Resolves a placement's rotation to a full XYZ Euler vector (degrees). */
export function readRotation(
  source: { rotation?: Vec3; rotationYDeg?: number },
): Vec3 {
  if (source.rotation) {
    return [source.rotation[0], source.rotation[1], source.rotation[2]];
  }
  return [0, source.rotationYDeg ?? 0, 0];
}

/** Resolves a placement's scale (uniform scalar or per-axis) to an XYZ vector. */
export function readScale(source: { scale?: number | Vec3 }): Vec3 {
  const scale = source.scale;
  if (Array.isArray(scale)) return [scale[0], scale[1], scale[2]];
  const value = scale ?? 1;
  return [value, value, value];
}

/** Resolves a placement's local authoring pivot offset; absent means the origin. */
export function readPivot(source: { pivot?: Vec3 }): Vec3 {
  const pivot = source.pivot;
  return pivot ? [pivot[0], pivot[1], pivot[2]] : [0, 0, 0];
}

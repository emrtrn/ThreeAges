export type {
  LayoutCharacter,
  LayoutLightActor,
  LayoutLightType,
  LayoutMetadata,
  LayoutModelInstances,
  LayoutPlacement,
  LayoutWorldSettings,
  MetadataValue,
  RoomLayout,
  Vec3,
} from "@engine/scene/layout";

import type { RoomLayout, Vec3 } from "@engine/scene/layout";

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

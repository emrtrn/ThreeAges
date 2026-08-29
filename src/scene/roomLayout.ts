export type {
  LayoutCharacter,
  LayoutLightActor,
  LayoutLightType,
  LayoutMetadata,
  LayoutModelInstances,
  LayoutPlacement,
  LayoutTargetPoint,
  LayoutWorldSettings,
  MetadataValue,
  RoomLayout,
  Vec3,
} from "@engine/scene/layout";

export {
  degreesToRadians,
  readPivot,
  readRotation,
  readScale,
} from "@engine/scene/transform";

import type { RoomLayout } from "@engine/scene/layout";
import { publicUrl } from "@engine/assets/publicUrl";

type LegacyReflection = {
  hidden?: boolean;
  intensity?: number;
};

type LegacyReflectionLayout = RoomLayout & {
  reflection?: LegacyReflection;
};

export async function loadRoomLayout(pathOrName: string): Promise<RoomLayout> {
  // A ".json" value is a public-relative path (served by Vite from public/);
  // a bare name resolves to the bundled layouts/ folder. Both go through
  // `publicUrl`, so a build served from a subpath resolves them against the
  // page rather than the origin root (see engine/assets/publicUrl.ts).
  const url = pathOrName.endsWith(".json")
    ? publicUrl(pathOrName)
    : publicUrl(`layouts/${pathOrName}.json`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Room layout failed: ${response.status} ${response.statusText}`,
    );
  }
  return normalizeLoadedRoomLayout((await response.json()) as RoomLayout);
}

/**
 * Keeps old saved scenes working after the editor-facing Reflection Environment
 * actor moved under Sky Atmosphere as `skyLightCapture`. The legacy field is
 * intentionally dropped from the in-memory layout so the next save writes only
 * the Sky Atmosphere-owned shape.
 */
export function normalizeLoadedRoomLayout(layout: RoomLayout): RoomLayout {
  const legacy = (layout as LegacyReflectionLayout).reflection;
  const legacyIntensity = legacy?.intensity;
  if (legacy && !legacy.hidden && typeof legacyIntensity === "number" && Number.isFinite(legacyIntensity)) {
    layout.skyAtmosphere ??= {};
    layout.skyAtmosphere.skyLightCapture ??= {};
    layout.skyAtmosphere.skyLightCapture.intensity ??= legacyIntensity;
  }
  delete (layout as LegacyReflectionLayout).reflection;
  return layout;
}

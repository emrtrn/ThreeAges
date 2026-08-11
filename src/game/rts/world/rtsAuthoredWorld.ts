/**
 * RTS wrapper over the generic authored-world loader (assetization Faz E).
 *
 * Keeps the RTS-specific knobs — the project URL resolver and the top-down
 * field's shadow bounds — out of the generic host in `src/scene/authoredWorld.ts`
 * so that stays free of any game constant. It resolves the Level's static
 * instances + lights into a mountable {@link AuthoredWorldHandle}; the marker
 * interpretation lives in {@link ./rtsLevelAdapter}, and mounting/fallback gating
 * lives in {@link RtsApp}.
 */
import { Box3, Vector3, type WebGLRenderer } from "three";
import type { LayoutLightActor, RoomLayout } from "@engine/scene/layout";
import { projectFileUrl } from "@/project/ProjectSystem";
import { buildAuthoredWorld, type AuthoredWorldHandle } from "@/scene/authoredWorld";
import { DEFAULT_SCENE_SUN_ID } from "@/scene/SceneRuntimeCore";
import { RTS_WORLD_HALF_EXTENT } from "./rtsGround";
import type { PlanarReflectionQuality } from "@engine/render-three/planarReflectionSource";

/**
 * Vertical span the field's shadow casters live in: from below the deepest
 * authored terrain to above the tallest structure or tree. Real geometry, not a
 * safety number — {@link fitDirectionalShadowToBounds} fits the frustum to the
 * box's *corners*, so an inflated height tilts into the ortho extent for a low
 * sun and spends shadow-map texels on empty sky. The depth range (`near`/`far`)
 * is derived from the light's own pose, so nothing here has to reserve for it.
 */
const RTS_SHADOW_MIN_Y = -12;
const RTS_SHADOW_MAX_Y = 45;

/**
 * Shadow frustum coverage for the field's sun: the whole playable field. The
 * backdrop art outside the world extent is deliberately excluded — it would
 * enlarge the frustum for shadows that fall behind the map edge anyway.
 */
export const RTS_SHADOW_BOUNDS = new Box3(
  new Vector3(-RTS_WORLD_HALF_EXTENT, RTS_SHADOW_MIN_Y, -RTS_WORLD_HALF_EXTENT),
  new Vector3(RTS_WORLD_HALF_EXTENT, RTS_SHADOW_MAX_Y, RTS_WORLD_HALF_EXTENT),
);

/**
 * The box a match's shadows are fitted to at a given quality coverage scale.
 *
 * At full coverage this is the whole field, so every structure on the map casts
 * regardless of where the player is looking. Below it the box shrinks *around the
 * camera's ground focus* rather than around a fixed world point: a shadow budget
 * spent on the half of the map nobody is looking at is what produced "the port
 * has no shadows". The box keeps its full size at the map edge (it slides rather
 * than clips) so the fitted frustum stays a constant size as the camera pans,
 * which is what lets the texel snap hold the shadow edges still.
 */
export function rtsShadowBounds(focusX: number, focusZ: number, coverageScale: number): Box3 {
  const scale = Math.min(1, Math.max(0.05, coverageScale > 0 ? coverageScale : 1));
  if (scale >= 1) return RTS_SHADOW_BOUNDS;
  const half = RTS_WORLD_HALF_EXTENT * scale;
  const limit = RTS_WORLD_HALF_EXTENT - half;
  const centerX = Math.min(limit, Math.max(-limit, focusX));
  const centerZ = Math.min(limit, Math.max(-limit, focusZ));
  return new Box3(
    new Vector3(centerX - half, RTS_SHADOW_MIN_Y, centerZ - half),
    new Vector3(centerX + half, RTS_SHADOW_MAX_Y, centerZ + half),
  );
}

/** Whether a Level authors any static world worth mounting (instances, lights or terrain). */
export function levelHasAuthoredWorld(layout: RoomLayout): boolean {
  const hasInstances = layout.instances.some((instance) => instance.placements.length > 0);
  const hasLights = (layout.lights ?? []).length > 0;
  const hasLandscape = (layout.landscapes ?? []).length > 0;
  return hasInstances || hasLights || hasLandscape;
}

/** Whether a Level authors its own directional sun (drives the code-sun swap). */
export function levelHasAuthoredSun(layout: RoomLayout): boolean {
  return (layout.lights ?? []).some((light) => light.type === "directional");
}

/**
 * The Level's directional sun actor (first directional light), or null. Its
 * persisted rotation is what {@link AuthoredEnvironment} uses to orient the Sky
 * Atmosphere sun disc + Sky Light capture, so Play matches the editor.
 */
export function levelAuthoredSun(layout: RoomLayout): LayoutLightActor | null {
  const lights = layout.lights ?? [];
  // Same precedence as `RuntimeSceneApp.sunLightActor`: the canonical scene sun
  // wins over layout order, and only then does "first directional" decide. A Level
  // with a second directional light (a fill, a moon) would otherwise orient the sky
  // dome's sun disc and the Sky Light capture off whichever one happens to sit
  // first in the array — and that order is a save-file detail, not an authoring
  // decision, so the editor and the match could disagree on where the sun is.
  return (
    lights.find((light) => light.type === "directional" && light.id === DEFAULT_SCENE_SUN_ID) ??
    lights.find((light) => light.type === "directional") ??
    null
  );
}

/**
 * Builds the RTS field's authored static world from a resolved Level layout.
 *
 * `levelPath` is the Level's public-relative path — it is what lets the host find
 * the sidecars keyed off the Level file (the painted `<level>.foliage.json`),
 * which the layout alone does not name. Omitting it mounts the world without them.
 */
export function loadRtsAuthoredWorld(
  layout: RoomLayout,
  renderer: WebGLRenderer,
  onWarn?: (message: string, error?: unknown) => void,
  levelPath?: string,
  /** Boot-curtain progress; see `AuthoredWorldOptions.onProgress`. */
  onProgress?: (loaded: number, total: number) => void,
  riverReflectionQuality?: PlanarReflectionQuality | null,
): Promise<AuthoredWorldHandle> {
  return buildAuthoredWorld({
    layout,
    renderer,
    resolveUrl: (path) => projectFileUrl(path),
    shadowBounds: RTS_SHADOW_BOUNDS,
    ...(onWarn ? { onWarn } : {}),
    ...(levelPath ? { levelPath } : {}),
    ...(onProgress ? { onProgress } : {}),
    ...(riverReflectionQuality !== undefined ? { riverReflectionQuality } : {}),
  });
}

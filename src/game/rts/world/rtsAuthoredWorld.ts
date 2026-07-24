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
import { RTS_WORLD_HALF_EXTENT } from "./rtsGround";

/**
 * Shadow frustum coverage for the field's sun. The X/Z extent spans the whole
 * playable field; the tall Y extent exists only to size the ortho `far` plane,
 * which {@link fitDirectionalShadowToBounds} derives from the box height — the
 * authored sun sits high above the field (y ≈ 80), so a short far would clip its
 * shadows away. This reproduces the legacy code sun's ~260-unit depth range.
 */
const RTS_SHADOW_BOUNDS = new Box3(
  new Vector3(-RTS_WORLD_HALF_EXTENT, -2, -RTS_WORLD_HALF_EXTENT),
  new Vector3(RTS_WORLD_HALF_EXTENT, 220, RTS_WORLD_HALF_EXTENT),
);

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
  return (layout.lights ?? []).find((light) => light.type === "directional") ?? null;
}

/** Builds the RTS field's authored static world from a resolved Level layout. */
export function loadRtsAuthoredWorld(
  layout: RoomLayout,
  renderer: WebGLRenderer,
  onWarn?: (message: string, error?: unknown) => void,
): Promise<AuthoredWorldHandle> {
  return buildAuthoredWorld({
    layout,
    renderer,
    resolveUrl: (path) => projectFileUrl(path),
    shadowBounds: RTS_SHADOW_BOUNDS,
    ...(onWarn ? { onWarn } : {}),
  });
}

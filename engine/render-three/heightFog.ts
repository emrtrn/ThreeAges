import { Fog, FogExp2, type Scene } from "three";

import type { ResolvedHeightFog } from "@engine/scene/heightFog";

export {
  resolveHeightFog,
  HEIGHT_FOG_DEFAULTS,
  type HeightFogMode,
  type ResolvedHeightFog,
} from "@engine/scene/heightFog";

/**
 * Exponential Height Fog render binding (Faz 1). Sets/clears `scene.fog`, which
 * three.js applies automatically to every lit/fog-aware material — no per-mesh or
 * per-frame work is needed. `exp` mode uses `FogExp2` (exponential with distance,
 * the closest built-in to Unreal's exponential fog); `linear` mode uses `Fog`
 * (near/far). A hidden or absent fog clears `scene.fog`.
 *
 * This is distance-based, not world-height-based: true height falloff would need
 * a custom fog shader (Faz 2). Kept deliberately small so the editor and runtime
 * share one render path.
 */
export function applySceneFog(scene: Scene, resolved: ResolvedHeightFog | null): void {
  if (!resolved || resolved.hidden) {
    scene.fog = null;
    return;
  }
  scene.fog =
    resolved.mode === "linear"
      ? new Fog(resolved.color, resolved.start, resolved.end)
      : new FogExp2(resolved.color, resolved.density);
}

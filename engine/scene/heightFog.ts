import type { LayoutHeightFog } from "./layout";

/**
 * Render-agnostic Exponential Height Fog model: resolved settings + defaults,
 * shared by the editor view-models and the three.js render binding
 * (`engine/render-three/heightFog.ts`). Kept free of three.js so editor core and
 * the save validator can read it without pulling in the renderer.
 *
 * Faz 1 is a distance-based scene fog (à la Unreal's Exponential Height Fog, but
 * without true world-height falloff): `exp` mode maps to three's `FogExp2`
 * (exponential with distance) and `linear` mode to `Fog` (near/far). Density and
 * start/end are tuned to the small (~100u) scene scale. True height-based falloff
 * is Faz 2 (a custom fog shader) and intentionally not modeled here.
 */
export type HeightFogMode = "exp" | "linear";

export interface ResolvedHeightFog {
  name: string;
  hidden: boolean;
  /** `exp` = FogExp2 (density), `linear` = Fog (start/end). */
  mode: HeightFogMode;
  /** Fog inscattering color (hex). */
  color: string;
  /** Exponential density (exp mode); tuned to the ~100u scene scale. */
  density: number;
  /** Linear fog near distance (linear mode). */
  start: number;
  /** Linear fog far distance (linear mode). */
  end: number;
}

export const HEIGHT_FOG_DEFAULTS: ResolvedHeightFog = {
  name: "Exponential Height Fog",
  hidden: false,
  mode: "exp",
  color: "#bcc6d1",
  density: 0.03,
  start: 5,
  end: 60,
};

/** Fills every Height Fog field with its default, decoupled from the layout. */
export function resolveHeightFog(
  actor: LayoutHeightFog | null | undefined,
): ResolvedHeightFog {
  const defaults = HEIGHT_FOG_DEFAULTS;
  if (!actor) return { ...defaults };
  return {
    name: actor.name ?? defaults.name,
    hidden: actor.hidden ?? defaults.hidden,
    mode: actor.mode ?? defaults.mode,
    color: actor.color ?? defaults.color,
    density: actor.density ?? defaults.density,
    start: actor.start ?? defaults.start,
    end: actor.end ?? defaults.end,
  };
}

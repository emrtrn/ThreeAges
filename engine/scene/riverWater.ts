import type { LayoutRiverWater } from "./layout";

/** Resolved presentation settings for a spline-driven River Water Body. */
export interface ResolvedRiverWater {
  id: string;
  name: string;
  hidden: boolean;
  landscapeRef: string;
  splineRef: string;
  surfaceLevel: number;
  widthScale: number;
  flowSpeed: number;
  normalScale: number;
  normalTexture: string;
  deepColor: string;
  shallowColor: string;
  opacity: number;
  waveAmplitude: number;
  waveLength: number;
  foamIntensity: number;
}

export const RIVER_WATER_DEFAULTS: ResolvedRiverWater = {
  id: "river-water",
  name: "River Water",
  hidden: false,
  landscapeRef: "",
  splineRef: "",
  surfaceLevel: 0,
  widthScale: 1,
  flowSpeed: 0.35,
  normalScale: 1,
  normalTexture: "t-water-n",
  deepColor: "#063447",
  shallowColor: "#2f8b91",
  opacity: 0.82,
  waveAmplitude: 0.04,
  waveLength: 3.5,
  foamIntensity: 0.55,
};

/** Fills optional River Water Body presentation fields without inspecting the spline. */
export function resolveRiverWater(actor: LayoutRiverWater | null | undefined): ResolvedRiverWater {
  const defaults = RIVER_WATER_DEFAULTS;
  return {
    id: actor?.id ?? defaults.id,
    name: actor?.name?.trim() || defaults.name,
    hidden: actor?.hidden === true,
    landscapeRef: actor?.landscapeRef ?? defaults.landscapeRef,
    splineRef: actor?.splineRef ?? defaults.splineRef,
    surfaceLevel: actor?.surfaceLevel ?? defaults.surfaceLevel,
    widthScale: actor?.widthScale ?? defaults.widthScale,
    flowSpeed: actor?.flowSpeed ?? defaults.flowSpeed,
    normalScale: actor?.normalScale ?? defaults.normalScale,
    normalTexture: actor?.normalTexture?.trim() || defaults.normalTexture,
    deepColor: actor?.deepColor ?? defaults.deepColor,
    shallowColor: actor?.shallowColor ?? defaults.shallowColor,
    opacity: actor?.opacity ?? defaults.opacity,
    waveAmplitude: actor?.waveAmplitude ?? defaults.waveAmplitude,
    waveLength: actor?.waveLength ?? defaults.waveLength,
    foamIntensity: actor?.foamIntensity ?? defaults.foamIntensity,
  };
}

export function uniqueRiverWaterId(waters: readonly LayoutRiverWater[]): string {
  const ids = new Set(waters.map((water) => water.id));
  let index = 1;
  while (ids.has(`river-water-${index}`)) index += 1;
  return `river-water-${index}`;
}

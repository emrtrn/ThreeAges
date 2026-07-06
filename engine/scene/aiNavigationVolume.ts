import type { LayoutAiNavigationVolume, Vec3 } from "./layout";
import { rotatedBoxAabb, type BoxAabb } from "../physics/rotatedBox";

export interface ResolvedAiNavigationVolume {
  name: string;
  hidden: boolean;
  size: Vec3;
  color: string;
}

export const AI_NAVIGATION_VOLUME_DEFAULT_SIZE: Vec3 = [10, 4, 10];

export const AI_NAVIGATION_VOLUME_DEFAULTS: ResolvedAiNavigationVolume = {
  name: "AI Navigation Volume",
  hidden: false,
  size: [...AI_NAVIGATION_VOLUME_DEFAULT_SIZE],
  color: "#3f86ff",
};

export function resolveAiNavigationVolume(
  volume: LayoutAiNavigationVolume | null | undefined,
): ResolvedAiNavigationVolume {
  const defaults = AI_NAVIGATION_VOLUME_DEFAULTS;
  if (!volume) return { ...defaults, size: [...defaults.size] };
  return {
    name: volume.name ?? defaults.name,
    hidden: volume.hidden ?? defaults.hidden,
    size: volume.size ? saneSize(volume.size) : [...defaults.size],
    color: volume.color ?? defaults.color,
  };
}

export function uniqueAiNavigationVolumeId(volumes: readonly LayoutAiNavigationVolume[]): string {
  const existing = new Set(volumes.map((volume) => volume.id));
  let index = 1;
  while (existing.has(`ai-navigation-volume-${index}`)) index += 1;
  return `ai-navigation-volume-${index}`;
}

export function uniqueAiNavigationVolumeName(
  baseName: string,
  volumes: readonly LayoutAiNavigationVolume[],
): string {
  const existing = new Set(volumes.map((volume) => volume.name ?? volume.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

export function aiNavigationVolumeAabb(volume: LayoutAiNavigationVolume): BoxAabb | null {
  if (volume.hidden === true) return null;
  const resolved = resolveAiNavigationVolume(volume);
  const scale = readVolumeScale(volume.scale);
  const half: Vec3 = [
    Math.max(0.001, resolved.size[0] * scale[0]) / 2,
    Math.max(0.001, resolved.size[1] * scale[1]) / 2,
    Math.max(0.001, resolved.size[2] * scale[2]) / 2,
  ];
  return rotatedBoxAabb(volume.position, [0, 0, 0], half, volume.rotation ?? [0, 0, 0]);
}

export function readVolumeScale(scale: number | Vec3 | undefined): Vec3 {
  if (Array.isArray(scale)) {
    return [
      finitePositive(scale[0], 1),
      finitePositive(scale[1], 1),
      finitePositive(scale[2], 1),
    ];
  }
  const uniform = finitePositive(scale, 1);
  return [uniform, uniform, uniform];
}

function saneSize(size: Vec3): Vec3 {
  return [
    finitePositive(size[0], AI_NAVIGATION_VOLUME_DEFAULT_SIZE[0]),
    finitePositive(size[1], AI_NAVIGATION_VOLUME_DEFAULT_SIZE[1]),
    finitePositive(size[2], AI_NAVIGATION_VOLUME_DEFAULT_SIZE[2]),
  ];
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

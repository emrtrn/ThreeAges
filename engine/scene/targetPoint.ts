import type { LayoutTargetPoint } from "./layout";

export interface ResolvedTargetPoint {
  name: string;
  hidden: boolean;
  startPoint: boolean;
  waitTime: number;
  acceptanceRadius: number;
  speedOverride: number | null;
  patrolTag: string;
  color: string;
}

export const TARGET_POINT_DEFAULT_COLOR = "#f5c542";

export const TARGET_POINT_DEFAULTS: ResolvedTargetPoint = {
  name: "Target Point",
  hidden: false,
  startPoint: false,
  waitTime: 0,
  acceptanceRadius: 0.5,
  speedOverride: null,
  patrolTag: "",
  color: TARGET_POINT_DEFAULT_COLOR,
};

export function resolveTargetPoint(
  point: LayoutTargetPoint | null | undefined,
): ResolvedTargetPoint {
  const defaults = TARGET_POINT_DEFAULTS;
  if (!point) return { ...defaults };
  return {
    name: point.name ?? defaults.name,
    hidden: point.hidden ?? defaults.hidden,
    startPoint: point.startPoint ?? defaults.startPoint,
    waitTime: finiteNonNegative(point.waitTime, defaults.waitTime),
    acceptanceRadius: finitePositive(point.acceptanceRadius, defaults.acceptanceRadius),
    speedOverride:
      typeof point.speedOverride === "number" &&
      Number.isFinite(point.speedOverride) &&
      point.speedOverride > 0
        ? point.speedOverride
        : defaults.speedOverride,
    patrolTag: point.patrolTag ?? defaults.patrolTag,
    color: point.color ?? defaults.color,
  };
}

export function uniqueTargetPointId(points: readonly LayoutTargetPoint[]): string {
  const existing = new Set(points.map((point) => point.id));
  let index = 1;
  while (existing.has(`target-point-${index}`)) index += 1;
  return `target-point-${index}`;
}

export function uniqueTargetPointName(
  baseName: string,
  points: readonly LayoutTargetPoint[],
): string {
  const existing = new Set(points.map((point) => point.name ?? point.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

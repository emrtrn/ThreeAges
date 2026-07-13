import type { LayoutSplineActor } from "./layout";
import { createDefaultSplineComponentData, normalizeSplineComponentData } from "./spline";

export const SPLINE_ACTOR_DEFAULT_COLOR = "#4fd1ff";
export const SPLINE_ACTOR_DEFAULT_RESOLUTION = 16;

export interface ResolvedSplineActorDebug {
  visible: boolean;
  color: string;
  resolution: number;
}

export function resolveSplineActorDebug(actor: LayoutSplineActor | null | undefined): ResolvedSplineActorDebug {
  const debug = actor?.debug;
  return {
    visible: debug?.visible ?? true,
    color: typeof debug?.color === "string" && /^#[0-9a-f]{6}$/i.test(debug.color)
      ? debug.color
      : SPLINE_ACTOR_DEFAULT_COLOR,
    resolution: clampInteger(debug?.resolution, 2, 128, SPLINE_ACTOR_DEFAULT_RESOLUTION),
  };
}

export function createDefaultSplineActor(points: readonly LayoutSplineActor[] = []): LayoutSplineActor {
  const id = uniqueSplineActorId(points);
  return {
    id,
    name: uniqueSplineActorName("Spline", points),
    position: [0, 0, 0],
    spline: createDefaultSplineComponentData(),
  };
}

export function normalizeSplineActor(actor: LayoutSplineActor): LayoutSplineActor {
  const normalized: LayoutSplineActor = {
    ...actor,
    position: [...actor.position],
    spline: normalizeSplineComponentData(actor.spline),
  };
  if (actor.rotation) normalized.rotation = [...actor.rotation];
  if (actor.scale !== undefined) normalized.scale = Array.isArray(actor.scale) ? [...actor.scale] : actor.scale;
  if (actor.debug) normalized.debug = { ...resolveSplineActorDebug(actor) };
  return normalized;
}

export function cloneSplineActor(actor: LayoutSplineActor): LayoutSplineActor {
  return normalizeSplineActor(actor);
}

export function uniqueSplineActorId(actors: readonly LayoutSplineActor[]): string {
  const existing = new Set(actors.map((actor) => actor.id));
  let index = 1;
  while (existing.has(`spline-${index}`)) index += 1;
  return `spline-${index}`;
}

export function uniqueSplineActorName(baseName: string, actors: readonly LayoutSplineActor[]): string {
  const existing = new Set(actors.map((actor) => actor.name ?? actor.id));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

/**
 * Runtime-owned index for generic Spline Actors.
 *
 * The registry deliberately stays independent from Three.js and game systems:
 * Play builds it once from the authored layout, while later query/follower
 * systems consume the cached curve without touching editor data or render
 * objects.
 */
import type { LayoutSplineActor } from "./layout";
import type { ForgeSplinePoint } from "./spline";
import {
  buildSplineCurveCache,
  getSplineDirectionAtDistance,
  getSplineLocationAtDistance,
  getSplineTangentAtDistance,
  type SplineCurveCache,
} from "./splineCurve";
import {
  getSplineRotationAtDistance,
  getSplineTransformAtDistance,
  type Quat,
  type SplineQuerySpace,
  type SplineTransformSample,
} from "./splineFrame";
import { normalizeSplineActor } from "./splineActor";
import { readRotation, readScale, rotateVectorByEulerDegrees } from "./transform";

export interface RuntimeSplineEntry {
  readonly id: string;
  /** Normalized, independent snapshot of the authored actor. */
  readonly actor: LayoutSplineActor;
  /** Arc-length cache reused by the Phase 6 query and path-follower APIs. */
  readonly curve: SplineCurveCache;
  readonly query: SplineQuery;
}

/** Read-only runtime facade. Consumers never receive the mutable layout actor. */
export interface SplineQuery {
  readonly id: string;
  getLength(): number;
  isClosed(): boolean;
  getLocationAtDistance(distance: number, space?: SplineQuerySpace): [number, number, number];
  getDirectionAtDistance(distance: number, space?: SplineQuerySpace): [number, number, number];
  getTangentAtDistance(distance: number, space?: SplineQuerySpace): [number, number, number];
  getRotationAtDistance(distance: number, space?: SplineQuerySpace): Quat;
  getTransformAtDistance(distance: number, space?: SplineQuerySpace): SplineTransformSample;
  getClosestDistanceToPoint(point: readonly [number, number, number], space?: SplineQuerySpace): number;
  getPointCount(): number;
  getPoint(index: number): Readonly<ForgeSplinePoint> | null;
}

export interface SplineRegistry {
  get(id: string | null | undefined): RuntimeSplineEntry | null;
  all(): readonly RuntimeSplineEntry[];
  getSplineById(id: string | null | undefined): SplineQuery | null;
  getSplinesByTag(tag: string | null | undefined): readonly SplineQuery[];
}

/**
 * Indexes authored splines in layout order. Empty or duplicate ids are skipped
 * so a hand-edited layout cannot make Play startup fail or create ambiguous
 * runtime references.
 */
export function createSplineRegistry(
  actors?: readonly LayoutSplineActor[],
): SplineRegistry {
  const byId = new Map<string, RuntimeSplineEntry>();
  const ordered: RuntimeSplineEntry[] = [];
  const byTag = new Map<string, SplineQuery[]>();
  for (const source of actors ?? []) {
    if (!source.id || byId.has(source.id)) continue;
    const actor = normalizeSplineActor(source);
    const curve = buildSplineCurveCache(actor.spline);
    const query = createSplineQuery(actor, curve);
    const entry: RuntimeSplineEntry = {
      id: actor.id,
      actor,
      curve,
      query,
    };
    byId.set(entry.id, entry);
    ordered.push(entry);
    for (const tag of actor.runtime?.tags ?? []) {
      const queries = byTag.get(tag) ?? [];
      queries.push(query);
      byTag.set(tag, queries);
    }
  }
  return {
    get: (id) => (id ? byId.get(id) ?? null : null),
    all: () => ordered,
    getSplineById: (id) => (id ? byId.get(id)?.query ?? null : null),
    getSplinesByTag: (tag) => (tag ? byTag.get(tag) ?? [] : []),
  };
}

function createSplineQuery(actor: LayoutSplineActor, curve: SplineCurveCache): SplineQuery {
  const sample = (distance: number, space: SplineQuerySpace) =>
    getSplineTransformAtDistance(curve, distance, space, actor);
  return {
    id: actor.id,
    getLength: () => curve.totalLength,
    isClosed: () => curve.spline.closed,
    getLocationAtDistance: (distance, space = "world") => {
      if (space === "local") return getSplineLocationAtDistance(curve, distance);
      return sample(distance, space).position;
    },
    getDirectionAtDistance: (distance, space = "world") => {
      if (space === "local") return getSplineDirectionAtDistance(curve, distance);
      return sample(distance, space).frame.tangent;
    },
    getTangentAtDistance: (distance, space = "world") => {
      const tangent = getSplineTangentAtDistance(curve, distance);
      if (space === "local") return tangent;
      const scale = readScale(actor);
      return rotateVectorByEulerDegrees(
        [tangent[0] * scale[0], tangent[1] * scale[1], tangent[2] * scale[2]],
        readRotation(actor),
      );
    },
    getRotationAtDistance: (distance, space = "world") => getSplineRotationAtDistance(curve, distance, space, actor),
    getTransformAtDistance: (distance, space = "world") => sample(distance, space),
    getClosestDistanceToPoint: (point, space = "world") => closestDistance(curve, actor, point, space),
    getPointCount: () => curve.spline.points.length,
    getPoint: (index) => {
      const point = curve.spline.points[index];
      if (!point) return null;
      return {
        ...point,
        position: [...point.position],
        ...(point.arriveTangent ? { arriveTangent: [...point.arriveTangent] } : {}),
        ...(point.leaveTangent ? { leaveTangent: [...point.leaveTangent] } : {}),
        ...(point.scale ? { scale: [...point.scale] as [number, number] } : {}),
        ...(point.metadata ? { metadata: { ...point.metadata } } : {}),
      };
    },
  };
}

/** Projects onto the cached polyline; exact enough for the Phase 6 closest-path API. */
function closestDistance(
  curve: SplineCurveCache,
  actor: LayoutSplineActor,
  point: readonly [number, number, number],
  space: SplineQuerySpace,
): number {
  let bestDistance = 0;
  let bestError = Infinity;
  for (const segment of curve.segments) {
    for (let index = 1; index < segment.samples.length; index += 1) {
      const before = segment.samples[index - 1]!;
      const after = segment.samples[index]!;
      const start = getSplineTransformAtDistance(curve, segment.startDistance + before.distance, space, actor).position;
      const end = getSplineTransformAtDistance(curve, segment.startDistance + after.distance, space, actor).position;
      const delta: [number, number, number] = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
      const lengthSquared = delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2;
      const projection = lengthSquared > 1e-10
        ? Math.max(0, Math.min(1, ((point[0] - start[0]) * delta[0] + (point[1] - start[1]) * delta[1] + (point[2] - start[2]) * delta[2]) / lengthSquared))
        : 0;
      const nearest: [number, number, number] = [start[0] + delta[0] * projection, start[1] + delta[1] * projection, start[2] + delta[2] * projection];
      const error = (point[0] - nearest[0]) ** 2 + (point[1] - nearest[1]) ** 2 + (point[2] - nearest[2]) ** 2;
      if (error < bestError) {
        bestError = error;
        bestDistance = segment.startDistance + before.distance + (after.distance - before.distance) * projection;
      }
    }
  }
  return bestDistance;
}

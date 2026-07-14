import type { ForgeLandscapeSpline, ForgeLandscapeSplineSegment } from "./landscape";
import type { Vec3 } from "./layout";
import type { ForgeSplineComponentData } from "./spline";
import { evaluateSplineSegment } from "./splineCurve";

/**
 * Adapts one Landscape-owned directed segment to the renderer-independent
 * Generic Spline curve contract. It is intentionally a copy, never a linked
 * reference: terrain width/falloff, paint and deformation remain Landscape data.
 */
export function landscapeSplineSegmentComponent(
  spline: ForgeLandscapeSpline,
  segment: ForgeLandscapeSplineSegment,
): ForgeSplineComponentData | null {
  const points = new Map(spline.points.map((point) => [point.id, point] as const));
  const start = points.get(segment.startPointId);
  const end = points.get(segment.endPointId);
  if (!start || !end) return null;
  const smooth = spline.smooth === true;
  const beforeStart = neighbourPosition(spline, points, start.id, end.id) ?? reflect(start.position, end.position);
  const afterEnd = neighbourPosition(spline, points, end.id, start.id) ?? reflect(end.position, start.position);
  const startPoint = smooth
    ? { id: `${segment.id}:start`, position: clone(start.position), pointType: "curveCustom" as const, leaveTangent: scale(subtract(end.position, beforeStart), 0.5) }
    : { id: `${segment.id}:start`, position: clone(start.position), pointType: "linear" as const };
  const endPoint = smooth
    ? { id: `${segment.id}:end`, position: clone(end.position), pointType: "curveCustom" as const, arriveTangent: scale(subtract(afterEnd, start.position), 0.5) }
    : { id: `${segment.id}:end`, position: clone(end.position), pointType: "linear" as const };
  return { schema: 1, closed: false, defaultUp: [0, 1, 0], reparamStepsPerSegment: 8, points: [startPoint, endPoint] };
}

/** Samples a Landscape segment through Generic Spline Hermite evaluation. */
export function evaluateLandscapeSplineSegment(
  spline: ForgeLandscapeSpline,
  segment: ForgeLandscapeSplineSegment,
  t: number,
): Vec3 | null {
  const component = landscapeSplineSegmentComponent(spline, segment);
  return component ? evaluateSplineSegment(component, 0, t).position : null;
}

function neighbourPosition(
  spline: ForgeLandscapeSpline,
  points: ReadonlyMap<string, { position: Vec3 }>,
  pointId: string,
  excludeId: string,
): Vec3 | null {
  const neighbour = spline.segments
    .flatMap((segment) => segment.startPointId === pointId ? [segment.endPointId] : segment.endPointId === pointId ? [segment.startPointId] : [])
    .find((id) => id !== excludeId && points.has(id));
  return neighbour ? points.get(neighbour)?.position ?? null : null;
}

function clone(value: Vec3): Vec3 { return [...value]; }
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scale(value: Vec3, amount: number): Vec3 { return [value[0] * amount, value[1] * amount, value[2] * amount]; }
function reflect(pivot: Vec3, other: Vec3): Vec3 { return [pivot[0] * 2 - other[0], pivot[1] * 2 - other[1], pivot[2] * 2 - other[2]]; }

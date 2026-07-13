import { BufferGeometry, Color, Float32BufferAttribute, Group, Line, LineBasicMaterial } from "three";

import type { LayoutSplineActor, Vec3 } from "@engine/scene/layout";
import { buildSplineCurveCache } from "@engine/scene/splineCurve";
import { getSplineTransformAtDistance } from "@engine/scene/splineFrame";
import { resolveSplineActorDebug } from "@engine/scene/splineActor";

export type SplineObject = Group;

export function createSplineObject(actor: LayoutSplineActor): SplineObject {
  const group = new Group();
  group.userData.splineActor = true;
  updateSplineObject(group, actor);
  return group;
}

/** Rebuilds the owned line resources. Call disposeSplineObject before removal. */
export function updateSplineObject(object: SplineObject, actor: LayoutSplineActor): void {
  disposeSplineObjectChildren(object);
  const debug = resolveSplineActorDebug(actor);
  object.name = actor.name ?? actor.id;
  object.visible = !actor.hidden && debug.visible;
  if (!object.visible) return;

  const cache = buildSplineCurveCache(actor.spline);
  if (cache.totalLength <= 0 || cache.segments.length === 0) return;
  const sampleCount = Math.max(2, cache.segments.length * debug.resolution + 1);
  const positions: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const distance = cache.totalLength * (index / (sampleCount - 1));
    const sample = getSplineTransformAtDistance(cache, distance, "world", actor);
    positions.push(sample.position[0], sample.position[1], sample.position[2]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: new Color(debug.color),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
  });
  const line = new Line(geometry, material);
  line.name = "spline-debug-line";
  object.add(line);
}

export function disposeSplineObject(object: SplineObject): void {
  disposeSplineObjectChildren(object);
}

function disposeSplineObjectChildren(object: SplineObject): void {
  for (const child of [...object.children]) {
    object.remove(child);
    const line = child as Line<BufferGeometry, LineBasicMaterial>;
    line.geometry?.dispose();
    line.material?.dispose();
  }
}

/** Pure helper exposed for renderer-focused engine checks. */
export function splineDebugWorldPolyline(actor: LayoutSplineActor, resolution?: number): Vec3[] {
  const cache = buildSplineCurveCache(actor.spline);
  if (cache.totalLength <= 0 || cache.segments.length === 0) return [];
  const steps = Math.max(2, cache.segments.length * (resolution ?? resolveSplineActorDebug(actor).resolution) + 1);
  return Array.from({ length: steps }, (_, index) =>
    getSplineTransformAtDistance(cache, cache.totalLength * (index / (steps - 1)), "world", actor).position,
  );
}

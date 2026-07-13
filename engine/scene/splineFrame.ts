import type { Vec3 } from "./layout";
import { rotateVectorByEulerDegrees } from "./transform";
import { sampleSplineAtDistance, type SplineCurveCache } from "./splineCurve";

const EPSILON = 1e-8;

export type Quat = [number, number, number, number];
export type SplineQuerySpace = "local" | "world";

export interface SplineFrame {
  position: Vec3;
  /** Local +Z / world forward axis. */
  tangent: Vec3;
  /** Local +Y / world up axis. */
  normal: Vec3;
  /** Local +X / world right axis. */
  binormal: Vec3;
  rotation: Quat;
  /** Interpolated point cross-section scale (right, up). */
  scale: [number, number];
  /** Interpolated roll in degrees. */
  roll: number;
}

export interface SplineActorTransform {
  position?: Vec3;
  /** Forge XYZ Euler rotation in degrees. */
  rotation?: Vec3;
  scale?: number | Vec3;
}

export interface SplineTransformSample {
  position: Vec3;
  rotation: Quat;
  scale: [number, number];
  frame: SplineFrame;
}

/** Returns a local frame. `defaultUp` is used as a hint, not an unsafe fixed axis. */
export function getSplineFrameAtDistance(cache: SplineCurveCache, distance: number): SplineFrame {
  const sample = sampleSplineAtDistance(cache, distance);
  const points = cache.spline.points;
  const start = points[sample.segmentIndex];
  const end = points.length > 0 ? points[(sample.segmentIndex + 1) % points.length] : undefined;
  const roll = lerp(start?.roll ?? 0, end?.roll ?? start?.roll ?? 0, sample.t);
  const scale = lerpScale(start?.scale ?? [1, 1], end?.scale ?? start?.scale ?? [1, 1], sample.t);
  return createSplineFrame(sample.position, sample.direction, cache.spline.defaultUp, roll, scale);
}

export function getSplineRotationAtDistance(
  cache: SplineCurveCache,
  distance: number,
  space: SplineQuerySpace = "local",
  actorTransform?: SplineActorTransform,
): Quat {
  return getSplineTransformAtDistance(cache, distance, space, actorTransform).rotation;
}

export function getSplineTransformAtDistance(
  cache: SplineCurveCache,
  distance: number,
  space: SplineQuerySpace = "local",
  actorTransform?: SplineActorTransform,
): SplineTransformSample {
  const local = getSplineFrameAtDistance(cache, distance);
  const frame = space === "world" ? transformSplineFrameToWorld(local, actorTransform) : local;
  return { position: frame.position, rotation: frame.rotation, scale: [...frame.scale], frame };
}

/** Applies actor scale, Forge Euler rotation, then translation to a local frame. */
export function transformSplineFrameToWorld(frame: SplineFrame, actorTransform?: SplineActorTransform): SplineFrame {
  const position = actorTransform?.position ?? [0, 0, 0];
  const rotation = actorTransform?.rotation ?? [0, 0, 0];
  const scale = actorScale(actorTransform?.scale);
  const transformedPosition = add(rotateVectorByEulerDegrees(multiply(frame.position, scale), rotation), position);
  const tangent = normalize(rotateVectorByEulerDegrees(multiply(frame.tangent, scale), rotation), [0, 0, 1]);
  const upHint = rotateVectorByEulerDegrees(multiply(frame.normal, scale), rotation);
  return createSplineFrame(transformedPosition, tangent, upHint, 0, frame.scale, frame.roll);
}

/** Reorients a frame to travel in the opposite direction while preserving its up axis. */
export function reverseSplineFrame(frame: SplineFrame): SplineFrame {
  return frameFromAxes(
    frame.position,
    negate(frame.tangent),
    frame.normal,
    negate(frame.binormal),
    frame.roll,
    frame.scale,
  );
}

/**
 * The MVP uses a default-up frame with a parallel-axis fallback. This is stable
 * for ordinary horizontal, sloped and vertical splines. Long 3D loops can still
 * accumulate a visible twist; Phase 12 should introduce parallel transport by
 * carrying the preceding frame's normal through the sample chain.
 */
export const SPLINE_FRAME_TRANSPORT_DESIGN_NOTE = "default-up fallback now; parallel transport for long 3D loops in Phase 12";

function createSplineFrame(
  position: Vec3,
  rawTangent: Vec3,
  rawUp: Vec3,
  rollDegrees: number,
  scale: [number, number],
  sourceRoll = rollDegrees,
): SplineFrame {
  const tangent = normalize(rawTangent, [0, 0, 1]);
  let binormal = cross(rawUp, tangent);
  if (length(binormal) <= EPSILON) binormal = cross(leastAlignedAxis(tangent), tangent);
  binormal = normalize(binormal, [1, 0, 0]);
  let normal = normalize(cross(tangent, binormal), [0, 1, 0]);

  const radians = (Number.isFinite(rollDegrees) ? rollDegrees : 0) * Math.PI / 180;
  if (Math.abs(radians) > EPSILON) {
    binormal = rotateAroundAxis(binormal, tangent, radians);
    normal = rotateAroundAxis(normal, tangent, radians);
  }
  return frameFromAxes(position, tangent, normal, binormal, sourceRoll, scale);
}

function frameFromAxes(
  position: Vec3,
  tangent: Vec3,
  normal: Vec3,
  binormal: Vec3,
  roll: number,
  scale: [number, number],
): SplineFrame {
  return {
    position: clone(position),
    tangent: normalize(tangent, [0, 0, 1]),
    normal: normalize(normal, [0, 1, 0]),
    binormal: normalize(binormal, [1, 0, 0]),
    rotation: quaternionFromAxes(binormal, normal, tangent),
    scale: [scale[0], scale[1]],
    roll,
  };
}

function quaternionFromAxes(right: Vec3, up: Vec3, forward: Vec3): Quat {
  const m00 = right[0], m01 = up[0], m02 = forward[0];
  const m10 = right[1], m11 = up[1], m12 = forward[1];
  const m20 = right[2], m21 = up[2], m22 = forward[2];
  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  const magnitude = Math.hypot(x, y, z, w);
  return magnitude > EPSILON ? [x / magnitude, y / magnitude, z / magnitude, w / magnitude] : [0, 0, 0, 1];
}

function leastAlignedAxis(vector: Vec3): Vec3 {
  const axes: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return axes.reduce((best, axis) => Math.abs(dot(axis, vector)) < Math.abs(dot(best, vector)) ? axis : best);
}

function actorScale(value: number | Vec3 | undefined): Vec3 {
  if (typeof value === "number" && Number.isFinite(value)) return [value, value, value];
  if (Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    return [value[0], value[1], value[2]];
  }
  return [1, 1, 1];
}

function rotateAroundAxis(vector: Vec3, axis: Vec3, radians: number): Vec3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const projected = dot(axis, vector) * (1 - cosine);
  const crossed = cross(axis, vector);
  return [
    vector[0] * cosine + crossed[0] * sine + axis[0] * projected,
    vector[1] * cosine + crossed[1] * sine + axis[1] * projected,
    vector[2] * cosine + crossed[2] * sine + axis[2] * projected,
  ];
}

function lerpScale(start: [number, number], end: [number, number], t: number): [number, number] {
  return [lerp(start[0], end[0], t), lerp(start[1], end[1], t)];
}

function lerp(start: number, end: number, t: number): number { return start + (end - start) * t; }
function add(a: Vec3, b: Vec3): Vec3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function multiply(a: Vec3, b: Vec3): Vec3 { return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]; }
function negate(value: Vec3): Vec3 { return [-value[0], -value[1], -value[2]]; }
function cross(a: Vec3, b: Vec3): Vec3 { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function length(value: Vec3): number { return Math.hypot(value[0], value[1], value[2]); }
function normalize(value: Vec3, fallback: Vec3): Vec3 {
  const valueLength = length(value);
  return valueLength > EPSILON
    ? [cleanAxis(value[0] / valueLength), cleanAxis(value[1] / valueLength), cleanAxis(value[2] / valueLength)]
    : [...fallback];
}
function clone(value: Vec3): Vec3 { return [value[0], value[1], value[2]]; }
function cleanAxis(value: number): number { return Math.abs(value) < EPSILON ? 0 : value; }

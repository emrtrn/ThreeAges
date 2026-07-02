/**
 * Pure, headless-testable moving-platform motion. A platform ping-pongs along a
 * straight segment from its authored start to `start + offset` and back, at a
 * constant `speed`. No Three.js, DOM, or physics-engine dependency — the
 * {@link MovingPlatformSubsystem} feeds it the elapsed time it accumulates and
 * turns the returned position into a transform + world AABB the character
 * movement system reads (as a blocker, a ground surface, and a carry source).
 *
 * The motion is a triangle wave in the position fraction (0 at the start, 1 at
 * the far end), so velocity is constant and reverses cleanly at each end — no
 * teleport, which would fling a rider. A platform with a zero offset or a
 * non-positive speed never moves (fraction stays at its start phase).
 */
import type { Vec3 } from "../scene/layout";

export interface MovingPlatformParams {
  /** Far-end offset from the platform's authored start position (world units). */
  readonly offset: Vec3;
  /** Travel speed along the segment (units/s). */
  readonly speed: number;
  /** Initial position along the segment, 0..1 (0 = start, 1 = far end). */
  readonly startPhase: number;
}

/** Length of the travel segment (units). */
export function segmentLength(offset: Vec3): number {
  return Math.hypot(offset[0], offset[1], offset[2]);
}

/** Seconds for one one-way traversal; 0 when the platform can't move (no offset/speed). */
export function oneWaySeconds(params: MovingPlatformParams): number {
  const length = segmentLength(params.offset);
  if (length <= 0 || params.speed <= 0) return 0;
  return length / params.speed;
}

/**
 * Position fraction (0..1) along the segment at `elapsed` seconds, ping-ponging:
 * 0 → 1 over the first one-way, 1 → 0 over the next, and so on. A non-positive
 * `oneWay` pins the fraction (a platform that never moves).
 */
export function platformFraction(elapsed: number, oneWay: number): number {
  if (!(oneWay > 0)) return 0;
  const cycle = mod(elapsed / oneWay, 2); // 0..2 across a full there-and-back
  return cycle <= 1 ? cycle : 2 - cycle;
}

/** Wraps `value` into `[0, m)` for a positive modulus (JS `%` keeps the sign of the dividend). */
function mod(value: number, m: number): number {
  return ((value % m) + m) % m;
}

/**
 * World position of the platform origin at `elapsed` seconds, given its authored
 * `start`. The fraction ping-pongs, so the platform oscillates between `start`
 * and `start + offset`.
 */
export function platformPositionAt(start: Vec3, params: MovingPlatformParams, elapsed: number): Vec3 {
  const fraction = platformFraction(elapsed, oneWaySeconds(params));
  return [
    start[0] + params.offset[0] * fraction,
    start[1] + params.offset[1] * fraction,
    start[2] + params.offset[2] * fraction,
  ];
}

/**
 * The elapsed-time seed that places a platform at `startPhase` (0..1) along its
 * segment on the first frame, moving toward the far end. `startPhase` maps
 * directly onto the rising half of the triangle wave.
 */
export function initialElapsed(params: MovingPlatformParams): number {
  const oneWay = oneWaySeconds(params);
  if (oneWay <= 0) return 0;
  return clamp01(params.startPhase) * oneWay;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

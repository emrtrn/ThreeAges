/**
 * Pure, headless-testable collision response: resolve a proposed horizontal move
 * against static collider AABBs so the player cannot walk through walls and
 * slides along them instead. No Three.js, DOM, or physics-engine dependency —
 * the player behavior (src/game/behaviors.ts) feeds it the AABBs the physics
 * subsystem already derives.
 *
 * Movement is resolved on the XZ plane (vertical motion is G2's floor clamp). A
 * blocker only blocks when it overlaps the player's vertical span, so the player
 * can jump over short obstacles. The X and Z axes are resolved separately, which
 * yields wall sliding: a diagonal move into an X-facing wall keeps its Z
 * component.
 *
 * Only *new* penetration caused by this move is resolved — a blocker the player
 * already overlaps on an axis is left alone. That keeps the ground/platform the
 * player stands inside (its collider AABB) from freezing horizontal movement,
 * and avoids snapping out of pre-existing overlaps.
 */
import { sampleTriangleHeight, type GroundTriangle } from "./slopeSurface";

export interface Aabb3 {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  /**
   * Optional tight XZ silhouette for a rotated collider. `min`/`max` remains the
   * broad-phase AABB, while movement collision can use this to avoid the empty
   * corners created by an enclosing AABB around a diagonal wall. A 2-point
   * footprint represents a vertical trimesh triangle projected to a line segment.
   */
  readonly footprint?: readonly (readonly [number, number])[];
}

export interface PlanarDelta {
  readonly dx: number;
  readonly dz: number;
}

export interface GroundProbeOptions {
  /** Half-size of the character footprint on X/Z. */
  readonly footprintHalf: readonly [number, number];
  /** Maximum surface height the character can step up to while grounded. */
  readonly maxStepUp: number;
  /** Small downward snap distance for walking down shallow steps without falling. */
  readonly maxStepDown: number;
  /**
   * Walkable slope-surface triangles (ramps), sampled at the probe point for the
   * true incline height. Absent/empty → flat AABB tops only (legacy behaviour).
   */
  readonly surfaces?: readonly GroundTriangle[];
  /**
   * A surface triangle is walkable when its `normalY >= maxSlopeCos`
   * (`cos(slopeLimit)`). Absent → every surface counts (no slope gate). Only
   * gates the triangle `surfaces`; flat AABB tops are always walkable.
   */
  readonly maxSlopeCos?: number;
  /**
   * When several walkable surfaces overlap the probe X/Z (stacked floors), pick
   * the surface nearest to this Y instead of always taking the highest one.
   * Movement leaves this unset; navigation sets it to the layer being baked.
   */
  readonly preferredFloorY?: number;
}

export interface GroundHit {
  /** The character root/feet Y that rests on this surface. */
  readonly floorY: number;
  readonly blocker: Aabb3 | null;
}

/** Half-open interval overlap: touching edges (equal) do not count, so a flush slide is allowed. */
function overlaps(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return minA < maxB && maxA > minB;
}

/**
 * Penetration tolerance for the "already inside → don't re-resolve" test. A player
 * resting flush against a wall lands on a boundary that carries floating-point
 * error (e.g. `0.9 - 0.3 + 0.3 = 0.9000000000000001`), which a strict overlap test
 * would read as "already inside" and wave the next push straight through the wall.
 * Ignoring sub-micron penetration keeps a genuine deep overlap (standing inside the
 * ground/platform AABB) exempt while still clamping a flush contact — this is what
 * lets substepping stop flush instead of tunnelling.
 */
const PENETRATION_EPSILON = 1e-6;

/** True when the player's span penetrates the blocker span by more than epsilon (a real pre-existing overlap, not a flush touch). */
function alreadyPenetrating(min: number, max: number, blockerMin: number, blockerMax: number): boolean {
  return overlaps(min + PENETRATION_EPSILON, max - PENETRATION_EPSILON, blockerMin, blockerMax);
}

function validFootprint(blocker: Aabb3): readonly (readonly [number, number])[] | undefined {
  const footprint = blocker.footprint;
  return footprint && footprint.length >= 2 ? footprint : undefined;
}

function rectOverlapsAabbXZ(
  x: number,
  z: number,
  hx: number,
  hz: number,
  blocker: Aabb3,
): boolean {
  return overlaps(x - hx, x + hx, blocker.min[0], blocker.max[0]) &&
    overlaps(z - hz, z + hz, blocker.min[2], blocker.max[2]);
}

function rectOverlapsFootprint(
  x: number,
  z: number,
  hx: number,
  hz: number,
  footprint: readonly (readonly [number, number])[],
): boolean {
  if (!overlaps(x - hx, x + hx, minFootprintAxis(footprint, 0), maxFootprintAxis(footprint, 0))) {
    return false;
  }
  if (!overlaps(z - hz, z + hz, minFootprintAxis(footprint, 1), maxFootprintAxis(footprint, 1))) {
    return false;
  }
  for (let i = 0; i < footprint.length; i += 1) {
    const a = footprint[i]!;
    const b = footprint[(i + 1) % footprint.length]!;
    const edgeX = b[0] - a[0];
    const edgeZ = b[1] - a[1];
    const axisX = -edgeZ;
    const axisZ = edgeX;
    const axisLen = Math.hypot(axisX, axisZ);
    if (axisLen <= 1e-9) continue;
    const rectCenter = x * axisX + z * axisZ;
    const rectRadius = Math.abs(axisX) * hx + Math.abs(axisZ) * hz;
    let polyMin = Infinity;
    let polyMax = -Infinity;
    for (const point of footprint) {
      const projected = point[0] * axisX + point[1] * axisZ;
      polyMin = Math.min(polyMin, projected);
      polyMax = Math.max(polyMax, projected);
    }
    if (rectCenter + rectRadius <= polyMin || rectCenter - rectRadius >= polyMax) return false;
  }
  return true;
}

function minFootprintAxis(footprint: readonly (readonly [number, number])[], axis: 0 | 1): number {
  let min = Infinity;
  for (const point of footprint) min = Math.min(min, point[axis]);
  return min;
}

function maxFootprintAxis(footprint: readonly (readonly [number, number])[], axis: 0 | 1): number {
  let max = -Infinity;
  for (const point of footprint) max = Math.max(max, point[axis]);
  return max;
}

function rectOverlapsBlockerXZ(
  x: number,
  z: number,
  hx: number,
  hz: number,
  blocker: Aabb3,
): boolean {
  if (!rectOverlapsAabbXZ(x, z, hx, hz, blocker)) return false;
  const footprint = validFootprint(blocker);
  return footprint ? rectOverlapsFootprint(x, z, hx, hz, footprint) : true;
}

function alreadyOverlapsBlockerXZ(
  x: number,
  z: number,
  hx: number,
  hz: number,
  blocker: Aabb3,
): boolean {
  return rectOverlapsBlockerXZ(
    x,
    z,
    Math.max(0, hx - PENETRATION_EPSILON),
    Math.max(0, hz - PENETRATION_EPSILON),
    blocker,
  );
}

function clampXAgainstFootprint(
  startX: number,
  targetX: number,
  z: number,
  hx: number,
  hz: number,
  blocker: Aabb3,
): number {
  let safe = startX;
  let blocked = targetX;
  for (let i = 0; i < 28; i += 1) {
    const mid = (safe + blocked) / 2;
    if (rectOverlapsBlockerXZ(mid, z, hx, hz, blocker)) blocked = mid;
    else safe = mid;
  }
  return safe;
}

function clampZAgainstFootprint(
  x: number,
  startZ: number,
  targetZ: number,
  hx: number,
  hz: number,
  blocker: Aabb3,
): number {
  let safe = startZ;
  let blocked = targetZ;
  for (let i = 0; i < 28; i += 1) {
    const mid = (safe + blocked) / 2;
    if (rectOverlapsBlockerXZ(x, mid, hx, hz, blocker)) blocked = mid;
    else safe = mid;
  }
  return safe;
}

/**
 * Returns the proposed `delta` clamped so the player's AABB (centered at
 * `position`, with `half` extents) does not enter any blocker. Each axis is
 * resolved independently against the blockers whose vertical span overlaps the
 * player's, pushing the moved edge flush against the nearest blocker.
 */
export function resolvePlanarMovement(
  position: readonly [number, number, number],
  delta: PlanarDelta,
  half: readonly [number, number, number],
  blockers: readonly Aabb3[],
): PlanarDelta {
  const [px, py, pz] = position;
  const [hx, hy, hz] = half;

  // Only blockers overlapping the player's vertical span can block this move.
  const active = blockers.filter((b) => overlaps(py - hy, py + hy, b.min[1], b.max[1]));

  // Resolve X against the player's current Z span.
  let x = px + delta.dx;
  for (const b of active) {
    if (validFootprint(b)) {
      if (alreadyOverlapsBlockerXZ(px, pz, hx, hz, b)) continue;
      if (!rectOverlapsBlockerXZ(x, pz, hx, hz, b)) continue;
      x = clampXAgainstFootprint(px, x, pz, hx, hz, b);
      continue;
    }
    if (!overlaps(pz - hz, pz + hz, b.min[2], b.max[2])) continue;
    if (alreadyPenetrating(px - hx, px + hx, b.min[0], b.max[0])) continue; // already inside on X: not new
    if (!overlaps(x - hx, x + hx, b.min[0], b.max[0])) continue;
    if (delta.dx > 0) x = Math.min(x, b.min[0] - hx);
    else if (delta.dx < 0) x = Math.max(x, b.max[0] + hx);
  }

  // Resolve Z against the now-resolved X span (so blocking X still lets Z slide).
  let z = pz + delta.dz;
  for (const b of active) {
    if (validFootprint(b)) {
      if (alreadyOverlapsBlockerXZ(x, pz, hx, hz, b)) continue;
      if (!rectOverlapsBlockerXZ(x, z, hx, hz, b)) continue;
      z = clampZAgainstFootprint(x, pz, z, hx, hz, b);
      continue;
    }
    if (!overlaps(x - hx, x + hx, b.min[0], b.max[0])) continue;
    if (alreadyPenetrating(pz - hz, pz + hz, b.min[2], b.max[2])) continue; // already inside on Z: not new
    if (!overlaps(z - hz, z + hz, b.min[2], b.max[2])) continue;
    if (delta.dz > 0) z = Math.min(z, b.min[2] - hz);
    else if (delta.dz < 0) z = Math.max(z, b.max[2] + hz);
  }

  return { dx: x - px, dz: z - pz };
}

/** Hard ceiling on planar substeps so a pathological (very thin blocker + huge
 * delta) case can't explode into thousands of resolves. Realistic per-frame moves
 * (dt clamped to 100ms) stay well under this. */
export const MAX_MOVEMENT_SUBSTEPS = 32;

/**
 * Half the thinnest X/Z extent among blockers — a planar substep length that
 * cannot skip past the narrowest wall (moving flush-to-flush by at most half the
 * wall's thickness always keeps the destination overlapping it, so the per-axis
 * clamp fires). Returns `Infinity` when there are no blockers (caller then does a
 * single unsplit resolve). Floored so an absurdly thin collider can't force a huge
 * substep count.
 */
export function safeSubstepLength(blockers: readonly Aabb3[]): number {
  let thinnest = Infinity;
  for (const b of blockers) {
    thinnest = Math.min(thinnest, b.max[0] - b.min[0], b.max[2] - b.min[2]);
    const footprint = validFootprint(b);
    if (!footprint) continue;
    if (footprint.length === 2) {
      thinnest = Math.min(thinnest, 0.01);
      continue;
    }
    for (let i = 0; i < footprint.length; i += 1) {
      const a = footprint[i]!;
      const c = footprint[(i + 1) % footprint.length]!;
      const edgeLength = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (edgeLength > 1e-9) thinnest = Math.min(thinnest, edgeLength);
    }
  }
  return thinnest === Infinity ? Infinity : Math.max(thinnest / 2, 0.01);
}

/**
 * Substepped wrapper around {@link resolvePlanarMovement}: splits a large planar
 * move into chunks no longer than `maxSubstepLength`, re-resolving from the running
 * position each chunk, so a fast move or a big `dt` spike cannot tunnel through a
 * thin wall. Wall sliding and flush stops are preserved because each substep is a
 * full independent resolve. A move that already fits in one substep (the common
 * case) resolves in a single pass with no behavioural change.
 */
export function resolvePlanarMovementSubstepped(
  position: readonly [number, number, number],
  delta: PlanarDelta,
  half: readonly [number, number, number],
  blockers: readonly Aabb3[],
  maxSubstepLength: number,
): PlanarDelta {
  const distance = Math.hypot(delta.dx, delta.dz);
  if (!(maxSubstepLength > 0) || distance <= maxSubstepLength) {
    return resolvePlanarMovement(position, delta, half, blockers);
  }
  const steps = Math.min(Math.ceil(distance / maxSubstepLength), MAX_MOVEMENT_SUBSTEPS);
  const subDx = delta.dx / steps;
  const subDz = delta.dz / steps;
  const py = position[1];
  let x = position[0];
  let z = position[2];
  for (let i = 0; i < steps; i += 1) {
    const resolved = resolvePlanarMovement([x, py, z], { dx: subDx, dz: subDz }, half, blockers);
    x += resolved.dx;
    z += resolved.dz;
  }
  return { dx: x - position[0], dz: z - position[2] };
}

export function filterWalkableBlockers(
  footY: number,
  blockers: readonly Aabb3[],
  maxStepUp: number,
): Aabb3[] {
  const stepTop = footY + Math.max(0, maxStepUp);
  return blockers.filter((blocker) => blocker.max[1] > stepTop);
}

export function findGroundAt(
  position: readonly [number, number, number],
  blockers: readonly Aabb3[],
  options: GroundProbeOptions,
): GroundHit | null {
  const [px, py, pz] = position;
  const [hx, hz] = options.footprintHalf;
  const minY = py - Math.max(0, options.maxStepDown);
  const maxY = py + Math.max(0, options.maxStepUp);
  return highestWalkableSurface(
    blockers,
    px,
    pz,
    hx,
    hz,
    (top) => top >= minY && top <= maxY,
    options,
  );
}

export function findGroundLayersAt(
  position: readonly [number, number, number],
  blockers: readonly Aabb3[],
  options: GroundProbeOptions,
): readonly GroundHit[] {
  const [px, py, pz] = position;
  const [hx, hz] = options.footprintHalf;
  const minY = py - Math.max(0, options.maxStepDown);
  const maxY = py + Math.max(0, options.maxStepUp);
  return collectWalkableSurfaces(
    blockers,
    px,
    pz,
    hx,
    hz,
    (top) => top >= minY && top <= maxY,
    options,
  ).sort((a, b) => a.floorY - b.floorY);
}

export function findLandingGround(
  previousFootY: number,
  nextFootY: number,
  position: readonly [number, number, number],
  blockers: readonly Aabb3[],
  options: GroundProbeOptions,
): GroundHit | null {
  if (nextFootY > previousFootY) return null;
  const [px, , pz] = position;
  const [hx, hz] = options.footprintHalf;
  return highestWalkableSurface(
    blockers,
    px,
    pz,
    hx,
    hz,
    (top) => top <= previousFootY && top >= nextFootY,
    options,
  );
}

function highestWalkableSurface(
  blockers: readonly Aabb3[],
  px: number,
  pz: number,
  hx: number,
  hz: number,
  acceptsTop: (top: number) => boolean,
  options: GroundProbeOptions,
): GroundHit | null {
  let best: GroundHit | null = null;
  for (const blocker of blockers) {
    if (!overlaps(px - hx, px + hx, blocker.min[0], blocker.max[0])) continue;
    if (!overlaps(pz - hz, pz + hz, blocker.min[2], blocker.max[2])) continue;
    const top = blocker.max[1];
    if (!acceptsTop(top)) continue;
    best = betterGroundHit(best, { floorY: top, blocker }, options);
  }
  // Slope surfaces (ramps): sampled at the probe centre for their true incline
  // height, gated on the slope limit. A ramp surface can win over a flat top.
  const surfaces = options.surfaces;
  if (surfaces && surfaces.length > 0) {
    const minSlopeCos = options.maxSlopeCos ?? 0;
    for (const surface of surfaces) {
      if (surface.normalY < minSlopeCos) continue; // too steep to walk → not ground
      const top = sampleTriangleHeight(surface, px, pz);
      if (top === null || !acceptsTop(top)) continue;
      best = betterGroundHit(best, { floorY: top, blocker: null }, options);
    }
  }
  return best;
}

function collectWalkableSurfaces(
  blockers: readonly Aabb3[],
  px: number,
  pz: number,
  hx: number,
  hz: number,
  acceptsTop: (top: number) => boolean,
  options: GroundProbeOptions,
): GroundHit[] {
  const hits: GroundHit[] = [];
  for (const blocker of blockers) {
    if (!overlaps(px - hx, px + hx, blocker.min[0], blocker.max[0])) continue;
    if (!overlaps(pz - hz, pz + hz, blocker.min[2], blocker.max[2])) continue;
    const top = blocker.max[1];
    if (!acceptsTop(top)) continue;
    pushGroundHit(hits, { floorY: top, blocker });
  }
  const surfaces = options.surfaces;
  if (surfaces && surfaces.length > 0) {
    const minSlopeCos = options.maxSlopeCos ?? 0;
    for (const surface of surfaces) {
      if (surface.normalY < minSlopeCos) continue;
      const top = sampleTriangleHeight(surface, px, pz);
      if (top === null || !acceptsTop(top)) continue;
      pushGroundHit(hits, { floorY: top, blocker: null });
    }
  }
  return hits;
}

function pushGroundHit(hits: GroundHit[], hit: GroundHit): void {
  const existing = hits.find((candidate) => Math.abs(candidate.floorY - hit.floorY) <= 1e-6);
  if (!existing) {
    hits.push(hit);
    return;
  }
  if (existing.blocker && !hit.blocker) {
    hits[hits.indexOf(existing)] = hit;
  }
}

function betterGroundHit(current: GroundHit | null, candidate: GroundHit, options: GroundProbeOptions): GroundHit {
  if (!current) return candidate;
  const preferred = options.preferredFloorY;
  if (typeof preferred === "number" && Number.isFinite(preferred)) {
    const currentDelta = Math.abs(current.floorY - preferred);
    const candidateDelta = Math.abs(candidate.floorY - preferred);
    if (candidateDelta < currentDelta - 1e-6) return candidate;
    if (Math.abs(candidateDelta - currentDelta) <= 1e-6 && candidate.floorY > current.floorY) return candidate;
    return current;
  }
  return candidate.floorY > current.floorY ? candidate : current;
}

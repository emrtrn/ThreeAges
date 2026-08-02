/**
 * Pure grazing behaviour for wildlife — wildlife plan Faz 2.
 *
 * No three.js and no renderer: it takes where an animal is and returns where it
 * should be next, so everything an animal *decides* stays headless-testable.
 * That is the same split `rtsUnitAnimation.ts` makes for the animation selector,
 * and for the same reason — the half with the decisions in it is the half worth
 * pinning.
 *
 * A grazing animal is deliberately not a unit under orders. It drifts to a point
 * inside its herd's circle, stands there eating for a while, then picks another.
 * So this owns a rest timer rather than a path: nothing here consults the
 * navigation grid, because an animal that wanders somewhere awkward is a visual
 * nuisance, not a stuck order, and paying for pathfinding per animal per frame
 * would be the most expensive way to solve the least important problem.
 */

/** Seconds an animal stands and grazes between moves. */
const REST_SECONDS_MIN = 2.5;
const REST_SECONDS_MAX = 7;

/** Close enough to a grazing spot to stop and eat, in world units. */
const ARRIVE_EPSILON = 0.15;

/** Where an animal is heading and how long it stands once it gets there. */
export interface RoamState {
  targetX: number;
  targetZ: number;
  restSeconds: number;
}

/** The unchanging half: the herd's circle and the species' grazing pace. */
export interface RoamProfile {
  readonly homeX: number;
  readonly homeZ: number;
  readonly roamRadius: number;
  /**
   * Speed a grazing animal drifts at — deliberately the species'
   * `walkClipSpeed`, the ground speed its walk clip reads naturally at.
   *
   * That equality is the whole fix for foot slide, and it is worth stating why
   * a fraction of `moveSpeed` was wrong: playback rate is
   * `planarSpeed / walkClipSpeed`, so scaling the speed scales the animation
   * with it and the mismatch survives untouched. Only pinning the two together
   * removes it — at this speed the rate is exactly 1, at every tuning, so the
   * feet plant wherever the animator put them.
   *
   * Fleeing (Faz 5) is the other half: it runs at `moveSpeed`, which is what
   * the gallop clip is calibrated to.
   */
  readonly walkSpeed: number;
}

/** Where the animal ended up this tick, and how fast it got there. */
export interface RoamPose {
  readonly x: number;
  readonly z: number;
  readonly facing: number;
  /** Ground speed actually travelled, which is what picks the clip. */
  readonly speed: number;
}

/**
 * Deterministic 32-bit PRNG (mulberry32).
 *
 * Wildlife is seeded rather than left on `Math.random` so a herd grazes the same
 * way twice: an animal's position decides whether a hunter can reach it, so
 * "where the deer wandered" is simulation, not decoration, and the headless AI
 * must see the same field the player does.
 */
export function makeWildlifeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed for an animal id, so a Level always produces the same herd. */
export function wildlifeSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A uniformly distributed point inside the herd's circle.
 *
 * `sqrt` on the radius is what makes it uniform by *area*; without it every
 * animal crowds the herd's centre, which reads as a pile rather than a herd.
 */
export function randomPointInHerd(profile: RoamProfile, random: () => number): { x: number; z: number } {
  const radius = profile.roamRadius * Math.sqrt(random());
  const angle = random() * Math.PI * 2;
  return {
    x: profile.homeX + Math.cos(angle) * radius,
    z: profile.homeZ + Math.sin(angle) * radius,
  };
}

/** Opening state: already standing somewhere in the circle, about to graze. */
export function initialRoamState(profile: RoamProfile, random: () => number): RoamState {
  const point = randomPointInHerd(profile, random);
  return {
    targetX: point.x,
    targetZ: point.z,
    restSeconds: REST_SECONDS_MIN + random() * (REST_SECONDS_MAX - REST_SECONDS_MIN),
  };
}

/**
 * Advance one animal by `deltaSeconds`, mutating `state` and returning its pose.
 *
 * Resting outranks moving: an animal that has arrived stands and eats until its
 * timer runs out, and only then picks a new spot. Facing is carried through
 * unchanged while standing so a grazing animal does not spin on the spot.
 */
export function advanceRoam(
  state: RoamState,
  current: { readonly x: number; readonly z: number; readonly facing: number },
  profile: RoamProfile,
  deltaSeconds: number,
  random: () => number,
): RoamPose {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("Roam delta must be a non-negative finite number");
  }
  const dx = state.targetX - current.x;
  const dz = state.targetZ - current.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= ARRIVE_EPSILON) {
    state.restSeconds -= deltaSeconds;
    if (state.restSeconds <= 0) {
      const point = randomPointInHerd(profile, random);
      state.targetX = point.x;
      state.targetZ = point.z;
      state.restSeconds = REST_SECONDS_MIN + random() * (REST_SECONDS_MAX - REST_SECONDS_MIN);
    }
    return { x: current.x, z: current.z, facing: current.facing, speed: 0 };
  }

  const step = Math.min(profile.walkSpeed * deltaSeconds, distance);
  return {
    x: current.x + (dx / distance) * step,
    z: current.z + (dz / distance) * step,
    facing: Math.atan2(dx, dz),
    // Report the speed actually achieved: a tick that lands exactly on the
    // target travelled less than a full step, and the clip should say so.
    speed: deltaSeconds > 0 ? step / deltaSeconds : 0,
  };
}

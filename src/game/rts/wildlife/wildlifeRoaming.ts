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

/**
 * Closer than this and the animal is caught rather than frightened: it stops
 * dead and turns to face what has hold of it.
 *
 * Without it a hunt cannot finish. Prey bolts whenever a person is inside
 * `fleeRadius`, so a hunter standing over his quarry re-triggered the flight he
 * had just closed — measured, one deer took 65 seconds of near-misses to bring
 * down instead of the 5 its `huntSeconds` asks for, because the hunter was only
 * ever in contact for the odd frame.
 *
 * Must stay above the gather loop's work range (`WORK_RANGE`, 1.25): a hunter
 * standing at his work post has to be inside this, or he pins nothing.
 */
export const CAUGHT_DISTANCE = 2;

/**
 * How far behind its shepherd a driven animal walks.
 *
 * Under {@link CAUGHT_DISTANCE} on purpose: the animal being driven is the
 * animal that was just calmed, and it stays in contact for the whole walk rather
 * than re-entering the frightened branch every time the shepherd steps ahead.
 */
const DRIVE_FOLLOW_GAP = 1.5;

/** Where an animal is heading and how long it stands once it gets there. */
export interface RoamState {
  targetX: number;
  targetZ: number;
  restSeconds: number;
  /** Seconds left in the current bolt; > 0 means running flat out from a threat. */
  fleeSeconds: number;
  /**
   * Seconds left of being winded, during which a threat is ignored.
   *
   * This is the whole reason a hunt can ever end. A deer is faster than a worker
   * (7.5 against 6), so an animal that bolted for as long as anything frightened
   * it could never be caught — the hunter would follow it to the edge of the map
   * and back. Bolt, blow, graze: the hunter closes the gap in the gaps.
   */
  recoverySeconds: number;
}

/** The unchanging half: the herd's circle and the species' grazing pace. */
export interface RoamProfile {
  readonly homeX: number;
  readonly homeZ: number;
  readonly roamRadius: number;
  /**
   * Radius the animal never grazes *inside*, turning the circle into a ring.
   *
   * Zero (a wild herd) is a plain disc. A pasture's pen sets it to the building's
   * own half-diagonal, which is the whole reason it exists: a penned cow drawn
   * standing in the middle of the barn is the one way this feature can look
   * broken, and no amount of tuning a disc fixes it.
   */
  readonly roamInnerRadius?: number;
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
  /** Flat-out speed while bolting — the species' `moveSpeed`, what Gallop is calibrated to. */
  readonly fleeSpeed: number;
  /** How close a person may come before the animal bolts. */
  readonly fleeRadius: number;
  /** How long one bolt lasts. */
  readonly fleeSeconds: number;
  /** How long the animal is winded afterwards; see {@link RoamState.recoverySeconds}. */
  readonly fleeRecoverySeconds: number;
}

/** A person close enough to frighten an animal. */
export interface ThreatPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * A shepherd who has hold of this animal — pasture plan Faz 4.
 *
 * The point is always the shepherd's *live position*, never a route: an animal
 * is not a navigation agent (Faz 2's decision, kept), so the way it comes to
 * follow a walkable line is by following someone who walked one.
 */
export interface WildlifeLead {
  readonly x: number;
  readonly z: number;
  /** False while it is being calmed: it stands and faces the shepherd. */
  readonly follow: boolean;
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
  // Uniform by area over the *ring* rather than the disc, which reduces to the
  // disc when there is no hole. Interpolating the radius directly instead would
  // crowd a narrow pen's inner rail.
  const inner = profile.roamInnerRadius ?? 0;
  const radius = Math.sqrt(inner * inner + (profile.roamRadius * profile.roamRadius - inner * inner) * random());
  const angle = random() * Math.PI * 2;
  return {
    x: profile.homeX + Math.cos(angle) * radius,
    z: profile.homeZ + Math.sin(angle) * radius,
  };
}

/**
 * Hold a point inside the herd's ground, sliding it back onto the rim when a
 * bolt would carry it out.
 *
 * This is what makes an animal huntable at all. Prey outruns a worker, so an
 * animal that ran in a straight line simply left — measured, a single deer
 * crossed 90 world units and walked off the map with its hunter trailing behind
 * it, and the camp's herd was gone without a shot fired. Confined, the bolt
 * turns along the rim instead: the deer keeps its speed advantage but spends it
 * circling its own meadow, which is where a hunter eventually corners it.
 *
 * It also makes the plan's range contract (`roamRadius < gatherRadius`) literally
 * true rather than true on average — a fleeing animal cannot leave the reach of
 * the camp built for its herd.
 */
function keepInHerdGround(x: number, z: number, profile: RoamProfile): { x: number; z: number } {
  const dx = x - profile.homeX;
  const dz = z - profile.homeZ;
  const distance = Math.hypot(dx, dz);
  const inner = profile.roamInnerRadius ?? 0;
  // Both rails, for the same reason: a pen's hole is the building, and an animal
  // shoved into it by a bolt would stand inside its own barn.
  if (distance < 1e-4) return { x, z };
  if (distance > profile.roamRadius) {
    const scale = profile.roamRadius / distance;
    return { x: profile.homeX + dx * scale, z: profile.homeZ + dz * scale };
  }
  if (inner > 0 && distance < inner) {
    const scale = inner / distance;
    return { x: profile.homeX + dx * scale, z: profile.homeZ + dz * scale };
  }
  return { x, z };
}

/** Opening state: already standing somewhere in the circle, about to graze. */
export function initialRoamState(profile: RoamProfile, random: () => number): RoamState {
  const point = randomPointInHerd(profile, random);
  return {
    targetX: point.x,
    targetZ: point.z,
    restSeconds: REST_SECONDS_MIN + random() * (REST_SECONDS_MAX - REST_SECONDS_MIN),
    fleeSeconds: 0,
    recoverySeconds: 0,
  };
}

/**
 * Advance an animal a shepherd has hold of — pasture plan Faz 4.
 *
 * Threats, herd ground and the grazing timer are all deliberately absent. A
 * driven animal is out of its herd's circle by definition (that is the point of
 * driving it), it must not bolt from the person leading it, and every other unit
 * on the field would otherwise scatter the drive at the last step.
 *
 * It walks at `walkSpeed`, which is not a pace choice but the only speed its walk
 * clip reads at rate 1 (see {@link RoamProfile.walkSpeed}). Driving it faster
 * would either clamp the playback and slide the feet, or tip it into the gallop
 * clip — a cow galloping to the barn behind a walking man.
 */
export function advanceLed(
  current: { readonly x: number; readonly z: number; readonly facing: number },
  lead: WildlifeLead,
  profile: RoamProfile,
  deltaSeconds: number,
): RoamPose {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("Lead delta must be a non-negative finite number");
  }
  const dx = lead.x - current.x;
  const dz = lead.z - current.z;
  const distance = Math.hypot(dx, dz);
  const facing = distance < 1e-4 ? current.facing : Math.atan2(dx, dz);
  if (!lead.follow || distance <= DRIVE_FOLLOW_GAP) {
    return { x: current.x, z: current.z, facing, speed: 0 };
  }
  const step = Math.min(profile.walkSpeed * deltaSeconds, distance - DRIVE_FOLLOW_GAP);
  return {
    x: current.x + (dx / distance) * step,
    z: current.z + (dz / distance) * step,
    facing,
    speed: deltaSeconds > 0 ? step / deltaSeconds : 0,
  };
}

/**
 * Advance one animal by `deltaSeconds`, mutating `state` and returning its pose.
 *
 * Fleeing outranks everything, then resting outranks moving: an animal that has
 * arrived stands and eats until its timer runs out, and only then picks a new
 * spot. Facing is carried through unchanged while standing so a grazing animal
 * does not spin on the spot.
 *
 * `threat` is the nearest person, or null when nobody is about. A bolt is
 * deliberately *not* steered back toward the herd — the animal runs flat out
 * away from what frightened it, and it is the grazing half that walks it home,
 * because every grazing target is a point inside the herd's own circle.
 */
export function advanceRoam(
  state: RoamState,
  current: { readonly x: number; readonly z: number; readonly facing: number },
  profile: RoamProfile,
  deltaSeconds: number,
  random: () => number,
  threat: ThreatPoint | null = null,
): RoamPose {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError("Roam delta must be a non-negative finite number");
  }

  const threatDistance = threat
    ? Math.hypot(threat.x - current.x, threat.z - current.z)
    : Number.POSITIVE_INFINITY;
  if (threatDistance <= CAUGHT_DISTANCE && threat) {
    // Caught: it holds still and faces what has hold of it, which is also the
    // pose the death clip reads out of.
    state.fleeSeconds = 0;
    return {
      x: current.x,
      z: current.z,
      facing: Math.atan2(threat.x - current.x, threat.z - current.z),
      speed: 0,
    };
  }
  if (state.fleeSeconds <= 0 && state.recoverySeconds <= 0 && threatDistance <= profile.fleeRadius) {
    state.fleeSeconds = profile.fleeSeconds;
  }
  if (state.fleeSeconds > 0) {
    state.fleeSeconds -= deltaSeconds;
    if (state.fleeSeconds <= 0) {
      state.fleeSeconds = 0;
      state.recoverySeconds = profile.fleeRecoverySeconds;
      // Graze from wherever the bolt ended rather than resuming the old target,
      // which may now be behind the hunter.
      const point = randomPointInHerd(profile, random);
      state.targetX = point.x;
      state.targetZ = point.z;
      state.restSeconds = 0;
    }
    // Straight away from the threat. With none left (it died, or the animal is
    // standing exactly on it) the bolt simply carries on facing forward.
    const awayX = threat ? current.x - threat.x : Math.sin(current.facing);
    const awayZ = threat ? current.z - threat.z : Math.cos(current.facing);
    const length = Math.hypot(awayX, awayZ);
    if (length < 1e-4) return { x: current.x, z: current.z, facing: current.facing, speed: 0 };
    const step = profile.fleeSpeed * deltaSeconds;
    const bolted = keepInHerdGround(
      current.x + (awayX / length) * step,
      current.z + (awayZ / length) * step,
      profile,
    );
    const travelled = Math.hypot(bolted.x - current.x, bolted.z - current.z);
    return {
      x: bolted.x,
      z: bolted.z,
      facing: Math.atan2(awayX, awayZ),
      // Report what it actually covered, not what it tried to: an animal running
      // along the rim of its ground moves slower than flat out, and the gallop
      // clip has to be played at the speed the feet are travelling.
      speed: deltaSeconds > 0 ? travelled / deltaSeconds : 0,
    };
  }
  if (state.recoverySeconds > 0) state.recoverySeconds -= deltaSeconds;

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
  // Held to the ground on the walk as well as the bolt. For a herd's disc this
  // is a no-op — both ends of the step are already inside a convex circle — but a
  // pen is a *ring*, and a straight line between two points on it cuts through
  // the hole, which is the building. Clamped, the animal walks around the barn
  // instead of through it.
  const walked = keepInHerdGround(
    current.x + (dx / distance) * step,
    current.z + (dz / distance) * step,
    profile,
  );
  const travelled = Math.hypot(walked.x - current.x, walked.z - current.z);
  return {
    x: walked.x,
    z: walked.z,
    facing: Math.atan2(dx, dz),
    // Report the speed actually achieved: a tick that lands exactly on the
    // target, or one shortened by the rail, travelled less than a full step, and
    // the clip should say so.
    speed: deltaSeconds > 0 ? travelled / deltaSeconds : 0,
  };
}

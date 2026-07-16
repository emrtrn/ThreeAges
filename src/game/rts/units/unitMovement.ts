/**
 * RTS unit movement — Vertical Slice Plan v0.2 §21 ("Sağ tık hareket") / §45.
 *
 * Follows planned ground waypoints (or a legacy direct target) on the ground
 * plane, faces the heading, and clears completed orders. Global grid planning
 * lives in `rtsNavigation`; crowd separation lives in `unitSeparation`.
 *
 * Faz 7's group-movement slice added the congestion escape below: a follower that
 * cannot close on its waypoint is, on its own, a unit that grinds against its
 * neighbours forever. The plan's acceptance is "köprüde kalıcı sıkışma
 * oluşmuyor" — permanent, not momentary — so the rule here is that every stall
 * has to end, either in a new route or in a stop.
 */
import { Vector3 } from "three";

import { combatDistance } from "../combat/combatTarget";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "./unit";
import { UNIT_RADIUS } from "./unit";

/** Distance to the target at which the unit is considered arrived. */
const ARRIVAL_RADIUS = 0.15;

/**
 * How long a unit may fail to close on its waypoint before its route is treated
 * as blocked. Long enough that squeezing single-file through a gap — which is
 * slow, not stuck — is never mistaken for congestion.
 */
const CONGESTION_TIMEOUT = 1.5;
/** Re-plans allowed per order before the unit gives its destination up. */
const MAX_REPLANS = 2;
/**
 * Fraction of the step a unit must actually cover to count as progressing.
 * A unit shoved sideways by the crowd still creeps forward; only one making
 * effectively no headway trips the timeout.
 */
const PROGRESS_FRACTION = 0.2;
/**
 * How close to its destination a congested unit is simply declared arrived. This
 * is the crowd-arrival rule: the last unit of a group cannot reach a slot an ally
 * is standing in, and must not spend the match trying.
 */
const CONGESTION_ARRIVAL_RADIUS = 2;

const scratchDir = new Vector3();

interface CongestionState {
  /** Seconds without meaningful progress toward the current waypoint. */
  seconds: number;
  /** Re-plans already spent on the current order. */
  replans: number;
  /** Waypoint the stall is being measured against; a new one resets the stall. */
  waypoint: Vector3 | null;
}

/**
 * Per-unit stall bookkeeping. Held outside the unit so `Unit` stays the thin
 * data+render holder plan §14 asks for; a despawned unit drops out with no
 * cleanup call to forget.
 */
const congestion = new WeakMap<Unit, CongestionState>();

export interface UnitMovementOptions {
  /**
   * Enables congestion re-planning. Without it movement is a pure path follower
   * and a blocked unit simply stops when its patience runs out.
   */
  readonly navigation?: RtsNavigation;
}

/** Advance every moving unit one frame toward its target. */
export function updateUnitMovement(
  units: readonly Unit[],
  dt: number,
  options: UnitMovementOptions = {},
): void {
  for (const unit of units) {
    if (unit.health.depleted) {
      unit.stop();
      continue;
    }
    // Hold Position is exactly this: the unit keeps its weapon and gives up its
    // feet (GDD 06 §26). Everything else below is a reason to take a step.
    if (unit.stance === "hold") continue;
    const attackTarget = unit.attackTarget;
    if (attackTarget?.health.depleted) {
      unit.setAttackTarget(null);
      continue;
    }
    // An explicit attack order follows its target's live position, stopping at
    // melee range so the combat system can resolve hits without overlap.
    if (attackTarget && combatDistance(unit.position, attackTarget) <= unit.attack.range) {
      continue;
    }
    // Attack orders follow a preplanned path. Never fall back to the target
    // pivot here: that was the route that let attackers walk through the ridge.
    const target = unit.pathTarget ?? (attackTarget ? null : unit.moveTarget);
    if (!target) {
      congestion.delete(unit);
      continue;
    }

    const pos = unit.position;
    scratchDir.set(target.x - pos.x, 0, target.z - pos.z);
    const dist = scratchDir.length();
    if (dist <= ARRIVAL_RADIUS) {
      if (unit.pathTarget) unit.advancePath();
      else if (!unit.attackTarget) unit.moveTarget = null;
      congestion.delete(unit);
      continue;
    }

    const step = Math.min(dist, unit.speed * dt);
    scratchDir.multiplyScalar(step / dist);
    pos.x += scratchDir.x;
    pos.z += scratchDir.z;
    // Face the heading (capsule is radially symmetric, but this keeps facing
    // meaningful once directional models replace the placeholder).
    unit.object.rotation.y = Math.atan2(scratchDir.x, scratchDir.z);

    trackCongestion(unit, target, dist, step, dt, options.navigation);
  }
}

/**
 * Measure whether this frame's step actually bought ground, and escalate when it
 * repeatedly did not: re-plan first, and only then give the destination up.
 */
function trackCongestion(
  unit: Unit,
  waypoint: Vector3,
  distanceBefore: number,
  step: number,
  dt: number,
  navigation: RtsNavigation | undefined,
): void {
  const state = congestion.get(unit) ?? { seconds: 0, replans: 0, waypoint: null };
  if (state.waypoint !== waypoint) {
    // Reaching a new waypoint is progress by definition, and the replan budget
    // belongs to the leg, not to the whole route.
    state.waypoint = waypoint;
    state.seconds = 0;
    state.replans = 0;
  }
  congestion.set(unit, state);

  const distanceAfter = Math.hypot(waypoint.x - unit.position.x, waypoint.z - unit.position.z);
  const progressed = distanceBefore - distanceAfter >= step * PROGRESS_FRACTION;
  if (progressed) {
    state.seconds = 0;
    return;
  }
  state.seconds += dt;
  if (state.seconds < CONGESTION_TIMEOUT) return;

  state.seconds = 0;
  const destination = unit.pathDestination;
  if (navigation && destination && state.replans < MAX_REPLANS) {
    state.replans += 1;
    const path = navigation.plan(unit.position, destination);
    if (path && path.length > 0) {
      unit.replanPath(path);
      state.waypoint = null;
      return;
    }
  }

  // Out of options. If the unit is effectively where it was sent, call it
  // arrived; otherwise stop it, so a blocked order ends instead of becoming a
  // permanent shove against the units in front of it.
  const remaining = destination
    ? Math.hypot(destination.x - unit.position.x, destination.z - unit.position.z)
    : 0;
  if (!destination || remaining <= CONGESTION_ARRIVAL_RADIUS) {
    unit.attackMoveTarget = null;
    unit.replanPath([]);
  } else {
    unit.stop();
  }
  congestion.delete(unit);
}

/** Test/debug read of a unit's current stall, in seconds. */
export function congestionSeconds(unit: Unit): number {
  return congestion.get(unit)?.seconds ?? 0;
}

/**
 * Ground-point offsets that spread `count` units into a compact square grid so a
 * group order does not stack everyone on one spot. Centred on (0,0); the caller
 * adds the command point. Spacing leaves a small gap between unit footprints.
 */
export function formationOffsets(count: number): Array<{ x: number; z: number }> {
  const offsets: Array<{ x: number; z: number }> = [];
  if (count <= 0) return offsets;
  const spacing = UNIT_RADIUS * 2 + 0.6;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const halfW = ((cols - 1) * spacing) / 2;
  const halfH = ((rows - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    offsets.push({ x: col * spacing - halfW, z: row * spacing - halfH });
  }
  return offsets;
}

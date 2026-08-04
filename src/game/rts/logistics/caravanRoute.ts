/** Pure, road-cell route following for RTS logistics caravans. */
import type { RoadCell } from "../roads/roadGraph";

/** Continuous position along a discrete road route. */
export interface CaravanRouteState {
  readonly waypointIndex: number;
  readonly x: number;
  readonly z: number;
  /** Three.js Y rotation: the direction the donkey's +Z axis faces. */
  readonly facing: number;
}

export interface CaravanRouteAdvance {
  readonly state: CaravanRouteState;
  /** Ground distance actually covered during this step. */
  readonly distance: number;
  readonly arrived: boolean;
}

/** Start at the first committed road cell. Empty routes are never valid. */
export function startCaravanRoute(route: readonly RoadCell[]): CaravanRouteState {
  const first = route[0];
  if (!first) throw new RangeError("A caravan route requires at least one road cell");
  return { waypointIndex: 0, x: first.x, z: first.z, facing: 0 };
}

/**
 * Walk a fixed road route without knowing anything about simulation, rendering,
 * or the graph that produced it.  FIFO cell routes can be crossed in one large
 * simulation tick without skipping an arrival state.
 */
export function advanceCaravanRoute(
  route: readonly RoadCell[],
  state: CaravanRouteState,
  moveSpeed: number,
  deltaSeconds: number,
): CaravanRouteAdvance {
  if (!Number.isFinite(moveSpeed) || moveSpeed < 0) throw new RangeError("Caravan move speed must be non-negative and finite");
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new RangeError("Caravan delta must be non-negative and finite");
  const lastIndex = route.length - 1;
  if (lastIndex < 0) throw new RangeError("A caravan route requires at least one road cell");

  let waypointIndex = Math.min(Math.max(0, state.waypointIndex), lastIndex);
  let x = state.x;
  let z = state.z;
  let facing = state.facing;
  let remaining = moveSpeed * deltaSeconds;
  let distance = 0;

  while (remaining > 0 && waypointIndex < lastIndex) {
    const target = route[waypointIndex + 1];
    if (!target) break;
    const dx = target.x - x;
    const dz = target.z - z;
    const segment = Math.hypot(dx, dz);
    if (segment <= 1e-9) {
      waypointIndex += 1;
      continue;
    }
    facing = Math.atan2(dx, dz);
    const moved = Math.min(remaining, segment);
    x += (dx / segment) * moved;
    z += (dz / segment) * moved;
    remaining -= moved;
    distance += moved;
    if (moved >= segment - 1e-9) {
      x = target.x;
      z = target.z;
      waypointIndex += 1;
    }
  }

  return {
    state: { waypointIndex, x, z, facing },
    distance,
    arrived: waypointIndex === lastIndex,
  };
}

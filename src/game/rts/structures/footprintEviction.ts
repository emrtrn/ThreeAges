/**
 * Push friendly units out of a building footprint at placement time.
 *
 * Units are deliberately absent from the static navigation grid, so a
 * construction site can legally be placed on top of one — and then the unit is
 * inside a blocker no path can leave, which is exactly the "sıkışıp kalma" the
 * footprint creates. The RTS convention (SC2, AoE) is that units never veto a
 * placement; they step aside. So this runs *after* validation succeeds and
 * *before* the site starts blocking navigation.
 *
 * Enemy units are not evicted — a build order that shoves hostile units around
 * would be a free displacement tool. Those are refused at validation instead
 * ({@link enemyOccupiesFootprint}).
 */
import { Vector3 } from "three";

import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit, UnitOwner } from "../units/unit";

/**
 * Extra clearance beyond the footprint edge an evicted unit must reach. A unit
 * standing exactly on the edge still overlaps the blocker by its own radius and
 * would be evicted again on the next placement.
 */
const EVICTION_CLEARANCE = 0.6;
/** Directions tried, in order, when looking for somewhere to send the unit. */
const EVICTION_DIRECTIONS = 16;
/** How far past the required clearance the search is willing to walk. */
const EVICTION_MAX_EXTRA = 6;
const EVICTION_STEP = 1;

/** Whether a ground point lies inside the footprint, inflated by `margin`. */
function insideFootprint(
  stats: BuildingBalanceStats,
  x: number,
  z: number,
  pointX: number,
  pointZ: number,
  margin: number,
): boolean {
  return Math.abs(pointX - x) <= stats.footprint.width / 2 + margin
    && Math.abs(pointZ - z) <= stats.footprint.depth / 2 + margin;
}

/** Live units of `owner` whose body overlaps the proposed footprint. */
export function unitsInFootprint(
  units: readonly Unit[],
  owner: UnitOwner,
  stats: BuildingBalanceStats,
  x: number,
  z: number,
): Unit[] {
  return units.filter((unit) => unit.owner === owner
    && !unit.health.depleted
    && !unit.dying
    && insideFootprint(stats, x, z, unit.position.x, unit.position.z, unit.navRadius));
}

/**
 * Whether a unit hostile to `owner` is standing in the footprint. This is the
 * one case that still refuses the placement outright.
 */
export function enemyOccupiesFootprint(
  units: readonly Unit[],
  owner: UnitOwner,
  stats: BuildingBalanceStats,
  x: number,
  z: number,
): boolean {
  return units.some((unit) => unit.owner !== owner
    && !unit.health.depleted
    && !unit.dying
    && insideFootprint(stats, x, z, unit.position.x, unit.position.z, unit.navRadius));
}

/**
 * Order every friendly unit inside the footprint to walk clear of it.
 *
 * Units get a real move order rather than a teleport: an instant relocation
 * reads as a glitch, and skips the separation/navigation state that keeps the
 * crowd coherent. A unit with no reachable exit — fully enclosed — is snapped as
 * a last resort, because leaving it inside the blocker is the bug this exists to
 * prevent.
 *
 * Call this *before* the new footprint is added to the navigation blockers, so
 * the routes planned here are not routes out of a wall the unit is already in.
 */
export function evictUnitsFromFootprint(
  units: readonly Unit[],
  owner: UnitOwner,
  stats: BuildingBalanceStats,
  x: number,
  z: number,
  navigation: RtsNavigation,
): Unit[] {
  const evicted = unitsInFootprint(units, owner, stats, x, z);
  for (const unit of evicted) {
    const exit = findExitPoint(unit, stats, x, z, navigation);
    if (!exit) {
      // Nowhere to walk. Put the unit on the footprint edge anyway; a stuck unit
      // is worse than a discontinuous one.
      const snapped = snapToFootprintEdge(unit, stats, x, z);
      unit.stop();
      unit.position.x = snapped.x;
      unit.position.z = snapped.z;
      continue;
    }
    const path = navigation.plan(unit.position, exit);
    // `setMovePath` (not the player variant) on purpose: this is an automatic
    // displacement, so worker automation may reclaim the unit the moment it is
    // clear, rather than treating the shove as a player-chosen destination.
    if (path && path.length > 0) unit.setMovePath(path);
    else unit.setMoveTarget(exit.x, exit.z);
  }
  return evicted;
}

/** Nearest walkable point outside the footprint, searched ring by ring. */
function findExitPoint(
  unit: Unit,
  stats: BuildingBalanceStats,
  x: number,
  z: number,
  navigation: RtsNavigation,
): Vector3 | null {
  const margin = unit.navRadius + EVICTION_CLEARANCE;
  const baseRadius = Math.hypot(stats.footprint.width / 2 + margin, stats.footprint.depth / 2 + margin);
  // Bias the ring scan toward the direction the unit is already offset in, so a
  // unit near one edge leaves by that edge instead of crossing the whole site.
  const offsetX = unit.position.x - x;
  const offsetZ = unit.position.z - z;
  const bias = Math.atan2(offsetX, offsetZ);
  for (let extra = 0; extra <= EVICTION_MAX_EXTRA; extra += EVICTION_STEP) {
    const radius = baseRadius + extra;
    for (let i = 0; i < EVICTION_DIRECTIONS; i += 1) {
      // Alternate sides of the bias direction: 0, +1, -1, +2, -2, …
      const half = Math.ceil(i / 2);
      const angle = bias + (i % 2 === 0 ? half : -half) * ((2 * Math.PI) / EVICTION_DIRECTIONS);
      const candidateX = x + Math.sin(angle) * radius;
      const candidateZ = z + Math.cos(angle) * radius;
      if (insideFootprint(stats, x, z, candidateX, candidateZ, margin)) continue;
      if (!navigation.isWalkable(candidateX, candidateZ)) continue;
      return new Vector3(candidateX, 0, candidateZ);
    }
  }
  return null;
}

/** Shortest push straight out of the nearest footprint edge. */
function snapToFootprintEdge(
  unit: Unit,
  stats: BuildingBalanceStats,
  x: number,
  z: number,
): { readonly x: number; readonly z: number } {
  const margin = unit.navRadius + EVICTION_CLEARANCE;
  const halfWidth = stats.footprint.width / 2 + margin;
  const halfDepth = stats.footprint.depth / 2 + margin;
  const offsetX = unit.position.x - x;
  const offsetZ = unit.position.z - z;
  const penetrationX = halfWidth - Math.abs(offsetX);
  const penetrationZ = halfDepth - Math.abs(offsetZ);
  if (penetrationX <= penetrationZ) {
    return { x: x + Math.sign(offsetX || 1) * halfWidth, z: unit.position.z };
  }
  return { x: unit.position.x, z: z + Math.sign(offsetZ || 1) * halfDepth };
}

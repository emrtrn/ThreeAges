/** Pure grid snapping and footprint validation for Phase 2 building placement. */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import { RTS_WORLD_HALF_EXTENT } from "../world/rtsGround";

/** Confirmed Phase 2 placement-grid measure, in world units. */
export const RTS_PLACEMENT_GRID_SIZE = 2;

export type PlacementFailure = "outside-map" | "outside-control" | "blocked" | "insufficient-resources";

export interface PlacementResult {
  readonly x: number;
  readonly z: number;
  readonly valid: boolean;
  readonly reason: PlacementFailure | null;
}

export interface PlacementControl {
  readonly owner: UnitOwner;
  readonly ownsFootprint: (owner: UnitOwner, x: number, z: number, width: number, depth: number) => boolean;
  readonly canPlaceExpansion: (owner: UnitOwner, x: number, z: number, width: number, depth: number, maximumGap: number) => boolean;
}

/** Snap a ground point to the centre of the nearest authored placement cell. */
export function snapToPlacementGrid(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.round(x / RTS_PLACEMENT_GRID_SIZE) * RTS_PLACEMENT_GRID_SIZE,
    z: Math.round(z / RTS_PLACEMENT_GRID_SIZE) * RTS_PLACEMENT_GRID_SIZE,
  };
}

/** Convert a building's centred XZ footprint into a static nav/occupancy blocker. */
export function buildingFootprintBlocker(
  stats: BuildingBalanceStats,
  x: number,
  z: number,
): NavBlocker {
  const halfWidth = stats.footprint.width / 2;
  const halfDepth = stats.footprint.depth / 2;
  return {
    min: [x - halfWidth, 0, z - halfDepth],
    max: [x + halfWidth, 3, z + halfDepth],
  };
}

/**
 * Validate a snapped proposal against map bounds and all existing structure/nav
 * footprints. Resource reservation deliberately belongs to the next slice.
 */
export function validateBuildingPlacement(
  stats: BuildingBalanceStats,
  x: number,
  z: number,
  occupied: readonly NavBlocker[],
  control?: PlacementControl,
): PlacementResult {
  const snapped = snapToPlacementGrid(x, z);
  const candidate = buildingFootprintBlocker(stats, snapped.x, snapped.z);
  const [minX, , minZ] = candidate.min;
  const [maxX, , maxZ] = candidate.max;
  if (minX < -RTS_WORLD_HALF_EXTENT || maxX > RTS_WORLD_HALF_EXTENT
    || minZ < -RTS_WORLD_HALF_EXTENT || maxZ > RTS_WORLD_HALF_EXTENT) {
    return { ...snapped, valid: false, reason: "outside-map" };
  }
  if (occupied.some((blocker) => footprintsOverlap(candidate, blocker))) {
    return { ...snapped, valid: false, reason: "blocked" };
  }
  const territoryAllowed = stats.territory
    ? control?.canPlaceExpansion(
      control.owner,
      snapped.x,
      snapped.z,
      stats.footprint.width,
      stats.footprint.depth,
      stats.territory.expansionPlacementRange,
    )
    : control?.ownsFootprint(
      control.owner,
      snapped.x,
      snapped.z,
      stats.footprint.width,
      stats.footprint.depth,
    );
  if (control && !territoryAllowed) {
    return { ...snapped, valid: false, reason: "outside-control" };
  }
  return { ...snapped, valid: true, reason: null };
}

function footprintsOverlap(a: NavBlocker, b: NavBlocker): boolean {
  return a.min[0] < b.max[0] && a.max[0] > b.min[0]
    && a.min[2] < b.max[2] && a.max[2] > b.min[2];
}

/** Strict footprint-edge production links, used first by the Windmill. */
import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import type { PlacedStructure } from "./placedStructureSystem";

const EDGE_EPSILON = 0.0001;

interface FootprintStructure {
  readonly x: number;
  readonly z: number;
  readonly stats: Pick<BuildingBalanceStats, "footprint">;
}

/** True only when two footprint rectangles share non-zero length of one edge. */
export function footprintsShareEdge(left: FootprintStructure, right: FootprintStructure): boolean {
  const leftMinX = left.x - left.stats.footprint.width / 2;
  const leftMaxX = left.x + left.stats.footprint.width / 2;
  const leftMinZ = left.z - left.stats.footprint.depth / 2;
  const leftMaxZ = left.z + left.stats.footprint.depth / 2;
  const rightMinX = right.x - right.stats.footprint.width / 2;
  const rightMaxX = right.x + right.stats.footprint.width / 2;
  const rightMinZ = right.z - right.stats.footprint.depth / 2;
  const rightMaxZ = right.z + right.stats.footprint.depth / 2;
  const overlapsX = Math.min(leftMaxX, rightMaxX) - Math.max(leftMinX, rightMinX) > EDGE_EPSILON;
  const overlapsZ = Math.min(leftMaxZ, rightMaxZ) - Math.max(leftMinZ, rightMinZ) > EDGE_EPSILON;
  return (
    (Math.abs(leftMaxX - rightMinX) <= EDGE_EPSILON || Math.abs(rightMaxX - leftMinX) <= EDGE_EPSILON) && overlapsZ
  ) || (
    (Math.abs(leftMaxZ - rightMinZ) <= EDGE_EPSILON || Math.abs(rightMaxZ - leftMinZ) <= EDGE_EPSILON) && overlapsX
  );
}

/** Placement gate for a building whose balance declares a production link. */
export function hasRequiredAdjacentCompletedBuilding(
  stats: BuildingBalanceStats,
  owner: UnitOwner,
  x: number,
  z: number,
  structures: readonly PlacedStructure[],
): boolean {
  const rule = stats.productionAdjacency;
  if (!rule) return true;
  return structures.some((structure) =>
    structure.owner === owner
    && structure.construction.complete
    && structure.stats.id === rule.targetBuildingId
    && footprintsShareEdge({ x, z, stats }, structure));
}

/** Multiple supports do not stack: an adjacent farm receives the strongest one. */
export function productionAdjacencyMultiplier(
  structure: PlacedStructure,
  structures: readonly PlacedStructure[],
): number {
  if (!structure.construction.complete) return 1;
  return structures.reduce((multiplier, support) => {
    const rule = support.stats.productionAdjacency;
    if (
      support.owner !== structure.owner
      || !support.construction.complete
      || !rule
      || rule.targetBuildingId !== structure.stats.id
      || !footprintsShareEdge(structure, support)
    ) return multiplier;
    return Math.max(multiplier, rule.multiplier);
  }, 1);
}

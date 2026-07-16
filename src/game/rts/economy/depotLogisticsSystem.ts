/**
 * Phase 4 depot nodes. A completed depot becomes an endpoint of the road graph
 * when a road tile physically touches its footprint; transfer is layered on
 * this stable node contract in the following logistics slices.
 */
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { UnitOwner } from "../units/unit";

export type DepotNodeStatus = "unlinked" | "linked";

export interface DepotNodeSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly roadCell: RoadCell | null;
  readonly componentId: number | null;
  readonly status: DepotNodeStatus;
}

/** Read-only depot-to-road node projection, recomputed from mutable world state. */
export class DepotLogisticsSystem {
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly roads: RoadGraph,
  ) {}

  snapshots(): readonly DepotNodeSnapshot[] {
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    return this.structures.all()
      .filter((structure) => structure.construction.complete && structure.stats.id === "depot")
      .map((structure) => {
        const roadCell = roadCellTouchingFootprint(
          this.roads,
          structure.x,
          structure.z,
          structure.stats.footprint.width,
          structure.stats.footprint.depth,
        );
        const componentId = roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null;
        return {
          structureId: structure.id,
          owner: structure.owner,
          x: structure.x,
          z: structure.z,
          roadCell,
          componentId,
          status: componentId === null ? "unlinked" : "linked",
        };
      });
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

/**
 * Returns the deterministic road tile whose footprint touches a structure.
 *
 * The tolerance is half a road cell rather than zero because a road tile can
 * never *overlap* a footprint — the footprint is a nav blocker, so the graph
 * refuses to route through it. "Touching" therefore means the nearest legal
 * tile outside the footprint, and whether one lands exactly on the edge depends
 * on how the footprint's half-width falls on the 2-unit road grid.
 *
 * Even footprints (depot/farm/outpost, 6) happen to line up; the 7-unit command
 * centre does not, and with a zero tolerance *no* tile could ever touch it —
 * which silently made {@link RtsApp.outpostConnectedToMainRoad} always false and
 * withheld the outpost's connected control radius from both kingdoms.
 */
export function roadCellTouchingFootprint(
  roads: RoadGraph,
  x: number,
  z: number,
  width: number,
  depth: number,
): RoadCell | null {
  const halfRoad = roads.cellSize / 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  return roads.all()
    .map((cell) => ({
      cell,
      distance: Math.hypot(
        Math.max(0, Math.abs(cell.x - x) - halfWidth - halfRoad),
        Math.max(0, Math.abs(cell.z - z) - halfDepth - halfRoad),
      ),
    }))
    .filter((candidate) => candidate.distance <= halfRoad)
    .sort((a, b) => a.distance - b.distance || a.cell.x - b.cell.x || a.cell.z - b.cell.z)
    .map((candidate) => ({ x: candidate.cell.x, z: candidate.cell.z }))[0] ?? null;
}

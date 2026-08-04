/** Phase 4 producer-to-depot graph attachment; transfer remains a later step. */
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { TerritoryControlSystem } from "../territory/territoryControlSystem";
import type { UnitOwner } from "../units/unit";
import { type DepotLogisticsSystem, roadCellTouchingFootprint } from "./depotLogisticsSystem";
import type { LogisticsOccupationSystem } from "./logisticsOccupationSystem";

export type ProducerLogisticsStatus = "outside-control" | "unlinked-road" | "unlinked-depot" | "unlinked-main-network" | "depot-occupied" | "linked";

export interface ProducerLogisticsSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly resourceId: string;
  readonly roadCell: RoadCell | null;
  readonly componentId: number | null;
  readonly depotStructureId: number | null;
  readonly status: ProducerLogisticsStatus;
}

/** Resolves a producer's physical road contact and its route back to the kingdom's store. */
export class ProductionLogisticsSystem {
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly roads: RoadGraph,
    private readonly depots: DepotLogisticsSystem,
    private readonly territory?: TerritoryControlSystem,
    private readonly occupation?: LogisticsOccupationSystem,
  ) {}

  snapshots(): readonly ProducerLogisticsSnapshot[] {
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    const mainComponentByOwner = this.depots.mainComponentIds();
    return this.structures.all()
      .filter((structure) => structure.construction.complete && structure.economy)
      .map((structure) => {
        const economy = structure.economy;
        if (!economy) throw new Error("Completed producer missing economy balance");
        const roadCell = roadCellTouchingFootprint(
          this.roads,
          structure.x,
          structure.z,
          structure.stats.footprint.width,
          structure.stats.footprint.depth,
        );
        const componentId = roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null;
        const mainComponentId = mainComponentByOwner.get(structure.owner);
        const endpoint = roadCell === null ? null : this.depots.endpointsFor(structure.owner)
          .filter((candidate) => candidate.structureId === null
            || (this.occupation?.isUsable(candidate.structureId) ?? true))
          .map((candidate) => ({ candidate, route: this.roads.route(roadCell, candidate.roadCell) }))
          .filter((candidate): candidate is { candidate: { structureId: number | null; roadCell: RoadCell }; route: readonly RoadCell[] } => candidate.route !== null)
          .sort((a, b) => a.route.length - b.route.length
            || (a.candidate.structureId ?? -1) - (b.candidate.structureId ?? -1))[0]?.candidate ?? null;
        const depotStructureId = endpoint?.structureId ?? null;
        const occupiedDepotOnComponent = componentId !== null && this.occupation !== undefined
          && this.depots.snapshots().some((depot) => depot.owner === structure.owner
            && depot.componentId === componentId
            && !this.occupation!.isUsable(depot.structureId));
        const controlled = this.territory?.ownsFootprint(
          structure.owner, structure.x, structure.z, structure.stats.footprint.width, structure.stats.footprint.depth,
        ) ?? true;
        return {
          structureId: structure.id,
          owner: structure.owner,
          resourceId: economy.resourceId,
          roadCell,
          componentId,
          depotStructureId,
          status: !controlled
            ? "outside-control"
            : componentId === null
              ? "unlinked-road"
              : endpoint !== null
                ? "linked"
                : occupiedDepotOnComponent
                  ? "depot-occupied"
                  : mainComponentId !== undefined
                    ? "unlinked-main-network"
                    : "unlinked-depot",
        };
      });
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

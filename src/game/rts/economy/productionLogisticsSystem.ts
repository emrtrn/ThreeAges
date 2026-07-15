/** Phase 4 producer-to-depot graph attachment; transfer remains a later step. */
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import { type DepotLogisticsSystem, roadCellTouchingFootprint } from "./depotLogisticsSystem";

export type ProducerLogisticsStatus = "unlinked-road" | "unlinked-depot" | "linked";

export interface ProducerLogisticsSnapshot {
  readonly structureId: number;
  readonly resourceId: string;
  readonly roadCell: RoadCell | null;
  readonly componentId: number | null;
  readonly depotStructureId: number | null;
  readonly status: ProducerLogisticsStatus;
}

/** Resolves a producer's physical road contact and any depot on that same graph island. */
export class ProductionLogisticsSystem {
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly roads: RoadGraph,
    private readonly depots: DepotLogisticsSystem,
  ) {}

  snapshots(): readonly ProducerLogisticsSnapshot[] {
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    const depotByComponent = new Map<number, number>();
    for (const depot of this.depots.snapshots()) {
      if (depot.componentId === null) continue;
      const existing = depotByComponent.get(depot.componentId);
      if (existing === undefined || depot.structureId < existing) depotByComponent.set(depot.componentId, depot.structureId);
    }
    return this.structures.all()
      .filter((structure) => structure.construction.complete && structure.stats.economy)
      .map((structure) => {
        const economy = structure.stats.economy;
        if (!economy) throw new Error("Completed producer missing economy balance");
        const roadCell = roadCellTouchingFootprint(
          this.roads,
          structure.x,
          structure.z,
          structure.stats.footprint.width,
          structure.stats.footprint.depth,
        );
        const componentId = roadCell ? componentByCell.get(this.key(roadCell)) ?? null : null;
        const depotStructureId = componentId === null ? null : depotByComponent.get(componentId) ?? null;
        return {
          structureId: structure.id,
          resourceId: economy.resourceId,
          roadCell,
          componentId,
          depotStructureId,
          status: componentId === null ? "unlinked-road" : depotStructureId === null ? "unlinked-depot" : "linked",
        };
      });
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

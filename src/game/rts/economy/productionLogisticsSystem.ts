/** Phase 4 producer-to-depot graph attachment; transfer remains a later step. */
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { TerritoryControlSystem } from "../territory/territoryControlSystem";
import type { UnitOwner } from "../units/unit";
import { type DepotLogisticsSystem, roadCellTouchingFootprint } from "./depotLogisticsSystem";
import type { LogisticsOccupationSystem } from "./logisticsOccupationSystem";

export type ProducerLogisticsStatus = "outside-control" | "unlinked-road" | "unlinked-depot" | "depot-occupied" | "linked";

export interface ProducerLogisticsSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
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
    private readonly territory?: TerritoryControlSystem,
    private readonly occupation?: LogisticsOccupationSystem,
  ) {}

  snapshots(): readonly ProducerLogisticsSnapshot[] {
    const componentByCell = new Map<string, number>();
    for (const component of this.roads.components()) {
      for (const cell of component.cells) componentByCell.set(this.key(cell), component.id);
    }
    // Roads are unowned in AI-1, so a single component can touch both kingdoms.
    // Key by owner too: a producer may only deliver into its own depot.
    const depotByComponent = new Map<string, number>();
    for (const depot of this.depots.snapshots()) {
      if (depot.componentId === null) continue;
      const key = `${depot.owner}:${depot.componentId}`;
      const existing = depotByComponent.get(key);
      if (existing === undefined || depot.structureId < existing) depotByComponent.set(key, depot.structureId);
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
        const depotStructureId = componentId === null
          ? null
          : depotByComponent.get(`${structure.owner}:${componentId}`) ?? null;
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
              : depotStructureId === null
                ? "unlinked-depot"
                : this.occupation !== undefined && !this.occupation.isUsable(depotStructureId)
                  ? "depot-occupied"
                  : "linked",
        };
      });
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }
}

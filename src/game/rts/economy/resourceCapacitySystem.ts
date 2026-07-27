/**
 * Global stock capacity supplied by the command centre's basic store and every
 * completed depot. The depot field is deliberately read from the live
 * age×level tier, so an upgrade immediately changes the amount logistics may
 * accept without copying capacity state into a second mutable registry.
 */
import type { StartingResources } from "../../data/gameDataTypes";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { DepotLogisticsSystem } from "./depotLogisticsSystem";

export const STOCK_RESOURCE_IDS = ["food", "wood", "stone", "gold"] as const;

/** The command centre's starter store; depots add their tier's values on top. */
export const COMMAND_CENTER_STORAGE_CAPACITY: StartingResources = {
  food: 500,
  wood: 500,
  stone: 300,
  gold: 300,
};

export interface ResourceCapacitySnapshot {
  readonly owner: UnitOwner;
  readonly capacity: StartingResources;
}

export class ResourceCapacitySystem {
  constructor(
    private readonly structures: PlacedStructureSystem,
    /** A live match supplies this, so isolated road islands cannot add capacity. */
    private readonly depots?: DepotLogisticsSystem,
  ) {}

  capacityFor(owner: UnitOwner): StartingResources {
    const capacity: Record<string, number> = { ...COMMAND_CENTER_STORAGE_CAPACITY };
    const depotStatusById = new Map(this.depots?.snapshots().map((depot) => [depot.structureId, depot.status]));
    for (const depot of this.structures.ownedBy(owner)) {
      if (!depot.construction.complete || depot.stats.id !== "depot" || !depot.storageCapacity) continue;
      if (this.depots && depotStatusById.get(depot.id) !== "linked") continue;
      for (const resourceId of STOCK_RESOURCE_IDS) {
        capacity[resourceId] = (capacity[resourceId] ?? 0) + (depot.storageCapacity[resourceId] ?? 0);
      }
    }
    return capacity;
  }

  availableFor(owner: UnitOwner, resourceId: string, currentAmount: number): number {
    return Math.max(0, (this.capacityFor(owner)[resourceId] ?? 0) - currentAmount);
  }

  snapshots(owners: readonly UnitOwner[]): readonly ResourceCapacitySnapshot[] {
    return owners.map((owner) => ({ owner, capacity: this.capacityFor(owner) }));
  }
}

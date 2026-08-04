/** Kervan varista producer bufferlarini krallik cuzdaniyla bulusturur. */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { CaravanArrival } from "../logistics/caravanSystem";
import type { UnitOwner } from "../units/unit";
import type { EconomyProductionSystem } from "./economyProductionSystem";
import type { ProductionLogisticsSystem } from "./productionLogisticsSystem";
import type { ResourceCapacitySystem } from "./resourceCapacitySystem";

export interface LogisticsTransferSnapshot {
  readonly structureId: number;
  readonly owner: UnitOwner;
  readonly resourceId: string;
  readonly amount: number;
  readonly totalTransferred: number;
}

/** Faz 4: only an arriving caravan may withdraw from a linked producer buffer. */
export class LogisticsTransferSystem {
  private readonly transfers = new Map<number, LogisticsTransferSnapshot>();

  constructor(
    private readonly production: EconomyProductionSystem,
    private readonly links: ProductionLogisticsSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly capacity?: ResourceCapacitySystem,
  ) {}

  update(arrivals: readonly CaravanArrival[] = []): void {
    const links = new Map(this.links.snapshots()
      .filter((link) => link.status === "linked")
      .map((link) => [link.structureId, link]));
    const amounts = new Map<number, number>();
    for (const arrival of arrivals) {
      const link = links.get(arrival.producerStructureId);
      if (!link || link.owner !== arrival.owner) continue;
      const wallet = this.kingdoms.get(link.owner).wallet;
      const capacity = this.capacity?.availableFor(link.owner, link.resourceId, wallet.amount(link.resourceId));
      const transfer = this.production.withdrawBuffered(
        link.structureId,
        capacity === undefined ? arrival.carryCapacity : Math.min(arrival.carryCapacity, capacity),
      );
      if (!transfer) continue;
      wallet.credit(transfer.resourceId, transfer.amount);
      amounts.set(link.structureId, (amounts.get(link.structureId) ?? 0) + transfer.amount);
    }
    for (const [structureId, snapshot] of this.transfers) {
      if (!links.has(structureId)) this.transfers.set(structureId, { ...snapshot, amount: 0 });
    }
    for (const link of links.values()) {
      this.record(link.structureId, link.owner, link.resourceId, amounts.get(link.structureId) ?? 0);
    }
  }

  snapshots(): readonly LogisticsTransferSnapshot[] {
    return [...this.transfers.values()].sort((a, b) => a.structureId - b.structureId);
  }

  reset(): void {
    this.transfers.clear();
  }

  private record(structureId: number, owner: UnitOwner, resourceId: string, amount: number): void {
    const previous = this.transfers.get(structureId);
    this.transfers.set(structureId, {
      structureId,
      owner,
      resourceId,
      amount,
      totalTransferred: (previous?.totalTransferred ?? 0) + amount,
    });
  }
}

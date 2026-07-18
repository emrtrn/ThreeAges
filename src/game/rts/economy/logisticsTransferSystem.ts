/** Instant V1 transfer from connected producer buffers into the owner's wallet. */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
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

/** Individual carts are out of scope: linked buffers flush after production. */
export class LogisticsTransferSystem {
  private readonly transfers = new Map<number, LogisticsTransferSnapshot>();

  constructor(
    private readonly production: EconomyProductionSystem,
    private readonly links: ProductionLogisticsSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly capacity?: ResourceCapacitySystem,
  ) {}

  update(): void {
    const linkedIds = new Set<number>();
    for (const link of this.links.snapshots()) {
      if (link.status !== "linked") continue;
      linkedIds.add(link.structureId);
      const wallet = this.kingdoms.get(link.owner).wallet;
      const transfer = this.production.withdrawBuffered(
        link.structureId,
        this.capacity?.availableFor(link.owner, link.resourceId, wallet.amount(link.resourceId)),
      );
      if (!transfer) {
        this.record(link.structureId, link.owner, link.resourceId, 0);
        continue;
      }
      wallet.credit(transfer.resourceId, transfer.amount);
      this.record(link.structureId, link.owner, transfer.resourceId, transfer.amount);
    }
    for (const [structureId, snapshot] of this.transfers) {
      if (!linkedIds.has(structureId)) this.transfers.set(structureId, { ...snapshot, amount: 0 });
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

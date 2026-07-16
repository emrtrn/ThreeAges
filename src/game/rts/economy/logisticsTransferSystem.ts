/** Instant V1 transfer from connected producer buffers into the global wallet. */
import type { ResourceWallet } from "./resourceWallet";
import type { EconomyProductionSystem } from "./economyProductionSystem";
import type { ProductionLogisticsSystem } from "./productionLogisticsSystem";

export interface LogisticsTransferSnapshot {
  readonly structureId: number;
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
    private readonly wallet: ResourceWallet,
  ) {}

  update(): void {
    const linkedIds = new Set<number>();
    for (const link of this.links.snapshots()) {
      if (link.status !== "linked") continue;
      linkedIds.add(link.structureId);
      const transfer = this.production.withdrawBuffered(link.structureId);
      if (!transfer) {
        this.record(link.structureId, link.resourceId, 0);
        continue;
      }
      this.wallet.credit(transfer.resourceId, transfer.amount);
      this.record(link.structureId, transfer.resourceId, transfer.amount);
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

  private record(structureId: number, resourceId: string, amount: number): void {
    const previous = this.transfers.get(structureId);
    this.transfers.set(structureId, {
      structureId,
      resourceId,
      amount,
      totalTransferred: (previous?.totalTransferred ?? 0) + amount,
    });
  }
}

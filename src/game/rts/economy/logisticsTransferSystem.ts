/** Kervan varista producer bufferlarini krallik cuzdaniyla bulusturur. */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { CaravanArrival } from "../logistics/caravanSystem";
import { producerLaneId } from "../logistics/producerCaravanLanes";
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

/** Linked producers either hand off locally or withdraw when their caravan arrives. */
export class LogisticsTransferSystem {
  private readonly transfers = new Map<number, LogisticsTransferSnapshot>();

  constructor(
    private readonly production: EconomyProductionSystem,
    private readonly links: ProductionLogisticsSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly capacity?: ResourceCapacitySystem,
  ) {}

  /**
   * Arrivals are keyed by lane (supply plan §3.4), and this system answers for
   * exactly one kind of lane. A trade site's delivery flows past untouched —
   * its goods belong on a market shelf, not in the wallet — so the lookup below
   * is also the filter that keeps the two deliveries from crossing.
   */
  update(arrivals: readonly CaravanArrival[] = []): void {
    const links = new Map(this.links.snapshots()
      .filter((link) => link.status === "linked")
      .map((link) => [producerLaneId(link.structureId), link]));
    const amounts = new Map<number, number>();
    // A producer inside the centre/depot's local access radius has no road trip
    // to simulate. It still takes the same capacity-limited withdrawal path as
    // a delivered load, so a full global store leaves its goods in the local
    // buffer rather than creating or losing stock.
    for (const link of links.values()) {
      if (link.transport !== "direct") continue;
      this.transfer(link.structureId, link.owner, link.resourceId, Number.POSITIVE_INFINITY, amounts);
    }
    for (const arrival of arrivals) {
      const link = links.get(arrival.laneId);
      if (!link || link.transport === "direct" || link.owner !== arrival.owner) continue;
      this.transfer(link.structureId, link.owner, link.resourceId, arrival.carryCapacity, amounts);
    }
    for (const [structureId, snapshot] of this.transfers) {
      if (!links.has(producerLaneId(structureId))) this.transfers.set(structureId, { ...snapshot, amount: 0 });
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

  private transfer(
    structureId: number,
    owner: UnitOwner,
    resourceId: string,
    maximumAmount: number,
    amounts: Map<number, number>,
  ): void {
    const wallet = this.kingdoms.get(owner).wallet;
    const capacity = this.capacity?.availableFor(owner, resourceId, wallet.amount(resourceId));
    const transfer = this.production.withdrawBuffered(
      structureId,
      capacity === undefined ? maximumAmount : Math.min(maximumAmount, capacity),
    );
    if (!transfer) return;
    wallet.credit(transfer.resourceId, transfer.amount);
    amounts.set(structureId, (amounts.get(structureId) ?? 0) + transfer.amount);
  }
}

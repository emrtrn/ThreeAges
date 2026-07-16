/** Small V1 hook for contesting a depot without taking ownership of its building. */
import type { DepotLogisticsSystem } from "./depotLogisticsSystem";

export type LogisticsOccupier = "enemy" | null;

export class LogisticsOccupationSystem {
  private readonly occupiers = new Map<number, LogisticsOccupier>();

  constructor(private readonly depots: DepotLogisticsSystem) {}

  setOccupier(structureId: number, occupier: LogisticsOccupier): void {
    if (occupier === null) this.occupiers.delete(structureId);
    else this.occupiers.set(structureId, occupier);
  }

  isUsable(structureId: number): boolean {
    return this.occupiers.get(structureId) !== "enemy";
  }

  occupierFor(structureId: number): LogisticsOccupier {
    return this.occupiers.get(structureId) ?? null;
  }

  /** Drop state for depots that no longer exist after destruction/restart. */
  sync(): void {
    const live = new Set(this.depots.snapshots().map((depot) => depot.structureId));
    for (const structureId of this.occupiers.keys()) {
      if (!live.has(structureId)) this.occupiers.delete(structureId);
    }
  }

  reset(): void {
    this.occupiers.clear();
  }
}

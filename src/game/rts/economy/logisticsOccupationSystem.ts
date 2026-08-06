/** Small V1 hook for contesting a depot without taking ownership of its building. */
import type { DepotLogisticsSystem } from "./depotLogisticsSystem";

export type LogisticsOccupier = "enemy" | null;

export class LogisticsOccupationSystem {
  /**
   * Monotonic counter of every real change to who holds what. Producer logistics
   * memoises on it, so it must move only when {@link isUsable} could answer
   * differently — a no-op `setOccupier` deliberately leaves it alone.
   */
  version = 0;
  private readonly occupiers = new Map<number, LogisticsOccupier>();

  constructor(private readonly depots: DepotLogisticsSystem) {}

  setOccupier(structureId: number, occupier: LogisticsOccupier): void {
    if (this.occupierFor(structureId) === occupier) return;
    this.version += 1;
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
    if (this.occupiers.size === 0) return;
    const live = new Set(this.depots.snapshots().map((depot) => depot.structureId));
    for (const structureId of [...this.occupiers.keys()]) {
      if (live.has(structureId)) continue;
      this.occupiers.delete(structureId);
      this.version += 1;
    }
  }

  reset(): void {
    if (this.occupiers.size > 0) this.version += 1;
    this.occupiers.clear();
  }
}

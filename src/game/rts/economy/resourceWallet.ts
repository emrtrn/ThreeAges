/**
 * Deterministic resource wallet for Phase 2 construction reservations.
 * A reservation is refundable exactly once, so cancelled sites cannot duplicate
 * stock or drive resources negative.
 */
import type { StartingResources } from "../../data/gameDataTypes";

export interface ResourceReservation {
  readonly id: number;
  readonly cost: StartingResources;
}

export class ResourceWallet {
  private readonly amounts = new Map<string, number>();
  private readonly openReservations = new Set<number>();
  private nextReservationId = 1;

  constructor(startingResources: StartingResources) {
    this.reset(startingResources);
  }

  amount(resourceId: string): number {
    return this.amounts.get(resourceId) ?? 0;
  }

  snapshot(): StartingResources {
    return Object.fromEntries([...this.amounts.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  /** Atomically deduct a cost, or return null without changing a balance. */
  reserve(cost: StartingResources): ResourceReservation | null {
    for (const [resourceId, amount] of Object.entries(cost)) {
      if (amount < 0 || !Number.isFinite(amount) || this.amount(resourceId) < amount) return null;
    }
    const normalized = Object.fromEntries(Object.entries(cost).filter(([, amount]) => amount > 0));
    for (const [resourceId, amount] of Object.entries(normalized)) {
      this.amounts.set(resourceId, this.amount(resourceId) - amount);
    }
    const reservation = { id: this.nextReservationId++, cost: normalized };
    this.openReservations.add(reservation.id);
    return reservation;
  }

  /** Refund exactly one still-open reservation. */
  refund(reservation: ResourceReservation): boolean {
    if (!this.openReservations.delete(reservation.id)) return false;
    for (const [resourceId, amount] of Object.entries(reservation.cost)) {
      this.amounts.set(resourceId, this.amount(resourceId) + amount);
    }
    return true;
  }

  /** Reset a match wallet; any prior reservation token becomes invalid. */
  reset(startingResources: StartingResources): void {
    this.amounts.clear();
    for (const [resourceId, amount] of Object.entries(startingResources)) {
      this.amounts.set(resourceId, Math.max(0, amount));
    }
    this.openReservations.clear();
    this.nextReservationId = 1;
  }
}

/**
 * Phase 3 population capacity and queue-reservation rules, scoped to one
 * kingdom. Faz 5 runs one instance per owner so the AI hits the same cap the
 * player does (AI design §4) instead of sharing the player's headroom.
 */
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";

export interface PopulationReservation {
  readonly id: number;
  readonly amount: number;
}

export interface PopulationSnapshot {
  readonly current: number;
  readonly reserved: number;
  readonly capacity: number;
  readonly used: number;
}

export class PopulationSystem {
  private readonly openReservations = new Set<number>();
  private nextReservationId = 1;
  private reserved = 0;

  constructor(
    private readonly owner: UnitOwner,
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly baseCapacity: number,
  ) {
    if (!Number.isInteger(baseCapacity) || baseCapacity < 0) {
      throw new RangeError("Population base capacity must be a non-negative integer");
    }
  }

  snapshot(): PopulationSnapshot {
    const current = this.units.unitsOf(this.owner).length;
    const capacity = this.baseCapacity + this.structures.ownedBy(this.owner)
      .filter((structure) => structure.construction.complete)
      .reduce((total, structure) => total + (structure.stats.populationCapacity ?? 0) + structure.populationCapacityBonus, 0);
    return { current, reserved: this.reserved, capacity, used: current + this.reserved };
  }

  reserve(amount: number): PopulationReservation | null {
    if (!Number.isInteger(amount) || amount <= 0) return null;
    const snapshot = this.snapshot();
    if (snapshot.used + amount > snapshot.capacity) return null;
    const reservation = { id: this.nextReservationId++, amount };
    this.openReservations.add(reservation.id);
    this.reserved += amount;
    return reservation;
  }

  release(reservation: PopulationReservation): boolean {
    if (!this.openReservations.delete(reservation.id)) return false;
    this.reserved -= reservation.amount;
    return true;
  }

  commit(reservation: PopulationReservation): boolean {
    return this.release(reservation);
  }

  reset(): void {
    this.openReservations.clear();
    this.reserved = 0;
    this.nextReservationId = 1;
  }
}

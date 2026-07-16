/**
 * The first completed-building function: a Barracks trains one Guard at a
 * time and places it on a navigable exit point outside the building footprint.
 * Phase 3 reserves the JSON cost and population slot before the timer starts.
 */
import { Vector3 } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { PopulationReservation } from "../economy/populationSystem";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";

export type GuardProductionResult =
  | "queued"
  | "no-completed-barracks"
  | "already-training"
  | "exit-blocked"
  | "insufficient-resources"
  | "population-full";

export interface GuardProductionEvent {
  readonly type: "completed" | "exit-blocked";
  readonly structure: PlacedStructure;
}

interface GuardQueue {
  readonly structure: PlacedStructure;
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

export class BarracksProductionSystem {
  private readonly queues = new Map<number, GuardQueue>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly guardStats: UnitBalanceStats,
    private readonly kingdoms: KingdomRegistry,
  ) {}

  /** Train a Guard at one kingdom's Barracks, paid from that kingdom's economy. */
  queueGuard(owner: UnitOwner): GuardProductionResult {
    const barracks = this.structures.ownedBy(owner).find(
      (structure) => structure.stats.id === "barracks" && structure.construction.complete,
    );
    if (!barracks) return "no-completed-barracks";
    if (this.queues.has(barracks.id)) return "already-training";
    const { wallet, population: pool } = this.kingdoms.get(owner);
    const resources = wallet.reserve(this.guardStats.cost);
    if (!resources) return "insufficient-resources";
    const population = pool.reserve(this.guardStats.populationCost);
    if (!population) {
      wallet.refund(resources);
      return "population-full";
    }
    this.queues.set(barracks.id, {
      structure: barracks,
      resources,
      population,
      remainingSeconds: this.guardStats.trainingSeconds,
    });
    return "queued";
  }

  update(deltaSeconds: number): GuardProductionEvent[] {
    const events: GuardProductionEvent[] = [];
    for (const [id, queue] of this.queues) {
      const { wallet, population } = this.kingdoms.get(queue.structure.owner);
      if (!this.structures.all().includes(queue.structure) || !queue.structure.construction.complete) {
        wallet.refund(queue.resources);
        population.release(queue.population);
        this.queues.delete(id);
        continue;
      }
      queue.remainingSeconds = Math.max(0, queue.remainingSeconds - Math.max(0, deltaSeconds));
      if (queue.remainingSeconds > 0) continue;
      const exit = this.findSafeExit(queue.structure);
      if (!exit) {
        events.push({ type: "exit-blocked", structure: queue.structure });
        continue;
      }
      this.units.spawn(queue.structure.owner, exit.x, exit.z, this.guardStats, "guard");
      wallet.commit(queue.resources);
      population.commit(queue.population);
      this.queues.delete(id);
      events.push({ type: "completed", structure: queue.structure });
    }
    return events;
  }

  reset(): void {
    for (const queue of this.queues.values()) {
      const { wallet, population } = this.kingdoms.get(queue.structure.owner);
      wallet.refund(queue.resources);
      population.release(queue.population);
    }
    this.queues.clear();
  }

  private findSafeExit(structure: PlacedStructure): Vector3 | null {
    const gap = 1.3;
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const candidates = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ];
    return candidates.find((point) => this.navigation.plan(point, point) !== null) ?? null;
  }
}

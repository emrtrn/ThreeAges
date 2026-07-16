/**
 * A Barracks trains Guards sequentially and places each on a navigable exit
 * point outside the building footprint. Paid orders follow the same age-based
 * 5 / 10 / 20 queue progression as workers.
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
  | "queue-full"
  | "exit-blocked"
  | "insufficient-resources"
  | "population-full"
  | "structure-upgrading";

export interface GuardProductionEvent {
  readonly type: "completed" | "exit-blocked";
  readonly structure: PlacedStructure;
}

interface GuardOrder {
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

interface GuardQueue {
  readonly structure: PlacedStructure;
  readonly orders: GuardOrder[];
}

export const GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL = [5, 10, 20] as const;

/** A future third age inherits the same queue curve without a new production-system change. */
export function guardQueueCapacityForAgeLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[0];
  const index = Math.min(GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL.length - 1, Math.floor(level) - 1);
  return GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[index] ?? GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[0];
}

export class BarracksProductionSystem {
  private readonly queues = new Map<number, GuardQueue>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly guardStats: UnitBalanceStats,
    private readonly kingdoms: KingdomRegistry,
    private readonly isStructureUpgrading: (structure: PlacedStructure) => boolean = () => false,
    /** Callers that do not own age state retain the original single-order behavior. */
    private readonly queueCapacityForOwner: (owner: UnitOwner) => number = () => 1,
  ) {}

  /** Train a Guard at one kingdom's Barracks, paid from that kingdom's economy. */
  queueGuard(owner: UnitOwner): GuardProductionResult {
    const barrackses = this.structures.ownedBy(owner).filter(
      (structure) => structure.stats.id === "barracks" && structure.construction.complete,
    );
    if (barrackses.length === 0) return "no-completed-barracks";
    const readyBarracks = barrackses.filter((structure) => !this.isStructureUpgrading(structure));
    if (readyBarracks.length === 0) return "structure-upgrading";
    const capacity = this.queueCapacityForOwner(owner);
    if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError("Guard queue capacity must be a positive integer");
    const barracks = readyBarracks
      .map((structure) => ({ structure, queued: this.queues.get(structure.id)?.orders.length ?? 0 }))
      .filter((candidate) => candidate.queued < capacity)
      .sort((left, right) => left.queued - right.queued || left.structure.id - right.structure.id)[0]?.structure;
    if (!barracks) return "queue-full";
    const { wallet, population: pool } = this.kingdoms.get(owner);
    const resources = wallet.reserve(this.guardStats.cost);
    if (!resources) return "insufficient-resources";
    const population = pool.reserve(this.guardStats.populationCost);
    if (!population) {
      wallet.refund(resources);
      return "population-full";
    }
    const order = { resources, population, remainingSeconds: this.guardStats.trainingSeconds };
    const queue = this.queues.get(barracks.id);
    if (queue) queue.orders.push(order);
    else this.queues.set(barracks.id, { structure: barracks, orders: [order] });
    return "queued";
  }

  /** Paid Guard orders currently held across every completed Barracks. */
  queuedCount(owner: UnitOwner): number {
    return [...this.queues.values()]
      .filter((queue) => queue.structure.owner === owner)
      .reduce((total, queue) => total + queue.orders.length, 0);
  }

  /** Total capacity; the per-Barracks age limit is multiplied by ready Barracks. */
  queueCapacity(owner: UnitOwner): number {
    const perBarracks = this.queueCapacityForOwner(owner);
    return this.structures.ownedBy(owner)
      .filter((structure) => structure.stats.id === "barracks" && structure.construction.complete && !this.isStructureUpgrading(structure))
      .length * perBarracks;
  }

  update(deltaSeconds: number): GuardProductionEvent[] {
    const events: GuardProductionEvent[] = [];
    for (const [id, queue] of this.queues) {
      const { wallet, population } = this.kingdoms.get(queue.structure.owner);
      if (!this.structures.all().includes(queue.structure) || !queue.structure.construction.complete) {
        for (const order of queue.orders) {
          wallet.refund(order.resources);
          population.release(order.population);
        }
        this.queues.delete(id);
        continue;
      }
      if (this.isStructureUpgrading(queue.structure)) continue;
      const order = queue.orders[0];
      if (!order) {
        this.queues.delete(id);
        continue;
      }
      order.remainingSeconds = Math.max(0, order.remainingSeconds - Math.max(0, deltaSeconds));
      if (order.remainingSeconds > 0) continue;
      const exit = this.findSafeExit(queue.structure);
      if (!exit) {
        events.push({ type: "exit-blocked", structure: queue.structure });
        continue;
      }
      this.units.spawn(queue.structure.owner, exit.x, exit.z, this.guardStats, "guard");
      wallet.commit(order.resources);
      population.commit(order.population);
      queue.orders.shift();
      if (queue.orders.length === 0) this.queues.delete(id);
      events.push({ type: "completed", structure: queue.structure });
    }
    return events;
  }

  reset(): void {
    for (const queue of this.queues.values()) {
      const { wallet, population } = this.kingdoms.get(queue.structure.owner);
      for (const order of queue.orders) {
        wallet.refund(order.resources);
        population.release(order.population);
      }
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

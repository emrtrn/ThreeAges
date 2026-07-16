/**
 * Barracks unit training — Vertical Slice Plan v0.2 §45 ("Üretim").
 *
 * A Barracks trains any unit its data allows, sequentially, and places each on a
 * navigable exit outside the footprint. Faz 7 widened this from Guards-only: the
 * Archer and the Ram unlock at Barracks II purely because their
 * `requiredBuildingLevel` says 2 (plan §2.10 — no separate Workshop, no id check
 * in code). Paid orders follow the same age-based 5 / 10 / 20 queue progression
 * as workers.
 */
import { Vector3 } from "three";

import type { UnitBalance, UnitBalanceStats } from "../../data/gameDataTypes";
import type { PopulationReservation } from "../economy/populationSystem";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";

export type UnitProductionResult =
  | "queued"
  | "unknown-unit"
  | "no-completed-barracks"
  | "requires-barracks-upgrade"
  | "queue-full"
  | "exit-blocked"
  | "insufficient-resources"
  | "population-full"
  | "structure-upgrading"
  | "disconnected";

/** Retained for the Faz 5 AI, which still only knows how to ask for Guards. */
export type GuardProductionResult = UnitProductionResult;

export interface UnitProductionEvent {
  readonly type: "completed" | "exit-blocked";
  readonly structure: PlacedStructure;
  readonly unitId: string;
  readonly label: string;
}

interface UnitOrder {
  readonly unitId: string;
  readonly stats: UnitBalanceStats;
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

interface BarracksQueue {
  readonly structure: PlacedStructure;
  readonly orders: UnitOrder[];
}

export const GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL = [5, 10, 20] as const;

/** A future third age inherits the same queue curve without a new production-system change. */
export function guardQueueCapacityForAgeLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[0];
  const index = Math.min(GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL.length - 1, Math.floor(level) - 1);
  return GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[index] ?? GUARD_QUEUE_CAPACITY_BY_AGE_LEVEL[0];
}

export class BarracksProductionSystem {
  private readonly queues = new Map<number, BarracksQueue>();
  /** Keyed by kingdom, not by Barracks: the rally point is a kingdom's order. */
  private readonly rallyPoints = new Map<UnitOwner, Vector3>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly unitBalance: UnitBalance,
    private readonly kingdoms: KingdomRegistry,
    private readonly isStructureUpgrading: (structure: PlacedStructure) => boolean = () => false,
    /** Callers that do not own age state retain the original single-order behavior. */
    private readonly queueCapacityForOwner: (owner: UnitOwner) => number = () => 1,
    /**
     * Plan §45: "Bağlantısı kesilen askerî yapının davranışını uygula". A
     * Barracks whose control area has been taken cannot train — the same rule
     * that severs a producer's logistics, applied to the military line.
     */
    private readonly isStructureConnected: (structure: PlacedStructure) => boolean = () => true,
    /** The Barracks-trained unit the Faz 5 AI asks for by default. */
    private readonly defaultUnitId = "guard_placeholder",
  ) {}

  /** Every unit this kingdom's Barracks could train right now, for the HUD. */
  trainableUnits(owner: UnitOwner): { readonly id: string; readonly stats: UnitBalanceStats; readonly unlocked: boolean }[] {
    const level = this.bestBarracksLevel(owner);
    return Object.entries(this.unitBalance)
      .filter(([, stats]) => stats.role !== "worker")
      .map(([id, stats]) => ({ id, stats, unlocked: level >= stats.requiredBuildingLevel }));
  }

  /** Train a Guard — the Faz 5 AI's only production verb (AI design §55). */
  queueGuard(owner: UnitOwner): UnitProductionResult {
    return this.queueUnit(owner, this.defaultUnitId);
  }

  /** Train one unit at a kingdom's Barracks, paid from that kingdom's economy. */
  queueUnit(owner: UnitOwner, unitId: string): UnitProductionResult {
    const stats = this.unitBalance[unitId];
    if (!stats || stats.role === "worker") return "unknown-unit";
    const completed = this.structures.ownedBy(owner).filter(
      (structure) => structure.stats.id === "barracks" && structure.construction.complete,
    );
    if (completed.length === 0) return "no-completed-barracks";
    const connected = completed.filter((structure) => this.isStructureConnected(structure));
    if (connected.length === 0) return "disconnected";
    const ready = connected.filter((structure) => !this.isStructureUpgrading(structure));
    if (ready.length === 0) return "structure-upgrading";
    // The tier gate is checked before cost so a player who cannot build the unit
    // at all is told why, rather than being told they are poor.
    const eligible = ready.filter((structure) => structure.level >= stats.requiredBuildingLevel);
    if (eligible.length === 0) return "requires-barracks-upgrade";

    const capacity = this.queueCapacityForOwner(owner);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Barracks queue capacity must be a positive integer");
    }
    const barracks = eligible
      .map((structure) => ({ structure, queued: this.queues.get(structure.id)?.orders.length ?? 0 }))
      .filter((candidate) => candidate.queued < capacity)
      .sort((left, right) => left.queued - right.queued || left.structure.id - right.structure.id)[0]?.structure;
    if (!barracks) return "queue-full";

    const { wallet, population: pool } = this.kingdoms.get(owner);
    const resources = wallet.reserve(stats.cost);
    if (!resources) return "insufficient-resources";
    const population = pool.reserve(stats.populationCost);
    if (!population) {
      wallet.refund(resources);
      return "population-full";
    }
    const order: UnitOrder = {
      unitId,
      stats,
      resources,
      population,
      remainingSeconds: stats.trainingSeconds,
    };
    const queue = this.queues.get(barracks.id);
    if (queue) queue.orders.push(order);
    else this.queues.set(barracks.id, { structure: barracks, orders: [order] });
    return "queued";
  }

  /**
   * Send this kingdom's newly trained units to a gathering point (GDD 06 §18).
   * One point per kingdom keeps the Faz 7 HUD to a single click; per-Barracks
   * rally points are a HUD problem, not a production one.
   *
   * Stored against the kingdom rather than against the Barracks standing at the
   * time: a Barracks built after the order still has to honour it, or the same
   * button would produce two behaviours with nothing explaining the difference.
   */
  setRallyPoint(owner: UnitOwner, point: Vector3 | null): void {
    if (point) this.rallyPoints.set(owner, point.clone());
    else this.rallyPoints.delete(owner);
  }

  rallyPoint(owner: UnitOwner): Vector3 | null {
    return this.rallyPoints.get(owner)?.clone() ?? null;
  }

  /** Paid orders currently held across every completed Barracks. */
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

  update(deltaSeconds: number): UnitProductionEvent[] {
    const events: UnitProductionEvent[] = [];
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
        events.push({ type: "exit-blocked", structure: queue.structure, unitId: order.unitId, label: order.stats.label });
        continue;
      }
      const unit = this.units.spawn(queue.structure.owner, exit.x, exit.z, order.stats);
      const rally = this.rallyPoints.get(queue.structure.owner);
      if (rally) {
        const path = this.navigation.plan(unit.position, rally);
        // An unreachable rally point leaves the unit at the exit rather than
        // silently teleporting it; the player can see it never left.
        if (path) unit.setMovePath(path);
      }
      wallet.commit(order.resources);
      population.commit(order.population);
      queue.orders.shift();
      if (queue.orders.length === 0) this.queues.delete(id);
      events.push({ type: "completed", structure: queue.structure, unitId: order.unitId, label: order.stats.label });
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
    this.rallyPoints.clear();
  }

  /** Highest tier among this kingdom's usable Barracks; 0 when it has none. */
  private bestBarracksLevel(owner: UnitOwner): number {
    return this.structures.ownedBy(owner)
      .filter((structure) => structure.stats.id === "barracks" && structure.construction.complete)
      .reduce((best, structure) => Math.max(best, structure.level), 0);
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

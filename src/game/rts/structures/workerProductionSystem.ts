/** Sequential worker production at a kingdom's command centre. */
import { Vector3 } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { PopulationReservation } from "../economy/populationSystem";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import { UNIT_RADIUS, type UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { CommandCenter } from "./commandCenter";
import type { CommandCenterSystem } from "./commandCenterSystem";

export type WorkerProductionResult = "queued" | "queue-full" | "insufficient-resources" | "population-full" | "no-command-center" | "center-upgrading";
export type WorkerProductionEventType = "completed" | "exit-blocked";

export interface WorkerProductionEvent {
  readonly owner: UnitOwner;
  readonly type: WorkerProductionEventType;
}

interface WorkerOrder {
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

interface WorkerQueue {
  readonly center: CommandCenter;
  readonly orders: WorkerOrder[];
}

/** The centre's worker queue, for the §51 selection panel. */
export interface WorkerQueueSnapshot {
  readonly queued: number;
  readonly capacity: number;
  readonly trainingRemainingSeconds: number | null;
}

export const WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL = [5, 10, 20] as const;

/** Worker queue capacity grows with the command-centre level / age. */
export function workerQueueCapacityForCenterLevel(level: number): number {
  if (!Number.isFinite(level) || level <= 1) return WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL[0];
  const index = Math.min(
    WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL.length - 1,
    Math.floor(level) - 1,
  );
  return WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL[index] ?? WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL[0];
}

const EXIT_GAP = 1.3;
const CENTER_HALF_FOOTPRINT = 3.5;
/** Workers are smaller than the common Guard-sized {@link UNIT_RADIUS} body. */
const WORKER_NAV_RADIUS = UNIT_RADIUS * 0.85;
/** Keep a visible gap so a fresh worker does not immediately re-enter a crowd. */
const EXIT_UNIT_CLEARANCE = 0.15;
/**
 * The first ring puts one worker on each side of the centre. Further rings only
 * come into play when every nearer exit is occupied, so a long queue spreads
 * around the building instead of repeatedly spawning at its eastern door.
 */
const EXIT_RING_OFFSETS = [0, 1.5, 3] as const;

export class WorkerProductionSystem {
  private readonly queues = new Map<UnitOwner, WorkerQueue>();

  constructor(
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
    private readonly navigation: RtsNavigation,
    private readonly workerStats: UnitBalanceStats,
    private readonly kingdoms: KingdomRegistry,
    /** Town upgrades pause the centre queue without cancelling its paid order. */
    private readonly isCenterUpgrading: (owner: UnitOwner) => boolean = () => false,
    /** A completed Town centre trains subsequent workers at its data-owned pace. */
    private readonly trainingSecondsForOwner: (owner: UnitOwner) => number = () => workerStats.trainingSeconds,
    /** Each age increases the number of paid worker orders held by its centre. */
    private readonly queueCapacityForOwner: (owner: UnitOwner) => number = () => WORKER_QUEUE_CAPACITY_BY_CENTER_LEVEL[0],
  ) {}

  /** Train a worker at one kingdom's centre, paid from that kingdom's economy. */
  queueWorker(owner: UnitOwner): WorkerProductionResult {
    const center = this.centers.get(owner);
    if (!center) return "no-command-center";
    if (this.isCenterUpgrading(owner)) return "center-upgrading";
    const capacity = this.queueCapacityForOwner(owner);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("Worker queue capacity must be a positive integer");
    }
    let queue = this.queues.get(owner);
    if (queue && queue.center !== center) {
      this.cancelQueue(owner);
      queue = undefined;
    }
    if (queue && queue.orders.length >= capacity) return "queue-full";
    const { wallet, population: pool } = this.kingdoms.get(owner);
    const resources = wallet.reserve(this.workerStats.cost);
    if (!resources) return "insufficient-resources";
    const population = pool.reserve(this.workerStats.populationCost);
    if (!population) {
      wallet.refund(resources);
      return "population-full";
    }
    const trainingSeconds = this.trainingSecondsForOwner(owner);
    if (!Number.isFinite(trainingSeconds) || trainingSeconds <= 0) {
      throw new RangeError("Worker production duration must be a positive finite number");
    }
    const order = { resources, population, remainingSeconds: trainingSeconds };
    if (queue) queue.orders.push(order);
    else this.queues.set(owner, { center, orders: [order] });
    return "queued";
  }

  /** Number of paid orders, including the worker currently in production. */
  queuedCount(owner: UnitOwner): number {
    return this.queues.get(owner)?.orders.length ?? 0;
  }

  /** The centre's queue for the §51 selection panel: what it is doing, and for how long. */
  queueSnapshot(owner: UnitOwner): WorkerQueueSnapshot {
    const orders = this.queues.get(owner)?.orders ?? [];
    return {
      queued: orders.length,
      capacity: this.queueCapacityForOwner(owner),
      trainingRemainingSeconds: orders[0]?.remainingSeconds ?? null,
    };
  }

  update(deltaSeconds: number): WorkerProductionEvent[] {
    const events: WorkerProductionEvent[] = [];
    for (const [owner, queue] of this.queues) {
      if (this.centers.get(owner) !== queue.center) {
        this.cancelQueue(owner);
        continue;
      }
      if (this.isCenterUpgrading(owner)) continue;
      const order = queue.orders[0];
      if (!order) {
        this.queues.delete(owner);
        continue;
      }
      order.remainingSeconds = Math.max(0, order.remainingSeconds - Math.max(0, deltaSeconds));
      if (order.remainingSeconds > 0) continue;
      const exit = this.findSafeExit(queue.center);
      if (!exit) {
        events.push({ owner, type: "exit-blocked" });
        continue;
      }
      const { wallet, population } = this.kingdoms.get(owner);
      this.units.spawn(owner, exit.x, exit.z, this.workerStats);
      wallet.commit(order.resources);
      population.commit(order.population);
      queue.orders.shift();
      if (queue.orders.length === 0) this.queues.delete(owner);
      events.push({ owner, type: "completed" });
    }
    return events;
  }

  reset(): void {
    for (const owner of [...this.queues.keys()]) this.cancelQueue(owner);
  }

  private cancelQueue(owner: UnitOwner): void {
    const queue = this.queues.get(owner);
    if (!queue) return;
    const { wallet, population } = this.kingdoms.get(owner);
    for (const order of queue.orders) {
      wallet.refund(order.resources);
      population.release(order.population);
    }
    this.queues.delete(owner);
  }

  private findSafeExit(center: CommandCenter): Vector3 | null {
    const { x, z } = center.position;
    for (const extraDistance of EXIT_RING_OFFSETS) {
      const distance = CENTER_HALF_FOOTPRINT + EXIT_GAP + extraDistance;
      const candidates = [
        new Vector3(x + distance, 0, z),
        new Vector3(x - distance, 0, z),
        new Vector3(x, 0, z + distance),
        new Vector3(x, 0, z - distance),
      ];
      const exit = candidates.find((point) =>
        this.navigation.plan(point, point) !== null && this.isClearOfUnits(point),
      );
      if (exit) return exit;
    }
    return null;
  }

  /** A spawn point must be clear of every live body, not merely static terrain. */
  private isClearOfUnits(point: Vector3): boolean {
    return this.units.all().every((unit) => {
      if (unit.health.depleted || unit.dying) return true;
      const requiredDistance = WORKER_NAV_RADIUS + unit.navRadius + EXIT_UNIT_CLEARANCE;
      return point.distanceToSquared(unit.position) >= requiredDistance * requiredDistance;
    });
  }
}

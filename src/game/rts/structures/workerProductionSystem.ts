/** One-at-a-time worker production at a kingdom's command centre. */
import { Vector3 } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { PopulationReservation } from "../economy/populationSystem";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { CommandCenter } from "./commandCenter";
import type { CommandCenterSystem } from "./commandCenterSystem";

export type WorkerProductionResult = "queued" | "already-training" | "insufficient-resources" | "population-full" | "no-command-center" | "center-upgrading";
export type WorkerProductionEventType = "completed" | "exit-blocked";

export interface WorkerProductionEvent {
  readonly owner: UnitOwner;
  readonly type: WorkerProductionEventType;
}

interface WorkerQueue {
  readonly center: CommandCenter;
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

const EXIT_GAP = 1.3;
const CENTER_HALF_FOOTPRINT = 3.5;

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
  ) {}

  /** Train a worker at one kingdom's centre, paid from that kingdom's economy. */
  queueWorker(owner: UnitOwner): WorkerProductionResult {
    const center = this.centers.get(owner);
    if (!center) return "no-command-center";
    if (this.isCenterUpgrading(owner)) return "center-upgrading";
    if (this.queues.has(owner)) return "already-training";
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
    this.queues.set(owner, { center, resources, population, remainingSeconds: trainingSeconds });
    return "queued";
  }

  update(deltaSeconds: number): WorkerProductionEvent[] {
    const events: WorkerProductionEvent[] = [];
    for (const [owner, queue] of this.queues) {
      if (this.centers.get(owner) !== queue.center) {
        this.cancelQueue(owner);
        continue;
      }
      if (this.isCenterUpgrading(owner)) continue;
      queue.remainingSeconds = Math.max(0, queue.remainingSeconds - Math.max(0, deltaSeconds));
      if (queue.remainingSeconds > 0) continue;
      const exit = this.findSafeExit(queue.center);
      if (!exit) {
        events.push({ owner, type: "exit-blocked" });
        continue;
      }
      const { wallet, population } = this.kingdoms.get(owner);
      this.units.spawn(owner, exit.x, exit.z, this.workerStats, "worker");
      wallet.commit(queue.resources);
      population.commit(queue.population);
      this.queues.delete(owner);
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
    wallet.refund(queue.resources);
    population.release(queue.population);
    this.queues.delete(owner);
  }

  private findSafeExit(center: CommandCenter): Vector3 | null {
    const { x, z } = center.position;
    const candidates = [
      new Vector3(x + CENTER_HALF_FOOTPRINT + EXIT_GAP, 0, z),
      new Vector3(x - CENTER_HALF_FOOTPRINT - EXIT_GAP, 0, z),
      new Vector3(x, 0, z + CENTER_HALF_FOOTPRINT + EXIT_GAP),
      new Vector3(x, 0, z - CENTER_HALF_FOOTPRINT - EXIT_GAP),
    ];
    return candidates.find((point) => this.navigation.plan(point, point) !== null) ?? null;
  }
}

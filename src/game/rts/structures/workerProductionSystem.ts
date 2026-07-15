/** One-at-a-time player-worker production at the command centre. */
import { Vector3 } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { PopulationReservation, PopulationSystem } from "../economy/populationSystem";
import type { ResourceReservation, ResourceWallet } from "../economy/resourceWallet";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitSystem } from "../units/unitSystem";
import type { CommandCenter } from "./commandCenter";
import type { CommandCenterSystem } from "./commandCenterSystem";

export type WorkerProductionResult = "queued" | "already-training" | "insufficient-resources" | "population-full" | "no-command-center";
export type WorkerProductionEvent = "completed" | "exit-blocked";

interface WorkerQueue {
  readonly center: CommandCenter;
  readonly resources: ResourceReservation;
  readonly population: PopulationReservation;
  remainingSeconds: number;
}

const EXIT_GAP = 1.3;
const CENTER_HALF_FOOTPRINT = 3.5;

export class WorkerProductionSystem {
  private queue: WorkerQueue | null = null;

  constructor(
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
    private readonly navigation: RtsNavigation,
    private readonly workerStats: UnitBalanceStats,
    private readonly wallet: ResourceWallet,
    private readonly population: PopulationSystem,
  ) {}

  queueWorker(): WorkerProductionResult {
    const center = this.centers.get("player");
    if (!center) return "no-command-center";
    if (this.queue) return "already-training";
    const resources = this.wallet.reserve(this.workerStats.cost);
    if (!resources) return "insufficient-resources";
    const population = this.population.reserve(this.workerStats.populationCost);
    if (!population) {
      this.wallet.refund(resources);
      return "population-full";
    }
    this.queue = { center, resources, population, remainingSeconds: this.workerStats.trainingSeconds };
    return "queued";
  }

  update(deltaSeconds: number): WorkerProductionEvent | null {
    const queue = this.queue;
    if (!queue) return null;
    if (this.centers.get("player") !== queue.center) {
      this.cancelQueue();
      return null;
    }
    queue.remainingSeconds = Math.max(0, queue.remainingSeconds - Math.max(0, deltaSeconds));
    if (queue.remainingSeconds > 0) return null;
    const exit = this.findSafeExit(queue.center);
    if (!exit) return "exit-blocked";
    this.units.spawn("player", exit.x, exit.z, this.workerStats, "worker");
    this.wallet.commit(queue.resources);
    this.population.commit(queue.population);
    this.queue = null;
    return "completed";
  }

  reset(): void {
    this.cancelQueue();
  }

  private cancelQueue(): void {
    if (!this.queue) return;
    this.wallet.refund(this.queue.resources);
    this.population.release(this.queue.population);
    this.queue = null;
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

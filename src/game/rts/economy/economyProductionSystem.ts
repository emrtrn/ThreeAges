/**
 * Phase 3 resource-building loop: completed producers reserve nearby idle
 * workers, have them walk to the site, then accumulate a data-driven local
 * buffer. Phase 4 logistics withdraws from this buffer only after a valid
 * road/depot connection has been resolved.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";

export type EconomyWorkerState = "idle" | "moving" | "producing";
export type EconomyProductionStatus = "awaiting-workers" | "workers-moving" | "producing" | "buffer-full";

export interface EconomyBuildingSnapshot {
  readonly structureId: number;
  readonly structureLabel: string;
  readonly resourceId: string;
  readonly assignedWorkers: number;
  readonly workingWorkers: number;
  readonly workerCapacity: number;
  readonly perWorkerPerMinute: number;
  readonly productionPerMinute: number;
  readonly localBuffer: number;
  readonly localBufferCapacity: number;
  readonly lastProductionTick: number;
  readonly lastTransferTick: number;
  readonly totalProduced: number;
  readonly totalTransferred: number;
  readonly status: EconomyProductionStatus;
}

interface WorkerAssignment {
  readonly worker: Unit;
  readonly approach: Vector3;
  state: Exclude<EconomyWorkerState, "idle">;
}

interface ProducerRecord {
  readonly structure: PlacedStructure;
  readonly assignments: Map<number, WorkerAssignment>;
  localBuffer: number;
  lastProductionTick: number;
  lastTransferTick: number;
  totalProduced: number;
  totalTransferred: number;
  status: EconomyProductionStatus;
}

const WORK_RANGE = 1.25;

export class EconomyProductionSystem {
  private readonly producers = new Map<number, ProducerRecord>();
  private readonly assignmentByWorker = new Map<number, ProducerRecord>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly isWorkerConstructing: (worker: Unit) => boolean,
  ) {}

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Economy production delta must be a non-negative finite number");
    }
    this.syncCompletedProducers();
    for (const producer of this.producers.values()) this.updateProducer(producer, deltaSeconds);
  }

  /** True while a worker is travelling to or producing at a resource building. */
  isAssigned(worker: Unit): boolean {
    return this.assignmentByWorker.has(worker.id);
  }

  stateFor(worker: Unit): EconomyWorkerState {
    return this.assignmentByWorker.get(worker.id)?.assignments.get(worker.id)?.state ?? "idle";
  }

  /** One kingdom's output rate, counting only workers who reached their work point. */
  productionPerMinute(owner: UnitOwner, resourceId: string): number {
    return this.snapshots(owner)
      .filter((producer) => producer.resourceId === resourceId)
      .reduce((total, producer) => total + producer.productionPerMinute, 0);
  }

  /** Stable snapshots for debug/UI; the local buffer is not globally spendable yet. */
  snapshots(owner?: UnitOwner): readonly EconomyBuildingSnapshot[] {
    return [...this.producers.values()]
      .filter((producer) => owner === undefined || producer.structure.owner === owner)
      .map((producer) => {
        const economy = producer.structure.stats.economy;
        if (!economy) throw new Error("Economy producer missing economy balance");
        const workingWorkers = [...producer.assignments.values()]
          .filter((assignment) => assignment.state === "producing").length;
        return {
          structureId: producer.structure.id,
          structureLabel: producer.structure.stats.label,
          resourceId: economy.resourceId,
          assignedWorkers: producer.assignments.size,
          workingWorkers,
          workerCapacity: economy.workerCapacity,
          perWorkerPerMinute: economy.perWorkerPerMinute,
          productionPerMinute: producer.status === "producing" ? workingWorkers * economy.perWorkerPerMinute : 0,
          localBuffer: producer.localBuffer,
          localBufferCapacity: economy.localBufferCapacity,
          lastProductionTick: producer.lastProductionTick,
          lastTransferTick: producer.lastTransferTick,
          totalProduced: producer.totalProduced,
          totalTransferred: producer.totalTransferred,
          status: producer.status,
        };
      });
  }

  reset(): void {
    for (const producer of this.producers.values()) this.releaseProducer(producer);
    this.producers.clear();
    this.assignmentByWorker.clear();
  }

  /**
   * Hand a gathering worker back to the idle pool.
   *
   * §55 puts securing population capacity above growing income: without this a
   * kingdom whose producers have soaked up every worker can never staff a
   * construction site, so it can never finish the house that would let it train
   * more workers — a deadlock, and exactly the permanent population lock plan
   * §39 forbids.
   */
  release(worker: Unit): boolean {
    const producer = this.assignmentByWorker.get(worker.id);
    if (!producer) return false;
    producer.assignments.delete(worker.id);
    this.assignmentByWorker.delete(worker.id);
    worker.stop();
    return true;
  }

  /** Remove buffered output for a connected logistics transfer, never below zero. */
  withdrawBuffered(structureId: number): { resourceId: string; amount: number } | null {
    const producer = this.producers.get(structureId);
    const economy = producer?.structure.stats.economy;
    if (!producer || !economy || producer.localBuffer <= 0) return null;
    const amount = producer.localBuffer;
    producer.localBuffer = 0;
    producer.lastTransferTick = amount;
    producer.totalTransferred += amount;
    return { resourceId: economy.resourceId, amount };
  }

  private syncCompletedProducers(): void {
    const live = new Set(this.structures.all());
    for (const producer of [...this.producers.values()]) {
      if (!live.has(producer.structure) || !producer.structure.construction.complete || !producer.structure.stats.economy) {
        this.releaseProducer(producer);
        this.producers.delete(producer.structure.id);
      }
    }
    for (const structure of this.structures.all()) {
      if (!structure.construction.complete || !structure.stats.economy || this.producers.has(structure.id)) continue;
      this.producers.set(structure.id, {
        structure,
        assignments: new Map(),
        localBuffer: 0,
        lastProductionTick: 0,
        lastTransferTick: 0,
        totalProduced: 0,
        totalTransferred: 0,
        status: "awaiting-workers",
      });
    }
  }

  private updateProducer(producer: ProducerRecord, deltaSeconds: number): void {
    const economy = producer.structure.stats.economy;
    if (!economy) return;
    producer.lastProductionTick = 0;
    producer.lastTransferTick = 0;
    this.dropInvalidAssignments(producer);
    if (producer.localBuffer >= economy.localBufferCapacity) {
      producer.localBuffer = economy.localBufferCapacity;
      producer.status = "buffer-full";
      return;
    }
    this.assignIdleWorkers(producer);
    let workingWorkers = 0;
    for (const assignment of producer.assignments.values()) {
      if (assignment.state === "moving") {
        if (assignment.worker.position.distanceTo(assignment.approach) > WORK_RANGE) continue;
        assignment.worker.stop();
        assignment.state = "producing";
      }
      if (assignment.state === "producing") workingWorkers += 1;
    }
    if (workingWorkers === 0) {
      producer.status = producer.assignments.size === 0 ? "awaiting-workers" : "workers-moving";
      return;
    }
    const produced = (workingWorkers * economy.perWorkerPerMinute * deltaSeconds) / 60;
    producer.lastProductionTick = Math.min(produced, economy.localBufferCapacity - producer.localBuffer);
    producer.localBuffer += producer.lastProductionTick;
    producer.totalProduced += producer.lastProductionTick;
    producer.status = producer.localBuffer >= economy.localBufferCapacity ? "buffer-full" : "producing";
  }

  private assignIdleWorkers(producer: ProducerRecord): void {
    const economy = producer.structure.stats.economy;
    if (!economy) return;
    const candidates = this.units.workersOf(producer.structure.owner)
      .filter((worker) => !this.assignmentByWorker.has(worker.id) && !this.isWorkerConstructing(worker))
      .sort((a, b) => a.position.distanceToSquared(producer.structure.object.position)
        - b.position.distanceToSquared(producer.structure.object.position));
    for (const worker of candidates) {
      if (producer.assignments.size >= economy.workerCapacity) return;
      const approach = this.findReachableApproach(worker, producer.structure);
      if (!approach) continue;
      const path = this.navigation.plan(worker.position, approach);
      if (!path) continue;
      worker.setMovePath(path);
      const assignment: WorkerAssignment = { worker, approach, state: "moving" };
      producer.assignments.set(worker.id, assignment);
      this.assignmentByWorker.set(worker.id, producer);
    }
  }

  private dropInvalidAssignments(producer: ProducerRecord): void {
    for (const [workerId, assignment] of producer.assignments) {
      if (!assignment.worker.health.depleted && this.units.all().includes(assignment.worker)) continue;
      producer.assignments.delete(workerId);
      this.assignmentByWorker.delete(workerId);
    }
  }

  private releaseProducer(producer: ProducerRecord): void {
    for (const assignment of producer.assignments.values()) {
      assignment.worker.stop();
      this.assignmentByWorker.delete(assignment.worker.id);
    }
    producer.assignments.clear();
  }

  private findReachableApproach(worker: Unit, structure: PlacedStructure): Vector3 | null {
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const gap = WORK_RANGE * 0.7;
    const candidates = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ];
    candidates.sort((a, b) => worker.position.distanceToSquared(a) - worker.position.distanceToSquared(b));
    return candidates.find((point) => this.navigation.plan(worker.position, point) !== null) ?? null;
  }
}

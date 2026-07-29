/**
 * Phase 3 resource-building loop: completed producers reserve nearby idle
 * workers, have them walk to the site, then accumulate a data-driven local
 * buffer. Phase 4 logistics withdraws from this buffer only after a valid
 * road/depot connection has been resolved.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { PlacedStructure } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { ResourceNodeSystem } from "./resourceNodeSystem";
import type { ForestSystem } from "./forestSystem";

export type EconomyWorkerState = "idle" | "moving" | "producing" | "moving-to-tree" | "harvesting" | "returning-to-camp" | "unloading";
export type EconomyProductionStatus = "awaiting-workers" | "workers-moving" | "producing" | "buffer-full" | "missing-resource-node" | "missing-forest" | "source-depleted";

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
  /** Remaining material at a finite source; null for renewable producers. */
  readonly sourceRemaining: number | null;
  readonly status: EconomyProductionStatus;
}

interface WorkerAssignment {
  readonly worker: Unit;
  approach: Vector3;
  readonly source: "automatic" | "manual";
  state: Exclude<EconomyWorkerState, "idle">;
  treeId: string | null;
  cargoAmount: number;
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
/**
 * How far into a walkable footprint a work post sits, as a fraction of its half
 * extent. Well inside the crop so the pose reads as working the field, but off
 * the middle, where the farm's own building stands.
 */
const FIELD_POST_INSET = 0.62;

export interface ManualEconomyAssignmentResult {
  readonly assignedWorkers: number;
  readonly rejectedWorkers: number;
}

export class EconomyProductionSystem {
  private readonly producers = new Map<number, ProducerRecord>();
  private readonly assignmentByWorker = new Map<number, ProducerRecord>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly isWorkerConstructing: (worker: Unit) => boolean,
    private readonly resourceNodes?: ResourceNodeSystem,
    private readonly forests?: ForestSystem,
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
        const economy = producer.structure.economy;
        if (!economy) throw new Error("Economy producer missing economy balance");
        const workingWorkers = [...producer.assignments.values()]
          .filter((assignment) => assignment.state === "producing" || assignment.state === "harvesting").length;
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
          sourceRemaining: economy.requiresForest
            ? this.forests?.remainingNear(
              producer.structure.x,
              producer.structure.z,
              economy.gatherRadius ?? 0,
              producer.structure.stats.footprint,
            ) ?? null
            : economy.requiresResourceNode
            ? this.resourceNodes?.remainingAt(
              economy.resourceId,
              producer.structure.x,
              producer.structure.z,
              producer.structure.stats.footprint.width,
              producer.structure.stats.footprint.depth,
            ) ?? null
            : null,
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
    this.forests?.releaseReservation(worker.id);
    worker.stop();
    // Presentation only: a released gatherer must not keep working a field it no
    // longer belongs to. Cleared on every exit path — player order, reassignment,
    // producer loss, death — the same way the construction system does it.
    worker.setWorking(false);
    return true;
  }

  /** Automatic construction recovery must not override an explicit gather order. */
  releaseAutomatic(worker: Unit): boolean {
    const producer = this.assignmentByWorker.get(worker.id);
    const assignment = producer?.assignments.get(worker.id);
    if (!assignment || assignment.source !== "automatic") return false;
    return this.release(worker);
  }

  /**
   * Assign selected workers to a completed resource building. This is an
   * explicit player order, so it remains protected from automatic construction
   * recovery until the player gives the worker another order.
   */
  assignWorkers(structure: PlacedStructure, workers: readonly Unit[]): ManualEconomyAssignmentResult {
    this.syncCompletedProducers();
    const producer = this.producers.get(structure.id);
    const economy = structure.economy;
    if (!producer || !economy) return { assignedWorkers: 0, rejectedWorkers: workers.length };
    let assignedWorkers = 0;
    let rejectedWorkers = 0;
    for (const worker of workers) {
      if (worker.role !== "worker" || worker.owner !== structure.owner || worker.health.depleted) {
        rejectedWorkers += 1;
        continue;
      }
      const existingProducer = this.assignmentByWorker.get(worker.id);
      if (existingProducer === producer) {
        assignedWorkers += 1;
        continue;
      }
      if (producer.assignments.size >= economy.workerCapacity || this.isWorkerConstructing(worker)) {
        rejectedWorkers += 1;
        continue;
      }
      if (existingProducer) this.release(worker);
      if (this.assignWorker(producer, worker, "manual")) assignedWorkers += 1;
      else rejectedWorkers += 1;
    }
    return { assignedWorkers, rejectedWorkers };
  }

  /** Remove buffered output for a connected logistics transfer, never below zero. */
  withdrawBuffered(structureId: number, maximumAmount = Number.POSITIVE_INFINITY): { resourceId: string; amount: number } | null {
    const producer = this.producers.get(structureId);
    const economy = producer?.structure.economy;
    if (!producer || !economy || producer.localBuffer <= 0 || !Number.isFinite(maximumAmount) && maximumAmount !== Number.POSITIVE_INFINITY) return null;
    const amount = Math.min(producer.localBuffer, Math.max(0, maximumAmount));
    if (amount <= 0) return null;
    producer.localBuffer -= amount;
    producer.lastTransferTick = amount;
    producer.totalTransferred += amount;
    return { resourceId: economy.resourceId, amount };
  }

  private syncCompletedProducers(): void {
    const live = new Set(this.structures.all());
    for (const producer of [...this.producers.values()]) {
      if (!live.has(producer.structure) || !producer.structure.construction.complete || !producer.structure.economy) {
        this.releaseProducer(producer);
        this.producers.delete(producer.structure.id);
      }
    }
    for (const structure of this.structures.all()) {
      if (!structure.construction.complete || !structure.economy || this.producers.has(structure.id)) continue;
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
    const economy = producer.structure.economy;
    if (!economy) return;
    producer.lastProductionTick = 0;
    producer.lastTransferTick = 0;
    this.dropInvalidAssignments(producer);
    if (economy.requiresForest) {
      this.updateForestProducer(producer, deltaSeconds);
      return;
    }
    if (economy.requiresResourceNode) {
      if (!this.resourceNodes || !this.resourceNodes.canExtractAt(
        economy.resourceId,
        producer.structure.x,
        producer.structure.z,
        producer.structure.stats.footprint.width,
        producer.structure.stats.footprint.depth,
      )) {
        this.releaseProducer(producer);
        producer.status = this.resourceNodes?.remainingAt(
          economy.resourceId,
          producer.structure.x,
          producer.structure.z,
          producer.structure.stats.footprint.width,
          producer.structure.stats.footprint.depth,
        ) === 0 ? "source-depleted" : "missing-resource-node";
        return;
      }
    }
    if (producer.localBuffer >= economy.localBufferCapacity) {
      producer.localBuffer = economy.localBufferCapacity;
      producer.status = "buffer-full";
      // A full buffer is a stopped producer, and the pose says so: the crew
      // stands up and waits. Leaving them bent over their work would make a
      // farm that has stopped earning look exactly like one that is earning.
      this.setProducerWorking(producer, false);
      return;
    }
    this.assignIdleWorkersToProducer(producer);
    let workingWorkers = 0;
    for (const assignment of [...producer.assignments.values()]) {
      if (assignment.state === "moving") {
        if (assignment.worker.position.distanceTo(assignment.approach) > WORK_RANGE) {
          // Congestion recovery can eventually drop a path. Without this retry,
          // the worker remained logically assigned forever: it was neither
          // producing nor selectable as idle, even though it stood beside the
          // producer. Re-plan the final approach once; a truly unreachable
          // worker is released so a different one can take the job.
          if (!this.replanApproach(assignment)) this.release(assignment.worker);
          continue;
        }
        assignment.worker.stop();
        assignment.state = "producing";
      }
      // Presentation only, and read straight off the assignment's own state, so
      // the working pose starts the frame the worker settles at the farm and
      // stops the frame it is released — no second timer to drift out of step.
      assignment.worker.setWorking(assignment.state === "producing");
      if (assignment.state === "producing") workingWorkers += 1;
    }
    if (workingWorkers === 0) {
      producer.status = producer.assignments.size === 0 ? "awaiting-workers" : "workers-moving";
      return;
    }
    const requested = Math.min(
      (workingWorkers * economy.perWorkerPerMinute * deltaSeconds) / 60,
      economy.localBufferCapacity - producer.localBuffer,
    );
    producer.lastProductionTick = economy.requiresResourceNode
      ? this.resourceNodes?.extract(
        economy.resourceId,
        producer.structure.x,
        producer.structure.z,
        producer.structure.stats.footprint.width,
        producer.structure.stats.footprint.depth,
        requested,
      ) ?? 0
      : requested;
    producer.localBuffer += producer.lastProductionTick;
    producer.totalProduced += producer.lastProductionTick;
    producer.status = producer.lastProductionTick <= 0 && economy.requiresResourceNode
      ? "source-depleted"
      : producer.localBuffer >= economy.localBufferCapacity
        ? "buffer-full"
        : "producing";
  }

  /** Wood is harvested from a specific tree and carried back before it enters the camp buffer. */
  private updateForestProducer(producer: ProducerRecord, deltaSeconds: number): void {
    const economy = producer.structure.economy;
    if (!economy?.requiresForest || !this.forests || economy.gatherRadius === undefined || economy.carryCapacity === undefined) {
      producer.status = "missing-forest";
      // Same reason as a full buffer: a camp that cannot gather must not leave
      // its crew frozen mid-swing at a forest that is no longer there.
      this.setProducerWorking(producer, false);
      return;
    }
    const hasLiveTree = this.forests.hasLiveTreeNear(
      producer.structure.x,
      producer.structure.z,
      economy.gatherRadius,
      producer.structure.stats.footprint,
    );
    if (!hasLiveTree && producer.assignments.size === 0) {
      producer.status = "source-depleted";
      this.setProducerWorking(producer, false);
      return;
    }
    this.assignIdleWorkersToProducer(producer);
    let harvestingWorkers = 0;
    let movingWorkers = 0;
    let delivered = 0;
    for (const assignment of [...producer.assignments.values()]) {
      // Cleared up front and re-raised only by the felling branch below: a
      // lumberjack's cycle walks, chops, walks back and unloads, and only the
      // chopping half is performed from a standstill. Unloading is deliberately
      // left out — it is shorter than the animation's kneel, so the pose would
      // be cut off part-way down and read as a twitch.
      assignment.worker.setWorking(false);
      if (assignment.state === "moving-to-tree") {
        if (assignment.worker.position.distanceTo(assignment.approach) > WORK_RANGE) {
          if (!this.replanApproach(assignment)) {
            this.release(assignment.worker);
            continue;
          }
          movingWorkers += 1;
          continue;
        }
        assignment.worker.stop();
        assignment.state = "harvesting";
      }
      if (assignment.state === "harvesting") {
        harvestingWorkers += 1;
        if (producer.localBuffer >= economy.localBufferCapacity) {
          producer.localBuffer = economy.localBufferCapacity;
          if (assignment.cargoAmount > 0 && !this.returnToCamp(assignment, producer.structure)) {
            this.release(assignment.worker);
          }
          continue;
        }
        assignment.worker.setWorking(true);
        const harvested = this.forests.harvest(
          assignment.worker.id,
          Math.min((economy.perWorkerPerMinute * deltaSeconds) / 60, economy.carryCapacity - assignment.cargoAmount),
        );
        assignment.cargoAmount += harvested;
        if (assignment.cargoAmount >= economy.carryCapacity || harvested <= 0) {
          if (!this.returnToCamp(assignment, producer.structure)) this.release(assignment.worker);
        }
        continue;
      }
      if (assignment.state === "returning-to-camp") {
        if (assignment.worker.position.distanceTo(assignment.approach) > WORK_RANGE) {
          if (!this.replanApproach(assignment)) {
            this.release(assignment.worker);
            continue;
          }
          movingWorkers += 1;
          continue;
        }
        assignment.worker.stop();
        assignment.state = "unloading";
      }
      if (assignment.state === "unloading") {
        const unloaded = Math.min(assignment.cargoAmount, economy.localBufferCapacity - producer.localBuffer);
        assignment.cargoAmount -= unloaded;
        delivered += unloaded;
        producer.localBuffer += unloaded;
        if (assignment.cargoAmount > 0) continue;
        this.forests.releaseReservation(assignment.worker.id);
        const nextProducer = assignment.source === "automatic"
          ? this.preferredForestProducer(producer, assignment.worker)
          : producer;
        if (nextProducer !== producer) {
          producer.assignments.delete(assignment.worker.id);
          nextProducer.assignments.set(assignment.worker.id, assignment);
          this.assignmentByWorker.set(assignment.worker.id, nextProducer);
        }
        const nextEconomy = nextProducer.structure.economy;
        if (!nextEconomy?.requiresForest || nextEconomy.gatherRadius === undefined
          || !this.moveWorkerToTree(assignment, nextProducer.structure, nextEconomy.gatherRadius)) {
          this.release(assignment.worker);
        }
      }
    }
    producer.lastProductionTick = delivered;
    producer.totalProduced += delivered;
    producer.status = producer.localBuffer >= economy.localBufferCapacity
      ? "buffer-full"
      : producer.assignments.size === 0
        ? hasLiveTree ? "awaiting-workers" : "source-depleted"
        : harvestingWorkers > 0 || delivered > 0
          ? "producing"
          : movingWorkers > 0
            ? "workers-moving"
            : hasLiveTree ? "awaiting-workers" : "source-depleted";
  }

  /** Immediately offer every currently eligible worker to a completed producer. */
  assignIdleWorkers(): void {
    this.syncCompletedProducers();
    for (const producer of this.producers.values()) this.assignIdleWorkersToProducer(producer);
  }

  private assignIdleWorkersToProducer(producer: ProducerRecord): void {
    const economy = producer.structure.economy;
    if (!economy) return;
    const candidates = this.units.workersOf(producer.structure.owner)
      .filter((worker) => !this.assignmentByWorker.has(worker.id)
        && !worker.blocksAutomaticWorkerAssignment && !this.isWorkerConstructing(worker))
      .sort((a, b) => a.position.distanceToSquared(producer.structure.object.position)
        - b.position.distanceToSquared(producer.structure.object.position));
    for (const worker of candidates) {
      if (producer.assignments.size >= economy.workerCapacity) return;
      this.assignWorker(producer, worker, "automatic");
    }
  }

  /** Drops (or raises) the working pose for every worker at this producer at once. */
  private setProducerWorking(producer: ProducerRecord, working: boolean): void {
    for (const assignment of producer.assignments.values()) assignment.worker.setWorking(working);
  }

  private dropInvalidAssignments(producer: ProducerRecord): void {
    for (const [workerId, assignment] of producer.assignments) {
      if (!assignment.worker.health.depleted && this.units.all().includes(assignment.worker)) continue;
      assignment.worker.setWorking(false);
      this.forests?.releaseReservation(workerId);
      producer.assignments.delete(workerId);
      this.assignmentByWorker.delete(workerId);
    }
  }

  private releaseProducer(producer: ProducerRecord): void {
    for (const assignment of producer.assignments.values()) {
      assignment.worker.stop();
      assignment.worker.setWorking(false);
      this.forests?.releaseReservation(assignment.worker.id);
      this.assignmentByWorker.delete(assignment.worker.id);
    }
    producer.assignments.clear();
  }

  private assignWorker(
    producer: ProducerRecord,
    worker: Unit,
    source: "automatic" | "manual",
  ): boolean {
    const economy = producer.structure.economy;
    if (!economy || producer.assignments.size >= economy.workerCapacity) return false;
    if (economy.requiresForest) {
      if (economy.gatherRadius === undefined) return false;
      const target = this.findReachableTree(worker, producer.structure, economy.gatherRadius);
      if (!target) return false;
      worker.setMovePath(target.path);
      const assignment: WorkerAssignment = {
        worker,
        approach: target.approach,
        source,
        state: "moving-to-tree",
        treeId: target.treeId,
        cargoAmount: 0,
      };
      producer.assignments.set(worker.id, assignment);
      this.assignmentByWorker.set(worker.id, producer);
      return true;
    }
    const approach = this.findReachableApproach(worker, producer.structure, {
      workPost: true,
      taken: [...producer.assignments.values()].map((assignment) => assignment.approach),
    });
    if (!approach) return false;
    const path = this.navigation.plan(worker.position, approach);
    if (!path) return false;
    worker.setMovePath(path);
    const assignment: WorkerAssignment = { worker, approach, source, state: "moving", treeId: null, cargoAmount: 0 };
    producer.assignments.set(worker.id, assignment);
    this.assignmentByWorker.set(worker.id, producer);
    return true;
  }

  private returnToCamp(assignment: WorkerAssignment, structure: PlacedStructure): boolean {
    const approach = this.findReachableApproach(assignment.worker, structure);
    if (!approach) return false;
    const path = this.navigation.plan(assignment.worker.position, approach);
    if (!path) return false;
    assignment.approach = approach;
    assignment.worker.setMovePath(path);
    assignment.state = "returning-to-camp";
    return true;
  }

  /** Restore a route that a congestion escape or an external cancellation removed. */
  private replanApproach(assignment: WorkerAssignment): boolean {
    if (assignment.worker.pathTarget || assignment.worker.moveTarget) return true;
    const path = this.navigation.plan(assignment.worker.position, assignment.approach);
    if (!path) return false;
    assignment.worker.setMovePath(path);
    return true;
  }

  private moveWorkerToTree(assignment: WorkerAssignment, structure: PlacedStructure, gatherRadius: number): boolean {
    const target = this.findReachableTree(assignment.worker, structure, gatherRadius);
    if (!target) return false;
    assignment.treeId = target.treeId;
    assignment.approach = target.approach;
    assignment.worker.setMovePath(target.path);
    assignment.state = "moving-to-tree";
    return true;
  }

  /** After delivering, automatic gatherers prefer the camp with the shortest next tree-to-camp trip. */
  private preferredForestProducer(current: ProducerRecord, worker: Unit): ProducerRecord {
    if (!this.forests) return current;
    const candidates = [...this.producers.values()]
      .filter((producer) => {
        const economy = producer.structure.economy;
        return producer.structure.owner === worker.owner
          && economy?.requiresForest === true
          && economy.gatherRadius !== undefined
          && (producer === current || producer.assignments.size < economy.workerCapacity)
          && this.forests!.hasLiveTreeNear(
            producer.structure.x,
            producer.structure.z,
            economy.gatherRadius,
            producer.structure.stats.footprint,
          );
      });
    let best = current;
    let bestDistance = this.forestDistanceForCamp(current);
    for (const candidate of candidates) {
      const distance = this.forestDistanceForCamp(candidate);
      if (distance >= bestDistance) continue;
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  private forestDistanceForCamp(producer: ProducerRecord): number {
    const economy = producer.structure.economy;
    if (!this.forests || !economy?.requiresForest || economy.gatherRadius === undefined) return Number.POSITIVE_INFINITY;
    return this.forests.nearestLiveTreeDistanceSquared(
      producer.structure.x,
      producer.structure.z,
      economy.gatherRadius,
      producer.structure.stats.footprint,
    );
  }

  /** A live tree may still be unreachable because a player built around it. Try its neighbours before giving up. */
  private findReachableTree(
    worker: Unit,
    structure: PlacedStructure,
    gatherRadius: number,
  ): { readonly treeId: string; readonly approach: Vector3; readonly path: readonly Vector3[] } | null {
    if (!this.forests) return null;
    const rejected = new Set<string>();
    while (true) {
      const tree = this.forests.reserveNearest(
        worker.id,
        structure.x,
        structure.z,
        gatherRadius,
        structure.stats.footprint,
        rejected,
      );
      if (!tree) return null;
      const approach = new Vector3(tree.x, 0, tree.z);
      const path = this.navigation.plan(worker.position, approach);
      if (path) return { treeId: tree.id, approach, path };
      this.forests.releaseReservation(worker.id);
      rejected.add(tree.id);
    }
  }

  /**
   * Where a worker stands to do the job.
   *
   * `workPost` asks for a spot *inside* the footprint, which is only offered by
   * structures units may walk on (a farm's field). A farmhand belongs among the
   * crop, not lined up along the fence looking at it — and since the field is
   * already pass-through ground for pathfinding, standing in it needs no new
   * navigation rule. Everything else — a quarry, a mine, and a lumberjack
   * dropping his load at the camp — keeps the edge approach, because there is a
   * building in the way and the job is done at its door.
   *
   * `taken` spreads a crew out: without it three farmhands share one post and
   * spend the match shoving each other off it.
   */
  private findReachableApproach(
    worker: Unit,
    structure: PlacedStructure,
    options: { readonly workPost?: boolean; readonly taken?: readonly Vector3[] } = {},
  ): Vector3 | null {
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const gap = WORK_RANGE * 0.7;
    const edges = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ];
    const interior = options.workPost && PlacedStructureSystem.isUnitPassThrough(structure)
      ? [
        new Vector3(structure.x + halfW * FIELD_POST_INSET, 0, structure.z + halfD * FIELD_POST_INSET),
        new Vector3(structure.x - halfW * FIELD_POST_INSET, 0, structure.z - halfD * FIELD_POST_INSET),
        new Vector3(structure.x + halfW * FIELD_POST_INSET, 0, structure.z - halfD * FIELD_POST_INSET),
        new Vector3(structure.x - halfW * FIELD_POST_INSET, 0, structure.z + halfD * FIELD_POST_INSET),
      ]
      : [];
    const taken = options.taken ?? [];
    const free = (point: Vector3): boolean =>
      !taken.some((claimed) => claimed.distanceTo(point) < WORK_RANGE * 2);
    const byDistance = (a: Vector3, b: Vector3): number =>
      worker.position.distanceToSquared(a) - worker.position.distanceToSquared(b);
    // Interior posts first and unclaimed ones before claimed: the fallbacks
    // matter as much as the preference, since a crowded or unreachable field
    // must still produce a usable post rather than refusing the assignment.
    for (const tier of [interior.filter(free), interior, edges.filter(free), edges]) {
      const point = [...tier].sort(byDistance).find((candidate) => this.navigation.plan(worker.position, candidate) !== null);
      if (point) return point;
    }
    return null;
  }
}

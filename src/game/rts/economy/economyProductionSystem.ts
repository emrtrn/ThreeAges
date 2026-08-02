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
import type { ResourceReach, ResourceSource } from "./resourceSource";
import type { WildlifeSystem } from "../wildlife/wildlifeSystem";

export type EconomyWorkerState = "idle" | "moving" | "producing" | "moving-to-source" | "gathering" | "returning" | "unloading";
export type EconomyProductionStatus = "awaiting-workers" | "workers-moving" | "producing" | "buffer-full" | "missing-resource-node" | "missing-forest" | "missing-game" | "source-depleted";

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
  sourceId: string | null;
  cargoAmount: number;
}

/**
 * The finite source a producer works, plus what its panel says when that source
 * is unavailable — "no forest here" and "no deposit here" are different messages
 * for the same shape of failure.
 */
interface ResourceRequirement {
  readonly source: ResourceSource | null;
  readonly missingStatus: EconomyProductionStatus;
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
 * How far a source may drift from the point a worker was sent to before the walk
 * is re-planned, in world units.
 *
 * Only a moving source ever reaches it. Wider than {@link WORK_RANGE} on purpose:
 * a bolting animal covers more ground per tick than the work range itself, so
 * re-planning the instant it moved would mean a fresh path every single frame of
 * every chase — expensive, and it kept resetting the walk before the hunter had
 * taken a step along it.
 */
const SOURCE_FOLLOW_SLACK = WORK_RANGE * 3;
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
  /**
   * Every finite source in play. A released worker is offered to all of them
   * rather than only the kind he was sent to: a claim is held per worker, so
   * releasing one he never held is a no-op, and that is cheaper than remembering
   * which source a worker who is being dropped mid-cycle belonged to.
   */
  private readonly sources: readonly ResourceSource[];

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly isWorkerConstructing: (worker: Unit) => boolean,
    private readonly resourceNodes?: ResourceNodeSystem,
    private readonly forests?: ForestSystem,
    private readonly wildlife?: WildlifeSystem,
  ) {
    const sources: ResourceSource[] = [];
    if (forests) sources.push(forests);
    if (resourceNodes) sources.push(resourceNodes);
    if (wildlife) sources.push(wildlife);
    this.sources = sources;
  }

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
          .filter((assignment) => assignment.state === "producing" || assignment.state === "gathering").length;
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
          sourceRemaining: this.sourceRemainingFor(producer),
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
   * Which finite source a producer works, if any, and what to report when it is
   * unavailable.
   *
   * The only place the source kinds are enumerated. The chain used to be spelled
   * out twice — once in {@link snapshots} and again in the production loop — so
   * a new kind of source meant finding both copies and getting them to agree.
   */
  private requirementFor(economy: NonNullable<PlacedStructure["economy"]>): ResourceRequirement | null {
    if (economy.requiresForest) return { source: this.forests ?? null, missingStatus: "missing-forest" };
    if (economy.requiresResourceNode) {
      return { source: this.resourceNodes ?? null, missingStatus: "missing-resource-node" };
    }
    if (economy.requiresGame) return { source: this.wildlife ?? null, missingStatus: "missing-game" };
    return null;
  }

  /**
   * What this producer can reach. A missing `gatherRadius` becomes a reach of
   * zero, which finds nothing: every source query already excludes the
   * producer's own footprint, so a radius of zero can only ever land inside it.
   */
  private reachFor(structure: PlacedStructure, economy: NonNullable<PlacedStructure["economy"]>): ResourceReach {
    return {
      resourceId: economy.resourceId,
      x: structure.x,
      z: structure.z,
      radius: economy.gatherRadius ?? 0,
      footprint: structure.stats.footprint,
    };
  }

  /** Material left at this producer's source; null for renewable producers and for a source out of reach entirely. */
  private sourceRemainingFor(producer: ProducerRecord): number | null {
    const economy = producer.structure.economy;
    if (!economy) return null;
    const source = this.requirementFor(economy)?.source;
    if (!source) return null;
    return source.remainingNear(this.reachFor(producer.structure, economy));
  }

  private releaseSourceClaims(workerId: number): void {
    for (const source of this.sources) source.releaseReservation(workerId);
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
    this.releaseSourceClaims(worker.id);
    worker.stop();
    // Presentation only: a released gatherer must not keep working a field it no
    // longer belongs to. Cleared on every exit path — player order, reassignment,
    // producer loss, death — the same way the construction system does it.
    worker.setWorking(false);
    worker.setHunting(false);
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
    const requirement = this.requirementFor(economy);
    if (requirement) {
      this.updateGatheringProducer(producer, deltaSeconds, requirement);
      return;
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
    // Renewable producers only: a farm's crop is grown on the spot, so the
    // request is simply granted. Finite sources go through their own gather
    // cycles above, where a worker has to walk to the source and back.
    producer.lastProductionTick = requested;
    producer.localBuffer += producer.lastProductionTick;
    producer.totalProduced += producer.lastProductionTick;
    producer.status = producer.localBuffer >= economy.localBufferCapacity ? "buffer-full" : "producing";
  }

  /**
   * The gather cycle every finite source shares: walk out to the source, work it
   * until the load is full or it runs dry, carry the load home, unload it into
   * the camp buffer, go again. Wood, stone and gold all run through here; the
   * {@link ResourceSource} decides what "the source" is.
   *
   * This was two copies of the same hundred lines, and they had already drifted
   * for no reason a player could see: a lumberjack walked to his tree while a
   * miner stood at the quarry door and the pile emptied itself from a distance.
   * The deposit is now authored beside the building rather than under it, so the
   * walk is the only way to reach it either way — and the shrinking deposit
   * finally has someone visibly taking material off it.
   *
   * Kneeling is not timed here. `setWorking(true)` hands the body to the work
   * montage, whose authored `enter` section kneels once and whose `loop` holds
   * until work ends; `setWorking(false)` is what starts the stand-up. So a worker
   * cannot pop upright mid-cut: the trip ends when the load is full or the source
   * runs dry, and only then does the wind-down play.
   */
  private updateGatheringProducer(
    producer: ProducerRecord,
    deltaSeconds: number,
    requirement: ResourceRequirement,
  ): void {
    const economy = producer.structure.economy;
    const { source, missingStatus } = requirement;
    if (!economy || !source || economy.gatherRadius === undefined || economy.carryCapacity === undefined) {
      producer.status = missingStatus;
      // Same reason as a full buffer: a camp that cannot gather must not leave
      // its crew frozen mid-swing at a source that is no longer there.
      this.setProducerWorking(producer, false);
      return;
    }
    const reach = this.reachFor(producer.structure, economy);
    const remaining = source.remainingNear(reach);
    const hasLiveSource = (remaining ?? 0) > 0;
    // Nothing in reach at all is a different failure from a source that has been
    // worked out, and the panel says so. Workers already carrying a load finish
    // their delivery either way rather than dropping it on the ground.
    const emptyStatus: EconomyProductionStatus = remaining === null ? missingStatus : "source-depleted";
    if (!hasLiveSource && producer.assignments.size === 0) {
      producer.status = emptyStatus;
      this.setProducerWorking(producer, false);
      return;
    }
    this.assignIdleWorkersToProducer(producer);
    let gatheringWorkers = 0;
    let movingWorkers = 0;
    let delivered = 0;
    for (const assignment of [...producer.assignments.values()]) {
      // Cleared up front and re-raised only by the working branch below: the walk
      // out, the walk back and the unload are all done on the worker's feet.
      // Unloading is deliberately left out — it is shorter than the animation's
      // kneel, so the pose would be cut off part-way down and read as a twitch.
      assignment.worker.setWorking(false);
      assignment.worker.setHunting(false);
      // Follow a source that moved out from under the worker. A tree never does,
      // so for wood and stone this is a distance check that always passes; a
      // hunted animal bolts, and a hunter who keeps walking to where it *was*
      // stands in an empty field for the rest of the match. Re-planned only once
      // the quarry has outrun the approach by a whole work range, so a chase
      // costs a handful of paths rather than one per frame.
      if (assignment.sourceId
        && (assignment.state === "moving-to-source" || assignment.state === "gathering")) {
        const at = source.positionOf(assignment.sourceId);
        // Two thresholds, because the two states are asking different questions.
        // In transit: has the quarry moved far enough that the walk is aimed at
        // the wrong place — tolerant, so a bolt does not re-plan every frame.
        // On station: is the worker still *at* it — tight, or a hunter would
        // butcher a carcass from a stale approach several paces away.
        const drift = assignment.state === "gathering"
          ? { from: assignment.worker.position, limit: WORK_RANGE }
          : { from: assignment.approach, limit: SOURCE_FOLLOW_SLACK };
        if (at && Math.hypot(at.x - drift.from.x, at.z - drift.from.z) > drift.limit) {
          const chase = this.navigation.plan(assignment.worker.position, new Vector3(at.x, 0, at.z));
          // A failed path is not fatal here, unlike a first approach: the quarry
          // is moving, so the next tick offers a different point to aim at. The
          // walk that is already underway carries on until the ordinary
          // `moving-to-source` retry gives up on it.
          if (chase) {
            assignment.approach.set(at.x, 0, at.z);
            assignment.worker.setMovePath(chase);
            assignment.state = "moving-to-source";
            movingWorkers += 1;
            continue;
          }
        }
      }
      if (assignment.state === "moving-to-source") {
        if (assignment.worker.position.distanceTo(assignment.approach) > WORK_RANGE) {
          if (!this.replanApproach(assignment)) {
            this.release(assignment.worker);
            continue;
          }
          movingWorkers += 1;
          continue;
        }
        assignment.worker.stop();
        assignment.state = "gathering";
      }
      if (assignment.state === "gathering") {
        gatheringWorkers += 1;
        if (producer.localBuffer >= economy.localBufferCapacity) {
          producer.localBuffer = economy.localBufferCapacity;
          if (assignment.cargoAmount > 0 && !this.returnToCamp(assignment, producer.structure)) {
            this.release(assignment.worker);
          }
          continue;
        }
        const harvested = assignment.sourceId
          ? source.harvest({
            workerId: assignment.worker.id,
            sourceId: assignment.sourceId,
            amount: Math.min(
              (economy.perWorkerPerMinute * deltaSeconds) / 60,
              economy.carryCapacity - assignment.cargoAmount,
            ),
            deltaSeconds,
          })
          : { amount: 0, working: false };
        // Still at it but nothing earned is a hunter whose quarry is not down
        // yet — the one combination a tree or a deposit never reports. That is
        // what tells the two poses apart without the loop knowing what wildlife
        // is: fighting the source, versus gathering from it.
        if (harvested.working && harvested.amount <= 0) assignment.worker.setHunting(true);
        else assignment.worker.setWorking(true);
        assignment.cargoAmount += harvested.amount;
        // A full load, or a source that just ran out under the tool: either way
        // the trip is over and the stand-up plays.
        if (assignment.cargoAmount >= economy.carryCapacity || !harvested.working) {
          if (!this.returnToCamp(assignment, producer.structure)) this.release(assignment.worker);
        }
        continue;
      }
      if (assignment.state === "returning") {
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
        source.releaseReservation(assignment.worker.id);
        // Only where sources are interchangeable: a lumberjack may deliver to
        // whichever camp faces the shortest next trip, while a miner belongs to
        // the deposit his mine was built beside.
        const nextProducer: ProducerRecord = source.sourcesAreInterchangeable && assignment.source === "automatic"
          ? this.preferredProducer(producer, assignment.worker, source)
          : producer;
        if (nextProducer !== producer) {
          producer.assignments.delete(assignment.worker.id);
          nextProducer.assignments.set(assignment.worker.id, assignment);
          this.assignmentByWorker.set(assignment.worker.id, nextProducer);
        }
        const nextEconomy = nextProducer.structure.economy;
        if (!nextEconomy || this.requirementFor(nextEconomy)?.source !== source
          || !this.moveWorkerToSource(assignment, nextProducer.structure, nextEconomy, source)) {
          this.release(assignment.worker);
        }
      }
    }
    producer.lastProductionTick = delivered;
    producer.totalProduced += delivered;
    producer.status = producer.localBuffer >= economy.localBufferCapacity
      ? "buffer-full"
      : producer.assignments.size === 0
        ? hasLiveSource ? "awaiting-workers" : emptyStatus
        : gatheringWorkers > 0 || delivered > 0
          ? "producing"
          : movingWorkers > 0
            ? "workers-moving"
            : hasLiveSource ? "awaiting-workers" : emptyStatus;
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

  /**
   * Drops (or raises) the working pose for every worker at this producer at once.
   * The hunting pose is only ever dropped here: a producer-wide pose change means
   * the job stopped, and no reason for it can leave a hunter mid-swing.
   */
  private setProducerWorking(producer: ProducerRecord, working: boolean): void {
    for (const assignment of producer.assignments.values()) {
      assignment.worker.setWorking(working);
      assignment.worker.setHunting(false);
    }
  }

  private dropInvalidAssignments(producer: ProducerRecord): void {
    for (const [workerId, assignment] of producer.assignments) {
      if (!assignment.worker.health.depleted && this.units.all().includes(assignment.worker)) continue;
      assignment.worker.setWorking(false);
      assignment.worker.setHunting(false);
      this.releaseSourceClaims(workerId);
      producer.assignments.delete(workerId);
      this.assignmentByWorker.delete(workerId);
    }
  }

  private releaseProducer(producer: ProducerRecord): void {
    for (const assignment of producer.assignments.values()) {
      assignment.worker.stop();
      assignment.worker.setWorking(false);
      assignment.worker.setHunting(false);
      this.releaseSourceClaims(assignment.worker.id);
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
    const requirement = this.requirementFor(economy);
    if (requirement) {
      if (!requirement.source) return false;
      const target = this.findReachableSource(worker, producer.structure, economy, requirement.source);
      if (!target) return false;
      worker.setMovePath(target.path);
      const assignment: WorkerAssignment = {
        worker,
        approach: target.approach,
        source,
        state: "moving-to-source",
        sourceId: target.sourceId,
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
    const assignment: WorkerAssignment = { worker, approach, source, state: "moving", sourceId: null, cargoAmount: 0 };
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
    assignment.state = "returning";
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

  private moveWorkerToSource(
    assignment: WorkerAssignment,
    structure: PlacedStructure,
    economy: NonNullable<PlacedStructure["economy"]>,
    source: ResourceSource,
  ): boolean {
    const target = this.findReachableSource(assignment.worker, structure, economy, source);
    if (!target) return false;
    assignment.sourceId = target.sourceId;
    assignment.approach = target.approach;
    assignment.worker.setMovePath(target.path);
    assignment.state = "moving-to-source";
    return true;
  }

  /**
   * The source a worker is sent to, and the route he takes to it.
   *
   * A live source may still be unreachable because a player built around it, and
   * whether that is worth retrying is the source's own call
   * ({@link ResourceSource.sourcesAreInterchangeable}): a grove simply offers the
   * next trunk, while a deposit's neighbour is a different pile that this
   * extractor could never bank — so the miner is released and the producer
   * reports it, rather than quietly walking to a deposit across the map.
   */
  private findReachableSource(
    worker: Unit,
    structure: PlacedStructure,
    economy: NonNullable<PlacedStructure["economy"]>,
    source: ResourceSource,
  ): { readonly sourceId: string; readonly approach: Vector3; readonly path: readonly Vector3[] } | null {
    if (economy.gatherRadius === undefined) return null;
    const reach = this.reachFor(structure, economy);
    const rejected = new Set<string>();
    while (true) {
      const reserved = source.reserveNearest(worker.id, reach, rejected);
      if (!reserved) return null;
      const approach = new Vector3(reserved.x, 0, reserved.z);
      const path = this.navigation.plan(worker.position, approach);
      if (path) return { sourceId: reserved.id, approach, path };
      source.releaseReservation(worker.id);
      if (!source.sourcesAreInterchangeable) return null;
      rejected.add(reserved.id);
    }
  }

  /** After delivering, automatic gatherers prefer the camp with the shortest next source-to-camp trip. */
  private preferredProducer(current: ProducerRecord, worker: Unit, source: ResourceSource): ProducerRecord {
    const candidates = [...this.producers.values()]
      .filter((producer) => {
        const economy = producer.structure.economy;
        if (!economy || producer.structure.owner !== worker.owner) return false;
        if (this.requirementFor(economy)?.source !== source || economy.gatherRadius === undefined) return false;
        if (producer !== current && producer.assignments.size >= economy.workerCapacity) return false;
        return (source.remainingNear(this.reachFor(producer.structure, economy)) ?? 0) > 0;
      });
    let best = current;
    let bestDistance = this.sourceDistanceForCamp(current, source);
    for (const candidate of candidates) {
      const distance = this.sourceDistanceForCamp(candidate, source);
      if (distance >= bestDistance) continue;
      best = candidate;
      bestDistance = distance;
    }
    return best;
  }

  private sourceDistanceForCamp(producer: ProducerRecord, source: ResourceSource): number {
    const economy = producer.structure.economy;
    if (!economy || economy.gatherRadius === undefined || this.requirementFor(economy)?.source !== source) {
      return Number.POSITIVE_INFINITY;
    }
    return source.nearestSourceDistanceSquared(this.reachFor(producer.structure, economy));
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

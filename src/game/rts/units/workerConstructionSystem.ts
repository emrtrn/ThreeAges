/**
 * Worker construction assignments for the settlement loop.
 *
 * Foundations receive one automatic builder so the economy cannot deadlock.
 * The player can then add selected workers explicitly; every active builder
 * contributes one worker-second of progress, up to the small approach-point
 * cap below.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "./unit";
import type { UnitSystem } from "./unitSystem";

export type WorkerConstructionState = "idle" | "moving" | "building" | "unreachable";
export type WorkerAssignmentFailure = "no-idle-worker" | "unreachable";
export type WorkerAssignmentResult =
  | { readonly assigned: true }
  | { readonly assigned: false; readonly reason: WorkerAssignmentFailure };

export interface ManualConstructionAssignmentResult {
  readonly assignedWorkers: number;
  readonly rejectedWorkers: number;
  readonly reason: WorkerAssignmentFailure | null;
}

type AssignmentSource = "automatic" | "manual";

interface WorkerAssignment {
  readonly worker: Unit;
  readonly structure: PlacedStructure;
  readonly approach: Vector3;
  readonly source: AssignmentSource;
  state: Exclude<WorkerConstructionState, "idle">;
}

const BUILD_RANGE = 1.25;
/** Four unique footprint-edge work positions keep worker pathing readable. */
const MAX_BUILDERS_PER_SITE = 4;

export class WorkerConstructionSystem {
  private readonly assignments = new Map<number, WorkerAssignment>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly isReservedForOtherWork: (worker: Unit) => boolean = () => false,
    private readonly onConstructionComplete: (structure: PlacedStructure) => void = () => {},
    /** Automatic recovery may only preempt automatic economy work; an explicit
     * player construction order may replace any economy assignment. */
    private readonly releaseFromOtherWork: (worker: Unit, source: AssignmentSource) => boolean = () => false,
  ) {}

  /** Assign one automatic builder, including recovery for an abandoned site. */
  assignNearest(structure: PlacedStructure): WorkerAssignmentResult {
    if (structure.construction.complete || this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) {
      return { assigned: false, reason: "no-idle-worker" };
    }
    const free = this.candidatesFor(structure, (worker) => !this.isReservedForOtherWork(worker));
    if (this.tryAssign(free, structure, "automatic")) return { assigned: true };

    // A foundation must not deadlock behind automatic gathering assignments.
    const gathering = this.candidatesFor(structure, (worker) => this.isReservedForOtherWork(worker));
    for (const worker of gathering) {
      if (!this.releaseFromOtherWork(worker, "automatic")) continue;
      if (this.tryAssign([worker], structure, "automatic")) return { assigned: true };
    }
    return {
      assigned: false,
      reason: free.length === 0 && gathering.length === 0 ? "no-idle-worker" : "unreachable",
    };
  }

  /**
   * Make the player's currently selected workers build this foundation. Explicit
   * orders may take a worker from gathering or another construction site.
   */
  assignWorkers(structure: PlacedStructure, workers: readonly Unit[]): ManualConstructionAssignmentResult {
    if (structure.construction.complete) {
      return { assignedWorkers: 0, rejectedWorkers: workers.length, reason: "unreachable" };
    }
    let assignedWorkers = 0;
    let rejectedWorkers = 0;
    let sawReachableCandidate = false;
    for (const worker of workers) {
      if (worker.role !== "worker" || worker.owner !== structure.owner || worker.health.depleted) {
        rejectedWorkers += 1;
        continue;
      }
      const existing = this.assignments.get(worker.id);
      if (existing?.structure === structure) {
        assignedWorkers += 1;
        continue;
      }
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) {
        rejectedWorkers += 1;
        continue;
      }
      if (existing) this.release(worker);
      if (this.isReservedForOtherWork(worker) && !this.releaseFromOtherWork(worker, "manual")) {
        rejectedWorkers += 1;
        continue;
      }
      const assigned = this.tryAssign([worker], structure, "manual");
      if (assigned) {
        assignedWorkers += 1;
        sawReachableCandidate = true;
      } else {
        rejectedWorkers += 1;
      }
    }
    return {
      assignedWorkers,
      rejectedWorkers,
      reason: assignedWorkers > 0 ? null : sawReachableCandidate ? "no-idle-worker" : "unreachable",
    };
  }

  /** Remove a worker from construction before a player-issued move or job order. */
  release(worker: Unit): boolean {
    const assignment = this.assignments.get(worker.id);
    if (!assignment) return false;
    assignment.worker.stop();
    this.assignments.delete(worker.id);
    return true;
  }

  private candidatesFor(structure: PlacedStructure, extra: (worker: Unit) => boolean): Unit[] {
    return this.units.workersOf(structure.owner)
      .filter((worker) => !this.assignments.has(worker.id) && extra(worker))
      .sort((a, b) => a.position.distanceToSquared(structure.object.position)
        - b.position.distanceToSquared(structure.object.position));
  }

  private tryAssign(candidates: readonly Unit[], structure: PlacedStructure, source: AssignmentSource): boolean {
    for (const worker of candidates) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) return false;
      const approach = this.findReachableApproach(worker, structure, this.approachesFor(structure));
      if (!approach) continue;
      const path = this.navigation.plan(worker.position, approach);
      if (!path) continue;
      worker.setMovePath(path);
      this.assignments.set(worker.id, { worker, structure, approach, source, state: "moving" });
      return true;
    }
    return false;
  }

  /** Remove a cancelled site's assignments, restoring its workers to idle. */
  cancelStructure(structure: PlacedStructure): void {
    for (const assignment of [...this.assignments.values()]) {
      if (assignment.structure === structure) this.release(assignment.worker);
    }
  }

  update(deltaSeconds: number): void {
    this.restaffAbandonedSites();
    for (const [workerId, assignment] of this.assignments) {
      const { worker, structure } = assignment;
      if (worker.health.depleted || !this.structures.all().includes(structure)) {
        this.assignments.delete(workerId);
        continue;
      }
      if (assignment.state !== "moving") continue;
      if (worker.position.distanceTo(assignment.approach) <= BUILD_RANGE) {
        worker.stop();
        assignment.state = "building";
        continue;
      }
      // A failed/stopped route used to leave the assignment occupied forever.
      // Re-plan once the mover has no active destination; if no route remains,
      // release it so the foundation can be staffed again on the next update.
      if (worker.pathTarget || worker.moveTarget) continue;
      const path = this.navigation.plan(worker.position, assignment.approach);
      if (path) worker.setMovePath(path);
      else this.assignments.delete(workerId);
    }

    const activeBuilders = new Map<PlacedStructure, number>();
    for (const assignment of this.assignments.values()) {
      if (assignment.state !== "building") continue;
      activeBuilders.set(assignment.structure, (activeBuilders.get(assignment.structure) ?? 0) + 1);
    }
    for (const [structure, workerCount] of activeBuilders) {
      if (!this.structures.advanceConstruction(structure, deltaSeconds, workerCount)) continue;
      for (const assignment of [...this.assignments.values()]) {
        if (assignment.structure === structure) this.release(assignment.worker);
      }
      this.onConstructionComplete(structure);
    }
  }

  /** Keep one automatic worker on a foundation that lost all of its builders. */
  private restaffAbandonedSites(): void {
    const staffed = new Set([...this.assignments.values()].map((assignment) => assignment.structure));
    for (const structure of this.structures.all()) {
      if (structure.construction.complete || staffed.has(structure)) continue;
      this.assignNearest(structure);
    }
  }

  stateFor(worker: Unit): WorkerConstructionState {
    return this.assignments.get(worker.id)?.state ?? "idle";
  }

  /** Builders on one site, for the §51 panel opened by selecting a foundation. */
  assignedWorkers(structure: PlacedStructure): number {
    return this.assignmentCount(structure);
  }

  idleWorkerCount(owner: UnitOwner): number {
    return this.units.workersOf(owner)
      .filter((worker) => this.stateFor(worker) === "idle" && !this.isReservedForOtherWork(worker)).length;
  }

  reset(): void {
    for (const assignment of [...this.assignments.values()]) this.release(assignment.worker);
  }

  private assignmentCount(structure: PlacedStructure): number {
    return [...this.assignments.values()].filter((assignment) => assignment.structure === structure).length;
  }

  private approachesFor(structure: PlacedStructure): readonly Vector3[] {
    return [...this.assignments.values()]
      .filter((assignment) => assignment.structure === structure)
      .map((assignment) => assignment.approach);
  }

  private findReachableApproach(
    worker: Unit,
    structure: PlacedStructure,
    occupied: readonly Vector3[],
  ): Vector3 | null {
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const gap = BUILD_RANGE * 0.7;
    const candidates = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ].filter((point) => !occupied.some((used) => used.distanceToSquared(point) < 0.01));
    candidates.sort((a, b) => worker.position.distanceToSquared(a) - worker.position.distanceToSquared(b));
    return candidates.find((point) => this.navigation.plan(worker.position, point) !== null) ?? null;
  }
}

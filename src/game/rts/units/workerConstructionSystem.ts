/**
 * Worker site work for the settlement loop: raising foundations, and repairing
 * the damaged buildings they became.
 *
 * Foundations pull in every idle worker, up to the approach-point cap below,
 * and — only when no idle worker exists — take a single gatherer off its job so
 * the economy cannot deadlock. The player can still add selected workers
 * explicitly; every active builder contributes one worker-second of progress.
 *
 * Repair rides on the same machinery rather than a system of its own. The
 * logistics question is identical — which workers, walking to which footprint
 * edge, how many may crowd one building — and a separate system would have to
 * be cross-checked by the economy, the AI's idle test and this one before any of
 * them could call a worker free. Only the *work* differs, and that is delegated
 * to `StructureRepairSystem` through the `advanceRepair` hook: repair is never
 * staffed automatically, because it spends resources and the player has to have
 * asked for it.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "./unit";
import type { UnitSystem } from "./unitSystem";

export type WorkerConstructionState = "idle" | "moving" | "building" | "repairing" | "unreachable";
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
/** What a worker at a site is there to do. */
export type WorkerSiteJob = "build" | "repair";
/** The tick result `StructureRepairSystem.advance` answers with. */
export type RepairAdvanceResult = "repairing" | "done";

interface WorkerAssignment {
  readonly worker: Unit;
  readonly structure: PlacedStructure;
  readonly approach: Vector3;
  readonly source: AssignmentSource;
  readonly job: WorkerSiteJob;
  /** "building" and "repairing" are both "settled and working", per job. */
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
    /**
     * Whether a site may pull in *every* idle worker instead of just one. The
     * player's kingdom opts in: hand-adding three more workers to each new
     * foundation was busywork. The AI keeps the single-builder rule its economy
     * managers are tuned around — flooding its own sites cost it buildings.
     */
    private readonly autoStaffsToCapacity: (structure: PlacedStructure) => boolean = () => false,
    /**
     * One tick of repair work, delegated to whoever owns the repair economics.
     * The default answers "done", so a runtime built without a repair system
     * simply has no repair rather than an unpaid, infinite one.
     */
    private readonly advanceRepair: (
      structure: PlacedStructure,
      deltaSeconds: number,
      workerCount: number,
    ) => RepairAdvanceResult = () => "done",
  ) {}

  /**
   * Staff a foundation automatically. For a kingdom that opts into capacity
   * staffing every genuinely idle worker joins, up to the approach-point cap;
   * otherwise one builder does. Only when the site would otherwise stay empty is
   * a worker pulled off automatic economy work — gathering keeps the rest.
   */
  assignNearest(structure: PlacedStructure): WorkerAssignmentResult {
    if (structure.construction.complete || this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) {
      return { assigned: false, reason: "no-idle-worker" };
    }
    const free = this.candidatesFor(structure, (worker) => !this.isReservedForOtherWork(worker));
    const toCapacity = this.autoStaffsToCapacity(structure);
    let assignedAny = false;
    for (const worker of free) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) break;
      if (!this.tryAssign([worker], structure, "automatic", "build")) continue;
      assignedAny = true;
      if (!toCapacity) break;
    }
    if (assignedAny) return { assigned: true };
    // A foundation must not deadlock behind automatic gathering assignments —
    // but preemption stays a last resort, so it only applies to an empty site.
    if (this.assignmentCount(structure) > 0) return { assigned: false, reason: "no-idle-worker" };

    const gathering = this.candidatesFor(structure, (worker) => this.isReservedForOtherWork(worker));
    for (const worker of gathering) {
      if (!this.releaseFromOtherWork(worker, "automatic")) continue;
      if (this.tryAssign([worker], structure, "automatic", "build")) return { assigned: true };
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
    return this.assignManually(structure, workers, "build");
  }

  /**
   * Send these workers to repair a standing building. The caller has already
   * opened and paid for the job (`StructureRepairSystem.begin`); this only staffs
   * it, under exactly the construction rules — same cap, same right to take a
   * worker off gathering, because the player asked for it by name.
   */
  assignRepairWorkers(structure: PlacedStructure, workers: readonly Unit[]): ManualConstructionAssignmentResult {
    if (!structure.construction.complete) {
      return { assignedWorkers: 0, rejectedWorkers: workers.length, reason: "unreachable" };
    }
    return this.assignManually(structure, workers, "repair");
  }

  /**
   * Staff a paid repair from whoever is free, nearest first — the repair
   * counterpart of {@link assignNearest}.
   *
   * Genuinely idle workers only: construction may preempt a gatherer to keep the
   * build order from deadlocking, and repair has no such deadlock to break. A
   * repair that finds nobody free is a refusal the player can answer by freeing
   * someone, not a reason to stop their economy behind their back.
   */
  assignNearestForRepair(structure: PlacedStructure): WorkerAssignmentResult {
    if (!structure.construction.complete || this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) {
      return { assigned: false, reason: "no-idle-worker" };
    }
    const free = this.candidatesFor(structure, (worker) => !this.isReservedForOtherWork(worker));
    let assignedAny = false;
    for (const worker of free) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) break;
      if (this.tryAssign([worker], structure, "automatic", "repair")) assignedAny = true;
    }
    if (assignedAny) return { assigned: true };
    return { assigned: false, reason: free.length === 0 ? "no-idle-worker" : "unreachable" };
  }

  private assignManually(
    structure: PlacedStructure,
    workers: readonly Unit[],
    job: WorkerSiteJob,
  ): ManualConstructionAssignmentResult {
    let assignedWorkers = 0;
    let rejectedWorkers = 0;
    let sawReachableCandidate = false;
    for (const worker of workers) {
      if (worker.role !== "worker" || worker.owner !== structure.owner || worker.health.depleted) {
        rejectedWorkers += 1;
        continue;
      }
      const existing = this.assignments.get(worker.id);
      if (existing?.structure === structure && existing.job === job) {
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
      const assigned = this.tryAssign([worker], structure, "manual", job);
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
    // Presentation only: a released builder must not keep kneeling at a site it
    // no longer belongs to. Cleared here so every exit path — cancelled site,
    // player order, death, completion — goes through one place.
    assignment.worker.setWorking(false);
    this.assignments.delete(worker.id);
    return true;
  }

  private candidatesFor(structure: PlacedStructure, extra: (worker: Unit) => boolean): Unit[] {
    return this.units.workersOf(structure.owner)
      .filter((worker) => !this.assignments.has(worker.id) && !worker.blocksAutomaticWorkerAssignment && extra(worker))
      .sort((a, b) => a.position.distanceToSquared(structure.object.position)
        - b.position.distanceToSquared(structure.object.position));
  }

  private tryAssign(
    candidates: readonly Unit[],
    structure: PlacedStructure,
    source: AssignmentSource,
    job: WorkerSiteJob,
  ): boolean {
    for (const worker of candidates) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) return false;
      const approach = this.findReachableApproach(worker, structure, this.approachesFor(structure));
      if (!approach) continue;
      const path = this.navigation.plan(worker.position, approach);
      if (!path) continue;
      worker.setMovePath(path);
      this.assignments.set(worker.id, { worker, structure, approach, source, job, state: "moving" });
      return true;
    }
    return false;
  }

  /** Remove a cancelled site's assignments, restoring its workers to idle. */
  cancelStructure(structure: PlacedStructure): void {
    this.releaseCrew(structure);
  }

  /** Send home only the crew repairing this building (a cancelled repair order). */
  cancelRepair(structure: PlacedStructure): void {
    this.releaseCrew(structure, "repair");
  }

  update(deltaSeconds: number): void {
    this.staffConstructionSites();
    for (const assignment of [...this.assignments.values()]) {
      const { worker, structure } = assignment;
      if (worker.health.depleted || !this.structures.all().includes(structure)) {
        // A destroyed/cancelled foundation must not leave its worker following
        // a now-orphaned route. In particular, a later player move has to start
        // from a genuinely clear unit state rather than a hidden assignment.
        this.release(worker);
        continue;
      }
      // The builder pose follows the assignment's own state, so it starts the
      // frame the worker settles on its approach point and stops the frame the
      // site is finished — no separate timer to drift out of step with. A
      // repairer swings the same hammer, so both settled states pose alike.
      worker.setWorking(assignment.state === "building" || assignment.state === "repairing");
      if (assignment.state !== "moving") continue;
      if (worker.position.distanceTo(assignment.approach) <= BUILD_RANGE) {
        worker.stop();
        assignment.state = assignment.job === "repair" ? "repairing" : "building";
        worker.setWorking(true);
        continue;
      }
      // A failed/stopped route used to leave the assignment occupied forever.
      // Re-plan once the mover has no active destination; if no route remains,
      // release it so the foundation can be staffed again on the next update.
      if (worker.pathTarget || worker.moveTarget) continue;
      const path = this.navigation.plan(worker.position, assignment.approach);
      if (path) worker.setMovePath(path);
      else this.release(worker);
    }

    const activeBuilders = new Map<PlacedStructure, number>();
    const activeRepairers = new Map<PlacedStructure, number>();
    for (const assignment of this.assignments.values()) {
      const crew = assignment.state === "building"
        ? activeBuilders
        : assignment.state === "repairing" ? activeRepairers : null;
      if (!crew) continue;
      crew.set(assignment.structure, (crew.get(assignment.structure) ?? 0) + 1);
    }
    for (const [structure, workerCount] of activeBuilders) {
      if (!this.structures.advanceConstruction(structure, deltaSeconds, workerCount)) continue;
      this.releaseCrew(structure);
      this.onConstructionComplete(structure);
    }
    // A finished repair frees its crew the same way a finished foundation does.
    // "done" also covers a job that was never open — a worker cannot be left
    // hammering a building nobody is paying for.
    for (const [structure, workerCount] of activeRepairers) {
      if (this.advanceRepair(structure, deltaSeconds, workerCount) !== "done") continue;
      this.releaseCrew(structure, "repair");
    }
  }

  /** Send one site's workers home; `job` narrows it to a single kind of crew. */
  private releaseCrew(structure: PlacedStructure, job?: WorkerSiteJob): void {
    for (const assignment of [...this.assignments.values()]) {
      if (assignment.structure !== structure) continue;
      if (job !== undefined && assignment.job !== job) continue;
      this.release(assignment.worker);
    }
  }

  /**
   * Keep every unfinished foundation staffed up to the cap. Workers that fall
   * idle later — a finished site, a gatherer released by its producer — join an
   * ongoing build instead of standing around.
   */
  private staffConstructionSites(): void {
    for (const structure of this.structures.all()) {
      if (structure.construction.complete) continue;
      const staffed = this.assignmentCount(structure);
      // A kingdom without capacity staffing keeps the old rule: top up only a
      // site that lost every builder.
      if (staffed >= MAX_BUILDERS_PER_SITE) continue;
      if (staffed > 0 && !this.autoStaffsToCapacity(structure)) continue;
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

  /** Workers currently sent to repair this building, walking or already at work. */
  assignedRepairWorkers(structure: PlacedStructure): number {
    return [...this.assignments.values()]
      .filter((assignment) => assignment.structure === structure && assignment.job === "repair").length;
  }

  idleWorkerCount(owner: UnitOwner): number {
    return this.units.workersOf(owner)
      .filter((worker) => this.stateFor(worker) === "idle"
        && !worker.blocksAutomaticWorkerAssignment && !this.isReservedForOtherWork(worker)).length;
  }

  /** Immediately retry automatic staffing of unfinished foundations. */
  assignIdleWorkers(): void {
    this.staffConstructionSites();
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

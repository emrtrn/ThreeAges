/**
 * Worker site work for the settlement loop: raising foundations.
 *
 * Foundations pull in every idle worker, up to the approach-point cap below,
 * and — only when no idle worker exists — take a single gatherer off its job so
 * the economy cannot deadlock. The player can still add selected workers
 * explicitly; every active builder contributes one worker-second of progress.
 *
 * Repair used to ride on this same machinery, because the logistics question was
 * identical — which workers, walking to which footprint edge, how many may crowd
 * one building. It no longer does: a damaged building repairs itself out of the
 * stockpile (`StructureRepairSystem`), with no crew to route and nobody taken
 * off gathering to do it. What that removed from here is the whole second kind
 * of site job; every assignment in this file is a builder on a foundation.
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
  /** Seconds spent in `moving` without reaching build reach. See {@link STALLED_APPROACH_SECONDS}. */
  movingSeconds: number;
}

const BUILD_RANGE = 1.25;

/**
 * How far outside the footprint edge a builder may stand and still be working.
 *
 * `BUILD_RANGE` alone measured the distance to {@link WorkerAssignment.approach},
 * a synthetic point on a ring `BUILD_RANGE * 0.7` outside the footprint — which
 * is *inside* the structure's own navigation blocker. The nav grid (cell size 1)
 * therefore parks the builder on the nearest free cell, consistently ~1.5 out
 * from the edge, so `distanceTo(approach) <= BUILD_RANGE` was never true: the
 * assignment sat in `moving` forever, the site stayed at 0%, and — because the
 * AI runs one build at a time — its whole build queue stopped behind it.
 *
 * So arrival is measured against the building itself rather than against a point
 * that may be unreachable, with one nav cell of slack over `BUILD_RANGE` for the
 * grid's own snapping. A builder this close is standing against the wall.
 */
const BUILD_REACH = BUILD_RANGE + 1;

/**
 * How long a builder may be en route without reaching build reach before the
 * assignment is given up.
 *
 * The re-plan below only fires when the mover has no route left, so a worker
 * whose route keeps "succeeding" short of the site retried forever without ever
 * gaining ground. This is the backstop: release it, and `staffConstructionSites`
 * offers the foundation a different worker and a different approach next tick.
 */
const STALLED_APPROACH_SECONDS = 20;

/** Four unique footprint-edge work positions keep worker pathing readable. */
const MAX_BUILDERS_PER_SITE = 4;

/** Distance from a point to a structure's footprint rectangle, 0 when inside. */
function distanceToFootprint(structure: PlacedStructure, x: number, z: number): number {
  const dx = Math.max(Math.abs(x - structure.x) - structure.stats.footprint.width / 2, 0);
  const dz = Math.max(Math.abs(z - structure.z) - structure.stats.footprint.depth / 2, 0);
  return Math.hypot(dx, dz);
}

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
    /** Player-owned automatic staffing can be disabled without affecting the AI. */
    private readonly isAutomaticWorkerAssignmentEnabled: (owner: UnitOwner) => boolean = () => true,
  ) {}

  /**
   * Staff a foundation automatically. For a kingdom that opts into capacity
   * staffing every genuinely idle worker joins, up to the approach-point cap;
   * otherwise one builder does. Only when the site would otherwise stay empty is
   * a worker pulled off automatic economy work — gathering keeps the rest.
   */
  assignNearest(structure: PlacedStructure): WorkerAssignmentResult {
    if (!this.isAutomaticWorkerAssignmentEnabled(structure.owner)) {
      return { assigned: false, reason: "no-idle-worker" };
    }
    if (structure.construction.complete || this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) {
      return { assigned: false, reason: "no-idle-worker" };
    }
    const free = this.candidatesFor(structure, (worker) => !this.isReservedForOtherWork(worker));
    const toCapacity = this.autoStaffsToCapacity(structure);
    let assignedAny = false;
    for (const worker of free) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) break;
      if (!this.tryAssign([worker], structure, "automatic")) continue;
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
    return this.assignManually(structure, workers);
  }

  private assignManually(
    structure: PlacedStructure,
    workers: readonly Unit[],
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
    // Presentation only: a released builder must not keep kneeling at a site it
    // no longer belongs to. Cleared here so every exit path — cancelled site,
    // player order, death, completion — goes through one place.
    assignment.worker.setWorking(false);
    assignment.worker.setWorkerActivity(null);
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
  ): boolean {
    for (const worker of candidates) {
      if (this.assignmentCount(structure) >= MAX_BUILDERS_PER_SITE) return false;
      const approach = this.findReachableApproach(worker, structure, this.approachesFor(structure));
      if (!approach) continue;
      const path = this.navigation.plan(worker.position, approach);
      if (!path) continue;
      worker.setMovePath(path);
      worker.setWorkerActivity("construction");
      this.assignments.set(worker.id, {
        worker, structure, approach, source, state: "moving", movingSeconds: 0,
      });
      return true;
    }
    return false;
  }

  /** Remove a cancelled site's assignments, restoring its workers to idle. */
  cancelStructure(structure: PlacedStructure): void {
    this.releaseCrew(structure);
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
      // The Worker pack has no honest hammer/build clip. Keep the body in its
      // standing idle instead of misrepresenting construction with the kneeling
      // fallback; the site’s own construction visual and progress remain the
      // presentation of the real build work. Activity still reports the job to
      // future authored construction clips without changing simulation.
      worker.setWorking(assignment.state === "building");
      if (assignment.state !== "moving") continue;
      // Arrival is asked of the building, not of the approach point: the approach
      // sits inside the site's own nav blocker, so a builder can be standing
      // against the wall and still be metres from it (see {@link BUILD_REACH}).
      if (worker.position.distanceTo(assignment.approach) <= BUILD_RANGE
        || distanceToFootprint(structure, worker.position.x, worker.position.z) <= BUILD_REACH) {
        worker.stop();
        assignment.state = "building";
        worker.setWorking(true);
        continue;
      }
      assignment.movingSeconds += deltaSeconds;
      // Neither arriving nor gaining ground. Give the job up rather than hold the
      // foundation — and, for the AI, its single build slot — open forever.
      if (assignment.movingSeconds >= STALLED_APPROACH_SECONDS) {
        this.release(worker);
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
    for (const assignment of this.assignments.values()) {
      if (assignment.state !== "building") continue;
      activeBuilders.set(assignment.structure, (activeBuilders.get(assignment.structure) ?? 0) + 1);
    }
    for (const [structure, workerCount] of activeBuilders) {
      if (!this.structures.advanceConstruction(structure, deltaSeconds, workerCount)) continue;
      this.releaseCrew(structure);
      this.onConstructionComplete(structure);
    }
  }

  /** Send one site's workers home. */
  private releaseCrew(structure: PlacedStructure): void {
    for (const assignment of [...this.assignments.values()]) {
      if (assignment.structure !== structure) continue;
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
      if (!this.isAutomaticWorkerAssignmentEnabled(structure.owner)) continue;
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

  /**
   * Builders standing at this site and working, as opposed to still walking to
   * it — the distinction {@link assignedWorkers} deliberately does not make.
   *
   * The panel above wants "how many workers is this foundation costing me",
   * which is every assignment. The build-loop audio wants the narrower thing:
   * whether hammering is actually happening here right now. A site whose crew is
   * still crossing the map is staffed and silent, and it is `update`'s
   * `activeBuilders` census — the same `"building"` state that advances the
   * progress bar — that separates the two.
   */
  activeBuilders(structure: PlacedStructure): number {
    // Walked rather than filtered, unlike its neighbours here: those answer a
    // panel that opens on a click, this one is asked every rendered frame, and
    // the copy of the assignment map they each make would be a per-frame
    // allocation for a number.
    let count = 0;
    for (const assignment of this.assignments.values()) {
      if (assignment.structure === structure && assignment.state === "building") count += 1;
    }
    return count;
  }

  /** Remaining distinct approach positions on an unfinished foundation. */
  availableWorkerSlots(structure: PlacedStructure): number {
    return structure.construction.complete
      ? 0
      : Math.max(0, MAX_BUILDERS_PER_SITE - this.assignmentCount(structure));
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

/**
 * Single-worker construction assignment for the first settlement loop.
 *
 * A newly placed foundation selects the nearest idle player worker, paths to a
 * reachable edge point, and contributes build time once in range. Multi-worker
 * acceleration and player-directed assignments remain later Phase 2 work.
 */
import { Vector3 } from "three";

import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit } from "./unit";
import type { UnitSystem } from "./unitSystem";

export type WorkerConstructionState = "idle" | "moving" | "building" | "unreachable";
export type WorkerAssignmentFailure = "no-idle-worker" | "unreachable";
export type WorkerAssignmentResult =
  | { readonly assigned: true }
  | { readonly assigned: false; readonly reason: WorkerAssignmentFailure };

interface WorkerAssignment {
  readonly worker: Unit;
  readonly structure: PlacedStructure;
  readonly approach: Vector3;
  state: Exclude<WorkerConstructionState, "idle">;
}

const BUILD_RANGE = 1.25;

export class WorkerConstructionSystem {
  private readonly assignments = new Map<number, WorkerAssignment>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
  ) {}

  /** Assign the nearest idle worker and name the failure mode for player feedback. */
  assignNearest(structure: PlacedStructure): WorkerAssignmentResult {
    const candidates = this.units.playerWorkers()
      .filter((worker) => !this.assignments.has(worker.id))
      .sort((a, b) => a.position.distanceToSquared(structure.object.position)
        - b.position.distanceToSquared(structure.object.position));
    for (const worker of candidates) {
      const approach = this.findReachableApproach(worker, structure);
      if (!approach) continue;
      const path = this.navigation.plan(worker.position, approach);
      if (!path) continue;
      worker.setMovePath(path);
      this.assignments.set(worker.id, { worker, structure, approach, state: "moving" });
      return { assigned: true };
    }
    return { assigned: false, reason: candidates.length === 0 ? "no-idle-worker" : "unreachable" };
  }

  /** Remove a cancelled site's assignment, restoring its worker to idle. */
  cancelStructure(structure: PlacedStructure): void {
    for (const [workerId, assignment] of this.assignments) {
      if (assignment.structure !== structure) continue;
      assignment.worker.stop();
      this.assignments.delete(workerId);
    }
  }

  update(deltaSeconds: number): void {
    for (const [workerId, assignment] of this.assignments) {
      const { worker, structure } = assignment;
      if (worker.health.depleted || !this.structures.all().includes(structure)) {
        this.assignments.delete(workerId);
        continue;
      }
      if (assignment.state === "moving") {
        if (worker.position.distanceTo(assignment.approach) > BUILD_RANGE) continue;
        worker.stop();
        assignment.state = "building";
      }
      if (assignment.state === "building" && this.structures.advanceConstruction(structure, deltaSeconds)) {
        this.assignments.delete(workerId);
      }
    }
  }

  stateFor(worker: Unit): WorkerConstructionState {
    return this.assignments.get(worker.id)?.state ?? "idle";
  }

  idleWorkerCount(): number {
    return this.units.playerWorkers().filter((worker) => this.stateFor(worker) === "idle").length;
  }

  reset(): void {
    for (const assignment of this.assignments.values()) assignment.worker.stop();
    this.assignments.clear();
  }

  private findReachableApproach(worker: Unit, structure: PlacedStructure): Vector3 | null {
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const gap = BUILD_RANGE * 0.7;
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

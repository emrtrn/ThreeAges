/**
 * The first completed-building function: a Barracks trains one Guard at a
 * time and places it on a navigable exit point outside the building footprint.
 * Unit cost/population are deliberately left to the Phase 3 economy slice.
 */
import { Vector3 } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { UnitSystem } from "../units/unitSystem";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";

export type GuardProductionResult =
  | "queued"
  | "no-completed-barracks"
  | "already-training"
  | "exit-blocked";

export interface GuardProductionEvent {
  readonly type: "completed" | "exit-blocked";
  readonly structure: PlacedStructure;
}

interface GuardQueue {
  readonly structure: PlacedStructure;
  remainingSeconds: number;
}

export class BarracksProductionSystem {
  private readonly queues = new Map<number, GuardQueue>();

  constructor(
    private readonly units: UnitSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly navigation: RtsNavigation,
    private readonly guardStats: UnitBalanceStats,
  ) {}

  queueGuard(): GuardProductionResult {
    const barracks = this.structures.all().find(
      (structure) => structure.stats.id === "barracks" && structure.construction.complete,
    );
    if (!barracks) return "no-completed-barracks";
    if (this.queues.has(barracks.id)) return "already-training";
    this.queues.set(barracks.id, { structure: barracks, remainingSeconds: this.guardStats.trainingSeconds });
    return "queued";
  }

  update(deltaSeconds: number): GuardProductionEvent[] {
    const events: GuardProductionEvent[] = [];
    for (const [id, queue] of this.queues) {
      if (!this.structures.all().includes(queue.structure) || !queue.structure.construction.complete) {
        this.queues.delete(id);
        continue;
      }
      queue.remainingSeconds = Math.max(0, queue.remainingSeconds - Math.max(0, deltaSeconds));
      if (queue.remainingSeconds > 0) continue;
      const exit = this.findSafeExit(queue.structure);
      if (!exit) {
        events.push({ type: "exit-blocked", structure: queue.structure });
        continue;
      }
      this.units.spawn("player", exit.x, exit.z, this.guardStats, "guard");
      this.queues.delete(id);
      events.push({ type: "completed", structure: queue.structure });
    }
    return events;
  }

  reset(): void {
    this.queues.clear();
  }

  private findSafeExit(structure: PlacedStructure): Vector3 | null {
    const gap = 1.3;
    const halfW = structure.stats.footprint.width / 2;
    const halfD = structure.stats.footprint.depth / 2;
    const candidates = [
      new Vector3(structure.x + halfW + gap, 0, structure.z),
      new Vector3(structure.x - halfW - gap, 0, structure.z),
      new Vector3(structure.x, 0, structure.z + halfD + gap),
      new Vector3(structure.x, 0, structure.z - halfD - gap),
    ];
    return candidates.find((point) => this.navigation.plan(point, point) !== null) ?? null;
  }
}

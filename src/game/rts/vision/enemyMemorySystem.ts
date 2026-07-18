/**
 * Last-known enemy structures — Vertical Slice Plan v0.2 §59, GDD 08 §40.
 *
 * §40: a structure seen once stays on the map as a ghost after it falls back
 * under fog, and "bilgi eskidikçe doğruluk kaybedebilir". The rule that makes
 * this behave like knowledge rather than a cache is *when memory is corrected*:
 *
 *  - A remembered structure is refreshed while its cell is **visible**.
 *  - It is **forgotten only when its cell is visible and it is not there** —
 *    i.e. you walked back and saw the rubble.
 *  - Under fog it is left exactly as it was, however stale.
 *
 * So razing a building the opponent cannot see does not quietly delete their
 * ghost; they keep planning against a building that no longer exists until they
 * look. That asymmetry is the point of the system — without it, "last known" is
 * just live truth with a delay.
 *
 * Symmetric: keyed by {@link UnitOwner}, so the AI's world model is built from
 * the same memory the player's ghost renderer draws.
 *
 * Pure TS: no three.js, no DOM (Forge boundary, CLAUDE.md / TD-002).
 */
import type { UnitOwner } from "../units/unit";
import type { VisionSystem } from "./visionSystem";

/**
 * Command centres live in {@link CommandCenterSystem}, not the placed-structure
 * registry, so they have no `PlacedStructure.id` to key memory by. They get
 * synthetic negative ids — negative because placed-structure ids are positive
 * and counting up, so the two id spaces can never collide as the match runs.
 */
export function commandCenterMemoryId(owner: UnitOwner): number {
  return owner === "player" ? -1 : -2;
}

/** What one kingdom believes about one enemy structure. */
export interface RememberedStructure {
  /** The live structure's id, so a re-sighting updates rather than duplicates. */
  readonly structureId: number;
  readonly buildingId: string;
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly level: number;
  /** Health ratio *at the moment it was last seen*, not the live value. */
  readonly healthRatio: number;
  /** Match seconds at the last sighting; the renderer fades old ghosts by age. */
  readonly lastSeenAt: number;
  /** True while the structure is in vision right now. */
  readonly currentlyVisible: boolean;
}

/** The subset of a live structure this system needs; keeps tests free of three.js. */
export interface ObservableStructure {
  readonly id: number;
  readonly owner: UnitOwner;
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly level: number;
  readonly healthRatio: number;
}

export class EnemyMemorySystem {
  private readonly memory: Record<UnitOwner, Map<number, RememberedStructure>> = {
    player: new Map(),
    enemy: new Map(),
  };

  constructor(
    private readonly vision: VisionSystem,
    private readonly structures: () => readonly ObservableStructure[],
  ) {}

  /**
   * Reconcile every kingdom's memory against what it can currently see.
   *
   * Runs on the simulation tick alongside {@link VisionSystem.refresh}; ordering
   * matters, vision must already be refreshed for this frame.
   */
  refresh(now: number): void {
    const live = this.structures();
    for (const observer of ["player", "enemy"] as const) {
      const remembered = this.memory[observer];
      const seenThisTick = new Set<number>();

      for (const structure of live) {
        if (structure.owner === observer) continue;
        if (!this.vision.isVisible(observer, structure.x, structure.z)) continue;
        seenThisTick.add(structure.id);
        remembered.set(structure.id, {
          structureId: structure.id,
          buildingId: structure.buildingId,
          owner: structure.owner,
          x: structure.x,
          z: structure.z,
          level: structure.level,
          healthRatio: structure.healthRatio,
          lastSeenAt: now,
          currentlyVisible: true,
        });
      }

      for (const [id, ghost] of remembered) {
        if (seenThisTick.has(id)) continue;
        // The only way to lose a memory: look at where it stood and find it
        // gone. Under fog the ghost survives, stale, which is the §40 rule.
        if (this.vision.isVisible(observer, ghost.x, ghost.z)) {
          remembered.delete(id);
          continue;
        }
        if (ghost.currentlyVisible) {
          remembered.set(id, { ...ghost, currentlyVisible: false });
        }
      }
    }
  }

  /** Everything this kingdom believes about enemy structures, ghosts included. */
  known(observer: UnitOwner): readonly RememberedStructure[] {
    return [...this.memory[observer].values()];
  }

  /** Only the ones under fog — what the ghost renderer draws (§40). */
  ghosts(observer: UnitOwner): readonly RememberedStructure[] {
    return this.known(observer).filter((entry) => !entry.currentlyVisible);
  }

  /** How stale a belief is, in seconds. */
  ageOf(entry: RememberedStructure, now: number): number {
    return Math.max(0, now - entry.lastSeenAt);
  }

  reset(): void {
    this.memory.player.clear();
    this.memory.enemy.clear();
  }
}

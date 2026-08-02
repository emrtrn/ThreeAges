/**
 * Authoritative, renderer-free state for a forest whose trees are individual,
 * finite wood sources. Rendering may batch them, but gameplay never treats the
 * forest as one opaque static mesh.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type {
  ResourceHarvest,
  ResourceHarvestRequest,
  ResourceReach,
  ResourceSearchArea,
  ResourceSource,
} from "./resourceSource";

export type TreeVariant = "pine" | "tree1" | "tree2";

const DEPLETION_EPSILON = 1e-9;

/**
 * Half-extent of the square a live tree reserves against building placement, in
 * world units. Sized just under the tree's rendered canopy so a footprint can
 * abut a grove without ever sitting on a trunk — a buried tree has no work point
 * (see {@link ForestSystem.outsideFootprint}) and would be lost wood.
 */
export const RTS_TREE_BLOCK_HALF_EXTENT = 0.8;

export interface RtsTreeDefinition {
  readonly id: string;
  readonly forestId: string;
  readonly x: number;
  readonly z: number;
  readonly capacity: number;
  readonly variant: TreeVariant;
}

export interface TreeSnapshot extends RtsTreeDefinition {
  readonly remaining: number;
  readonly depleted: boolean;
  readonly reservedByWorkerId: number | null;
}

/** The camp footprint a tree may not hide under. Named for its callers here. */
export type ForestSearchArea = ResourceSearchArea;

interface TreeRecord {
  readonly definition: RtsTreeDefinition;
  remaining: number;
  reservedByWorkerId: number | null;
}

/** Shared tree state for camps, workers, AI and visual presentation. */
export class ForestSystem implements ResourceSource {
  private readonly trees = new Map<string, TreeRecord>();
  private readonly treeIdByWorkerId = new Map<number, string>();

  /**
   * One trunk is as good as the next: a lumberjack walled in from his tree takes
   * its neighbour, and one who has just unloaded goes to whichever camp is
   * closest to standing wood.
   */
  readonly sourcesAreInterchangeable = true;

  constructor(definitions: readonly RtsTreeDefinition[]) {
    for (const definition of definitions) {
      if (this.trees.has(definition.id)) throw new Error(`Duplicate tree "${definition.id}"`);
      if (!Number.isFinite(definition.capacity) || definition.capacity <= 0) {
        throw new RangeError(`Tree "${definition.id}" capacity must be a positive finite number`);
      }
      this.trees.set(definition.id, { definition, remaining: definition.capacity, reservedByWorkerId: null });
    }
  }

  hasLiveTreeNear(x: number, z: number, radius: number, excludedFootprint?: ForestSearchArea): boolean {
    return this.liveTreesNear(x, z, radius, excludedFootprint).length > 0;
  }

  /**
   * Standing wood in reach, and never null: a camp out of range of every tree
   * and a camp that has felled its whole grove are the same thing to a player —
   * no wood here — unlike a mine, whose deposits are separate piles worth
   * telling apart.
   */
  remainingNear(reach: ResourceReach): number {
    return this.liveTreesNear(reach.x, reach.z, reach.radius, reach.footprint)
      .reduce((total, tree) => total + tree.remaining, 0);
  }

  /** Squared camp-to-tree distance for choosing the best delivery point without a renderer query. */
  nearestSourceDistanceSquared(reach: ResourceReach): number {
    const { x, z } = reach;
    const nearest = this.liveTreesNear(x, z, reach.radius, reach.footprint)
      .sort((a, b) => this.distanceSquared(a.definition, x, z) - this.distanceSquared(b.definition, x, z))[0];
    return nearest ? this.distanceSquared(nearest.definition, x, z) : Number.POSITIVE_INFINITY;
  }

  /** Reserve the closest free live tree, keeping one worker from crowding another. */
  reserveNearest(
    workerId: number,
    reach: ResourceReach,
    rejectedSourceIds: ReadonlySet<string> = new Set(),
  ): TreeSnapshot | null {
    const { x, z, radius, footprint } = reach;
    const currentId = this.treeIdByWorkerId.get(workerId);
    const current = currentId ? this.trees.get(currentId) : null;
    if (current && !rejectedSourceIds.has(current.definition.id) && current.remaining > 0 && this.inRange(current.definition, x, z, radius)
      && this.outsideFootprint(current.definition, x, z, footprint)) {
      return this.snapshot(current);
    }
    this.releaseReservation(workerId);
    const next = this.liveTreesNear(x, z, radius, footprint)
      .filter((tree) => tree.reservedByWorkerId === null && !rejectedSourceIds.has(tree.definition.id))
      .sort((a, b) => this.distanceSquared(a.definition, x, z) - this.distanceSquared(b.definition, x, z))[0];
    if (!next) return null;
    next.reservedByWorkerId = workerId;
    this.treeIdByWorkerId.set(workerId, next.definition.id);
    return this.snapshot(next);
  }

  treeForWorker(workerId: number): TreeSnapshot | null {
    const treeId = this.treeIdByWorkerId.get(workerId);
    const tree = treeId ? this.trees.get(treeId) : null;
    return tree ? this.snapshot(tree) : null;
  }

  /** A tree stands where it was authored; nothing here ever moves. */
  positionOf(sourceId: string): { readonly x: number; readonly z: number } | null {
    const tree = this.trees.get(sourceId);
    return tree ? { x: tree.definition.x, z: tree.definition.z } : null;
  }

  /**
   * Cut from the tree this worker holds. The request also names the source it
   * believes he is at, but the reservation is what binds here: a lumberjack can
   * only ever fell the trunk the forest handed him, so the name is not consulted.
   * Nor is the tick length — an axe yields by the stroke, not by the second.
   */
  harvest({ workerId, amount: requested }: ResourceHarvestRequest): ResourceHarvest {
    if (!Number.isFinite(requested) || requested < 0) {
      throw new RangeError("Requested wood harvest must be a non-negative finite number");
    }
    const treeId = this.treeIdByWorkerId.get(workerId);
    const tree = treeId ? this.trees.get(treeId) : null;
    if (!tree || tree.reservedByWorkerId !== workerId || tree.remaining <= 0) {
      return { amount: 0, working: false };
    }
    const amount = Math.min(requested, tree.remaining);
    tree.remaining -= amount;
    if (tree.remaining <= DEPLETION_EPSILON) tree.remaining = 0;
    return { amount, working: amount > 0 };
  }

  releaseReservation(workerId: number): void {
    const treeId = this.treeIdByWorkerId.get(workerId);
    const tree = treeId ? this.trees.get(treeId) : null;
    if (tree?.reservedByWorkerId === workerId) tree.reservedByWorkerId = null;
    this.treeIdByWorkerId.delete(workerId);
  }

  reset(): void {
    this.treeIdByWorkerId.clear();
    for (const tree of this.trees.values()) {
      tree.remaining = tree.definition.capacity;
      tree.reservedByWorkerId = null;
    }
  }

  /**
   * Footprint blockers for every still-standing tree, so a building cannot be
   * placed on top of a live wood source. Depleted trees have already vanished,
   * so they stop reserving ground and their cells become buildable again.
   */
  liveTreeBlockers(): readonly NavBlocker[] {
    const blockers: NavBlocker[] = [];
    for (const tree of this.trees.values()) {
      if (tree.remaining <= 0) continue;
      const { x, z } = tree.definition;
      blockers.push({
        min: [x - RTS_TREE_BLOCK_HALF_EXTENT, 0, z - RTS_TREE_BLOCK_HALF_EXTENT],
        max: [x + RTS_TREE_BLOCK_HALF_EXTENT, 3, z + RTS_TREE_BLOCK_HALF_EXTENT],
      });
    }
    return blockers;
  }

  snapshots(): readonly TreeSnapshot[] {
    return [...this.trees.values()]
      .map((tree) => this.snapshot(tree))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private liveTreesNear(x: number, z: number, radius: number, excludedFootprint?: ForestSearchArea): TreeRecord[] {
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError("Forest search radius must be non-negative and finite");
    return [...this.trees.values()].filter((tree) => tree.remaining > 0
      && this.inRange(tree.definition, x, z, radius)
      && this.outsideFootprint(tree.definition, x, z, excludedFootprint));
  }

  private inRange(tree: RtsTreeDefinition, x: number, z: number, radius: number): boolean {
    return this.distanceSquared(tree, x, z) <= radius * radius;
  }

  private distanceSquared(tree: RtsTreeDefinition, x: number, z: number): number {
    const dx = tree.x - x;
    const dz = tree.z - z;
    return dx * dx + dz * dz;
  }

  /** Camps are built beside trees; a source buried under their footprint has no work point. */
  private outsideFootprint(tree: RtsTreeDefinition, x: number, z: number, footprint: ForestSearchArea | undefined): boolean {
    if (!footprint) return true;
    return tree.x < x - footprint.width / 2 || tree.x > x + footprint.width / 2
      || tree.z < z - footprint.depth / 2 || tree.z > z + footprint.depth / 2;
  }

  private snapshot(tree: TreeRecord): TreeSnapshot {
    return {
      ...tree.definition,
      remaining: tree.remaining,
      depleted: tree.remaining <= 0,
      reservedByWorkerId: tree.reservedByWorkerId,
    };
  }
}

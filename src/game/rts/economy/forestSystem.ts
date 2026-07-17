/**
 * Authoritative, renderer-free state for a forest whose trees are individual,
 * finite wood sources. Rendering may batch them, but gameplay never treats the
 * forest as one opaque static mesh.
 */
export type TreeVariant = "pine" | "tree1" | "tree2";

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

interface TreeRecord {
  readonly definition: RtsTreeDefinition;
  remaining: number;
  reservedByWorkerId: number | null;
}

/** Shared tree state for camps, workers, AI and visual presentation. */
export class ForestSystem {
  private readonly trees = new Map<string, TreeRecord>();
  private readonly treeIdByWorkerId = new Map<number, string>();

  constructor(definitions: readonly RtsTreeDefinition[]) {
    for (const definition of definitions) {
      if (this.trees.has(definition.id)) throw new Error(`Duplicate tree "${definition.id}"`);
      if (!Number.isFinite(definition.capacity) || definition.capacity <= 0) {
        throw new RangeError(`Tree "${definition.id}" capacity must be a positive finite number`);
      }
      this.trees.set(definition.id, { definition, remaining: definition.capacity, reservedByWorkerId: null });
    }
  }

  hasLiveTreeNear(x: number, z: number, radius: number): boolean {
    return this.liveTreesNear(x, z, radius).length > 0;
  }

  remainingNear(x: number, z: number, radius: number): number {
    return this.liveTreesNear(x, z, radius).reduce((total, tree) => total + tree.remaining, 0);
  }

  /** Reserve the closest free live tree, keeping one worker from crowding another. */
  reserveNearest(workerId: number, x: number, z: number, radius: number): TreeSnapshot | null {
    const currentId = this.treeIdByWorkerId.get(workerId);
    const current = currentId ? this.trees.get(currentId) : null;
    if (current && current.remaining > 0 && this.inRange(current.definition, x, z, radius)) {
      return this.snapshot(current);
    }
    this.releaseReservation(workerId);
    const next = this.liveTreesNear(x, z, radius)
      .filter((tree) => tree.reservedByWorkerId === null)
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

  harvest(workerId: number, requested: number): number {
    if (!Number.isFinite(requested) || requested < 0) {
      throw new RangeError("Requested wood harvest must be a non-negative finite number");
    }
    const treeId = this.treeIdByWorkerId.get(workerId);
    const tree = treeId ? this.trees.get(treeId) : null;
    if (!tree || tree.reservedByWorkerId !== workerId || tree.remaining <= 0) return 0;
    const amount = Math.min(requested, tree.remaining);
    tree.remaining -= amount;
    return amount;
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

  snapshots(): readonly TreeSnapshot[] {
    return [...this.trees.values()]
      .map((tree) => this.snapshot(tree))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private liveTreesNear(x: number, z: number, radius: number): TreeRecord[] {
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError("Forest search radius must be non-negative and finite");
    return [...this.trees.values()].filter((tree) => tree.remaining > 0 && this.inRange(tree.definition, x, z, radius));
  }

  private inRange(tree: RtsTreeDefinition, x: number, z: number, radius: number): boolean {
    return this.distanceSquared(tree, x, z) <= radius * radius;
  }

  private distanceSquared(tree: RtsTreeDefinition, x: number, z: number): number {
    const dx = tree.x - x;
    const dz = tree.z - z;
    return dx * dx + dz * dz;
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

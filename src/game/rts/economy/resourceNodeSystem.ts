/**
 * Finite Faz 6 deposits. A quarry or mine must cover one matching node; its
 * workers draw material from that shared world state rather than creating an
 * unlimited private buffer. The class has no renderer dependency so both the
 * player and headless AI use exactly the same depletion rule.
 */
import type { ResourceBalance } from "../../data/gameDataTypes";

export type ResourceNodeKind = "safe" | "external";

export interface RtsResourceNodeDefinition {
  readonly id: string;
  readonly resourceId: string;
  readonly kind: ResourceNodeKind;
  readonly x: number;
  readonly z: number;
}

export interface ResourceNodeSnapshot extends RtsResourceNodeDefinition {
  readonly capacity: number;
  readonly remaining: number;
  readonly depleted: boolean;
}

interface ResourceNodeRecord {
  readonly definition: RtsResourceNodeDefinition;
  readonly capacity: number;
  remaining: number;
}

/** A source point must sit inside the extractor footprint, with no fuzzy range. */
export class ResourceNodeSystem {
  private readonly nodes = new Map<string, ResourceNodeRecord>();

  constructor(
    balance: ResourceBalance,
    definitions: readonly RtsResourceNodeDefinition[],
  ) {
    for (const definition of definitions) {
      if (this.nodes.has(definition.id)) throw new Error(`Duplicate resource node "${definition.id}"`);
      const resource = balance[definition.resourceId];
      if (!resource) throw new Error(`Resource node "${definition.id}" references unknown resource "${definition.resourceId}"`);
      const profile = definition.kind === "safe" ? resource.safeNode : resource.externalNode;
      this.nodes.set(definition.id, { definition, capacity: profile.capacity, remaining: profile.capacity });
    }
  }

  /** A matching, non-depleted source lies inside this extractor's footprint. */
  canExtractAt(resourceId: string, x: number, z: number, width: number, depth: number): boolean {
    return (this.nodeAt(resourceId, x, z, width, depth)?.remaining ?? 0) > 0;
  }

  /** Draw up to `requested` material, returning zero when the source is empty. */
  extract(resourceId: string, x: number, z: number, width: number, depth: number, requested: number): number {
    if (!Number.isFinite(requested) || requested < 0) {
      throw new RangeError("Requested resource extraction must be a non-negative finite number");
    }
    const node = this.nodeAt(resourceId, x, z, width, depth);
    if (!node || node.remaining <= 0) return 0;
    const amount = Math.min(requested, node.remaining);
    node.remaining -= amount;
    return amount;
  }

  remainingAt(resourceId: string, x: number, z: number, width: number, depth: number): number | null {
    return this.nodeAt(resourceId, x, z, width, depth)?.remaining ?? null;
  }

  reset(): void {
    for (const node of this.nodes.values()) node.remaining = node.capacity;
  }

  snapshots(): readonly ResourceNodeSnapshot[] {
    return [...this.nodes.values()]
      .map(({ definition, capacity, remaining }) => ({ ...definition, capacity, remaining, depleted: remaining <= 0 }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private nodeAt(resourceId: string, x: number, z: number, width: number, depth: number): ResourceNodeRecord | null {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    for (const node of this.nodes.values()) {
      if (node.definition.resourceId !== resourceId) continue;
      if (node.definition.x < x - halfWidth || node.definition.x > x + halfWidth
        || node.definition.z < z - halfDepth || node.definition.z > z + halfDepth) continue;
      return node;
    }
    return null;
  }
}

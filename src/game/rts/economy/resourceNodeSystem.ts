/**
 * Finite Faz 6 deposits. A quarry or mine must cover one matching node; its
 * workers draw material from that shared world state rather than creating an
 * unlimited private buffer. The class has no renderer dependency so both the
 * player and headless AI use exactly the same depletion rule.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { ResourceBalance } from "../../data/gameDataTypes";

/**
 * Half-extent of the road-free reserve around a live deposit, in world units.
 *
 * Must stay *below* half a road cell (`roads.json` cellSize / 2 = 1) so the
 * reserve covers the deposit's own road tile and nothing more. That single tile
 * is the whole point: an extractor footprint has to contain the deposit point
 * ({@link ResourceNodeSystem.canExtractAt}), and roads reserve build space, so a
 * road paved *on* the deposit rules out every legal extractor centre at once and
 * kills the deposit for the rest of the match. Reserving wider would be worse
 * than the bug — a road kept 3+ cells away can no longer touch the extractor's
 * footprint, and the mine is built but permanently `unlinked-road`.
 */
export const RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT = 0.8;

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

  /**
   * Road-space reserve for every deposit that still has material in it, mirroring
   * {@link ForestSystem.liveTreeBlockers}: a route bends around the yield rather
   * than paving over it. Deposits stay out of the *building* blocker list — a
   * quarry is supposed to sit on one — and out of unit navigation, which is why
   * this is its own query rather than a nav blocker.
   *
   * A depleted deposit stops reserving, exactly as a felled tree does: there is
   * no extractor left to place, so the ground goes back to being ordinary ground.
   */
  liveNodeBlockers(): readonly NavBlocker[] {
    const blockers: NavBlocker[] = [];
    for (const node of this.nodes.values()) {
      if (node.remaining <= 0) continue;
      const { x, z } = node.definition;
      blockers.push({
        min: [x - RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT, 0, z - RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT],
        max: [x + RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT, 3, z + RTS_RESOURCE_NODE_BLOCK_HALF_EXTENT],
      });
    }
    return blockers;
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

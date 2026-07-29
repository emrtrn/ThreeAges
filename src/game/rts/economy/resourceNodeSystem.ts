/**
 * Finite Faz 6 deposits. A quarry or mine is built *beside* a matching deposit
 * and works it from there; its workers draw material from that shared world
 * state rather than creating an unlimited private buffer. The class has no
 * renderer dependency so both the player and headless AI use exactly the same
 * depletion rule.
 *
 * The "beside, never on top" rule is the forest rule
 * ({@link ForestSystem.hasLiveTreeNear}), and for the same reason: the deposit
 * mesh shrinks through its stages as it is worked, and a building parked on top
 * of it hides the one signal that tells the player the yield is running out.
 * Extraction is therefore a radius query that *excludes* the extractor's own
 * footprint, and every live deposit reserves its ground against all placement.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { ResourceBalance } from "../../data/gameDataTypes";

/**
 * Half-extent of the square a live deposit reserves against roads and building
 * placement, in world units.
 *
 * Matched to {@link RTS_TREE_BLOCK_HALF_EXTENT}: sized just under the rendered
 * deposit so a footprint can abut it without ever sitting on it. Paving or
 * building over a deposit would bury a source that nothing demolishes, retiring
 * it for the rest of the match — and hide its depletion stages while doing so.
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

/** The extractor footprint a deposit must stay clear of to be workable. */
export interface ResourceNodeSearchArea {
  readonly width: number;
  readonly depth: number;
}

/** A source is worked from beside it, within reach and outside the footprint. */
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

  /** A matching, non-depleted source is within reach of this extractor. */
  canExtractAt(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint?: ResourceNodeSearchArea,
  ): boolean {
    return (this.nearestLiveNode(resourceId, x, z, radius, footprint)?.remaining ?? 0) > 0;
  }

  /**
   * Draw up to `requested` material from the nearest reachable source, returning
   * zero when there is none left in range. Nearest-first so a mine standing
   * between two deposits works one out before starting on the next, which is
   * what the shrinking deposit meshes lead the player to expect.
   */
  extract(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint: ResourceNodeSearchArea | undefined,
    requested: number,
  ): number {
    if (!Number.isFinite(requested) || requested < 0) {
      throw new RangeError("Requested resource extraction must be a non-negative finite number");
    }
    const node = this.nearestLiveNode(resourceId, x, z, radius, footprint);
    if (!node || node.remaining <= 0) return 0;
    const amount = Math.min(requested, node.remaining);
    node.remaining -= amount;
    return amount;
  }

  /**
   * Total material still reachable from this point, or null when no matching
   * deposit is in range at all.
   *
   * The sum, not the nearest deposit's share: a mine beside three deposits is
   * not "depleted" because it just finished the closest one, and the status it
   * reports has to say which of those two it is.
   */
  remainingAt(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint?: ResourceNodeSearchArea,
  ): number | null {
    const nodes = this.nodesNear(resourceId, x, z, radius, footprint);
    if (nodes.length === 0) return null;
    return nodes.reduce((total, node) => total + node.remaining, 0);
  }

  /**
   * The nearest deposit with material left that an extractor at this point can
   * send a worker to, or null when none is in reach.
   *
   * Unlike {@link ForestSystem.reserveNearest} there is no per-worker claim: a
   * tree is one trunk and two lumberjacks would stand inside each other, while a
   * deposit is a pile several miners can work at once. Capacity is limited by the
   * extractor's `workerCapacity`, which is where that limit belongs.
   */
  nearestLiveNodeNear(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint?: ResourceNodeSearchArea,
  ): ResourceNodeSnapshot | null {
    const node = this.nearestLiveNode(resourceId, x, z, radius, footprint);
    return node ? this.snapshot(node) : null;
  }

  /**
   * Draw from one named deposit — the one a worker is actually kneeling at,
   * rather than whichever happens to be nearest to its building. Returns zero
   * for an unknown or spent deposit, which is the caller's cue to send the
   * worker home and look for another.
   */
  extractFrom(nodeId: string, requested: number): number {
    if (!Number.isFinite(requested) || requested < 0) {
      throw new RangeError("Requested resource extraction must be a non-negative finite number");
    }
    const node = this.nodes.get(nodeId);
    if (!node || node.remaining <= 0) return 0;
    const amount = Math.min(requested, node.remaining);
    node.remaining -= amount;
    return amount;
  }

  reset(): void {
    for (const node of this.nodes.values()) node.remaining = node.capacity;
  }

  /**
   * Build- and road-space reserve for every deposit that still has material in
   * it, mirroring {@link ForestSystem.liveTreeBlockers}: a route bends around
   * the yield, and a building goes beside it rather than on it. That covers the
   * "only its own extractor may claim this ground" rule without a second rule —
   * nothing is built on a deposit, so nothing can bury one, and the mine that
   * works it stands alongside where the shrinking deposit stays in view.
   *
   * Deposits stay out of *unit* navigation, which is why this is its own query
   * rather than a nav blocker: workers still walk up to what they are mining.
   *
   * A depleted deposit stops reserving, exactly as a felled tree does: there is
   * nothing left to protect, so the ground goes back to being ordinary ground.
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
      .map((node) => this.snapshot(node))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private snapshot({ definition, capacity, remaining }: ResourceNodeRecord): ResourceNodeSnapshot {
    return { ...definition, capacity, remaining, depleted: remaining <= 0 };
  }

  /** Every matching deposit in reach, spent ones included, ordered nearest first. */
  private nodesNear(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint?: ResourceNodeSearchArea,
  ): ResourceNodeRecord[] {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError("Resource node search radius must be non-negative and finite");
    }
    return [...this.nodes.values()]
      .filter((node) => node.definition.resourceId === resourceId
        && this.distanceSquared(node, x, z) <= radius * radius
        && this.outsideFootprint(node, x, z, footprint))
      .sort((left, right) => this.distanceSquared(left, x, z) - this.distanceSquared(right, x, z));
  }

  private nearestLiveNode(
    resourceId: string,
    x: number,
    z: number,
    radius: number,
    footprint?: ResourceNodeSearchArea,
  ): ResourceNodeRecord | null {
    return this.nodesNear(resourceId, x, z, radius, footprint).find((node) => node.remaining > 0) ?? null;
  }

  private distanceSquared(node: ResourceNodeRecord, x: number, z: number): number {
    const dx = node.definition.x - x;
    const dz = node.definition.z - z;
    return dx * dx + dz * dz;
  }

  /**
   * Extractors are built beside deposits; one buried under the footprint has no
   * work point and, worse, no visible depletion — the same rule
   * {@link ForestSystem.outsideFootprint} applies to trees. Placement already
   * refuses such a site ({@link liveNodeBlockers}); this keeps the extraction
   * query honest if one ever slips through.
   */
  private outsideFootprint(
    node: ResourceNodeRecord,
    x: number,
    z: number,
    footprint: ResourceNodeSearchArea | undefined,
  ): boolean {
    if (!footprint) return true;
    const { x: nodeX, z: nodeZ } = node.definition;
    return nodeX < x - footprint.width / 2 || nodeX > x + footprint.width / 2
      || nodeZ < z - footprint.depth / 2 || nodeZ > z + footprint.depth / 2;
  }
}

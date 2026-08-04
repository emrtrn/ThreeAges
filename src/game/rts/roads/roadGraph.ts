/**
 * Cell-backed road network, deliberately separate from RTS unit navigation.
 * It owns logistics connectivity only; visual placement arrives in the next
 * Phase 4 slice.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";

import type { RoadBalance } from "../../data/gameDataTypes";
import { RTS_WORLD_HALF_EXTENT } from "../world/rtsGround";

export interface RoadCell {
  readonly x: number;
  readonly z: number;
}

export type RoadDirection = "north" | "east" | "south" | "west";

export type RoadSegmentKind = "end" | "straight" | "corner" | "t-junction" | "cross";

export interface RoadSegment extends RoadCell {
  readonly kind: RoadSegmentKind;
  /** Cardinal exits used by the renderer to shape this road tile. */
  readonly connections: readonly RoadDirection[];
}

export interface RoadPlan {
  readonly cells: readonly RoadCell[];
  readonly newCells: readonly RoadCell[];
  readonly woodCost: number;
}

export interface RoadComponent {
  readonly id: number;
  readonly cells: readonly RoadCell[];
}

interface RoadNode extends RoadCell {
  readonly key: string;
}

/** Mutable, event-driven graph of completed road cells. */
export class RoadGraph {
  private readonly cells = new Map<string, RoadCell>();
  private revision = 0;

  constructor(private readonly balance: RoadBalance) {}

  get cellSize(): number {
    return this.balance.cellSize;
  }

  /** The short access-road reach, reused as the local no-caravan logistics radius. */
  get autoConnectMaximumDistance(): number {
    return (this.balance.autoConnect?.maxCells ?? 0) * this.balance.cellSize;
  }

  /** Increments only when committed topology changes, for event-style views. */
  get version(): number {
    return this.revision;
  }

  /** Resolve a ground point to the road grid without exposing the grid math to a view. */
  snapCell(point: RoadCell): RoadCell {
    return this.snap(point);
  }

  /** Preview the shortest valid orthogonal route and charge only new cells. */
  plan(start: RoadCell, end: RoadCell, blockers: readonly NavBlocker[]): RoadPlan | null {
    const source = this.snap(start);
    const goal = this.snap(end);
    if (!this.isInside(source) || !this.isInside(goal) || this.isBlocked(source, blockers) || this.isBlocked(goal, blockers)) {
      return null;
    }
    const route = this.shortestRoute(source, goal, blockers);
    if (!route) return null;
    const newCells = route.filter((cell) => !this.cells.has(this.key(cell)));
    return { cells: route, newCells, woodCost: newCells.length * this.balance.woodCostPerCell };
  }

  /** Commit a previewed plan. Existing cells are idempotent and remain free. */
  commit(plan: RoadPlan): void {
    let changed = false;
    for (const cell of plan.cells) {
      const snapped = this.snap(cell);
      if (!this.cells.has(this.key(snapped))) changed = true;
      this.cells.set(this.key(snapped), snapped);
    }
    if (changed) this.revision += 1;
  }

  clear(): void {
    if (this.cells.size > 0) this.revision += 1;
    this.cells.clear();
  }

  /** Remove selected road tiles (combat/destruction hook); returns removed count. */
  remove(cells: readonly RoadCell[]): number {
    let removed = 0;
    for (const cell of cells) {
      if (this.cells.delete(this.key(this.snap(cell)))) removed += 1;
    }
    if (removed > 0) this.revision += 1;
    return removed;
  }

  all(): readonly RoadSegment[] {
    return [...this.cells.values()]
      .map((cell) => {
        const connections = this.connections(cell);
        return { ...cell, kind: this.segmentKind(connections), connections };
      })
      .sort((a, b) => a.x - b.x || a.z - b.z);
  }

  /** Roads reserve build space while remaining walkable for units. */
  occupancyBlockers(): readonly NavBlocker[] {
    const half = this.balance.cellSize / 2;
    return [...this.cells.values()].map((cell) => ({
      min: [cell.x - half, 0, cell.z - half],
      max: [cell.x + half, 3, cell.z + half],
    }));
  }

  /**
   * The committed cell a world point falls in, or null when that tile is bare.
   * The erase tool's pick: it turns a ground ray into the exact tile `remove`
   * takes, so the pointer layer never has to know the grid measure.
   */
  cellAt(point: RoadCell): RoadCell | null {
    return this.cells.get(this.key(this.snap(point))) ?? null;
  }

  /**
   * Would removing this cell split the network it sits in? (GDD 10 §44: "Yol
   * silme işleminde bağlantı etkisi önceden gösterilir".)
   *
   * True when two of the cell's road neighbours can no longer reach each other
   * without it — a bridge tile. False for a dead end (nothing behind it to cut
   * off) and false for a tile inside a loop, where the network closes around the
   * gap. The query is pure: the cell is skipped during the walk rather than
   * removed, so a hover preview costs the caller nothing.
   */
  wouldDisconnect(cell: RoadCell): boolean {
    const target = this.snap(cell);
    const targetKey = this.key(target);
    if (!this.cells.has(targetKey)) return false;
    const neighbors = this.neighbors(target).filter((neighbor) => this.cells.has(this.key(neighbor)));
    const first = neighbors[0];
    if (!first || neighbors.length < 2) return false;
    // Seeding `visited` with the target is what stands in for removing it.
    const visited = new Set<string>([targetKey, this.key(first)]);
    const queue = [first];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) continue;
      for (const neighbor of this.neighbors(current)) {
        const key = this.key(neighbor);
        if (!this.cells.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }
    return neighbors.some((neighbor) => !visited.has(this.key(neighbor)));
  }

  /** True if two road cells share any connected component, including loops. */
  connected(a: RoadCell, b: RoadCell): boolean {
    const start = this.snap(a);
    const goalKey = this.key(this.snap(b));
    const startKey = this.key(start);
    if (!this.cells.has(startKey) || !this.cells.has(goalKey)) return false;
    const visited = new Set<string>([startKey]);
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) continue;
      if (this.key(current) === goalKey) return true;
      for (const neighbor of this.neighbors(current)) {
        const key = this.key(neighbor);
        if (!this.cells.has(key) || visited.has(key)) continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }
    return false;
  }

  /**
   * Shortest deterministic route through completed road cells only.
   *
   * Unlike {@link plan}, this never crosses bare ground or considers build
   * blockers. It is a read-only query for systems that travel on the road
   * network itself, such as a logistics caravan.
   */
  route(from: RoadCell, to: RoadCell): readonly RoadCell[] | null {
    const start = this.snap(from);
    const goal = this.snap(to);
    const startKey = this.key(start);
    const goalKey = this.key(goal);
    if (!this.cells.has(startKey) || !this.cells.has(goalKey)) return null;

    const frontier = [this.node(start)];
    const cameFrom = new Map<string, string | null>([[startKey, null]]);
    for (let index = 0; index < frontier.length; index += 1) {
      const current = frontier[index];
      if (!current) continue;
      if (current.key === goalKey) return this.reconstruct(cameFrom, goalKey);
      // `neighbors` has a fixed cardinal order. FIFO traversal therefore keeps
      // equal-length alternatives stable while still guaranteeing a shortest
      // path over the committed, unweighted road graph.
      for (const neighbor of this.neighbors(current)) {
        const node = this.node(neighbor);
        if (!this.cells.has(node.key) || cameFrom.has(node.key)) continue;
        cameFrom.set(node.key, current.key);
        frontier.push(node);
      }
    }
    return null;
  }

  /** Connected road islands, deterministically ordered for debug and logistics. */
  components(): readonly RoadComponent[] {
    const unvisited = new Set(this.cells.keys());
    const components: RoadComponent[] = [];
    while (unvisited.size > 0) {
      const startKey = [...unvisited].sort()[0];
      if (!startKey) break;
      const start = this.cells.get(startKey);
      if (!start) {
        unvisited.delete(startKey);
        continue;
      }
      const cells: RoadCell[] = [];
      const queue = [start];
      unvisited.delete(startKey);
      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        if (!current) continue;
        cells.push(current);
        for (const neighbor of this.neighbors(current)) {
          const key = this.key(neighbor);
          const next = this.cells.get(key);
          if (!next || !unvisited.delete(key)) continue;
          queue.push(next);
        }
      }
      components.push({
        id: components.length + 1,
        cells: cells.sort((a, b) => a.x - b.x || a.z - b.z),
      });
    }
    return components;
  }

  /** Undirected cardinal edges; each shared road boundary counts once. */
  edgeCount(): number {
    let count = 0;
    for (const cell of this.cells.values()) {
      if (this.cells.has(this.key({ x: cell.x + this.balance.cellSize, z: cell.z }))) count += 1;
      if (this.cells.has(this.key({ x: cell.x, z: cell.z + this.balance.cellSize }))) count += 1;
    }
    return count;
  }

  private shortestRoute(start: RoadCell, goal: RoadCell, blockers: readonly NavBlocker[]): RoadCell[] | null {
    const startNode = this.node(start);
    const goalKey = this.key(goal);
    const frontier: RoadNode[] = [startNode];
    const cameFrom = new Map<string, string | null>([[startNode.key, null]]);
    while (frontier.length > 0) {
      frontier.sort((a, b) => this.distance(a, goal) - this.distance(b, goal) || a.key.localeCompare(b.key));
      const current = frontier.shift();
      if (!current) break;
      if (current.key === goalKey) return this.reconstruct(cameFrom, current.key);
      for (const neighbor of this.neighbors(current)) {
        const node = this.node(neighbor);
        if (!this.isInside(node) || this.isBlocked(node, blockers) || cameFrom.has(node.key)) continue;
        cameFrom.set(node.key, current.key);
        frontier.push(node);
      }
    }
    return null;
  }

  private reconstruct(cameFrom: ReadonlyMap<string, string | null>, goalKey: string): RoadCell[] {
    const path: RoadCell[] = [];
    let key: string | null = goalKey;
    while (key !== null) {
      const values = key.split(":").map(Number);
      const x = values[0];
      const z = values[1];
      if (x === undefined || z === undefined || !Number.isFinite(x) || !Number.isFinite(z)) {
        throw new Error("Invalid road graph key");
      }
      path.push({ x, z });
      key = cameFrom.get(key) ?? null;
    }
    return path.reverse();
  }

  private connections(cell: RoadCell): RoadDirection[] {
    return this.neighbors(cell)
      .filter((neighbor) => this.cells.has(this.key(neighbor)))
      .map((neighbor) => this.directionFrom(cell, neighbor));
  }

  private segmentKind(connections: readonly RoadDirection[]): RoadSegmentKind {
    if (connections.length >= 4) return "cross";
    if (connections.length === 3) return "t-junction";
    if (connections.length <= 1) return "end";
    return (connections.includes("east") && connections.includes("west"))
      || (connections.includes("north") && connections.includes("south"))
      ? "straight"
      : "corner";
  }

  private neighbors(cell: RoadCell): RoadCell[] {
    const step = this.balance.cellSize;
    return [
      { x: cell.x + step, z: cell.z },
      { x: cell.x - step, z: cell.z },
      { x: cell.x, z: cell.z + step },
      { x: cell.x, z: cell.z - step },
    ];
  }

  private directionFrom(cell: RoadCell, neighbor: RoadCell): RoadDirection {
    if (neighbor.x > cell.x) return "east";
    if (neighbor.x < cell.x) return "west";
    return neighbor.z > cell.z ? "south" : "north";
  }

  private isBlocked(cell: RoadCell, blockers: readonly NavBlocker[]): boolean {
    const half = this.balance.cellSize / 2;
    return blockers.some((blocker) => cell.x + half > blocker.min[0] && cell.x - half < blocker.max[0]
      && cell.z + half > blocker.min[2] && cell.z - half < blocker.max[2]);
  }

  private isInside(cell: RoadCell): boolean {
    const half = this.balance.cellSize / 2;
    return cell.x - half >= -RTS_WORLD_HALF_EXTENT && cell.x + half <= RTS_WORLD_HALF_EXTENT
      && cell.z - half >= -RTS_WORLD_HALF_EXTENT && cell.z + half <= RTS_WORLD_HALF_EXTENT;
  }

  private snap(cell: RoadCell): RoadCell {
    const step = this.balance.cellSize;
    return { x: Math.round(cell.x / step) * step, z: Math.round(cell.z / step) * step };
  }

  private node(cell: RoadCell): RoadNode {
    const snapped = this.snap(cell);
    return { ...snapped, key: this.key(snapped) };
  }

  private key(cell: RoadCell): string {
    return `${cell.x}:${cell.z}`;
  }

  private distance(a: RoadCell, b: RoadCell): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }
}

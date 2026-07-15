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

export type RoadSegmentKind = "end" | "straight" | "corner" | "t-junction" | "cross";

export interface RoadSegment extends RoadCell {
  readonly kind: RoadSegmentKind;
}

export interface RoadPlan {
  readonly cells: readonly RoadCell[];
  readonly newCells: readonly RoadCell[];
  readonly woodCost: number;
}

interface RoadNode extends RoadCell {
  readonly key: string;
}

/** Mutable, event-driven graph of completed road cells. */
export class RoadGraph {
  private readonly cells = new Map<string, RoadCell>();

  constructor(private readonly balance: RoadBalance) {}

  get cellSize(): number {
    return this.balance.cellSize;
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
    for (const cell of plan.cells) {
      const snapped = this.snap(cell);
      this.cells.set(this.key(snapped), snapped);
    }
  }

  clear(): void {
    this.cells.clear();
  }

  all(): readonly RoadSegment[] {
    return [...this.cells.values()]
      .map((cell) => ({ ...cell, kind: this.segmentKind(cell) }))
      .sort((a, b) => a.x - b.x || a.z - b.z);
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

  private segmentKind(cell: RoadCell): RoadSegmentKind {
    const neighbors = this.neighbors(cell).filter((neighbor) => this.cells.has(this.key(neighbor)));
    if (neighbors.length >= 4) return "cross";
    if (neighbors.length === 3) return "t-junction";
    if (neighbors.length <= 1) return "end";
    return neighbors[0]?.x === neighbors[1]?.x || neighbors[0]?.z === neighbors[1]?.z ? "straight" : "corner";
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

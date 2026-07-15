/**
 * RTS ground navigation — Vertical Slice Plan v0.2 §21 / TD-006.
 *
 * Adapts Forge's reusable grid navigation to the small Phase 1 RTS field.
 * The grid is cached until the blocker set changes. The field starts obstacle
 * free; building placement supplies blockers through `setBlockers` in Faz 2.
 */
import { NavGridCache, searchNavGrid, type NavBlocker } from "@engine/navigation/gridNavigation";
import { Vector3 } from "three";

import { UNIT_RADIUS } from "../units/unit";
import { RTS_WORLD_HALF_EXTENT } from "../world/rtsGround";

const UNIT_HEIGHT = 2;
const CELL_SIZE = 1;
const NAV_BOUNDS = [{
  min: [-RTS_WORLD_HALF_EXTENT, -1, -RTS_WORLD_HALF_EXTENT],
  max: [RTS_WORLD_HALF_EXTENT, UNIT_HEIGHT + 1, RTS_WORLD_HALF_EXTENT],
}] as const;

/** Plans and caches paths for the Phase 1 infantry placeholder. */
export class RtsNavigation {
  private readonly gridCache = new NavGridCache();
  private blockers: readonly NavBlocker[] = [];
  private revision = 0;

  /** Replace static blockers and invalidate the cached nav grid. */
  setBlockers(blockers: readonly NavBlocker[]): void {
    this.blockers = blockers;
    this.revision += 1;
  }

  /**
   * Return a waypoint path, including the exact start/goal, or null when the
   * destination cannot be reached within the current ground bounds.
   */
  plan(start: Vector3, goal: Vector3): Vector3[] | null {
    const grid = this.gridCache.getOrBuild(`rts:${this.revision}`, {
      agent: { radius: UNIT_RADIUS, height: UNIT_HEIGHT },
      blockers: this.blockers,
      bounds: NAV_BOUNDS,
      footY: 0,
      cellSize: CELL_SIZE,
      safetyMargin: 0,
    });
    if (!grid) return null;
    const result = searchNavGrid(
      grid,
      [start.x, 0, start.z],
      [goal.x, 0, goal.z],
    );
    return result.status === "success"
      ? result.points.map(([x, y, z]) => new Vector3(x, y, z))
      : null;
  }
}

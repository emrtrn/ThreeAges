/**
 * RTS ground navigation — Vertical Slice Plan v0.2 §21 / TD-006.
 *
 * Adapts Forge's reusable grid navigation to the small Phase 1 RTS field.
 * The grid is cached until the blocker set changes. The field starts obstacle
 * free; building placement supplies blockers through `setBlockers` in Faz 2.
 */
import { NavGridCache, searchNavGrid, type NavBlocker, type NavGrid } from "@engine/navigation/gridNavigation";
import { Vector3 } from "three";

import { UNIT_RADIUS } from "../units/unit";
import { RTS_WORLD_HALF_EXTENT } from "../world/rtsGround";
import { combatDistance, type CombatTarget } from "../combat/combatTarget";

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
   *
   * Every role plans on the one infantry grid, including the wider Ram. That is
   * a resolution decision, not an oversight: the cell is 1 world unit and the
   * whole roster's radii span 0.39–0.75, so a per-agent grid could not express a
   * gap that admits a Guard and refuses a Ram — it would only cost a second
   * 14k-cell bake per blocker change to return the same answer. The Ram's width
   * is enforced where it is expressible instead: `unitSeparation` spaces bodies
   * by {@link Unit.navRadius}. Revisit if the cell size ever drops (which needs
   * the engine's `MAX_GRID_CELLS` raised first).
   */
  plan(start: Vector3, goal: Vector3): Vector3[] | null {
    const grid = this.grid();
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

  /**
   * Whether a unit may stand on a ground point. Crowd separation uses this to
   * veto a shove that would push a body inside a ridge or off the map: the grid,
   * not the pusher, stays the authority on where a unit is allowed to be.
   */
  isWalkable(x: number, z: number): boolean {
    const grid = this.grid();
    if (!grid) return false;
    const col = Math.round((x - grid.originX) / grid.cellSize);
    const row = Math.round((z - grid.originZ) / grid.cellSize);
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
    return grid.passable[row * grid.cols + col] === 1;
  }

  /**
   * The nearest ground point a unit may legally stand on, searched outward in
   * rings from (x, z). Returns the point itself when it is already walkable, or
   * null when no clear ground exists within `maxRadius`.
   *
   * This is how a unit caught inside a freshly placed footprint is dug back out:
   * the cell it stands on is unwalkable, so ordinary planning cannot even start
   * there, but clear ground is almost always a few cells away.
   */
  nearestWalkable(x: number, z: number, maxRadius = 12): Vector3 | null {
    if (this.isWalkable(x, z)) return new Vector3(x, 0, z);
    const directions = 24;
    for (let radius = CELL_SIZE; radius <= maxRadius; radius += CELL_SIZE) {
      for (let i = 0; i < directions; i += 1) {
        const angle = (i / directions) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        if (this.isWalkable(px, pz)) return new Vector3(px, 0, pz);
      }
    }
    return null;
  }

  /** The single baked grid, rebuilt only when the blocker set changes. */
  private grid(): NavGrid | null {
    return this.gridCache.getOrBuild(`rts:${this.revision}`, {
      agent: { radius: UNIT_RADIUS, height: UNIT_HEIGHT },
      blockers: this.blockers,
      bounds: NAV_BOUNDS,
      footY: 0,
      cellSize: CELL_SIZE,
      safetyMargin: 0,
    });
  }

  /**
   * Plan to an attackable edge around a live target. In particular, command
   * centres are solid navigation blockers, so their centre can never be a
   * valid walking goal. The closest perimeter point preserves the attacker's
   * current flank; the grid then finds the required detour around obstacles.
   */
  planAttack(start: Vector3, target: CombatTarget, attackRange: number): Vector3[] | null {
    if (combatDistance(start, target) <= attackRange) return [];
    const radius = target.combatRadius === undefined
      ? Math.max(UNIT_RADIUS * 2, attackRange * 0.85)
      : target.combatRadius + attackRange * 0.9;
    const startAngle = Math.atan2(start.z - target.position.z, start.x - target.position.x);
    const goal = new Vector3(
      target.position.x + Math.cos(startAngle) * radius,
      0,
      target.position.z + Math.sin(startAngle) * radius,
    );
    return this.plan(start, goal);
  }
}

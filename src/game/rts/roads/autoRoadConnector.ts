/**
 * Auto-built access road (Option A — "stub" connection).
 *
 * When a building lands a little short of an existing road, its footprint no
 * longer *touches* a road cell, so the logistics snapshots
 * ({@link ProductionLogisticsSystem}, {@link DepotLogisticsSystem}) read it as
 * `unlinked-road` even though a road is right there. Rather than make the player
 * hand-draw the last couple of tiles — the fiddly step that "bazen sorun
 * çıkarıyor" — the building pays for its own short access road, folded into its
 * price, connecting it to the nearest network on placement.
 *
 * This module is pure and headless: it plans, it does not commit. The caller
 * (RtsApp) commits the returned plan for free through
 * {@link RoadConstructionService.commitFree}. Kept free of three.js so it runs
 * under the engine test harness.
 */
import { roadCellTouchingFootprint } from "../economy/depotLogisticsSystem";
import type { RoadCell, RoadGraph, RoadPlan } from "./roadGraph";

export interface AutoRoadFootprint {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

export interface AutoRoadOptions {
  /** Reject a connection needing more than this many new road cells (range cap). */
  readonly maxNewCells: number;
}

/**
 * Plan a short access road from a placed footprint to the nearest existing road
 * network, or return null when none should be built:
 *  - `maxNewCells <= 0`  — the feature is switched off in data,
 *  - the graph is empty  — there is no network to reach yet,
 *  - a road already touches the footprint — it is placed on the network, or
 *  - the nearest network is farther than `maxNewCells` new cells — the building
 *    is genuinely off-grid and gets no free highway.
 *
 * The chosen route starts on a grid cell that *touches* the footprint, so once
 * committed `roadCellTouchingFootprint` resolves the building as linked, which
 * is the exact contract the logistics systems read.
 *
 * @param plan Router that costs a route between two cells (usually
 *   `RoadConstructionService.plan`), so this stays independent of the graph's
 *   blocker wiring and is trivially fakeable in tests.
 */
export function planAutoRoadConnection(
  roads: RoadGraph,
  footprint: AutoRoadFootprint,
  plan: (start: RoadCell, end: RoadCell) => RoadPlan | null,
  options: AutoRoadOptions,
): RoadPlan | null {
  if (options.maxNewCells <= 0) return null;
  // Already touching the network: the adjacent placement that has always worked
  // needs no help, and drawing a zero-length road would only churn the graph.
  if (roadCellTouchingFootprint(roads, footprint.x, footprint.z, footprint.width, footprint.depth)) {
    return null;
  }
  const target = nearestRoadCell(roads, footprint);
  if (!target) return null;
  const existing = new Set(roads.all().map((cell) => key(cell)));
  // Preferred shape: a straight stem out of the centre of the face pointing at
  // the road, so the road meets the building head-on (see centredStemPlan).
  const centred = centredStemPlan(roads, footprint, target, plan, existing, options.maxNewCells);
  if (centred) return centred;
  // Fallback for a boxed-in face (a tree or building right behind it): the
  // nearest feasible touching anchor, still ordered centred-first, routed freely.
  for (const anchor of perimeterAnchors(roads, footprint, target)) {
    const candidate = plan(anchor, target);
    if (candidate && candidate.newCells.length <= options.maxNewCells) return candidate;
  }
  return null;
}

/**
 * Build the access road as a straight stem leaving the centre of the face that
 * points at the road, then let the router bend the *far* end toward the target.
 *
 * The building tile that ends up touching the footprint is the stem's root, so
 * it lands on the face's centre axis rather than wherever a free A* happened to
 * clip the perimeter — that off-centre clip is exactly what the earlier greedy
 * version produced. Forcing the first step straight out (root → stemTip) also
 * keeps the router from re-entering the "touching row" sideways, so no second,
 * off-centre tile touches the building either.
 */
function centredStemPlan(
  roads: RoadGraph,
  footprint: AutoRoadFootprint,
  target: RoadCell,
  plan: (start: RoadCell, end: RoadCell) => RoadPlan | null,
  existing: ReadonlySet<string>,
  maxNewCells: number,
): RoadPlan | null {
  const step = roads.cellSize;
  const halfRoad = step / 2;
  const alongZ = Math.abs(target.z - footprint.z) >= Math.abs(target.x - footprint.x);
  const root = alongZ
    ? { x: snap(footprint.x, step), z: faceLine(footprint.z, footprint.depth, target.z, halfRoad, step) }
    : { x: faceLine(footprint.x, footprint.width, target.x, halfRoad, step), z: snap(footprint.z, step) };
  // Snapping an odd-sized centre can nudge the root just off the touch tolerance;
  // if so this shape does not apply and the caller falls back.
  if (!touchesFootprint(root, footprint, halfRoad)) return null;
  // A blocked or off-map root cannot anchor a road; single-cell plan validates it.
  if (!plan(root, root)) return null;
  const outward = alongZ
    ? { x: root.x, z: root.z + Math.sign(target.z - footprint.z) * step }
    : { x: root.x + Math.sign(target.x - footprint.x) * step, z: root.z };
  const tail = plan(outward, target);
  if (!tail) return null;
  const cells = [root, ...tail.cells];
  const newCells = cells.filter((cell) => !existing.has(key(cell)));
  if (newCells.length > maxNewCells) return null;
  return { cells, newCells, woodCost: 0 };
}

/** The grid line one road tile outside a footprint face on the side of `toward`. */
function faceLine(centre: number, size: number, toward: number, halfRoad: number, step: number): number {
  const sign = Math.sign(toward - centre) || 1;
  return snap(centre + sign * (size / 2 + halfRoad), step);
}

function touchesFootprint(cell: RoadCell, footprint: AutoRoadFootprint, halfRoad: number): boolean {
  return Math.hypot(
    Math.max(0, Math.abs(cell.x - footprint.x) - footprint.width / 2 - halfRoad),
    Math.max(0, Math.abs(cell.z - footprint.z) - footprint.depth / 2 - halfRoad),
  ) <= halfRoad;
}

function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function key(cell: RoadCell): string {
  return `${cell.x}:${cell.z}`;
}

/** Nearest existing road tile by edge-distance to the footprint, or null when none. */
function nearestRoadCell(roads: RoadGraph, footprint: AutoRoadFootprint): RoadCell | null {
  const halfWidth = footprint.width / 2;
  const halfDepth = footprint.depth / 2;
  let best: RoadCell | null = null;
  let bestDistance = Infinity;
  for (const cell of roads.all()) {
    const distance = Math.hypot(
      Math.max(0, Math.abs(cell.x - footprint.x) - halfWidth),
      Math.max(0, Math.abs(cell.z - footprint.z) - halfDepth),
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: cell.x, z: cell.z };
    }
  }
  return best;
}

/**
 * Grid cells that would *touch* the footprint by the same half-road tolerance
 * {@link roadCellTouchingFootprint} uses.
 *
 * Ordered centred-first: an anchor sitting on one of the footprint's centre axes
 * (`x ≈ centre.x` or `z ≈ centre.z`) reads as the road meeting the building
 * head-on, which is what a face-centred connection looks like. `min(|dx|, |dz|)`
 * is zero exactly on a face centre and grows toward the corners, so it ranks the
 * arms of a plus-sign ahead of its diagonals. Ties break toward the target so the
 * chosen centre is the one on the side the road is actually on. Cells that fall
 * inside the footprint are harmless — the router rejects them as blocked.
 */
function perimeterAnchors(roads: RoadGraph, footprint: AutoRoadFootprint, target: RoadCell): RoadCell[] {
  const step = roads.cellSize;
  const halfRoad = step / 2;
  const halfWidth = footprint.width / 2;
  const halfDepth = footprint.depth / 2;
  const startX = Math.round((footprint.x - halfWidth - step) / step) * step;
  const startZ = Math.round((footprint.z - halfDepth - step) / step) * step;
  const endX = footprint.x + halfWidth + step;
  const endZ = footprint.z + halfDepth + step;
  const anchors: RoadCell[] = [];
  for (let x = startX; x <= endX + 1e-6; x += step) {
    for (let z = startZ; z <= endZ + 1e-6; z += step) {
      const touching = Math.hypot(
        Math.max(0, Math.abs(x - footprint.x) - halfWidth - halfRoad),
        Math.max(0, Math.abs(z - footprint.z) - halfDepth - halfRoad),
      ) <= halfRoad;
      if (touching) anchors.push({ x, z });
    }
  }
  anchors.sort((a, b) =>
    offCentre(a, footprint) - offCentre(b, footprint)
    || manhattan(a, target) - manhattan(b, target)
    || a.x - b.x || a.z - b.z);
  return anchors;
}

/** How far an anchor sits off the footprint's nearest centre axis; 0 on a face centre. */
function offCentre(cell: RoadCell, footprint: AutoRoadFootprint): number {
  return Math.min(Math.abs(cell.x - footprint.x), Math.abs(cell.z - footprint.z));
}

function manhattan(a: RoadCell, b: RoadCell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

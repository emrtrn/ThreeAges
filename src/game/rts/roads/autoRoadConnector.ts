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
import { ROAD_TOUCH_EPSILON, roadCellTouchesFootprint, roadTouchLines } from "./roadFootprintTouch";
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
  const alongZ = Math.abs(target.z - footprint.z) >= Math.abs(target.x - footprint.x);
  const root = alongZ
    ? { x: snap(footprint.x, step), z: faceLine(footprint.z, footprint.depth, target.z, step) }
    : { x: faceLine(footprint.x, footprint.width, target.x, step), z: snap(footprint.z, step) };
  // The cross-axis coordinate is still snapped, so an off-grid centre can push
  // the root off the face; if so this shape does not apply and the caller falls
  // back to the perimeter search.
  if (!roadCellTouchesFootprint(root, footprint, step)) return null;
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
  // The plan is also used by the AI's paid infrastructure builder. Player
  // placement still commits it through `commitFree`, but retaining the router's
  // real new-cell cost lets that caller pay for exactly this spur.
  return { cells, newCells, woodCost: newCells.length * roads.woodCostPerCell };
}

/**
 * The first pavable grid line outside a footprint face, on the side of `toward`.
 *
 * Taken from {@link roadTouchLines} rather than rounded out from the edge: on a
 * grid-aligned face the two agree, and off one `Math.round` picks the wrong side
 * of a .5 (it rounds -1.5 to -1), landing the stem's root inside the footprint
 * where the router refuses it.
 */
function faceLine(centre: number, size: number, toward: number, step: number): number {
  const lines = roadTouchLines(centre, size, step);
  return toward >= centre ? lines.max : lines.min;
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
  // The touch lines *are* the perimeter: every grid cell they bracket either
  // meets the footprint or lies inside it, so there is nothing left to filter.
  const xLines = roadTouchLines(footprint.x, footprint.width, step);
  const zLines = roadTouchLines(footprint.z, footprint.depth, step);
  const anchors: RoadCell[] = [];
  for (let x = xLines.min; x <= xLines.max + ROAD_TOUCH_EPSILON; x += step) {
    for (let z = zLines.min; z <= zLines.max + ROAD_TOUCH_EPSILON; z += step) {
      anchors.push({ x, z });
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

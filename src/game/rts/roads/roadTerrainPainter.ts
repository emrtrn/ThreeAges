/**
 * Painted Roads (plan Faz 2–4): turns the logistics {@link RoadGraph} into a
 * natural dirt path painted onto an authored Landscape's paint layer, instead of
 * the box-mesh tiles. It is a *presentation* mirror — it reads `RoadGraph.all()`
 * and never writes topology, cost or connectivity back.
 *
 * Split in three so the grid→spline conversion and the restore→repaint bookkeeping
 * stay pure (three.js-free, unit-testable), and only {@link RoadTerrainPainter}
 * touches the render object:
 *
 * 1. {@link roadGraphToLandscapeSpline} — pure graph→`ForgeLandscapeSpline`.
 *    Straight runs collapse to one segment; corners/junctions become control
 *    points; long runs gain deterministic perpendicular jitter (Faz 4) so the
 *    grid look breaks. Smooth Catmull-Rom rounds every turn.
 * 2. {@link RoadPaintSurface} — owns the mount-time *pristine* weight snapshot and
 *    applies each network as "restore previous corridor → repaint fresh", so a
 *    removed/rerouted road leaves no residue and hand-painted terrain survives.
 * 3. {@link RoadTerrainPainter} — wires (1)+(2) to a mounted terrain and refreshes
 *    only the dirty chunk geometry, dirty-checked on `RoadGraph.version`.
 *
 * Building ground pads ({@link structurePadsToRectPaints}) ride along here rather
 * than in a painter of their own: a landscape has exactly one pristine snapshot,
 * and two surfaces restoring the same vertices would erase each other's paint.
 * One surface, one repaint — roads and pads simply blend where they overlap.
 */
import type { Vec3 } from "@engine/scene/layout";
import {
  applyLandscapeRectPaint,
  applyLandscapeRectDeform,
  applyLandscapeSplinePaint,
  landscapeGridBoundsForLocalBox,
  splineToPolyline,
  type ForgeLandscapeData,
  type LandscapeRectDeform,
  type ForgeLandscapeSpline,
  type ForgeLandscapeSplinePoint,
  type ForgeLandscapeSplineSegment,
  type LandscapeRectPaint,
  type LandscapeSplineApplyBounds,
} from "@engine/scene/landscape";
import { updateLandscapeObjectGeometry, type LandscapeLayerColors, type LandscapeObject } from "@engine/render-three/landscape";

import type { BuildingPadVisual, RoadVisual } from "../../data/gameDataTypes";
import type { RoadCell, RoadDirection, RoadOwner, RoadSegment } from "./roadGraph";

interface DirStep {
  readonly dx: number;
  readonly dz: number;
}

const DIR_STEP: Record<RoadDirection, DirStep> = {
  east: { dx: 1, dz: 0 },
  west: { dx: -1, dz: 0 },
  south: { dx: 0, dz: 1 },
  north: { dx: 0, dz: -1 },
};

const OPPOSITE: Record<RoadDirection, RoadDirection> = {
  east: "west",
  west: "east",
  north: "south",
  south: "north",
};

/** Inputs that shape the spline corridor; all presentational (never logistics). */
export interface RoadSplineOptions {
  /** Road grid cell width in world units (used to step between neighbours). */
  readonly cellSize: number;
  /** World position of the landscape actor; local = world − origin. */
  readonly origin: Vec3;
  /** Presentational paint tuning (layer, width, falloff, strength, jitter). */
  readonly visual: RoadVisual;
  /**
   * The paint layer a cell takes, by the owner of the ground under it. This is
   * what lets one kingdom's roads reach the Town age's cobblestone while its
   * neighbour's stay dirt: age is a per-kingdom fact, and a road belongs to
   * whoever holds the ground it runs over. Defaults to `visual.layerId` for
   * every owner, which is the single-layer behaviour this had before.
   */
  readonly layerForOwner?: (owner: RoadOwner) => string;
}

/** A degree-2 road cell whose two exits are collinear is an interior straight cell. */
function isStraightThrough(connections: readonly RoadDirection[]): boolean {
  if (connections.length !== 2) return false;
  const hasEW = connections.includes("east") && connections.includes("west");
  const hasNS = connections.includes("north") && connections.includes("south");
  return hasEW || hasNS;
}

/** Deterministic hash of a cell coordinate to `[-1, 1]` (stable across repaints). */
function hashUnit(x: number, z: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h / 0xffffffff) * 2 - 1;
}

/**
 * Converts a committed road network into a paint-only Landscape spline. Pure and
 * three.js-free. The corridor follows `visual`; with `visual.jitter === 0` (and
 * `widthVariation === 0`) it reduces to dead-straight runs — the Faz 3 baseline.
 *
 * Cells are grouped by ground owner and each group is traced on its own, because
 * an owner boundary is a *paint* boundary: two kingdoms in different ages meet
 * mid-corridor and the run has to stop there rather than carry one age's layer
 * across. Tracing per group gets that for free — the neighbour across the border
 * is simply not in the group's lookup, so it reads as the end of the run — and
 * costs nothing when everything shares one owner.
 */
export function roadGraphToLandscapeSpline(
  segments: readonly RoadSegment[],
  options: RoadSplineOptions,
): ForgeLandscapeSpline {
  const { visual } = options;
  const points: ForgeLandscapeSplinePoint[] = [];
  const splineSegments: ForgeLandscapeSplineSegment[] = [];
  const byOwner = new Map<RoadOwner, RoadSegment[]>();
  for (const segment of segments) {
    const group = byOwner.get(segment.owner);
    if (group) group.push(segment);
    else byOwner.set(segment.owner, [segment]);
  }
  // Sorted so the emitted point/segment ids are stable regardless of which
  // kingdom paved first — the paint result is identical either way, but a stable
  // spline keeps the dirty-bounds diffing honest.
  for (const owner of [...byOwner.keys()].sort()) {
    traceOwnerGroup(byOwner.get(owner)!, owner, options, points, splineSegments);
  }

  return {
    id: "rts-roads",
    name: "RTS Roads",
    smooth: true,
    smoothness: visual.cornerRoundness,
    points,
    segments: splineSegments,
  };
}

/** Trace one owner's cells into `points`/`splineSegments`, painting its layer. */
function traceOwnerGroup(
  segments: readonly RoadSegment[],
  owner: RoadOwner,
  options: RoadSplineOptions,
  points: ForgeLandscapeSplinePoint[],
  splineSegments: ForgeLandscapeSplineSegment[],
): void {
  const { cellSize, origin, visual } = options;
  const key = (x: number, z: number): string => `${x}:${z}`;
  const byKey = new Map<string, RoadSegment>();
  for (const segment of segments) byKey.set(key(segment.x, segment.z), segment);

  /** Exits that stay inside this group; a border exit is not a run to follow. */
  const exits = (segment: RoadSegment): readonly RoadDirection[] =>
    segment.connections.filter((dir) => {
      const step = DIR_STEP[dir];
      return byKey.has(key(segment.x + step.dx * cellSize, segment.z + step.dz * cellSize));
    });
  const isControl = (segment: RoadSegment): boolean => !isStraightThrough(exits(segment));

  const pointIdByCell = new Map<string, string>();
  const paint = { enabled: true, layerId: options.layerForOwner?.(owner) ?? visual.layerId, strength: visual.strength };
  const local = (cell: RoadCell): Vec3 => [cell.x - origin[0], 0, cell.z - origin[2]];

  /** Registers (once) a full-width control point for a cell and returns its id. */
  const nodePoint = (cell: RoadCell): string => {
    const cellKey = key(cell.x, cell.z);
    const existing = pointIdByCell.get(cellKey);
    if (existing) return existing;
    const id = `n:${owner}:${cellKey}`;
    pointIdByCell.set(cellKey, id);
    points.push({ id, position: local(cell), width: visual.width, falloff: visual.falloff });
    return id;
  };

  /** Registers an interior jitter point (perpendicular offset + width variation). */
  const jitterPoint = (cell: RoadCell, perp: DirStep): string => {
    const cellKey = key(cell.x, cell.z);
    const id = `j:${owner}:${cellKey}`;
    const offset = hashUnit(cell.x, cell.z, 1) * visual.jitter;
    const widthScale = 1 + hashUnit(cell.x, cell.z, 2) * visual.widthVariation;
    points.push({
      id,
      position: [cell.x - origin[0] + perp.dx * offset, 0, cell.z - origin[2] + perp.dz * offset],
      width: Math.max(0.1, visual.width * widthScale),
      falloff: visual.falloff,
    });
    return id;
  };

  // Ids are derived from the two endpoints, never from emission order. Point ids
  // are already content-derived (`n:`/`j:` + cell), so a segment keeps the same id
  // across repaints for as long as the corridor piece itself is unchanged — which
  // is what lets {@link RoadPaintSurface} diff two networks and repaint only the
  // difference. An order-based counter would renumber every downstream segment the
  // moment a cell is inserted mid-network, and the diff would degrade to "all".
  const addSegment = (startPointId: string, endPointId: string): void => {
    splineSegments.push({ id: `s:${startPointId}>${endPointId}`, startPointId, endPointId, paint: { ...paint } });
  };

  const consumed = new Set<string>();
  const nodes = segments.filter(isControl);

  for (const node of nodes) {
    const nodeExits = exits(node);
    // A lone road cell (no exits *in this group*) still deserves a dab so no
    // committed cell is left unpainted; a zero-length self-segment paints a disk
    // of the corridor. A border cell whose only neighbours are the opponent's
    // lands here too, which is exactly right — its own side ends at the line.
    if (nodeExits.length === 0) {
      const id = nodePoint(node);
      addSegment(id, id);
      continue;
    }
    for (const dir of nodeExits) {
      const halfEdge = `${node.x}:${node.z}|${dir}`;
      if (consumed.has(halfEdge)) continue;
      // Walk the straight run in `dir` until the next control cell. Every interior
      // cell is degree-2 collinear, so the whole run is one axis-aligned line.
      const interior: RoadCell[] = [];
      let cur: RoadCell = node;
      let d = dir;
      let end: RoadSegment | null = null;
      let arriveDir = dir;
      for (let guard = 0; guard <= byKey.size; guard += 1) {
        const step = DIR_STEP[d];
        const next = byKey.get(key(cur.x + step.dx * cellSize, cur.z + step.dz * cellSize));
        if (!next) break;
        if (isControl(next)) {
          end = next;
          arriveDir = d;
          break;
        }
        interior.push(next);
        const back = OPPOSITE[d];
        const forward = exits(next).find((c) => c !== back);
        if (!forward) break;
        cur = next;
        d = forward;
      }
      if (!end) continue;
      consumed.add(halfEdge);
      consumed.add(`${end.x}:${end.z}|${OPPOSITE[arriveDir]}`);

      const startId = nodePoint(node);
      const endId = nodePoint(end);
      const perp: DirStep = DIR_STEP[dir].dx !== 0 ? { dx: 0, dz: 1 } : { dx: 1, dz: 0 };
      // Insert an interior control point every `jitterSpacingCells` cells so a long
      // run gently waves instead of ruling a perfectly straight line (Faz 4).
      const spacing = Math.max(1, Math.round(visual.jitterSpacingCells));
      const useJitter = visual.jitter > 0 && interior.length > spacing;
      let prevId = startId;
      if (useJitter) {
        for (let i = spacing - 1; i < interior.length; i += spacing) {
          // Keep the last stretch attached to the end node — no point right beside it.
          if (interior.length - i <= 1) break;
          const jid = jitterPoint(interior[i]!, perp);
          addSegment(prevId, jid);
          prevId = jid;
        }
      }
      addSegment(prevId, endId);
    }
  }
}

/** A standing building's ground footprint, in world XZ (centre + full extents). */
export interface StructurePad {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** The sampled ground level at placement, in world-space Y. Defaults to terrain origin. */
  readonly groundY?: number;
  /**
   * Whether the pad also levels the terrain to {@link groundY}. Defaults to
   * `true`, which is what a *built* structure wants: it was placed onto the pad,
   * so the pad may move the ground under it freely.
   *
   * Authored footprints set this `false`. A trade site's dock is surrounded by
   * level scenery baked at authored elevations — the port's jetty, the camp's cut
   * grove, the pit's rubble — and none of it re-grounds when the heightfield
   * moves, so flattening its apron would leave those props floating or buried.
   * Such a footprint takes the paint (which is all the player needs to read where
   * the site ends) and leaves the authored elevation exactly as it was.
   */
  readonly flatten?: boolean;
}

/**
 * Turns building footprints into rounded-rect paint pads, so the ground a
 * building stands on is the same worn layer its roads are (the settlement clears
 * the ground it builds on). Pure and three.js-free, like the spline builder
 * above. A `strength: 0` pad visual returns nothing — the documented off switch.
 */
export function structurePadsToRectPaints(
  pads: readonly StructurePad[],
  origin: Vec3,
  visual: BuildingPadVisual,
): LandscapeRectPaint[] {
  if (visual.strength <= 0) return [];
  return pads.map((pad) => ({
    layerId: visual.layerId,
    centerX: pad.x - origin[0],
    centerZ: pad.z - origin[2],
    halfWidth: Math.max(0, pad.width / 2 + visual.padding),
    halfDepth: Math.max(0, pad.depth / 2 + visual.padding),
    falloff: visual.falloff,
    strength: visual.strength,
  }));
}

/**
 * Uses the exact same footprint, padding and soft edge as the dirt pad, but
 * turns it into a level foundation at the structure's placement elevation.
 *
 * Pads that opted out of levelling (`flatten: false`) are dropped rather than
 * emitted with a no-op height — see {@link StructurePad.flatten}.
 */
export function structurePadsToRectDeforms(
  pads: readonly StructurePad[],
  origin: Vec3,
  visual: BuildingPadVisual,
): LandscapeRectDeform[] {
  return pads.filter((pad) => pad.flatten !== false).map((pad) => ({
    centerX: pad.x - origin[0],
    centerZ: pad.z - origin[2],
    halfWidth: Math.max(0, pad.width / 2 + visual.padding),
    halfDepth: Math.max(0, pad.depth / 2 + visual.padding),
    falloff: visual.falloff,
    targetHeight: (pad.groundY ?? origin[1]) - origin[1],
  }));
}

// --- Incremental repaint bookkeeping ----------------------------------------

/** Landscape-local XZ box; the unit the input diff below works in. */
interface LocalBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * What one repaint was built from, in the shape the next repaint diffs against.
 *
 * Both maps are keyed by content, not by position in a list: a spline segment by
 * its endpoint-derived id, a rect by its own numbers. That is what makes the diff
 * survive an edit in the middle of the network — inserting one road cell must not
 * make every later corridor piece look new.
 */
interface AppliedPaintInputs {
  /** Segment id → resolved geometry + paint config, and the box it can reach. */
  readonly segments: Map<string, { geometry: number[]; paintKey: string; box: LocalBox }>;
  /** Rect content key → how many identical rects carry it, and their shared box. */
  readonly rects: Map<string, { count: number; box: LocalBox }>;
  /** Set when the inputs could not be described unambiguously (duplicate ids). */
  readonly ambiguous: boolean;
}

function expandLocalBox(target: LocalBox | null, box: LocalBox): LocalBox {
  if (!target) return { ...box };
  target.minX = Math.min(target.minX, box.minX);
  target.minZ = Math.min(target.minZ, box.minZ);
  target.maxX = Math.max(target.maxX, box.maxX);
  target.maxZ = Math.max(target.maxZ, box.maxZ);
  return target;
}

/** Reach box of a rounded-rect pad, including its soft edge. */
function rectBox(rect: LandscapeRectPaint | LandscapeRectDeform): LocalBox {
  const reach = Math.max(0, rect.falloff);
  return {
    minX: rect.centerX - rect.halfWidth - reach,
    minZ: rect.centerZ - rect.halfDepth - reach,
    maxX: rect.centerX + rect.halfWidth + reach,
    maxZ: rect.centerZ + rect.halfDepth + reach,
  };
}

function rectKey(rect: LandscapeRectPaint | LandscapeRectDeform): string {
  return "layerId" in rect
    ? `p|${rect.layerId}|${rect.centerX}|${rect.centerZ}|${rect.halfWidth}|${rect.halfDepth}|${rect.falloff}|${rect.strength}`
    : `d|${rect.centerX}|${rect.centerZ}|${rect.halfWidth}|${rect.halfDepth}|${rect.falloff}|${rect.targetHeight}`;
}

function describeRects(rects: readonly (LandscapeRectPaint | LandscapeRectDeform)[]): AppliedPaintInputs["rects"] {
  const out: AppliedPaintInputs["rects"] = new Map();
  for (const rect of rects) {
    const key = rectKey(rect);
    const existing = out.get(key);
    if (existing) existing.count += 1;
    else out.set(key, { count: 1, box: rectBox(rect) });
  }
  return out;
}

/**
 * Resolves the inputs of one repaint into the comparable form above. The spline is
 * resolved through the same {@link splineToPolyline} the engine's apply pass uses,
 * so a corner that curves differently because its *neighbour* moved still reads as
 * changed — the diff never has to reason about Catmull-Rom adjacency itself.
 */
function describePaintInputs(
  spline: ForgeLandscapeSpline,
  rects: readonly (LandscapeRectPaint | LandscapeRectDeform)[],
): AppliedPaintInputs {
  const segments: AppliedPaintInputs["segments"] = new Map();
  let ambiguous = false;
  for (const sub of splineToPolyline(spline)) {
    const id = sub.segment.id;
    const paint = sub.segment.paint;
    const paintKey = `${paint?.enabled === true}|${paint?.layerId ?? ""}|${paint?.strength ?? 0}`;
    const reach = Math.max(0, sub.start.width, sub.end.width) / 2 + Math.max(0, sub.start.falloff, sub.end.falloff);
    const box: LocalBox = {
      minX: Math.min(sub.start.position[0], sub.end.position[0]) - reach,
      minZ: Math.min(sub.start.position[2], sub.end.position[2]) - reach,
      maxX: Math.max(sub.start.position[0], sub.end.position[0]) + reach,
      maxZ: Math.max(sub.start.position[2], sub.end.position[2]) + reach,
    };
    const geometry = [
      sub.start.position[0], sub.start.position[2], sub.start.width, sub.start.falloff,
      sub.end.position[0], sub.end.position[2], sub.end.width, sub.end.falloff,
    ];
    const existing = segments.get(id);
    if (!existing) {
      segments.set(id, { geometry, paintKey, box });
      continue;
    }
    if (existing.paintKey !== paintKey) ambiguous = true;
    existing.geometry.push(...geometry);
    expandLocalBox(existing.box, box);
  }
  return { segments, rects: describeRects(rects), ambiguous };
}

function sameGeometry(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * The landscape-local box covering every vertex whose painted value could differ
 * between two input sets, or `"all"` when the difference cannot be localised.
 * `null` means the two describe exactly the same paint.
 *
 * Restoring that box to pristine and replaying the *whole* ordered operation list
 * clipped to it reproduces the full pass exactly: paint and deform are per-vertex
 * independent, and any vertex outside the box is still touched by the identical
 * ordered subsequence of unchanged operations.
 */
function changedInputBox(previous: AppliedPaintInputs, next: AppliedPaintInputs): LocalBox | "all" | null {
  if (previous.ambiguous || next.ambiguous) return "all";
  let changed: LocalBox | null = null;
  for (const [id, entry] of next.segments) {
    const before = previous.segments.get(id);
    if (before && before.paintKey === entry.paintKey && sameGeometry(before.geometry, entry.geometry)) continue;
    changed = expandLocalBox(changed, entry.box);
    if (before) changed = expandLocalBox(changed, before.box);
  }
  for (const [id, entry] of previous.segments) {
    if (next.segments.has(id)) continue;
    changed = expandLocalBox(changed, entry.box);
  }
  for (const [key, entry] of next.rects) {
    if (previous.rects.get(key)?.count === entry.count) continue;
    changed = expandLocalBox(changed, entry.box);
  }
  for (const [key, entry] of previous.rects) {
    if (next.rects.has(key)) continue;
    changed = expandLocalBox(changed, entry.box);
  }
  return changed;
}

/** Union of two inclusive grid-space bounds; `null` operands are ignored. */
function unionBounds(
  a: LandscapeSplineApplyBounds | null,
  b: LandscapeSplineApplyBounds | null,
): LandscapeSplineApplyBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    x0: Math.min(a.x0, b.x0),
    z0: Math.min(a.z0, b.z0),
    x1: Math.max(a.x1, b.x1),
    z1: Math.max(a.z1, b.z1),
  };
}

/**
 * Returns the smallest changed rectangle after a restore/repaint pass. The paint
 * operations still need their previous coverage to guarantee that a removed road
 * leaves no residue, but the renderer does not need to rebuild every chunk in
 * that coverage when the final vertex values are unchanged.
 */
function changedWeightBounds(
  data: ForgeLandscapeData,
  previous: readonly number[][],
  bounds: LandscapeSplineApplyBounds | null,
): LandscapeSplineApplyBounds | null {
  if (!bounds) return null;
  const { verticesX } = data.size;
  let changed: LandscapeSplineApplyBounds | null = null;
  for (let z = bounds.z0; z <= bounds.z1; z += 1) {
    const row = z * verticesX;
    for (let x = bounds.x0; x <= bounds.x1; x += 1) {
      const index = row + x;
      let differs = false;
      for (let layer = 0; layer < data.layers.length; layer += 1) {
        const next = data.layers[layer]!.weights[index]!;
        if (next !== previous[layer]![index]!) differs = true;
        previous[layer]![index] = next;
      }
      if (!differs) continue;
      changed = unionBounds(changed, { x0: x, z0: z, x1: x, z1: z });
    }
  }
  return changed;
}

/** Same final-value dirty tracking for height edits, including adjacent normals. */
function changedHeightBounds(
  data: ForgeLandscapeData,
  previous: number[],
  bounds: LandscapeSplineApplyBounds | null,
): LandscapeSplineApplyBounds | null {
  if (!bounds) return null;
  const { verticesX, verticesZ } = data.size;
  let changed: LandscapeSplineApplyBounds | null = null;
  for (let z = bounds.z0; z <= bounds.z1; z += 1) {
    const row = z * verticesX;
    for (let x = bounds.x0; x <= bounds.x1; x += 1) {
      const index = row + x;
      const next = data.heights[index]!;
      if (next === previous[index]!) continue;
      previous[index] = next;
      changed = unionBounds(changed, { x0: x, z0: z, x1: x, z1: z });
    }
  }
  if (!changed) return null;
  // Normals sample one vertex outside their own chunk, so a height change at a
  // chunk edge also dirties the neighbour's border vertices.
  return {
    x0: Math.max(0, changed.x0 - 1),
    z0: Math.max(0, changed.z0 - 1),
    x1: Math.min(verticesX - 1, changed.x1 + 1),
    z1: Math.min(verticesZ - 1, changed.z1 + 1),
  };
}

/**
 * Owns a landscape's mount-time paint snapshot and re-derives the road corridor
 * from scratch on every network change. Pure (no render object): each
 * {@link repaint} restores painted vertices to pristine, applies the fresh spline
 * over them, and returns the region that actually moved as the geometry-dirty
 * bounds (or `null` when nothing changed). Restoring guarantees a removed/rerouted
 * road leaves zero residue and any hand-authored paint under the corridor returns.
 *
 * Which vertices that covers is decided by diffing the new inputs against the last
 * ones: an edit only restores and re-applies the region it could have changed,
 * while an input the diff cannot localise still falls back to the whole corridor.
 * Both paths write the same values — see the engine check "a network grown and cut
 * one edit at a time equals one repaint of the result".
 */
export class RoadPaintSurface {
  private readonly pristine: number[][];
  /** Last values submitted to the landscape renderer, for exact dirty bounds. */
  private readonly rendered: number[][];
  private paintedBounds: LandscapeSplineApplyBounds | null = null;
  /** What the last repaint was built from; `null` forces the next one to be full. */
  private applied: AppliedPaintInputs | null = null;

  constructor(private readonly data: ForgeLandscapeData) {
    this.pristine = data.layers.map((layer) => layer.weights.slice());
    this.rendered = data.layers.map((layer) => layer.weights.slice());
  }

  /**
   * Repaint the settlement footprint on the terrain: the road corridor first, then
   * the building pads on top. Returns the geometry-dirty bounds, or null when the
   * inputs describe paint that is already on the terrain.
   *
   * Only the region the inputs actually changed is touched. A full restore and
   * repaint used to run on every committed cell, which made the cost of laying one
   * road proportional to the size of the whole network — a late-game road or erase
   * froze the game for seconds. The corridor is still derived from scratch (so a
   * removed road can leave no residue and hand-painted terrain still returns); what
   * is bounded now is how much of it gets re-applied.
   */
  repaint(spline: ForgeLandscapeSpline, rects: readonly LandscapeRectPaint[] = []): LandscapeSplineApplyBounds | null {
    const next = describePaintInputs(spline, rects);
    const changedBox = this.applied ? changedInputBox(this.applied, next) : "all";
    this.applied = next;
    if (changedBox === null) return null;
    const clip = changedBox === "all" ? null : landscapeGridBoundsForLocalBox(this.data.size, changedBox);
    if (changedBox !== "all" && !clip) return null;

    const restored = clip ?? this.paintedBounds;
    if (restored) this.restore(restored);
    const painted = unionBounds(
      applyLandscapeSplinePaint(this.data, spline, clip).bounds,
      applyLandscapeRectPaint(this.data, rects, clip).bounds,
    );
    // A clipped pass only knows about its own region, so the total painted
    // coverage — what `reset` and the next full repaint have to restore — grows
    // by union rather than being replaced.
    this.paintedBounds = clip ? unionBounds(this.paintedBounds, painted) : painted;
    return changedWeightBounds(this.data, this.rendered, unionBounds(restored, painted));
  }

  /** Reset every painted vertex back to the mount-time snapshot (idempotent). */
  reset(): LandscapeSplineApplyBounds | null {
    const restored = this.paintedBounds;
    if (restored) this.restore(restored);
    this.paintedBounds = null;
    this.applied = null;
    return changedWeightBounds(this.data, this.rendered, restored);
  }

  private restore(bounds: LandscapeSplineApplyBounds): void {
    const { verticesX } = this.data.size;
    const layers = this.data.layers;
    for (let z = bounds.z0; z <= bounds.z1; z += 1) {
      const row = z * verticesX;
      for (let x = bounds.x0; x <= bounds.x1; x += 1) {
        const index = row + x;
        for (let layer = 0; layer < layers.length; layer += 1) {
          layers[layer]!.weights[index] = this.pristine[layer]![index]!;
        }
      }
    }
  }
}

/**
 * Height counterpart to {@link RoadPaintSurface}. A building foundation is a
 * runtime presentation of standing structures, not a permanent edit to the
 * authored level, so each rebuild restores the prior changed region before
 * flattening the current pads from the mount-time height snapshot.
 */
export class StructurePadTerrainSurface {
  private readonly pristine: number[];
  /** Last values submitted to the landscape renderer, for exact dirty bounds. */
  private readonly rendered: number[];
  private flattenedBounds: LandscapeSplineApplyBounds | null = null;
  /** Pads the last rebuild was built from; `null` forces the next one to be full. */
  private applied: AppliedPaintInputs["rects"] | null = null;

  constructor(private readonly data: ForgeLandscapeData) {
    this.pristine = data.heights.slice();
    this.rendered = data.heights.slice();
  }

  /** Same bounded-region rule as {@link RoadPaintSurface.repaint}, for heights. */
  rebuild(rects: readonly LandscapeRectDeform[]): LandscapeSplineApplyBounds | null {
    const next = describeRects(rects);
    const changedBox = this.applied
      ? changedInputBox(
        { segments: new Map(), rects: this.applied, ambiguous: false },
        { segments: new Map(), rects: next, ambiguous: false },
      )
      : "all";
    this.applied = next;
    if (changedBox === null) return null;
    const clip = changedBox === "all" ? null : landscapeGridBoundsForLocalBox(this.data.size, changedBox);
    if (changedBox !== "all" && !clip) return null;

    const restored = clip ?? this.flattenedBounds;
    if (restored) this.restore(restored);
    const flattened = applyLandscapeRectDeform(this.data, rects, clip).bounds;
    this.flattenedBounds = clip ? unionBounds(this.flattenedBounds, flattened) : flattened;
    return changedHeightBounds(this.data, this.rendered, unionBounds(restored, flattened));
  }

  reset(): LandscapeSplineApplyBounds | null {
    const restored = this.flattenedBounds;
    if (restored) this.restore(restored);
    this.flattenedBounds = null;
    this.applied = null;
    return changedHeightBounds(this.data, this.rendered, restored);
  }

  private restore(bounds: LandscapeSplineApplyBounds): void {
    const { verticesX } = this.data.size;
    for (let z = bounds.z0; z <= bounds.z1; z += 1) {
      const row = z * verticesX;
      for (let x = bounds.x0; x <= bounds.x1; x += 1) {
        const index = row + x;
        this.data.heights[index] = this.pristine[index]!;
      }
    }
  }
}

/** A mounted terrain the painter drives (matches `AuthoredWorldHandle` entries). */
export interface RoadTerrainPainterTarget {
  readonly data: ForgeLandscapeData;
  readonly object: LandscapeObject;
  readonly position: Vec3;
  readonly layerColors: LandscapeLayerColors;
}

/** Last event-driven terrain mutation, exposed through the RTS debug perf witness. */
export interface RoadTerrainPaintSnapshot {
  /** CPU time for spline conversion, paint/deform and dirty geometry replacement. */
  readonly durationMs: number;
  readonly roadVersion: number;
  readonly roadSegments: number;
  readonly structurePads: number;
  /** Vertex rectangle sent to the landscape geometry updater; null means no upload. */
  readonly dirtyBounds: LandscapeSplineApplyBounds | null;
}

function paintNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Binds a {@link RoadPaintSurface} to a mounted terrain and pushes the repainted
 * corridor into the render object's chunk geometry. Dirty-checked on
 * `RoadGraph.version`, so however a mutation arrives (commit/remove/clear) it
 * repaints exactly once per topology change.
 */
export class RoadTerrainPainter {
  private readonly surface: RoadPaintSurface;
  private readonly foundationSurface: StructurePadTerrainSurface;
  private lastVersion = -1;
  /** Ownership generation the last repaint was built for; borders move on their own. */
  private lastOwnershipVersion = -1;
  /** Set by every input change; cleared by the {@link sync} that consumes it. */
  private dirty = true;
  /**
   * The paint layer each kingdom's roads blend toward; changes with that
   * kingdom's age (Faz 5). Ground nobody holds keeps the base layer, so an open
   * haul road stays a dirt track no matter who is in which age.
   */
  private readonly layerByOwner = new Map<RoadOwner, string>();
  /** Ground pads of the currently standing buildings, in world XZ. */
  private pads: readonly StructurePad[] = [];
  /** Last building revision the pads were rebuilt for; `-1` means "never". */
  private padRevision = -1;
  private lastPaintSnapshot: RoadTerrainPaintSnapshot | null = null;

  constructor(
    private readonly target: RoadTerrainPainterTarget,
    private readonly cellSize: number,
    private readonly visual: RoadVisual,
    private readonly padVisual: BuildingPadVisual,
  ) {
    this.surface = new RoadPaintSurface(target.data);
    this.foundationSurface = new StructurePadTerrainSurface(target.data);
  }

  /**
   * Switch the layer *one kingdom's* roads paint into (e.g. age promotion
   * dirt→cobblestone). Only forces a repaint when it actually changes — the
   * caller drives the repaint by calling {@link sync} next, and the dirty flag
   * guarantees it runs.
   */
  setLayer(owner: RoadOwner, layerId: string): void {
    if (this.layerFor(owner) === layerId) return;
    this.layerByOwner.set(owner, layerId);
    this.dirty = true;
  }

  /** A kingdom's current road layer; the base layer until it is given one. */
  private layerFor(owner: RoadOwner): string {
    return this.layerByOwner.get(owner) ?? this.visual.layerId;
  }

  /**
   * Refresh the building ground pads, dirty-checked on `revision` — a monotonic
   * counter of every place/cancel/destroy across the building systems. `resolve`
   * only runs when that number moved, so the caller may hand over a fresh array
   * without paying for it on the frames where nothing was built.
   */
  setStructurePads(revision: number, resolve: () => readonly StructurePad[]): void {
    if (revision === this.padRevision) return;
    this.padRevision = revision;
    this.pads = resolve();
    this.dirty = true;
  }

  /** Read the latest actual repaint without adding any work to regular frames. */
  snapshot(): RoadTerrainPaintSnapshot | null {
    return this.lastPaintSnapshot;
  }

  /**
   * Repaint the terrain for the current network, unless nothing has changed.
   *
   * `ownershipVersion` is a second staleness input, not a nicety: a border that
   * moves repaints a road nobody touched — the stretch that just fell inside a
   * kingdom's control takes that kingdom's age layer.
   *
   * The network arrives as a thunk because the caller polls this every frame:
   * `RoadGraph.all()` rebuilds and sorts the whole network on each call, which is
   * pure garbage on the frames — nearly all of them — where nothing was paved.
   */
  sync(resolveSegments: () => readonly RoadSegment[], version: number, ownershipVersion = 0): void {
    if (version !== this.lastVersion || ownershipVersion !== this.lastOwnershipVersion) {
      this.lastVersion = version;
      this.lastOwnershipVersion = ownershipVersion;
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const segments = resolveSegments();
    const startedAt = paintNow();
    const spline = roadGraphToLandscapeSpline(segments, {
      cellSize: this.cellSize,
      origin: this.target.position,
      visual: this.visual,
      layerForOwner: (owner) => this.layerFor(owner),
    });
    const rects = structurePadsToRectPaints(this.pads, this.target.position, this.padVisual);
    const foundations = structurePadsToRectDeforms(this.pads, this.target.position, this.padVisual);
    const dirty = unionBounds(
      this.surface.repaint(spline, rects),
      this.foundationSurface.rebuild(foundations),
    );
    this.refreshGeometry(dirty);
    this.lastPaintSnapshot = {
      durationMs: Math.max(0, paintNow() - startedAt),
      roadVersion: version,
      roadSegments: segments.length,
      structurePads: this.pads.length,
      dirtyBounds: dirty,
    };
  }

  /** Drop all road/pad paint back to the mount-time snapshot (match restart/dispose). */
  reset(): void {
    this.lastVersion = -1;
    this.lastOwnershipVersion = -1;
    this.padRevision = -1;
    this.pads = [];
    this.dirty = true;
    this.layerByOwner.clear();
    const startedAt = paintNow();
    const dirty = unionBounds(this.surface.reset(), this.foundationSurface.reset());
    this.refreshGeometry(dirty);
    this.lastPaintSnapshot = {
      durationMs: Math.max(0, paintNow() - startedAt),
      roadVersion: this.lastVersion,
      roadSegments: 0,
      structurePads: 0,
      dirtyBounds: dirty,
    };
  }

  private refreshGeometry(dirty: LandscapeSplineApplyBounds | null): void {
    if (!dirty) return;
    updateLandscapeObjectGeometry(
      this.target.object,
      this.target.data,
      dirty,
      "lit",
      // Only the weight-debug view modes read this; "lit" ignores it, and there
      // is no single active layer once each kingdom paints its own.
      this.visual.layerId,
      this.target.layerColors,
    );
  }
}

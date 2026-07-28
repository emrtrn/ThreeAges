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
import type { RoadCell, RoadDirection, RoadSegment } from "./roadGraph";

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
}

/** A degree-2 road cell whose two exits are collinear is an interior straight cell. */
function isStraightThrough(connections: readonly RoadDirection[]): boolean {
  if (connections.length !== 2) return false;
  const hasEW = connections.includes("east") && connections.includes("west");
  const hasNS = connections.includes("north") && connections.includes("south");
  return hasEW || hasNS;
}

/** Control points are everything that is *not* an interior straight cell. */
function isControlCell(segment: RoadSegment): boolean {
  return !isStraightThrough(segment.connections);
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
 */
export function roadGraphToLandscapeSpline(
  segments: readonly RoadSegment[],
  options: RoadSplineOptions,
): ForgeLandscapeSpline {
  const { cellSize, origin, visual } = options;
  const key = (x: number, z: number): string => `${x}:${z}`;
  const byKey = new Map<string, RoadSegment>();
  for (const segment of segments) byKey.set(key(segment.x, segment.z), segment);

  const points: ForgeLandscapeSplinePoint[] = [];
  const splineSegments: ForgeLandscapeSplineSegment[] = [];
  const pointIdByCell = new Map<string, string>();
  const paint = { enabled: true, layerId: visual.layerId, strength: visual.strength };
  const local = (cell: RoadCell): Vec3 => [cell.x - origin[0], 0, cell.z - origin[2]];

  /** Registers (once) a full-width control point for a cell and returns its id. */
  const nodePoint = (cell: RoadCell): string => {
    const cellKey = key(cell.x, cell.z);
    const existing = pointIdByCell.get(cellKey);
    if (existing) return existing;
    const id = `n:${cellKey}`;
    pointIdByCell.set(cellKey, id);
    points.push({ id, position: local(cell), width: visual.width, falloff: visual.falloff });
    return id;
  };

  /** Registers an interior jitter point (perpendicular offset + width variation). */
  const jitterPoint = (cell: RoadCell, perp: DirStep): string => {
    const cellKey = key(cell.x, cell.z);
    const id = `j:${cellKey}`;
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

  let segIndex = 0;
  const addSegment = (startPointId: string, endPointId: string): void => {
    splineSegments.push({ id: `s${segIndex++}`, startPointId, endPointId, paint: { ...paint } });
  };

  const consumed = new Set<string>();
  const nodes = segments.filter(isControlCell);

  for (const node of nodes) {
    // A lone road cell (no exits) still deserves a dab so no committed cell is
    // left unpainted; a zero-length self-segment paints a disk of the corridor.
    if (node.connections.length === 0) {
      const id = nodePoint(node);
      addSegment(id, id);
      continue;
    }
    for (const dir of node.connections) {
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
        if (isControlCell(next)) {
          end = next;
          arriveDir = d;
          break;
        }
        interior.push(next);
        const back = OPPOSITE[d];
        const forward = next.connections.find((c) => c !== back);
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

  return {
    id: "rts-roads",
    name: "RTS Roads",
    smooth: true,
    smoothness: visual.cornerRoundness,
    points,
    segments: splineSegments,
  };
}

/** A standing building's ground footprint, in world XZ (centre + full extents). */
export interface StructurePad {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** The sampled ground level at placement, in world-space Y. Defaults to terrain origin. */
  readonly groundY?: number;
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
 */
export function structurePadsToRectDeforms(
  pads: readonly StructurePad[],
  origin: Vec3,
  visual: BuildingPadVisual,
): LandscapeRectDeform[] {
  return pads.map((pad) => ({
    centerX: pad.x - origin[0],
    centerZ: pad.z - origin[2],
    halfWidth: Math.max(0, pad.width / 2 + visual.padding),
    halfDepth: Math.max(0, pad.depth / 2 + visual.padding),
    falloff: visual.falloff,
    targetHeight: (pad.groundY ?? origin[1]) - origin[1],
  }));
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
 * Owns a landscape's mount-time paint snapshot and re-derives the road corridor
 * from scratch on every network change. Pure (no render object): each
 * {@link repaint} restores the previously painted region to pristine, applies the
 * fresh spline, and returns the union of both regions as the geometry-dirty
 * bounds (or `null` when nothing changed). Restoring guarantees a removed/rerouted
 * road leaves zero residue and any hand-authored paint under the corridor returns.
 */
export class RoadPaintSurface {
  private readonly pristine: number[][];
  private paintedBounds: LandscapeSplineApplyBounds | null = null;

  constructor(private readonly data: ForgeLandscapeData) {
    this.pristine = data.layers.map((layer) => layer.weights.slice());
  }

  /**
   * Repaint the whole settlement footprint on the terrain: the road corridor
   * first, then the building pads on top, both derived from scratch. Returns the
   * union of the restored and freshly painted regions as geometry-dirty bounds.
   */
  repaint(spline: ForgeLandscapeSpline, rects: readonly LandscapeRectPaint[] = []): LandscapeSplineApplyBounds | null {
    const restored = this.paintedBounds;
    if (restored) this.restore(restored);
    const painted = unionBounds(
      applyLandscapeSplinePaint(this.data, spline).bounds,
      applyLandscapeRectPaint(this.data, rects).bounds,
    );
    this.paintedBounds = painted;
    return unionBounds(restored, painted);
  }

  /** Reset every painted vertex back to the mount-time snapshot (idempotent). */
  reset(): LandscapeSplineApplyBounds | null {
    const restored = this.paintedBounds;
    if (restored) this.restore(restored);
    this.paintedBounds = null;
    return restored;
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
  private flattenedBounds: LandscapeSplineApplyBounds | null = null;

  constructor(private readonly data: ForgeLandscapeData) {
    this.pristine = data.heights.slice();
  }

  rebuild(rects: readonly LandscapeRectDeform[]): LandscapeSplineApplyBounds | null {
    const restored = this.flattenedBounds;
    if (restored) this.restore(restored);
    const flattened = applyLandscapeRectDeform(this.data, rects).bounds;
    this.flattenedBounds = flattened;
    return unionBounds(restored, flattened);
  }

  reset(): LandscapeSplineApplyBounds | null {
    const restored = this.flattenedBounds;
    if (restored) this.restore(restored);
    this.flattenedBounds = null;
    return restored;
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
  /** Set by every input change; cleared by the {@link sync} that consumes it. */
  private dirty = true;
  /** The paint layer roads currently blend toward; changes with age (Faz 5). */
  private activeLayerId: string;
  /** Ground pads of the currently standing buildings, in world XZ. */
  private pads: readonly StructurePad[] = [];
  /** Last building revision the pads were rebuilt for; `-1` means "never". */
  private padRevision = -1;

  constructor(
    private readonly target: RoadTerrainPainterTarget,
    private readonly cellSize: number,
    private readonly visual: RoadVisual,
    private readonly padVisual: BuildingPadVisual,
  ) {
    this.surface = new RoadPaintSurface(target.data);
    this.foundationSurface = new StructurePadTerrainSurface(target.data);
    this.activeLayerId = visual.layerId;
  }

  /**
   * Switch the layer roads paint into (e.g. age promotion dirt→cobblestone). Only
   * forces a repaint when it actually changes — the caller drives the repaint by
   * calling {@link sync} next, and the dirty flag guarantees it runs.
   */
  setLayer(layerId: string): void {
    if (layerId === this.activeLayerId) return;
    this.activeLayerId = layerId;
    this.dirty = true;
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

  /** Repaint the terrain for the current network, unless nothing has changed. */
  sync(segments: readonly RoadSegment[], version: number): void {
    if (version !== this.lastVersion) {
      this.lastVersion = version;
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const spline = roadGraphToLandscapeSpline(segments, {
      cellSize: this.cellSize,
      origin: this.target.position,
      visual: { ...this.visual, layerId: this.activeLayerId },
    });
    const rects = structurePadsToRectPaints(this.pads, this.target.position, this.padVisual);
    const foundations = structurePadsToRectDeforms(this.pads, this.target.position, this.padVisual);
    this.refreshGeometry(unionBounds(
      this.surface.repaint(spline, rects),
      this.foundationSurface.rebuild(foundations),
    ));
  }

  /** Drop all road/pad paint back to the mount-time snapshot (match restart/dispose). */
  reset(): void {
    this.lastVersion = -1;
    this.padRevision = -1;
    this.pads = [];
    this.dirty = true;
    this.activeLayerId = this.visual.layerId;
    this.refreshGeometry(unionBounds(this.surface.reset(), this.foundationSurface.reset()));
  }

  private refreshGeometry(dirty: LandscapeSplineApplyBounds | null): void {
    if (!dirty) return;
    updateLandscapeObjectGeometry(
      this.target.object,
      this.target.data,
      dirty,
      "lit",
      this.activeLayerId,
      this.target.layerColors,
    );
  }
}

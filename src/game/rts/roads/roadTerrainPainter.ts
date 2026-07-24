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
 */
import type { Vec3 } from "@engine/scene/layout";
import {
  applyLandscapeSplinePaint,
  type ForgeLandscapeData,
  type ForgeLandscapeSpline,
  type ForgeLandscapeSplinePoint,
  type ForgeLandscapeSplineSegment,
  type LandscapeSplineApplyBounds,
} from "@engine/scene/landscape";
import { updateLandscapeObjectGeometry, type LandscapeLayerColors, type LandscapeObject } from "@engine/render-three/landscape";

import type { RoadVisual } from "../../data/gameDataTypes";
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

  return { id: "rts-roads", name: "RTS Roads", smooth: true, points, segments: splineSegments };
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

  repaint(spline: ForgeLandscapeSpline): LandscapeSplineApplyBounds | null {
    const restored = this.paintedBounds;
    if (restored) this.restore(restored);
    const result = applyLandscapeSplinePaint(this.data, spline);
    this.paintedBounds = result.bounds;
    return unionBounds(restored, result.bounds);
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
  private lastVersion = -1;
  /** The paint layer roads currently blend toward; changes with age (Faz 5). */
  private activeLayerId: string;

  constructor(
    private readonly target: RoadTerrainPainterTarget,
    private readonly cellSize: number,
    private readonly visual: RoadVisual,
  ) {
    this.surface = new RoadPaintSurface(target.data);
    this.activeLayerId = visual.layerId;
  }

  /**
   * Switch the layer roads paint into (e.g. age promotion dirt→cobblestone). Only
   * forces a repaint when it actually changes — the caller drives the repaint by
   * calling {@link sync} next, and the invalidated version guarantees it runs.
   */
  setLayer(layerId: string): void {
    if (layerId === this.activeLayerId) return;
    this.activeLayerId = layerId;
    this.lastVersion = -1;
  }

  /** Repaint the terrain for the current network, unless `version` is unchanged. */
  sync(segments: readonly RoadSegment[], version: number): void {
    if (version === this.lastVersion) return;
    this.lastVersion = version;
    const spline = roadGraphToLandscapeSpline(segments, {
      cellSize: this.cellSize,
      origin: this.target.position,
      visual: { ...this.visual, layerId: this.activeLayerId },
    });
    this.refreshGeometry(this.surface.repaint(spline));
  }

  /** Drop all road paint back to the mount-time snapshot (match restart/dispose). */
  reset(): void {
    this.lastVersion = -1;
    this.activeLayerId = this.visual.layerId;
    this.refreshGeometry(this.surface.reset());
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

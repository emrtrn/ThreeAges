/**
 * Minimal 2D grid navigation for AI path requests.
 *
 * Pure engine module: no DOM, Three.js or editor imports. The first
 * implementation plans over X/Z using static blocker AABBs inflated by the
 * agent radius. It is intentionally small so higher-level AI can start using
 * path-following before a full navmesh/Recast adapter exists.
 *
 * Navigation contract (Unreal/Recast `Agent Radius` analogue): a path point is
 * the agent capsule *center* at foot height, never a surface point. Obstacles
 * are eroded by an effective clearance so the capsule body stays clear:
 *
 *   effectiveRadius = agent.radius + agent.clearancePadding + safetyMargin
 *
 * `clearancePadding` is optional per-agent slack beyond the capsule radius (kept
 * small so narrow corridors stay traversable). `safetyMargin` absorbs the grid
 * discretization error and defaults to `cellSize * 0.5` — half a cell, the worst
 * case rounding of a continuous position onto a cell center. Authored navigation
 * bounds are eroded inward by the same effective radius.
 */
import type { Vec3 } from "../scene/layout";

export interface NavAabb {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface NavAgent {
  readonly radius: number;
  readonly height: number;
  readonly stepHeight?: number;
  /**
   * Extra clearance beyond the capsule radius (Unreal `Nav Agent` slack). Added
   * to the effective blocker erosion so the agent keeps a safety gap from walls.
   * Keep it small — large values close off narrow corridors. Defaults to 0.
   */
  readonly clearancePadding?: number;
}

export interface PathRequest {
  readonly start: Vec3;
  readonly goal: Vec3;
  readonly agent: NavAgent;
  readonly blockers: readonly NavAabb[];
  /** Optional authored navigation bounds; when present both start and goal must be inside one. */
  readonly bounds?: readonly NavAabb[];
  readonly cellSize?: number;
  readonly boundsPadding?: number;
  /**
   * Grid discretization safety margin added to the effective blocker erosion.
   * Defaults to `cellSize * 0.5`. Pass `0` to disable (e.g. exact-grid tests).
   */
  readonly safetyMargin?: number;
}

export interface PathResult {
  readonly status: "success" | "failure";
  readonly points: readonly Vec3[];
  readonly visited: number;
}

export interface PathFollowingState {
  readonly path: readonly Vec3[];
  readonly waypointIndex: number;
  readonly status: "idle" | "following" | "success" | "failure";
}

export interface WaypointAcceptance {
  /** Acceptance radius for the final goal waypoint (authored, may be generous). */
  readonly final: number;
  /** Acceptance radius for intermediate waypoints (kept tight so corners aren't cut). */
  readonly intermediate: number;
}

export interface WaypointAdvance {
  /** Index of the waypoint the agent should now steer toward. */
  readonly waypointIndex: number;
  /** True once the final waypoint is within its acceptance radius (path complete). */
  readonly arrived: boolean;
}

/**
 * Advances a path-follower's waypoint cursor past every waypoint already within
 * acceptance. Intermediate waypoints use a tight radius so a generous final
 * `acceptance` cannot make the agent skip a corner early and cut through an
 * inflated blocker; only the final goal honors the authored acceptance.
 */
export function advanceWaypoint(
  path: readonly Vec3[],
  waypointIndex: number,
  position: Vec3,
  acceptance: WaypointAcceptance,
): WaypointAdvance {
  let index = Math.max(0, waypointIndex);
  while (index < path.length) {
    const isFinal = index >= path.length - 1;
    const radius = isFinal ? acceptance.final : acceptance.intermediate;
    if (planarDistanceXZ(position, path[index]!) > radius) break;
    if (isFinal) return { waypointIndex: index, arrived: true };
    index += 1;
  }
  return { waypointIndex: index, arrived: false };
}

function planarDistanceXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

interface GridCoord {
  readonly x: number;
  readonly z: number;
}

interface SearchNode extends GridCoord {
  readonly g: number;
  readonly f: number;
}

const DEFAULT_CELL_SIZE = 0.5;
const DEFAULT_BOUNDS_PADDING = 2;
const MAX_GRID_CELLS = 20000;

export function findGridPath(request: PathRequest): PathResult {
  const cellSize = sanePositive(request.cellSize, DEFAULT_CELL_SIZE);
  const radius = Math.max(0, finiteOr(request.agent.radius, 0));
  const clearance = Math.max(0, finiteOr(request.agent.clearancePadding, 0));
  const safetyMargin = nonNegativeOr(request.safetyMargin, cellSize * 0.5);
  // Effective erosion applied to blockers and authored bounds: the capsule body
  // plus per-agent slack plus grid rounding slack (see module contract).
  const clearanceRadius = radius + clearance + safetyMargin;
  const height = Math.max(0, finiteOr(request.agent.height, 0));
  const stepHeight = Math.max(0, finiteOr(request.agent.stepHeight, 0));
  const blockers = request.blockers.filter((blocker) =>
    blocksAgentVertically(blocker, request.start[1], height, stepHeight),
  );
  const authoredBounds = request.bounds && request.bounds.length > 0 ? request.bounds : undefined;
  if (authoredBounds && !pointInsideAnyAabb2d(request.start, authoredBounds)) {
    return { status: "failure", points: [], visited: 0 };
  }
  if (authoredBounds && !pointInsideAnyAabb2d(request.goal, authoredBounds)) {
    return { status: "failure", points: [], visited: 0 };
  }
  const bounds = authoredBounds
    ? navBoundsFromAuthored(authoredBounds, clearanceRadius)
    : navBounds(request.start, request.goal, blockers, clearanceRadius, request.boundsPadding);
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize) + 1);
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize) + 1);
  if (cols * rows > MAX_GRID_CELLS) return { status: "failure", points: [], visited: 0 };

  const toCoord = (point: Vec3): GridCoord => ({
    x: clamp(Math.round((point[0] - bounds.minX) / cellSize), 0, cols - 1),
    z: clamp(Math.round((point[2] - bounds.minZ) / cellSize), 0, rows - 1),
  });
  const toPoint = (coord: GridCoord): Vec3 => [
    bounds.minX + coord.x * cellSize,
    request.start[1],
    bounds.minZ + coord.z * cellSize,
  ];
  const passable = (coord: GridCoord): boolean => {
    if (coord.x < 0 || coord.z < 0 || coord.x >= cols || coord.z >= rows) return false;
    const point = toPoint(coord);
    return !pointBlocked(point, blockers, clearanceRadius) && (!authoredBounds || pointInsideAnyAabb2d(point, authoredBounds));
  };

  const start = toCoord(request.start);
  const goal = toCoord(request.goal);
  if (!passable(start) || !passable(goal)) return { status: "failure", points: [], visited: 0 };
  if (sameCoord(start, goal)) {
    return { status: "success", points: [cloneVec3(request.start), cloneVec3(request.goal)], visited: 1 };
  }

  const open: SearchNode[] = [{ ...start, g: 0, f: heuristic(start, goal) }];
  const bestG = new Map<string, number>([[coordKey(start), 0]]);
  const cameFrom = new Map<string, string>();
  let visited = 0;

  while (open.length > 0) {
    const current = popLowest(open);
    visited += 1;
    if (sameCoord(current, goal)) {
      const cells = reconstructCells(cameFrom, current).map(coordFromKey);
      return {
        status: "success",
        points: pathPoints(request.start, request.goal, cells, toPoint, (a, b) =>
          segmentSafe(a, b, blockers, clearanceRadius, authoredBounds),
        ),
        visited,
      };
    }
    for (const next of neighbors(current, passable)) {
      const step = next.x !== current.x && next.z !== current.z ? Math.SQRT2 : 1;
      const nextG = current.g + step;
      const key = coordKey(next);
      if (nextG >= (bestG.get(key) ?? Infinity)) continue;
      bestG.set(key, nextG);
      cameFrom.set(key, coordKey(current));
      open.push({ ...next, g: nextG, f: nextG + heuristic(next, goal) });
    }
  }

  return { status: "failure", points: [], visited };
}

function navBounds(
  start: Vec3,
  goal: Vec3,
  blockers: readonly NavAabb[],
  radius: number,
  padding: number | undefined,
) {
  const pad = sanePositive(padding, DEFAULT_BOUNDS_PADDING) + radius;
  let minX = Math.min(start[0], goal[0]) - pad;
  let maxX = Math.max(start[0], goal[0]) + pad;
  let minZ = Math.min(start[2], goal[2]) - pad;
  let maxZ = Math.max(start[2], goal[2]) + pad;
  for (const blocker of blockers) {
    minX = Math.min(minX, blocker.min[0] - pad);
    maxX = Math.max(maxX, blocker.max[0] + pad);
    minZ = Math.min(minZ, blocker.min[2] - pad);
    maxZ = Math.max(maxZ, blocker.max[2] + pad);
  }
  return { minX, maxX, minZ, maxZ };
}

function navBoundsFromAuthored(bounds: readonly NavAabb[], radius: number) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const bound of bounds) {
    minX = Math.min(minX, bound.min[0] + radius);
    maxX = Math.max(maxX, bound.max[0] - radius);
    minZ = Math.min(minZ, bound.min[2] + radius);
    maxZ = Math.max(maxZ, bound.max[2] - radius);
  }
  return { minX, maxX, minZ, maxZ };
}

function pointInsideAnyAabb2d(point: Vec3, bounds: readonly NavAabb[]): boolean {
  return bounds.some((bound) => pointInsideAabb2d(point, bound));
}

function pointInsideAabb2d(point: Vec3, bound: NavAabb): boolean {
  return point[0] >= bound.min[0] &&
    point[0] <= bound.max[0] &&
    point[2] >= bound.min[2] &&
    point[2] <= bound.max[2];
}

function blocksAgentVertically(
  blocker: NavAabb,
  footY: number,
  height: number,
  stepHeight: number,
): boolean {
  return blocker.max[1] > footY + stepHeight && blocker.min[1] < footY + Math.max(height, 0.001);
}

function pointBlocked(point: Vec3, blockers: readonly NavAabb[], radius: number): boolean {
  return blockers.some(
    (blocker) =>
      point[0] >= blocker.min[0] - radius &&
      point[0] <= blocker.max[0] + radius &&
      point[2] >= blocker.min[2] - radius &&
      point[2] <= blocker.max[2] + radius,
  );
}

function neighbors(
  coord: GridCoord,
  passable: (coord: GridCoord) => boolean,
): GridCoord[] {
  const out: GridCoord[] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dz === 0) continue;
      const next = { x: coord.x + dx, z: coord.z + dz };
      if (!passable(next)) continue;
      if (dx !== 0 && dz !== 0) {
        if (!passable({ x: coord.x + dx, z: coord.z }) || !passable({ x: coord.x, z: coord.z + dz })) {
          continue;
        }
      }
      out.push(next);
    }
  }
  return out;
}

function reconstructCells(cameFrom: ReadonlyMap<string, string>, current: GridCoord): string[] {
  const cells = [coordKey(current)];
  let cursor = coordKey(current);
  while (cameFrom.has(cursor)) {
    cursor = cameFrom.get(cursor)!;
    cells.push(cursor);
  }
  cells.reverse();
  return cells;
}

function pathPoints(
  start: Vec3,
  goal: Vec3,
  cells: readonly GridCoord[],
  toPoint: (coord: GridCoord) => Vec3,
  segmentSafe: (a: Vec3, b: Vec3) => boolean,
): Vec3[] {
  const raw: Vec3[] = [cloneVec3(start)];
  for (const cell of cells) pushDistinctPoint(raw, toPoint(cell));
  pushDistinctPoint(raw, cloneVec3(goal));
  return compressPathPoints(raw, segmentSafe);
}

function pushDistinctPoint(points: Vec3[], point: Vec3): void {
  const prev = points[points.length - 1];
  if (prev && planarDistanceXZ(prev, point) < 1e-9 && Math.abs(prev[1] - point[1]) < 1e-9) return;
  points.push(point);
}

function compressPathPoints(points: readonly Vec3[], segmentSafe: (a: Vec3, b: Vec3) => boolean): Vec3[] {
  if (points.length <= 2) return points.map(cloneVec3);
  const out: Vec3[] = [cloneVec3(points[0]!)];
  let prevDir = pointDirection(points[0]!, points[1]!);
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const dir = pointDirection(current, next);
    const changedDirection = dir.x !== prevDir.x || dir.z !== prevDir.z;
    const shortcutSafe = segmentSafe(out[out.length - 1]!, next);
    if (changedDirection || !shortcutSafe) out.push(cloneVec3(current));
    prevDir = dir;
  }
  out.push(cloneVec3(points[points.length - 1]!));
  return out;
}

function pointDirection(a: Vec3, b: Vec3): GridCoord {
  return {
    x: Math.sign(b[0] - a[0]),
    z: Math.sign(b[2] - a[2]),
  };
}

function segmentSafe(
  a: Vec3,
  b: Vec3,
  blockers: readonly NavAabb[],
  radius: number,
  bounds: readonly NavAabb[] | undefined,
): boolean {
  if (blockers.some((blocker) => segmentIntersectsAabb2d(a, b, blocker, radius))) return false;
  return !bounds || segmentInsideAnyErodedAabb2d(a, b, bounds, radius);
}

function segmentInsideAnyErodedAabb2d(a: Vec3, b: Vec3, bounds: readonly NavAabb[], radius: number): boolean {
  return bounds.some((bound) => pointInsideErodedAabb2d(a, bound, radius) && pointInsideErodedAabb2d(b, bound, radius));
}

function pointInsideErodedAabb2d(point: Vec3, bound: NavAabb, radius: number): boolean {
  return point[0] >= bound.min[0] + radius &&
    point[0] <= bound.max[0] - radius &&
    point[2] >= bound.min[2] + radius &&
    point[2] <= bound.max[2] - radius;
}

function segmentIntersectsAabb2d(a: Vec3, b: Vec3, blocker: NavAabb, radius: number): boolean {
  let tMin = 0;
  let tMax = 1;
  const minX = blocker.min[0] - radius;
  const maxX = blocker.max[0] + radius;
  const minZ = blocker.min[2] - radius;
  const maxZ = blocker.max[2] + radius;
  const xHit = clipSegmentAxis(a[0], b[0], minX, maxX, tMin, tMax);
  if (!xHit) return false;
  tMin = xHit[0];
  tMax = xHit[1];
  const zHit = clipSegmentAxis(a[2], b[2], minZ, maxZ, tMin, tMax);
  return Boolean(zHit);
}

function clipSegmentAxis(from: number, to: number, min: number, max: number, tMin: number, tMax: number): [number, number] | null {
  const delta = to - from;
  if (Math.abs(delta) < 1e-9) return from >= min && from <= max ? [tMin, tMax] : null;
  let enter = (min - from) / delta;
  let exit = (max - from) / delta;
  if (enter > exit) [enter, exit] = [exit, enter];
  const clippedMin = Math.max(tMin, enter);
  const clippedMax = Math.min(tMax, exit);
  return clippedMin <= clippedMax ? [clippedMin, clippedMax] : null;
}

function popLowest(open: SearchNode[]): SearchNode {
  let bestIndex = 0;
  for (let i = 1; i < open.length; i += 1) {
    const best = open[bestIndex]!;
    const candidate = open[i]!;
    if (candidate.f < best.f || (candidate.f === best.f && candidate.g < best.g)) bestIndex = i;
  }
  return open.splice(bestIndex, 1)[0]!;
}

function heuristic(a: GridCoord, b: GridCoord): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function coordKey(coord: GridCoord): string {
  return `${coord.x},${coord.z}`;
}

function coordFromKey(key: string): GridCoord {
  const [x, z] = key.split(",").map(Number);
  return { x: x ?? 0, z: z ?? 0 };
}

function sameCoord(a: GridCoord, b: GridCoord): boolean {
  return a.x === b.x && a.z === b.z;
}

function cloneVec3(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]];
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

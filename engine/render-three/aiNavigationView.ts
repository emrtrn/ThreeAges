import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from "three";

import type { NavAabb } from "../navigation/gridNavigation";
import type { Vec3 } from "../scene/layout";

export interface AiNavigationFollowerView {
  readonly status: "idle" | "following" | "success" | "failure";
  readonly waypointIndex: number;
  readonly path: readonly Vec3[];
  readonly goal?: Vec3 | null;
  readonly secondsWithoutProgress?: number;
}

export interface AiNavigationViewInput {
  readonly blockers?: readonly NavAabb[];
  readonly bounds?: readonly NavAabb[];
  readonly followers?: readonly AiNavigationFollowerView[];
  readonly cellSize?: number;
  readonly y?: number;
}

const DEFAULT_CELL_SIZE = 0.5;
const MAX_GRID_LINES_PER_AXIS = 80;
const GRID_COLOR = 0x4386ff;
const BLOCKER_COLOR = 0xff6b4a;
const BOUNDS_COLOR = 0x52a3ff;
const PATH_COLOR = 0x3fd47f;
const PATH_STALLED_COLOR = 0xffc857;
const PATH_FAILED_COLOR = 0xff4d6d;
const WAYPOINT_COLOR = 0xfff06a;

export function createAiNavigationView(input: AiNavigationViewInput): Group {
  const group = new Group();
  group.name = "ai-navigation-debug-view";
  const y = input.y ?? 0.04;
  const bounds = computeBounds(input.blockers ?? [], input.bounds ?? [], input.followers ?? []);
  if (!bounds) return group;

  const grid = gridSegments(bounds, input.cellSize ?? DEFAULT_CELL_SIZE, y);
  if (grid.length > 0) group.add(lineSegments("ai-nav-grid", grid, GRID_COLOR, 0.18));

  const navBounds = blockerFootprintSegments(input.bounds ?? [], y + 0.01);
  if (navBounds.length > 0) group.add(lineSegments("ai-nav-bounds", navBounds, BOUNDS_COLOR, 0.95));

  const blockers = blockerFootprintSegments(input.blockers ?? [], y + 0.015);
  if (blockers.length > 0) group.add(lineSegments("ai-nav-blockers", blockers, BLOCKER_COLOR, 0.8));

  for (const follower of input.followers ?? []) {
    const color =
      follower.status === "failure"
        ? PATH_FAILED_COLOR
        : (follower.secondsWithoutProgress ?? 0) >= 0.5
          ? PATH_STALLED_COLOR
          : PATH_COLOR;
    const path = pathSegments(follower.path, y + 0.08);
    if (path.length > 0) group.add(lineSegments("ai-nav-path", path, color, 0.95));
    const waypoint = follower.path[follower.waypointIndex] ?? follower.goal ?? null;
    if (waypoint) {
      group.add(
        lineSegments(
          follower.status === "failure" ? "ai-nav-failed-goal" : "ai-nav-current-waypoint",
          crossSegments(waypoint, y + 0.12, follower.status === "failure" ? 0.35 : 0.22),
          follower.status === "failure" ? PATH_FAILED_COLOR : WAYPOINT_COLOR,
          1,
        ),
      );
    }
  }

  return group;
}

export function disposeAiNavigationView(group: Group | null): void {
  if (!group) return;
  group.traverse((object) => {
    if (!(object instanceof LineSegments)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function lineSegments(name: string, points: readonly Vec3[], color: number, opacity: number): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.flatMap((point) => point), 3));
  const material = new LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const lines = new LineSegments(geometry, material);
  lines.name = name;
  lines.renderOrder = 20;
  return lines;
}

function computeBounds(
  blockers: readonly NavAabb[],
  bounds: readonly NavAabb[],
  followers: readonly AiNavigationFollowerView[],
): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const include = (point: readonly [number, number, number]) => {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minZ = Math.min(minZ, point[2]);
    maxZ = Math.max(maxZ, point[2]);
  };
  for (const blocker of blockers) {
    include(blocker.min);
    include(blocker.max);
  }
  for (const bound of bounds) {
    include(bound.min);
    include(bound.max);
  }
  for (const follower of followers) {
    for (const point of follower.path) include(point);
    if (follower.goal) include(follower.goal);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    return null;
  }
  const padding = 1.5;
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding,
  };
}

function gridSegments(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  rawCellSize: number,
  y: number,
): Vec3[] {
  const cellSize = Number.isFinite(rawCellSize) && rawCellSize > 0 ? rawCellSize : DEFAULT_CELL_SIZE;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const step = Math.max(
    cellSize,
    width / MAX_GRID_LINES_PER_AXIS,
    depth / MAX_GRID_LINES_PER_AXIS,
  );
  const points: Vec3[] = [];
  for (let x = snapDown(bounds.minX, step); x <= bounds.maxX; x += step) {
    points.push([x, y, bounds.minZ], [x, y, bounds.maxZ]);
  }
  for (let z = snapDown(bounds.minZ, step); z <= bounds.maxZ; z += step) {
    points.push([bounds.minX, y, z], [bounds.maxX, y, z]);
  }
  return points;
}

function blockerFootprintSegments(blockers: readonly NavAabb[], y: number): Vec3[] {
  const out: Vec3[] = [];
  for (const blocker of blockers) {
    const minX = blocker.min[0];
    const maxX = blocker.max[0];
    const minZ = blocker.min[2];
    const maxZ = blocker.max[2];
    out.push(
      [minX, y, minZ],
      [maxX, y, minZ],
      [maxX, y, minZ],
      [maxX, y, maxZ],
      [maxX, y, maxZ],
      [minX, y, maxZ],
      [minX, y, maxZ],
      [minX, y, minZ],
    );
  }
  return out;
}

function pathSegments(path: readonly Vec3[], y: number): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i + 1 < path.length; i += 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    out.push([a[0], y, a[2]], [b[0], y, b[2]]);
  }
  return out;
}

function crossSegments(point: Vec3, y: number, size: number): Vec3[] {
  const x = point[0];
  const z = point[2];
  return [
    [x - size, y, z],
    [x + size, y, z],
    [x, y, z - size],
    [x, y, z + size],
  ];
}

function snapDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

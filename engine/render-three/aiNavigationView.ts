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

export interface AiPerceptionView {
  readonly entityId: string;
  readonly position: Vec3;
  readonly forward: Vec3;
  readonly sightRadius?: number;
  readonly fieldOfViewDeg?: number;
  readonly hearingRadius?: number;
}

export interface AiQueryCandidateView {
  readonly entityId?: string;
  readonly position: Vec3;
  readonly score: number;
  readonly failedTests?: readonly string[];
  readonly winner?: boolean;
}

export interface AiNavigationViewInput {
  readonly blockers?: readonly NavAabb[];
  readonly bounds?: readonly NavAabb[];
  readonly followers?: readonly AiNavigationFollowerView[];
  readonly perception?: readonly AiPerceptionView[];
  readonly queries?: readonly AiQueryCandidateView[];
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
const SIGHT_COLOR = 0x8ee66b;
const HEARING_COLOR = 0x9f7aff;
const QUERY_CANDIDATE_COLOR = 0x75d7ff;
const QUERY_FAILED_COLOR = 0x7d8794;
const QUERY_WINNER_COLOR = 0x00f5a0;
const DEFAULT_SIGHT_FOV_DEG = 90;

export function createAiNavigationView(input: AiNavigationViewInput): Group {
  const group = new Group();
  group.name = "ai-navigation-debug-view";
  const y = input.y ?? 0.04;
  const bounds = computeBounds(
    input.blockers ?? [],
    input.bounds ?? [],
    input.followers ?? [],
    input.perception ?? [],
    input.queries ?? [],
  );
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

  for (const perception of input.perception ?? []) {
    const hearingRadius = positiveFinite(perception.hearingRadius);
    if (hearingRadius !== null) {
      group.add(
        lineSegments(
          "ai-perception-hearing-radius",
          circleSegments(perception.position, hearingRadius, y + 0.16),
          HEARING_COLOR,
          0.45,
        ),
      );
    }
    const sightRadius = positiveFinite(perception.sightRadius);
    if (sightRadius !== null) {
      group.add(
        lineSegments(
          "ai-perception-sight-cone",
          coneSegments(
            perception.position,
            perception.forward,
            sightRadius,
            perception.fieldOfViewDeg ?? DEFAULT_SIGHT_FOV_DEG,
            y + 0.18,
          ),
          SIGHT_COLOR,
          0.65,
        ),
      );
    }
  }

  for (const candidate of input.queries ?? []) {
    const failed = (candidate.failedTests?.length ?? 0) > 0;
    const winner = candidate.winner === true;
    const color = winner ? QUERY_WINNER_COLOR : failed ? QUERY_FAILED_COLOR : QUERY_CANDIDATE_COLOR;
    const size = winner ? 0.32 : 0.18;
    group.add(
      lineSegments(
        winner ? "ai-query-winner" : failed ? "ai-query-failed-candidate" : "ai-query-candidate",
        queryCandidateSegments(candidate.position, y + (winner ? 0.28 : 0.24), size, winner),
        color,
        winner ? 1 : 0.7,
      ),
    );
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
  perceptions: readonly AiPerceptionView[],
  queries: readonly AiQueryCandidateView[],
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
  for (const perception of perceptions) {
    include(perception.position);
    const radius = Math.max(
      positiveFinite(perception.sightRadius) ?? 0,
      positiveFinite(perception.hearingRadius) ?? 0,
    );
    if (radius > 0) {
      include([perception.position[0] - radius, perception.position[1], perception.position[2] - radius]);
      include([perception.position[0] + radius, perception.position[1], perception.position[2] + radius]);
    }
  }
  for (const candidate of queries) include(candidate.position);
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

function queryCandidateSegments(point: Vec3, y: number, size: number, winner: boolean): Vec3[] {
  const out = crossSegments(point, y, size);
  if (winner) {
    out.push(...circleSegments(point, size * 1.35, y, 24));
  }
  return out;
}

function circleSegments(center: Vec3, radius: number, y: number, steps = 48): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const b = ((i + 1) / steps) * Math.PI * 2;
    out.push(
      [center[0] + Math.cos(a) * radius, y, center[2] + Math.sin(a) * radius],
      [center[0] + Math.cos(b) * radius, y, center[2] + Math.sin(b) * radius],
    );
  }
  return out;
}

function coneSegments(center: Vec3, forward: Vec3, radius: number, fovDeg: number, y: number): Vec3[] {
  const clampedFov = Math.max(1, Math.min(360, fovDeg));
  const steps = Math.max(6, Math.ceil(clampedFov / 8));
  const yaw = Math.atan2(forward[2], forward[0]);
  const half = (clampedFov * Math.PI) / 360;
  const start = yaw - half;
  const end = yaw + half;
  const out: Vec3[] = [];
  const left = [center[0] + Math.cos(start) * radius, y, center[2] + Math.sin(start) * radius] satisfies Vec3;
  const right = [center[0] + Math.cos(end) * radius, y, center[2] + Math.sin(end) * radius] satisfies Vec3;
  out.push([center[0], y, center[2]], left, [center[0], y, center[2]], right);
  for (let i = 0; i < steps; i += 1) {
    const a = start + ((end - start) * i) / steps;
    const b = start + ((end - start) * (i + 1)) / steps;
    out.push(
      [center[0] + Math.cos(a) * radius, y, center[2] + Math.sin(a) * radius],
      [center[0] + Math.cos(b) * radius, y, center[2] + Math.sin(b) * radius],
    );
  }
  return out;
}

function positiveFinite(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function snapDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

/**
 * Runtime Target Point index for AI patrol routes.
 *
 * Target Points are authored as layout marker actors ({@link LayoutTargetPoint});
 * the host maps them into {@link TargetPointEntry} records and hands the Behavior
 * Tree runner an index. Patrol tasks read it through
 * {@link AiTaskContext.targetPoints} to resolve route positions, next links and
 * tag/route lookups without touching editor or render code.
 *
 * Pure engine module: no DOM / Three.js / editor imports; value imports stay
 * relative so the engine-test bundler (no path aliases) can run it.
 */
import type { LayoutTargetPoint, Vec3 } from "../scene/layout";
import { resolveTargetPoint } from "../scene/targetPoint";

export interface TargetPointEntry {
  readonly id: string;
  readonly name: string;
  readonly position: Vec3;
  /** Next point id in a single-link patrol route, or null when the route ends. */
  readonly nextTargetPoint: string | null;
  readonly waitTime: number;
  readonly acceptanceRadius: number;
  readonly speedOverride: number | null;
  readonly patrolTag: string;
}

export interface TargetPointIndex {
  get(id: string | null | undefined): TargetPointEntry | null;
  all(): readonly TargetPointEntry[];
  /** Points carrying `patrolTag === tag` in authored order (all points if tag empty). */
  byTag(tag: string): readonly TargetPointEntry[];
  /** The point referenced by `entry.nextTargetPoint`, or null when missing/broken. */
  next(id: string | null | undefined): TargetPointEntry | null;
  /** First point (optionally within `tag`) in authored order. */
  first(tag?: string): TargetPointEntry | null;
  /** Closest point (planar) to `position` (optionally within `tag`), excluding `excludeId`. */
  nearest(position: Vec3, tag?: string, excludeId?: string): TargetPointEntry | null;
}

export function createTargetPointIndex(entries: readonly TargetPointEntry[]): TargetPointIndex {
  const byId = new Map<string, TargetPointEntry>();
  const ordered: TargetPointEntry[] = [];
  for (const entry of entries) {
    if (!entry.id || byId.has(entry.id)) continue;
    byId.set(entry.id, entry);
    ordered.push(entry);
  }
  const byTag = (tag: string): readonly TargetPointEntry[] =>
    tag ? ordered.filter((entry) => entry.patrolTag === tag) : ordered;
  return {
    get: (id) => (id ? byId.get(id) ?? null : null),
    all: () => ordered,
    byTag,
    next: (id) => {
      const current = id ? byId.get(id) : undefined;
      if (!current || !current.nextTargetPoint) return null;
      return byId.get(current.nextTargetPoint) ?? null;
    },
    first: (tag) => {
      const pool = tag ? byTag(tag) : ordered;
      return pool[0] ?? null;
    },
    nearest: (position, tag, excludeId) => {
      const pool = tag ? byTag(tag) : ordered;
      let best: TargetPointEntry | null = null;
      let bestDist = Infinity;
      for (const entry of pool) {
        if (entry.id === excludeId) continue;
        const dist = planarDistanceSq(position, entry.position);
        if (dist < bestDist) {
          bestDist = dist;
          best = entry;
        }
      }
      return best;
    },
  };
}

/** Maps authored layout Target Points into runtime index entries (skips id-less). */
export function targetPointEntriesFromLayout(
  points: readonly LayoutTargetPoint[] | undefined,
): TargetPointEntry[] {
  if (!points) return [];
  const entries: TargetPointEntry[] = [];
  for (const point of points) {
    if (!point.id) continue;
    const resolved = resolveTargetPoint(point);
    const nextId =
      typeof point.nextTargetPoint === "string" && point.nextTargetPoint.length > 0
        ? point.nextTargetPoint
        : null;
    entries.push({
      id: point.id,
      name: resolved.name,
      position: [point.position[0], point.position[1], point.position[2]],
      nextTargetPoint: nextId,
      waitTime: resolved.waitTime,
      acceptanceRadius: resolved.acceptanceRadius,
      speedOverride: resolved.speedOverride,
      patrolTag: resolved.patrolTag,
    });
  }
  return entries;
}

function planarDistanceSq(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

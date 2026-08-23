/**
 * Where the river runs, as a world-space centreline the RTS can measure against.
 *
 * The river is authored twice over and neither half is the path: a
 * `riverWaters` entry in the Level carries the *water surface* (opacity, foam,
 * reflection) and names a spline, and the Landscape sidecar carries that spline
 * as the trench it cut into the terrain. What crosses the map is the spline, so
 * that is what this resolves — the water entry is only how we learn *which*
 * spline is a river rather than a road or a fence.
 *
 * Read once when the authored world mounts. A Landscape spline is authored
 * geometry: it does not move, and nothing at runtime edits it.
 */
import type { RoomLayout } from "@engine/scene/layout";
import type { ForgeLandscapeSpline } from "@engine/scene/landscape";
import type { MountedLandscape } from "@/scene/authoredWorld";
import type { RtsRiverPath } from "../audio/rtsZoneAmbience";

/**
 * The centreline of every authored river, in world XZ.
 *
 * Empty for a level with no water, which is every level that is not
 * `RTS_GameplayProof` today — and empty is the honest answer rather than a
 * fallback, because a river bed with no river is a sound coming from nowhere.
 */
export function resolveRtsRiverPaths(
  layout: RoomLayout,
  landscapes: readonly MountedLandscape[],
): RtsRiverPath[] {
  const paths: RtsRiverPath[] = [];
  const layoutLandscapes = layout.landscapes ?? [];
  for (const water of layout.riverWaters ?? []) {
    // Mounted landscapes come back in layout order, so the id resolves to an
    // index rather than being carried on the mounted handle.
    const index = layoutLandscapes.findIndex((entry) => entry.id === water.landscapeRef);
    const terrain = index < 0 ? undefined : landscapes[index];
    if (!terrain) continue;
    const spline = (terrain.data.splines ?? []).find((entry) => entry.id === water.splineRef);
    if (!spline) continue;
    const path = splineCentreline(spline, terrain.position[0], terrain.position[2]);
    if (path.length >= 2) paths.push(path);
  }
  return paths;
}

/**
 * One Landscape spline as an ordered world-space polyline.
 *
 * Ordered by walking the segments rather than by taking `points` as authored:
 * the point list is a set the segments index into, and an editor that inserts a
 * point mid-river appends it to that list. Reading the list in order would then
 * fold the river back on itself — a fault that only appears after an edit, which
 * is the worst time for it to appear.
 *
 * A spline with no segments (or one whose segments do not form a single chain)
 * falls back to the authored point order, which is what a freshly drawn spline
 * has anyway.
 */
function splineCentreline(
  spline: ForgeLandscapeSpline,
  originX: number,
  originZ: number,
): RtsRiverPath {
  const points = new Map(spline.points.map((point) => [point.id, point]));
  const segments = spline.segments ?? [];
  const authored = spline.points.map((point) => ({
    x: originX + point.position[0],
    z: originZ + point.position[2],
  }));
  if (segments.length === 0) return authored;
  const next = new Map(segments.map((segment) => [segment.startPointId, segment.endPointId]));
  const ends = new Set(segments.map((segment) => segment.endPointId));
  // The head is the point nothing arrives at. A closed loop has no such point;
  // any start will do there, so fall back to the first segment's.
  const head = segments.find((segment) => !ends.has(segment.startPointId))?.startPointId
    ?? segments[0]!.startPointId;
  const walked: { x: number; z: number }[] = [];
  const seen = new Set<string>();
  let current: string | undefined = head;
  while (current && !seen.has(current)) {
    seen.add(current);
    const point = points.get(current);
    if (!point) break;
    walked.push({ x: originX + point.position[0], z: originZ + point.position[2] });
    current = next.get(current);
  }
  // A chain that missed points means the segments branch or the ids disagree
  // with the point list; the authored order is the safer read at that point.
  return walked.length === spline.points.length ? walked : authored;
}

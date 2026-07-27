/**
 * Free starting road ring for a command centre.
 *
 * A centre is a logistics endpoint, not a road cell itself: its footprint must
 * remain clear for selection, navigation and visuals. This ring therefore sits
 * one road cell outside the footprint and gives every cardinal side an equally
 * valid attachment point.
 */
import type { RoadGraph, RoadPlan } from "./roadGraph";

export interface CenterRoadAnchor {
  readonly x: number;
  readonly z: number;
  readonly footprint: Readonly<{ width: number; depth: number }>;
}

/** Build a square perimeter whose cells are all outside, but touch, the centre. */
export function centerAccessRoadPlan(roads: RoadGraph, center: CenterRoadAnchor): RoadPlan {
  const step = roads.cellSize;
  const offsetX = center.footprint.width / 2 + step;
  const offsetZ = center.footprint.depth / 2 + step;
  const cells = [] as { x: number; z: number }[];
  const push = (x: number, z: number) => {
    const cell = roads.snapCell({ x, z });
    if (!cells.some((existing) => existing.x === cell.x && existing.z === cell.z)) cells.push(cell);
  };

  for (let x = center.x - offsetX; x <= center.x + offsetX; x += step) {
    push(x, center.z - offsetZ);
    push(x, center.z + offsetZ);
  }
  for (let z = center.z - offsetZ + step; z < center.z + offsetZ; z += step) {
    push(center.x - offsetX, z);
    push(center.x + offsetX, z);
  }

  const newCells = cells.filter((cell) => roads.cellAt(cell) === null);
  return { cells, newCells, woodCost: 0 };
}

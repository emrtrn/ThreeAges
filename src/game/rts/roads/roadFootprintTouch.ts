/**
 * Where a road may meet a footprint — the geometry behind "this building is on
 * the network".
 *
 * A road cell can never *overlap* a footprint: the footprint is a build blocker,
 * so `RoadGraph.plan` refuses to route through it. "Touching" therefore means the
 * first legal tile outside the blocked band — on any of the four sides — and
 * which grid line that is depends on how the footprint's centre happens to fall
 * on the road grid.
 *
 * That phase is the whole reason this module exists. The rule used to be a fixed
 * half-cell tolerance measured out from the footprint edge, which is exactly
 * right while every centre sits on the grid (every *building* does —
 * `snapToPlacementGrid`) and quietly wrong the moment one does not. An authored
 * trade site at z = 19.73 has its first pavable tile 3.73 away on one side and
 * 4.27 on the other: the near side passed the half-cell test, the far side
 * missed it by a quarter of a unit, and the river port could only ever be
 * connected from its north and east. Two of its four sides were unreachable and
 * nothing said so — the road was drawn, it simply did not count.
 *
 * So the bounds are derived from the grid rather than guessed with a tolerance:
 * per axis, the first grid line clear of the blocked band on each side. For a
 * grid-aligned footprint those are precisely the cells the half-cell test
 * accepted, which is why no building's behaviour moves.
 */
import type { RoadCell } from "./roadGraph";

export interface RoadFootprint {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
}

/**
 * Grid-noise guard. Road coordinates are multiples of `cellSize` and footprint
 * sizes are whole units, so nothing legitimate ever lands this close to a
 * boundary — it only absorbs the float error of the divide.
 */
export const ROAD_TOUCH_EPSILON = 1e-6;

/**
 * The two grid lines bracketing one axis of a footprint: the nearest cell centre
 * on each side that a road may actually occupy.
 *
 * A cell overlaps the footprint — and so is refused by the router — while
 * `|cell - centre| < size / 2 + cellSize / 2`. These are the first coordinates
 * outside that band in each direction, and they are what "touching" means.
 */
export function roadTouchLines(
  centre: number,
  size: number,
  cellSize: number,
): { readonly min: number; readonly max: number } {
  const reach = size / 2 + cellSize / 2;
  return {
    min: Math.floor((centre - reach) / cellSize + ROAD_TOUCH_EPSILON) * cellSize,
    max: Math.ceil((centre + reach) / cellSize - ROAD_TOUCH_EPSILON) * cellSize,
  };
}

/**
 * Whether one road cell sits on the ring of tiles that meet a footprint.
 *
 * Cells *inside* the ring are accepted too, exactly as the old tolerance
 * accepted them: they can never hold a committed road, because the router
 * refuses to pave a blocked tile, so excluding them would only add a case that
 * cannot arise.
 */
export function roadCellTouchesFootprint(
  cell: RoadCell,
  footprint: RoadFootprint,
  cellSize: number,
): boolean {
  const x = roadTouchLines(footprint.x, footprint.width, cellSize);
  const z = roadTouchLines(footprint.z, footprint.depth, cellSize);
  return cell.x >= x.min - ROAD_TOUCH_EPSILON && cell.x <= x.max + ROAD_TOUCH_EPSILON
    && cell.z >= z.min - ROAD_TOUCH_EPSILON && cell.z <= z.max + ROAD_TOUCH_EPSILON;
}

/**
 * Gap between a road tile's edge and the footprint's, in world units.
 *
 * Ranking only — never a test. Which of several touching tiles is "nearest" is a
 * tie-break for determinism; whether a tile touches at all is
 * {@link roadCellTouchesFootprint}'s answer, and measuring it with this number
 * is the mistake that cost the ports two sides.
 */
export function roadCellFootprintGap(
  cell: RoadCell,
  footprint: RoadFootprint,
  cellSize: number,
): number {
  const halfRoad = cellSize / 2;
  return Math.hypot(
    Math.max(0, Math.abs(cell.x - footprint.x) - footprint.width / 2 - halfRoad),
    Math.max(0, Math.abs(cell.z - footprint.z) - footprint.depth / 2 - halfRoad),
  );
}

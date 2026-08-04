/**
 * V4's producer→store line, expressed as a {@link CaravanLaneProvider} — supply
 * plan Faz S3, §3.4.
 *
 * Nothing here is new behaviour. Every rule in this file was inside
 * {@link CaravanSystem} until the trade sites needed a second kind of trip, and
 * it is all still exactly what it was: a completed producer that touches a road
 * reaching a usable store gets `spawnPerProducer` animals, the store is the
 * nearest usable depot or else the owner's command centre, and an occupied depot
 * is skipped in favour of the centre.
 *
 * The move is the whole point of the refactor: `CaravanSystem` stops naming
 * producers, and the knowledge of what a producer *is* comes back to the
 * economy's side of the wall.
 */
import { roadCellTouchingFootprint } from "../economy/depotLogisticsSystem";
import type { LogisticsOccupationSystem } from "../economy/logisticsOccupationSystem";
import type { ProductionLogisticsSystem } from "../economy/productionLogisticsSystem";
import type { CaravanBalance } from "../../data/gameDataTypes";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { CaravanDispatch, CaravanLane, CaravanLaneProvider } from "./caravanLane";

const PRODUCER_LANE_PREFIX = "producer:";

/** The lane id one producer ships on. The only place this string is built. */
export function producerLaneId(structureId: number): string {
  return `${PRODUCER_LANE_PREFIX}${structureId}`;
}

/** The producer behind a lane id, or null when the lane belongs to someone else. */
export function producerStructureIdFromLane(laneId: string): number | null {
  if (!laneId.startsWith(PRODUCER_LANE_PREFIX)) return null;
  const structureId = Number(laneId.slice(PRODUCER_LANE_PREFIX.length));
  return Number.isInteger(structureId) ? structureId : null;
}

export class ProducerCaravanLanes implements CaravanLaneProvider {
  constructor(
    private readonly balance: CaravanBalance,
    private readonly links: ProductionLogisticsSystem,
    private readonly roads: RoadGraph,
    private readonly structures: PlacedStructureSystem,
    private readonly centers: CommandCenterSystem,
    private readonly occupation?: LogisticsOccupationSystem,
    /** The live age × level shipment threshold; the match supplies it, not the table. */
    private readonly dispatchForProducer: (producerStructureId: number) => CaravanDispatch | null = () => null,
  ) {}

  lanes(): readonly CaravanLane[] {
    const lanes: CaravanLane[] = [];
    for (const link of this.links.snapshots()) {
      if (link.status !== "linked" || !link.roadCell) continue;
      lanes.push({
        id: producerLaneId(link.structureId),
        owner: link.owner,
        source: link.roadCell,
        // Deliberately kept as a lane with a null endpoint rather than dropped:
        // a kingdom that has just lost its last store still owes its in-flight
        // donkeys a walk home (see {@link CaravanLane.destination}).
        destination: this.destinationFor(link.owner, link.depotStructureId),
        caravanCount: this.balance.spawnPerProducer,
      });
    }
    return lanes;
  }

  /**
   * `claimed` is ignored, and that is V4's behaviour preserved rather than an
   * oversight: `spawnPerProducer` is 1, so a producer lane never has a second
   * animal to stagger against. If a project ever raises it, this is the line
   * that has to learn what {@link MarketSupplySystem.dispatch} already knows.
   */
  dispatch(lane: CaravanLane): CaravanDispatch | null {
    const structureId = producerStructureIdFromLane(lane.id);
    return structureId === null ? null : this.dispatchForProducer(structureId);
  }

  private destinationFor(owner: UnitOwner, depotStructureId: number | null): RoadCell | null {
    if (depotStructureId !== null && (this.occupation?.isUsable(depotStructureId) ?? true)) {
      const depot = this.structures.all().find((structure) => structure.id === depotStructureId);
      if (depot) return roadCellTouchingFootprint(this.roads, depot.x, depot.z, depot.stats.footprint.width, depot.stats.footprint.depth);
    }
    const center = this.centers.get(owner);
    return center
      ? roadCellTouchingFootprint(this.roads, center.position.x, center.position.z, center.stats.footprint.width, center.stats.footprint.depth)
      : null;
  }
}

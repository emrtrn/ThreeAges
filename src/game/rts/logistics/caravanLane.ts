/**
 * The lane a caravan runs on — supply plan (`THREEAGES_RTS_MARKET_SUPPLY_PLAN.md`)
 * Faz S3, §3.4.
 *
 * V4 gave the match one kind of donkey trip: a producer's, walking its output to
 * the kingdom's nearest store. {@link CaravanSystem} knew that by name — it read
 * {@link ProductionLogisticsSystem} directly, keyed its animals by structure id
 * and took its fleet size from one global tuning field. The supply plan brings a
 * second kind of trip (a trade site's, walking goods to a Market's shelf), and
 * the one thing it must not bring is a second state machine: two copies of
 * "load, walk, unload, walk home, and go home early when the road is cut" would
 * drift apart at the first bug fixed in only one of them.
 *
 * So the trip is named instead. A **lane** is the whole of what the carrier
 * needs — who owns it, which road cell it starts from, which it ends at, and how
 * many animals run it — and everything about *why* that lane exists stays with
 * the system that supplies it. `CaravanSystem` keeps the state machine, the
 * death window, {@link Caravan.beginReturnHome} and the route cache, in one copy.
 */
import type { RoadCell } from "../roads/roadGraph";
import type { UnitOwner } from "../units/unit";

/** One live source→store run, as the carrier sees it. */
export interface CaravanLane {
  /** Stable across ticks and unique across providers (`producer:12`, `supply:player_river_port`). */
  readonly id: string;
  readonly owner: UnitOwner;
  /** Road cell at the facility end — where the animals load and return to. */
  readonly source: RoadCell;
  /**
   * Road cell at the receiving end, or null when the lane momentarily has no
   * store to walk to (a kingdom that just lost the centre its producers shipped
   * to, with no depot to fall back on).
   *
   * Nullable rather than simply omitting the lane, and that is the one place
   * this abstraction is shaped by an existing behaviour rather than by taste:
   * V4 already let an in-flight donkey walk home in exactly this case, and a
   * lane that disappeared instead would delete it mid-road. The plan asks for
   * the producer line to survive the generalisation bit for bit (§7 Faz S3), so
   * "I still know where home is, I just have nowhere to take this" has to stay
   * expressible.
   */
  readonly destination: RoadCell | null;
  /**
   * Animals this lane keeps on its road. Per lane rather than global because
   * throughput is a property of the *route*, not of the species: a producer's
   * fleet comes from `logistics.json`'s `spawnPerProducer`, a trade site's from
   * its own row in `trade-sites.json` (plan §6.4).
   */
  readonly caravanCount: number;
}

/** Whether a lane's source has enough buffered goods to release its next animal. */
export interface CaravanDispatch {
  readonly carryCapacity: number;
  readonly ready: boolean;
  /** False only when the receiving end cannot accept this resource at all. */
  readonly canReceive: boolean;
}

/**
 * A system that owns some lanes and knows when they may load.
 *
 * Two ship: {@link ProducerCaravanLanes} (V4's producer→store line) and
 * {@link MarketSupplySystem} (the trade site→market line). Both answer the same
 * two questions and neither knows the other exists.
 */
export interface CaravanLaneProvider {
  /** Every lane that currently exists, recomputed from live world state. */
  lanes(): readonly CaravanLane[];
  /**
   * Load state for one of this provider's own lanes; null when it has gone away.
   *
   * `claimed` is how many of this lane's animals are already carrying a load
   * that has not been withdrawn yet, and it is asked per animal because a fleet
   * is not one decision. A load is only taken out of the source buffer *on
   * arrival* (KARAR 5 — a donkey turned back by a cut road must leave the goods
   * where it found them), so while a trip is in flight the buffer still shows
   * goods that are already spoken for. With one animal per lane, as V4 shipped,
   * that never mattered. With four it decides everything: asked once per lane,
   * all four would read the same "there is a full load waiting" and leave
   * together to deliver a single load between them, and the lane would run at a
   * quarter of its fleet.
   */
  dispatch(lane: CaravanLane, claimed: number): CaravanDispatch | null;
}

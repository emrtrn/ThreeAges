/**
 * Trade site → Market supply lanes — supply plan
 * (`THREEAGES_RTS_MARKET_SUPPLY_PLAN.md`) Faz S3.
 *
 * The twin of {@link ProductionLogisticsSystem} (plan §3.5), and deliberately
 * the *same query* with one end swapped: find the road cell that touches the
 * facility, find the owner's receiving building on that road network, and name
 * the state when either is missing. A producer's receiving building is a store;
 * a trade site's is a Market. Everything after that — the caravans, the load
 * threshold, the walk home on a cut road — is shared machinery
 * ({@link CaravanLaneProvider}), not a second copy.
 *
 * Two rules are this file's own, and both come from locked decisions:
 *
 * - **Exclusive, first-come (KARAR 4-A).** A site belongs to the first kingdom
 *   whose road reaches it, and stays that kingdom's while a route survives. The
 *   way to take a rival's port is to cut the road to it, which is a thing the
 *   game could already do — so this adds a target, not a mechanic.
 * - **Delivery lands on the shelf, never in the wallet (§1).** {@link deliver}
 *   credits {@link MarketStock}, so the goods are bought with gold like any
 *   other lot. A site produces the *right to buy*, not income; crediting the
 *   wallet here would make it a remote farm and the Market pointless.
 *
 * No renderer dependency, for the reason every system on this side of the wall
 * has none: the player, the headless AI and `test:engine` must run the identical
 * rule.
 */
import type { TradeSiteBalance } from "../../data/gameDataTypes";
import type { CaravanArrival, CaravanDispatch, CaravanLane, CaravanLaneProvider } from "../logistics/caravanSystem";
import type { RoadCell, RoadGraph } from "../roads/roadGraph";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import { roadCellsTouchingFootprint, roadLinkCellFor } from "./depotLogisticsSystem";
import type { MarketStock } from "./marketStock";
import type { TradeSiteSystem } from "./tradeSiteSystem";

const SUPPLY_LANE_PREFIX = "supply:";

/** The lane id one trade site ships on. The only place this string is built. */
export function supplyLaneId(siteId: string): string {
  return `${SUPPLY_LANE_PREFIX}${siteId}`;
}

/** The site behind a lane id, or null when the lane belongs to someone else. */
export function tradeSiteIdFromLane(laneId: string): string | null {
  return laneId.startsWith(SUPPLY_LANE_PREFIX) ? laneId.slice(SUPPLY_LANE_PREFIX.length) : null;
}

/**
 * What stands between one trade site and a Market, in the order a player fixes
 * it. Each is a different sentence with a different remedy — the same reason
 * {@link ProducerLogisticsStatus} names six states instead of returning a
 * boolean.
 *
 * `claimed-by-enemy` is the one that is never a *site's* state: a site has one
 * claimant, so being claimed by somebody else is a fact about the kingdom
 * asking. It is produced by {@link MarketSupplySystem.statusFor} alone.
 */
export type MarketSupplyStatus =
  | "unlinked-road"
  | "unlinked-market"
  | "outside-control"
  | "claimed-by-enemy"
  | "linked";

export interface MarketSupplySnapshot {
  readonly siteId: string;
  readonly siteType: string;
  readonly label: string;
  readonly resourceId: string;
  /** Where the site stands — what the fog test in {@link marketSupplyLines} asks about. */
  readonly x: number;
  readonly z: number;
  /** The kingdom holding this site, or null while nobody's road reaches it. */
  readonly owner: UnitOwner | null;
  readonly roadCell: RoadCell | null;
  /** Road cell at the Market this lane delivers to; null unless `linked`. */
  readonly marketRoadCell: RoadCell | null;
  readonly marketStructureId: number | null;
  readonly status: Exclude<MarketSupplyStatus, "claimed-by-enemy">;
  readonly caravanCount: number;
  readonly carryCapacity: number;
  readonly buffered: number;
  readonly bufferCapacity: number;
}

/**
 * One kingdom's reading of a trade site — supply plan Faz S5.
 *
 * Deliberately *not* {@link MarketSupplyStatus}. That type names what stands
 * between a site and a market, in the order an engineer fixes it; this one names
 * what the player has to do about it, and the two do not line up. A besieged
 * market and a cut road are different rows of the status table and the same
 * sentence here ("nothing is arriving from a site that used to feed you"),
 * while `unlinked-road` splits in two depending on whether that road was ever
 * there.
 *
 * - `supplying` — this kingdom holds it and goods are moving.
 * - `cut` — it fed this kingdom before and does not now. The distinguishing fact
 *   is history, not geometry: a road that broke and a road never drawn look
 *   identical in the graph, and only one of them means "repair it".
 * - `unclaimed` — nobody visibly holds it; the remedy is to pave.
 * - `rival` — somebody else holds it, and this kingdom has seen the ground.
 */
export type MarketSupplyState = "supplying" | "cut" | "unclaimed" | "rival";

/**
 * The state one *resource's* buy button is in, resolved across every site that
 * could feed it. See {@link marketSupplyLines}; `absent` is the extra case that
 * belongs to a resource rather than to a site — no site of that kind is authored
 * on this map at all, so no road will ever open that button.
 */
export type MarketSupplyLineState = MarketSupplyState | "absent";

export interface MarketSupplyLine {
  readonly resourceId: string;
  readonly state: MarketSupplyLineState;
  /** The site the sentence is about; null only when `absent`. */
  readonly siteId: string | null;
  readonly siteLabel: string | null;
}

/**
 * How one kingdom reads one site.
 *
 * **The fog rule, and the reason it is here rather than in the view.** A trade
 * site is a static world object — the tree/deposit twin (plan Faz S5): its art
 * is cut against the explored fog like every other authored mesh
 * (`vision/fogMask.ts`), so what a kingdom *knows* about it has to stop at the
 * same line. A rival's claim on ground this kingdom has never scouted therefore
 * reads as `unclaimed`, which is exactly what an unscouted map looks like: go
 * and pave, and find out. Without this the Market panel would quietly report
 * enemy activity in the dark — a scouting result for free, from a building
 * standing in your own base.
 *
 * `everSupplied` is the caller's memory, not this module's, because "has this
 * ever fed me" is a fact about the match rather than about the world: the road
 * graph cannot recover it once the road is gone, which is the whole reason `cut`
 * needs to be told.
 */
export function siteSupplyState(
  site: MarketSupplySnapshot,
  reader: UnitOwner,
  everSupplied: boolean,
  explored: boolean,
): MarketSupplyState {
  if (site.owner === reader) return site.status === "linked" ? "supplying" : "cut";
  if (site.owner !== null) return explored ? "rival" : "unclaimed";
  return everSupplied ? "cut" : "unclaimed";
}

/**
 * Rank for {@link marketSupplyLines}: the best news a resource has wins.
 *
 * `rival` ranks *last*, below `unclaimed`, and that ordering is load-bearing on
 * a map authored in point-symmetric pairs (plan §3.7). Two sites feed every
 * resource, one on each bank; if the opponent holds theirs and the near one is
 * still free, the sentence the player needs is "pave to yours", not "the enemy
 * has it". `rival` is the last resort — it means every site that could feed this
 * resource is somebody else's.
 */
const SUPPLY_LINE_RANK: Readonly<Record<MarketSupplyLineState, number>> = {
  supplying: 0,
  cut: 1,
  unclaimed: 2,
  rival: 3,
  absent: 4,
};

/**
 * One line per stocked resource, for the Market panel — supply plan Faz S5.
 *
 * Pure, and given the world rather than reaching for it, so `test:engine` can
 * hold "a cut road says repair, an unpaved one says pave" to account without a
 * running match. The panel turns each line into a sentence; it never re-derives
 * one from the raw snapshots.
 *
 * @param resourceIds the market's stocked list, in its own order — a resource
 *   with no site authored anywhere still gets a line, because "this map has no
 *   port" is the one supply answer a player can never fix and must be told.
 */
export function marketSupplyLines(
  snapshots: readonly MarketSupplySnapshot[],
  reader: UnitOwner,
  resourceIds: readonly string[],
  options: {
    /** Sites that have fed `reader` at least once this match. */
    readonly everSupplied?: ReadonlySet<string>;
    /** §59's explored test; omitted (fog off) means everything is known. */
    readonly isExplored?: (x: number, z: number) => boolean;
  } = {},
): readonly MarketSupplyLine[] {
  return resourceIds.map((resourceId) => {
    let best: MarketSupplyLine = { resourceId, state: "absent", siteId: null, siteLabel: null };
    for (const site of snapshots) {
      if (site.resourceId !== resourceId) continue;
      const state = siteSupplyState(
        site,
        reader,
        options.everSupplied?.has(site.siteId) ?? false,
        options.isExplored?.(site.x, site.z) ?? true,
      );
      if (SUPPLY_LINE_RANK[state] >= SUPPLY_LINE_RANK[best.state]) continue;
      best = { resourceId, state, siteId: site.siteId, siteLabel: site.label };
    }
    return best;
  });
}

export class MarketSupplySystem implements CaravanLaneProvider {
  /**
   * Who holds each site. The only mutable state here — every other answer is
   * recomputed from the world — and it exists precisely because "first to
   * connect" is a fact about history that the current road graph cannot recover:
   * once both kingdoms have a route, nothing in the geometry says who arrived
   * first.
   */
  private readonly claims = new Map<string, UnitOwner>();

  constructor(
    private readonly balance: TradeSiteBalance,
    private readonly sites: TradeSiteSystem,
    private readonly roads: RoadGraph,
    private readonly structures: PlacedStructureSystem,
    private readonly stock: MarketStock,
    /** KR-M4's predicate: a Market on ground its owner has lost cannot receive. */
    private readonly isMarketConnected: (structure: PlacedStructure) => boolean = () => true,
  ) {}

  snapshots(): readonly MarketSupplySnapshot[] {
    const markets = this.completedMarkets();
    return this.sites.snapshots().map((site) => {
      const stats = this.balance[site.siteType];
      // Unreachable: TradeSiteSystem refuses an unknown site type in its own
      // constructor, which is where that mistake is loud (Faz S2).
      if (!stats) throw new Error(`Trade site "${site.id}" references unknown site type "${site.siteType}"`);
      const base = {
        siteId: site.id,
        siteType: site.siteType,
        label: site.label,
        resourceId: site.resourceId,
        x: site.x,
        z: site.z,
        caravanCount: stats.caravanCount,
        carryCapacity: stats.carryCapacity,
        buffered: site.buffered,
        bufferCapacity: site.bufferCapacity,
      };
      // A trade site is nobody's ground, so its dock cells stay ownership-blind:
      // whichever kingdoms have paved up to it are all candidates, and which one
      // holds it is decided below by who can actually run a route.
      const dockCells = roadCellsTouchingFootprint(this.roads, site.x, site.z, stats.dock.width, stats.dock.depth);
      const roadCell = dockCells[0] ?? null;
      if (!roadCell) {
        this.claims.delete(site.id);
        return { ...base, owner: null, roadCell: null, marketRoadCell: null, marketStructureId: null, status: "unlinked-road" as const };
      }
      const reachable = markets
        .map((market) => ({ market, cell: this.roadCellFor(market) }))
        .filter((candidate): candidate is { market: PlacedStructure; cell: RoadCell } => candidate.cell !== null)
        // Asked from each Market's own side: a trade site is reached over roads
        // that Market's kingdom may actually use, not over the rival's spine.
        // Both kingdoms can have a dock cell of their own, so each starts from
        // the one it may stand on rather than from a single shared tile.
        .map((candidate) => ({
          ...candidate,
          route: dockCells
            .map((dock) => this.roads.route(dock, candidate.cell, candidate.market.owner))
            .find((route): route is readonly RoadCell[] => route !== null) ?? null,
        }))
        .filter((candidate): candidate is { market: PlacedStructure; cell: RoadCell; route: readonly RoadCell[] } => candidate.route !== null);
      if (reachable.length === 0) {
        this.claims.delete(site.id);
        return { ...base, owner: null, roadCell, marketRoadCell: null, marketStructureId: null, status: "unlinked-market" as const };
      }
      // The claim survives on the *route*, not on the control: a besieged Market
      // stops receiving, but it does not hand the site to the besieger. Losing
      // the site is what losing the road means (KARAR 4-A), and keeping the two
      // separate is what makes cutting the road the way to take it.
      const holder = this.claims.get(site.id);
      const heldStill = holder !== undefined && reachable.some((candidate) => candidate.market.owner === holder);
      const deliverable = reachable.filter((candidate) => this.isMarketConnected(candidate.market));
      const owner = heldStill
        ? holder
        : deliverable[0]?.market.owner ?? null;
      if (owner === null) {
        // Somebody's road is here but nobody has a Market that may receive.
        return { ...base, owner: null, roadCell, marketRoadCell: null, marketStructureId: null, status: "outside-control" as const };
      }
      this.claims.set(site.id, owner);
      const endpoint = deliverable
        .filter((candidate) => candidate.market.owner === owner)
        .sort((left, right) => left.route.length - right.route.length || left.market.id - right.market.id)[0];
      if (!endpoint) {
        // The holder still has a route but not a usable Market at the end of it.
        return { ...base, owner, roadCell, marketRoadCell: null, marketStructureId: null, status: "outside-control" as const };
      }
      return {
        ...base,
        owner,
        roadCell,
        marketRoadCell: endpoint.cell,
        marketStructureId: endpoint.market.id,
        status: "linked" as const,
      };
    });
  }

  /** One site's state as a given kingdom sees it — where `claimed-by-enemy` lives. */
  statusFor(siteId: string, owner: UnitOwner): MarketSupplyStatus | null {
    const snapshot = this.snapshots().find((candidate) => candidate.siteId === siteId);
    if (!snapshot) return null;
    if (snapshot.owner !== null && snapshot.owner !== owner) return "claimed-by-enemy";
    return snapshot.status;
  }

  lanes(): readonly CaravanLane[] {
    const lanes: CaravanLane[] = [];
    for (const site of this.snapshots()) {
      if (site.status !== "linked" || site.owner === null || !site.roadCell) continue;
      lanes.push({
        id: supplyLaneId(site.siteId),
        owner: site.owner,
        source: site.roadCell,
        destination: site.marketRoadCell,
        caravanCount: site.caravanCount,
      });
    }
    return lanes;
  }

  /**
   * A supply animal loads on the site's own buffer and never on a full-store
   * check: the shelf is not a wallet, so there is no storage ceiling to pause
   * for (plan §3.10). The only thing that can hold a donkey here is a buffer
   * that has not yet made a load *this* animal can claim.
   *
   * Hence the `claimed + 1`: the site must hold a full load for every trip
   * already in flight plus this one, because none of those loads has been taken
   * out of the buffer yet. Without it a four-donkey lane leaves as a herd on the
   * first 30 units and delivers 30 between them; with it the fleet staggers, and
   * the lane's throughput settles at whatever `perMinute` actually is — which is
   * the knob the plan wants the acceptance match to be reading.
   *
   * Read straight off the site rather than out of {@link snapshots}: this is
   * asked once per animal per tick, and the snapshot pass routes roads.
   */
  dispatch(lane: CaravanLane, claimed: number): CaravanDispatch | null {
    const siteId = tradeSiteIdFromLane(lane.id);
    if (siteId === null) return null;
    const stats = this.sites.statsFor(siteId);
    if (!stats) return null;
    return {
      carryCapacity: stats.carryCapacity,
      canReceive: true,
      ready: this.sites.bufferedAt(siteId) >= stats.carryCapacity * (claimed + 1),
    };
  }

  /**
   * Put an arrived load on the claiming kingdom's shelf.
   *
   * The owner check is not ceremony: a site whose claim changed hands while a
   * donkey was walking must not deliver to whoever it set out for, or cutting a
   * road would still pay the kingdom that lost it.
   */
  deliver(arrivals: readonly CaravanArrival[]): void {
    for (const arrival of arrivals) {
      const siteId = tradeSiteIdFromLane(arrival.laneId);
      if (siteId === null) continue;
      // Checked against the claim rather than against a fresh {@link snapshots}
      // pass: the claim is the same authority the pass writes, and it was
      // refreshed by {@link lanes} earlier in this very tick — a caravan cannot
      // arrive on a lane that was not offered. Re-deriving it here would route
      // every site's road a second time per frame to reach the same answer.
      const owner = this.claims.get(siteId);
      if (owner === undefined || owner !== arrival.owner) continue;
      const stats = this.sites.statsFor(siteId);
      if (!stats) continue;
      const delivered = this.sites.withdrawBuffered(siteId, arrival.carryCapacity);
      if (delivered <= 0) continue;
      this.stock.credit(owner, stats.resourceId, delivered);
    }
  }

  /** A new match hands every site back to nobody. */
  reset(): void {
    this.claims.clear();
  }

  private completedMarkets(): readonly PlacedStructure[] {
    return this.structures.all()
      .filter((structure) => structure.stats.market && structure.construction.complete)
      // Deterministic first-claim order when two kingdoms connect on the same
      // tick: whichever Market was placed first. Arbitrary, but arbitrary and
      // *stable* is what a replay and the test suite both need.
      .sort((left, right) => left.id - right.id);
  }

  private roadCellFor(market: PlacedStructure): RoadCell | null {
    return roadLinkCellFor(
      this.roads,
      market.owner,
      market.x,
      market.z,
      market.stats.footprint.width,
      market.stats.footprint.depth,
    );
  }
}

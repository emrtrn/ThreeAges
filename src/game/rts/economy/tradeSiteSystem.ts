/**
 * Trade sites — supply plan (`THREEAGES_RTS_MARKET_SUPPLY_PLAN.md`) Faz S2.
 *
 * The river port, the independent timber camp and the stone pit: the three
 * places on the map where the goods a Market sells actually come from. A site is
 * authored, never built; it needs no worker, costs no population, cannot be
 * demolished and cannot be repaired (KARAR 3-A). The only decision it asks of a
 * kingdom is whether to run a road out to it.
 *
 * This phase gives it exactly one behaviour: the buffer fills at the site's own
 * rate and **stops** when full. Nothing collects it yet — Faz S3 attaches the
 * caravan lane that carries a load to the market's shelf — so the economy plays
 * bit for bit as it did before this file existed. Filling first is deliberate:
 * it puts the throughput knob on the map where it can be looked at before
 * anything depends on it.
 *
 * Sibling of {@link ResourceNodeSystem}, and for the same reason: no renderer
 * dependency, so the player, the headless AI and `test:engine` all run the
 * identical rule.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { TradeSiteBalance, TradeSiteBalanceStats } from "../../data/gameDataTypes";

/**
 * One authored trade site. The Level says only *where* it stands and *which
 * kind* it is; throughput, buffer, fleet size and dock size are the balance
 * table's (supply plan §5.3), so retuning a site never means reopening a level.
 */
export interface RtsTradeSiteDefinition {
  /** Stable per-site id, unique across the map (`player_river_port`). */
  readonly id: string;
  /** Key into `balance/trade-sites.json` — the *kind* of site this is. */
  readonly siteType: string;
  readonly x: number;
  readonly z: number;
}

export interface TradeSiteSnapshot extends RtsTradeSiteDefinition {
  readonly label: string;
  readonly resourceId: string;
  /** Goods standing at the site, waiting for a caravan that arrives in Faz S3. */
  readonly buffered: number;
  readonly bufferCapacity: number;
  /**
   * Production has stalled because there is nowhere to put the next unit — the
   * producer's `buffer-full`, and the signal that reads as "add a caravan or move
   * your market closer" (plan §3.8).
   */
  readonly bufferFull: boolean;
}

interface TradeSiteRecord {
  readonly definition: RtsTradeSiteDefinition;
  readonly stats: TradeSiteBalanceStats;
  buffered: number;
}

export class TradeSiteSystem {
  private readonly sites = new Map<string, TradeSiteRecord>();

  /**
   * @throws when a site names a kind the balance table does not define. Loud on
   *   purpose: a typo'd `siteType` would otherwise become a marker standing on
   *   the map that supplies nothing, and the player's road out to it would be
   *   wood spent on a place that can never fill.
   */
  constructor(balance: TradeSiteBalance, definitions: readonly RtsTradeSiteDefinition[]) {
    for (const definition of definitions) {
      if (this.sites.has(definition.id)) throw new Error(`Duplicate trade site "${definition.id}"`);
      const stats = balance[definition.siteType];
      if (!stats) {
        throw new Error(`Trade site "${definition.id}" references unknown site type "${definition.siteType}"`);
      }
      this.sites.set(definition.id, { definition, stats, buffered: 0 });
    }
  }

  /** Fill every site's buffer at its own rate, up to — never past — its cap. */
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Trade site update needs a non-negative finite delta");
    }
    if (deltaSeconds === 0) return;
    for (const site of this.sites.values()) {
      if (site.buffered >= site.stats.bufferCapacity) continue;
      site.buffered = Math.min(
        site.stats.bufferCapacity,
        site.buffered + (site.stats.perMinute / 60) * deltaSeconds,
      );
    }
  }

  /**
   * Ground every site reserves against building placement and road cells — the
   * twin of {@link ResourceNodeSystem.liveNodeBlockers}, and reserved for the
   * same reason turned inside out.
   *
   * A deposit is protected because a building on top of it buries the yield. A
   * dock is protected because it *is* the site's footprint: the road has to
   * touch it from outside exactly as it touches a producer's, so a road paved
   * across it, or a warehouse parked on it, would take away the one edge the
   * supply lane connects through.
   *
   * Like the deposits, this stays out of unit navigation: soldiers walk over a
   * dock, they simply cannot build on it.
   */
  dockBlockers(): readonly NavBlocker[] {
    const blockers: NavBlocker[] = [];
    for (const { definition, stats } of this.sites.values()) {
      blockers.push({
        min: [definition.x - stats.dock.width / 2, 0, definition.z - stats.dock.depth / 2],
        max: [definition.x + stats.dock.width / 2, 3, definition.z + stats.dock.depth / 2],
      });
    }
    return blockers;
  }

  /** Goods waiting at one site, or 0 when nothing is authored under that id. */
  bufferedAt(siteId: string): number {
    return this.sites.get(siteId)?.buffered ?? 0;
  }

  snapshots(): readonly TradeSiteSnapshot[] {
    return [...this.sites.values()]
      .map(({ definition, stats, buffered }): TradeSiteSnapshot => ({
        ...definition,
        label: stats.label,
        resourceId: stats.resourceId,
        buffered,
        bufferCapacity: stats.bufferCapacity,
        bufferFull: buffered >= stats.bufferCapacity,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  /** A new match starts every site empty, as a restart clears every other buffer. */
  reset(): void {
    for (const site of this.sites.values()) site.buffered = 0;
  }
}

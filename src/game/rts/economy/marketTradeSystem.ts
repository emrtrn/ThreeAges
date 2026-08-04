/**
 * Market trading — `docs/planned/THREEAGES_MARKET_TRADE_PLAN.md` Faz M2.
 *
 * {@link MarketPrices} owns the economics and nothing else; this is the layer
 * that couples it to a match: which buildings may trade, whose stockpile pays,
 * and in what order a refused trade is explained. The split is the same one
 * {@link BarracksProductionSystem} draws — the rule about *whether* an order is
 * legal lives with the system that owns the resource it touches, never in the
 * panel that draws the button.
 *
 * Two decisions from the plan are load-bearing here:
 *
 * - **KR-M2, prices per kingdom.** Each owner keeps its own price table, so one
 *   kingdom's buying spree cannot move another's rates. AoE2 shares prices
 *   across players; with no AI trader (KR-M6) the difference is unobservable,
 *   and per-kingdom state is the deterministic, isolated version to start from.
 * - **KR-M4, control not logistics.** A trade is abstract — it moves global
 *   stock, with no cart and no road. The one thing it does need is ground: a
 *   Market standing outside its owner's control area cannot trade, the same
 *   severance the Barracks lives under, which is what makes besieging one mean
 *   something.
 *
 * Nothing here names the `market` building id. A building trades because its
 * balance declares a `market` block, so a fork renaming or adding one gets the
 * behaviour from data alone.
 */
import type { BuildingBalance, MarketBalance } from "../../data/gameDataTypes";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";

import { MarketPrices, NUMERAIRE_RESOURCE_ID, type MarketPriceSnapshot } from "./marketPricing";
import { MarketStock } from "./marketStock";
import type { ResourceCapacitySystem } from "./resourceCapacitySystem";

/**
 * Why a trade did or did not happen. Distinct causes rather than a boolean: the
 * panel turns each into its own sentence, and "you have no Market" and "your
 * Market is besieged" are different problems with different fixes.
 */
export type MarketTradeResult =
  | "traded"
  | "untraded-resource"
  | "no-completed-market"
  | "disconnected"
  | "out-of-stock"
  | "insufficient-gold"
  | "insufficient-resources"
  | "storage-full";

/** A market's live rates plus the terms they were quoted under. */
export interface MarketTradeSnapshot {
  readonly lotSize: number;
  /** The house's spread at this market, 0..1. */
  readonly commission: number;
  readonly prices: readonly MarketPriceSnapshot[];
  /**
   * Goods on hand for the resources this project marks as stocked (KARAR 8),
   * keyed by resource id. A resource *absent* from this record buys the old
   * way — out of gold alone — so the panel reads "no key" as "not gated",
   * never as "empty".
   */
  readonly stock: Readonly<Record<string, number>>;
}

/**
 * The spread one Market charges at its current tier. Centre-led progression sets
 * {@link PlacedStructure.marketCommission} from the active age × level tier, so
 * that live value wins; the base commission is only the fallback for a Market
 * with no progression entry yet (e.g. before its first tier is applied).
 */
export function marketCommission(structure: PlacedStructure, baseCommission: number): number {
  if (structure.marketCommission !== null) return structure.marketCommission;
  return structure.stats.market?.commission ?? baseCommission;
}

export class MarketTradeSystem {
  /** KR-M2: one price table per kingdom, created on first use. */
  private readonly pricesByOwner = new Map<UnitOwner, MarketPrices>();
  private readonly balance: MarketBalance | null;
  /**
   * Goods on hand, per kingdom (supply plan Faz S1). Owned here rather than
   * injected so that {@link reset} clears prices and stock together — a new
   * match must not start with the last one's deliveries still sitting on the
   * counter. Public because the supply chain (Faz S3) credits it on arrival;
   * it is the one thing outside this class allowed to make stock grow.
   */
  readonly stock = new MarketStock();

  constructor(
    buildingBalance: BuildingBalance,
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
    /** KR-M4: the same control-area predicate the Barracks is severed by. */
    private readonly isStructureConnected: (structure: PlacedStructure) => boolean = () => true,
    private readonly capacity?: ResourceCapacitySystem,
  ) {
    // First trading building wins. The template ships exactly one; a project
    // that wants two markets with different rates needs a per-building table,
    // which is a change to make when something actually asks for it.
    this.balance = Object.values(buildingBalance).find((stats) => stats.market)?.market ?? null;
  }

  /** False when this project's data defines no trading building at all. */
  get enabled(): boolean {
    return this.balance !== null;
  }

  /** Live rates for a kingdom, or null when nothing trades in this project. */
  snapshotFor(owner: UnitOwner): MarketTradeSnapshot | null {
    const balance = this.balance;
    if (!balance) return null;
    const commission = this.commissionFor(owner);
    // Only stocked resources get a key, and every one of them gets one even at
    // zero: the panel needs "empty" and "not gated" to be different states, and
    // an omitted zero would collapse them into the same missing key.
    const stock: Record<string, number> = {};
    for (const resourceId of balance.stocked) {
      stock[resourceId] = this.stock.amount(owner, resourceId);
    }
    return {
      lotSize: balance.lotSize,
      commission,
      prices: this.pricesFor(owner).snapshot(commission),
      stock,
    };
  }

  /** True when this project's data makes the resource's buy side need supply. */
  requiresStock(resourceId: string): boolean {
    return this.balance?.stocked.includes(resourceId) ?? false;
  }

  /**
   * The spread this kingdom trades at — Faz M3, the level system's payoff.
   *
   * The *best* rate any of its usable Markets offers, not the selected
   * building's: a kingdom that has paid for a Lv3 Market has bought that rate,
   * and charging it Lv1 terms because it happened to click an older Market
   * would make the upgrade's benefit depend on which building the panel is
   * open on. Only completed, connected Markets count, for the same reason they
   * are the only ones that may trade at all (KR-M4).
   */
  commissionFor(owner: UnitOwner): number {
    const base = this.balance?.commission ?? 0;
    const rates = this.usableMarkets(owner).map((structure) => marketCommission(structure, base));
    return rates.length === 0 ? base : Math.min(...rates);
  }

  /**
   * Buy one lot of a resource for gold. The price is read *before* the wallet is
   * touched and the index moves only after it agrees, so a refused trade leaves
   * the market exactly as it found it — a rejected buy that had already pushed
   * the price up would let a broke player move the market for free.
   *
   * The supply plan changes exactly one thing here: a *stocked* resource is also
   * taken off the market's own shelf, so a lot bought is a lot somebody carried
   * (§1). Everything else — the gates, their order, the price move — is
   * untouched, and a resource this project leaves unstocked still buys out of
   * gold alone.
   *
   * `out-of-stock` is checked before storage and gold because the gates read
   * outside-in: whether the goods exist at all is the market's business and
   * comes first; whether this kingdom can hold them or pay for them is the
   * kingdom's, and there is no sense telling a player they are short of gold for
   * a lot that was never on the shelf.
   */
  buy(owner: UnitOwner, resourceId: string): MarketTradeResult {
    const prices = this.pricesFor(owner);
    if (!prices.trades(resourceId)) return "untraded-resource";
    const gate = this.tradeGate(owner);
    if (gate) return gate;
    const price = prices.buyPrice(resourceId, this.commissionFor(owner));
    if (price === null) return "untraded-resource";
    const stocked = this.requiresStock(resourceId);
    if (stocked && this.stock.amount(owner, resourceId) < prices.lotSize) {
      return "out-of-stock";
    }
    const { wallet } = this.kingdoms.get(owner);
    if (this.capacity && this.capacity.availableFor(owner, resourceId, wallet.amount(resourceId)) < prices.lotSize) {
      return "storage-full";
    }
    if (!wallet.exchange(NUMERAIRE_RESOURCE_ID, price, resourceId, prices.lotSize)) {
      return "insufficient-gold";
    }
    // Cannot come up short: the check above proved the shelf holds a lot, and
    // the only thing between the two is a wallet exchange, which touches no
    // stock. Drawing down after the wallet agrees keeps the refusal paths
    // above free of anything to undo.
    if (stocked) this.stock.withdraw(owner, resourceId, prices.lotSize);
    prices.recordBuy(resourceId);
    return "traded";
  }

  /**
   * Sell one lot of a resource for gold.
   *
   * Deliberately untouched by the supply plan (KARAR 7-A): a sale takes goods
   * out of the game and must not land on the market's shelf. Crediting stock
   * here would let a kingdom fill its own market with no road and no caravan —
   * not for profit, which {@link assertNoArbitrage} already forbids, but by
   * skipping the supply chain altogether, which is the one thing the plan is
   * for.
   */
  sell(owner: UnitOwner, resourceId: string): MarketTradeResult {
    const prices = this.pricesFor(owner);
    if (!prices.trades(resourceId)) return "untraded-resource";
    const gate = this.tradeGate(owner);
    if (gate) return gate;
    const price = prices.sellPrice(resourceId, this.commissionFor(owner));
    if (price === null) return "untraded-resource";
    const { wallet } = this.kingdoms.get(owner);
    if (this.capacity && this.capacity.availableFor(owner, NUMERAIRE_RESOURCE_ID, wallet.amount(NUMERAIRE_RESOURCE_ID)) < price) {
      return "storage-full";
    }
    if (!wallet.exchange(resourceId, prices.lotSize, NUMERAIRE_RESOURCE_ID, price)) {
      return "insufficient-resources";
    }
    prices.recordSell(resourceId);
    return "traded";
  }

  /** True when this kingdom owns a completed Market inside its control area. */
  canTrade(owner: UnitOwner): boolean {
    return this.tradeGate(owner) === null;
  }

  /** A new match trades at the opening rate, with every market's shelf bare. */
  reset(): void {
    for (const prices of this.pricesByOwner.values()) prices.reset();
    this.stock.reset();
  }

  /**
   * The building-side refusals, in the order the panel wants to say them: owning
   * nothing is reported before losing the ground under what you do own.
   */
  private tradeGate(owner: UnitOwner): MarketTradeResult | null {
    const markets = this.structures.ownedBy(owner)
      .filter((structure) => structure.stats.market && structure.construction.complete);
    if (markets.length === 0) return "no-completed-market";
    if (!markets.some((structure) => this.isStructureConnected(structure))) return "disconnected";
    return null;
  }

  /** Completed Markets standing on ground this kingdom still holds. */
  private usableMarkets(owner: UnitOwner): readonly PlacedStructure[] {
    return this.structures.ownedBy(owner).filter((structure) => structure.stats.market
      && structure.construction.complete
      && this.isStructureConnected(structure));
  }

  private pricesFor(owner: UnitOwner): MarketPrices {
    const existing = this.pricesByOwner.get(owner);
    if (existing) return existing;
    if (!this.balance) throw new Error("This project's building balance defines no market");
    const prices = new MarketPrices(this.balance);
    this.pricesByOwner.set(owner, prices);
    return prices;
  }
}

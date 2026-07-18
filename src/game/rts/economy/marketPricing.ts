/**
 * Market price core — supply-and-demand trade pricing.
 *
 * See `docs/planned/THREEAGES_MARKET_TRADE_PLAN.md`. This module is the whole
 * economic model and nothing else: no wallet, no structures, no Three.js. The
 * wallet-coupled trade system (Faz M2) sits on top and is the only thing that
 * moves resources; keeping the pricing pure is what lets `test:engine` hold the
 * one property that matters — that the market cannot mint gold — to account
 * without a running match.
 *
 * ## The model
 *
 * Gold is the numeraire, so it carries no price of its own. Each tradable
 * resource has a price *index* starting at 1.0, and one lot costs
 * `basePrice * index` gold before the house's commission. Buying a resource
 * pushes its index up by `priceStep`; selling pushes it down. This is the whole
 * of "supply and demand": a player who keeps buying wood makes wood dearer, so
 * the same gold buys less of it — which is what "gold weakened against wood"
 * means when gold is the unit of account.
 *
 * ## Why buy rounds up and sell rounds down
 *
 * Prices are whole gold. Rounding both sides to nearest would let a rounding
 * step pay for a round trip at small indices, so the house always takes the
 * rounding: {@link buyPrice} ceils and {@link sellPrice} floors. This only ever
 * widens the spread the no-arbitrage invariant already guarantees, never
 * narrows it.
 */
import type { MarketBalance } from "../../data/gameDataTypes";

/** One resource's live market state, as the panel and the AI read it. */
export interface MarketPriceSnapshot {
  readonly resourceId: string;
  /** Live price index; 1.0 is the opening rate. */
  readonly index: number;
  /** Gold the player pays for one lot right now. */
  readonly buyPrice: number;
  /** Gold the player receives for one lot right now. */
  readonly sellPrice: number;
  /** True when the index sits at its floor/ceiling and cannot move further. */
  readonly atFloor: boolean;
  readonly atCeiling: boolean;
}

const OPENING_INDEX = 1;

/**
 * The unit of account. Everything is priced in it and it is never priced
 * itself — `validateMarketBalance` refuses a `basePrice.gold` entry for exactly
 * that reason, so this constant and that rule must name the same resource.
 */
export const NUMERAIRE_RESOURCE_ID = "gold";

/**
 * Binary floating point decides prices here, and it is off by ulps in ways a
 * player sees: `100 * (1 + 0.12)` is 112.00000000000001, so ceiling it charges
 * 113 gold for a 112-gold lot — a Market that quotes one price and takes
 * another. Snapping to nine decimals before the deliberate ceil/floor removes
 * the artefact without touching the intended rounding: the correction is ~1e-9
 * against a spread the no-arbitrage invariant keeps orders of magnitude wider.
 */
function settle(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export class MarketPrices {
  /** Price index per tradable resource. Keyed by resource id. */
  private readonly indices = new Map<string, number>();

  constructor(private readonly balance: MarketBalance) {
    this.reset();
  }

  /** Resources this market trades, in the data's own order. */
  tradableResourceIds(): string[] {
    return Object.keys(this.balance.basePrice);
  }

  trades(resourceId: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.balance.basePrice, resourceId);
  }

  /** Units moved by one trade. */
  get lotSize(): number {
    return this.balance.lotSize;
  }

  index(resourceId: string): number {
    return this.indices.get(resourceId) ?? OPENING_INDEX;
  }

  /**
   * Gold for one lot, before the spread. Null when the resource is not traded —
   * a caller asking about gold, or about a resource this market does not price,
   * gets an explicit "no" rather than a plausible number.
   */
  private rawPrice(resourceId: string): number | null {
    const base = this.balance.basePrice[resourceId];
    if (base === undefined) return null;
    return base * this.index(resourceId);
  }

  /** Gold the player pays for one lot, commission included. Null when untraded. */
  buyPrice(resourceId: string, commission = this.balance.commission): number | null {
    const raw = this.rawPrice(resourceId);
    if (raw === null) return null;
    return Math.ceil(settle(raw * (1 + commission)));
  }

  /** Gold the player receives for one lot, commission deducted. Null when untraded. */
  sellPrice(resourceId: string, commission = this.balance.commission): number | null {
    const raw = this.rawPrice(resourceId);
    if (raw === null) return null;
    return Math.max(0, Math.floor(settle(raw * (1 - commission))));
  }

  /**
   * Move the price after a completed buy. Called by the trade system *after* the
   * wallet has agreed, never as a way to ask whether a trade is legal.
   */
  recordBuy(resourceId: string): void {
    this.shift(resourceId, this.balance.priceStep);
  }

  /** Move the price after a completed sell. */
  recordSell(resourceId: string): void {
    this.shift(resourceId, -this.balance.priceStep);
  }

  snapshot(commission = this.balance.commission): MarketPriceSnapshot[] {
    return this.tradableResourceIds().map((resourceId) => {
      const index = this.index(resourceId);
      return {
        resourceId,
        index,
        buyPrice: this.buyPrice(resourceId, commission) ?? 0,
        sellPrice: this.sellPrice(resourceId, commission) ?? 0,
        atFloor: index <= this.balance.indexMin,
        atCeiling: index >= this.balance.indexMax,
      };
    });
  }

  /** Back to the opening rate; a new match trades at 1.0 across the board. */
  reset(): void {
    this.indices.clear();
    for (const resourceId of Object.keys(this.balance.basePrice)) {
      this.indices.set(resourceId, OPENING_INDEX);
    }
  }

  private shift(resourceId: string, delta: number): void {
    if (!this.trades(resourceId)) return;
    const next = this.index(resourceId) + delta;
    const clamped = Math.min(this.balance.indexMax, Math.max(this.balance.indexMin, next));
    this.indices.set(resourceId, clamped);
  }
}

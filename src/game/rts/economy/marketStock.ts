/**
 * Market stock — supply plan (`THREEAGES_RTS_MARKET_SUPPLY_PLAN.md`) Faz S1.
 *
 * The goods a kingdom's Market has *on hand* to sell to its own owner. Buying a
 * lot draws it down; a supply caravan arriving from a trade site fills it back
 * up (Faz S3). Until this existed the buy button minted goods from nothing: the
 * only limits were gold and the storage cap, and "where did the wood come from"
 * had no answer in the match.
 *
 * Three properties are load-bearing, and each is one of the plan's locked
 * decisions rather than an implementation preference:
 *
 * - **One pool per kingdom (KARAR 1-A).** The price table (KR-M2) and the
 *   commission are already per kingdom, so stock is too; the panel then speaks
 *   at a single scale. Losing a Market stops resupply, it does not burn the
 *   stock (KARAR 6-A).
 * - **Stock is not a wallet.** It is goods sitting at the market, not goods the
 *   kingdom owns, so the storage cap does not apply to it — that ceiling bites
 *   only when a lot crosses into the wallet. Nothing here talks to
 *   {@link ResourceCapacitySystem} for exactly that reason.
 * - **Selling never feeds it (KARAR 7-A).** A sale takes goods out of the game.
 *   If it topped the stock up instead, a kingdom could fill its own market
 *   without building a single road — which is the thing this whole plan exists
 *   to remove.
 *
 * Pure by design: no wallet, no structures, no Three.js. That is what lets
 * `test:engine` hold "a stocked resource cannot be bought out of thin air" to
 * account without a running match.
 */
import type { UnitOwner } from "../units/unit";

export class MarketStock {
  /** Goods on hand per kingdom, keyed by resource id. */
  private readonly byOwner = new Map<UnitOwner, Map<string, number>>();

  /** Units of a resource this kingdom's market can hand over right now. */
  amount(owner: UnitOwner, resourceId: string): number {
    return this.byOwner.get(owner)?.get(resourceId) ?? 0;
  }

  /**
   * Goods delivered to the market. The only way stock ever grows — a caravan
   * unloading (Faz S3), never a sale and never a purchase.
   *
   * A non-positive or non-finite amount is a caller bug rather than a game
   * state, so it throws instead of silently doing nothing: a delivery that
   * quietly vanished would show up as a market that never fills, which is the
   * hardest kind of supply bug to see.
   */
  credit(owner: UnitOwner, resourceId: string, amount: number): void {
    if (!resourceId) throw new RangeError("Market stock needs a resource id");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Market stock is credited a positive finite amount");
    }
    const byResource = this.byOwner.get(owner) ?? new Map<string, number>();
    byResource.set(resourceId, (byResource.get(resourceId) ?? 0) + amount);
    this.byOwner.set(owner, byResource);
  }

  /**
   * Take goods off the market for a completed buy.
   *
   * Returns false and moves *nothing* when the stock is short, so a refused
   * trade cannot half-execute — the same contract {@link ResourceWallet.exchange}
   * keeps on the gold side. Stock never goes negative: a market that owes goods
   * is a market that sold what it did not have.
   */
  withdraw(owner: UnitOwner, resourceId: string, amount: number): boolean {
    if (!resourceId) throw new RangeError("Market stock needs a resource id");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Market stock is withdrawn a positive finite amount");
    }
    const byResource = this.byOwner.get(owner);
    const held = byResource?.get(resourceId) ?? 0;
    if (held < amount) return false;
    byResource!.set(resourceId, held - amount);
    return true;
  }

  /**
   * A new match starts with every market empty.
   *
   * There is deliberately no `snapshotFor` here: the panel's stock record is
   * built from the balance's `stocked` list, not from what happens to be held,
   * so that a gated resource sitting at zero still gets a key. Reading this
   * class directly would collapse "empty shelf" into "no shelf".
   */
  reset(): void {
    this.byOwner.clear();
  }
}

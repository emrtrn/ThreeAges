/**
 * AI market trading — `docs/planned/THREEAGES_MARKET_TRADE_PLAN.md` Faz M4.
 *
 * KR-M6 held the AI out of the market for v1, and named the gap it left: the
 * AI's own `incomeTargetsPerMinute` asks for stone 10/min and gold 6/min, and
 * both come from finite deposits it may lose or never reach. A player who
 * trades and an AI who cannot is the asymmetry this closes.
 *
 * ## What it trades for
 *
 * The Town age, and nothing else. That is deliberate: the age is the one
 * expense with a *fixed, known* four-resource price (`balance/ages.json`), so
 * "how short am I" is a subtraction rather than a heuristic, and the rule stops
 * on its own the moment the cost is covered. An AI trading toward a vague
 * "more stone is good" would keep converting its economy into whatever it was
 * last short of, and pay the spread every time it changed its mind.
 *
 * ## The pattern
 *
 * Like {@link AiUpgradeManager}, this only *acts on the answer* it is given.
 * It re-derives none of {@link MarketTradeSystem}'s rules — not the control-area
 * gate (KR-M4), not affordability, not the price. It asks, and a refusal is a
 * state to report, never an error: `no-completed-market` is a message to the
 * economy manager's build order, which already lists the Market.
 */
import type { MarketTradeSystem } from "../economy/marketTradeSystem";
import { NUMERAIRE_RESOURCE_ID } from "../economy/marketPricing";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";

/** How the trade rule last resolved, for §82 and the plan's debug list. */
export type AiTradeStep =
  /** Nothing to close: the age cost is covered, or nothing is short. */
  | "idle"
  /** Short, and willing — but the kingdom has no Market it can trade at yet. */
  | "no-market"
  /** Short, but nothing may be sold without breaking a reserve. */
  | "saving"
  | "traded";

/**
 * Never sell a resource down to the level the age itself needs. Without this the
 * AI would fund a stone shortfall by selling the food the same age cost demands
 * — paying the spread to move the shortfall from one column to another.
 */
function shortfall(bb: AiBlackboard, resourceId: string): number {
  return Math.max(0, (bb.ageCost[resourceId] ?? 0) - (bb.resourceStocks[resourceId] ?? 0));
}

export class AiTradeManager {
  private step: AiTradeStep = "idle";

  constructor(
    private readonly owner: UnitOwner,
    private readonly trade: MarketTradeSystem,
    private readonly log: AiDecisionLog,
    /**
     * Stock a tradable resource keeps on top of what the age needs before any of
     * it is considered surplus. Shared with §38's wood safety stock reasoning:
     * an AI that sells down to exactly the age cost has no buffer left to build
     * or train with while it saves for the rest.
     */
    private readonly reserve = 150,
  ) {}

  get currentStep(): AiTradeStep {
    return this.step;
  }

  /**
   * Run the trade rule for one tick, at most one lot.
   *
   * One lot rather than "trade until covered" on purpose: each trade moves the
   * price against the AI (§4.2), so a loop would walk the index up its own
   * ladder and pay progressively worse rates inside a single frame — the exact
   * mistake a human player learns not to make. Spreading it across ticks also
   * keeps the AI's market footprint visible in the decision log.
   */
  update(bb: AiBlackboard): AiTradeStep {
    if (!this.trade.enabled) return this.settle("idle");
    // Already able to pay for the age: the only thing this rule trades for.
    if (bb.ageAffordable || bb.age === "town") return this.settle("idle");

    const snapshot = this.trade.snapshotFor(this.owner);
    if (!snapshot) return this.settle("idle");
    const tradable = snapshot.prices;
    const goldShort = shortfall(bb, NUMERAIRE_RESOURCE_ID);

    // Gold is the numeraire, so a gold shortfall can only be sold into: pick the
    // resource with the most to spare, which is both the one the AI misses least
    // and — because the index has not been pushed down yet — usually its best rate.
    if (goldShort > 0) {
      const best = tradable
        .map((price) => ({ price, spare: this.spare(bb, price.resourceId, snapshot.lotSize) }))
        .filter((candidate) => candidate.spare > 0)
        .sort((left, right) => right.spare - left.spare)[0];
      if (!best) return this.settle("saving");
      return this.execute(bb, "sell", best.price.resourceId, best.price.sellPrice);
    }

    // Otherwise the shortfall is in something gold can buy. Largest first: it is
    // the one furthest from letting the age start.
    const wanted = tradable
      .map((price) => ({ price, short: shortfall(bb, price.resourceId) }))
      .filter((candidate) => candidate.short > 0)
      .sort((left, right) => right.short - left.short)[0];
    if (!wanted) return this.settle("idle");
    // Spending gold the age cost itself needs would just move the shortfall.
    const spareGold = (bb.resourceStocks[NUMERAIRE_RESOURCE_ID] ?? 0) - (bb.ageCost[NUMERAIRE_RESOURCE_ID] ?? 0);
    if (spareGold < wanted.price.buyPrice) return this.settle("saving");
    return this.execute(bb, "buy", wanted.price.resourceId, wanted.price.buyPrice);
  }

  reset(): void {
    this.step = "idle";
  }

  /** Units of a resource that may be sold without eating into the age cost. */
  private spare(bb: AiBlackboard, resourceId: string, lotSize: number): number {
    const spare = (bb.resourceStocks[resourceId] ?? 0)
      - (bb.ageCost[resourceId] ?? 0)
      - this.reserve;
    // Only whole lots can be sold, so anything under one is not spare at all.
    return spare >= lotSize ? spare : 0;
  }

  private execute(
    bb: AiBlackboard,
    direction: "buy" | "sell",
    resourceId: string,
    price: number,
  ): AiTradeStep {
    const result = direction === "buy"
      ? this.trade.buy(this.owner, resourceId)
      : this.trade.sell(this.owner, resourceId);
    if (result === "traded") {
      this.log.record({
        at: bb.now,
        kind: "intent-selected",
        intent: "economy",
        reason: `pazar: ${resourceId} ${direction === "buy" ? "alındı" : "satıldı"} (${price} altın, çağ açığı)`,
      });
      // Reported every time rather than only on change: each trade is a distinct
      // spend, and collapsing a run of them would hide how much the AI paid.
      this.step = "traded";
      return this.step;
    }
    // Everything else is a state, not a failure. `no-completed-market` is the
    // one worth naming: it is the build order's cue, and it is the difference
    // between "the AI will not trade" and "the AI cannot yet".
    return this.settle(result === "no-completed-market" || result === "disconnected" ? "no-market" : "saving");
  }

  private settle(step: AiTradeStep): AiTradeStep {
    this.step = step;
    return step;
  }
}

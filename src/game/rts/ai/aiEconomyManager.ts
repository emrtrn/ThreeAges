/**
 * AI economy executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17 (EconomyManager),
 * §34–§38; plan §38 ("Açılış", "Ekonomi").
 *
 * Two pure decisions plus a thin executor:
 *  - {@link detectBottleneck} (§37) names the single thing most blocking us.
 *  - {@link nextBuilding} (§34) is the limited opening template. §34 says the
 *    opening "kesin saniyelere bağlı olmamalıdır", so it is a state-driven
 *    order — read off what exists, not off a clock — which also lets it double
 *    as the mid-game repair order without a second code path.
 *
 * Both are pure over the blackboard so plan §39's "AI beş ardışık maçta
 * açılışını tamamlıyor" is testable without running a renderer.
 */
import type { AiBalance } from "../../data/gameDataTypes";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiBuildManager } from "./aiBuildManager";
import type { AiDecisionLog } from "./aiDecisionLog";

/** §37: the bottleneck vocabulary AI-1 can actually detect. */
export type AiBottleneck =
  | "population-blocked"
  | "no-food-production"
  | "no-wood-production"
  | "disconnected-production"
  | "no-available-worker"
  | "wood-shortage"
  | null;

/**
 * §38: never spend the last of the stockpile. Housing must stay affordable
 * after any other purchase, or the AI can trade itself into a population lock
 * it cannot buy its way out of.
 */
export const AI_WOOD_SAFETY_STOCK = 80;

/** §37: report the one bottleneck worth acting on, most severe first. */
export function detectBottleneck(bb: AiBlackboard, balance: AiBalance): AiBottleneck {
  if (bb.population >= bb.populationCap) return "population-blocked";
  if ((bb.buildingCounts["farm"] ?? 0) === 0) return "no-food-production";
  if ((bb.buildingCounts["lumber_camp"] ?? 0) === 0) return "no-wood-production";
  if (bb.disconnectedProducers > 0) return "disconnected-production";
  if (bb.workerCount < balance.economy.workerTarget && bb.idleWorkerCount === 0) return "no-available-worker";
  if ((bb.resourceStocks["wood"] ?? 0) < AI_WOOD_SAFETY_STOCK) return "wood-shortage";
  return null;
}

/**
 * §34: the next building the opening (or a later repair) wants, or null when
 * the base is complete. Order: keep population unlocked → food → wood →
 * military.
 */
export function nextBuilding(bb: AiBlackboard, balance: AiBalance): string | null {
  const headroom = bb.populationCap - bb.population;
  // §37 PopulationBlocked → "Ev planını yüksek öncelikli yap".
  if (headroom <= balance.economy.populationPressureBuffer) return "house";
  if ((bb.buildingCounts["farm"] ?? 0) === 0) return "farm";
  if ((bb.buildingCounts["lumber_camp"] ?? 0) === 0) return "lumber_camp";
  if ((bb.buildingCounts["barracks"] ?? 0) === 0) return "barracks";
  return null;
}

export class AiEconomyManager {
  private lastBottleneck: AiBottleneck = null;

  constructor(
    private readonly balance: AiBalance,
    private readonly builds: AiBuildManager,
    private readonly log: AiDecisionLog,
  ) {}

  get bottleneck(): AiBottleneck {
    return this.lastBottleneck;
  }

  /** Run the economy plan for one tick. Called while the intent is Economy. */
  update(bb: AiBlackboard): void {
    this.reportBottleneck(detectBottleneck(bb, this.balance), bb.now);
    const wanted = nextBuilding(bb, this.balance);
    if (!wanted) return;

    // §38: only Housing may dip into the safety stock, because housing is what
    // the stock exists to guarantee.
    const cost = wanted === "house" ? 0 : AI_WOOD_SAFETY_STOCK;
    if ((bb.resourceStocks["wood"] ?? 0) < cost) return;

    const outcome = this.builds.request(wanted, bb.now);
    // §43/§5: "waiting" and "busy" are normal and must stay quiet — logging
    // them every tick would bury the decisions that matter.
    if (outcome.kind !== "failed") return;
    this.log.record({
      at: bb.now,
      kind: "plan-failed",
      reason: `${wanted} kurulamadı: ${outcome.reason}`,
      failureReason: outcome.reason,
    });
  }

  reset(): void {
    this.lastBottleneck = null;
  }

  /** §5: log a bottleneck when it changes, not on every evaluation. */
  private reportBottleneck(bottleneck: AiBottleneck, now: number): void {
    if (bottleneck === this.lastBottleneck) return;
    this.lastBottleneck = bottleneck;
    if (!bottleneck) return;
    this.log.record({ at: now, kind: "emergency", reason: `darboğaz: ${bottleneck}` });
  }
}

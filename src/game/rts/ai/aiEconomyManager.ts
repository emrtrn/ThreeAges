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
import type { AiFailureReason } from "./aiTypes";
import { workerTargetFor } from "./intentScorer";

/** §37: the bottleneck vocabulary the AI can actually detect. */
export type AiBottleneck =
  | "population-blocked"
  | "workers-lost"
  | "predator-pressure"
  | "no-food-production"
  | "no-wood-production"
  | "no-stone-production"
  | "no-gold-production"
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
  // §27: no workers is worse than a full population — nothing rebuilds itself.
  if (bb.workerCount === 0) return "workers-lost";
  // V3 Faz 7. A camp whose crew was eaten is not evidence that the map needs
  // another farm. Name the cause first; the assignment gate then keeps the
  // replacement crew out of the same wolf den while the normal economy repairs.
  if (bb.predatorWorkerLosses > 0) return "predator-pressure";
  if (bb.population >= bb.populationCap) return "population-blocked";
  // Measured per resource rather than per building id. Naming the buildings
  // here made the diagnosis wrong in both directions the moment food stopped
  // being a farm's exclusive business: an AI living off a hunting camp reported
  // starvation it was not in, and a camp standing over an eaten herd reported a
  // food supply that no longer existed.
  if ((bb.resourceProducerCounts["food"] ?? 0) === 0) return "no-food-production";
  if ((bb.resourceProducerCounts["wood"] ?? 0) === 0) return "no-wood-production";
  if (bb.disconnectedProducers > 0) return "disconnected-production";
  // Stone and gold rank below the two staples and below logistics: they only
  // gate the age, while food/wood gate the units that survive to reach it.
  if ((bb.resourceProducerCounts["stone"] ?? 0) === 0) return "no-stone-production";
  if ((bb.resourceProducerCounts["gold"] ?? 0) === 0) return "no-gold-production";
  if (bb.workerCount < workerTargetFor(bb, balance) && bb.idleWorkerCount === 0) return "no-available-worker";
  if ((bb.resourceStocks["wood"] ?? 0) < AI_WOOD_SAFETY_STOCK) return "wood-shortage";
  return null;
}

/**
 * §34: the next building the opening (or a later repair) wants, or null when
 * the base is complete. Order: keep population unlocked → food → wood →
 * military → the two age extractors.
 *
 * This stays state-driven — it reads what exists rather than a clock — which is
 * §34's "kesin saniyelere bağlı olmamalıdır" and, more usefully, is what makes
 * "kritik yapı yeniden kurma" free: a destroyed farm drops its count back to
 * zero, so the same order that opened the base rebuilds it, with no separate
 * repair branch to keep in sync.
 *
 * The base depot is deliberately absent: {@link AiInfrastructureManager} owns it
 * together with the spine it needs, and two owners would double-book the §42
 * build slot.
 */
export function buildOrder(bb: AiBlackboard, balance: AiBalance): readonly string[] {
  const order: string[] = [];
  const targets = balance.economy.buildingTargets[bb.age];
  /** Wanted while the age's plan asks for more of this building than stands. */
  const short = (buildingId: string): boolean =>
    (bb.buildingCounts[buildingId] ?? 0) < (targets[buildingId] ?? 0);

  const headroom = bb.populationCap - bb.population;
  // §37 PopulationBlocked → "Ev planını yüksek öncelikli yap". Deliberately ahead
  // of the target check and not subject to it: a population lock has to be
  // relieved even by a house the settlement plan did not ask for, or the plan
  // itself becomes the thing that wedges the AI at its cap.
  if (headroom <= balance.economy.populationPressureBuffer) order.push("house");
  if (short("farm")) order.push("farm");
  if (short("lumber_camp")) order.push("lumber_camp");
  // Additive food off a source that runs out, so it sits behind both staples and
  // ahead of everything else. Behind the farm because the Town transition
  // requires one by name, and an AI that opened on game alone would be gated on
  // a building it had never built. Ahead of the military because a herd is the
  // one asset on the map whose value only decays: the camp's whole yield is
  // fixed at what the herd holds, so a camp built late is a camp built smaller.
  if (short("hunting_camp")) order.push("hunting_camp");
  // Beside the camp, for a sharper version of the camp's own reason. A herd is
  // the one asset on the map that only ever gets smaller, and cattle are the
  // half of it the opponent can take *permanently* — a cow he drives into his
  // own pasture is one this kingdom can never hunt, tame or replace. Where the
  // camp built late is merely a camp built smaller, a pasture built late is a
  // pasture built on nothing. Left unnamed it would still be ordered, by the
  // fallback loop's key order, at almost this position — so this line is about
  // saying why, not about moving it.
  if (short("pasture")) order.push("pasture");
  if (short("barracks")) order.push("barracks");
  // §41 "Kule: kritik geçit veya karakol yakını" — the AI's only structure with a
  // `defense` block, so on this data set the outpost *is* the base defence. After
  // the Barracks (something has to garrison it) and before the extractors, which
  // only gate the age: an undefended base does not live long enough to spend the
  // stone. It also satisfies the Town requirement without waiting for a region.
  if (short("outpost")) order.push("outpost");
  // §24: the Town age needs all four resources. These come after the Barracks so
  // the base is never mining stone while it has nothing to defend itself with.
  if (short("quarry")) order.push("quarry");
  if (short("gold_mine")) order.push("gold_mine");
  // Faz M4, last on purpose: the Market converts an economy, it does not make
  // one. Ahead of the extractors it would have the AI buy the stone it could
  // have mined, at a spread, while its deposits sat untouched.
  if (short("market")) order.push("market");
  // Everything else the age's plan asks for, in the plan's own key order — the
  // Town Archery Range today. Listing it above would have needed a second age
  // branch here for a building the ratio (§53) already asks for by name; letting
  // data name it keeps the *order* above about priority and the *contents* about
  // tuning. The named wants are filtered out so nothing is queued twice.
  const named = new Set(order);
  for (const buildingId of Object.keys(targets)) {
    if (named.has(buildingId) || buildingId === "house") continue;
    if (short(buildingId)) order.push(buildingId);
  }
  // The settlement plan's housing, last: it is what raises the population ceiling
  // the army and worker targets grow into, but it never outranks a producer the
  // economy is actually short of. The urgent case is already handled at the top.
  if (!named.has("house") && short("house")) order.push("house");
  return order;
}

/** The single most wanted building, or null when the base is complete. */
export function nextBuilding(bb: AiBlackboard, balance: AiBalance): string | null {
  return buildOrder(bb, balance)[0] ?? null;
}

export class AiEconomyManager {
  private lastBottleneck: AiBottleneck = null;
  /** §5: buildings already reported as out of slots, so the log stays readable. */
  private readonly exhausted = new Set<string>();

  constructor(
    private readonly balance: AiBalance,
    private readonly builds: AiBuildManager,
    private readonly log: AiDecisionLog,
  ) {}

  get bottleneck(): AiBottleneck {
    return this.lastBottleneck;
  }

  /**
   * Run the economy plan for one tick. Called while the intent is Economy.
   *
   * Walks the whole priority order rather than only its head. A single pick
   * deadlocks the base: once every authored house slot is taken, population
   * pressure keeps naming "house" — which can no longer be built — and the AI
   * never reaches the quarry and gold mine underneath it, so it never gets the
   * stone and gold the Town age is gated on. Falling through to the next want is
   * what keeps an exhausted priority from freezing the ones below it.
   */
  update(bb: AiBlackboard): void {
    this.reportBottleneck(detectBottleneck(bb, this.balance), bb.now);

    for (const wanted of buildOrder(bb, this.balance)) {
      // §38: only Housing may dip into the safety stock, because housing is what
      // the stock exists to guarantee.
      const reserve = wanted === "house" ? 0 : AI_WOOD_SAFETY_STOCK;
      // Not affordable yet: this want still owns the slot, so wait for it rather
      // than skipping ahead and spending the stock a higher priority needs.
      if ((bb.resourceStocks["wood"] ?? 0) < reserve) return;

      const outcome = this.builds.request(wanted, bb.now);
      // §43/§5: "waiting" and "busy" are normal and must stay quiet — logging
      // them every tick would bury the decisions that matter.
      if (outcome.kind !== "failed") {
        // A slot that works again is worth reporting if it ever runs out again.
        this.exhausted.delete(wanted);
        return;
      }
      // Out of candidate slots for *this* building. The build manager has
      // already named it in the log, so drop to the next want.
      this.reportExhausted(wanted, bb.now, outcome.reason);
    }
  }

  reset(): void {
    this.lastBottleneck = null;
    this.exhausted.clear();
  }

  /**
   * §5: report a building running out of slots once, not on every tick. A slot
   * can free up again — a destroyed house releases its anchor — so this is a
   * log filter, never a blacklist; {@link AiBuildManager} owns the §43 one.
   */
  private reportExhausted(buildingId: string, now: number, reason: AiFailureReason): void {
    if (this.exhausted.has(buildingId)) return;
    this.exhausted.add(buildingId);
    this.log.record({
      at: now,
      kind: "plan-failed",
      reason: `${buildingId} kurulamadı: ${reason}`,
      failureReason: reason,
    });
  }

  /** §5: log a bottleneck when it changes, not on every evaluation. */
  private reportBottleneck(bottleneck: AiBottleneck, now: number): void {
    if (bottleneck === this.lastBottleneck) return;
    this.lastBottleneck = bottleneck;
    if (!bottleneck) return;
    this.log.record({ at: now, kind: "emergency", reason: `darboğaz: ${bottleneck}` });
  }
}

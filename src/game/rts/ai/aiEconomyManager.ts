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
import type { AiBalance, BuildingBalance } from "../../data/gameDataTypes";
import { buildingCostForAge } from "../economy/buildingCost";
import { buildingUnlocked } from "../progression/kingdomProgressionSystem";
import { AI_RESOURCE_IDS, type AiBlackboard } from "./aiBlackboard";
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
  | "build-material-shortage"
  | null;

/**
 * §38: never spend the last of the stockpile. Housing must stay affordable
 * after any other purchase, or the AI can trade itself into a population lock
 * it cannot buy its way out of.
 */
export const AI_BUILD_MATERIAL_SAFETY_STOCK = 80;

/**
 * *Which* resource the reserve above is held in.
 *
 * The stock exists for exactly one purpose — keeping the next house affordable —
 * so the resource to protect is whatever a house is bought with right now, and
 * under this project's age rule that stops being timber at Kasaba. Hard-coding
 * "wood" here made the AI hoard a material it no longer spends while running dry
 * of the one it does, which is a population lock reached by a different road.
 *
 * Falls back to wood when no building table is supplied: the pure-blackboard
 * tests have no data to read, and they were written against the timber opening.
 */
export function buildMaterialFor(
  bb: Pick<AiBlackboard, "age">,
  buildings: BuildingBalance | null,
): string {
  const house = buildings?.["house"];
  if (!house) return "wood";
  const [resourceId] = Object.keys(buildingCostForAge(house, bb.age));
  return resourceId ?? "wood";
}

/**
 * §24: hold the pending centre-level cost back from the building budget.
 *
 * The centre level is not one more building — it is the multiplier under every
 * other building. A Yerleşim Lv1 lumber camp pays 40 wood per worker-minute and
 * a levelled one pays 120, so the level is what *fixes* a weak economy rather
 * than what a strong economy affords later.
 *
 * Without this the two halves deadlocked: the Economy executor spent every log
 * as it arrived, so the stockpile never reached the 200 wood a level costs;
 * {@link scoreAgeUp} only scores once the cost is affordable, so AgeUp stayed at
 * ~0 and Economy kept the plan forever. Measured over eight procedural seeds,
 * five never bought a single centre level in 24 minutes while banking thousands
 * of food — they were not poor, they were never saving.
 *
 * So while a level is pending and the opening producers are up, the builder may
 * only spend what is left *above* that cost. Housing is exempt for the same
 * reason it is exempt from the wood stock: a population lock stops the workers
 * who would earn the level in the first place.
 */
export function centerLevelReserveFor(bb: AiBlackboard, resourceId: string): number {
  const cost = bb.centerLevelUpgradeCost;
  if (!cost) return 0;
  // The bootstrap gate {@link scoreAgeUp} already uses: before both staple
  // producers are running, saving for a level starves the base that has to earn
  // it. Held to the same condition so the two cannot drift apart.
  const bootstrapReady = (bb.buildingCounts["farm"] ?? 0) > 0
    && (bb.buildingCounts["lumber_camp"] ?? 0) > 0
    && bb.disconnectedProducers === 0;
  if (!bootstrapReady) return 0;
  return cost[resourceId] ?? 0;
}

/** §37: report the one bottleneck worth acting on, most severe first. */
export function detectBottleneck(
  bb: AiBlackboard,
  balance: AiBalance,
  buildings: BuildingBalance | null = null,
): AiBottleneck {
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
  if ((bb.resourceStocks[buildMaterialFor(bb, buildings)] ?? 0) < AI_BUILD_MATERIAL_SAFETY_STOCK) {
    return "build-material-shortage";
  }
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
export function buildOrder(
  bb: AiBlackboard,
  balance: AiBalance,
  /**
   * The building table, when the caller has one, so the AI is bound by the same
   * tier gate the player's palette is (§4: the AI builds through the player's
   * rules, never a parallel path). Optional because the pure-order tests drive
   * this over a blackboard alone; absent, nothing is gated, which is the
   * behaviour every caller had before the Tarla moved behind Yerleşim Lv2.
   */
  buildings: BuildingBalance | null = null,
): readonly string[] {
  const order: string[] = [];
  const targets = balance.economy.buildingTargets[bb.age];
  const tier = { age: bb.age, level: bb.centerLevel };
  /**
   * Wanted while the age's plan asks for more of this building than stands —
   * and the kingdom's tier actually opens it. A locked want is dropped rather
   * than merely deprioritised: it would otherwise sit at the head of the order
   * spending the §42 build slot on a request that can never succeed, which is
   * how one gated building freezes every want underneath it.
   */
  const short = (buildingId: string, cap = Number.POSITIVE_INFINITY): boolean => {
    const stats = buildings?.[buildingId];
    if (stats && !buildingUnlocked(stats, tier)) return false;
    const count = bb.sourceDepletedBuildingIds.includes(buildingId)
      ? (bb.activeBuildingCounts[buildingId] ?? 0)
      : (bb.buildingCounts[buildingId] ?? 0);
    return count < Math.min(targets[buildingId] ?? 0, cap);
  };

  const headroom = bb.populationCap - bb.population;
  // §37 PopulationBlocked → "Ev planını yüksek öncelikli yap". Deliberately ahead
  // of the target check and not subject to it: a population lock has to be
  // relieved even by a house the settlement plan did not ask for, or the plan
  // itself becomes the thing that wedges the AI at its cap.
  if (headroom <= balance.economy.populationPressureBuffer) order.push("house");
  // Still the first food *want*, and now frequently not the first food *built*:
  // the Tarla sits behind Yerleşim Lv2, so at the opening tier `short` drops it
  // and the order falls straight through to the hunt below. It keeps this
  // position for the tier that opens it, where the Town transition still
  // requires a farm by name.
  if (short("farm")) order.push("farm");
  // The plan's *whole* wood target, here in the opening, not one camp with the
  // rest deferred. One camp works one grove — `gatherRadius` is what "one grove"
  // means — so when those trees are cut out the kingdom's only wood income stops
  // dead with live trees standing just past the radius, and wood is what every
  // other building is priced in.
  //
  // Queueing the second camp after the age prerequisites instead was measured and
  // was worse on every count: over eight procedural seeds it cost two kingdoms
  // their Kasaba transition entirely and left one running on a spent grove for
  // more than half the match. The camp's build time is cheaper than the stall.
  if (short("lumber_camp")) order.push("lumber_camp");
  // Additive food off a source that runs out, so it sits behind both staples and
  // ahead of everything else. Behind the farm in the *listing* because the Town
  // transition requires one by name, and an AI that opened on game alone would
  // be gated on a building it had never built — but the farm's own level gate is
  // what makes this the opening food source in practice. Ahead of the military
  // because a herd is the one asset on the map whose value only decays: the
  // camp's whole yield is fixed at what the herd holds, so a camp built late is
  // a camp built smaller.
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
  // Faz M4's normal path stays after the extractors: the standing trade manager
  // may request an earlier Market only when a real progression shortfall proves
  // the trade route is needed.
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
export function nextBuilding(
  bb: AiBlackboard,
  balance: AiBalance,
  buildings: BuildingBalance | null = null,
): string | null {
  return buildOrder(bb, balance, buildings)[0] ?? null;
}

export class AiEconomyManager {
  private lastBottleneck: AiBottleneck = null;
  /** §5: buildings already reported as out of slots, so the log stays readable. */
  private readonly exhausted = new Set<string>();

  constructor(
    private readonly balance: AiBalance,
    private readonly builds: AiBuildManager,
    private readonly log: AiDecisionLog,
    /** The building table the tier gate is read from; see {@link buildOrder}. */
    private readonly buildings: BuildingBalance | null = null,
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
    this.reportBottleneck(detectBottleneck(bb, this.balance, this.buildings), bb.now);

    const material = buildMaterialFor(bb, this.buildings);
    for (const wanted of buildOrder(bb, this.balance, this.buildings)) {
      // §38: only Housing may dip into the safety stock, because housing is what
      // the stock exists to guarantee. §24's centre-level reserve is exempt for
      // Housing on the same grounds — see {@link centerLevelReserveFor}.
      const reserve = wanted === "house" ? 0 : AI_BUILD_MATERIAL_SAFETY_STOCK;
      // Not affordable yet: this want still owns the slot, so wait for it rather
      // than skipping ahead and spending the stock a higher priority needs.
      if ((bb.resourceStocks[material] ?? 0) < reserve) return;
      if (this.heldByCenterLevelReserve(bb, wanted)) return;

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
   * §24: whether this want must wait for the pending centre level to be paid.
   *
   * Two exemptions, and both are there to stop the reserve from trading one
   * deadlock for another:
   *
   *  - **Housing**, as with {@link AI_BUILD_MATERIAL_SAFETY_STOCK}: a population lock stops
   *    the workers who earn the level.
   *  - **A missing age requirement.** The Kasaba transition is gated on six named
   *    buildings, so an AI that saved through every one of them would buy centre
   *    levels forever and never qualify for the age those levels are for. The
   *    quarry and the gold mine in particular are only ever built here.
   */
  private heldByCenterLevelReserve(bb: AiBlackboard, wanted: string): boolean {
    if (wanted === "house") return false;
    if (bb.ageMissingBuildingIds.includes(wanted)) return false;
    // Saving is only possible while something is still earning. If a resource the
    // level is priced in has no live producer left — the grove the only lumber
    // camp stood in has been cut out — then holding the budget saves toward an
    // income that no longer exists, and it blocks the replacement camp that would
    // restore it. Supply is repaired first, and the level waits for the wood.
    const starved = AI_RESOURCE_IDS.some((resourceId) =>
      centerLevelReserveFor(bb, resourceId) > 0 && (bb.resourceProducerCounts[resourceId] ?? 0) === 0);
    if (starved) return false;
    return AI_RESOURCE_IDS.some((resourceId) =>
      (bb.resourceStocks[resourceId] ?? 0) < centerLevelReserveFor(bb, resourceId));
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

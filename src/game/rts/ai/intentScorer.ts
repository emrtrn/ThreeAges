/**
 * Utility scoring for the five strategic intents — `07_ENEMY_AI_DESIGN_v0.2.md`
 * §29–§30.
 *
 * Pure functions over an {@link AiBlackboard}: no world access, no randomness,
 * no time. That keeps §80 (determinism) trivially true and lets every scoring
 * rule be tested by handing it a plain object.
 *
 * Each score is normalised to 0..1 before its data-owned weight is applied
 * (§29 "Bütün girdiler mümkün olduğunca normalize edilmelidir"), and each
 * carries the short reason the debug panel and decision log show (§5, §82).
 *
 * Plan §48 asks for the intent scores themselves to be data-driven, so the term
 * coefficients and normalising divisors live in `balance/ai.json` alongside the
 * intent weights. What stays here is the *shape* of each §30 formula — which
 * terms combine, and whether they add or multiply — because that is design, not
 * tuning: a designer retunes how much population pressure matters, but changing
 * Defend from a product into a sum would be a different AI.
 */
import type { AiBalance } from "../../data/gameDataTypes";
import { AI_RESOURCE_IDS, type AiBlackboard } from "./aiBlackboard";
import { AI_INTENTS, type AiExpansionStep, type AiIntent, type AiIntentScore } from "./aiTypes";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * §47 steps with a claim already on the ground. "outpost" is not one of them —
 * it is the recipe's *starting* state, before anything has been committed.
 */
const RUNNING_EXPANSION_STEPS: readonly AiExpansionStep[] = ["route", "depot", "production"];

/** Score every intent, highest first. Ties break on the §23 intent order. */
export function scoreIntents(blackboard: AiBlackboard, balance: AiBalance): readonly AiIntentScore[] {
  const scores = AI_INTENTS.map((intent) => scoreIntent(intent, blackboard, balance));
  return [...scores].sort((a, b) => b.score - a.score
    || AI_INTENTS.indexOf(a.intent) - AI_INTENTS.indexOf(b.intent));
}

function scoreIntent(intent: AiIntent, blackboard: AiBlackboard, balance: AiBalance): AiIntentScore {
  const { rawScore, reason } = rawScoreFor(intent, blackboard, balance);
  const weight = balance.intentWeights[intent];
  return { intent, rawScore, score: clamp01(rawScore * weight), reason };
}

function rawScoreFor(
  intent: AiIntent,
  bb: AiBlackboard,
  balance: AiBalance,
): { rawScore: number; reason: string } {
  switch (intent) {
    case "economy": return scoreEconomy(bb, balance);
    case "ageUp": return scoreAgeUp(bb, balance);
    case "expand": return scoreExpand(bb, balance);
    case "defend": return scoreDefend(bb, balance);
    case "attack": return scoreAttack(bb, balance);
  }
}

/** §29: the base threat, normalised against the power that reads as "serious". */
function threatLevel(bb: AiBlackboard, balance: AiBalance): number {
  return clamp01(bb.baseThreat / balance.scoring.normalizers.threatPower);
}

/** §35: the worker count this age is driving toward. */
export function workerTargetFor(bb: AiBlackboard, balance: AiBalance): number {
  return balance.economy.workerTarget[bb.age];
}

/**
 * §36 IncomeDeficit across all four resources, as the worst shortfall rather
 * than the mean. A mean lets three healthy incomes hide a fourth that is flat
 * zero — and with Town gated behind stone *and* gold, a hidden zero is exactly
 * the deficit that matters.
 */
function worstIncomeDeficit(bb: AiBlackboard, balance: AiBalance): { deficit: number; resourceId: string } {
  let worst = { deficit: 0, resourceId: "food" };
  for (const resourceId of AI_RESOURCE_IDS) {
    const target = balance.economy.incomeTargetsPerMinute[resourceId];
    if (target === undefined || target <= 0) continue;
    const deficit = clamp01(1 - (bb.resourceIncomePerMinute[resourceId] ?? 0) / target);
    if (deficit > worst.deficit) worst = { deficit, resourceId };
  }
  return worst;
}

/**
 * §30: WorkerNeed + IncomeDeficit + PopulationPressure + RecoveryNeed
 *      - ImmediateThreat
 */
function scoreEconomy(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  const terms = balance.scoring.economy;
  const workerTarget = workerTargetFor(bb, balance);
  const workerNeed = clamp01((workerTarget - bb.workerCount) / workerTarget);
  const income = worstIncomeDeficit(bb, balance);
  const headroom = bb.populationCap - bb.population;
  const populationPressure = clamp01(1 - headroom / Math.max(1, balance.economy.populationPressureBuffer));
  // §37 DisconnectedProduction: cut output is an economic problem to repair.
  const recoveryNeed = clamp01(bb.disconnectedProducers / balance.scoring.normalizers.disconnectedProducers);

  const rawScore = clamp01(
    terms.workerNeed * workerNeed
    + terms.incomeDeficit * income.deficit
    + terms.populationPressure * populationPressure
    + terms.recoveryNeed * recoveryNeed
    - terms.immediateThreat * threatLevel(bb, balance),
  );
  const reason = populationPressure >= 0.999
    ? "nüfus kilidi: ev gerekli"
    : workerNeed > 0.4
      ? `işçi hedefin altında (${bb.workerCount}/${workerTarget})`
      : recoveryNeed > 0
        ? `${bb.disconnectedProducers} üretim bağlantısı kopuk`
        : income.deficit > 0.5
          ? `${income.resourceId} geliri yetersiz`
          : "ekonomi hedefe yakın";
  return { rawScore, reason };
}

/**
 * §30/§24: RequirementProgress + Affordability + EconomyMaturity
 *          - ImmediateThreat.
 *
 * §24 puts the age behind a working economy rather than in a race with it, so
 * this is a *sum* gated on the requirements: the AI only starts wanting the age
 * once the buildings that prove the economy exist are standing, and only acts on
 * it once the stockpile can pay without emptying itself.
 *
 * The requirement list is data (`balance/ages.json`), so on this map the score
 * cannot rise until the AI has a farm, lumber camp, quarry, gold mine, barracks
 * *and* an outpost — which is why the Town age implies a four-resource economy
 * and an expansion rather than needing to name them here.
 */
function scoreAgeUp(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  if (bb.age === "town") return { rawScore: 0, reason: "kasaba çağına ulaşıldı" };
  // Already paid for and running: keep the intent up so the director does not
  // wander off and leave the transition unattended.
  if (bb.ageUpgrading) return { rawScore: 1, reason: "kasaba yükseltmesi sürüyor" };

  const terms = balance.scoring.ageUp;
  const total = Math.max(1, bb.ageRequiredBuildingIds.length);
  const missing = bb.ageMissingBuildingIds.length;
  if (missing > 0) {
    // §5: an age the AI cannot legally start must not out-score the economy that
    // would make it legal, or it would sit on a full stockpile doing nothing.
    const rawScore = clamp01(terms.requirementProgress * clamp01((total - missing) / total));
    return { rawScore, reason: `çağ gereksinimi eksik: ${bb.ageMissingBuildingIds.join(", ")}` };
  }

  const affordability = bb.ageAffordable ? 1 : 0;
  // §24: the transition drains all four stockpiles at once, so an economy that
  // cannot refill them turns the age into a long defenceless gap.
  const economyMaturity = 1 - worstIncomeDeficit(bb, balance).deficit;

  const rawScore = clamp01(
    terms.requirementProgress
    + terms.affordability * affordability
    + terms.economyMaturity * economyMaturity
    - terms.immediateThreat * threatLevel(bb, balance),
  );
  const reason = bb.baseThreat > 0
    ? "üs tehdit altında, çağ ertelendi"
    : !bb.ageAffordable
      ? "çağ için kaynak biriktiriliyor"
      : "kasaba çağı için hazır";
  return { rawScore, reason };
}

/** §30: ResourceNeed × BestRegionValue × RouteFeasibility × Safety */
function scoreExpand(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  // §7: the §47 recipe outlives the plan's commitment window (outpost → road →
  // depot → farm is minutes of work). Hold the intent while it runs, or the
  // director would drop a half-built expansion the moment the outpost landed,
  // leaving a claim with no depot and therefore no income.
  if (RUNNING_EXPANSION_STEPS.includes(bb.expansionStep)) {
    return { rawScore: 1, reason: `genişleme sürüyor: ${bb.expansionStep}` };
  }
  // §45/§49: the AI runs at most two regions. Once its plan budget is spent — or
  // the map has no region left — Expand must go to zero rather than keep scoring
  // for ground that does not exist, which §7's hysteresis would make permanent.
  if (!bb.expansionPlanAvailable) {
    return {
      rawScore: 0,
      reason: bb.expansionStep === "failed" ? "bölge terk edildi, plan kalmadı" : "genişleme planı kalmadı",
    };
  }
  // §34: the opening template runs to completion — food, wood, *then* a Barracks
  // — before free strategic evaluation begins. Gating on the whole opening keeps
  // that order without a separate opening state: an AI that expanded first would
  // stretch a defenceless base across half the map.
  const openingDone = (bb.buildingCounts["farm"] ?? 0) > 0
    && (bb.buildingCounts["lumber_camp"] ?? 0) > 0
    && (bb.buildingCounts["barracks"] ?? 0) > 0;
  if (!openingDone) return { rawScore: 0, reason: "açılış henüz tamamlanmadı" };
  // The whole recipe has to be affordable, not just the outpost, or the AI
  // strands itself with a claim it cannot connect.
  const resourceNeed = clamp01((bb.resourceStocks["wood"] ?? 0) / balance.scoring.expand.recipeWoodCost);
  const safety = bb.baseThreat > 0 ? 0 : 1;
  const rawScore = clamp01(resourceNeed * safety);
  const reason = safety === 0
    ? "üs tehdit altında, genişleme ertelendi"
    : resourceNeed < 1
      ? "genişleme için odun biriktiriliyor"
      : "genişleme için hazır";
  return { rawScore, reason };
}

/** §30: ThreatLevel × TargetImportance × ResponseAbility × Urgency */
function scoreDefend(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  if (bb.baseThreat <= 0) return { rawScore: 0, reason: "tehdit yok" };
  // §30 multiplies by ResponseAbility, so an army-less kingdom scores ~0 here
  // on purpose: §27 wants the economy to rebuild rather than feed a lost fight.
  const responseAbility = clamp01(bb.ownArmyPower / Math.max(0.5, bb.baseThreat));
  const urgency = clamp01(1 - bb.ownCenterHealthRatio + 0.5);
  const rawScore = clamp01(threatLevel(bb, balance) * responseAbility * urgency);
  const reason = responseAbility <= 0
    ? "savunacak ordu yok, ekonomi toparlanmalı"
    : bb.ownCenterHealthRatio < 1
      ? "merkez saldırı altında"
      : `üs çevresinde düşman gücü ${bb.baseThreat.toFixed(1)}`;
  return { rawScore, reason };
}

/**
 * §30: ArmyReadiness × TargetValue × InformationConfidence × RouteSafety
 *      × Opportunity
 * AI-1 has no fog (§21), so information confidence is 1 by construction.
 */
function scoreAttack(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  if (!bb.enemyCenterExists) return { rawScore: 0, reason: "hedef yok" };
  // Plan §53 (4): the early-game non-aggression window. Playtesting found the
  // opening decided the match — the AI pushed as soon as it could and the only
  // winning reply was to rush first — so the economy/expansion/age openings
  // never got to exist. Gating here rather than in the army manager keeps the
  // rule in one place: §30's Attack is what the manager reads (`intent !==
  // "attack"` → regroup), so a suppressed intent suppresses target selection
  // too, and there is no second copy of the window to drift.
  //
  // Defend is deliberately untouched. This makes the AI slow to *start* a fight,
  // not slow to answer one: `baseThreat` still drives Defend and the army
  // manager's own §57 override, so rushing the AI inside the window is answered
  // normally rather than met with a passive base.
  //
  // `bb.now` is match simulation seconds — the same tick {@link RtsMatchClock}
  // counts and reset with the match, so the window scales with game speed and
  // freezes on pause without this holding a second clock of its own.
  const { peaceSeconds } = balance.army;
  if (bb.now < peaceSeconds) {
    const remaining = Math.ceil(peaceSeconds - bb.now);
    return { rawScore: 0, reason: `erken oyun saldırmazlık süresi (${remaining} sn kaldı)` };
  }
  // §59: the base keeps a minimum defence before the field army may leave.
  const deployable = bb.ownArmyPower - balance.army.minimumDefensePower;
  if (deployable <= 0) {
    return { rawScore: 0, reason: `ordu minimum savunmanın altında (${bb.ownArmyPower.toFixed(1)})` };
  }
  const powerRatio = bb.ownArmyPower / Math.max(0.5, bb.knownEnemyArmyPower);
  // §62: readiness climbs from the risky bar up to the dominance bar, so merely
  // being *allowed* to attack is not the same as being ready to.
  //
  // Dividing by `attackPowerRatio` instead saturated readiness at 1.0 the moment
  // the army cleared its minimum bar — a coin-flip 1.1 ratio scored the same as
  // a 5:1 rout. Because scores clamp to 0..1, that pinned Attack at a permanent
  // 1.0 that §7's hysteresis then made unbeatable (a rival needs 1.25×, which is
  // unreachable), so the AI committed to the first fight it was allowed to take
  // and never developed again. §24's "çağ atlama ekonomi ile denge içinde
  // olmalıdır" cannot hold against an intent that is always maxed.
  const { riskyAttackPowerRatio, dominancePowerRatio } = balance.army;
  const band = Math.max(0.01, dominancePowerRatio - riskyAttackPowerRatio);
  const armyReadiness = clamp01((powerRatio - riskyAttackPowerRatio) / band);
  // §27/§57: an attack never outranks defending our own base.
  const opportunity = bb.baseThreat > 0 ? 0.2 : 1;
  const rawScore = clamp01(armyReadiness * opportunity);
  const reason = bb.baseThreat > 0
    ? "üs tehdit altında, saldırı beklemede"
    : powerRatio >= balance.army.attackPowerRatio
      ? `güç oranı uygun (${powerRatio.toFixed(2)})`
      : `güç oranı yetersiz (${powerRatio.toFixed(2)})`;
  return { rawScore, reason };
}

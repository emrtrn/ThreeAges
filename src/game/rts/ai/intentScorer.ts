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
 */
import type { AiBalance } from "../../data/gameDataTypes";
import type { AiBlackboard } from "./aiBlackboard";
import { AI_INTENTS, type AiIntent, type AiIntentScore } from "./aiTypes";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

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
    case "ageUp": return scoreAgeUp();
    case "expand": return scoreExpand(bb);
    case "defend": return scoreDefend(bb);
    case "attack": return scoreAttack(bb, balance);
  }
}

/**
 * §30: WorkerNeed + IncomeDeficit + PopulationPressure + RecoveryNeed
 *      - ImmediateThreat
 */
function scoreEconomy(bb: AiBlackboard, balance: AiBalance): { rawScore: number; reason: string } {
  const workerNeed = clamp01((balance.economy.workerTarget - bb.workerCount) / balance.economy.workerTarget);
  const incomeDeficit = clamp01(1 - (bb.resourceIncomePerMinute["food"] ?? 0) / 20);
  const headroom = bb.populationCap - bb.population;
  const populationPressure = clamp01(1 - headroom / Math.max(1, balance.economy.populationPressureBuffer));
  // §37 DisconnectedProduction: cut output is an economic problem to repair.
  const recoveryNeed = clamp01(bb.disconnectedProducers / 2);
  const immediateThreat = clamp01(bb.baseThreat / 4);

  const rawScore = clamp01(
    0.4 * workerNeed + 0.25 * incomeDeficit + 0.25 * populationPressure + 0.1 * recoveryNeed
    - 0.5 * immediateThreat,
  );
  const reason = populationPressure >= 0.999
    ? "nüfus kilidi: ev gerekli"
    : workerNeed > 0.4
      ? `işçi hedefin altında (${bb.workerCount}/${balance.economy.workerTarget})`
      : recoveryNeed > 0
        ? `${bb.disconnectedProducers} üretim bağlantısı kopuk`
        : incomeDeficit > 0.5
          ? "yiyecek geliri yetersiz"
          : "ekonomi hedefe yakın";
  return { rawScore, reason };
}

/**
 * §10: AI-1 has a single development level, so there is no age to reach. The
 * intent stays in the vocabulary (§23) and `ai.json` pins its weight to 0; this
 * returns 0 so the shape is ready for Faz 6 without faking behaviour now.
 */
function scoreAgeUp(): { rawScore: number; reason: string } {
  return { rawScore: 0, reason: "AI-1 kapsamında çağ yok" };
}

/** §30: ResourceNeed × BestRegionValue × RouteFeasibility × Safety */
function scoreExpand(bb: AiBlackboard): { rawScore: number; reason: string } {
  // §10: AI-1 has one region, so a finished or abandoned recipe ends the intent.
  if (bb.expansionStep === "done") return { rawScore: 0, reason: "bölge aktif" };
  if (bb.expansionStep === "failed") return { rawScore: 0, reason: "bölge terk edildi" };
  // §7: the §47 recipe outlives the plan's commitment window (outpost → road →
  // depot → farm is minutes of work). Hold the intent while it runs, or the
  // director would drop a half-built expansion the moment the outpost landed,
  // leaving a claim with no depot and therefore no income.
  if (bb.expansionStep !== "outpost") return { rawScore: 1, reason: `genişleme sürüyor: ${bb.expansionStep}` };
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
  const resourceNeed = clamp01((bb.resourceStocks["wood"] ?? 0) / 400);
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
function scoreDefend(bb: AiBlackboard): { rawScore: number; reason: string } {
  if (bb.baseThreat <= 0) return { rawScore: 0, reason: "tehdit yok" };
  const threatLevel = clamp01(bb.baseThreat / 4);
  // §30 multiplies by ResponseAbility, so an army-less kingdom scores ~0 here
  // on purpose: §27 wants the economy to rebuild rather than feed a lost fight.
  const responseAbility = clamp01(bb.ownArmyPower / Math.max(0.5, bb.baseThreat));
  const urgency = clamp01(1 - bb.ownCenterHealthRatio + 0.5);
  const rawScore = clamp01(threatLevel * responseAbility * urgency);
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
  // §59: the base keeps a minimum defence before the field army may leave.
  const deployable = bb.ownArmyPower - balance.army.minimumDefensePower;
  if (deployable <= 0) {
    return { rawScore: 0, reason: `ordu minimum savunmanın altında (${bb.ownArmyPower.toFixed(1)})` };
  }
  const powerRatio = bb.ownArmyPower / Math.max(0.5, bb.knownEnemyArmyPower);
  const armyReadiness = clamp01(powerRatio / balance.army.attackPowerRatio);
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

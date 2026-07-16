/**
 * Kingdom Director — `07_ENEMY_AI_DESIGN_v0.2.md` §14, §31; plan §38.
 *
 * The AI's single strategic decision point: it scores the five intents, applies
 * plan stability, and owns the active plan's lifecycle. It never commands a unit
 * (§14) — executing managers subscribe to the plan it publishes.
 *
 * The two rules that keep behaviour readable (§5, §7) live here:
 *  - a running plan is held for `minimumCommitmentSeconds`,
 *  - a rival intent must beat it by `hysteresisMargin` to take over,
 *  - unless an emergency (§7 exceptions) cuts the plan short.
 *
 * Faz 5 scope: the director *decides*. The economy/build/expansion executors
 * that turn a plan into buildings arrive with the later §38 task groups, so a
 * plan currently runs until it times out or is superseded.
 */
import type { AiBalance } from "../../data/gameDataTypes";
import type { AiBlackboard, AiEmergencyFlag } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";
import { scoreIntents } from "./intentScorer";
import type { AiIntent, AiIntentScore, AiPlan } from "./aiTypes";

/** §7: which emergencies may pre-empt a committed plan, and what they demand. */
const EMERGENCY_INTENT: Readonly<Record<AiEmergencyFlag, AiIntent>> = {
  "base-under-attack": "defend",
  "army-destroyed": "economy",
  "population-blocked": "economy",
  // §27: a raid that clears the workers ends every income at once. Nothing else
  // the AI could commit to matters until it has hands again.
  "workers-lost": "economy",
};

export interface KingdomDirectorState {
  readonly intent: AiIntent | null;
  readonly plan: AiPlan | null;
  readonly scores: readonly AiIntentScore[];
}

export class KingdomDirector {
  private plan: AiPlan | null = null;
  private scores: readonly AiIntentScore[] = [];
  private nextPlanId = 1;

  constructor(
    private readonly balance: AiBalance,
    private readonly log: AiDecisionLog,
  ) {}

  get currentPlan(): AiPlan | null {
    return this.plan;
  }

  get currentIntent(): AiIntent | null {
    return this.plan?.intent ?? null;
  }

  state(): KingdomDirectorState {
    return { intent: this.currentIntent, plan: this.plan, scores: this.scores };
  }

  /**
   * One strategic evaluation (§31). Called on the director cadence, not per
   * frame; `blackboard.now` is match time so plan ages survive speed changes.
   */
  evaluate(blackboard: AiBlackboard): AiPlan | null {
    this.scores = scoreIntents(blackboard, this.balance);
    const best = this.scores[0];
    if (!best) return this.plan;

    this.expireTimedOutPlan(blackboard);

    const emergency = this.emergencyIntent(blackboard);
    if (emergency && this.plan?.intent !== emergency.intent) {
      // §7: emergencies bypass both commitment and hysteresis.
      this.startPlan(emergency.intent, blackboard, `acil: ${emergency.reason}`, "emergency");
      return this.plan;
    }

    if (!this.plan) {
      this.startPlan(best.intent, blackboard, best.reason, "intent-selected");
      return this.plan;
    }

    // The running plan is still the best choice; nothing to decide.
    if (best.intent === this.plan.intent) return this.plan;

    const runningSeconds = blackboard.now - this.plan.startedAt;
    if (runningSeconds < this.plan.minimumCommitmentSeconds) {
      this.log.record({
        at: blackboard.now,
        kind: "intent-held",
        intent: this.plan.intent,
        reason: `bağlılık süresi (${runningSeconds.toFixed(1)}/${this.plan.minimumCommitmentSeconds}sn)`,
        scores: this.scores,
      });
      return this.plan;
    }

    // §7: "Yeni plan puanı, mevcut plan puanından en az %25 yüksek değilse
    // mevcut plan devam eder."
    const currentScore = this.scores.find((score) => score.intent === this.plan?.intent)?.score ?? 0;
    const required = currentScore * (1 + this.balance.evaluation.hysteresisMargin);
    if (best.score <= required) {
      this.log.record({
        at: blackboard.now,
        kind: "intent-held",
        intent: this.plan.intent,
        reason: `histerezis: ${best.intent} ${best.score.toFixed(2)} <= gereken ${required.toFixed(2)}`,
        scores: this.scores,
      });
      return this.plan;
    }

    this.startPlan(best.intent, blackboard, best.reason, "intent-selected");
    return this.plan;
  }

  /** Report an executor's outcome so the director can pick a new plan (§32). */
  completePlan(plan: AiPlan, at: number, succeeded: boolean, failureReason?: AiPlan["failureReason"]): void {
    if (this.plan !== plan) return;
    plan.status = succeeded ? "succeeded" : "failed";
    if (failureReason) plan.failureReason = failureReason;
    this.log.record({
      at,
      kind: succeeded ? "plan-succeeded" : "plan-failed",
      intent: plan.intent,
      reason: succeeded ? `${plan.intent} planı tamamlandı` : `${plan.intent} planı başarısız: ${failureReason ?? "bilinmiyor"}`,
      ...(failureReason ? { failureReason } : {}),
    });
    this.plan = null;
  }

  reset(): void {
    this.plan = null;
    this.scores = [];
    this.nextPlanId = 1;
  }

  private emergencyIntent(blackboard: AiBlackboard): { intent: AiIntent; reason: string } | null {
    for (const flag of blackboard.emergencyFlags) {
      const intent = EMERGENCY_INTENT[flag];
      // Defending needs something to defend with; §27 lets the economy rebuild
      // first rather than throwing a non-existent army at the threat.
      if (intent === "defend" && blackboard.ownArmyPower <= 0) continue;
      return { intent, reason: flag };
    }
    return null;
  }

  private expireTimedOutPlan(blackboard: AiBlackboard): void {
    if (!this.plan) return;
    if (blackboard.now - this.plan.startedAt < this.plan.timeoutSeconds) return;
    this.completePlan(this.plan, blackboard.now, false, "timeout");
  }

  private startPlan(
    intent: AiIntent,
    blackboard: AiBlackboard,
    reason: string,
    kind: "intent-selected" | "emergency",
  ): void {
    const previous = this.plan;
    if (previous) {
      previous.status = "cancelled";
      previous.failureReason = "superseded";
    }
    this.plan = {
      id: `plan-${this.nextPlanId++}`,
      intent,
      startedAt: blackboard.now,
      minimumCommitmentSeconds: this.balance.evaluation.minimumCommitmentSeconds,
      timeoutSeconds: this.balance.evaluation.planTimeoutSeconds,
      status: "running",
    };
    this.log.record({
      at: blackboard.now,
      kind,
      intent,
      reason: previous ? `${previous.intent} → ${intent}: ${reason}` : `${intent}: ${reason}`,
      scores: this.scores,
    });
  }
}

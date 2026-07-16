/**
 * AI plan and task vocabulary — `07_ENEMY_AI_DESIGN_v0.2.md` §32–§33.
 *
 * Pure types plus the two small enums the director and army manager agree on.
 * Deliberately free of Three.js and of any runtime system so the decision layer
 * stays testable headlessly (AI design §80 determinism, plan §38 test mode).
 */
import type { AiIntent } from "../../data/gameDataTypes";

export type { AiIntent };

/** §33: every task/plan moves through exactly these states. */
export type AiPlanStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

/**
 * §43: explicit failure codes, so a blocked plan names its reason instead of
 * silently retrying the same candidate forever (§5 "yapı yeri bulunamadığında
 * sonsuz tekrar" is listed as a behaviour to avoid).
 */
export type AiFailureReason =
  | "no-valid-placement"
  | "insufficient-resources"
  | "no-builder-available"
  | "path-blocked"
  | "territory-invalid"
  | "required-node-missing"
  | "timeout"
  | "superseded";

/** §32: the single strategic plan the director commits to at a time. */
export interface AiPlan {
  readonly id: string;
  readonly intent: AiIntent;
  readonly targetId?: string;
  readonly targetRegionId?: string;
  /** Match seconds at which this plan started running. */
  readonly startedAt: number;
  /** §7: no rival intent may replace this plan before it has run this long. */
  readonly minimumCommitmentSeconds: number;
  /** §32: the plan fails once it has run this long without succeeding. */
  readonly timeoutSeconds: number;
  status: AiPlanStatus;
  failureReason?: AiFailureReason;
}

/** One intent's utility score for a single evaluation (§29). */
export interface AiIntentScore {
  readonly intent: AiIntent;
  /** Weighted, clamped to 0..1 — what the director actually compares. */
  readonly score: number;
  /** Unweighted score, kept so the debug panel can explain a weight's effect. */
  readonly rawScore: number;
  /** Short human-readable driver of this score, for §5 readability and §82. */
  readonly reason: string;
}

/** §15: the field army's mission vocabulary. One is active at a time. */
export type AiArmyMission =
  | "defendBase"
  | "defendExpansion"
  | "contestObjective"
  | "harassEconomy"
  | "assaultTarget"
  | "regroup";

export const AI_INTENTS: readonly AiIntent[] = ["economy", "ageUp", "expand", "defend", "attack"];

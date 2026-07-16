/**
 * AI decision log — `07_ENEMY_AI_DESIGN_v0.2.md` §82–§83, plan §38/§39.
 *
 * Plan §39 requires "AI karar nedeni debug panelinde görülebiliyor", and AI
 * design §5 makes readable behaviour a design goal. Every intent switch, plan
 * outcome and army mission passes through here with the reason that drove it,
 * so an unexplained plan change shows up as a missing/blank reason rather than
 * silently happening.
 *
 * A bounded ring buffer: the log runs for the whole match and must never grow
 * without limit (§79 keeps debug cheap when it is switched off).
 */
import type { AiArmyMission, AiFailureReason, AiIntent, AiIntentScore } from "./aiTypes";

export type AiDecisionKind =
  | "intent-selected"
  | "intent-held"
  | "plan-succeeded"
  | "plan-failed"
  | "army-mission"
  | "emergency"
  /** §69: the last entry of a match — the AI stops deciding after this. */
  | "match-ended";

export interface AiDecisionEntry {
  /** Match seconds at which the decision was taken. */
  readonly at: number;
  readonly kind: AiDecisionKind;
  /** Human-readable cause — never empty (§5: no unexplained plan changes). */
  readonly reason: string;
  readonly intent?: AiIntent;
  readonly mission?: AiArmyMission;
  readonly failureReason?: AiFailureReason;
  /** Every intent's score at this evaluation, for §82 TopIntentScores. */
  readonly scores?: readonly AiIntentScore[];
}

export const AI_DECISION_LOG_CAPACITY = 40;

export class AiDecisionLog {
  private readonly entries: AiDecisionEntry[] = [];

  constructor(private readonly capacity: number = AI_DECISION_LOG_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("AI decision log capacity must be a positive integer");
    }
  }

  record(entry: AiDecisionEntry): void {
    if (!entry.reason) throw new Error("AI decisions must carry a reason (AI design §5)");
    this.entries.push(entry);
    // Bounded: drop the oldest once the ring is full.
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
  }

  /** Newest first, for a debug panel that reads top-down. */
  recent(limit = this.capacity): readonly AiDecisionEntry[] {
    return [...this.entries].reverse().slice(0, Math.max(0, limit));
  }

  get latest(): AiDecisionEntry | null {
    return this.entries.at(-1) ?? null;
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

/**
 * AI expansion executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17
 * (ExpansionManager), §26, §45–§49; plan §38 ("Genişleme").
 *
 * Runs §47's fixed recipe as a small state machine. §47 exists precisely so
 * that every expansion is the same testable sequence rather than an emergent
 * one, and the map's geometry enforces the ordering: the depot and production
 * slots only fall inside the outpost's *connected* control radius, so the road
 * genuinely has to land before they become legal.
 *
 * This is why the expansion matters beyond territory: until the AI owns a depot
 * wired to its producers, its output sits in local buffers (Faz 4 logistics) and
 * it has no spendable income at all.
 *
 * §46/§49 region scoring and re-routing are AI-2+ concerns — §10 gives AI-1 one
 * region and one corridor, so a failure here retires the region (§43) rather
 * than shopping for a better one.
 */
import type { RtsExpansionRegion } from "../world/rtsMapBlockout";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiBuildManager } from "./aiBuildManager";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiExpansionStep } from "./aiTypes";

/** §43: give up on the region after this many hard step failures. */
export const AI_EXPANSION_FAILURE_LIMIT = 3;

export class AiExpansionManager {
  private step: AiExpansionStep = "outpost";
  private failures = 0;

  constructor(
    private readonly owner: UnitOwner,
    private readonly region: RtsExpansionRegion,
    private readonly builds: AiBuildManager,
    private readonly roads: RoadConstructionService,
    private readonly structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
  ) {}

  get currentStep(): AiExpansionStep {
    return this.step;
  }

  get done(): boolean {
    return this.step === "done";
  }

  get failed(): boolean {
    return this.step === "failed";
  }

  /** True once the recipe has reached a terminal state and needs no more ticks. */
  get settled(): boolean {
    return this.step === "done" || this.step === "failed";
  }

  /** Advance the recipe by at most one step. Called while the intent is Expand. */
  update(bb: AiBlackboard): AiExpansionStep {
    switch (this.step) {
      case "outpost": return this.advanceOutpost(bb);
      case "route": return this.advanceRoute(bb);
      case "depot": return this.advanceDepot(bb);
      case "production": return this.advanceProduction(bb);
      default: return this.step;
    }
  }

  reset(): void {
    this.step = "outpost";
    this.failures = 0;
  }

  /** §47 step 4: claim the region. */
  private advanceOutpost(bb: AiBlackboard): AiExpansionStep {
    return this.awaitSlot("outpost", bb, "route", "karakol hazır");
  }

  /**
   * §47 steps 5–6: complete the authored corridor. Segments are idempotent, so
   * a partially paid route resumes instead of restarting.
   */
  private advanceRoute(bb: AiBlackboard): AiExpansionStep {
    for (let index = 0; index < this.region.route.length - 1; index += 1) {
      const from = this.region.route[index];
      const to = this.region.route[index + 1];
      if (!from || !to) continue;
      const result = this.roads.build(this.owner, from, to);
      if (result.built) continue;
      // §38: no wood yet is a wait, not a failure — try again next tick.
      if (result.reason === "insufficient-resources") return this.step;
      return this.fail(bb, `yol rotası kurulamadı: ${result.reason}`);
    }
    return this.enter("depot", bb, "yol bağlantısı tamam");
  }

  /** §47 step 7: the depot is what turns the region into actual income. */
  private advanceDepot(bb: AiBlackboard): AiExpansionStep {
    return this.awaitSlot("depot", bb, "production", "depo hazır");
  }

  /** §47 step 8: the region's resource building; §47 step 9 is automatic. */
  private advanceProduction(bb: AiBlackboard): AiExpansionStep {
    return this.awaitSlot("production", bb, "done", "bölge aktif");
  }

  /**
   * Place a slot's building, then wait for it. The three states are distinct and
   * conflating them is a trap: once a site exists the anchor is *taken*, so
   * asking the build manager for it again reports "no candidates" — which would
   * make the AI abandon the region while its own outpost was still going up.
   */
  private awaitSlot(
    slot: "outpost" | "depot" | "production",
    bb: AiBlackboard,
    next: AiExpansionStep,
    reason: string,
  ): AiExpansionStep {
    const anchor = this.region[slot];
    const site = this.structures.ownedBy(this.owner)
      .find((structure) => structure.x === anchor.x && structure.z === anchor.z);
    if (site?.construction.complete) return this.enter(next, bb, reason);
    if (site) return this.step;
    const outcome = this.builds.request(anchor.buildingId, bb.now, [anchor]);
    // "started"/"busy" mean the site is in hand; "waiting" means no resources.
    if (outcome.kind !== "failed") return this.step;
    return this.fail(bb, `${anchor.buildingId} kurulamadı: ${outcome.reason}`);
  }

  private enter(step: AiExpansionStep, bb: AiBlackboard, reason: string): AiExpansionStep {
    if (this.step === step) return step;
    this.step = step;
    this.log.record({
      at: bb.now,
      kind: step === "done" ? "plan-succeeded" : "intent-selected",
      intent: "expand",
      reason: `genişleme (${this.region.id}): ${reason}`,
    });
    return step;
  }

  /** §43/§49: never retry forever — retire the region and let the director move on. */
  private fail(bb: AiBlackboard, reason: string): AiExpansionStep {
    this.failures += 1;
    if (this.failures < AI_EXPANSION_FAILURE_LIMIT) return this.step;
    this.step = "failed";
    this.log.record({
      at: bb.now,
      kind: "plan-failed",
      intent: "expand",
      reason: `genişleme (${this.region.id}) terk edildi: ${reason}`,
      failureReason: "no-valid-placement",
    });
    return this.step;
  }
}

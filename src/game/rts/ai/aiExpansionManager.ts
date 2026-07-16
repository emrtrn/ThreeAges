/**
 * AI expansion executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17
 * (ExpansionManager), §26, §45–§49; plan §48 ("Yapı ve genişleme").
 *
 * Runs §47's fixed recipe over *one* authored region as a small state machine.
 * §47 exists precisely so that every expansion is the same testable sequence
 * rather than an emergent one, and the map's geometry enforces the ordering: the
 * depot and production slots only fall inside the outpost's *connected* control
 * radius, so the road genuinely has to land before they become legal.
 *
 * This is why the expansion matters beyond territory: until the AI owns a depot
 * wired to its producers, its output sits in local buffers (Faz 4 logistics) and
 * it has no spendable income at all.
 *
 * Faz 8 made the recipe survivable rather than one-shot. It is no longer a line
 * that ends at "done":
 *  - a slot whose building is destroyed drops the recipe back to that step, so
 *    "karakol ve depo yeniden kurma" falls out of the same code path that built
 *    them (the {@link AiInfrastructureManager} pattern), with no rebuild branch
 *    to keep in sync;
 *  - a severed region re-walks its corridor ("bağlantı kesintisi onarımı");
 *  - a corridor that is refused for reasons the AI did not cause falls through
 *    to the region's next authored route ("yol rota fallback'i") instead of
 *    retiring a region it could simply have reached another way.
 *
 * Which regions exist and how many the AI may run is {@link AiExpansionCoordinator}'s
 * concern (§10/§49 "en fazla iki genişleme planı").
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

/** §47's recipe slots, in the order they become legal. */
const RECIPE_SLOTS = ["outpost", "depot", "production"] as const;
type RecipeSlot = (typeof RECIPE_SLOTS)[number];

export class AiExpansionManager {
  private step: AiExpansionStep = "outpost";
  private failures = 0;
  /** §49: which of the region's authored corridors is currently being walked. */
  private routeIndex = 0;

  constructor(
    private readonly owner: UnitOwner,
    private readonly region: RtsExpansionRegion,
    private readonly builds: AiBuildManager,
    private readonly roads: RoadConstructionService,
    private readonly structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
  ) {}

  get regionId(): string {
    return this.region.id;
  }

  get currentStep(): AiExpansionStep {
    return this.step;
  }

  get done(): boolean {
    return this.step === "done";
  }

  get failed(): boolean {
    return this.step === "failed";
  }

  /**
   * True while the recipe still has work in hand. Unlike Faz 5's `settled`, a
   * finished region is *not* settled forever: it can be knocked back open by a
   * lost building or a cut road, so "done" is a state the recipe can leave.
   */
  get running(): boolean {
    return this.step !== "done" && this.step !== "failed";
  }

  /** Advance the recipe by at most one step. Called while the intent is Expand. */
  update(bb: AiBlackboard): AiExpansionStep {
    // §43: a retired region is never reopened — that is the whole point of
    // retiring it, and a razed outpost must not resurrect one.
    if (this.step === "failed") return this.step;
    this.regressIfLost(bb);
    switch (this.step) {
      case "outpost": return this.advanceOutpost(bb);
      case "route": return this.advanceRoute(bb);
      case "depot": return this.advanceDepot(bb);
      case "production": return this.advanceProduction(bb);
      // "done": nothing to advance — the checks above are its whole tick.
      default: return this.step;
    }
  }

  reset(): void {
    this.step = "outpost";
    this.failures = 0;
    this.routeIndex = 0;
  }

  /**
   * §37/§49: put the recipe back to the earliest thing that is missing.
   *
   * A finished region is not a finished concern — its outpost can be razed, its
   * depot can fall, and the road that made both legal can be cut. Rather than a
   * separate repair branch, the recipe simply re-enters the step that owns
   * whatever is gone and rebuilds it exactly the way it built it the first time.
   *
   */
  private regressIfLost(bb: AiBlackboard): void {
    for (const slot of this.slotsBehindUs()) {
      // A site that is merely still going up is the recipe working, not a loss.
      if (this.siteAt(slot) !== undefined) continue;
      this.failures = 0;
      this.enter(slot, bb, `${slot} kaybedildi, yeniden kuruluyor`, "emergency");
      return;
    }
    // §37: the region stands but its output cannot reach a depot — the corridor
    // has been cut. Re-walking it is the repair, and an intact leg costs nothing.
    if (this.step === "done" && bb.disconnectedProducers > 0) {
      this.failures = 0;
      this.enter("route", bb, "bölge bağlantısı koptu, yol onarılıyor", "emergency");
    }
  }

  /**
   * The slots the recipe has already built, earliest first. Only these can be
   * *lost*; a slot the recipe has not reached yet is simply not built, which is
   * the recipe running normally rather than damage to repair.
   */
  private slotsBehindUs(): readonly RecipeSlot[] {
    if (this.step === "done") return RECIPE_SLOTS;
    // "route" sits between the outpost and the depot, so only the outpost is
    // behind it; every other step names itself in the recipe order.
    if (this.step === "route") return ["outpost"];
    const current = RECIPE_SLOTS.indexOf(this.step as RecipeSlot);
    return current <= 0 ? [] : RECIPE_SLOTS.slice(0, current);
  }

  private siteAt(slot: RecipeSlot) {
    const anchor = this.region[slot];
    return this.structures.ownedBy(this.owner)
      .find((structure) => structure.x === anchor.x && structure.z === anchor.z);
  }

  /** §47 step 4: claim the region. */
  private advanceOutpost(bb: AiBlackboard): AiExpansionStep {
    return this.awaitSlot("outpost", bb, "route", "karakol hazır");
  }

  /**
   * §47 steps 5–6: complete an authored corridor. Segments are idempotent, so a
   * partially paid route resumes instead of restarting, and a repair re-walk of
   * an intact route is free.
   */
  private advanceRoute(bb: AiBlackboard): AiExpansionStep {
    const route = this.region.routes[this.routeIndex];
    if (!route) return this.fail(bb, "kurulabilir yol rotası kalmadı");
    for (let index = 0; index < route.length - 1; index += 1) {
      const from = route[index];
      const to = route[index + 1];
      if (!from || !to) continue;
      // A segment whose cells all exist costs nothing, so planning it first lets
      // an intact leg be skipped without a commit — and therefore without the
      // territory refresh a commit triggers, which re-scans the whole world grid.
      const existing = this.roads.plan(from, to);
      if (existing && existing.woodCost === 0) continue;
      const result = this.roads.build(this.owner, from, to);
      if (result.built) continue;
      // §38: no wood yet is a wait, not a failure — try again next tick.
      if (result.reason === "insufficient-resources") return this.step;
      return this.nextRoute(bb, result.reason);
    }
    return this.enter("depot", bb, "yol bağlantısı tamam");
  }

  /**
   * §49: a refused corridor retires the *route*, not the region. Only once the
   * region has run out of authored alternatives is the region itself given up.
   */
  private nextRoute(bb: AiBlackboard, reason: string): AiExpansionStep {
    this.routeIndex += 1;
    if (this.routeIndex >= this.region.routes.length) {
      // Put the index back on the primary: a later repair re-walk should start
      // from the preferred corridor rather than inheriting this failure.
      this.routeIndex = 0;
      return this.fail(bb, `yol rotası kurulamadı: ${reason}`);
    }
    this.log.record({
      at: bb.now,
      kind: "intent-selected",
      intent: "expand",
      reason: `genişleme (${this.region.id}): yol rotası engelli (${reason}), alternatif deneniyor`,
    });
    return this.step;
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
    slot: RecipeSlot,
    bb: AiBlackboard,
    next: AiExpansionStep,
    reason: string,
  ): AiExpansionStep {
    const anchor = this.region[slot];
    const site = this.siteAt(slot);
    if (site?.construction.complete) return this.enter(next, bb, reason);
    if (site) return this.step;
    const outcome = this.builds.request(anchor.buildingId, bb.now, [anchor]);
    // "started"/"busy" mean the site is in hand; "waiting" means no resources.
    if (outcome.kind !== "failed") return this.step;
    return this.fail(bb, `${anchor.buildingId} kurulamadı: ${outcome.reason}`);
  }

  private enter(
    step: AiExpansionStep,
    bb: AiBlackboard,
    reason: string,
    kind: "intent-selected" | "emergency" = "intent-selected",
  ): AiExpansionStep {
    if (this.step === step) return step;
    this.step = step;
    this.log.record({
      at: bb.now,
      kind: step === "done" ? "plan-succeeded" : kind,
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

/**
 * AI expansion planning — `07_ENEMY_AI_DESIGN_v0.2.md` §10, §45–§46, §49;
 * plan §48 ("En fazla iki genişleme planı", "Karakol ve depo yeniden kurma").
 *
 * §10 gave AI-1 a single region, so {@link AiExpansionManager} *was* the plan.
 * AI-2 runs a full match and needs a second one — but not a third: §45 is
 * explicit that an AI which keeps claiming ground it cannot hold is worse than
 * one that consolidates, and a sprawling AI is also the least readable kind
 * (§5). So the cap lives here, in the AI, rather than being an accident of how
 * many regions the map happens to author.
 *
 * Regions are claimed in the map's own preference order (§46 region *scoring* is
 * an AI-3 concern), one at a time: §42 allows a single construction site anyway,
 * so two recipes racing for it would only deadlock each other.
 *
 * A claimed region is never forgotten, including a finished one. That is what
 * makes "karakol ve depo yeniden kurma" and "bağlantı kesintisi onarımı"
 * behaviours of the recipe itself rather than a separate repair system: the
 * manager re-enters the step that owns whatever was lost and rebuilds it exactly
 * the way it built it the first time.
 */
import type { RtsExpansionRegion } from "../world/rtsMapBlockout";
import type { RoadConstructionService } from "../roads/roadConstructionService";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiBuildManager } from "./aiBuildManager";
import type { AiDecisionLog } from "./aiDecisionLog";
import { AiExpansionManager } from "./aiExpansionManager";
import type { AiExpansionStep } from "./aiTypes";

/** §45/§49: the AI commits to at most this many regions across a whole match. */
export const AI_MAX_EXPANSION_PLANS = 2;

export class AiExpansionCoordinator {
  private readonly managers: readonly AiExpansionManager[];
  /** Regions claimed so far, in map order; also the index of the next one. */
  private started = 0;
  /** The region holding the plan, or -1 between plans. */
  private activeIndex = -1;

  constructor(
    owner: UnitOwner,
    regions: readonly RtsExpansionRegion[],
    builds: AiBuildManager,
    roads: RoadConstructionService,
    structures: PlacedStructureSystem,
    private readonly log: AiDecisionLog,
  ) {
    this.managers = regions.map((region) =>
      new AiExpansionManager(owner, region, builds, roads, structures, log));
  }

  /**
   * The step the §82 panel and §30's Expand score read.
   *
   * Whatever the AI is actually working on — which is not always the region
   * holding the plan. A finished region knocked back open by a raid is real work
   * on real ground, and reading only the active plan would report a placid "done"
   * while the AI was rebuilding a razed outpost.
   */
  get currentStep(): AiExpansionStep {
    const working = this.claimed.find((manager) => manager.running);
    if (working) return working.currentStep;
    // Nothing in hand: report the best outcome the claims reached, so an AI that
    // finished one region and retired another reads "done" rather than "failed".
    if (this.claimed.some((manager) => manager.done)) return "done";
    if (this.claimed.some((manager) => manager.failed)) return "failed";
    return "outpost";
  }

  /** Regions whose §47 recipe has completed and still stands. */
  get completedCount(): number {
    return this.managers.filter((manager) => manager.done).length;
  }

  /**
   * §49: is there a plan left to run? A director scoring Expand with nothing to
   * expand into would sit at a full score doing nothing — and §7's hysteresis
   * would then make that permanent.
   */
  get planAvailable(): boolean {
    return this.started < AI_MAX_EXPANSION_PLANS && this.managers[this.started] !== undefined;
  }

  /**
   * §26/§37: the AI owes every region it has claimed a tick, whatever the
   * director is currently doing. A claim with no depot is the exact failure §26
   * names, and a finished region whose outpost has just been razed owes the same
   * debt.
   *
   * Deliberately "has claims" rather than "has work": *noticing* that an outpost
   * is gone is itself the work, so a gate that only opened once work was already
   * known would never open at all.
   */
  get hasClaims(): boolean {
    return this.started > 0;
  }

  /** Advance the AI's expansion by one tick. */
  update(bb: AiBlackboard): AiExpansionStep {
    // Repair pass: every region already claimed stays responsible for its own
    // outpost, depot and road (§37). They all share the §42 build slot, so this
    // is a priority order rather than parallelism — the first damaged region
    // takes the slot and the rest wait, which is also why it runs before the
    // active plan: standing assets outrank new ground.
    for (let index = 0; index < this.started; index += 1) {
      if (index === this.activeIndex) continue;
      this.managers[index]?.update(bb);
    }

    const active = this.active;
    if (active) {
      active.update(bb);
      // Settled: hand the plan back so the director can re-decide. A finished
      // region keeps repairing through the pass above; a retired one is done.
      if (!active.running) this.activeIndex = -1;
      return this.currentStep;
    }

    this.claimNext(bb)?.update(bb);
    return this.currentStep;
  }

  reset(): void {
    for (const manager of this.managers) manager.reset();
    this.started = 0;
    this.activeIndex = -1;
  }

  private get active(): AiExpansionManager | null {
    return this.activeIndex < 0 ? null : this.managers[this.activeIndex] ?? null;
  }

  /** The regions the AI has committed to, in claim order. */
  private get claimed(): readonly AiExpansionManager[] {
    return this.managers.slice(0, this.started);
  }

  private claimNext(bb: AiBlackboard): AiExpansionManager | null {
    if (!this.planAvailable) return null;
    const index = this.started;
    const manager = this.managers[index];
    if (!manager) return null;
    // Counted when the recipe is handed the slot, not when it succeeds: §45 caps
    // what the AI *attempts*, or a region that keeps failing would let it work
    // its way through every region the map has.
    this.started += 1;
    this.activeIndex = index;
    this.log.record({
      at: bb.now,
      kind: "intent-selected",
      intent: "expand",
      reason: `genişleme planı ${this.started}/${AI_MAX_EXPANSION_PLANS}: ${manager.regionId}`,
    });
    return manager;
  }
}

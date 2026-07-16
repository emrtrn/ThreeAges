/**
 * AI structure upgrade executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17, §53; plan §48
 * ("Muhafız / Okçu / Kuşatma oranı").
 *
 * §53's composition ratio was data long before the AI could honour it: the Archer
 * and the Ram sit behind `requiredBuildingLevel: 2`, so a kingdom whose Barracks
 * is still tier 1 can only ever field Guards no matter what the ratio asks for.
 * Faz 8's acceptance criteria ("AI karışık ordu üretiyor", "AI yapı hedefleri
 * için kuşatma kullanıyor") both failed on exactly that missing step.
 *
 * The research runs through the same {@link StructureUpgradeSystem} the player's
 * palette button drives (§4), so the Town prerequisite, the cost and the
 * training pause during the upgrade are identical for both kingdoms.
 *
 * The trigger is deliberately not a rule of its own: the production manager
 * already asks for the role §53 wants and is told `requires-barracks-upgrade` by
 * the same data gate the player hits. This executor only acts on that answer, so
 * the tier gate stays in the data (§45) and no second copy of it lives here.
 */
import type { StructureUpgradeSystem } from "../structures/structureUpgradeSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";

/** How far the tier upgrade has run, for §82 and the plan's debug list. */
export type AiUpgradeStep = "idle" | "saving" | "researching" | "done";

export class AiUpgradeManager {
  private step: AiUpgradeStep = "idle";

  constructor(
    private readonly owner: UnitOwner,
    /** The building whose tier gates the §53 composition — the Barracks. */
    private readonly buildingId: string,
    private readonly upgrades: StructureUpgradeSystem,
    private readonly log: AiDecisionLog,
  ) {}

  get currentStep(): AiUpgradeStep {
    return this.step;
  }

  /**
   * Advance the research by at most one step. `blocked` is the production
   * manager's report that the composition wants a unit this tier cannot train.
   *
   * A refused start is never an error worth failing on: `not-town` and
   * `insufficient-resources` are both "later", and the Town age and the
   * stockpile are the economy's problem, not this executor's.
   */
  update(bb: AiBlackboard, blocked: boolean): AiUpgradeStep {
    const snapshot = this.upgrades.snapshot(this.owner, this.buildingId);
    if (snapshot.completed) return this.enter("done", bb, `${this.buildingId} II tamamlandı`);
    if (snapshot.upgrading) return this.enter("researching", bb, `${this.buildingId} II yükseltiliyor`);
    if (!blocked) {
      this.step = "idle";
      return this.step;
    }
    const result = this.upgrades.start(this.owner, this.buildingId);
    if (result === "started") return this.enter("researching", bb, `${this.buildingId} II başlatıldı (§53 bileşimi)`);
    // Everything else is a wait: the age has not arrived, the stockpile is short,
    // or there is no completed Barracks standing to upgrade yet.
    this.step = "saving";
    return this.step;
  }

  reset(): void {
    this.step = "idle";
  }

  private enter(step: AiUpgradeStep, bb: AiBlackboard, reason: string): AiUpgradeStep {
    if (this.step === step) return step;
    this.step = step;
    this.log.record({ at: bb.now, kind: "intent-selected", intent: "economy", reason });
    return step;
  }
}

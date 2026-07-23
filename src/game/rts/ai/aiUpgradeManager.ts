/**
 * AI centre-level upgrade executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17, §53; plan §48
 * ("Muhafız / Okçu / Kuşatma oranı") and the centre-led progression plan §4.
 *
 * §53's composition ratio was data long before the AI could honour it: the Archer
 * and the Ram sit behind a global centre tier (`requiredSettlementLevel`), so a
 * kingdom that has not levelled its centre can only ever field Guards no matter
 * what the ratio asks for.
 *
 * Under centre-led progression a unit is gated on the kingdom's global tier, not
 * a building's own level, so this executor invests in the centre level through
 * the same {@link KingdomProgressionSystem} the player's Merkez panel drives (§4).
 *
 * The trigger is deliberately not a rule of its own: the production manager
 * already asks for the role §53 wants and is told `requires-production-building-upgrade`
 * by the same data gate the player hits. This executor only acts on that answer,
 * so the tier gate stays in the data (§45) and no second copy of it lives here.
 */
import type { KingdomProgressionSystem } from "../progression/kingdomProgressionSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";

/** How far the tier upgrade has run, for §82 and the plan's debug list. */
export type AiUpgradeStep = "idle" | "saving" | "researching" | "done";

export class AiUpgradeManager {
  private step: AiUpgradeStep = "idle";

  constructor(
    private readonly owner: UnitOwner,
    private readonly progression: KingdomProgressionSystem,
    private readonly log: AiDecisionLog,
  ) {}

  get currentStep(): AiUpgradeStep {
    return this.step;
  }

  /**
   * Advance the centre level by at most one step. `blocked` is the production
   * manager's report that the composition wants a unit this tier cannot train.
   *
   * A refused start is never an error worth failing on: `insufficient-resources`
   * is "later" and the stockpile is the economy's problem, not this executor's;
   * `at-max-level` means the tier ladder is exhausted and nothing more will open.
   */
  update(bb: AiBlackboard, blocked: boolean): AiUpgradeStep {
    const snapshot = this.progression.snapshot(this.owner);
    if (snapshot.upgrading) return this.enter("researching", bb, "merkez seviyesi yükseltiliyor");
    if (!blocked) {
      this.step = "idle";
      return this.step;
    }
    const result = this.progression.startLevelUpgrade(this.owner);
    if (result === "started") return this.enter("researching", bb, "§53 bileşimi için merkez seviyesi başlatıldı");
    if (result === "at-max-level") return this.enter("done", bb, "merkez en yüksek seviyede");
    // Everything else is a wait: the stockpile is short, or the centre is gone.
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

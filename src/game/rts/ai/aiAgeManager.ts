/**
 * AI age executor — `07_ENEMY_AI_DESIGN_v0.2.md` §17, §24; plan §48
 * ("AI Kasaba çağına ulaşıyor").
 *
 * Turns a committed AgeUp plan into the one call the player's own centre panel
 * makes, {@link AgeSystem.startTownUpgrade} (§4: same rules, same cost, same
 * atomic four-resource reservation).
 *
 * There is deliberately no build logic here. The Town age's requirement list is
 * data, and every id on it — farm, lumber camp, quarry, gold mine, barracks,
 * outpost — is already something the economy and expansion executors build on
 * their own. So this manager only has to answer "can we start, and did it take",
 * and the AI reaches Town by running its ordinary economy well rather than by
 * following a separate age script.
 */
import type { AgeSystem, AgeUpgradeResult } from "../progression/ageSystem";
import type { UnitOwner } from "../units/unit";
import type { AiBlackboard } from "./aiBlackboard";
import type { AiDecisionLog } from "./aiDecisionLog";
import type { AiFailureReason } from "./aiTypes";

/** What one age tick did, so the controller can close the plan (§32). */
export type AiAgeOutcome =
  | { readonly kind: "started" }
  | { readonly kind: "upgrading" }
  | { readonly kind: "done" }
  /** A recoverable wait — no resources yet, or a requirement still missing. */
  | { readonly kind: "waiting"; readonly reason: AiFailureReason }
  | { readonly kind: "failed"; readonly reason: AiFailureReason };

export class AiAgeManager {
  constructor(
    private readonly owner: UnitOwner,
    private readonly ages: AgeSystem,
    private readonly log: AiDecisionLog,
  ) {}

  /** Try to advance the age by one step. Called while the intent is AgeUp. */
  update(bb: AiBlackboard): AiAgeOutcome {
    if (bb.age === "town") return { kind: "done" };
    if (bb.ageUpgrading) return { kind: "upgrading" };

    const result = this.ages.startTownUpgrade(this.owner);
    if (result === "started") {
      this.log.record({
        at: bb.now,
        kind: "intent-selected",
        intent: "ageUp",
        reason: "kasaba yükseltmesi başladı",
      });
      return { kind: "started" };
    }
    return this.outcomeFor(result, bb);
  }

  /**
   * §43: name the reason rather than retrying blindly. Only a genuinely
   * unrecoverable state fails the plan — a missing requirement or an empty
   * stockpile is a wait, because the economy executor is what fixes both and it
   * needs the director free to go back to it.
   */
  private outcomeFor(result: AgeUpgradeResult, bb: AiBlackboard): AiAgeOutcome {
    switch (result) {
      case "already-town": return { kind: "done" };
      case "already-upgrading": return { kind: "upgrading" };
      case "missing-requirements": return { kind: "waiting", reason: "required-node-missing" };
      case "insufficient-resources": return { kind: "waiting", reason: "insufficient-resources" };
      case "no-command-center":
      default:
        // Losing the centre ends the match anyway; failing loudly here keeps a
        // dead kingdom from silently re-queuing an upgrade every tick.
        this.log.record({
          at: bb.now,
          kind: "plan-failed",
          intent: "ageUp",
          reason: "çağ yükseltmesi başarısız: merkez yok",
          failureReason: "timeout",
        });
        return { kind: "failed", reason: "timeout" };
    }
  }
}

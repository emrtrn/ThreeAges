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
import type {
  KingdomProgressionSystem,
  LevelUpgradeResult,
  TownUpgradeResult,
} from "../progression/kingdomProgressionSystem";
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
    /**
     * Centre-led progression. Reaching Town is now two things through one system:
     * buying centre levels up to Settlement Lv3 (no other executor ever levels
     * the centre, so this manager has to), then paying the Town transition.
     */
    private readonly progression: KingdomProgressionSystem,
    private readonly log: AiDecisionLog,
  ) {}

  /** Try to advance toward Town by one step. Called while the intent is AgeUp. */
  update(bb: AiBlackboard): AiAgeOutcome {
    if (bb.age === "town") return { kind: "done" };
    if (bb.ageUpgrading) return { kind: "upgrading" };

    const snapshot = this.progression.snapshot(this.owner);
    // Below Settlement Lv3 the Town gate is not open yet: climb the centre level
    // ladder first. Each level is "cost only", so a refused start is only ever a
    // wait on the stockpile.
    if (snapshot.level < 3) {
      const result = this.progression.startLevelUpgrade(this.owner);
      if (result === "started") {
        this.log.record({
          at: bb.now,
          kind: "intent-selected",
          intent: "ageUp",
          reason: "kasaba için merkez seviyesi yükseltiliyor",
        });
        return { kind: "started" };
      }
      return this.levelOutcome(result, bb);
    }
    // Settlement Lv3: start the one-way Town transition.
    const result = this.progression.startTownUpgrade(this.owner);
    if (result === "started") {
      this.log.record({
        at: bb.now,
        kind: "intent-selected",
        intent: "ageUp",
        reason: "kasaba yükseltmesi başladı",
      });
      return { kind: "started" };
    }
    return this.townOutcome(result, bb);
  }

  /**
   * §43: name the reason rather than retrying blindly. A centre level-up only
   * ever refuses for lack of resources (or a race with an in-flight one), both of
   * which the economy executor resolves — so this is always a recoverable wait
   * unless the centre itself is gone.
   */
  private levelOutcome(result: LevelUpgradeResult, bb: AiBlackboard): AiAgeOutcome {
    switch (result) {
      case "already-upgrading": return { kind: "upgrading" };
      case "at-max-level": return { kind: "waiting", reason: "insufficient-resources" };
      case "insufficient-resources": return { kind: "waiting", reason: "insufficient-resources" };
      case "no-command-center":
      default: return this.failNoCentre(bb);
    }
  }

  /**
   * §43 for the Town transition. A missing requirement or an empty stockpile is a
   * wait — the economy executor fixes both and needs the director free to return
   * to it. Only a lost centre fails the plan.
   */
  private townOutcome(result: TownUpgradeResult, bb: AiBlackboard): AiAgeOutcome {
    switch (result) {
      case "already-town": return { kind: "done" };
      case "already-upgrading": return { kind: "upgrading" };
      case "settlement-level": return { kind: "waiting", reason: "insufficient-resources" };
      case "missing-requirements": return { kind: "waiting", reason: "required-node-missing" };
      case "insufficient-resources": return { kind: "waiting", reason: "insufficient-resources" };
      case "no-command-center":
      default: return this.failNoCentre(bb);
    }
  }

  /** Losing the centre ends the match; fail loudly so a dead kingdom stops re-queuing. */
  private failNoCentre(bb: AiBlackboard): AiAgeOutcome {
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

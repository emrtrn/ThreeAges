/**
 * Faz 1 match outcome — the enemy command centre is the victory objective.
 * UI presentation and restart ownership remain outside this state holder.
 */
import type { CommandCenterSystem } from "../structures/commandCenterSystem";

export type RtsMatchOutcome = "active" | "victory";

export class RtsMatchState {
  private outcomeValue: RtsMatchOutcome = "active";

  get outcome(): RtsMatchOutcome {
    return this.outcomeValue;
  }

  get active(): boolean {
    return this.outcomeValue === "active";
  }

  /** Resolve the one-way Faz 1 win condition. */
  update(centers: CommandCenterSystem): RtsMatchOutcome {
    if (!this.active) return this.outcomeValue;
    if (centers.get("enemy")?.health.depleted) this.outcomeValue = "victory";
    return this.outcomeValue;
  }

  /** Return the match result holder to a fresh playable state. */
  reset(): void {
    this.outcomeValue = "active";
  }
}

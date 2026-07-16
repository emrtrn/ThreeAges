/**
 * Match outcome — a command centre is the objective for *both* kingdoms.
 *
 * Faz 1 only resolved the player's win, because nothing could threaten the
 * player's centre. Faz 5's AI can, and plan §39 asks for "Oyuncu veya AI maçı
 * kazanabiliyor", so the result is now symmetric.
 *
 * UI presentation and restart ownership remain outside this state holder.
 */
import type { CommandCenterSystem } from "../structures/commandCenterSystem";

export type RtsMatchOutcome = "active" | "victory" | "defeat";

export class RtsMatchState {
  private outcomeValue: RtsMatchOutcome = "active";

  get outcome(): RtsMatchOutcome {
    return this.outcomeValue;
  }

  get active(): boolean {
    return this.outcomeValue === "active";
  }

  /** Resolve the one-way win condition, from the player's point of view. */
  update(centers: CommandCenterSystem): RtsMatchOutcome {
    if (!this.active) return this.outcomeValue;
    // A mutual kill on the same tick reads as a defeat: losing your own centre
    // is the more specific outcome, and leaving it a win would let the player
    // trade a loss for a victory.
    if (centers.get("player")?.health.depleted) this.outcomeValue = "defeat";
    else if (centers.get("enemy")?.health.depleted) this.outcomeValue = "victory";
    return this.outcomeValue;
  }

  /** Return the match result holder to a fresh playable state. */
  reset(): void {
    this.outcomeValue = "active";
  }
}

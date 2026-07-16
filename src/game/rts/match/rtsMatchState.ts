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

/**
 * How the match ended. Faz 9 §51 added surrender, giving defeat two causes —
 * and a result screen that says "Merkeziniz yıkıldı" to a player who resigned
 * with their centre standing is simply lying about what happened.
 */
export type RtsMatchEndReason = "center-destroyed" | "surrendered";

export class RtsMatchState {
  private outcomeValue: RtsMatchOutcome = "active";
  private reasonValue: RtsMatchEndReason | null = null;

  get outcome(): RtsMatchOutcome {
    return this.outcomeValue;
  }

  /** Null while the match is active; set once and only by whatever ended it. */
  get reason(): RtsMatchEndReason | null {
    return this.reasonValue;
  }

  get active(): boolean {
    return this.outcomeValue === "active";
  }

  /**
   * §51 "Teslim ol". Resigning is a defeat the player chose, so it goes through
   * the same one-way door as a destroyed centre rather than a parallel flag.
   *
   * @returns whether this call ended the match. A decided match ignores it: you
   * cannot resign a game you have already won.
   */
  surrender(): boolean {
    if (!this.active) return false;
    this.outcomeValue = "defeat";
    this.reasonValue = "surrendered";
    return true;
  }

  /** Resolve the one-way win condition, from the player's point of view. */
  update(centers: CommandCenterSystem): RtsMatchOutcome {
    if (!this.active) return this.outcomeValue;
    // A mutual kill on the same tick reads as a defeat: losing your own centre
    // is the more specific outcome, and leaving it a win would let the player
    // trade a loss for a victory.
    if (centers.get("player")?.health.depleted) this.outcomeValue = "defeat";
    else if (centers.get("enemy")?.health.depleted) this.outcomeValue = "victory";
    if (!this.active) this.reasonValue = "center-destroyed";
    return this.outcomeValue;
  }

  /** Return the match result holder to a fresh playable state. */
  reset(): void {
    this.outcomeValue = "active";
    this.reasonValue = null;
  }
}

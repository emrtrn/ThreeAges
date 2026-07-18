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
import type { UnitOwner } from "../units/unit";

export type RtsMatchOutcome = "active" | "victory" | "defeat";

/**
 * How the match ended. Faz 9 §51 added surrender, giving defeat two causes —
 * and a result screen that says "Merkeziniz yıkıldı" to a player who resigned
 * with their centre standing is simply lying about what happened.
 *
 * Faz 11 §58 added `regional-control` for the same reason: a second victory
 * *condition* is only readable if the result screen can name it. A player who
 * lost with a healthy centre and a full army needs to be told the passes were
 * held, or the loss looks like a bug.
 */
export type RtsMatchEndReason = "center-destroyed" | "surrendered" | "regional-control";

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

  /**
   * §58's second win condition, resolved from the kingdom whose regional counter
   * completed — {@link RegionalVictorySystem.winner}'s output, passed straight
   * through.
   *
   * Takes the winning *owner* rather than a boolean because this state holder is
   * symmetric (§39: "Oyuncu veya AI maçı kazanabiliyor") and a boolean would
   * have to be named from the player's side by the caller, putting the "which of
   * us won" decision in two places. Null — nobody has completed — is the common
   * case and does nothing, so the caller may hand it every tick.
   *
   * Deliberately does *not* out-rank a decided match: a centre razed on the same
   * tick the counter filled has already ended the match, and the counter cannot
   * un-end it.
   *
   * @returns whether this call ended the match.
   */
  resolveRegionalControl(winner: UnitOwner | null): boolean {
    if (!this.active || winner === null) return false;
    this.outcomeValue = winner === "player" ? "victory" : "defeat";
    this.reasonValue = "regional-control";
    return true;
  }

  /** Return the match result holder to a fresh playable state. */
  reset(): void {
    this.outcomeValue = "active";
    this.reasonValue = null;
  }
}

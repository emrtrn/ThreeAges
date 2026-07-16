/**
 * Match lifecycle — Vertical Slice Plan v0.2 §51 "Maç akışı" (Faz 9).
 *
 * Answers one question: *is the simulation supposed to be running right now.*
 * Deliberately not merged into {@link RtsMatchState}, which answers a different
 * one: *who won.* Keeping them apart is what lets each stay a plain, testable
 * fact — and it means "ended" is never stored twice. There is no `ended` phase
 * here: a decided match is one the outcome already knows about, and a second
 * copy of that truth is a copy that can disagree.
 *
 * Pure state, no DOM: `test:engine` drives the transitions directly.
 */

export type RtsMatchPhase = "start" | "playing" | "paused";

export class RtsMatchFlow {
  /**
   * A match does not run until the player says so (§51 "basit başlatma
   * ekranı"). Booting straight into a live match means the opening — the one
   * part of an RTS that is pure economy and pure decision — is already being
   * spent while the player is still reading the screen.
   */
  private phaseValue: RtsMatchPhase = "start";

  get phase(): RtsMatchPhase {
    return this.phaseValue;
  }

  /** True only while the simulation should advance. */
  get running(): boolean {
    return this.phaseValue === "playing";
  }

  /** @returns whether this call changed the phase. */
  begin(): boolean {
    if (this.phaseValue !== "start") return false;
    this.phaseValue = "playing";
    return true;
  }

  pause(): boolean {
    if (this.phaseValue !== "playing") return false;
    this.phaseValue = "paused";
    return true;
  }

  resume(): boolean {
    if (this.phaseValue !== "paused") return false;
    this.phaseValue = "playing";
    return true;
  }

  /**
   * Pause/resume from one key. A no-op on the start screen: the match has not
   * begun, so there is nothing to pause, and letting Escape "pause" it there
   * would strand the player behind a menu with no running match under it.
   */
  togglePause(): boolean {
    return this.pause() || this.resume();
  }

  /**
   * A restart is a *running* match, not a trip back to the start screen: the
   * player pressed "Yeniden Başlat", which is already the decision the start
   * screen exists to ask for.
   */
  restart(): void {
    this.phaseValue = "playing";
  }
}

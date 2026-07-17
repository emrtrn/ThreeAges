/**
 * Match duration — Vertical Slice Plan v0.2 §53 "Kapı B öncesi yapılacaklar" (2).
 *
 * Kapı B's central box is "askerî zafer çoğu maçta 12–25 dakika içinde
 * gerçekleşiyor", and until this existed that sentence could not be checked: no
 * clock anywhere counted a match. This is the instrument for it — one number,
 * made visible — and deliberately not §71's "Minimum Telemetri" (Faz 13), which
 * is a different job: collecting match *statistics*.
 *
 * It counts **simulation** seconds, never wall-clock ones. A stopwatch cannot
 * answer the box's question, because §38's 2X/4X/8X control severs the two: five
 * wall minutes at 8X is a forty-minute match, and a speed changed halfway
 * through makes any after-the-fact multiplication wrong. So the clock is advanced
 * by the simulation tick itself — the same delta the systems age on. Scaling with
 * speed and stopping on pause are then not features it implements but facts about
 * where it is ticked: no tick, no time.
 *
 * A third fact, kept apart from {@link RtsMatchState} ("who won") and
 * {@link RtsMatchFlow} ("is it running") for the reason those two are already
 * apart: each stays a plain, testable fact, and none of them stores a second copy
 * of another's truth.
 *
 * Pure state, no DOM: `test:engine` drives it directly.
 */

export class RtsMatchClock {
  private secondsValue = 0;

  /** Simulation seconds elapsed since the match began. */
  get seconds(): number {
    return this.secondsValue;
  }

  /**
   * Age the clock by one simulation step. Takes the step the systems were given,
   * so the clock cannot disagree with them about how long the match has been.
   *
   * Non-finite and negative steps are ignored rather than thrown on: a clock is
   * an instrument, and one that can end a match by raising is worse than one that
   * refuses to run backwards.
   */
  advance(simulationSeconds: number): void {
    if (!Number.isFinite(simulationSeconds) || simulationSeconds <= 0) return;
    this.secondsValue += simulationSeconds;
  }

  /** Back to zero for a fresh match. */
  reset(): void {
    this.secondsValue = 0;
  }
}

/**
 * `m:ss`, counting minutes past the hour rather than rolling into one: this is
 * read against "12–25 dakika", so a 72-minute match should say `72:15` and not
 * hide the answer behind an hour field the reader has to add back.
 */
export function formatMatchDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

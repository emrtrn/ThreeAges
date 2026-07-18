/**
 * The §58 regional victory counter — Vertical Slice Plan v0.2 (Faz 11).
 *
 * One number per kingdom: how long it has held *both* authored objectives. It
 * reads {@link StrategicPointSystem} and decides nothing about the match; the
 * caller asks {@link winner} and does the ending. Keeping the counter separate
 * from the outcome is the same split the match already makes between
 * `RtsMatchFlow` ("is it running") and `RtsMatchState` ("who won").
 *
 * §58's three behavioural boxes are the three branches of {@link advance}:
 *
 *  - **hold both, uncontested** → the counter climbs.
 *  - **hold some** (one point, or both with an enemy standing on one) → it
 *    *stalls*. Contesting a single point is enough to stop the clock, which is
 *    what makes "AI sayacı durdurmak için tepki veriyor" an achievable reaction
 *    rather than a demand that the AI retake ground it has already lost.
 *  - **hold none** → it *decays*. Not resets: a reset would make the counter a
 *    binary the loser can never re-enter, and it would make the moment a point
 *    flips silently catastrophic. Decay is slower than gain
 *    ({@link DEFAULT_REGIONAL_VICTORY_SETTINGS}), so ground taken keeps some
 *    value while a lapse stays recoverable.
 *
 * Both halves of "sayaç sürpriz yenilgi yaratmıyor" (§58) live here rather than
 * in the UI: the requirement is long enough that no counter completes without a
 * sustained, visible map presence, and {@link warning} lets the caller raise the
 * alarm well before the end instead of at it.
 *
 * Pure state, no DOM, no three.js — `test:engine` advances it directly.
 */
import type { UnitOwner } from "../units/unit";
import type { StrategicPointSystem } from "./strategicPointSystem";

export interface RegionalVictorySettings {
  /** Simulation seconds of uncontested control of every point needed to win. */
  readonly requiredSeconds: number;
  /** Fraction of a second the counter loses per second while holding nothing. */
  readonly decayPerSecond: number;
  /** Remaining seconds at which {@link warning} starts reporting true. */
  readonly warningSeconds: number;
}

/**
 * Three minutes of *uncontested* control of both objectives, against an enemy
 * free to walk onto either and stop the clock with a single unit.
 *
 * The number is chosen against §58's last acceptance box — "İkinci zafer türü
 * askerî zaferi gereksiz hale getirmiyor". A kingdom that can hold both passes
 * for three unbroken minutes has already beaten the opponent's field army in two
 * places at once, which is a harder standing than the one that razes a centre;
 * so this is a second *route*, not a shortcut. Decay at a third of the gain rate
 * means a fully lapsed counter takes nine minutes to fall back to zero.
 */
export const DEFAULT_REGIONAL_VICTORY_SETTINGS: RegionalVictorySettings = {
  requiredSeconds: 180,
  decayPerSecond: 1 / 3,
  warningSeconds: 60,
};

/** What the counter is doing for one kingdom this tick, for UI and logs. */
export type RegionalVictoryPhase = "holding" | "stalled" | "decaying";

export interface RegionalVictoryProgress {
  readonly owner: UnitOwner;
  readonly phase: RegionalVictoryPhase;
  /** Simulation seconds banked, 0..`requiredSeconds`. */
  readonly seconds: number;
  /** 0..1, for a bar that does not have to know the requirement. */
  readonly ratio: number;
  /** Seconds of held time still needed; 0 once the counter has completed. */
  readonly remainingSeconds: number;
  /** Points secured out of the authored total, for "1/2"-style readouts. */
  readonly secured: number;
  readonly total: number;
}

export class RegionalVictorySystem {
  private readonly progress = new Map<UnitOwner, number>();
  private readonly phases = new Map<UnitOwner, RegionalVictoryPhase>();

  constructor(
    private readonly owners: readonly UnitOwner[],
    private readonly points: StrategicPointSystem,
    private readonly settings: RegionalVictorySettings = DEFAULT_REGIONAL_VICTORY_SETTINGS,
  ) {
    this.reset();
  }

  /**
   * Age every kingdom's counter by one simulation step.
   *
   * Takes the same delta the systems age on, so the counter scales with §38's
   * speed control and freezes on pause without holding a clock of its own —
   * exactly {@link RtsMatchClock}'s arrangement, and for the same reason.
   */
  advance(simulationSeconds: number): void {
    if (!Number.isFinite(simulationSeconds) || simulationSeconds <= 0) return;
    for (const owner of this.owners) {
      const secured = this.points.securedBy(owner).length;
      const current = this.progress.get(owner) ?? 0;
      if (this.points.holdsAll(owner)) {
        this.phases.set(owner, "holding");
        this.progress.set(owner, Math.min(this.settings.requiredSeconds, current + simulationSeconds));
      } else if (secured > 0) {
        this.phases.set(owner, "stalled");
      } else {
        this.phases.set(owner, "decaying");
        this.progress.set(owner, Math.max(0, current - simulationSeconds * this.settings.decayPerSecond));
      }
    }
  }

  progressFor(owner: UnitOwner): RegionalVictoryProgress {
    const seconds = this.progress.get(owner) ?? 0;
    const total = this.points.all().length;
    return {
      owner,
      phase: this.phases.get(owner) ?? "decaying",
      seconds,
      ratio: this.settings.requiredSeconds > 0
        ? Math.min(1, seconds / this.settings.requiredSeconds)
        : 0,
      remainingSeconds: Math.max(0, this.settings.requiredSeconds - seconds),
      secured: this.points.securedBy(owner).length,
      total,
    };
  }

  all(): readonly RegionalVictoryProgress[] {
    return this.owners.map((owner) => this.progressFor(owner));
  }

  /**
   * The kingdom whose counter has completed, or null.
   *
   * Ties cannot happen — a point has one holder, so two kingdoms can never both
   * hold every point — but the owner order still decides deterministically if a
   * future map ever authors zero points, where `holdsAll` is false for everyone
   * and nobody ever completes.
   */
  winner(): UnitOwner | null {
    return this.owners.find((owner) =>
      (this.progress.get(owner) ?? 0) >= this.settings.requiredSeconds) ?? null;
  }

  /**
   * True when this kingdom is close enough to winning that the *other* one needs
   * telling. Deliberately reported while the counter is stalled as well as while
   * it climbs: a stall is one unit walking away from being a loss, and a warning
   * that vanishes the moment you contest is a warning that trains the player to
   * stop watching.
   */
  warning(owner: UnitOwner): boolean {
    const { remainingSeconds, seconds } = this.progressFor(owner);
    return seconds > 0 && remainingSeconds <= this.settings.warningSeconds;
  }

  reset(): void {
    for (const owner of this.owners) {
      this.progress.set(owner, 0);
      this.phases.set(owner, "decaying");
    }
  }
}

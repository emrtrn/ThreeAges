/**
 * Which music the match should be playing — audio plan §28's state system.
 *
 * The design names six states; four of them belong to a running match and are
 * decided here (MENU is the shell's, RESULT is the two closing stingers). What
 * this module does *not* do is play anything: it turns a sample of the match
 * into a state name, and `MusicDirector` owns the sound. Pure, so `test:engine`
 * drives the whole state machine without a scene — which matters more here than
 * usual, because the interesting behaviour is what happens over *time* and
 * nobody can sit through a twenty-minute match to check a hysteresis window.
 *
 * §35's "battle trigger" note is the rule this implements, and its warning is
 * the reason the shape is what it is: *a single enemy coming into view must not
 * start battle music.* Seeing an enemy and fighting one are different facts, and
 * they get different states.
 */

import type { SettlementAge } from "@/game/data/gameDataTypes";
import type { CombatTargetOwner } from "@/game/rts/combat/combatTarget";

/** The four states a running match moves between, weakest first. */
export const RTS_MUSIC_STATES = ["settlement", "expansion", "tension", "battle"] as const;
export type RtsMusicState = (typeof RTS_MUSIC_STATES)[number];

/** Position in {@link RTS_MUSIC_STATES}; higher is more intense. */
export function musicStateRank(state: RtsMusicState): number {
  return RTS_MUSIC_STATES.indexOf(state);
}

/**
 * One reading of the match, as the three signals the design chose plus the age.
 *
 * Deliberately not a snapshot of the world: this module takes numbers, so the
 * host owns every question about *what counts* (which units are visible through
 * the fog, what the player's centre is) and this owns only what the numbers
 * mean. That split is what lets the thresholds be tested against invented
 * numbers instead of an assembled match.
 */
export interface RtsMusicSignal {
  /** Enemy fighting units inside the player's vision. Wildlife is not an enemy. */
  readonly visibleEnemies: number;
  /** Fights under way — units of either side currently holding an attack target. */
  readonly activeFights: number;
  /** Distance from the player's centre to the nearest visible enemy; null when none is seen. */
  readonly threatDistance: number | null;
  /** The player's current age. Settlement plays at the opening age, expansion after it. */
  readonly age: SettlementAge;
}

/**
 * Thresholds and timings. Tuning, not contract — retuned by ear like every other
 * number in `events.json`, which is where these live, so nothing here asserts a
 * magnitude.
 */
export interface RtsMusicStateSettings {
  /** Visible enemies that make the match tense. */
  readonly tensionVisibleEnemies: number;
  /** Simultaneous fights that make it a battle. */
  readonly battleActiveFights: number;
  /**
   * How close a *seen* enemy has to get to the player's centre to be a battle
   * on its own, before a blow has landed.
   *
   * Without this the music would wait for contact while a siege column walks
   * into the town square, which is the moment the player most needs telling.
   */
  readonly threatRadius: number;
  /**
   * How long a raised state holds after its cause is gone.
   *
   * The whole reason the machine is not a pure function of the sample. Combat is
   * spiky — a fight ends for two seconds while the next pair closes — and a
   * state that followed the sample exactly would flap between battle and
   * settlement several times per skirmish, crossfading each way. Rising is
   * immediate because being late to a battle is worse than being early to calm.
   */
  readonly calmSeconds: number;
}

export const DEFAULT_RTS_MUSIC_STATE_SETTINGS: RtsMusicStateSettings = {
  tensionVisibleEnemies: 1,
  battleActiveFights: 2,
  threatRadius: 28,
  calmSeconds: 14,
};

/**
 * Reads the `music.states` block of `events.json`.
 *
 * Parsed here rather than by the engine's table normalizer, and the boundary is
 * the reason: "how many enemies are visible" and "how close is the centre" are
 * facts about *this* game, and an engine that knew them would stop being a
 * template. The engine owns the transition timing beside it (`crossfadeSeconds`
 * and friends), which is true of any playlist anywhere; it passes this block
 * through untouched.
 *
 * Absent is legal and gives the defaults — a fork with one music track has no
 * states to tune.
 */
export function normalizeRtsMusicStateSettings(value: unknown): RtsMusicStateSettings {
  if (value === undefined || value === null) return DEFAULT_RTS_MUSIC_STATE_SETTINGS;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("music.states must be an object");
  }
  const input = value as Record<string, unknown>;
  const read = (key: keyof RtsMusicStateSettings, min: number, max: number): number => {
    const raw = input[key];
    if (raw === undefined) return DEFAULT_RTS_MUSIC_STATE_SETTINGS[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new Error(`music.states.${key} must be a finite number`);
    }
    if (raw < min || raw > max) {
      throw new Error(`music.states.${key} must be within [${min}, ${max}] (got ${raw})`);
    }
    return raw;
  };
  return {
    // Floored at one: a threshold of zero would make every peacetime match
    // tense, which is not a tuning anybody wants and is easy to type by accident.
    tensionVisibleEnemies: Math.round(read("tensionVisibleEnemies", 1, 64)),
    battleActiveFights: Math.round(read("battleActiveFights", 1, 64)),
    threatRadius: read("threatRadius", 0, 500),
    calmSeconds: read("calmSeconds", 0, 300),
  };
}

/**
 * Whether one unit's current attack belongs in {@link RtsMusicSignal.activeFights}.
 *
 * Two conditions, and both were learned from the same complaint — battle music
 * inside the first minute of a match nobody had fought yet:
 *
 * 1. **The target is a kingdom, not an animal.** A hunt and a wolf cull are
 *    combat-shaped — a Guard holds an attack target, arrows fly, something dies
 *    — but wildlife is not an enemy, which {@link RtsMusicSignal.visibleEnemies}
 *    already says in its own half of the signal. Counting a wolf here made the
 *    two halves disagree, and two Guards answering one wolf that wandered onto
 *    owned ground was a battle by the numbers.
 * 2. **The player can see it.** Every other world sound passes the fog gate, and
 *    the reason is the same here as there: music that tensed for a fight behind
 *    the curtain would hand the player a scouting tool they were never given.
 *    The gate is not the loss it sounds like — the player's own units are always
 *    inside their own vision, so an ambush being sprung on them still counts
 *    from the victim's side even while the ambusher is invisible.
 */
export function countsAsActiveFight(
  targetOwner: CombatTargetOwner | null,
  audible: boolean,
): boolean {
  return targetOwner !== null && targetOwner !== "wild" && audible;
}

/**
 * The state this sample alone calls for, before any hysteresis.
 *
 * Read top-down: a battle outranks tension outranks the peacetime pair, and the
 * peacetime pair is the age. Nothing here looks at the previous state — that is
 * {@link RtsMusicStateMachine}'s job, and keeping the two apart is what makes
 * "what does this sample mean" testable in one line.
 */
export function resolveMusicState(
  signal: RtsMusicSignal,
  settings: RtsMusicStateSettings = DEFAULT_RTS_MUSIC_STATE_SETTINGS,
): RtsMusicState {
  const besieged =
    signal.threatDistance !== null && signal.threatDistance <= settings.threatRadius;
  if (signal.activeFights >= settings.battleActiveFights || besieged) return "battle";
  if (signal.visibleEnemies >= settings.tensionVisibleEnemies) return "tension";
  return signal.age === "settlement" ? "settlement" : "expansion";
}

/**
 * Holds the state steady against a flapping signal.
 *
 * Asymmetric on purpose: a rise takes effect on the frame it is seen, a fall has
 * to survive {@link RtsMusicStateSettings.calmSeconds} of quiet. A drop that is
 * interrupted starts its wait over, so a skirmish that keeps flaring never
 * reaches calm at all — which is the behaviour a player reads as "the music
 * knows the fight is still on".
 */
export class RtsMusicStateMachine {
  private readonly settings: RtsMusicStateSettings;
  private state: RtsMusicState = "settlement";
  /** The lower state waiting out its calm window, or null when none is pending. */
  private falling: { readonly to: RtsMusicState; readonly since: number } | null = null;

  constructor(settings: RtsMusicStateSettings = DEFAULT_RTS_MUSIC_STATE_SETTINGS) {
    this.settings = settings;
  }

  /** The state currently sounding. */
  get current(): RtsMusicState {
    return this.state;
  }

  /** Feeds one sample and returns the state that should be playing after it. */
  update(signal: RtsMusicSignal, clockSeconds: number): RtsMusicState {
    const target = resolveMusicState(signal, this.settings);
    if (musicStateRank(target) >= musicStateRank(this.state)) {
      this.state = target;
      this.falling = null;
      return this.state;
    }
    if (!this.falling || this.falling.to !== target) {
      this.falling = { to: target, since: clockSeconds };
    }
    if (clockSeconds - this.falling.since >= this.settings.calmSeconds) {
      this.state = target;
      this.falling = null;
    }
    return this.state;
  }

  /** Drops back to the opening state — for a match that ends or restarts. */
  reset(): void {
    this.state = "settlement";
    this.falling = null;
  }
}

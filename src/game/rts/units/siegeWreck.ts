/**
 * What is left of a gun that has been destroyed — siege crew plan Faz 4 (K-09).
 *
 * A cannon is not a body, and until now it died like one: with no authored death
 * clip its presentation reported no `deathSeconds`, so `updateDeath` fell back to
 * the code tip-over and laid a wheeled carriage on its side like a felled
 * soldier. This is the answer — an authored timeline that drops the barrel,
 * breaks the wheels off and collapses the carriage — and reporting its length is
 * what takes the tip-over off the gun for good.
 *
 * Pure by the same contract as `siegeCrewAnimation`: no Three.js, no DOM. It
 * answers "at t seconds into the wreck, where is everything and what should be
 * playing", and the driver in `../content/rtsUnitPresentation` is what writes
 * that onto nodes. That is what makes the timeline testable headless, and it is
 * why the wreck can be verified without a renderer.
 *
 * **No ragdoll and no collision.** The barrel falls on an authored curve and the
 * wheels roll on authored headings; nothing here is simulated, queried against
 * the ground, or allowed to influence anything. `unitDeath`'s rule holds: the
 * fall is an authored clip or a code tip-over, never a physics result.
 */

/** Notify names the wreck asks for; `rtsNotifyEffects` owns what they draw. */
export const SIEGE_WRECK_BLAST_NOTIFY = "wreck-blast";
export const SIEGE_WRECK_FIRE_NOTIFY = "wreck-fire";
export const SIEGE_WRECK_SMOKE_NOTIFY = "wreck-smoke";

/**
 * When each part of the wreck happens, in seconds from the gun's death.
 *
 * Authored here rather than in balance data because none of it is tunable
 * gameplay: no number below changes what a gun is worth, how long it takes to
 * kill, or how long the body stays on the field (the corpse window is
 * `UNIT_CORPSE_SECONDS`, and it already outlasts all of this). They are the
 * shape of one animation, and they live beside the code that plays it for the
 * same reason a clip's sections live beside the asset.
 */
export interface SiegeWreckTiming {
  /** When the wheels let go of the carriage. */
  readonly wheelBreakSeconds: number;
  /** How long a wheel rolls before friction stops it. */
  readonly wheelRollSeconds: number;
  /** How far a wheel travels before it stops, in world units. */
  readonly wheelRollDistance: number;
  /** How long the barrel takes to come off its pivot and reach the ground. */
  readonly barrelFallSeconds: number;
  /** How far the muzzle drops, in world units. */
  readonly barrelDropDistance: number;
  /** How far the barrel pitches over as it falls, in radians. */
  readonly barrelPitchRadians: number;
  /** When the carriage has finished collapsing — the wreck's own `tBreak`. */
  readonly collapseSeconds: number;
  /** When the fire catches. */
  readonly fireStartSeconds: number;
  /** How often the flame is re-requested while the wreck burns. */
  readonly fireIntervalSeconds: number;
  /** How often the smoke is; deliberately rarer, so the two do not read as one. */
  readonly smokeIntervalSeconds: number;
  /** How long the wreck keeps asking for fire and smoke at all. */
  readonly burnSeconds: number;
}

export const SIEGE_WRECK_TIMING: SiegeWreckTiming = {
  // Not zero: the blast has to read as what threw the wheels off, so the wheels
  // leave a beat after it rather than with it.
  wheelBreakSeconds: 0.15,
  wheelRollSeconds: 1.4,
  wheelRollDistance: 2.2,
  barrelFallSeconds: 0.9,
  // The barrel pivot sits about a metre up on the shipped carriage, and the
  // carriage is collapsing under it, so the drop is a little more than that.
  barrelDropDistance: 1.05,
  barrelPitchRadians: 1.05,
  collapseSeconds: 1.8,
  fireStartSeconds: 0.3,
  fireIntervalSeconds: 0.55,
  smokeIntervalSeconds: 1.4,
  // Well inside `UNIT_CORPSE_SECONDS`: a wreck that burned for the whole corpse
  // window would leave a permanent bonfire wherever a gun ever died.
  burnSeconds: 12,
};

/** Where one wheel is, relative to the pivot it broke off. */
export interface SiegeWreckWheelFrame {
  /** Extra spin about the wheel's own authored axis, in radians. */
  readonly rollRadians: number;
  /** How far it has travelled from its pivot, in world units. */
  readonly travel: number;
  /** Heading it rolls along, in radians about the carriage's up axis. */
  readonly headingRadians: number;
  /** How far it has fallen onto its side once it stops, in radians. */
  readonly tiltRadians: number;
}

/** The whole wreck at one instant. */
export interface SiegeWreckFrame {
  /** Collapse progress for `applyStructureDeformation`, 0 (intact) to 1. */
  readonly collapseProgress: number;
  /** How far the barrel has dropped, in world units. */
  readonly barrelDrop: number;
  /** How far it has pitched over, in radians, added to its authored rest pose. */
  readonly barrelPitch: number;
  readonly wheels: readonly SiegeWreckWheelFrame[];
}

/** The wreck's own clock and what it has already asked for. */
export interface SiegeWreckState {
  readonly elapsedSeconds: number;
  /** True once the opening blast has been requested; it happens exactly once. */
  readonly blasted: boolean;
  /** When the flame was last asked for, in wreck-seconds; -1 before the first. */
  readonly lastFireSeconds: number;
  readonly lastSmokeSeconds: number;
}

export const SIEGE_WRECK_NONE: SiegeWreckState = {
  elapsedSeconds: 0,
  blasted: false,
  lastFireSeconds: -1,
  lastSmokeSeconds: -1,
};

/**
 * How long the gun's presentation should report as its death length.
 *
 * The maximum of the crew's fall and the carriage's collapse, because both have
 * to finish on screen and the shorter one waiting costs nothing. This single
 * number is what closes the code tip-over: `RtsPresentationHandle.deathSeconds`
 * being defined is exactly the condition `updateDeath` checks before rolling an
 * unanimated body onto its side.
 */
export function siegeWreckDeathSeconds(
  crewDeathSeconds: number | null,
  timing: SiegeWreckTiming = SIEGE_WRECK_TIMING,
): number {
  const crew = crewDeathSeconds !== null && Number.isFinite(crewDeathSeconds) && crewDeathSeconds > 0
    ? crewDeathSeconds
    : 0;
  return Math.max(crew, timing.collapseSeconds, timing.barrelFallSeconds, timing.wheelBreakSeconds + timing.wheelRollSeconds);
}

/** Ease-out, so a rolling wheel and a falling barrel both slow into their rest. */
function easeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

/**
 * Where each wheel goes.
 *
 * Derived from the wheel's index rather than drawn, for the reason every other
 * choice in this plan is: a gun that scatters its wheels differently on each
 * replay is a gun whose death cannot be reviewed. Four wheels fan into four
 * quadrants, offset so no two share a heading and none rolls straight along the
 * carriage's own axis — which would read as the wheel simply sliding forward.
 */
export function siegeWreckWheelHeading(index: number, wheelCount: number): number {
  const count = Math.max(1, Math.floor(wheelCount));
  const slot = ((Math.floor(index) % count) + count) % count;
  return (slot / count) * Math.PI * 2 + Math.PI / count;
}

/** Advance the wreck and collect whatever effects this step crossed. */
export function advanceSiegeWreck(
  state: SiegeWreckState,
  deltaSeconds: number,
  timing: SiegeWreckTiming = SIEGE_WRECK_TIMING,
): { readonly state: SiegeWreckState; readonly effects: readonly string[] } {
  const elapsed = state.elapsedSeconds + Math.max(0, deltaSeconds);
  const effects: string[] = [];
  let blasted = state.blasted;
  let lastFireSeconds = state.lastFireSeconds;
  let lastSmokeSeconds = state.lastSmokeSeconds;

  if (!blasted) {
    effects.push(SIEGE_WRECK_BLAST_NOTIFY);
    blasted = true;
  }
  // Requested repeatedly rather than as one long-lived emitter: the presentation
  // owns no effect instances and cannot stop one, so a fire it started would
  // outlive the wreck if the match ended mid-burn. Asking again each interval
  // means the burn stops simply by stopping asking.
  if (elapsed >= timing.fireStartSeconds && elapsed <= timing.burnSeconds) {
    if (lastFireSeconds < 0 || elapsed - lastFireSeconds >= timing.fireIntervalSeconds) {
      effects.push(SIEGE_WRECK_FIRE_NOTIFY);
      lastFireSeconds = elapsed;
    }
    if (lastSmokeSeconds < 0 || elapsed - lastSmokeSeconds >= timing.smokeIntervalSeconds) {
      effects.push(SIEGE_WRECK_SMOKE_NOTIFY);
      lastSmokeSeconds = elapsed;
    }
  }
  return { state: { elapsedSeconds: elapsed, blasted, lastFireSeconds, lastSmokeSeconds }, effects };
}

/** Where every moving part of the wreck stands at this instant. */
export function siegeWreckFrame(
  state: SiegeWreckState,
  wheelCount: number,
  timing: SiegeWreckTiming = SIEGE_WRECK_TIMING,
): SiegeWreckFrame {
  const t = state.elapsedSeconds;
  const count = Math.max(0, Math.floor(wheelCount));
  const collapse = timing.collapseSeconds > 0 ? Math.min(1, Math.max(0, t / timing.collapseSeconds)) : 1;
  const fall = timing.barrelFallSeconds > 0 ? easeOut(t / timing.barrelFallSeconds) : 1;
  const rolled = timing.wheelRollSeconds > 0
    ? easeOut((t - timing.wheelBreakSeconds) / timing.wheelRollSeconds)
    : t >= timing.wheelBreakSeconds ? 1 : 0;
  const travel = t <= timing.wheelBreakSeconds ? 0 : rolled * timing.wheelRollDistance;

  const wheels: SiegeWreckWheelFrame[] = [];
  for (let index = 0; index < count; index += 1) {
    wheels.push({
      // The same relationship `advanceRtsWheelSpins` uses — distance over radius —
      // is applied by the driver, which is the only place the authored radius is
      // known. Here the roll is reported as the distance travelled.
      rollRadians: travel,
      travel,
      headingRadians: siegeWreckWheelHeading(index, count),
      // A wheel that has stopped falls flat. It happens at the end of the roll,
      // not during it, so a wheel is never both rolling and lying down.
      tiltRadians: (rolled >= 1 ? 1 : 0) * (Math.PI / 2),
    });
  }
  return {
    collapseProgress: collapse,
    barrelDrop: fall * timing.barrelDropDistance,
    barrelPitch: fall * timing.barrelPitchRadians,
    wheels,
  };
}

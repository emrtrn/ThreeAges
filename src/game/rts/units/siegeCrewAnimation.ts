/**
 * Pure animation selector for the artillery crew — siege crew plan Faz 1.
 *
 * The crew is presentation: two men parented to the gun's Actor, with no health,
 * no selection and no orders of their own. What they play is derived entirely
 * from what the gun is already doing, so this module reads a snapshot and returns
 * a description. It writes nothing.
 *
 * It is deliberately *not* an extension of `rtsUnitAnimation.ts`. "Brace against
 * the carriage", "kick", "cheer" are this unit's vocabulary, not a general RTS
 * one, and putting them in the shared role list would carry dead roles onto every
 * asset in the project. What the two modules do share is the contract: no
 * Three.js, no DOM, deterministic variation, and every decision testable headless
 * (K-03).
 */

import type { RtsLocomotionTuning } from "./rtsUnitAnimation";

/**
 * The clips this crew plays, by the role each fills.
 *
 * Authored here rather than in the asset's `animationSet` because that vocabulary
 * is the engine's and is closed (`ANIMATION_SET_ROLES`); the locomotion half of
 * the crew *is* authored there and is read from the sidecar as usual. What is
 * left is the part only this unit has a concept of, and this is the one place in
 * the project that knows what "brace" means. Every name is checked against the
 * clips the model actually ships before it is played, so a renamed or missing
 * clip degrades to the pose underneath it rather than freezing a man in T-pose.
 */
export const SIEGE_CREW_CLIPS = {
  strafeLeft: "siege_strafe_left",
  strafeRight: "siege_strafe_right",
  pushExit: "siege_push_stop",
  crouchIn: "siege_crouch_start",
  braceIn: "siege_crouch_block_start",
  braced: "siege_crouch_block_idle",
  braceImpact: "siege_crouch_block_impact",
  braceOut: "siege_crouch_block_end",
  crouchOut: "siege_crouch_end",
  kick: "siege_kick",
  triumph: "siege_power_up",
} as const;

export type SiegeCrewClipRole = keyof typeof SIEGE_CREW_CLIPS;

/**
 * Montage name the crew asset uses for the *wind-up* of pushing the gun (K-10).
 *
 * Only the wind-up, because only the wind-up needs a window. `siege_push_start`
 * runs 4.77 s, of which roughly the first 1.5 s is the actual lean into the trail
 * and the rest is push cycles `siege_pushing` already repeats — a gun given a
 * move order would otherwise spend five seconds "starting" and could stop before
 * ever reaching its loop. Where that lean ends is asset knowledge, so it is an
 * authored section rather than a constant here, and reverting the trim is one
 * number in the sidecar. The other two parts need no window: the loop is the
 * whole of the ordinary `walk` role, and the wind-down is the whole of
 * {@link SIEGE_CREW_CLIPS.pushExit}.
 */
export const SIEGE_CREW_PUSH_MONTAGE_NAME = "push";
/** Section of that montage holding the lean-in. */
export const SIEGE_CREW_PUSH_ENTER_SECTION = "enter";

/**
 * Per-frame summary of what the *gun* is doing. Every field is a plain read of
 * simulation state the cannon already reports to its own presentation; the crew
 * adds nothing to it and decides nothing with it.
 */
export interface SiegeCrewInput {
  /** Observed ground speed of the gun in world units/s. */
  readonly planarSpeed: number;
  /** Signed yaw rate of the carriage, degrees/s, +left (Three.js Y is left-handed up). */
  readonly yawRateDegPerSecond: number;
  /**
   * The gun's authored `turnRateDegPerSecond`, which is what makes the strafe
   * gate proportional. It rides in the input rather than in
   * {@link RtsLocomotionTuning} because it is a fact about this gun, and adding
   * it to the shared tuning would put a turn rate on every unit in the project
   * that nothing else reads.
   */
  readonly turnRateDegPerSecond: number;
  /** True while the gun travels without turning its body toward the route (`T`). */
  readonly backward: boolean;
  /** True while a live target is inside weapon range — the gun means to fire. */
  readonly attacking: boolean;
  /** True once the gun's defeat has begun. */
  readonly dying: boolean;
  /** Blows the gun has *taken*; each increment shakes a bracing crew. */
  readonly impactCount: number;
  /** Kicks the gun has thrown; each increment plays one kick (Faz 3). */
  readonly kickCount: number;
  /** Enemy structures this gun has brought down; each increment cheers once (Faz 5). */
  readonly triumphCount: number;
}

/**
 * The continuous pose the crew holds, underneath any one-shot.
 *
 * `push*` are the montage's three sections rather than one role because the
 * wind-up is a different part of the same clip, and the phase machine is what
 * decides when the wind-up has been paid for.
 */
export type SiegeCrewLocomotion =
  | "idle"
  | "pushEnter"
  | "pushLoop"
  | "pushExit"
  | "backward"
  | "strafeLeft"
  | "strafeRight";

/** Where the firing stance is, from standing to braced and back (Faz 2). */
export type SiegeCrewBracePhase =
  | "standing"
  | "crouchIn"
  | "braceIn"
  | "braced"
  | "braceOut"
  | "crouchOut";

/**
 * The one-shots that ride above everything else.
 *
 * `braceImpact` is here rather than in the brace machine because it does not
 * change where the stance *is*: the men stay braced, one of them takes the shock,
 * and the stance is exactly where it was when the clip ends.
 */
export type SiegeCrewOneShot = "none" | "death" | "triumph" | "kick" | "braceImpact";

/**
 * How long each of this asset's clips runs, in seconds, read off the model.
 *
 * Null for a clip the asset does not ship, which is what lets a half-authored
 * crew keep working: a phase with no clip takes no time and is stepped straight
 * through, and a one-shot with no clip never starts.
 */
export type SiegeCrewDurations = Readonly<Partial<Record<SiegeCrewClipRole | "death", number | null>>>;

/** The crew's whole animation state. One per crew member. */
export interface SiegeCrewState {
  readonly locomotion: SiegeCrewLocomotion;
  /** Seconds left of a timed locomotion section (`pushEnter`/`pushExit`). */
  readonly locomotionRemainingSeconds: number;
  readonly brace: SiegeCrewBracePhase;
  /** Seconds left of a timed brace phase; 0 while `standing` or held `braced`. */
  readonly braceRemainingSeconds: number;
  readonly oneShot: SiegeCrewOneShot;
  readonly oneShotRemainingSeconds: number;
  /** Counters this state was last reconciled against; only their changes are read. */
  readonly impactCount: number;
  readonly kickCount: number;
  readonly triumphCount: number;
}

/** A crew member that has done nothing yet. */
export const SIEGE_CREW_NONE: SiegeCrewState = {
  locomotion: "idle",
  locomotionRemainingSeconds: 0,
  brace: "standing",
  braceRemainingSeconds: 0,
  oneShot: "none",
  oneShotRemainingSeconds: 0,
  impactCount: 0,
  kickCount: 0,
  triumphCount: 0,
};

/**
 * Fraction of the gun's own turn rate above which a standing crew reads the
 * carriage as being swung round rather than merely settling onto a heading.
 *
 * A quarter, so the tail of every ordinary `faceHeading` turn — which decays
 * toward zero as the gun lines up — does not leave two men side-stepping in place
 * for a second after the gun has stopped moving.
 */
const STRAFE_YAW_FRACTION = 0.25;

/**
 * How long the push's wind-up and wind-down run, in seconds.
 *
 * The wind-up comes from the authored montage section, the wind-down from the
 * length of its own clip. Zero means "instant": an asset that authors neither
 * simply starts and stops on the loop, which is what every crewed unit did
 * before montages existed.
 */
export interface SiegeCrewPushSections {
  readonly enterSeconds: number;
  readonly exitSeconds: number;
}

/** A crew asset with no authored push montage pushes with no wind-up or wind-down. */
export const SIEGE_CREW_PUSH_INSTANT: SiegeCrewPushSections = { enterSeconds: 0, exitSeconds: 0 };

/**
 * Classifies the continuous channel.
 *
 * Priority, highest first: `backward` > `push*` > `strafe*` > `idle`. Reverse
 * outranks push because a retreating gun is being *pulled* and the men walk
 * backwards with it; push outranks strafe because a gun that is turning while it
 * rolls is still, to the crew, a gun being pushed — side-stepping mid-roll is the
 * one combination that reads as a bug rather than as a manoeuvre.
 */
function advanceLocomotion(
  state: SiegeCrewState,
  input: SiegeCrewInput,
  tuning: RtsLocomotionTuning,
  push: SiegeCrewPushSections,
  deltaSeconds: number,
): { readonly locomotion: SiegeCrewLocomotion; readonly locomotionRemainingSeconds: number } {
  const dt = Math.max(0, deltaSeconds);
  const moving = input.planarSpeed > tuning.walkSpeed;

  if (moving && input.backward) return { locomotion: "backward", locomotionRemainingSeconds: 0 };

  if (moving) {
    if (state.locomotion === "pushLoop") return { locomotion: "pushLoop", locomotionRemainingSeconds: 0 };
    if (state.locomotion === "pushEnter") {
      const remaining = state.locomotionRemainingSeconds - dt;
      return remaining > 0
        ? { locomotion: "pushEnter", locomotionRemainingSeconds: remaining }
        : { locomotion: "pushLoop", locomotionRemainingSeconds: 0 };
    }
    return push.enterSeconds > 0
      ? { locomotion: "pushEnter", locomotionRemainingSeconds: push.enterSeconds }
      : { locomotion: "pushLoop", locomotionRemainingSeconds: 0 };
  }

  // Standing still. The gun may still be swinging round onto a target, which is
  // the only thing the crew can be doing with its feet that is not a walk.
  if (state.locomotion === "pushExit") {
    const remaining = state.locomotionRemainingSeconds - dt;
    if (remaining > 0) return { locomotion: "pushExit", locomotionRemainingSeconds: remaining };
    return { locomotion: "idle", locomotionRemainingSeconds: 0 };
  }
  if (state.locomotion === "pushEnter" || state.locomotion === "pushLoop") {
    return push.exitSeconds > 0
      ? { locomotion: "pushExit", locomotionRemainingSeconds: push.exitSeconds }
      : { locomotion: "idle", locomotionRemainingSeconds: 0 };
  }

  const turnGate = input.turnRateDegPerSecond * STRAFE_YAW_FRACTION;
  if (turnGate > 0 && Math.abs(input.yawRateDegPerSecond) > turnGate) {
    // K-06, and it is inverted on purpose: the crew shoves the trail *left* to
    // swing the muzzle *right*. It reads backwards from the code and correctly on
    // screen; if the model disagrees, swapping these two lines is the whole fix.
    return {
      locomotion: input.yawRateDegPerSecond < 0 ? "strafeLeft" : "strafeRight",
      locomotionRemainingSeconds: 0,
    };
  }
  return { locomotion: "idle", locomotionRemainingSeconds: 0 };
}

/**
 * Advances the firing stance (Faz 2).
 *
 * The trigger is `attacking` — "a live target is in range and the gun means to
 * fire it" — never the cooldown. A 5.5 s reload with the stance keyed off the
 * shot itself would have two men stand up and kneel back down between every
 * round; keyed off the engagement they crouch once and stay there for the fight.
 *
 * Moving cancels the stance the same way it cancels the work montage: an ordered
 * gun is leaving, and the crew stands up on the way rather than politely finishing.
 */
function advanceBrace(
  state: SiegeCrewState,
  input: SiegeCrewInput,
  tuning: RtsLocomotionTuning,
  durations: SiegeCrewDurations,
  deltaSeconds: number,
): { readonly brace: SiegeCrewBracePhase; readonly braceRemainingSeconds: number } {
  const dt = Math.max(0, deltaSeconds);
  const seconds = (role: SiegeCrewClipRole): number => Math.max(0, durations[role] ?? 0);
  const step = (
    phase: SiegeCrewBracePhase,
    role: SiegeCrewClipRole,
    next: SiegeCrewBracePhase,
    nextRole: SiegeCrewClipRole | null,
  ): { brace: SiegeCrewBracePhase; braceRemainingSeconds: number } => {
    if (state.brace === phase) {
      const remaining = state.braceRemainingSeconds - dt;
      if (remaining > 0) return { brace: phase, braceRemainingSeconds: remaining };
      return { brace: next, braceRemainingSeconds: nextRole ? seconds(nextRole) : 0 };
    }
    const length = seconds(role);
    return length > 0
      ? { brace: phase, braceRemainingSeconds: length }
      : { brace: next, braceRemainingSeconds: nextRole ? seconds(nextRole) : 0 };
  };

  // Death does not wind the stance down; it stops it where it is. The fall owns
  // the body from that frame on, and a man who politely stood up first would be
  // finishing a posture the gun that held him up no longer has.
  if (input.dying) return { brace: "standing", braceRemainingSeconds: 0 };
  const wants = input.attacking && input.planarSpeed <= tuning.walkSpeed;

  if (wants) {
    switch (state.brace) {
      case "braced":
        return { brace: "braced", braceRemainingSeconds: 0 };
      case "crouchIn":
        return step("crouchIn", "crouchIn", "braceIn", "braceIn");
      case "braceIn":
        return step("braceIn", "braceIn", "braced", null);
      // Re-engaging mid-stand goes back down the way it came rather than jumping
      // to `braced`: the body is halfway to its feet, and the wind-up clips are
      // exactly the motion that gets it back down.
      case "braceOut":
      case "crouchOut":
      case "standing":
      default:
        return step("crouchIn", "crouchIn", "braceIn", "braceIn");
    }
  }

  switch (state.brace) {
    case "braceOut":
      return step("braceOut", "braceOut", "crouchOut", "crouchOut");
    case "crouchOut":
      return step("crouchOut", "crouchOut", "standing", null);
    case "standing":
      return { brace: "standing", braceRemainingSeconds: 0 };
    // Leaving from anywhere in the down half exits through the authored order,
    // so the men release the carriage before they stand rather than after.
    default:
      return step("braceOut", "braceOut", "crouchOut", "crouchOut");
  }
}

/**
 * Advances the one-shot channel.
 *
 * Priority, highest first: death latches forever > triumph > kick > brace impact.
 * Triumph outranks a kick and an impact because it is the rarest of the three and
 * the only one the player is being shown deliberately; death outranks all of them
 * for the reason every death does — a crew only falls once, and it must still be
 * lying there when the corpse window ends.
 *
 * A counter that moves while another one-shot owns the body is *dropped*, not
 * queued: three shells in half a second are one shake from the last of them.
 */
function advanceOneShot(
  state: SiegeCrewState,
  input: SiegeCrewInput,
  durations: SiegeCrewDurations,
  deltaSeconds: number,
): { readonly oneShot: SiegeCrewOneShot; readonly oneShotRemainingSeconds: number } {
  const dt = Math.max(0, deltaSeconds);
  const length = (role: SiegeCrewClipRole | "death"): number | null => {
    const value = durations[role];
    return value === null || value === undefined || value <= 0 ? null : value;
  };

  if (input.dying) {
    if (state.oneShot === "death") {
      return { oneShot: "death", oneShotRemainingSeconds: Math.max(0, state.oneShotRemainingSeconds - dt) };
    }
    const death = length("death");
    // No authored fall: the crew simply stops, and the gun's own wreck timeline
    // is what the player watches.
    return death === null
      ? { oneShot: "none", oneShotRemainingSeconds: 0 }
      : { oneShot: "death", oneShotRemainingSeconds: death };
  }

  const triumph = length("triumph");
  if (input.triumphCount !== state.triumphCount && triumph !== null) {
    return { oneShot: "triumph", oneShotRemainingSeconds: triumph };
  }
  const kick = length("kick");
  if (input.kickCount !== state.kickCount && kick !== null) {
    return { oneShot: "kick", oneShotRemainingSeconds: kick };
  }
  const impact = length("braceImpact");
  // The shake belongs to the bracing pose it was animated inside. A standing crew
  // taking a hit has no clip for it, and borrowing the braced one would snap two
  // upright men into a crouch for 0.7 s every time a shell lands nearby.
  if (input.impactCount !== state.impactCount && impact !== null && state.brace === "braced") {
    return { oneShot: "braceImpact", oneShotRemainingSeconds: impact };
  }
  if (state.oneShot !== "none") {
    const remaining = state.oneShotRemainingSeconds - dt;
    if (remaining > 0) return { oneShot: state.oneShot, oneShotRemainingSeconds: remaining };
  }
  return { oneShot: "none", oneShotRemainingSeconds: 0 };
}

/**
 * Advances one crew member's whole state by a frame.
 *
 * The three channels run independently and are ranked only when the driver asks
 * what to play ({@link siegeCrewClipRole}). Keeping them separate is what lets a
 * braced crew take a shell and return to bracing without the stance having to
 * remember it was interrupted.
 */
export function advanceSiegeCrew(
  state: SiegeCrewState,
  input: SiegeCrewInput,
  tuning: RtsLocomotionTuning,
  durations: SiegeCrewDurations,
  push: SiegeCrewPushSections,
  deltaSeconds: number,
): SiegeCrewState {
  const oneShot = advanceOneShot(state, input, durations, deltaSeconds);
  const brace = advanceBrace(state, input, tuning, durations, deltaSeconds);
  const locomotion = advanceLocomotion(state, input, tuning, push, deltaSeconds);
  return {
    ...locomotion,
    ...brace,
    ...oneShot,
    impactCount: input.impactCount,
    kickCount: input.kickCount,
    triumphCount: input.triumphCount,
  };
}

/**
 * What the crew member should be playing, ranked across the three channels:
 * `oneShot` > `brace` > `locomotion` (the plan's `dying > bracing > oneShot >
 * backward > push > strafe > idle`, with death and the other one-shots split out
 * of the middle because they interrupt the stance rather than replace it).
 *
 * Two shapes come back. A `clipRole` is one of this unit's own clips and the
 * driver looks it up in {@link SIEGE_CREW_CLIPS}; a `locomotionRole` is an
 * ordinary sidecar role (`idle`/`walk`/`walkBack`/`death`) that the shared
 * selector already knows how to resolve, variants and all.
 */
export type SiegeCrewSelection =
  | { readonly kind: "clip"; readonly clipRole: SiegeCrewClipRole; readonly loop: boolean }
  | { readonly kind: "death" }
  | { readonly kind: "pushEnter" }
  | { readonly kind: "locomotion"; readonly locomotionRole: "idle" | "walk" | "walkBack" };

export function siegeCrewSelection(state: SiegeCrewState): SiegeCrewSelection {
  switch (state.oneShot) {
    case "death":
      return { kind: "death" };
    case "triumph":
      return { kind: "clip", clipRole: "triumph", loop: false };
    case "kick":
      return { kind: "clip", clipRole: "kick", loop: false };
    case "braceImpact":
      return { kind: "clip", clipRole: "braceImpact", loop: false };
    default:
      break;
  }
  switch (state.brace) {
    case "crouchIn":
      return { kind: "clip", clipRole: "crouchIn", loop: false };
    case "braceIn":
      return { kind: "clip", clipRole: "braceIn", loop: false };
    case "braced":
      return { kind: "clip", clipRole: "braced", loop: true };
    case "braceOut":
      return { kind: "clip", clipRole: "braceOut", loop: false };
    case "crouchOut":
      return { kind: "clip", clipRole: "crouchOut", loop: false };
    default:
      break;
  }
  switch (state.locomotion) {
    case "pushEnter":
      return { kind: "pushEnter" };
    case "pushLoop":
      return { kind: "locomotion", locomotionRole: "walk" };
    case "pushExit":
      return { kind: "clip", clipRole: "pushExit", loop: false };
    case "backward":
      return { kind: "locomotion", locomotionRole: "walkBack" };
    case "strafeLeft":
      return { kind: "clip", clipRole: "strafeLeft", loop: true };
    case "strafeRight":
      return { kind: "clip", clipRole: "strafeRight", loop: true };
    default:
      return { kind: "locomotion", locomotionRole: "idle" };
  }
}

/**
 * How far behind slot 0 this crew member runs, in seconds (K-05).
 *
 * Two men hitting every pose on the same frame read as one man drawn twice. The
 * offset is derived from the slot index rather than drawn at random so a replayed
 * or reloaded match stages the crew identically, and it is small enough — a tenth
 * of a second — to look like two people rather than like a delay.
 */
export const SIEGE_CREW_SLOT_PHASE_SECONDS = 0.12;

export function siegeCrewSlotPhaseSeconds(slotIndex: number): number {
  const index = Number.isFinite(slotIndex) ? Math.max(0, Math.floor(slotIndex)) : 0;
  return index * SIEGE_CREW_SLOT_PHASE_SECONDS;
}

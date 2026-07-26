/**
 * Pure animation selector for RTS units — skeletal animation plan Faz C.
 *
 * No Three.js and no DOM: it maps the small per-frame snapshot a unit reports
 * ({@link RtsAnimationInput}) onto a semantic role, resolves that role to a clip
 * the asset actually ships, and works out how fast to play it. That keeps the
 * only part of the animation path with real decisions in it headless-testable,
 * while the Three-touching half stays a thin driver
 * (`src/game/rts/content/rtsUnitPresentation.ts`).
 *
 * It is deliberately narrower than `src/game/locomotionAnimation.ts`, which is
 * TPS-shaped (grounded, vertical velocity, jump/fall). An RTS unit is always on
 * the ground; what it can be doing is walking, fighting or dying.
 *
 * The selector reads simulation state and returns a description. It writes
 * nothing — no unit position, stat or cooldown is reachable from here.
 */

/** What the unit is doing, independent of which clips its asset carries. */
export type RtsAnimationRole = "idle" | "walk" | "run" | "attack" | "death";

/** Per-frame simulation summary, mirroring `RtsPresentationUpdate`'s gameplay half. */
export interface RtsAnimationInput {
  /** Observed ground speed in world units/s, measured from real displacement. */
  readonly planarSpeed: number;
  /** True while a live target is inside weapon range. */
  readonly attacking: boolean;
  /** True once the defeat pose has begun. */
  readonly dying: boolean;
  /**
   * How many blows this unit has landed so far. Only its *changes* are read —
   * one swing animation per increment — so the presentation stays event-driven
   * off the same cooldown the damage came from, without the animation getting a
   * vote in when that damage lands.
   */
  readonly attackCount: number;
}

/**
 * A role→clip map. Typed loosely on purpose: today it is fed the sidecar's
 * `animationSet`, which only knows the TPS roles (`idle`/`walk`/`run`/…), and
 * Faz E adds `attack`/`death` to that schema without this module changing.
 */
export type RtsAnimationSet = Readonly<Record<string, string | undefined>>;

/**
 * Speed boundaries and clip calibration for one unit, in world units/s.
 *
 * Both halves are per-unit rather than global because an RTS field mixes a
 * Worker at 4 units/s with a Guard at 6: a fixed "running above 3" boundary
 * would have one of them permanently in the wrong clip.
 */
export interface RtsLocomotionTuning {
  /** Above this speed the unit is at least walking; below it, standing. */
  readonly walkSpeed: number;
  /** At or above this speed the unit is running. */
  readonly runSpeed: number;
  /** Ground speed the walk clip looks natural at (playback rate 1). */
  readonly walkClipSpeed: number;
  /** Ground speed the run clip looks natural at (playback rate 1). */
  readonly runClipSpeed: number;
  /** Playback-rate clamp, so a crawling or shoved unit neither freezes nor sprints. */
  readonly minPlaybackRate: number;
  readonly maxPlaybackRate: number;
}

/**
 * How a unit's authored `moveSpeed` becomes thresholds and clip calibration.
 *
 * The calibration assumption — and it is an assumption, since no clip declares
 * the speed it was authored for — is that the run clip reads correctly at the
 * unit's full move speed (the speed it spends nearly all of its travelling life
 * at, since RTS movement accelerates instantly) and the walk clip at half that.
 * Everything in between is covered by scaling playback, so foot contact stays
 * consistent when a crowd or a corner slows the unit down.
 */
export const RTS_LOCOMOTION_CALIBRATION = {
  /** Fraction of move speed above which the unit reads as moving at all. */
  walkThreshold: 0.1,
  /** Absolute floor for that boundary: separation jitter must not start a walk. */
  minWalkThreshold: 0.15,
  /** Fraction of move speed at which walking becomes running. */
  runThreshold: 0.55,
  /** Fraction of move speed the walk clip is calibrated to. */
  walkClipSpeed: 0.5,
  minPlaybackRate: 0.4,
  maxPlaybackRate: 1.8,
} as const;

/** Builds the per-unit tuning from its authored `moveSpeed` (`balance/units.json`). */
export function rtsLocomotionTuning(moveSpeed: number): RtsLocomotionTuning {
  const speed = Number.isFinite(moveSpeed) && moveSpeed > 0 ? moveSpeed : 1;
  const c = RTS_LOCOMOTION_CALIBRATION;
  return {
    walkSpeed: Math.max(c.minWalkThreshold, speed * c.walkThreshold),
    runSpeed: speed * c.runThreshold,
    walkClipSpeed: speed * c.walkClipSpeed,
    runClipSpeed: speed,
    minPlaybackRate: c.minPlaybackRate,
    maxPlaybackRate: c.maxPlaybackRate,
  };
}

/**
 * Classifies the snapshot into a role. Death outranks everything — a unit that
 * dies mid-swing falls rather than finishing the blow — and a unit in weapon
 * range is fighting even if crowd shoving still gives it some residual speed.
 */
export function classifyRtsAnimation(
  input: RtsAnimationInput,
  tuning: RtsLocomotionTuning,
): RtsAnimationRole {
  if (input.dying) return "death";
  if (input.attacking) return "attack";
  if (input.planarSpeed >= tuning.runSpeed) return "run";
  if (input.planarSpeed > tuning.walkSpeed) return "walk";
  return "idle";
}

/**
 * Per-role preference order. A missing clip escalates to the nearest role that
 * still reads as the same intent (a missing walk uses the run clip slowed down,
 * not a T-pose), and every chain ends at idle — the one clip an animated asset
 * can be relied on to have.
 */
const ROLE_FALLBACKS: Record<RtsAnimationRole, readonly RtsAnimationRole[]> = {
  idle: ["idle"],
  walk: ["walk", "run", "idle"],
  run: ["run", "walk", "idle"],
  // `attack` and `death` deliberately do *not* reach their own clips here. This
  // chain feeds the continuous, looping channel, and those two clips are
  // one-shots played per event by {@link advanceRtsAction} — looping a sword
  // swing between blows would show a unit attacking on a cadence its cooldown
  // never had. What the continuous channel wants for an engaged or fallen unit
  // is the standing pose underneath the action.
  attack: ["idle"],
  death: ["idle"],
};

/**
 * Walks the role's fallback chain and returns the first role whose authored clip
 * the asset actually carries, or null when none does.
 *
 * Null means "hold the current pose", not "stop": the caller keeps playing
 * whatever it was playing. Picking an arbitrary available clip instead would be
 * worse than useless — it is exactly how a unit ends up permanently frozen in
 * `A_TPose`, which is a real clip in the shipped UAL1 set.
 */
export function resolveRtsAnimationRole(
  role: RtsAnimationRole,
  animationSet: RtsAnimationSet,
  available: ReadonlySet<string>,
): { readonly role: RtsAnimationRole; readonly clip: string } | null {
  for (const candidate of ROLE_FALLBACKS[role]) {
    const clip = animationSet[candidate];
    if (clip && available.has(clip)) return { role: candidate, clip };
  }
  return null;
}

/**
 * Playback rate for the clip that will actually play. Only locomotion is scaled;
 * an attack or death plays at its authored speed, because those clips are timed
 * against gameplay (cooldown, despawn) rather than against ground contact.
 *
 * The rate is keyed off the *resolved* role, not the requested one: a unit that
 * walks on the run clip has to be slowed to the run clip's calibration or the
 * fallback would slide worse than having no clip at all.
 */
export function rtsPlaybackRate(
  role: RtsAnimationRole,
  planarSpeed: number,
  tuning: RtsLocomotionTuning,
): number {
  const reference = role === "run" ? tuning.runClipSpeed : role === "walk" ? tuning.walkClipSpeed : 0;
  if (reference <= 0) return 1;
  const rate = planarSpeed / reference;
  return Math.min(tuning.maxPlaybackRate, Math.max(tuning.minPlaybackRate, rate));
}

/** What the driver should play this frame. */
export interface RtsAnimationSelection {
  /** The role the simulation state asked for. */
  readonly requested: RtsAnimationRole;
  /** The role whose clip is actually playing, after the fallback chain. */
  readonly role: RtsAnimationRole;
  readonly clip: string;
  readonly playbackRate: number;
}

/**
 * Classify, resolve and calibrate in one call. Returns null when the asset has
 * no clip for the state or anything it falls back to; the caller then holds the
 * pose it already had.
 */
export function selectRtsAnimation(
  input: RtsAnimationInput,
  animationSet: RtsAnimationSet,
  available: ReadonlySet<string>,
  tuning: RtsLocomotionTuning,
): RtsAnimationSelection | null {
  const requested = classifyRtsAnimation(input, tuning);
  const resolved = resolveRtsAnimationRole(requested, animationSet, available);
  if (!resolved) return null;
  return {
    requested,
    role: resolved.role,
    clip: resolved.clip,
    playbackRate: rtsPlaybackRate(resolved.role, input.planarSpeed, tuning),
  };
}

/* ------------------------------------------------------------------------- *
 * One-shot actions — Faz D
 *
 * Attack and death are events, not states: each is played through exactly once
 * and then gets out of the way. They ride above the continuous locomotion
 * channel, so a unit that finishes a swing returns to whatever it was doing
 * without the selector having to remember that it swung.
 * ------------------------------------------------------------------------- */

/** The one-shot currently overriding locomotion, if any. */
export interface RtsActionState {
  readonly kind: "none" | "attack" | "death";
  /** Seconds left of the running clip. Reaches 0 on the frame it finishes. */
  readonly remainingSeconds: number;
  /** The blow count this state was last reconciled against; see {@link advanceRtsAction}. */
  readonly attackCount: number;
}

/** A unit that has neither swung nor fallen. */
export const RTS_ACTION_NONE: RtsActionState = { kind: "none", remainingSeconds: 0, attackCount: 0 };

/**
 * Authored lengths of the one-shot clips, in seconds. Null means the asset
 * ships no clip for that role, and the action never starts — which is how the
 * capsule fallback and any half-authored asset keep working.
 */
export interface RtsActionDurations {
  readonly attack: number | null;
  readonly death: number | null;
}

/**
 * Advances the one-shot channel by one frame.
 *
 * Three rules, in order:
 *  1. **Death latches.** Once it starts it is never interrupted, never
 *     restarted, and never returns to locomotion — a unit only dies once, and
 *     it must still be lying there when the death system despawns it.
 *  2. **A new blow restarts the swing.** Any change in `attackCount` begins the
 *     attack clip from the top, even if the previous swing is still running.
 *  3. **Otherwise the running action runs down**, and locomotion resumes on the
 *     frame it expires.
 *
 * The returned state always carries the input's `attackCount`, so blows landed
 * while an action was uninterruptible do not queue up and fire late.
 */
export function advanceRtsAction(
  state: RtsActionState,
  input: RtsAnimationInput,
  durations: RtsActionDurations,
  deltaSeconds: number,
): RtsActionState {
  const dt = Math.max(0, deltaSeconds);
  if (input.dying) {
    if (state.kind === "death") {
      return { ...state, remainingSeconds: Math.max(0, state.remainingSeconds - dt) };
    }
    if (durations.death === null) {
      // No authored death clip: the unit's own collapse pose owns its defeat.
      return { kind: "none", remainingSeconds: 0, attackCount: input.attackCount };
    }
    return { kind: "death", remainingSeconds: durations.death, attackCount: input.attackCount };
  }
  if (input.attackCount !== state.attackCount && durations.attack !== null) {
    return { kind: "attack", remainingSeconds: durations.attack, attackCount: input.attackCount };
  }
  if (state.kind === "attack") {
    const remaining = state.remainingSeconds - dt;
    if (remaining > 0) return { kind: "attack", remainingSeconds: remaining, attackCount: input.attackCount };
  }
  return { kind: "none", remainingSeconds: 0, attackCount: input.attackCount };
}

/**
 * The clip a running one-shot should be playing, or null when the continuous
 * locomotion channel owns the pose this frame.
 */
export function rtsActionClip(
  state: RtsActionState,
  animationSet: RtsAnimationSet,
  available: ReadonlySet<string>,
): string | null {
  if (state.kind === "none") return null;
  const clip = animationSet[state.kind];
  return clip && available.has(clip) ? clip : null;
}

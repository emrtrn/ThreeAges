/**
 * Two-channel clip animator: the legs keep their locomotion while a one-shot
 * owns the torso.
 *
 * The same body-mask idea as {@link LayeredCharacterAnimator} — Unreal's
 * "Layered Blend Per Bone" + Slot, as data — but with the opposite ownership
 * model. There, the animator holds the montage's own timer and an aim pose,
 * because a TPS character's shell asks it to *play a montage* and forgets about
 * it. Here the caller already runs a pure state machine that knows exactly which
 * one-shot is playing and how much of it is left, so this class holds no timing
 * at all: it is told what each channel should be showing, and when the torso is
 * handed back.
 *
 * That is also why it ticks its own mixers ({@link update}, matching
 * {@link CrossfadeAnimator.update}) rather than exposing them to an
 * `AnimationSubsystem`: the RTS frame loop owns the tick, and throttles it by
 * distance.
 *
 * Three-touching, so it lives in `engine/render-three`. It holds no game rules —
 * "a walking unit flinches from the waist up" is a decision the caller makes.
 */
import { type AnimationClip, type Object3D } from "three";
import { CrossfadeAnimator, type AnimatorClipRange } from "./characterAnimator";
import { collectSubtreeNodeNames, splitClipsByUpperBody } from "./bodyMask";
import { applyRootMotionToClips, type RootMotionClipSetting } from "./rootMotion";

/**
 * The playback surface a unit presentation drives, satisfied by both the plain
 * {@link CrossfadeAnimator} and the layered one.
 *
 * It exists so the driver is written once. An asset that authors no upper-body
 * bone must keep exactly its previous single-mixer cost and behaviour, and the
 * way to guarantee that is for the layered class to be *absent* from its path
 * rather than present and disabled.
 */
export interface UnitClipAnimator {
  readonly clips: ReadonlySet<string>;
  play(name: string, fadeSeconds?: number): void;
  playOnce(name: string, fadeSeconds?: number): void;
  playRange(name: string, range: AnimatorClipRange, fadeSeconds?: number): void;
  setPlaybackRate(rate: number): void;
  clipDuration(name: string): number | null;
  update(deltaSeconds: number): void;
  release(root: Object3D): void;
}

export class LayeredClipAnimator implements UnitClipAnimator {
  /** All clip names either channel can play, under their original names. */
  readonly clips: ReadonlySet<string>;
  private readonly lower: CrossfadeAnimator;
  private readonly upper: CrossfadeAnimator;
  private readonly durations = new Map<string, number>();
  private readonly matched: boolean;
  /** The locomotion clip the torso mirrors whenever no one-shot owns it. */
  private passthrough: string | null = null;
  /** True while a one-shot owns the torso and locomotion must not touch it. */
  private upperOwned = false;

  constructor(
    root: Object3D,
    clips: readonly AnimationClip[],
    upperBodyBone: string,
    options: { readonly rootMotion?: readonly RootMotionClipSetting[] } = {},
  ) {
    // Root motion is locked before the split, never after. A masked half no
    // longer carries the hip position track the lock is aimed at, and
    // `resolveRootMotionNode` falls back to the first position track it *does*
    // find — so locking the upper half would pin some arbitrary arm bone in
    // place instead of the root.
    const playable = applyRootMotionToClips(clips, options.rootMotion, root);
    const upperNames = collectSubtreeNodeNames(root, upperBodyBone);
    this.matched = upperNames.size > 0;
    const split = splitClipsByUpperBody(playable, upperNames);
    this.lower = new CrossfadeAnimator(root, split.lower);
    this.upper = new CrossfadeAnimator(root, split.upper);
    this.clips = new Set(clips.map((clip) => clip.name));
    for (const clip of clips) this.durations.set(clip.name, clip.duration);
  }

  /**
   * True when the authored bone matched real nodes. False means the mask is
   * empty — every track landed on the lower channel — so layering would be a
   * silent no-op and the caller should treat the asset as full-body.
   */
  get hasUpperBody(): boolean {
    return this.matched;
  }

  /** Current lower-channel (legs) clip, for tests and debug readouts. */
  get lowerClip(): string | null {
    return this.lower.currentClip;
  }

  /** Current upper-channel (torso/arms/head) clip, for tests and debug readouts. */
  get upperClip(): string | null {
    return this.upper.currentClip;
  }

  /** True while a one-shot owns the torso alone. */
  get isUpperBusy(): boolean {
    return this.upperOwned;
  }

  /**
   * Continuous locomotion. Drives the legs always, and the torso only while no
   * one-shot owns it — which is what lets a struck unit keep walking underneath
   * its flinch, and what makes the flinch end into the *current* gait rather
   * than into whichever one was playing when the blow landed.
   */
  play(name: string, fadeSeconds = 0.2): void {
    this.lower.play(name, fadeSeconds);
    this.passthrough = name;
    if (!this.upperOwned) this.upper.play(name, fadeSeconds);
  }

  /** A one-shot across the whole body — a swing, a fall. Reclaims the torso. */
  playOnce(name: string, fadeSeconds = 0.08): void {
    this.upperOwned = false;
    this.lower.playOnce(name, fadeSeconds);
    this.upper.playOnce(name, fadeSeconds);
  }

  /** A montage section across the whole body — the work animation. Reclaims the torso. */
  playRange(name: string, range: AnimatorClipRange, fadeSeconds = 0.15): void {
    this.upperOwned = false;
    this.lower.playRange(name, range, fadeSeconds);
    this.upper.playRange(name, range, fadeSeconds);
  }

  /**
   * A one-shot on the torso alone, leaving the legs on whatever they are doing.
   * Always restarts, like {@link CrossfadeAnimator.playOnce}: re-triggering is
   * the normal case, and the caller decides when a blow is a *new* one.
   */
  playUpperOnce(name: string, fadeSeconds = 0.08): void {
    if (!this.clips.has(name)) return;
    this.upperOwned = true;
    this.upper.playOnce(name, fadeSeconds);
  }

  /**
   * Hands the torso back to locomotion. A no-op unless a
   * {@link playUpperOnce} owns it, so the full-body paths are never disturbed.
   */
  releaseUpperBody(fadeSeconds = 0.18): void {
    if (!this.upperOwned) return;
    this.upperOwned = false;
    if (this.passthrough) this.upper.play(this.passthrough, fadeSeconds);
  }

  /**
   * Scales locomotion playback. The torso follows only while it is mirroring the
   * legs: a flinch is timed against the blow that caused it, not against how
   * fast the unit happens to be walking, and speeding it up with the gait would
   * make a shoved unit's reaction stutter.
   */
  setPlaybackRate(rate: number): void {
    this.lower.setPlaybackRate(rate);
    if (!this.upperOwned) this.upper.setPlaybackRate(rate);
  }

  /** Authored length of a clip, taken from the unsplit original. */
  clipDuration(name: string): number | null {
    return this.durations.get(name) ?? null;
  }

  /** Advances both channels, each keeping its own range window. */
  update(deltaSeconds: number): void {
    this.lower.update(deltaSeconds);
    this.upper.update(deltaSeconds);
  }

  /** Stops both channels and releases their binding caches for `root`. */
  release(root: Object3D): void {
    this.lower.release(root);
    this.upper.release(root);
  }
}

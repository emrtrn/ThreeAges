/**
 * Animated RTS unit presentation — skeletal animation plan Faz B/C.
 *
 * Wraps one {@link CrossfadeAnimator} around a cloned Actor presentation tree
 * and drives it from the small per-frame snapshot the unit reports, choosing the
 * clip through the pure selector in `../units/rtsUnitAnimation`. It is a
 * presentation object in the strict sense: it reads simulation state and never
 * writes any, so a unit animates identically whether or not this handle exists.
 *
 * The mixer is advanced from the RTS frame loop rather than registered with the
 * engine's `AnimationSubsystem`, because `RtsApp` runs its own rAF loop and has
 * no subsystem registry to register with. Throttling distant units is Faz F's
 * job and can either introduce that registry or throttle here.
 */
import type { AnimationClip, Object3D } from "three";

import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import type { AssetSkeletonDef } from "@/scene/assetSkeletonLoader";
import {
  rtsLocomotionTuning,
  selectRtsAnimation,
  type RtsAnimationSet,
  type RtsLocomotionTuning,
} from "../units/rtsUnitAnimation";
import type { RtsPresentationHandle, RtsPresentationUpdate } from "../units/unit";

/** Everything an animated instance needs from the asset it was cloned from. */
export interface RtsUnitAnimationSource {
  /**
   * Node the mixer binds to: the cloned model, not the presentation root.
   * Tracks resolve nodes by name, and authored component ids share that
   * namespace with bone names — binding above the model lets a component called
   * "root" capture the `root` bone's track and lay the whole unit on its back.
   */
  readonly target: Object3D;
  readonly clips: readonly AnimationClip[];
  /** Sidecar authoring: which clip fills each semantic role, and root-motion locks. */
  readonly skeleton: AssetSkeletonDef;
}

export interface RtsUnitPresentationOptions {
  readonly root: Object3D;
  readonly pickTargets: readonly Object3D[];
  readonly selectionRadius: number;
  /** Null for a model that ships no clips; the unit then stands in its bind pose. */
  readonly animation: RtsUnitAnimationSource | null;
  /**
   * The unit's authored `moveSpeed`, which calibrates the walk/run boundary and
   * the playback rate. Omitted for a caller that does not know it; the defaults
   * then behave like a 1 unit/s unit, which is only ever a stand-in.
   */
  readonly moveSpeed?: number | undefined;
}

/** Crossfade length between locomotion clips: long enough to blend, short enough to obey. */
const LOCOMOTION_FADE_SECONDS = 0.18;

class RtsUnitPresentation implements RtsPresentationHandle {
  readonly root: Object3D;
  readonly pickTargets: readonly Object3D[];
  readonly selectionRadius: number;
  private animator: CrossfadeAnimator | null = null;
  /** The node the mixer was bound to, so disposal uncaches the same root. */
  private animationTarget: Object3D | null = null;
  /** Sidecar role→clip map, consulted every frame by the pure selector. */
  private animationSet: RtsAnimationSet = {};
  private readonly tuning: RtsLocomotionTuning;

  constructor(options: RtsUnitPresentationOptions) {
    this.root = options.root;
    this.pickTargets = options.pickTargets;
    this.selectionRadius = options.selectionRadius;
    this.tuning = rtsLocomotionTuning(options.moveSpeed ?? 1);

    const animation = options.animation;
    if (!animation || animation.clips.length === 0) return;
    // Root motion is locked from the sidecar, not from code: RTS movement is
    // authoritative over position, so a walk clip that carries its own
    // translation would drag the body away from where the simulation put it.
    this.animationTarget = animation.target;
    this.animator = new CrossfadeAnimator(animation.target, animation.clips, {
      rootMotion: animation.skeleton.rootMotion,
    });
    this.animationSet = animation.skeleton.animationSet;
    // Snapped in rather than faded, so the unit stands correctly on the frame it
    // spawns instead of blending out of its bind pose. An asset with no authored
    // idle is left in its bind pose on purpose — falling back to "some clip"
    // could just as easily start it on its death.
    const idle = animation.skeleton.animationSet.idle;
    if (idle) this.animator.play(idle, 0);
  }

  /**
   * Picks this frame's clip from the simulation snapshot and advances the mixer.
   *
   * All of the judgement lives in the pure selector; what is left here is the
   * Three.js half — crossfade to whatever it named and scale playback to the
   * observed speed. A null selection means the asset has no clip for this state,
   * and the current pose is held rather than replaced with an arbitrary one.
   */
  update(state: RtsPresentationUpdate): void {
    const animator = this.animator;
    if (!animator || state.deltaSeconds <= 0) return;
    const selection = selectRtsAnimation(state, this.animationSet, animator.clips, this.tuning);
    if (selection) {
      animator.play(selection.clip, LOCOMOTION_FADE_SECONDS);
      // After `play`, which resets the rate: this is what keeps a Guard slowed by
      // a crowd from skating, since its feet then cycle at the speed it moves.
      animator.setPlaybackRate(selection.playbackRate);
    }
    animator.mixer.update(state.deltaSeconds);
  }

  dispose(): void {
    if (this.animator) {
      // Both halves matter: stopping ends the actions, uncaching releases the
      // mixer's per-root binding cache. Without the second, every unit that ever
      // died stays referenced for the lifetime of the match.
      this.animator.mixer.stopAllAction();
      if (this.animationTarget) this.animator.mixer.uncacheRoot(this.animationTarget);
      this.animator = null;
      this.animationTarget = null;
    }
    // Detaching before the owning unit disposes its subtree is what keeps the
    // shared template's geometry and materials alive for every other instance.
    this.root.removeFromParent();
  }
}

export function createRtsUnitPresentation(options: RtsUnitPresentationOptions): RtsPresentationHandle {
  return new RtsUnitPresentation(options);
}

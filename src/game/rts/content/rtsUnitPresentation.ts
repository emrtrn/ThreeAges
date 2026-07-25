/**
 * Animated RTS unit presentation — skeletal animation plan Faz B.
 *
 * Wraps one {@link CrossfadeAnimator} around a cloned Actor presentation tree
 * and drives it from the small per-frame snapshot the unit reports. It is a
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
}

class RtsUnitPresentation implements RtsPresentationHandle {
  readonly root: Object3D;
  readonly pickTargets: readonly Object3D[];
  readonly selectionRadius: number;
  private animator: CrossfadeAnimator | null = null;
  /** The node the mixer was bound to, so disposal uncaches the same root. */
  private animationTarget: Object3D | null = null;

  constructor(options: RtsUnitPresentationOptions) {
    this.root = options.root;
    this.pickTargets = options.pickTargets;
    this.selectionRadius = options.selectionRadius;

    const animation = options.animation;
    if (!animation || animation.clips.length === 0) return;
    // Root motion is locked from the sidecar, not from code: RTS movement is
    // authoritative over position, so a walk clip that carries its own
    // translation would drag the body away from where the simulation put it.
    this.animationTarget = animation.target;
    this.animator = new CrossfadeAnimator(animation.target, animation.clips, {
      rootMotion: animation.skeleton.rootMotion,
    });
    // Faz B plays the authored idle and nothing else; the speed/attack fields of
    // the snapshot are already carried so Faz C only has to add the selector.
    // An asset with no authored idle is left in its bind pose on purpose —
    // falling back to "some clip" could just as easily start it on its death.
    const idle = animation.skeleton.animationSet.idle;
    if (idle) this.animator.play(idle, 0);
  }

  update(state: RtsPresentationUpdate): void {
    if (!this.animator || state.deltaSeconds <= 0) return;
    this.animator.mixer.update(state.deltaSeconds);
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

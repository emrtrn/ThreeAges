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
 * no subsystem registry to register with. Faz F therefore took the second of the
 * two options it left open and throttles here, reusing the same pure scheduler
 * (`@engine/perf/distanceUpdateRate`) that the subsystem uses — the cadence
 * policy is shared even though the tick owner is not.
 */
import { Mesh, type AnimationClip, type Object3D } from "three";
import type { ActorScriptDef } from "@engine/scene/actorScript";

import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import {
  consumeDistanceUpdateDelta,
  isFarFromFocus,
  type DistanceUpdateRateSettings,
} from "@engine/perf/distanceUpdateRate";
import type { AssetSkeletonDef } from "@/scene/assetSkeletonLoader";
import {
  advanceRtsAction,
  advanceRtsWorkMontage,
  resolveRtsWorkMontage,
  rtsActionClip,
  rtsLocomotionTuning,
  rtsWorkMontageSection,
  selectRtsAnimation,
  RTS_ACTION_NONE,
  RTS_WORK_MONTAGE_NONE,
  type RtsActionDurations,
  type RtsActionState,
  type RtsAnimationSet,
  type RtsLocomotionTuning,
  type RtsWorkMontage,
  type RtsWorkMontageState,
} from "../units/rtsUnitAnimation";
import type { RtsPresentationHandle, RtsPresentationUpdate } from "../units/unit";
import { advanceRtsWheelSpins, type RtsWheelSpinBinding } from "./rtsPresentationMotion";

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
  /**
   * Ground speed this actor's walk clip reads naturally at. Omitted keeps the
   * `moveSpeed`-derived default, which is right for anything drawn at the scale
   * its clips were authored for; an actor with an authored model scale must
   * supply it or its feet slide (see {@link RtsLocomotionOverrides}).
   */
  readonly walkClipSpeed?: number | undefined;
  /**
   * Authored presentation motions already bound to their runtime nodes. Empty or
   * omitted for every unit that is a body with a walk cycle; the siege engine is
   * what this exists for.
   */
  readonly wheelSpins?: readonly RtsWheelSpinBinding[] | undefined;
}

/** Crossfade length between locomotion clips: long enough to blend, short enough to obey. */
const LOCOMOTION_FADE_SECONDS = 0.18;
/** A swing and a fall are meant to read as sudden, so they cut in far faster. */
const ACTION_FADE_SECONDS = 0.06;

/**
 * When a unit's animation may run on a reduced cadence, and how reduced.
 *
 * The scale is the RTS camera's, not a character game's: at the default pitch a
 * unit 45 world units from the camera is a small figure near the edge of the
 * view, where a 15 Hz cycle is indistinguishable from a 60 Hz one — while an army
 * of them is exactly where per-frame mixer evaluation stops being affordable.
 * Skipped time is accumulated, never dropped, so a unit that walks back into
 * range is where its clip should be rather than behind it.
 */
export const RTS_ANIMATION_DISTANCE_SETTINGS: DistanceUpdateRateSettings = {
  farDistance: 45,
  farUpdateHz: 15,
};

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
  /** The running one-shot (swing or fall), owned by the pure state machine. */
  private action: RtsActionState = RTS_ACTION_NONE;
  private actionDurations: RtsActionDurations = { attack: null, death: null };
  /** Which one-shot the mixer was last told to start, so it retriggers only on change. */
  private startedAction: RtsActionState = RTS_ACTION_NONE;
  /** See {@link RtsPresentationHandle.deathSeconds}: undefined when unauthored. */
  readonly deathSeconds: number | undefined = undefined;
  /** Authored kneel/hold/stand sections of the job animation, or null when unauthored. */
  private workMontage: RtsWorkMontage | null = null;
  /** Which part of that montage is playing, owned by the pure state machine. */
  private workState: RtsWorkMontageState = RTS_WORK_MONTAGE_NONE;
  /** Render time a far unit has banked since its last mixer update (Faz F). */
  private pendingSeconds = 0;
  /** Authored wheel pivots, turned by measured travel rather than by a clip. */
  private readonly wheelSpins: readonly RtsWheelSpinBinding[];

  constructor(options: RtsUnitPresentationOptions) {
    this.root = options.root;
    this.pickTargets = options.pickTargets;
    this.selectionRadius = options.selectionRadius;
    this.tuning = rtsLocomotionTuning(options.moveSpeed ?? 1, { walkClipSpeed: options.walkClipSpeed });
    this.wheelSpins = options.wheelSpins ?? [];

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
    // One-shot lengths come from the clips themselves, which is the only place
    // that knows them: a swing or a fall must be allowed to finish, and the
    // death length is what the unit's despawn timer then waits for.
    this.actionDurations = {
      attack: this.durationOfRole("attack"),
      death: this.durationOfRole("death"),
    };
    this.deathSeconds = this.actionDurations.death ?? undefined;
    this.workMontage = resolveRtsWorkMontage(animation.skeleton.montages, this.animator.clips);
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
   * Two channels, in priority order: a running one-shot (swing or fall) owns the
   * pose outright, and locomotion drives whenever none is. All of the judgement
   * lives in the pure module; what is left here is the Three.js half — start,
   * crossfade, scale playback, tick.
   *
   * A frame this unit is too far away to be worth evaluating returns early with
   * its time banked; the next frame that does run gets the whole accumulated
   * delta, so clip phase, swing length and death length stay wall-clock correct
   * however often the mixer was actually stepped.
   */
  update(state: RtsPresentationUpdate): void {
    if (state.deltaSeconds <= 0) return;
    // Before the animator, and outside its early return: a siege engine is static
    // meshes on pivots with no mixer at all, so gating the wheels on an animator
    // would leave them frozen for the one unit they exist for. Full delta, not the
    // throttled one — the throttle is there to skip mixer evaluation, and adding a
    // float to a rotation is not what it was protecting.
    advanceRtsWheelSpins(this.wheelSpins, state.planarSpeed, state.deltaSeconds);

    const animator = this.animator;
    if (!animator) return;

    const deltaSeconds = consumeDistanceUpdateDelta({
      deltaSeconds: state.deltaSeconds,
      accumulatedSeconds: this.pendingSeconds,
      isFar: isFarFromFocus(state.cameraDistanceSquared, RTS_ANIMATION_DISTANCE_SETTINGS),
      settings: RTS_ANIMATION_DISTANCE_SETTINGS,
    });
    if (deltaSeconds <= 0) {
      this.pendingSeconds += state.deltaSeconds;
      return;
    }
    this.pendingSeconds = 0;

    this.action = advanceRtsAction(this.action, state, this.actionDurations, deltaSeconds);
    this.workState = advanceRtsWorkMontage(this.workState, state, this.workMontage, this.tuning, deltaSeconds);
    const actionClip = rtsActionClip(this.action, this.animationSet, animator.clips);
    if (actionClip) {
      // Restarted only when the state machine says a *new* one-shot began.
      // Re-issuing it every frame would reset the playhead and freeze the unit
      // on the swing's first frame for as long as it was fighting.
      if (this.action.kind !== this.startedAction.kind || this.action.attackCount !== this.startedAction.attackCount) {
        animator.playOnce(actionClip, ACTION_FADE_SECONDS);
        this.startedAction = this.action;
      }
      animator.update(deltaSeconds);
      return;
    }
    this.startedAction = RTS_ACTION_NONE;

    // The work montage sits between the one-shots and locomotion: it owns the
    // body only while the unit is standing at its job (or winding down out of
    // it), and cancels itself the moment the unit moves or fights. Re-issuing
    // the same section every frame is a no-op inside the animator, so the held
    // part stays put instead of restarting.
    const workSection = rtsWorkMontageSection(this.workState, this.workMontage);
    if (workSection && this.workMontage) {
      animator.playRange(
        this.workMontage.clip,
        {
          startSeconds: workSection.section.startSeconds,
          endSeconds: workSection.section.endSeconds,
          loop: workSection.loop,
        },
        LOCOMOTION_FADE_SECONDS,
      );
      animator.update(deltaSeconds);
      return;
    }

    // A null selection means the asset has no clip for this state; the current
    // pose is held rather than replaced with an arbitrary one.
    const selection = selectRtsAnimation(state, this.animationSet, animator.clips, this.tuning);
    if (selection) {
      animator.play(selection.clip, LOCOMOTION_FADE_SECONDS);
      // After `play`, which resets the rate: this is what keeps a Guard slowed by
      // a crowd from skating, since its feet then cycle at the speed it moves.
      animator.setPlaybackRate(selection.playbackRate);
    }
    animator.update(deltaSeconds);
  }

  /** Authored length of the clip a semantic role names, or null when unauthored. */
  private durationOfRole(role: "attack" | "death"): number | null {
    const clip = this.animationSet[role];
    if (!clip || !this.animator) return null;
    const duration = this.animator.clipDuration(clip);
    return duration !== null && duration > 0 ? duration : null;
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

/**
 * Every mesh under a presentation, which is what a click on the unit may land on.
 *
 * All of them, not just the body: a siege engine is a chassis, a barrel and two
 * wheels, and a player who clicks the barrel has clicked the gun. Selection is
 * the one place where a multi-component Actor must still behave as one object.
 */
export function collectRtsPickTargets(root: Object3D): Object3D[] {
  const targets: Object3D[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) targets.push(child);
  });
  return targets;
}

/**
 * The Actor's authored selection radius.
 *
 * Authored rather than measured from the model's bounds: the ring says how big
 * the unit is *to the player's mouse*, which is a design call, and deriving it
 * from geometry would make a wide-armed pose select differently from a narrow one.
 */
export function readRtsSelectionRadius(def: ActorScriptDef | undefined, fallback = 0.5): number {
  const value = def?.variables.find((field) => field.key === "selectionRadius")?.default;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

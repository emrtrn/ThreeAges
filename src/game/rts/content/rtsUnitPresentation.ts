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
import { Group, Mesh, PropertyBinding, type AnimationClip, type Object3D } from "three";
import type { ActorScriptDef } from "@engine/scene/actorScript";

import { CrossfadeAnimator } from "@engine/render-three/characterAnimator";
import { collectSubtreeNodeNames } from "@engine/render-three/bodyMask";
import { LayeredClipAnimator, type UnitClipAnimator } from "@engine/render-three/layeredClipAnimator";
import {
  consumeDistanceUpdateDelta,
  isFarFromFocus,
  type DistanceUpdateRateSettings,
} from "@engine/perf/distanceUpdateRate";
import type { AssetSkeletonDef } from "@/scene/assetSkeletonLoader";
import {
  AnimationNotifyTracker,
  groupNotifiesByClip,
  type NotifyMarker,
} from "@/game/animationNotifies";
import {
  advanceRtsAction,
  advanceRtsWorkMontage,
  resolveRtsWorkMontage,
  resolveRtsAnimationVariant,
  rtsActionClip,
  rtsActionSequence,
  rtsLocomotionTuning,
  rtsWorkMontageSection,
  selectRtsAnimation,
  RTS_ACTION_NONE,
  RTS_WORK_MONTAGE_NONE,
  type RtsActionDurations,
  type RtsActionState,
  type RtsAnimationRole,
  type RtsAnimationSet,
  type RtsAnimationVariants,
  type RtsLocomotionTuning,
  type RtsWorkMontage,
  type RtsWorkMontageState,
} from "../units/rtsUnitAnimation";
import type { RtsPresentationHandle, RtsPresentationUpdate } from "../units/unit";
import { advanceRtsWheelSpins, type RtsWheelSpinBinding } from "./rtsPresentationMotion";
import { advanceRtsGunRecoils, type RtsGunRecoilBinding } from "./rtsGunMotion";
import {
  advanceRtsCargoSway,
  applyRtsCargoVisibility,
  type RtsCargoSwayBinding,
  type RtsCargoVisualBinding,
} from "./rtsCargoVisual";

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

/**
 * Mount a sidecar-authored socket on a bone in a cloned RTS presentation.
 *
 * The marker is presentation-only: callers can read its rendered world position
 * for a projectile, but no combat decision can flow back through it. Bone names
 * are checked both as saved and as GLTFLoader sanitizes them, so a socket authored
 * against a Mixamo name stays valid at runtime.
 */
export function bindRtsSkeletalSocket(
  animation: RtsUnitAnimationSource | null,
  socketName: string,
): Object3D | null {
  const socket = animation?.skeleton.sockets.find((candidate) => candidate.name === socketName);
  if (!animation || !socket) return null;
  const savedBone = PropertyBinding.sanitizeNodeName(socket.bone);
  const matches: Object3D[] = [];
  animation.target.traverse((candidate) => {
    if (matches.length > 0 || candidate.name.length === 0) return;
    if (candidate.name === socket.bone || PropertyBinding.sanitizeNodeName(candidate.name) === savedBone) {
      matches.push(candidate);
    }
  });
  const bone = matches[0];
  if (!bone) return null;
  const marker = new Group();
  marker.name = `rts-socket:${socket.name}`;
  marker.position.set(...socket.position);
  marker.rotation.set(
    socket.rotation[0] * Math.PI / 180,
    socket.rotation[1] * Math.PI / 180,
    socket.rotation[2] * Math.PI / 180,
  );
  marker.scale.set(...socket.scale);
  bone.add(marker);
  return marker;
}

export interface RtsUnitPresentationOptions {
  readonly root: Object3D;
  readonly pickTargets: readonly Object3D[];
  readonly selectionRadius: number;
  /** Null for a model that ships no clips; the unit then stands in its bind pose. */
  readonly animation: RtsUnitAnimationSource | null;
  /** Stable per-instance seed for purely visual animation variety. */
  readonly animationVariantSeed?: number | undefined;
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
  /**
   * Authored cargo meshes already bound to their runtime nodes. Empty or omitted
   * for anything that never carries a visible load; the caravan pack animal is
   * what this exists for.
   */
  readonly cargoVisuals?: readonly RtsCargoVisualBinding[] | undefined;
  /**
   * Authored load sways already bound to their runtime nodes, each carrying the
   * small phase state it advances. Independent of {@link cargoVisuals}: anything
   * that hangs off a body may rock, whether or not it appears and disappears.
   */
  readonly cargoSways?: readonly RtsCargoSwayBinding[] | undefined;
  /**
   * Authored barrel recoils already bound to their runtime nodes. Empty or
   * omitted for anything without a gun on it.
   */
  readonly gunRecoils?: readonly RtsGunRecoilBinding[] | undefined;
  /**
   * The node this Actor fires from, or null when it marks none — the shell then
   * leaves from the unit's own position, as it did before muzzles were authored.
   */
  readonly muzzle?: Object3D | null | undefined;
  /** Visual-only riders/crew parented to this unit's root. */
  readonly crew?: readonly RtsAttachedCrewPresentation[] | undefined;
  /**
   * Called with an authored animation notify's name as this unit's playhead
   * crosses it (Guard plan Faz 6) — a footfall, a sword's contact, a flinch.
   *
   * A report, never a request: the simulation has already decided what happened
   * and how much it hurt, and this says only when the *art* reaches the moment.
   * Nothing downstream of it may write simulation state. Omitted by callers with
   * no consumer, which skips the sampling entirely.
   */
  readonly onNotify?: ((name: string) => void) | undefined;
}

/** An independently animated visual attached to a unit, never a simulation unit. */
export interface RtsAttachedCrewPresentation {
  readonly root: Object3D;
  readonly animation: RtsUnitAnimationSource | null;
}

class RtsAttachedCrewAnimator {
  private animator: CrossfadeAnimator | null = null;
  private target: Object3D | null = null;
  private animationSet: RtsAnimationSet = {};
  private readonly tuning: RtsLocomotionTuning;

  constructor(crew: RtsAttachedCrewPresentation, moveSpeed: number) {
    this.tuning = rtsLocomotionTuning(moveSpeed);
    const source = crew.animation;
    if (!source || source.clips.length === 0) return;
    this.target = source.target;
    this.animator = new CrossfadeAnimator(source.target, source.clips, { rootMotion: source.skeleton.rootMotion });
    this.animationSet = source.skeleton.animationSet;
    const idle = this.animationSet.idle;
    if (idle) this.animator.play(idle, 0);
  }

  update(state: RtsPresentationUpdate): void {
    if (!this.animator || state.deltaSeconds <= 0) return;
    // Crew has no separate combat or death state: it is part of the gun. It
    // follows the gun's measured movement until purpose-built push animations
    // are authored, at which point this small visual driver is the only seam.
    const selection = selectRtsAnimation(
      {
        planarSpeed: state.planarSpeed,
        ...(state.forceWalk === undefined ? {} : { forceWalk: state.forceWalk }),
        attacking: false,
        dying: false,
        working: false,
        attackCount: 0,
        impactCount: 0,
      },
      this.animationSet,
      this.animator.clips,
      this.tuning,
    );
    if (selection) {
      this.animator.play(selection.clip, LOCOMOTION_FADE_SECONDS);
      this.animator.setPlaybackRate(selection.playbackRate);
    }
    this.animator.update(state.deltaSeconds);
  }

  dispose(): void {
    if (!this.animator) return;
    if (this.target) this.animator.release(this.target);
    this.animator = null;
    this.target = null;
  }
}

/** Crossfade length between locomotion clips: long enough to blend, short enough to obey. */
const LOCOMOTION_FADE_SECONDS = 0.18;
/** A swing and a fall are meant to read as sudden, so they cut in far faster. */
const ACTION_FADE_SECONDS = 0.06;
/**
 * Kneeling down to be tended, and rising once it is done.
 *
 * Slower than an ordinary locomotion blend because it is a whole change of
 * posture rather than a change of gait: at 0.18 s a wounded soldier drops to the
 * ground and springs back up like a dropped puppet. Deliberately *not* applied
 * to every transition out of the pose — a unit ordered to move mid-mending is
 * getting up because something urgent happened, and should do it at the speed
 * everything else moves at.
 */
const REST_FADE_SECONDS = 0.45;

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
  private animator: UnitClipAnimator | null = null;
  /**
   * The same animator when it can split the body, else null.
   *
   * Held separately rather than behind a capability flag on the interface so the
   * unlayered path is provably untouched: an asset that authors no upper-body
   * bone gets the plain single-mixer animator it always had, and every call that
   * only a layered asset can serve is unreachable without this reference.
   */
  private layered: LayeredClipAnimator | null = null;
  /** Asset opt-in: only moving ranged attacks with this flag may split the body. */
  private canLayerAttack = false;
  /** The node the mixer was bound to, so disposal uncaches the same root. */
  private animationTarget: Object3D | null = null;
  /** Sidecar role→clip map, consulted every frame by the pure selector. */
  private animationSet: RtsAnimationSet = {};
  /** Extra authored clips per semantic role; absent keeps the single-clip path. */
  private animationVariants: RtsAnimationVariants = {};
  private readonly animationVariantSeed: number;
  private readonly tuning: RtsLocomotionTuning;
  /** The running one-shot (swing or fall), owned by the pure state machine. */
  private action: RtsActionState = RTS_ACTION_NONE;
  private actionDurations: RtsActionDurations = { attack: null, attackRecovery: null, hit: null, death: null };
  /**
   * The continuous role the mixer was last told to play, for {@link locomotionFade}.
   *
   * Only written on frames the continuous channel actually reaches, so a one-shot
   * or a work montage passing overhead leaves it alone: what the kneel blends out
   * of is the last pose this channel held, not whatever interrupted it.
   */
  private lastContinuousRole: RtsAnimationRole = "idle";
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
  /** True once the fall has played out and the animator has been stopped for good. */
  private poseFrozen = false;
  /** Authored wheel pivots, turned by measured travel rather than by a clip. */
  private readonly wheelSpins: readonly RtsWheelSpinBinding[];
  /** Authored cargo meshes, shown and hidden by the carrier's reported load. */
  private readonly cargoVisuals: readonly RtsCargoVisualBinding[];
  /** Authored load sways, rocked by measured travel rather than by a clip. */
  private readonly cargoSways: readonly RtsCargoSwayBinding[];
  /** Authored barrel pivots, kicked by the unit's shot counter rather than by a clip. */
  private readonly gunRecoils: readonly RtsGunRecoilBinding[];
  /** See {@link RtsPresentationHandle.muzzle}: null for anything that marks none. */
  readonly muzzle: Object3D | null;
  /** Last load state applied, so an unchanged frame touches no node at all. */
  private carrying: boolean | null = null;
  /** Where an authored notify goes, or null when this caller consumes none. */
  private readonly onNotify: ((name: string) => void) | null;
  /** Authored markers keyed by clip; empty keeps the whole notify path unentered. */
  private notifiesByClip: ReadonlyMap<string, readonly NotifyMarker[]> = new Map();
  /**
   * Notify detector for the clip driving the body — the legs' channel on a
   * layered unit, the only channel on every other one.
   */
  private readonly bodyNotifies = new AnimationNotifyTracker();
  /**
   * A second detector for the torso, used only while a one-shot owns it alone.
   *
   * Two detectors rather than one because a struck walker is genuinely playing
   * two clips at once and both carry markers: its feet keep landing while its
   * chest takes the blow. They cannot be merged into one playhead, and reading
   * both channels unconditionally would double every full-body clip's notifies —
   * which is why {@link LayeredClipAnimator.getUpperActiveClip} reports null the
   * moment the torso goes back to mirroring the legs.
   */
  private readonly torsoNotifies = new AnimationNotifyTracker();
  /**
   * What the continuous channel was last told to play, as an identity string.
   *
   * A restart onto the same clip name is invisible to a playhead comparison — the
   * name is unchanged and the time jumps backwards, which reads as a loop wrap
   * and would fire every marker the interrupted take never reached. The montage
   * section is part of the identity for the same reason: re-entering a section
   * rewinds inside one clip.
   */
  private startedContinuous: string | null = null;
  /** Crew mixers are visual children of this one unit, never independent units. */
  private readonly crew: readonly RtsAttachedCrewAnimator[];

  constructor(options: RtsUnitPresentationOptions) {
    this.root = options.root;
    this.pickTargets = options.pickTargets;
    this.selectionRadius = options.selectionRadius;
    this.animationVariantSeed = options.animationVariantSeed ?? 0;
    this.tuning = rtsLocomotionTuning(options.moveSpeed ?? 1, { walkClipSpeed: options.walkClipSpeed });
    this.wheelSpins = options.wheelSpins ?? [];
    this.cargoVisuals = options.cargoVisuals ?? [];
    this.cargoSways = options.cargoSways ?? [];
    this.gunRecoils = options.gunRecoils ?? [];
    this.muzzle = options.muzzle ?? null;
    this.onNotify = options.onNotify ?? null;
    this.crew = (options.crew ?? []).map((member) => new RtsAttachedCrewAnimator(member, options.moveSpeed ?? 1));

    const animation = options.animation;
    if (!animation || animation.clips.length === 0) return;
    // Grouped only where someone listens: every unit in the match builds one of
    // these, and an asset with no consumer should carry no per-instance map.
    if (this.onNotify) this.notifiesByClip = groupNotifiesByClip(animation.skeleton.notifies);
    // Root motion is locked from the sidecar, not from code: RTS movement is
    // authoritative over position, so a walk clip that carries its own
    // translation would drag the body away from where the simulation put it.
    this.animationTarget = animation.target;
    // Layering costs a second mixer and a second set of clip actions per unit,
    // so it is bought only where it is used: the asset has to author an
    // upper-body bone *and* that bone has to match real nodes on this model. A
    // bone that matches nothing would split every track onto the lower channel
    // and pay the whole cost for an animator that behaves identically.
    const upperBodyBone = animation.skeleton.upperBodyBone;
    const canSplit =
      typeof upperBodyBone === "string" &&
      upperBodyBone.length > 0 &&
      collectSubtreeNodeNames(animation.target, upperBodyBone).size > 0;
    if (canSplit) {
      this.layered = new LayeredClipAnimator(animation.target, animation.clips, upperBodyBone, {
        rootMotion: animation.skeleton.rootMotion,
      });
      this.animator = this.layered;
    } else {
      this.animator = new CrossfadeAnimator(animation.target, animation.clips, {
        rootMotion: animation.skeleton.rootMotion,
      });
    }
    this.animationSet = animation.skeleton.animationSet;
    this.animationVariants = animation.skeleton.animationVariants;
    this.canLayerAttack = animation.skeleton.layerAttackWhenMoving === true;
    // One-shot lengths come from the clips themselves, which is the only place
    // that knows them: a swing or a fall must be allowed to finish, and the
    // death length is what the unit's despawn timer then waits for.
    this.actionDurations = {
      attack: this.durationOfRole("attack"),
      attackRecovery: this.durationOfRole("attackRecovery"),
      hit: this.durationOfRole("hit"),
      death: this.durationOfRole("death"),
    };
    this.deathSeconds = this.actionDurations.death ?? undefined;
    this.workMontage = resolveRtsWorkMontage(animation.skeleton.montages, this.animator.clips);
    // Snapped in rather than faded, so the unit stands correctly on the frame it
    // spawns instead of blending out of its bind pose. An asset with no authored
    // idle is left in its bind pose on purpose — falling back to "some clip"
    // could just as easily start it on its death.
    const idle = resolveRtsAnimationVariant(
      "idle",
      this.animationSet,
      this.animationVariants,
      this.animator.clips,
      this.animationVariantSeed,
    );
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
    // First, and above every early return: whether a load is on the animal's back
    // is a fact about this frame, not an animation to advance. A paused frame, a
    // far-away frame and a frame where the mixer is skipped must all still show
    // the right cargo, and the change guard is what keeps that free.
    if (state.carrying !== undefined && state.carrying !== this.carrying) {
      this.carrying = state.carrying;
      applyRtsCargoVisibility(this.cargoVisuals, state.carrying);
    }
    if (state.deltaSeconds <= 0) return;
    // Before the animator, and outside its early return: a siege engine is static
    // meshes on pivots with no mixer at all, so gating the wheels on an animator
    // would leave them frozen for the one unit they exist for. Full delta, not the
    // throttled one — the throttle is there to skip mixer evaluation, and adding a
    // float to a rotation is not what it was protecting.
    advanceRtsWheelSpins(this.wheelSpins, state.planarSpeed, state.deltaSeconds);
    // Alongside the wheels, and for the same reasons: measured speed, full delta,
    // outside the animator's early return. A pack animal's load must rock whether
    // or not the asset it hangs on ships a single clip.
    advanceRtsCargoSway(this.cargoSways, state.planarSpeed, state.deltaSeconds);
    // And alongside both: a gun is static meshes on pivots with no mixer, so its
    // barrel would never kick if this waited for the animator. Driven by the shot
    // counter, not by measured speed — the one presentation motion here that a
    // standing unit is *supposed* to have.
    advanceRtsGunRecoils(this.gunRecoils, state.attackCount, state.deltaSeconds);
    for (const crew of this.crew) crew.update(state);

    const animator = this.animator;
    if (!animator) return;
    // The one state a presentation never leaves, and the only place it is worth
    // stopping the animator outright. A body that has finished falling holds one
    // pose for the rest of its time on the field, so every frame after that is
    // pure waste — and it is not small waste: `clampWhenFinished` pauses the
    // action but Three still evaluates and accumulates every one of the clip's
    // ~200 tracks per channel per frame, and the selector above rebuilds the
    // same clip choice on top of it. Skipping both is what makes a corpse window
    // measured in tens of seconds affordable.
    if (this.poseFrozen) return;

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

    // Attack and hit lengths are resolved against *this frame's* counter, since
    // each variant is a different length and the state machine is about to be
    // told how long the one it is starting runs for. Death has no variants keyed
    // to an event, so its cached length stands.
    this.action = advanceRtsAction(this.action, state, {
      attack: this.durationOfRole("attack", state.attackCount),
      attackRecovery: this.actionDurations.attackRecovery ?? null,
      hit: this.durationOfRole("hit", state.impactCount),
      death: this.actionDurations.death,
    }, deltaSeconds, {
      canLayerHit: this.layered !== null,
      canLayerAttack: this.layered !== null && this.canLayerAttack,
      walkSpeed: this.tuning.walkSpeed,
    });
    this.workState = advanceRtsWorkMontage(this.workState, state, this.workMontage, this.tuning, deltaSeconds);
    const actionClip = rtsActionClip(
      this.action,
      this.animationSet,
      animator.clips,
      this.animationVariants,
      this.animationVariantSeed,
    );
    if (actionClip) {
      // Restarted only when the state machine says a *new* one-shot began.
      // Re-issuing it every frame would reset the playhead and freeze the unit
      // on the swing's first frame for as long as it was fighting.
      const started =
        this.action.kind !== this.startedAction.kind
        || rtsActionSequence(this.action) !== rtsActionSequence(this.startedAction);
      const promotedToUpperBody =
        !started
        && this.action.layered
        && !this.startedAction.layered;
      if (this.action.layered && this.layered) {
        // The one one-shot that shares the body. It claims the torso and then
        // falls through on purpose — the locomotion code below still runs, and
        // it is what keeps the legs striding under a flinch instead of pinning
        // the whole unit mid-step while the simulation slides it forward.
        if (started || promotedToUpperBody) {
          // A move order may arrive after a standing shot has already begun.
          // Continue the torso from the lower channel's current playhead rather
          // than restarting recoil (and its arrow-release notify) from zero.
          const startSeconds = promotedToUpperBody
            ? (this.layered.getActiveClip()?.time ?? 0)
            : 0;
          this.layered.playUpperOnce(actionClip, ACTION_FADE_SECONDS, startSeconds);
          this.startedAction = this.action;
          this.torsoNotifies.arm(actionClip, startSeconds);
        }
      } else {
        if (started) {
          animator.playOnce(actionClip, ACTION_FADE_SECONDS);
          this.startedAction = this.action;
          // A one-shot takes the continuous channel with it, so what plays after
          // it is a fresh start however familiar its name.
          this.startedContinuous = null;
          this.bodyNotifies.arm(actionClip);
        }
        this.tick(deltaSeconds);
        // Frozen *after* this frame's tick, never before it. The state machine
        // does not spend the delta on the frame the fall starts and the mixer
        // does, so by the time the remaining time reaches zero the mixer has had
        // a frame more than the clip is long and is sitting on its clamped last
        // pose. Freezing on the check alone, before the tick, would leave the
        // body a frame short of where it was animated to land.
        if (this.action.kind === "death" && this.action.remainingSeconds <= 0) this.poseFrozen = true;
        return;
      }
    } else {
      this.startedAction = RTS_ACTION_NONE;
      // Where a layered flinch ends: the torso fades back into the gait the legs
      // are on *now*, which is not necessarily the one it left.
      this.layered?.releaseUpperBody(LOCOMOTION_FADE_SECONDS);
    }

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
      this.markContinuous(
        this.workMontage.clip,
        `${this.workMontage.clip}@${workSection.section.startSeconds}:${workSection.section.endSeconds}:${workSection.loop}`,
        workSection.section.startSeconds,
      );
      this.tick(deltaSeconds);
      return;
    }

    // A null selection means the asset has no clip for this state; the current
    // pose is held rather than replaced with an arbitrary one.
    const selection = selectRtsAnimation(
      state,
      this.animationSet,
      animator.clips,
      this.tuning,
      this.animationVariants,
      this.animationVariantSeed,
    );
    if (selection) {
      animator.play(selection.clip, this.locomotionFade(selection.role));
      // After `play`, which resets the rate: this is what keeps a Guard slowed by
      // a crowd from skating, since its feet then cycle at the speed it moves.
      animator.setPlaybackRate(selection.playbackRate);
      this.markContinuous(selection.clip, selection.clip, 0);
    }
    this.tick(deltaSeconds);
  }

  /**
   * Advances the mixer and reads whatever notify markers that step crossed.
   *
   * One place rather than four so the two can never come apart: a path that
   * ticked without sampling would bank markers and fire them all at once on the
   * next path that did, and a path that sampled without ticking would report a
   * playhead that has not moved. Sampling *after* the tick is what makes the
   * far-unit cadence honest — the whole banked delta is one interval, and a
   * marker inside it fires once, on the frame the animation actually reached it.
   */
  private tick(deltaSeconds: number): void {
    this.animator?.update(deltaSeconds);
    if (this.notifiesByClip.size === 0 || !this.onNotify) return;
    const animator = this.animator;
    if (!animator) return;
    for (const notify of this.bodyNotifies.sample(animator.getActiveClip(), this.notifiesByClip)) {
      this.onNotify(notify.name);
    }
    // Null whenever no one-shot owns the torso, which is what stops a full-body
    // clip — present on both channels — from firing each of its markers twice.
    const torso = this.layered?.getUpperActiveClip() ?? null;
    for (const notify of this.torsoNotifies.sample(torso, this.notifiesByClip)) {
      this.onNotify(notify.name);
    }
  }

  /**
   * Records what the continuous channel is playing, re-arming on a real restart.
   *
   * `identity` is what changes when playback begins again rather than continues:
   * the clip name for locomotion, and the clip *plus its window* for a montage
   * section, since re-entering a section rewinds inside a single clip.
   */
  private markContinuous(clip: string, identity: string, startSeconds: number): void {
    if (identity === this.startedContinuous) return;
    this.startedContinuous = identity;
    this.bodyNotifies.arm(clip, startSeconds);
  }

  /**
   * Whether this presentation has stopped animating for good.
   *
   * Exposed because the saving is invisible from the outside — the body looks
   * identical either way — so without a way to observe it, a later edit that
   * puts every corpse back on the mixer would cost frame time silently. Read by
   * the engine tests; nothing in the game branches on it.
   */
  get animationFrozen(): boolean {
    return this.poseFrozen;
  }

  /**
   * Blend length for a continuous clip, slowed only for the kneel and the rise.
   *
   * Both directions between `rest` and a standing pose, and only those: going
   * down to be tended and getting back up are what the fiction wants unhurried.
   * Which standing pose it is does not change that — a held Guard rises out of
   * the kneel just as slowly as an ordinary one — so `hold` counts as standing
   * here alongside `idle`. Anything else leaving the pose (a march order, a
   * fight, a fall) keeps the ordinary blend, because those transitions are
   * urgent and a lazy one would leave the body kneeling half a second into a
   * charge. Adopting the ready stance is one of the ordinary ones: an order
   * answered at 0.18 s reads as obeyed, at 0.45 s as reluctant.
   */
  private locomotionFade(role: RtsAnimationRole): number {
    const standing = (candidate: RtsAnimationRole): boolean => candidate === "idle" || candidate === "hold";
    const restful = (role === "rest" && standing(this.lastContinuousRole))
      || (standing(role) && this.lastContinuousRole === "rest");
    this.lastContinuousRole = role;
    return restful ? REST_FADE_SECONDS : LOCOMOTION_FADE_SECONDS;
  }

  /** Authored length of the clip a semantic role names, or null when unauthored. */
  private durationOfRole(role: "attack" | "attackRecovery" | "hit" | "death", sequence = 0): number | null {
    const clip = resolveRtsAnimationVariant(
      role,
      this.animationSet,
      this.animationVariants,
      this.animator?.clips ?? new Set<string>(),
      this.animationVariantSeed,
      role === "death" ? 0 : sequence,
    );
    if (!clip || !this.animator) return null;
    const duration = this.animator.clipDuration(clip);
    return duration !== null && duration > 0 ? duration : null;
  }

  dispose(): void {
    for (const crew of this.crew) crew.dispose();
    if (this.animator) {
      // Every channel the animator owns, not just the first: a layered unit
      // holds two mixers, and leaving the second bound keeps every unit that
      // ever died referenced for the lifetime of the match.
      if (this.animationTarget) this.animator.release(this.animationTarget);
      this.animator = null;
      this.layered = null;
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

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
export type RtsAnimationRole =
  | "idle" | "walk" | "run" | "walkBack" | "runBack"
  | "aimWalkForward" | "aimWalkBack" | "aimWalkLeft" | "aimWalkRight"
  | "work" | "workCultivation" | "workHarvest" | "workLivestock" | "workHunting" | "workChopping"
  | "carryIdle" | "carryWalk" | "carryPose"
  | "rest" | "hold" | "combatIdle" | "attack" | "attackHunting" | "attackMelee" | "hit" | "death";

/** Per-frame simulation summary, mirroring `RtsPresentationUpdate`'s gameplay half. */
export interface RtsAnimationInput {
  /** Observed ground speed in world units/s, measured from real displacement. */
  readonly planarSpeed: number;
  /** Measured local right/left velocity (+right), relative to the body's facing. */
  readonly localVelocityX?: number;
  /** Measured local forward/back velocity (+forward), relative to the body's facing. */
  readonly localVelocityZ?: number;
  /** Some non-combat movers (the pack donkey) never visually run. */
  readonly forceWalk?: boolean;
  /** True while an order deliberately keeps the unit facing forward as it retreats. */
  readonly backward?: boolean;
  /** True while a live target is inside weapon range. */
  readonly attacking: boolean;
  /** Wildlife hunting is a job animation, never a combat decision. */
  readonly hunting?: boolean;
  /** True once the defeat pose has begun. */
  readonly dying: boolean;
  /**
   * True while the unit is standing at a job it performs in place — today, a
   * worker building a foundation. It is deliberately a single flag rather than
   * one per job: the animation only needs "working here", and every job the RTS
   * has is performed from a standstill at an approach point.
   */
  readonly working: boolean;
  /** Presentation-only Worker assignment category, authored by the owning job system. */
  readonly workerActivity?: import("./unit").WorkerActivity | null;
  /** True only while the job system reports that this body has a visible load. */
  readonly carrying?: boolean | undefined;
  /**
   * True while the unit is standing still being restored in place — today, a
   * wounded soldier inside a Temple's support field (Guard plan Faz 4).
   *
   * A single flag for the same reason {@link working} is one: the pose only
   * needs "being tended here", and it is written where the restoring actually
   * happens rather than inferred from position and health. It reports a fact the
   * simulation already produced — the aura healed this body this tick — so the
   * pose ends the moment the healing does, which is what makes a unit rise on
   * reaching full health without anything watching for that separately.
   *
   * Optional: a caller that models no restoring field omits it and keeps its
   * ordinary idle.
   */
  readonly resting?: boolean;
  /**
   * True while this unit has been ordered to hold its ground rather than to
   * pursue what it sees (`UnitStance = "hold"`, the `H` key).
   *
   * The one flag here that reports an *order* rather than a condition, and that
   * is the whole point of it: holding is a decision the player made that today
   * only shows up indirectly, in a unit declining to chase something it could
   * reach. Read as a plain state rather than as the moment the stance changed,
   * so a unit re-selected, saved or reloaded mid-hold is still in the pose.
   *
   * Optional: a caller with no notion of stance omits it and keeps its idle.
   */
  readonly holding?: boolean;
  /**
   * True while a live hostile is close enough to trade close blows with —
   * inside the unit's own shove reach, not its weapon's firing band.
   *
   * The two are genuinely different questions, and a Worker is where they come
   * apart: its stone has a *minimum* range, so an enemy standing against it is
   * simultaneously "too close to throw at" ({@link attacking} false) and "the
   * thing it is punching". Without this the body reads that gap as nothing
   * happening and drops to its ordinary idle between punches — a man being
   * beaten standing with his arms folded.
   *
   * A condition, not an order: it reports what the simulation has already put in
   * reach, and it clears itself when the target dies or the distance opens.
   * Optional — a caller with no close weapon omits it and keeps its idle.
   */
  readonly engagedClose?: boolean;
  /**
   * How many blows this unit has landed so far. Only its *changes* are read —
   * one swing animation per increment — so the presentation stays event-driven
   * off the same cooldown the damage came from, without the animation getting a
   * vote in when that damage lands.
   */
  readonly attackCount: number;
  /**
   * How many blows this unit has *taken* so far — Guard animation plan Faz 2.
   *
   * Read exactly like {@link attackCount}: only its changes matter, one flinch
   * per increment, and it is written by the health component after the damage is
   * already resolved. A flinch can therefore never delay a blow, hold a cooldown
   * or change what a hit was worth; the animation is told what happened, and is
   * told it late.
   */
  readonly impactCount: number;
  /** Close blows outside the main weapon, such as the Worker's punches. */
  readonly meleeCount?: number;
  /** Decisive wildlife strikes; separate from player-combat attack events. */
  readonly huntStrikeCount?: number;
}

/**
 * A role→clip map. Typed loosely on purpose: today it is fed the sidecar's
 * `animationSet`, which only knows the TPS roles (`idle`/`walk`/`run`/…), and
 * Faz E adds `attack`/`death` to that schema without this module changing.
 */
export type RtsAnimationSet = Readonly<Record<string, string | undefined>>;

/** Optional additional clips for semantic roles, authored beside the primary set. */
export type RtsAnimationVariants = Readonly<Record<string, readonly string[] | undefined>>;

/**
 * A reproducible small hash for presentation-only variety.
 *
 * It never reaches gameplay state: the same unit instance and blow number pick
 * the same clip, while replaying a match or restoring its view cannot make a
 * Guard unexpectedly choose a different swing through `Math.random()`.
 */
function stableAnimationVariantIndex(seed: number, role: string, sequence: number, count: number): number {
  if (count <= 1) return 0;
  let hash = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  hash ^= Math.imul(Number.isFinite(sequence) ? Math.floor(sequence) : 0, 0x9e3779b1);
  for (let index = 0; index < role.length; index += 1) {
    hash ^= role.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}

/**
 * Resolves the primary authored clip plus any valid extras, then selects one
 * deterministically. The primary mapping remains first so an asset with no
 * variants keeps exactly its pre-variation behaviour.
 */
export function resolveRtsAnimationVariant(
  role: string,
  animationSet: RtsAnimationSet,
  variants: RtsAnimationVariants | undefined,
  available: ReadonlySet<string>,
  seed = 0,
  sequence = 0,
): string | null {
  const candidates = [animationSet[role], ...(variants?.[role] ?? [])]
    .filter((clip): clip is string => typeof clip === "string" && available.has(clip));
  const unique = [...new Set(candidates)];
  return unique.length > 0 ? unique[stableAnimationVariantIndex(seed, role, sequence, unique.length)] ?? null : null;
}

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

/**
 * Per-actor override of the calibration half of the tuning.
 *
 * The `walkClipSpeed: 0.5` assumption above holds for anything rendered at the
 * scale its clips were authored for — which every unit is. It does *not* hold
 * for an actor whose model carries an authored scale: a deer drawn at 0.2 covers
 * a fifth of the ground per stride, so its walk clip reads naturally at roughly a
 * fifth of the speed, and calibrating it off `moveSpeed` leaves it sliding.
 *
 * Only the calibration is overridable, never the thresholds: what counts as
 * walking rather than running is a gameplay fact about the actor's speed, and
 * moving that would put a grazing animal into its gallop.
 */
export interface RtsLocomotionOverrides {
  /** Ground speed this actor's walk clip looks natural at, in world units/s. */
  readonly walkClipSpeed?: number | undefined;
}

/** Builds the per-unit tuning from its authored `moveSpeed` (`balance/units.json`). */
export function rtsLocomotionTuning(
  moveSpeed: number,
  overrides?: RtsLocomotionOverrides,
): RtsLocomotionTuning {
  const speed = Number.isFinite(moveSpeed) && moveSpeed > 0 ? moveSpeed : 1;
  const c = RTS_LOCOMOTION_CALIBRATION;
  const authoredWalkClipSpeed = overrides?.walkClipSpeed;
  return {
    walkSpeed: Math.max(c.minWalkThreshold, speed * c.walkThreshold),
    runSpeed: speed * c.runThreshold,
    walkClipSpeed: authoredWalkClipSpeed !== undefined && Number.isFinite(authoredWalkClipSpeed) && authoredWalkClipSpeed > 0
      ? authoredWalkClipSpeed
      : speed * c.walkClipSpeed,
    runClipSpeed: speed,
    minPlaybackRate: c.minPlaybackRate,
    maxPlaybackRate: c.maxPlaybackRate,
  };
}

/**
 * Classifies the snapshot into a role. Death outranks everything — a unit that
 * dies mid-swing falls rather than finishing the blow — and a unit in weapon
 * range is fighting even if crowd shoving still gives it some residual speed.
 *
 * Work sits *below* locomotion on purpose. A builder is assigned to its site for
 * the whole walk over, and only reaches the pose once it has stopped; ranking
 * work above movement would have it kneel while still crossing the map.
 */
export function classifyRtsAnimation(
  input: RtsAnimationInput,
  tuning: RtsLocomotionTuning,
  directionalAimActive = false,
): RtsAnimationRole {
  if (input.dying) return "death";
  if (directionalAimActive && input.planarSpeed > tuning.walkSpeed) {
    const localX = Number.isFinite(input.localVelocityX) ? input.localVelocityX! : 0;
    const localZ = Number.isFinite(input.localVelocityZ)
      ? input.localVelocityZ!
      : input.backward ? -input.planarSpeed : input.planarSpeed;
    if (Math.abs(localX) > Math.abs(localZ)) return localX > 0 ? "aimWalkRight" : "aimWalkLeft";
    return localZ < 0 ? "aimWalkBack" : "aimWalkForward";
  }
  if (input.hunting) return "workHunting";
  if (input.attacking) return "attack";
  // A load owns the locomotion silhouette, but not the route or its speed: this
  // is a presentation read of cargo already held by the job system. Carrying
  // workers deliberately stay on their authored walk even at run speed.
  if (input.carrying) return input.planarSpeed > tuning.walkSpeed ? "carryWalk" : "carryIdle";
  if (input.backward && !input.forceWalk && input.planarSpeed >= tuning.runSpeed) return "runBack";
  if (input.backward && input.planarSpeed > tuning.walkSpeed) return "walkBack";
  if (!input.forceWalk && input.planarSpeed >= tuning.runSpeed) return "run";
  if (input.planarSpeed > tuning.walkSpeed) return "walk";
  // Above the job and below the feet. An enemy inside close reach outranks
  // whatever this body was assigned to do — a builder does not go back to
  // kneeling at his site while a soldier is hitting him — but it never pins a
  // unit that is walking, so a worker ordered away still leaves.
  if (input.engagedClose) return "combatIdle";
  if (input.working) return "work";
  // Below work, above idle. A wounded builder inside the field is still a
  // builder — the job it was sent to do outranks the mending it happens to be
  // receiving — but a soldier with nothing else to do kneels rather than stands.
  if (input.resting) return "rest";
  // Last before idle, because it is the weakest claim on the body: every role
  // above is something the unit is *doing*, and this is only the posture it
  // waits in between those. A held unit that is wounded inside a support field
  // therefore kneels — the mending is news, the standing order is not — and
  // stands back into its ready pose the moment the wound closes.
  if (input.holding) return "hold";
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
  // A project that has not authored dedicated reverse clips remains fully
  // playable: its retreat order uses the ordinary gait instead of holding a
  // pose. Guard maps these to its verified reverse loops in the sidecar.
  walkBack: ["walkBack", "walk", "run", "idle"],
  runBack: ["runBack", "walkBack", "run", "walk", "idle"],
  // Directional aim is an opt-in continuous base under the layered ranged
  // one-shots. A partially authored asset remains readable on its ordinary
  // gait rather than holding a pose or borrowing another aim direction.
  aimWalkForward: ["aimWalkForward", "walk", "run", "idle"],
  aimWalkBack: ["aimWalkBack", "walkBack", "walk", "run", "idle"],
  aimWalkLeft: ["aimWalkLeft", "walk", "run", "idle"],
  aimWalkRight: ["aimWalkRight", "walk", "run", "idle"],
  // Work is continuous and looped like locomotion, so it *does* reach its own
  // clip. An asset that authors none simply stands there, which is what the
  // capsule-era worker did and is never wrong — only less expressive.
  work: ["work", "idle"],
  // A job-specific loop is opt-in. An asset that does not author the category
  // simply uses its neutral work pose, so gameplay never depends on clip
  // coverage and a partial sidecar remains readable.
  workCultivation: ["workCultivation", "work", "idle"],
  workHarvest: ["workHarvest", "work", "idle"],
  workLivestock: ["workLivestock", "work", "idle"],
  workHunting: ["workHunting", "work", "idle"],
  workChopping: ["workChopping", "work", "idle"],
  // Prop-dependent roles fall back before the prop can ever disappear: an
  // incomplete sidecar keeps ordinary locomotion while the Actor's cargo mesh
  // remains governed by the same carrying snapshot.
  carryIdle: ["carryIdle", "idle"],
  carryWalk: ["carryWalk", "walk", "run", "idle"],
  // The upper-body carry layer, and the one role with no locomotion in its
  // chain: it is blended *over* the gait rather than instead of it, so falling
  // back to a walk clip would put a second pair of striding legs on the torso.
  // An asset that authors neither pose leaves the torso on the legs' clip, which
  // is what every carrier looked like before layering existed.
  carryPose: ["carryPose", "carryIdle"],
  // Continuous and looped like work, and it reaches its own clip for the same
  // reason: the unit holds this pose for as long as the mending takes. An asset
  // that authors none simply waits standing up, which is exactly what every unit
  // did before this role existed.
  rest: ["rest", "idle"],
  // Continuous for the same reason again: the order stands until the player
  // revokes it, so the pose is held rather than played. An asset that authors no
  // ready stance waits in its ordinary idle, which is exactly what every unit
  // did before this role existed — the order still works, it just does not show.
  hold: ["hold", "idle"],
  // The stance a unit waits in *between* blows while an enemy is still there.
  // Straight to `idle` when unauthored rather than by way of `hold`: a hold
  // clip is the *order* to stand ground (the Guard's block idle), and borrowing
  // it here would show that order on a unit nobody gave it to — and make the
  // real order invisible by showing it all the time. Asset opt-in, so every unit
  // that authors no stance keeps exactly the idle it always had.
  combatIdle: ["combatIdle", "idle"],
  // `attack`, `hit` and `death` deliberately do *not* reach their own clips
  // here. This chain feeds the continuous, looping channel, and those three
  // clips are one-shots played per event by {@link advanceRtsAction} — looping a
  // sword swing between blows would show a unit attacking on a cadence its
  // cooldown never had, and a looping flinch would show one permanently being
  // beaten. What the continuous channel wants for an engaged, struck or fallen
  // unit is the standing pose underneath the action — and for the first two that
  // pose is the combat stance, not the folded arms a unit waits out a peaceful
  // afternoon in. Same opt-in as `combatIdle` above, and it matters most here:
  // every ranged unit in the project passes through this chain between shots.
  attack: ["combatIdle", "idle"],
  attackHunting: ["idle"],
  attackMelee: ["combatIdle", "idle"],
  hit: ["idle"],
  death: ["idle"],
};

/**
 * Walks the role's fallback chain and returns the first role whose authored clip
 * the asset actually carries, or null when none does.
 *
 * Null means "hold the current pose", not "stop": the caller keeps playing
 * whatever it was playing. Picking an arbitrary available clip instead would be
 * worse than useless — it is exactly how a unit ends up permanently frozen in
 * `A_TPose`, which is a real clip in rigs like the UAL1 pack this was built
 * against.
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
  const reference = role === "run" || role === "runBack"
    ? tuning.runClipSpeed
    : role === "walk" || role === "walkBack"
        || role === "carryWalk"
        || role === "aimWalkForward" || role === "aimWalkBack"
        || role === "aimWalkLeft" || role === "aimWalkRight"
      ? tuning.walkClipSpeed
      : 0;
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
  variants?: RtsAnimationVariants,
  variantSeed = 0,
  directionalAimActive = false,
): RtsAnimationSelection | null {
  const baseRequested = classifyRtsAnimation(input, tuning, directionalAimActive);
  const requested = baseRequested === "work" ? rtsWorkRoleForActivity(input.workerActivity) : baseRequested;
  const resolved = resolveRtsAnimationRole(requested, animationSet, available);
  if (!resolved) return null;
  const clip = resolveRtsAnimationVariant(resolved.role, animationSet, variants, available, variantSeed);
  if (!clip) return null;
  return {
    requested,
    role: resolved.role,
    clip,
    playbackRate: rtsPlaybackRate(resolved.role, input.planarSpeed, tuning),
  };
}

/**
 * Maps an already-authoritative Worker assignment category onto the optional
 * sidecar role that can present it. This never infers activity from the map,
 * building id or resource: unrecognised and intentionally neutral activities
 * stay on `work`.
 */
export function rtsWorkRoleForActivity(
  activity: import("./unit").WorkerActivity | null | undefined,
): Extract<RtsAnimationRole, `work${string}`> {
  if (activity === "cultivation") return "workCultivation";
  if (activity === "harvest") return "workHarvest";
  if (activity === "livestock") return "workLivestock";
  if (activity === "hunting") return "workHunting";
  if (activity === "lumber") return "workChopping";
  return "work";
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
  readonly kind: "none" | "attack" | "attackHunting" | "attackMelee" | "attackRecovery" | "hit" | "death";
  /** Seconds left of the running clip. Reaches 0 on the frame it finishes. */
  readonly remainingSeconds: number;
  /** The blow count this state was last reconciled against; see {@link advanceRtsAction}. */
  readonly attackCount: number;
  /** The same, for blows taken rather than landed. */
  readonly impactCount: number;
  /** Same event counter for the independent close weapon. */
  readonly meleeCount?: number;
  /** Same event counter for the Worker's one-shot wildlife strike. */
  readonly huntStrikeCount?: number;
  /**
   * True when this one-shot owns only the upper body, leaving the legs on
   * locomotion — a walking unit can react or fire without stopping its stride.
   *
   * A layered action never demotes while it is running. Moving ranged attacks
   * and flinches may promote from full-body to upper-body when a move order takes
   * effect mid-action; after that promotion the choice stays latched (through
   * recovery, for a shot). This one-way rule prevents both foot skating and a
   * torso/full-body pop when the unit later slows down again.
   */
  readonly layered: boolean;
  /**
   * Seconds left before this unit may flinch again; see
   * {@link RTS_FLINCH_REFRACTORY_SECONDS}. Counts down on every frame regardless
   * of which action owns the body, so the gap is measured from one flinch to the
   * next rather than from whatever happened to follow it.
   */
  readonly flinchHoldSeconds?: number;
}

/**
 * Shortest gap between two flinches on the same unit.
 *
 * A flinch outranks every swing (rule 2 below) *and* drops the events that land
 * under it, so a unit hit faster than it can react spends the whole fight
 * flinching and never appears to answer. Measured on a Worker beaten by a Guard:
 * three punches actually landed and only one of them ever reached the screen.
 *
 * This does not change the priority — a blow taken still interrupts a swing —
 * it only caps how *often* a body may be interrupted, which is what leaves the
 * gaps its own blows can be seen in. Presentation-only either way: nothing here
 * moves a hit, and the counters keep advancing while a flinch is withheld, so a
 * suppressed reaction is dropped rather than queued.
 *
 * An authored look, not a contract: it has to sit above the fastest weapon
 * cadence in the match to open any gap at all, and beyond that it is tuned by
 * eye. Tests assert the relationship (a beaten unit gets its own blow on screen),
 * never this magnitude.
 */
export const RTS_FLINCH_REFRACTORY_SECONDS = 1.8;

/** A unit that has neither swung, flinched nor fallen. */
export const RTS_ACTION_NONE: RtsActionState = {
  kind: "none",
  remainingSeconds: 0,
  attackCount: 0,
  impactCount: 0,
  meleeCount: 0,
  huntStrikeCount: 0,
  layered: false,
  flinchHoldSeconds: 0,
};

/**
 * Authored lengths of the one-shot clips, in seconds. Null means the asset
 * ships no clip for that role, and the action never starts — which is how the
 * capsule fallback and any half-authored asset keep working.
 */
export interface RtsActionDurations {
  readonly attack: number | null;
  readonly attackHunting?: number | null;
  readonly attackMelee?: number | null;
  /** Optional visual tail of an attack; a new real attack may interrupt it. */
  readonly attackRecovery?: number | null;
  readonly hit: number | null;
  readonly death: number | null;
}

/**
 * Whether — and when — a one-shot may be demoted to an upper-body-only clip.
 *
 * Two conditions, and both are needed. The asset must be able to split its
 * skeleton at all (an authored `upperBodyBone` that matched real bones), and the
 * legs must have something worth protecting: a unit standing still has no stride
 * to interrupt, and taking the blow through the whole body there keeps the hip
 * recoil the impact clips were animated with. Above walking speed the trade
 * reverses — the full-body clip pins the legs mid-stride while the simulation
 * keeps sliding the unit forward, which is foot-skate with no upside.
 */
export interface RtsActionLayering {
  /** True when the asset can play a clip on the upper body alone. */
  readonly canLayerHit: boolean;
  /** True when a moving unit may keep its gait below a ranged attack/recovery. */
  readonly canLayerAttack?: boolean;
  /** The unit's own walking boundary, from {@link RtsLocomotionTuning}. */
  readonly walkSpeed: number;
}

/** Never layer: the behaviour of every caller that predates upper-body flinches. */
const NO_LAYERING: RtsActionLayering = { canLayerHit: false, canLayerAttack: false, walkSpeed: Infinity };

/**
 * Advances the one-shot channel by one frame.
 *
 * Four rules, in strict priority order — the plan's
 * `death > new impact > new attack > locomotion`:
 *  1. **Death latches.** Once it starts it is never interrupted, never
 *     restarted, and never returns to locomotion — a unit only dies once, and
 *     it must still be lying there when the death system despawns it.
 *  2. **A blow taken restarts the flinch**, outranking a swing either way
 *     round: it interrupts one that is running, and one landed while a flinch
 *     is running does not interrupt it. A unit being beaten reads as being
 *     beaten, not as trading blows through it — but only
 *     {@link RTS_FLINCH_REFRACTORY_SECONDS} apart, or a unit under a fast weapon
 *     never gets a frame to be seen answering in.
 *  3. **A new blow landed restarts the swing.** Any change in `attackCount`
 *     begins the attack clip from the top, even mid-swing.
 *  4. **An authored attack recovery follows the swing** when present, but a new
 *     real blow cuts that cosmetic tail immediately.
 *  5. **Otherwise the running action runs down**, and locomotion resumes on the
 *     frame it expires.
 *
 * The returned state always carries the input's counters, so events that
 * happened while an action owned the body are *dropped* rather than queued —
 * three blows in half a second are one flinch from the last of them, not three
 * played back long after the fight moved on.
 *
 * A moving ranged attack and a flinch may be demoted to the upper body
 * ({@link RtsActionLayering}). Melee swings remain full-body, while a fall is
 * full-body by definition.
 */
export function advanceRtsAction(
  state: RtsActionState,
  input: RtsAnimationInput,
  durations: RtsActionDurations,
  deltaSeconds: number,
  layering: RtsActionLayering = NO_LAYERING,
): RtsActionState {
  const dt = Math.max(0, deltaSeconds);
  const counters = {
    attackCount: input.attackCount,
    impactCount: input.impactCount,
    meleeCount: input.meleeCount ?? 0,
    huntStrikeCount: input.huntStrikeCount ?? 0,
    layered: false,
    // Spread into every return below, so the gap keeps closing while a swing,
    // a montage or plain locomotion owns the body.
    flinchHoldSeconds: Math.max(0, (state.flinchHoldSeconds ?? 0) - dt),
  };
  if (input.dying) {
    if (state.kind === "death") {
      return { ...state, ...counters, remainingSeconds: Math.max(0, state.remainingSeconds - dt) };
    }
    if (durations.death === null) {
      // No authored death clip: the unit's own collapse pose owns its defeat.
      return { kind: "none", remainingSeconds: 0, ...counters };
    }
    return { kind: "death", remainingSeconds: durations.death, ...counters };
  }
  if (input.impactCount !== state.impactCount && durations.hit !== null && counters.flinchHoldSeconds <= 0) {
    const layered = layering.canLayerHit && input.planarSpeed > layering.walkSpeed;
    return {
      kind: "hit",
      remainingSeconds: durations.hit,
      ...counters,
      layered,
      flinchHoldSeconds: RTS_FLINCH_REFRACTORY_SECONDS,
    };
  }
  if (state.kind === "hit") {
    const remaining = state.remainingSeconds - dt;
    // One-way, exactly like the ranged swing below. The frame the flinch started
    // owns the choice, so a unit shoved to a halt mid-reaction keeps the torso
    // clip it began — but a *move order* arriving mid-flinch promotes it, because
    // from that frame on the simulation is sliding the body forward while the
    // full-body impact clip pins the feet. That is the foot-skate a struck Archer
    // walked away with: hit standing, ordered to march, legs frozen mid-recoil
    // for the rest of the flinch.
    const layered = state.layered
      || (layering.canLayerHit && input.planarSpeed > layering.walkSpeed);
    if (remaining > 0) return { kind: "hit", remainingSeconds: remaining, ...counters, layered };
  }
  if ((input.huntStrikeCount ?? 0) !== (state.huntStrikeCount ?? 0)
    && durations.attackHunting !== null && durations.attackHunting !== undefined) {
    return { kind: "attackHunting", remainingSeconds: durations.attackHunting, ...counters };
  }
  if (state.kind === "attackHunting") {
    const remaining = state.remainingSeconds - dt;
    if (remaining > 0) return { kind: "attackHunting", remainingSeconds: remaining, ...counters };
  }
  if ((input.meleeCount ?? 0) !== (state.meleeCount ?? 0) && durations.attackMelee !== null && durations.attackMelee !== undefined) {
    return { kind: "attackMelee", remainingSeconds: durations.attackMelee, ...counters };
  }
  if (state.kind === "attackMelee") {
    const remaining = state.remainingSeconds - dt;
    if (remaining > 0) return { kind: "attackMelee", remainingSeconds: remaining, ...counters };
  }
  if (input.attackCount !== state.attackCount && durations.attack !== null) {
    const layered = layering.canLayerAttack === true && input.planarSpeed > layering.walkSpeed;
    return { kind: "attack", remainingSeconds: durations.attack, ...counters, layered };
  }
  if (state.kind === "attack") {
    const remaining = state.remainingSeconds - dt;
    const layered = state.layered
      || (layering.canLayerAttack === true && input.planarSpeed > layering.walkSpeed);
    if (remaining > 0) return { kind: "attack", remainingSeconds: remaining, ...counters, layered };
    if (durations.attackRecovery !== null && durations.attackRecovery !== undefined) {
      return { kind: "attackRecovery", remainingSeconds: durations.attackRecovery, ...counters, layered };
    }
  }
  if (state.kind === "attackRecovery") {
    const remaining = state.remainingSeconds - dt;
    const layered = state.layered
      || (layering.canLayerAttack === true && input.planarSpeed > layering.walkSpeed);
    if (remaining > 0) return { kind: "attackRecovery", remainingSeconds: remaining, ...counters, layered };
  }
  return { kind: "none", remainingSeconds: 0, ...counters };
}

/**
 * Which *occurrence* of its kind a one-shot state is: the running counter of the
 * event that started it, and 0 for the kinds that happen once or not at all.
 *
 * Two callers need exactly this number and must agree on it. It picks the
 * variant clip, so the same unit varies its swings across a fight and its
 * flinches across a beating while both stay reproducible — blow number seven
 * looks the same on every replay. And it identifies the occurrence for the
 * driver's "is this a new one-shot" test, which is why it may not simply be
 * "either counter changed": a state carries both, so a blow landed *during* a
 * flinch moves `attackCount` without starting anything, and restarting the clip
 * on that would freeze a beaten unit on its first flinch frame.
 */
export function rtsActionSequence(state: RtsActionState): number {
  if (state.kind === "attack" || state.kind === "attackRecovery") return state.attackCount;
  if (state.kind === "attackHunting") return state.huntStrikeCount ?? 0;
  if (state.kind === "attackMelee") return state.meleeCount ?? 0;
  if (state.kind === "hit") return state.impactCount;
  return 0;
}

/**
 * The clip a running one-shot should be playing, or null when the continuous
 * locomotion channel owns the pose this frame.
 */
export function rtsActionClip(
  state: RtsActionState,
  animationSet: RtsAnimationSet,
  available: ReadonlySet<string>,
  variants?: RtsAnimationVariants,
  variantSeed = 0,
): string | null {
  if (state.kind === "none") return null;
  const role = state.kind === "attackRecovery" ? "attackRecovery" : state.kind;
  return resolveRtsAnimationVariant(
    role,
    animationSet,
    variants,
    available,
    variantSeed,
    rtsActionSequence(state),
  );
}

/* ------------------------------------------------------------------------- *
 * The work montage
 *
 * A job is neither a loop nor a one-shot. Looping the whole `work` clip made a
 * builder kneel, work, stand up and kneel again for as long as the site took —
 * the bob of an animation repeating where the fiction has one continuous action.
 * What the pose actually wants is Unreal's montage shape: kneel once on arrival
 * (`enter`), hold the working part for however long the site takes (`loop`), and
 * stand up once when the finish notification lands (`exit`).
 *
 * The sections are authored data (`AssetSkeletonMontageDef.sections`), because
 * only the asset knows where in its clip the kneel ends. An asset that authors
 * none keeps the old looping behaviour, which is still the right fallback for a
 * clip that is nothing but the working part.
 * ------------------------------------------------------------------------- */

/** Which part of the work montage is playing. */
export type RtsWorkPhase = "none" | "enter" | "loop" | "exit";

/** One authored section of the montage clip, in seconds from the clip start. */
export interface RtsMontageSection {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

/**
 * The three sections the work montage is built from. Only `loop` is required:
 * an asset may kneel with no wind-up or stand with no wind-down, and each
 * missing section simply means that transition is instant.
 */
export interface RtsWorkMontage {
  readonly clip: string;
  readonly enter: RtsMontageSection | null;
  readonly loop: RtsMontageSection;
  readonly exit: RtsMontageSection | null;
}

/** Structural view of the sidecar's montage list; `AssetSkeletonDef` satisfies it. */
export interface RtsMontageSource {
  readonly name: string;
  readonly clip: string;
  readonly sections: readonly {
    readonly name: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly loop: boolean;
  }[];
}

/** Montage name an asset uses to declare its in-place job animation. */
export const RTS_WORK_MONTAGE_NAME = "work";

/**
 * Reads the `work` montage out of an asset's sidecar, or null when it authors
 * none, names a clip the model does not carry, or omits the held section — in
 * every one of those cases the caller falls back to the looping `work` role,
 * which is exactly the behaviour the asset had before montages existed.
 *
 * `loop` is taken from the section flagged `loop: true` rather than from its
 * name, so the phase machine and the animator agree on which part is held; the
 * wind-up/wind-down are matched by name because there is nothing else to
 * distinguish them by.
 */
export function resolveRtsWorkMontage(
  montages: readonly RtsMontageSource[],
  available: ReadonlySet<string>,
): RtsWorkMontage | null {
  const montage = montages.find((entry) => entry.name === RTS_WORK_MONTAGE_NAME);
  if (!montage || !available.has(montage.clip)) return null;
  const held = montage.sections.find((section) => section.loop);
  if (!held) return null;
  const named = (name: string): RtsMontageSection | null => {
    const section = montage.sections.find((entry) => entry.name === name && !entry.loop);
    return section ? { startSeconds: section.startSeconds, endSeconds: section.endSeconds } : null;
  };
  return {
    clip: montage.clip,
    enter: named("enter"),
    loop: { startSeconds: held.startSeconds, endSeconds: held.endSeconds },
    exit: named("exit"),
  };
}

/** Where the montage is, and how much of a timed section is left. */
export interface RtsWorkMontageState {
  readonly phase: RtsWorkPhase;
  /** Seconds left of `enter`/`exit`. Always 0 for `none` and the held `loop`. */
  readonly remainingSeconds: number;
}

/** A unit that is not at a job. */
export const RTS_WORK_MONTAGE_NONE: RtsWorkMontageState = { phase: "none", remainingSeconds: 0 };

/** Length of a section, in seconds. */
function sectionSeconds(section: RtsMontageSection | null): number {
  return section ? Math.max(0, section.endSeconds - section.startSeconds) : 0;
}

/**
 * Advances the work montage by one frame.
 *
 * Rules, in order:
 *  1. **Dying, fighting or moving cancels it outright** — with no wind-down.
 *     A builder that is shot, attacked or ordered away is not going to finish
 *     standing up politely first, and those channels own the whole body.
 *  2. **Work starts the wind-up**, then falls through to the held section,
 *     which stays there for as many frames as the site takes.
 *  3. **Work ending starts the wind-down**, which runs to its end and releases
 *     the body back to locomotion. This is the "construction finished" edge:
 *     nothing schedules it, it is simply `working` going false.
 *
 * A site that resumes mid-stand rewinds to the wind-up, because the body is
 * halfway to its feet and the kneel is what gets it back down.
 */
export function advanceRtsWorkMontage(
  state: RtsWorkMontageState,
  input: RtsAnimationInput,
  montage: RtsWorkMontage | null,
  tuning: RtsLocomotionTuning,
  deltaSeconds: number,
): RtsWorkMontageState {
  if (!montage) return RTS_WORK_MONTAGE_NONE;
  const interrupted = input.dying || input.attacking || input.planarSpeed > tuning.walkSpeed;
  if (interrupted) return RTS_WORK_MONTAGE_NONE;
  const dt = Math.max(0, deltaSeconds);

  if (input.working) {
    if (state.phase === "loop") return state;
    if (state.phase === "enter") {
      const remaining = state.remainingSeconds - dt;
      if (remaining > 0) return { phase: "enter", remainingSeconds: remaining };
      return { phase: "loop", remainingSeconds: 0 };
    }
    const enterSeconds = sectionSeconds(montage.enter);
    if (enterSeconds <= 0) return { phase: "loop", remainingSeconds: 0 };
    return { phase: "enter", remainingSeconds: enterSeconds };
  }

  if (state.phase === "exit") {
    const remaining = state.remainingSeconds - dt;
    return remaining > 0 ? { phase: "exit", remainingSeconds: remaining } : RTS_WORK_MONTAGE_NONE;
  }
  if (state.phase === "none") return RTS_WORK_MONTAGE_NONE;
  const exitSeconds = sectionSeconds(montage.exit);
  if (exitSeconds <= 0) return RTS_WORK_MONTAGE_NONE;
  return { phase: "exit", remainingSeconds: exitSeconds };
}

/** The section a phase should be playing, or null when locomotion owns the pose. */
export function rtsWorkMontageSection(
  state: RtsWorkMontageState,
  montage: RtsWorkMontage | null,
): { readonly section: RtsMontageSection; readonly loop: boolean } | null {
  if (!montage) return null;
  switch (state.phase) {
    case "enter":
      return montage.enter ? { section: montage.enter, loop: false } : null;
    case "loop":
      return { section: montage.loop, loop: true };
    case "exit":
      return montage.exit ? { section: montage.exit, loop: false } : null;
    default:
      return null;
  }
}

/**
 * RTS unit entity — Vertical Slice Plan v0.2 §21 ("Test birimi") / §45.
 *
 * A single controllable actor. It owns its render object (a body + a flat
 * selection ring + a health bar) and the small gameplay state the systems need:
 * ownership, selection, stance, and an explicit attack target. Movement, combat
 * resolution and death cleanup are layered on by their own systems — this stays
 * a thin data+render holder, not a mega-object (plan §14).
 *
 * Faz 7 made the silhouette, speed, armour class and counters data-owned: a
 * Guard, an Archer and a Topçu are the same class with different `stats`.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Quaternion,
} from "three";
import type { Object3D } from "three";
import type { UnitBalanceStats, UnitRoleId } from "../../data/gameDataTypes";
import { combatDistance, type CombatTarget } from "../combat/combatTarget";
// Shortest-path yaw stepping, shared with the TPS character and with wildlife
// rather than reimplemented: one turn helper, three callers.
import { rotateYawToward, shortestYawDeltaDeg } from "../../playerMovement";
// Body tint and the ground ring read from one source, so a unit can never wear
// one team's colour on its body and another's underneath it.
import { TEAM_COLOR, createTeamRing } from "../team/teamColors";
import { createSelectionRing } from "../selection/selectionRing";
import { AttackComponent } from "./attackComponent";
import { HealthComponent } from "./health";
import { HealthBar } from "./healthBar";
import { SIEGE_CREW_PUSH_START_DELAY_SECONDS } from "./siegeCrewAnimation";

/** Which army a unit belongs to. Ürün A is one player vs. one AI (plan §4.2). */
export type UnitOwner = "player" | "enemy";
/** Ürün B roles; workers use the same movement shell but do not enter combat. */
export type UnitRole = UnitRoleId;

/**
 * How a unit treats enemies it was not explicitly ordered onto (GDD 06 §26).
 * `aggressive` acquires and chases within its data leash; `hold` fires from
 * where it stands and never steps off its position.
 */
export type UnitStance = "aggressive" | "hold";

/** Presentation-only Worker assignment category, authored by the owning job system. */
export type WorkerActivity =
  | "generic"
  | "construction"
  | "repair"
  | "cultivation"
  | "harvest"
  | "livestock"
  | "hunting"
  | "mining"
  | "lumber"
  | "carryingBox"
  | "carryingLoad"
  | "wheelbarrow";

/**
 * Per-frame simulation summary handed to an animated presentation.
 *
 * Deliberately tiny and derived: the presentation may read what the unit is
 * doing but owns none of it, so nothing here is state the unit keeps only for
 * rendering. `deltaSeconds` is the rendered-frame delta, not the simulation's —
 * a walk cycle should look the same at any game speed, exactly like the health
 * bars and tracers it plays alongside.
 */
export interface RtsPresentationUpdate {
  readonly deltaSeconds: number;
  /** Observed ground speed (units/s), measured from actual displacement. */
  readonly planarSpeed: number;
  /** Measured velocity along the body's local right axis (+right, -left). */
  readonly localVelocityX?: number;
  /** Measured velocity along the body's local forward axis (+forward, -back). */
  readonly localVelocityZ?: number;
  /**
   * Measured signed yaw rate of the body, degrees/s, positive turning left.
   *
   * The twin of {@link localVelocityX}: measured from actual rotation rather than
   * read off the turn rate or the heading it is aiming at, so a gun that has
   * finished lining up reports zero even though its order still names a target.
   * Only a presentation that has something to do with turning in place reads it
   * — today, the artillery crew that swings the carriage round.
   */
  readonly yawRateDegPerSecond?: number;
  /**
   * The unit's authored `turnRateDegPerSecond`, so a presentation can scale a
   * threshold against it rather than against a constant that would be wrong for
   * every unit but one. Omitted by callers that model no turn rate.
   */
  readonly turnRateDegPerSecond?: number | undefined;
  /**
   * Melee blows this unit has thrown outside its main weapon; each increment is
   * one to play. Today only the artillery's kick writes it (siege crew plan
   * Faz 3), and it is a separate counter from {@link attackCount} because the two
   * come off different cooldowns and must not cancel each other's animation.
   */
  readonly meleeCount?: number;
  /** One-shot wildlife strikes; kept separate from player-combat attacks. */
  readonly huntStrikeCount?: number;
  /**
   * Enemy structures this unit has brought down; each increment is one cheer to
   * play (siege crew plan Faz 5). Written where the killing blow is already
   * resolved, so the animation is told what happened and is told it late.
   */
  readonly triumphCount?: number;
  /** Keep a deliberately unhurried mover on its walk clip at any travel speed. */
  readonly forceWalk?: boolean;
  /** True while the unit is travelling without turning its body toward the route. */
  readonly backward?: boolean;
  /** True while a siege carriage is letting its crew lean into the trail before rolling. */
  readonly preparingToMove?: boolean;
  /** True while a live target is inside weapon range — i.e. blows are landing. */
  readonly attacking: boolean;
  /**
   * True while a live enemy is inside this unit's close-quarters reach.
   *
   * Distinct from {@link attacking}, which asks whether the *weapon* is firing.
   * A Worker with a Guard against it is inside its own stone minimum: nothing is
   * being thrown, and yet it is very much in a fight. An asset that authors a
   * `combatIdle` clip waits in that stance instead of its ordinary idle.
   *
   * Omitted by callers that model no close weapon, which keeps their idle.
   */
  readonly engagedClose?: boolean;
  /** True while a Worker is bringing down wildlife at a hunting camp. */
  readonly hunting?: boolean;
  /** True once the defeat pose has begun. */
  readonly dying: boolean;
  /** True while the unit is standing at an in-place job — a builder on its site (Faz F). */
  readonly working: boolean;
  /** Job-system-authored Worker category; null means no job assignment. */
  readonly workerActivity?: WorkerActivity | null;
  /**
   * True while a support field is restoring this body's hit points (Guard plan
   * Faz 4). An asset that authors a `rest` clip waits in that pose instead of
   * its idle for as long as it is being mended.
   *
   * Omitted by callers that model no such field, which keeps their ordinary idle.
   */
  readonly resting?: boolean;
  /**
   * True while this unit is standing on a hold order (`H`). An asset that
   * authors a `hold` clip waits in that ready stance instead of its idle, which
   * is what makes the order visible on the body rather than only in what the
   * unit declines to chase.
   *
   * Omitted by callers with no notion of stance, which keeps their ordinary idle.
   */
  readonly holding?: boolean;
  /** Blows landed so far; each increment is one swing to play (Faz D). */
  readonly attackCount: number;
  /**
   * Blows *taken* so far; each increment is one flinch to play (Guard plan Faz 2).
   *
   * Comes straight off the health component, which is where every damage source
   * in the match already meets, so a delayed shell, a tower, a wolf and a sword
   * all reach the presentation as the same event.
   */
  readonly impactCount: number;
  /**
   * Whether this presentation is carrying a load right now.
   *
   * Only Actors that author `rtsCargoVisibility` react — for everything else the
   * field is inert. Omitted means "this caller does not model cargo", which
   * leaves any authored cargo node exactly as the Actor authored it rather than
   * silently hiding it.
   */
  readonly carrying?: boolean | undefined;
  /**
   * Squared distance from the camera, or null when the caller does not know it.
   *
   * Presentations may spend less time on units the player can barely see. Null
   * disables that entirely — every frame is a near frame — which is what keeps a
   * caller that has no camera (an engine test, a headless harness) on the exact
   * animation behaviour it had before the throttle existed.
   */
  readonly cameraDistanceSquared: number | null;
}

/** Presentation-only Actor/legacy render handle. It owns no simulation data. */
export interface RtsPresentationHandle {
  readonly root: Object3D;
  readonly pickTargets: readonly Object3D[];
  readonly selectionRadius: number;
  readonly update?: (state: RtsPresentationUpdate) => void;
  /**
   * How long this presentation's authored death animation runs, in seconds.
   *
   * Undefined means it has none, and the unit's own collapse pose plays for
   * {@link UNIT_DEATH_SECONDS} instead. When it is defined it *replaces* that
   * constant, because the defeat window exists to let the death read on screen
   * and a fixed 0.35s would cut nearly every authored death clip off mid-fall.
   * This is the presentation reporting a fact about its asset, not asking for
   * gameplay time: nothing else about the unit's removal changes.
   */
  readonly deathSeconds?: number | undefined;
  /**
   * The node this unit's weapon fires from, when its Actor marks one.
   *
   * Presentation reporting a fact about its art, exactly as {@link deathSeconds}
   * is: the simulation still decides *that* a shot happens and what it hits, and
   * only the point the shell is drawn leaving from comes from here. Null or
   * absent leaves the shot spawning from the unit's own position at the
   * projectile system's default launch height, which is what every weapon did
   * before any Actor marked a muzzle.
   */
  readonly muzzle?: Object3D | null | undefined;
  dispose(): void;
}

/** Gameplay footprint used by selection, commands and formation spacing. */
export const UNIT_RADIUS = 0.5;
/** How long the code tip-over takes to lay an unanimated unit down. */
export const UNIT_DEATH_SECONDS = 0.35;
/**
 * How long a fallen body stays on the field before it is removed.
 *
 * A floor under the defeat window rather than the window itself: the fall has to
 * finish first, so a unit is held for its own clip *or* this, whichever is
 * longer. Splitting it this way is what lets the two be tuned against different
 * things — the clip length is a fact about the asset, and this is a readability
 * choice about how long a player gets to see what died where.
 */
export const UNIT_CORPSE_SECONDS = 30;
/** A worker rests at a player-chosen point before automatic work may reclaim it. */
export const WORKER_RETURN_DELAY_SECONDS = 3;

/**
 * Per-role silhouette. GDD 06 §3.4 asks that a role be readable before its UI
 * is: the Archer is slighter than the Guard, and the Topçu is unmistakably a
 * wheeled gun rather than a person.
 */
const ROLE_BODY: Record<UnitRoleId, {
  readonly radius: number;
  readonly length: number;
  readonly box?: boolean;
  /** Built as a wheeled gun — a carriage with a barrel — instead of one body. */
  readonly gun?: boolean;
}> = {
  guard: { radius: UNIT_RADIUS, length: 1.0 },
  archer: { radius: UNIT_RADIUS * 0.78, length: 1.15 },
  siege: { radius: UNIT_RADIUS * 1.5, length: 0.9, box: true, gun: true },
  worker: { radius: UNIT_RADIUS * 0.85, length: 0.8 },
};

/**
 * The rough solid a unit occupies, derived from {@link ROLE_BODY}.
 *
 * Two things read it: the fallback body and health bar place themselves off
 * `centerY`, and the fake shadow proxy (`unitShadowProxies.ts`) casts from this
 * volume rather than from the unit's real mesh. Exported because the second
 * caller is a different module, and because `centerY` was previously spelled out
 * at both of the in-file call sites — a silhouette tweak had to be made twice or
 * the health bar drifted off the head.
 */
export interface UnitBodyVolume {
  /** Half-width of the body at its widest. */
  readonly radius: number;
  /** Length of the straight section between the caps. */
  readonly length: number;
  /** Height of the body's centre above the unit's feet. */
  readonly centerY: number;
}

export function unitBodyVolume(role: UnitRoleId): UnitBodyVolume {
  const shape = ROLE_BODY[role];
  return {
    radius: shape.radius,
    length: shape.length,
    // A box body's length already spans it end to end; a capsule's does not —
    // its two hemispherical caps add a radius at each end.
    centerY: shape.box ? shape.length / 2 : shape.length / 2 + shape.radius,
  };
}

/** Dark iron for a gun barrel; the carriage stays in team colour. */
const GUN_BARREL_COLOR = "#2f3438";
const GUN_WHEEL_COLOR = "#6b4a2c";
/**
 * How far the muzzle is raised above level, in radians. A gun that lobs its
 * shot has to look like one while it stands still, which is the state the
 * player mostly sees a siege line in.
 */
const GUN_ELEVATION = 0.34;

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Facing error, in degrees, beyond which a unit that turns at a rate comes to a
 * stop and turns on the spot before travelling again.
 *
 * This is what separates a vehicle from a body: a soldier drifts onto a new
 * heading while walking, but a gun carriage sent back the way it came must not
 * describe a long curve across the field — it stops, comes about, and only then
 * rolls. Small corrections stay under the threshold on purpose, or the gun would
 * stutter to a halt every time a crowd nudged its heading by a degree.
 *
 * Inert for anything with no authored `turnRateDegPerSecond`: those units snap,
 * so their error is zero the instant they are asked to turn and they never stop.
 */
export const UNIT_PIVOT_THRESHOLD_DEG = 30;

let nextUnitId = 1;

export class Unit {
  readonly id: number;
  readonly owner: UnitOwner;
  readonly object: Group;
  /**
   * Which `balance/units.json` definition this unit is, mirrored off
   * {@link stats} exactly as {@link role} and {@link speed} are.
   *
   * The role is the *kind of job* a unit does and there are four of them; the
   * type id is the unit itself, and there is no ceiling on how many a project
   * adds. Two Guard units share `role: "guard"` and differ only here, so every
   * "how many of these do I have" and "select all of these" answer keys on this.
   */
  readonly typeId: string;
  readonly role: UnitRoleId;
  /** Ground speed in world units/s, from `balance/units.json`. */
  readonly speed: number;
  /**
   * Ground footprint radius, used both to plan on a grid the body actually fits
   * and to keep the crowd from standing inside itself. It follows the silhouette:
   * the Topçu is genuinely wider than the Archer, so it navigates as a wider agent.
   */
  readonly navRadius: number;
  /** {@link CombatTarget}: which §33 column attackers resolve against. */
  readonly armorClass: UnitBalanceStats["armorClass"];
  /** Bounded health state; death/removal is handled by the death system. */
  readonly health: HealthComponent;
  /** JSON-backed damage, range, counters and cooldown state. */
  readonly attack: AttackComponent;
  /**
   * {@link CombatTarget}: fraction of incoming damage currently absorbed.
   *
   * Not a unit stat and never authored on one — it is rewritten from zero every
   * tick by {@link SupportAuraSystem} from the support fields the unit is
   * standing in. Held on the unit rather than looked up at the moment of the hit
   * because a hit is resolved from a {@link CombatTarget}, which knows nothing
   * about buildings; this is the target-side answer that contract can read.
   */
  damageResistance = 0;
  /**
   * Whether a support field restored hit points to this body on the last tick.
   *
   * Written by the same pass and under the same rewritten-from-zero rule as
   * {@link damageResistance}. Presentation-only: nothing in combat, movement or
   * AI reads it, so removing every animation would leave the match identical.
   */
  mending = false;
  /** Active move destination (y = 0), or null when idle/arrived. */
  moveTarget: Vector3 | null = null;
  /** Enemy this unit is currently fighting, or null. */
  attackTarget: CombatTarget | null = null;
  stance: UnitStance = "aggressive";
  /**
   * Ground destination of an attack-move (GDD 06 §25). The unit walks here but
   * stops to engage anything it acquires on the way; cleared on arrival or Stop.
   */
  attackMoveTarget: Vector3 | null = null;
  /**
   * True while the current `attackTarget` was chosen by auto-acquisition rather
   * than by an order. Only these chases are leashed: a player who clicks a
   * target across the map means it (GDD 06 §39).
   */
  autoAcquired = false;
  /** Where an auto-acquired chase began; the leash is measured from here. */
  private chaseOrigin: Vector3 | null = null;
  private readonly ring: Mesh;
  private readonly healthBar: HealthBar;
  private presentation: RtsPresentationHandle | null = null;
  /** Where the body stood at the last presentation frame; see `measureLocalPlanarVelocity`. */
  private readonly lastPresentationPosition = new Vector3();
  /** Which way it faced at that frame; see `measureYawRate`. Presentation-local memory. */
  private lastPresentationYaw = 0;
  /** Reused local motion sample; presentation measurement allocates nothing per frame. */
  private readonly presentationLocalVelocity = new Vector3();
  private fallbackBody: Mesh | null = null;
  private pickTargets: readonly Object3D[] = [];
  private movePath: Vector3[] = [];
  /** Small authored lead-in held before a siege carriage starts a new route. */
  private movementStartDelaySeconds = 0;
  /**
   * A ground route explicitly issued by the player. Automation and defensive
   * retaliation must leave this route alone until it ends: a right-click is a
   * direct instruction, not a suggestion that a worker may immediately replace
   * with its old job or a Guard may abandon after taking one hit.
   */
  private playerMoveOrder = false;
  /** A player-issued reverse move; gameplay stays a normal route, presentation keeps its facing. */
  private retreating = false;
  /**
   * True while a rescue escort is walking this unit out of a footprint it was
   * caught inside. It marks the one stretch of movement that must ignore crowd
   * separation: separation refuses to shove a body onto unwalkable ground, so an
   * ordinary escort would be pinned inside the blocker it is trying to leave.
   * Scoped to the moment — {@link isRescuing} reads it together with a live
   * target, and every other order-issuing method clears it.
   */
  private rescuing = false;
  /**
   * A short, automatic crowd-recovery window. Unlike {@link rescuing}, this
   * does not waive world navigation: it only asks `unitSeparation` to leave
   * this body out while overlapping movers get a chance to pass each other.
   */
  private collisionRecoverySeconds = 0;
  private workerReturnDelayAfterMove = 0;
  private workerReturnDelayRemaining = 0;
  /**
   * `I` ile seçilen boş işçiler, oyuncu bir iş kartı seçene kadar otomatik
   * görevlendirme tarafından kapılmamalı. Bu bir hareket emri değildir: işçi
   * yerinde kalır ve seçim değiştiğinde ya da `R` ile otomatiğe döndüğünde
   * bırakılır.
   */
  private manualAssignmentHeld = false;
  private selectedFlag = false;
  private targeterCount = 0;
  private deathElapsed: number | null = null;
  /** See {@link setWorking}: presentation-only, written by the job system. */
  private working = false;
  /** See {@link setHunting}: presentation-only, written by the job system. */
  private hunting = false;
  /** See {@link setWorkerActivity}: presentation-only, written by the job system. */
  private workerActivityValue: WorkerActivity | null = null;
  /** Visible job cargo only; it never participates in economy or movement. */
  private carrying = false;
  /** See {@link noteMeleeBlow}: presentation-only, written by `siegeMeleeSystem`. */
  private meleeBlows = 0;
  /** One-shot wildlife strikes, written by the hunting economy after the kill resolves. */
  private huntStrikes = 0;
  /** See {@link noteStructureDestroyed}: presentation-only, written where the wall falls. */
  private triumphs = 0;

  constructor(
    owner: UnitOwner,
    x: number,
    z: number,
    readonly stats: UnitBalanceStats,
    presentation: RtsPresentationHandle | null = null,
  ) {
    this.id = nextUnitId++;
    this.owner = owner;
    this.typeId = stats.id;
    this.role = stats.role;
    this.speed = stats.moveSpeed;
    this.armorClass = stats.armorClass;

    this.object = new Group();
    this.object.name = `rts-unit-${this.role}-${owner}-${this.id}`;
    this.object.position.set(x, 0, z);
    // Seeded at the spawn point so the first measured frame reads as standing
    // still rather than as an instant teleport from the world origin.
    this.lastPresentationPosition.set(x, 0, z);
    this.health = new HealthComponent(stats.maxHealth);
    this.attack = new AttackComponent(stats);

    const shape = ROLE_BODY[this.role];
    this.navRadius = shape.radius;
    const bodyCenterY = unitBodyVolume(this.role).centerY;
    this.installPresentation(presentation, bodyCenterY);

    // Always on: this is the answer to "whose is that", which the player needs
    // continuously, not on selection. It sits inside the selection ring's radius
    // so both can be visible at once without reading as one thick band.
    this.object.add(createTeamRing(owner, UNIT_RADIUS * 0.75));

    this.ring = createSelectionRing(UNIT_RADIUS * 1.25, {
      y: 0.03,
      name: "rts-unit-selection-ring",
    });
    this.object.add(this.ring);

    this.healthBar = new HealthBar(shape.radius * 2.4, bodyCenterY + shape.length / 2 + 0.55);
    this.object.add(this.healthBar.object);
  }

  /** The Actor Script path can replace only the presentation; stats and gameplay stay intact. */
  replacePresentation(presentation: RtsPresentationHandle | null): void {
    this.installPresentation(presentation, unitBodyVolume(this.role).centerY);
  }

  presentationPickTargets(): readonly Object3D[] {
    return this.pickTargets;
  }

  /** World position on the ground plane (y tracks 0 for gameplay purposes). */
  get position(): Vector3 {
    return this.object.position;
  }

  get selected(): boolean {
    return this.selectedFlag;
  }

  /**
   * {@link CombatTarget.stanceResistanceAt}: the shield a held unit raises
   * against a blow it has no answer to.
   *
   * Two conditions, and the second is what keeps Hold a trade rather than an
   * upgrade. The unit must be holding position, and the blow must come from
   * beyond its own weapon range — an attacker that closed into reach is already
   * being hit back (`engagementSystem` hands a held unit anything inside that
   * range), so that exchange needs no thumb on it. What Hold has no answer to is
   * the archer, the gun or the tower standing outside it, and that is what this
   * absorbs.
   *
   * A body already going down is excluded for the same reason a support field
   * skips it: it is past defending, and a corpse that shrugged off arrows on the
   * way down would stretch out a fall the player is watching end.
   */
  stanceResistanceAt(distance: number): number {
    if (this.stance !== "hold" || this.dying) return 0;
    const braced = this.stats.holdDamageResistance ?? 0;
    if (braced <= 0) return 0;
    return distance > this.attack.range ? braced : 0;
  }

  /** Whether another unit currently has an explicit attack order on this one. */
  get targeted(): boolean {
    return this.targeterCount > 0;
  }

  /** A depleted unit is no longer commandable, even during its short defeat pose. */
  get dying(): boolean {
    return this.deathElapsed !== null;
  }

  setSelected(selected: boolean): void {
    if (this.selectedFlag === selected) return;
    this.selectedFlag = selected;
    this.ring.visible = selected;
  }

  /**
   * Refresh the health bar, billboard it, and advance the animated presentation.
   *
   * `cameraPosition` is optional and purely a budget hint: with it the handle may
   * update a distant unit's mixer less often, without it every unit is treated as
   * near. Nothing the simulation reads depends on which of the two it gets.
   */
  updatePresentation(deltaSeconds: number, cameraQuaternion: Quaternion, cameraPosition?: Vector3): void {
    // beginDeath() hides the bar for the short death presentation. Do not
    // immediately revive it here with a zero-health update on the next frame.
    if (!this.health.depleted) {
      this.healthBar.set(this.health.ratio);
      this.healthBar.faceCamera(cameraQuaternion);
    }
    const localVelocity = this.measureLocalPlanarVelocity(deltaSeconds);
    this.presentation?.update?.({
      deltaSeconds,
      planarSpeed: Math.hypot(localVelocity.x, localVelocity.z),
      localVelocityX: localVelocity.x,
      localVelocityZ: localVelocity.z,
      yawRateDegPerSecond: this.measureYawRate(deltaSeconds),
      turnRateDegPerSecond: this.stats.turnRateDegPerSecond,
      backward: this.retreating,
      preparingToMove: this.isPreparingToMove,
      attacking: this.isTradingBlows() || this.hunting,
      engagedClose: this.isEngagedAtCloseQuarters(),
      hunting: this.hunting,
      dying: this.dying,
      working: this.working,
      workerActivity: this.workerActivityValue,
      carrying: this.carrying,
      // The bridge from the support field to the pose: a body being mended waits
      // kneeling instead of standing, and rises the tick the mending stops —
      // which is the tick it reaches full health, or leaves the field.
      resting: this.mending,
      // The bridge from the stance to the pose. A plain read of the order that
      // is already there: `setStance` owns what holding *means* to movement and
      // targeting, and this only reports that it is in force.
      holding: this.stance === "hold",
      attackCount: this.attack.blowCount,
      impactCount: this.health.impactCount,
      meleeCount: this.meleeBlows,
      huntStrikeCount: this.huntStrikes,
      triumphCount: this.triumphs,
      cameraDistanceSquared: cameraPosition ? this.object.position.distanceToSquared(cameraPosition) : null,
    });
  }

  /**
   * Mark the unit as performing (or having stopped) an in-place job.
   *
   * Presentation-only, and owned by whichever system runs the job — building a
   * site, or gathering at a farm/mine/forest. It is stored on the unit rather
   * than queried from those systems because the presentation snapshot is
   * assembled here and must stay a plain read of unit state; nothing in
   * movement, combat or death consults it.
   */
  setWorking(working: boolean): void {
    this.working = working;
  }

  /** Whether an in-place job is running; see {@link setWorking}. */
  get isWorking(): boolean {
    return this.working;
  }

  /**
   * Report the current Worker assignment to presentation consumers.
   *
   * Unlike {@link setWorking}, this remains available during the walk to a job.
   * It never feeds back into simulation; job-system release paths clear it.
   */
  setWorkerActivity(activity: WorkerActivity | null): void {
    this.workerActivityValue = activity;
  }

  /** Current presentation-only Worker assignment category. */
  get workerActivity(): WorkerActivity | null {
    return this.workerActivityValue;
  }

  /** Report whether a job's already-existing cargo is visible on this body. */
  setCarrying(carrying: boolean): void {
    this.carrying = carrying;
  }

  /** Whether this unit currently presents an already-authoritative load. */
  get isCarrying(): boolean {
    return this.carrying;
  }

  /**
   * Mark the unit as bringing down prey.
   *
   * The twin of {@link setWorking} and owned by the same system, for a job that
   * is not in-place work but is not combat either: a hunter has no attack target
   * and never trades blows, so `isTradingBlows()` would leave him standing idle
   * while an animal dies in front of him. Presentation-only — nothing in
   * movement, combat or death reads it, and no damage is dealt through it; the
   * kill itself belongs to the source being worked.
   */
  setHunting(hunting: boolean): void {
    this.hunting = hunting;
  }

  /** Whether prey is being brought down; see {@link setHunting}. */
  get isHunting(): boolean {
    return this.hunting;
  }

  /** Record the one decisive wildlife strike after the source has dropped prey. */
  noteHuntStrike(): void {
    this.huntStrikes += 1;
  }

  /** How many decisive wildlife strikes this worker has made. */
  get huntStrikeCount(): number {
    return this.huntStrikes;
  }

  /**
   * Record one close-quarters shove, written by `siegeMeleeSystem` after the
   * damage is already resolved.
   *
   * The twin of {@link AttackComponent.blowCount}, and separate from it for the
   * reason the two cooldowns are separate: a kick and a shot are different
   * events on different clocks, and sharing one counter would have each cancel
   * the other's animation. Nothing in combat reads it — removing every
   * presentation would leave the fight identical. Monotonic for the unit's life.
   */
  noteMeleeBlow(): void {
    this.meleeBlows += 1;
  }

  /** How many shoves this unit has thrown; see {@link noteMeleeBlow}. */
  get meleeCount(): number {
    return this.meleeBlows;
  }

  /**
   * Record one enemy structure brought down by this unit's own killing blow
   * (siege crew plan Faz 5).
   *
   * Written where the blow is already resolved, so the cheer is a report and
   * never a cause. Only the gun that landed the last hit is told — everything
   * else shelling the same wall keeps its count, which is what makes the
   * animation mean "you did that" rather than "something fell somewhere".
   */
  noteStructureDestroyed(): void {
    this.triumphs += 1;
  }

  /** How many enemy structures this unit has felled; see {@link noteStructureDestroyed}. */
  get triumphCount(): number {
    return this.triumphs;
  }

  /**
   * Local planar velocity observed since the last presentation frame.
   *
   * Measured from displacement rather than read off `speed` or the move target,
   * so it tells the truth in every case the animation has to survive: a unit
   * blocked by a crowd, shoved by separation, or stopped mid-order is reported
   * as slow because it *is* slow. The world displacement is projected onto the
   * body's current right/forward axes for directional animation selection. It
   * also costs the unit no extra simulation state — the previous position and
   * reusable output vector are presentation-local memory.
   */
  private measureLocalPlanarVelocity(deltaSeconds: number): Vector3 {
    const previous = this.lastPresentationPosition;
    const dx = this.object.position.x - previous.x;
    const dz = this.object.position.z - previous.z;
    previous.set(this.object.position.x, 0, this.object.position.z);
    if (deltaSeconds <= 0) return this.presentationLocalVelocity.set(0, 0, 0);
    const inverseDelta = 1 / deltaSeconds;
    const sine = Math.sin(this.object.rotation.y);
    const cosine = Math.cos(this.object.rotation.y);
    return this.presentationLocalVelocity.set(
      (dx * cosine - dz * sine) * inverseDelta,
      0,
      (dx * sine + dz * cosine) * inverseDelta,
    );
  }

  /**
   * Signed yaw rate observed since the last presentation frame, in degrees/s.
   *
   * The rotational twin of {@link measureLocalPlanarVelocity}, and measured for
   * the same reason: `turnRateDegPerSecond` is what the unit is *allowed* to
   * turn at, while this is what it actually did — a gun already on its heading
   * turns at zero even though it still holds the target that made it turn.
   * Presentation-local memory, exactly like the position sample: nothing in
   * movement, combat or death reads `lastPresentationYaw`.
   *
   * The delta is wrapped into (-π, π] so the seam at ±π reads as the small turn
   * it was rather than as a full rotation in one frame.
   */
  private measureYawRate(deltaSeconds: number): number {
    const yaw = this.object.rotation.y;
    const previous = this.lastPresentationYaw;
    this.lastPresentationYaw = yaw;
    if (deltaSeconds <= 0) return 0;
    let delta = yaw - previous;
    delta -= Math.PI * 2 * Math.floor((delta + Math.PI) / (Math.PI * 2));
    return delta * (180 / Math.PI) / deltaSeconds;
  }

  /**
   * Whether this unit is actually landing blows rather than merely walking after
   * something. Holding a target is not enough: a Guard chasing across the map
   * should still be shown walking.
   */
  private isTradingBlows(): boolean {
    const target = this.attackTarget;
    if (!target || target.health.depleted || this.dying) return false;
    // The firing *band*, not just its outer edge: a gun with something standing
    // against its wheels is holding fire, and reporting it as engaged would
    // brace its crew against a shot that is never coming — and leave them braced
    // exactly when the shove that does answer needs them on their feet (K-07/K-08).
    return this.attack.inFiringBand(combatDistance(this.position, target));
  }

  /**
   * Whether a live enemy is inside this unit's close reach — the shove
   * `siegeMeleeSystem` resolves, not the weapon `unitCombat` fires.
   *
   * Read off `kickRange` because that is the same number the shove itself uses,
   * so the stance covers exactly the band the blows land in and cannot drift
   * from it. A unit that authors no close weapon has no such band and reports
   * false, which leaves every pre-existing unit's idle untouched.
   *
   * Deliberately *not* folded into {@link isTradingBlows}: that one answers
   * "is my weapon firing", which the artillery needs to stay false inside its
   * minimum (K-07). This answers "is someone on top of me", and for a Worker
   * standing inside its own stone minimum both are true at once.
   */
  private isEngagedAtCloseQuarters(): boolean {
    const reach = this.stats.kickRange;
    if (reach === undefined || this.dying) return false;
    const target = this.attackTarget;
    if (!target || target.health.depleted || (target.dying ?? false)) return false;
    return combatDistance(this.position, target) <= reach;
  }

  /** Order the unit to walk to a ground point (y is ignored). */
  setMoveTarget(x: number, z: number): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.movePath = [];
    this.playerMoveOrder = false;
    this.retreating = false;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
    this.resumeAutomaticWorkerAssignment();
    this.moveTarget = new Vector3(x, 0, z);
    this.prepareMovementStart();
  }

  /**
   * Escort a trapped unit straight to clear ground, phasing through the crowd
   * until it arrives. Issued as a player move order so worker automation cannot
   * reclaim the unit before it is out of the footprint; {@link isRescuing} then
   * holds — and separation keeps ignoring the body — only until the point is
   * reached, at which point ordinary movement takes over again.
   */
  beginRescue(x: number, z: number): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.movePath = [];
    this.resumeAutomaticWorkerAssignment();
    this.moveTarget = new Vector3(x, 0, z);
    this.playerMoveOrder = true;
    this.retreating = false;
    this.rescuing = true;
    this.prepareMovementStart();
  }

  /** Whether a rescue escort still owns this unit (true until it reaches clear ground). */
  get isRescuing(): boolean {
    return this.rescuing && this.moveTarget !== null;
  }

  /** True while an active ground route or direct destination owns this unit. */
  get hasMovementOrder(): boolean {
    return this.movePath.length > 0 || this.moveTarget !== null;
  }

  /** Whether the presentation should show the artillery crew's lean-in. */
  get isPreparingToMove(): boolean {
    return this.movementStartDelaySeconds > 0 && this.hasMovementOrder;
  }

  /**
   * Spend the carriage-only lead-in before its first movement step.
   *
   * Returns true while the movement system must keep the gun stationary. The
   * delay is set only when a new order is issued, never for each waypoint, so a
   * long route does not repeatedly look like the crew has stopped to reset.
   */
  advanceMovementStartDelay(deltaSeconds: number): boolean {
    if (this.movementStartDelaySeconds <= 0) return false;
    this.movementStartDelaySeconds = Math.max(0, this.movementStartDelaySeconds - Math.max(0, deltaSeconds));
    return true;
  }

  /** Start a bounded unit-to-unit collision recovery without changing the order. */
  beginCollisionRecovery(seconds: number): void {
    this.collisionRecoverySeconds = Math.max(this.collisionRecoverySeconds, Math.max(0, seconds));
  }

  /** True while crowd separation must temporarily ignore this unit. */
  get isCollisionRecovering(): boolean {
    return this.collisionRecoverySeconds > 0;
  }

  /** Advance recovery time; returns true exactly when its window expires. */
  advanceCollisionRecovery(dt: number): boolean {
    if (this.collisionRecoverySeconds <= 0) return false;
    this.collisionRecoverySeconds = Math.max(0, this.collisionRecoverySeconds - Math.max(0, dt));
    return this.collisionRecoverySeconds === 0;
  }

  /** Replace the current movement order with a planned ground waypoint path. */
  setMovePath(points: readonly Vector3[]): void {
    this.replaceMovePath(points, false);
  }

  /** Set a player-issued ground route that automation must not preempt. */
  setPlayerMovePath(points: readonly Vector3[]): void {
    this.replaceMovePath(points, true);
  }

  /**
   * Set a player-issued route that keeps a Guard's current facing while it
   * moves. The route still uses ordinary navigation, collision and arrival
   * rules; only its body heading and locomotion role differ.
   */
  setPlayerRetreatPath(points: readonly Vector3[]): void {
    this.replaceMovePath(points, true, true);
  }

  /** Whether the current player route is a backwards retreat. */
  get isRetreating(): boolean {
    return this.retreating && this.hasPlayerMoveOrder;
  }

  /** Whether an active player-issued ground route still owns this unit. */
  get hasPlayerMoveOrder(): boolean {
    return this.playerMoveOrder && (this.movePath.length > 0 || this.moveTarget !== null);
  }

  /** Whether worker automation must leave this unit at its player-chosen spot. */
  get blocksAutomaticWorkerAssignment(): boolean {
    return this.hasPlayerMoveOrder || this.workerReturnDelayRemaining > 0 || this.manualAssignmentHeld;
  }

  /** Reserve an idle worker for the selection panel's explicit job cards. */
  holdForManualAssignment(): void {
    this.manualAssignmentHeld = true;
  }

  /** True while the worker is waiting for an explicit selection-panel job. */
  get isHeldForManualAssignment(): boolean {
    return this.manualAssignmentHeld;
  }

  /** Start the post-arrival rest timer for a worker's player-issued route. */
  waitBeforeReturningToWork(seconds = WORKER_RETURN_DELAY_SECONDS): void {
    const delay = Math.max(0, seconds);
    this.workerReturnDelayAfterMove = delay;
    this.workerReturnDelayRemaining = this.hasPlayerMoveOrder ? 0 : delay;
  }

  /** Let the worker re-enter automatic construction/production immediately. */
  resumeAutomaticWorkerAssignment(): void {
    this.workerReturnDelayAfterMove = 0;
    this.workerReturnDelayRemaining = 0;
    this.manualAssignmentHeld = false;
  }

  /** Advance only the post-arrival worker rest timer. */
  advanceWorkerReturnDelay(dt: number): void {
    if (this.workerReturnDelayRemaining <= 0) return;
    this.workerReturnDelayRemaining = Math.max(0, this.workerReturnDelayRemaining - Math.max(0, dt));
  }

  private replaceMovePath(points: readonly Vector3[], playerMoveOrder: boolean, retreating = false): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
    this.playerMoveOrder = playerMoveOrder;
    this.retreating = retreating;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
    this.prepareMovementStart();
    if (!playerMoveOrder) this.resumeAutomaticWorkerAssignment();
  }

  /**
   * Walk a planned path, engaging anything acquired on the way (GDD 06 §25).
   * The destination is retained separately so the unit resumes its advance once
   * the fight it was pulled into is over.
   */
  setAttackMovePath(points: readonly Vector3[], destination: Vector3): void {
    this.setAttackTarget(null);
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
    this.attackMoveTarget = destination.clone();
    this.playerMoveOrder = false;
    this.retreating = false;
    this.collisionRecoverySeconds = 0;
    this.prepareMovementStart();
  }

  /**
   * Swap the route under the current order, leaving the order itself alone.
   * This is how an attack pursuit gets its path, and how congestion re-planning
   * hands a jammed unit a fresh route without cancelling what it was told to do.
   */
  replanPath(points: readonly Vector3[]): void {
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
  }

  /** Current navigation waypoint, or null when not following a planned path. */
  get pathTarget(): Vector3 | null {
    return this.movePath[0] ?? null;
  }

  /** Final point of the planned route, or null when not following one. */
  get pathDestination(): Vector3 | null {
    return this.movePath[this.movePath.length - 1] ?? null;
  }

  /** Remaining planned waypoints, for debug readout only. */
  get pathWaypointCount(): number {
    return this.movePath.length;
  }

  /** Drop the current waypoint after reaching it. */
  advancePath(): void {
    this.movePath.shift();
    if (this.movePath.length === 0) {
      this.playerMoveOrder = false;
      this.retreating = false;
      this.workerReturnDelayRemaining = this.workerReturnDelayAfterMove;
      this.workerReturnDelayAfterMove = 0;
    }
  }

  /** Immediately clear movement, attack-move and explicit attack intent. */
  stop(): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = [];
    this.playerMoveOrder = false;
    this.retreating = false;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
    this.movementStartDelaySeconds = 0;
    this.resumeAutomaticWorkerAssignment();
  }

  /**
   * Hold makes a unit surrender its movement orders on the spot; it will still
   * shoot what comes into range. Switching back to aggressive does not restore
   * the discarded orders — the player re-issues them (GDD 06 §26).
   *
   * Dropping a target it can no longer reach is `engagementSystem`'s job: that
   * is where every "is this target still valid" rule lives, and a held unit can
   * also be handed an unreachable target *after* the stance is set.
   */
  setStance(stance: UnitStance): void {
    if (this.stance === stance) return;
    this.stance = stance;
    if (stance !== "hold") return;
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = [];
    this.retreating = false;
    this.collisionRecoverySeconds = 0;
    this.movementStartDelaySeconds = 0;
  }

  /**
   * Order this unit to fight an enemy. This records intent only: the movement
   * system pursues and the combat system decides when a hit lands.
   *
   * `auto` marks a target the unit picked for itself, which is what makes the
   * chase leash apply to it and not to a clicked order.
   */
  setAttackTarget(target: CombatTarget | null, auto = false): void {
    if (this.attackTarget === target) return;
    this.attackTarget?.setTargetedBy?.(-1);
    this.attackTarget = target;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
    this.autoAcquired = target !== null && auto;
    this.chaseOrigin = target !== null && auto ? this.position.clone() : null;
    this.moveTarget = null;
    this.movePath = [];
    this.retreating = false;
    this.movementStartDelaySeconds = 0;
    if (target) {
      this.playerMoveOrder = false;
      this.resumeAutomaticWorkerAssignment();
      this.prepareMovementStart();
    }
    target?.setTargetedBy?.(1);
  }

  /** Arms the crew lead-in for an ordinary forward artillery order. */
  private prepareMovementStart(): void {
    this.movementStartDelaySeconds = this.role === "siege" && !this.retreating
      ? SIEGE_CREW_PUSH_START_DELAY_SECONDS
      : 0;
  }

  /**
   * Turn to face a point on the ground, without touching any order.
   *
   * `unitMovement` already faces the heading while a unit walks; this is the
   * standing case, which only mattered once a unit's silhouette had a front. A
   * gun that shells a wall while pointing somewhere else reads as broken, and an
   * Archer loosing arrows over its shoulder reads no better.
   */
  faceTowards(x: number, z: number, deltaSeconds = 0): void {
    const dx = x - this.object.position.x;
    const dz = z - this.object.position.z;
    // Standing exactly on the target leaves no heading to take; keep the last one.
    if (dx * dx + dz * dz < 1e-6) return;
    this.faceHeading(Math.atan2(dx, dz), deltaSeconds);
  }

  /**
   * Point the body at a heading, at no more than this unit's authored turn rate.
   *
   * A unit with no `turnRateDegPerSecond` snaps, which is every unit that walks
   * on legs: a soldier pivots on its own feet and a limiter on one would read as
   * slow motion. A wheeled gun states a rate and swings round over several
   * frames instead, because a carriage describes an arc.
   *
   * `deltaSeconds` of 0 also snaps. That is the honest answer for a caller with
   * no frame to spend — a unit being placed, a formation being laid out — rather
   * than leaving it facing wherever it was built.
   */
  faceHeading(headingRad: number, deltaSeconds = 0): number {
    const rate = this.stats.turnRateDegPerSecond;
    if (rate === undefined || deltaSeconds <= 0) {
      this.object.rotation.y = headingRad;
      return 0;
    }
    this.object.rotation.y = rotateYawToward(
      this.object.rotation.y * RAD_TO_DEG,
      headingRad * RAD_TO_DEG,
      rate * deltaSeconds,
    ) * DEG_TO_RAD;
    return Math.abs(shortestYawDeltaDeg(this.object.rotation.y * RAD_TO_DEG, headingRad * RAD_TO_DEG));
  }

  /**
   * Turn toward a heading, and say whether the body may travel this frame.
   *
   * False is a unit still coming about: it has spent the frame turning and has
   * bought no ground, which is the whole of "turn first, then move". Everything
   * that snaps answers true on the frame it is asked, so this changes nothing
   * for any unit that authors no turn rate.
   */
  steerToHeading(headingRad: number, deltaSeconds: number): boolean {
    return this.faceHeading(headingRad, deltaSeconds) <= UNIT_PIVOT_THRESHOLD_DEG;
  }

  /**
   * Where this unit's weapon fires from, in world space, or null when its art
   * marks no muzzle.
   *
   * Read off the presentation's last rendered transform, which is a frame behind
   * the simulation. That is deliberate and invisible: a gun that has just turned
   * would otherwise need its whole hierarchy re-solved mid-tick to move the
   * spawn point by a few centimetres.
   */
  muzzleWorldPosition(out: Vector3): Vector3 | null {
    const muzzle = this.presentation?.muzzle;
    if (!muzzle) return null;
    return muzzle.getWorldPosition(out);
  }

  /**
   * Distance from where an auto-acquired chase began, or 0 when this unit is not
   * on a leashed chase. The combat system compares it to `attack.chaseRange`.
   */
  chaseDistance(): number {
    if (!this.chaseOrigin) return 0;
    return Math.hypot(this.position.x - this.chaseOrigin.x, this.position.z - this.chaseOrigin.z);
  }

  /** Begin the one-shot defeat presentation. Returns true exactly once. */
  beginDeath(): boolean {
    if (!this.health.depleted || this.deathElapsed !== null) return false;
    this.deathElapsed = 0;
    this.stop();
    this.setWorking(false);
    this.setHunting(false);
    this.setCarrying(false);
    this.setWorkerActivity(null);
    this.healthBar.object.visible = false;
    return true;
  }

  /**
   * How long the fall itself takes: the presentation's authored death animation
   * when it has one, otherwise the code tip-over's {@link UNIT_DEATH_SECONDS}.
   */
  get fallSeconds(): number {
    return this.presentation?.deathSeconds ?? UNIT_DEATH_SECONDS;
  }

  /**
   * The defeat window at normal speed: the fall, then the body lying there for
   * the rest of {@link UNIT_CORPSE_SECONDS}.
   */
  get deathSeconds(): number {
    return Math.max(this.fallSeconds, UNIT_CORPSE_SECONDS);
  }

  /**
   * Advance the defeat pose; true means the registry may now remove the unit.
   *
   * `simulationSpeed` is what keeps a death readable at 2x–8x, and it is needed
   * because the two clocks involved are genuinely different: an authored death
   * clip is played by the presentation on the *rendered* delta (deliberately —
   * a health bar and a tracer should look the same at any game speed), while
   * this window is spent on the *simulation* delta, which is the rendered one
   * multiplied by the speed. Left unscaled, 4x speed burns the window four times
   * faster than the clip it exists to wait for and the body vanishes a quarter
   * of the way into its own fall.
   *
   * Only the fall is scaled. The corpse linger stays in simulation seconds
   * because it is not waiting for anything on screen: at 8x the player is
   * fast-forwarding a battle and wants the field cleared at that speed too.
   */
  updateDeath(dt: number, simulationSpeed = 1): boolean {
    if (this.deathElapsed === null) return false;
    const speed = Number.isFinite(simulationSpeed) && simulationSpeed > 0 ? simulationSpeed : 1;
    const fall = this.fallSeconds * speed;
    const duration = Math.max(fall, UNIT_CORPSE_SECONDS);
    this.deathElapsed = Math.min(duration, this.deathElapsed + Math.max(0, dt));
    // The tip-over is the *fallback* death. An asset that animates its own fall
    // must not also be rotated by code, or the body lands twice — once from the
    // clip's own collapse and once from this, ending face-down in the ground.
    // It is paced by the fall, not by the whole window: the body goes down at
    // its own speed and then lies there, rather than sinking over five seconds.
    if (this.presentation?.deathSeconds === undefined) {
      const progress = fall > 0 ? Math.min(1, this.deathElapsed / fall) : 1;
      this.object.rotation.z = -Math.PI * 0.5 * progress;
      this.object.position.y = -UNIT_RADIUS * 0.2 * progress;
    }
    return this.deathElapsed >= duration;
  }

  /** Release the per-unit render allocations when it permanently leaves play. */
  dispose(): void {
    this.healthBar.dispose();
    this.disposePresentation();
    this.object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
    this.object.clear();
  }

  private installPresentation(presentation: RtsPresentationHandle | null, bodyCenterY: number): void {
    this.disposePresentation();
    if (presentation) {
      this.presentation = presentation;
      presentation.root.userData.rtsUnitPresentation = true;
      this.object.add(presentation.root);
      this.pickTargets = presentation.pickTargets;
      return;
    }
    const shape = ROLE_BODY[this.role];
    const geometry: BufferGeometry = shape.box
      ? new BoxGeometry(shape.radius * 2, shape.length, shape.radius * 2.6)
      : new CapsuleGeometry(shape.radius, shape.length, 6, 12);
    const body = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: new Color(this.role === "worker" ? "#dfbd5b" : TEAM_COLOR[this.owner]),
        roughness: 0.6,
      }),
    );
    body.position.y = bodyCenterY;
    body.castShadow = true;
    body.userData.unitId = this.id;
    this.fallbackBody = body;
    this.pickTargets = shape.gun ? [body, this.addGunParts(body, shape)] : [body];
    this.object.add(body);
  }

  /**
   * Turn the plain siege box into a wheeled gun: a barrel raised over the
   * carriage and two wheels under it. Everything hangs off the carriage mesh, so
   * the existing single-`fallbackBody` lifecycle still owns all of it — and the
   * barrel is returned because a click on it must select the gun too.
   *
   * The barrel points +Z, which is the heading `unitMovement` and
   * {@link faceTowards} rotate the unit to, so it aims where the gun is aiming.
   */
  private addGunParts(carriage: Mesh, shape: { readonly radius: number; readonly length: number }): Mesh {
    const barrel = new Mesh(
      new CylinderGeometry(shape.radius * 0.3, shape.radius * 0.38, shape.radius * 2.8, 8),
      new MeshStandardMaterial({ color: new Color(GUN_BARREL_COLOR), roughness: 0.4, metalness: 0.55 }),
    );
    // A cylinder is built along +Y; a quarter turn lays it along +Z, and taking
    // the elevation back off that raises the muzzle.
    barrel.rotation.x = Math.PI / 2 - GUN_ELEVATION;
    barrel.position.set(0, shape.length * 0.45, shape.radius * 0.35);
    barrel.castShadow = true;
    barrel.userData.unitId = this.id;
    carriage.add(barrel);

    const wheelGeometry = new CylinderGeometry(shape.radius * 0.45, shape.radius * 0.45, shape.radius * 0.28, 10);
    const wheelMaterial = new MeshStandardMaterial({ color: new Color(GUN_WHEEL_COLOR), roughness: 0.8 });
    for (const side of [-1, 1]) {
      const wheel = new Mesh(wheelGeometry, wheelMaterial);
      // Lay each wheel on its side so it rolls along the gun's heading.
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * shape.radius * 0.95, -shape.length * 0.12, 0);
      wheel.castShadow = true;
      carriage.add(wheel);
    }
    return barrel;
  }

  private disposePresentation(): void {
    if (this.presentation) {
      this.presentation.dispose();
      this.presentation = null;
    }
    if (this.fallbackBody) {
      const body = this.fallbackBody;
      body.removeFromParent();
      // Traversed rather than disposed directly: a gun's barrel and wheels are
      // children of the carriage, and they own geometries of their own.
      body.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      });
      this.fallbackBody = null;
    }
    this.pickTargets = [];
  }

  setTargetedBy(delta: number): void {
    this.targeterCount = Math.max(0, this.targeterCount + delta);
  }
}

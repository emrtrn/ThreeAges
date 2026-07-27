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
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Quaternion,
} from "three";
import type { Object3D } from "three";
import type { UnitBalanceStats, UnitRoleId } from "../../data/gameDataTypes";
import { combatDistance, type CombatTarget } from "../combat/combatTarget";
// Body tint and the ground ring read from one source, so a unit can never wear
// one team's colour on its body and another's underneath it.
import { TEAM_COLOR, createTeamRing } from "../team/teamColors";
import { AttackComponent } from "./attackComponent";
import { HealthComponent } from "./health";
import { HealthBar } from "./healthBar";

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
  /** True while a live target is inside weapon range — i.e. blows are landing. */
  readonly attacking: boolean;
  /** True once the defeat pose has begun. */
  readonly dying: boolean;
  /** True while the unit is standing at an in-place job — a builder on its site (Faz F). */
  readonly working: boolean;
  /** Blows landed so far; each increment is one swing to play (Faz D). */
  readonly attackCount: number;
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
  dispose(): void;
}

/** Gameplay footprint used by selection, commands and formation spacing. */
export const UNIT_RADIUS = 0.5;
/** Brief defeat presentation before the unit leaves the field. */
export const UNIT_DEATH_SECONDS = 0.35;
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

/** Dark iron for a gun barrel; the carriage stays in team colour. */
const GUN_BARREL_COLOR = "#2f3438";
const GUN_WHEEL_COLOR = "#6b4a2c";
/**
 * How far the muzzle is raised above level, in radians. A gun that lobs its
 * shot has to look like one while it stands still, which is the state the
 * player mostly sees a siege line in.
 */
const GUN_ELEVATION = 0.34;

let nextUnitId = 1;

export class Unit {
  readonly id: number;
  readonly owner: UnitOwner;
  readonly object: Group;
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
  private readonly targetRing: Mesh;
  private readonly healthBar: HealthBar;
  private presentation: RtsPresentationHandle | null = null;
  /** Where the body stood at the last presentation frame; see `measurePlanarSpeed`. */
  private readonly lastPresentationPosition = new Vector3();
  private fallbackBody: Mesh | null = null;
  private pickTargets: readonly Object3D[] = [];
  private movePath: Vector3[] = [];
  /**
   * A ground route explicitly issued by the player. Automation and defensive
   * retaliation must leave this route alone until it ends: a right-click is a
   * direct instruction, not a suggestion that a worker may immediately replace
   * with its old job or a Guard may abandon after taking one hit.
   */
  private playerMoveOrder = false;
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
  private selectedFlag = false;
  private targeterCount = 0;
  private deathElapsed: number | null = null;
  /** See {@link setWorking}: presentation-only, written by the job system. */
  private working = false;

  constructor(
    owner: UnitOwner,
    x: number,
    z: number,
    readonly stats: UnitBalanceStats,
    presentation: RtsPresentationHandle | null = null,
  ) {
    this.id = nextUnitId++;
    this.owner = owner;
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
    const bodyCenterY = shape.box ? shape.length / 2 : shape.length / 2 + shape.radius;
    this.installPresentation(presentation, bodyCenterY);

    // Always on: this is the answer to "whose is that", which the player needs
    // continuously, not on selection. It sits inside the selection ring's radius
    // so both can be visible at once without reading as one thick band.
    this.object.add(createTeamRing(owner, UNIT_RADIUS * 0.75));

    this.ring = new Mesh(
      new RingGeometry(UNIT_RADIUS * 1.25, UNIT_RADIUS * 1.55, 24),
      new MeshStandardMaterial({
        color: new Color("#f2f27a"),
        emissive: new Color("#8f8f20"),
        roughness: 0.5,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.object.add(this.ring);

    // Separate from the local selection ring: this is visible on an enemy while
    // one or more selected player units have an explicit attack order on it.
    this.targetRing = new Mesh(
      new RingGeometry(UNIT_RADIUS * 1.65, UNIT_RADIUS * 1.95, 24),
      new MeshStandardMaterial({
        color: new Color("#ff7468"),
        emissive: new Color("#9a241b"),
        roughness: 0.5,
      }),
    );
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.position.y = 0.04;
    this.targetRing.visible = false;
    this.object.add(this.targetRing);

    this.healthBar = new HealthBar(shape.radius * 2.4, bodyCenterY + shape.length / 2 + 0.55);
    this.object.add(this.healthBar.object);
  }

  /** The Actor Script path can replace only the presentation; stats and gameplay stay intact. */
  replacePresentation(presentation: RtsPresentationHandle | null): void {
    const shape = ROLE_BODY[this.role];
    const bodyCenterY = shape.box ? shape.length / 2 : shape.length / 2 + shape.radius;
    this.installPresentation(presentation, bodyCenterY);
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
    this.presentation?.update?.({
      deltaSeconds,
      planarSpeed: this.measurePlanarSpeed(deltaSeconds),
      attacking: this.isTradingBlows(),
      dying: this.dying,
      working: this.working,
      attackCount: this.attack.blowCount,
      cameraDistanceSquared: cameraPosition ? this.object.position.distanceToSquared(cameraPosition) : null,
    });
  }

  /**
   * Mark the unit as performing (or having stopped) an in-place job.
   *
   * Presentation-only, and owned by whichever system runs the job — construction
   * today. It is stored on the unit rather than queried from that system because
   * the presentation snapshot is assembled here and must stay a plain read of
   * unit state; nothing in movement, combat or death consults it.
   */
  setWorking(working: boolean): void {
    this.working = working;
  }

  /**
   * Ground speed observed since the last presentation frame.
   *
   * Measured from displacement rather than read off `speed` or the move target,
   * so it tells the truth in every case the animation has to survive: a unit
   * blocked by a crowd, shoved by separation, or stopped mid-order is reported
   * as slow because it *is* slow. It also costs the unit no extra simulation
   * state — the previous position is a presentation-local memory.
   */
  private measurePlanarSpeed(deltaSeconds: number): number {
    const previous = this.lastPresentationPosition;
    const dx = this.object.position.x - previous.x;
    const dz = this.object.position.z - previous.z;
    previous.set(this.object.position.x, 0, this.object.position.z);
    if (deltaSeconds <= 0) return 0;
    return Math.hypot(dx, dz) / deltaSeconds;
  }

  /**
   * Whether this unit is actually landing blows rather than merely walking after
   * something. Holding a target is not enough: a Guard chasing across the map
   * should still be shown walking.
   */
  private isTradingBlows(): boolean {
    const target = this.attackTarget;
    if (!target || target.health.depleted || this.dying) return false;
    return combatDistance(this.position, target) <= this.attack.range;
  }

  /** Order the unit to walk to a ground point (y is ignored). */
  setMoveTarget(x: number, z: number): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.movePath = [];
    this.playerMoveOrder = false;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
    this.resumeAutomaticWorkerAssignment();
    this.moveTarget = new Vector3(x, 0, z);
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
    this.rescuing = true;
  }

  /** Whether a rescue escort still owns this unit (true until it reaches clear ground). */
  get isRescuing(): boolean {
    return this.rescuing && this.moveTarget !== null;
  }

  /** True while an active ground route or direct destination owns this unit. */
  get hasMovementOrder(): boolean {
    return this.movePath.length > 0 || this.moveTarget !== null;
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

  /** Whether an active player-issued ground route still owns this unit. */
  get hasPlayerMoveOrder(): boolean {
    return this.playerMoveOrder && (this.movePath.length > 0 || this.moveTarget !== null);
  }

  /** Whether worker automation must leave this unit at its player-chosen spot. */
  get blocksAutomaticWorkerAssignment(): boolean {
    return this.hasPlayerMoveOrder || this.workerReturnDelayRemaining > 0;
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
  }

  /** Advance only the post-arrival worker rest timer. */
  advanceWorkerReturnDelay(dt: number): void {
    if (this.workerReturnDelayRemaining <= 0) return;
    this.workerReturnDelayRemaining = Math.max(0, this.workerReturnDelayRemaining - Math.max(0, dt));
  }

  private replaceMovePath(points: readonly Vector3[], playerMoveOrder: boolean): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
    this.playerMoveOrder = playerMoveOrder;
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
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
    this.collisionRecoverySeconds = 0;
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
    this.rescuing = false;
    this.collisionRecoverySeconds = 0;
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
    this.collisionRecoverySeconds = 0;
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
    if (target) {
      this.playerMoveOrder = false;
      this.resumeAutomaticWorkerAssignment();
    }
    target?.setTargetedBy?.(1);
  }

  /**
   * Turn to face a point on the ground, without touching any order.
   *
   * `unitMovement` already faces the heading while a unit walks; this is the
   * standing case, which only mattered once a unit's silhouette had a front. A
   * gun that shells a wall while pointing somewhere else reads as broken, and an
   * Archer loosing arrows over its shoulder reads no better.
   */
  faceTowards(x: number, z: number): void {
    const dx = x - this.object.position.x;
    const dz = z - this.object.position.z;
    // Standing exactly on the target leaves no heading to take; keep the last one.
    if (dx * dx + dz * dz < 1e-6) return;
    this.object.rotation.y = Math.atan2(dx, dz);
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
    this.healthBar.object.visible = false;
    return true;
  }

  /**
   * The defeat window this unit actually plays: its presentation's authored
   * death animation when it has one, otherwise the code collapse's fixed
   * {@link UNIT_DEATH_SECONDS}.
   */
  get deathSeconds(): number {
    return this.presentation?.deathSeconds ?? UNIT_DEATH_SECONDS;
  }

  /** Advance the defeat pose; true means the registry may now remove the unit. */
  updateDeath(dt: number): boolean {
    if (this.deathElapsed === null) return false;
    const duration = this.deathSeconds;
    this.deathElapsed = Math.min(duration, this.deathElapsed + Math.max(0, dt));
    // The tip-over is the *fallback* death. An asset that animates its own fall
    // must not also be rotated by code, or the body lands twice — once from the
    // clip's own collapse and once from this, ending face-down in the ground.
    if (this.presentation?.deathSeconds === undefined) {
      const progress = this.deathElapsed / duration;
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
    this.targetRing.visible = this.targeterCount > 0;
  }
}

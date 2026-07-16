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
 * Guard, an Archer and a Ram are the same class with different `stats`.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
  type BufferGeometry,
  type Quaternion,
} from "three";
import type { UnitBalanceStats, UnitRoleId } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
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

const TEAM_COLOR: Record<UnitOwner, string> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
};

/** Gameplay footprint used by selection, commands and formation spacing. */
export const UNIT_RADIUS = 0.5;
/** Brief defeat presentation before the unit leaves the field. */
export const UNIT_DEATH_SECONDS = 0.35;

/**
 * Per-role silhouette. GDD 06 §3.4 asks that a role be readable before its UI
 * is: the Archer is slighter than the Guard, and the Ram is an unmistakable
 * low box rather than a person.
 */
const ROLE_BODY: Record<UnitRoleId, { readonly radius: number; readonly length: number; readonly box?: boolean }> = {
  guard: { radius: UNIT_RADIUS, length: 1.0 },
  archer: { radius: UNIT_RADIUS * 0.78, length: 1.15 },
  siege: { radius: UNIT_RADIUS * 1.5, length: 0.9, box: true },
  worker: { radius: UNIT_RADIUS * 0.85, length: 0.8 },
};

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
   * the Ram is genuinely wider than the Archer, so it navigates as a wider agent.
   */
  readonly navRadius: number;
  /** {@link CombatTarget}: which §33 column attackers resolve against. */
  readonly armorClass: UnitBalanceStats["armorClass"];
  /** Bounded health state; death/removal is handled by the death system. */
  readonly health: HealthComponent;
  /** JSON-backed damage, range, counters and cooldown state. */
  readonly attack: AttackComponent;
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
  private movePath: Vector3[] = [];
  private selectedFlag = false;
  private targeterCount = 0;
  private deathElapsed: number | null = null;

  constructor(
    owner: UnitOwner,
    x: number,
    z: number,
    readonly stats: UnitBalanceStats,
  ) {
    this.id = nextUnitId++;
    this.owner = owner;
    this.role = stats.role;
    this.speed = stats.moveSpeed;
    this.armorClass = stats.armorClass;

    this.object = new Group();
    this.object.name = `rts-unit-${this.role}-${owner}-${this.id}`;
    this.object.position.set(x, 0, z);
    this.health = new HealthComponent(stats.maxHealth);
    this.attack = new AttackComponent(stats);

    const shape = ROLE_BODY[this.role];
    this.navRadius = shape.radius;
    const geometry: BufferGeometry = shape.box
      ? new BoxGeometry(shape.radius * 2, shape.length, shape.radius * 2.6)
      : new CapsuleGeometry(shape.radius, shape.length, 6, 12);
    const bodyCenterY = shape.box ? shape.length / 2 : shape.length / 2 + shape.radius;
    const body = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: new Color(this.role === "worker" ? "#dfbd5b" : TEAM_COLOR[owner]),
        roughness: 0.6,
      }),
    );
    body.position.y = bodyCenterY;
    body.castShadow = true;
    // Back-reference so a raycast hit on the body resolves to this unit.
    body.userData.unitId = this.id;
    this.object.add(body);

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

  /** Refresh the health bar and keep it turned toward the camera. */
  updatePresentation(cameraQuaternion: Quaternion): void {
    this.healthBar.set(this.health.ratio);
    this.healthBar.faceCamera(cameraQuaternion);
  }

  /** Order the unit to walk to a ground point (y is ignored). */
  setMoveTarget(x: number, z: number): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.movePath = [];
    this.moveTarget = new Vector3(x, 0, z);
  }

  /** Replace the current movement order with a planned ground waypoint path. */
  setMovePath(points: readonly Vector3[]): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
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
  }

  /** Immediately clear movement, attack-move and explicit attack intent. */
  stop(): void {
    this.setAttackTarget(null);
    this.attackMoveTarget = null;
    this.moveTarget = null;
    this.movePath = [];
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
    this.autoAcquired = target !== null && auto;
    this.chaseOrigin = target !== null && auto ? this.position.clone() : null;
    this.moveTarget = null;
    this.movePath = [];
    target?.setTargetedBy?.(1);
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

  /** Advance the brief collapse pose; true means the registry may now remove it. */
  updateDeath(dt: number): boolean {
    if (this.deathElapsed === null) return false;
    this.deathElapsed = Math.min(UNIT_DEATH_SECONDS, this.deathElapsed + Math.max(0, dt));
    const progress = this.deathElapsed / UNIT_DEATH_SECONDS;
    this.object.rotation.z = -Math.PI * 0.5 * progress;
    this.object.position.y = -UNIT_RADIUS * 0.2 * progress;
    return this.deathElapsed >= UNIT_DEATH_SECONDS;
  }

  /** Release the per-unit render allocations when it permanently leaves play. */
  dispose(): void {
    this.healthBar.dispose();
    this.object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
    this.object.clear();
  }

  setTargetedBy(delta: number): void {
    this.targeterCount = Math.max(0, this.targeterCount + delta);
    this.targetRing.visible = this.targeterCount > 0;
  }
}

/**
 * RTS unit entity — Vertical Slice Plan v0.2 §21 ("Test birimi").
 *
 * A single controllable actor (Faz 1: the Guard placeholder). It owns its render
 * object (a capsule body + a flat selection ring) and the small gameplay state
 * the Faz 1 systems need: ownership (whose army it belongs to), selection, and
 * an explicit attack target. Movement, health and combat resolution are layered
 * on in later Faz 1 steps —
 * this stays a thin data+render holder, not a mega-object (plan §14).
 */
import {
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
} from "three";
import { HealthComponent } from "./health";

/** Which army a unit belongs to. Ürün A is one player vs. one AI (plan §4.2). */
export type UnitOwner = "player" | "enemy";

const TEAM_COLOR: Record<UnitOwner, string> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
};

/** Capsule body radius; also the gameplay footprint used by selection/commands. */
export const UNIT_RADIUS = 0.5;
const BODY_LENGTH = 1.0;
/** Capsule centre height so the body rests on the y = 0 ground. */
const BODY_CENTER_Y = BODY_LENGTH / 2 + UNIT_RADIUS;

let nextUnitId = 1;

/** Default ground speed (world units/s). Balance number — moves to JSON in the
 *  Faz 1 data step; a constant for now (plan §14). */
export const UNIT_MOVE_SPEED = 6;

export class Unit {
  readonly id: number;
  readonly owner: UnitOwner;
  readonly object: Group;
  /** Ground speed in world units/s. */
  readonly speed = UNIT_MOVE_SPEED;
  /** Bounded health state; death/removal is handled by a later combat step. */
  readonly health: HealthComponent;
  /** Active move destination (y = 0), or null when idle/arrived. */
  moveTarget: Vector3 | null = null;
  /** Enemy explicitly ordered by a contextual right-click, or null. */
  attackTarget: Unit | null = null;
  private readonly ring: Mesh;
  private readonly targetRing: Mesh;
  private movePath: Vector3[] = [];
  private selectedFlag = false;
  private targeterCount = 0;

  constructor(owner: UnitOwner, x: number, z: number, maxHealth: number) {
    this.id = nextUnitId++;
    this.owner = owner;

    this.object = new Group();
    this.object.name = `rts-unit-${owner}-${this.id}`;
    this.object.position.set(x, 0, z);
    this.health = new HealthComponent(maxHealth);

    const body = new Mesh(
      new CapsuleGeometry(UNIT_RADIUS, BODY_LENGTH, 6, 12),
      new MeshStandardMaterial({ color: new Color(TEAM_COLOR[owner]), roughness: 0.6 }),
    );
    body.position.y = BODY_CENTER_Y;
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

  setSelected(selected: boolean): void {
    if (this.selectedFlag === selected) return;
    this.selectedFlag = selected;
    this.ring.visible = selected;
  }

  /** Order the unit to walk to a ground point (y is ignored). */
  setMoveTarget(x: number, z: number): void {
    this.setAttackTarget(null);
    this.movePath = [];
    this.moveTarget = new Vector3(x, 0, z);
  }

  /** Replace the current movement order with a planned ground waypoint path. */
  setMovePath(points: readonly Vector3[]): void {
    this.setAttackTarget(null);
    this.moveTarget = null;
    this.movePath = points.map((point) => point.clone());
  }

  /** Current navigation waypoint, or null when not following a planned path. */
  get pathTarget(): Vector3 | null {
    return this.movePath[0] ?? null;
  }

  /** Drop the current waypoint after reaching it. */
  advancePath(): void {
    this.movePath.shift();
  }

  /** Immediately clear both movement and explicit attack intent. */
  stop(): void {
    this.setAttackTarget(null);
    this.moveTarget = null;
    this.movePath = [];
  }

  /**
   * Order this unit to pursue an enemy. This records intent only: the following
   * melee-combat step will decide when it is in range and applies damage.
   */
  setAttackTarget(target: Unit | null): void {
    if (this.attackTarget === target) return;
    if (this.attackTarget) this.attackTarget.setTargetedBy(-1);
    this.attackTarget = target;
    this.moveTarget = null;
    this.movePath = [];
    if (target) target.setTargetedBy(1);
  }

  private setTargetedBy(delta: number): void {
    this.targeterCount = Math.max(0, this.targeterCount + delta);
    this.targetRing.visible = this.targeterCount > 0;
  }
}

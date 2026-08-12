/** Shared combat-facing contract for RTS units and damageable structures. */
import { Vector3 } from "three";

import type { UnitArmorClass } from "../../data/gameDataTypes";
import type { HealthComponent } from "../units/health";
import type { UnitOwner } from "../units/unit";

/**
 * Who a combat target answers to.
 *
 * Wider than {@link UnitOwner} by exactly one value: wildlife belongs to no
 * kingdom. Widening *here* rather than widening `UnitOwner` itself is the whole
 * point — `UnitOwner` still means "a kingdom", so population counting, team
 * colours, the AI blackboard and the kingdom registry keep working on the two
 * values they were written for, while a deer can still be shot at.
 *
 * Note the consequence for {@link isHostile}, which is a plain inequality: an
 * animal reads as hostile to both kingdoms. That is only ever reached for
 * targets a system actually offers up, so wildlife stays unattackable until the
 * hunt deliberately puts an animal in front of a hunter.
 */
export type CombatTargetOwner = UnitOwner | "wild";

export interface CombatTarget {
  readonly owner: CombatTargetOwner;
  readonly position: Vector3;
  readonly health: HealthComponent;
  /**
   * Which column of the GDD 12 §33 counter table an attacker resolves against.
   * Buildings are always "structure"; units carry their data-owned class.
   */
  readonly armorClass: UnitArmorClass;
  /**
   * Horizontal radius that can be attacked from outside the target's collision
   * footprint. Units use zero; command centres expose their perimeter.
   */
  readonly combatRadius?: number;
  /**
   * True while this target is already going down — a body playing its defeat
   * pose rather than a threat still standing.
   *
   * Optional because only {@link Unit} has a death presentation to be in the
   * middle of; a structure is rubble the instant its health empties, and an
   * animal is a carcass. Absent therefore means "not dying", which is what lets
   * a caller ask the question of any target without knowing which kind it holds
   * (V3 §3.5 — {@link retaliateAgainstAttack} asks it of a wolf).
   */
  readonly dying?: boolean;
  /**
   * Fraction of incoming damage this target currently absorbs, 0..1.
   *
   * Written by whatever grants the protection rather than owned by the target —
   * today the Temple's support field ({@link SupportAuraSystem}), which rewrites
   * it every tick. Absent means "none", which is what keeps every target that
   * nothing protects — structures included — resolving exactly as before.
   */
  readonly damageResistance?: number;
  /**
   * Fraction of a blow struck from `distance` away that this target's own
   * *stance* absorbs, 0..1 — the shield a unit holding its position raises
   * against what it cannot reach (GDD 06 §26).
   *
   * A method rather than a field because, unlike {@link damageResistance}, the
   * answer depends on where the blow came from: the same held Guard absorbs an
   * arrow shot from across the field and takes a sword in front of it in full.
   * Asking the target rather than deriving it at the damage site is what keeps
   * the rule in one place — the target is the only thing that knows both its
   * stance and how far its own weapon reaches.
   *
   * Optional, and absent means none: a structure has no stance to take, and a
   * unit that authors no bracing keeps resolving exactly as it did before.
   */
  stanceResistanceAt?(distance: number): number;
  /** Units show a target ring; structures may omit that presentation hook. */
  setTargetedBy?(delta: number): void;
}

/** Ground-plane distance to a target's attackable edge rather than its pivot. */
export function combatDistance(position: Vector3, target: CombatTarget): number {
  return Math.max(0, Math.hypot(position.x - target.position.x, position.z - target.position.z)
    - (target.combatRadius ?? 0));
}

/**
 * Height a thrown effect lands at on a building. The balance data carries no
 * model height, so this is a wall-ish constant rather than a per-building
 * lookup: it only has to read as "against the structure", and a footprint-
 * derived guess would still be wrong for every model with a tower.
 */
const STRUCTURE_IMPACT_HEIGHT = 1.7;

/**
 * Where a thrown effect should hit `target`, seen from `from`: the point on the
 * near edge the attacker is standing at, not the target's pivot. Aiming at the
 * pivot would send a torch *through* a large building to land in its middle.
 */
export function structureImpactPoint(from: Vector3, target: CombatTarget): Vector3 {
  const point = new Vector3(target.position.x, target.position.y + STRUCTURE_IMPACT_HEIGHT, target.position.z);
  const radius = target.combatRadius ?? 0;
  if (radius <= 0) return point;
  const dx = from.x - target.position.x;
  const dz = from.z - target.position.z;
  const length = Math.hypot(dx, dz);
  // Directly on top of the pivot there is no near edge to pick; the pivot is
  // then as good an aim point as any.
  if (length < 1e-4) return point;
  point.x += (dx / length) * radius;
  point.z += (dz / length) * radius;
  return point;
}

/** Height a shot lands at on a person — chest height on the placeholder bodies. */
const UNIT_IMPACT_HEIGHT = 0.9;

/**
 * Where a lobbed shot should hit `target`, whichever class it is: the near edge
 * of a building (see {@link structureImpactPoint}) or the body of a unit. An
 * artillery piece fires the same ball at both, so it needs one aim point that
 * answers for both rather than a caller-side branch on armour class.
 */
export function combatImpactPoint(from: Vector3, target: CombatTarget): Vector3 {
  if (target.armorClass === "structure") return structureImpactPoint(from, target);
  return new Vector3(target.position.x, target.position.y + UNIT_IMPACT_HEIGHT, target.position.z);
}

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
   * Fraction of incoming damage this target currently absorbs, 0..1.
   *
   * Written by whatever grants the protection rather than owned by the target —
   * today the Temple's support field ({@link SupportAuraSystem}), which rewrites
   * it every tick. Absent means "none", which is what keeps every target that
   * nothing protects — structures included — resolving exactly as before.
   */
  readonly damageResistance?: number;
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

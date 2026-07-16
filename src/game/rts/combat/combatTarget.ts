/** Shared combat-facing contract for RTS units and damageable structures. */
import type { Vector3 } from "three";

import type { UnitArmorClass } from "../../data/gameDataTypes";
import type { HealthComponent } from "../units/health";
import type { UnitOwner } from "../units/unit";

export interface CombatTarget {
  readonly owner: UnitOwner;
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
  /** Units show a target ring; structures may omit that presentation hook. */
  setTargetedBy?(delta: number): void;
}

/** Ground-plane distance to a target's attackable edge rather than its pivot. */
export function combatDistance(position: Vector3, target: CombatTarget): number {
  return Math.max(0, Math.hypot(position.x - target.position.x, position.z - target.position.z)
    - (target.combatRadius ?? 0));
}

/** Shared combat-facing contract for RTS units and damageable structures. */
import type { Vector3 } from "three";

import type { HealthComponent } from "../units/health";
import type { UnitOwner } from "../units/unit";

export interface CombatTarget {
  readonly owner: UnitOwner;
  readonly position: Vector3;
  readonly health: HealthComponent;
  /** Units show a target ring; structures may omit that presentation hook. */
  setTargetedBy?(delta: number): void;
}

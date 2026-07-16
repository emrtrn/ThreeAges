/**
 * RTS combat resolution — Vertical Slice Plan v0.2 §21 / §45.
 *
 * Resolves an existing attack order once the target is in weapon range. Target
 * choice lives in `engagementSystem`, pursuit in `unitMovement`, and removal in
 * `unitDeath`; this owns the hit itself.
 *
 * Friendly fire cannot happen here: a hit only ever lands on `unit.attackTarget`,
 * and nothing in the match will point that at an ally (plan §45).
 */
import type { Unit } from "./unit";
import { combatDistance, type CombatTarget } from "../combat/combatTarget";
import type { HealthChange } from "./health";

export interface CombatHit {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly change: HealthChange;
  /** Ranged hits ask the caller for a tracer; melee hits land where they stand. */
  readonly ranged: boolean;
}

export function updateUnitCombat(
  units: readonly Unit[],
  dt: number,
  onHit?: (hit: CombatHit) => void,
  canDamageTarget?: (attacker: Unit, target: CombatTarget) => boolean,
): void {
  for (const unit of units) {
    if (unit.role === "worker") continue;
    unit.attack.update(dt);
    if (unit.health.depleted) {
      unit.stop();
      continue;
    }

    const target = unit.attackTarget;
    if (!target) continue;
    if (target.health.depleted) {
      unit.setAttackTarget(null);
      continue;
    }
    if (combatDistance(unit.position, target) > unit.attack.range) continue;
    if (canDamageTarget && !canDamageTarget(unit, target)) continue;

    const change = unit.attack.tryHit(target);
    if (change) onHit?.({ attacker: unit, target, change, ranged: unit.attack.ranged });
    if (target.health.depleted) unit.setAttackTarget(null);
  }
}

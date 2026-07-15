/**
 * RTS combat resolution â€” Vertical Slice Plan v0.2 Faz 1.
 *
 * Resolves an existing attack order after movement has pursued the target into
 * melee range. Depleted units are retained for the next death/removal slice,
 * but cannot deal damage or keep stale attack orders.
 */
import type { Unit } from "./unit";
import type { CombatTarget } from "../combat/combatTarget";
import type { HealthChange } from "./health";

export interface CombatHit {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly change: HealthChange;
}

export function updateUnitCombat(
  units: readonly Unit[],
  dt: number,
  onHit?: (hit: CombatHit) => void,
): void {
  for (const unit of units) {
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
    if (unit.position.distanceTo(target.position) > unit.attack.range) continue;

    const change = unit.attack.tryHit(target.health);
    if (change) onHit?.({ attacker: unit, target, change });
    if (target.health.depleted) unit.setAttackTarget(null);
  }
}

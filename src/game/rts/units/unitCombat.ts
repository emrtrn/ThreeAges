/**
 * RTS combat resolution â€” Vertical Slice Plan v0.2 Faz 1.
 *
 * Resolves an existing attack order after movement has pursued the target into
 * melee range. Depleted units are retained for the next death/removal slice,
 * but cannot deal damage or keep stale attack orders.
 */
import type { Unit } from "./unit";

export function updateUnitCombat(units: readonly Unit[], dt: number): void {
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

    unit.attack.tryHit(target.health);
    if (target.health.depleted) unit.setAttackTarget(null);
  }
}

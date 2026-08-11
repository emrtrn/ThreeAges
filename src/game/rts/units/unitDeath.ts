/**
 * RTS defeat lifecycle â€” Vertical Slice Plan v0.2 Faz 1.
 *
 * A zero-health unit immediately stops participating in selection, commands and
 * targeting, plays a brief collapse pose, then is removed without a persistent
 * corpse or ragdoll.
 */
import type { SelectionSystem } from "../selection/selectionSystem";
import type { UnitSystem } from "./unitSystem";

export function updateUnitDeaths(
  units: UnitSystem,
  selection: Pick<SelectionSystem, "remove">,
  dt: number,
  /** The rate `dt` is already scaled by; see {@link Unit.updateDeath}. */
  simulationSpeed = 1,
): void {
  for (const unit of [...units.all()]) {
    if (!unit.health.depleted) continue;
    if (unit.beginDeath()) {
      selection.remove(unit);
      units.clearAttackTargets(unit);
    }
    if (unit.updateDeath(dt, simulationSpeed)) units.despawn(unit);
  }
}

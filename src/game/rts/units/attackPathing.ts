/** Shared navigation-aware attack order used by player commands and the AI. */
import type { CombatTarget } from "../combat/combatTarget";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "./unit";

/**
 * Attack intent remains on the unit while its movement follows the path to a
 * valid attack position. A failed path deliberately leaves the unit still;
 * steering straight at the target would tunnel through a navigation blocker.
 */
export function issueAttackOrder(unit: Unit, target: CombatTarget, navigation: RtsNavigation): void {
  const targetChanged = unit.attackTarget !== target;
  if (targetChanged) unit.setAttackTarget(target);
  // AI evaluates its mission frequently. The target's attack order is stable,
  // so keep its route rather than baking twelve candidate paths every tick.
  // A later moving-target pursuit slice can add a distance/cadence replan.
  if (!targetChanged) return;
  const path = navigation.planAttack(unit.position, target, unit.attack.range);
  unit.setAttackPath(path ?? []);
}

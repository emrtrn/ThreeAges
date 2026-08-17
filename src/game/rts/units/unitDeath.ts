/**
 * RTS defeat lifecycle â€” Vertical Slice Plan v0.2 Faz 1.
 *
 * A zero-health unit immediately stops participating in selection, commands and
 * targeting, plays its collapse, lies where it fell for the rest of
 * `UNIT_CORPSE_SECONDS`, and is then removed. No ragdoll: the fall is an
 * authored clip or a code tip-over, never simulated.
 */
import type { SelectionSystem } from "../selection/selectionSystem";
import type { Unit } from "./unit";
import type { UnitSystem } from "./unitSystem";

export function updateUnitDeaths(
  units: UnitSystem,
  selection: Pick<SelectionSystem, "remove">,
  dt: number,
  /** The rate `dt` is already scaled by; see {@link Unit.updateDeath}. */
  simulationSpeed = 1,
  /**
   * Called with each body as it leaves the field, before it is despawned — the
   * last moment a caller can read where it fell and what it was.
   *
   * This is the hook the gear debris hangs on (`unitGearDebris.ts`), and it is
   * here rather than on the death *clip* because the two are thirty seconds
   * apart: a corpse lies wearing its kit for the whole linger, so kit dropped
   * when the clip ended would sit next to the body still visibly wearing it.
   * Presentation only by contract — the simulation has finished with the unit by
   * the time this runs, and nothing it does is read back.
   */
  onRemoved?: (unit: Unit) => void,
  /**
   * Called once, on the frame a unit is defeated — `beginDeath` returns true
   * exactly once, which is what makes this a tally point rather than a condition
   * a caller has to de-duplicate.
   *
   * Kept apart from {@link onRemoved} because the two are a corpse-linger apart
   * (~30s): "this unit died" is news now, while "its kit hits the ground" is news
   * when the body goes. A mission counting kills on removal would credit them
   * half a minute after the fight, which on a step gated on defending is the
   * difference between the card reacting and the card looking broken.
   */
  onDefeated?: (unit: Unit) => void,
): void {
  for (const unit of [...units.all()]) {
    if (!unit.health.depleted) continue;
    if (unit.beginDeath()) {
      selection.remove(unit);
      units.clearAttackTargets(unit);
      onDefeated?.(unit);
    }
    if (!unit.updateDeath(dt, simulationSpeed)) continue;
    onRemoved?.(unit);
    units.despawn(unit);
  }
}

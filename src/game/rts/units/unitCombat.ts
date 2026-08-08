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
import type { PendingImpactQueue } from "../combat/pendingImpacts";
import type { HealthChange } from "./health";

export interface CombatHit {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly change: HealthChange;
  /** Ranged hits ask the caller for a tracer; melee hits land where they stand. */
  readonly ranged: boolean;
}

/** A weapon going off, reported before the blow exists. */
export interface CombatShot {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly ranged: boolean;
  /** What this shot will be worth when it arrives, already resolved. */
  readonly damage: number;
}

export interface UnitCombatOptions {
  /**
   * Called the instant a weapon fires, so the caller can show the shot leaving.
   * Returns how many seconds it needs to reach its target: `0` — the default
   * for every weapon whose blow is instant — lands it here and now, while a
   * positive time parks the damage in {@link impacts} until the shot arrives.
   *
   * The flight time comes from the caller because the caller owns the visuals:
   * the damage lands when the thing the player is watching lands, not on a
   * duration combat guessed separately.
   */
  readonly onShot?: (shot: CombatShot) => number;
  /** Where shots with a flight time wait. Without it, everything is instant. */
  readonly impacts?: PendingImpactQueue;
}

export function updateUnitCombat(
  units: readonly Unit[],
  dt: number,
  onHit?: (hit: CombatHit) => void,
  options?: UnitCombatOptions,
): void {
  for (const unit of units) {
    // Workers cannot receive an attack command or acquire targets themselves.
    // `retaliateAgainstAttack` may nevertheless give a struck worker one
    // auto-acquired target, so a crowd cannot be defeated by an effectively
    // invulnerable last Guard.
    if (unit.role === "worker" && !unit.autoAcquired) continue;
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
    // In range and about to shoot: face what is being shot at. A unit that
    // reached its firing position has stopped moving, so nothing else is going
    // to turn it, and the Topçu's barrel has to point down its own line of fire.
    unit.faceTowards(target.position.x, target.position.z, dt);
    const ranged = unit.attack.ranged;
    const damage = unit.attack.tryFire(target);
    if (damage !== null) {
      const travel = options?.onShot?.({ attacker: unit, target, ranged, damage }) ?? 0;
      if (travel > 0 && options?.impacts) {
        // In the air: the target keeps its health until the shot arrives, so the
        // gun may well fire again before this one lands. That overkill is the
        // honest cost of a weapon with travel time, not a bug to smooth over.
        options.impacts.schedule(unit, target, damage, ranged, travel);
      } else {
        const change = target.health.damage(damage);
        onHit?.({ attacker: unit, target, change, ranged });
      }
    }
    if (target.health.depleted) unit.setAttackTarget(null);
  }
}

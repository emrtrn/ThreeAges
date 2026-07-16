/**
 * Soft-counter damage resolution — Vertical Slice Plan v0.2 §45 ("Savaş"),
 * GDD 12 §33.
 *
 * One function decides what a hit is worth: the attacker's base damage scaled by
 * its multiplier against the target's armour class. Every damage source in the
 * match goes through here, so the counter table is a data table rather than a
 * rule scattered across the unit, structure and siege code paths.
 */
import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { CombatTarget } from "./combatTarget";

/**
 * Damage one hit from `attacker` applies to `target`, before health clamping.
 *
 * The multiplier is looked up on the *attacker*: §33 is a table of what each
 * attacker does to each armour class, not a table of resistances. That is what
 * lets a Ram read as anti-building (2.50 vs structure) while its raw 28 damage
 * stays weak against troops.
 */
export function resolveDamage(attacker: UnitBalanceStats, target: CombatTarget): number {
  return attacker.attackDamage * attacker.damageMultipliers[target.armorClass];
}

/**
 * Whether `attacker` may damage `target` at all.
 *
 * Friendly fire is absent by construction rather than by an area-damage guard
 * (plan §45 "Dost ateşi olmaması"): nothing in the match can resolve a hit onto
 * a target of the same kingdom, so an attack-move sweeping past its own front
 * line cannot hurt it.
 */
export function isHostile(attackerOwner: string, target: CombatTarget): boolean {
  return target.owner !== attackerOwner;
}

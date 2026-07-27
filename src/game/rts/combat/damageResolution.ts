/**
 * Soft-counter damage resolution — Vertical Slice Plan v0.2 §45 ("Savaş"),
 * GDD 12 §33.
 *
 * One function decides what a hit is worth: the attacker's base damage scaled by
 * its multiplier against the target's armour class. Every damage source in the
 * match goes through here, so the counter table is a data table rather than a
 * rule scattered across the unit, structure and siege code paths.
 */
import { MAX_AURA_DAMAGE_RESISTANCE, type UnitBalanceStats } from "../../data/gameDataTypes";
import type { CombatTarget } from "./combatTarget";

/**
 * Damage one hit from `attacker` applies to `target`, before health clamping.
 *
 * The multiplier is looked up on the *attacker*: §33 is a table of what each
 * attacker does to each armour class, not a table of resistances. That is what
 * lets the Topçu read as anti-building (2.50 vs structure) while its raw 34 damage
 * stays weak against troops.
 *
 * The target's own {@link CombatTarget.damageResistance} is then taken off the
 * result. That is not a second counter table — it is a *granted* protection a
 * support building is projecting onto this target right now, and it belongs
 * here for the same reason the counters do: every hit in the match, from a unit,
 * a tower, a cannonball or a torch, comes through this one function, so a
 * protection applied here cannot be missed by one damage path.
 */
type DamageSourceStats = Pick<UnitBalanceStats, "attackDamage" | "damageMultipliers">;

export function resolveDamage(attacker: DamageSourceStats, target: CombatTarget): number {
  const raw = attacker.attackDamage * attacker.damageMultipliers[target.armorClass];
  // Clamped rather than trusted: the field is written per tick by a system, and
  // a stray value above the cap would make a unit outright unkillable.
  const resistance = Math.min(Math.max(target.damageResistance ?? 0, 0), MAX_AURA_DAMAGE_RESISTANCE);
  return raw * (1 - resistance);
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

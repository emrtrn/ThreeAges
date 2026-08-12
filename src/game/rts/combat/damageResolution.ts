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
 * Two protections are then taken off the result, and neither is a second counter
 * table. They belong here for the same reason the counters do: every hit in the
 * match, from a unit, a tower, a cannonball or a torch, comes through this one
 * function, so a protection applied here cannot be missed by one damage path.
 *
 *  - {@link CombatTarget.damageResistance} is *granted*: a support building is
 *    projecting it onto this target right now.
 *  - {@link CombatTarget.stanceResistanceAt} is *earned*: the target has planted
 *    itself and raised a shield, and this is the blow it cannot answer.
 *
 * They compose the way two independent absorptions do — each takes its share of
 * what the other let through — rather than adding, which would let two 0.5
 * sources produce a unit nothing can hurt. The total is then held under the same
 * ceiling either one is capped at alone.
 */
type DamageSourceStats = Pick<UnitBalanceStats, "attackDamage" | "damageMultipliers">;

/**
 * @param fromDistance Ground distance the blow was struck from, as
 * {@link combatDistance} measures it. Required rather than optional because the
 * stance protection is invisible without it: a new damage path that forgot to
 * pass it would silently strip the shield off every unit it hit, and no test
 * that did not already know to look would notice. A source with genuinely no
 * position — a scripted or debug hit — passes 0, which reads as point blank and
 * is the honest answer for a blow that came from nowhere.
 */
export function resolveDamage(
  attacker: DamageSourceStats,
  target: CombatTarget,
  fromDistance: number,
): number {
  const raw = attacker.attackDamage * attacker.damageMultipliers[target.armorClass];
  // Clamped rather than trusted: the field is written per tick by a system, and
  // a stray value above the cap would make a unit outright unkillable.
  const granted = clampResistance(target.damageResistance ?? 0);
  const braced = clampResistance(target.stanceResistanceAt?.(fromDistance) ?? 0);
  const combined = 1 - (1 - granted) * (1 - braced);
  return raw * (1 - clampResistance(combined));
}

function clampResistance(value: number): number {
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), MAX_AURA_DAMAGE_RESISTANCE);
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

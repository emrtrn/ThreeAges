/**
 * Target acquisition, retargeting and the chase leash — Vertical Slice Plan
 * v0.2 §45 ("Savaş: Hedef kaybı ve yeniden hedefleme / Kovalama mesafesi"),
 * GDD 06 §38–§39.
 *
 * This decides *who* a unit is fighting. `unitCombat` decides when the hit
 * lands and `unitMovement` walks it there; keeping the three apart is what lets
 * an attack-move resume its advance without any of them knowing about the
 * others' state (plan §14).
 */
import type { CombatTarget } from "./combatTarget";
import { combatDistance } from "./combatTarget";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { Unit } from "../units/unit";
import { issueAttackOrder } from "../units/attackPathing";

/** Ground distance at which an attack-move counts as having arrived. */
const ATTACK_MOVE_ARRIVAL_RADIUS = 1.5;

export interface EngagementOptions {
  readonly navigation: RtsNavigation;
  /**
   * Every damageable thing on the field. The caller assembles it because only
   * the composition root sees units, centres and structures at once.
   */
  readonly targets: readonly CombatTarget[];
}

export function updateUnitEngagement(units: readonly Unit[], options: EngagementOptions): void {
  for (const unit of units) {
    if (unit.role === "worker" || unit.health.depleted || unit.dying) continue;

    releaseInvalidTarget(unit);
    if (!unit.attackTarget) acquireTarget(unit, options);
    if (!unit.attackTarget) resumeAttackMove(unit, options);
  }
}

/**
 * Turn an actual hostile hit into a defensive response.
 *
 * A plain Move still ignores enemies it merely passes (§23), but a combat unit
 * that has already taken damage must not keep marching as if nothing happened.
 * Existing attack intent wins: this is a fallback for an otherwise unengaged
 * defender, not a hidden retargeting rule. Workers remain outside combat.
 */
export function retaliateAgainstAttack(defender: Unit, attacker: Unit, navigation: RtsNavigation): boolean {
  if (defender.role === "worker" || defender.health.depleted || defender.dying
    || attacker.health.depleted || attacker.dying || defender.owner === attacker.owner
    || defender.attackTarget !== null) return false;
  // Hold Position can answer a nearby attacker, but it must never turn a ranged
  // hit into a chase order that its stance will immediately refuse to follow.
  if (defender.stance === "hold" && combatDistance(defender.position, attacker) > defender.attack.range) {
    return false;
  }
  issueAttackOrder(defender, attacker, navigation, true);
  return true;
}

/**
 * Drop a target that died, became unengageable, or dragged an auto-acquired
 * chase past its leash. A leashed unit is left idle on purpose: the next
 * `resumeAttackMove` sends it back to its advance, and a plain idle defender
 * simply holds the ground it drifted to rather than walking home through the
 * enemy that just baited it.
 */
function releaseInvalidTarget(unit: Unit): void {
  const target = unit.attackTarget;
  if (!target) return;
  if (target.health.depleted) {
    unit.setAttackTarget(null);
    return;
  }
  // A held unit never closes the distance, so a target outside its weapon range
  // is one it will never hit. Holding onto it would also block `acquireTarget`
  // from answering the enemy that *did* walk up — Hold Position must shoot back.
  if (unit.stance === "hold" && combatDistance(unit.position, target) > unit.attack.range) {
    unit.setAttackTarget(null);
    return;
  }
  if (unit.autoAcquired && unit.chaseDistance() > unit.attack.chaseRange) {
    unit.setAttackTarget(null);
  }
}

/**
 * Pick the nearest hostile inside the acquisition circle.
 *
 * Only a unit that is not already carrying out a movement order may acquire: a
 * plain Move is a transit order and must not be derailed by anything the unit
 * walks past (GDD 06 §23). Attack-move is the order that opts into stopping,
 * and Hold acquires only what is already in weapon range.
 */
function acquireTarget(unit: Unit, options: EngagementOptions): void {
  const range = unit.attack.acquisitionRange;
  if (range <= 0) return;
  const onTransitOrder = unit.attackMoveTarget === null
    && (unit.pathTarget !== null || unit.moveTarget !== null);
  if (onTransitOrder) return;

  const limit = unit.stance === "hold" ? Math.min(range, unit.attack.range) : range;
  const candidate = nearestHostile(unit, limit, options);
  if (!candidate) return;

  // Hold never takes a step, so it gets the target without a pursuit path.
  if (unit.stance === "hold") unit.setAttackTarget(candidate, true);
  else issueAttackOrder(unit, candidate, options.navigation, true);
}

/**
 * Send an idle attack-mover onward once whatever it stopped for is gone.
 * Arrival ends the order so the unit reverts to plain defensive acquisition.
 */
function resumeAttackMove(unit: Unit, options: EngagementOptions): void {
  const destination = unit.attackMoveTarget;
  if (!destination || unit.stance === "hold") return;
  if (unit.pathTarget !== null) return;
  const remaining = Math.hypot(unit.position.x - destination.x, unit.position.z - destination.z);
  if (remaining <= ATTACK_MOVE_ARRIVAL_RADIUS) {
    unit.attackMoveTarget = null;
    return;
  }
  const path = options.navigation.plan(unit.position, destination);
  // An unreachable destination ends the order rather than leaving the unit
  // replanning the same failed route every tick.
  if (path) unit.setAttackMovePath(path, destination);
  else unit.attackMoveTarget = null;
}

function nearestHostile(
  unit: Unit,
  range: number,
  options: EngagementOptions,
): CombatTarget | null {
  let best: CombatTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestIsStructure = true;
  for (const target of options.targets) {
    if (target === (unit as CombatTarget)) continue;
    if (target.owner === unit.owner || target.health.depleted) continue;
    const distance = combatDistance(unit.position, target);
    if (distance > range) continue;
    // Troops outrank buildings at any distance inside the circle: a Guard that
    // answers the wall instead of the Archer shooting it reads as broken.
    const isStructure = target.armorClass === "structure";
    if (best && bestIsStructure === isStructure && distance >= bestDistance) continue;
    if (best && bestIsStructure !== isStructure && bestIsStructure === false) continue;
    best = target;
    bestDistance = distance;
    bestIsStructure = isStructure;
  }
  return best;
}

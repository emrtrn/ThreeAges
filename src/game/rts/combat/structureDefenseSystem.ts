/**
 * Completed-structure ranged defense.
 *
 * This deliberately owns only stationary target choice, volley timing and
 * damage. It shares `resolveDamage` with units and reports every arrow to the
 * composition root so the existing projectile presentation stays authoritative.
 */
import { combatDistance, type CombatTarget } from "./combatTarget";
import { resolveDamage } from "./damageResolution";
import type { PlacedStructure } from "../structures/placedStructureSystem";

export interface StructureDefenseHit {
  readonly attacker: PlacedStructure;
  readonly target: CombatTarget;
  /** Which arrow in the just-fired volley landed this hit. */
  readonly arrowIndex: number;
}

export type StructureAttackOrderResult = "ordered" | "not-defensive" | "incomplete" | "out-of-range";

export class StructureDefenseSystem {
  private readonly cooldowns = new Map<number, number>();
  /** A player-directed target takes precedence over automatic nearest-target fire. */
  private readonly orderedTargets = new Map<number, CombatTarget>();

  /** Direct a completed defensive structure to prioritize one enemy in its range. */
  orderAttack(structure: PlacedStructure, target: CombatTarget): StructureAttackOrderResult {
    const defense = structure.stats.defense;
    if (!defense) return "not-defensive";
    if (!structure.construction.complete || structure.health.depleted) return "incomplete";
    if (target.owner === structure.owner || target.health.depleted) return "out-of-range";
    if (combatDistance(structure.position, target) > defense.attackRange) return "out-of-range";
    this.orderedTargets.set(structure.id, target);
    return "ordered";
  }

  update(
    structures: readonly PlacedStructure[],
    targets: readonly CombatTarget[],
    dt: number,
    onHit?: (hit: StructureDefenseHit) => void,
  ): void {
    const liveIds = new Set<number>();
    for (const structure of structures) {
      liveIds.add(structure.id);
      const defense = structure.stats.defense;
      if (!defense || !structure.construction.complete || structure.health.depleted) {
        this.cooldowns.delete(structure.id);
        this.orderedTargets.delete(structure.id);
        continue;
      }
      const cooldown = Math.max(0, (this.cooldowns.get(structure.id) ?? 0) - Math.max(0, dt));
      if (cooldown > 0) {
        this.cooldowns.set(structure.id, cooldown);
        continue;
      }
      const orderedTarget = this.orderedTargets.get(structure.id);
      if (orderedTarget && (!targets.includes(orderedTarget)
        || orderedTarget.owner === structure.owner || orderedTarget.health.depleted)) {
        this.orderedTargets.delete(structure.id);
      }
      const commandedTarget = this.orderedTargets.get(structure.id) ?? null;
      // A direct target is intentionally not replaced by a nearer enemy. If it
      // steps out of range, the Karakol holds its volley until it returns or dies.
      const target = commandedTarget && combatDistance(structure.position, commandedTarget) <= defense.attackRange
        ? commandedTarget
        : commandedTarget
          ? null
          : nearestHostile(structure, defense.attackRange, targets);
      if (!target) {
        this.cooldowns.set(structure.id, 0);
        continue;
      }
      for (let arrowIndex = 0; arrowIndex < defense.arrowsPerVolley; arrowIndex += 1) {
        if (target.health.depleted) break;
        target.health.damage(resolveDamage(defense, target));
        onHit?.({ attacker: structure, target, arrowIndex });
      }
      this.cooldowns.set(structure.id, defense.attackCooldown);
    }
    for (const id of this.cooldowns.keys()) {
      if (!liveIds.has(id)) this.cooldowns.delete(id);
    }
    for (const id of this.orderedTargets.keys()) {
      if (!liveIds.has(id)) this.orderedTargets.delete(id);
    }
  }
}

/** Prefer enemy troops over buildings, then choose the nearest valid target. */
function nearestHostile(
  attacker: PlacedStructure,
  range: number,
  targets: readonly CombatTarget[],
): CombatTarget | null {
  let best: CombatTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestIsStructure = true;
  for (const target of targets) {
    if (target === attacker || target.owner === attacker.owner || target.health.depleted) continue;
    const distance = combatDistance(attacker.position, target);
    if (distance > range) continue;
    const isStructure = target.armorClass === "structure";
    if (best && bestIsStructure === isStructure && distance >= bestDistance) continue;
    if (best && bestIsStructure === false && isStructure) continue;
    best = target;
    bestDistance = distance;
    bestIsStructure = isStructure;
  }
  return best;
}

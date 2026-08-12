/**
 * Completed-structure ranged defense.
 *
 * This deliberately owns only stationary target choice, volley timing and
 * damage. It shares `resolveDamage` with units and reports every shot to the
 * composition root so the existing projectile presentation stays authoritative.
 *
 * A shot may take time to arrive. An arrow does not — the blow is struck and the
 * tracer is decoration over it — but the Town-age Karakol fires the Topçu's
 * lobbed ball, and a soldier who dies before the shell reaches him reads as
 * broken. So this mirrors `unitCombat`'s contract exactly: the presentation
 * layer is told a weapon went off and answers with the flight time, and a
 * positive answer parks the blow until the ball lands.
 */
import { combatDistance, type CombatTarget } from "./combatTarget";
import { resolveDamage } from "./damageResolution";
import type { PlacedStructure } from "../structures/placedStructureSystem";
import type { BuildingDefenseBalance } from "../../data/gameDataTypes";

/** A defensive structure's weapon going off, reported before the blow exists. */
export interface StructureDefenseShot {
  readonly attacker: PlacedStructure;
  readonly target: CombatTarget;
  /** Which shot in the just-fired volley this is. */
  readonly shotIndex: number;
  /** The weapon that fired, already resolved for the structure's active tier. */
  readonly defense: BuildingDefenseBalance;
  /** What this shot will be worth when it arrives, already resolved. */
  readonly damage: number;
}

/**
 * Told a weapon fired; answers how many seconds its shot needs to reach the
 * target. `0` (and no handler at all) lands the blow immediately.
 */
export type StructureDefenseShotHandler = (shot: StructureDefenseShot) => number | void;

interface StructureShotInFlight {
  readonly target: CombatTarget;
  readonly damage: number;
  /** Seconds of flight left; the blow lands when this reaches zero. */
  remaining: number;
}

export type StructureAttackOrderResult = "ordered" | "not-defensive" | "incomplete" | "out-of-range";

export class StructureDefenseSystem {
  private readonly cooldowns = new Map<number, number>();
  /** A player-directed target takes precedence over automatic nearest-target fire. */
  private readonly orderedTargets = new Map<number, CombatTarget>();
  /**
   * Shells still in the air. Held here rather than in the units'
   * `PendingImpactQueue` because that queue reports a `CombatHit`, whose
   * attacker is a `Unit` — a tower is not one, and widening that type would
   * silently put buildings in front of retaliation, which is a rule change
   * rather than a presentation one.
   */
  private readonly inFlight: StructureShotInFlight[] = [];

  /** Direct a completed defensive structure to prioritize one enemy in its range. */
  orderAttack(structure: PlacedStructure, target: CombatTarget): StructureAttackOrderResult {
    const defense = effectiveDefense(structure);
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
    onShot?: StructureDefenseShotHandler,
  ): void {
    // Shells fired on an earlier tick land before this tick's guns pick targets,
    // so a wall about to be finished off by one is already rubble by then.
    this.landArrivedShots(dt);
    const liveIds = new Set<number>();
    for (const structure of structures) {
      liveIds.add(structure.id);
      const defense = effectiveDefense(structure);
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
      for (let shotIndex = 0; shotIndex < defense.arrowsPerVolley; shotIndex += 1) {
        if (target.health.depleted) break;
        // The tower's own distance to what it is shooting at: a Karakol
        // outranges every held unit on the field, so this is precisely the blow
        // a raised shield is for.
        const damage = resolveDamage(defense, target, combatDistance(structure.position, target));
        const travel = onShot?.({ attacker: structure, target, shotIndex, defense, damage }) ?? 0;
        if (travel > 0) {
          // In the air: the target keeps its health until the shell arrives, so
          // the tower may well fire again before this one lands. That overkill
          // is the honest cost of a weapon with travel time, as it is for the
          // Topçu's gun.
          this.inFlight.push({ target, damage, remaining: travel });
        } else {
          target.health.damage(damage);
        }
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

  /** Drop every shell in the air — a restart has no shots left over. */
  clear(): void {
    this.inFlight.length = 0;
  }

  /**
   * Land every shell whose flight has elapsed. One that outlived its target hits
   * rubble and is simply dropped; one whose tower has since fallen still lands,
   * because it left the barrel.
   */
  private landArrivedShots(dt: number): void {
    const step = Math.max(0, dt);
    for (let i = this.inFlight.length - 1; i >= 0; i -= 1) {
      const shot = this.inFlight[i]!;
      shot.remaining -= step;
      if (shot.remaining > 0) continue;
      this.inFlight.splice(i, 1);
      if (shot.target.health.depleted) continue;
      shot.target.health.damage(shot.damage);
    }
  }
}

/** The weapon a structure is firing right now: its active tier's, or its base block's. */
function effectiveDefense(structure: PlacedStructure): BuildingDefenseBalance | null {
  return structure.defense ?? structure.stats.defense ?? null;
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

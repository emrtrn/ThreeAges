/**
 * The shove a gun throws at whatever has closed inside its minimum range —
 * siege crew plan Faz 3 (K-07/K-08).
 *
 * A gun with an authored `minAttackRange` cannot depress its barrel onto
 * something standing against its own wheels, so `unitCombat` withholds the shot
 * (never the target). This is what answers instead: a real blow on its own
 * cooldown, resolved through the same `resolveDamage` every other hit in the
 * match goes through, so armour-class multipliers and a held unit's shield apply
 * in exactly one place.
 *
 * Deliberately *not* a second mode inside {@link AttackComponent}. That
 * component owns one weapon's timing, and giving it a second cooldown would mean
 * every unit in the project carried the branch. It is also deliberately not the
 * `firebrandSystem` pattern: that is presentation over damage `unitCombat` had
 * already applied, and this blow has no other origin.
 *
 * Entirely opt-in on the data: a unit that authors no `kickDamage` is never
 * looked at, which is every unit but the artillery.
 */
import { combatDistance, type CombatTarget } from "./combatTarget";
import { isHostile, resolveDamage } from "./damageResolution";
import type { Unit } from "../units/unit";
import type { HealthChange } from "../units/health";

/** One shove landing, reported after the damage is already applied. */
export interface SiegeMeleeHit {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly change: HealthChange;
}

/**
 * Per-gun cooldowns, keyed by unit id.
 *
 * Held by the caller rather than on the unit for the same reason
 * `PendingImpactQueue` is: it is the system's bookkeeping, and a unit that never
 * shoves should not carry a field for one. Entries for units that have left the
 * field are pruned on the tick they stop being offered.
 */
export class SiegeMeleeState {
  private readonly cooldowns = new Map<number, number>();

  remaining(unitId: number): number {
    return this.cooldowns.get(unitId) ?? 0;
  }

  set(unitId: number, seconds: number): void {
    this.cooldowns.set(unitId, seconds);
  }

  advance(dt: number, live: ReadonlySet<number>): void {
    for (const [id, remaining] of [...this.cooldowns]) {
      if (!live.has(id)) {
        this.cooldowns.delete(id);
        continue;
      }
      const next = remaining - Math.max(0, dt);
      if (next <= 0) this.cooldowns.delete(id);
      else this.cooldowns.set(id, next);
    }
  }

  /** Live cooldown count, for tests and the perf overlay. Never read by gameplay. */
  get size(): number {
    return this.cooldowns.size;
  }
}

/**
 * Resolve one tick of close-quarters shoves.
 *
 * Three conditions, and each rules out a way this could look like a bug:
 *
 *  - The gun must be **standing**, not braced. A crew leaning on the carriage
 *    has its hands full; the shove is what the men do when they are on their
 *    feet because the gun cannot fire. `attacking` already means "in the firing
 *    band" ({@link Unit.updatePresentation}), so a gun that can shoot never
 *    kicks and a gun that cannot never stays braced.
 *  - The enemy must be inside `kickRange`, which the validator holds at or
 *    inside the minimum, so the shove covers exactly the hole the minimum leaves.
 *  - The gun's own cooldown must have elapsed, independent of `attackCooldown` —
 *    a 5.5 s reload has nothing to do with how fast a man can kick.
 *
 * Nearest hostile first, so a gun surrounded answers whatever is closest rather
 * than whichever body happens to be earliest in the list.
 */
export function updateSiegeMelee(
  units: readonly Unit[],
  targets: readonly CombatTarget[],
  dt: number,
  state: SiegeMeleeState,
  onHit?: (hit: SiegeMeleeHit) => void,
): void {
  const live = new Set<number>();
  for (const unit of units) live.add(unit.id);
  state.advance(dt, live);

  for (const unit of units) {
    const damage = unit.stats.kickDamage;
    const reach = unit.stats.kickRange;
    const cooldown = unit.stats.kickCooldown;
    // The validator refuses a partial set, so one present means all three are.
    if (damage === undefined || reach === undefined || cooldown === undefined) continue;
    if (unit.dying || unit.health.depleted) continue;
    // Workers remain passive until an actual hostile hit gave them the one
    // defensive target `engagementSystem` permits. Their nearby punch must not
    // turn the zero-acquisition worker role into an automatic attacker.
    if (unit.role === "worker" && !unit.autoAcquired) continue;
    if (state.remaining(unit.id) > 0) continue;

    let nearest: CombatTarget | null = null;
    let nearestDistance = Infinity;
    for (const target of targets) {
      if (target === (unit as unknown as CombatTarget)) continue;
      if (target.health.depleted || target.dying === true) continue;
      if (!isHostile(unit.owner, target)) continue;
      const distance = combatDistance(unit.position, target);
      if (distance > reach || distance >= nearestDistance) continue;
      nearest = target;
      nearestDistance = distance;
    }
    if (!nearest) continue;

    state.set(unit.id, cooldown);
    // Through the shared resolver, so this blow reads the same counter table and
    // the same shields every other blow does — the whole reason K-08 refused to
    // make the kick a presentation flourish.
    const change = nearest.health.damage(
      resolveDamage({ attackDamage: damage, damageMultipliers: unit.stats.damageMultipliers }, nearest, nearestDistance),
    );
    // Counted after the damage is resolved, exactly as `attack.blowCount` is:
    // the crew's kick animation is told what happened, and is told it late.
    unit.noteMeleeBlow();
    onHit?.({ attacker: unit, target: nearest, change });
  }
}

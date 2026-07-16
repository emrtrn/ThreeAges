/**
 * Attack cadence and damage application — Vertical Slice Plan v0.2 §45.
 *
 * Faz 1 shipped this as a melee-only component. Faz 7 keeps its scope identical
 * — timing plus one resolved hit — and only widens *what* a hit is worth: the
 * armour-class multiplier and the melee/ranged distinction now come from data.
 * Target choice, pursuit, projectile visuals and death cleanup all stay in their
 * own systems (plan §14).
 */
import type { UnitBalanceStats } from "../../data/gameDataTypes";
import { resolveDamage } from "../combat/damageResolution";
import type { CombatTarget } from "../combat/combatTarget";
import type { HealthChange } from "./health";

export class AttackComponent {
  private cooldownRemaining = 0;

  constructor(private readonly stats: UnitBalanceStats) {}

  get cooldown(): number {
    return this.stats.attackCooldown;
  }

  get range(): number {
    return this.stats.attackRange;
  }

  get ranged(): boolean {
    return this.stats.attackType === "ranged";
  }

  /** Zero means the unit never picks its own targets — the worker's opt-out. */
  get acquisitionRange(): number {
    return this.stats.acquisitionRange;
  }

  get chaseRange(): number {
    return this.stats.chaseRange;
  }

  update(dt: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - Math.max(0, dt));
  }

  get ready(): boolean {
    return this.cooldownRemaining === 0;
  }

  /** Damage this attack would deal to a target, for UI counter hints. */
  damageAgainst(target: CombatTarget): number {
    return resolveDamage(this.stats, target);
  }

  /**
   * Damage a living target when the cooldown has elapsed. The caller has already
   * confirmed range and hostility; this only owns the timing and the amount.
   */
  tryHit(target: CombatTarget): HealthChange | null {
    if (!this.ready || target.health.depleted) return null;
    const change = target.health.damage(resolveDamage(this.stats, target));
    this.cooldownRemaining = this.stats.attackCooldown;
    return change;
  }
}

/**
 * Basic melee cadence â€” Vertical Slice Plan v0.2 Faz 1.
 *
 * This component owns only timing and damage application. Target choice,
 * pursuit and death cleanup remain in their respective RTS systems.
 */
import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { HealthChange, HealthComponent } from "./health";

export class MeleeAttackComponent {
  readonly damage: number;
  readonly cooldown: number;
  readonly range: number;
  private cooldownRemaining = 0;

  constructor(stats: UnitBalanceStats) {
    this.damage = stats.attackDamage;
    this.cooldown = stats.attackCooldown;
    this.range = stats.attackRange;
  }

  update(dt: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - Math.max(0, dt));
  }

  get ready(): boolean {
    return this.cooldownRemaining === 0;
  }

  /** Damage a living target when the attack's cooldown has elapsed. */
  tryHit(target: HealthComponent): HealthChange | null {
    if (!this.ready || target.depleted) return null;
    const change = target.damage(this.damage);
    this.cooldownRemaining = this.cooldown;
    return change;
  }
}

/**
 * Unit health state — Vertical Slice Plan v0.2 §21 / Combat GDD §45.
 *
 * Owns only bounded hit points: current/max health, a display-ready ratio, and
 * clamped damage/healing operations. Death/removal, UI bars, and combat timing
 * deliberately remain separate Faz 1 steps.
 */

export interface HealthChange {
  /** Amount actually applied after clamping to the valid health range. */
  readonly applied: number;
  /** Health before this operation. */
  readonly previous: number;
  /** Health after this operation. */
  readonly current: number;
  /** True only when this operation reduced a living target to zero. */
  readonly depleted: boolean;
}

/** Small, data-agnostic health component for a live RTS unit or structure. */
export class HealthComponent {
  readonly max: number;
  private currentValue: number;

  constructor(max: number) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new RangeError("Health maximum must be a positive finite number");
    }
    this.max = max;
    this.currentValue = max;
  }

  get current(): number {
    return this.currentValue;
  }

  /** Normalized [0, 1] value for later health-bar/debug presentation. */
  get ratio(): number {
    return this.currentValue / this.max;
  }

  get depleted(): boolean {
    return this.currentValue === 0;
  }

  /** Apply a non-negative damage amount without allowing health below zero. */
  damage(amount: number): HealthChange {
    this.assertAmount(amount, "Damage");
    const previous = this.currentValue;
    const applied = Math.min(amount, previous);
    this.currentValue -= applied;
    return {
      applied,
      previous,
      current: this.currentValue,
      depleted: previous > 0 && this.currentValue === 0,
    };
  }

  /** Restore a non-negative amount without allowing health above its maximum. */
  heal(amount: number): HealthChange {
    this.assertAmount(amount, "Healing");
    const previous = this.currentValue;
    const applied = Math.min(amount, this.max - previous);
    this.currentValue += applied;
    return { applied, previous, current: this.currentValue, depleted: false };
  }

  /** Return to full health for match restart or a future respawn flow. */
  reset(): void {
    this.currentValue = this.max;
  }

  private assertAmount(amount: number, label: string): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(`${label} must be a non-negative finite number`);
    }
  }
}

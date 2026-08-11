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
  private maxValue: number;
  private currentValue: number;
  private impacts = 0;

  constructor(max: number) {
    if (!Number.isFinite(max) || max <= 0) {
      throw new RangeError("Health maximum must be a positive finite number");
    }
    this.maxValue = max;
    this.currentValue = max;
  }

  get current(): number {
    return this.currentValue;
  }

  get max(): number {
    return this.maxValue;
  }

  /** Normalized [0, 1] value for later health-bar/debug presentation. */
  get ratio(): number {
    return this.currentValue / this.maxValue;
  }

  get depleted(): boolean {
    return this.currentValue === 0;
  }

  /**
   * How many blows this body has actually *taken*, counted purely so a
   * presentation can play one flinch per hit — Guard animation plan Faz 2.
   *
   * The mirror image of `AttackComponent.blowCount`, and here rather than on the
   * unit for one reason: this is the single place every damage source in the
   * match already passes through. Melee and ranged blows land in `unitCombat`, a
   * gun's shell lands a second later out of `PendingImpactQueue`, a tower fires
   * from `structureDefenseSystem`, a wolf bites in `predatorSystem` and a bull
   * gores in `wildlifeRetaliation` — five call sites today, and a counter kept
   * anywhere else would have to be threaded through all of them and remembered
   * by the sixth. Counted where the hit points actually move, no source can be
   * missed.
   *
   * Only real damage counts: `applied` is zero for a blow on an already-dead
   * body, and healing never reaches here at all. Nothing in combat reads it, so
   * removing every presentation would leave the fight identical. Monotonic for
   * the body's lifetime.
   */
  get impactCount(): number {
    return this.impacts;
  }

  /** Apply a non-negative damage amount without allowing health below zero. */
  damage(amount: number): HealthChange {
    this.assertAmount(amount, "Damage");
    const previous = this.currentValue;
    const applied = Math.min(amount, previous);
    this.currentValue -= applied;
    if (applied > 0) this.impacts += 1;
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
    const headroom = this.maxValue - previous;
    const applied = Math.min(amount, headroom);
    // A heal that covers the whole headroom lands *exactly* on max, rather than on
    // `previous + (max - previous)` — which in floating point undershoots by a few
    // parts in 1e13 whenever `previous` came from a fractional damage roll. That
    // residue never heals away: the building sits a hair under full forever, so its
    // health bar never fills and it keeps quoting a repair for damage no one can
    // see. The comparison is `>=` so an over-heal takes the same exact path.
    this.currentValue = applied >= headroom ? this.maxValue : previous + applied;
    return { applied, previous, current: this.currentValue, depleted: false };
  }

  /** Return to full health for match restart or a future respawn flow. */
  reset(): void {
    this.currentValue = this.maxValue;
  }

  /**
   * Raise a live target's maximum, carrying current health up by the same
   * amount, so the damage it has taken is preserved as an absolute figure.
   *
   * The delta — not the ratio, and not a plain ceiling raise. Raising only the
   * ceiling made an *undamaged* building damaged: a full 700/700 upgrading to a
   * 1000 maximum became 700/1000 and read as having lost 300 hit points it never
   * had, permanently, without ever being attacked. Preserving the ratio instead
   * would silently heal a building that was under attack while it levelled.
   * Carrying the delta does both correctly: 700/700 → 1000/1000, and a building
   * 200 down at 500/700 → 800/1000, still 200 down.
   */
  upgradeMax(nextMax: number): void {
    if (!Number.isFinite(nextMax) || nextMax < this.maxValue) {
      throw new RangeError("Health upgrades must be finite and may not lower the maximum");
    }
    this.currentValue += nextMax - this.maxValue;
    this.maxValue = nextMax;
  }

  /**
   * Set a new maximum in either direction and clamp current health into range.
   * Unlike {@link upgradeMax} this may *lower* the ceiling — used when an age
   * transition resets a levelled building back to its base Level 1 durability.
   */
  setMax(nextMax: number): void {
    if (!Number.isFinite(nextMax) || nextMax <= 0) {
      throw new RangeError("Health maximum must be a positive finite number");
    }
    this.maxValue = nextMax;
    if (this.currentValue > nextMax) this.currentValue = nextMax;
  }

  private assertAmount(amount: number, label: string): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(`${label} must be a non-negative finite number`);
    }
  }
}

/**
 * Shots that are still in the air.
 *
 * Most weapons in the slice resolve the moment they fire: the blow is instant
 * and the tracer that follows is pure decoration. An artillery shell is not —
 * it is lobbed, it hangs for the better part of a second, and a wall that
 * cracks while the ball is still climbing reads as broken. So the gun's damage
 * is parked here at the moment of firing and applied when the ball lands.
 *
 * The amount is resolved at *fire* time, not at impact: what the shell is worth
 * was decided by the gun that fired it and the thing it was aimed at, and a
 * defensive aura that goes up mid-flight should not retroactively soften a shot
 * already on its way. Only whether there is still something to hit is decided
 * on arrival.
 *
 * The queue ticks on the simulation delta, the same clock the shell's visuals
 * are advanced on, so the two stay together at any game speed and both freeze
 * on pause.
 */
import type { CombatTarget } from "./combatTarget";
import type { Unit } from "../units/unit";
import type { CombatHit } from "../units/unitCombat";

interface PendingImpact {
  readonly attacker: Unit;
  readonly target: CombatTarget;
  readonly damage: number;
  readonly ranged: boolean;
  /** Seconds of flight left; the blow lands when this reaches zero. */
  remaining: number;
}

export class PendingImpactQueue {
  private readonly shots: PendingImpact[] = [];

  /** Shots currently in flight — read by tests and the debug overlay. */
  get size(): number {
    return this.shots.length;
  }

  /**
   * Park a shot's damage for `seconds` of flight. The caller has already spent
   * the attacker's cooldown and resolved the amount.
   */
  schedule(attacker: Unit, target: CombatTarget, damage: number, ranged: boolean, seconds: number): void {
    this.shots.push({ attacker, target, damage, ranged, remaining: Math.max(0, seconds) });
  }

  /**
   * Land every shot whose flight has elapsed, reporting each as an ordinary
   * {@link CombatHit} so retaliation and the debug overlay see no difference
   * between a delayed blow and an instant one.
   *
   * A shell whose target died mid-flight is dropped without a hit: it lands on
   * rubble. A shell fired by a gun that has since died still lands — it left
   * the barrel.
   */
  update(dt: number, onHit?: (hit: CombatHit) => void): void {
    const step = Math.max(0, dt);
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i]!;
      shot.remaining -= step;
      if (shot.remaining > 0) continue;
      this.shots.splice(i, 1);
      if (shot.target.health.depleted) continue;
      const change = shot.target.health.damage(shot.damage);
      onHit?.({ attacker: shot.attacker, target: shot.target, change, ranged: shot.ranged });
    }
  }

  /** Drop everything in the air — a restart has no shells left over. */
  clear(): void {
    this.shots.length = 0;
  }
}

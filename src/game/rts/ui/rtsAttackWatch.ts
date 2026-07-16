/**
 * "Saldırı altında" detection — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * Combat has no damage-event bus: `updateUnitCombat` reports hits to the debug
 * overlay through a callback, and structures are damaged through the plain
 * {@link HealthComponent}. Rather than thread an event channel through combat
 * for one HUD line, this samples health per frame and reports what *lost* health
 * since the last look. Polling is also the more honest signal for the criterion:
 * §51 asks whether a building is under attack, and a building being chewed on by
 * something the combat system never classified as an attack still counts.
 *
 * Pure state, so `test:engine` drives it without a scene.
 */

export interface RtsAttackWatchSample {
  /** Stable per-match identity; a rebuilt structure may reuse a freed id. */
  readonly id: string;
  readonly health: number;
}

export class RtsAttackWatch {
  private readonly lastHealth = new Map<string, number>();

  /**
   * @returns the ids whose health dropped since the previous call, in sample
   * order. A newly seen id never reports: its first sample establishes the
   * baseline, so placing a building cannot read as damage to it.
   */
  observe(samples: readonly RtsAttackWatchSample[]): readonly string[] {
    const damaged: string[] = [];
    const seen = new Set<string>();
    for (const sample of samples) {
      seen.add(sample.id);
      const previous = this.lastHealth.get(sample.id);
      this.lastHealth.set(sample.id, sample.health);
      if (previous !== undefined && sample.health < previous) damaged.push(sample.id);
    }
    // Forget the destroyed. Left in, a demolished outpost's stale entry would
    // make a *rebuilt* one at the same id look damaged on its first sample.
    for (const id of this.lastHealth.keys()) {
      if (!seen.has(id)) this.lastHealth.delete(id);
    }
    return damaged;
  }

  reset(): void {
    this.lastHealth.clear();
  }
}

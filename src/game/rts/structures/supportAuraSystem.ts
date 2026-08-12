/**
 * Temple support field — the passive counterpart of {@link StructureDefenseSystem}.
 *
 * A completed structure whose balance declares an `aura` block sustains its own
 * kingdom's units standing inside its radius: it mends them steadily, and it
 * absorbs part of every blow they take while they are in it. Both effects are
 * driven off the same data block and the same radius, so the Temple is one place
 * on the map rather than two overlapping ones.
 *
 * Two rules make the resistance side safe to leave in `Unit.damageResistance`,
 * which combat reads without knowing this system exists:
 *
 *  - It is recomputed from zero every tick, for every unit, before any field is
 *    applied. A unit that walks out of a Temple's reach — or whose Temple was
 *    just razed — is unprotected on the very next tick, with no bookkeeping to
 *    unwind and nothing to leak if a structure disappears mid-fight.
 *  - Overlapping fields do not stack, they take the strongest. Stacking would
 *    make a cluster of Temples a wall of unkillable troops, which is exactly the
 *    outcome the per-building cap exists to prevent.
 *
 * Ordering: run this *before* combat resolves, so a unit is already protected on
 * the tick it is hit, and healing lands before the death sweep reads the health
 * it produced.
 */
import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import type { HealthComponent } from "../units/health";
import type { UnitOwner } from "../units/unit";

/** What a support field needs from a structure — narrower than `PlacedStructure`. */
export interface AuraSourceStructure {
  readonly owner: UnitOwner;
  readonly stats: Pick<BuildingBalanceStats, "aura">;
  readonly construction: { readonly complete: boolean };
  readonly health: HealthComponent;
  readonly x: number;
  readonly z: number;
}

/** What a support field needs from a unit; `Unit` satisfies it structurally. */
export interface AuraTargetUnit {
  readonly owner: UnitOwner;
  readonly position: { readonly x: number; readonly z: number };
  readonly health: HealthComponent;
  /** A unit already playing its defeat pose is past saving; the field skips it. */
  readonly dying: boolean;
  damageResistance: number;
  /**
   * Whether this tick's pass actually restored hit points to this body.
   *
   * Presentation-only, and written here rather than derived from "inside the
   * radius and below full health" because those two are not the same fact: a
   * unit at full health standing in the field is receiving nothing, and this is
   * the one place that already knows it. It follows the same
   * rewritten-from-zero rule as {@link damageResistance}, so a healed, razed or
   * departed unit stops claiming it on the very next tick with nothing to unwind.
   */
  mending: boolean;
}

/** One unit's live support state, for the debug overlay and the selection panel. */
export interface SupportAuraEffect {
  readonly healed: number;
  readonly damageResistance: number;
}

export class SupportAuraSystem {
  /** Units the last {@link update} actually reached, for readouts only. */
  private readonly effects = new Map<AuraTargetUnit, SupportAuraEffect>();

  update(
    structures: readonly AuraSourceStructure[],
    units: readonly AuraTargetUnit[],
    dt: number,
  ): void {
    this.effects.clear();
    for (const unit of units) {
      unit.damageResistance = 0;
      unit.mending = false;
    }
    const delta = Math.max(0, dt);
    const sources = structures.filter(isActiveAuraSource);
    if (sources.length === 0) return;
    for (const unit of units) {
      if (unit.dying || unit.health.depleted) continue;
      let healed = 0;
      let resistance = 0;
      for (const source of sources) {
        const aura = source.stats.aura!;
        if (source.owner !== unit.owner) continue;
        if (!withinAura(source, unit, aura.radius)) continue;
        healed += unit.health.heal(aura.healPerSecond * delta).applied;
        resistance = Math.max(resistance, aura.damageResistance);
      }
      if (resistance === 0 && healed === 0) continue;
      unit.damageResistance = resistance;
      // Strictly "hit points moved", not "stood in the radius": a unit already at
      // full health takes nothing from the field, and kneeling to be tended for a
      // wound it does not have is the one reading this pose must not have.
      unit.mending = healed > 0;
      this.effects.set(unit, { healed, damageResistance: resistance });
    }
  }

  /** Support state applied to this unit on the last tick, or null when none was. */
  effectFor(unit: AuraTargetUnit): SupportAuraEffect | null {
    return this.effects.get(unit) ?? null;
  }

  /** How many of an owner's units the last tick's fields reached. */
  sustainedCount(owner: UnitOwner): number {
    let count = 0;
    for (const unit of this.effects.keys()) {
      if (unit.owner === owner) count += 1;
    }
    return count;
  }

  clear(): void {
    this.effects.clear();
  }
}

/**
 * A field is projected only by a finished, standing building. A construction
 * site does not yet protect anything — that is what the 200 wood and the build
 * time are *for* — and a razed one has already left the structure list.
 */
function isActiveAuraSource(structure: AuraSourceStructure): boolean {
  return structure.stats.aura !== undefined
    && structure.construction.complete
    && !structure.health.depleted;
}

function withinAura(
  source: AuraSourceStructure,
  unit: AuraTargetUnit,
  radius: number,
): boolean {
  const dx = unit.position.x - source.x;
  const dz = unit.position.z - source.z;
  return dx * dx + dz * dz <= radius * radius;
}

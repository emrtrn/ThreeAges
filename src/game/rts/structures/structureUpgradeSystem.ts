/**
 * Per-instance, in-age building level upgrades (Level 1 -> 2 -> 3).
 *
 * This axis is independent of the Settlement -> Town age transition (see
 * `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`): each building is
 * levelled *individually*, from its own selection panel, paying its own cost and
 * running its own timer. Two Barracks of the same owner can sit at different
 * levels. There is no age gate — a level-up is always available in the current
 * age as long as the building's data still has a next step.
 *
 * The AI still reasons about a *type* reaching a tier (its §53 composition needs
 * one Barracks at level 2 to unlock Archers), so a thin type-oriented facade
 * ({@link startForType} / {@link typeSnapshot}) sits on top of the instance core.
 */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { BuildingLevelBalance } from "../../data/gameDataTypes";

export type StructureUpgradeResult =
  | "started"
  | "at-max-level"
  | "already-upgrading"
  | "under-construction"
  | "no-eligible-structure"
  | "insufficient-resources";

export interface StructureUpgradeEvent {
  readonly structure: PlacedStructure;
  readonly type: "completed" | "cancelled";
  /** The level the structure holds after the event (post-promotion on completion). */
  readonly level: number;
}

export interface StructureUpgradeSnapshot {
  /** Current in-age level of the instance (1..{@link maxLevel}). */
  readonly level: number;
  /** Highest level this building's data defines (1 when it has no `levels`). */
  readonly maxLevel: number;
  readonly upgrading: boolean;
  readonly remainingSeconds: number;
  /** Cost of the next level step, or null when the instance is already at max. */
  readonly nextCost: Readonly<Record<string, number>> | null;
  /** True when the instance can go no higher — the panel's "fully upgraded" state. */
  readonly completed: boolean;
}

interface UpgradeState {
  readonly structure: PlacedStructure;
  readonly step: BuildingLevelBalance;
  readonly reservation: ResourceReservation;
  remainingSeconds: number;
}

export class StructureUpgradeSystem {
  /** Keyed by structure id so a destroyed-then-reused reference cannot collide. */
  private readonly upgrades = new Map<number, UpgradeState>();
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
  ) {}

  isUpgrading(structure: PlacedStructure): boolean {
    return this.upgrades.has(structure.id);
  }

  snapshot(structure: PlacedStructure): StructureUpgradeSnapshot {
    const state = this.upgrades.get(structure.id);
    const next = this.nextStep(structure);
    return {
      level: structure.level,
      maxLevel: this.maxLevel(structure),
      upgrading: state !== undefined,
      remainingSeconds: state?.remainingSeconds ?? 0,
      nextCost: next?.cost ?? null,
      completed: next === null && this.maxLevel(structure) > 1,
    };
  }

  /** Start levelling a single completed building to its next level. */
  start(structure: PlacedStructure): StructureUpgradeResult {
    if (this.upgrades.has(structure.id)) return "already-upgrading";
    if (!structure.construction.complete) return "under-construction";
    const step = this.nextStep(structure);
    if (!step) return "at-max-level";
    const reservation = this.kingdoms.get(structure.owner).wallet.reserve(step.cost);
    if (!reservation) return "insufficient-resources";
    this.upgrades.set(structure.id, {
      structure,
      step,
      reservation,
      remainingSeconds: step.durationSeconds,
    });
    return "started";
  }

  update(deltaSeconds: number): StructureUpgradeEvent[] {
    const events: StructureUpgradeEvent[] = [];
    for (const [id, state] of this.upgrades) {
      // A building razed mid-upgrade refunds its reservation, exactly as the
      // type-wide research did when its last structure fell.
      if (!this.structures.all().includes(state.structure)) {
        this.kingdoms.get(state.structure.owner).wallet.refund(state.reservation);
        this.upgrades.delete(id);
        events.push({ structure: state.structure, type: "cancelled", level: state.structure.level });
        continue;
      }
      state.remainingSeconds = Math.max(0, state.remainingSeconds - Math.max(0, deltaSeconds));
      if (state.remainingSeconds > 0) continue;
      this.kingdoms.get(state.structure.owner).wallet.commit(state.reservation);
      this.upgrades.delete(id);
      this.promote(state.structure, state.step);
      events.push({ structure: state.structure, type: "completed", level: state.structure.level });
    }
    return events;
  }

  reset(): void {
    for (const state of this.upgrades.values()) {
      this.kingdoms.get(state.structure.owner).wallet.refund(state.reservation);
    }
    this.upgrades.clear();
  }

  /**
   * AI facade: start the next level on the first eligible building of a type.
   * The §53 tier gate only needs *one* instance of the type at the target level,
   * so this promotes a single Barracks rather than the whole type.
   */
  startForType(owner: UnitOwner, buildingId: string): StructureUpgradeResult {
    const structure = this.structures.ownedBy(owner).find((item) =>
      item.stats.id === buildingId
      && item.construction.complete
      && !this.upgrades.has(item.id)
      && this.nextStep(item) !== null);
    if (!structure) return "no-eligible-structure";
    return this.start(structure);
  }

  /**
   * AI facade: whether any building of a type has reached level 2 (`completed`)
   * or is being levelled right now (`upgrading`). Mirrors what the barracks tier
   * gate reads off `structure.level`.
   */
  typeSnapshot(owner: UnitOwner, buildingId: string): { readonly completed: boolean; readonly upgrading: boolean } {
    const owned = this.structures.ownedBy(owner).filter((item) => item.stats.id === buildingId);
    return {
      completed: owned.some((item) => item.level >= 2),
      upgrading: owned.some((item) => this.upgrades.has(item.id)),
    };
  }

  /** The data step that promotes this structure to its next level, or null at max. */
  private nextStep(structure: PlacedStructure): BuildingLevelBalance | null {
    const levels = structure.stats.levels;
    if (!levels) return null;
    return levels.find((entry) => entry.level === structure.level + 1) ?? null;
  }

  private maxLevel(structure: PlacedStructure): number {
    const levels = structure.stats.levels;
    if (!levels || levels.length === 0) return 1;
    return Math.max(structure.level, ...levels.map((entry) => entry.level));
  }

  private promote(structure: PlacedStructure, step: BuildingLevelBalance): void {
    structure.level = step.level;
    structure.health.upgradeMax(step.maxHealth);
    if (step.populationCapacity !== undefined) {
      // The panel and PopulationSystem read base + bonus, so a level's absolute
      // capacity becomes the delta over the building's base figure.
      structure.populationCapacityBonus = step.populationCapacity - (structure.stats.populationCapacity ?? 0);
    }
    if (step.territory) {
      structure.territoryControlRadius = step.territory.controlRadius;
      structure.territoryConnectedControlRadius = step.territory.connectedControlRadius;
    }
  }
}

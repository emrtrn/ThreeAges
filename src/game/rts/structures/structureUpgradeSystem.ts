/**
 * Type-wide, in-age building level research (Level 1 -> 2 -> 3).
 *
 * A completed upgrade belongs to an owner and building type, not to the one
 * building whose panel started it. Every completed House, Depot, or Barracks of
 * that owner receives the level, and a same-type building completed after the
 * research immediately inherits the current type level. Age changes reset this
 * research along with every building back to Level 1.
 */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import type { PlacedStructureSystem } from "./placedStructureSystem";
import type { HealthComponent } from "../units/health";
import type { ResourceReservation } from "../economy/resourceWallet";
import type {
  BuildingBalanceStats,
  BuildingLevelBalance,
  EconomyProductionBalance,
  SettlementAge,
} from "../../data/gameDataTypes";

/**
 * What this system needs from a building to level it — deliberately narrower
 * than `PlacedStructure`, which it used to take.
 *
 * The command centre is not a placed structure (it is spawned, never built) yet
 * it owns the same in-age Lv1→3 ladder and the same art variants, so the ladder
 * is expressed against the fields both shapes share rather than against one of
 * them. `PlacedStructure` satisfies this structurally.
 */
export interface UpgradableStructure {
  readonly owner: UnitOwner;
  readonly stats: BuildingBalanceStats;
  readonly construction: { readonly complete: boolean };
  readonly health: HealthComponent;
  level: number;
  populationCapacityBonus: number;
  territoryControlRadius: number | null;
  territoryConnectedControlRadius: number | null;
  economy: EconomyProductionBalance | null;
  defenseAttackDamage: number | null;
  marketCommission: number | null;
  queueCapacity: number | null;
}

export type StructureUpgradeResult =
  | "started"
  | "at-max-level"
  | "already-upgrading"
  | "under-construction"
  | "no-eligible-structure"
  | "insufficient-resources";

export interface StructureUpgradeEvent {
  /** A representative affected structure, retained for existing callers. */
  readonly structure: UpgradableStructure;
  /** Every completed instance changed by this type-wide research. */
  readonly structures: readonly UpgradableStructure[];
  readonly type: "completed" | "cancelled";
  /** The researched level after the event. */
  readonly level: number;
}

export interface StructureUpgradeSnapshot {
  /** Current researched in-age level of this building type. */
  readonly level: number;
  readonly maxLevel: number;
  readonly upgrading: boolean;
  readonly remainingSeconds: number;
  readonly nextCost: Readonly<Record<string, number>> | null;
  readonly completed: boolean;
}

interface UpgradeState {
  readonly owner: UnitOwner;
  readonly buildingId: string;
  readonly step: BuildingLevelBalance;
  readonly reservation: ResourceReservation;
  remainingSeconds: number;
}

export class StructureUpgradeSystem {
  /** One active research per owner/building type. */
  private readonly upgrades = new Map<string, UpgradeState>();
  /** The level already researched for each owner/building type in this age. */
  private readonly completedLevels = new Map<string, number>();

  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly ageForOwner: (owner: UnitOwner) => SettlementAge = () => "settlement",
    /**
     * Upgradables that are not placed structures — today the owner's command
     * centre. Supplied as a lookup rather than a second registry so this system
     * keeps one notion of "the owner's buildings" for research, reset and the
     * type-wide promotion sweep alike.
     */
    private readonly externalStructures: (owner: UnitOwner) => readonly UpgradableStructure[] = () => [],
  ) {}

  isUpgrading(structure: UpgradableStructure): boolean {
    return this.upgrades.has(this.keyFor(structure.owner, structure.stats.id));
  }

  /** The level a newly placed visual should show for this owner/building type. */
  levelFor(owner: UnitOwner, buildingId: string): number {
    return this.completedLevels.get(this.keyFor(owner, buildingId)) ?? 1;
  }

  snapshot(structure: UpgradableStructure): StructureUpgradeSnapshot {
    const key = this.keyFor(structure.owner, structure.stats.id);
    const state = this.upgrades.get(key);
    const level = this.currentLevel(structure);
    const next = this.nextStep(structure, level);
    return {
      level,
      maxLevel: this.maxLevel(structure),
      upgrading: state !== undefined,
      remainingSeconds: state?.remainingSeconds ?? 0,
      nextCost: next?.cost ?? null,
      completed: next === null && this.maxLevel(structure) > 1,
    };
  }

  /** Start the next type-wide level research from any completed instance. */
  start(structure: UpgradableStructure): StructureUpgradeResult {
    const key = this.keyFor(structure.owner, structure.stats.id);
    if (this.upgrades.has(key)) return "already-upgrading";
    if (!structure.construction.complete) return "under-construction";
    const step = this.nextStep(structure, this.currentLevel(structure));
    if (!step) return "at-max-level";
    const reservation = this.kingdoms.get(structure.owner).wallet.reserve(step.cost);
    if (!reservation) return "insufficient-resources";
    this.upgrades.set(key, {
      owner: structure.owner,
      buildingId: structure.stats.id,
      step,
      reservation,
      remainingSeconds: step.durationSeconds,
    });
    return "started";
  }

  update(deltaSeconds: number): StructureUpgradeEvent[] {
    const events: StructureUpgradeEvent[] = [];
    for (const [key, state] of this.upgrades) {
      const completed = this.completedOfType(state.owner, state.buildingId);
      // A research needs a completed instance to represent it. If the whole type
      // is razed while it is running, refund its reservation rather than silently
      // completing an upgrade with no building left to receive it.
      if (completed.length === 0) {
        this.kingdoms.get(state.owner).wallet.refund(state.reservation);
        this.upgrades.delete(key);
        continue;
      }
      state.remainingSeconds = Math.max(0, state.remainingSeconds - Math.max(0, deltaSeconds));
      if (state.remainingSeconds > 0) continue;
      this.kingdoms.get(state.owner).wallet.commit(state.reservation);
      this.completedLevels.set(key, state.step.level);
      this.upgrades.delete(key);
      const promoted = completed.filter((structure) => this.promote(structure, state.step));
      events.push({
        structure: promoted[0] ?? completed[0]!,
        structures: promoted,
        type: "completed",
        level: state.step.level,
      });
    }
    return events;
  }

  reset(): void {
    for (const state of this.upgrades.values()) {
      this.kingdoms.get(state.owner).wallet.refund(state.reservation);
    }
    this.upgrades.clear();
    this.completedLevels.clear();
  }

  /**
   * Age transition: cancel this owner's type research, refund it, and return all
   * of the owner's buildings to their Level 1 baseline for the next age.
   */
  resetOwner(owner: UnitOwner): void {
    for (const [key, state] of this.upgrades) {
      if (state.owner !== owner) continue;
      this.kingdoms.get(owner).wallet.refund(state.reservation);
      this.upgrades.delete(key);
    }
    for (const key of this.completedLevels.keys()) {
      if (key.startsWith(`${owner}:`)) this.completedLevels.delete(key);
    }
    for (const structure of this.ownedBy(owner)) this.demoteToBase(structure);
  }

  /** AI facade: start the next type-wide level from the first eligible building. */
  startForType(owner: UnitOwner, buildingId: string): StructureUpgradeResult {
    const structure = this.ownedBy(owner).find((item) =>
      item.stats.id === buildingId
      && item.construction.complete
      && !this.upgrades.has(this.keyFor(owner, buildingId))
      && this.nextStep(item, this.currentLevel(item)) !== null);
    if (!structure) return "no-eligible-structure";
    return this.start(structure);
  }

  /** AI facade: type-level state for tier gates and upgrade scheduling. */
  typeSnapshot(owner: UnitOwner, buildingId: string): { readonly completed: boolean; readonly upgrading: boolean } {
    const key = this.keyFor(owner, buildingId);
    return {
      completed: (this.completedLevels.get(key) ?? 1) >= 2,
      upgrading: this.upgrades.has(key),
    };
  }

  /** Apply a type's completed research to a building that just finished construction. */
  applyCompletedUpgrade(structure: UpgradableStructure): boolean {
    if (!structure.construction.complete) return false;
    const level = this.completedLevels.get(this.keyFor(structure.owner, structure.stats.id)) ?? 1;
    if (level > structure.level) {
      const step = structure.stats.levels?.find((entry) => entry.level === level);
      if (step) return this.promote(structure, step);
    }
    // A newly completed Town building has no in-age research yet, but it still
    // needs the Town Lv1 tier instead of inheriting the Settlement baseline.
    return this.applyProgressionTier(structure);
  }

  private demoteToBase(structure: UpgradableStructure): void {
    structure.level = 1;
    this.applyProgressionTier(structure, true);
  }

  private nextStep(structure: UpgradableStructure, level: number): BuildingLevelBalance | null {
    const levels = structure.stats.levels;
    if (!levels) return null;
    return levels.find((entry) => entry.level === level + 1) ?? null;
  }

  private maxLevel(structure: UpgradableStructure): number {
    const levels = structure.stats.levels;
    if (!levels || levels.length === 0) return 1;
    return Math.max(structure.level, ...levels.map((entry) => entry.level));
  }

  private promote(structure: UpgradableStructure, step: BuildingLevelBalance): boolean {
    if (structure.level >= step.level) return false;
    structure.level = step.level;
    if (this.applyProgressionTier(structure)) return true;
    structure.health.upgradeMax(step.maxHealth);
    if (step.populationCapacity !== undefined) {
      structure.populationCapacityBonus = step.populationCapacity - (structure.stats.populationCapacity ?? 0);
    }
    if (step.territory) {
      structure.territoryControlRadius = step.territory.controlRadius;
      structure.territoryConnectedControlRadius = step.territory.connectedControlRadius;
    }
    return true;
  }

  /** Apply every runtime-facing absolute value from one active age × level tier. */
  private applyProgressionTier(structure: UpgradableStructure, resetHealth = false): boolean {
    const tier = structure.stats.progression?.[this.ageForOwner(structure.owner)]
      .find((entry) => entry.level === structure.level);
    if (!tier) {
      if (resetHealth) {
        structure.health.setMax(structure.stats.maxHealth);
        structure.populationCapacityBonus = 0;
        structure.territoryControlRadius = structure.stats.territory?.controlRadius ?? null;
        structure.territoryConnectedControlRadius = structure.stats.territory?.connectedControlRadius ?? null;
        structure.economy = structure.stats.economy ?? null;
        structure.defenseAttackDamage = structure.stats.defense?.attackDamage ?? null;
        structure.marketCommission = structure.stats.market?.commission ?? null;
        structure.queueCapacity = null;
      }
      return false;
    }
    if (resetHealth) structure.health.setMax(tier.maxHealth);
    else structure.health.upgradeMax(tier.maxHealth);
    structure.populationCapacityBonus = tier.populationCapacity === undefined
      ? 0
      : tier.populationCapacity - (structure.stats.populationCapacity ?? 0);
    structure.territoryControlRadius = tier.territory?.controlRadius ?? structure.stats.territory?.controlRadius ?? null;
    structure.territoryConnectedControlRadius = tier.territory?.connectedControlRadius
      ?? structure.stats.territory?.connectedControlRadius ?? null;
    structure.economy = structure.stats.economy
      ? { ...structure.stats.economy, ...tier.economy }
      : null;
    structure.defenseAttackDamage = tier.defense?.attackDamage ?? structure.stats.defense?.attackDamage ?? null;
    structure.marketCommission = tier.tradeCommission ?? structure.stats.market?.commission ?? null;
    structure.queueCapacity = tier.queueCapacity ?? null;
    return true;
  }

  private currentLevel(structure: UpgradableStructure): number {
    return Math.max(structure.level, this.levelFor(structure.owner, structure.stats.id));
  }

  private completedOfType(owner: UnitOwner, buildingId: string): UpgradableStructure[] {
    return this.ownedBy(owner).filter((structure) =>
      structure.stats.id === buildingId && structure.construction.complete);
  }

  /** Every building this owner can level, placed or not. */
  private ownedBy(owner: UnitOwner): readonly UpgradableStructure[] {
    return [...this.structures.ownedBy(owner), ...this.externalStructures(owner)];
  }

  private keyFor(owner: UnitOwner, buildingId: string): string {
    return `${owner}:${buildingId}`;
  }
}

/**
 * Centre-led kingdom progression — one progression source per owner.
 *
 * See `docs/planned/THREEAGES_CENTER_LED_PROGRESSION_PLAN.md`. The old per-building
 * research ladder (`StructureUpgradeSystem`) and the separate age transition
 * (`AgeSystem`) are merged here: a kingdom has a single active tier
 * `{ age, level }`, driven only from its Command Centre, and every completed and
 * in-progress structure of that owner shares it. There is no per-building upgrade
 * cost, button, or world progress bar.
 *
 * Six playable tiers run Settlement Lv1→3 then Town Lv1→3. Within an age the
 * centre buys the next level ("cost only" — no building prerequisite); the one
 * age transition (Settlement Lv3 → Town Lv1) keeps its building requirements.
 * Each action reserves its cost up front, shows a timer on the centre, and
 * applies its effect atomically on completion.
 */
import type {
  AgeBalance,
  BuildingBalanceStats,
  EconomyProductionBalance,
  SettlementAge,
  StartingResources,
} from "../../data/gameDataTypes";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import { CommandCenter } from "../structures/commandCenter";
import type { HealthComponent } from "../units/health";
import type { UnitOwner } from "../units/unit";

/**
 * What the progression sweep needs from a structure to give it a tier's stats —
 * deliberately narrower than `PlacedStructure`. The Command Centre is spawned
 * rather than built yet shares the same tier ladder, so the contract is stated
 * against the fields both shapes share. `PlacedStructure` satisfies it structurally.
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
  storageCapacity: StartingResources | null;
}

export type ActiveTier = { readonly age: SettlementAge; readonly level: 1 | 2 | 3 };

export type LevelUpgradeResult =
  | "started"
  | "at-max-level"
  | "already-upgrading"
  | "no-command-center"
  | "insufficient-resources";

export type TownUpgradeResult =
  | "started"
  | "already-town"
  | "already-upgrading"
  | "no-command-center"
  | "settlement-level"
  | "missing-requirements"
  | "insufficient-resources";

/** The one centre action available next, or null at Town Lv3. */
export interface ProgressionAction {
  readonly kind: "level" | "town";
  readonly targetAge: SettlementAge;
  readonly targetLevel: 1 | 2 | 3;
  readonly cost: Readonly<Record<string, number>>;
  readonly durationSeconds: number;
  /** Town action only: completed buildings still missing (empty for a level action). */
  readonly missingBuildingIds: readonly string[];
}

export interface ProgressionSnapshot {
  readonly owner: UnitOwner;
  readonly age: SettlementAge;
  readonly level: 1 | 2 | 3;
  readonly upgrading: boolean;
  /** "level" while a Lv-up is in flight, "town" during the age transition, null when idle. */
  readonly upgradeKind: "level" | "town" | null;
  readonly remainingSeconds: number;
  /** The single centre action the panel offers, or null at Town Lv3. */
  readonly nextAction: ProgressionAction | null;
}

export interface ProgressionEvent {
  readonly owner: UnitOwner;
  readonly kind: "level" | "town";
  readonly type: "completed" | "cancelled";
  /** Resulting tier after a completed event (unchanged on cancel). */
  readonly age: SettlementAge;
  readonly level: 1 | 2 | 3;
  /** Every completed structure the sweep re-tiered (empty on cancel). */
  readonly structures: readonly UpgradableStructure[];
}

interface UpgradeState {
  readonly kind: "level" | "town";
  readonly reservation: ResourceReservation;
  remainingSeconds: number;
}

interface OwnerState {
  age: SettlementAge;
  level: 1 | 2 | 3;
  upgrade: UpgradeState | null;
}

/** Settlement < Town, for comparing an owner's tier against a unit's age gate. */
export function ageRank(age: SettlementAge): number {
  return age === "town" ? 1 : 0;
}

/** Town-only structures unlock once the Town transition commits (not while it runs). */
export function townUnlocksAvailable(snapshot: { readonly age: SettlementAge; readonly upgrading: boolean }): boolean {
  return snapshot.age === "town" && !snapshot.upgrading;
}

export class KingdomProgressionSystem {
  private readonly states = new Map<UnitOwner, OwnerState>();

  constructor(
    owners: readonly UnitOwner[],
    private readonly balance: AgeBalance,
    private readonly centers: CommandCenterSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
  ) {
    for (const owner of owners) this.states.set(owner, { age: "settlement", level: 1, upgrade: null });
  }

  /** The owner's single active tier — the one query every runtime consumer reads. */
  tierFor(owner: UnitOwner): ActiveTier {
    const state = this.stateFor(owner);
    return { age: state.age, level: state.level };
  }

  isUpgrading(owner: UnitOwner): boolean {
    return this.stateFor(owner).upgrade !== null;
  }

  snapshot(owner: UnitOwner): ProgressionSnapshot {
    const state = this.stateFor(owner);
    return {
      owner,
      age: state.age,
      level: state.level,
      upgrading: state.upgrade !== null,
      upgradeKind: state.upgrade?.kind ?? null,
      remainingSeconds: state.upgrade?.remainingSeconds ?? 0,
      nextAction: this.nextAction(owner, state),
    };
  }

  /** Start the next in-age centre level-up (Lv1→2 or Lv2→3), reserving its cost. */
  startLevelUpgrade(owner: UnitOwner): LevelUpgradeResult {
    const state = this.stateFor(owner);
    if (state.upgrade) return "already-upgrading";
    if (state.level >= 3) return "at-max-level";
    if (!this.centers.get(owner)) return "no-command-center";
    const step = this.levelUpgradeStep(state.age, state.level);
    if (!step) return "at-max-level";
    const reservation = this.kingdoms.get(owner).wallet.reserve(step.cost);
    if (!reservation) return "insufficient-resources";
    state.upgrade = { kind: "level", reservation, remainingSeconds: step.durationSeconds };
    return "started";
  }

  /** Start the one-way Settlement Lv3 → Town transition, reserving its cost. */
  startTownUpgrade(owner: UnitOwner): TownUpgradeResult {
    const state = this.stateFor(owner);
    if (state.age === "town") return "already-town";
    if (state.upgrade) return "already-upgrading";
    if (!this.centers.get(owner)) return "no-command-center";
    // The centre-level gate comes first, mirroring how the panel reads: the town
    // action only appears once the kingdom has reached Settlement Lv3.
    if (state.level < 3) return "settlement-level";
    if (this.missingBuildings(owner).length > 0) return "missing-requirements";
    const reservation = this.kingdoms.get(owner).wallet.reserve(this.balance.town.cost);
    if (!reservation) return "insufficient-resources";
    state.upgrade = { kind: "town", reservation, remainingSeconds: this.balance.town.upgradeSeconds };
    return "started";
  }

  /**
   * Advance active centre actions. On completion the tier moves and every one of
   * the owner's completed structures is re-tiered atomically; a destroyed centre
   * cancels the action and refunds its reservation.
   */
  update(deltaSeconds: number): ProgressionEvent[] {
    const events: ProgressionEvent[] = [];
    for (const [owner, state] of this.states) {
      const upgrade = state.upgrade;
      if (!upgrade) continue;
      if (!this.centers.get(owner)) {
        this.kingdoms.get(owner).wallet.refund(upgrade.reservation);
        state.upgrade = null;
        events.push({ owner, kind: upgrade.kind, type: "cancelled", age: state.age, level: state.level, structures: [] });
        continue;
      }
      upgrade.remainingSeconds = Math.max(0, upgrade.remainingSeconds - Math.max(0, deltaSeconds));
      if (upgrade.remainingSeconds > 0) continue;
      this.kingdoms.get(owner).wallet.commit(upgrade.reservation);
      state.upgrade = null;
      if (upgrade.kind === "town") {
        state.age = "town";
        state.level = 1;
      } else {
        state.level = Math.min(3, state.level + 1) as 1 | 2 | 3;
      }
      const structures = this.applyTierToAll(owner);
      events.push({ owner, kind: upgrade.kind, type: "completed", age: state.age, level: state.level, structures });
    }
    return events;
  }

  /**
   * Give one structure the owner's current tier. Used when a building finishes
   * construction, when a new structure is placed, and when a centre spawns, so a
   * structure born mid-tier joins the kingdom's level rather than the base.
   */
  applyToStructure(structure: UpgradableStructure): void {
    const { age, level } = this.tierFor(structure.owner);
    this.applyTier(structure, age, level);
  }

  /** Reset every owner to Settlement Lv1, refunding any open reservation. */
  reset(): void {
    for (const [owner, state] of this.states) {
      if (state.upgrade) this.kingdoms.get(owner).wallet.refund(state.upgrade.reservation);
      state.age = "settlement";
      state.level = 1;
      state.upgrade = null;
    }
  }

  private nextAction(owner: UnitOwner, state: OwnerState): ProgressionAction | null {
    if (state.level < 3) {
      const step = this.levelUpgradeStep(state.age, state.level);
      if (!step) return null;
      return {
        kind: "level",
        targetAge: state.age,
        targetLevel: (state.level + 1) as 1 | 2 | 3,
        cost: step.cost,
        durationSeconds: step.durationSeconds,
        missingBuildingIds: [],
      };
    }
    // Settlement Lv3: the next centre action is the town transition. Town Lv3 is
    // the top of the current progression, so it has no next action.
    if (state.age === "town") return null;
    return {
      kind: "town",
      targetAge: "town",
      targetLevel: 1,
      cost: this.balance.town.cost,
      durationSeconds: this.balance.town.upgradeSeconds,
      missingBuildingIds: this.missingBuildings(owner),
    };
  }

  private levelUpgradeStep(age: SettlementAge, level: number): { cost: StartingResources; durationSeconds: number } | null {
    return this.balance[age].levelUpgrades.find((entry) => entry.level === level + 1) ?? null;
  }

  private missingBuildings(owner: UnitOwner): string[] {
    const completeIds = new Set(this.structures.ownedBy(owner)
      .filter((structure) => structure.construction.complete)
      .map((structure) => structure.stats.id));
    return this.balance.town.requiredBuildingIds.filter((id) => !completeIds.has(id));
  }

  private applyTierToAll(owner: UnitOwner): UpgradableStructure[] {
    const { age, level } = this.tierFor(owner);
    const swept: UpgradableStructure[] = [];
    for (const structure of this.ownedBy(owner)) {
      if (!structure.construction.complete) continue;
      this.applyTier(structure, age, level);
      swept.push(structure);
    }
    return swept;
  }

  /** Every structure this owner can tier, placed or not (the centre included). */
  private ownedBy(owner: UnitOwner): readonly UpgradableStructure[] {
    const center = this.centers.get(owner);
    return center ? [...this.structures.ownedBy(owner), center] : [...this.structures.ownedBy(owner)];
  }

  /**
   * Apply every runtime-facing absolute value from one age × level tier, plus the
   * centre's age-level control radius and worker-training pace. A structure with
   * no `progression` entry for this tier keeps its base stats.
   */
  private applyTier(structure: UpgradableStructure, age: SettlementAge, level: 1 | 2 | 3): void {
    structure.level = level;
    const tier = structure.stats.progression?.[age].find((entry) => entry.level === level);
    if (tier) {
      structure.health.upgradeMax(tier.maxHealth);
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
      structure.storageCapacity = tier.storageCapacity ?? null;
    }
    // The centre's control radius and worker-training pace are age benefits, not
    // per-building tiers, so they come from the age table rather than the matrix.
    if (structure instanceof CommandCenter) {
      const cc = this.balance[age].commandCenter;
      structure.controlRadius = cc.controlRadius;
      structure.workerTrainingSeconds = cc.workerTrainingSeconds ?? null;
    }
  }

  private stateFor(owner: UnitOwner): OwnerState {
    const state = this.states.get(owner);
    if (!state) throw new Error(`No progression state registered for owner "${owner}"`);
    return state;
  }
}

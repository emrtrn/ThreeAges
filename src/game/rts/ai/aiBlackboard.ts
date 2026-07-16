/**
 * Minimal AI world model — `07_ENEMY_AI_DESIGN_v0.2.md` §19–§20.
 *
 * §19 is explicit that unused fields must not be added, so this carries only
 * what the director, economy and army managers actually read. Fog-of-war and
 * last-known-enemy tracking stay out until AI-3 (§21, §11: AI-2 may plan on
 * simplified reconnaissance).
 *
 * Information limits (§20) are enforced *here*, at the only place the AI reads
 * the world: it may see its own economy and whatever enemy units/structures are
 * on the field, but never the opponent's stockpile or production queue. That is
 * what makes plan §39 "AI normal oyunda gizli kaynak bonusu kullanmıyor"
 * structurally true rather than a promise.
 */
import type { AiBalance, SettlementAge, UnitRoleId } from "../../data/gameDataTypes";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { AgeSystem } from "../progression/ageSystem";
import type { EconomyProductionSystem } from "../economy/economyProductionSystem";
import type { ProductionLogisticsSystem } from "../economy/productionLogisticsSystem";
import type { AiArmyMission, AiExpansionStep, AiIntent, AiPlan } from "./aiTypes";

/**
 * §19 ResourceIncome: the four Faz 6 resources. Read as a fixed list rather than
 * from whatever the wallet happens to hold, so a missing income reads as 0 —
 * a real signal — instead of vanishing from the record entirely.
 */
export const AI_RESOURCE_IDS: readonly string[] = ["food", "wood", "stone", "gold"];

/** The three Faz 7 combat roles, in the order the §82 panel lists them. */
export const AI_COMBAT_ROLES: readonly UnitRoleId[] = ["guard", "archer", "siege"];

export interface AiBlackboard {
  /** Match seconds elapsed. */
  readonly now: number;
  readonly resourceStocks: Readonly<Record<string, number>>;
  readonly resourceIncomePerMinute: Readonly<Record<string, number>>;
  readonly workerCount: number;
  readonly idleWorkerCount: number;
  readonly population: number;
  readonly populationCap: number;
  readonly buildingCounts: Readonly<Record<string, number>>;
  /** Completed producers whose output cannot currently reach a depot (§37). */
  readonly disconnectedProducers: number;
  /** §19 ActiveExpansion: how far the §47 recipe has run. */
  readonly expansionStep: AiExpansionStep;
  /**
   * §49: a region is left to claim and the AI's plan budget allows another.
   * Distinct from the step: a *finished* region leaves the step at "done" while
   * a second plan may still be open, and §30's Expand has to tell those apart.
   */
  readonly expansionPlanAvailable: boolean;
  /** §19 DevelopmentLevel: the kingdom's current age. */
  readonly age: SettlementAge;
  /** True while the Town transition is paid for and running. */
  readonly ageUpgrading: boolean;
  /** Every completed building the Town age asks for (`balance/ages.json`). */
  readonly ageRequiredBuildingIds: readonly string[];
  /** Completed buildings the Town age still wants; empty once it is reachable. */
  readonly ageMissingBuildingIds: readonly string[];
  /** True when the stockpile covers the Town cost right now. */
  readonly ageAffordable: boolean;
  /** §52: live combat units per role, so §53 can read the army's shape. */
  readonly armyComposition: Readonly<Record<UnitRoleId, number>>;
  /**
   * §55: population the field army occupies. Summed from each unit's own cost
   * rather than inferred from the head count, because a Ram costs three.
   */
  readonly armyPopulation: number;
  readonly ownArmyPower: number;
  /** §20: only enemies actually on the field — never a hidden stockpile read. */
  readonly knownEnemyArmyPower: number;
  /** §56: enemy power inside the base radius. */
  readonly baseThreat: number;
  readonly ownCenterHealthRatio: number;
  readonly enemyCenterExists: boolean;
  readonly currentIntent: AiIntent | null;
  readonly currentPlan: AiPlan | null;
  readonly planRunningSeconds: number;
  readonly armyMission: AiArmyMission | null;
  /** §7: the emergencies that may cut a committed plan short. */
  readonly emergencyFlags: readonly AiEmergencyFlag[];
}

/** §7 exceptions + §57 level-3 triggers, narrowed to what the AI can detect. */
export type AiEmergencyFlag =
  | "base-under-attack"
  | "army-destroyed"
  | "population-blocked"
  /** §27: the economy itself has collapsed and must be rebuilt before anything else. */
  | "workers-lost";

/** §56: threat is measured in a simple radius around the base for AI-1. */
export const AI_BASE_THREAT_RADIUS = 24;

export interface AiBlackboardSources {
  readonly owner: UnitOwner;
  readonly units: UnitSystem;
  readonly structures: PlacedStructureSystem;
  readonly centers: CommandCenterSystem;
  readonly kingdoms: KingdomRegistry;
  readonly production: EconomyProductionSystem;
  readonly logistics: ProductionLogisticsSystem;
  /** §19 DevelopmentLevel: the owner-scoped Settlement → Town progression. */
  readonly ages: AgeSystem;
  /** The Town transition's cost, so §30's AgeUp can score affordability. */
  readonly townCost: Readonly<Record<string, number>>;
  /** The Town transition's required buildings, so §30 can score progress. */
  readonly townRequiredBuildingIds: readonly string[];
  /** True while a worker is already building or gathering (§19 IdleWorkerCount). */
  readonly isWorkerBusy: (worker: Unit) => boolean;
}

/** Recomputes the blackboard from live world state; holds no state of its own. */
export class AiBlackboardReader {
  constructor(
    private readonly sources: AiBlackboardSources,
    private readonly balance: AiBalance,
  ) {}

  read(context: {
    readonly now: number;
    readonly currentIntent: AiIntent | null;
    readonly currentPlan: AiPlan | null;
    readonly armyMission: AiArmyMission | null;
    readonly expansionStep: AiExpansionStep;
    readonly expansionPlanAvailable: boolean;
  }): AiBlackboard {
    const { owner, units, structures, centers, kingdoms, production, logistics, ages } = this.sources;
    const kingdom = kingdoms.get(owner);
    const opponent: UnitOwner = owner === "player" ? "enemy" : "player";
    const populationSnapshot = kingdom.population.snapshot();
    const stocks = kingdom.wallet.snapshot();
    const power = (army: readonly Unit[]) => armyPower(army, this.balance);

    const ownUnits = units.unitsOf(owner);
    const workers = ownUnits.filter((unit) => unit.role === "worker");
    // Every combat unit, not just Guards: `role === "guard"` meant "the whole
    // army" only while Guard and worker were the only roles. Faz 7 added the
    // Archer and the Ram, and an AI that cannot see them reads an Archer push
    // as zero threat (AI design §56/§62).
    const ownArmy = units.armyOf(owner);
    const ownArmyPower = power(ownArmy);
    const center = centers.get(owner);
    const baseThreat = center
      ? power(units.armyOf(opponent).filter((unit) =>
        Math.hypot(unit.position.x - center.position.x, unit.position.z - center.position.z)
          <= AI_BASE_THREAT_RADIUS))
      : 0;

    const ageSnapshot = ages.snapshot(owner);

    const buildingCounts: Record<string, number> = {};
    for (const structure of structures.ownedBy(owner)) {
      if (!structure.construction.complete) continue;
      buildingCounts[structure.stats.id] = (buildingCounts[structure.stats.id] ?? 0) + 1;
    }

    const disconnectedProducers = logistics.snapshots()
      .filter((producer) => producer.owner === owner && producer.status !== "linked").length;

    const emergencyFlags: AiEmergencyFlag[] = [];
    if (baseThreat > 0) emergencyFlags.push("base-under-attack");
    // §7: "ana ordu yok edildi" only counts once the kingdom has fielded one.
    if (ownArmyPower <= 0 && (buildingCounts["barracks"] ?? 0) > 0) emergencyFlags.push("army-destroyed");
    if (populationSnapshot.used >= populationSnapshot.capacity) emergencyFlags.push("population-blocked");
    // §27: a raid that clears the workers ends the economy, and no amount of
    // army fixes that. The centre has to be alive to rebuild from, or this is
    // simply a lost match rather than a recovery.
    if (workers.length === 0 && center && !center.health.depleted) emergencyFlags.push("workers-lost");

    return {
      now: context.now,
      resourceStocks: stocks,
      resourceIncomePerMinute: Object.fromEntries(
        AI_RESOURCE_IDS.map((id) => [id, production.productionPerMinute(owner, id)]),
      ),
      workerCount: workers.length,
      idleWorkerCount: workers.filter((worker) => !this.sources.isWorkerBusy(worker)).length,
      population: populationSnapshot.used,
      populationCap: populationSnapshot.capacity,
      buildingCounts,
      disconnectedProducers,
      expansionStep: context.expansionStep,
      expansionPlanAvailable: context.expansionPlanAvailable,
      age: ageSnapshot.age,
      ageUpgrading: ageSnapshot.upgrading,
      ageRequiredBuildingIds: this.sources.townRequiredBuildingIds,
      ageMissingBuildingIds: ageSnapshot.missingBuildingIds,
      ageAffordable: Object.entries(this.sources.townCost)
        .every(([id, cost]) => (stocks[id] ?? 0) >= cost),
      armyComposition: composition(ownArmy),
      armyPopulation: ownArmy.reduce((total, unit) => total + unit.stats.populationCost, 0),
      ownArmyPower,
      knownEnemyArmyPower: power(units.armyOf(opponent)),
      baseThreat,
      ownCenterHealthRatio: center ? center.health.ratio : 0,
      enemyCenterExists: centers.get(opponent) !== null,
      currentIntent: context.currentIntent,
      currentPlan: context.currentPlan,
      planRunningSeconds: context.currentPlan ? Math.max(0, context.now - context.currentPlan.startedAt) : 0,
      armyMission: context.armyMission,
      emergencyFlags,
    };
  }
}

/**
 * §52: ArmyPower = Σ(UnitBasePower × HealthRatio).
 *
 * AI-1 pinned UnitBasePower at 1 because Guard was the only combat unit. Faz 7
 * added the Archer and the Ram, so the per-role value is data (`balance/ai.json`
 * `army.rolePower`) — a Ram counted as one Guard would have the AI read a siege
 * push as a even fight and a Guard wall as unbeatable.
 */
export function armyPower(units: readonly Unit[], balance: AiBalance): number {
  return units.reduce(
    (total, unit) => total + (balance.army.rolePower[unit.role] ?? 0) * unit.health.ratio,
    0,
  );
}

function composition(army: readonly Unit[]): Record<UnitRoleId, number> {
  const counts: Record<UnitRoleId, number> = { guard: 0, archer: 0, siege: 0, worker: 0 };
  for (const unit of army) counts[unit.role] += 1;
  return counts;
}

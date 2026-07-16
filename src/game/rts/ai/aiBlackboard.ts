/**
 * Minimal AI world model — `07_ENEMY_AI_DESIGN_v0.2.md` §19–§20.
 *
 * §19 is explicit that unused fields must not be added, so this carries only
 * what the AI-1 director and army manager actually read. Age, fog-of-war,
 * regions and last-known-enemy tracking arrive with AI-2/AI-3 (§21).
 *
 * Information limits (§20) are enforced *here*, at the only place the AI reads
 * the world: it may see its own economy and whatever enemy units/structures are
 * on the field, but never the opponent's stockpile or production queue. That is
 * what makes plan §39 "AI normal oyunda gizli kaynak bonusu kullanmıyor"
 * structurally true rather than a promise.
 */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { Unit, UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import type { EconomyProductionSystem } from "../economy/economyProductionSystem";
import type { ProductionLogisticsSystem } from "../economy/productionLogisticsSystem";
import type { AiArmyMission, AiExpansionStep, AiIntent, AiPlan } from "./aiTypes";

/** §52: ArmyPower = Σ(UnitBasePower × HealthRatio). Roles arrive with AI-2. */
const GUARD_BASE_POWER = 1;

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

/** §7 exceptions + §57 level-3 triggers, narrowed to what AI-1 can detect. */
export type AiEmergencyFlag = "base-under-attack" | "army-destroyed" | "population-blocked";

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
  /** True while a worker is already building or gathering (§19 IdleWorkerCount). */
  readonly isWorkerBusy: (worker: Unit) => boolean;
}

/** Recomputes the blackboard from live world state; holds no state of its own. */
export class AiBlackboardReader {
  constructor(private readonly sources: AiBlackboardSources) {}

  read(context: {
    readonly now: number;
    readonly currentIntent: AiIntent | null;
    readonly currentPlan: AiPlan | null;
    readonly armyMission: AiArmyMission | null;
    readonly expansionStep: AiExpansionStep;
  }): AiBlackboard {
    const { owner, units, structures, centers, kingdoms, production, logistics } = this.sources;
    const kingdom = kingdoms.get(owner);
    const opponent: UnitOwner = owner === "player" ? "enemy" : "player";
    const populationSnapshot = kingdom.population.snapshot();

    const ownUnits = units.unitsOf(owner);
    const workers = ownUnits.filter((unit) => unit.role === "worker");
    // Every combat unit, not just Guards: `role === "guard"` meant "the whole
    // army" only while Guard and worker were the only roles. Faz 7 added the
    // Archer and the Ram, and an AI that cannot see them reads an Archer push
    // as zero threat (AI design §56/§62).
    const ownArmyPower = armyPower(units.armyOf(owner));
    const center = centers.get(owner);
    const baseThreat = center
      ? armyPower(units.armyOf(opponent).filter((unit) =>
        Math.hypot(unit.position.x - center.position.x, unit.position.z - center.position.z)
          <= AI_BASE_THREAT_RADIUS))
      : 0;

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

    return {
      now: context.now,
      resourceStocks: kingdom.wallet.snapshot(),
      resourceIncomePerMinute: {
        food: production.productionPerMinute(owner, "food"),
        wood: production.productionPerMinute(owner, "wood"),
      },
      workerCount: workers.length,
      idleWorkerCount: workers.filter((worker) => !this.sources.isWorkerBusy(worker)).length,
      population: populationSnapshot.used,
      populationCap: populationSnapshot.capacity,
      buildingCounts,
      disconnectedProducers,
      expansionStep: context.expansionStep,
      ownArmyPower,
      knownEnemyArmyPower: armyPower(units.armyOf(opponent)),
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

function armyPower(units: readonly { readonly health: { readonly ratio: number } }[]): number {
  return units.reduce((total, unit) => total + GUARD_BASE_POWER * unit.health.ratio, 0);
}

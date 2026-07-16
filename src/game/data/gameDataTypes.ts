/**
 * Game-data shapes — Vertical Slice Plan v0.2 §14 / §72.
 *
 * These describe the read-only JSON served from `public/game-data/` (TD-003):
 * version stamps and test presets. Balance tables are added here when Faz 3+
 * introduce them; for Faz 0 only version + preset exist.
 *
 * Type-only module (no runtime cost); safe to import from both browser runtime
 * and node tests.
 */
import type { FeatureFlag } from "../core/featureFlags";

/** `public/game-data/version.json` — plan §17 "Build sürümü ve balance sürümü". */
export interface GameVersion {
  /** Semantic-ish build stamp for the code/data snapshot. */
  buildVersion: string;
  /** Balance-data revision, bumped when tuning numbers change (plan §71). */
  balanceVersion: string;
}

/** AI opponent tuning profile (plan §72). Only "normal" exists in Ürün A. */
export type AiProfile = "easy" | "normal" | "hard";

/** Starting stockpile a preset grants (plan §72). Keys are resource ids; the
 *  Ürün A economy uses food/wood/population, later products add stone/gold. */
export type StartingResources = Readonly<Record<string, number>>;

/**
 * A test preset — `public/game-data/presets/<id>.json` (plan §72).
 * Presets decide feature flags, starting resources, game speed, map state and
 * AI profile so a scenario is reproducible from data alone.
 */
export interface GamePreset {
  /** Stable id, must match the file name (e.g. "gameplay_proof"). */
  id: string;
  /** Human-readable label for menus / debug. */
  label: string;
  /** Feature-flag overrides for this scenario (unset flags keep their default). */
  flags: Partial<Record<FeatureFlag, boolean>>;
  /** Resources granted at match start. */
  startingResources: StartingResources;
  /** Simulation speed multiplier (1 = real time; debug_fast raises it). */
  gameSpeed: number;
  /** Map/level this preset boots into (blockout id; empty until Faz 2). */
  mapState: string;
  /** AI opponent profile. */
  aiProfile: AiProfile;
}

/**
 * What a damage source is hitting. GDD 12 §33's soft-counter table is expressed
 * as attacker multipliers against these three classes, so a unit's counters are
 * data rather than a rule keyed on unit ids (plan §14).
 */
export type UnitArmorClass = "light" | "heavy" | "structure";

/** Ürün B roles. Cavalry is deliberately out of the vertical slice (plan §2.9). */
export type UnitRoleId = "guard" | "archer" | "siege" | "worker";

/** Melee lands instantly at range; ranged spawns a tracer toward the target. */
export type UnitAttackType = "melee" | "ranged";

/** Per-armour-class damage multipliers — the GDD 12 §33 soft-counter table. */
export type UnitDamageMultipliers = Readonly<Record<UnitArmorClass, number>>;

/** Balance stats shared by a unit definition (GDD 12 §5). */
export interface UnitBalanceStats {
  /** Player-facing name; the HUD never invents a label for a unit id. */
  readonly label: string;
  /** Battlefield role, driving both production gating and UI role copy. */
  readonly role: UnitRoleId;
  /** What attackers resolve their §33 multiplier against when hitting this unit. */
  readonly armorClass: Exclude<UnitArmorClass, "structure">;
  /** Maximum hit points; must be positive. */
  maxHealth: number;
  /** Ground speed in world units/s; must be positive. */
  readonly moveSpeed: number;
  readonly attackType: UnitAttackType;
  /**
   * Base damage of one hit, before the target's armour-class multiplier. The
   * player-facing number in GDD 12 §32 is the *resolved* one, so e.g. siege's 28
   * base becomes the documented ~70 against a structure.
   */
  attackDamage: number;
  /** Seconds between hits; must be positive. */
  attackCooldown: number;
  /** Maximum ground-plane distance from which a hit may land; must be positive. */
  attackRange: number;
  /**
   * Distance at which an idle unit picks up a nearby enemy by itself. Zero opts
   * a unit out entirely, which is how workers stay out of combat.
   */
  readonly acquisitionRange: number;
  /**
   * How far an auto-acquired chase may drag a unit from where it started before
   * it gives up and returns (GDD 06 §39). Explicit orders ignore this leash.
   */
  readonly chaseRange: number;
  readonly damageMultipliers: UnitDamageMultipliers;
  /** Seconds a completed production building needs to train this unit. */
  trainingSeconds: number;
  /**
   * Minimum tier of the training building. Archers and siege sit behind Barracks
   * II (plan §2.10 / §45), so the gate is data instead of a hard-coded id check.
   */
  readonly requiredBuildingLevel: number;
  /** Resources reserved when this unit enters a production queue. */
  readonly cost: StartingResources;
  /** Population capacity consumed by this unit once queued. */
  readonly populationCost: number;
}

/** `public/game-data/balance/units.json` — keyed by stable unit id. */
export type UnitBalance = Readonly<Record<string, UnitBalanceStats>>;

/** One grid-aligned RTS building definition, loaded from balance/buildings.json. */
export interface BuildingBalanceStats {
  /** Stable data id, copied from the key in `balance/buildings.json`. */
  readonly id: string;
  readonly label: string;
  /** World-space footprint dimensions; both are multiples of the placement grid. */
  readonly footprint: { readonly width: number; readonly depth: number };
  /** Resource reservation is implemented in the following Phase 2 slice. */
  readonly cost: StartingResources;
  readonly constructionSeconds: number;
  /**
   * Durability of the placed structure, following the GDD §37 health classes
   * (`12_BALANCE_AND_GAME_DATA.md`). Required rather than optional: a building
   * without it would be silently invulnerable, which is the failure this data
   * exists to prevent.
   */
  readonly maxHealth: number;
  /** Capacity supplied while this completed structure is standing. */
  readonly populationCapacity?: number;
  /** Present only on structures which turn assigned workers into a resource. */
  readonly economy?: EconomyProductionBalance;
  /** Present on structures which extend the control area once complete. */
  readonly territory?: TerritoryBuildingBalance;
  /** Optional Town-era T1 -> T2 path; absent buildings stay single-level. */
  readonly upgrade?: BuildingUpgradeBalance;
}

export interface BuildingUpgradeBalance {
  readonly cost: StartingResources;
  readonly durationSeconds: number;
  readonly maxHealth: number;
  /** T2 outposts can expand both their isolated and road-connected control area. */
  readonly territory?: Pick<TerritoryBuildingBalance, "controlRadius" | "connectedControlRadius">;
}

/** Data-owned production behaviour for an RTS resource structure. */
export interface EconomyProductionBalance {
  readonly resourceId: string;
  readonly workerCapacity: number;
  readonly perWorkerPerMinute: number;
  readonly localBufferCapacity: number;
  /** Stone/gold buildings must cover a live matching finite deposit. */
  readonly requiresResourceNode?: boolean;
}

/** Territory source and bounded expansion rule supplied by a completed structure. */
export interface TerritoryBuildingBalance {
  /** Radius unlocked immediately after this structure completes. */
  readonly controlRadius: number;
  /** Radius while the outpost's touching road component reaches the main base. */
  readonly connectedControlRadius: number;
  /** Maximum gap from friendly territory when this special structure is placed. */
  readonly expansionPlacementRange: number;
}

/** `public/game-data/balance/buildings.json` — keyed by stable building id. */
export type BuildingBalance = Readonly<Record<string, BuildingBalanceStats>>;

/**
 * One finite stone or gold deposit profile for Faz 6. Safe deposits establish
 * the early, low-risk baseline; external deposits are richer and later make
 * expansion/road decisions meaningful. Buildings consume this data in the
 * following quarry/mine slice rather than inventing their own capacities.
 */
export interface ResourceNodeBalance {
  /** Total material in one deposit before it is exhausted. */
  readonly capacity: number;
  /** Maximum output of one assigned worker while material remains. */
  readonly perWorkerPerMinute: number;
}

/** Data contract for one finite Faz 6 resource type. */
export interface ResourceBalanceStats {
  readonly id: string;
  readonly label: string;
  readonly safeNode: ResourceNodeBalance;
  readonly externalNode: ResourceNodeBalance;
}

/** `public/game-data/balance/resources.json` — finite stone and gold deposits. */
export type ResourceBalance = Readonly<Record<string, ResourceBalanceStats>>;

/** The two progression states included in Faz 6 (Kingdom deliberately remains out of scope). */
export type SettlementAge = "settlement" | "town";

/** One data-owned transition from the opening Settlement into Town. */
export interface TownAgeBalance {
  readonly id: "town";
  readonly label: string;
  /** Atomically reserved when the command-centre upgrade begins. */
  readonly cost: StartingResources;
  readonly upgradeSeconds: number;
  /** Completed structures that prove the economy and defence are established. */
  readonly requiredBuildingIds: readonly string[];
  /** The command centre's concrete T2 gains, applied when the age completes. */
  readonly commandCenter: {
    readonly maxHealth: number;
    readonly controlRadius: number;
    readonly workerTrainingSeconds: number;
  };
}

/** `public/game-data/balance/ages.json` — the Faz 6 progression contract. */
export interface AgeBalance {
  readonly settlement: { readonly id: "settlement"; readonly label: string };
  readonly town: TownAgeBalance;
}

/**
 * The five strategic intents the Kingdom Director chooses between
 * (`07_ENEMY_AI_DESIGN_v0.2.md` §23). Exactly one is active at a time.
 */
export type AiIntent = "economy" | "ageUp" | "expand" | "defend" | "attack";

/** Per-difficulty knobs. AI design §70: difficulty is timing/quality, not cheating. */
export interface AiProfileBalance {
  /**
   * Resource multiplier. §72 pins normal at 1.00 and §73 caps hard at 1.05; any
   * bonus must be visible in data rather than hidden in code.
   */
  readonly economyMultiplier: number;
  /** Seconds the director waits before reacting to a new event (§70). */
  readonly reactionDelaySeconds: number;
}

/**
 * §60 `TargetScore` terms. The formula and each target kind's base values live
 * in `armyTargeting.ts`; only the weights are data, mirroring `intentWeights`.
 */
export interface AiTargetWeights {
  readonly economicValue: number;
  readonly strategicValue: number;
  readonly victoryValue: number;
  readonly vulnerability: number;
  readonly proximity: number;
  /** Subtracted: defenders near a target push the army toward a softer one. */
  readonly defenseStrength: number;
}

/** The §60 target-score term names, in the order the formula lists them. */
export const AI_TARGET_WEIGHTS: readonly (keyof AiTargetWeights)[] = [
  "economicValue",
  "strategicValue",
  "victoryValue",
  "vulnerability",
  "proximity",
  "defenseStrength",
];

/** §53: how many of each combat role the AI wants, as a ratio not a count. */
export interface AiArmyComposition {
  readonly guard: number;
  readonly archer: number;
  readonly siege: number;
}

/**
 * §30's Economy terms: WorkerNeed + IncomeDeficit + PopulationPressure +
 * RecoveryNeed − ImmediateThreat.
 */
export interface AiEconomyScoring {
  readonly workerNeed: number;
  readonly incomeDeficit: number;
  readonly populationPressure: number;
  readonly recoveryNeed: number;
  /** Subtracted: a base under attack is not the moment to expand the economy. */
  readonly immediateThreat: number;
}

/**
 * §30's AgeUp terms. §24 orders the age behind a working economy, so the score
 * is gated on requirements and paid for out of surplus rather than raced to.
 */
export interface AiAgeUpScoring {
  /** How much of the age's required building list already stands. */
  readonly requirementProgress: number;
  /** How close the stockpile is to the transition's cost. */
  readonly affordability: number;
  /** Whether income can refill what the transition drains. */
  readonly economyMaturity: number;
  /** Subtracted: never start a two-minute upgrade while the base is contested. */
  readonly immediateThreat: number;
}

/** §30's Expand terms: ResourceNeed × BestRegionValue × RouteFeasibility × Safety. */
export interface AiExpandScoring {
  /** Wood stock at which the whole §47 recipe reads as affordable. */
  readonly recipeWoodCost: number;
}

/** §29: the divisors that normalise raw world quantities into 0..1 terms. */
export interface AiScoringNormalizers {
  /** Enemy power at the base that reads as a full-strength threat. */
  readonly threatPower: number;
  /** Disconnected producers that read as a total logistics collapse. */
  readonly disconnectedProducers: number;
}

export interface AiScoringBalance {
  readonly economy: AiEconomyScoring;
  readonly ageUp: AiAgeUpScoring;
  readonly expand: AiExpandScoring;
  readonly normalizers: AiScoringNormalizers;
}

/** `public/game-data/balance/ai.json` — AI design §30 keeps the weights in data. */
export interface AiBalance {
  readonly evaluation: {
    /** Director intent re-evaluation cadence; §78 suggests 3–6s. */
    readonly directorSeconds: number;
    /** Army mission re-evaluation cadence; §78 suggests 0.5–1.0s. */
    readonly armySeconds: number;
    /** Economy/build/production executor cadence; §78 suggests 1–3s. */
    readonly economySeconds: number;
    /** §7: a plan is held at least this long before a rival plan can take over. */
    readonly minimumCommitmentSeconds: number;
    /** §32: a plan that runs longer than this fails rather than hanging forever. */
    readonly planTimeoutSeconds: number;
    /** §7: a rival intent must beat the running plan by this fraction (0.25 = 25%). */
    readonly hysteresisMargin: number;
  };
  readonly army: {
    /** §62: attack when own/enemy power is at or above this. */
    readonly attackPowerRatio: number;
    /** §62: below `attackPowerRatio`, only a high-value target justifies attacking. */
    readonly riskyAttackPowerRatio: number;
    /** §62: retreat below this ratio. */
    readonly retreatPowerRatio: number;
    /** §65: retreat once the army's mean health ratio falls below this. */
    readonly retreatHealthRatio: number;
    /**
     * §69: the power ratio at which the AI reads itself as decisively winning
     * and starts valuing the enemy centre. Well above `attackPowerRatio` on
     * purpose — an army that merely *may* attack has not won anything yet, and
     * §60 requires that the centre not always be the best target.
     */
    readonly dominancePowerRatio: number;
    /** §54: power held back at the base before the field army may leave. */
    readonly minimumDefensePower: number;
    /**
     * §55: the largest share of the population cap the field army may occupy.
     *
     * Without a ceiling the army grows until the population is full, and then
     * §7's PopulationBlocked fires forever: once every authored house slot is
     * taken there is nothing the economy can do to relieve it, so the emergency
     * pins the director on Economy and the AI never ages up or acts again. The
     * headroom this leaves is what keeps the kingdom able to replace workers and
     * to pay a population cost later.
     */
    readonly populationShare: number;
    /**
     * §52 UnitBasePower, per role. Workers are 0: they never fight, and counting
     * them would read a base full of villagers as a defended one.
     */
    readonly rolePower: Readonly<Record<UnitRoleId, number>>;
    /** §53: the army shape the AI trains toward, per age. */
    readonly composition: Readonly<Record<SettlementAge, AiArmyComposition>>;
    /** §60: per-term weights of the target score. */
    readonly targetWeights: AiTargetWeights;
  };
  readonly economy: {
    /** §35: worker count the economy intent drives toward, per age. */
    readonly workerTarget: Readonly<Record<SettlementAge, number>>;
    /** §24: population headroom below which housing becomes urgent. */
    readonly populationPressureBuffer: number;
    /**
     * §36: the per-minute income each resource is driven toward. Reaching a
     * target stops that resource pulling on the economy score, which is what
     * lets a balanced four-resource economy settle instead of over-building one.
     */
    readonly incomeTargetsPerMinute: Readonly<Record<string, number>>;
  };
  /** §29–§30: the utility formula's own coefficients, not just its weights. */
  readonly scoring: AiScoringBalance;
  readonly profiles: Readonly<Record<AiProfile, AiProfileBalance>>;
  /** §30: per-intent multipliers applied to the raw utility score. */
  readonly intentWeights: Readonly<Record<AiIntent, number>>;
}

/** `public/game-data/balance/roads.json` — first-pass logistics road tuning. */
export interface RoadBalance {
  /** Grid cell width in world units; intentionally independent from unit navigation. */
  readonly cellSize: number;
  /** Wood charged for each newly created road cell. */
  readonly woodCostPerCell: number;
}

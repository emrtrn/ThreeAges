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

/** Per-kingdom opening forces a preset may override (see `GamePreset`). */
export interface StartingUnits {
  readonly guard?: number;
  readonly worker?: number;
}

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
  /**
   * Units each kingdom fields at match start. Omitted keys fall back to the
   * runtime defaults.
   */
  startingUnits: StartingUnits;
  /**
   * Enemy-only overrides. Unset means the AI opens identically to the player —
   * the fair default, and the only setting a balance preset should use. Test
   * presets set these to handicap the AI (e.g. no opening army) so a scenario
   * can be exercised without fighting; never ship a balance preset with them.
   */
  enemyStartingResources?: StartingResources;
  enemyStartingUnits?: StartingUnits;
  /** Simulation speed multiplier (1 = real time; debug_fast raises it). */
  gameSpeed: number;
  /** Map/level this preset boots into (blockout id; empty until Faz 2). */
  mapState: string;
  /**
   * Optional public-relative Forge Level asset. During Faz D this coexists with
   * `mapState` so existing presets keep their blockout fallback until their
   * complete gameplay marker set has migrated.
   */
  levelRef?: string;
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

/** Buildings that can own a unit production queue. */
export type ProductionBuildingId = "command_center" | "barracks" | "archery_range";

/** Per-armour-class damage multipliers — the GDD 12 §33 soft-counter table. */
export type UnitDamageMultipliers = Readonly<Record<UnitArmorClass, number>>;

/** Balance stats shared by a unit definition (GDD 12 §5). */
export interface UnitBalanceStats {
  /** Player-facing name; the HUD never invents a label for a unit id. */
  readonly label: string;
  /**
   * Optional public UI asset, resolved from the game-data file rather than
   * chosen by a panel.  Placeholder art may be replaced without changing UI
   * code; omitted remains valid for headless fixtures and future content.
   */
  readonly icon?: UiAssetPath;
  /** Larger selection-panel artwork for this unit, when it has one. */
  readonly portrait?: UiAssetPath;
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
  /**
   * How far this unit reveals fog for its kingdom (GDD 08 §41/§42, plan §59).
   * Required rather than optional: a unit with no vision would be a scout that
   * reveals nothing, and the validator can only enforce "sees at least as far as
   * it shoots" when every unit states a number.
   */
  readonly visionRadius: number;
  readonly damageMultipliers: UnitDamageMultipliers;
  /** Seconds a completed production building needs to train this unit. */
  trainingSeconds: number;
  /** The building that trains this unit. */
  readonly productionBuildingId: ProductionBuildingId;
  /** The earliest settlement age that may train this unit. */
  readonly requiredAge: SettlementAge;
  /**
   * Minimum global centre level *within {@link requiredAge}* the owner must have
   * reached to train this unit (1..3). Centre-led progression (see
   * `docs/planned/THREEAGES_CENTER_LED_PROGRESSION_PLAN.md`): a unit gate is a
   * statement about the whole kingdom's tier, not about one production building.
   * Guard = Settlement Lv1, Archer = Town Lv1, Ram = Town Lv2.
   */
  readonly requiredSettlementLevel: number;
  /** Resources reserved when this unit enters a production queue. */
  readonly cost: StartingResources;
  /** Population capacity consumed by this unit once queued. */
  readonly populationCost: number;
}

/** `public/game-data/balance/units.json` — keyed by stable unit id. */
export type UnitBalance = Readonly<Record<string, UnitBalanceStats>>;

/**
 * A public, same-origin UI asset path.  Game data may point only at the
 * curated UI directories; this keeps data-driven panels from accepting an
 * arbitrary URL as artwork.
 */
export type UiAssetPath = `/assets/ui/${"icons" | "portraits"}/${string}.svg`;

/** One grid-aligned RTS building definition, loaded from balance/buildings.json. */
export interface BuildingBalanceStats {
  /** Stable data id, copied from the key in `balance/buildings.json`. */
  readonly id: string;
  readonly label: string;
  /** Compact tile/icon artwork used by build and selection UI. */
  readonly icon?: UiAssetPath;
  /** Larger selection-panel artwork, when distinct from the compact icon. */
  readonly portrait?: UiAssetPath;
  /** World-space footprint dimensions; both are multiples of the placement grid. */
  readonly footprint: { readonly width: number; readonly depth: number };
  /** Resource reservation is implemented in the following Phase 2 slice. */
  readonly cost: StartingResources;
  readonly constructionSeconds: number;
  /** The earliest settlement age in which this building may be placed. */
  readonly requiredAge?: SettlementAge;
  /**
   * Durability of the placed structure, following the GDD §37 health classes
   * (`12_BALANCE_AND_GAME_DATA.md`). Required rather than optional: a building
   * without it would be silently invulnerable, which is the failure this data
   * exists to prevent.
   */
  readonly maxHealth: number;
  /**
   * How far this structure reveals fog for its kingdom (GDD 08 §41/§42, plan
   * §59). Applies from the moment the foundation is placed, not on completion:
   * a construction site the enemy can walk up to unseen would be a blind spot
   * inside one's own base. §42 caps the Outpost here — it is meant to be the
   * wide one without opening most of the map by itself.
   */
  readonly visionRadius: number;
  /** Capacity supplied while this completed structure is standing. */
  readonly populationCapacity?: number;
  /** Present only on structures which turn assigned workers into a resource. */
  readonly economy?: EconomyProductionBalance;
  /** Present on structures which extend the control area once complete. */
  readonly territory?: TerritoryBuildingBalance;
  /** Present only on the Market: what it trades and how its prices move. */
  readonly market?: MarketBalance;
  /** Optional stationary ranged defense, fired only after construction completes. */
  readonly defense?: BuildingDefenseBalance;
  /**
   * Complete age × level balance matrix — the single source of a building's
   * live stats. Every entry is an absolute value for one of the six playable
   * tiers (Settlement 1–3, Town 1–3). The owner's centre-led global tier
   * (see {@link AgeBalance}) selects which entry is active; a building no
   * longer carries its own per-instance upgrade cost or ladder.
   */
  readonly progression?: BuildingProgressionBalance;
}

/** Full absolute balance matrix for the two currently playable settlement ages. */
/** An empty age array means the building is not available in that age. */
export type BuildingProgressionBalance = Readonly<Record<SettlementAge, readonly BuildingProgressionTier[]>>;

/**
 * One absolute building tier in {@link BuildingProgressionBalance}.
 * Lv1 has no research cost; Lv2/Lv3 research prices remain in the legacy
 * ladder until the simulation migration consumes this matrix directly.
 */
export interface BuildingProgressionTier {
  readonly level: 1 | 2 | 3;
  readonly maxHealth: number;
  readonly populationCapacity?: number;
  readonly economy?: Pick<EconomyProductionBalance,
    "workerCapacity" | "perWorkerPerMinute" | "localBufferCapacity" | "carryCapacity">;
  readonly territory?: Pick<TerritoryBuildingBalance, "controlRadius" | "connectedControlRadius">;
  readonly tradeCommission?: number;
  readonly defense?: Pick<BuildingDefenseBalance, "attackDamage">;
  /** Queue capacity supplied by military production structures at this tier. */
  readonly queueCapacity?: number;
  /** Global stock capacity this completed depot contributes, keyed by resource id. */
  readonly storageCapacity?: StartingResources;
}

/** Data-owned production behaviour for an RTS resource structure. */
export interface EconomyProductionBalance {
  readonly resourceId: string;
  readonly workerCapacity: number;
  readonly perWorkerPerMinute: number;
  readonly localBufferCapacity: number;
  /** Stone/gold buildings must cover a live matching finite deposit. */
  readonly requiresResourceNode?: boolean;
  /** Maximum distance at which a lumber worker may search for a live tree. */
  readonly requiresForest?: boolean;
  /** Camp-centre radius in which a worker may reserve and harvest a tree. */
  readonly gatherRadius?: number;
  /** Maximum wood a worker carries from one tree back to the camp. */
  readonly carryCapacity?: number;
}

/**
 * Data-owned trade tuning for a Market — see
 * `docs/planned/THREEAGES_MARKET_TRADE_PLAN.md`.
 *
 * Gold is the numeraire: it has no price of its own, so "gold weakened" is
 * expressed as every other resource's price index rising. Only the resources
 * named in {@link basePrice} are tradable, and `gold` may not be one of them.
 *
 * {@link priceStep} and {@link commission} are not independent knobs: a
 * commission too small next to the step makes an instant buy-then-sell round
 * trip *profitable*, which mints gold from nothing. The validator enforces
 * `priceStep * (1 + commission) < 2 * indexMin * commission` for exactly this.
 */
export interface MarketBalance {
  /** Units of a resource moved by one trade action. */
  readonly lotSize: number;
  /** Gold price of one lot at price index 1.0, keyed by resource id. */
  readonly basePrice: Readonly<Record<string, number>>;
  /** How far one trade moves that resource's price index. */
  readonly priceStep: number;
  /** Price index floor; must be <= 1 (the index starts at 1.0). */
  readonly indexMin: number;
  /** Price index ceiling; must be >= 1. */
  readonly indexMax: number;
  /** Spread taken by the house at market level 1, 0..1. Levels lower it. */
  readonly commission: number;
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

/** Data-owned stationary ranged attack for a completed defensive structure. */
export interface BuildingDefenseBalance {
  /** Damage of one arrow before the target armour multiplier. */
  readonly attackDamage: number;
  /** Seconds between volleys. */
  readonly attackCooldown: number;
  /** Maximum ground-plane distance from which the structure can fire. */
  readonly attackRange: number;
  /** Number of arrows fired at its chosen target in one volley. */
  readonly arrowsPerVolley: number;
  /** The same soft-counter table used by mobile ranged attackers. */
  readonly damageMultipliers: UnitDamageMultipliers;
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

/**
 * One centre level-up step within an age. `level` is the level it promotes to
 * (2 or 3). Cost is reserved when the upgrade starts and committed on completion;
 * a level-up carries no building or technology prerequisite ("cost only").
 */
export interface CenterLevelUpgradeBalance {
  readonly level: 2 | 3;
  readonly cost: StartingResources;
  readonly durationSeconds: number;
}

/**
 * Age-level command-centre benefits applied to the centre whenever the owner
 * enters this age (and at spawn). Kept here rather than in the per-building
 * progression matrix because control radius and worker-training pace are the
 * centre's alone — no other building has them.
 */
export interface CommandCenterAgeBalance {
  /** Buildable control radius the centre grants for this age. */
  readonly controlRadius: number;
  /** Worker training pace for this age; absent means "use the worker's own trainingSeconds". */
  readonly workerTrainingSeconds?: number;
}

/** The opening age. Its centre begins at Lv1; two upgrades reach Lv2 and Lv3. */
export interface SettlementAgeBalance {
  readonly id: "settlement";
  readonly label: string;
  readonly commandCenter: CommandCenterAgeBalance;
  /** Centre level upgrades within Settlement: Lv1→2, then Lv2→3 ("cost only"). */
  readonly levelUpgrades: readonly CenterLevelUpgradeBalance[];
}

/**
 * The Town age. Entered by the one-way transition from Settlement Lv3, then two
 * further centre level upgrades reach Town Lv2 and Lv3.
 */
export interface TownAgeBalance {
  readonly id: "town";
  readonly label: string;
  /** Atomically reserved when the Settlement Lv3 → Town transition begins. */
  readonly cost: StartingResources;
  readonly upgradeSeconds: number;
  /** Completed structures that prove the economy and defence are established. */
  readonly requiredBuildingIds: readonly string[];
  readonly commandCenter: CommandCenterAgeBalance;
  /** Centre level upgrades within Town: Lv1→2, then Lv2→3 ("cost only"). */
  readonly levelUpgrades: readonly CenterLevelUpgradeBalance[];
}

/** `public/game-data/balance/ages.json` — the centre-led progression contract. */
export interface AgeBalance {
  readonly settlement: SettlementAgeBalance;
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
    /**
     * Vertical Slice Plan v0.2 §53 (4): match seconds before the AI may attack
     * at all — the early-game non-aggression window.
     *
     * Playtesting for Kapı B found the opening decided the match: the AI built a
     * Barracks immediately and pushed, so the only winning reply was to rush
     * first, and §9's "12–25 dakika" window only appeared when neither side did.
     * The window buys the economy/expansion/age openings enough room to exist.
     *
     * Measured in *simulation* seconds, so §38's speed control scales it and a
     * pause freezes it. Defend is untouched: this suppresses the attack intent,
     * never the AI's ability to answer a rush against itself.
     */
    readonly peaceSeconds: number;
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

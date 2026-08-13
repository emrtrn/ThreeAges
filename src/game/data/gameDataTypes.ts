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

/**
 * AI opponent tuning profiles (plan §72), as a value rather than a bare union.
 *
 * The preset validator and the start card's difficulty row both need the list at
 * runtime, and two hand-written copies of it is how a fourth profile ends up
 * offered on the card but rejected by the validator. Declared here, next to the
 * type it derives, so there is one place to add one.
 */
export const AI_PROFILES = ["easy", "normal", "hard"] as const;

export type AiProfile = (typeof AI_PROFILES)[number];

/** Starting stockpile a preset grants (plan §72). Keys are resource ids; the
 *  Ürün A economy uses food/wood/population, later products add stone/gold. */
export type StartingResources = Readonly<Record<string, number>>;

/** Per-kingdom opening forces a preset may override (see `GamePreset`). */
export interface StartingUnits {
  readonly guard?: number;
  readonly worker?: number;
  /** Ranged infantry fielded at match start; absent keeps the normal opening at zero. */
  readonly archer?: number;
  /**
   * Artillery fielded at match start. Unlike guards and workers this defaults to
   * none: siege is a Town-tier unit, so a preset that opens with it is staging a
   * scenario (e.g. inspecting structure-destruction VFX without waiting on a
   * Barracks) rather than describing a normal opening.
   */
  readonly siege?: number;
}

/**
 * The centre tier a preset may open on (see {@link GamePreset.startingTier}).
 * One of the six playable tiers: Settlement 1–3 then Town 1–3.
 */
export interface StartingTier {
  readonly age: SettlementAge;
  readonly level: 1 | 2 | 3;
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
  /**
   * Centre tier every kingdom opens the match on, instead of Settlement Lv1.
   *
   * A test-only handicap in the same family as {@link enemyStartingResources}:
   * it exists so a Town-age feature can be exercised without first playing the
   * ten minutes of economy that unlock it — the Topçu sits behind the Town age,
   * and "reach the Town age" is not a useful step in a bombardment test. Applied
   * to both kingdoms, so the match stays symmetric; never ship a balance preset
   * with it.
   */
  startingTier?: StartingTier;
  /** Simulation speed multiplier (1 = real time; a debug preset may raise it). */
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

/**
 * How a unit's hits are shown when they should not look like an ordinary stab
 * or arrow. Presentation only — the damage is always the unit's own resolved
 * hit. Each value states its own scope:
 *
 * - `firebrand`: the Guard's thrown torch, on buildings only. Its hits on
 *   people stay melee, because that is what they are.
 * - `cannonball`: the artillery's lobbed iron ball, on *every* target it fires
 *   at. A gun does not switch to a bow because a soldier walked in front of the
 *   wall, so this one is not gated on the target class.
 */
export type UnitStructureAttackVfx = "firebrand" | "cannonball";

/** Buildings that can own a unit production queue. */
export type ProductionBuildingId = "command_center" | "barracks" | "archery_range";

/** Per-armour-class damage multipliers — the GDD 12 §33 soft-counter table. */
export type UnitDamageMultipliers = Readonly<Record<UnitArmorClass, number>>;

/** Balance stats shared by a unit definition (GDD 12 §5). */
export interface UnitBalanceStats {
  /**
   * The `units.json` key this definition was loaded under.
   *
   * Stamped by the validator from the key rather than authored in the body, so
   * it can never disagree with the map it lives in. It exists because
   * {@link UnitRoleId} is a fixed four-value enum while unit *variety* grows
   * inside a role: two different Guard units are both `role: "guard"` and only
   * their ids tell them apart. Anything that counts, groups or bulk-selects
   * "units of this kind" must key on this, not on the role.
   */
  readonly id: string;
  /** Player-facing name; the HUD never invents a label for a unit id. */
  readonly label: string;
  /**
   * Optional public UI asset, resolved from the game-data file rather than
   * chosen by a panel.  Placeholder art may be replaced without changing UI
   * code; omitted remains valid for headless fixtures and future content.
   */
  readonly icon?: UiAssetPath;
  /** Battlefield role, driving both production gating and UI role copy. */
  readonly role: UnitRoleId;
  /** What attackers resolve their §33 multiplier against when hitting this unit. */
  readonly armorClass: Exclude<UnitArmorClass, "structure">;
  /** Maximum hit points; must be positive. */
  maxHealth: number;
  /** Ground speed in world units/s; must be positive. */
  readonly moveSpeed: number;
  /**
   * How fast this unit may swing its body round, in degrees per second.
   *
   * Optional, and omitted means *instant*: a soldier is a body that pivots on
   * its own feet, and a turn rate on one would be a slow-motion effect nobody
   * asked for. What this exists for is the wheeled gun, which has to describe an
   * arc rather than spin on the spot — a carriage that snaps to a new heading in
   * one frame reads as a bug however good its model is.
   *
   * Facing is presentation only: nothing in targeting, movement or damage reads
   * which way a unit points, so a slow turn costs the unit no reach and gives
   * its enemy no opening. It lives in balance data all the same, because "how
   * heavy is this thing" is a tuning answer, not an art one.
   */
  readonly turnRateDegPerSecond?: number;
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
   * Optional visual flight speed for a projectile this unit fires, in world
   * units/s. It changes only the rendered projectile lifetime: combat damage
   * and the attack cooldown remain authoritative elsewhere.
   */
  readonly projectileSpeed?: number;
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
   * Fraction of a blow this unit absorbs while holding position *and* unable to
   * answer it — i.e. struck from beyond its own {@link attackRange}, by an archer,
   * a siege gun or a tower it will never step out to reach (GDD 06 §26).
   *
   * Scoped to blows it cannot return on purpose. Hold is meant to be a trade:
   * the unit gives up its feet and keeps its weapon, so an attacker that closes
   * into reach already gets an even exchange and needs no correction. What the
   * stance has no answer to is the enemy standing outside that reach, and this
   * is the shield raised against exactly that.
   *
   * Optional, and absent means none: bracing is a fact about carrying a shield,
   * not about receiving an order, so a unit that authors no number holds its
   * position exactly as it did before. Capped by the validator at
   * {@link MAX_AURA_DAMAGE_RESISTANCE} — the same ceiling a support field obeys,
   * and the two compose rather than replace each other.
   */
  readonly holdDamageResistance?: number;
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
   *
   * Every shipped unit sits at Lv1 of its own age — Guard = Settlement Lv1,
   * Archer = Town Lv1, artillery = Town Lv1 — so `requiredAge` carries the whole
   * unlock and reaching an age opens everything that age adds. The field stays
   * because the ladder is data: a retune can put a unit above Lv1 without a code
   * change, and the gate is enforced either way.
   */
  readonly requiredSettlementLevel: number;
  /** Resources reserved when this unit enters a production queue. */
  readonly cost: StartingResources;
  /** Population capacity consumed by this unit once queued. */
  readonly populationCost: number;
  /**
   * Optional attack presentation for units whose weapon is not an ordinary
   * blade or arrow. Omitted means a hit looks the same whatever it lands on,
   * which is the default for every role that has no siege identity of its own.
   */
  readonly structureAttackVfx?: UnitStructureAttackVfx;
  /**
   * Manifest effect asset id burst at the point this unit's shot lands.
   *
   * Only the arcing weapons can use it — the ones whose blow waits on a shell
   * that has to arrive ({@link structureAttackVfx} `cannonball`), because those
   * are the only shots with a landing to burst at. Presentation only: an id that
   * no manifested effect answers costs the shot its blast, never its damage.
   *
   * It is a free-form asset id rather than another closed enum like
   * `structureAttackVfx` on purpose. The choice of *which* weapon lobs is a
   * gameplay fact with code behind it; the choice of what its blast looks like
   * is authoring, and pointing it at a newly imported `.effect.json` must not
   * need a code change.
   */
  readonly impactEffect?: string;
}

/** `public/game-data/balance/units.json` — keyed by stable unit id. */
export type UnitBalance = Readonly<Record<string, UnitBalanceStats>>;

/**
 * A public, same-origin UI asset path.  Game data may point only at the
 * curated UI directories; this keeps data-driven panels from accepting an
 * arbitrary URL as artwork.
 */
export type UiAssetPath = `/assets/ui/icons/${string}.${"svg" | "png"}`;

/** One grid-aligned RTS building definition, loaded from balance/buildings.json. */
export interface BuildingBalanceStats {
  /** Stable data id, copied from the key in `balance/buildings.json`. */
  readonly id: string;
  readonly label: string;
  /** Compact tile/icon artwork used by build and selection UI. */
  readonly icon?: UiAssetPath;
  /** World-space footprint dimensions; both are multiples of the placement grid. */
  readonly footprint: { readonly width: number; readonly depth: number };
  /** Resource reservation is implemented in the following Phase 2 slice. */
  readonly cost: StartingResources;
  readonly constructionSeconds: number;
  /** The earliest settlement age in which this building may be placed. */
  readonly requiredAge?: SettlementAge;
  /**
   * Minimum global centre level *within {@link requiredAge}* the owner must have
   * reached before this building may be placed (1..3). Omitted means Lv1 — the
   * building opens the moment its age does, which is the default every structure
   * had before the field existed.
   *
   * Centre-led progression: the gate is a statement about the whole kingdom's
   * tier, not about one building, and it is data so the food ladder (the Tarla
   * behind the Avcı Kulübesi and the Ağıl) can be retuned without a code change.
   * A later age clears the gate outright: reaching Kasaba is never *less*
   * developed than Yerleşim Lv3.
   */
  readonly requiredSettlementLevel?: number;
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
  /** Present on support structures which sustain nearby friendly units (the Temple). */
  readonly aura?: BuildingAuraBalance;
  /** Completed local infrastructure that multiplies adjacent target production. */
  readonly productionAdjacency?: BuildingProductionAdjacencyBalance;
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
    "workerCapacity" | "perWorkerPerMinute" | "localBufferCapacity" | "carryCapacity"
    | "livestockCapacity" | "perAnimalPerMinute">;
  readonly territory?: Pick<TerritoryBuildingBalance, "controlRadius" | "connectedControlRadius">;
  readonly tradeCommission?: number;
  /**
   * The tier's live weapon. `attackDamage` is required and must climb by tier;
   * everything else is an optional override of the base `defense` block, which
   * is what lets the Karakol trade its bow for a gun on reaching Town — a
   * different weapon is a different cadence, volley size and counter table, not
   * just a bigger number.
   */
  readonly defense?: Pick<BuildingDefenseBalance, "attackDamage">
    & Partial<Omit<BuildingDefenseBalance, "attackDamage">>;
  /** Queue capacity supplied by military production structures at this tier. */
  readonly queueCapacity?: number;
  /** Global stock capacity this completed depot contributes, keyed by resource id. */
  readonly storageCapacity?: StartingResources;
}

/** Data-owned production behaviour for an RTS resource structure. */
export interface EconomyProductionBalance {
  readonly resourceId: string;
  readonly workerCapacity: number;
  /**
   * Output per worker standing at the job, per minute.
   *
   * Optional for exactly one shape of producer: a {@link requiresLivestock}
   * pasture, whose output is measured in penned animals rather than staff
   * (pasture plan §3.5). Everywhere else the validator still demands it — a
   * producer that hires workers and has no rate for them would earn nothing and
   * say nothing about why.
   */
  readonly perWorkerPerMinute?: number;
  readonly localBufferCapacity: number;
  /** Stone/gold buildings must cover a live matching finite deposit. */
  readonly requiresResourceNode?: boolean;
  /** Maximum distance at which a lumber worker may search for a live tree. */
  readonly requiresForest?: boolean;
  /**
   * Food buildings that hunt rather than farm: the camp must have live game in
   * reach, and its workers walk out to it. The finite twin of the endless Farm.
   */
  readonly requiresGame?: boolean;
  /**
   * The third production shape (pasture plan §3.5): this building pens tamed
   * animals and produces from the pen, with no worker at the till at all. Its
   * `workerCapacity` buys shepherds — who go out and *bring animals in* — rather
   * than staff whose presence is the output.
   *
   * Mutually exclusive with the three gathering flags above: a pasture is not a
   * camp that walks out to a finite source, it is a herd that lives here.
   */
  readonly requiresLivestock?: boolean;
  /** Maximum animals a pasture may hold; the hard ceiling on livestock income. */
  readonly livestockCapacity?: number;
  /**
   * Output per minute per unit of penned `pastureYield`, independent of workers.
   * Named for what it measures rather than reusing {@link perWorkerPerMinute},
   * because a tuner reading "per worker" on a building that needs none would be
   * reading a lie.
   */
  readonly perAnimalPerMinute?: number;
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
  /**
   * Resources whose *buy* side requires stock a supply caravan actually
   * delivered (supply plan KARAR 8). Every id must also appear in
   * {@link basePrice}; a resource left out of this list buys the old way, out of
   * gold alone.
   *
   * A list rather than a flag so a fork can exempt one resource by editing one
   * line of data and no code. The empty list is valid and gives the pre-supply
   * behaviour, which is what makes the whole mechanic revertible in one line.
   */
  readonly stocked: readonly string[];
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

/**
 * Passive support field of a completed structure, applied to the owner's units
 * standing inside it (the Temple).
 *
 * Both effects are one radius rather than two: the player reads a support
 * building as "my army is better *here*", and a heal that reached further than
 * the protection — or the reverse — would make that one place two places.
 * {@link damageResistance} is capped well under 1 by the validator, because a
 * field that made units unkillable would end every fight at the building rather
 * than in it.
 */
export interface BuildingAuraBalance {
  /** World-space radius from the structure's centre. */
  readonly radius: number;
  /** Health restored per second to each friendly unit inside the radius. */
  readonly healPerSecond: number;
  /** Fraction of incoming damage absorbed while inside, 0..{@link MAX_AURA_DAMAGE_RESISTANCE}. */
  readonly damageResistance: number;
}

/** A strict footprint-edge production bonus, first used by the Windmill. */
export interface BuildingProductionAdjacencyBalance {
  /** Stable id of the completed friendly building this structure supports. */
  readonly targetBuildingId: string;
  /** Output multiplier while the two completed footprints share an edge. */
  readonly multiplier: number;
}

/**
 * Ceiling on {@link BuildingAuraBalance.damageResistance}. Stated here rather
 * than only in the validator because the combat side clamps to the same number:
 * one constant means data and resolution cannot disagree about what "capped" is.
 */
export const MAX_AURA_DAMAGE_RESISTANCE = 0.75;

/**
 * What weapon a defensive structure is showing.
 *
 * - `arrow`: straight tracers, one per shot in the volley, over a blow that has
 *   already been struck. The Karakol's Settlement-age bow.
 * - `cannonball`: the same lobbed iron ball the Topçu throws, and the same
 *   contract — the tower's damage waits for the ball to land, so the blast and
 *   the death happen together. The Karakol's Town-age gun.
 */
export type BuildingDefenseVfx = "arrow" | "cannonball";

/** Data-owned stationary ranged attack for a completed defensive structure. */
export interface BuildingDefenseBalance {
  /** Damage of one shot before the target armour multiplier. */
  readonly attackDamage: number;
  /** Seconds between volleys. */
  readonly attackCooldown: number;
  /** Maximum ground-plane distance from which the structure can fire. */
  readonly attackRange: number;
  /** Number of shots fired at its chosen target in one volley. */
  readonly arrowsPerVolley: number;
  /** The same soft-counter table used by mobile ranged attackers. */
  readonly damageMultipliers: UnitDamageMultipliers;
  /** Weapon shown for this volley; absent means `arrow`. */
  readonly attackVfx?: BuildingDefenseVfx;
  /**
   * Authored burst played where a shell lands. Only meaningful with
   * {@link attackVfx} `cannonball`, exactly as on a unit's `impactEffect`.
   */
  readonly impactEffect?: string;
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

/**
 * How much one authored tree holds before it is felled.
 *
 * Deliberately capacity and nothing else. A deposit's `perWorkerPerMinute` sits
 * beside its capacity because the pile itself meters the work; a forest does
 * not — the lumber camp's own progression tiers decide how fast its workers
 * cut, so a rate here would be a second, quieter answer to a question
 * `buildings.json` already answers.
 */
export interface ResourceTreeBalance {
  /** Total wood in one tree before it is exhausted and removed. */
  readonly capacity: number;
}

/**
 * Data contract for one finite Faz 6 resource type.
 *
 * A resource is worked either as *deposits* (stone, gold: piles placed by
 * `BP_RTS_ResourceNode`, whose capacity depends on whether the pile is safe or
 * external) or as *trees* (wood: individual trunks placed by `BP_RTS_Tree`).
 * The two are mutually exclusive and `validateResourceBalance` refuses an entry
 * that claims both or neither, which is what keeps these optionals from meaning
 * "might be missing" at the call sites that narrow them.
 */
export interface ResourceBalanceStats {
  readonly id: string;
  readonly label: string;
  /** Deposit resources only; absent on a tree resource. */
  readonly safeNode?: ResourceNodeBalance;
  /** Deposit resources only; absent on a tree resource. */
  readonly externalNode?: ResourceNodeBalance;
  /** Tree resources only; absent on a deposit resource. */
  readonly tree?: ResourceTreeBalance;
}

/**
 * `public/game-data/balance/resources.json` — finite stone and gold deposits,
 * and the per-tree wood yield every authored tree is stamped with.
 */
export type ResourceBalance = Readonly<Record<string, ResourceBalanceStats>>;

/**
 * What a species does to the worker who has hold of it (V2 §4.3).
 *
 * Deliberately not a weapon: there is no range, no acquisition and no target
 * here, because the animal never chooses anybody. It hurts whoever is already
 * touching it — the one worker its claim names — and that is the whole of the
 * bull's risk. A species with no block simply endures being handled.
 */
export interface AnimalRetaliationBalance {
  /** Damage one blow lands on the worker holding the animal. */
  readonly damage: number;
  /** How often it lands, in blows per minute. */
  readonly attacksPerMinute: number;
}

/**
 * What a species does to somebody who never touched it (V3 §4, KARAR 1).
 *
 * The exact opposite of {@link AnimalRetaliationBalance}, and separate from it
 * for that reason: retaliation has no range because the animal never chooses
 * anybody, while every field here exists so it *can* choose — how far it looks,
 * how far it will follow, and what it is willing to look at. Merging the two
 * would attach a target to the rule whose whole point is that it has none.
 *
 * The radii are measured from different origins on purpose:
 * `acquisitionRadius` from the predator itself (what it can see right now), and
 * `pursuitRadius` from its den (how far the leash reaches). That is what keeps a
 * chase a local event instead of a walk across the map — a predator past its
 * leash gives up and returns to patrol.
 */
export interface AnimalPredatorBalance {
  /**
   * Ground speed the predator patrols its territory at (V3 §2.1).
   *
   * The one field here that is about *reading* rather than about damage, and it
   * exists because a predator has no grazing pace to fall back on. Every other
   * species drifts at its `walkClipSpeed`, which pins playback to rate 1 and is
   * exactly right for an animal whose idle behaviour is eating. A wolf's idle
   * behaviour is looking for something to eat, and at a grazer's pace it reads
   * as a deer with the wrong model on it.
   *
   * Above `walkClipSpeed` (or it is not a patrol) and below the presentation's
   * walk/run boundary — `moveSpeed * RTS_LOCOMOTION_CALIBRATION.runThreshold` —
   * or the wolf spends its whole patrol in the gallop clip. Both are pinned in
   * `test:engine` against the calibration itself rather than against a number.
   */
  readonly patrolSpeed: number;
  /** How far the predator looks for a victim, measured from itself. */
  readonly acquisitionRadius: number;
  /** Damage one bite lands. */
  readonly damage: number;
  /** How often it bites, in bites per minute. */
  readonly attacksPerMinute: number;
  /**
   * How far from its den the predator will follow a target before giving up.
   *
   * Must exceed the species' `roamRadius` — a leash shorter than the patrol
   * circle means the predator abandons every chase before it starts, which
   * reads as broken pathfinding rather than as tuning, so the validator refuses
   * it.
   */
  readonly pursuitRadius: number;
  /**
   * Wild species this predator hunts, by animal id. Empty is legal and means
   * "preys on workers only"; a tamed animal is never a victim regardless of
   * what is listed (V3 KARAR 5).
   */
  readonly preySpecies: readonly string[];
}

/**
 * How long a species stands between moves — locomotion polish plan §3.8.
 *
 * A range rather than a number so a herd does not step off in lockstep, and
 * per-species rather than the one shared `2.5..7` this replaced: a cow settling
 * for as long as a fox is the same "one rule for six animals" flatness the turn
 * rate fixes for rotation.
 */
export interface AnimalRestBalance {
  /** Shortest pause; zero is legal (a species that never settles). */
  readonly min: number;
  /** Longest pause; never below {@link min}. */
  readonly max: number;
}

/**
 * One huntable species. Wildlife is a *finite* food source that moves, which is
 * why its numbers live here rather than in `resources.json`: a deposit profile
 * is split safe/external by placement, while an animal carries its own yield
 * wherever it wanders (the tree model, not the deposit model).
 *
 * Deliberately carries no rig or clip data — the `*.skeleton.json` sidecar is
 * the single authority for which clip plays, and duplicating that here would
 * give a species two disagreeing animation truths.
 */
export interface AnimalBalanceStats {
  /** Stable data id, copied from the key in `balance/animals.json`. */
  readonly id: string;
  readonly label: string;
  /** Food one carcass yields before it is picked clean. */
  readonly meatCapacity: number;
  readonly maxHealth: number;
  /** Speed the animal flees at; the gallop clip is calibrated to it. */
  readonly moveSpeed: number;
  /**
   * Ground speed this species' walk clip reads naturally at, in world units/s.
   *
   * Authored rather than derived because the engine's default — half of
   * `moveSpeed` — assumes a model drawn at the scale its clips were made for,
   * and every animal carries an authored scale instead. It doubles as the
   * grazing speed ({@link RoamProfile}), which is what keeps a wandering animal
   * at playback rate 1 and so free of foot slide at any tuning.
   */
  readonly walkClipSpeed: number;
  /** Distance at which the animal breaks away from an approaching hunter. */
  readonly fleeRadius: number;
  /** How long one bolt lasts, in seconds. */
  readonly fleeSeconds: number;
  /**
   * Seconds the animal is winded after a bolt and ignores whatever frightened
   * it. This is what makes a hunt finish at all: prey is faster than a worker,
   * so a hunter only ever closes the gap during the recovery.
   */
  readonly fleeRecoverySeconds: number;
  /**
   * Seconds one hunter needs to bring this species down. The damage rate is
   * derived from it and `maxHealth`, so a tuner reads a duration rather than
   * doing the arithmetic — and the animal keeps a real health bar for whatever
   * else shoots at it.
   */
  readonly huntSeconds: number;
  /** How far from its herd's centre the animal may wander. */
  readonly roamRadius: number;
  /**
   * How fast this species may turn its body, in degrees per second.
   *
   * Authored per species rather than shared or derived, which is the whole of
   * the locomotion plan's §2.5: a bull swinging round as fast as a fox is the
   * tell that nothing here knows what animal it is drawing. Deriving it from
   * `moveSpeed` was refused for the reason `walkClipSpeed` was — the model's
   * authored scale means speed does not predict how a body reads on screen.
   *
   * Required of every species: a default would ship a new animal turning like
   * whatever the default happened to be, because nobody wrote the line.
   */
  readonly turnRateDegPerSecond: number;
  /** Seconds this species stands at a grazing spot before picking the next. */
  readonly restSeconds: AnimalRestBalance;
  /**
   * Whether a herder may drive this species into a Pasture instead of killing it
   * (V2 §4.1).
   *
   * Required rather than defaulted: "does this species tame" is a design answer
   * every species owes, and a missing field that quietly means `false` would let
   * a new animal ship as un-tameable because nobody wrote the line, not because
   * anybody decided it.
   */
  readonly tameable: boolean;
  /** Seconds one herder needs to calm this species; tameable species only. */
  readonly tameSeconds?: number;
  /**
   * How much this animal is worth in a pen, as a multiplier on the Pasture's
   * `perAnimalPerMinute`; tameable species only.
   *
   * The species half of V2 §4.4's split: the building says how good the pasture
   * is, the species says how good the animal is — the same shape as
   * `perWorkerPerMinute * workers`.
   */
  readonly pastureYield?: number;
  /** Seconds a stocked pen takes to add one animal, up to its capacity. */
  readonly breedSeconds?: number;
  /**
   * What this species does back while it is being calmed or hunted; absent for
   * every species that simply submits (V2 Faz 6).
   *
   * Optional and independent of {@link tameable} on purpose: fighting back is
   * not a taming trait, it is a temperament, and the predator V3 adds will want
   * this same field without ever being drivable into a pen.
   */
  readonly retaliation?: AnimalRetaliationBalance;
  /**
   * What this species hunts on its own initiative; absent for every species that
   * only ever grazes (V3 Faz 1).
   *
   * Absence is the normal answer, so it is optional rather than required like
   * {@link tameable}: "does this animal hunt" is answered by the whole shape of
   * the species, not by one flag somebody might forget. A species that carries
   * the block is a predator; one that does not is prey or livestock.
   */
  readonly predator?: AnimalPredatorBalance;
}

/** `public/game-data/balance/animals.json` — keyed by stable species id. */
export type AnimalBalance = Readonly<Record<string, AnimalBalanceStats>>;

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
  /**
   * How much an unfinished `economy.buildingTargets` plan pulls on the economy
   * score.
   *
   * The counterpart to {@link AiAttackScoring.developmentFloor}, and the term that
   * makes the plan reachable at all: only the Economy intent places buildings
   * (`AiController` runs the economy executor when that intent is committed), so a
   * settlement plan the score never asks for is a plan the AI never builds. With
   * the old one-of-each opening this term had nothing to measure — the order
   * emptied itself after eight buildings — which is why it arrives with the
   * targets rather than before them.
   */
  readonly developmentNeed: number;
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

/**
 * §30's Attack terms beyond the power ratio: how much a half-built settlement
 * holds the attack back.
 *
 * The age gate (`army.attackMinimumAge`) stops the AI attacking *before* Town;
 * this stops it treating the age transition as a finish line. Without it, a Town
 * AI with a dominant army scores a flat 1.0 on Attack, §7's hysteresis makes that
 * unbeatable (a rival needs 1.25×), and the second half of the match is the same
 * "convert everything into soldiers" opening the age gate was added to end.
 */
export interface AiAttackScoring {
  /**
   * The development multiplier at a settlement that has built nothing, rising
   * linearly to 1 as `economy.buildingTargets` are met.
   *
   * Deliberately a floor and not a gate: authored anchors can run out, and an AI
   * that could never finish its target city would otherwise never attack at all
   * and no match could end. 0 makes development a hard requirement, 1 disables
   * the term — both still expressible in data.
   */
  readonly developmentFloor: number;
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
  readonly attack: AiAttackScoring;
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
    /**
     * §24: the age the AI must have reached before it may *start* a fight.
     *
     * `peaceSeconds` bought the opening a fixed number of minutes; this buys it a
     * *state*. Playtesting after the window found the AI still spent the whole
     * Settlement age converting its economy into Guards, because nothing in §30
     * tied attacking to development — so the age transition and the developed
     * city §9 asks for were something the AI skipped rather than something it
     * played toward.
     *
     * Typed as an age rather than a boolean so a third age (Kingdom) needs no
     * code change: "settlement" is the pre-gate behaviour, still expressible.
     */
    readonly attackMinimumAge: SettlementAge;
    /**
     * Fail-safe for {@link attackMinimumAge}: match seconds after which the age
     * gate lifts regardless of the age reached.
     *
     * An AI whose economy was raided flat may never reach Town, and a hard gate
     * would leave it standing in its base forever while the match could not end.
     * 0 disables the fail-safe — the hard gate is still expressible in data.
     */
    readonly attackAgeGraceSeconds: number;
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
    /**
     * §54: power held back at the base before the field army may leave, per age.
     *
     * Per age rather than flat because what "the base is defended" means scales
     * with what there is to lose: a single flat value low enough for a Settlement
     * opening (two Guards) left a whole Town — four producers, a Market, an
     * Archery Range — behind the same two Guards.
     */
    readonly minimumDefensePower: Readonly<Record<SettlementAge, number>>;
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
    /**
     * How many of each building the AI's settlement is driving toward, per age
     * (building id → count).
     *
     * The opening template (§34) only ever asked "does one exist", so the AI
     * stopped developing the moment its first of each building stood: eight
     * buildings and nothing left for the economy intent to do, which is what
     * handed the match to Attack by default. A target count turns §34 from an
     * opening checklist into a settlement plan, and keeps the *order* (design) in
     * `aiEconomyManager.buildOrder` while the counts (tuning) live here.
     *
     * A target the authored anchors cannot satisfy is not an error — the build
     * manager's §43 blacklist reports the exhausted slots and the order falls
     * through to the next want — but it does hold {@link AiAttackScoring} below
     * its full development reading, so the two are tuned together.
     */
    readonly buildingTargets: Readonly<Record<SettlementAge, Readonly<Record<string, number>>>>;
  };
  /** §29–§30: the utility formula's own coefficients, not just its weights. */
  readonly scoring: AiScoringBalance;
  readonly profiles: Readonly<Record<AiProfile, AiProfileBalance>>;
  /** §30: per-intent multipliers applied to the raw utility score. */
  readonly intentWeights: Readonly<Record<AiIntent, number>>;
}

/**
 * `public/game-data/balance/ai-layout.json` — deterministic base-layout tuning.
 *
 * This intentionally lives beside, rather than inside, {@link AiBalance}:
 * `ai.json` decides *what* the AI wants to build, while this table only controls
 * where a safe candidate is searched for.  Keeping that boundary typed prevents
 * a layout retune from quietly changing the economy or combat director.
 */
export interface AiLayoutBalance {
  readonly version: 1;
  /** Number of ranked candidates retained for each building/source pair. */
  readonly candidateLimit: number;
  readonly zones: {
    readonly housing: AiLayoutZoneBalance;
    readonly logistics: AiLayoutZoneBalance;
    readonly military: AiLayoutZoneBalance;
    /** Search radius around a real resource source, tree grove, or herd. */
    readonly resource: AiLayoutZoneBalance;
  };
  readonly scoring: {
    /** Small deterministic preference that makes otherwise-safe layouts vary by seed. */
    readonly seedTieBreakWeight: number;
    /** Penalty per world unit from the zone/source's preferred radius. */
    readonly distancePenalty: number;
    /**
     * Bounded geometry-only preference for a candidate that keeps the paid
     * base-to-site connection short.  This deliberately approximates a road
     * with centre distance so the pure planner never reaches into RoadGraph.
     */
    readonly centerDistancePenalty: number;
  };
}

export interface AiLayoutZoneBalance {
  readonly minRadius: number;
  readonly maxRadius: number;
}

/**
 * Purely presentational tuning for how a committed road network is painted onto
 * an authored Landscape's paint layer (Painted Roads plan, Faz 0). Logistics —
 * topology, cost, connectivity — never reads these; they only shape the corridor
 * the {@link RoadTerrainPainter} hands to the engine's spline paint. When no
 * Landscape is mounted the box-mesh render ignores them entirely.
 */
export interface RoadVisual {
  /** Default landscape paint layer the corridor blends toward (e.g. `dirt`). */
  readonly layerId: string;
  /**
   * Per-age paint-layer override, keyed by {@link SettlementAge} (Painted Roads
   * Faz 5). The centre-led age drives a *visual* promotion — same road topology,
   * a different layer: e.g. `settlement → dirt`, `town → cobblestone`. An age
   * absent here falls back to {@link layerId}; logistics never reads this.
   */
  readonly ageLayers?: Readonly<Record<string, string>>;
  /** Corridor full width in world units (fully painted core before falloff). */
  readonly width: number;
  /** Soft edge distance blended out past the core, in world units. */
  readonly falloff: number;
  /** Peak paint weight applied along the corridor centre (0..1). */
  readonly strength: number;
  /**
   * Perpendicular jitter amplitude (world units) applied to interior control
   * points of long straight runs, breaking the grid look. `0` disables jitter
   * (Faz 3 behaviour: straight runs stay dead straight).
   */
  readonly jitter: number;
  /** Cells between inserted interior jitter points along a long straight run. */
  readonly jitterSpacingCells: number;
  /** Per-point width variation as a fraction of `width` (±), `0` disables it. */
  readonly widthVariation: number;
  /**
   * Tangent scale used when the painted road spline rounds a grid corner.
   * `0` keeps corners square; `0.5` matches the original Catmull-Rom-like
   * rounding; `1` produces the broadest supported turn.
   */
  readonly cornerRoundness: number;
}

/**
 * Purely presentational ground pad painted under every standing building's
 * footprint, the area counterpart of {@link RoadVisual}'s corridor. A building
 * sitting straight on grass reads as dropped on the field; clearing its ground to
 * the same worn layer the roads use ties the settlement together. Placement,
 * navigation and territory never read this — the pad is paint, not footprint.
 */
export interface BuildingPadVisual {
  /** Landscape paint layer the pad blends toward (e.g. `dirt`). */
  readonly layerId: string;
  /** World units the pad extends past the footprint edge before falling off. */
  readonly padding: number;
  /** Soft edge distance blended out past the padded core, in world units. */
  readonly falloff: number;
  /** Peak paint weight under the building (0..1); `0` disables the pad. */
  readonly strength: number;
}

/** `public/game-data/balance/roads.json` — first-pass logistics road tuning. */
export interface RoadBalance {
  /** Grid cell width in world units; intentionally independent from unit navigation. */
  readonly cellSize: number;
  /** Wood charged for each newly created road cell. */
  readonly woodCostPerCell: number;
  /** Presentational road-paint tuning; absent in data falls back to built-in defaults. */
  readonly visual: RoadVisual;
  /**
   * Presentational building ground-pad tuning. It lives with the road block
   * because both are the same feature — terrain paint driven by the settlement —
   * and share one landscape paint surface at runtime.
   */
  readonly buildingPad: BuildingPadVisual;
  /** Auto-built access road on placement; absent disables the feature. */
  readonly autoConnect?: RoadAutoConnect;
}

/**
 * When a player building lands near — but not touching — an existing road, a
 * short access road is paved for free (its cost folded into the building price)
 * up to `maxCells` new tiles. Beyond that the building is deemed placed off the
 * network and no road is drawn.
 */
export interface RoadAutoConnect {
  /** Max newly created road cells an auto access road may add; 0 disables it. */
  readonly maxCells: number;
}

/**
 * The pack animal that walks a producer's output down the road (V4 KARAR 3-B).
 *
 * It has its own table rather than a row in `animals.json` because it is not a
 * huntable species: a caravan neither grazes nor bolts, so every field that
 * table requires of a species — `fleeRadius`, `huntSeconds`, `roamRadius` — would
 * have to be invented for it, and invented numbers in a balance table mislead
 * the next person to tune it. It is not a row in `units.json` either: it is
 * never selected, never ordered, never queued and never counted against
 * population, so joining that table would drag the roster UI, group selection
 * and the population paths into seeing it (V4 §6.2).
 *
 * Art is shared with the wildlife pack all the same — the donkey's clips come
 * from its `*.skeleton.json` sidecar exactly as a deer's do. Data separate,
 * art common.
 */
export interface CaravanBalance {
  readonly label: string;
  /** Road speed, in world units/s. Deliberately unhurried: a caravan *is* the delay. */
  readonly moveSpeed: number;
  /**
   * Ground speed the donkey's walk clip reads naturally at, in world units/s.
   *
   * Authored for the same reason {@link AnimalBalanceStats.walkClipSpeed} is:
   * the model carries an authored scale, so the engine's "half of moveSpeed"
   * default would play the clip at a rate the feet do not agree with.
   */
  readonly walkClipSpeed: number;
  readonly maxHealth: number;
  /** How a caravan takes damage; livestock-soft, like every other animal. */
  readonly armorClass: Exclude<UnitArmorClass, "structure">;
  /** Seconds spent standing at each end of the trip, loading or unloading. */
  readonly loadSeconds: number;
  /** Caravans a linked producer keeps on the road (V4 KARAR 2-A: automatic). */
  readonly spawnPerProducer: number;
}

/**
 * One *kind* of trade site — the supply plan's answer to "where did the goods on
 * the market shelf come from" (`THREEAGES_RTS_MARKET_SUPPLY_PLAN.md` §6.1).
 *
 * A trade site is not a building: it is never built, never demolished, needs no
 * worker and costs no population (KARAR 2-A/3-A). The only decision it asks of a
 * kingdom is whether to run a road out to it. So its tuning cannot live in
 * `buildings.json` — every field that table requires of a building (cost,
 * construction time, footprint, health, progression tiers) would have to be
 * invented, and invented numbers in a balance table mislead the next person to
 * tune it.
 *
 * {@link carryCapacity} sits here rather than in `logistics.json` for a measured
 * reason (plan §3.8): cargo is a property of the *facility at the end of the
 * line*, not of the animal — producers carry it per building × tier in
 * `buildings.json`. A trade site has no tiers to inherit from, so it carries its
 * own, and {@link bufferCapacity} >= {@link carryCapacity} is then checkable from
 * this one table.
 */
export interface TradeSiteBalanceStats {
  /** Shown wherever the site is named in the UI. */
  readonly label: string;
  /** Selection-panel artwork, same constrained path as a building's or unit's. */
  readonly icon?: UiAssetPath;
  /** Which resource this site supplies; must have a market price to be buyable. */
  readonly resourceId: string;
  /** Units produced into the local buffer per minute, independent of workers. */
  readonly perMinute: number;
  /** Units one caravan carries from here to the market in a single trip. */
  readonly carryCapacity: number;
  /**
   * Units the site holds before production stalls (`buffer-full`), exactly as a
   * producer's `localBufferCapacity` does. Kept at or above
   * {@link carryCapacity}: a buffer smaller than one load empties on every
   * arrival, so "the buffer is full" — the signal that says "add a caravan or
   * move your market closer" — could never appear.
   */
  readonly bufferCapacity: number;
  /**
   * Pack animals this site keeps on its road. Per site rather than global
   * (`logistics.json`'s `spawnPerProducer`) because throughput is a property of
   * the *lane*: plan §3.8 measured one donkey at ~4.2 minutes per lot, which is
   * "practically closed", and four at ~63 seconds.
   */
  readonly caravanCount: number;
  /**
   * The landing the road has to touch, in world units. It is the site's
   * footprint for placement purposes: nothing is built or paved on it, and a
   * road reaches it from outside exactly as it reaches a producer.
   */
  readonly dock: { readonly width: number; readonly depth: number };
  /**
   * Total units this site can ever yield, or absent for a renewable one.
   *
   * KARAR 2-A ships renewable — the limit is throughput, not quantity — but the
   * field stays in the schema so a fork can author a finite pit without a code
   * change.
   */
  readonly capacity?: number;
}

/** `public/game-data/balance/trade-sites.json` — keyed by stable site-type id. */
export type TradeSiteBalance = Readonly<Record<string, TradeSiteBalanceStats>>;

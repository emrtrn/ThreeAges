/**
 * Game-data validation — Vertical Slice Plan v0.2 §17 ("ID ve referans
 * doğrulaması") / §19 ("Hatalı veri açık hata veriyor").
 *
 * Pure functions that take already-parsed JSON (unknown) and either return a
 * typed value or throw a descriptive Error naming the offending field. Kept
 * separate from fetch so both the browser loader and node tests validate the
 * exact same way (tests feed readFileSync content).
 */
import { isFeatureFlag } from "../core/featureFlags";
import { AI_TARGET_WEIGHTS } from "./gameDataTypes";

/**
 * Mirrors `RTS_WORLD_HALF_EXTENT` (`rts/world/rtsGround.ts`), duplicated rather
 * than imported because that module pulls in three.js and this validator is
 * pure TS on purpose (CLAUDE.md / TD-002). Only the §42 vision ceiling below
 * reads it; if the map ever grows, that check loosens — it never silently
 * passes bad data.
 */
const WORLD_HALF_EXTENT_FOR_VISION_CHECK = 70;
import type {
  AiAgeUpScoring,
  AiArmyComposition,
  AiBalance,
  AgeBalance,
  AiEconomyScoring,
  AiIntent,
  AiProfile,
  AiProfileBalance,
  AiScoringBalance,
  AiTargetWeights,
  BuildingBalance,
  BuildingProgressionBalance,
  BuildingProgressionTier,
  GamePreset,
  GameVersion,
  MarketBalance,
  ResourceBalance,
  RoadAutoConnect,
  RoadBalance,
  RoadVisual,
  SettlementAge,
  StartingResources,
  StartingUnits,
  UnitArmorClass,
  UnitAttackType,
  UnitBalance,
  UnitDamageMultipliers,
  UnitRoleId,
  UiAssetPath,
} from "./gameDataTypes";

/** Thrown for any malformed / mis-referenced game-data file. */
export class GameDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameDataError";
  }
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GameDataError(`${where}: expected a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireString(
  obj: Record<string, unknown>,
  key: string,
  where: string,
): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new GameDataError(`${where}: missing or empty string field "${key}"`);
  }
  return value;
}

function requireStringAllowEmpty(
  obj: Record<string, unknown>,
  key: string,
  where: string,
): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new GameDataError(`${where}: field "${key}" must be a string`);
  }
  return value;
}

/**
 * UI artwork is data-driven but remains a packaged, same-origin asset.  The
 * constrained path keeps panels portable and makes a bad asset reference fail
 * at load time instead of becoming a broken image after a player has started a
 * match.
 */
function optionalUiAssetPath(
  obj: Record<string, unknown>,
  key: "icon" | "portrait",
  where: string,
): UiAssetPath | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\/assets\/ui\/(?:icons|portraits)\/[a-z0-9][a-z0-9_-]*\.svg$/.test(value)) {
    throw new GameDataError(`${where}.${key}: must be a /assets/ui/icons/ or /assets/ui/portraits/ SVG path`);
  }
  return value as UiAssetPath;
}

function requireFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  where: string,
): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GameDataError(`${where}: field "${key}" must be a finite number`);
  }
  return value;
}

const AI_PROFILES: readonly AiProfile[] = ["easy", "normal", "hard"];

export function validateGameVersion(value: unknown): GameVersion {
  const where = "version.json";
  const obj = asObject(value, where);
  return {
    buildVersion: requireString(obj, "buildVersion", where),
    balanceVersion: requireString(obj, "balanceVersion", where),
  };
}

function validateFlags(
  value: unknown,
  where: string,
): GamePreset["flags"] {
  const obj = asObject(value, `${where}.flags`);
  const flags: GamePreset["flags"] = {};
  for (const [id, raw] of Object.entries(obj)) {
    // ID reference check: a preset may only reference known feature flags.
    if (!isFeatureFlag(id)) {
      throw new GameDataError(
        `${where}.flags: unknown feature flag id "${id}"`,
      );
    }
    if (typeof raw !== "boolean") {
      throw new GameDataError(
        `${where}.flags."${id}": must be a boolean`,
      );
    }
    flags[id] = raw;
  }
  return flags;
}

function validateStartingResources(
  value: unknown,
  where: string,
): StartingResources {
  const obj = asObject(value, `${where}.startingResources`);
  const out: Record<string, number> = {};
  for (const [id, raw] of Object.entries(obj)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      throw new GameDataError(
        `${where}.startingResources."${id}": must be a non-negative number`,
      );
    }
    out[id] = raw;
  }
  return out;
}

function validateStartingUnits(value: unknown, where: string): StartingUnits {
  const obj = asObject(value, `${where}.startingUnits`);
  const out: { guard?: number; worker?: number } = {};
  for (const key of ["guard", "worker"] as const) {
    const raw = obj[key];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
      throw new GameDataError(
        `${where}.startingUnits."${key}": must be a non-negative integer`,
      );
    }
    out[key] = raw;
  }
  return out;
}

/**
 * Validate a preset. When `expectedId` is given (the file name), it must match
 * the preset's `id` field — a reference check that keeps files self-describing.
 */
export function validateGamePreset(
  value: unknown,
  expectedId?: string,
): GamePreset {
  const where = expectedId ? `preset "${expectedId}"` : "preset";
  const obj = asObject(value, where);

  const id = requireString(obj, "id", where);
  if (expectedId !== undefined && id !== expectedId) {
    throw new GameDataError(
      `${where}: id "${id}" does not match file name "${expectedId}"`,
    );
  }

  const gameSpeed = requireFiniteNumber(obj, "gameSpeed", where);
  if (gameSpeed <= 0) {
    throw new GameDataError(`${where}: gameSpeed must be > 0`);
  }

  const aiProfileRaw = requireString(obj, "aiProfile", where);
  if (!AI_PROFILES.includes(aiProfileRaw as AiProfile)) {
    throw new GameDataError(
      `${where}: aiProfile "${aiProfileRaw}" is not one of ${AI_PROFILES.join(", ")}`,
    );
  }

  const levelRef = obj["levelRef"];
  if (levelRef !== undefined && (
    typeof levelRef !== "string" || !levelRef.endsWith(".level.json") || levelRef.startsWith("/") || levelRef.includes("..")
  )) {
    throw new GameDataError(`${where}.levelRef must be a public-relative .level.json path`);
  }

  return {
    id,
    label: requireString(obj, "label", where),
    flags: validateFlags(obj["flags"] ?? {}, where),
    startingResources: validateStartingResources(
      obj["startingResources"] ?? {},
      where,
    ),
    startingUnits: validateStartingUnits(obj["startingUnits"] ?? {}, where),
    ...(obj["enemyStartingResources"] !== undefined
      ? {
          enemyStartingResources: validateStartingResources(
            obj["enemyStartingResources"],
            `${where}.enemy`,
          ),
        }
      : {}),
    ...(obj["enemyStartingUnits"] !== undefined
      ? {
          enemyStartingUnits: validateStartingUnits(
            obj["enemyStartingUnits"],
            `${where}.enemy`,
          ),
        }
      : {}),
    gameSpeed,
    // mapState is intentionally allowed empty until a blockout exists (Faz 2).
    mapState: requireStringAllowEmpty(obj, "mapState", where),
    ...(levelRef ? { levelRef } : {}),
    aiProfile: aiProfileRaw as AiProfile,
  };
}

const UNIT_ROLES: readonly UnitRoleId[] = ["guard", "archer", "siege", "worker"];
const UNIT_ATTACK_TYPES: readonly UnitAttackType[] = ["melee", "ranged"];
const UNIT_ARMOR_CLASSES: readonly UnitArmorClass[] = ["light", "heavy", "structure"];
/** A unit's own armour is what attackers hit; only buildings are "structure". */
const UNIT_SELF_ARMOR_CLASSES: readonly UnitArmorClass[] = ["light", "heavy"];

/** GDD 12 §33: every attacker states a multiplier for every armour class. */
function validateDamageMultipliers(value: unknown, where: string): UnitDamageMultipliers {
  const obj = asObject(value, where);
  const multipliers = {} as Record<UnitArmorClass, number>;
  for (const armorClass of UNIT_ARMOR_CLASSES) {
    const multiplier = requireFiniteNumber(obj, armorClass, where);
    // Zero would make a matchup silently unwinnable rather than merely bad, and
    // §33's whole point is that counters are soft.
    if (multiplier <= 0) {
      throw new GameDataError(`${where}."${armorClass}": must be > 0`);
    }
    multipliers[armorClass] = multiplier;
  }
  for (const key of Object.keys(obj)) {
    if (!UNIT_ARMOR_CLASSES.includes(key as UnitArmorClass)) {
      throw new GameDataError(`${where}: unknown armour class "${key}"`);
    }
  }
  return multipliers;
}

/** Validate `balance/units.json` without tying balance data to render code. */
export function validateUnitBalance(value: unknown): UnitBalance {
  const where = "balance/units.json";
  const obj = asObject(value, where);
  const units: Record<string, UnitBalance["string"]> = {};
  for (const [id, raw] of Object.entries(obj)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      throw new GameDataError(`${where}: invalid unit id "${id}"`);
    }
    const statsWhere = `${where}."${id}"`;
    const stats = asObject(raw, statsWhere);
    const role = requireString(stats, "role", statsWhere);
    if (!UNIT_ROLES.includes(role as UnitRoleId)) {
      throw new GameDataError(`${statsWhere}.role: "${role}" is not one of ${UNIT_ROLES.join(", ")}`);
    }
    const armorClass = requireString(stats, "armorClass", statsWhere);
    if (!UNIT_SELF_ARMOR_CLASSES.includes(armorClass as UnitArmorClass)) {
      throw new GameDataError(
        `${statsWhere}.armorClass: "${armorClass}" is not one of ${UNIT_SELF_ARMOR_CLASSES.join(", ")}`,
      );
    }
    const attackType = requireString(stats, "attackType", statsWhere);
    if (!UNIT_ATTACK_TYPES.includes(attackType as UnitAttackType)) {
      throw new GameDataError(
        `${statsWhere}.attackType: "${attackType}" is not one of ${UNIT_ATTACK_TYPES.join(", ")}`,
      );
    }
    const maxHealth = requireFiniteNumber(stats, "maxHealth", statsWhere);
    if (maxHealth <= 0) {
      throw new GameDataError(`${where}."${id}".maxHealth: must be > 0`);
    }
    const moveSpeed = requireFiniteNumber(stats, "moveSpeed", statsWhere);
    if (moveSpeed <= 0) {
      throw new GameDataError(`${statsWhere}.moveSpeed: must be > 0`);
    }
    const attackDamage = requireFiniteNumber(stats, "attackDamage", statsWhere);
    if (attackDamage <= 0) {
      throw new GameDataError(`${statsWhere}.attackDamage: must be > 0`);
    }
    const attackCooldown = requireFiniteNumber(stats, "attackCooldown", statsWhere);
    if (attackCooldown <= 0) {
      throw new GameDataError(`${statsWhere}.attackCooldown: must be > 0`);
    }
    const attackRange = requireFiniteNumber(stats, "attackRange", statsWhere);
    if (attackRange <= 0) {
      throw new GameDataError(`${statsWhere}.attackRange: must be > 0`);
    }
    const acquisitionRange = requireFiniteNumber(stats, "acquisitionRange", statsWhere);
    if (acquisitionRange < 0) {
      throw new GameDataError(`${statsWhere}.acquisitionRange: must be >= 0`);
    }
    const chaseRange = requireFiniteNumber(stats, "chaseRange", statsWhere);
    if (chaseRange < 0) {
      throw new GameDataError(`${statsWhere}.chaseRange: must be >= 0`);
    }
    // A leash shorter than the range that starts the chase would make a unit
    // acquire a target and abandon it on the same tick (GDD 06 §39).
    if (acquisitionRange > 0 && chaseRange < acquisitionRange) {
      throw new GameDataError(`${statsWhere}.chaseRange: must be >= acquisitionRange`);
    }
    // A unit that cannot see as far as it can shoot could never open fire on its
    // own; the archer's range is the reason this is worth failing loudly on.
    if (acquisitionRange > 0 && acquisitionRange < attackRange) {
      throw new GameDataError(`${statsWhere}.acquisitionRange: must be >= attackRange`);
    }
    const visionRadius = requireFiniteNumber(stats, "visionRadius", statsWhere);
    if (visionRadius <= 0) {
      throw new GameDataError(`${statsWhere}.visionRadius: must be > 0`);
    }
    // Vision is what fog reveals; acquisition is what the unit shoots at. If
    // acquisition reached further, a unit would auto-attack an enemy its own
    // kingdom cannot see — the exact omniscience §59 exists to remove.
    if (visionRadius < acquisitionRange) {
      throw new GameDataError(`${statsWhere}.visionRadius: must be >= acquisitionRange`);
    }
    const trainingSeconds = requireFiniteNumber(stats, "trainingSeconds", statsWhere);
    if (trainingSeconds <= 0) {
      throw new GameDataError(`${statsWhere}.trainingSeconds: must be > 0`);
    }
    const requiredSettlementLevel = requireFiniteNumber(stats, "requiredSettlementLevel", statsWhere);
    if (!Number.isInteger(requiredSettlementLevel) || requiredSettlementLevel < 1 || requiredSettlementLevel > 3) {
      throw new GameDataError(`${statsWhere}.requiredSettlementLevel: must be an integer in 1..3`);
    }
    const productionBuildingId = requireString(stats, "productionBuildingId", statsWhere);
    if (productionBuildingId !== "command_center" && productionBuildingId !== "barracks" && productionBuildingId !== "archery_range") {
      throw new GameDataError(`${statsWhere}.productionBuildingId: must be command_center, barracks or archery_range`);
    }
    const requiredAge = requireString(stats, "requiredAge", statsWhere) as SettlementAge;
    if (!SETTLEMENT_AGES.includes(requiredAge)) {
      throw new GameDataError(`${statsWhere}.requiredAge: must be one of ${SETTLEMENT_AGES.join(", ")}`);
    }
    const populationCost = requireFiniteNumber(stats, "populationCost", statsWhere);
    if (!Number.isInteger(populationCost) || populationCost <= 0) {
      throw new GameDataError(`${statsWhere}.populationCost: must be a positive integer`);
    }
    const icon = optionalUiAssetPath(stats, "icon", statsWhere);
    const portrait = optionalUiAssetPath(stats, "portrait", statsWhere);
    units[id] = {
      label: requireString(stats, "label", statsWhere),
      ...(icon ? { icon } : {}),
      ...(portrait ? { portrait } : {}),
      role: role as UnitRoleId,
      armorClass: armorClass as Exclude<UnitArmorClass, "structure">,
      maxHealth,
      moveSpeed,
      attackType: attackType as UnitAttackType,
      attackDamage,
      attackCooldown,
      attackRange,
      acquisitionRange,
      chaseRange,
      visionRadius,
      damageMultipliers: validateDamageMultipliers(
        stats["damageMultipliers"],
        `${statsWhere}.damageMultipliers`,
      ),
      trainingSeconds,
      productionBuildingId,
      requiredAge,
      requiredSettlementLevel,
      cost: validateStartingResources(stats["cost"] ?? {}, statsWhere),
      populationCost,
    };
  }
  if (Object.keys(units).length === 0) {
    throw new GameDataError(`${where}: must define at least one unit`);
  }
  return units;
}

/** Validate `balance/buildings.json` before placement code receives its data. */
export function validateBuildingBalance(value: unknown): BuildingBalance {
  const where = "balance/buildings.json";
  const obj = asObject(value, where);
  const buildings: Record<string, BuildingBalance["string"]> = {};
  for (const [id, raw] of Object.entries(obj)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      throw new GameDataError(`${where}: invalid building id "${id}"`);
    }
    const statsWhere = `${where}."${id}"`;
    const stats = asObject(raw, statsWhere);
    const footprint = asObject(stats["footprint"], `${statsWhere}.footprint`);
    const width = requireFiniteNumber(footprint, "width", `${statsWhere}.footprint`);
    const depth = requireFiniteNumber(footprint, "depth", `${statsWhere}.footprint`);
    if (width <= 0 || depth <= 0) {
      throw new GameDataError(`${statsWhere}.footprint: width and depth must be > 0`);
    }
    const constructionSeconds = requireFiniteNumber(stats, "constructionSeconds", statsWhere);
    if (constructionSeconds <= 0) {
      throw new GameDataError(`${statsWhere}.constructionSeconds: must be > 0`);
    }
    const requiredAgeRaw = stats["requiredAge"];
    const requiredAge = requiredAgeRaw === undefined ? undefined : requireString(stats, "requiredAge", statsWhere) as SettlementAge;
    if (requiredAge !== undefined && !SETTLEMENT_AGES.includes(requiredAge)) {
      throw new GameDataError(`${statsWhere}.requiredAge: must be one of ${SETTLEMENT_AGES.join(", ")}`);
    }
    const maxHealth = requireFiniteNumber(stats, "maxHealth", statsWhere);
    if (maxHealth <= 0) {
      throw new GameDataError(`${statsWhere}.maxHealth: must be > 0`);
    }
    const visionRadius = requireFiniteNumber(stats, "visionRadius", statsWhere);
    if (visionRadius <= 0) {
      throw new GameDataError(`${statsWhere}.visionRadius: must be > 0`);
    }
    // GDD 08 §42: the Outpost is meant to be the wide one, but "must not open
    // most of the map by itself" is a real constraint, so it is enforced rather
    // than trusted. A quarter of the world's half-extent keeps any single
    // structure's reveal well under a third of the play area.
    if (visionRadius > WORLD_HALF_EXTENT_FOR_VISION_CHECK / 2) {
      throw new GameDataError(
        `${statsWhere}.visionRadius: must be <= ${WORLD_HALF_EXTENT_FOR_VISION_CHECK / 2} (GDD 08 §42)`,
      );
    }
    const populationCapacityRaw = stats["populationCapacity"];
    let populationCapacity: number | undefined;
    if (populationCapacityRaw !== undefined) {
      if (typeof populationCapacityRaw !== "number" || !Number.isInteger(populationCapacityRaw) || populationCapacityRaw <= 0) {
        throw new GameDataError(`${statsWhere}.populationCapacity: must be a positive integer`);
      }
      populationCapacity = populationCapacityRaw;
    }
    const economyRaw = stats["economy"];
    let economy: BuildingBalance["string"]["economy"];
    if (economyRaw !== undefined) {
      const economyWhere = `${statsWhere}.economy`;
      const economyData = asObject(economyRaw, economyWhere);
      const resourceId = requireString(economyData, "resourceId", economyWhere);
      if (!/^[a-z][a-z0-9_]*$/.test(resourceId)) {
        throw new GameDataError(`${economyWhere}.resourceId: invalid resource id "${resourceId}"`);
      }
      const workerCapacity = requireFiniteNumber(economyData, "workerCapacity", economyWhere);
      const perWorkerPerMinute = requireFiniteNumber(economyData, "perWorkerPerMinute", economyWhere);
      const localBufferCapacity = requireFiniteNumber(economyData, "localBufferCapacity", economyWhere);
      const requiresResourceNode = economyData["requiresResourceNode"];
      const requiresForest = economyData["requiresForest"];
      if (!Number.isInteger(workerCapacity) || workerCapacity <= 0) {
        throw new GameDataError(`${economyWhere}.workerCapacity: must be a positive integer`);
      }
      if (perWorkerPerMinute <= 0 || localBufferCapacity <= 0) {
        throw new GameDataError(`${economyWhere}: production rate and local buffer capacity must be > 0`);
      }
      if (requiresResourceNode !== undefined && typeof requiresResourceNode !== "boolean") {
        throw new GameDataError(`${economyWhere}.requiresResourceNode: must be a boolean`);
      }
      if (requiresForest !== undefined && typeof requiresForest !== "boolean") {
        throw new GameDataError(`${economyWhere}.requiresForest: must be a boolean`);
      }
      const forestSettings = requiresForest === true ? {
        gatherRadius: requireFiniteNumber(economyData, "gatherRadius", economyWhere),
        carryCapacity: requireFiniteNumber(economyData, "carryCapacity", economyWhere),
      } : null;
      if (forestSettings && (forestSettings.gatherRadius <= 0 || forestSettings.carryCapacity <= 0)) {
        throw new GameDataError(`${economyWhere}: forest gatherRadius and carryCapacity must be > 0`);
      }
      economy = {
        resourceId,
        workerCapacity,
        perWorkerPerMinute,
        localBufferCapacity,
        ...(requiresResourceNode === true ? { requiresResourceNode: true } : {}),
        ...(forestSettings ? { requiresForest: true, ...forestSettings } : {}),
      };
    }
    const territoryRaw = stats["territory"];
    let territory: BuildingBalance["string"]["territory"];
    if (territoryRaw !== undefined) {
      const territoryWhere = `${statsWhere}.territory`;
      const territoryData = asObject(territoryRaw, territoryWhere);
      const controlRadius = requireFiniteNumber(territoryData, "controlRadius", territoryWhere);
      const connectedControlRadius = requireFiniteNumber(territoryData, "connectedControlRadius", territoryWhere);
      const expansionPlacementRange = requireFiniteNumber(territoryData, "expansionPlacementRange", territoryWhere);
      if (controlRadius <= 0 || connectedControlRadius < controlRadius || expansionPlacementRange <= 0) {
        throw new GameDataError(`${territoryWhere}: control radius and placement range must be > 0`);
      }
      territory = { controlRadius, connectedControlRadius, expansionPlacementRange };
    }
    const marketRaw = stats["market"];
    let market: BuildingBalance["string"]["market"];
    if (marketRaw !== undefined) {
      market = validateMarketBalance(marketRaw, `${statsWhere}.market`);
    }
    const defenseRaw = stats["defense"];
    let defense: BuildingBalance["string"]["defense"];
    if (defenseRaw !== undefined) {
      const defenseWhere = `${statsWhere}.defense`;
      const defenseData = asObject(defenseRaw, defenseWhere);
      const attackDamage = requireFiniteNumber(defenseData, "attackDamage", defenseWhere);
      const attackCooldown = requireFiniteNumber(defenseData, "attackCooldown", defenseWhere);
      const attackRange = requireFiniteNumber(defenseData, "attackRange", defenseWhere);
      const arrowsPerVolley = requireFiniteNumber(defenseData, "arrowsPerVolley", defenseWhere);
      if (attackDamage <= 0 || attackCooldown <= 0 || attackRange <= 0) {
        throw new GameDataError(`${defenseWhere}: damage, cooldown and range must be > 0`);
      }
      if (!Number.isInteger(arrowsPerVolley) || arrowsPerVolley <= 0) {
        throw new GameDataError(`${defenseWhere}.arrowsPerVolley: must be a positive integer`);
      }
      defense = {
        attackDamage,
        attackCooldown,
        attackRange,
        arrowsPerVolley,
        damageMultipliers: validateDamageMultipliers(defenseData["damageMultipliers"], `${defenseWhere}.damageMultipliers`),
      };
    }
    const progressionRaw = stats["progression"];
    const progression = progressionRaw === undefined ? undefined : validateBuildingProgression(
      progressionRaw,
      `${statsWhere}.progression`,
      id,
      {
        maxHealth,
        ...(populationCapacity !== undefined ? { populationCapacity } : {}),
        ...(economy ? { economy } : {}),
        ...(territory ? { territory } : {}),
        ...(market ? { market } : {}),
        ...(defense ? { defense } : {}),
        ...(requiredAge ? { requiredAge } : {}),
      },
    );
    const icon = optionalUiAssetPath(stats, "icon", statsWhere);
    const portrait = optionalUiAssetPath(stats, "portrait", statsWhere);
    buildings[id] = {
      id,
      label: requireString(stats, "label", statsWhere),
      ...(icon ? { icon } : {}),
      ...(portrait ? { portrait } : {}),
      footprint: { width, depth },
      cost: validateStartingResources(stats["cost"] ?? {}, statsWhere),
      constructionSeconds,
      ...(requiredAge ? { requiredAge } : {}),
      maxHealth,
      visionRadius,
      ...(populationCapacity ? { populationCapacity } : {}),
      ...(economy ? { economy } : {}),
      ...(territory ? { territory } : {}),
      ...(market ? { market } : {}),
      ...(defense ? { defense } : {}),
      ...(progression ? { progression } : {}),
    };
  }
  if (Object.keys(buildings).length === 0) {
    throw new GameDataError(`${where}: must define at least one building`);
  }
  return buildings;
}

/**
 * Validates the staged six-tier matrix.  It deliberately has no upgrade cost
 * fields yet: the legacy `levels` ladder remains the authoritative research
 * cost/timer source during the Phase 1 → Phase 2 migration.
 */
function validateBuildingProgression(
  value: unknown,
  where: string,
  buildingId: string,
  base: Pick<BuildingBalance["string"], "maxHealth" | "populationCapacity" | "economy" | "territory" | "market" | "defense" | "requiredAge">,
): BuildingProgressionBalance {
  const data = asObject(value, where);
  const byAge = {} as Record<SettlementAge, readonly BuildingProgressionTier[]>;
  for (const age of SETTLEMENT_AGES) {
    const entriesRaw = data[age];
    const ageWhere = `${where}.${age}`;
    if (!Array.isArray(entriesRaw)) {
      throw new GameDataError(`${ageWhere}: must be an array`);
    }
    if (entriesRaw.length === 0) {
      if (base.requiredAge !== "town" || age !== "settlement") {
        throw new GameDataError(`${ageWhere}: only a Town-only building may omit Settlement tiers`);
      }
      byAge[age] = [];
      continue;
    }
    if (entriesRaw.length !== 3) {
      throw new GameDataError(`${ageWhere}: must define exactly Lv1, Lv2 and Lv3`);
    }
    let previousHealth = 0;
    let previousPopulation = 0;
    let previousWorkerCapacity = 0;
    let previousRate = 0;
    let previousBuffer = 0;
    let previousCarry = 0;
    let previousControlRadius = 0;
    let previousConnectedRadius = 0;
    let previousCommission = 1;
    let previousDamage = 0;
    let previousQueueCapacity = 0;
    let previousStorage: Readonly<Record<string, number>> | null = null;
    const entries: BuildingProgressionTier[] = entriesRaw.map((entryRaw, index) => {
      const entryWhere = `${ageWhere}[${index}]`;
      const entry = asObject(entryRaw, entryWhere);
      const expectedLevel = index + 1;
      const level = requireFiniteNumber(entry, "level", entryWhere);
      if (level !== expectedLevel) {
        throw new GameDataError(`${entryWhere}.level: expected ${expectedLevel}`);
      }
      const maxHealth = requireFiniteNumber(entry, "maxHealth", entryWhere);
      if (maxHealth <= previousHealth) {
        throw new GameDataError(`${entryWhere}.maxHealth: must exceed the previous tier`);
      }
      previousHealth = maxHealth;

      const populationRaw = entry["populationCapacity"];
      let populationCapacity: number | undefined;
      if (populationRaw !== undefined) {
        if (base.populationCapacity === undefined || !Number.isInteger(populationRaw) || typeof populationRaw !== "number"
          || populationRaw <= previousPopulation) {
          throw new GameDataError(`${entryWhere}.populationCapacity: requires housing and must increase by tier`);
        }
        populationCapacity = populationRaw;
        previousPopulation = populationRaw;
      }

      const economyRaw = entry["economy"];
      let economy: BuildingProgressionTier["economy"];
      if (economyRaw !== undefined) {
        if (!base.economy) throw new GameDataError(`${entryWhere}.economy: requires a base economy definition`);
        const economyData = asObject(economyRaw, `${entryWhere}.economy`);
        const workerCapacity = requireFiniteNumber(economyData, "workerCapacity", `${entryWhere}.economy`);
        const perWorkerPerMinute = requireFiniteNumber(economyData, "perWorkerPerMinute", `${entryWhere}.economy`);
        const localBufferCapacity = requireFiniteNumber(economyData, "localBufferCapacity", `${entryWhere}.economy`);
        if (!Number.isInteger(workerCapacity) || workerCapacity < previousWorkerCapacity
          || perWorkerPerMinute < previousRate || localBufferCapacity < previousBuffer
          || (workerCapacity === previousWorkerCapacity
            && perWorkerPerMinute === previousRate
            && localBufferCapacity === previousBuffer)) {
          throw new GameDataError(`${entryWhere}.economy: no value may shrink and at least one core value must increase by tier`);
        }
        const carryRaw = economyData["carryCapacity"];
        let carryCapacity: number | undefined;
        if (carryRaw !== undefined) {
          if (typeof carryRaw !== "number" || !Number.isFinite(carryRaw) || carryRaw < previousCarry) {
            throw new GameDataError(`${entryWhere}.economy.carryCapacity: may not shrink by tier`);
          }
          carryCapacity = carryRaw;
          previousCarry = carryRaw;
        }
        previousWorkerCapacity = workerCapacity;
        previousRate = perWorkerPerMinute;
        previousBuffer = localBufferCapacity;
        economy = { workerCapacity, perWorkerPerMinute, localBufferCapacity, ...(carryCapacity !== undefined ? { carryCapacity } : {}) };
      }

      const territoryRaw = entry["territory"];
      let territory: BuildingProgressionTier["territory"];
      if (territoryRaw !== undefined) {
        if (!base.territory) throw new GameDataError(`${entryWhere}.territory: requires a base territory definition`);
        const territoryData = asObject(territoryRaw, `${entryWhere}.territory`);
        const controlRadius = requireFiniteNumber(territoryData, "controlRadius", `${entryWhere}.territory`);
        const connectedControlRadius = requireFiniteNumber(territoryData, "connectedControlRadius", `${entryWhere}.territory`);
        if (controlRadius <= previousControlRadius || connectedControlRadius <= previousConnectedRadius || connectedControlRadius < controlRadius) {
          throw new GameDataError(`${entryWhere}.territory: both radii must increase by tier`);
        }
        previousControlRadius = controlRadius;
        previousConnectedRadius = connectedControlRadius;
        territory = { controlRadius, connectedControlRadius };
      }

      const tradeRaw = entry["tradeCommission"];
      let tradeCommission: number | undefined;
      if (tradeRaw !== undefined) {
        if (!base.market || typeof tradeRaw !== "number" || !Number.isFinite(tradeRaw) || !(tradeRaw > 0) || tradeRaw >= previousCommission) {
          throw new GameDataError(`${entryWhere}.tradeCommission: requires Market and must fall by tier`);
        }
        assertNoArbitrage(base.market.priceStep, base.market.indexMin, tradeRaw, `${entryWhere}.tradeCommission`);
        tradeCommission = tradeRaw;
        previousCommission = tradeRaw;
      }

      const defenseRaw = entry["defense"];
      let defense: BuildingProgressionTier["defense"];
      if (defenseRaw !== undefined) {
        if (!base.defense) throw new GameDataError(`${entryWhere}.defense: requires a base defense definition`);
        const attackDamage = requireFiniteNumber(asObject(defenseRaw, `${entryWhere}.defense`), "attackDamage", `${entryWhere}.defense`);
        if (attackDamage <= previousDamage) throw new GameDataError(`${entryWhere}.defense.attackDamage: must increase by tier`);
        defense = { attackDamage };
        previousDamage = attackDamage;
      }

      const queueRaw = entry["queueCapacity"];
      let queueCapacity: number | undefined;
      if (queueRaw !== undefined) {
        if (!Number.isInteger(queueRaw) || typeof queueRaw !== "number" || queueRaw <= previousQueueCapacity) {
          throw new GameDataError(`${entryWhere}.queueCapacity: must be a positive integer that increases by tier`);
        }
        queueCapacity = queueRaw;
        previousQueueCapacity = queueRaw;
      }
      const storageRaw = entry["storageCapacity"];
      let storageCapacity: Readonly<Record<string, number>> | undefined;
      if (storageRaw !== undefined) {
        if (buildingId !== "depot") {
          throw new GameDataError(`${entryWhere}.storageCapacity: only a depot may provide global storage`);
        }
        storageCapacity = validateStorageCapacity(storageRaw, `${entryWhere}.storageCapacity`);
        if (previousStorage && Object.keys(storageCapacity).some((resourceId) =>
          (storageCapacity![resourceId] ?? 0) <= (previousStorage![resourceId] ?? 0))) {
          throw new GameDataError(`${entryWhere}.storageCapacity: every resource must increase by tier`);
        }
        previousStorage = storageCapacity;
      } else if (buildingId === "depot") {
        throw new GameDataError(`${entryWhere}.storageCapacity: every depot tier must define food, wood, stone and gold capacity`);
      }
      return { level: expectedLevel as 1 | 2 | 3, maxHealth, ...(populationCapacity !== undefined ? { populationCapacity } : {}), ...(economy ? { economy } : {}), ...(territory ? { territory } : {}), ...(tradeCommission !== undefined ? { tradeCommission } : {}), ...(defense ? { defense } : {}), ...(queueCapacity !== undefined ? { queueCapacity } : {}), ...(storageCapacity ? { storageCapacity } : {}) };
    });
    byAge[age] = entries;
  }
  const settlementLast = byAge.settlement[2];
  const townFirst = byAge.town[0]!;
  if (settlementLast === undefined) return byAge;
  if (townFirst.maxHealth <= settlementLast.maxHealth) {
    throw new GameDataError(`${where}.town[0].maxHealth: Town Lv1 must exceed Settlement Lv3`);
  }
  assertTownTierDoesNotRegress(where, "populationCapacity", townFirst.populationCapacity, settlementLast.populationCapacity);
  assertTownTierDoesNotRegress(where, "economy.workerCapacity", townFirst.economy?.workerCapacity, settlementLast.economy?.workerCapacity);
  assertTownTierDoesNotRegress(where, "economy.perWorkerPerMinute", townFirst.economy?.perWorkerPerMinute, settlementLast.economy?.perWorkerPerMinute);
  assertTownTierDoesNotRegress(where, "economy.localBufferCapacity", townFirst.economy?.localBufferCapacity, settlementLast.economy?.localBufferCapacity);
  assertTownTierDoesNotRegress(where, "economy.carryCapacity", townFirst.economy?.carryCapacity, settlementLast.economy?.carryCapacity);
  assertTownTierDoesNotRegress(where, "territory.controlRadius", townFirst.territory?.controlRadius, settlementLast.territory?.controlRadius);
  assertTownTierDoesNotRegress(where, "territory.connectedControlRadius", townFirst.territory?.connectedControlRadius, settlementLast.territory?.connectedControlRadius);
  assertTownTierDoesNotRegress(where, "defense.attackDamage", townFirst.defense?.attackDamage, settlementLast.defense?.attackDamage);
  assertTownTierDoesNotRegress(where, "queueCapacity", townFirst.queueCapacity, settlementLast.queueCapacity);
  if (townFirst.storageCapacity !== undefined && settlementLast.storageCapacity !== undefined) {
    for (const resourceId of Object.keys(settlementLast.storageCapacity)) {
      if ((townFirst.storageCapacity[resourceId] ?? 0) < (settlementLast.storageCapacity[resourceId] ?? 0)) {
        throw new GameDataError(`${where}.town[0].storageCapacity.${resourceId}: Town Lv1 may not regress below Settlement Lv3`);
      }
    }
  }
  if (townFirst.tradeCommission !== undefined && settlementLast.tradeCommission !== undefined && townFirst.tradeCommission >= settlementLast.tradeCommission) {
    throw new GameDataError(`${where}.town[0].tradeCommission: Town Lv1 must improve on Settlement Lv3`);
  }
  return byAge;
}

function validateStorageCapacity(value: unknown, where: string): Readonly<Record<string, number>> {
  const data = asObject(value, where);
  const resourceIds = ["food", "wood", "stone", "gold"];
  const actualIds = Object.keys(data).sort();
  if (actualIds.length !== resourceIds.length || actualIds.some((id, index) => id !== [...resourceIds].sort()[index])) {
    throw new GameDataError(`${where}: must define exactly food, wood, stone and gold`);
  }
  return Object.fromEntries(resourceIds.map((resourceId) => {
    const amount = requireFiniteNumber(data, resourceId, where);
    if (amount <= 0) throw new GameDataError(`${where}.${resourceId}: must be > 0`);
    return [resourceId, amount];
  }));
}

function assertTownTierDoesNotRegress(
  where: string,
  field: string,
  townValue: number | undefined,
  settlementValue: number | undefined,
): void {
  if (townValue !== undefined && settlementValue !== undefined && townValue < settlementValue) {
    throw new GameDataError(`${where}.town[0].${field}: Town Lv1 may not regress below Settlement Lv3`);
  }
}

/**
 * Validate a Market's trade tuning (plan `THREEAGES_MARKET_TRADE_PLAN.md` §4).
 *
 * The last check is the one that matters most and is not a shape check at all:
 * a commission too small next to the price step makes an instant round trip
 * profitable, so the market mints gold from nothing. That is a *balance* bug
 * with no symptom until someone notices infinite money, so it is refused here
 * rather than left to a play-test.
 */
export function validateMarketBalance(value: unknown, where: string): MarketBalance {
  const data = asObject(value, where);
  const lotSize = requireFiniteNumber(data, "lotSize", where);
  if (!Number.isInteger(lotSize) || lotSize <= 0) {
    throw new GameDataError(`${where}.lotSize: must be a positive integer`);
  }
  const priceStep = requireFiniteNumber(data, "priceStep", where);
  const indexMin = requireFiniteNumber(data, "indexMin", where);
  const indexMax = requireFiniteNumber(data, "indexMax", where);
  const commission = requireFiniteNumber(data, "commission", where);
  if (priceStep <= 0) {
    throw new GameDataError(`${where}.priceStep: must be > 0`);
  }
  // The index starts at 1.0, so a band that excludes 1 would be unreachable.
  if (!(indexMin > 0) || indexMin > 1 || indexMax < 1) {
    throw new GameDataError(`${where}: indexMin must be in (0, 1] and indexMax must be >= 1`);
  }
  if (!(commission > 0) || commission >= 1) {
    throw new GameDataError(`${where}.commission: must be in (0, 1)`);
  }
  const basePriceWhere = `${where}.basePrice`;
  const basePriceData = asObject(data["basePrice"], basePriceWhere);
  const basePrice: Record<string, number> = {};
  for (const [resourceId, raw] of Object.entries(basePriceData)) {
    if (!/^[a-z][a-z0-9_]*$/.test(resourceId)) {
      throw new GameDataError(`${basePriceWhere}: invalid resource id "${resourceId}"`);
    }
    // Gold is the numeraire — pricing it against itself is meaningless, and a
    // `gold` entry would silently create a gold-for-gold trade button.
    if (resourceId === "gold") {
      throw new GameDataError(`${basePriceWhere}: "gold" is the numeraire and cannot be traded against itself`);
    }
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
      throw new GameDataError(`${basePriceWhere}."${resourceId}": must be a finite number > 0`);
    }
    basePrice[resourceId] = raw;
  }
  if (Object.keys(basePrice).length === 0) {
    throw new GameDataError(`${basePriceWhere}: must price at least one tradable resource`);
  }
  assertNoArbitrage(priceStep, indexMin, commission, where);
  return { lotSize, basePrice, priceStep, indexMin, indexMax, commission };
}

/**
 * The invariant of plan §4.3, in one place because two callers need it: the base
 * tuning, and every level that lowers the commission (Faz M3). The worst case is
 * at the price floor, where the spread earned by the house is smallest relative
 * to the step the trade itself moves.
 */
function assertNoArbitrage(priceStep: number, indexMin: number, commission: number, where: string): void {
  if (priceStep * (1 + commission) >= 2 * indexMin * commission) {
    throw new GameDataError(
      `${where}: priceStep ${priceStep} and commission ${commission} allow a profitable round trip at indexMin `
      + `${indexMin} — require priceStep * (1 + commission) < 2 * indexMin * commission`,
    );
  }
}

/** Validate Faz 6's finite stone/gold deposit profiles. */
export function validateResourceBalance(value: unknown): ResourceBalance {
  const where = "balance/resources.json";
  const obj = asObject(value, where);
  const resources: Record<string, ResourceBalance["string"]> = {};
  for (const [id, raw] of Object.entries(obj)) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      throw new GameDataError(`${where}: invalid resource id "${id}"`);
    }
    const statsWhere = `${where}."${id}"`;
    const stats = asObject(raw, statsWhere);
    const node = (key: "safeNode" | "externalNode") => {
      const nodeWhere = `${statsWhere}.${key}`;
      const nodeData = asObject(stats[key], nodeWhere);
      const capacity = requireFiniteNumber(nodeData, "capacity", nodeWhere);
      const perWorkerPerMinute = requireFiniteNumber(nodeData, "perWorkerPerMinute", nodeWhere);
      if (capacity <= 0 || perWorkerPerMinute <= 0) {
        throw new GameDataError(`${nodeWhere}: capacity and perWorkerPerMinute must be > 0`);
      }
      return { capacity, perWorkerPerMinute };
    };
    const safeNode = node("safeNode");
    const externalNode = node("externalNode");
    if (externalNode.capacity <= safeNode.capacity) {
      throw new GameDataError(`${statsWhere}.externalNode.capacity: must exceed safeNode.capacity`);
    }
    resources[id] = {
      id,
      label: requireString(stats, "label", statsWhere),
      safeNode,
      externalNode,
    };
  }
  for (const id of ["stone", "gold"]) {
    if (!resources[id]) throw new GameDataError(`${where}: missing required resource "${id}"`);
  }
  return resources;
}

/**
 * Validate the centre-led progression contract: the Settlement -> Town
 * transition plus the two "cost only" centre level upgrades each age carries.
 */
export function validateAgeBalance(value: unknown): AgeBalance {
  const where = "balance/ages.json";
  const obj = asObject(value, where);
  const settlement = asObject(obj["settlement"], `${where}.settlement`);
  const town = asObject(obj["town"], `${where}.town`);
  if (requireString(settlement, "id", `${where}.settlement`) !== "settlement") {
    throw new GameDataError(`${where}.settlement.id: must be \"settlement\"`);
  }
  if (requireString(town, "id", `${where}.town`) !== "town") {
    throw new GameDataError(`${where}.town.id: must be \"town\"`);
  }
  const upgradeSeconds = requireFiniteNumber(town, "upgradeSeconds", `${where}.town`);
  if (upgradeSeconds <= 0) {
    throw new GameDataError(`${where}.town.upgradeSeconds: must be > 0`);
  }
  const cost = validateStartingResources(town["cost"], `${where}.town`);
  for (const resourceId of ["food", "wood", "stone", "gold"]) {
    if ((cost[resourceId] ?? 0) <= 0) {
      throw new GameDataError(`${where}.town.cost: must include positive ${resourceId}`);
    }
  }
  const requirements = town["requiredBuildingIds"];
  if (!Array.isArray(requirements) || requirements.length === 0
    || requirements.some((id) => typeof id !== "string" || !/^[a-z][a-z0-9_]*$/.test(id))
    || new Set(requirements).size !== requirements.length) {
    throw new GameDataError(`${where}.town.requiredBuildingIds: must be a non-empty unique building-id array`);
  }
  return {
    settlement: {
      id: "settlement",
      label: requireString(settlement, "label", `${where}.settlement`),
      commandCenter: validateCommandCenterAge(settlement["commandCenter"], `${where}.settlement.commandCenter`),
      levelUpgrades: validateCenterLevelUpgrades(settlement["levelUpgrades"], `${where}.settlement.levelUpgrades`),
    },
    town: {
      id: "town",
      label: requireString(town, "label", `${where}.town`),
      cost,
      upgradeSeconds,
      requiredBuildingIds: [...requirements] as string[],
      commandCenter: validateCommandCenterAge(town["commandCenter"], `${where}.town.commandCenter`),
      levelUpgrades: validateCenterLevelUpgrades(town["levelUpgrades"], `${where}.town.levelUpgrades`),
    },
  };
}

/** Age-level centre benefits: a positive control radius and an optional training pace. */
function validateCommandCenterAge(value: unknown, where: string): AgeBalance["settlement"]["commandCenter"] {
  const data = asObject(value, where);
  const controlRadius = requireFiniteNumber(data, "controlRadius", where);
  if (controlRadius <= 0) throw new GameDataError(`${where}.controlRadius: must be > 0`);
  const trainingRaw = data["workerTrainingSeconds"];
  if (trainingRaw === undefined) return { controlRadius };
  const workerTrainingSeconds = requireFiniteNumber(data, "workerTrainingSeconds", where);
  if (workerTrainingSeconds <= 0) throw new GameDataError(`${where}.workerTrainingSeconds: must be > 0`);
  return { controlRadius, workerTrainingSeconds };
}

/**
 * The two "cost only" centre level upgrades of an age: exactly Lv2 then Lv3,
 * each with a positive duration and a payable cost. No building or technology
 * prerequisite lives here — the whole point of a centre level-up is that its
 * only gate is the resources it reserves.
 */
function validateCenterLevelUpgrades(value: unknown, where: string): AgeBalance["settlement"]["levelUpgrades"] {
  if (!Array.isArray(value)) throw new GameDataError(`${where}: must be an array`);
  if (value.length !== 2) throw new GameDataError(`${where}: must define exactly the Lv2 and Lv3 upgrades`);
  return value.map((entryRaw, index) => {
    const entryWhere = `${where}[${index}]`;
    const entry = asObject(entryRaw, entryWhere);
    const expectedLevel = index + 2;
    const level = requireFiniteNumber(entry, "level", entryWhere);
    if (level !== expectedLevel) throw new GameDataError(`${entryWhere}.level: expected ${expectedLevel}`);
    const durationSeconds = requireFiniteNumber(entry, "durationSeconds", entryWhere);
    if (durationSeconds <= 0) throw new GameDataError(`${entryWhere}.durationSeconds: must be > 0`);
    return { level: expectedLevel as 2 | 3, cost: validateStartingResources(entry["cost"], entryWhere), durationSeconds };
  });
}

const AI_INTENTS: readonly AiIntent[] = ["economy", "ageUp", "expand", "defend", "attack"];
const SETTLEMENT_AGES: readonly SettlementAge[] = ["settlement", "town"];
/** The four Faz 6 resources the AI drives income targets for. */
const AI_SCORED_RESOURCES: readonly string[] = ["food", "wood", "stone", "gold"];
/** §53 shapes the three combat roles; a worker is not part of an army ratio. */
const AI_COMPOSITION_ROLES: readonly (keyof AiArmyComposition)[] = ["guard", "archer", "siege"];
const AI_ECONOMY_SCORING_TERMS: readonly (keyof AiEconomyScoring)[] = [
  "workerNeed",
  "incomeDeficit",
  "populationPressure",
  "recoveryNeed",
  "immediateThreat",
];
const AI_AGE_UP_SCORING_TERMS: readonly (keyof AiAgeUpScoring)[] = [
  "requirementProgress",
  "affordability",
  "economyMaturity",
  "immediateThreat",
];
/** AI design §73 caps a hard-difficulty economy bonus; anything above is a data bug. */
const MAX_AI_ECONOMY_MULTIPLIER = 1.05;

function requirePositive(obj: Record<string, unknown>, key: string, where: string): number {
  const value = requireFiniteNumber(obj, key, where);
  if (value <= 0) throw new GameDataError(`${where}: field "${key}" must be > 0`);
  return value;
}

function validateAiProfileBalance(value: unknown, profile: AiProfile, where: string): AiProfileBalance {
  const obj = asObject(value, `${where}.profiles.${profile}`);
  const scope = `${where}.profiles.${profile}`;
  const economyMultiplier = requirePositive(obj, "economyMultiplier", scope);
  const reactionDelaySeconds = requireFiniteNumber(obj, "reactionDelaySeconds", scope);
  if (economyMultiplier > MAX_AI_ECONOMY_MULTIPLIER) {
    throw new GameDataError(`${scope}: economyMultiplier must not exceed ${MAX_AI_ECONOMY_MULTIPLIER}`);
  }
  // §72: normal is the fair baseline and may never grant a hidden bonus.
  if (profile === "normal" && economyMultiplier !== 1) {
    throw new GameDataError(`${scope}: the normal profile must keep economyMultiplier at 1`);
  }
  if (reactionDelaySeconds < 0) {
    throw new GameDataError(`${scope}: reactionDelaySeconds must be >= 0`);
  }
  return { economyMultiplier, reactionDelaySeconds };
}

/** Validate the data-owned AI tuning contract (AI design §30, §70–§73). */
export function validateAiBalance(value: unknown): AiBalance {
  const where = "balance/ai.json";
  const obj = asObject(value, where);

  const evaluationObj = asObject(obj["evaluation"], `${where}.evaluation`);
  const evaluation = {
    directorSeconds: requirePositive(evaluationObj, "directorSeconds", `${where}.evaluation`),
    armySeconds: requirePositive(evaluationObj, "armySeconds", `${where}.evaluation`),
    economySeconds: requirePositive(evaluationObj, "economySeconds", `${where}.evaluation`),
    minimumCommitmentSeconds: requirePositive(evaluationObj, "minimumCommitmentSeconds", `${where}.evaluation`),
    planTimeoutSeconds: requirePositive(evaluationObj, "planTimeoutSeconds", `${where}.evaluation`),
    hysteresisMargin: requireFiniteNumber(evaluationObj, "hysteresisMargin", `${where}.evaluation`),
  };
  if (evaluation.hysteresisMargin < 0) {
    throw new GameDataError(`${where}.evaluation: hysteresisMargin must be >= 0`);
  }
  if (evaluation.planTimeoutSeconds < evaluation.minimumCommitmentSeconds) {
    throw new GameDataError(`${where}.evaluation: planTimeoutSeconds must be >= minimumCommitmentSeconds`);
  }

  const armyObj = asObject(obj["army"], `${where}.army`);
  const army = {
    peaceSeconds: requireFiniteNumber(armyObj, "peaceSeconds", `${where}.army`),
    attackPowerRatio: requirePositive(armyObj, "attackPowerRatio", `${where}.army`),
    riskyAttackPowerRatio: requirePositive(armyObj, "riskyAttackPowerRatio", `${where}.army`),
    retreatPowerRatio: requirePositive(armyObj, "retreatPowerRatio", `${where}.army`),
    retreatHealthRatio: requireFiniteNumber(armyObj, "retreatHealthRatio", `${where}.army`),
    dominancePowerRatio: requirePositive(armyObj, "dominancePowerRatio", `${where}.army`),
    minimumDefensePower: requireFiniteNumber(armyObj, "minimumDefensePower", `${where}.army`),
    populationShare: requirePositive(armyObj, "populationShare", `${where}.army`),
    rolePower: validateAiRolePower(armyObj["rolePower"], `${where}.army.rolePower`),
    composition: validateAiCompositions(armyObj["composition"], `${where}.army.composition`),
    targetWeights: validateAiTargetWeights(armyObj["targetWeights"], `${where}.army.targetWeights`),
  };
  // §65: a health floor outside 0..1 would either never fire or retreat always.
  if (!(army.retreatHealthRatio >= 0 && army.retreatHealthRatio <= 1)) {
    throw new GameDataError(`${where}.army: retreatHealthRatio must be within 0..1`);
  }
  // §60/§69: dominance below the attack bar would hand the centre full victory
  // value the moment attacking became legal, making it always the best target.
  if (army.dominancePowerRatio < army.attackPowerRatio) {
    throw new GameDataError(
      `${where}.army: dominancePowerRatio must be >= attackPowerRatio`,
    );
  }
  // §62 orders these thresholds; an out-of-order set would make the army both
  // attack and retreat in the same band.
  if (!(army.retreatPowerRatio <= army.riskyAttackPowerRatio && army.riskyAttackPowerRatio <= army.attackPowerRatio)) {
    throw new GameDataError(
      `${where}.army: expected retreatPowerRatio <= riskyAttackPowerRatio <= attackPowerRatio`,
    );
  }
  if (army.minimumDefensePower < 0) {
    throw new GameDataError(`${where}.army: minimumDefensePower must be >= 0`);
  }
  // §53 (4): 0 disables the window (the pre-grace behaviour, still expressible);
  // negative is meaningless and would read as "attack before the match started".
  if (army.peaceSeconds < 0) {
    throw new GameDataError(`${where}.army: peaceSeconds must be >= 0`);
  }
  // §55: a share of 1 lets the army fill the population by itself, which is the
  // deadlock the ceiling exists to prevent — there would be no headroom left for
  // the workers that pay for it.
  if (army.populationShare >= 1) {
    throw new GameDataError(`${where}.army: populationShare must be < 1 — the economy needs headroom`);
  }

  const economyObj = asObject(obj["economy"], `${where}.economy`);
  const workerTargetObj = asObject(economyObj["workerTarget"], `${where}.economy.workerTarget`);
  const workerTarget = {} as Record<SettlementAge, number>;
  for (const age of SETTLEMENT_AGES) {
    workerTarget[age] = requirePositive(workerTargetObj, age, `${where}.economy.workerTarget`);
  }
  // §35: a Town that wanted fewer workers than a Settlement would have the AI
  // stop growing exactly when its four-resource economy needs the most hands.
  if (workerTarget.town < workerTarget.settlement) {
    throw new GameDataError(`${where}.economy.workerTarget: town must be >= settlement`);
  }
  const incomeObj = asObject(economyObj["incomeTargetsPerMinute"], `${where}.economy.incomeTargetsPerMinute`);
  const incomeTargetsPerMinute: Record<string, number> = {};
  for (const resourceId of AI_SCORED_RESOURCES) {
    incomeTargetsPerMinute[resourceId] = requirePositive(
      incomeObj, resourceId, `${where}.economy.incomeTargetsPerMinute`,
    );
  }
  for (const key of Object.keys(incomeObj)) {
    if (!AI_SCORED_RESOURCES.includes(key)) {
      throw new GameDataError(`${where}.economy.incomeTargetsPerMinute: unknown resource "${key}"`);
    }
  }
  const economy = {
    workerTarget,
    populationPressureBuffer: requireFiniteNumber(economyObj, "populationPressureBuffer", `${where}.economy`),
    incomeTargetsPerMinute,
  };
  if (economy.populationPressureBuffer < 0) {
    throw new GameDataError(`${where}.economy: populationPressureBuffer must be >= 0`);
  }

  const scoring = validateAiScoring(obj["scoring"], `${where}.scoring`);

  const profilesObj = asObject(obj["profiles"], `${where}.profiles`);
  const profiles = {} as Record<AiProfile, AiProfileBalance>;
  for (const profile of AI_PROFILES) {
    if (profilesObj[profile] === undefined) {
      throw new GameDataError(`${where}.profiles: missing profile "${profile}"`);
    }
    profiles[profile] = validateAiProfileBalance(profilesObj[profile], profile, where);
  }

  const weightsObj = asObject(obj["intentWeights"], `${where}.intentWeights`);
  const intentWeights = {} as Record<AiIntent, number>;
  for (const intent of AI_INTENTS) {
    const weight = requireFiniteNumber(weightsObj, intent, `${where}.intentWeights`);
    if (weight < 0) throw new GameDataError(`${where}.intentWeights: "${intent}" must be >= 0`);
    intentWeights[intent] = weight;
  }
  for (const key of Object.keys(weightsObj)) {
    if (!AI_INTENTS.includes(key as AiIntent)) {
      throw new GameDataError(`${where}.intentWeights: unknown intent "${key}"`);
    }
  }

  return { evaluation, army, economy, scoring, profiles, intentWeights };
}

/** §52: every role's base power is data, and a worker may never count as army. */
function validateAiRolePower(value: unknown, where: string): Record<UnitRoleId, number> {
  const obj = asObject(value, where);
  const power = {} as Record<UnitRoleId, number>;
  for (const role of UNIT_ROLES) {
    const term = requireFiniteNumber(obj, role, where);
    if (term < 0) throw new GameDataError(`${where}: "${role}" must be >= 0`);
    power[role] = term;
  }
  for (const key of Object.keys(obj)) {
    if (!UNIT_ROLES.includes(key as UnitRoleId)) {
      throw new GameDataError(`${where}: unknown role "${key}"`);
    }
  }
  // §52 measures fighting strength; a worker with power would read a base full
  // of villagers as defended and suppress the AI's own defend score.
  if (power.worker !== 0) throw new GameDataError(`${where}: "worker" must be 0 — workers never fight`);
  return power;
}

/** §53: the army shape per age. An all-zero ratio would train nothing at all. */
function validateAiCompositions(value: unknown, where: string): Record<SettlementAge, AiArmyComposition> {
  const obj = asObject(value, where);
  const compositions = {} as Record<SettlementAge, AiArmyComposition>;
  for (const age of SETTLEMENT_AGES) {
    const scope = `${where}.${age}`;
    const ageObj = asObject(obj[age], scope);
    const composition = {} as Record<keyof AiArmyComposition, number>;
    for (const role of AI_COMPOSITION_ROLES) {
      const share = requireFiniteNumber(ageObj, role, scope);
      if (share < 0) throw new GameDataError(`${scope}: "${role}" must be >= 0`);
      composition[role] = share;
    }
    for (const key of Object.keys(ageObj)) {
      if (!AI_COMPOSITION_ROLES.includes(key as keyof AiArmyComposition)) {
        throw new GameDataError(`${scope}: unknown role "${key}"`);
      }
    }
    if (AI_COMPOSITION_ROLES.every((role) => composition[role] === 0)) {
      throw new GameDataError(`${scope}: at least one role must be > 0, or the AI trains nothing`);
    }
    compositions[age] = composition;
  }
  return compositions;
}

/**
 * §29–§30: the scoring coefficients themselves, not only the intent weights.
 *
 * Every term is a non-negative contribution to a raw score that is clamped to
 * 0..1, so the numbers only have meaning relative to each other — which is
 * exactly why they belong in data next to the weights that scale them.
 */
function validateAiScoring(value: unknown, where: string): AiScoringBalance {
  const obj = asObject(value, where);

  const economyObj = asObject(obj["economy"], `${where}.economy`);
  const economy = {} as Record<keyof AiEconomyScoring, number>;
  for (const term of AI_ECONOMY_SCORING_TERMS) {
    const weight = requireFiniteNumber(economyObj, term, `${where}.economy`);
    if (weight < 0) throw new GameDataError(`${where}.economy: "${term}" must be >= 0`);
    economy[term] = weight;
  }

  const ageUpObj = asObject(obj["ageUp"], `${where}.ageUp`);
  const ageUp = {} as Record<keyof AiAgeUpScoring, number>;
  for (const term of AI_AGE_UP_SCORING_TERMS) {
    const weight = requireFiniteNumber(ageUpObj, term, `${where}.ageUp`);
    if (weight < 0) throw new GameDataError(`${where}.ageUp: "${term}" must be >= 0`);
    ageUp[term] = weight;
  }

  const expandObj = asObject(obj["expand"], `${where}.expand`);
  const expand = { recipeWoodCost: requirePositive(expandObj, "recipeWoodCost", `${where}.expand`) };

  const normalizersObj = asObject(obj["normalizers"], `${where}.normalizers`);
  const normalizers = {
    // Both are divisors: a zero would make every threat read as infinite.
    threatPower: requirePositive(normalizersObj, "threatPower", `${where}.normalizers`),
    disconnectedProducers: requirePositive(normalizersObj, "disconnectedProducers", `${where}.normalizers`),
  };

  return { economy, ageUp, expand, normalizers };
}

/** §60: every term is weighted in data, and an unknown term is a typo, not a feature. */
function validateAiTargetWeights(value: unknown, where: string): AiTargetWeights {
  const obj = asObject(value, where);
  const weights = {} as Record<keyof AiTargetWeights, number>;
  for (const term of AI_TARGET_WEIGHTS) {
    const weight = requireFiniteNumber(obj, term, where);
    if (weight < 0) throw new GameDataError(`${where}: "${term}" must be >= 0`);
    weights[term] = weight;
  }
  for (const key of Object.keys(obj)) {
    if (!AI_TARGET_WEIGHTS.includes(key as keyof AiTargetWeights)) {
      throw new GameDataError(`${where}: unknown target term "${key}"`);
    }
  }
  return weights;
}

/** Built-in road-paint tuning used when `roads.json` omits the `visual` block. */
const DEFAULT_ROAD_VISUAL: RoadVisual = {
  layerId: "dirt",
  ageLayers: { settlement: "dirt", town: "rock" },
  width: 2.5,
  falloff: 2,
  strength: 0.9,
  jitter: 0.6,
  jitterSpacingCells: 5,
  widthVariation: 0.15,
};

/** Parse the optional per-age paint-layer override map (age → non-empty layer id). */
function validateRoadAgeLayers(value: unknown, scope: string): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  const map = asObject(value, `${scope}.ageLayers`);
  const entries: Array<[string, string]> = [];
  for (const [age, layer] of Object.entries(map)) {
    if (typeof layer !== "string" || layer.length === 0) {
      throw new GameDataError(`${scope}.ageLayers.${age}: must be a non-empty layer id`);
    }
    entries.push([age, layer]);
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/** Optional finite number field, falling back to `fallback` when absent. */
function optionalFiniteNumber(
  obj: Record<string, unknown>,
  key: string,
  where: string,
  fallback: number,
): number {
  const value = obj[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GameDataError(`${where}: field "${key}" must be a finite number`);
  }
  return value;
}

/** Validate the optional presentational road-paint block (defaults when absent). */
function validateRoadVisual(value: unknown, where: string): RoadVisual {
  if (value === undefined) return { ...DEFAULT_ROAD_VISUAL };
  const obj = asObject(value, `${where}.visual`);
  const scope = `${where}.visual`;
  const layerId = typeof obj["layerId"] === "string" && obj["layerId"].length > 0
    ? (obj["layerId"] as string)
    : DEFAULT_ROAD_VISUAL.layerId;
  const width = optionalFiniteNumber(obj, "width", scope, DEFAULT_ROAD_VISUAL.width);
  const falloff = optionalFiniteNumber(obj, "falloff", scope, DEFAULT_ROAD_VISUAL.falloff);
  const strength = optionalFiniteNumber(obj, "strength", scope, DEFAULT_ROAD_VISUAL.strength);
  const jitter = optionalFiniteNumber(obj, "jitter", scope, DEFAULT_ROAD_VISUAL.jitter);
  const jitterSpacingCells = optionalFiniteNumber(obj, "jitterSpacingCells", scope, DEFAULT_ROAD_VISUAL.jitterSpacingCells);
  const widthVariation = optionalFiniteNumber(obj, "widthVariation", scope, DEFAULT_ROAD_VISUAL.widthVariation);
  if (width <= 0 || falloff < 0 || strength <= 0 || jitter < 0 || jitterSpacingCells < 1 || widthVariation < 0) {
    throw new GameDataError(`${scope}: width/strength must be > 0, others must be non-negative (spacing >= 1)`);
  }
  const ageLayers = validateRoadAgeLayers(obj["ageLayers"], scope);
  return { layerId, width, falloff, strength, jitter, jitterSpacingCells, widthVariation, ...(ageLayers ? { ageLayers } : {}) };
}

/** Validate the small data-owned road cost/grid contract before RTS uses it. */
export function validateRoadBalance(value: unknown): RoadBalance {
  const where = "balance/roads.json";
  const obj = asObject(value, where);
  const cellSize = requireFiniteNumber(obj, "cellSize", where);
  const woodCostPerCell = requireFiniteNumber(obj, "woodCostPerCell", where);
  if (cellSize <= 0 || woodCostPerCell <= 0) {
    throw new GameDataError(`${where}: cell size and wood cost must be > 0`);
  }
  const autoConnect = validateRoadAutoConnect(obj["autoConnect"], where);
  return {
    cellSize,
    woodCostPerCell,
    visual: validateRoadVisual(obj["visual"], where),
    ...(autoConnect ? { autoConnect } : {}),
  };
}

/** Validate the optional auto-connect access-road block (feature off when absent). */
function validateRoadAutoConnect(value: unknown, where: string): RoadAutoConnect | undefined {
  if (value === undefined) return undefined;
  const scope = `${where}.autoConnect`;
  const obj = asObject(value, scope);
  const maxCells = requireFiniteNumber(obj, "maxCells", scope);
  if (maxCells < 0 || !Number.isInteger(maxCells)) {
    throw new GameDataError(`${scope}: maxCells must be a non-negative integer`);
  }
  return { maxCells };
}

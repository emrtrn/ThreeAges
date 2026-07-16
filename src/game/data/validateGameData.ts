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
  GamePreset,
  GameVersion,
  ResourceBalance,
  RoadBalance,
  SettlementAge,
  StartingResources,
  UnitArmorClass,
  UnitAttackType,
  UnitBalance,
  UnitDamageMultipliers,
  UnitRoleId,
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

  return {
    id,
    label: requireString(obj, "label", where),
    flags: validateFlags(obj["flags"] ?? {}, where),
    startingResources: validateStartingResources(
      obj["startingResources"] ?? {},
      where,
    ),
    gameSpeed,
    // mapState is intentionally allowed empty until a blockout exists (Faz 2).
    mapState: requireStringAllowEmpty(obj, "mapState", where),
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
    const trainingSeconds = requireFiniteNumber(stats, "trainingSeconds", statsWhere);
    if (trainingSeconds <= 0) {
      throw new GameDataError(`${statsWhere}.trainingSeconds: must be > 0`);
    }
    const requiredBuildingLevel = requireFiniteNumber(stats, "requiredBuildingLevel", statsWhere);
    if (!Number.isInteger(requiredBuildingLevel) || requiredBuildingLevel <= 0) {
      throw new GameDataError(`${statsWhere}.requiredBuildingLevel: must be a positive integer`);
    }
    const populationCost = requireFiniteNumber(stats, "populationCost", statsWhere);
    if (!Number.isInteger(populationCost) || populationCost <= 0) {
      throw new GameDataError(`${statsWhere}.populationCost: must be a positive integer`);
    }
    units[id] = {
      label: requireString(stats, "label", statsWhere),
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
      damageMultipliers: validateDamageMultipliers(
        stats["damageMultipliers"],
        `${statsWhere}.damageMultipliers`,
      ),
      trainingSeconds,
      requiredBuildingLevel,
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
    const maxHealth = requireFiniteNumber(stats, "maxHealth", statsWhere);
    if (maxHealth <= 0) {
      throw new GameDataError(`${statsWhere}.maxHealth: must be > 0`);
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
      if (!Number.isInteger(workerCapacity) || workerCapacity <= 0) {
        throw new GameDataError(`${economyWhere}.workerCapacity: must be a positive integer`);
      }
      if (perWorkerPerMinute <= 0 || localBufferCapacity <= 0) {
        throw new GameDataError(`${economyWhere}: production rate and local buffer capacity must be > 0`);
      }
      if (requiresResourceNode !== undefined && typeof requiresResourceNode !== "boolean") {
        throw new GameDataError(`${economyWhere}.requiresResourceNode: must be a boolean`);
      }
      economy = {
        resourceId,
        workerCapacity,
        perWorkerPerMinute,
        localBufferCapacity,
        ...(requiresResourceNode === true ? { requiresResourceNode: true } : {}),
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
    const upgradeRaw = stats["upgrade"];
    let upgrade: BuildingBalance["string"]["upgrade"];
    if (upgradeRaw !== undefined) {
      const upgradeWhere = `${statsWhere}.upgrade`;
      const upgradeData = asObject(upgradeRaw, upgradeWhere);
      const durationSeconds = requireFiniteNumber(upgradeData, "durationSeconds", upgradeWhere);
      const upgradeMaxHealth = requireFiniteNumber(upgradeData, "maxHealth", upgradeWhere);
      if (durationSeconds <= 0 || upgradeMaxHealth <= maxHealth) {
        throw new GameDataError(`${upgradeWhere}: durationSeconds must be > 0 and maxHealth must exceed T1`);
      }
      const upgradeTerritoryRaw = upgradeData["territory"];
      let upgradeTerritory: NonNullable<BuildingBalance["string"]["upgrade"]>["territory"];
      if (upgradeTerritoryRaw !== undefined) {
        if (!territory) throw new GameDataError(`${upgradeWhere}.territory requires a T1 territory definition`);
        const upgradeTerritoryWhere = `${upgradeWhere}.territory`;
        const upgradeTerritoryData = asObject(upgradeTerritoryRaw, upgradeTerritoryWhere);
        const controlRadius = requireFiniteNumber(upgradeTerritoryData, "controlRadius", upgradeTerritoryWhere);
        const connectedControlRadius = requireFiniteNumber(upgradeTerritoryData, "connectedControlRadius", upgradeTerritoryWhere);
        if (controlRadius < territory.controlRadius || connectedControlRadius < controlRadius
          || connectedControlRadius < territory.connectedControlRadius) {
          throw new GameDataError(`${upgradeTerritoryWhere}: T2 radii must not shrink T1 control`);
        }
        upgradeTerritory = { controlRadius, connectedControlRadius };
      }
      upgrade = {
        cost: validateStartingResources(upgradeData["cost"] ?? {}, upgradeWhere),
        durationSeconds,
        maxHealth: upgradeMaxHealth,
        ...(upgradeTerritory ? { territory: upgradeTerritory } : {}),
      };
    }
    buildings[id] = {
      id,
      label: requireString(stats, "label", statsWhere),
      footprint: { width, depth },
      cost: validateStartingResources(stats["cost"] ?? {}, statsWhere),
      constructionSeconds,
      maxHealth,
      ...(populationCapacity ? { populationCapacity } : {}),
      ...(economy ? { economy } : {}),
      ...(territory ? { territory } : {}),
      ...(upgrade ? { upgrade } : {}),
    };
  }
  if (Object.keys(buildings).length === 0) {
    throw new GameDataError(`${where}: must define at least one building`);
  }
  return buildings;
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

/** Validate the data-owned Faz 6 Settlement -> Town transition. */
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
  const commandCenterWhere = `${where}.town.commandCenter`;
  const commandCenter = asObject(town["commandCenter"], commandCenterWhere);
  const commandCenterMaxHealth = requireFiniteNumber(commandCenter, "maxHealth", commandCenterWhere);
  const commandCenterControlRadius = requireFiniteNumber(commandCenter, "controlRadius", commandCenterWhere);
  const commandCenterWorkerTrainingSeconds = requireFiniteNumber(commandCenter, "workerTrainingSeconds", commandCenterWhere);
  if (commandCenterMaxHealth <= 0 || commandCenterControlRadius <= 0 || commandCenterWorkerTrainingSeconds <= 0) {
    throw new GameDataError(`${commandCenterWhere}: maxHealth, controlRadius and workerTrainingSeconds must be > 0`);
  }
  return {
    settlement: { id: "settlement", label: requireString(settlement, "label", `${where}.settlement`) },
    town: {
      id: "town",
      label: requireString(town, "label", `${where}.town`),
      cost,
      upgradeSeconds,
      requiredBuildingIds: [...requirements] as string[],
      commandCenter: {
        maxHealth: commandCenterMaxHealth,
        controlRadius: commandCenterControlRadius,
        workerTrainingSeconds: commandCenterWorkerTrainingSeconds,
      },
    },
  };
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

/** Validate the small data-owned road cost/grid contract before RTS uses it. */
export function validateRoadBalance(value: unknown): RoadBalance {
  const where = "balance/roads.json";
  const obj = asObject(value, where);
  const cellSize = requireFiniteNumber(obj, "cellSize", where);
  const woodCostPerCell = requireFiniteNumber(obj, "woodCostPerCell", where);
  if (cellSize <= 0 || woodCostPerCell <= 0) {
    throw new GameDataError(`${where}: cell size and wood cost must be > 0`);
  }
  return { cellSize, woodCostPerCell };
}

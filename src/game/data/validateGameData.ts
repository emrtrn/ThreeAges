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
import type {
  AiBalance,
  AiIntent,
  AiProfile,
  AiProfileBalance,
  BuildingBalance,
  GamePreset,
  GameVersion,
  RoadBalance,
  StartingResources,
  UnitBalance,
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
    const maxHealth = requireFiniteNumber(stats, "maxHealth", statsWhere);
    if (maxHealth <= 0) {
      throw new GameDataError(`${where}."${id}".maxHealth: must be > 0`);
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
    const trainingSeconds = requireFiniteNumber(stats, "trainingSeconds", statsWhere);
    if (trainingSeconds <= 0) {
      throw new GameDataError(`${statsWhere}.trainingSeconds: must be > 0`);
    }
    const populationCost = requireFiniteNumber(stats, "populationCost", statsWhere);
    if (!Number.isInteger(populationCost) || populationCost <= 0) {
      throw new GameDataError(`${statsWhere}.populationCost: must be a positive integer`);
    }
    units[id] = {
      maxHealth,
      attackDamage,
      attackCooldown,
      attackRange,
      trainingSeconds,
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
      if (!Number.isInteger(workerCapacity) || workerCapacity <= 0) {
        throw new GameDataError(`${economyWhere}.workerCapacity: must be a positive integer`);
      }
      if (perWorkerPerMinute <= 0 || localBufferCapacity <= 0) {
        throw new GameDataError(`${economyWhere}: production rate and local buffer capacity must be > 0`);
      }
      economy = { resourceId, workerCapacity, perWorkerPerMinute, localBufferCapacity };
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
    buildings[id] = {
      id,
      label: requireString(stats, "label", statsWhere),
      footprint: { width, depth },
      cost: validateStartingResources(stats["cost"] ?? {}, statsWhere),
      constructionSeconds,
      ...(populationCapacity ? { populationCapacity } : {}),
      ...(economy ? { economy } : {}),
      ...(territory ? { territory } : {}),
    };
  }
  if (Object.keys(buildings).length === 0) {
    throw new GameDataError(`${where}: must define at least one building`);
  }
  return buildings;
}

const AI_INTENTS: readonly AiIntent[] = ["economy", "ageUp", "expand", "defend", "attack"];
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
    minimumDefensePower: requireFiniteNumber(armyObj, "minimumDefensePower", `${where}.army`),
  };
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

  const economyObj = asObject(obj["economy"], `${where}.economy`);
  const economy = {
    workerTarget: requirePositive(economyObj, "workerTarget", `${where}.economy`),
    populationPressureBuffer: requireFiniteNumber(economyObj, "populationPressureBuffer", `${where}.economy`),
  };
  if (economy.populationPressureBuffer < 0) {
    throw new GameDataError(`${where}.economy: populationPressureBuffer must be >= 0`);
  }

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

  return { evaluation, army, economy, profiles, intentWeights };
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

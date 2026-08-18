/**
 * Game-data loader — Vertical Slice Plan v0.2 §17 ("Temel JSON loader").
 *
 * Fetches the read-only JSON served from `public/game-data/` (TD-003) and runs
 * it through validateGameData before handing back a typed value. Fetch is a thin
 * shell around the pure validators so malformed data fails loudly with a field-
 * level message (plan §19). Base-path handling mirrors src/scene/roomLayout.ts.
 *
 * Browser runtime module (uses fetch); node tests exercise the validators
 * directly against readFileSync content instead of going through here.
 */
import { logger } from "../core/logger";
import {
  validateAiBalance,
  validateAiLayoutBalance,
  validateAgeBalance,
  validateAnimalBalance,
  validateGamePreset,
  validateGameVersion,
  validateBuildingBalance,
  validateCaravanBalance,
  validateMissionScript,
  validateResourceBalance,
  validateRoadBalance,
  validateTradeSiteBalance,
  validateUnitBalance,
} from "./validateGameData";
import type { AgeBalance, AiBalance, AiLayoutBalance, AnimalBalance, BuildingBalance, CaravanBalance, GamePreset, GameVersion, ResourceBalance, RoadBalance, TradeSiteBalance, UnitBalance } from "./gameDataTypes";
import type { MissionScript } from "../rts/tutorial/missionScript";

const log = logger("Data");

const BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

const GAME_DATA_ROOT = `${BASE_URL}game-data`;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Game data fetch failed: ${response.status} ${response.statusText} (${url})`,
    );
  }
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new Error(`Game data is not valid JSON (${url})`, { cause });
  }
}

/** Load and validate `public/game-data/version.json`. */
export async function loadGameVersion(): Promise<GameVersion> {
  const url = `${GAME_DATA_ROOT}/version.json`;
  const version = validateGameVersion(await fetchJson(url));
  log.info(
    `build ${version.buildVersion} / balance ${version.balanceVersion}`,
  );
  return version;
}

/** Load and validate `public/game-data/presets/<id>.json`. */
export async function loadGamePreset(id: string): Promise<GamePreset> {
  const url = `${GAME_DATA_ROOT}/presets/${id}.json`;
  const preset = validateGamePreset(await fetchJson(url), id);
  log.debug(`loaded preset "${preset.id}" (speed ${preset.gameSpeed})`);
  return preset;
}

/** Load and validate `public/game-data/balance/units.json`. */
export async function loadUnitBalance(): Promise<UnitBalance> {
  const url = `${GAME_DATA_ROOT}/balance/units.json`;
  const balance = validateUnitBalance(await fetchJson(url));
  log.debug(`loaded unit balance (${Object.keys(balance).length} definitions)`);
  return balance;
}

/** Load and validate `public/game-data/balance/buildings.json`. */
export async function loadBuildingBalance(): Promise<BuildingBalance> {
  const url = `${GAME_DATA_ROOT}/balance/buildings.json`;
  const balance = validateBuildingBalance(await fetchJson(url));
  log.debug(`loaded building balance (${Object.keys(balance).length} definitions)`);
  return balance;
}

/** Load and validate Faz 6's finite stone/gold deposit profiles. */
export async function loadResourceBalance(): Promise<ResourceBalance> {
  const url = `${GAME_DATA_ROOT}/balance/resources.json`;
  const balance = validateResourceBalance(await fetchJson(url));
  log.debug(`loaded resource balance (${Object.keys(balance).length} definitions)`);
  return balance;
}

/** Load and validate the huntable species table. */
export async function loadAnimalBalance(): Promise<AnimalBalance> {
  const url = `${GAME_DATA_ROOT}/balance/animals.json`;
  const balance = validateAnimalBalance(await fetchJson(url));
  log.debug(`loaded animal balance (${Object.keys(balance).length} species)`);
  return balance;
}

/** Load the data-owned Settlement -> Town upgrade contract. */
export async function loadAgeBalance(): Promise<AgeBalance> {
  const url = `${GAME_DATA_ROOT}/balance/ages.json`;
  const balance = validateAgeBalance(await fetchJson(url));
  log.debug(`loaded age balance (${balance.settlement.id} -> ${balance.town.id})`);
  return balance;
}

/** Load and validate `public/game-data/balance/ai.json`. */
export async function loadAiBalance(): Promise<AiBalance> {
  const url = `${GAME_DATA_ROOT}/balance/ai.json`;
  const balance = validateAiBalance(await fetchJson(url));
  log.debug(`loaded AI balance (director every ${balance.evaluation.directorSeconds}s)`);
  return balance;
}

/** Load the deterministic settlement planner's geometry-only tuning. */
export async function loadAiLayoutBalance(): Promise<AiLayoutBalance> {
  const url = `${GAME_DATA_ROOT}/balance/ai-layout.json`;
  const balance = validateAiLayoutBalance(await fetchJson(url));
  log.debug(`loaded AI layout balance (${balance.candidateLimit} candidates per source)`);
  return balance;
}

/**
 * Load and validate `public/game-data/balance/logistics.json` — V4's pack animal.
 *
 * Movement and durability are authored here; each trip's cargo is derived from
 * the producer's live economy tier at runtime.
 */
export async function loadCaravanBalance(): Promise<CaravanBalance> {
  const url = `${GAME_DATA_ROOT}/balance/logistics.json`;
  const balance = validateCaravanBalance(await fetchJson(url));
  log.debug(`loaded caravan balance (${balance.moveSpeed}/s)`);
  return balance;
}

/**
 * Load and validate `public/game-data/balance/trade-sites.json` — the supply
 * plan's port, timber camp and stone pit.
 *
 * A trade site is authored on the map but tuned here: the Level says only *where*
 * a site stands and *which kind* it is, so a fork can retune throughput without
 * reopening a level (supply plan §5.3).
 */
export async function loadTradeSiteBalance(): Promise<TradeSiteBalance> {
  const url = `${GAME_DATA_ROOT}/balance/trade-sites.json`;
  const balance = validateTradeSiteBalance(await fetchJson(url));
  log.debug(`loaded trade site balance (${Object.keys(balance).length} site types)`);
  return balance;
}

/** Load and validate `public/game-data/balance/roads.json`. */
export async function loadRoadBalance(): Promise<RoadBalance> {
  const url = `${GAME_DATA_ROOT}/balance/roads.json`;
  const balance = validateRoadBalance(await fetchJson(url));
  const perCell = Object.entries(balance.costPerCell).map(([id, amount]) => `${amount} ${id}`).join(" + ");
  log.debug(`loaded road balance (${balance.cellSize}u cell, ${perCell}/cell)`);
  return balance;
}

/**
 * Load and validate `public/game-data/missions/<id>.json` — the story/tutorial
 * chain (Hikâye / Öğretici Tur Modu, Faz 1).
 *
 * `knownBuildingIds` comes from the already-loaded building balance so a goal
 * naming a building that does not exist fails here, at load, rather than
 * becoming a step the player can never clear.
 */
export async function loadMissionScript(
  id: string,
  knownBuildingIds: ReadonlySet<string>,
): Promise<MissionScript> {
  const url = `${GAME_DATA_ROOT}/missions/${id}.json`;
  const script = validateMissionScript(await fetchJson(url), id, knownBuildingIds);
  log.debug(`loaded mission "${script.id}" (${script.steps.length} steps)`);
  return script;
}

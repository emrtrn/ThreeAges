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
  validateGamePreset,
  validateGameVersion,
  validateUnitBalance,
} from "./validateGameData";
import type { GamePreset, GameVersion, UnitBalance } from "./gameDataTypes";

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

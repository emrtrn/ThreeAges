/** Browser loader for the reference-only RTS Content Catalog (assetization Faz B). */
import { logger } from "@/game/core/logger";
import type { BuildingBalance, UnitBalance } from "@/game/data/gameDataTypes";
import {
  validateRtsContentCatalog,
  type RtsContentCatalog,
} from "./rtsContentCatalog";

const log = logger("Data");
const BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const CATALOG_URL = `${BASE_URL}game-data/content/rts-content.json`;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`RTS content catalog fetch failed: ${response.status} ${response.statusText} (${url})`);
  }
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new Error(`RTS content catalog is not valid JSON (${url})`, { cause });
  }
}

/** Load catalog JSON only after the normal balance tables are available for id validation. */
export async function loadRtsContentCatalog(
  unitBalance: UnitBalance,
  buildingBalance: BuildingBalance,
): Promise<RtsContentCatalog> {
  const catalog = validateRtsContentCatalog(await fetchJson(CATALOG_URL), {
    unitBalance,
    buildingBalance,
  });
  log.debug(
    `loaded RTS content catalog (${Object.keys(catalog.units).length} unit, ${Object.keys(catalog.buildings).length} building mappings)`,
  );
  return catalog;
}

/**
 * RTS Content Catalog -- assetization Faz B.
 *
 * This is deliberately a reference-only bridge between balance identities and
 * authored Actor/UI assets. Gameplay numbers remain in balance JSON; the
 * catalog never becomes a second source for cost, health, timing, or rules.
 */
import type { BuildingBalance, UnitBalance } from "@/game/data/gameDataTypes";

export const RTS_CONTENT_CATALOG_SCHEMA = 1;

export type RtsActorRef = `assets/${string}.actor.json`;

export interface RtsUnitContentEntry {
  readonly actorRef: RtsActorRef;
}

export interface RtsBuildingContentEntry {
  readonly constructionActorRef?: RtsActorRef;
  /** Completed-building Actor assets keyed by the in-age level ("1", "2", ...). */
  readonly levels: Readonly<Record<string, RtsActorRef>>;
}

export interface RtsContentCatalog {
  readonly schema: typeof RTS_CONTENT_CATALOG_SCHEMA;
  readonly type: "rtsContentCatalog";
  readonly units: Readonly<Record<string, RtsUnitContentEntry>>;
  readonly buildings: Readonly<Record<string, RtsBuildingContentEntry>>;
  /** Manifest asset ids. UI migration starts in Faz F, so these are optional now. */
  readonly ui: Readonly<Record<string, string>>;
}

export interface RtsContentCatalogValidationContext {
  readonly unitBalance: UnitBalance;
  readonly buildingBalance: BuildingBalance;
}

/** Resolve a catalog mapping without letting callers inspect its JSON shape. */
export function rtsUnitActorRef(catalog: RtsContentCatalog, unitId: string): RtsActorRef | null {
  return catalog.units[unitId]?.actorRef ?? null;
}

/** The construction and completed-tier mappings intentionally use separate Actor assets. */
export function rtsBuildingActorRef(
  catalog: RtsContentCatalog,
  buildingId: string,
  state: "construction" | "completed",
  level: number,
): RtsActorRef | null {
  const entry = catalog.buildings[buildingId];
  return state === "construction"
    ? entry?.constructionActorRef ?? null
    : entry?.levels[String(level)] ?? null;
}

/** Thrown when catalog JSON is malformed or names a balance id that does not exist. */
export class RtsContentCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RtsContentCatalogError";
  }
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RtsContentCatalogError(`${where}: expected a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(obj: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw new RtsContentCatalogError(`${where}: unknown field "${key}"`);
    }
  }
}

function requireActorRef(value: unknown, where: string): RtsActorRef {
  if (
    typeof value !== "string"
    || !/^assets\/[a-zA-Z0-9_./-]+\.actor\.json$/.test(value)
    || value.includes("..")
  ) {
    throw new RtsContentCatalogError(
      `${where}: must be a public-root-relative assets/*.actor.json reference`,
    );
  }
  return value as RtsActorRef;
}

function requireManifestAssetId(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(value)) {
    throw new RtsContentCatalogError(`${where}: must be a manifest asset id`);
  }
  return value;
}

function validateUnits(value: unknown, context: RtsContentCatalogValidationContext): RtsContentCatalog["units"] {
  const where = "rts-content.json.units";
  const rawEntries = asObject(value, where);
  const entries: Record<string, RtsUnitContentEntry> = {};
  for (const [id, raw] of Object.entries(rawEntries)) {
    if (!context.unitBalance[id]) {
      throw new RtsContentCatalogError(`${where}: unknown unit balance id "${id}"`);
    }
    const entryWhere = `${where}."${id}"`;
    const entry = asObject(raw, entryWhere);
    requireExactKeys(entry, ["actorRef"], entryWhere);
    entries[id] = { actorRef: requireActorRef(entry["actorRef"], `${entryWhere}.actorRef`) };
  }
  return entries;
}

function validateBuildings(
  value: unknown,
  context: RtsContentCatalogValidationContext,
): RtsContentCatalog["buildings"] {
  const where = "rts-content.json.buildings";
  const rawEntries = asObject(value, where);
  const entries: Record<string, RtsBuildingContentEntry> = {};
  for (const [id, raw] of Object.entries(rawEntries)) {
    if (!context.buildingBalance[id]) {
      throw new RtsContentCatalogError(`${where}: unknown building balance id "${id}"`);
    }
    const entryWhere = `${where}."${id}"`;
    const entry = asObject(raw, entryWhere);
    requireExactKeys(entry, ["constructionActorRef", "levels"], entryWhere);
    const rawLevels = asObject(entry["levels"], `${entryWhere}.levels`);
    const levels: Record<string, RtsActorRef> = {};
    for (const [level, actorRef] of Object.entries(rawLevels)) {
      if (!/^[1-9][0-9]*$/.test(level)) {
        throw new RtsContentCatalogError(`${entryWhere}.levels: "${level}" must be a positive integer key`);
      }
      levels[level] = requireActorRef(actorRef, `${entryWhere}.levels."${level}"`);
    }
    entries[id] = {
      ...(entry["constructionActorRef"] === undefined
        ? {}
        : { constructionActorRef: requireActorRef(entry["constructionActorRef"], `${entryWhere}.constructionActorRef`) }),
      levels,
    };
  }
  return entries;
}

function validateUi(value: unknown): RtsContentCatalog["ui"] {
  const where = "rts-content.json.ui";
  const rawEntries = asObject(value, where);
  const entries: Record<string, string> = {};
  for (const [slot, assetId] of Object.entries(rawEntries)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(slot)) {
      throw new RtsContentCatalogError(`${where}: invalid UI slot "${slot}"`);
    }
    entries[slot] = requireManifestAssetId(assetId, `${where}."${slot}"`);
  }
  return entries;
}

/** Validate the reference-only `public/game-data/content/rts-content.json` contract. */
export function validateRtsContentCatalog(
  value: unknown,
  context: RtsContentCatalogValidationContext,
): RtsContentCatalog {
  const where = "rts-content.json";
  const obj = asObject(value, where);
  requireExactKeys(obj, ["schema", "type", "units", "buildings", "ui"], where);
  if (obj["schema"] !== RTS_CONTENT_CATALOG_SCHEMA) {
    throw new RtsContentCatalogError(`${where}.schema: expected ${RTS_CONTENT_CATALOG_SCHEMA}`);
  }
  if (obj["type"] !== "rtsContentCatalog") {
    throw new RtsContentCatalogError(`${where}.type: expected "rtsContentCatalog"`);
  }
  return {
    schema: RTS_CONTENT_CATALOG_SCHEMA,
    type: "rtsContentCatalog",
    units: validateUnits(obj["units"], context),
    buildings: validateBuildings(obj["buildings"], context),
    ui: validateUi(obj["ui"]),
  };
}

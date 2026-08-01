/**
 * RTS Content Catalog -- assetization Faz B.
 *
 * This is deliberately a reference-only bridge between balance identities and
 * authored Actor/UI assets. Gameplay numbers remain in balance JSON; the
 * catalog never becomes a second source for cost, health, timing, or rules.
 */
import type { BuildingBalance, SettlementAge, UnitBalance } from "@/game/data/gameDataTypes";
import type { UnitOwner } from "@/game/rts/units/unit";

/**
 * Schema 2 adds the `damage` section. There is deliberately no schema-1 read
 * path: unlike an effect or skeleton sidecar — user-authored assets a fork may
 * carry forward — this is the template's own single project-data file, updated
 * in the same commit as its reader. A missing section fails the load naming the
 * field, which beats inventing code-level defaults that would then be a second
 * place to look when a building's debris is wrong.
 */
export const RTS_CONTENT_CATALOG_SCHEMA = 2;

export type RtsActorRef = `assets/${string}.actor.json`;

const SETTLEMENT_AGES: readonly SettlementAge[] = ["settlement", "town"];

/**
 * Owners that may author their own presentation variant.
 *
 * `player` is deliberately absent: `actorRef` is the single player authority, so
 * an override for it would create a second place to look when the player's art
 * is wrong. See {@link validateOwnerActorRefs}.
 */
const OVERRIDABLE_OWNERS: readonly UnitOwner[] = ["enemy"];

export interface RtsUnitContentEntry {
  readonly actorRef: RtsActorRef;
  /**
   * Per-owner presentation overrides. Only the owners in
   * {@link OVERRIDABLE_OWNERS} may appear; an owner without an entry uses
   * `actorRef`. This is presentation only — picking a different enemy Actor
   * never changes cost, health, AI, or navigation.
   */
  readonly ownerActorRefs?: Readonly<Partial<Record<UnitOwner, RtsActorRef>>>;
}

export interface RtsBuildingContentEntry {
  readonly constructionActorRef?: RtsActorRef;
  /** Completed-building Actor assets keyed by the in-age level ("1", "2", ...). */
  readonly levels: Readonly<Record<string, RtsActorRef>>;
  /**
   * Optional per-age override of {@link levels}, for buildings whose art family
   * changes with the owner's age (the pack ships one Farm set per age). Looked up
   * first; anything it does not map falls back to the age-agnostic `levels`.
   */
  readonly ages?: Readonly<Partial<Record<SettlementAge, Readonly<Record<string, RtsActorRef>>>>>;
  /** This building's layer over `damage.defaults`; absent means "the default". */
  readonly damage?: RtsBuildingDamageOverride;
}

/** Whether a razed building topples sideways or settles where it stood. */
export const RTS_COLLAPSE_STYLES = ["topple", "inPlace"] as const;
export type RtsCollapseStyle = (typeof RTS_COLLAPSE_STYLES)[number];

/**
 * Where a slot's effect is played, relative to the building. Derived from the
 * footprint rather than authored in world units so one entry stays correct for a
 * 2x2 house and a 6x6 depot: `ground` sits on the pad, `roof` rides the model's
 * approximate top, `center` splits them.
 */
export const RTS_DAMAGE_ANCHOR_MODES = ["ground", "center", "roof"] as const;
export type RtsDamageAnchorMode = (typeof RTS_DAMAGE_ANCHOR_MODES)[number];

/**
 * The presentation moments a building may author. Repeating slots re-trigger a
 * one-shot emitter on their interval; one-shot slots fire once at collapse.
 * Splitting dust from debris is what lets the two sit at different anchors —
 * dust on the ground, masonry off the roof.
 */
export const RTS_DAMAGE_REPEATING_SLOTS = ["lightSmoke", "heavySmoke", "heavyDebris", "ruinSmoke"] as const;
export const RTS_DAMAGE_ONE_SHOT_SLOTS = ["collapseDust", "collapseDebris"] as const;
export const RTS_DAMAGE_SLOTS = [...RTS_DAMAGE_REPEATING_SLOTS, ...RTS_DAMAGE_ONE_SHOT_SLOTS] as const;
export type RtsDamageSlotName = (typeof RTS_DAMAGE_SLOTS)[number];

/** Largest authored spawn offset, in world units, in any axis. */
const MAX_ANCHOR_OFFSET = 50;
/** Bounds on a repeat interval: a zero would spawn per frame, an hour is a typo. */
const MIN_INTERVAL_SECONDS = 0.05;
const MAX_INTERVAL_SECONDS = 60;
/** Matches the parser's per-effect model cap; a rotation longer than this is noise. */
const MAX_SLOT_EFFECTS = 8;

export interface RtsDamageAnchor {
  readonly mode: RtsDamageAnchorMode;
  readonly offset: readonly [number, number, number];
}

/**
 * One authored moment: which effects, where, and (for repeating slots) how
 * often. Co-located deliberately — "which effect", "where" and "how often" are
 * the three things an author tunes together, and keeping them in one object
 * means they cannot drift out of sync the way three parallel maps would.
 */
export interface RtsDamageSlot {
  /** Played in rotation, keyed off the structure id. Empty disables the slot. */
  readonly effects: readonly string[];
  readonly anchor: RtsDamageAnchor;
  /** Present exactly on {@link RTS_DAMAGE_REPEATING_SLOTS}. */
  readonly intervalSeconds?: number;
}

/** A building's fully resolved presentation: no optional fields, no lookups left. */
export interface RtsDamagePresentation {
  readonly collapseStyle: RtsCollapseStyle;
  readonly slots: Readonly<Record<RtsDamageSlotName, RtsDamageSlot>>;
}

/** Field-level override of a {@link RtsDamageSlot}; anything absent is inherited. */
export interface RtsDamageSlotOverride {
  readonly effects?: readonly string[];
  readonly anchor?: { readonly mode?: RtsDamageAnchorMode; readonly offset?: readonly [number, number, number] };
  readonly intervalSeconds?: number;
}

export interface RtsDamageOverride {
  readonly collapseStyle?: RtsCollapseStyle;
  readonly slots?: Readonly<Partial<Record<RtsDamageSlotName, RtsDamageSlotOverride>>>;
}

/** A named debris family (`stone`, `wood`, ...) buildings opt into by name. */
export interface RtsDamageMaterialClass extends RtsDamageOverride {}

export interface RtsDamageSection {
  /** The only complete entry; every other layer is a partial laid over it. */
  readonly defaults: RtsDamagePresentation;
  readonly materials: Readonly<Record<string, RtsDamageMaterialClass>>;
}

/** A building's own layer: a material class to inherit, plus direct overrides. */
export interface RtsBuildingDamageOverride extends RtsDamageOverride {
  readonly material?: string;
}

export interface RtsContentCatalog {
  readonly schema: typeof RTS_CONTENT_CATALOG_SCHEMA;
  readonly type: "rtsContentCatalog";
  readonly units: Readonly<Record<string, RtsUnitContentEntry>>;
  readonly buildings: Readonly<Record<string, RtsBuildingContentEntry>>;
  /** Manifest asset ids. UI migration starts in Faz F, so these are optional now. */
  readonly ui: Readonly<Record<string, string>>;
  /** Health-driven damage/collapse presentation; see {@link rtsBuildingDamagePresentation}. */
  readonly damage: RtsDamageSection;
}

export interface RtsContentCatalogValidationContext {
  readonly unitBalance: UnitBalance;
  readonly buildingBalance: BuildingBalance;
}

/**
 * Resolve a catalog mapping without letting callers inspect its JSON shape.
 *
 * An owner with an authored override resolves to it; every other owner resolves
 * to `actorRef`. A ref that exists but fails to load is *not* handled here — the
 * factory renders it as the explicit placeholder rather than quietly borrowing
 * the default Actor, so a missing enemy variant stays a visible art gap.
 */
export function rtsUnitActorRef(
  catalog: RtsContentCatalog,
  unitId: string,
  owner: UnitOwner = "player",
): RtsActorRef | null {
  const entry = catalog.units[unitId];
  if (!entry) return null;
  return entry.ownerActorRefs?.[owner] ?? entry.actorRef;
}

/**
 * Whether an owner has its *own* authored Actor, as opposed to resolving through
 * the `actorRef` fallback. Coverage uses this; presentation does not.
 */
export function rtsUnitOwnerActorRefIsAuthored(
  catalog: RtsContentCatalog,
  unitId: string,
  owner: UnitOwner,
): boolean {
  return catalog.units[unitId]?.ownerActorRefs?.[owner] !== undefined;
}

/**
 * Completed tiers resolve the owner's age first (`ages`) and fall back to the
 * age-agnostic `levels`, so a building only authors per-age art when its models
 * actually differ by age.
 *
 * `construction` may author its own Actor (a scaffold that looks nothing like
 * the finished building). When it does not, the site shows the very building
 * that is being raised — the completed Actor for the same age and level, drawn
 * translucent by the caller — rather than dropping to the legacy single-mesh
 * path, which would make the site and the finished model disagree.
 */
export function rtsBuildingActorRef(
  catalog: RtsContentCatalog,
  buildingId: string,
  state: "construction" | "completed",
  level: number,
  age: SettlementAge = "settlement",
): RtsActorRef | null {
  const entry = catalog.buildings[buildingId];
  if (state === "construction" && entry?.constructionActorRef) return entry.constructionActorRef;
  const key = String(level);
  return entry?.ages?.[age]?.[key] ?? entry?.levels[key] ?? null;
}

function isRepeatingSlot(slot: RtsDamageSlotName): boolean {
  return (RTS_DAMAGE_REPEATING_SLOTS as readonly string[]).includes(slot);
}

function applySlotOverride(base: RtsDamageSlot, override: RtsDamageSlotOverride | undefined): RtsDamageSlot {
  if (!override) return base;
  return {
    effects: override.effects ?? base.effects,
    anchor: {
      mode: override.anchor?.mode ?? base.anchor.mode,
      offset: override.anchor?.offset ?? base.anchor.offset,
    },
    ...(base.intervalSeconds === undefined
      ? {}
      : { intervalSeconds: override.intervalSeconds ?? base.intervalSeconds }),
  };
}

function applyDamageOverride(base: RtsDamagePresentation, override: RtsDamageOverride | undefined): RtsDamagePresentation {
  if (!override) return base;
  const slots = {} as Record<RtsDamageSlotName, RtsDamageSlot>;
  for (const slot of RTS_DAMAGE_SLOTS) {
    slots[slot] = applySlotOverride(base.slots[slot], override.slots?.[slot]);
  }
  return { collapseStyle: override.collapseStyle ?? base.collapseStyle, slots };
}

/**
 * Resolve one building's damage presentation through the authored chain:
 * `defaults` → its material class → its own overrides, each layer replacing only
 * the fields it names.
 *
 * Total by construction — every building resolves, because `defaults` is the one
 * complete entry and the validator refuses a material name that does not exist.
 * A building with nothing authored is therefore not a gap; it is the default
 * presentation, which is what keeps a 12-building × 2-age × 3-level table from
 * having to be filled in by hand.
 */
export function rtsBuildingDamagePresentation(
  catalog: RtsContentCatalog,
  buildingId: string,
): RtsDamagePresentation {
  const authored = catalog.buildings[buildingId]?.damage;
  const material = authored?.material === undefined ? undefined : catalog.damage.materials[authored.material];
  return applyDamageOverride(applyDamageOverride(catalog.damage.defaults, material), authored);
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

/**
 * Owner overrides are rejected for anything but a known non-player owner, so a
 * typo (`"enemey"`, `"ai"`) fails the pack load instead of silently leaving that
 * army on the default Actor — the exact failure this authoring split exists to
 * make visible.
 */
function validateOwnerActorRefs(
  value: unknown,
  where: string,
): NonNullable<RtsUnitContentEntry["ownerActorRefs"]> {
  const raw = asObject(value, where);
  const refs: Partial<Record<UnitOwner, RtsActorRef>> = {};
  for (const [owner, ref] of Object.entries(raw)) {
    if (owner === "player") {
      throw new RtsContentCatalogError(
        `${where}: "player" is not overridable — actorRef is the player authority`,
      );
    }
    if (!OVERRIDABLE_OWNERS.includes(owner as UnitOwner)) {
      throw new RtsContentCatalogError(
        `${where}: "${owner}" must be one of ${OVERRIDABLE_OWNERS.join(", ")}`,
      );
    }
    refs[owner as UnitOwner] = requireActorRef(ref, `${where}."${owner}"`);
  }
  return refs;
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
    requireExactKeys(entry, ["actorRef", "ownerActorRefs"], entryWhere);
    entries[id] = {
      actorRef: requireActorRef(entry["actorRef"], `${entryWhere}.actorRef`),
      ...(entry["ownerActorRefs"] === undefined
        ? {}
        : { ownerActorRefs: validateOwnerActorRefs(entry["ownerActorRefs"], `${entryWhere}.ownerActorRefs`) }),
    };
  }
  return entries;
}

function validateLevels(value: unknown, where: string): Record<string, RtsActorRef> {
  const rawLevels = asObject(value, where);
  const levels: Record<string, RtsActorRef> = {};
  for (const [level, actorRef] of Object.entries(rawLevels)) {
    if (!/^[1-9][0-9]*$/.test(level)) {
      throw new RtsContentCatalogError(`${where}: "${level}" must be a positive integer key`);
    }
    levels[level] = requireActorRef(actorRef, `${where}."${level}"`);
  }
  return levels;
}

function validateAges(
  value: unknown,
  where: string,
): NonNullable<RtsBuildingContentEntry["ages"]> {
  const rawAges = asObject(value, where);
  const ages: Partial<Record<SettlementAge, Record<string, RtsActorRef>>> = {};
  for (const [age, rawLevels] of Object.entries(rawAges)) {
    if (!SETTLEMENT_AGES.includes(age as SettlementAge)) {
      throw new RtsContentCatalogError(`${where}: "${age}" must be one of ${SETTLEMENT_AGES.join(", ")}`);
    }
    ages[age as SettlementAge] = validateLevels(rawLevels, `${where}."${age}"`);
  }
  return ages;
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
    requireExactKeys(entry, ["constructionActorRef", "levels", "ages", "damage"], entryWhere);
    const levels = validateLevels(entry["levels"], `${entryWhere}.levels`);
    entries[id] = {
      ...(entry["constructionActorRef"] === undefined
        ? {}
        : { constructionActorRef: requireActorRef(entry["constructionActorRef"], `${entryWhere}.constructionActorRef`) }),
      levels,
      ...(entry["ages"] === undefined ? {} : { ages: validateAges(entry["ages"], `${entryWhere}.ages`) }),
      ...(entry["damage"] === undefined
        ? {}
        : { damage: validateBuildingDamage(entry["damage"], `${entryWhere}.damage`) }),
    };
  }
  return entries;
}

function requireFiniteNumber(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RtsContentCatalogError(`${where}: must be a finite number`);
  }
  return value;
}

function validateAnchorOffset(value: unknown, where: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new RtsContentCatalogError(`${where}: must be a [x, y, z] array`);
  }
  const offset = value.map((axis, index) => {
    const n = requireFiniteNumber(axis, `${where}[${index}]`);
    if (Math.abs(n) > MAX_ANCHOR_OFFSET) {
      throw new RtsContentCatalogError(`${where}[${index}]: must be within ±${MAX_ANCHOR_OFFSET}`);
    }
    return n;
  });
  return [offset[0] as number, offset[1] as number, offset[2] as number];
}

function validateAnchorMode(value: unknown, where: string): RtsDamageAnchorMode {
  if (!RTS_DAMAGE_ANCHOR_MODES.includes(value as RtsDamageAnchorMode)) {
    throw new RtsContentCatalogError(`${where}: must be one of ${RTS_DAMAGE_ANCHOR_MODES.join(", ")}`);
  }
  return value as RtsDamageAnchorMode;
}

function validateSlotEffects(value: unknown, where: string): readonly string[] {
  if (!Array.isArray(value)) throw new RtsContentCatalogError(`${where}: must be an array of effect asset ids`);
  if (value.length > MAX_SLOT_EFFECTS) {
    throw new RtsContentCatalogError(`${where}: at most ${MAX_SLOT_EFFECTS} effects`);
  }
  const effects = value.map((effect, index) => requireManifestAssetId(effect, `${where}[${index}]`));
  // A repeat would silently bias the rotation toward one effect rather than do
  // anything an author could have meant.
  const seen = new Set<string>();
  for (const effect of effects) {
    if (seen.has(effect)) throw new RtsContentCatalogError(`${where}: duplicate effect "${effect}"`);
    seen.add(effect);
  }
  return effects;
}

function validateIntervalSeconds(value: unknown, where: string): number {
  const seconds = requireFiniteNumber(value, where);
  if (seconds < MIN_INTERVAL_SECONDS || seconds > MAX_INTERVAL_SECONDS) {
    throw new RtsContentCatalogError(
      `${where}: must be between ${MIN_INTERVAL_SECONDS} and ${MAX_INTERVAL_SECONDS} seconds`,
    );
  }
  return seconds;
}

/** The complete form, used only by `damage.defaults`. */
function validateDamageSlot(value: unknown, slot: RtsDamageSlotName, where: string): RtsDamageSlot {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["effects", "anchor", "intervalSeconds"], where);
  const anchorWhere = `${where}.anchor`;
  const anchor = asObject(raw["anchor"], anchorWhere);
  requireExactKeys(anchor, ["mode", "offset"], anchorWhere);
  const repeating = isRepeatingSlot(slot);
  if (repeating && raw["intervalSeconds"] === undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: required for repeating slot "${slot}"`);
  }
  if (!repeating && raw["intervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: "${slot}" fires once and has no interval`);
  }
  return {
    effects: validateSlotEffects(raw["effects"], `${where}.effects`),
    anchor: {
      mode: validateAnchorMode(anchor["mode"], `${anchorWhere}.mode`),
      offset: validateAnchorOffset(anchor["offset"], `${anchorWhere}.offset`),
    },
    ...(repeating ? { intervalSeconds: validateIntervalSeconds(raw["intervalSeconds"], `${where}.intervalSeconds`) } : {}),
  };
}

/** The partial form, used by material classes and per-building overrides. */
function validateDamageSlotOverride(value: unknown, slot: RtsDamageSlotName, where: string): RtsDamageSlotOverride {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["effects", "anchor", "intervalSeconds"], where);
  if (!isRepeatingSlot(slot) && raw["intervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: "${slot}" fires once and has no interval`);
  }
  let anchor: RtsDamageSlotOverride["anchor"];
  if (raw["anchor"] !== undefined) {
    const anchorWhere = `${where}.anchor`;
    const rawAnchor = asObject(raw["anchor"], anchorWhere);
    requireExactKeys(rawAnchor, ["mode", "offset"], anchorWhere);
    anchor = {
      ...(rawAnchor["mode"] === undefined ? {} : { mode: validateAnchorMode(rawAnchor["mode"], `${anchorWhere}.mode`) }),
      ...(rawAnchor["offset"] === undefined
        ? {}
        : { offset: validateAnchorOffset(rawAnchor["offset"], `${anchorWhere}.offset`) }),
    };
  }
  return {
    ...(raw["effects"] === undefined ? {} : { effects: validateSlotEffects(raw["effects"], `${where}.effects`) }),
    ...(anchor === undefined ? {} : { anchor }),
    ...(raw["intervalSeconds"] === undefined
      ? {}
      : { intervalSeconds: validateIntervalSeconds(raw["intervalSeconds"], `${where}.intervalSeconds`) }),
  };
}

function validateCollapseStyle(value: unknown, where: string): RtsCollapseStyle {
  if (!RTS_COLLAPSE_STYLES.includes(value as RtsCollapseStyle)) {
    throw new RtsContentCatalogError(`${where}: must be one of ${RTS_COLLAPSE_STYLES.join(", ")}`);
  }
  return value as RtsCollapseStyle;
}

function validateDamageOverride(value: unknown, where: string, extraKeys: readonly string[] = []): RtsDamageOverride {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["collapseStyle", "slots", ...extraKeys], where);
  let slots: Record<string, RtsDamageSlotOverride> | undefined;
  if (raw["slots"] !== undefined) {
    const slotsWhere = `${where}.slots`;
    const rawSlots = asObject(raw["slots"], slotsWhere);
    requireExactKeys(rawSlots, RTS_DAMAGE_SLOTS, slotsWhere);
    slots = {};
    for (const [slot, rawSlot] of Object.entries(rawSlots)) {
      slots[slot] = validateDamageSlotOverride(rawSlot, slot as RtsDamageSlotName, `${slotsWhere}.${slot}`);
    }
  }
  return {
    ...(raw["collapseStyle"] === undefined
      ? {}
      : { collapseStyle: validateCollapseStyle(raw["collapseStyle"], `${where}.collapseStyle`) }),
    ...(slots === undefined ? {} : { slots }),
  };
}

function validateBuildingDamage(value: unknown, where: string): RtsBuildingDamageOverride {
  const raw = asObject(value, where);
  const override = validateDamageOverride(value, where, ["material"]);
  if (raw["material"] === undefined) return override;
  if (typeof raw["material"] !== "string" || !/^[a-z][a-zA-Z0-9_-]*$/.test(raw["material"])) {
    throw new RtsContentCatalogError(`${where}.material: must be a material class name`);
  }
  return { ...override, material: raw["material"] };
}

function validateDamage(value: unknown): RtsDamageSection {
  const where = "rts-content.json.damage";
  const raw = asObject(value, where);
  requireExactKeys(raw, ["defaults", "materials"], where);

  const defaultsWhere = `${where}.defaults`;
  const rawDefaults = asObject(raw["defaults"], defaultsWhere);
  requireExactKeys(rawDefaults, ["collapseStyle", "slots"], defaultsWhere);
  const slotsWhere = `${defaultsWhere}.slots`;
  const rawSlots = asObject(rawDefaults["slots"], slotsWhere);
  // Exhaustive, not just allowlisted: defaults is the layer every resolution
  // bottoms out in, so a slot missing here would leave a building unresolvable.
  for (const slot of RTS_DAMAGE_SLOTS) {
    if (rawSlots[slot] === undefined) throw new RtsContentCatalogError(`${slotsWhere}.${slot}: required`);
  }
  requireExactKeys(rawSlots, RTS_DAMAGE_SLOTS, slotsWhere);
  const slots = {} as Record<RtsDamageSlotName, RtsDamageSlot>;
  for (const slot of RTS_DAMAGE_SLOTS) {
    slots[slot] = validateDamageSlot(rawSlots[slot], slot, `${slotsWhere}.${slot}`);
  }

  const materialsWhere = `${where}.materials`;
  const rawMaterials = asObject(raw["materials"], materialsWhere);
  const materials: Record<string, RtsDamageMaterialClass> = {};
  for (const [name, rawMaterial] of Object.entries(rawMaterials)) {
    if (!/^[a-z][a-zA-Z0-9_-]*$/.test(name)) {
      throw new RtsContentCatalogError(`${materialsWhere}: invalid material class name "${name}"`);
    }
    materials[name] = validateDamageOverride(rawMaterial, `${materialsWhere}."${name}"`);
  }

  return {
    defaults: { collapseStyle: validateCollapseStyle(rawDefaults["collapseStyle"], `${defaultsWhere}.collapseStyle`), slots },
    materials,
  };
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
  requireExactKeys(obj, ["schema", "type", "units", "buildings", "ui", "damage"], where);
  if (obj["schema"] !== RTS_CONTENT_CATALOG_SCHEMA) {
    throw new RtsContentCatalogError(`${where}.schema: expected ${RTS_CONTENT_CATALOG_SCHEMA}`);
  }
  if (obj["type"] !== "rtsContentCatalog") {
    throw new RtsContentCatalogError(`${where}.type: expected "rtsContentCatalog"`);
  }
  const damage = validateDamage(obj["damage"]);
  const buildings = validateBuildings(obj["buildings"], context);
  // Checked after both parse, so the message can name the class that is missing
  // rather than failing later as an unresolved lookup at collapse time.
  for (const [id, entry] of Object.entries(buildings)) {
    const material = entry.damage?.material;
    if (material !== undefined && damage.materials[material] === undefined) {
      throw new RtsContentCatalogError(
        `${where}.buildings."${id}".damage.material: unknown material class "${material}"`,
      );
    }
  }
  return {
    schema: RTS_CONTENT_CATALOG_SCHEMA,
    type: "rtsContentCatalog",
    units: validateUnits(obj["units"], context),
    buildings,
    ui: validateUi(obj["ui"]),
    damage,
  };
}

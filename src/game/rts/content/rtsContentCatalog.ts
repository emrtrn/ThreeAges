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
 * The presentation moments a building may author, in three kinds.
 *
 * - **Repeating** slots re-trigger on their `intervalSeconds` for as long as the
 *   condition holds. Smoke belongs here: a burning building keeps burning.
 * - **Impact** slots fire on an event — a blow landing — and carry a
 *   `minIntervalSeconds` floor rather than a period, so a building under fire
 *   from twenty units does not spawn twenty bursts a second. Debris belongs
 *   here: masonry comes off when something hits it, not on a timer.
 * - **One-shot** slots fire exactly once, at collapse.
 *
 * Splitting dust from debris is what lets the two sit at different anchors —
 * dust on the ground, masonry off the roof.
 */
export const RTS_DAMAGE_REPEATING_SLOTS = ["lightSmoke", "heavySmoke", "ruinSmoke"] as const;
export const RTS_DAMAGE_IMPACT_SLOTS = ["impactDebris"] as const;
export const RTS_DAMAGE_ONE_SHOT_SLOTS = ["collapseDust", "collapseDebris"] as const;
export const RTS_DAMAGE_SLOTS = [
  ...RTS_DAMAGE_REPEATING_SLOTS,
  ...RTS_DAMAGE_IMPACT_SLOTS,
  ...RTS_DAMAGE_ONE_SHOT_SLOTS,
] as const;
export type RtsDamageSlotName = (typeof RTS_DAMAGE_SLOTS)[number];

/** Largest authored spawn offset, in world units, in any axis. */
const MAX_ANCHOR_OFFSET = 50;
/** Bounds on a repeat interval: a zero would spawn per frame, an hour is a typo. */
const MIN_INTERVAL_SECONDS = 0.05;
const MAX_INTERVAL_SECONDS = 60;
/** Matches the parser's per-effect model cap; a rotation longer than this is noise. */
const MAX_SLOT_EFFECTS = 8;
/**
 * How long a husk may linger after its building is gone. The ruin is pure
 * scenery — gameplay released the ground on the frame the building died — so
 * `0` (clear as soon as the fall ends) is a legitimate authoring choice, while
 * anything past a couple of minutes is a typo rather than an intent.
 */
const MAX_RUIN_SECONDS = 120;
/**
 * Deformation bounds. `squash` stops short of `1` because a building compressed
 * to zero height is a degenerate, unlit sliver rather than a ruin; the other two
 * are capped where the shape stops reading as the building it was.
 */
const MAX_DEFORM_SQUASH = 0.9;
const MAX_DEFORM_SPLAY = 1;
const MAX_DEFORM_BUCKLE = 0.5;

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
  /**
   * Present exactly on {@link RTS_DAMAGE_IMPACT_SLOTS}: the shortest gap two
   * bursts may be played at. A floor, not a period — nothing fires without an
   * impact to fire it.
   */
  readonly minIntervalSeconds?: number;
}

/**
 * How far a building's geometry gives way, as fractions of its own bounding box.
 * Consumed by the vertex-shader deformation, which is why these are pure shape
 * numbers with no units: they scale with whatever model the building resolves to.
 */
export interface RtsDamageDeformation {
  /** Fraction of total height removed at full progress. */
  readonly squash: number;
  /** Fraction of footprint pushed outward, strongest at the base. */
  readonly splay: number;
  /** Peak per-vertex horizontal wander, strongest at the top. */
  readonly buckle: number;
}

/** A building's fully resolved presentation: no optional fields, no lookups left. */
export interface RtsDamagePresentation {
  readonly collapseStyle: RtsCollapseStyle;
  /** How long the husk stays as visible scenery after the fall finishes. */
  readonly ruinSeconds: number;
  /** Shape the building loses as it comes down. */
  readonly collapseDeformation: RtsDamageDeformation;
  /**
   * Shape a still-standing, heavily damaged building loses. Held while it is
   * damaged and released on repair, so authoring a squash here would make a
   * repairable building permanently shorter until it was fixed — buckle alone is
   * the honest setting, and the bounds allow the rest only deliberately.
   */
  readonly heavyDeformation: RtsDamageDeformation;
  readonly slots: Readonly<Record<RtsDamageSlotName, RtsDamageSlot>>;
}

/** Field-level override of a {@link RtsDamageSlot}; anything absent is inherited. */
export interface RtsDamageSlotOverride {
  readonly effects?: readonly string[];
  readonly anchor?: { readonly mode?: RtsDamageAnchorMode; readonly offset?: readonly [number, number, number] };
  readonly intervalSeconds?: number;
  readonly minIntervalSeconds?: number;
}

export interface RtsDamageOverride {
  readonly collapseStyle?: RtsCollapseStyle;
  readonly ruinSeconds?: number;
  readonly collapseDeformation?: Partial<RtsDamageDeformation>;
  readonly heavyDeformation?: Partial<RtsDamageDeformation>;
  readonly slots?: Readonly<Partial<Record<RtsDamageSlotName, RtsDamageSlotOverride>>>;
}

/** A named debris family (`stone`, `wood`, ...) buildings opt into by name. */
export interface RtsDamageMaterialClass extends RtsDamageOverride {}

/** A building's own layer: a material class to inherit, plus direct overrides. */
export interface RtsBuildingDamageOverride extends RtsDamageOverride {
  readonly material?: string;
}

/**
 * Every damage-presentation decision, in one section.
 *
 * Per-building overrides live here rather than beside that building's art refs
 * so `buildings.<id>` stays purely "which Actor", and so the whole authoring
 * surface is one editable table instead of a decision spread across two shapes.
 */
export interface RtsDamageSection {
  /** The only complete entry; every other layer is a partial laid over it. */
  readonly defaults: RtsDamagePresentation;
  readonly materials: Readonly<Record<string, RtsDamageMaterialClass>>;
  readonly buildings: Readonly<Record<string, RtsBuildingDamageOverride>>;
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

function isImpactSlot(slot: RtsDamageSlotName): boolean {
  return (RTS_DAMAGE_IMPACT_SLOTS as readonly string[]).includes(slot);
}

function applyDeformationOverride(
  base: RtsDamageDeformation,
  override: Partial<RtsDamageDeformation> | undefined,
): RtsDamageDeformation {
  if (!override) return base;
  return {
    squash: override.squash ?? base.squash,
    splay: override.splay ?? base.splay,
    buckle: override.buckle ?? base.buckle,
  };
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
    ...(base.minIntervalSeconds === undefined
      ? {}
      : { minIntervalSeconds: override.minIntervalSeconds ?? base.minIntervalSeconds }),
  };
}

function applyDamageOverride(base: RtsDamagePresentation, override: RtsDamageOverride | undefined): RtsDamagePresentation {
  if (!override) return base;
  const slots = {} as Record<RtsDamageSlotName, RtsDamageSlot>;
  for (const slot of RTS_DAMAGE_SLOTS) {
    slots[slot] = applySlotOverride(base.slots[slot], override.slots?.[slot]);
  }
  return {
    collapseStyle: override.collapseStyle ?? base.collapseStyle,
    ruinSeconds: override.ruinSeconds ?? base.ruinSeconds,
    collapseDeformation: applyDeformationOverride(base.collapseDeformation, override.collapseDeformation),
    heavyDeformation: applyDeformationOverride(base.heavyDeformation, override.heavyDeformation),
    slots,
  };
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
  const authored = catalog.damage.buildings[buildingId];
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
    requireExactKeys(entry, ["constructionActorRef", "levels", "ages"], entryWhere);
    const levels = validateLevels(entry["levels"], `${entryWhere}.levels`);
    entries[id] = {
      ...(entry["constructionActorRef"] === undefined
        ? {}
        : { constructionActorRef: requireActorRef(entry["constructionActorRef"], `${entryWhere}.constructionActorRef`) }),
      levels,
      ...(entry["ages"] === undefined ? {} : { ages: validateAges(entry["ages"], `${entryWhere}.ages`) }),
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
  requireExactKeys(raw, ["effects", "anchor", "intervalSeconds", "minIntervalSeconds"], where);
  const anchorWhere = `${where}.anchor`;
  const anchor = asObject(raw["anchor"], anchorWhere);
  requireExactKeys(anchor, ["mode", "offset"], anchorWhere);
  const repeating = isRepeatingSlot(slot);
  const impact = isImpactSlot(slot);
  if (repeating && raw["intervalSeconds"] === undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: required for repeating slot "${slot}"`);
  }
  if (!repeating && raw["intervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: "${slot}" does not repeat, so it has no interval`);
  }
  if (impact && raw["minIntervalSeconds"] === undefined) {
    throw new RtsContentCatalogError(`${where}.minIntervalSeconds: required for impact slot "${slot}"`);
  }
  if (!impact && raw["minIntervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(
      `${where}.minIntervalSeconds: only impact slots throttle; "${slot}" is not one`,
    );
  }
  return {
    effects: validateSlotEffects(raw["effects"], `${where}.effects`),
    anchor: {
      mode: validateAnchorMode(anchor["mode"], `${anchorWhere}.mode`),
      offset: validateAnchorOffset(anchor["offset"], `${anchorWhere}.offset`),
    },
    ...(repeating ? { intervalSeconds: validateIntervalSeconds(raw["intervalSeconds"], `${where}.intervalSeconds`) } : {}),
    ...(impact
      ? { minIntervalSeconds: validateIntervalSeconds(raw["minIntervalSeconds"], `${where}.minIntervalSeconds`) }
      : {}),
  };
}

/** The partial form, used by material classes and per-building overrides. */
function validateDamageSlotOverride(value: unknown, slot: RtsDamageSlotName, where: string): RtsDamageSlotOverride {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["effects", "anchor", "intervalSeconds", "minIntervalSeconds"], where);
  if (!isRepeatingSlot(slot) && raw["intervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(`${where}.intervalSeconds: "${slot}" does not repeat, so it has no interval`);
  }
  if (!isImpactSlot(slot) && raw["minIntervalSeconds"] !== undefined) {
    throw new RtsContentCatalogError(
      `${where}.minIntervalSeconds: only impact slots throttle; "${slot}" is not one`,
    );
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
    ...(raw["minIntervalSeconds"] === undefined
      ? {}
      : { minIntervalSeconds: validateIntervalSeconds(raw["minIntervalSeconds"], `${where}.minIntervalSeconds`) }),
  };
}

function validateCollapseStyle(value: unknown, where: string): RtsCollapseStyle {
  if (!RTS_COLLAPSE_STYLES.includes(value as RtsCollapseStyle)) {
    throw new RtsContentCatalogError(`${where}: must be one of ${RTS_COLLAPSE_STYLES.join(", ")}`);
  }
  return value as RtsCollapseStyle;
}

function validateRuinSeconds(value: unknown, where: string): number {
  const seconds = requireFiniteNumber(value, where);
  if (seconds < 0 || seconds > MAX_RUIN_SECONDS) {
    throw new RtsContentCatalogError(`${where}: must be between 0 and ${MAX_RUIN_SECONDS} seconds`);
  }
  return seconds;
}

function validateDeformAmount(value: unknown, where: string, max: number): number {
  const amount = requireFiniteNumber(value, where);
  // Negative is refused rather than clamped: it is not a weaker deformation, it
  // is an inside-out building, and silently flipping it would hide the typo.
  if (amount < 0 || amount > max) {
    throw new RtsContentCatalogError(`${where}: must be between 0 and ${max}`);
  }
  return amount;
}

/** The complete form; every field required, used only by `damage.defaults`. */
function validateDeformation(value: unknown, where: string): RtsDamageDeformation {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["squash", "splay", "buckle"], where);
  for (const key of ["squash", "splay", "buckle"] as const) {
    if (raw[key] === undefined) throw new RtsContentCatalogError(`${where}.${key}: required`);
  }
  return {
    squash: validateDeformAmount(raw["squash"], `${where}.squash`, MAX_DEFORM_SQUASH),
    splay: validateDeformAmount(raw["splay"], `${where}.splay`, MAX_DEFORM_SPLAY),
    buckle: validateDeformAmount(raw["buckle"], `${where}.buckle`, MAX_DEFORM_BUCKLE),
  };
}

/** The partial form, used by material classes and per-building overrides. */
function validateDeformationOverride(value: unknown, where: string): Partial<RtsDamageDeformation> {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["squash", "splay", "buckle"], where);
  return {
    ...(raw["squash"] === undefined
      ? {}
      : { squash: validateDeformAmount(raw["squash"], `${where}.squash`, MAX_DEFORM_SQUASH) }),
    ...(raw["splay"] === undefined
      ? {}
      : { splay: validateDeformAmount(raw["splay"], `${where}.splay`, MAX_DEFORM_SPLAY) }),
    ...(raw["buckle"] === undefined
      ? {}
      : { buckle: validateDeformAmount(raw["buckle"], `${where}.buckle`, MAX_DEFORM_BUCKLE) }),
  };
}

const DAMAGE_OVERRIDE_KEYS = [
  "collapseStyle",
  "ruinSeconds",
  "collapseDeformation",
  "heavyDeformation",
  "slots",
] as const;

function validateDamageOverride(value: unknown, where: string, extraKeys: readonly string[] = []): RtsDamageOverride {
  const raw = asObject(value, where);
  requireExactKeys(raw, [...DAMAGE_OVERRIDE_KEYS, ...extraKeys], where);
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
    ...(raw["ruinSeconds"] === undefined
      ? {}
      : { ruinSeconds: validateRuinSeconds(raw["ruinSeconds"], `${where}.ruinSeconds`) }),
    ...(raw["collapseDeformation"] === undefined
      ? {}
      : {
          collapseDeformation: validateDeformationOverride(
            raw["collapseDeformation"],
            `${where}.collapseDeformation`,
          ),
        }),
    ...(raw["heavyDeformation"] === undefined
      ? {}
      : { heavyDeformation: validateDeformationOverride(raw["heavyDeformation"], `${where}.heavyDeformation`) }),
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

function validateDamage(value: unknown, buildingIds: ReadonlySet<string>): RtsDamageSection {
  const where = "rts-content.json.damage";
  const raw = asObject(value, where);
  requireExactKeys(raw, ["defaults", "materials", "buildings"], where);

  const defaultsWhere = `${where}.defaults`;
  const rawDefaults = asObject(raw["defaults"], defaultsWhere);
  requireExactKeys(rawDefaults, DAMAGE_OVERRIDE_KEYS, defaultsWhere);
  // Exhaustive for the same reason the slots are: `defaults` is the layer every
  // resolution bottoms out in, so a field missing here has no value to inherit.
  for (const key of DAMAGE_OVERRIDE_KEYS) {
    if (rawDefaults[key] === undefined) throw new RtsContentCatalogError(`${defaultsWhere}.${key}: required`);
  }
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

  const buildingsWhere = `${where}.buildings`;
  const rawBuildings = asObject(raw["buildings"], buildingsWhere);
  const buildings: Record<string, RtsBuildingDamageOverride> = {};
  for (const [id, rawBuilding] of Object.entries(rawBuildings)) {
    // Checked against the catalog's own building map rather than the balance
    // table: it is the stricter rule (those keys are themselves balance-checked)
    // and it makes the damage section validatable from the document alone, which
    // is what lets the editor refuse a bad save without loading balance JSON.
    if (!buildingIds.has(id)) {
      throw new RtsContentCatalogError(`${buildingsWhere}: "${id}" is not a mapped building id`);
    }
    const override = validateBuildingDamage(rawBuilding, `${buildingsWhere}."${id}"`);
    // Named here rather than left to fail as an unresolved lookup at collapse
    // time, when nothing would be left to say which entry was wrong.
    if (override.material !== undefined && materials[override.material] === undefined) {
      throw new RtsContentCatalogError(
        `${buildingsWhere}."${id}".material: unknown material class "${override.material}"`,
      );
    }
    buildings[id] = override;
  }

  return {
    defaults: {
      collapseStyle: validateCollapseStyle(rawDefaults["collapseStyle"], `${defaultsWhere}.collapseStyle`),
      ruinSeconds: validateRuinSeconds(rawDefaults["ruinSeconds"], `${defaultsWhere}.ruinSeconds`),
      collapseDeformation: validateDeformation(
        rawDefaults["collapseDeformation"],
        `${defaultsWhere}.collapseDeformation`,
      ),
      heavyDeformation: validateDeformation(rawDefaults["heavyDeformation"], `${defaultsWhere}.heavyDeformation`),
      slots,
    },
    materials,
    buildings,
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
  const buildings = validateBuildings(obj["buildings"], context);
  return {
    schema: RTS_CONTENT_CATALOG_SCHEMA,
    type: "rtsContentCatalog",
    units: validateUnits(obj["units"], context),
    buildings,
    ui: validateUi(obj["ui"]),
    damage: validateDamage(obj["damage"], new Set(Object.keys(buildings))),
  };
}

/**
 * Validate only the `damage` section of a raw catalog document.
 *
 * The editor's Data Table save gate. It needs no balance tables — the section's
 * only cross-reference is to the document's own `buildings` keys — so the editor
 * route can refuse a bad damage edit without loading the game's balance JSON,
 * using the same rules the runtime boots with.
 */
export function validateRtsContentDamageSection(value: unknown): RtsDamageSection {
  const obj = asObject(value, "rts-content.json");
  const buildings = asObject(obj["buildings"], "rts-content.json.buildings");
  return validateDamage(obj["damage"], new Set(Object.keys(buildings)));
}

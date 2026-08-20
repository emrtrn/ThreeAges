/**
 * RTS Content Catalog -- assetization Faz B.
 *
 * This is deliberately a reference-only bridge between balance identities and
 * authored Actor/UI assets. Gameplay numbers remain in balance JSON; the
 * catalog never becomes a second source for cost, health, timing, or rules.
 */
import type { AnimalBalance, BuildingBalance, SettlementAge, UnitBalance } from "@/game/data/gameDataTypes";
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
  /**
   * Presentation-only crew that rides with this unit. Crew members are meshes
   * parented to the unit's Actor: they do not become independently selectable,
   * targetable, or population-counted simulation units.
   *
   * The crew names Actors directly rather than a balance id. An earlier shape
   * pointed at another unit entry, which forced every crew to also be a
   * producible, AI-visible unit just to own a mesh — and the only thing that
   * indirection ever resolved to was this pair of refs.
   */
  readonly crew?: {
    readonly actorRef: RtsActorRef;
    /** Per-owner overrides, same rule as {@link RtsUnitContentEntry.ownerActorRefs}. */
    readonly ownerActorRefs?: Readonly<Partial<Record<UnitOwner, RtsActorRef>>>;
    readonly slots: readonly RtsCrewSlot[];
  };
}

/** One locally authored crew position, in the parent unit Actor's space. */
export interface RtsCrewSlot {
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
}

/**
 * One huntable species' art.
 *
 * No `ownerActorRefs` twin of {@link RtsUnitContentEntry}: wildlife belongs to
 * no kingdom, so there is no second owner whose art could differ. A tamed animal
 * (the pasture, V2) would be the first thing to want one, and it can add the
 * field then rather than carrying an always-empty one now.
 */
export interface RtsAnimalContentEntry {
  readonly actorRef: RtsActorRef;
}

/**
 * Art for the things that carry goods rather than live on the map — today, the
 * pack animal that walks a producer's output down the road (V4).
 *
 * Its own section rather than a row under `animals` because the section's keys
 * are checked against `balance/animals.json`, and a caravan deliberately has no
 * row there: it is a logistics unit whose numbers live in
 * `balance/logistics.json` (V4 KARAR 3-B). Sharing the wildlife *art* pack is
 * not the same as sharing the wildlife *table*.
 */
export interface RtsLogisticsContentSection {
  /** The caravan pack animal; absent leaves the caravan rendering as a placeholder. */
  readonly caravan?: { readonly actorRef: RtsActorRef };
}

/**
 * One owner's own art for a building, in the same `levels`/`ages` shape the
 * building itself uses.
 *
 * Both members are optional because a variant is authored where it exists and
 * nowhere else: the Barracks ships a red-flag settlement set and no town set, so
 * an enemy Town Barracks resolves back to the shared art rather than to nothing.
 */
export interface RtsBuildingOwnerArt {
  readonly levels?: Readonly<Record<string, RtsActorRef>>;
  readonly ages?: Readonly<Partial<Record<SettlementAge, Readonly<Record<string, RtsActorRef>>>>>;
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
  /**
   * Optional per-owner art, for buildings the two sides do not share — the
   * Barracks flies the owner's colour, so each army needs its own model rather
   * than a tint. Resolved ahead of {@link ages} and {@link levels} and falling
   * back to them per level key, which is what lets one age be authored per owner
   * without duplicating the rest of the ladder.
   *
   * Unlike units, a missing owner variant here is *not* a coverage gap: most
   * buildings look the same on both sides and are meant to.
   */
  readonly owners?: Readonly<Partial<Record<UnitOwner, RtsBuildingOwnerArt>>>;
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
 * `debris` is one slot authored once and fired at both moments — rotated on a
 * blow, burst at the collapse. The two were separate slots until they were
 * always given the same effect anyway: what the wreckage is made of is a
 * property of the building, not of the moment it comes off.
 *
 * Splitting dust from debris is what lets the two sit at different anchors —
 * dust on the ground, masonry off the roof.
 */
export const RTS_DAMAGE_REPEATING_SLOTS = ["lightSmoke", "heavySmoke", "ruinSmoke"] as const;
export const RTS_DAMAGE_IMPACT_SLOTS = ["debris"] as const;
export const RTS_DAMAGE_ONE_SHOT_SLOTS = ["collapseDust"] as const;
export const RTS_DAMAGE_SLOTS = [
  ...RTS_DAMAGE_REPEATING_SLOTS,
  ...RTS_DAMAGE_IMPACT_SLOTS,
  ...RTS_DAMAGE_ONE_SHOT_SLOTS,
] as const;
export type RtsDamageSlotName = (typeof RTS_DAMAGE_SLOTS)[number];

/**
 * Slots whose effects are chosen by the *owner's age* rather than authored once.
 *
 * Only debris is one: a settlement is timber and a town is tile, so the same
 * building sheds a different material after it ages up, while smoke and dust
 * look the same in both. An aged slot authors `ages` instead of `effects` — not
 * as well as — so there is exactly one place the answer comes from.
 *
 * Buildings that keep their settlement model into the Town age (the lumber camp,
 * the hunting camp, the pasture) and the ones that are masonry in both (the
 * quarry, the gold mine) are not exceptions to this rule; they are per-building
 * overrides on top of it, authored as material classes in `damage.materials`.
 */
export const RTS_DAMAGE_AGED_SLOTS = ["debris"] as const;

/** The ages an aged slot keys its effects by, in progression order. */
export const RTS_DAMAGE_SLOT_AGES: readonly SettlementAge[] = ["settlement", "town"];

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
  /**
   * Played in rotation, keyed off the structure id. Empty disables the slot.
   * Present on every slot *except* {@link RTS_DAMAGE_AGED_SLOTS}, which say the
   * same thing per age in {@link RtsDamageSlot.ages}.
   */
  readonly effects?: readonly string[];
  /**
   * Present exactly on {@link RTS_DAMAGE_AGED_SLOTS}: the effect list each age
   * plays, in place of a single {@link RtsDamageSlot.effects}. Every age is
   * authored, so ageing up can never leave a slot with nothing to play.
   */
  readonly ages?: Readonly<Record<SettlementAge, readonly string[]>>;
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
 * A slot with its age already chosen: what playback consumes.
 *
 * Splitting this from {@link RtsDamageSlot} is what keeps `effects` a plain
 * required list at the point it is played, instead of every call site having to
 * ask again which age this building is in.
 */
export interface RtsResolvedDamageSlot {
  readonly effects: readonly string[];
  readonly anchor: RtsDamageAnchor;
  readonly intervalSeconds?: number;
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

/** The complete authored form, used only by `damage.defaults`: ages not yet picked. */
export interface RtsDamagePresentationDef {
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

/**
 * A building's fully resolved presentation at one age: no optional fields, no
 * lookups left.
 */
export interface RtsDamagePresentation extends Omit<RtsDamagePresentationDef, "slots"> {
  readonly slots: Readonly<Record<RtsDamageSlotName, RtsResolvedDamageSlot>>;
}

/** Field-level override of a {@link RtsDamageSlot}; anything absent is inherited. */
export interface RtsDamageSlotOverride {
  readonly effects?: readonly string[];
  /** Aged slots only, and one age may be overridden without naming the other. */
  readonly ages?: Readonly<Partial<Record<SettlementAge, readonly string[]>>>;
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
  readonly defaults: RtsDamagePresentationDef;
  readonly materials: Readonly<Record<string, RtsDamageMaterialClass>>;
  readonly buildings: Readonly<Record<string, RtsBuildingDamageOverride>>;
}

export interface RtsContentCatalog {
  readonly schema: typeof RTS_CONTENT_CATALOG_SCHEMA;
  readonly type: "rtsContentCatalog";
  readonly units: Readonly<Record<string, RtsUnitContentEntry>>;
  readonly buildings: Readonly<Record<string, RtsBuildingContentEntry>>;
  /** Huntable species art, keyed by the `balance/animals.json` species id. */
  readonly animals: Readonly<Record<string, RtsAnimalContentEntry>>;
  /** Caravan art (V4). Absent in a catalog authored before V4; never required. */
  readonly logistics: RtsLogisticsContentSection;
  /** Manifest asset ids. UI migration starts in Faz F, so these are optional now. */
  readonly ui: Readonly<Record<string, string>>;
  /**
   * Manifest asset ids for art the runtime draws that no Actor references — a
   * projectile in flight, which is a pooled mesh rather than a placed Actor.
   *
   * Keyed by a well-known slot name the drawing system asks for, so the model
   * stays swappable from data. Absent in a catalog authored before props
   * existed, which resolves as "no prop art" and leaves the system on the
   * procedural stand-in it shipped with.
   */
  readonly props: Readonly<Record<string, string>>;
  /** Health-driven damage/collapse presentation; see {@link rtsBuildingDamagePresentation}. */
  readonly damage: RtsDamageSection;
}

export interface RtsContentCatalogValidationContext {
  readonly unitBalance: UnitBalance;
  readonly buildingBalance: BuildingBalance;
  readonly animalBalance: AnimalBalance;
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

/** Resolve a species' Actor, or null when the catalog does not map it. */
export function rtsAnimalActorRef(catalog: RtsContentCatalog, species: string): RtsActorRef | null {
  return catalog.animals[species]?.actorRef ?? null;
}

/** Resolve the caravan pack animal's Actor, or null when the catalog omits it. */
export function rtsCaravanActorRef(catalog: RtsContentCatalog): RtsActorRef | null {
  return catalog.logistics.caravan?.actorRef ?? null;
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
 *
 * `owner` narrows before age does: an owner that authored this level wins even
 * when the shared table has an entry for the same age, because an owner variant
 * exists precisely to not be the shared model.
 */
export function rtsBuildingActorRef(
  catalog: RtsContentCatalog,
  buildingId: string,
  state: "construction" | "completed",
  level: number,
  age: SettlementAge = "settlement",
  owner: UnitOwner = "player",
): RtsActorRef | null {
  const entry = catalog.buildings[buildingId];
  if (state === "construction" && entry?.constructionActorRef) return entry.constructionActorRef;
  const key = String(level);
  const owned = entry?.owners?.[owner];
  return (
    owned?.ages?.[age]?.[key] ??
    owned?.levels?.[key] ??
    entry?.ages?.[age]?.[key] ??
    entry?.levels[key] ??
    null
  );
}

/**
 * Every Actor this building can resolve to at one age — its whole level ladder.
 *
 * The presentation layer needs the siblings, not just the level it is drawing:
 * the ladder is modelled as one building in one coordinate space, so the scale
 * that makes level 1 the right size is the one derived from the largest model in
 * its own ladder. Resolution mirrors {@link rtsBuildingActorRef} exactly — the
 * age override wins per level key, the age-agnostic table fills the rest — so a
 * ref the ladder omits is a ref the lookup cannot return either.
 */
export function rtsBuildingActorRefLadder(
  catalog: RtsContentCatalog,
  buildingId: string,
  state: "construction" | "completed",
  age: SettlementAge = "settlement",
  owner: UnitOwner = "player",
): readonly RtsActorRef[] {
  const entry = catalog.buildings[buildingId];
  if (!entry) return [];
  // A dedicated construction Actor answers for every level, so it is its own
  // ladder rather than one rung of the completed building's.
  if (state === "construction" && entry.constructionActorRef) return [entry.constructionActorRef];
  // Applied least-specific first so the last write wins, which reproduces the
  // ?? chain in rtsBuildingActorRef exactly. The two must not drift: the ladder
  // decides the scale every rung is fitted to, so a ladder built from the shared
  // models would size the enemy's variants against art it never renders.
  const byLevel = new Map<string, RtsActorRef>(Object.entries(entry.levels));
  for (const [key, ref] of Object.entries(entry.ages?.[age] ?? {})) byLevel.set(key, ref);
  const owned = entry.owners?.[owner];
  for (const [key, ref] of Object.entries(owned?.levels ?? {})) byLevel.set(key, ref);
  for (const [key, ref] of Object.entries(owned?.ages?.[age] ?? {})) byLevel.set(key, ref);
  return [...byLevel.values()];
}

function isRepeatingSlot(slot: RtsDamageSlotName): boolean {
  return (RTS_DAMAGE_REPEATING_SLOTS as readonly string[]).includes(slot);
}

function isImpactSlot(slot: RtsDamageSlotName): boolean {
  return (RTS_DAMAGE_IMPACT_SLOTS as readonly string[]).includes(slot);
}

function isAgedSlot(slot: RtsDamageSlotName): boolean {
  return (RTS_DAMAGE_AGED_SLOTS as readonly string[]).includes(slot);
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

/** Per-age replacement: an override may name one age and inherit the other. */
function applySlotAgesOverride(
  base: Readonly<Record<SettlementAge, readonly string[]>>,
  override: Readonly<Partial<Record<SettlementAge, readonly string[]>>> | undefined,
): Readonly<Record<SettlementAge, readonly string[]>> {
  if (!override) return base;
  const merged = {} as Record<SettlementAge, readonly string[]>;
  for (const age of RTS_DAMAGE_SLOT_AGES) merged[age] = override[age] ?? base[age];
  return merged;
}

function applySlotOverride(base: RtsDamageSlot, override: RtsDamageSlotOverride | undefined): RtsDamageSlot {
  if (!override) return base;
  return {
    // Whichever of the two the base authored stays the one that answers: the
    // validator refuses `effects` on an aged slot and `ages` on any other, so an
    // override can never introduce the shape its slot does not have.
    ...(base.effects === undefined ? {} : { effects: override.effects ?? base.effects }),
    ...(base.ages === undefined ? {} : { ages: applySlotAgesOverride(base.ages, override.ages) }),
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

function applyDamageOverride(
  base: RtsDamagePresentationDef,
  override: RtsDamageOverride | undefined,
): RtsDamagePresentationDef {
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
 * Collapse the per-age lists down to the one age this building is actually in.
 *
 * An aged slot always has both ages authored (the validator requires it), so the
 * lookup is total; a non-aged slot hands its single list straight through.
 */
function resolveSlotAge(slot: RtsDamageSlot, age: SettlementAge): RtsResolvedDamageSlot {
  return {
    effects: slot.ages?.[age] ?? slot.effects ?? [],
    anchor: slot.anchor,
    ...(slot.intervalSeconds === undefined ? {} : { intervalSeconds: slot.intervalSeconds }),
    ...(slot.minIntervalSeconds === undefined ? {} : { minIntervalSeconds: slot.minIntervalSeconds }),
  };
}

/**
 * Resolve one building's damage presentation through the authored chain:
 * `defaults` → its material class → its own overrides, each layer replacing only
 * the fields it names, and then the owner's age picking each aged slot's list.
 *
 * Total by construction — every building resolves, because `defaults` is the one
 * complete entry and the validator refuses a material name that does not exist.
 * A building with nothing authored is therefore not a gap; it is the default
 * presentation, which is what keeps a 12-building × 2-age × 3-level table from
 * having to be filled in by hand.
 *
 * `age` is the *owner's* age, not the building's model age, and the two can
 * disagree: a lumber camp keeps its settlement art into the Town age. That is
 * why the buildings which never get a stone-age model carry a material class
 * pinning both ages to timber rather than relying on this lookup.
 */
export function rtsBuildingDamagePresentation(
  catalog: RtsContentCatalog,
  buildingId: string,
  age: SettlementAge = "settlement",
): RtsDamagePresentation {
  const authored = catalog.damage.buildings[buildingId];
  const material = authored?.material === undefined ? undefined : catalog.damage.materials[authored.material];
  const merged = applyDamageOverride(applyDamageOverride(catalog.damage.defaults, material), authored);
  const slots = {} as Record<RtsDamageSlotName, RtsResolvedDamageSlot>;
  for (const slot of RTS_DAMAGE_SLOTS) slots[slot] = resolveSlotAge(merged.slots[slot], age);
  return { ...merged, slots };
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
    requireExactKeys(entry, ["actorRef", "ownerActorRefs", "crew"], entryWhere);
    const actorRef = requireActorRef(entry["actorRef"], `${entryWhere}.actorRef`);
    const ownerActorRefs = entry["ownerActorRefs"] === undefined
      ? undefined
      : validateOwnerActorRefs(entry["ownerActorRefs"], `${entryWhere}.ownerActorRefs`);
    entries[id] = {
      actorRef,
      ...(ownerActorRefs === undefined ? {} : { ownerActorRefs }),
      ...(entry["crew"] === undefined
        ? {}
        : {
          crew: validateCrew(
            entry["crew"],
            `${entryWhere}.crew`,
            new Set<RtsActorRef>([actorRef, ...Object.values(ownerActorRefs ?? {})]),
          ),
        }),
    };
  }
  return entries;
}

/**
 * The crew's own Actor pair, plus where it sits.
 *
 * `hostRefs` is what the host unit itself renders as. Naming one of those here
 * would parent the cannon's own model to the cannon at a trail offset — a second
 * ghost gun that follows the real one — so it is refused by name rather than
 * left to be noticed on the field.
 */
function validateCrew(
  value: unknown,
  where: string,
  hostRefs: ReadonlySet<RtsActorRef>,
): NonNullable<RtsUnitContentEntry["crew"]> {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["actorRef", "ownerActorRefs", "slots"], where);
  const actorRef = requireActorRef(raw["actorRef"], `${where}.actorRef`);
  const ownerActorRefs = raw["ownerActorRefs"] === undefined
    ? undefined
    : validateOwnerActorRefs(raw["ownerActorRefs"], `${where}.ownerActorRefs`);
  for (const [field, ref] of [
    ["actorRef", actorRef] as const,
    ...Object.entries(ownerActorRefs ?? {}).map(([owner, ref]) => [`ownerActorRefs."${owner}"`, ref] as const),
  ]) {
    if (hostRefs.has(ref)) {
      throw new RtsContentCatalogError(`${where}.${field}: a crew cannot render its own host Actor`);
    }
  }
  if (!Array.isArray(raw["slots"]) || raw["slots"].length === 0) {
    throw new RtsContentCatalogError(`${where}.slots: must contain at least one local slot`);
  }
  const slots = raw["slots"].map((slot, index) => {
    const slotWhere = `${where}.slots[${index}]`;
    const entry = asObject(slot, slotWhere);
    requireExactKeys(entry, ["position", "rotation"], slotWhere);
    const vector = (key: "position" | "rotation"): [number, number, number] => {
      const input = entry[key];
      if (!Array.isArray(input) || input.length !== 3 || input.some((part) => typeof part !== "number" || !Number.isFinite(part))) {
        throw new RtsContentCatalogError(`${slotWhere}.${key}: must be three finite numbers`);
      }
      return [input[0] as number, input[1] as number, input[2] as number];
    };
    return { position: vector("position"), ...(entry["rotation"] === undefined ? {} : { rotation: vector("rotation") }) };
  });
  return { actorRef, ...(ownerActorRefs === undefined ? {} : { ownerActorRefs }), slots };
}

/**
 * Species art, cross-checked against the balance table exactly as units are.
 *
 * The check is the point: a typo'd species would otherwise load "successfully"
 * and then produce a herd of placeholders at spawn, when nothing is reporting on
 * the catalog any more.
 */
function validateAnimals(value: unknown, context: RtsContentCatalogValidationContext): RtsContentCatalog["animals"] {
  const where = "rts-content.json.animals";
  const rawEntries = asObject(value, where);
  const entries: Record<string, RtsAnimalContentEntry> = {};
  for (const [id, raw] of Object.entries(rawEntries)) {
    if (!context.animalBalance[id]) {
      throw new RtsContentCatalogError(`${where}: unknown animal balance id "${id}"`);
    }
    const entryWhere = `${where}."${id}"`;
    const entry = asObject(raw, entryWhere);
    requireExactKeys(entry, ["actorRef"], entryWhere);
    entries[id] = { actorRef: requireActorRef(entry["actorRef"], `${entryWhere}.actorRef`) };
  }
  return entries;
}

/**
 * The caravan's art, checked for shape only.
 *
 * There is no balance id to cross-check against — the caravan is one role, not a
 * keyed table — so what this refuses is an unknown key: a `donkey` or `cart`
 * entry authored beside `caravan` would look mapped and render nothing.
 */
function validateLogistics(value: unknown): RtsContentCatalog["logistics"] {
  if (value === undefined) return {};
  const where = "rts-content.json.logistics";
  const section = asObject(value, where);
  requireExactKeys(section, ["caravan"], where);
  const raw = section["caravan"];
  if (raw === undefined) return {};
  const entryWhere = `${where}.caravan`;
  const entry = asObject(raw, entryWhere);
  requireExactKeys(entry, ["actorRef"], entryWhere);
  return { caravan: { actorRef: requireActorRef(entry["actorRef"], `${entryWhere}.actorRef`) } };
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

function validateBuildingOwners(
  value: unknown,
  where: string,
): NonNullable<RtsBuildingContentEntry["owners"]> {
  const rawOwners = asObject(value, where);
  const owners: Partial<Record<UnitOwner, RtsBuildingOwnerArt>> = {};
  for (const [owner, rawArt] of Object.entries(rawOwners)) {
    if (!OVERRIDABLE_OWNERS.includes(owner as UnitOwner)) {
      throw new RtsContentCatalogError(
        `${where}: "${owner}" must be one of ${OVERRIDABLE_OWNERS.join(", ")}`,
      );
    }
    const artWhere = `${where}."${owner}"`;
    const art = asObject(rawArt, artWhere);
    requireExactKeys(art, ["levels", "ages"], artWhere);
    // An owner block that maps nothing is a typo that would render as "the
    // variant silently never appears", so it is refused rather than ignored.
    if (art["levels"] === undefined && art["ages"] === undefined) {
      throw new RtsContentCatalogError(`${artWhere}: must author "levels" or "ages"`);
    }
    owners[owner as UnitOwner] = {
      ...(art["levels"] === undefined ? {} : { levels: validateLevels(art["levels"], `${artWhere}.levels`) }),
      ...(art["ages"] === undefined ? {} : { ages: validateAges(art["ages"], `${artWhere}.ages`) }),
    };
  }
  return owners;
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
    requireExactKeys(entry, ["constructionActorRef", "levels", "ages", "owners"], entryWhere);
    const levels = validateLevels(entry["levels"], `${entryWhere}.levels`);
    entries[id] = {
      ...(entry["constructionActorRef"] === undefined
        ? {}
        : { constructionActorRef: requireActorRef(entry["constructionActorRef"], `${entryWhere}.constructionActorRef`) }),
      levels,
      ...(entry["ages"] === undefined ? {} : { ages: validateAges(entry["ages"], `${entryWhere}.ages`) }),
      ...(entry["owners"] === undefined
        ? {}
        : { owners: validateBuildingOwners(entry["owners"], `${entryWhere}.owners`) }),
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

/**
 * The per-age effect lists of an aged slot.
 *
 * `complete` is what separates `damage.defaults` (both ages required, so a slot
 * can never resolve to nothing after an age-up) from an override layer, where
 * naming one age and inheriting the other is the point.
 */
function validateSlotAges(
  value: unknown,
  where: string,
  complete: boolean,
): Record<SettlementAge, readonly string[]> {
  const raw = asObject(value, where);
  requireExactKeys(raw, RTS_DAMAGE_SLOT_AGES, where);
  const ages = {} as Record<SettlementAge, readonly string[]>;
  for (const age of RTS_DAMAGE_SLOT_AGES) {
    if (raw[age] === undefined) {
      if (complete) throw new RtsContentCatalogError(`${where}.${age}: required`);
      continue;
    }
    ages[age] = validateSlotEffects(raw[age], `${where}.${age}`);
  }
  return ages;
}

/**
 * Refuse the shape this slot does not have, in both directions.
 *
 * Allowing both would leave two places to answer "which effect", and an author
 * editing the one the resolver does not read would see no change in the game.
 */
function requireSlotEffectShape(
  raw: Readonly<Record<string, unknown>>,
  slot: RtsDamageSlotName,
  where: string,
): void {
  if (isAgedSlot(slot)) {
    if (raw["effects"] !== undefined) {
      throw new RtsContentCatalogError(
        `${where}.effects: "${slot}" is authored per age; use ages.${RTS_DAMAGE_SLOT_AGES.join(" / ages.")}`,
      );
    }
    return;
  }
  if (raw["ages"] !== undefined) {
    throw new RtsContentCatalogError(`${where}.ages: "${slot}" looks the same in every age; use effects`);
  }
}

/** The complete form, used only by `damage.defaults`. */
function validateDamageSlot(value: unknown, slot: RtsDamageSlotName, where: string): RtsDamageSlot {
  const raw = asObject(value, where);
  requireExactKeys(raw, ["effects", "ages", "anchor", "intervalSeconds", "minIntervalSeconds"], where);
  const anchorWhere = `${where}.anchor`;
  const anchor = asObject(raw["anchor"], anchorWhere);
  requireExactKeys(anchor, ["mode", "offset"], anchorWhere);
  const repeating = isRepeatingSlot(slot);
  const impact = isImpactSlot(slot);
  const aged = isAgedSlot(slot);
  requireSlotEffectShape(raw, slot, where);
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
    ...(aged
      ? { ages: validateSlotAges(raw["ages"], `${where}.ages`, true) }
      : { effects: validateSlotEffects(raw["effects"], `${where}.effects`) }),
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
  requireExactKeys(raw, ["effects", "ages", "anchor", "intervalSeconds", "minIntervalSeconds"], where);
  requireSlotEffectShape(raw, slot, where);
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
    ...(raw["ages"] === undefined ? {} : { ages: validateSlotAges(raw["ages"], `${where}.ages`, false) }),
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

function validateSlotAssetIds(value: unknown, where: string): Readonly<Record<string, string>> {
  const rawEntries = asObject(value, where);
  const entries: Record<string, string> = {};
  for (const [slot, assetId] of Object.entries(rawEntries)) {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(slot)) {
      throw new RtsContentCatalogError(`${where}: invalid slot "${slot}"`);
    }
    entries[slot] = requireManifestAssetId(assetId, `${where}."${slot}"`);
  }
  return entries;
}

/**
 * The manifest asset the catalog maps a prop slot to, or null when it maps none.
 *
 * Null is a supported answer, not a failure: the runtime's procedural stand-in
 * is what a project that authors no prop art keeps drawing.
 */
export function rtsPropAssetId(catalog: RtsContentCatalog, slot: string): string | null {
  return catalog.props[slot] ?? null;
}

/** Validate the reference-only `public/game-data/content/rts-content.json` contract. */
export function validateRtsContentCatalog(
  value: unknown,
  context: RtsContentCatalogValidationContext,
): RtsContentCatalog {
  const where = "rts-content.json";
  const obj = asObject(value, where);
  requireExactKeys(obj, ["schema", "type", "units", "buildings", "animals", "logistics", "ui", "props", "damage"], where);
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
    animals: validateAnimals(obj["animals"], context),
    logistics: validateLogistics(obj["logistics"]),
    ui: validateSlotAssetIds(obj["ui"], `${where}.ui`),
    // Optional: a catalog written before props existed is still valid, and
    // resolves to no prop art rather than to a load failure.
    props: obj["props"] === undefined ? {} : validateSlotAssetIds(obj["props"], `${where}.props`),
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

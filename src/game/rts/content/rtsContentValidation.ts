/**
 * Presentation-side validation for the RTS Actor pack.
 *
 * The Content Catalog only proves that a gameplay id points *somewhere*
 * (`rtsContentCatalog.ts`). This module proves the other half: that what it
 * points at is an Actor the runtime can actually build — a coherent component
 * tree whose every mesh names a manifest asset of the matching kind — and that
 * the catalog covers every playable identity.
 *
 * It is deliberately Three.js-free and I/O-free: callers hand it parsed JSON, so
 * the same rules run in the browser factory (per-Actor load errors) and in the
 * engine tests (whole-pack coverage), rather than being re-implemented in each.
 */
import { isMeshComponentKind, type ActorScriptDef } from "@engine/scene/actorScript";
import type { SettlementAge } from "@/game/data/gameDataTypes";
import { readRtsActorMotions } from "./rtsPresentationMotion";
import {
  RTS_DAMAGE_SLOTS,
  rtsBuildingActorRef,
  rtsBuildingDamagePresentation,
  rtsUnitActorRef,
  rtsUnitOwnerActorRefIsAuthored,
  type RtsActorRef,
  type RtsContentCatalog,
} from "./rtsContentCatalog";

/** The manifest facts a presentation Actor may be checked against. */
export interface RtsMeshAsset {
  readonly path: string;
  readonly assetType: "staticMesh" | "skeletalMesh";
}

/** Thrown when an Actor referenced by the catalog cannot be rendered as authored. */
export class RtsActorPresentationError extends Error {
  constructor(
    /** The catalog reference that led here, so a failure names its own entry point. */
    readonly ref: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${ref}: ${message}`, options);
    this.name = "RtsActorPresentationError";
  }
}

/** Index the mesh assets out of a raw `assets/manifest.json`; other asset types are ignored. */
export function parseRtsMeshManifest(value: unknown): Map<string, RtsMeshAsset> {
  const meshes = new Map<string, RtsMeshAsset>();
  const assets = (value as { assets?: unknown } | null)?.assets;
  if (!Array.isArray(assets)) throw new Error("RTS Actor manifest has no assets array");
  for (const entry of assets) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { id, path, assetType } = entry as Record<string, unknown>;
    if (
      typeof id === "string"
      && typeof path === "string"
      && (assetType === "staticMesh" || assetType === "skeletalMesh")
    ) {
      meshes.set(id, { path, assetType });
    }
  }
  return meshes;
}

/** Every distinct Actor the catalog can resolve to, in a stable order. */
export function rtsContentCatalogRefs(catalog: RtsContentCatalog): readonly RtsActorRef[] {
  const refs = new Set<RtsActorRef>();
  for (const entry of Object.values(catalog.units)) {
    refs.add(entry.actorRef);
    // Owner variants are separate files with their own meshes; leaving them out
    // here would load the pack "successfully" and then fail per enemy unit at
    // spawn time, when the manifest is no longer being reported on.
    for (const ref of Object.values(entry.ownerActorRefs ?? {})) refs.add(ref);
  }
  for (const entry of Object.values(catalog.animals)) refs.add(entry.actorRef);
  for (const entry of Object.values(catalog.buildings)) {
    if (entry.constructionActorRef) refs.add(entry.constructionActorRef);
    for (const ref of Object.values(entry.levels)) refs.add(ref);
    for (const levels of Object.values(entry.ages ?? {})) {
      for (const ref of Object.values(levels)) refs.add(ref);
    }
  }
  return [...refs];
}

/**
 * Assert that a normalized Actor can be instantiated as a presentation tree.
 *
 * `normalizeActorScriptDef` guarantees shape, not sense: it will happily return
 * two components sharing an id, a `parent` naming nothing, or a mesh with no
 * asset. Those all fail silently at render time — the second component quietly
 * replaces the first in the runtime node map, or a model simply never appears —
 * which is exactly the class of bug the Actor path was blamed for. Fail loudly
 * here instead, naming the ref and the component.
 */
export function validateRtsPresentationActor(
  def: ActorScriptDef,
  ref: string,
  manifest: ReadonlyMap<string, RtsMeshAsset>,
): void {
  const byId = new Map<string, { readonly parent?: string }>();
  for (const node of def.components) {
    if (byId.has(node.id)) {
      throw new RtsActorPresentationError(ref, `duplicate component id "${node.id}"`);
    }
    byId.set(node.id, node);
  }

  for (const node of def.components) {
    if (node.parent === undefined) continue;
    if (!byId.has(node.parent)) {
      throw new RtsActorPresentationError(ref, `component "${node.id}" names unknown parent "${node.parent}"`);
    }
    // Walk to the root: a cycle would otherwise leave these nodes orphaned from
    // the Actor root and invisible, with no error anywhere.
    const seen = new Set<string>([node.id]);
    let cursor: string | undefined = node.parent;
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        throw new RtsActorPresentationError(ref, `component "${node.id}" sits in a cyclic parent chain`);
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.parent;
    }
  }

  // Presentation motion is authored metadata, so a wrong axis or a zero radius is
  // a load failure here rather than a wheel that turns oddly on the field.
  const motions = readRtsActorMotions(def);
  if ("problem" in motions) throw new RtsActorPresentationError(ref, motions.problem);

  const meshNodes = def.components.filter((node) => isMeshComponentKind(node.component));
  if (meshNodes.length === 0) {
    throw new RtsActorPresentationError(ref, "a presentation Actor must author at least one mesh component");
  }

  for (const node of meshNodes) {
    const assetId = node.props.assetId;
    if (typeof assetId !== "string" || assetId.length === 0) {
      throw new RtsActorPresentationError(ref, `mesh component "${node.id}" has no assetId`);
    }
    const asset = manifest.get(assetId);
    if (!asset) {
      throw new RtsActorPresentationError(ref, `mesh component "${node.id}" names unmanifested asset "${assetId}"`);
    }
    // `MeshRenderer` is the legacy kind that predates the static/skeletal split,
    // so it is the one component that may carry either.
    const expected = node.component === "SkeletalMeshComponent"
      ? "skeletalMesh"
      : node.component === "StaticMeshComponent"
        ? "staticMesh"
        : null;
    if (expected && asset.assetType !== expected) {
      throw new RtsActorPresentationError(
        ref,
        `${node.component} "${node.id}" names a ${asset.assetType} asset ("${assetId}")`,
      );
    }
  }
}

/**
 * Index the effect asset ids out of a raw `assets/manifest.json`.
 *
 * The damage table names effects, never models — a debris GLTF is reached through
 * the effect asset's own `renderer.modelIds`, which the effect parser already
 * validates. That layering is what lets an author import a mesh, wrap it in an
 * effect, and assign it to a building without any of the three steps needing a
 * code change.
 */
export function parseRtsEffectManifestPaths(value: unknown): Map<string, string> {
  return parseRtsManifestPaths(value, "effect");
}

/**
 * Same, for the sprite textures an effect's `renderer.texture` names.
 *
 * Effects reach their art through the manifest exactly as they reach their debris
 * meshes, and for the same reason: an id resolves when the project ships that
 * asset and never otherwise, so an effect can never name an arbitrary URL. Left
 * unresolved, a textured effect silently falls back to the engine's procedural
 * round sprite — a flipbook fireball renders as a grey blob, in the match only,
 * while the effect editor's preview (which does resolve textures) looks right.
 */
export function parseRtsTextureManifestPaths(value: unknown): Map<string, string> {
  return parseRtsManifestPaths(value, "texture");
}

function parseRtsManifestPaths(value: unknown, assetType: string): Map<string, string> {
  const paths = new Map<string, string>();
  const assets = (value as { assets?: unknown } | null)?.assets;
  if (!Array.isArray(assets)) throw new Error("RTS effect manifest has no assets array");
  for (const entry of assets) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { id, path, assetType: type } = entry as Record<string, unknown>;
    if (typeof id === "string" && typeof path === "string" && type === assetType) paths.set(id, path);
  }
  return paths;
}

/** The id set alone, for coverage checks that do not need to load anything. */
export function parseRtsEffectManifest(value: unknown): Set<string> {
  return new Set(parseRtsEffectManifestPaths(value).keys());
}

/**
 * Every damage-table effect reference that no manifested effect asset answers,
 * as `<layer>.<slot>:<effectId>` strings. Empty means every authored slot can
 * actually play.
 *
 * Checked against the resolved presentation *per building* as well as the raw
 * layers, because an override that names a dead effect is only reachable through
 * the building that opts into it.
 */
export function rtsDamageEffectGaps(
  catalog: RtsContentCatalog,
  manifestEffectIds: ReadonlySet<string>,
  buildingIds: readonly string[],
): readonly string[] {
  const gaps: string[] = [];
  const check = (layer: string, slot: string, effects: readonly string[]): void => {
    for (const effectId of effects) {
      if (!manifestEffectIds.has(effectId)) gaps.push(`${layer}.${slot}:${effectId}`);
    }
  };
  for (const slot of RTS_DAMAGE_SLOTS) {
    check("defaults", slot, catalog.damage.defaults.slots[slot].effects);
  }
  for (const [name, material] of Object.entries(catalog.damage.materials)) {
    for (const slot of RTS_DAMAGE_SLOTS) {
      check(`materials.${name}`, slot, material.slots?.[slot]?.effects ?? []);
    }
  }
  for (const buildingId of buildingIds) {
    const presentation = rtsBuildingDamagePresentation(catalog, buildingId);
    for (const slot of RTS_DAMAGE_SLOTS) {
      check(`buildings.${buildingId}`, slot, presentation.slots[slot].effects);
    }
  }
  return [...new Set(gaps)];
}

/** What a match may ask the catalog for, derived from balance rather than art. */
export interface RtsCoverageRequest {
  readonly unitIds: readonly string[];
  readonly buildingIds: readonly string[];
  /** Highest in-age level each age can reach (`1 + levelUpgrades.length`). */
  readonly levelsByAge: Readonly<Record<SettlementAge, number>>;
  /**
   * Gameplay ids knowingly left to the legacy code silhouette.
   *
   * Empty as of Faz F: every unit now maps to an Actor. The three non-Guard roles
   * share the pack's single character mesh and are told apart by an authored
   * `materialTint`, which is what made mapping them an improvement over the
   * code-built bodies rather than a loss of readability. The field stays because
   * a fork with half-authored art needs the same escape hatch.
   */
  readonly approvedUnitExceptions?: readonly string[];
}

/**
 * Every playable identity the catalog cannot resolve, as `unit:<id>` /
 * `<buildingId>@<age>#<level>` strings. Empty means full coverage.
 */
export function rtsContentCoverageGaps(
  catalog: RtsContentCatalog,
  request: RtsCoverageRequest,
): readonly string[] {
  const gaps: string[] = [];
  const exceptions = new Set(request.approvedUnitExceptions ?? []);
  for (const unitId of request.unitIds) {
    if (exceptions.has(unitId)) continue;
    if (!rtsUnitActorRef(catalog, unitId)) gaps.push(`unit:${unitId}`);
    // The enemy variant is required rather than inferred. `rtsUnitActorRef`
    // falls back to `actorRef` for an unmapped owner, so without this check a new
    // role would ship with both armies wearing the player's art and nothing would
    // say so.
    else if (!rtsUnitOwnerActorRefIsAuthored(catalog, unitId, "enemy")) gaps.push(`unit:${unitId}@enemy`);
  }
  for (const buildingId of request.buildingIds) {
    for (const [age, maxLevel] of Object.entries(request.levelsByAge) as [SettlementAge, number][]) {
      for (let level = 1; level <= maxLevel; level += 1) {
        if (!rtsBuildingActorRef(catalog, buildingId, "completed", level, age)) {
          gaps.push(`${buildingId}@${age}#${level}`);
        }
        // Construction resolves through the same lookup, so a site can never be
        // the one state that silently falls back to the legacy mesh.
        if (!rtsBuildingActorRef(catalog, buildingId, "construction", level, age)) {
          gaps.push(`${buildingId}@${age}#${level}:construction`);
        }
      }
    }
  }
  return gaps;
}

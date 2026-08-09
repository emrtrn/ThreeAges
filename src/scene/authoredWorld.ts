/**
 * Generic authored-world loader (assetization Faz E, plan §7.2).
 *
 * Reads a Forge {@link RoomLayout}'s *static* presentation — placed static-mesh
 * instances and authored lights — into a single detachable {@link Group}, and
 * returns an {@link AuthoredWorldHandle} that a runtime shell mounts, tunes and
 * disposes without re-implementing model/light loading. It reuses the shared
 * build helpers in {@link ./SceneRuntimeCore} so an instanced group here uses the
 * same matrices and shadow policy the editor viewport and `RuntimeSceneApp` do —
 * "Level Editor ve production runtime ayni authored dunya verisini tuketir".
 *
 * Deliberately narrow. This host owns visual mounting only; it never derives
 * gameplay navigation or resource authority from the layout (plan §12 "Cift
 * otorite riski"). The `navigationBlockers` field exists for the generic handle
 * contract and stays empty until authored-collision → nav is designed as its own
 * slice — the RTS keeps its nav authority in markers/balance, not in level art.
 * Landscape, atmosphere and post-process are future extensions of this same host.
 */
import { Box3, Float32BufferAttribute, Group, Mesh, RepeatWrapping, TextureLoader, Vector3, type DirectionalLight, type Material, type Object3D, type Texture, type WebGLRenderer } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { InstancedMesh } from "three";

import { assetPath, assetRecordById } from "@engine/assets/manifest";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import { FoliageRenderBinding, foliageInstanceFromRoll } from "@engine/render-three/foliage";
import {
  foliageDataPath,
  normalizeFoliageData,
  normalizeFoliageType,
  type ForgeFoliageTypeDef,
  type LayoutFoliageData,
  type LayoutFoliageGroup,
} from "@engine/scene/foliage";
import { generateLandscapeFoliageSamples } from "@engine/scene/landscapeFoliage";
import { makeFoliageRng, rollFoliageInstance } from "@engine/scene/foliagePaint";
import { readRotation } from "@engine/scene/transform";
import { createLandscapeObject, type LandscapeLayerColors, type LandscapeLayerTexture, type LandscapeObject, type LandscapeRenderItem } from "@engine/render-three/landscape";
import { createRiverWaterObject, disposeRiverWaterObject, resolveRiverWater, type RiverWaterObjectLike, type RiverWaterRenderItem } from "@engine/render-three/riverWater";
import { riverWaterReflectionGroupKey } from "@engine/scene/riverWater";
import { PlanarReflectionSource } from "@engine/render-three/planarReflectionSource";
import { createFlatLandscapeData, LANDSCAPE_DEFAULT_LAYERS, resolveLandscape, type ForgeLandscapeData } from "@engine/scene/landscape";
import type { AssetManifest } from "@engine/assets/manifest";
import { isRenderableMesh } from "@engine/render-three/materials";
import type { LightObjectRecord } from "@engine/render-three/lights";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { LayoutPlacement, RoomLayout, Vec3 } from "@engine/scene/layout";
import {
  applyMaterialSlotOverrides,
  assignedMaterialSlotIds,
  hasAssignedMaterialSlots,
  loadAssetMaterialSlotsFromUrl,
  type AssetMaterialSlotsDef,
} from "./assetMaterialSlotsLoader";
import { applyAssetUvwMapping, loadAssetUvwFromUrl } from "./assetUvwLoader";
import { loadForgeMaterial, loadForgeMaterialLayer } from "./materialAssets";
import {
  createEmptyMeshPaintData,
  meshPaintDataPath,
  normalizeMeshPaintData,
  type LayoutMeshPaintData,
  type LayoutMeshPaintPlacement,
} from "@engine/scene/meshPaint";
import {
  buildSceneInstancedModel,
  buildSceneLightObject,
  buildSplineInstanceGeneratorGroup,
  computeModelLocalBounds,
  computeSceneRoomBounds,
  disposeSplineGeneratedGroup,
  fitDirectionalShadowToBounds,
  registerSceneShapeModels,
  resolveSceneWorldSettings,
  sceneModelAssetIds,
} from "./SceneRuntimeCore";

/**
 * One authored Landscape a shell mounted, exposed so runtime systems can read
 * and live-repaint its terrain without re-loading the sidecar. Generic host
 * contract — carries no game rule; any fork can drive it (e.g. the RTS road
 * painter blends a `dirt` corridor into `data.layers` and refreshes `object`).
 */
export interface MountedLandscape {
  /** In-memory sidecar data (heights + paint layers). Mutating it needs a geometry refresh. */
  readonly data: ForgeLandscapeData;
  /** The chunked render group; feed it to `updateLandscapeObjectGeometry` after edits. */
  readonly object: LandscapeObject;
  /** World-space position of the terrain actor (its local origin sits at the grid centre). */
  readonly position: Vec3;
  /** Resolved per-layer tint (assigned-material base colours), for the vertex-colour fallback. */
  readonly layerColors: LandscapeLayerColors;
}

/** A mounted authored world: one scene subtree the shell owns and later frees. */
export interface AuthoredWorldHandle {
  /** The single group holding every authored static instance + light. */
  readonly root: Group;
  /**
   * Navigation obstacles derived from the layout. Empty in this slice: RTS nav
   * authority stays with markers/balance (plan §12), so level art never blocks.
   */
  readonly navigationBlockers: readonly NavBlocker[];
  /** Authored directional lights, exposed so a shell can re-tune their shadows. */
  readonly directionalLights: readonly DirectionalLight[];
  /**
   * The batched meshes carrying the Level's authored static placements — the
   * layout's `instances` plus spline generator output — exposed so a game shell
   * can apply a per-placement rule to art it did not create. The RTS uses it for
   * §59 fog of war: without it, every model added to a Level in the editor stands
   * in plain sight on ground the player has never scouted, and the only way to
   * fog a new prop would be to name it in game code.
   *
   * Three things are deliberately *not* here. Landscape and water are the ground
   * itself, which GDD 08 §40 keeps visible once seen rather than hiding piece by
   * piece; painted foliage is ground cover in the tens of thousands, and a
   * per-blade rule would cost more than it could ever be worth.
   *
   * A shell that ignores this field pays nothing: the array is already built to
   * mount the world.
   */
  readonly staticInstanceMeshes: readonly InstancedMesh[];
  /** Distinct Forge materials resolved from placed static-mesh slot sidecars. */
  readonly staticSlotMaterialCount: number;
  /** Placed mesh assets whose UVW sidecar was applied before instancing. */
  readonly staticUvwMappingCount: number;
  /**
   * Placements that took Mesh Paint vertex colours from the Level's sidecar. Each
   * one is a batch of its own (paint lives on the geometry an InstancedMesh shares),
   * so this doubles as the count of batches the paint cost.
   */
  readonly meshPaintedPlacementCount: number;
  /**
   * How many Landscape terrains this world mounted. A shell reads this to retire
   * its own flat placeholder ground once an authored terrain is standing in for
   * it; 0 means the terrain was absent (or failed to load) and the fallback stays.
   */
  readonly landscapeCount: number;
  /**
   * The mounted terrains, exposing each one's in-memory data + render object so a
   * shell can live-edit paint/height and refresh geometry. Empty when
   * `landscapeCount` is 0. Ordered as the layout's `landscapes` are.
   */
  readonly landscapes: readonly MountedLandscape[];
  /** How many foliage instances this world mounted (0 when the Level paints none). */
  readonly foliageInstanceCount: number;
  /**
   * The painted foliage's own subtree, or null when the Level paints none.
   *
   * Exposed for measurement, not for editing: a diagnostic that wants to know
   * what ground cover costs has to be able to take it off the screen for one
   * frame, and the alternative — finding it by node name under `root` — breaks
   * silently the day the group is renamed.
   */
  readonly foliageRoot: Object3D | null;
  /**
   * The mounted River Water ribbons, for the same measurement reason as
   * {@link foliageRoot}.
   *
   * Worth its own handle because a water body is not only the pixels it covers:
   * a `sharedPlanar` reflection re-renders the whole scene from a mirrored
   * camera into its own fixed-size target, and that cost hides behind the
   * ribbon's draw. Taking the ribbons off the screen is the only way to take
   * that nested pass off it too.
   */
  readonly riverWaterObjects: readonly Object3D[];
  /**
   * Advances the foliage distance cull for a rendered frame. A no-op when the
   * Level paints no foliage, or when every Foliage Type disables distance
   * culling, so a shell can call it unconditionally from its frame loop.
   * `cullDistanceScale` is the runtime quality knob (see
   * {@link QualitySettings.foliageCullDistanceScale}).
   */
  updateFoliageCulling(cameraPosition: Vector3, cullDistanceScale?: number): void;
  /** Detach from the scene and release every GPU resource this handle created. */
  dispose(): void;
}

export interface AuthoredWorldOptions {
  /** The resolved Level layout whose static world is mounted. */
  readonly layout: RoomLayout;
  /** GL context for the KTX2/DRACO-aware glTF loader. */
  readonly renderer: WebGLRenderer;
  /** Resolves a public-root-relative asset path to a fetchable URL. */
  readonly resolveUrl: (path: string) => string;
  /**
   * Public-root-relative path of the Level this layout came from. Only the
   * *sidecars* keyed off the Level file need it — currently the painted foliage
   * (`<level>.foliage.json`), which the layout itself does not carry. Omitted
   * (or pointing at a Level with no sidecar) simply mounts no foliage.
   */
  readonly levelPath?: string;
  /**
   * Bounds a directional light's shadow frustum is fitted to. A large top-down
   * world (the RTS field is ~140 units wide) needs a far wider ortho frustum than
   * the per-light default; without this the shadow only renders near the origin.
   * Omitted falls back to the mounted instances' bounds.
   */
  readonly shadowBounds?: Box3;
  /** Optional sink for non-fatal load diagnostics (a missing optional model). */
  readonly onWarn?: (message: string, error?: unknown) => void;
  /**
   * Optional progress sink, for a host that puts a loading curtain over the
   * mount (the RTS route does; see `rtsLoadProgress.ts`). `total` is the count
   * of models plus landscapes this call will work through, known only after the
   * manifest fetch — which is why it is reported alongside every tick rather
   * than promised up front.
   *
   * A plain function type rather than a shared interface on purpose: this module
   * is engine-side and may not import from `@/game`, and structural typing means
   * the game's tracker satisfies it without either side owning a common type.
   */
  readonly onProgress?: (loaded: number, total: number) => void;
}

interface ManifestModelEntry {
  readonly path: string;
}

/**
 * Fetches the asset manifest and builds an `assetId -> path` map for every model
 * asset (static/skeletal mesh). Mirrors {@link RtsActorVisualFactory}'s inline
 * parse so the authored-world path resolves ids the same way the RTS actor path
 * does, without pulling in the heavier {@link AssetLoader}.
 */
async function fetchAssetManifest(resolveUrl: (path: string) => string): Promise<AssetManifest> {
  const response = await fetch(resolveUrl("assets/manifest.json"), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Authored-world manifest fetch failed: ${response.status}`);
  const manifest = await response.json() as AssetManifest;
  if (!Array.isArray(manifest.assets)) throw new Error("Authored-world manifest has no assets array");
  return manifest;
}

function modelEntriesFrom(manifest: AssetManifest): Map<string, ManifestModelEntry> {
  const models = new Map<string, ManifestModelEntry>();
  for (const value of manifest.assets as unknown[]) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const id = entry["id"];
    const path = entry["path"];
    const assetType = entry["assetType"];
    if (typeof id === "string" && typeof path === "string" && (assetType === "staticMesh" || assetType === "skeletalMesh")) {
      models.set(id, { path });
    }
  }
  return models;
}

/** Every distinct Forge material id a placement in this Level overrides its asset with. */
function placementMaterialSlotIds(layout: RoomLayout): string[] {
  const ids = new Set<string>();
  for (const instance of layout.instances) {
    for (const placement of instance.placements) {
      if (placement.materialSlot) ids.add(placement.materialSlot);
    }
  }
  return [...ids];
}

/** One batch to build for an asset: its placements plus what they share. */
export interface PlacementBatch {
  /** Forge material id overriding the asset's own, or null for the asset default. */
  readonly materialId: string | null;
  /** Set only for a painted batch, which is always exactly one placement. */
  readonly paintedPlacementIndex: number | null;
  readonly placements: LayoutPlacement[];
}

/**
 * Splits an asset's placements into the batches that can share one `InstancedMesh`.
 *
 * Two things force a split. A `materialSlot` override changes the material, and a
 * Mesh Paint entry changes the *geometry* — vertex colours live on the geometry an
 * InstancedMesh shares across all its instances, so a painted placement can only
 * ever be a batch of one. Everything else stays together: a Level with no overrides
 * and no paint yields exactly one batch per asset, the single mesh this built
 * before either was honoured.
 */
export function planPlacementBatches(
  placements: readonly LayoutPlacement[],
  paintedPlacements: MeshPaintByPlacement | undefined,
): PlacementBatch[] {
  const batches: PlacementBatch[] = [];
  const sharedByMaterial = new Map<string | null, PlacementBatch>();
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    const materialId = placement.materialSlot ?? null;
    if (paintedPlacements?.has(index)) {
      batches.push({ materialId, paintedPlacementIndex: index, placements: [placement] });
      continue;
    }
    const shared = sharedByMaterial.get(materialId);
    if (shared) {
      shared.placements.push(placement);
      continue;
    }
    const batch: PlacementBatch = { materialId, paintedPlacementIndex: null, placements: [placement] };
    sharedByMaterial.set(materialId, batch);
    batches.push(batch);
  }
  return batches;
}

interface AuthoredWorldMaterialSlots {
  readonly slotsByAssetId: Map<string, AssetMaterialSlotsDef>;
  readonly materialsById: Map<string, Material>;
}

/**
 * Static mesh material slots are authored beside the GLTF, not inside the Level.
 * Resolve them before instance groups build so every host of this generic world
 * (including the RTS preview route) renders the same surfaces as the editor.
 *
 * `placementMaterialIds` carries the *other* way a Level assigns a material: the
 * per-placement `materialSlot` override, which lives in the Level rather than
 * beside the asset. Both end up in the same `materialsById` map, so both are
 * disposed with the world.
 */
async function loadAuthoredWorldMaterialSlots(
  assetIds: readonly string[],
  placementMaterialIds: readonly string[],
  manifest: AssetManifest,
  textureLoader: TextureLoader,
  resolveUrl: (path: string) => string,
  maxAnisotropy: number,
  warn: (message: string, error?: unknown) => void,
): Promise<AuthoredWorldMaterialSlots> {
  const slotsByAssetId = new Map<string, AssetMaterialSlotsDef>();
  await Promise.all(assetIds.map(async (assetId) => {
    const asset = assetRecordById(manifest, assetId);
    if (!asset) return;
    const slots = await loadAssetMaterialSlotsFromUrl(assetPath(asset), resolveUrl);
    if (hasAssignedMaterialSlots(slots)) slotsByAssetId.set(assetId, slots);
  }));

  const materialsById = new Map<string, Material>();
  const materialIds = new Set<string>(placementMaterialIds);
  for (const slots of slotsByAssetId.values()) {
    for (const materialId of assignedMaterialSlotIds(slots)) materialIds.add(materialId);
  }
  await Promise.all([...materialIds].map(async (materialId) => {
    try {
      materialsById.set(
        materialId,
        await loadForgeMaterial(manifest, materialId, textureLoader, { maxAnisotropy, resolveUrl }),
      );
    } catch (error) {
      warn(`Authored-world material slot failed to load: ${materialId}`, error);
    }
  }));
  return { slotsByAssetId, materialsById };
}

/** Apply the same per-mesh UVW sidecars the editor applies before instancing. */
async function applyAuthoredWorldUvwMappings(
  assetIds: readonly string[],
  manifest: AssetManifest,
  models: ReadonlyMap<string, GLTF>,
  resolveUrl: (path: string) => string,
): Promise<number> {
  const applied = await Promise.all(assetIds.map(async (assetId) => {
    const asset = assetRecordById(manifest, assetId);
    const gltf = models.get(assetId);
    if (!asset || !gltf) return false;
    const uvw = await loadAssetUvwFromUrl(assetPath(asset), resolveUrl);
    applyAssetUvwMapping(gltf.scene, uvw);
    return uvw.mapType !== null;
  }));
  return applied.filter(Boolean).length;
}

/**
 * Resolves the per-layer splat inputs (base color + tiling texture) for a
 * landscape's material-assigned paint layers, aligned to `data.layers`. Mirrors
 * {@link RuntimeSceneApp}'s runtime resolver so an authored terrain shows the same
 * grass/dirt/rock/snow textures the editor paints with. A layer with no material —
 * or one whose material can't be read — falls back to its preset colour.
 */
async function resolveLandscapeLayerTextures(
  data: ForgeLandscapeData,
  manifest: AssetManifest,
  textureLoader: TextureLoader,
  maxAnisotropy: number,
  loaded: Texture[],
  warn: (message: string, error?: unknown) => void,
): Promise<LandscapeLayerTexture[]> {
  const worldSize = (data.size.verticesX - 1) * data.size.spacing;
  const base = Math.min(128, Math.max(1, Math.round(worldSize / 8)));
  const presetById = new Map(LANDSCAPE_DEFAULT_LAYERS.map((preset) => [preset.id as string, preset]));
  return Promise.all(
    data.layers.map(async (layer) => {
      const presetColor = presetById.get(layer.id)?.color ?? LANDSCAPE_DEFAULT_LAYERS[0]!.color;
      let resolved: Awaited<ReturnType<typeof loadForgeMaterialLayer>> = null;
      if (layer.material) {
        try {
          resolved = await loadForgeMaterialLayer(manifest, layer.material, textureLoader, { maxAnisotropy });
        } catch (error) {
          warn(`Authored-world landscape layer material failed to load: ${layer.material}`, error);
        }
      }
      if (resolved?.texture) loaded.push(resolved.texture);
      if (resolved?.normalTexture) loaded.push(resolved.normalTexture);
      if (resolved?.ormTexture) loaded.push(resolved.ormTexture);
      const mat = resolved?.tiling ?? { x: 1, y: 1 };
      return {
        id: layer.id,
        texture: resolved?.texture ?? null,
        normalTexture: resolved?.normalTexture ?? null,
        ormTexture: resolved?.ormTexture ?? null,
        color: resolved?.baseColor ?? presetColor,
        tiling: { x: base * mat.x, y: base * mat.y },
        roughness: resolved?.roughness ?? 1,
        metalness: resolved?.metalness ?? 0,
        aoIntensity: resolved?.aoIntensity ?? 1,
      } satisfies LandscapeLayerTexture;
    }),
  );
}

/**
 * Loads a Level's painted-foliage sidecar (`<level>.foliage.json`) plus every
 * Foliage Type asset its groups/rules reference, resolved id → path through the
 * manifest. Mirrors {@link ./foliageLoader} but fetches through this host's
 * `resolveUrl` (the same reason the manifest fetch is inlined above), so a fork
 * that serves its project files from elsewhere keeps one URL policy. A missing
 * sidecar is the normal "this Level paints no foliage" case, not a failure.
 */
/**
 * The Level's placement-scoped Mesh Paint sidecar (`<level>.meshpaint.json`), or
 * empty when it paints none. Fetched through this host's `resolveUrl` for the same
 * reason the foliage sidecar is — one URL policy for a fork that serves its project
 * files from elsewhere. A missing sidecar is the normal case, not a failure.
 */
async function fetchAuthoredMeshPaint(
  levelPath: string,
  resolveUrl: (path: string) => string,
  warn: (message: string, error?: unknown) => void,
): Promise<LayoutMeshPaintData> {
  try {
    const response = await fetch(resolveUrl(meshPaintDataPath(levelPath)), { cache: "no-cache" });
    if (!response.ok) return createEmptyMeshPaintData();
    return normalizeMeshPaintData(await response.json());
  } catch (error) {
    warn(`Authored-world mesh paint sidecar failed to load: ${meshPaintDataPath(levelPath)}`, error);
    return createEmptyMeshPaintData();
  }
}

/**
 * Paint entries for one asset, indexed by placement then by
 * `<meshName>|<primitiveIndex>` — the key {@link applyMeshPaintToBatch} rebuilds
 * while walking the glTF in the same order the instanced builder does.
 */
export type MeshPaintByPlacement = Map<number, Map<string, LayoutMeshPaintPlacement>>;

function indexMeshPaintByAsset(data: LayoutMeshPaintData): Map<string, MeshPaintByPlacement> {
  const byAsset = new Map<string, MeshPaintByPlacement>();
  for (const entry of data.placements) {
    if (entry.colors.length === 0) continue;
    const byPlacement = byAsset.get(entry.target.assetId) ?? new Map<number, Map<string, LayoutMeshPaintPlacement>>();
    const byMesh = byPlacement.get(entry.target.placementIndex) ?? new Map<string, LayoutMeshPaintPlacement>();
    byMesh.set(`${entry.target.meshName}|${entry.target.primitiveIndex}`, entry);
    byPlacement.set(entry.target.placementIndex, byMesh);
    byAsset.set(entry.target.assetId, byPlacement);
  }
  return byAsset;
}

/**
 * Writes one placement's painted vertex colours onto a single-placement batch.
 *
 * Mesh Paint is per *placement*, and an `InstancedMesh` has one geometry for all of
 * its instances — so a painted placement can only be its own batch, which is what
 * the caller arranges. The geometry is cloned first: the builder hands out the glTF
 * template's geometry, and writing the attribute in place would paint every other
 * placement of the same asset with it.
 *
 * The (meshName, primitiveIndex) key is rebuilt by walking `gltf.scene` in the same
 * order {@link createInstancedModelGroup} walks it, so `meshes[i]` is the batch for
 * the i-th renderable mesh. A vertex-count mismatch means the source GLB changed
 * under the paint; the entry is skipped rather than corrupting the buffer.
 */
function applyMeshPaintToBatch(
  gltf: GLTF,
  meshes: readonly InstancedMesh[],
  byMesh: Map<string, LayoutMeshPaintPlacement>,
): void {
  const primitiveIndexByMeshName = new Map<string, number>();
  let meshIndex = 0;
  gltf.scene.traverse((object) => {
    if (!isRenderableMesh(object)) return;
    const batch = meshes[meshIndex];
    meshIndex += 1;
    if (!batch) return;
    const meshName = object.name || "__unnamed_mesh";
    const primitiveIndex = primitiveIndexByMeshName.get(meshName) ?? 0;
    primitiveIndexByMeshName.set(meshName, primitiveIndex + 1);
    const paint = byMesh.get(`${meshName}|${primitiveIndex}`);
    if (!paint) return;
    if (batch.geometry.getAttribute("position")?.count !== paint.vertexCount) return;
    const geometry = batch.geometry.clone();
    geometry.setAttribute("color", new Float32BufferAttribute(paint.colors, 4));
    geometry.userData.forgeMeshPaintClone = true;
    batch.geometry = geometry;
  });
}

async function fetchAuthoredFoliage(
  levelPath: string,
  manifest: AssetManifest,
  resolveUrl: (path: string) => string,
  warn: (message: string, error?: unknown) => void,
): Promise<{ data: LayoutFoliageData; types: Map<string, ForgeFoliageTypeDef> } | null> {
  let data: LayoutFoliageData;
  try {
    const response = await fetch(resolveUrl(foliageDataPath(levelPath)), { cache: "no-cache" });
    if (!response.ok) return null; // no sidecar = no painted foliage
    data = normalizeFoliageData(await response.json());
  } catch (error) {
    warn(`Authored-world foliage sidecar failed to load: ${foliageDataPath(levelPath)}`, error);
    return null;
  }
  if (data.groups.length === 0 && (data.landscapeRules?.length ?? 0) === 0) return null;
  const typeIds = new Set([
    ...data.groups.map((group) => group.foliageTypeId),
    ...(data.landscapeRules ?? []).map((rule) => rule.foliageTypeId),
  ]);
  const types = new Map<string, ForgeFoliageTypeDef>();
  await Promise.all([...typeIds].map(async (id) => {
    const record = assetRecordById(manifest, id);
    if (!record) {
      warn(`Authored-world Foliage Type is not in the manifest: ${id}`);
      return;
    }
    try {
      const response = await fetch(resolveUrl(assetPath(record)), { cache: "no-cache" });
      if (!response.ok) throw new Error(`status ${response.status}`);
      types.set(id, normalizeFoliageType(await response.json()));
    } catch (error) {
      warn(`Authored-world Foliage Type failed to load: ${id}`, error);
    }
  }));
  return types.size > 0 ? { data, types } : null;
}

/**
 * Builds the authored static world for a Level layout.
 *
 * Loads every referenced model, registers procedural shape primitives, then
 * mounts the instanced static meshes and lights into one group. The returned
 * handle is inert until the caller adds `root` to a scene.
 */
export async function buildAuthoredWorld(options: AuthoredWorldOptions): Promise<AuthoredWorldHandle> {
  const { layout, renderer, resolveUrl } = options;
  const warn = options.onWarn ?? (() => {});
  const settings = resolveSceneWorldSettings(layout);
  const loader = createForgeGltfLoader(renderer);

  const assetManifest = await fetchAssetManifest(resolveUrl);
  const modelEntries = modelEntriesFrom(assetManifest);
  const models = new Map<string, GLTF>();
  const modelAssetIds = sceneModelAssetIds(layout);
  // The two phases a curtain has to sit through. Counted together so the bar
  // does not fill, reset and fill again as the mount moves from models to
  // terrain — one load, one denominator.
  const progressTotal = modelAssetIds.length + (layout.landscapes?.length ?? 0);
  let progressDone = 0;
  const tickProgress = (): void => options.onProgress?.(++progressDone, progressTotal);
  await Promise.all(modelAssetIds.map(async (assetId) => {
    const entry = modelEntries.get(assetId);
    if (!entry) {
      warn(`Authored-world asset is not in the manifest: ${assetId}`);
      tickProgress();
      return;
    }
    try {
      models.set(assetId, await loader.loadAsync(resolveUrl(entry.path)));
    } catch (error) {
      warn(`Authored-world model failed to load: ${assetId}`, error);
    }
    // Ticked on every outcome, missing and broken included: the curtain is
    // waiting on the *work*, and a model that failed is work that is over.
    tickProgress();
  }));

  // Sidecars repair or generate mesh UVs before instancing. Without this, an
  // assigned Forge material still reaches Play but every map samples as a flat
  // colour — the exact Editor/RTS mismatch this host must prevent.
  const staticUvwMappingCount = await applyAuthoredWorldUvwMappings(
    modelAssetIds,
    assetManifest,
    models,
    resolveUrl,
  );

  const materialTextureLoader = new TextureLoader();
  const authoredMaterials = await loadAuthoredWorldMaterialSlots(
    modelAssetIds,
    placementMaterialSlotIds(layout),
    assetManifest,
    materialTextureLoader,
    resolveUrl,
    renderer.capabilities.getMaxAnisotropy(),
    warn,
  );
  const applyAuthoredMaterialSlots = (assetId: string, group: Group): void => {
    const slots = authoredMaterials.slotsByAssetId.get(assetId);
    if (!slots) return;
    applyMaterialSlotOverrides(group, slots, (materialId) => authoredMaterials.materialsById.get(materialId));
  };

  const localBounds = new Map(computeModelLocalBounds(models));
  // Register procedural `shape:<type>` primitives so a shape instance mounts like
  // any other, instead of throwing on the synthetic (unmanifested) asset id.
  registerSceneShapeModels(layout, models, localBounds);

  // Mesh Paint lives in a sidecar keyed off the Level file, so a world mounted
  // without `levelPath` simply has none — the same rule painted foliage follows.
  const meshPaintByAsset = options.levelPath
    ? indexMeshPaintByAsset(await fetchAuthoredMeshPaint(options.levelPath, resolveUrl, warn))
    : new Map<string, MeshPaintByPlacement>();
  let meshPaintedPlacementCount = 0;

  const root = new Group();
  root.name = "authored-world";
  const instancedMeshes: InstancedMesh[] = [];
  for (const instance of layout.instances) {
    if (instance.placements.length === 0) continue;
    const gltf = models.get(instance.assetId);
    if (!gltf) continue; // missing model already warned; keep the rest of the world
    // A placement can carry two things the asset itself does not: a `materialSlot`
    // override (the editor's Details "Material" assignment) and Mesh Paint vertex
    // colours. Both are honoured by batching rather than by cloning: the editor and
    // `RuntimeSceneApp` pull such placements *out* of the instanced mesh, but this
    // world is mounted by hosts that batch by the thousand and apply per-mesh rules
    // (fog of war, reflection probes) to `staticInstanceMeshes` — a loose clone
    // would fall outside all of them.
    const paintedPlacements = meshPaintByAsset.get(instance.assetId);
    for (const batch of planPlacementBatches(instance.placements, paintedPlacements)) {
      const built = buildSceneInstancedModel({
        assetId: instance.assetId,
        gltf,
        placements: batch.placements,
        castShadow: settings.staticObjectsCastShadow,
        receiveShadow: settings.staticObjectsReceiveShadow,
      });
      const override =
        batch.materialId === null ? undefined : authoredMaterials.materialsById.get(batch.materialId);
      if (override) {
        // An override replaces every slot on the asset, so the sidecar's per-slot
        // assignment does not also apply — same precedence the editor uses.
        for (const mesh of built.meshes) mesh.material = override;
      } else if (batch.materialId === null) {
        applyAuthoredMaterialSlots(instance.assetId, built.group);
      }
      if (batch.paintedPlacementIndex !== null) {
        const byMesh = paintedPlacements?.get(batch.paintedPlacementIndex);
        if (byMesh) {
          applyMeshPaintToBatch(gltf, built.meshes, byMesh);
          meshPaintedPlacementCount += 1;
        }
      }
      root.add(built.group);
      instancedMeshes.push(...built.meshes);
    }
  }

  // Procedural spline generator output (instances / rigid segments / deform mesh).
  // `sceneModelAssetIds` already declared these meshes, so the models are loaded;
  // without this the authored world silently drops every generator the editor
  // previews — a spline-scattered rock wall would exist only in the editor.
  const splineGeneratedGroups: Group[] = [];
  for (const actor of layout.splines ?? []) {
    const built = buildSplineInstanceGeneratorGroup({
      actor,
      mode: "runtime",
      models,
      castShadow: settings.staticObjectsCastShadow,
      receiveShadow: settings.staticObjectsReceiveShadow,
      applyMaterialSlots: applyAuthoredMaterialSlots,
    });
    if (built?.missingAssetIds.length) {
      warn(`Authored-world spline generator mesh missing: ${built.missingAssetIds.join(", ")}`);
    }
    if (!built?.group) continue;
    root.add(built.group);
    splineGeneratedGroups.push(built.group);
    instancedMeshes.push(...built.meshes);
  }

  // Landscape terrains (heightfield). Mounted from the same `*.landscape.json`
  // sidecar the editor viewport and RuntimeSceneApp render, so an authored,
  // sculpted/painted terrain reaches the runtime without a bespoke loader. Layer
  // *textures* (assigned-material splat) are a later slice; the baked vertex-colour
  // paint still renders, so a sculpted terrain is already visible. A missing or
  // broken sidecar degrades to a flat terrain rather than dropping the whole world.
  const landscapeObjects: LandscapeObject[] = [];
  const mountedLandscapes: MountedLandscape[] = [];
  const landscapeLayerTextures: Texture[] = [];
  const riverWaterObjects: RiverWaterObjectLike[] = [];
  const riverReflectionSources: PlanarReflectionSource[] = [];
  const riverWaterTextures: Texture[] = [];
  const landscapes = layout.landscapes ?? [];
  const riverWaters = layout.riverWaters ?? [];
  const textureLoader = landscapes.length > 0 || riverWaters.length > 0 ? new TextureLoader() : null;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  for (const actor of landscapes) {
    let data: ForgeLandscapeData;
    try {
      const response = await fetch(resolveUrl(actor.dataRef), { cache: "no-cache" });
      if (!response.ok) throw new Error(`status ${response.status}`);
      data = await response.json() as ForgeLandscapeData;
    } catch (error) {
      warn(`Authored-world landscape sidecar failed to load: ${actor.dataRef}`, error);
      data = createFlatLandscapeData("medium");
    }
    const layerTextures = await resolveLandscapeLayerTextures(
      data,
      assetManifest,
      textureLoader!,
      maxAnisotropy,
      landscapeLayerTextures,
      warn,
    );
    const layerColors: LandscapeLayerColors = Object.fromEntries(
      layerTextures.map((layer) => [layer.id, layer.color]),
    );
    const item: LandscapeRenderItem = {
      ...resolveLandscape(actor),
      position: actor.position,
      rotation: actor.rotation ?? [0, 0, 0],
      data,
      layerTextures,
      layerColors,
      maxTextureUnits: renderer.capabilities.maxTextures,
    };
    const object = createLandscapeObject(item);
    root.add(object);
    landscapeObjects.push(object);
    mountedLandscapes.push({ data, object, position: actor.position, layerColors });
    tickProgress();
  }

  // Water presentation resolves against the already loaded Landscape sidecar so
  // editor and runtime share the exact same spline data. Missing references are
  // non-fatal: a bad optional river must not prevent the authored world loading.
  const landscapeDataById = new Map(
    landscapes.map((actor, index) => [actor.id, { actor, data: mountedLandscapes[index]!.data }] as const),
  );
  const texturePathById = new Map<string, string>();
  for (const value of assetManifest.assets as unknown[]) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const asset = value as Record<string, unknown>;
    if (asset.assetType === "texture" && typeof asset.id === "string" && typeof asset.path === "string") {
      texturePathById.set(asset.id, asset.path);
    }
  }
  const riverNormalCache = new Map<string, Texture | null>();
  const riverReflectionSourceByKey = new Map<string, PlanarReflectionSource>();
  for (const actor of riverWaters) {
    const resolved = resolveRiverWater(actor);
    const landscape = landscapeDataById.get(resolved.landscapeRef);
    const spline = landscape?.data.splines?.find((candidate) => candidate.id === resolved.splineRef);
    if (!landscape || !spline) {
      warn(`Authored-world river water skipped: ${resolved.id} references missing Landscape/spline (${resolved.landscapeRef}/${resolved.splineRef}).`);
      continue;
    }
    let reflectionSource: PlanarReflectionSource | null = null;
    const planeY = landscape.actor.position[1] + resolved.surfaceLevel;
    const reflectionKey = riverWaterReflectionGroupKey(resolved, planeY);
    if (reflectionKey && resolved.reflectionQuality !== "low") {
      reflectionSource = riverReflectionSourceByKey.get(reflectionKey) ?? null;
      if (!reflectionSource) {
        reflectionSource = new PlanarReflectionSource(planeY, resolved.reflectionQuality);
        riverReflectionSourceByKey.set(reflectionKey, reflectionSource);
        riverReflectionSources.push(reflectionSource);
      }
    }
    let normalMap = riverNormalCache.get(resolved.normalTexture);
    if (normalMap === undefined) {
      const texturePath = texturePathById.get(resolved.normalTexture);
      if (!texturePath) {
        warn(`Authored-world river water normal texture is not in the manifest: ${resolved.normalTexture}`);
        normalMap = null;
      } else {
        try {
          normalMap = await textureLoader!.loadAsync(resolveUrl(texturePath));
          normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
          riverWaterTextures.push(normalMap);
        } catch (error) {
          warn(`Authored-world river water normal texture failed to load: ${resolved.normalTexture}`, error);
          normalMap = null;
        }
      }
      riverNormalCache.set(resolved.normalTexture, normalMap);
    }
    let foamNoiseMap = riverNormalCache.get("perlin-noise");
    if (foamNoiseMap === undefined) {
      const texturePath = texturePathById.get("perlin-noise");
      if (!texturePath) {
        warn("Authored-world river water foam noise texture is not in the manifest: perlin-noise");
        foamNoiseMap = null;
      } else {
        try {
          foamNoiseMap = await textureLoader!.loadAsync(resolveUrl(texturePath));
          foamNoiseMap.wrapS = foamNoiseMap.wrapT = RepeatWrapping;
          riverWaterTextures.push(foamNoiseMap);
        } catch (error) {
          warn("Authored-world river water foam noise texture failed to load: perlin-noise", error);
          foamNoiseMap = null;
        }
      }
      riverNormalCache.set("perlin-noise", foamNoiseMap);
    }
    const item: RiverWaterRenderItem = {
      ...resolved,
      spline,
      landscapeData: landscape.data,
      position: landscape.actor.position,
      rotation: landscape.actor.rotation ?? [0, 0, 0],
      foamNoiseMap,
      reflectionSource,
    };
    const object = createRiverWaterObject(item, normalMap);
    root.add(object);
    riverWaterObjects.push(object);
  }

  // Painted foliage. It lives in a `<level>.foliage.json` sidecar rather than in
  // the layout, so without this block a Level's foliage exists only in the editor
  // viewport and in `RuntimeSceneApp` — a shell mounting its world through this
  // host would silently drop every painted tree. Decorative only (no collision,
  // no nav), matching the runtime path; a broken sidecar/type/mesh degrades to
  // "no foliage" instead of failing the whole world.
  let foliageBinding: FoliageRenderBinding | null = null;
  let foliageInstanceCount = 0;
  const foliage = options.levelPath
    ? await fetchAuthoredFoliage(options.levelPath, assetManifest, resolveUrl, warn)
    : null;
  if (foliage) {
    // Foliage meshes are not layout instances, so `sceneModelAssetIds` never
    // declared them — load whichever ones the world does not already hold.
    await Promise.all([...new Set(
      [...foliage.types.values()].map((type) => type.meshAssetId).filter((id) => id && !models.has(id)),
    )].map(async (assetId) => {
      const entry = modelEntries.get(assetId);
      if (!entry) {
        warn(`Authored-world foliage mesh is not in the manifest: ${assetId}`);
        return;
      }
      try {
        models.set(assetId, await loader.loadAsync(resolveUrl(entry.path)));
      } catch (error) {
        warn(`Authored-world foliage mesh failed to load: ${assetId}`, error);
      }
    }));
    // Landscape-rule foliage is transient render data: the sidecar stores the
    // rule, and the instances are re-derived here from the same seeded sampler
    // the editor previews with, so Play matches the viewport scatter exactly.
    const generated: LayoutFoliageGroup[] = [];
    for (const rule of foliage.data.landscapeRules ?? []) {
      const index = landscapes.findIndex((entry) => entry.id === rule.landscapeId);
      const actor = index >= 0 ? landscapes[index]! : null;
      const type = foliage.types.get(rule.foliageTypeId);
      if (!actor || !type) continue;
      const instances = generateLandscapeFoliageSamples(rule, {
        id: actor.id,
        position: [...actor.position],
        rotation: readRotation(actor),
        data: mountedLandscapes[index]!.data,
      }).map((sample) =>
        foliageInstanceFromRoll(type, rollFoliageInstance(type, sample, makeFoliageRng(sample.seed))),
      );
      if (instances.length === 0) continue;
      generated.push({
        id: `generated-${rule.id}`,
        foliageTypeId: rule.foliageTypeId,
        target: { kind: "landscape", id: rule.landscapeId },
        instances,
      });
    }
    const renderData: LayoutFoliageData = {
      schema: 1,
      type: "foliage",
      groups: [...foliage.data.groups, ...generated],
    };
    const binding = new FoliageRenderBinding();
    binding.rebuild(renderData, {
      getType: (id) => foliage.types.get(id) ?? null,
      getModel: (assetId) => models.get(assetId) ?? null,
      applyMaterialSlots: applyAuthoredMaterialSlots,
    });
    root.add(binding.root);
    foliageBinding = binding;
    for (const group of renderData.groups) foliageInstanceCount += group.instances.length;
  }

  const shadowBounds = options.shadowBounds ?? computeSceneRoomBounds(layout, localBounds);
  const lightRecords: LightObjectRecord[] = [];
  const directionalLights: DirectionalLight[] = [];
  const lights = layout.lights ?? [];
  for (let index = 0; index < lights.length; index += 1) {
    // Headless: no gizmo billboard (that needs a DOM canvas and is editor-only).
    const record = buildSceneLightObject(lights[index]!, index, { gizmo: false });
    if (record.light.type === "DirectionalLight") {
      const directional = record.light as DirectionalLight;
      fitDirectionalShadowToBounds(directional, shadowBounds);
      directionalLights.push(directional);
    }
    root.add(record.root);
    if (record.target) root.add(record.target);
    lightRecords.push(record);
  }

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    const geometries = new Set<{ dispose(): void }>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    const collect = (object: Object3D): void => {
      object.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        geometries.add(child.geometry);
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (material) collectMaterialTextures(material, materials, textures);
        }
      });
    };
    collect(root);
    for (const material of authoredMaterials.materialsById.values()) {
      collectMaterialTextures(material, materials, textures);
    }
    // The loaded glTF templates are not children of `root` (the instanced meshes
    // reference their geometry), so free them explicitly too — dispose is
    // idempotent, so any geometry shared with an instanced mesh is safe to repeat.
    for (const gltf of models.values()) collect(gltf.scene);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    // Landscape splat textures live in the material's custom uniforms, not as
    // enumerable material properties, so the traversal above cannot reach them.
    for (const texture of landscapeLayerTextures) texture.dispose();
    for (const texture of riverWaterTextures) texture.dispose();
    for (const river of riverWaterObjects) disposeRiverWaterObject(river);
    // Deform-mesh generators build geometry per spline (not shared with a glTF
    // template), and plugin generators register their own disposals.
    for (const group of splineGeneratedGroups) disposeSplineGeneratedGroup(group);
    // Foliage batches instance the glTF templates collected above, so this only
    // has to free the InstancedMeshes themselves.
    foliageBinding?.dispose();
    for (const source of riverReflectionSources) source.dispose();
    for (const record of lightRecords) {
      const light = record.light as { dispose?: () => void };
      light.dispose?.();
    }
    models.clear();
  };

  return {
    root,
    navigationBlockers: [],
    directionalLights,
    staticInstanceMeshes: instancedMeshes,
    staticSlotMaterialCount: authoredMaterials.materialsById.size,
    staticUvwMappingCount,
    meshPaintedPlacementCount,
    landscapeCount: landscapeObjects.length,
    landscapes: mountedLandscapes,
    foliageInstanceCount,
    foliageRoot: foliageBinding?.root ?? null,
    riverWaterObjects,
    updateFoliageCulling: (cameraPosition, cullDistanceScale = 1) => {
      foliageBinding?.updateCulling(cameraPosition, cullDistanceScale);
    },
    dispose,
  };
}

/** Adds a material and its bound textures to the dispose sets. */
function collectMaterialTextures(material: Material, materials: Set<Material>, textures: Set<Texture>): void {
  materials.add(material);
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === "object" && "isTexture" in value && (value as { isTexture?: boolean }).isTexture) {
      textures.add(value as Texture);
    }
  }
}

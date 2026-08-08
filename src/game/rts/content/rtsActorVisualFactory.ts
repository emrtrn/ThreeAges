/**
 * Actor Script -> RTS presentation adapter (assetization Faz C).
 *
 * It consumes only authored presentation components and never reads gameplay
 * values from Actor Scripts.
 *
 * Loading is per-Actor: one unreadable class or model produces a visible
 * placeholder for that one entry and a counted, named failure, instead of
 * throwing the whole pack back to the legacy art path. A pack-wide failure is
 * reserved for what genuinely is one — an unreachable manifest, without which no
 * reference can resolve at all.
 */
import { Group, Mesh, TextureLoader, type AnimationClip, type Material, type Object3D, type WebGLRenderer } from "three";
import { isMeshComponentKind, normalizeActorScriptDef, type ActorScriptDef } from "@engine/scene/actorScript";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import type { AssetManifest } from "@engine/assets/manifest";
import { projectFileUrl } from "@/project/ProjectSystem";
import type { SettlementAge } from "@/game/data/gameDataTypes";
import { rtsAnimalActorRef, rtsBuildingActorRef, rtsBuildingActorRefLadder, rtsCaravanActorRef, rtsPropAssetId, rtsUnitActorRef, type RtsActorRef, type RtsContentCatalog } from "./rtsContentCatalog";
import {
  RtsActorPresentationError,
  parseRtsEffectManifestPaths,
  parseRtsTextureManifestPaths,
  parseRtsMeshManifest,
  rtsContentCatalogRefs,
  validateRtsPresentationActor,
  type RtsMeshAsset,
} from "./rtsContentValidation";
import {
  buildActorPresentationTree,
  fitPresentationToFootprint,
  presentationExtent,
  tintedCopy,
  type PresentationExtent,
} from "./rtsActorPresentationTree";
import { createRtsActorPlaceholder } from "./rtsActorPlaceholder";
import { bindRtsWheelSpins } from "./rtsPresentationMotion";
import { bindRtsGunRecoils, bindRtsMuzzle } from "./rtsGunMotion";
import { bindRtsCargoSways, bindRtsCargoVisuals } from "./rtsCargoVisual";
import {
  collectRtsPickTargets,
  createRtsUnitPresentation,
  readRtsSelectionRadius,
  type RtsUnitAnimationSource,
} from "./rtsUnitPresentation";
import { loadAssetSkeleton, type AssetSkeletonDef } from "@/scene/assetSkeletonLoader";
import { applyAssetUvwMapping, loadAssetUvw, type AssetUvwDef } from "@/scene/assetUvwLoader";
import {
  applyMaterialSlotOverrides,
  assignedMaterialSlotIds,
  hasAssignedMaterialSlots,
  loadAssetMaterialSlots,
  type AssetMaterialSlotsDef,
} from "@/scene/assetMaterialSlotsLoader";
import { loadForgeMaterial } from "@/scene/materialAssets";
import type { RtsPresentationHandle, UnitOwner } from "../units/unit";

/**
 * One resolved mesh asset: the model to clone plus everything an animated
 * instance needs. Clips and the skeleton sidecar are cached beside the scene
 * because they are per-*asset* facts — every unit cloned from this model shares
 * them, while each clone gets its own bones and its own mixer.
 */
interface RtsModelTemplate {
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
  readonly skeleton: AssetSkeletonDef;
}

/** One catalog entry that could not be built, named by ref and failing component. */
export interface RtsActorLoadFailure {
  readonly ref: string;
  readonly reason: string;
}

/** What the pack load actually achieved; surfaced by the debug overlay and log. */
export interface RtsActorLoadReport {
  readonly requested: number;
  readonly loaded: number;
  readonly failures: readonly RtsActorLoadFailure[];
}

/**
 * The canvas witness for the pack's health. `ready` means every catalog entry
 * built; `placeholder` means the match is running with visible stand-ins, which
 * is a different fact from both "ready" and the pack-wide `fallback`.
 */
export function rtsContentAssetsState(report: RtsActorLoadReport): "ready" | "placeholder" {
  return report.failures.length > 0 ? "placeholder" : "ready";
}

/** `?debug` overlay block: the count first, then the reason for each stand-in. */
export function formatRtsActorPresentationDebug(report: RtsActorLoadReport): string[] {
  const header = `sunum: ${report.loaded}/${report.requested} Actor`;
  if (report.failures.length === 0) return [`${header} · placeholder yok`];
  return [
    `${header} · ${report.failures.length} placeholder`,
    ...report.failures.map((failure) => `  ! ${failure.reason}`),
  ];
}

/** Builds cloned Actor Script component trees from the manifest-resolved mesh assets. */
export class RtsActorVisualFactory {
  private readonly loader;
  private readonly definitions = new Map<RtsActorRef, ActorScriptDef>();
  private readonly templates = new Map<string, RtsModelTemplate>();
  /** In-flight/settled model loads, keyed by asset id — see {@link templateFor}. */
  private readonly templateLoads = new Map<string, Promise<RtsModelTemplate>>();
  private readonly manifestMeshes = new Map<string, RtsMeshAsset>();
  /** Effect asset id → public-root-relative path, for the damage table's slots. */
  private readonly manifestEffects = new Map<string, string>();
  /** Texture asset id → path, for the sprite art an effect's renderer names. */
  private readonly manifestTextures = new Map<string, string>();
  /**
   * Tinted material variants, keyed by source material and tint.
   *
   * Cached at the factory rather than built per instance because a tint is an
   * *Actor* fact: every Archer wants the same green copy of the same material.
   * Without this, forty Archers would carry forty materials and forty shader
   * programs would be compiled for what is one appearance.
   */
  private readonly tintedMaterials = new Map<string, Material>();
  /**
   * Forge materials assigned to a mesh asset's slots in the Static Mesh Editor
   * (`*.materials.json`), cached by material id.
   *
   * Shared across every template that names the same id, for the same reason the
   * tints are: three Town Centre levels all assigned `m-wood-floor-material`, and
   * loading it once means one set of textures on the GPU and one shader program
   * instead of three.
   */
  private readonly slotMaterials = new Map<string, Material | null>();
  /** In-flight material loads, deduped by id so concurrent templates share a fetch. */
  private readonly slotMaterialLoads = new Map<string, Promise<Material | null>>();
  /** Shared by every slot material's textures; a per-material loader would not cache. */
  private readonly textureLoader = new TextureLoader();
  /** Read once from the renderer: the cap `loadForgeMaterial` clamps anisotropy to. */
  private readonly maxAnisotropy: number;
  /**
   * The manifest this pack resolved against, kept because slot assignments name
   * materials by *id* — resolving one to a file needs the same manifest the mesh
   * ids came from.
   */
  private manifest: AssetManifest | null = null;
  /** Refs that failed to load and now render as the explicit stand-in. */
  private readonly failures = new Map<RtsActorRef, string>();
  /**
   * The extent every level of one building+age+state is fitted against, keyed by
   * that triple. Measuring it means building each rung's tree once; the cache is
   * what keeps that off the path a placement preview walks every frame.
   */
  private readonly ladderExtents = new Map<string, PresentationExtent | null>();
  private requested = 0;
  private ready = false;

  constructor(
    renderer: WebGLRenderer,
    private readonly catalog: RtsContentCatalog,
  ) {
    this.loader = createForgeGltfLoader(renderer);
    this.maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  }

  /**
   * Public-root-relative path of a manifested effect asset, or null.
   *
   * This is what replaces the runtime's former hand-written effect allowlist: an
   * effect the author imported and registered resolves, anything else does not,
   * and no code change sits between those two states.
   */
  effectAssetPath(effectId: string): string | null {
    return this.manifestEffects.get(effectId) ?? null;
  }

  /** Same, for the sprite texture an effect's renderer names. */
  textureAssetPath(textureId: string): string | null {
    return this.manifestTextures.get(textureId) ?? null;
  }

  /** Same, for a static mesh — the debris models an effect's renderer names. */
  /**
   * Load the model the catalog maps a prop slot to, or null when it maps none.
   *
   * Props are art the runtime draws that no Actor references — a shell in
   * flight is a pooled mesh, not a placed Actor — so they cannot come through
   * the pack walk, which only visits Actors. They go through the same template
   * cache all the same, so a prop that happened to share a model with an Actor
   * shares its download too.
   *
   * Callable only after {@link load}: the manifest is what resolves the id.
   */
  async loadPropModel(slot: string): Promise<Object3D | null> {
    const assetId = rtsPropAssetId(this.catalog, slot);
    if (assetId === null) return null;
    const asset = this.manifestMeshes.get(assetId);
    if (!asset || asset.assetType !== "staticMesh") return null;
    const template = this.templates.get(assetId) ?? await this.templateFor(assetId, asset.path);
    this.templates.set(assetId, template);
    return template.scene;
  }

  staticMeshAssetPath(assetId: string): string | null {
    const asset = this.manifestMeshes.get(assetId);
    return asset?.assetType === "staticMesh" ? asset.path : null;
  }

  /**
   * `onProgress` feeds the boot curtain (`rtsLoadProgress.ts`). The denominator
   * is the catalog's ref count, which is only knowable after the manifest fetch
   * below — hence reported with every tick rather than promised up front.
   */
  async load(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const manifestResponse = await fetch(projectFileUrl("assets/manifest.json"), { cache: "no-cache" });
    if (!manifestResponse.ok) {
      throw new Error(`RTS Actor manifest fetch failed: ${manifestResponse.status}`);
    }
    const manifestJson = (await manifestResponse.json()) as unknown;
    // Held for the material-slot sidecars, which name materials by id. Shape is
    // checked here rather than trusted: a manifest without an `assets` array
    // simply means no slot override can resolve, which the loader degrades to
    // "keep the model's own material" instead of throwing the pack away.
    this.manifest = isAssetManifest(manifestJson) ? manifestJson : null;
    for (const [id, asset] of parseRtsMeshManifest(manifestJson)) {
      this.manifestMeshes.set(id, asset);
    }
    // The damage table names effect assets; the factory is where the manifest is
    // already read, so indexing them here keeps the whole match to one fetch of a
    // file this size.
    for (const [id, path] of parseRtsEffectManifestPaths(manifestJson)) {
      this.manifestEffects.set(id, path);
    }
    // Indexed from the same read: an effect that names a sprite texture is no use
    // without it, and the match has no other chance to resolve the id.
    for (const [id, path] of parseRtsTextureManifestPaths(manifestJson)) {
      this.manifestTextures.set(id, path);
    }

    const refs = rtsContentCatalogRefs(this.catalog);
    this.requested = refs.length;
    let loaded = 0;
    // In parallel: the pack covers every building at every age and level, and
    // loading it one file at a time put the whole match behind a serial chain of
    // fetches. Models are shared through {@link templateFor}, so concurrency does
    // not turn into duplicate downloads of the same mesh.
    await Promise.all(refs.map(async (ref) => {
      try {
        await this.loadActor(ref);
      } catch (error) {
        // Per-Actor isolation: this ref renders as the stand-in, every other
        // entry in the pack is unaffected, and the reason survives to the report.
        this.failures.set(ref, error instanceof Error ? error.message : String(error));
      }
      // A failed ref still advances the bar: it resolves to the stand-in and the
      // boot is no longer waiting on it. Progress tracks work, not success.
      onProgress?.(++loaded, refs.length);
    }));
    this.ready = true;
  }

  /**
   * Whether the pack has finished loading. Callers use it to tell "no Actor for
   * this id" (a coverage bug worth showing) apart from "not loaded yet" (a
   * moment, during which the legacy art still covers the field).
   */
  isReady(): boolean {
    return this.ready;
  }

  /** Counts and reasons for whatever the pack could not build. */
  report(): RtsActorLoadReport {
    return {
      requested: this.requested,
      loaded: this.definitions.size,
      failures: [...this.failures].map(([ref, reason]) => ({ ref, reason })),
    };
  }

  /**
   * Returns null until loaded or whenever a catalog entry intentionally does not
   * exist. `moveSpeed` is the unit's authored ground speed, which the animated
   * handle needs to calibrate its walk/run boundary and playback rate — it is
   * balance data read straight off the unit's stats, never off the Actor Script.
   */
  createUnitPresentation(unitId: string, owner: UnitOwner, moveSpeed?: number): RtsPresentationHandle | null {
    const actorRef = rtsUnitActorRef(this.catalog, unitId, owner);
    if (!actorRef || !this.ready) return null;
    const root = this.createActorVisual(actorRef);
    if (!root) return null;
    const pickTargets = collectRtsPickTargets(root);
    if (pickTargets.length === 0) return null;
    // A ref that failed to load has no def, and `createActorVisual` has already
    // handed back the stand-in. Returning null here instead would drop the unit
    // to the legacy code body — art that looks finished — which is how a missing
    // enemy variant used to pass unnoticed.
    const def = this.definitions.get(actorRef);
    return createRtsUnitPresentation({
      root,
      pickTargets,
      selectionRadius: readRtsSelectionRadius(def),
      animation: def ? this.animationSourceFor(root) : null,
      moveSpeed,
      wheelSpins: def ? bindRtsWheelSpins(def, root) : [],
      // The siege engine is what these two exist for: a barrel that kicks when
      // the gun goes off, and the point its shell is drawn leaving from.
      gunRecoils: def ? bindRtsGunRecoils(def, root) : [],
      muzzle: def ? bindRtsMuzzle(def, root) : null,
    });
  }

  /**
   * A grazing animal's presentation. Shares the unit path deliberately: an
   * animal needs exactly what a unit needs — a cloned tree, a mixer bound to the
   * model, and speed-driven clip selection — and the only thing wildlife lacks
   * (an owner variant) is the one argument left off.
   */
  createAnimalPresentation(
    species: string,
    moveSpeed?: number,
    walkClipSpeed?: number,
  ): RtsPresentationHandle | null {
    const actorRef = rtsAnimalActorRef(this.catalog, species);
    if (!actorRef || !this.ready) return null;
    const root = this.createActorVisual(actorRef);
    if (!root) return null;
    const pickTargets = collectRtsPickTargets(root);
    if (pickTargets.length === 0) return null;
    const def = this.definitions.get(actorRef);
    return createRtsUnitPresentation({
      root,
      pickTargets,
      selectionRadius: readRtsSelectionRadius(def),
      animation: def ? this.animationSourceFor(root) : null,
      moveSpeed,
      // Animals carry an authored model scale, so the engine's "walk clip is
      // natural at half move speed" default would leave them sliding.
      walkClipSpeed,
      wheelSpins: [],
    });
  }

  /** V4's non-unit donkey uses the logistics catalog section, not `animals`. */
  createCaravanPresentation(moveSpeed?: number, walkClipSpeed?: number): RtsPresentationHandle | null {
    const actorRef = rtsCaravanActorRef(this.catalog);
    if (!actorRef || !this.ready) return null;
    const root = this.createActorVisual(actorRef);
    if (!root) return null;
    const pickTargets = collectRtsPickTargets(root);
    if (pickTargets.length === 0) return null;
    const def = this.definitions.get(actorRef);
    return createRtsUnitPresentation({
      root,
      pickTargets,
      selectionRadius: readRtsSelectionRadius(def),
      animation: def ? this.animationSourceFor(root) : null,
      moveSpeed,
      walkClipSpeed,
      wheelSpins: [],
      // The one carrier the project has: its panniers are hidden until the
      // logistics view reports an outbound load.
      cargoVisuals: def ? bindRtsCargoVisuals(def, root) : [],
      cargoSways: def ? bindRtsCargoSways(def, root) : [],
    });
  }

  createBuildingVisual(
    buildingId: string,
    state: "construction" | "completed",
    level: number,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge = "settlement",
  ): Group | null {
    if (!this.ready) return null;
    const actorRef = rtsBuildingActorRef(this.catalog, buildingId, state, level, age);
    if (!actorRef) return null;
    const visual = this.createActorVisual(actorRef);
    if (!visual) return null;
    visual.userData.rtsSharedModel = true;
    fitPresentationToFootprint(
      visual,
      footprintWidth,
      footprintDepth,
      this.ladderExtent(buildingId, state, age),
    );
    return visual;
  }

  /**
   * The largest ground-plane extent in this building's level ladder at this age.
   *
   * Every rung is fitted against it rather than against itself, which is what
   * makes levelling up an increase in size instead of a re-fit of whatever the
   * artist happened to model for that level. Null when nothing in the ladder
   * measures — then each model falls back to being its own reference, the old
   * behaviour, which is still right for a single-model building.
   */
  private ladderExtent(
    buildingId: string,
    state: "construction" | "completed",
    age: SettlementAge,
  ): PresentationExtent | null {
    const key = `${buildingId}|${state}|${age}`;
    const cached = this.ladderExtents.get(key);
    if (cached !== undefined) return cached;
    let width = 0;
    let depth = 0;
    for (const ref of rtsBuildingActorRefLadder(this.catalog, buildingId, state, age)) {
      // Built and thrown away: the clone shares its templates' geometry and
      // materials, so measuring costs nodes, not GPU memory.
      const rung = this.createActorVisual(ref);
      if (!rung) continue;
      const extent = presentationExtent(rung);
      width = Math.max(width, extent.width);
      depth = Math.max(depth, extent.depth);
    }
    const extent = width > 0 && depth > 0 ? { width, depth } : null;
    this.ladderExtents.set(key, extent);
    return extent;
  }

  dispose(): void {
    // Slot materials are shared *between* templates, so they are held back from
    // the per-template sweep and freed once below. Letting the sweep take them
    // would dispose one material up to as many times as models named it.
    const shared = new Set<Material>();
    for (const material of this.slotMaterials.values()) if (material) shared.add(material);
    for (const template of this.templates.values()) disposeTemplate(template.scene, shared);
    this.templates.clear();
    for (const material of shared) material.dispose();
    this.slotMaterials.clear();
    for (const pending of this.slotMaterialLoads.values()) pending.catch(() => undefined);
    this.slotMaterialLoads.clear();
    // The tinted copies are this factory's own GPU resources — the templates it
    // disposes above never referenced them, so nothing else will free them.
    for (const material of this.tintedMaterials.values()) material.dispose();
    this.tintedMaterials.clear();
    // A rejected entry left here would keep an unhandled rejection alive past the
    // app it belonged to.
    for (const pending of this.templateLoads.values()) pending.catch(() => undefined);
    this.templateLoads.clear();
    this.definitions.clear();
    this.manifestMeshes.clear();
    this.failures.clear();
    this.ladderExtents.clear();
    this.requested = 0;
    this.ready = false;
  }

  private async loadActor(ref: RtsActorRef): Promise<void> {
    const response = await fetch(projectFileUrl(ref), { cache: "no-cache" });
    if (!response.ok) {
      throw new RtsActorPresentationError(ref, `Actor class fetch failed (${response.status})`);
    }
    const def = normalizeActorScriptDef(await response.json(), ref);
    // One authority for "is this Actor renderable as authored" — shared with the
    // engine coverage test, so a pack that passes CI cannot fail only in game.
    validateRtsPresentationActor(def, ref, this.manifestMeshes);
    await Promise.all(def.components
      .filter((entry) => isMeshComponentKind(entry.component))
      .map(async (node) => {
        const assetId = node.props.assetId as string;
        const asset = this.manifestMeshes.get(assetId)!;
        try {
          this.templates.set(assetId, await this.templateFor(assetId, asset.path));
        } catch (cause) {
          throw new RtsActorPresentationError(
            ref,
            `mesh component "${node.id}" could not load model "${asset.path}"`,
            { cause },
          );
        }
      }));
    // Registered only once every model behind it is in hand, so a half-loaded
    // Actor can never render as a tree with silently missing meshes.
    this.definitions.set(ref, def);
  }

  /**
   * One request per mesh asset, however many Actors reference it. The promise
   * itself is cached, not just the result, so Actors loading concurrently share a
   * download instead of racing for it — and a model that failed stays failed for
   * every Actor that names it, rather than being retried once per reference.
   */
  private templateFor(assetId: string, path: string): Promise<RtsModelTemplate> {
    let pending = this.templateLoads.get(assetId);
    if (!pending) {
      pending = this.buildTemplate(path);
      this.templateLoads.set(assetId, pending);
    }
    return pending;
  }

  /**
   * One model plus the asset-level authoring that rides along with it.
   *
   * None of the three sidecars reject: a missing one resolves to its empty
   * default, which for the skeleton means "this asset animates nothing", and for
   * the other two means "render this model exactly as it was exported".
   */
  private async buildTemplate(path: string): Promise<RtsModelTemplate> {
    const [gltf, skeleton, uvw, materialSlots] = await Promise.all([
      this.loader.loadAsync(projectFileUrl(path)),
      loadAssetSkeleton(path),
      loadAssetUvw(path),
      loadAssetMaterialSlots(path),
    ]);
    await this.applyAuthoredSurface(gltf.scene, uvw, materialSlots);
    return { scene: gltf.scene, animations: gltf.animations, skeleton };
  }

  /**
   * Apply what the Static Mesh Editor authored on the *asset*: its material slot
   * assignments and its UVW projection.
   *
   * Done once on the template, before any clone — the presentation tree clones
   * `Object3D`s, which share geometry, so projecting UVs here reaches every
   * building placed from this model at the cost of one pass.
   *
   * Order is not free. Slot overrides first, projection second: the projection
   * pass also forces every texture it finds on the current materials to repeat
   * wrapping, and a material swapped in afterwards would miss that. It is also
   * the direction that matters for these kit meshes, whose exported UVs are
   * degenerate (every vertex at one point) — without the projection an assigned
   * wood material samples a single texel and reads as flat colour, which is
   * exactly the "material assigned but nothing changed" symptom.
   */
  private async applyAuthoredSurface(
    root: Object3D,
    uvw: AssetUvwDef,
    materialSlots: AssetMaterialSlotsDef,
  ): Promise<void> {
    if (hasAssignedMaterialSlots(materialSlots)) {
      await Promise.all(assignedMaterialSlotIds(materialSlots).map((id) => this.slotMaterial(id)));
      applyMaterialSlotOverrides(
        root,
        materialSlots,
        (materialId) => this.slotMaterials.get(materialId) ?? undefined,
      );
    }
    applyAssetUvwMapping(root, uvw);
  }

  /**
   * One load per assigned material id, however many meshes name it.
   *
   * A material that cannot be read resolves to null rather than throwing: the
   * mesh keeps its exported material and the building still renders, which is a
   * better answer than an entire Actor dropping to a stand-in over one surface.
   */
  private slotMaterial(materialId: string): Promise<Material | null> {
    const cached = this.slotMaterials.get(materialId);
    if (cached !== undefined) return Promise.resolve(cached);
    let pending = this.slotMaterialLoads.get(materialId);
    if (!pending) {
      const manifest = this.manifest;
      pending = (manifest
        ? loadForgeMaterial(manifest, materialId, this.textureLoader, {
            maxAnisotropy: this.maxAnisotropy,
          }).catch((error: unknown) => {
            console.warn(`[rts] material slot "${materialId}" could not load:`, error);
            return null;
          })
        : Promise.resolve(null)
      ).then((material) => {
        this.slotMaterials.set(materialId, material);
        return material;
      });
      this.slotMaterialLoads.set(materialId, pending);
    }
    return pending;
  }

  /**
   * The animation source for a built presentation tree: the first cloned model
   * that actually ships clips, together with the node to bind a mixer to.
   *
   * The bind target is the model subtree, never the presentation root. Animation
   * tracks address nodes by name, and authored component ids live in the same
   * namespace as the rig's bone names — binding higher up lets a component
   * called "root" swallow the `root` bone's track. Actors may also hang static
   * props off an animated body; those carry no clips and are skipped rather than
   * treated as a second, competing skeleton.
   */
  private animationSourceFor(root: Object3D): RtsUnitAnimationSource | null {
    let source: RtsUnitAnimationSource | null = null;
    root.traverse((child) => {
      if (source) return;
      const assetId = child.userData.rtsActorMeshAssetId;
      if (typeof assetId !== "string") return;
      const template = this.templates.get(assetId);
      if (!template || template.animations.length === 0) return;
      source = { target: child, clips: template.animations, skeleton: template.skeleton };
    });
    return source;
  }

  private createActorVisual(ref: RtsActorRef): Group | null {
    const def = this.definitions.get(ref);
    if (!def) return this.failures.has(ref) ? createRtsActorPlaceholder(ref) : null;
    return buildActorPresentationTree(
      def,
      ref,
      (assetId) => this.templates.get(assetId)?.scene,
      (material, tint) => this.tintedMaterial(material, tint),
    );
  }

  private tintedMaterial(material: Material, tint: string): Material {
    const key = `${material.uuid}|${tint}`;
    let tinted = this.tintedMaterials.get(key);
    if (!tinted) {
      tinted = tintedCopy(material, tint);
      this.tintedMaterials.set(key, tinted);
    }
    return tinted;
  }
}

function disposeTemplate(root: Object3D, shared: ReadonlySet<Material> = new Set()): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      // Materials this template does not own (slot overrides shared with other
      // templates) are the caller's to free, exactly once.
      if (!shared.has(material)) material.dispose();
    }
  });
}

/** Minimal shape guard: enough to resolve a material id, nothing more. */
function isAssetManifest(value: unknown): value is AssetManifest {
  return Boolean(value) && Array.isArray((value as AssetManifest).assets);
}

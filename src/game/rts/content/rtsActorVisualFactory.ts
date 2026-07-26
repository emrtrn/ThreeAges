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
import { Group, Mesh, type AnimationClip, type Material, type Object3D, type WebGLRenderer } from "three";
import { isMeshComponentKind, normalizeActorScriptDef, type ActorScriptDef } from "@engine/scene/actorScript";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import { projectFileUrl } from "@/project/ProjectSystem";
import type { SettlementAge } from "@/game/data/gameDataTypes";
import { rtsBuildingActorRef, rtsUnitActorRef, type RtsActorRef, type RtsContentCatalog } from "./rtsContentCatalog";
import {
  RtsActorPresentationError,
  parseRtsMeshManifest,
  rtsContentCatalogRefs,
  validateRtsPresentationActor,
  type RtsMeshAsset,
} from "./rtsContentValidation";
import { buildActorPresentationTree, fitPresentationToFootprint, tintedCopy } from "./rtsActorPresentationTree";
import { createRtsActorPlaceholder } from "./rtsActorPlaceholder";
import { createRtsUnitPresentation, type RtsUnitAnimationSource } from "./rtsUnitPresentation";
import { loadAssetSkeleton, type AssetSkeletonDef } from "@/scene/assetSkeletonLoader";
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

function readNumberVariable(def: ActorScriptDef, key: string, fallback: number): number {
  const value = def.variables.find((field) => field.key === key)?.default;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Builds cloned Actor Script component trees from the manifest-resolved mesh assets. */
export class RtsActorVisualFactory {
  private readonly loader;
  private readonly definitions = new Map<RtsActorRef, ActorScriptDef>();
  private readonly templates = new Map<string, RtsModelTemplate>();
  /** In-flight/settled model loads, keyed by asset id — see {@link templateFor}. */
  private readonly templateLoads = new Map<string, Promise<RtsModelTemplate>>();
  private readonly manifestMeshes = new Map<string, RtsMeshAsset>();
  /**
   * Tinted material variants, keyed by source material and tint.
   *
   * Cached at the factory rather than built per instance because a tint is an
   * *Actor* fact: every Archer wants the same green copy of the same material.
   * Without this, forty Archers would carry forty materials and forty shader
   * programs would be compiled for what is one appearance.
   */
  private readonly tintedMaterials = new Map<string, Material>();
  /** Refs that failed to load and now render as the explicit stand-in. */
  private readonly failures = new Map<RtsActorRef, string>();
  private requested = 0;
  private ready = false;

  constructor(
    renderer: WebGLRenderer,
    private readonly catalog: RtsContentCatalog,
  ) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async load(): Promise<void> {
    const manifestResponse = await fetch(projectFileUrl("assets/manifest.json"), { cache: "no-cache" });
    if (!manifestResponse.ok) {
      throw new Error(`RTS Actor manifest fetch failed: ${manifestResponse.status}`);
    }
    for (const [id, asset] of parseRtsMeshManifest(await manifestResponse.json())) {
      this.manifestMeshes.set(id, asset);
    }

    const refs = rtsContentCatalogRefs(this.catalog);
    this.requested = refs.length;
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
  createUnitPresentation(unitId: string, _owner: UnitOwner, moveSpeed?: number): RtsPresentationHandle | null {
    const actorRef = rtsUnitActorRef(this.catalog, unitId);
    if (!actorRef || !this.ready) return null;
    const root = this.createActorVisual(actorRef);
    const def = this.definitions.get(actorRef);
    if (!root || !def) return null;
    const pickTargets: Object3D[] = [];
    root.traverse((child) => {
      if (child instanceof Mesh) pickTargets.push(child);
    });
    if (pickTargets.length === 0) return null;
    return createRtsUnitPresentation({
      root,
      pickTargets,
      selectionRadius: readNumberVariable(def, "selectionRadius", 0.5),
      animation: this.animationSourceFor(root),
      moveSpeed,
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
    fitPresentationToFootprint(visual, footprintWidth, footprintDepth);
    return visual;
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeTemplate(template.scene);
    this.templates.clear();
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
      // The sidecar rides along with the model: it names which clip is idle,
      // which is walk, and which clips must have their root motion locked. It
      // never rejects — a missing sidecar resolves to the empty default, which
      // simply means "this asset animates nothing".
      pending = Promise.all([
        this.loader.loadAsync(projectFileUrl(path)),
        loadAssetSkeleton(path),
      ]).then(([gltf, skeleton]) => ({ scene: gltf.scene, animations: gltf.animations, skeleton }));
      this.templateLoads.set(assetId, pending);
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

function disposeTemplate(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

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
import { Box3, Group, Mesh, type DirectionalLight, type Material, type Object3D, type Texture, type WebGLRenderer } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { InstancedMesh } from "three";

import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import type { LightObjectRecord } from "@engine/render-three/lights";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { RoomLayout } from "@engine/scene/layout";
import {
  buildSceneInstancedModel,
  buildSceneLightObject,
  computeModelLocalBounds,
  computeSceneRoomBounds,
  fitDirectionalShadowToBounds,
  registerSceneShapeModels,
  resolveSceneWorldSettings,
  sceneModelAssetIds,
} from "./SceneRuntimeCore";

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
   * Bounds a directional light's shadow frustum is fitted to. A large top-down
   * world (the RTS field is ~140 units wide) needs a far wider ortho frustum than
   * the per-light default; without this the shadow only renders near the origin.
   * Omitted falls back to the mounted instances' bounds.
   */
  readonly shadowBounds?: Box3;
  /** Optional sink for non-fatal load diagnostics (a missing optional model). */
  readonly onWarn?: (message: string, error?: unknown) => void;
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
async function loadModelManifest(resolveUrl: (path: string) => string): Promise<Map<string, ManifestModelEntry>> {
  const response = await fetch(resolveUrl("assets/manifest.json"), { cache: "no-cache" });
  if (!response.ok) throw new Error(`Authored-world manifest fetch failed: ${response.status}`);
  const manifest = await response.json() as { assets?: unknown };
  if (!Array.isArray(manifest.assets)) throw new Error("Authored-world manifest has no assets array");
  const models = new Map<string, ManifestModelEntry>();
  for (const value of manifest.assets) {
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

  const manifest = await loadModelManifest(resolveUrl);
  const models = new Map<string, GLTF>();
  await Promise.all(sceneModelAssetIds(layout).map(async (assetId) => {
    const entry = manifest.get(assetId);
    if (!entry) {
      warn(`Authored-world asset is not in the manifest: ${assetId}`);
      return;
    }
    try {
      models.set(assetId, await loader.loadAsync(resolveUrl(entry.path)));
    } catch (error) {
      warn(`Authored-world model failed to load: ${assetId}`, error);
    }
  }));

  const localBounds = new Map(computeModelLocalBounds(models));
  // Register procedural `shape:<type>` primitives so a shape instance mounts like
  // any other, instead of throwing on the synthetic (unmanifested) asset id.
  registerSceneShapeModels(layout, models, localBounds);

  const root = new Group();
  root.name = "authored-world";
  const instancedMeshes: InstancedMesh[] = [];
  for (const instance of layout.instances) {
    if (instance.placements.length === 0) continue;
    const gltf = models.get(instance.assetId);
    if (!gltf) continue; // missing model already warned; keep the rest of the world
    const built = buildSceneInstancedModel({
      assetId: instance.assetId,
      gltf,
      placements: instance.placements,
      castShadow: settings.staticObjectsCastShadow,
      receiveShadow: settings.staticObjectsReceiveShadow,
    });
    root.add(built.group);
    instancedMeshes.push(...built.meshes);
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
    // The loaded glTF templates are not children of `root` (the instanced meshes
    // reference their geometry), so free them explicitly too — dispose is
    // idempotent, so any geometry shared with an instanced mesh is safe to repeat.
    for (const gltf of models.values()) collect(gltf.scene);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const record of lightRecords) {
      const light = record.light as { dispose?: () => void };
      light.dispose?.();
    }
    models.clear();
  };

  return { root, navigationBlockers: [], directionalLights, dispose };
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

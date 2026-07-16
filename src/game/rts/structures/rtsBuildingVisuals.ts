/**
 * First Age visual library for the RTS building contracts.
 *
 * Gameplay continues to own footprints, navigation blockers and construction;
 * this module only replaces their temporary box meshes once the corresponding
 * glTF is ready. Models are shared templates and every placed structure gets a
 * clone, so the same building can appear many times without repeated requests.
 */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";

import type { CommandCenter } from "./commandCenter";
import type { PlacedStructure } from "./placedStructureSystem";

type VisualBuildingId = "command_center_t1" | "command_center_t2" | "house" | "depot" | "outpost" | "farm" | "lumber_camp" | "barracks_t1" | "barracks_t2";

interface BuildingVisualDefinition {
  readonly path: string;
}

const STATIC_MESH_ROOT = "/assets/ThreeAges/StaticMeshes";

/**
 * `lumber_camp` has no dedicated source mesh in this pack yet. Storage is a
 * readable temporary stand-in until a woodcutter model is added to the set.
 */
const VISUALS: Record<VisualBuildingId, BuildingVisualDefinition> = {
  command_center_t1: { path: `${STATIC_MESH_ROOT}/TownCenter_FirstAge_Level1.gltf` },
  command_center_t2: { path: `${STATIC_MESH_ROOT}/TownCenter_FirstAge_Level2.gltf` },
  house: { path: `${STATIC_MESH_ROOT}/Houses_FirstAge_1_Level1.gltf` },
  depot: { path: `${STATIC_MESH_ROOT}/Storage_FirstAge_Level1.gltf` },
  outpost: { path: `${STATIC_MESH_ROOT}/WatchTower_FirstAge_Level1.gltf` },
  farm: { path: `${STATIC_MESH_ROOT}/Farm_FirstAge_Level1_Wheat.gltf` },
  lumber_camp: { path: `${STATIC_MESH_ROOT}/Storage_FirstAge_Level1.gltf` },
  barracks_t1: { path: `${STATIC_MESH_ROOT}/Barracks_FirstAge_Level1.gltf` },
  barracks_t2: { path: `${STATIC_MESH_ROOT}/Barracks_FirstAge_Level2.gltf` },
};

const FOUNDATION_TOP = 0.18;
const MODEL_FOOTPRINT_FILL = 0.86;

export class RtsBuildingVisuals {
  private readonly loader;
  private readonly templates = new Map<VisualBuildingId, Object3D>();
  private loaded = false;

  constructor(renderer: WebGLRenderer) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async load(): Promise<void> {
    const entries = await Promise.all((Object.entries(VISUALS) as [VisualBuildingId, BuildingVisualDefinition][])
      .map(async ([id, definition]) => [id, (await this.loader.loadAsync(definition.path)).scene] as const));
    for (const [id, scene] of entries) this.templates.set(id, scene);
    this.loaded = true;
  }

  applyToCenter(center: CommandCenter): void {
    const visual = this.create(center.level >= 2 ? "command_center_t2" : "command_center_t1", 8, 8);
    if (visual) center.setVisual(visual);
  }

  createForStructure(structure: PlacedStructure): Group | null {
    if (!structure.construction.complete) return null;
    const id = structure.stats.id === "barracks"
      ? (structure.level >= 2 ? "barracks_t2" : "barracks_t1")
      : structure.stats.id as Exclude<VisualBuildingId, "command_center_t1" | "command_center_t2" | "barracks_t1" | "barracks_t2">;
    return this.create(
      id,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
    );
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
    this.loaded = false;
  }

  private create(id: VisualBuildingId, footprintWidth: number, footprintDepth: number): Group | null {
    if (!this.loaded) return null;
    const template = this.templates.get(id);
    if (!template) return null;

    const visual = new Group();
    visual.name = "rts-complete-building-model";
    visual.userData.rtsSharedModel = true;
    const model = template.clone(true);
    visual.add(model);
    fitModelToFootprint(model, footprintWidth, footprintDepth);
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return visual;
  }
}

/** Preserve each author's proportions while fitting safely inside gameplay's footprint. */
function fitModelToFootprint(model: Object3D, footprintWidth: number, footprintDepth: number): void {
  const sourceBounds = new Box3().setFromObject(model);
  const sourceWidth = sourceBounds.max.x - sourceBounds.min.x;
  const sourceDepth = sourceBounds.max.z - sourceBounds.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return;

  const scale = Math.min(footprintWidth / sourceWidth, footprintDepth / sourceDepth) * MODEL_FOOTPRINT_FILL;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const fittedBounds = new Box3().setFromObject(model);
  model.position.y += FOUNDATION_TOP - fittedBounds.min.y;
}

function disposeModel(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

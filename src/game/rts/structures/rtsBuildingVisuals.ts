/**
 * Visual library for the RTS building contracts.
 *
 * Gameplay continues to own footprints, navigation blockers and construction;
 * this module only replaces their temporary box meshes once the corresponding
 * glTF is ready. Models are shared templates keyed by mesh path and every placed
 * structure gets a clone, so the same building can appear many times without
 * repeated requests. The gameplay-to-path mapping lives in {@link rtsBuildingArt}
 * so it stays Three.js-free and testable; callers pass the owner's
 * {@link SettlementAge} to pick the art family (defaulting to Settlement/First
 * Age, which preserves the pre-age-split behaviour of every current call site).
 */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";

import type { SettlementAge } from "../../data/gameDataTypes";
import type { CommandCenter } from "./commandCenter";
import type { PlacedStructure } from "./placedStructureSystem";
import { allBuildingMeshPaths, buildingMeshPath } from "./rtsBuildingArt";

const FOUNDATION_TOP = 0.18;
const MODEL_FOOTPRINT_FILL = 0.86;

export class RtsBuildingVisuals {
  private readonly loader;
  private readonly templates = new Map<string, Object3D>();
  private loaded = false;

  constructor(renderer: WebGLRenderer) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async load(): Promise<void> {
    const entries = await Promise.all(allBuildingMeshPaths()
      .map(async (path) => [path, (await this.loader.loadAsync(path)).scene] as const));
    for (const [path, scene] of entries) this.templates.set(path, scene);
    this.loaded = true;
  }

  applyToCenter(center: CommandCenter, age: SettlementAge = "settlement"): void {
    const path = buildingMeshPath("command_center", age, center.level);
    const visual = path ? this.create(path, 8, 8) : null;
    if (visual) center.setVisual(visual);
  }

  createForStructure(structure: PlacedStructure, age: SettlementAge = "settlement"): Group | null {
    const path = visualMeshPathForStructure(structure, age);
    if (!path) return null;
    return this.create(
      path,
      structure.stats.footprint.width,
      structure.stats.footprint.depth,
    );
  }

  createPreviewForBuilding(
    buildingId: string,
    footprintWidth: number,
    footprintDepth: number,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    const path = buildingMeshPath(buildingId, age, level);
    return path ? this.create(path, footprintWidth, footprintDepth) : null;
  }

  createConstructionVisual(
    structure: Pick<PlacedStructure, "stats">,
    age: SettlementAge = "settlement",
    level = 1,
  ): Group | null {
    const path = buildingMeshPath(structure.stats.id, age, level);
    return path ? this.create(path, structure.stats.footprint.width, structure.stats.footprint.depth) : null;
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
    this.loaded = false;
  }

  private create(path: string, footprintWidth: number, footprintDepth: number): Group | null {
    if (!this.loaded) return null;
    const template = this.templates.get(path);
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

/**
 * Mesh path for a structure's current model, or `null` while its foundation is
 * still under construction (the caller keeps the construction placeholder). A
 * completed structure with no mapped art also returns `null`.
 */
export function visualMeshPathForStructure(
  structure: Pick<PlacedStructure, "stats" | "level" | "construction">,
  age: SettlementAge = "settlement",
): string | null {
  if (!structure.construction.complete) return null;
  return buildingMeshPath(structure.stats.id, age, structure.level);
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

/** First Age art pass for the RTS blockout's central ridge and resource landmark. */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";

import type { RtsMapBlockout } from "./rtsMapBlockout";

const STATIC_MESH_ROOT = "/assets/ThreeAges/StaticMeshes";

const MODELS = {
  ridge: `${STATIC_MESH_ROOT}/Mountain_Group_1.gltf`,
  ridgeRock: `${STATIC_MESH_ROOT}/Rock_Group.gltf`,
  trees: `${STATIC_MESH_ROOT}/Resource_PineTree_Group.gltf`,
  gold: `${STATIC_MESH_ROOT}/Resource_Gold_2.gltf`,
  stone: `${STATIC_MESH_ROOT}/Resource_Rock_2.gltf`,
} as const;

type MapModelId = keyof typeof MODELS;

/** Loads once, then decorates the authored gameplay map without changing its rules. */
export class RtsMapArt {
  private readonly loader;
  private readonly templates = new Map<MapModelId, Object3D>();

  constructor(renderer: WebGLRenderer) {
    this.loader = createForgeGltfLoader(renderer);
  }

  async apply(root: Group, map: RtsMapBlockout): Promise<void> {
    const entries = await Promise.all((Object.entries(MODELS) as [MapModelId, string][])
      .map(async ([id, path]) => [id, (await this.loader.loadAsync(path)).scene] as const));
    for (const [id, scene] of entries) this.templates.set(id, scene);

    this.replaceRidgePlaceholder(root);
    root.add(this.createRidge());
    root.add(this.createExternalResources(map));
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
  }

  private replaceRidgePlaceholder(root: Group): void {
    const placeholder = root.getObjectByName("rts-central-ridge");
    if (!placeholder) return;
    root.remove(placeholder);
    disposeModel(placeholder);
  }

  private createRidge(): Group {
    const ridge = new Group();
    ridge.name = "rts-central-ridge-art";
    ridge.add(this.model("ridge", 0, 0, 22, 7));
    ridge.add(this.model("ridgeRock", -7.2, 0.1, 7, 4));
    ridge.add(this.model("ridgeRock", 7.4, -0.2, 7, 4));
    return ridge;
  }

  private createExternalResources(map: RtsMapBlockout): Group {
    const resources = new Group();
    resources.name = "rts-external-resource-art";
    resources.position.set(map.externalResource.x, 0, map.externalResource.z);
    resources.add(this.model("trees", -1.3, 0.2, 6.5, 6));
    resources.add(this.model("gold", 2.7, 1.6, 2.3, 2.3));
    resources.add(this.model("stone", 2.5, -1.9, 2.8, 2.8));
    return resources;
  }

  private model(id: MapModelId, x: number, z: number, width: number, depth: number): Group {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Missing loaded RTS map model "${id}"`);
    const root = new Group();
    root.name = `rts-map-model-${id}`;
    const model = template.clone(true);
    root.add(model);
    fitModel(model, width, depth);
    root.position.set(x, 0, z);
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return root;
  }
}

function fitModel(model: Object3D, width: number, depth: number): void {
  const source = new Box3().setFromObject(model);
  const sourceWidth = source.max.x - source.min.x;
  const sourceDepth = source.max.z - source.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return;
  model.scale.setScalar(Math.min(width / sourceWidth, depth / sourceDepth));
  model.updateMatrixWorld(true);
  const fitted = new Box3().setFromObject(model);
  model.position.y -= fitted.min.y;
}

function disposeModel(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

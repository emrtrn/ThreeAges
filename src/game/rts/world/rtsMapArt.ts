/** First Age art pass for the RTS blockout's central ridge and resource landmark. */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";

import type { RtsMapBlockout } from "./rtsMapBlockout";
import type { ForestSystem } from "../economy/forestSystem";

const STATIC_MESH_ROOT = "/assets/ThreeAges/StaticMeshes";

const MODELS = {
  ridge: `${STATIC_MESH_ROOT}/Mountain_Group_1.gltf`,
  ridgeRock: `${STATIC_MESH_ROOT}/Rock_Group.gltf`,
  treePine: `${STATIC_MESH_ROOT}/Resource_PineTree.gltf`,
  tree1: `${STATIC_MESH_ROOT}/Resource_Tree1.gltf`,
  tree2: `${STATIC_MESH_ROOT}/Resource_Tree2.gltf`,
  gold: `${STATIC_MESH_ROOT}/Resource_Gold_2.gltf`,
  stone: `${STATIC_MESH_ROOT}/Resource_Rock_2.gltf`,
} as const;

type MapModelId = keyof typeof MODELS;

/** Loads once, then decorates the authored gameplay map without changing its rules. */
export class RtsMapArt {
  private readonly loader;
  private readonly templates = new Map<MapModelId, Object3D>();
  private readonly treeObjects = new Map<string, Group>();

  constructor(renderer: WebGLRenderer) {
    this.loader = createForgeGltfLoader(renderer);
  }

  /**
   * @param options.includeRidge Faz E ridge gate. Default true keeps the legacy
   *   fitted ridge art. When the Level authors its own static world the ridge is
   *   mounted from there instead, so this is passed false — the placeholder box is
   *   left in place for the loader to remove on success (a fallback if it fails),
   *   and the forest + external-resource landmark still come from here.
   */
  async apply(
    root: Group,
    map: RtsMapBlockout,
    forests: ForestSystem,
    options: { includeRidge?: boolean } = {},
  ): Promise<void> {
    const includeRidge = options.includeRidge ?? true;
    const modelIds = includeRidge
      ? (Object.keys(MODELS) as MapModelId[])
      : (Object.keys(MODELS) as MapModelId[]).filter((id) => id !== "ridge" && id !== "ridgeRock");
    const entries = await Promise.all(modelIds
      .map(async (id) => [id, (await this.loader.loadAsync(MODELS[id])).scene] as const));
    for (const [id, scene] of entries) this.templates.set(id, scene);

    if (includeRidge) {
      this.replaceRidgePlaceholder(root);
      root.add(this.createRidge());
    }
    root.add(this.createExternalResources(map));
    root.add(this.createForest(forests));
  }

  /** Presentation follows the authoritative source state; no visual owns depletion. */
  /**
   * @param isRevealed §59: whether the observing kingdom has scouted a point.
   *   Omitted (the `fogOfWar` flag off) leaves every standing tree visible.
   *
   * The fog test lives *here*, inside the one loop that already owns
   * `tree.visible`, rather than in `FogVisibilityBinder` beside the other hidden
   * world props. A second writer would fight this one every tick and the trees
   * would flicker at whichever rate the two ran at. One writer, both reasons a
   * tree can be invisible — depleted, or never scouted.
   *
   * Keyed off `isExplored` rather than `isVisible`, matching the resource
   * deposits: GDD 08 §40 keeps permanent natural elements on the map once seen.
   * A forest you walked through does not vanish when the scout leaves.
   */
  syncForest(forests: ForestSystem, isRevealed?: (x: number, z: number) => boolean): void {
    for (const tree of forests.snapshots()) {
      const object = this.treeObjects.get(tree.id);
      if (!object) continue;
      object.visible = isTreeVisible(tree, isRevealed);
    }
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
    this.treeObjects.clear();
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
    resources.add(this.model("gold", 2.7, 1.6, 2.3, 2.3));
    resources.add(this.model("stone", 2.5, -1.9, 2.8, 2.8));
    return resources;
  }

  private createForest(forests: ForestSystem): Group {
    const root = new Group();
    root.name = "rts-individual-tree-art";
    for (const tree of forests.snapshots()) {
      const modelId: MapModelId = tree.variant === "pine" ? "treePine" : tree.variant;
      const object = this.model(modelId, tree.x, tree.z, 1.55, 1.55);
      object.name = `rts-tree-${tree.id}`;
      object.visible = !tree.depleted;
      object.userData.treeId = tree.id;
      this.treeObjects.set(tree.id, object);
      root.add(object);
    }
    return root;
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

/**
 * The map-art subtrees §59 hides until their ground has been scouted.
 *
 * GDD 08 §39 names *resources* and *strategic detail* as what unknown ground
 * must not reveal, and §40 allows terrain form to stay readable — so this
 * returns the resource deposits and the central ridge, whole groups at a time,
 * keyed off each group's own world position.
 *
 * Trees are excluded here but *are* hidden under fog — they go through
 * {@link RtsMapArt.syncForest} instead, because that loop already owns
 * `tree.visible` for depletion and two writers would flicker against each other.
 * Same rule, different owner.
 */
export function collectWorldProps(blockout: Group): Object3D[] {
  const props: Object3D[] = [];
  for (const name of ["rts-external-resource-art", "rts-central-ridge-art"]) {
    const group = blockout.getObjectByName(name);
    if (group) props.push(group);
  }
  return props;
}

/**
 * Whether one tree is drawn — the whole of §59's forest rule, extracted so it
 * can be tested for real.
 *
 * {@link RtsMapArt} needs a WebGLRenderer to construct, so a test driving
 * `syncForest` directly would need a GL context; a test that re-implemented the
 * condition instead would pass happily while the shipped rule rotted. Keeping
 * the decision here means `syncForest` is a loop over this, and this is what
 * `test:engine` exercises.
 */
export function isTreeVisible(
  tree: { readonly x: number; readonly z: number; readonly depleted: boolean },
  isRevealed?: (x: number, z: number) => boolean,
): boolean {
  if (tree.depleted) return false;
  // No predicate = the `fogOfWar` flag is off; every standing tree is drawn.
  return !isRevealed || isRevealed(tree.x, tree.z);
}

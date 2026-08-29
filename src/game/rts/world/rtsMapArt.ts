/** First Age art pass for the RTS blockout's central ridge and resource landmark. */
import { Box3, Group, Mesh, type Object3D, type WebGLRenderer } from "three";
import { createForgeGltfLoader } from "@engine/render-three/gltfLoader";
import { publicUrl } from "@engine/assets/publicUrl";

import type { ForestSystem } from "../economy/forestSystem";
import type { ResourceNodeSnapshot, ResourceNodeSystem } from "../economy/resourceNodeSystem";

const STATIC_MESH_ROOT = "/assets/ThreeAges/StaticMeshes";

const MODELS = {
  ridgeRock: `${STATIC_MESH_ROOT}/Rock_Group.gltf`,
  treePine: `${STATIC_MESH_ROOT}/Resource_PineTree.glb`,
  tree1: `${STATIC_MESH_ROOT}/Resource_Tree1.glb`,
  tree2: `${STATIC_MESH_ROOT}/Resource_Tree2.glb`,
  gold1: `${STATIC_MESH_ROOT}/Resource_Gold_1.gltf`,
  gold2: `${STATIC_MESH_ROOT}/Resource_Gold_2.gltf`,
  gold3: `${STATIC_MESH_ROOT}/Resource_Gold_3.gltf`,
  stone1: `${STATIC_MESH_ROOT}/Resource_Rock_1.gltf`,
  stone2: `${STATIC_MESH_ROOT}/Resource_Rock_2.gltf`,
  stone3: `${STATIC_MESH_ROOT}/Resource_Rock_3.gltf`,
} as const;

type MapModelId = keyof typeof MODELS;

/**
 * The landmark stages of each resource, ordered full -> nearly spent. Adding a
 * resource to `resources.json` without an entry here leaves that deposit
 * unmodelled rather than breaking the map art.
 */
const RESOURCE_MODELS: Readonly<Record<string, readonly MapModelId[] | undefined>> = {
  gold: ["gold1", "gold2", "gold3"],
  stone: ["stone1", "stone2", "stone3"],
};

/**
 * Remaining-fraction thresholds the deposit stages switch at: above 0.6 the
 * full mesh, down to 0.3 the middle one, below that the picked-over one. A
 * deposit reading as "nearly gone" before a worker even gets there would lie,
 * so these are boundaries on the *remaining* share, not on elapsed time.
 */
const RESOURCE_NODE_STAGE_THRESHOLDS = [0.6, 0.3] as const;

/** Footprint the deposit meshes are fitted to, in world units. */
const SAFE_NODE_SIZE = 2.3;
const EXTERNAL_NODE_SIZE = 2.8;

/** Loads once, then decorates the authored gameplay map without changing its rules. */
export class RtsMapArt {
  private readonly loader;
  private readonly templates = new Map<MapModelId, Object3D>();
  private readonly treeObjects = new Map<string, Group>();
  private readonly nodeObjects = new Map<string, Group>();

  constructor(renderer: WebGLRenderer) {
    this.loader = createForgeGltfLoader(renderer);
  }

  /**
   * @param options.includeRidge Faz E ridge gate. Default true keeps the legacy
   *   fitted ridge art. When the Level authors its own static world the ridge is
   *   mounted from there instead, so this is passed false — the placeholder box is
   *   left in place for the loader to remove on success (a fallback if it fails),
   *   and the forest + resource deposits still come from here.
   */
  async apply(
    root: Group,
    forests: ForestSystem,
    nodes: ResourceNodeSystem,
    options: { includeRidge?: boolean } = {},
  ): Promise<void> {
    const includeRidge = options.includeRidge ?? true;
    const modelIds = includeRidge
      ? (Object.keys(MODELS) as MapModelId[])
      : (Object.keys(MODELS) as MapModelId[]).filter((id) => id !== "ridgeRock");
    const entries = await Promise.all(modelIds
      // `publicUrl` because MODELS holds authored project paths, not deploy URLs:
      // a packaged build is served from a subpath where the leading slash points
      // past the game (see engine/assets/publicUrl.ts).
      .map(async (id) => [id, (await this.loader.loadAsync(publicUrl(MODELS[id]))).scene] as const));
    for (const [id, scene] of entries) this.templates.set(id, scene);

    if (includeRidge) root.add(this.createRidge());
    root.add(this.createResourceNodes(nodes));
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

  /**
   * The deposit half of {@link syncForest}, and for the same reason: now that a
   * deposit is one object per node, its two reasons to be invisible — depleted,
   * or never scouted — have to be decided by a single writer. The group-level
   * fog pass in {@link collectWorldProps} no longer covers deposits, so each one
   * is fogged by its own position instead of the whole cluster's.
   */
  syncResourceNodes(nodes: ResourceNodeSystem, isRevealed?: (x: number, z: number) => boolean): void {
    for (const node of nodes.snapshots()) {
      const object = this.nodeObjects.get(node.id);
      if (!object) continue;
      this.applyResourceNodeStage(object, node);
      object.visible = isResourceNodeVisible(node, isRevealed);
    }
  }

  dispose(): void {
    for (const template of this.templates.values()) disposeModel(template);
    this.templates.clear();
    this.treeObjects.clear();
    this.nodeObjects.clear();
  }

  /**
   * The legacy ridge: the blockout's own box plus two rock groups dressing its
   * flanks.
   *
   * It used to fit a mountain model over the box and delete the box underneath
   * it. That model is no longer shipped, and because every template here is
   * awaited together, one missing file took the forest and the deposits down
   * with it. So the box stays — it is already sized from the same
   * `navigationBlockers` entry the ridge blocks with, which makes it the one
   * ridge visual that cannot disagree with where units may walk — and the rocks
   * still break up its silhouette. The authored Level mounts its own ridge and
   * never reaches this path.
   */
  private createRidge(): Group {
    const ridge = new Group();
    ridge.name = "rts-central-ridge-art";
    ridge.add(this.model("ridgeRock", -7.2, 0.1, 7, 4));
    ridge.add(this.model("ridgeRock", 7.4, -0.2, 7, 4));
    return ridge;
  }

  /**
   * One deposit mesh per authored resource node, exactly as {@link createForest}
   * does for trees.
   *
   * This replaces a hard-coded pair of meshes parked on the blockout's single
   * `externalResource` point, which had no relationship to the Level's actual
   * nodes: every deposit had to be decorated by hand, and the hand-placed rock
   * stayed sitting there after the mine underneath it ran dry. Now the art is a
   * projection of the same authoritative state the extraction rule reads, so a
   * dropped `BP_RTS_ResourceNode` marker is all a deposit needs.
   */
  private createResourceNodes(nodes: ResourceNodeSystem): Group {
    const root = new Group();
    root.name = "rts-resource-node-art";
    for (const node of nodes.snapshots()) {
      const stages = RESOURCE_MODELS[node.resourceId];
      // An unmodelled resource is a data question, not a crash: the deposit still
      // works, it just has no landmark until a mesh is mapped for it.
      if (!stages || stages.length === 0) continue;
      const size = node.kind === "external" ? EXTERNAL_NODE_SIZE : SAFE_NODE_SIZE;
      const object = new Group();
      object.name = `rts-resource-node-${node.id}`;
      object.userData.resourceNodeId = node.id;
      // Every stage is built once and toggled, rather than cloned and disposed on
      // each threshold crossing: a mesh swap must not allocate mid-match, and the
      // three stages together are a handful of objects per deposit. Only the full
      // stage is fitted to the footprint; the rest share its scalar so a spent
      // deposit stays visibly smaller than a full one.
      const full = this.model(stages[0]!, node.x, node.z, size, size);
      const scale = typeof full.userData.fitScale === "number" ? full.userData.fitScale : undefined;
      object.add(full);
      for (const modelId of stages.slice(1)) {
        object.add(this.model(modelId, node.x, node.z, size, size, true, scale));
      }
      this.nodeObjects.set(node.id, object);
      this.applyResourceNodeStage(object, node);
      object.visible = !node.depleted;
      root.add(object);
    }
    return root;
  }

  /** Shows only the stage mesh matching how much of the deposit is left. */
  private applyResourceNodeStage(object: Group, node: ResourceNodeSnapshot): void {
    const stage = resourceNodeStageIndex(node.remaining, node.capacity, object.children.length);
    object.children.forEach((child, index) => {
      child.visible = index === stage;
    });
  }

  private createForest(forests: ForestSystem): Group {
    const root = new Group();
    root.name = "rts-individual-tree-art";
    for (const tree of forests.snapshots()) {
      const modelId: MapModelId = tree.variant === "pine" ? "treePine" : tree.variant;
      // A forest can contribute dozens of repeated meshes to every directional
      // shadow pass. Its tiny moving-detail shadows are not readable at the RTS
      // camera distance, while buildings, ridge and resources remain casters.
      const object = this.model(modelId, tree.x, tree.z, 1.55, 1.55, false);
      object.name = `rts-tree-${tree.id}`;
      object.visible = !tree.depleted;
      object.userData.treeId = tree.id;
      this.treeObjects.set(tree.id, object);
      root.add(object);
    }
    return root;
  }

  /**
   * @param fixedScale Skips the fit and uses this scalar instead. The deposit
   *   stages need it: fitting each stage to the same footprint would inflate the
   *   picked-over mesh back to the full one's size, erasing the very shrink the
   *   stage exists to show. One scalar, taken from the full stage, keeps their
   *   authored size relationship intact.
   */
  private model(
    id: MapModelId,
    x: number,
    z: number,
    width: number,
    depth: number,
    castShadow = true,
    fixedScale?: number,
  ): Group {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Missing loaded RTS map model "${id}"`);
    const root = new Group();
    root.name = `rts-map-model-${id}`;
    const model = template.clone(true);
    root.add(model);
    if (fixedScale !== undefined) scaleModel(model, fixedScale);
    else root.userData.fitScale = fitModel(model, width, depth);
    root.position.set(x, 0, z);
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = castShadow;
      child.receiveShadow = true;
    });
    return root;
  }
}

/** Fits the model into the footprint and returns the scalar it settled on. */
function fitModel(model: Object3D, width: number, depth: number): number {
  const source = new Box3().setFromObject(model);
  const sourceWidth = source.max.x - source.min.x;
  const sourceDepth = source.max.z - source.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return 1;
  const scale = Math.min(width / sourceWidth, depth / sourceDepth);
  scaleModel(model, scale);
  return scale;
}

/** Applies a known scalar and re-seats the model on the ground plane. */
function scaleModel(model: Object3D, scale: number): void {
  model.scale.setScalar(scale);
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
 * returns the central ridge, as a whole group keyed off its own world position.
 *
 * Trees and resource deposits are excluded here but *are* hidden under fog —
 * they go through {@link RtsMapArt.syncForest} /
 * {@link RtsMapArt.syncResourceNodes} instead, because those loops already own
 * `visible` for depletion and two writers would flicker against each other.
 * Same rule, different owner.
 */
export function collectWorldProps(blockout: Group): Object3D[] {
  const props: Object3D[] = [];
  for (const name of ["rts-central-ridge-art"]) {
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

/**
 * Whether one deposit is drawn — {@link isTreeVisible}'s rule for resource
 * nodes, extracted for the same reason: `RtsMapArt` needs a WebGLRenderer, so
 * this is the part `test:engine` can actually drive.
 *
 * A depleted deposit stops being drawn, matching
 * {@link ResourceNodeSystem.liveNodeBlockers}: once there is nothing left to
 * extract the ground goes back to being ordinary ground. Fog is keyed off
 * *explored*, not currently visible — GDD 08 §40 keeps a permanent natural
 * element on the map once it has been seen.
 */
/**
 * Which stage mesh a deposit shows, as an index into its full -> spent list.
 *
 * The deposit's own remaining share is the only input: a mine the player has
 * barely touched must not look picked over, and one that is nearly out must
 * read that way before it vanishes. `capacity` comes straight from the balance
 * table, so the thresholds hold at any tuning of `resources.json`.
 *
 * Stages beyond the declared thresholds clamp to the last mesh rather than
 * falling off the end, so mapping a fourth stage in is a data change, not a
 * crash. A depleted deposit still resolves to the last stage — it is
 * {@link isResourceNodeVisible} that stops drawing it at all.
 */
export function resourceNodeStageIndex(
  remaining: number,
  capacity: number,
  stageCount: number,
): number {
  if (stageCount <= 1) return 0;
  const last = stageCount - 1;
  // A zero/invalid capacity cannot yield a meaningful share; treat the deposit
  // as spent rather than dividing by it.
  if (!Number.isFinite(capacity) || capacity <= 0) return last;
  const share = Math.max(0, remaining) / capacity;
  const thresholds = RESOURCE_NODE_STAGE_THRESHOLDS.slice(0, last);
  for (const [index, threshold] of thresholds.entries()) {
    if (share > threshold) return index;
  }
  return Math.min(RESOURCE_NODE_STAGE_THRESHOLDS.length, last);
}

export function isResourceNodeVisible(
  node: { readonly x: number; readonly z: number; readonly depleted: boolean },
  isRevealed?: (x: number, z: number) => boolean,
): boolean {
  if (node.depleted) return false;
  return !isRevealed || isRevealed(node.x, node.z);
}

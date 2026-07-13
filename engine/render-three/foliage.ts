import {
  Box3,
  BoxGeometry,
  type BufferGeometry,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Vec3 } from "@engine/scene/layout";
import type {
  FoliageGroupRenderStat,
  ForgeFoliageTypeDef,
  LayoutFoliageData,
  LayoutFoliageGroup,
  LayoutFoliageInstance,
} from "@engine/scene/foliage";
import type { FoliageInstanceRoll } from "@engine/scene/foliagePaint";
import { composeTransformMatrix } from "./transforms";
import { createInstancedModelGroup, type InstanceRenderItem } from "./models";

const WORLD_UP = new Vector3(0, 1, 0);

/** Triangle count of one geometry (indexed or not); 0 when it has no positions. */
export function geometryTriangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute("position");
  return position ? Math.floor(position.count / 3) : 0;
}

/**
 * Resolves a paint roll ({@link FoliageInstanceRoll}) into a saved
 * {@link LayoutFoliageInstance}: applies normal-alignment (quaternion tilt of the
 * mesh up axis to the hit normal) + yaw + z-offset, and bakes the result to an
 * Euler-degrees rotation the sidecar stores and the InstancedMesh builder composes.
 * Kept in the render layer because it depends on three's quaternion math.
 */
export function foliageInstanceFromRoll(
  type: ForgeFoliageTypeDef,
  roll: FoliageInstanceRoll,
): LayoutFoliageInstance {
  const up = type.alignToNormal
    ? new Vector3(roll.normal[0], roll.normal[1], roll.normal[2])
    : new Vector3(0, 1, 0);
  if (up.lengthSq() < 1e-8) up.copy(WORLD_UP);
  else up.normalize();
  const align = new Quaternion().setFromUnitVectors(WORLD_UP, up);
  const yaw = new Quaternion().setFromAxisAngle(WORLD_UP, MathUtils.degToRad(roll.yawDeg));
  // Yaw about the (possibly tilted) local up: align first, then spin around it.
  const orientation = align.multiply(yaw);
  const euler = new Euler().setFromQuaternion(orientation, "XYZ");
  const position = new Vector3(roll.position[0], roll.position[1], roll.position[2]).addScaledVector(
    up,
    roll.zOffset,
  );
  const instance: LayoutFoliageInstance = {
    position: [position.x, position.y, position.z] as Vec3,
    rotation: [MathUtils.radToDeg(euler.x), MathUtils.radToDeg(euler.y), MathUtils.radToDeg(euler.z)] as Vec3,
    scale: [...roll.scale] as Vec3,
    normal: [...roll.normal] as Vec3,
    seed: roll.seed,
  };
  return instance;
}

/** A resolved surface point for reattach/snap: world position + unit normal. */
export interface FoliageReattachSurface {
  position: Vec3;
  normal: Vec3;
}

function normalOrUp(normal: Vec3 | undefined): Vector3 {
  const v = normal ? new Vector3(normal[0], normal[1], normal[2]) : WORLD_UP.clone();
  if (v.lengthSq() < 1e-8) return WORLD_UP.clone();
  return v.normalize();
}

/**
 * Reattach/snap: moves an instance onto a freshly-sampled surface point, preserving
 * its scale and yaw. When the type aligns to the surface normal, the tilt is
 * re-derived from the delta between the old and new normals (so painted yaw is kept
 * while the instance re-seats flush to the new ground); otherwise only the position
 * moves. Lives in the render layer because it depends on three's quaternion math.
 */
export function reattachFoliageInstance(
  instance: LayoutFoliageInstance,
  type: ForgeFoliageTypeDef,
  surface: FoliageReattachSurface,
): LayoutFoliageInstance {
  const next: LayoutFoliageInstance = {
    position: [...surface.position] as Vec3,
    rotation: [...instance.rotation] as Vec3,
    scale: [...instance.scale] as Vec3,
  };
  if (instance.seed !== undefined) next.seed = instance.seed;
  if (type.alignToNormal) {
    const oldAlign = new Quaternion().setFromUnitVectors(WORLD_UP, normalOrUp(instance.normal));
    const newAlign = new Quaternion().setFromUnitVectors(WORLD_UP, normalOrUp(surface.normal));
    const delta = newAlign.multiply(oldAlign.invert());
    const oldEuler = new Euler(
      MathUtils.degToRad(instance.rotation[0]),
      MathUtils.degToRad(instance.rotation[1]),
      MathUtils.degToRad(instance.rotation[2]),
      "XYZ",
    );
    const oldQuat = new Quaternion().setFromEuler(oldEuler);
    const nextEuler = new Euler().setFromQuaternion(delta.multiply(oldQuat), "XYZ");
    next.rotation = [
      MathUtils.radToDeg(nextEuler.x),
      MathUtils.radToDeg(nextEuler.y),
      MathUtils.radToDeg(nextEuler.z),
    ] as Vec3;
    next.normal = [...surface.normal] as Vec3;
  } else if (instance.normal) {
    next.normal = [...instance.normal] as Vec3;
  }
  return next;
}

/**
 * Foliage render binding: turns the level foliage sidecar ({@link LayoutFoliageData})
 * into `InstancedMesh` batches, one per foliage group (Faz 1: no grid chunking —
 * each group is a single batch keyed by `foliageTypeId + meshAssetId`).
 *
 * Instances are stored in WORLD space in the sidecar, so the binding's root Group
 * lives directly under the scene (not parented to a target). Landscapes are static
 * origin singletons in Faz 1, so this keeps foliage decoupled from target
 * transforms; reattach/snap after a target moves is a Faz 2 concern.
 *
 * The host (SceneApp / RuntimeSceneApp) owns the type/model lookup and calls
 * {@link FoliageRenderBinding.rebuild} on load and {@link FoliageRenderBinding.rebuildGroup}
 * after a paint/erase dab so only the dirty batch is rebuilt.
 */
export interface FoliageRenderResolver {
  /** The resolved Foliage Type for a group, or null when its type asset is missing. */
  getType(foliageTypeId: string): ForgeFoliageTypeDef | null;
  /** The loaded model for a mesh asset id, or null when it is not loaded yet. */
  getModel(meshAssetId: string): GLTF | null;
  /**
   * Applies the asset's default material-slot overrides to its instanced sub-group
   * (foliage meshes share the raw GLTF material otherwise — see the landscape
   * spline mesh binding for the same hook).
   */
  applyMaterialSlots?(assetId: string, group: Group): void;
}

/** Composes the world-space instance matrices for one foliage group. */
export function foliageInstanceItems(group: LayoutFoliageGroup): InstanceRenderItem[] {
  return group.instances.map((instance) => ({
    matrix: composeTransformMatrix(instance.position, instance.rotation, instance.scale),
    hidden: false,
  }));
}

interface FoliageGroupObject {
  group: Group;
  meshes: InstancedMesh[];
}

/** One group's selected instance indices (Foliage Mode selection overlay input). */
export interface FoliageSelectionEntry {
  groupId: string;
  indices: readonly number[];
}

// Shared wireframe cage geometry/material for the selection overlay — a unit box
// re-sized per instance to the foliage mesh's bounding box. Depth-tested off so the
// cage reads through the foliage it wraps.
const SELECTION_BOX_GEOMETRY = new BoxGeometry(1, 1, 1);
const SELECTION_BOX_MATERIAL = new MeshBasicMaterial({
  color: 0xffcf40,
  wireframe: true,
  transparent: true,
  opacity: 0.9,
  depthTest: false,
});

function disposeGroupObject(object: FoliageGroupObject): void {
  object.group.removeFromParent();
  for (const mesh of object.meshes) mesh.dispose();
}

export class FoliageRenderBinding {
  /** Scene-space container; add this once to the scene root. */
  readonly root = new Group();
  private readonly objects = new Map<string, FoliageGroupObject>();
  /** Editor-only selection cage overlay (null when nothing is selected). */
  private selectionMesh: InstancedMesh | null = null;
  /** Foliage mesh bounding boxes, keyed by mesh asset id (selection cage sizing). */
  private readonly boxCache = new Map<string, Box3>();

  constructor() {
    this.root.name = "Foliage";
  }

  /** All InstancedMeshes currently drawn (for picking/statistics). */
  allMeshes(): InstancedMesh[] {
    const meshes: InstancedMesh[] = [];
    for (const object of this.objects.values()) meshes.push(...object.meshes);
    return meshes;
  }

  /**
   * Live render stat for one group's batch (triangles-per-instance + draw calls),
   * or null when the group has no built batch (mesh not loaded / no instances).
   * Feeds {@link computeFoliageResourceUsage} for the panel's resource readout.
   */
  groupRenderStat(groupId: string): FoliageGroupRenderStat | null {
    const object = this.objects.get(groupId);
    if (!object || object.meshes.length === 0) return null;
    let trianglesPerInstance = 0;
    for (const mesh of object.meshes) trianglesPerInstance += geometryTriangleCount(mesh.geometry);
    return { trianglesPerInstance, drawCalls: object.meshes.length };
  }

  /** Rebuilds every group from scratch (load, or a bulk change). */
  rebuild(data: LayoutFoliageData | null, resolver: FoliageRenderResolver): void {
    const wanted = new Set((data?.groups ?? []).map((group) => group.id));
    for (const id of [...this.objects.keys()]) {
      if (!wanted.has(id)) this.removeGroup(id);
    }
    for (const group of data?.groups ?? []) this.rebuildGroup(group, resolver);
  }

  /** Rebuilds a single group's batch in place (paint/erase/type-change dirty path). */
  rebuildGroup(group: LayoutFoliageGroup, resolver: FoliageRenderResolver): void {
    this.removeGroup(group.id);
    const type = resolver.getType(group.foliageTypeId);
    if (!type || !type.meshAssetId) return;
    const gltf = resolver.getModel(type.meshAssetId);
    if (!gltf) return;
    const items = foliageInstanceItems(group);
    if (items.length === 0) return;
    const built = createInstancedModelGroup({
      assetId: type.meshAssetId,
      gltf,
      items,
      castShadow: type.castShadow,
      receiveShadow: type.receiveShadow,
    });
    built.group.name = `foliage-${group.id}`;
    // Tag the batch so the editor picker can map an instance hit back to its group.
    built.group.userData.foliageGroupId = group.id;
    resolver.applyMaterialSlots?.(type.meshAssetId, built.group);
    this.root.add(built.group);
    this.objects.set(group.id, { group: built.group, meshes: built.meshes });
  }

  /** Removes and disposes a single group's batch, if present. */
  removeGroup(groupId: string): void {
    const existing = this.objects.get(groupId);
    if (!existing) return;
    disposeGroupObject(existing);
    this.objects.delete(groupId);
  }

  /**
   * Rebuilds the selection cage overlay: a wireframe box per selected instance,
   * sized to its foliage mesh's bounding box and placed at the instance transform.
   * Editor-only; the runtime never calls this.
   */
  setSelection(
    data: LayoutFoliageData | null,
    entries: readonly FoliageSelectionEntry[],
    resolver: FoliageRenderResolver,
  ): void {
    if (this.selectionMesh) {
      this.selectionMesh.removeFromParent();
      this.selectionMesh.dispose();
      this.selectionMesh = null;
    }
    if (!data || entries.length === 0) return;
    const groupsById = new Map(data.groups.map((group) => [group.id, group]));
    const matrices: Matrix4[] = [];
    const size = new Vector3();
    const center = new Vector3();
    const identity = new Quaternion();
    for (const entry of entries) {
      const group = groupsById.get(entry.groupId);
      if (!group) continue;
      const type = resolver.getType(group.foliageTypeId);
      if (!type) continue;
      const box = this.meshBox(type.meshAssetId, resolver);
      if (!box) continue;
      box.getSize(size);
      box.getCenter(center);
      // Pad flat axes so a plane/decal mesh still shows a visible cage.
      const local = new Matrix4().compose(
        center,
        identity,
        new Vector3(Math.max(size.x, 0.05), Math.max(size.y, 0.05), Math.max(size.z, 0.05)),
      );
      for (const index of entry.indices) {
        const instance = group.instances[index];
        if (!instance) continue;
        const world = composeTransformMatrix(instance.position, instance.rotation, instance.scale);
        matrices.push(world.clone().multiply(local));
      }
    }
    if (matrices.length === 0) return;
    const mesh = new InstancedMesh(SELECTION_BOX_GEOMETRY, SELECTION_BOX_MATERIAL, matrices.length);
    mesh.name = "foliage-selection";
    mesh.renderOrder = 30;
    mesh.raycast = () => {};
    for (let i = 0; i < matrices.length; i += 1) mesh.setMatrixAt(i, matrices[i]!);
    mesh.instanceMatrix.needsUpdate = true;
    this.root.add(mesh);
    this.selectionMesh = mesh;
  }

  private meshBox(meshAssetId: string, resolver: FoliageRenderResolver): Box3 | null {
    const cached = this.boxCache.get(meshAssetId);
    if (cached) return cached;
    const gltf = resolver.getModel(meshAssetId);
    if (!gltf) return null;
    const box = new Box3().setFromObject(gltf.scene);
    if (box.isEmpty()) return null;
    this.boxCache.set(meshAssetId, box);
    return box;
  }

  /** Removes and disposes every batch (scene teardown / layout swap). */
  clear(): void {
    for (const object of this.objects.values()) disposeGroupObject(object);
    this.objects.clear();
    if (this.selectionMesh) {
      this.selectionMesh.removeFromParent();
      this.selectionMesh.dispose();
      this.selectionMesh = null;
    }
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }
}

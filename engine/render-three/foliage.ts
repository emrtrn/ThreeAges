import { Euler, Group, MathUtils, Quaternion, Vector3, type InstancedMesh } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Vec3 } from "@engine/scene/layout";
import type {
  ForgeFoliageTypeDef,
  LayoutFoliageData,
  LayoutFoliageGroup,
  LayoutFoliageInstance,
} from "@engine/scene/foliage";
import type { FoliageInstanceRoll } from "@engine/scene/foliagePaint";
import { composeTransformMatrix } from "./transforms";
import { createInstancedModelGroup, type InstanceRenderItem } from "./models";

const WORLD_UP = new Vector3(0, 1, 0);

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

function disposeGroupObject(object: FoliageGroupObject): void {
  object.group.removeFromParent();
  for (const mesh of object.meshes) mesh.dispose();
}

export class FoliageRenderBinding {
  /** Scene-space container; add this once to the scene root. */
  readonly root = new Group();
  private readonly objects = new Map<string, FoliageGroupObject>();

  constructor() {
    this.root.name = "Foliage";
  }

  /** All InstancedMeshes currently drawn (for picking/statistics). */
  allMeshes(): InstancedMesh[] {
    const meshes: InstancedMesh[] = [];
    for (const object of this.objects.values()) meshes.push(...object.meshes);
    return meshes;
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

  /** Removes and disposes every batch (scene teardown / layout swap). */
  clear(): void {
    for (const object of this.objects.values()) disposeGroupObject(object);
    this.objects.clear();
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }
}

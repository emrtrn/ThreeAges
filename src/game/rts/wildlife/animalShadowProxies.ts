/**
 * Cheap projected ground shadows for animated wildlife.
 *
 * Like the unit proxy layer, this keeps skinned animal meshes out of the shadow
 * map. One low-poly, invisible, instanced capsule per living presentation gives
 * the field a contact shadow without a second skinning pass for every animal.
 * The proxy reads the presentation root rather than simulation visibility: that
 * is the single place fog, enclosed pastures and local art offsets are resolved.
 */
import {
  CapsuleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";

import type { WildlifeAnimal } from "./wildlifeSystem";

const CAP_SEGMENTS = 3;
const RADIAL_SEGMENTS = 8;
/** Full length of `CapsuleGeometry(1, 1)` along its authored Y axis. */
const CAPSULE_LENGTH = 3;
const INITIAL_CAPACITY = 32;

/**
 * Compact dimensions for an animal's unit-style shadow body. They are
 * intentionally presentation data, not collision data: wildlife has no
 * simulation footprint and the actor models' authored scales do not predict a
 * useful one.
 */
interface AnimalShadowProfile {
  readonly radius: number;
  readonly height: number;
}

const DEFAULT_PROFILE: AnimalShadowProfile = { radius: 0.36, height: 0.6 };
const PROFILES: Readonly<Record<string, AnimalShadowProfile>> = {
  deer: { radius: 0.34, height: 0.64 },
  stag: { radius: 0.4, height: 0.74 },
  cow: { radius: 0.5, height: 0.72 },
  bull: { radius: 0.58, height: 0.82 },
  wolf: { radius: 0.3, height: 0.42 },
  fox: { radius: 0.24, height: 0.3 },
};

export class AnimalShadowProxies {
  readonly root = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: Material;
  private mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private enabled = true;

  constructor(capacity = INITIAL_CAPACITY) {
    this.root.name = "rts-animal-shadow-proxies";
    this.geometry = new CapsuleGeometry(1, 1, CAP_SEGMENTS, RADIAL_SEGMENTS);
    // The colour pass rasterises no pixels, while the shadow depth material
    // still sees this caster. `visible = false` would remove it from both.
    this.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.mesh = this.createMesh(Math.max(1, capacity));
    this.root.add(this.mesh);
  }

  /**
   * Update from the roots already accepted by WildlifeView. A null or invisible
   * root means this animal is fogged, spent, or hidden in a closed pen and must
   * not leak its position through a shadow.
   */
  sync(animals: readonly WildlifeAnimal[], presentationRoot: (animal: WildlifeAnimal) => Object3D | null): void {
    if (!this.enabled) {
      this.mesh.count = 0;
      return;
    }
    if (animals.length > this.mesh.instanceMatrix.count) this.grow(animals.length);
    const capacity = this.mesh.instanceMatrix.count;
    let written = 0;
    for (const animal of animals) {
      if (written >= capacity) break;
      const root = presentationRoot(animal);
      if (!root?.visible) continue;
      const profile = PROFILES[animal.stats.id] ?? DEFAULT_PROFILE;
      this.position.set(root.position.x, root.position.y + profile.height / 2, root.position.z);
      // Match the unit proxy exactly: one compact, grounded vertical capsule.
      // Animal-specific silhouettes made the shadow read as a second model;
      // this deliberately stays a single continuous contact shadow instead.
      this.scale.set(profile.radius, profile.height / CAPSULE_LENGTH, profile.radius);
      this.matrix.makeScale(this.scale.x, this.scale.y, this.scale.z);
      this.matrix.setPosition(this.position);
      this.mesh.setMatrixAt(written, this.matrix);
      written += 1;
    }
    this.mesh.count = written;
    if (written > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.mesh.count = 0;
  }

  dispose(): void {
    this.root.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private grow(required: number): void {
    let capacity = Math.max(1, this.mesh.instanceMatrix.count);
    while (capacity < required) capacity *= 2;
    this.root.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = this.createMesh(capacity);
    this.root.add(this.mesh);
  }

  private createMesh(capacity: number): InstancedMesh {
    const mesh = new InstancedMesh(this.geometry, this.material, capacity);
    mesh.name = "rts-animal-shadow-proxy-instances";
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.userData.rtsAnimalShadowProxy = true;
    return mesh;
  }
}

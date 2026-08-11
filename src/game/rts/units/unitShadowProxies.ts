/**
 * Fake ground shadows for units, cast by invisible capsule stand-ins.
 *
 * Animated units are not shadow casters: `rtsActorPresentationTree` clears
 * `castShadow` on every `SkinnedMesh`, because skinning several hundred bodies a
 * second time for the shadow map is the single most expensive thing the render
 * could be asked to do at this unit count. The result reads badly — a soldier
 * with no shadow floats over the terrain — so the shadow comes back from a
 * cheaper body instead of from the real one.
 *
 * Each unit gets one capsule roughly its size, held in a single `InstancedMesh`.
 * The capsule is drawn into the shadow map and nowhere else, so what the player
 * sees is a real projected shadow: it wraps the authored heightfield without
 * anyone sampling it, points where the sun points, softens like every other
 * shadow on the field, and disappears under a building the same way. That is the
 * part a ground decal cannot buy at any price — a flat quad has to be told the
 * terrain normal, the sun direction and what is above it, and gets all three
 * slightly wrong on a slope.
 *
 * **Why the capsule is invisible the way it is.** Three ways to keep a mesh out
 * of the colour pass all take the shadow with them: `object.visible = false` and
 * `material.visible = false` are both checked by `WebGLShadowMap` before it
 * queues a caster, and layers do not separate the two passes either — the shadow
 * pass tests `object.layers` against the *viewing* camera, not the shadow
 * camera, so a layer the camera cannot see is a layer that casts nothing. What
 * is left is `colorWrite: false`, which `getDepthMaterial` does not copy onto
 * the depth material: the capsule rasterises in the colour pass and writes no
 * pixel, then writes depth normally into the shadow map. One draw call either
 * way, since the whole field is one instanced mesh.
 *
 * Ownership: view-side only. It reads unit positions and visibility and writes
 * nothing back — a unit whose `object.visible` the fog binder cleared is skipped
 * here too, or an unscouted army would be given away by its shadows.
 */
import {
  CapsuleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  type BufferGeometry,
  type Material,
} from "three";

import { unitBodyVolume, type Unit } from "./unit";

/**
 * Cap and radial segments of the shared capsule. Deliberately coarse: this
 * geometry is never seen, only its silhouette in a shadow map whose texel is
 * around a tenth of a metre at the coverage this game runs. Finer caps would buy
 * detail the map cannot record.
 */
const CAP_SEGMENTS = 3;
const RADIAL_SEGMENTS = 8;
/** Radius and straight-section length the shared geometry is authored at. */
const UNIT_CAPSULE_RADIUS = 1;
const UNIT_CAPSULE_LENGTH = 1;
/** Total height of the authored capsule, which per-unit Y scale divides out. */
const UNIT_CAPSULE_HEIGHT = UNIT_CAPSULE_LENGTH + 2 * UNIT_CAPSULE_RADIUS;

/**
 * How much narrower than the body the shadow capsule is.
 *
 * The body volume is a navigation and selection footprint, sized so a crowd does
 * not stand inside itself — it is wider than the soldier drawn inside it. Using
 * it unshrunk gives every unit a shadow visibly broader than the unit, which
 * reads as a hovering disc rather than as contact.
 */
const WIDTH_SCALE = 0.72;

/** Instance slots allocated up front; the pool doubles from here as needed. */
const INITIAL_CAPACITY = 128;

export class UnitShadowProxies {
  /** Scene subtree to add once; the instanced mesh inside it is swapped on growth. */
  readonly root = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: Material;
  private mesh: InstancedMesh;
  private readonly matrix = new Matrix4();
  private enabled = true;

  constructor(capacity = INITIAL_CAPACITY) {
    this.root.name = "rts-unit-shadow-proxies";
    this.geometry = new CapsuleGeometry(
      UNIT_CAPSULE_RADIUS,
      UNIT_CAPSULE_LENGTH,
      CAP_SEGMENTS,
      RADIAL_SEGMENTS,
    );
    // `visible` stays true on both the object and the material — see the module
    // note; clearing either one removes the capsule from the shadow map, which
    // is the only pass it exists for.
    this.material = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.mesh = this.createMesh(Math.max(1, capacity));
    this.root.add(this.mesh);
  }

  /**
   * Point every instance at a live unit and hide the rest.
   *
   * Call once per rendered frame, after units have been settled onto the ground
   * and after the fog binder has run: this reads `object.position` and
   * `object.visible` as they stand and keeps no state between frames.
   */
  sync(units: readonly Unit[]): void {
    if (!this.enabled) {
      this.mesh.count = 0;
      return;
    }
    // `count` is last frame's written total, not the pool size; the allocated
    // slot count is the instance attribute's length.
    if (units.length > this.mesh.instanceMatrix.count) this.grow(units.length);
    const capacity = this.mesh.instanceMatrix.count;
    let written = 0;
    for (const unit of units) {
      if (written >= capacity) break;
      // Fogged units are hidden by clearing `visible` on their render object.
      // A shadow is a position, so it has to follow that or the fog leaks.
      if (!unit.object.visible) continue;
      const body = unitBodyVolume(unit.role);
      const width = body.radius * WIDTH_SCALE;
      // The body is centred at `centerY` and stands on the ground, so it is
      // exactly twice that tall — true of a capsule and of the Topçu's box
      // alike, which is why this reads `centerY` rather than reassembling the
      // height from `length` and `radius` and getting the box case wrong.
      const height = body.centerY * 2;
      this.matrix.makeScale(width, height / UNIT_CAPSULE_HEIGHT, width);
      // `position` is the unit's feet: `RtsApp.syncUnitsToGround` writes the
      // authored heightfield into y, so raising by `centerY` lands the capsule
      // around the body on flat ground and on a slope alike.
      this.matrix.setPosition(
        unit.position.x,
        unit.position.y + body.centerY,
        unit.position.z,
      );
      this.mesh.setMatrixAt(written, this.matrix);
      written += 1;
    }
    this.mesh.count = written;
    if (written > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Turn the whole layer off — for the quality levels that render no shadow map
   * at all, where these capsules would be pure cost for no pixel.
   */
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
    mesh.name = "rts-unit-shadow-proxy-instances";
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    // An `InstancedMesh` culls on a bounding sphere derived from its instance
    // matrices, which this rewrites every frame without invalidating. Rather
    // than recompute a sphere for an object that writes no pixels, opt out: the
    // saving would be one no-op draw call, and a stale sphere would cull the
    // shadows of the units that moved.
    mesh.frustumCulled = false;
    mesh.count = 0;
    // Read by `RtsApp`'s shadow-caster inventory so the debug overlay bills
    // these triangles to the units rather than to an anonymous "other".
    mesh.userData.rtsUnitShadowProxy = true;
    return mesh;
  }
}

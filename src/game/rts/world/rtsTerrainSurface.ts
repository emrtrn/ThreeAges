/**
 * Runtime bridge between the generic authored Landscape and the RTS's X/Z
 * simulation. Navigation remains deliberately planar; this service only answers
 * where that plane is rendered in Y and where pointer rays meet it.
 */
import { Matrix4, Ray, Raycaster, Vector3 } from "three";

import { landscapeHeightAtLocal } from "@engine/scene/landscape";
import type { MountedLandscape } from "@/scene/authoredWorld";

export interface RtsGroundSurface {
  /** First visible terrain hit under a pointer ray, or null outside the landscape. */
  intersectRay(ray: Ray): Vector3 | null;
  /** Rendered ground height at a world X/Z position; flat-ground fallback is zero. */
  heightAt(x: number, z: number): number;
}

/** The original RTS field contract, retained when no Landscape is authored. */
export const FLAT_RTS_GROUND: RtsGroundSurface = {
  intersectRay: () => null,
  heightAt: () => 0,
};

/**
 * Reads the first mounted Landscape. This matches the road painter's existing
 * single-terrain scope and keeps a level without a Landscape on the zero-height
 * fallback. Pointer picking raycasts actual terrain chunks; frequent unit
 * grounding samples the heightfield directly instead of raycasting every unit.
 */
export class AuthoredRtsGroundSurface implements RtsGroundSurface {
  private readonly raycaster = new Raycaster();
  private readonly worldPoint = new Vector3();
  private readonly localPoint = new Vector3();
  private readonly worldMatrixInverse = new Matrix4();

  constructor(private readonly terrain: MountedLandscape) {}

  intersectRay(ray: Ray): Vector3 | null {
    this.raycaster.ray.copy(ray);
    const hit = this.raycaster.intersectObject(this.terrain.object, true)[0];
    return hit?.point.clone() ?? null;
  }

  heightAt(x: number, z: number): number {
    const object = this.terrain.object;
    object.updateWorldMatrix(true, false);
    this.worldMatrixInverse.copy(object.matrixWorld).invert();
    // Landscape gameplay is a top-down X/Z world. Landscapes rotated around X/Z
    // are not a valid RTS floor; yaw is supported because this point is converted
    // through the mounted object's complete world transform.
    this.localPoint.set(x, this.terrain.position[1], z).applyMatrix4(this.worldMatrixInverse);
    const halfWidth = (this.terrain.data.size.verticesX - 1) * this.terrain.data.size.spacing * 0.5;
    const halfDepth = (this.terrain.data.size.verticesZ - 1) * this.terrain.data.size.spacing * 0.5;
    if (Math.abs(this.localPoint.x) > halfWidth || Math.abs(this.localPoint.z) > halfDepth) return 0;
    const localHeight = landscapeHeightAtLocal(this.terrain.data, this.localPoint.x, this.localPoint.z);
    this.worldPoint.set(this.localPoint.x, localHeight, this.localPoint.z).applyMatrix4(object.matrixWorld);
    return this.worldPoint.y;
  }
}

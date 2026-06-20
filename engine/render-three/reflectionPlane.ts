import { Color, PlaneGeometry, type ShaderMaterial } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedReflectionPlane } from "@engine/scene/reflectionPlane";

export {
  resolveReflectionPlane,
  REFLECTION_PLANE_DEFAULTS,
  uniqueReflectionPlaneId,
  uniqueReflectionPlaneName,
  type ResolvedReflectionPlane,
} from "@engine/scene/reflectionPlane";

/**
 * Planar Reflection render binding — the web/three counterpart to Unreal's Planar
 * Reflection, built on three.js's {@link Reflector}. The reflector is a unit
 * `PlaneGeometry` mesh whose reflective surface faces local **+Z**; the actor's
 * transform (position/rotation/scale) orients and sizes it. `Reflector` updates
 * itself via its own `onBeforeRender` hook (it renders the scene from a mirrored
 * camera into its texture), so the render loop never has to drive it.
 *
 * Resolution is baked into the render target at construction, so a resolution
 * change requires rebuilding the object; color is a live shader uniform.
 */

/** The three.js object backing a Planar Reflection actor. */
export type ReflectionPlaneObject = Reflector;

/** Resolved settings + world transform the binding needs to build/sync a plane. */
export interface ReflectionPlaneRenderItem extends ResolvedReflectionPlane {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  /** Per-axis scale (z is unused by the flat plane but kept for the gizmo). */
  scale: Vec3;
}

/** Builds a reflector mesh; resolution/color are fixed here, transform via {@link applyReflectionPlaneTransform}. */
export function createReflectionPlaneObject(item: ReflectionPlaneRenderItem): ReflectionPlaneObject {
  const reflector = new Reflector(new PlaneGeometry(1, 1), {
    color: new Color(item.color),
    textureWidth: item.resolution,
    textureHeight: item.resolution,
    clipBias: 0.003,
  });
  reflector.name = item.name;
  applyReflectionPlaneTransform(reflector, item);
  return reflector;
}

/** Pushes the transform + visibility + (live) color onto an existing reflector. */
export function applyReflectionPlaneTransform(
  reflector: ReflectionPlaneObject,
  item: ReflectionPlaneRenderItem,
): void {
  reflector.position.set(item.position[0], item.position[1], item.position[2]);
  reflector.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  reflector.scale.set(item.scale[0], item.scale[1], item.scale[2] || 1);
  reflector.visible = !item.hidden;
  const material = reflector.material as ShaderMaterial;
  (material.uniforms.color!.value as Color).set(item.color);
}

/** Frees the reflector's render target, material, and geometry. */
export function disposeReflectionPlaneObject(reflector: ReflectionPlaneObject): void {
  reflector.geometry.dispose();
  reflector.dispose();
}

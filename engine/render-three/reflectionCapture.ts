import { Color, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedSphereReflectionCapture } from "@engine/scene/reflectionCapture";

export {
  resolveSphereReflectionCapture,
  SPHERE_REFLECTION_CAPTURE_DEFAULTS,
  uniqueSphereReflectionCaptureId,
  uniqueSphereReflectionCaptureName,
  type ResolvedSphereReflectionCapture,
} from "@engine/scene/reflectionCapture";

/**
 * Sphere Reflection Capture render binding. Faz 1 renders only the editor-side
 * **influence helper**: a wireframe sphere marking the probe's radius, drawn at
 * the actor's position. There is no cubemap bake yet (that is a later phase) — the
 * helper is purely an authoring aid that is selectable and movable in the
 * viewport. The radius is applied as a uniform three.js scale on a unit-sphere
 * mesh, so a radius edit is a cheap `scale` change with no geometry rebuild; the
 * actor's layout transform never stores a scale.
 */

/** Editor wireframe-sphere helper backing a Sphere Reflection Capture actor. */
export type SphereReflectionCaptureObject = Mesh<SphereGeometry, MeshBasicMaterial>;

/** Resolved settings + world transform the binding needs to build/sync a probe helper. */
export interface SphereReflectionCaptureRenderItem extends ResolvedSphereReflectionCapture {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees (cosmetic for a sphere; kept for the gizmo). */
  rotation: Vec3;
}

/** Tint of the influence-sphere wireframe helper. */
const CAPTURE_HELPER_COLOR = "#46c8ff";

/** Builds the wireframe influence-sphere helper; transform via {@link applySphereReflectionCaptureTransform}. */
export function createSphereReflectionCaptureObject(
  item: SphereReflectionCaptureRenderItem,
): SphereReflectionCaptureObject {
  // Unit sphere scaled by the radius so radius edits never rebuild geometry.
  const geometry = new SphereGeometry(1, 24, 16);
  const material = new MeshBasicMaterial({
    color: new Color(CAPTURE_HELPER_COLOR),
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = item.name;
  applySphereReflectionCaptureTransform(mesh, item);
  return mesh;
}

/** Pushes the transform + visibility + radius (as scale) onto an existing helper. */
export function applySphereReflectionCaptureTransform(
  mesh: SphereReflectionCaptureObject,
  item: SphereReflectionCaptureRenderItem,
): void {
  mesh.position.set(item.position[0], item.position[1], item.position[2]);
  mesh.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  mesh.scale.setScalar(Math.max(item.radius, 0.001));
  mesh.visible = !item.hidden;
}

/** Frees the helper's geometry + material. */
export function disposeSphereReflectionCaptureObject(mesh: SphereReflectionCaptureObject): void {
  mesh.geometry.dispose();
  mesh.material.dispose();
}

import {
  ACESFilmicToneMapping,
  Euler,
  MathUtils,
  NoToneMapping,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedSkyAtmosphere } from "@engine/scene/skyAtmosphere";

export {
  resolveSkyAtmosphere,
  SKY_ATMOSPHERE_DEFAULTS,
  type ResolvedSkyAtmosphere,
} from "@engine/scene/skyAtmosphere";

/**
 * Sky Atmosphere render binding — Unreal-style physically-inspired sky built on
 * three.js's analytic `Sky` shader (Rayleigh + Mie scattering). The dome is a
 * camera-following, depth-test-disabled background box: the scene camera's far
 * plane is small (100u), so the textbook 450000u sky sphere would be frustum-
 * culled. Instead we render a modest box that always surrounds the camera and
 * draws first (`renderOrder = -1`, no depth write/test) as a pure backdrop.
 *
 * The sky never illuminates by itself (its shader only colors the backdrop), so
 * the "sun" is realized by driving the scene's directional Sun light — see
 * {@link sunLightRotationDeg}.
 */

/** Box half-extent the camera sits inside; well within the 100u camera far plane. */
const SKY_BOX_SCALE = 100;

/** Builds the sky dome mesh (uniforms still need {@link applySkyUniforms}). */
export function createSkyObject(): Sky {
  const sky = new Sky();
  sky.name = "sky-atmosphere";
  sky.scale.setScalar(SKY_BOX_SCALE);
  // Pure backdrop: draw before everything, never write/test depth, never cull.
  sky.material.depthWrite = false;
  sky.material.depthTest = false;
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  // Background geometry is never a pick target.
  sky.raycast = () => {};
  return sky;
}

/**
 * Keeps the dome centered on the camera so it always fills the (small) frustum.
 * Call once per frame from the render loop.
 */
export function followCameraWithSky(sky: Sky, camera: PerspectiveCamera): void {
  sky.position.copy(camera.position);
}

/** Unit vector pointing from the ground toward the sun. */
export function sunDirectionVector(elevationDeg: number, azimuthDeg: number): Vector3 {
  const phi = MathUtils.degToRad(90 - elevationDeg);
  const theta = MathUtils.degToRad(azimuthDeg);
  return new Vector3().setFromSphericalCoords(1, phi, theta);
}

/** Pushes the resolved scattering + sun-direction settings onto the sky shader. */
export function applySkyUniforms(sky: Sky, resolved: ResolvedSkyAtmosphere): void {
  const uniforms = sky.material.uniforms;
  uniforms.turbidity!.value = resolved.turbidity;
  uniforms.rayleigh!.value = resolved.rayleigh;
  uniforms.mieCoefficient!.value = resolved.mie;
  uniforms.mieDirectionalG!.value = resolved.mieDirectionalG;
  (uniforms.sunPosition!.value as Vector3).copy(
    sunDirectionVector(resolved.sunElevationDeg, resolved.sunAzimuthDeg),
  );
  // Some three builds ship a clouds-extended Sky; disable its procedural clouds so
  // this stays a pure atmosphere (clouds are a separate concern, à la UE's
  // Volumetric Clouds) and we don't need to animate the `time` uniform.
  if (uniforms.cloudCoverage) uniforms.cloudCoverage.value = 0;
  sky.visible = !resolved.hidden;
}

const LIGHT_FORWARD = new Vector3(0, 0, -1);

/**
 * Euler XYZ rotation (degrees) that aims a directional light along the sky's
 * sun. The light travels FROM the sun TOWARD the scene, so its local forward
 * (-Z, see `applyLightTransform` in lights.ts) must equal the negated sun
 * direction. Lets the sky drive the scene's Sun so shadows track the sky.
 */
export function sunLightRotationDeg(elevationDeg: number, azimuthDeg: number): Vec3 {
  const travel = sunDirectionVector(elevationDeg, azimuthDeg).negate().normalize();
  const quaternion = new Quaternion().setFromUnitVectors(LIGHT_FORWARD, travel);
  const euler = new Euler().setFromQuaternion(quaternion, "XYZ");
  return [
    Number(MathUtils.radToDeg(euler.x).toFixed(3)),
    Number(MathUtils.radToDeg(euler.y).toFixed(3)),
    Number(MathUtils.radToDeg(euler.z).toFixed(3)),
  ];
}

/**
 * The three.js `Sky` shader relies on the renderer's tone mapping for a correct
 * look (its fragment includes `<tonemapping_fragment>`). Opt into ACES filmic
 * tone mapping with the sky's exposure only while an active sky is present, and
 * restore the neutral default otherwise so sky-less scenes are unaffected.
 */
export function applySkyToneMapping(
  renderer: WebGLRenderer,
  resolved: ResolvedSkyAtmosphere | null,
): void {
  if (resolved && !resolved.hidden) {
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = resolved.exposure;
  } else {
    renderer.toneMapping = NoToneMapping;
    renderer.toneMappingExposure = 1;
  }
}

import { Mesh, Vector3 } from "three";
import type { Object3D, PerspectiveCamera, Scene, WebGLRenderer, WebGLRenderTarget } from "three";
import type { Sky } from "three/examples/jsm/objects/Sky.js";

import {
  applySkySunDirection,
  applySkyToneMapping,
  applySkyUniforms,
  createSkyObject,
  followCameraWithSky,
  resolveSkyAtmosphere,
  setSkyLocalToneMappingExposure,
  skyAtmosphereToneMappingExposure,
  sunDirectionFromLightRotation,
} from "./skyAtmosphere";
import { applySceneFog, resolveHeightFog } from "./heightFog";
import {
  advanceCloudTime,
  applyCloudUniforms,
  createCloudObject,
  followCameraWithClouds,
  resolveCloudLayer,
  type CloudDome,
} from "./cloudLayer";
import {
  applyReflectionEnvironment,
  captureSkyEnvironment,
  resolveReflection,
} from "./reflection";
import { postProcessToneMappingExposure, type ResolvedPostProcess } from "./postProcess";
import { readRotation } from "../scene/transform";
import type { LayoutLightActor, RoomLayout } from "../scene/layout";

/**
 * Host resources + callbacks an {@link AuthoredEnvironment} draws into. The owner
 * (RuntimeSceneApp, and — per the Editor↔Runtime parity plan — RtsApp) supplies the
 * scene/renderer/camera and resolves which light drives the sun, keeping this layer
 * free of any single runtime's field layout.
 */
export interface AuthoredEnvironmentDeps {
  readonly scene: Scene;
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  /**
   * Resolves the scene's Sun (directional) light actor — its persisted rotation is
   * the source of truth for the sun disc + IBL capture direction. Returning null
   * leaves the sky lit from straight overhead (the reflection fallback).
   */
  readonly resolveSunActor: () => LayoutLightActor | null;
}

/**
 * Owns the authored environment singletons every runtime that renders a Forge
 * Level must apply identically: the Sky Atmosphere dome, the Sky Light (IBL)
 * capture, Exponential Height Fog, and the Cloud Layer. Extracted from
 * RuntimeSceneApp (Faz 0 of the Editor↔Runtime parity plan) so a second runtime can
 * reuse the exact same application code instead of reimplementing it — the drift
 * that hid these from the RTS Play route.
 *
 * Not owned here: world-settings background/ambient (coupled to the light teardown)
 * and the Post Process pipeline (coupled to the quality profile). Post Process's one
 * hook into this layer — the sky's local tone-mapping exposure — is exposed via
 * {@link applySkyPostProcessExposure} so the owner can keep driving it.
 */
export class AuthoredEnvironment {
  private readonly scene: Scene;
  private readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly resolveSunActor: () => LayoutLightActor | null;

  /** Sky Atmosphere dome (singleton); null when no sky actor is in the layout. */
  private skyObject: Sky | null = null;
  private cloudObject: CloudDome | null = null;
  /** Captured Sky Light environment (PMREM) backing `scene.environment`; null when none. */
  private reflectionTarget: WebGLRenderTarget | null = null;

  constructor(deps: AuthoredEnvironmentDeps) {
    this.scene = deps.scene;
    this.renderer = deps.renderer;
    this.camera = deps.camera;
    this.resolveSunActor = deps.resolveSunActor;
  }

  /**
   * Renders the Sky Atmosphere dome. Like the editor, the directional Sun light is
   * the source of truth for the sun: its persisted rotation places the sun disc.
   * This only builds the backdrop + tone mapping. Absent sky resets tone mapping.
   */
  applySky(layout: RoomLayout | null): void {
    const actor = layout?.skyAtmosphere ?? null;
    if (!actor) {
      applySkyToneMapping(this.renderer, null);
      return;
    }
    const resolved = resolveSkyAtmosphere(actor);
    if (!this.skyObject) {
      this.skyObject = createSkyObject();
      this.scene.add(this.skyObject);
    }
    applySkyUniforms(this.skyObject, resolved);
    const sun = this.resolveSunActor();
    if (sun) applySkySunDirection(this.skyObject, sunDirectionFromLightRotation(readRotation(sun)));
    followCameraWithSky(this.skyObject, this.camera);
    applySkyToneMapping(this.renderer, resolved);
  }

  /**
   * Whether the Level authors a Sky Light (IBL) contribution — i.e. a non-hidden
   * Sky Atmosphere. A runtime with a hardcoded fallback ambient light queries this
   * to retire that fallback once the authored sky supplies the ambient bounce
   * (otherwise the two stack and wash the scene out).
   */
  hasAuthoredSkyLight(layout: RoomLayout | null): boolean {
    const actor = layout?.skyAtmosphere ?? null;
    if (!actor) return false;
    return !resolveSkyAtmosphere(actor).hidden;
  }

  /** Applies the Exponential Height Fog to `scene.fog` (distance-based). */
  applyFog(layout: RoomLayout | null): void {
    const actor = layout?.heightFog ?? null;
    applySceneFog(this.scene, actor ? resolveHeightFog(actor) : null);
  }

  /**
   * Builds the static Cloud Layer dome. Absent/hidden clouds leave the scene
   * without the dome (an existing dome is left in place; teardown removes it).
   */
  applyClouds(layout: RoomLayout | null): void {
    const actor = layout?.cloudLayer ?? null;
    if (!actor) return;
    const resolved = resolveCloudLayer(actor);
    if (!this.cloudObject) {
      this.cloudObject = createCloudObject();
      this.scene.add(this.cloudObject);
    }
    applyCloudUniforms(this.cloudObject, resolved);
    followCameraWithClouds(this.cloudObject, this.camera);
  }

  /**
   * Mirrors the editor's Sky Atmosphere-owned Sky Light Capture: capture the
   * authored sky once and use it as the global PBR environment/ambient bounce
   * wherever no local Sphere Reflection Capture applies. Pass `recapture` to force
   * a fresh cubemap render (e.g. after the sun or sky changed).
   */
  applyReflection(layout: RoomLayout | null, recapture = false): void {
    const skyActor = layout?.skyAtmosphere ?? null;
    const sky = skyActor ? resolveSkyAtmosphere(skyActor) : null;
    if (!sky || sky.hidden) {
      this.disposeReflectionTarget();
      applyReflectionEnvironment(this.scene, null, null);
      return;
    }

    if (recapture || !this.reflectionTarget) {
      this.disposeReflectionTarget();
      const sun = this.resolveSunActor();
      const sunDirection = sun
        ? sunDirectionFromLightRotation(readRotation(sun))
        : new Vector3(0, 1, 0);
      this.reflectionTarget = captureSkyEnvironment(this.renderer, sky, sunDirection);
    }

    applyReflectionEnvironment(this.scene, this.reflectionTarget, resolveReflection(sky.skyLightCapture));
  }

  /**
   * Couples the sky dome's local tone-mapping exposure to the authored Post
   * Process. The owner keeps the Post Process pipeline (it is quality-gated), and
   * calls this after resolving it so the sky matches the composited exposure.
   */
  applySkyPostProcessExposure(post: ResolvedPostProcess | null, layout: RoomLayout | null): void {
    if (!this.skyObject) return;
    const sky = layout?.skyAtmosphere ? resolveSkyAtmosphere(layout.skyAtmosphere) : null;
    if (!sky || sky.hidden || !post || post.hidden) {
      setSkyLocalToneMappingExposure(this.skyObject, null);
      return;
    }
    setSkyLocalToneMappingExposure(
      this.skyObject,
      postProcessToneMappingExposure(post.exposure) * skyAtmosphereToneMappingExposure(sky.exposure),
    );
  }

  /** Per-frame: keep the sky + cloud domes centered on the camera and advance clouds. */
  update(deltaSeconds: number): void {
    if (this.skyObject) followCameraWithSky(this.skyObject, this.camera);
    if (this.cloudObject) {
      followCameraWithClouds(this.cloudObject, this.camera);
      advanceCloudTime(this.cloudObject, deltaSeconds);
    }
  }

  /** Frees the captured Sky Light environment (does not clear `scene.environment`). */
  disposeReflectionTarget(): void {
    if (!this.reflectionTarget) return;
    this.reflectionTarget.dispose();
    this.reflectionTarget = null;
  }

  /**
   * Removes + disposes the sky/cloud domes and the Sky Light capture, and clears
   * `scene.environment`. Called on scene rebuild/teardown; safe to call repeatedly.
   */
  teardown(): void {
    if (this.skyObject) {
      this.scene.remove(this.skyObject);
      disposeObjectMeshResources(this.skyObject);
      this.skyObject = null;
    }
    if (this.cloudObject) {
      this.scene.remove(this.cloudObject);
      disposeObjectMeshResources(this.cloudObject);
      this.cloudObject = null;
    }
    this.disposeReflectionTarget();
    this.scene.environment = null;
  }
}

/**
 * Disposes the geometry + materials of every mesh under a scene-owned dome (sky /
 * cloud). These own their geometry + shader material outright — unlike loader-cached
 * GLTFs, which must not be disposed here.
 */
function disposeObjectMeshResources(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      material?.dispose();
    }
  });
}

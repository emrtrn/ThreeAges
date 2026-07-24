import {
  HalfFloatType,
  Matrix4,
  NoToneMapping,
  Object3D,
  Plane,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

/** Reserved opt-out layer for editor helpers, UI meshes and reflection-only FX. */
export const PLANAR_REFLECTION_EXCLUDED_LAYER = 31;

/** Keeps a source camera's normal visibility mask while removing the opt-out layer. */
export function planarReflectionLayerMask(mask: number): number {
  return mask & ~(1 << PLANAR_REFLECTION_EXCLUDED_LAYER);
}

/** The one reflection texture/matrix a family of coplanar consumers samples. */
export interface PlanarReflectionBinding {
  readonly texture: Texture;
  readonly textureMatrix: Matrix4;
  readonly strength: number;
}

export type PlanarReflectionQuality = "medium" | "high";

const QUALITY_SETTINGS: Record<PlanarReflectionQuality, { resolution: number; minUpdateMs: number }> = {
  medium: { resolution: 256, minUpdateMs: 32 },
  high: { resolution: 512, minUpdateMs: 4 },
};

/**
 * One horizontal planar-reflection render source shared by every consumer in a
 * River Water Body group. It intentionally owns no visible geometry: consumers
 * call {@link update} during their draw, while this source hides all consumers
 * for the nested scene render and restores them afterwards.
 */
export class PlanarReflectionSource {
  readonly textureMatrix = new Matrix4();
  readonly binding: PlanarReflectionBinding;
  private readonly renderTarget: WebGLRenderTarget;
  private readonly planeY: number;
  private readonly reflectionCameras = new WeakMap<Camera, Camera>();
  private readonly consumers = new Set<Object3D>();
  private readonly minUpdateMs: number;
  private lastUpdateAt = -Infinity;
  private rendering = false;

  constructor(planeY: number, quality: PlanarReflectionQuality, strength = 0.34) {
    const settings = QUALITY_SETTINGS[quality];
    this.planeY = planeY;
    this.minUpdateMs = settings.minUpdateMs;
    this.renderTarget = new WebGLRenderTarget(settings.resolution, settings.resolution, {
      samples: quality === "high" ? 2 : 0,
      type: HalfFloatType,
    });
    this.binding = {
      texture: this.renderTarget.texture,
      textureMatrix: this.textureMatrix,
      strength,
    };
  }

  addConsumer(object: Object3D): void {
    this.consumers.add(object);
  }

  removeConsumer(object: Object3D): void {
    this.consumers.delete(object);
  }

  dispose(): void {
    this.consumers.clear();
    this.renderTarget.dispose();
  }

  /** Updates at most once per profile interval, even when several ribbons draw in one frame. */
  update(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    if (this.rendering) return;
    const now = performance.now();
    if (now - this.lastUpdateAt < this.minUpdateMs) return;
    this.lastUpdateAt = now;
    this.rendering = true;
    try {
      this.renderReflection(renderer, scene, camera);
    } finally {
      this.rendering = false;
    }
  }

  private renderReflection(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    const reflectionCamera = this.getReflectionCamera(camera);
    const reflectorPosition = new Vector3(0, this.planeY, 0);
    const normal = new Vector3(0, 1, 0);
    const cameraPosition = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new Vector3().subVectors(reflectorPosition, cameraPosition);
    if (view.dot(normal) > 0) return;

    view.reflect(normal).negate().add(reflectorPosition);
    const rotationMatrix = new Matrix4().extractRotation(camera.matrixWorld);
    const lookAtPosition = new Vector3(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraPosition);
    const target = new Vector3()
      .subVectors(reflectorPosition, lookAtPosition)
      .reflect(normal)
      .negate()
      .add(reflectorPosition);
    reflectionCamera.position.copy(view);
    reflectionCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    reflectionCamera.lookAt(target);
    reflectionCamera.updateMatrixWorld();

    const perspective = reflectionCamera as Camera & {
      far: number;
      projectionMatrix: Matrix4;
      matrixWorldInverse: Matrix4;
    };
    const sourcePerspective = camera as Camera & { far: number; projectionMatrix: Matrix4 };
    perspective.far = sourcePerspective.far;
    perspective.projectionMatrix.copy(sourcePerspective.projectionMatrix);
    // Keep the caller's normal scene layers, but never render opt-out helpers
    // into water. Runtime UI is DOM-based today; this reserved Three layer covers
    // editor gizmos and any future world-space UI/FX explicitly placed on it.
    reflectionCamera.layers.mask = planarReflectionLayerMask(camera.layers.mask);

    // World-space projection: unlike a flat ReflectiveSurface plane, a ribbon
    // consumer has its own transform, so its shader multiplies this by modelMatrix.
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(perspective.projectionMatrix);
    this.textureMatrix.multiply(perspective.matrixWorldInverse);

    const reflectorPlane = new Plane().setFromNormalAndCoplanarPoint(normal, reflectorPosition);
    reflectorPlane.applyMatrix4(perspective.matrixWorldInverse);
    const clipPlane = new Vector4(
      reflectorPlane.normal.x,
      reflectorPlane.normal.y,
      reflectorPlane.normal.z,
      reflectorPlane.constant,
    );
    const projection = perspective.projectionMatrix;
    const q = new Vector4(
      (Math.sign(clipPlane.x) + projection.elements[8]!) / projection.elements[0]!,
      (Math.sign(clipPlane.y) + projection.elements[9]!) / projection.elements[5]!,
      -1,
      (1 + projection.elements[10]!) / projection.elements[14]!,
    );
    clipPlane.multiplyScalar(2 / clipPlane.dot(q));
    projection.elements[2] = clipPlane.x;
    projection.elements[6] = clipPlane.y;
    projection.elements[10] = clipPlane.z + 1 - 0.003;
    projection.elements[14] = clipPlane.w;

    const hidden = [...this.consumers].map((consumer) => [consumer, consumer.visible] as const);
    for (const [consumer] of hidden) consumer.visible = false;
    const previousTarget = renderer.getRenderTarget();
    const previousToneMapping = renderer.toneMapping;
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const previousXrEnabled = renderer.xr.enabled;
    try {
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.toneMapping = NoToneMapping;
      renderer.setRenderTarget(this.renderTarget);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, reflectionCamera);
    } finally {
      renderer.xr.enabled = previousXrEnabled;
      renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
      renderer.toneMapping = previousToneMapping;
      renderer.setRenderTarget(previousTarget);
      for (const [consumer, visible] of hidden) consumer.visible = visible;
    }
  }

  private getReflectionCamera(camera: Camera): Camera {
    let reflectionCamera = this.reflectionCameras.get(camera);
    if (!reflectionCamera) {
      reflectionCamera = camera.clone();
      this.reflectionCameras.set(camera, reflectionCamera);
    }
    return reflectionCamera;
  }
}

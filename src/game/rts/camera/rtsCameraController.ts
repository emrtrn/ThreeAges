/**
 * RTS camera controller — Vertical Slice Plan v0.2 §21 ("Kamera").
 *
 * A tilted top-down camera modelled as a ground focus point plus a zoom
 * distance and a fixed downward pitch. WASD/arrows pan the focus (screen-
 * relative, zoom-scaled), the wheel changes distance (smoothed + clamped), the
 * focus is clamped to authored bounds, and an optional screen-edge scroll sits
 * behind a config flag. Yaw is fixed (no rotation in Ürün A), so screen X maps
 * to world +X and screen forward to world -Z.
 *
 * Pure of DOM/event code — it reads an {@link RtsInput} snapshot each frame so
 * the controller stays unit-testable (plan §14).
 */
import { MathUtils, PerspectiveCamera, Vector3 } from "three";

import type { RtsInput } from "../input/rtsInput";
import {
  cameraSettingsToFeel,
  DEFAULT_RTS_CAMERA_CONFIG,
  DEFAULT_RTS_CAMERA_SETTINGS,
  type RtsCameraConfig,
  type RtsCameraSettings,
} from "./rtsCameraConfig";

export class RtsCameraController {
  readonly camera: PerspectiveCamera;
  private readonly config: RtsCameraConfig;
  /** Ground focus point (y = 0). */
  private readonly focus = new Vector3(0, 0, 0);
  /** Current (smoothed) camera distance to the focus. */
  private distance: number;
  /** Target distance the wheel drives; `distance` eases toward it. */
  private targetDistance: number;
  private viewportW = 1;
  private viewportH = 1;
  /**
   * §51 "Minimal ayarlar": pan speed and zoom smoothing are the two pieces of
   * camera feel the player owns, so they are live fields rather than the frozen
   * config. The rest of the config stays authored — a player has no business
   * setting the map bounds.
   */
  private panSpeed: number;
  private zoomLerpRate: number;

  constructor(config: RtsCameraConfig = DEFAULT_RTS_CAMERA_CONFIG) {
    this.config = config;
    this.distance = config.startDistance;
    this.targetDistance = config.startDistance;
    const feel = cameraSettingsToFeel(DEFAULT_RTS_CAMERA_SETTINGS);
    this.panSpeed = feel.panSpeed;
    this.zoomLerpRate = feel.zoomLerpRate;
    this.camera = new PerspectiveCamera(config.fovDeg, 1, 0.5, 2000);
    this.applyTransform();
  }

  /** Apply the player's camera dials (plan §51). */
  setSettings(settings: RtsCameraSettings): void {
    const feel = cameraSettingsToFeel(settings);
    this.panSpeed = feel.panSpeed;
    this.zoomLerpRate = feel.zoomLerpRate;
  }

  /** Recompute aspect + projection when the drawing buffer resizes. */
  setViewport(width: number, height: number): void {
    this.viewportW = Math.max(1, width);
    this.viewportH = Math.max(1, height);
    this.camera.aspect = this.viewportW / this.viewportH;
    this.camera.updateProjectionMatrix();
  }

  /** Recenter the camera focus (world XZ), clamped to bounds. */
  setFocus(x: number, z: number): void {
    this.focus.set(x, 0, z);
    this.clampFocus();
    this.applyTransform();
  }

  update(dt: number, input: RtsInput): void {
    // Zoom: accumulate wheel notches into the target distance proportionally,
    // then ease the live distance toward it for a smooth feel.
    const wheel = input.consumeWheelDelta();
    if (wheel !== 0) {
      this.targetDistance = MathUtils.clamp(
        this.targetDistance * (1 + wheel * this.config.zoomStep),
        this.config.minDistance,
        this.config.maxDistance,
      );
    }
    this.distance = MathUtils.damp(this.distance, this.targetDistance, this.zoomLerpRate, dt);

    // Pan: screen-relative, scaled by zoom so the map feels consistent.
    const intent = input.panIntent();
    let px = intent.x;
    let pz = intent.z;
    if (this.config.edgeScroll.enabled) {
      const edge = this.edgeScrollIntent(input);
      px += edge.x;
      pz += edge.z;
    }
    if (px !== 0 || pz !== 0) {
      const speed = this.panSpeed * (this.distance / this.config.panReferenceDistance) * dt;
      // Screen forward (pz = +1) moves the focus away from the camera → world -Z.
      this.focus.x += px * speed;
      this.focus.z += -pz * speed;
      this.clampFocus();
    }

    this.applyTransform();
  }

  /** Screen-edge scroll contribution when the pointer sits in an edge hot zone. */
  private edgeScrollIntent(input: RtsInput): { x: number; z: number } {
    const pointer = input.pointerPosition();
    if (!pointer) return { x: 0, z: 0 };
    const m = this.config.edgeScroll.marginPx;
    let x = 0;
    let z = 0;
    if (pointer.x <= m) x -= 1;
    else if (pointer.x >= this.viewportW - m) x += 1;
    if (pointer.y <= m) z += 1; // top edge → pan forward
    else if (pointer.y >= this.viewportH - m) z -= 1;
    return { x, z };
  }

  private clampFocus(): void {
    const b = this.config.bounds;
    this.focus.x = MathUtils.clamp(this.focus.x, b.minX, b.maxX);
    this.focus.z = MathUtils.clamp(this.focus.z, b.minZ, b.maxZ);
  }

  private applyTransform(): void {
    const pitch = MathUtils.degToRad(this.config.pitchDeg);
    // Offset from focus to camera: up by sin(pitch), back (+Z) by cos(pitch).
    const horizontal = Math.cos(pitch) * this.distance;
    const vertical = Math.sin(pitch) * this.distance;
    this.camera.position.set(this.focus.x, vertical, this.focus.z + horizontal);
    this.camera.lookAt(this.focus);
  }
}

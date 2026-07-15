/**
 * RTS camera tuning — Vertical Slice Plan v0.2 §21 ("Kamera").
 *
 * Camera *feel* (pan speed, zoom limits, tilt) is UX configuration, not balance
 * data, so it lives in TS rather than `public/game-data/` (plan §14 scopes the
 * JSON rule to gameplay numbers). Values are chosen for a small blockout map and
 * re-tuned once Faz 2 introduces a real map extent.
 */

export interface RtsCameraConfig {
  /** Downward tilt of the camera in degrees (90 = straight down). */
  readonly pitchDeg: number;
  /** Zoom = camera distance to its ground focus point, min/max (world units). */
  readonly minDistance: number;
  readonly maxDistance: number;
  /** Distance the camera starts at. */
  readonly startDistance: number;
  /** Pan speed at the reference distance, in world units per second. */
  readonly panSpeed: number;
  /**
   * Pan speed scales with zoom so the map feels consistent: effective speed =
   * panSpeed * (distance / panReferenceDistance).
   */
  readonly panReferenceDistance: number;
  /** Fraction of `distance` added/removed per wheel notch (before clamping). */
  readonly zoomStep: number;
  /** Exponential smoothing rate for zoom (higher = snappier). */
  readonly zoomLerpRate: number;
  /** Axis-aligned bounds the ground focus point is clamped to (world XZ). */
  readonly bounds: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  /** Screen-edge scroll (plan §21: opsiyonel flag altında) — off by default. */
  readonly edgeScroll: {
    readonly enabled: boolean;
    /** Thickness in pixels of the hot zone at each screen edge. */
    readonly marginPx: number;
  };
  /** Perspective vertical field of view, degrees. */
  readonly fovDeg: number;
}

export const DEFAULT_RTS_CAMERA_CONFIG: RtsCameraConfig = {
  pitchDeg: 55,
  minDistance: 12,
  maxDistance: 60,
  startDistance: 34,
  panSpeed: 26,
  panReferenceDistance: 34,
  zoomStep: 0.15,
  zoomLerpRate: 12,
  bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  edgeScroll: { enabled: false, marginPx: 12 },
  fovDeg: 50,
};

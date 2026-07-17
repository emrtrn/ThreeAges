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

/**
 * §51 "Minimal ayarlar" — the camera feel a player is allowed to change.
 *
 * Both are stored as a 0..1 dial rather than the raw world numbers: a slider
 * labelled "Kamera hızı" must not ask the player what 26 world-units-per-second
 * means, and clamping in dial space keeps a stored value from ever producing an
 * unusable camera. {@link cameraSettingsToFeel} owns the mapping.
 */
export interface RtsCameraSettings {
  /** 0 = slowest usable pan, 1 = fastest. */
  readonly panSpeed: number;
  /** 0 = no zoom smoothing (instant), 1 = heaviest. */
  readonly smoothing: number;
}

export const DEFAULT_RTS_CAMERA_SETTINGS: RtsCameraSettings = { panSpeed: 0.5, smoothing: 0.5 };

/**
 * The ranges are centred on the authored config below, so a dial left at its
 * default reproduces the camera exactly as tuned — `cameraSettingsToFeel` at 0.5
 * returns `panSpeed: 26` and `zoomLerpRate: 12`.
 *
 * This is not cosmetic. The first cut ran 12..52, which quietly moved the
 * default pan from 26 to 32 and re-tuned the camera for every player who never
 * opened the settings; a Playwright test that pans for a fixed 700 ms caught it
 * by landing somewhere new. A settings dial must offer a choice around the
 * authored value, not replace it. `test:engine` pins the midpoint to the config.
 */
const PAN_SPEED_RANGE = { min: 12, max: 40 } as const;
/** Lerp rate, so *higher* is snappier — the dial is inverted against it. */
const ZOOM_RATE_RANGE = { min: 4, max: 20 } as const;

/** Turn the player's dials into the world numbers the controller runs on. */
export function cameraSettingsToFeel(settings: RtsCameraSettings): {
  readonly panSpeed: number;
  readonly zoomLerpRate: number;
} {
  const pan = clamp01(settings.panSpeed);
  const smoothing = clamp01(settings.smoothing);
  return {
    panSpeed: PAN_SPEED_RANGE.min + (PAN_SPEED_RANGE.max - PAN_SPEED_RANGE.min) * pan,
    // Inverted: more smoothing means a slower ease toward the target distance.
    zoomLerpRate: ZOOM_RATE_RANGE.max - (ZOOM_RATE_RANGE.max - ZOOM_RATE_RANGE.min) * smoothing,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
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

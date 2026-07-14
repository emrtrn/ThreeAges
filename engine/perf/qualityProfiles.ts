/**
 * Pure quality-profile definitions and resolution (Adaptive Performance &
 * Graphics Quality, Faz 2).
 *
 * Side-effect free: no DOM, no three.js, no renderer. This module owns the
 * template `QUALITY_PROFILES` defaults (the `DEFAULT_PERF_BUDGET` pattern — a
 * fork overrides the values, the keys stay shared) and the pure functions that
 * turn a chosen {@link QualityLevel} into effective {@link QualitySettings} and
 * merge those onto authored post-process. The `src/scene` applier adapter takes
 * the resolved values and drives the renderer; that layer is where three.js
 * lives.
 *
 * **Principle #2 (authored data is sacred).** The quality layer only ever turns
 * an effect **off** or scales it **down**. It never enables an effect the
 * author left disabled: an effective gate is `authored && qualityAllows`. So a
 * scene whose `LayoutPostProcess` ships bloom off stays bloom-off on Ultra, and
 * the layout file is never written by the quality layer.
 */

import type { ResolvedPostProcess } from "../scene/postProcess";

export type QualityLevel = "ultra" | "high" | "medium" | "low" | "custom";

/** The four concrete profiles, ordered highest → lowest (adaptive ladder). */
export const QUALITY_LEVELS: readonly Exclude<QualityLevel, "custom">[] = [
  "ultra",
  "high",
  "medium",
  "low",
];

/** Shadow map resolutions the quality layer may select (256 = lowest usable). */
export type ShadowMapSize = 256 | 512 | 1024 | 2048;

/**
 * Core quality settings — every field has a direct applier in today's engine
 * (render scale, pixel ratio, post-process gates, shadows, particles, foliage).
 * Post-process gates are **allow** flags, not force-on: see Principle #2.
 */
export interface QualitySettings {
  /** Composer + renderer internal-resolution scale (1 = native). */
  renderScale: number;
  /** Upper bound on device pixel ratio (replaces the MAX_PIXEL_RATIO constant). */
  maxPixelRatio: number;

  /** Allow the authored GTAO pass (the most expensive pass). */
  aoAllowed: boolean;
  /** Allow the authored Bokeh depth-of-field pass. */
  dofAllowed: boolean;
  /** Allow the authored bloom pass. */
  bloomAllowed: boolean;
  /** Bloom render-target scale when bloom is on (0.5 = half resolution). */
  bloomResolutionScale: 1 | 0.5;
  /** Allow authored SMAA (MSAA is fixed at context creation, so runtime AA = SMAA). */
  smaaAllowed: boolean;

  /** Master shadow toggle (`renderer.shadowMap.enabled`). */
  shadowsEnabled: boolean;
  /** Directional shadow map resolution (2048 is today's hard-coded value). */
  shadowMapSize: ShadowMapSize;
  /** Shadow camera extent multiplier (smaller = shadows fade in nearer). */
  shadowDistanceScale: number;

  /** Global VFX spawn-rate / maxParticles multiplier (1 = authored density). */
  particleDensity: number;
  /** Foliage cull-distance multiplier (smaller = cull nearer). */
  foliageCullDistanceScale: number;
}

/**
 * Extension settings whose mechanism is not built yet (Faz 7) or is fork-owned.
 * Template profiles do **not** write these; the schema exists so a fork can
 * override with its own distance-LOD / NPC-budget / texture-streaming systems.
 */
export interface QualityExtensions {
  viewDistanceMultiplier?: number;
  lodBias?: number;
  npcBudgetMultiplier?: number;
  aiUpdateHz?: number;
  farAnimationUpdateHz?: number;
  maxTextureSize?: 512 | 1024 | 2048;
}

/**
 * Template default profiles. A fork overrides the **values** (a dense-NPC sim
 * and a tiny service game have different budgets); the **names** and setting
 * **keys** stay shared across forks (plan §6.1).
 */
export const QUALITY_PROFILES: Record<Exclude<QualityLevel, "custom">, QualitySettings> = {
  ultra: {
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    aoAllowed: true,
    dofAllowed: true,
    bloomAllowed: true,
    bloomResolutionScale: 1,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowDistanceScale: 1.0,
    particleDensity: 1.0,
    foliageCullDistanceScale: 1.0,
  },
  high: {
    renderScale: 1.0,
    maxPixelRatio: 1.75,
    aoAllowed: true,
    dofAllowed: true,
    bloomAllowed: true,
    bloomResolutionScale: 1,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowDistanceScale: 0.75,
    particleDensity: 0.8,
    foliageCullDistanceScale: 0.85,
  },
  medium: {
    renderScale: 0.85,
    maxPixelRatio: 1.5,
    aoAllowed: false,
    dofAllowed: false,
    bloomAllowed: true,
    bloomResolutionScale: 0.5,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowDistanceScale: 0.5,
    particleDensity: 0.55,
    foliageCullDistanceScale: 0.65,
  },
  low: {
    renderScale: 0.7,
    maxPixelRatio: 1.0,
    aoAllowed: false,
    dofAllowed: false,
    bloomAllowed: false,
    bloomResolutionScale: 0.5,
    smaaAllowed: false,
    shadowsEnabled: false,
    shadowMapSize: 256,
    shadowDistanceScale: 0.35,
    particleDensity: 0.3,
    foliageCullDistanceScale: 0.45,
  },
};

/** Fallback base for `custom` when no explicit base level is supplied. */
const DEFAULT_CUSTOM_BASE: Exclude<QualityLevel, "custom"> = "medium";

/**
 * Resolves a {@link QualityLevel} to concrete {@link QualitySettings}.
 *
 * - A concrete level returns a **fresh copy** of its template profile (callers
 *   never mutate the shared `QUALITY_PROFILES` objects).
 * - `"custom"` layers `customSettings` over `baseLevel`'s profile, so a player
 *   who tweaks one advanced slider keeps every other value from their base.
 */
export function resolveQualitySettings(
  level: QualityLevel,
  customSettings?: Partial<QualitySettings>,
  baseLevel: Exclude<QualityLevel, "custom"> = DEFAULT_CUSTOM_BASE,
): QualitySettings {
  if (level === "custom") {
    return { ...QUALITY_PROFILES[baseLevel], ...customSettings };
  }
  return { ...QUALITY_PROFILES[level] };
}

/**
 * Merges quality gates onto authored post-process (Principle #2): returns a new
 * {@link ResolvedPostProcess} whose bloom / DoF / GTAO / SMAA are on **only when
 * the author enabled them AND the quality profile allows them**. Every other
 * authored field (colour grading, vignette, exposure, numeric bloom params) is
 * passed through untouched — quality gates effects, it does not re-author them.
 *
 * Bloom's render-target scale is a renderer concern
 * ({@link QualitySettings.bloomResolutionScale}); this function only decides
 * whether bloom runs at all.
 */
export function applyQualityToPostProcess(
  authored: ResolvedPostProcess,
  quality: QualitySettings,
): ResolvedPostProcess {
  return {
    ...authored,
    antialias: quality.smaaAllowed ? authored.antialias : "none",
    bloom: { ...authored.bloom, enabled: authored.bloom.enabled && quality.bloomAllowed },
    dof: { ...authored.dof, enabled: authored.dof.enabled && quality.dofAllowed },
    ao: { ...authored.ao, enabled: authored.ao.enabled && quality.aoAllowed },
  };
}

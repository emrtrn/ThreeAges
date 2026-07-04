/**
 * VFX Lite — particle effect asset types.
 *
 * Two shapes live here:
 *
 * 1. {@link ParticleEffectDefinition} — the *normalized* rich authoring form
 *    (schema-2 shaped, fully defaulted). This is the single internal
 *    representation the editor, validation, and (later) the full CPU simulation
 *    speak. Both schema-1 and schema-2 asset files normalize into it.
 *
 * 2. {@link RuntimeParticleEffect} — the *flat* runtime contract the current
 *    simple `THREE.Points` renderer consumes. A best-effort collapse of the
 *    normalized form (see `toRuntimeParticleEffect`). Deliberately narrow: the
 *    first renderer only does continuous-rate emission, a single size lerp, one
 *    tint, and linear spread jitter. Richer authoring fields (ranges, burst
 *    shapes, start/end colour, curves) are stored but not yet honoured by this
 *    renderer — they light up as the simulation grows (VFX Lite Faz 3+).
 *
 * This module knows nothing about the DOM or Three.js; it is pure data, so it
 * lives under `engine/vfx/` per the plan's layering rules (§9).
 */

export type Vec3 = [number, number, number];
/** An inclusive `[min, max]` range; `min <= max` after normalization. */
export type NumberRange = [number, number];

export type SpawnMode = "rate" | "burst";
export type SpawnShape = "point" | "sphere" | "box" | "circle";
export type RendererType = "sprite";
export type ParticleBlendMode = "alpha" | "additive";
export type SortMode = "none" | "distance";
export type BoundsMode = "fixed" | "autoPreview";

export interface ParticleBounds {
  mode: BoundsMode;
  min: Vec3;
  max: Vec3;
  showInPreview: boolean;
}

export interface ParticleSystemBlock {
  enabled: boolean;
  loop: boolean;
  /** Spawn-phase duration in seconds (how long a one-shot keeps emitting). */
  duration: number;
  /** Deterministic-preview seed, or null for a random seed each play. */
  seed: number | null;
  maxParticles: number;
  bounds: ParticleBounds;
}

export interface ParticleSpawnBlock {
  mode: SpawnMode;
  /** Particles per second (rate mode). */
  rate: number;
  /** Particles per burst (burst mode). */
  count: number;
  delay: number;
  interval: number;
  shape: SpawnShape;
  radius: number;
  boxSize: Vec3;
}

export interface ParticleInitializeBlock {
  lifetime: NumberRange;
  startSize: NumberRange;
  startColor: string;
  startOpacity: number;
  direction: Vec3;
  speed: NumberRange;
  spreadAngleDeg: number;
  rotation: NumberRange;
  angularVelocity: NumberRange;
}

export interface ParticleUpdateBlock {
  gravityScale: number;
  drag: number;
  acceleration: Vec3;
  endSize: NumberRange;
  endColor: string;
  endOpacity: number;
  fadeInTime: number;
  fadeOutTime: number;
}

export interface ParticleRendererBlock {
  type: RendererType;
  blendMode: ParticleBlendMode;
  softness: number;
  sortMode: SortMode;
  /**
   * Optional sprite texture, referenced as a manifest texture asset id (matching
   * the material convention). `null` keeps the procedural soft-round sprite. The
   * id → URL → `THREE.Texture` resolution happens at the app boundary that owns
   * the manifest (VFX Lite Faz 6a); `engine/vfx` stays manifest-free.
   */
  texture: string | null;
}

/** The normalized, fully-defaulted authoring form (schema-2 shaped). */
export interface ParticleEffectDefinition {
  name: string;
  category: string;
  tags: string[];
  system: ParticleSystemBlock;
  spawn: ParticleSpawnBlock;
  initialize: ParticleInitializeBlock;
  update: ParticleUpdateBlock;
  renderer: ParticleRendererBlock;
}

/**
 * The flat shape the simple `THREE.Points` renderer simulates. Collapsed from a
 * {@link ParticleEffectDefinition}; see `toRuntimeParticleEffect`.
 */
export interface RuntimeParticleEffect {
  name?: string;
  loop: boolean;
  /** Particles spawned per second. */
  rate: number;
  /** Particle lifetime in seconds. */
  lifetime: number;
  startSize: number;
  endSize: number;
  velocity: Vec3;
  /** Random linear spread applied to spawn velocity/position. */
  spread: number;
  materialMode: ParticleBlendMode;
  /** Particle tint (hex `#rrggbb`). */
  color: string;
  /** Optional sprite texture asset id; absent renders the procedural sprite. */
  texture?: string;
}

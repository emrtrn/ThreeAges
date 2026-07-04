/**
 * VFX Lite — particle effect normalizer.
 *
 * `normalizeEffectDefinition` accepts either a schema-1 (`{ schema: 1, rate,
 * lifetime, ... }`) or schema-2 (`{ schema: 2, system, spawn, ... }`) effect
 * asset body and produces the single normalized {@link ParticleEffectDefinition}.
 * `toRuntimeParticleEffect` collapses that rich form to the flat
 * {@link RuntimeParticleEffect} the current `THREE.Points` renderer consumes.
 *
 * The schema-1 → schema-2 mapping is deliberately reversible on the fields the
 * simple renderer uses, so a schema-1 asset and a schema-2 asset authored to the
 * same runtime params render identically (see the starter round-trip tests). Two
 * reversible encodings do the work:
 *
 * - linear spread jitter  ↔  `spreadAngleDeg`   via `deg = linear * SPREAD_SCALE`
 * - velocity vector       ↔  `direction`+`speed` via unit-direction × magnitude
 *
 * The mapping is best-effort for everything else (schema-1's `spread` also
 * jitters spawn position axis-by-axis, which the cone model does not reproduce
 * exactly) — the plan (§7) accepts "same effect impression", not bit-equality.
 */

import type {
  NumberRange,
  ParticleBlendMode,
  ParticleBounds,
  ParticleEffectDefinition,
  ParticleInitializeBlock,
  ParticleRendererBlock,
  ParticleSpawnBlock,
  ParticleSystemBlock,
  ParticleUpdateBlock,
  RuntimeParticleEffect,
  SortMode,
  SpawnMode,
  SpawnShape,
  Vec3,
} from "./particleEffectTypes";

/** Reversible scale between schema-1 linear spread and schema-2 cone degrees. */
const SPREAD_SCALE = 45;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const SPAWN_MODES: readonly SpawnMode[] = ["rate", "burst"];
const SPAWN_SHAPES: readonly SpawnShape[] = ["point", "sphere", "box", "circle"];
const BLEND_MODES: readonly ParticleBlendMode[] = ["alpha", "additive"];
const SORT_MODES: readonly SortMode[] = ["none", "distance"];

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampMin(value: number, min: number): number {
  return value < min ? min : value;
}

function readBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function readVec3(value: unknown, fallback: Vec3): Vec3 {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((axis) => typeof axis === "number" && Number.isFinite(axis))
  ) {
    return [value[0] as number, value[1] as number, value[2] as number];
  }
  return [...fallback];
}

/**
 * Reads a `[min, max]` range. Accepts a two-number tuple or a single number
 * (widened to `[n, n]`); anything else falls back. Result is ordered `min<=max`.
 */
function readRange(value: unknown, fallback: NumberRange): NumberRange {
  let lo: number;
  let hi: number;
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    lo = value[0];
    hi = value[1];
  } else if (typeof value === "number" && Number.isFinite(value)) {
    lo = value;
    hi = value;
  } else {
    return [fallback[0], fallback[1]];
  }
  return lo <= hi ? [lo, hi] : [hi, lo];
}

function rangeMid(range: NumberRange): number {
  return (range[0] + range[1]) / 2;
}

// ─── schema-2 (native) ───────────────────────────────────────────────────────

function normalizeBounds(value: unknown): ParticleBounds {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    mode: readEnum(data.mode, ["fixed", "autoPreview"] as const, "fixed"),
    min: readVec3(data.min, [-1, 0, -1]),
    max: readVec3(data.max, [1, 2, 1]),
    showInPreview: readBool(data.showInPreview, true),
  };
}

function normalizeSystem(value: unknown): ParticleSystemBlock {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const seed = typeof data.seed === "number" && Number.isFinite(data.seed) ? data.seed : null;
  return {
    enabled: readBool(data.enabled, true),
    loop: readBool(data.loop, false),
    duration: clampMin(finiteNumber(data.duration, 0.5), 0),
    seed,
    maxParticles: Math.round(clampMin(finiteNumber(data.maxParticles, 128), 1)),
    bounds: normalizeBounds(data.bounds),
  };
}

function normalizeSpawn(value: unknown): ParticleSpawnBlock {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    mode: readEnum(data.mode, SPAWN_MODES, "burst"),
    rate: clampMin(finiteNumber(data.rate, 10), 0),
    count: Math.round(clampMin(finiteNumber(data.count, 16), 0)),
    delay: clampMin(finiteNumber(data.delay, 0), 0),
    interval: clampMin(finiteNumber(data.interval, 0), 0),
    shape: readEnum(data.shape, SPAWN_SHAPES, "point"),
    radius: clampMin(finiteNumber(data.radius, 0), 0),
    boxSize: readVec3(data.boxSize, [0, 0, 0]),
  };
}

function normalizeInitialize(value: unknown): ParticleInitializeBlock {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    lifetime: readRange(data.lifetime, [0.5, 1]),
    startSize: readRange(data.startSize, [0.1, 0.2]),
    startColor: readColor(data.startColor, "#ffffff"),
    startOpacity: finiteNumber(data.startOpacity, 1),
    direction: readVec3(data.direction, [0, 1, 0]),
    speed: readRange(data.speed, [0, 1]),
    spreadAngleDeg: clampMin(finiteNumber(data.spreadAngleDeg, 0), 0),
    rotation: readRange(data.rotation, [0, 0]),
    angularVelocity: readRange(data.angularVelocity, [0, 0]),
  };
}

function normalizeUpdate(value: unknown): ParticleUpdateBlock {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    gravityScale: finiteNumber(data.gravityScale, 0),
    drag: clampMin(finiteNumber(data.drag, 0), 0),
    acceleration: readVec3(data.acceleration, [0, 0, 0]),
    endSize: readRange(data.endSize, [0.1, 0.2]),
    endColor: readColor(data.endColor, "#ffffff"),
    endOpacity: finiteNumber(data.endOpacity, 0),
    fadeInTime: clampMin(finiteNumber(data.fadeInTime, 0), 0),
    fadeOutTime: clampMin(finiteNumber(data.fadeOutTime, 0.1), 0),
  };
}

/** A non-empty texture asset id, or null (empty/whitespace/non-string → null). */
function readTextureRef(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRenderer(value: unknown): ParticleRendererBlock {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    type: "sprite",
    blendMode: readEnum(data.blendMode, BLEND_MODES, "alpha"),
    softness: Math.min(1, clampMin(finiteNumber(data.softness, 0.5), 0)),
    sortMode: readEnum(data.sortMode, SORT_MODES, "none"),
    texture: readTextureRef(data.texture),
  };
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && tag.length > 0);
}

function normalizeSchema2(data: Record<string, unknown>): ParticleEffectDefinition {
  return {
    name: typeof data.name === "string" && data.name.length > 0 ? data.name : "FX_NewEffect",
    category: typeof data.category === "string" && data.category.length > 0 ? data.category : "Gameplay",
    tags: readTags(data.tags),
    system: normalizeSystem(data.system),
    spawn: normalizeSpawn(data.spawn),
    initialize: normalizeInitialize(data.initialize),
    update: normalizeUpdate(data.update),
    renderer: normalizeRenderer(data.renderer),
  };
}

// ─── schema-1 (legacy) ───────────────────────────────────────────────────────

/** Splits a velocity vector into a unit direction + `[mag, mag]` speed range. */
function velocityToDirectionSpeed(velocity: Vec3): { direction: Vec3; speed: NumberRange } {
  const mag = Math.hypot(velocity[0], velocity[1], velocity[2]);
  if (mag <= 1e-6) return { direction: [0, 1, 0], speed: [0, 0] };
  return {
    direction: [velocity[0] / mag, velocity[1] / mag, velocity[2] / mag],
    speed: [mag, mag],
  };
}

function normalizeSchema1(data: Record<string, unknown>): ParticleEffectDefinition | null {
  // Preserve the old parser's contract: a schema-1 body without a non-empty
  // effectId is not a valid effect (the id is the manifest join key at runtime).
  if (typeof data.effectId !== "string" || data.effectId.length === 0) return null;

  const loop = data.loop === true;
  const rate = clampMin(finiteNumber(data.rate, 10), 0);
  const lifetime = clampMin(finiteNumber(data.lifetime, 1), 0.01);
  const startSize = clampMin(finiteNumber(data.startSize, 0.2), 0);
  const endSize = clampMin(finiteNumber(data.endSize, 0.2), 0);
  const spread = clampMin(finiteNumber(data.spread, 0), 0);
  const velocity = readVec3(data.velocity, [0, 0, 0]);
  const materialMode: ParticleBlendMode = data.materialMode === "additive" ? "additive" : "alpha";
  const color = readColor(data.color, "#ffffff");
  const { direction, speed } = velocityToDirectionSpeed(velocity);

  return {
    name: typeof data.name === "string" && data.name.length > 0 ? data.name : "FX_NewEffect",
    category: "Gameplay",
    tags: [],
    system: {
      enabled: true,
      loop,
      // The old renderer emits for one lifetime window on a one-shot.
      duration: lifetime,
      seed: null,
      maxParticles: Math.max(8, Math.ceil(rate * lifetime) + 4),
      bounds: { mode: "fixed", min: [-1, 0, -1], max: [1, 2, 1], showInPreview: true },
    },
    spawn: {
      mode: "rate",
      rate,
      count: 16,
      delay: 0,
      interval: 0,
      shape: "point",
      radius: 0,
      boxSize: [0, 0, 0],
    },
    initialize: {
      lifetime: [lifetime, lifetime],
      startSize: [startSize, startSize],
      startColor: color,
      startOpacity: 1,
      direction,
      speed,
      spreadAngleDeg: spread * SPREAD_SCALE,
      rotation: [0, 0],
      angularVelocity: [0, 0],
    },
    update: {
      gravityScale: 0,
      drag: 0,
      acceleration: [0, 0, 0],
      endSize: [endSize, endSize],
      endColor: color,
      endOpacity: 0,
      fadeInTime: 0,
      fadeOutTime: 0.1,
    },
    renderer: { type: "sprite", blendMode: materialMode, softness: 0.5, sortMode: "none", texture: null },
  };
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Normalizes a schema-1 or schema-2 effect asset body to the rich
 * {@link ParticleEffectDefinition}. Returns null for a non-object, an unknown
 * schema version, or a schema-1 body missing its `effectId`.
 */
export function normalizeEffectDefinition(value: unknown): ParticleEffectDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.schema === 2) return normalizeSchema2(data);
  if (data.schema === 1) return normalizeSchema1(data);
  return null;
}

/**
 * Collapses the normalized form to the flat {@link RuntimeParticleEffect} the
 * current `THREE.Points` renderer simulates. Reverses the schema-1 encodings so
 * a schema-1-origin definition round-trips to its original runtime params.
 */
export function toRuntimeParticleEffect(def: ParticleEffectDefinition): RuntimeParticleEffect {
  const speedMid = rangeMid(def.initialize.speed);
  const dir = def.initialize.direction;
  // For burst mode the simple renderer has no burst concept yet; approximate a
  // continuous rate that emits ~count particles across one lifetime window.
  const lifetimeMid = rangeMid(def.initialize.lifetime);
  const rate =
    def.spawn.mode === "rate"
      ? def.spawn.rate
      : def.spawn.count / Math.max(0.05, lifetimeMid);
  return {
    ...(def.name ? { name: def.name } : {}),
    loop: def.system.loop,
    rate,
    lifetime: clampMin(lifetimeMid, 0.01),
    startSize: rangeMid(def.initialize.startSize),
    endSize: rangeMid(def.update.endSize),
    velocity: [dir[0] * speedMid, dir[1] * speedMid, dir[2] * speedMid],
    spread: def.initialize.spreadAngleDeg / SPREAD_SCALE,
    materialMode: def.renderer.blendMode,
    color: def.initialize.startColor,
    ...(def.renderer.texture ? { texture: def.renderer.texture } : {}),
  };
}

/**
 * Convenience: normalize + collapse in one call. Returns the flat runtime effect
 * the renderer needs, or null when the value is not a valid effect body.
 */
export function parseRuntimeParticleEffect(value: unknown): RuntimeParticleEffect | null {
  const def = normalizeEffectDefinition(value);
  return def ? toRuntimeParticleEffect(def) : null;
}

/**
 * Minimal CPU-simulated particle effect for the runtime VFX path. Renders a
 * pre-authored effect asset (`.effect.json`) as a `THREE.Points` cloud with soft
 * round, color-tinted particles. Emission is driven by `rate`/`lifetime`; each
 * particle ages out, growing `startSize`→`endSize` and fading. A non-looping
 * effect emits for one `lifetime` window then finishes.
 *
 * Deliberately simple (no textures, no GPU sim, no sub-emitters) — a first VFX
 * version that makes authored effects visible on Play. The class consumes the
 * flat {@link RuntimeParticleEffect} collapsed by `engine/vfx/particleEffectParser`
 * from either schema; parsing/normalization is pure and headless-testable, while
 * this renderer class is Three.js glue like the other render-three modules.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

import type { RuntimeParticleEffect, Vec3 } from "../vfx/particleEffectTypes";

/**
 * Per-instance overrides a {@link ParticleEmitterComponent} applies on top of the
 * shared effect asset (VFX Lite §8). All optional; absent means "use the asset's
 * own value", so an emitter with no overrides renders identically to the asset.
 */
export interface ParticleEffectOverrides {
  /** Uniform scale on particle size, spawn spread and velocity (default 1). */
  scale?: number;
  /** Hex tint (`#rrggbb`) replacing the effect's colour. */
  tint?: string;
  /** Force looping on/off for this instance; absent keeps the asset's own loop. */
  loop?: boolean;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Back-compat aliases: the runtime path (RuntimeSceneApp) and tests reference the
// flat runtime effect + the normalize→collapse entry point through these names.
export {
  normalizeEffectDefinition,
  parseRuntimeParticleEffect,
  parseRuntimeParticleEffect as parseEffectDefinition,
  toRuntimeParticleEffect,
} from "../vfx/particleEffectParser";
export type { RuntimeParticleEffect as EffectDefinition } from "../vfx/particleEffectTypes";
export type { ParticleBlendMode as EffectMaterialMode } from "../vfx/particleEffectTypes";

const POINT_PIXEL_SCALE = 320;

const VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (uScale / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, dist);
  gl_FragColor = vec4(uColor, vAlpha * soft);
}
`;

/** A live, CPU-simulated instance of an effect definition, ready to add to a scene. */
export class ParticleEffect {
  readonly object3D: Points;
  private readonly capacity: number;
  // Effective (override-applied) simulation params; see ParticleEffectOverrides.
  private readonly loop: boolean;
  private readonly lifetime: number;
  private readonly rate: number;
  private readonly startSize: number;
  private readonly endSize: number;
  private readonly velocity: Vec3;
  private readonly spread: number;
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  /** Per-particle age in seconds; negative marks an inactive slot. */
  private readonly ages: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly origin: [number, number, number] = [0, 0, 0];
  private elapsed = 0;
  private spawnAccumulator = 0;

  constructor(definition: RuntimeParticleEffect, overrides?: ParticleEffectOverrides) {
    // `scale` uniformly grows sizes, spawn spread and velocity (so particles reach
    // a proportionally larger extent in the same lifetime); rate/lifetime are
    // unaffected, so buffer capacity matches the un-scaled effect.
    const scale =
      typeof overrides?.scale === "number" && Number.isFinite(overrides.scale) && overrides.scale > 0
        ? overrides.scale
        : 1;
    this.loop = overrides?.loop ?? definition.loop;
    this.lifetime = definition.lifetime;
    this.rate = definition.rate;
    this.startSize = definition.startSize * scale;
    this.endSize = definition.endSize * scale;
    this.velocity = [
      definition.velocity[0] * scale,
      definition.velocity[1] * scale,
      definition.velocity[2] * scale,
    ];
    this.spread = definition.spread * scale;
    const color =
      typeof overrides?.tint === "string" && HEX_COLOR.test(overrides.tint)
        ? overrides.tint
        : definition.color;
    // Max particles alive at once ≈ rate * lifetime; pad for spawn jitter.
    this.capacity = Math.max(8, Math.ceil(this.rate * this.lifetime) + 4);
    this.positions = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity);
    this.velocities = new Float32Array(this.capacity * 3);
    this.ages = new Float32Array(this.capacity).fill(-1);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute("aSize", new BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute("aAlpha", new BufferAttribute(this.alphas, 1));
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(color) },
        uScale: { value: POINT_PIXEL_SCALE },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: definition.materialMode === "additive" ? AdditiveBlending : NormalBlending,
    });
    this.object3D = new Points(this.geometry, this.material);
    // Particles move past the emitter origin; skip frustum culling so the cloud
    // is not clipped by its (stationary) bounding sphere.
    this.object3D.frustumCulled = false;
  }

  /** Sets the emitter origin (world space) new particles spawn from. */
  setOrigin(x: number, y: number, z: number): void {
    this.origin[0] = x;
    this.origin[1] = y;
    this.origin[2] = z;
  }

  /** Advances the simulation by `dt` seconds and uploads the updated buffers. */
  update(dt: number): void {
    if (dt <= 0) return;
    const { lifetime, rate, startSize, endSize, loop } = this;
    this.elapsed += dt;

    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! < 0) continue;
      const age = this.ages[i]! + dt;
      if (age >= lifetime) {
        this.ages[i] = -1;
        this.sizes[i] = 0;
        this.alphas[i] = 0;
        continue;
      }
      this.ages[i] = age;
      const t = age / lifetime;
      const base = i * 3;
      this.positions[base] = this.positions[base]! + this.velocities[base]! * dt;
      this.positions[base + 1] = this.positions[base + 1]! + this.velocities[base + 1]! * dt;
      this.positions[base + 2] = this.positions[base + 2]! + this.velocities[base + 2]! * dt;
      this.sizes[i] = startSize + (endSize - startSize) * t;
      this.alphas[i] = 1 - t;
    }

    // A looping effect emits forever; a one-shot emits for one lifetime window.
    if (loop || this.elapsed <= lifetime) {
      this.spawnAccumulator += rate * dt;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawnParticle();
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aSize!.needsUpdate = true;
    this.geometry.attributes.aAlpha!.needsUpdate = true;
  }

  /** A non-looping effect is finished once it stopped emitting and all particles died. */
  isFinished(): boolean {
    if (this.loop) return false;
    if (this.elapsed <= this.lifetime) return false;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! >= 0) return false;
    }
    return true;
  }

  /** Particles currently alive (age >= 0). Preview/diagnostics only. */
  aliveCount(): number {
    let alive = 0;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! >= 0) alive += 1;
    }
    return alive;
  }

  /** Max particles this instance can hold at once (simulation buffer size). */
  get maxCapacity(): number {
    return this.capacity;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private spawnParticle(): void {
    let slot = -1;
    for (let i = 0; i < this.capacity; i += 1) {
      if (this.ages[i]! < 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    const { spread, velocity, startSize } = this;
    const jitter = (): number => (Math.random() * 2 - 1) * spread;
    this.ages[slot] = 0;
    this.positions[slot * 3] = this.origin[0] + jitter() * 0.2;
    this.positions[slot * 3 + 1] = this.origin[1];
    this.positions[slot * 3 + 2] = this.origin[2] + jitter() * 0.2;
    this.velocities[slot * 3] = velocity[0] + jitter();
    this.velocities[slot * 3 + 1] = velocity[1] + (Math.random() * 2 - 1) * spread * 0.3;
    this.velocities[slot * 3 + 2] = velocity[2] + jitter();
    this.sizes[slot] = startSize;
    this.alphas[slot] = 1;
  }
}

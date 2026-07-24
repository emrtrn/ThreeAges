import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Texture,
} from "three";

import type { ForgeLandscapeData, ForgeLandscapeSpline, LandscapeSplinePolylineSample } from "@engine/scene/landscape";
import { landscapeHeightAtLocal, splineToPolyline } from "@engine/scene/landscape";
import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedRiverWater } from "@engine/scene/riverWater";

export { resolveRiverWater, RIVER_WATER_DEFAULTS, uniqueRiverWaterId, type ResolvedRiverWater } from "@engine/scene/riverWater";

/** Pure ribbon arrays, kept inspectable for engine tests without a WebGL context. */
export interface RiverWaterRibbonData {
  positions: number[];
  uvs: number[];
  flowDirections: number[];
  shoreDistances: number[];
  waterDepths: number[];
  rapidness: number[];
  indices: number[];
}

export interface BuildRiverWaterRibbonOptions {
  surfaceLevel: number;
  widthScale: number;
  /** Maximum centreline spacing in world units. */
  sampleSpacing?: number;
  /** World units represented by one U repeat of the normal texture. */
  normalTileLength?: number;
  /** Optional Landscape data used to bake shallow/deep water into the ribbon. */
  landscapeData?: ForgeLandscapeData;
}

interface RiverSample extends LandscapeSplinePolylineSample {
  distance: number;
}

const EPSILON = 1e-5;
const DEFAULT_SAMPLE_SPACING = 1.25;
const DEFAULT_NORMAL_TILE_LENGTH = 3;

/**
 * Resolves the common directed Landscape-spline case into continuous chains.
 * Branches become independent strips in the same geometry until the dedicated
 * junction/flow-map phase supplies a junction patch.
 */
function riverChains(spline: ForgeLandscapeSpline, sampleSpacing: number): RiverSample[][] {
  const piecesBySegment = new Map<string, LandscapeSplinePolylineSample[]>();
  for (const sub of splineToPolyline(spline, 24)) {
    const pieces = piecesBySegment.get(sub.segment.id) ?? [];
    if (pieces.length === 0) pieces.push(sub.start);
    const dx = sub.end.position[0] - sub.start.position[0];
    const dy = sub.end.position[1] - sub.start.position[1];
    const dz = sub.end.position[2] - sub.start.position[2];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / sampleSpacing));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      pieces.push({
        position: [sub.start.position[0] + dx * t, sub.start.position[1] + dy * t, sub.start.position[2] + dz * t],
        width: sub.start.width + (sub.end.width - sub.start.width) * t,
        falloff: sub.start.falloff + (sub.end.falloff - sub.start.falloff) * t,
      });
    }
    piecesBySegment.set(sub.segment.id, pieces);
  }

  const outgoing = new Map<string, typeof spline.segments>();
  const incoming = new Set<string>();
  for (const segment of spline.segments) {
    const list = outgoing.get(segment.startPointId) ?? [];
    list.push(segment);
    outgoing.set(segment.startPointId, list);
    incoming.add(segment.endPointId);
  }
  const starts = spline.segments.filter((segment) => !incoming.has(segment.startPointId));
  const pending = [...starts, ...spline.segments];
  const used = new Set<string>();
  const chains: RiverSample[][] = [];
  for (const seed of pending) {
    if (used.has(seed.id)) continue;
    const samples: LandscapeSplinePolylineSample[] = [];
    let segment: typeof spline.segments[number] | undefined = seed;
    while (segment && !used.has(segment.id)) {
      used.add(segment.id);
      const piece = piecesBySegment.get(segment.id) ?? [];
      samples.push(...(samples.length === 0 ? piece : piece.slice(1)));
      segment = (outgoing.get(segment.endPointId) ?? []).find((next) => !used.has(next.id));
    }
    if (samples.length < 2) continue;
    let distance = 0;
    chains.push(samples.map((sample, index) => {
      if (index > 0) {
        const previous = samples[index - 1]!.position;
        distance += Math.hypot(sample.position[0] - previous[0], sample.position[1] - previous[1], sample.position[2] - previous[2]);
      }
      return { ...sample, distance };
    }));
  }
  return chains;
}

/** Builds 5-wide spline ribbon geometry with arc-length UVs and per-vertex flow data. */
export function buildRiverWaterRibbon(
  spline: ForgeLandscapeSpline,
  options: BuildRiverWaterRibbonOptions,
): RiverWaterRibbonData {
  const positions: number[] = [];
  const uvs: number[] = [];
  const flowDirections: number[] = [];
  const shoreDistances: number[] = [];
  const waterDepths: number[] = [];
  const rapidness: number[] = [];
  const indices: number[] = [];
  const width = 5;
  const tileLength = Math.max(EPSILON, options.normalTileLength ?? DEFAULT_NORMAL_TILE_LENGTH);
  let vertexBase = 0;
  for (const chain of riverChains(spline, Math.max(0.25, options.sampleSpacing ?? DEFAULT_SAMPLE_SPACING))) {
    for (let index = 0; index < chain.length; index += 1) {
      const sample = chain[index]!;
      const previous = chain[Math.max(0, index - 1)]!;
      const next = chain[Math.min(chain.length - 1, index + 1)]!;
      const dx = next.position[0] - previous.position[0];
      const dz = next.position[2] - previous.position[2];
      const length = Math.hypot(dx, dz) || 1;
      const flowX = dx / length;
      const flowZ = dz / length;
      const previousDx = sample.position[0] - previous.position[0];
      const previousDz = sample.position[2] - previous.position[2];
      const nextDx = next.position[0] - sample.position[0];
      const nextDz = next.position[2] - sample.position[2];
      const previousLength = Math.hypot(previousDx, previousDz) || 1;
      const nextLength = Math.hypot(nextDx, nextDz) || 1;
      const turn = 1 - Math.max(-1, Math.min(1, (previousDx * nextDx + previousDz * nextDz) / (previousLength * nextLength)));
      const slope = Math.abs(next.position[1] - previous.position[1]) / Math.max(length, EPSILON);
      const localRapidness = Math.min(1, turn * 1.5 + slope * 0.75);
      const sideX = -flowZ;
      const sideZ = flowX;
      for (let lateral = 0; lateral < width; lateral += 1) {
        const v = lateral / (width - 1);
        const offset = (v - 0.5) * 2 * sample.width * options.widthScale;
        positions.push(sample.position[0] + sideX * offset, options.surfaceLevel, sample.position[2] + sideZ * offset);
        uvs.push(sample.distance / tileLength, v);
        flowDirections.push(flowX, flowZ);
        shoreDistances.push(Math.abs(v - 0.5) * 2);
        const terrainHeight = options.landscapeData
          ? landscapeHeightAtLocal(options.landscapeData, sample.position[0] + sideX * offset, sample.position[2] + sideZ * offset)
          : options.surfaceLevel - 1;
        waterDepths.push(Math.max(0, options.surfaceLevel - terrainHeight));
        rapidness.push(localRapidness);
      }
    }
    for (let row = 0; row < chain.length - 1; row += 1) {
      for (let lateral = 0; lateral < width - 1; lateral += 1) {
        const a = vertexBase + row * width + lateral;
        const b = a + width;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    vertexBase += chain.length * width;
  }
  return { positions, uvs, flowDirections, shoreDistances, waterDepths, rapidness, indices };
}

const VERTEX_SHADER = `
attribute vec2 flowDirection;
attribute float shoreDistance;
attribute float waterDepth;
attribute float rapidness;
varying vec2 vRiverUv;
varying float vShoreDistance;
varying float vWaterDepth;
varying float vRapidness;
uniform float time;
uniform float flowSpeed;
uniform float waveAmplitude;
uniform float waveLength;
void main() {
  vRiverUv = uv;
  vShoreDistance = shoreDistance;
  vWaterDepth = waterDepth;
  vRapidness = rapidness;
  float centreWeight = pow(max(0.0, 1.0 - shoreDistance), 1.6);
  float wavePhase = uv.x * 6.283185 / max(waveLength, 0.01) - time * flowSpeed * 2.0;
  float wave = sin(wavePhase) + sin(wavePhase * 1.73 + uv.y * 5.0) * 0.35;
  vec3 displaced = position;
  displaced.y += wave * waveAmplitude * centreWeight * (0.65 + rapidness * 0.35);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}`;

const FRAGMENT_SHADER = `
uniform sampler2D normalMap;
uniform float time;
uniform float flowSpeed;
uniform float normalScale;
uniform float hasNormalMap;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform float opacity;
uniform float foamIntensity;
varying vec2 vRiverUv;
varying float vShoreDistance;
varying float vWaterDepth;
varying float vRapidness;
void main() {
  vec2 baseUv = vec2(vRiverUv.x * normalScale, vRiverUv.y * normalScale);
  vec2 normalA = texture2D(normalMap, baseUv - vec2(time * flowSpeed, 0.0)).xy * 2.0 - 1.0;
  vec2 normalB = texture2D(normalMap, baseUv * 1.37 + vec2(0.37, 0.61) - vec2(time * flowSpeed * 0.73, 0.0)).xy * 2.0 - 1.0;
  float phase = 0.5 + 0.5 * sin(time * flowSpeed * 1.4);
  float ripple = hasNormalMap * dot(mix(normalA, normalB, phase), vec2(0.07));
  float depth = clamp(vWaterDepth / 2.2, 0.0, 1.0);
  vec3 color = mix(shallowColor, deepColor, depth) + ripple;
  float shoreNoise = 0.5 + 0.5 * sin(vRiverUv.x * 9.0 - time * flowSpeed * 3.0 + sin(vRiverUv.x * 2.7));
  float shoreFoam = smoothstep(0.56, 0.96, vShoreDistance) * shoreNoise;
  float rapidFoam = smoothstep(0.16, 0.75, vRapidness) * (0.45 + 0.55 * shoreNoise);
  float foam = clamp((shoreFoam + rapidFoam) * foamIntensity, 0.0, 1.0);
  color = mix(color, vec3(0.84, 0.93, 0.91), foam * 0.72);
  float alpha = opacity * mix(0.58, 1.0, depth);
  gl_FragColor = vec4(color, alpha);
}`;

export interface RiverWaterRenderItem extends ResolvedRiverWater {
  spline: ForgeLandscapeSpline;
  landscapeData: ForgeLandscapeData;
  position: Vec3;
  rotation: Vec3;
}

export class RiverWaterObject extends Mesh<BufferGeometry, ShaderMaterial> {
  readonly isRiverWaterObject = true;

  constructor(item: RiverWaterRenderItem, normalMap: Texture | null) {
    const ribbon = buildRiverWaterRibbon(item.spline, {
      surfaceLevel: item.surfaceLevel,
      widthScale: item.widthScale,
      landscapeData: item.landscapeData,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(ribbon.positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(ribbon.uvs, 2));
    geometry.setAttribute("flowDirection", new Float32BufferAttribute(ribbon.flowDirections, 2));
    geometry.setAttribute("shoreDistance", new Float32BufferAttribute(ribbon.shoreDistances, 1));
    geometry.setAttribute("waterDepth", new Float32BufferAttribute(ribbon.waterDepths, 1));
    geometry.setAttribute("rapidness", new Float32BufferAttribute(ribbon.rapidness, 1));
    geometry.setIndex(ribbon.indices);
    geometry.computeBoundingSphere();
    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        normalMap: { value: normalMap },
        time: { value: 0 },
        flowSpeed: { value: item.flowSpeed },
        normalScale: { value: item.normalScale },
        hasNormalMap: { value: normalMap ? 1 : 0 },
        deepColor: { value: new Color(item.deepColor) },
        shallowColor: { value: new Color(item.shallowColor) },
        opacity: { value: item.opacity },
        waveAmplitude: { value: item.waveAmplitude },
        waveLength: { value: item.waveLength },
        foamIntensity: { value: item.foamIntensity },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    super(geometry, material);
    this.name = item.name;
    this.position.set(...item.position);
    this.rotation.set(
      (item.rotation[0] * Math.PI) / 180,
      (item.rotation[1] * Math.PI) / 180,
      (item.rotation[2] * Math.PI) / 180,
      "XYZ",
    );
    this.visible = !item.hidden;
    // Water is a visual transparent overlay: it neither writes opaque depth nor
    // participates in shadow maps/collision, leaving terrain and RTS blockers as
    // their respective render/gameplay authorities.
    this.castShadow = false;
    this.receiveShadow = false;
    this.renderOrder = 1;
    this.onBeforeRender = () => {
      this.material.uniforms["time"]!.value = performance.now() / 1000;
    };
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export type RiverWaterObjectLike = RiverWaterObject;

export function createRiverWaterObject(item: RiverWaterRenderItem, normalMap: Texture | null): RiverWaterObject {
  return new RiverWaterObject(item, normalMap);
}

export function disposeRiverWaterObject(object: RiverWaterObjectLike): void {
  object.dispose();
}

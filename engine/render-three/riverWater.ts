import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Texture,
} from "three";

import type { ForgeLandscapeData, ForgeLandscapeSpline, LandscapeSplinePolylineSample } from "@engine/scene/landscape";
import { landscapeHeightAtLocal, splineToPolyline } from "@engine/scene/landscape";
import type {
  LayoutRiverWaterFoamStamp,
  LayoutRiverWaterSegmentProfile,
  Vec3,
} from "@engine/scene/layout";
import type { ResolvedRiverWater } from "@engine/scene/riverWater";
import type { PlanarReflectionSource } from "./planarReflectionSource";

export { resolveRiverWater, RIVER_WATER_DEFAULTS, uniqueRiverWaterId, type ResolvedRiverWater } from "@engine/scene/riverWater";

/** Pure ribbon arrays, kept inspectable for engine tests without a WebGL context. */
export interface RiverWaterRibbonData {
  positions: number[];
  uvs: number[];
  flowDirections: number[];
  shoreDistances: number[];
  waterDepths: number[];
  rapidness: number[];
  foamMasks: number[];
  flowSpeedMultipliers: number[];
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
  /** Static foam masks, evaluated into vertices when the river geometry is built. */
  foamStamps?: readonly LayoutRiverWaterFoamStamp[];
  /** Per-segment flow/rapid overrides keyed by the Landscape spline segment id. */
  segmentProfiles?: readonly LayoutRiverWaterSegmentProfile[];
}

interface RiverPolylineSample extends LandscapeSplinePolylineSample {
  segmentId: string;
}

interface RiverSample extends RiverPolylineSample {
  distance: number;
}

const EPSILON = 1e-5;
const DEFAULT_SAMPLE_SPACING = 1.25;
const STATIC_FOAM_SAMPLE_SPACING = 0.75;
const DEFAULT_NORMAL_TILE_LENGTH = 3;

/**
 * Resolves the common directed Landscape-spline case into continuous chains.
 * Branches become independent strips in the same geometry until the dedicated
 * junction/flow-map phase supplies a junction patch.
 */
function riverChains(spline: ForgeLandscapeSpline, sampleSpacing: number): RiverSample[][] {
  const piecesBySegment = new Map<string, RiverPolylineSample[]>();
  for (const sub of splineToPolyline(spline, 24)) {
    const pieces = piecesBySegment.get(sub.segment.id) ?? [];
    if (pieces.length === 0) pieces.push({ ...sub.start, segmentId: sub.segment.id });
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
        segmentId: sub.segment.id,
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
    const samples: RiverPolylineSample[] = [];
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

function pointToSegmentDistanceXZ(
  pointX: number,
  pointZ: number,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): number {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared <= EPSILON ? 0 : Math.max(0, Math.min(1, ((pointX - startX) * dx + (pointZ - startZ) * dz) / lengthSquared));
  return Math.hypot(pointX - (startX + dx * t), pointZ - (startZ + dz * t));
}

function staticFoamMask(
  foamStamps: readonly LayoutRiverWaterFoamStamp[] | undefined,
  x: number,
  z: number,
): number {
  if (!foamStamps?.length) return 0;
  let mask = 0;
  for (const stamp of foamStamps) {
    const end = stamp.kind === "strip" ? stamp.endPosition ?? stamp.position : stamp.position;
    const distance = pointToSegmentDistanceXZ(x, z, stamp.position[0], stamp.position[2], end[0], end[2]);
    const falloff = Math.max(0, 1 - distance / Math.max(EPSILON, stamp.radius));
    // Smoothstep keeps a readable core and a soft outer edge. Squaring the
    // falloff made a point stamp disappear between this ribbon's sparse rows.
    const feathered = falloff * falloff * (3 - 2 * falloff);
    mask = Math.max(mask, stamp.intensity * feathered);
  }
  return mask;
}

/** Builds a spline ribbon with arc-length UVs and per-vertex flow data. */
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
  const foamMasks: number[] = [];
  const flowSpeedMultipliers: number[] = [];
  const indices: number[] = [];
  const hasStaticFoam = (options.foamStamps?.length ?? 0) > 0;
  // Static masks are baked at vertices, so add only the resolution needed to
  // make authored rock/pier foam legible; ordinary rivers keep their cheaper 5-wide grid.
  const width = hasStaticFoam ? 9 : 5;
  const tileLength = Math.max(EPSILON, options.normalTileLength ?? DEFAULT_NORMAL_TILE_LENGTH);
  const profiles = new Map((options.segmentProfiles ?? []).map((profile) => [profile.splineSegmentRef, profile]));
  let vertexBase = 0;
  const requestedSpacing = options.sampleSpacing ?? DEFAULT_SAMPLE_SPACING;
  const sampleSpacing = hasStaticFoam
    ? Math.min(requestedSpacing, STATIC_FOAM_SAMPLE_SPACING)
    : requestedSpacing;
  for (const chain of riverChains(spline, Math.max(0.25, sampleSpacing))) {
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
      const profile = profiles.get(sample.segmentId);
      const segmentRapidness = Math.max(localRapidness, profile?.rapidness ?? 0);
      const flowSpeedMultiplier = profile?.flowSpeedMultiplier ?? 1;
      const sideX = -flowZ;
      const sideZ = flowX;
      for (let lateral = 0; lateral < width; lateral += 1) {
        const v = lateral / (width - 1);
        const offset = (v - 0.5) * 2 * sample.width * options.widthScale;
        const x = sample.position[0] + sideX * offset;
        const z = sample.position[2] + sideZ * offset;
        positions.push(x, options.surfaceLevel, z);
        uvs.push(sample.distance / tileLength, v);
        flowDirections.push(flowX, flowZ);
        shoreDistances.push(Math.abs(v - 0.5) * 2);
        const terrainHeight = options.landscapeData
          ? landscapeHeightAtLocal(options.landscapeData, x, z)
          : options.surfaceLevel - 1;
        waterDepths.push(Math.max(0, options.surfaceLevel - terrainHeight));
        rapidness.push(segmentRapidness);
        foamMasks.push(staticFoamMask(options.foamStamps, x, z));
        flowSpeedMultipliers.push(flowSpeedMultiplier);
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
  return { positions, uvs, flowDirections, shoreDistances, waterDepths, rapidness, foamMasks, flowSpeedMultipliers, indices };
}

const VERTEX_SHADER = `
attribute vec2 flowDirection;
attribute float shoreDistance;
attribute float waterDepth;
attribute float rapidness;
attribute float foamMask;
attribute float flowSpeedMultiplier;
varying vec2 vRiverUv;
varying float vShoreDistance;
varying float vWaterDepth;
varying float vRapidness;
varying float vFoamMask;
varying float vFlowSpeedMultiplier;
varying vec4 vReflectionUv;
uniform float time;
uniform float flowSpeed;
uniform float waveAmplitude;
uniform float waveLength;
uniform mat4 reflectionTextureMatrix;
void main() {
  vRiverUv = uv;
  vShoreDistance = shoreDistance;
  vWaterDepth = waterDepth;
  vRapidness = rapidness;
  vFoamMask = foamMask;
  vFlowSpeedMultiplier = flowSpeedMultiplier;
  float centreWeight = pow(max(0.0, 1.0 - shoreDistance), 1.6);
  float wavePhase = uv.x * 6.283185 / max(waveLength, 0.01) - time * flowSpeed * flowSpeedMultiplier * 2.0;
  float wave = sin(wavePhase) + sin(wavePhase * 1.73 + uv.y * 5.0) * 0.35;
  vec3 displaced = position;
  displaced.y += wave * waveAmplitude * centreWeight * (0.65 + rapidness * 0.35);
  vReflectionUv = reflectionTextureMatrix * modelMatrix * vec4(displaced, 1.0);
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
uniform float bedVisibility;
uniform float absorptionDistance;
uniform float foamIntensity;
uniform sampler2D reflectionTexture;
uniform float reflectionStrength;
varying vec2 vRiverUv;
varying float vShoreDistance;
varying float vWaterDepth;
varying float vRapidness;
varying float vFoamMask;
varying float vFlowSpeedMultiplier;
varying vec4 vReflectionUv;
void main() {
  vec2 baseUv = vec2(vRiverUv.x * normalScale, vRiverUv.y * normalScale);
  vec2 normalA = texture2D(normalMap, baseUv - vec2(time * flowSpeed * vFlowSpeedMultiplier, 0.0)).xy * 2.0 - 1.0;
  vec2 normalB = texture2D(normalMap, baseUv * 1.37 + vec2(0.37, 0.61) - vec2(time * flowSpeed * vFlowSpeedMultiplier * 0.73, 0.0)).xy * 2.0 - 1.0;
  float phase = 0.5 + 0.5 * sin(time * flowSpeed * vFlowSpeedMultiplier * 1.4);
  float ripple = hasNormalMap * dot(mix(normalA, normalB, phase), vec2(0.07));
  float depth = clamp(vWaterDepth / 2.2, 0.0, 1.0);
  // A ribbon edge can sit over terrain that is already well below the water
  // plane, so waterDepth alone cannot make a readable shallow bank. Blend the
  // explicit shore coordinate into the colour/alpha transition as well.
  float shore = smoothstep(0.38, 0.98, vShoreDistance);
  float shallow = max(1.0 - depth, shore * 0.78);
  vec3 color = mix(deepColor, shallowColor, shallow) + ripple;
  float flowStreak = 0.5 + 0.5 * sin(vRiverUv.x * 13.0 - time * flowSpeed * vFlowSpeedMultiplier * 5.0 + normalA.x * 4.0);
  color += (flowStreak - 0.5) * (0.012 + depth * 0.008);
  float shoreNoise = 0.5 + 0.5 * sin(vRiverUv.x * 9.0 - time * flowSpeed * vFlowSpeedMultiplier * 3.0 + sin(vRiverUv.x * 2.7));
  float shoreFoam = smoothstep(0.56, 0.96, vShoreDistance) * shoreNoise;
  float rapidFoam = smoothstep(0.16, 0.75, vRapidness) * (0.45 + 0.55 * shoreNoise);
  float authoredFoam = vFoamMask * (0.72 + 0.28 * shoreNoise);
  float foam = clamp((shoreFoam + rapidFoam) * foamIntensity + authoredFoam, 0.0, 1.0);
  color = mix(color, vec3(0.84, 0.93, 0.91), foam * 0.78);
  vec2 reflectionUv = vReflectionUv.xy / max(vReflectionUv.w, 0.0001);
  reflectionUv += mix(normalA, normalB, phase) * 0.025;
  vec3 reflected = texture2D(reflectionTexture, reflectionUv).rgb;
  float reflectionAmount = reflectionStrength * (0.15 + depth * 0.2) * (1.0 - foam * 0.65);
  color = mix(color, reflected, clamp(reflectionAmount, 0.0, 0.45));
  // Overall opacity alone cannot conceal the terrain where a river is shallow:
  // alpha is deliberately reduced there for a readable bank. This separate
  // Beer-Lambert-style transmission term gives authors an explicit clear-water
  // control. At Bed Visibility 0 the riverbed is fully hidden, even at the
  // shallow edge; deeper terrain is absorbed increasingly quickly.
  float bedTransmission = clamp(bedVisibility, 0.0, 1.0) * exp(-max(vWaterDepth, 0.0) / max(absorptionDistance, 0.01));
  float bedOpacity = 1.0 - bedTransmission;
  float alpha = max(opacity * mix(0.62, 1.0, depth) * mix(1.0, 0.7, shore), bedOpacity);
  gl_FragColor = vec4(color, alpha);
}`;

export interface RiverWaterRenderItem extends ResolvedRiverWater {
  spline: ForgeLandscapeSpline;
  landscapeData: ForgeLandscapeData;
  position: Vec3;
  rotation: Vec3;
  /** Optional shared source; absent covers off/low reflection profiles. */
  reflectionSource?: PlanarReflectionSource | null;
}

export class RiverWaterObject extends Mesh<BufferGeometry, ShaderMaterial> {
  readonly isRiverWaterObject = true;

  constructor(item: RiverWaterRenderItem, normalMap: Texture | null) {
    const ribbon = buildRiverWaterRibbon(item.spline, {
      surfaceLevel: item.surfaceLevel,
      widthScale: item.widthScale,
      landscapeData: item.landscapeData,
      foamStamps: item.foamStamps,
      segmentProfiles: item.segmentProfiles,
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(ribbon.positions, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(ribbon.uvs, 2));
    geometry.setAttribute("flowDirection", new Float32BufferAttribute(ribbon.flowDirections, 2));
    geometry.setAttribute("shoreDistance", new Float32BufferAttribute(ribbon.shoreDistances, 1));
    geometry.setAttribute("waterDepth", new Float32BufferAttribute(ribbon.waterDepths, 1));
    geometry.setAttribute("rapidness", new Float32BufferAttribute(ribbon.rapidness, 1));
    geometry.setAttribute("foamMask", new Float32BufferAttribute(ribbon.foamMasks, 1));
    geometry.setAttribute("flowSpeedMultiplier", new Float32BufferAttribute(ribbon.flowSpeedMultipliers, 1));
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
        bedVisibility: { value: item.bedVisibility },
        absorptionDistance: { value: item.absorptionDistance },
        waveAmplitude: { value: item.waveAmplitude },
        waveLength: { value: item.waveLength },
        foamIntensity: { value: item.foamIntensity },
        reflectionTexture: { value: item.reflectionSource?.binding.texture ?? null },
        reflectionTextureMatrix: { value: item.reflectionSource?.binding.textureMatrix ?? new Matrix4() },
        reflectionStrength: { value: item.reflectionSource?.binding.strength ?? 0 },
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
    item.reflectionSource?.addConsumer(this);
    this.onBeforeRender = (renderer, scene, camera) => {
      this.material.uniforms["time"]!.value = performance.now() / 1000;
      item.reflectionSource?.update(renderer, scene, camera);
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

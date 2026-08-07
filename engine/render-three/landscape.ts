import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  type Texture,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import {
  LANDSCAPE_DEFAULT_LAYERS,
  LANDSCAPE_QUADS_PER_CHUNK,
  ensureLandscapeLayers,
  type ForgeLandscapeData,
  type ResolvedLandscape,
} from "@engine/scene/landscape";

export {
  DEFAULT_LANDSCAPE_MATERIAL,
  resolveLandscape,
  LANDSCAPE_DEFAULTS,
  LANDSCAPE_DEFAULT_LAYERS,
  uniqueLandscapeId,
  uniqueLandscapeName,
  landscapeSizeForPreset,
  createFlatLandscapeData,
  createLandscapeColliderPrimitive,
  landscapeDataPath,
  ensureLandscapeLayers,
  normalizeLandscapeLayerWeights,
  resampleLandscapeHeightmap,
  landscapeHeightsToGrayscale,
  resampleLandscapeData,
  applyLandscapeSplineDeform,
  applyLandscapeSplinePaint,
  computeLandscapeSplineMeshInstances,
  splineToPolyline,
  landscapeSplineMeshAssetIds,
  LANDSCAPE_MIN_VERTICES,
  LANDSCAPE_MAX_VERTICES,
  LANDSCAPE_QUADS_PER_CHUNK,
  type ResolvedLandscape,
  type ForgeLandscapeData,
  type ForgeLandscapeMaterialDef,
  type LandscapeSize,
  type LandscapeSizePreset,
  type LandscapeLayerWeights,
  type LandscapeDefaultLayer,
  type LandscapeLayerId,
  type ForgeLandscapeSpline,
  type ForgeLandscapeSplinePoint,
  type ForgeLandscapeSplineSegment,
} from "@engine/scene/landscape";

/**
 * Landscape render binding — the web/three counterpart to Unreal's Landscape
 * actor. Faz 1 builds a flat chunked heightfield mesh from the sidecar's
 * `heights` array; the actor's transform (position/rotation) places it in the
 * world (there is no transform scale — terrain size is fixed by the sidecar's
 * `size`). Normals are computed on the CPU from neighboring heights.
 *
 * The mesh is split into `quadsPerChunk`-sized chunk meshes (Faz 1 doesn't
 * dirty-track individual chunks yet — that lands with Faz 2 sculpt — but
 * building chunked from day one avoids a reshape later).
 */

/** The three.js object backing a Landscape actor: one child mesh per chunk. */
export type LandscapeObject = Group;

export interface LandscapeDirtyBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type LandscapeViewMode = "lit" | "height" | "slope" | "layer";

/** Four albedo, four normal and four ORM maps in the full Landscape PBR variant. */
export const LANDSCAPE_PBR_TEXTURE_SAMPLERS = 12;
/** Leave room for the host's shadow/environment samplers on the desktop target. */
export const LANDSCAPE_PBR_MIN_TEXTURE_UNITS = 16;

export interface LandscapeSamplerBudget {
  availableTextureUnits: number | null;
  requiredTextureUnits: number;
  pbrEnabled: boolean;
  fallback: "none" | "albedo-only";
}

/**
 * Chooses the full 12-sampler PBR variant only when the host reports enough
 * fragment texture units. Unknown capability preserves the legacy/full path;
 * a known constrained device gets a deliberate four-albedo-sampler fallback.
 */
export function resolveLandscapeSamplerBudget(maxTextureUnits?: number): LandscapeSamplerBudget {
  const availableTextureUnits = Number.isFinite(maxTextureUnits)
    ? Math.max(0, Math.floor(maxTextureUnits!))
    : null;
  const pbrEnabled = availableTextureUnits === null || availableTextureUnits >= LANDSCAPE_PBR_MIN_TEXTURE_UNITS;
  return {
    availableTextureUnits,
    requiredTextureUnits: LANDSCAPE_PBR_TEXTURE_SAMPLERS,
    pbrEnabled,
    fallback: pbrEnabled ? "none" : "albedo-only",
  };
}

/** Per-layer color override (layerId → hex), resolved from assigned materials. */
export type LandscapeLayerColors = Record<string, string>;

/**
 * A paint layer's resolved render inputs, aligned to `data.layers` order. The
 * base-color `texture` (when present) is weight-blended across the terrain in
 * "lit" view; `color` is the fallback tint (and the debug/vertex-color look).
 */
export interface LandscapeLayerTexture {
  id: string;
  texture: Texture | null;
  /** Tangent-space normal map; `null` falls back to a flat normal. */
  normalTexture: Texture | null;
  /** Packed AO/Roughness/Metalness texture; `null` uses scalar PBR values. */
  ormTexture: Texture | null;
  color: string;
  /** Per-axis UV repeat count across the whole terrain for this layer's texture. */
  tiling: { x: number; y: number };
  roughness: number;
  metalness: number;
  aoIntensity: number;
}

/** Resolved settings + world transform + sidecar data the binding needs to build a landscape. */
export interface LandscapeRenderItem extends ResolvedLandscape {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  data: ForgeLandscapeData;
  viewMode?: LandscapeViewMode;
  activeLayerId?: string;
  /** Layer tint overrides (assigned-material base colors); falls back to preset colors. */
  layerColors?: LandscapeLayerColors;
  /** Per-layer base-color textures for weight-blended splat rendering (lit view). */
  layerTextures?: LandscapeLayerTexture[];
  /** Renderer fragment texture-unit limit, used to select the safe shader variant. */
  maxTextureUnits?: number;
}

const DEFAULT_LAYER_COLOR = new Color(LANDSCAPE_DEFAULT_LAYERS[0]!.color);

function heightAt(data: ForgeLandscapeData, x: number, z: number): number {
  const { verticesX, verticesZ } = data.size;
  const cx = Math.min(Math.max(x, 0), verticesX - 1);
  const cz = Math.min(Math.max(z, 0), verticesZ - 1);
  return data.heights[cz * verticesX + cx] ?? 0;
}

function heightRange(data: ForgeLandscapeData): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const height of data.heights) {
    if (!Number.isFinite(height)) continue;
    min = Math.min(min, height);
    max = Math.max(max, height);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (Math.abs(max - min) < 0.0001) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

function layerColor(layerId: string, colors?: LandscapeLayerColors): Color {
  const override = colors?.[layerId];
  if (override) return new Color(override);
  const defaults = LANDSCAPE_DEFAULT_LAYERS.find((layer) => layer.id === layerId);
  return new Color(defaults?.color ?? DEFAULT_LAYER_COLOR);
}

function setColor(values: Float32Array, vertexIndex: number, color: Color): void {
  values[vertexIndex * 3] = color.r;
  values[vertexIndex * 3 + 1] = color.g;
  values[vertexIndex * 3 + 2] = color.b;
}

function landscapeVertexColor(
  data: ForgeLandscapeData,
  vertexIndex: number,
  height: number,
  normalY: number,
  viewMode: LandscapeViewMode,
  activeLayerId: string,
  range: { min: number; max: number },
  colors?: LandscapeLayerColors,
): Color {
  if (viewMode === "height") {
    const t = (height - range.min) / Math.max(0.0001, range.max - range.min);
    return new Color().setRGB(0.16 + t * 0.62, 0.28 + t * 0.5, 0.2 + t * 0.68);
  }
  if (viewMode === "slope") {
    const slope = Math.min(1, Math.max(0, 1 - normalY));
    return new Color().setRGB(0.15 + slope * 0.75, 0.62 - slope * 0.34, 0.22 + slope * 0.32);
  }

  if (viewMode === "layer") {
    const layer = data.layers.find((entry) => entry.id === activeLayerId) ?? data.layers[0];
    const weight = Math.min(1, Math.max(0, layer?.weights[vertexIndex] ?? 0));
    return layerColor(layer?.id ?? activeLayerId, colors).multiplyScalar(0.2 + weight * 0.8);
  }

  const color = new Color(0, 0, 0);
  for (const layer of data.layers) {
    const weight = Math.min(1, Math.max(0, layer.weights[vertexIndex] ?? 0));
    if (weight <= 0) continue;
    color.add(layerColor(layer.id, colors).multiplyScalar(weight));
  }
  return color.r + color.g + color.b > 0 ? color : DEFAULT_LAYER_COLOR.clone();
}

/**
 * Builds one chunk's geometry covering vertex range `[x0, x1] x [z0, z1]`
 * (inclusive), with position/normal/uv attributes. Normals sample one vertex
 * of padding beyond the chunk so seams between chunks shade continuously.
 */
function buildChunkGeometry(
  data: ForgeLandscapeData,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  viewMode: LandscapeViewMode,
  activeLayerId: string,
  layerColors?: LandscapeLayerColors,
): BufferGeometry {
  const { spacing, heightScale, verticesX, verticesZ } = data.size;
  const cols = x1 - x0 + 1;
  const rows = z1 - z0 + 1;
  const vertexCount = cols * rows;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  // Per-vertex weight of the first four paint layers (grass/dirt/rock/snow),
  // consumed by the splat material to blend up to four base-color textures.
  const layerWeights = new Float32Array(vertexCount * 4);
  const range = heightRange(data);

  // World-space origin centers the full grid on the actor's position.
  const originX = ((verticesX - 1) * spacing) / 2;
  const originZ = ((verticesZ - 1) * spacing) / 2;

  for (let row = 0; row < rows; row += 1) {
    const z = z0 + row;
    for (let col = 0; col < cols; col += 1) {
      const x = x0 + col;
      const vertexIndex = row * cols + col;
      const height = heightAt(data, x, z) * heightScale;
      positions[vertexIndex * 3] = x * spacing - originX;
      positions[vertexIndex * 3 + 1] = height;
      positions[vertexIndex * 3 + 2] = z * spacing - originZ;

      const left = heightAt(data, x - 1, z) * heightScale;
      const right = heightAt(data, x + 1, z) * heightScale;
      const up = heightAt(data, x, z - 1) * heightScale;
      const down = heightAt(data, x, z + 1) * heightScale;
      const dx = left - right;
      const dz = up - down;
      const length = Math.sqrt(dx * dx + 4 * spacing * spacing + dz * dz) || 1;
      normals[vertexIndex * 3] = dx / length;
      const normalY = (2 * spacing) / length;
      normals[vertexIndex * 3 + 1] = normalY;
      normals[vertexIndex * 3 + 2] = dz / length;

      uvs[vertexIndex * 2] = x / (verticesX - 1);
      uvs[vertexIndex * 2 + 1] = z / (verticesZ - 1);

      const globalVertexIndex = z * verticesX + x;
      setColor(
        colors,
        vertexIndex,
        landscapeVertexColor(
          data,
          globalVertexIndex,
          height,
          normalY,
          viewMode,
          activeLayerId,
          range,
          layerColors,
        ),
      );
      for (let layer = 0; layer < 4; layer += 1) {
        const weight = data.layers[layer]?.weights[globalVertexIndex] ?? 0;
        layerWeights[vertexIndex * 4 + layer] = Math.min(1, Math.max(0, weight));
      }
    }
  }

  const indexCount = (cols - 1) * (rows - 1) * 6;
  const indices = indexCount > 0 ? new Uint32Array(indexCount) : new Uint32Array(0);
  let cursor = 0;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices[cursor] = a;
      indices[cursor + 1] = c;
      indices[cursor + 2] = b;
      indices[cursor + 3] = b;
      indices[cursor + 4] = c;
      indices[cursor + 5] = d;
      cursor += 6;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("landscapeWeight", new BufferAttribute(layerWeights, 4));
  if (indices.length > 0) geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds a MeshStandardMaterial that blends up to four paint-layer base-color
 * textures by the per-vertex `landscapeWeight` attribute, keeping full PBR
 * lighting/shadows. Layers without a texture fall back to their flat color.
 * Used only in "lit" view when at least one layer has a texture; otherwise the
 * plain vertex-color material renders the tint and the debug view modes.
 */
function createLandscapeSplatMaterial(
  layerTextures: LandscapeLayerTexture[],
  samplerBudget: LandscapeSamplerBudget,
): MeshStandardMaterial {
  const firstNormalTexture = samplerBudget.pbrEnabled
    ? layerTextures.find((layer) => layer.normalTexture)?.normalTexture ?? null
    : null;
  const material = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    roughness: 1,
    metalness: 0,
    // This enables Three's derivative-based TBN frame. The stock normal sample
    // is neutralized below; the terrain instead blends all four layer normals.
    normalMap: firstNormalTexture,
  });
  material.normalScale.set(0, 0);
  material.defines = { ...(material.defines ?? {}), USE_UV: "" };
  const texAt = (index: number): Texture | null => layerTextures[index]?.texture ?? null;
  const normalAt = (index: number): Texture | null => layerTextures[index]?.normalTexture ?? null;
  const ormAt = (index: number): Texture | null => layerTextures[index]?.ormTexture ?? null;
  const colorAt = (index: number): Color =>
    new Color(layerTextures[index]?.color ?? LANDSCAPE_DEFAULT_LAYERS[0]!.color);
  const tilingAt = (index: number): Vector2 => {
    const t = layerTextures[index]?.tiling;
    return new Vector2(Math.max(0.0001, t?.x ?? 1), Math.max(0.0001, t?.y ?? 1));
  };
  const scalarAt = (index: number, key: "roughness" | "metalness" | "aoIntensity", fallback: number): number =>
    Math.min(1, Math.max(0, layerTextures[index]?.[key] ?? fallback));

  material.onBeforeCompile = (shader) => {
    for (let index = 0; index < 4; index += 1) {
      shader.uniforms[`uLayerTex${index}`] = { value: texAt(index) };
      shader.uniforms[`uLayerColor${index}`] = { value: colorAt(index) };
      shader.uniforms[`uLayerHasTex${index}`] = { value: texAt(index) ? 1 : 0 };
      shader.uniforms[`uLayerTiling${index}`] = { value: tilingAt(index) };
      if (!samplerBudget.pbrEnabled) continue;
      shader.uniforms[`uLayerNormal${index}`] = { value: normalAt(index) };
      shader.uniforms[`uLayerOrm${index}`] = { value: ormAt(index) };
      shader.uniforms[`uLayerHasNormal${index}`] = { value: normalAt(index) ? 1 : 0 };
      shader.uniforms[`uLayerHasOrm${index}`] = { value: ormAt(index) ? 1 : 0 };
      shader.uniforms[`uLayerRoughness${index}`] = { value: scalarAt(index, "roughness", 1) };
      shader.uniforms[`uLayerMetalness${index}`] = { value: scalarAt(index, "metalness", 0) };
      shader.uniforms[`uLayerAoIntensity${index}`] = { value: scalarAt(index, "aoIntensity", 1) };
    }
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 landscapeWeight;\nvarying vec4 vLandscapeWeight;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvLandscapeWeight = landscapeWeight;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D uLayerTex0;
uniform sampler2D uLayerTex1;
uniform sampler2D uLayerTex2;
uniform sampler2D uLayerTex3;
uniform vec3 uLayerColor0;
uniform vec3 uLayerColor1;
uniform vec3 uLayerColor2;
uniform vec3 uLayerColor3;
uniform float uLayerHasTex0;
uniform float uLayerHasTex1;
uniform float uLayerHasTex2;
uniform float uLayerHasTex3;
uniform vec2 uLayerTiling0;
uniform vec2 uLayerTiling1;
uniform vec2 uLayerTiling2;
uniform vec2 uLayerTiling3;
varying vec4 vLandscapeWeight;`,
      )
      // Inlined here (not a helper at <common>) because vUv is only in scope
      // inside main(), after three's <uv_pars_fragment> declares it.
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  vec3 forgeC0 = uLayerHasTex0 > 0.5 ? texture2D(uLayerTex0, vUv * uLayerTiling0).rgb : uLayerColor0;
  vec3 forgeC1 = uLayerHasTex1 > 0.5 ? texture2D(uLayerTex1, vUv * uLayerTiling1).rgb : uLayerColor1;
  vec3 forgeC2 = uLayerHasTex2 > 0.5 ? texture2D(uLayerTex2, vUv * uLayerTiling2).rgb : uLayerColor2;
  vec3 forgeC3 = uLayerHasTex3 > 0.5 ? texture2D(uLayerTex3, vUv * uLayerTiling3).rgb : uLayerColor3;
  vec3 forgeAlbedo =
    forgeC0 * vLandscapeWeight.x +
    forgeC1 * vLandscapeWeight.y +
    forgeC2 * vLandscapeWeight.z +
    forgeC3 * vLandscapeWeight.w;
  float forgeWeight = vLandscapeWeight.x + vLandscapeWeight.y + vLandscapeWeight.z + vLandscapeWeight.w;
  diffuseColor.rgb = forgeWeight > 0.0001 ? forgeAlbedo / forgeWeight : uLayerColor0;
}`,
      );
    if (!samplerBudget.pbrEnabled) return;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D uLayerNormal0;
uniform sampler2D uLayerNormal1;
uniform sampler2D uLayerNormal2;
uniform sampler2D uLayerNormal3;
uniform sampler2D uLayerOrm0;
uniform sampler2D uLayerOrm1;
uniform sampler2D uLayerOrm2;
uniform sampler2D uLayerOrm3;
uniform float uLayerHasNormal0;
uniform float uLayerHasNormal1;
uniform float uLayerHasNormal2;
uniform float uLayerHasNormal3;
uniform float uLayerHasOrm0;
uniform float uLayerHasOrm1;
uniform float uLayerHasOrm2;
uniform float uLayerHasOrm3;
uniform float uLayerRoughness0;
uniform float uLayerRoughness1;
uniform float uLayerRoughness2;
uniform float uLayerRoughness3;
uniform float uLayerMetalness0;
uniform float uLayerMetalness1;
uniform float uLayerMetalness2;
uniform float uLayerMetalness3;
uniform float uLayerAoIntensity0;
uniform float uLayerAoIntensity1;
uniform float uLayerAoIntensity2;
uniform float uLayerAoIntensity3;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  vec3 forgeN0 = uLayerHasNormal0 > 0.5 ? texture2D(uLayerNormal0, vUv * uLayerTiling0).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
  vec3 forgeN1 = uLayerHasNormal1 > 0.5 ? texture2D(uLayerNormal1, vUv * uLayerTiling1).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
  vec3 forgeN2 = uLayerHasNormal2 > 0.5 ? texture2D(uLayerNormal2, vUv * uLayerTiling2).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
  vec3 forgeN3 = uLayerHasNormal3 > 0.5 ? texture2D(uLayerNormal3, vUv * uLayerTiling3).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
  float forgeWeight = max(0.0001, vLandscapeWeight.x + vLandscapeWeight.y + vLandscapeWeight.z + vLandscapeWeight.w);
  vec3 forgeNormal = normalize((forgeN0 * vLandscapeWeight.x + forgeN1 * vLandscapeWeight.y + forgeN2 * vLandscapeWeight.z + forgeN3 * vLandscapeWeight.w) / forgeWeight);
  #ifdef USE_NORMALMAP_TANGENTSPACE
    normal = normalize(tbn * forgeNormal);
  #endif
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
vec4 forgeOrm0 = uLayerHasOrm0 > 0.5 ? texture2D(uLayerOrm0, vUv * uLayerTiling0) : vec4(1.0);
vec4 forgeOrm1 = uLayerHasOrm1 > 0.5 ? texture2D(uLayerOrm1, vUv * uLayerTiling1) : vec4(1.0);
vec4 forgeOrm2 = uLayerHasOrm2 > 0.5 ? texture2D(uLayerOrm2, vUv * uLayerTiling2) : vec4(1.0);
vec4 forgeOrm3 = uLayerHasOrm3 > 0.5 ? texture2D(uLayerOrm3, vUv * uLayerTiling3) : vec4(1.0);
float forgePbrWeight = max(0.0001, vLandscapeWeight.x + vLandscapeWeight.y + vLandscapeWeight.z + vLandscapeWeight.w);
roughnessFactor = clamp((forgeOrm0.g * uLayerRoughness0 * vLandscapeWeight.x + forgeOrm1.g * uLayerRoughness1 * vLandscapeWeight.y + forgeOrm2.g * uLayerRoughness2 * vLandscapeWeight.z + forgeOrm3.g * uLayerRoughness3 * vLandscapeWeight.w) / forgePbrWeight, 0.0, 1.0);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        `#include <metalnessmap_fragment>
metalnessFactor = clamp((forgeOrm0.b * uLayerMetalness0 * vLandscapeWeight.x + forgeOrm1.b * uLayerMetalness1 * vLandscapeWeight.y + forgeOrm2.b * uLayerMetalness2 * vLandscapeWeight.z + forgeOrm3.b * uLayerMetalness3 * vLandscapeWeight.w) / forgePbrWeight, 0.0, 1.0);`,
      )
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
float forgeAo = clamp((mix(1.0, forgeOrm0.r, uLayerAoIntensity0) * vLandscapeWeight.x + mix(1.0, forgeOrm1.r, uLayerAoIntensity1) * vLandscapeWeight.y + mix(1.0, forgeOrm2.r, uLayerAoIntensity2) * vLandscapeWeight.z + mix(1.0, forgeOrm3.r, uLayerAoIntensity3) * vLandscapeWeight.w) / forgePbrWeight, 0.0, 1.0);
reflectedLight.indirectDiffuse *= forgeAo;
#if defined( USE_ENVMAP ) && defined( STANDARD )
  float forgeDotNV = saturate(dot(geometryNormal, geometryViewDir));
  reflectedLight.indirectSpecular *= computeSpecularOcclusion(forgeDotNV, forgeAo, material.roughness);
#endif`,
      );
  };
  // Distinguish this program from the plain landscape material in three's cache.
  material.customProgramCacheKey = () => samplerBudget.pbrEnabled
    ? `forge-landscape-splat-pbr-${firstNormalTexture ? "normal" : "flat"}`
    : "forge-landscape-splat-albedo-only";
  return material;
}

/** Splits the vertex grid into `quadsPerChunk`-sized chunk meshes under one shared material. */
function buildLandscapeChunkMeshes(
  data: ForgeLandscapeData,
  viewMode: LandscapeViewMode,
  activeLayerId: string,
  colors?: LandscapeLayerColors,
  layerTextures?: LandscapeLayerTexture[],
  samplerBudget: LandscapeSamplerBudget = resolveLandscapeSamplerBudget(),
): Mesh[] {
  const { verticesX, verticesZ } = data.size;
  const quadsPerChunk = Math.max(1, data.chunks?.quadsPerChunk || LANDSCAPE_QUADS_PER_CHUNK);
  ensureLandscapeLayers(data);
  const useSplat = viewMode === "lit" && Boolean(layerTextures?.some((layer) => layer.texture));
  const material = useSplat
    ? createLandscapeSplatMaterial(layerTextures!, samplerBudget)
    : new MeshStandardMaterial({
        color: new Color("#ffffff"),
        roughness: 1,
        metalness: 0,
        vertexColors: true,
      });
  const meshes: Mesh[] = [];
  for (let z0 = 0; z0 < verticesZ - 1; z0 += quadsPerChunk) {
    const z1 = Math.min(z0 + quadsPerChunk, verticesZ - 1);
    for (let x0 = 0; x0 < verticesX - 1; x0 += quadsPerChunk) {
      const x1 = Math.min(x0 + quadsPerChunk, verticesX - 1);
      const geometry = buildChunkGeometry(data, x0, x1, z0, z1, viewMode, activeLayerId, colors);
      const mesh = new Mesh(geometry, material);
      mesh.name = "landscape-chunk";
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.landscapeChunk = { x0, x1, z0, z1 } satisfies LandscapeDirtyBounds;
      meshes.push(mesh);
    }
  }
  return meshes;
}

/** Builds a landscape's chunked mesh group; rebuild required whenever `data` changes shape. */
export function createLandscapeObject(item: LandscapeRenderItem): LandscapeObject {
  const group = new Group();
  group.name = item.name;
  const samplerBudget = resolveLandscapeSamplerBudget(item.maxTextureUnits);
  group.userData.landscapeSamplerBudget = samplerBudget;
  const viewMode = item.viewMode ?? "lit";
  const activeLayerId = item.activeLayerId ?? LANDSCAPE_DEFAULT_LAYERS[0]!.id;
  for (const mesh of buildLandscapeChunkMeshes(
    item.data,
    viewMode,
    activeLayerId,
    item.layerColors,
    item.layerTextures,
    samplerBudget,
  )) {
    group.add(mesh);
  }
  applyLandscapeTransform(group, item);
  return group;
}

/** Pushes the transform + visibility onto an existing landscape group (no geometry rebuild). */
export function applyLandscapeTransform(object: LandscapeObject, item: LandscapeRenderItem): void {
  object.position.set(item.position[0], item.position[1], item.position[2]);
  object.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  object.visible = !item.hidden;
}

function intersectsDirtyBounds(chunk: LandscapeDirtyBounds, dirty: LandscapeDirtyBounds): boolean {
  return (
    chunk.x0 <= dirty.x1 &&
    chunk.x1 >= dirty.x0 &&
    chunk.z0 <= dirty.z1 &&
    chunk.z1 >= dirty.z0
  );
}

/**
 * Rebuilds only the chunk geometries that overlap the edited vertex bounds.
 * Sculpt changes don't alter chunk count/materials, so replacing geometry in
 * place keeps selection and scene ownership stable while avoiding a full actor
 * rebuild for every brush dab.
 */
export function updateLandscapeObjectGeometry(
  object: LandscapeObject,
  data: ForgeLandscapeData,
  dirty: LandscapeDirtyBounds,
  viewMode: LandscapeViewMode = "lit",
  activeLayerId: string = LANDSCAPE_DEFAULT_LAYERS[0]!.id,
  colors?: LandscapeLayerColors,
): void {
  ensureLandscapeLayers(data);
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const chunk = child.userData.landscapeChunk as LandscapeDirtyBounds | undefined;
    if (!chunk || !intersectsDirtyBounds(chunk, dirty)) return;
    child.geometry.dispose();
    child.geometry = buildChunkGeometry(
      data,
      chunk.x0,
      chunk.x1,
      chunk.z0,
      chunk.z1,
      viewMode,
      activeLayerId,
      colors,
    );
  });
}

/** Frees every chunk's geometry + (shared) material under a landscape group. */
export function disposeLandscapeObject(object: LandscapeObject): void {
  const disposedMaterials = new Set<MeshStandardMaterial>();
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      const material = child.material as MeshStandardMaterial;
      if (!disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    }
  });
}

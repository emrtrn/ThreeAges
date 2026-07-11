import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import {
  LANDSCAPE_QUADS_PER_CHUNK,
  type ForgeLandscapeData,
  type ResolvedLandscape,
} from "@engine/scene/landscape";

export {
  resolveLandscape,
  LANDSCAPE_DEFAULTS,
  uniqueLandscapeId,
  uniqueLandscapeName,
  landscapeSizeForPreset,
  createFlatLandscapeData,
  landscapeDataPath,
  LANDSCAPE_MIN_VERTICES,
  LANDSCAPE_MAX_VERTICES,
  LANDSCAPE_QUADS_PER_CHUNK,
  type ResolvedLandscape,
  type ForgeLandscapeData,
  type LandscapeSize,
  type LandscapeSizePreset,
  type LandscapeLayerWeights,
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

/** Resolved settings + world transform + sidecar data the binding needs to build a landscape. */
export interface LandscapeRenderItem extends ResolvedLandscape {
  position: Vec3;
  /** XYZ-order Euler rotation in degrees. */
  rotation: Vec3;
  data: ForgeLandscapeData;
}

/** Flat terrain-green fill color for the Faz 1 unpainted landscape material. */
const LANDSCAPE_DEFAULT_COLOR = "#5c8a4a";

function heightAt(data: ForgeLandscapeData, x: number, z: number): number {
  const { verticesX, verticesZ } = data.size;
  const cx = Math.min(Math.max(x, 0), verticesX - 1);
  const cz = Math.min(Math.max(z, 0), verticesZ - 1);
  return data.heights[cz * verticesX + cx] ?? 0;
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
): BufferGeometry {
  const { spacing, heightScale, verticesX, verticesZ } = data.size;
  const cols = x1 - x0 + 1;
  const rows = z1 - z0 + 1;
  const vertexCount = cols * rows;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

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
      normals[vertexIndex * 3 + 1] = (2 * spacing) / length;
      normals[vertexIndex * 3 + 2] = dz / length;

      uvs[vertexIndex * 2] = x / (verticesX - 1);
      uvs[vertexIndex * 2 + 1] = z / (verticesZ - 1);
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
  if (indices.length > 0) geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Splits the vertex grid into `quadsPerChunk`-sized chunk meshes under one shared material. */
function buildLandscapeChunkMeshes(data: ForgeLandscapeData, color: string): Mesh[] {
  const { verticesX, verticesZ } = data.size;
  const quadsPerChunk = Math.max(1, data.chunks?.quadsPerChunk || LANDSCAPE_QUADS_PER_CHUNK);
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 1,
    metalness: 0,
  });
  const meshes: Mesh[] = [];
  for (let z0 = 0; z0 < verticesZ - 1; z0 += quadsPerChunk) {
    const z1 = Math.min(z0 + quadsPerChunk, verticesZ - 1);
    for (let x0 = 0; x0 < verticesX - 1; x0 += quadsPerChunk) {
      const x1 = Math.min(x0 + quadsPerChunk, verticesX - 1);
      const geometry = buildChunkGeometry(data, x0, x1, z0, z1);
      const mesh = new Mesh(geometry, material);
      mesh.name = "landscape-chunk";
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      meshes.push(mesh);
    }
  }
  return meshes;
}

/** Builds a landscape's chunked mesh group; rebuild required whenever `data` changes shape. */
export function createLandscapeObject(item: LandscapeRenderItem): LandscapeObject {
  const group = new Group();
  group.name = item.name;
  for (const mesh of buildLandscapeChunkMeshes(item.data, LANDSCAPE_DEFAULT_COLOR)) {
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

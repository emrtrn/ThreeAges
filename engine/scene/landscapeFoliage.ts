import type { Vec3 } from "./layout";
import type { ForgeLandscapeData } from "./landscape";
import type { LandscapeFoliageRule } from "./foliage";
import { makeFoliageRng } from "./foliagePaint";

/** Terrain state needed to regenerate one Landscape foliage rule without three.js. */
export interface LandscapeFoliageGenerationInput {
  id: string;
  position: Vec3;
  rotation?: Vec3;
  data: ForgeLandscapeData;
}

/** One deterministic world-space sample accepted by a Landscape foliage rule. */
export interface GeneratedLandscapeFoliageSample {
  position: Vec3;
  normal: Vec3;
  seed: number;
}

/** Hard upper bound per rule; prevents malformed density data from freezing a web editor. */
export const MAX_GENERATED_LANDSCAPE_FOLIAGE = 20_000;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function bilinear(values: readonly number[], width: number, height: number, x: number, z: number): number {
  const sx = clamp(x, 0, width - 1);
  const sz = clamp(z, 0, height - 1);
  const x0 = Math.floor(sx);
  const z0 = Math.floor(sz);
  const x1 = Math.min(width - 1, x0 + 1);
  const z1 = Math.min(height - 1, z0 + 1);
  const tx = sx - x0;
  const tz = sz - z0;
  const at = (px: number, pz: number) => values[pz * width + px] ?? 0;
  const top = at(x0, z0) + (at(x1, z0) - at(x0, z0)) * tx;
  const bottom = at(x0, z1) + (at(x1, z1) - at(x0, z1)) * tx;
  return top + (bottom - top) * tz;
}

function rotateXyz(vector: Vec3, rotation: Vec3): Vec3 {
  const x = (rotation[0] * Math.PI) / 180;
  const y = (rotation[1] * Math.PI) / 180;
  const z = (rotation[2] * Math.PI) / 180;
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);
  return [
    (c * e) * vector[0] + (-c * f) * vector[1] + d * vector[2],
    (a * f + b * d * e) * vector[0] + (a * e - b * d * f) * vector[1] + (-b * c) * vector[2],
    (b * f - a * d * e) * vector[0] + (b * e + a * d * f) * vector[1] + (a * c) * vector[2],
  ];
}

function normalized(vector: Vec3): Vec3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return length > 1e-8 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [0, 1, 0];
}

/**
 * Samples a Landscape layer in a stable jittered grid. It intentionally returns
 * surface samples rather than saved instances: the caller rolls the selected
 * Foliage Type each rebuild, so type edits immediately affect generated foliage.
 */
export function generateLandscapeFoliageSamples(
  rule: LandscapeFoliageRule,
  landscape: LandscapeFoliageGenerationInput,
): GeneratedLandscapeFoliageSample[] {
  if (rule.landscapeId !== landscape.id || rule.density <= 0) return [];
  const { data } = landscape;
  const layer = data.layers.find((entry) => entry.id === rule.layerId);
  if (!layer) return [];
  const { verticesX, verticesZ, spacing, heightScale } = data.size;
  if (verticesX < 2 || verticesZ < 2 || spacing <= 0) return [];
  const width = (verticesX - 1) * spacing;
  const depth = (verticesZ - 1) * spacing;
  const desired = Math.min(MAX_GENERATED_LANDSCAPE_FOLIAGE, Math.ceil(width * depth * rule.density));
  if (desired <= 0) return [];
  const aspect = width / Math.max(depth, 1e-6);
  const columns = Math.max(1, Math.ceil(Math.sqrt(desired * aspect)));
  const rows = Math.max(1, Math.ceil(desired / columns));
  const cellWidth = width / columns;
  const cellDepth = depth / rows;
  const rotation = landscape.rotation ?? [0, 0, 0];
  const rng = makeFoliageRng(rule.seed);
  const samples: GeneratedLandscapeFoliageSample[] = [];

  for (let row = 0; row < rows && samples.length < MAX_GENERATED_LANDSCAPE_FOLIAGE; row += 1) {
    for (let col = 0; col < columns && samples.length < MAX_GENERATED_LANDSCAPE_FOLIAGE; col += 1) {
      const localX = -width / 2 + (col + rng()) * cellWidth;
      const localZ = -depth / 2 + (row + rng()) * cellDepth;
      const gridX = localX / spacing + (verticesX - 1) / 2;
      const gridZ = localZ / spacing + (verticesZ - 1) / 2;
      if (bilinear(layer.weights, verticesX, verticesZ, gridX, gridZ) + 1e-6 < rule.minWeight) continue;
      const heightAt = (x: number, z: number) => bilinear(data.heights, verticesX, verticesZ, x, z) * heightScale;
      const localY = heightAt(gridX, gridZ);
      const dx = heightAt(gridX - 1, gridZ) - heightAt(gridX + 1, gridZ);
      const dz = heightAt(gridX, gridZ - 1) - heightAt(gridX, gridZ + 1);
      const localNormal = normalized([dx, 2 * spacing, dz]);
      const rotatedPosition = rotateXyz([localX, localY, localZ], rotation);
      const rotatedNormal = normalized(rotateXyz(localNormal, rotation));
      samples.push({
        position: [
          landscape.position[0] + rotatedPosition[0],
          landscape.position[1] + rotatedPosition[1],
          landscape.position[2] + rotatedPosition[2],
        ],
        normal: rotatedNormal,
        seed: Math.floor(rng() * 0xffffffff) >>> 0,
      });
    }
  }
  return samples;
}

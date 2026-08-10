import { Vector3 } from "three";

import type { RtsFormationId } from "./rtsFormationTypes";

export type RtsGeometricFormationId = Exclude<RtsFormationId, "free">;

export interface RtsFormationOffset {
  /** Sideways displacement: negative is left, positive is right. */
  readonly x: number;
  /** Forward displacement: positive is toward the command target. */
  readonly z: number;
}

/** V1 formation geometry, local to the movement direction. */
export function rtsFormationOffsets(
  formation: RtsGeometricFormationId,
  count: number,
  spacing: number,
): RtsFormationOffset[] {
  if (count <= 0) return [];
  switch (formation) {
    case "line": {
      const halfWidth = ((count - 1) * spacing) / 2;
      return Array.from({ length: count }, (_, index) => ({ x: index * spacing - halfWidth, z: 0 }));
    }
    case "column":
      return columnOffsets(count, spacing);
    case "wedge":
      return wedgeOffsets(count, spacing);
    case "crescent":
      return crescentOffsets(count, spacing);
    case "square":
      return squareOffsets(count, spacing);
    case "loose":
      return looseOffsets(count, spacing);
  }
}

function columnOffsets(count: number, spacing: number): RtsFormationOffset[] {
  // Two files through an ordinary passage; larger groups earn a third file only
  // once their depth would otherwise become needlessly long.
  const columns = count >= 12 ? 3 : 2;
  const rows = Math.ceil(count / columns);
  const halfWidth = ((columns - 1) * spacing) / 2;
  const halfDepth = ((rows - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: (index % columns) * spacing - halfWidth,
    z: Math.floor(index / columns) * spacing - halfDepth,
  }));
}

function wedgeOffsets(count: number, spacing: number): RtsFormationOffset[] {
  let rows = 0;
  let remaining = count;
  while (remaining > 0) {
    rows += 1;
    remaining -= rows;
  }
  const offsets: RtsFormationOffset[] = [];
  for (let row = 0; offsets.length < count; row += 1) {
    const rowCount = Math.min(row + 1, count - offsets.length);
    const halfWidth = ((rowCount - 1) * spacing) / 2;
    for (let column = 0; column < rowCount; column += 1) {
      offsets.push({
        x: column * spacing - halfWidth,
        z: ((rows - 1) / 2 - row) * spacing,
      });
    }
  }
  return centreDepth(offsets);
}

function crescentOffsets(count: number, spacing: number): RtsFormationOffset[] {
  const columns = Math.min(8, Math.max(6, Math.ceil(Math.sqrt(count) * 2)));
  const offsets: RtsFormationOffset[] = [];
  for (let row = 0; offsets.length < count; row += 1) {
    const rowCount = Math.min(columns, count - offsets.length);
    const halfWidth = ((rowCount - 1) * spacing) / 2;
    for (let column = 0; column < rowCount; column += 1) {
      const normalized = rowCount <= 1 ? 0 : (column / (rowCount - 1)) * 2 - 1;
      offsets.push({
        x: column * spacing - halfWidth,
        // Leading wings and a recessed centre form the readable open crescent.
        z: Math.abs(normalized) * spacing * 1.45 - row * spacing * 0.75,
      });
    }
  }
  return centreDepth(offsets);
}

function squareOffsets(count: number, spacing: number): RtsFormationOffset[] {
  const side = Math.ceil(Math.sqrt(count));
  const half = ((side - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: (index % side) * spacing - half,
    z: Math.floor(index / side) * spacing - half,
  }));
}

function looseOffsets(count: number, spacing: number): RtsFormationOffset[] {
  const side = Math.ceil(Math.sqrt(count));
  const looseSpacing = spacing * 1.9;
  const half = ((side - 1) * looseSpacing) / 2;
  return Array.from({ length: count }, (_, index) => {
    // Stable jitter, not randomness: repeating a command remains readable.
    const jitterX = ((index * 37) % 5 - 2) * spacing * 0.1;
    const jitterZ = ((index * 19) % 5 - 2) * spacing * 0.1;
    return {
      x: (index % side) * looseSpacing - half + jitterX,
      z: Math.floor(index / side) * looseSpacing - half + jitterZ,
    };
  });
}

function centreDepth(offsets: readonly RtsFormationOffset[]): RtsFormationOffset[] {
  const averageZ = offsets.reduce((sum, offset) => sum + offset.z, 0) / offsets.length;
  return offsets.map((offset) => ({ ...offset, z: offset.z - averageZ }));
}

/** Rotate local formation geometry to face from the group centroid to its target. */
export function rtsFormationWorldSlots(
  formation: RtsGeometricFormationId,
  count: number,
  spacing: number,
  centroid: Vector3,
  target: Vector3,
): Vector3[] {
  const forwardX = target.x - centroid.x;
  const forwardZ = target.z - centroid.z;
  const length = Math.hypot(forwardX, forwardZ);
  // A target exactly under the group has no meaningful heading. Keep it stable
  // instead of letting a near-zero direction flip every order.
  const normalizedForwardX = length > 0.001 ? forwardX / length : 0;
  const normalizedForwardZ = length > 0.001 ? forwardZ / length : 1;
  const rightX = normalizedForwardZ;
  const rightZ = -normalizedForwardX;
  return rtsFormationOffsets(formation, count, spacing).map((offset) => new Vector3(
    target.x + rightX * offset.x + normalizedForwardX * offset.z,
    target.y,
    target.z + rightZ * offset.x + normalizedForwardZ * offset.z,
  ));
}

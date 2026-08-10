import { Vector3 } from "three";

import type { RtsFormationId } from "./rtsFormationTypes";

export interface RtsFormationOffset {
  /** Sideways displacement: negative is left, positive is right. */
  readonly x: number;
  /** Forward displacement: positive is toward the command target. */
  readonly z: number;
}

/** The two geometries introduced in Faz 2, local to the movement direction. */
export function rtsFormationOffsets(
  formation: Extract<RtsFormationId, "line" | "column">,
  count: number,
  spacing: number,
): RtsFormationOffset[] {
  if (count <= 0) return [];
  if (formation === "line") {
    const halfWidth = ((count - 1) * spacing) / 2;
    return Array.from({ length: count }, (_, index) => ({ x: index * spacing - halfWidth, z: 0 }));
  }

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

/** Rotate local formation geometry to face from the group centroid to its target. */
export function rtsFormationWorldSlots(
  formation: Extract<RtsFormationId, "line" | "column">,
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

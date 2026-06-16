import { Box3, Vector3 } from "three";

import type { RoomLayout, Vec3 } from "@engine/scene/layout";
import { readRotation } from "@engine/scene/transform";
import { colliderBoxFromBounds, composeTransformMatrix, type ColliderBox } from "./transforms";

/** A world-aligned collider box plus whether its owner is a (non-blocking) sensor. */
export interface CollisionWirebox {
  box: Box3;
  segments: Vec3[];
  size: Vec3;
  sensor: boolean;
}

/**
 * World-aligned collider boxes for every collidable placement and character in a
 * layout: the data behind the editor's "Show > Collision" overlay.
 *
 * Mirrors the collider the adapter derives (the model's local bounds under the
 * placement's position + scale, ignoring rotation; see `colliderBoxFromBounds`)
 * and the same `collision` / `sensor` flags, so the overlay shows exactly what
 * physics uses. Placements that opted out with `collision: false` are skipped
 * unless `simulatePhysics` forces a collider; an asset with no loaded bounds is
 * skipped (its box is unknown).
 *
 * Pure: takes the layout and a bounds lookup, returns boxes/line segments. No
 * DOM, no scene mutation: the host turns each segment list into a line helper.
 */
export function collisionWireboxes(
  layout: RoomLayout,
  localBounds: ReadonlyMap<string, Box3>,
): CollisionWirebox[] {
  const boxes: CollisionWirebox[] = [];
  for (const instance of layout.instances) {
    const bounds = localBounds.get(instance.assetId);
    if (!bounds || bounds.isEmpty()) continue;
    for (const placement of instance.placements) {
      if (placement.collision === false && placement.simulatePhysics !== true) continue;
      const collider = colliderBoxFromBounds(bounds, placement);
      const segments = wireboxSegments(placement.position, readRotation(placement), collider);
      boxes.push({
        box: boxFromColliderBox(placement.position, collider),
        segments,
        size: [...collider.size],
        sensor: placement.sensor === true,
      });
    }
  }
  for (const character of layout.characters) {
    if (character.collision === false && character.simulatePhysics !== true) continue;
    const bounds = localBounds.get(character.assetId);
    if (!bounds || bounds.isEmpty()) continue;
    const collider = colliderBoxFromBounds(bounds, character);
    const segments = wireboxSegments(character.position, readRotation(character), collider);
    boxes.push({
      box: boxFromColliderBox(character.position, collider),
      segments,
      size: [...collider.size],
      sensor: character.sensor === true,
    });
  }
  return boxes;
}

function wireboxSegments(position: Vec3, rotation: Vec3, collider: ColliderBox): Vec3[] {
  const half: Vec3 = [collider.size[0] / 2, collider.size[1] / 2, collider.size[2] / 2];
  const localCorners: Vec3[] = [
    [-half[0], -half[1], -half[2]],
    [half[0], -half[1], -half[2]],
    [half[0], half[1], -half[2]],
    [-half[0], half[1], -half[2]],
    [-half[0], -half[1], half[2]],
    [half[0], -half[1], half[2]],
    [half[0], half[1], half[2]],
    [-half[0], half[1], half[2]],
  ];
  const corners: Vec3[] = localCorners.map((corner) => [
    corner[0] + collider.center[0],
    corner[1] + collider.center[1],
    corner[2] + collider.center[2],
  ]);
  const matrix = composeTransformMatrix(position, rotation, [1, 1, 1]);
  const world = corners.map((corner) => {
    const point = new Vector3(...corner).applyMatrix4(matrix);
    return [point.x, point.y, point.z] as Vec3;
  });
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;
  return edges.flatMap(([a, b]) => [world[a]!, world[b]!]);
}

function boxFromColliderBox(position: Vec3, collider: ColliderBox): Box3 {
  const center = new Vector3(
    position[0] + collider.center[0],
    position[1] + collider.center[1],
    position[2] + collider.center[2],
  );
  const half = new Vector3(collider.size[0] / 2, collider.size[1] / 2, collider.size[2] / 2);
  return new Box3(center.clone().sub(half), center.clone().add(half));
}

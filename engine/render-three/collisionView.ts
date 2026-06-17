import { Box3, Vector3 } from "three";

import type { RoomLayout, Vec3 } from "@engine/scene/layout";
import type { AssetCollisionDef, CollisionPrimitive } from "@engine/scene/collision";
import { readRotation, readScale } from "@engine/scene/transform";
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
  collisionDefs?: ReadonlyMap<string, AssetCollisionDef>,
): CollisionWirebox[] {
  const boxes: CollisionWirebox[] = [];
  const emit = (
    source: ColliderSource,
    assetId: string,
    sensor: boolean,
  ): void => {
    if (source.collision === false && source.simulatePhysics !== true) return;
    // Authored simple-collision primitives (from the Static Mesh editor's
    // sidecar) replace the auto bounding box when present.
    const def = collisionDefs?.get(assetId);
    if (def && def.primitives.length > 0) {
      for (const primitive of def.primitives) {
        boxes.push(authoredWirebox(source, primitive, sensor));
      }
      return;
    }
    const bounds = localBounds.get(assetId);
    if (!bounds || bounds.isEmpty()) return;
    const collider = colliderBoxFromBounds(bounds, source);
    boxes.push({
      box: boxFromColliderBox(source.position, collider),
      segments: wireboxSegments(source.position, readRotation(source), collider),
      size: [...collider.size],
      sensor,
    });
  };

  for (const instance of layout.instances) {
    for (const placement of instance.placements) {
      emit(placement, instance.assetId, placement.sensor === true);
    }
  }
  for (const character of layout.characters) {
    emit(character, character.assetId, character.sensor === true);
  }
  return boxes;
}

/** Placement/character fields the wirebox builder reads. */
type ColliderSource = {
  position: Vec3;
  rotation?: Vec3;
  rotationYDeg?: number;
  scale?: number | Vec3;
  collision?: boolean;
  sensor?: boolean;
  simulatePhysics?: boolean;
};

const UNIT_CORNERS: readonly Vec3[] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const BOX_EDGES = [
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

/**
 * A wirebox for one authored collision primitive. Composes the placement
 * transform (position/rotation/scale) with the primitive's local
 * center/rotation/size, so the box follows both the model placement and the
 * shape authored in the Static Mesh editor.
 */
function authoredWirebox(
  source: ColliderSource,
  primitive: CollisionPrimitive,
  sensor: boolean,
): CollisionWirebox {
  const place = composeTransformMatrix(source.position, readRotation(source), readScale(source));
  const local = composeTransformMatrix(
    primitive.center ?? [0, 0, 0],
    primitive.rotation ?? [0, 0, 0],
    primitive.size,
  );
  const matrix = place.multiply(local);
  const world = UNIT_CORNERS.map((corner) => {
    const point = new Vector3(corner[0], corner[1], corner[2]).applyMatrix4(matrix);
    return [point.x, point.y, point.z] as Vec3;
  });
  const segments = BOX_EDGES.flatMap(([a, b]) => [world[a]!, world[b]!]);
  const box = new Box3().setFromPoints(world.map((p) => new Vector3(p[0], p[1], p[2])));
  return { box, segments, size: [...primitive.size], sensor };
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

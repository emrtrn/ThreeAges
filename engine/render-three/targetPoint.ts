import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedTargetPoint } from "@engine/scene/targetPoint";

export {
  TARGET_POINT_DEFAULTS,
  resolveTargetPoint,
  uniqueTargetPointId,
  uniqueTargetPointName,
  type ResolvedTargetPoint,
} from "@engine/scene/targetPoint";

export type TargetPointObject = Group;

export interface TargetPointRenderItem extends ResolvedTargetPoint {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export function createTargetPointObject(item: TargetPointRenderItem): TargetPointObject {
  const group = new Group();
  group.name = item.name;

  const color = new Color(item.color);
  const lineMaterial = new LineBasicMaterial({ color, depthTest: false, depthWrite: false });

  const stem = new LineSegments(
    lineGeometry([
      [0, 0, 0],
      [0, 1, 0],
      [-0.18, 0, 0],
      [0.18, 0, 0],
      [0, 0, -0.18],
      [0, 0, 0.18],
      [0, 1, 0],
      [0, 0.82, 0.28],
    ]),
    lineMaterial,
  );
  stem.name = "target-point-lines";
  group.add(stem);

  const ring = new Mesh(
    new RingGeometry(0.2, 0.23, 32),
    new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      depthWrite: false,
    }),
  );
  ring.name = "target-point-ring";
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const cap = new Mesh(
    new SphereGeometry(0.07, 16, 8),
    new MeshBasicMaterial({ color, depthTest: false, depthWrite: false }),
  );
  cap.name = "target-point-cap";
  cap.position.y = 1;
  group.add(cap);

  applyTargetPointTransform(group, item);
  return group;
}

export function applyTargetPointTransform(
  object: TargetPointObject,
  item: TargetPointRenderItem,
): void {
  object.name = item.name;
  object.position.set(item.position[0], item.position[1], item.position[2]);
  object.rotation.set(
    (item.rotation[0] * Math.PI) / 180,
    (item.rotation[1] * Math.PI) / 180,
    (item.rotation[2] * Math.PI) / 180,
    "XYZ",
  );
  object.scale.set(item.scale[0] || 1, item.scale[1] || 1, item.scale[2] || 1);
  object.visible = !item.hidden;
}

export function disposeTargetPointObject(object: TargetPointObject): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
  });
}

function lineGeometry(segments: Array<[number, number, number]>): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(segments.flat(), 3));
  return geometry;
}

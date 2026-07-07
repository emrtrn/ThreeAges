import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from "three";

import type { Vec3 } from "@engine/scene/layout";
import type { ResolvedAiNavigationVolume } from "@engine/scene/aiNavigationVolume";

export {
  AI_NAVIGATION_VOLUME_DEFAULTS,
  AI_NAVIGATION_VOLUME_DEFAULT_SIZE,
  aiNavigationVolumeAabb,
  readVolumeScale,
  resolveAiNavigationVolume,
  uniqueAiNavigationVolumeId,
  uniqueAiNavigationVolumeName,
  type ResolvedAiNavigationVolume,
} from "@engine/scene/aiNavigationVolume";

export type AiNavigationVolumeObject = Group;

export interface AiNavigationVolumeRenderItem extends ResolvedAiNavigationVolume {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export function createAiNavigationVolumeObject(
  item: AiNavigationVolumeRenderItem,
): AiNavigationVolumeObject {
  const group = new Group();
  group.name = item.name;
  const geometry = new BoxGeometry(item.size[0], item.size[1], item.size[2]);
  const fill = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: new Color(item.color),
      transparent: true,
      opacity: 0.16,
      roughness: 0.9,
      metalness: 0,
      depthWrite: false,
    }),
  );
  fill.name = "ai-navigation-volume-fill";
  fill.castShadow = false;
  fill.receiveShadow = false;
  // Unreal-style volume picking: the translucent fill is a visual only and must
  // not be clickable — otherwise the volume's face covers the whole scene and
  // steals every click, so objects inside/behind it can't be selected. Only the
  // wireframe edges are pickable (below), exactly like Unreal's brush volumes.
  fill.raycast = () => {};
  group.add(fill);

  const wireframe = new LineSegments(
    new EdgesGeometry(geometry),
    new LineBasicMaterial({ color: new Color(item.color) }),
  );
  wireframe.name = "ai-navigation-volume-wire";
  group.add(wireframe);

  applyAiNavigationVolumeTransform(group, item);
  return group;
}

export function applyAiNavigationVolumeTransform(
  object: AiNavigationVolumeObject,
  item: AiNavigationVolumeRenderItem,
): void {
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

export function disposeAiNavigationVolumeObject(object: AiNavigationVolumeObject): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
  });
}

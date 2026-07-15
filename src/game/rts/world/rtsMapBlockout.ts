/**
 * Small playable map blockout — Vertical Slice Plan v0.2 §25 (Faz 2).
 *
 * This is deliberately authored data plus inexpensive placeholder geometry. It
 * establishes the playable spatial contract before resource/economy mechanics
 * arrive: two bases face one another across a central expansion and a rock
 * ridge, so infantry must choose the west or east approach. Buildings will add
 * their own dynamic blockers to this same navigation layer in the next slice.
 */
import { BoxGeometry, CircleGeometry, Color, Group, Mesh, MeshStandardMaterial } from "three";

import type { NavBlocker } from "@engine/navigation/gridNavigation";

export interface RtsMapPoint {
  readonly x: number;
  readonly z: number;
}

export interface RtsMapBlockout {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly centralExpansion: RtsMapPoint;
  readonly externalResource: RtsMapPoint;
  /** Static obstacle footprints consumed by `RtsNavigation`. */
  readonly navigationBlockers: readonly NavBlocker[];
}

/**
 * The initial one-map contract for Ürün A. The 24-unit-wide central ridge has
 * open west/east flanks, yielding two readable approach routes without making
 * the early map depend on road or territory systems.
 */
export const RTS_BLOCKOUT_MAP: RtsMapBlockout = {
  playerStart: { x: 0, z: 22 },
  enemyStart: { x: 0, z: -26 },
  centralExpansion: { x: 0, z: 0 },
  externalResource: { x: 27, z: 13 },
  navigationBlockers: [
    { min: [-12, -1, -4], max: [12, 4, 4] },
  ],
};

/** Creates the non-interactive blockout landmarks for the Phase 2 field. */
export function createRtsMapBlockout(map: RtsMapBlockout = RTS_BLOCKOUT_MAP): Group {
  const root = new Group();
  root.name = "rts-map-blockout";

  root.add(createZoneMarker("rts-player-start", map.playerStart, "#2d7fd6", 8));
  root.add(createZoneMarker("rts-enemy-start", map.enemyStart, "#c0392b", 8));
  root.add(createZoneMarker("rts-central-expansion", map.centralExpansion, "#d7ad52", 7));
  root.add(createZoneMarker("rts-external-resource", map.externalResource, "#63a86e", 5));

  for (const blocker of map.navigationBlockers) {
    root.add(createRockRidge(blocker));
  }
  root.add(...createBoundaryPlaceholders());
  return root;
}

function createZoneMarker(name: string, point: RtsMapPoint, color: string, radius: number): Mesh {
  const marker = new Mesh(
    new CircleGeometry(radius, 32),
    new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color),
      emissiveIntensity: 0.12,
      roughness: 0.9,
      transparent: true,
      opacity: 0.48,
    }),
  );
  marker.name = name;
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(point.x, 0.025, point.z);
  marker.receiveShadow = true;
  return marker;
}

function createRockRidge(blocker: NavBlocker): Mesh {
  const width = blocker.max[0] - blocker.min[0];
  const height = blocker.max[1] - blocker.min[1];
  const depth = blocker.max[2] - blocker.min[2];
  const ridge = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({ color: "#555149", roughness: 1 }),
  );
  ridge.name = "rts-central-ridge";
  ridge.position.set(
    (blocker.min[0] + blocker.max[0]) / 2,
    blocker.min[1] + height / 2,
    (blocker.min[2] + blocker.max[2]) / 2,
  );
  ridge.castShadow = true;
  ridge.receiveShadow = true;
  return ridge;
}

/** Visual-only boundary rocks; `RtsNavigation` world bounds enforce the edge. */
function createBoundaryPlaceholders(): Mesh[] {
  const material = new MeshStandardMaterial({ color: "#3f4934", roughness: 1 });
  const geometry = new BoxGeometry(120, 4, 3);
  const north = new Mesh(geometry, material);
  north.name = "rts-natural-boundary";
  north.position.set(0, 2, -58.5);
  const south = north.clone();
  south.position.z = 58.5;
  const sideGeometry = new BoxGeometry(3, 4, 114);
  const west = new Mesh(sideGeometry, material);
  west.name = "rts-natural-boundary";
  west.position.set(-58.5, 2, 0);
  const east = west.clone();
  east.position.x = 58.5;
  return [north, south, west, east];
}

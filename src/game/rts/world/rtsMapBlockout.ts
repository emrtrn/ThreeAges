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
import type { RtsResourceNodeDefinition } from "../economy/resourceNodeSystem";

export interface RtsMapPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * An authored candidate slot for one building
 * (`07_ENEMY_AI_DESIGN_v0.2.md` §40).
 *
 * §40 is explicit that the first vertical slice does *not* give the AI a
 * general-purpose city planner: the hand-made map supplies the legal spots, and
 * the AI only picks between them. That keeps AI bases tidy, tests repeatable,
 * and — the reason it is a plan §39 criterion — makes an infinite
 * "no valid placement" retry loop impossible.
 */
export interface RtsBuildAnchor {
  /** Building id from `balance/buildings.json` this slot is authored for. */
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
}

/**
 * One authored expansion region (`07_ENEMY_AI_DESIGN_v0.2.md` §45, §47–§48).
 *
 * AI-1 scope (§10) is a single expansion region, and §48 states the first slice
 * does not free-search road routes either: the map supplies the corridor. The
 * ordering of the members mirrors §47's recipe, which is also the order the
 * pieces become legal — the depot and production slots only fall inside the
 * outpost's *connected* control radius, so the road genuinely has to exist
 * before they can be built.
 */
export interface RtsExpansionRegion {
  readonly id: string;
  /** §26 step 1: the outpost that claims the region. */
  readonly outpost: RtsBuildAnchor;
  /** §26 step 3: the depot that lets the region's output reach the stockpile. */
  readonly depot: RtsBuildAnchor;
  /** §26 step 4: the region's resource building. */
  readonly production: RtsBuildAnchor;
  /**
   * §48: the authored corridor, walked as consecutive segments. It starts on a
   * tile touching the owner's command centre and ends past the region, passing
   * close enough to touch the outpost, depot and production slots.
   */
  readonly route: readonly RtsMapPoint[];
}

export interface RtsMapBlockout {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly centralExpansion: RtsMapPoint;
  readonly externalResource: RtsMapPoint;
  /**
   * Base-interior build slots for the enemy kingdom, all inside its starting
   * control radius. Named for the kingdom rather than for "the AI": which side
   * the AI plays is a runtime choice, not map data.
   */
  readonly enemyBaseAnchors: readonly RtsBuildAnchor[];
  /** The enemy kingdom's single authored expansion (§10: one region in AI-1). */
  readonly enemyExpansion: RtsExpansionRegion;
  /** Faz 6's finite safe and external stone/gold deposits. */
  readonly resourceNodes: readonly RtsResourceNodeDefinition[];
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
  // Authored around the enemy centre at (0, -26): every slot is grid-snapped,
  // clear of the 8x8 centre footprint and of its neighbours, and inside the
  // 18-unit starting control radius. §41 orders economy near the centre and the
  // Barracks between the centre and the front (here: the player's side is +z,
  // so the Barracks sits at -38, behind the base, matching §41's "merkez ile
  // sınır arasında" once the army rallies northward).
  enemyBaseAnchors: [
    { buildingId: "farm", x: -12, z: -26 },
    { buildingId: "lumber_camp", x: 12, z: -26 },
    { buildingId: "barracks", x: 0, z: -38 },
    { buildingId: "house", x: -12, z: -20 },
    { buildingId: "house", x: 12, z: -20 },
    { buildingId: "house", x: -12, z: -32 },
    { buildingId: "house", x: 12, z: -32 },
  ],
  // West flank. The outpost sits in neutral land just within the 12-unit
  // expansion reach of the enemy's starting territory; the depot and production
  // slots need the outpost's *connected* radius (12, not the unconnected 8), so
  // §47's "road before depot" ordering is enforced by the geometry itself.
  enemyExpansion: {
    id: "enemy_west",
    outpost: { buildingId: "outpost", x: -28, z: -20 },
    depot: { buildingId: "depot", x: -28, z: -28 },
    production: { buildingId: "farm", x: -28, z: -12 },
    // Leaves the centre on its west side, runs north clear of the base slots,
    // then turns west and down the x = -24 corridor, which touches all three.
    route: [
      { x: -6, z: -26 },
      { x: -6, z: -12 },
      { x: -24, z: -12 },
      { x: -24, z: -28 },
    ],
  },
  resourceNodes: [
    { id: "player_safe_stone", resourceId: "stone", kind: "safe", x: -4, z: 10 },
    { id: "player_safe_gold", resourceId: "gold", kind: "safe", x: 4, z: 10 },
    { id: "enemy_safe_stone", resourceId: "stone", kind: "safe", x: -4, z: -14 },
    { id: "enemy_safe_gold", resourceId: "gold", kind: "safe", x: 4, z: -14 },
    { id: "external_stone", resourceId: "stone", kind: "external", x: -34, z: 16 },
    { id: "external_gold", resourceId: "gold", kind: "external", x: 34, z: 16 },
  ],
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
  for (const node of map.resourceNodes) {
    root.add(createZoneMarker(
      `rts-resource-node-${node.id}`,
      node,
      node.resourceId === "gold" ? "#d6af3a" : "#8f969b",
      node.kind === "external" ? 2.5 : 2,
    ));
  }

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

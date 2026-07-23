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
import type { RtsTreeDefinition } from "../economy/forestSystem";
import { RTS_WORLD_HALF_EXTENT } from "./rtsGround";

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
   * §48/§49: the authored corridors, in preference order, each walked as
   * consecutive segments. A corridor joins the owner's base road spine and ends
   * past the region, passing close enough to touch the outpost, depot and
   * production slots.
   *
   * More than one because §49 asks for a route fallback: a corridor can be
   * refused for reasons the AI did not cause — a player's building or road
   * standing on a cell of it — and a region with a single authored line would
   * retire over an obstacle it could simply have gone around. §48 still rules out
   * a free route search; the alternatives are authored, not discovered.
   */
  readonly routes: readonly (readonly RtsMapPoint[])[];
}

/**
 * One authored capture objective for the §58 regional victory (Faz 11).
 *
 * Map data rather than a runtime spawn because §58's whole point is that the
 * objectives pull play *away* from the two bases: where they sit is a statement
 * about the map's shape, and only the author of the map can make it. The system
 * that scores them never invents one.
 */
export interface RtsStrategicPoint {
  readonly id: string;
  /** Shown in the countdown UI and in notifications; §60 replaced the minimap
   *  with "stratejik nokta isimleri", so this name is a navigation aid. */
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** World radius inside which an enemy unit contests the hold (§58). */
  readonly captureRadius: number;
}

export interface RtsMapBlockout {
  readonly playerStart: RtsMapPoint;
  readonly enemyStart: RtsMapPoint;
  readonly centralExpansion: RtsMapPoint;
  readonly externalResource: RtsMapPoint;
  /**
   * §58's two capture objectives, live only behind the `regionalVictory` flag.
   *
   * Both sit on the line through the origin *perpendicular* to the base-to-base
   * diagonal, which is the one placement that makes them exactly equidistant
   * from (-38,38) and (38,-38): ~60.7 units each, against a 28-unit starting
   * control radius. So neither kingdom owns one at match start and neither has a
   * shorter walk to either — a regional victory has to be expanded toward, not
   * inherited. They also straddle the central ridge (x -12..12, z -4..4) rather
   * than sitting on it, which is what turns §58's "merkez savunmasına kapanmayı
   * azaltıyor" into geometry: turtling at your own centre concedes both.
   */
  readonly strategicPoints: readonly RtsStrategicPoint[];
  /**
   * Base-interior build slots for the enemy kingdom, all inside its starting
   * control radius. Named for the kingdom rather than for "the AI": which side
   * the AI plays is a runtime choice, not map data.
   */
  readonly enemyBaseAnchors: readonly RtsBuildAnchor[];
  /**
   * The enemy kingdom's base road spine, walked as consecutive segments like an
   * expansion route (retraced legs are idempotent, which is how one polyline
   * expresses a branching network).
   *
   * Faz 6 made income conditional on logistics: a producer only pays into the
   * stockpile when a road touches its footprint *and* that road island also
   * touches one of the owner's depots. The base had neither, so its farm and
   * lumber camp filled their local buffers and stopped — the "AI'ın geliri yok"
   * limit recorded against Faz 5 §38. Faz 8 needs real income (the Town age
   * alone costs 600/350/150/150), so the base depot and its spine are authored
   * here, and the AI builds them through the same road service the player uses.
   */
  readonly enemyBaseRoute: readonly RtsMapPoint[];
  /**
   * The enemy kingdom's authored expansion regions, in preference order.
   *
   * §10 gave AI-1 exactly one; Faz 8 asks for "en fazla iki genişleme planı", so
   * the map authors the candidates and the AI's own plan limit — not the map's
   * length — is what caps how many it runs.
   */
  readonly enemyExpansions: readonly RtsExpansionRegion[];
  /** Faz 6's finite safe and external stone/gold deposits. */
  readonly resourceNodes: readonly RtsResourceNodeDefinition[];
  /** Individually harvestable wood sources; no forest group mesh owns gameplay. */
  readonly trees: readonly RtsTreeDefinition[];
  /** Static obstacle footprints consumed by `RtsNavigation`. */
  readonly navigationBlockers: readonly NavBlocker[];
}

/**
 * The initial one-map contract for Ürün A. The 24-unit-wide central ridge has
 * open west/east flanks, yielding two readable approach routes without making
 * the early map depend on road or territory systems.
 */
const PLAYER_START: RtsMapPoint = { x: -38, z: 38 };
const ENEMY_START: RtsMapPoint = { x: 38, z: -38 };

const TREE_VARIANTS: readonly RtsTreeDefinition["variant"][] = ["pine", "tree1", "tree2"];

/** Double each authored grove's density and per-tree yield without turning it into one static resource mesh. */
function denseForestTrees(trees: readonly RtsTreeDefinition[]): readonly RtsTreeDefinition[] {
  return trees.flatMap((tree, index) => {
    const offset = index % 2 === 0 ? { x: 2, z: -2 } : { x: -2, z: 2 };
    const capacity = tree.capacity * 2;
    return [
      { ...tree, capacity },
      {
        ...tree,
        id: `${tree.id}-dense`,
        x: tree.x + offset.x,
        z: tree.z + offset.z,
        capacity,
        variant: TREE_VARIANTS[(index + 1) % TREE_VARIANTS.length]!,
      },
    ];
  });
}

const atEnemyBase = (x: number, z: number): RtsMapPoint => ({
  x: ENEMY_START.x + x,
  z: ENEMY_START.z + z,
});

export const RTS_BLOCKOUT_MAP: RtsMapBlockout = {
  playerStart: PLAYER_START,
  enemyStart: ENEMY_START,
  centralExpansion: { x: 0, z: 0 },
  externalResource: { x: 27, z: 13 },
  strategicPoints: [
    // Named west/east: x reads the same for both kingdoms, while "north/south"
    // would be the enemy's z convention worn by a label the player also reads.
    { id: "west_pass", name: "Batı Geçidi", x: -20, z: -20, captureRadius: 10 },
    { id: "east_pass", name: "Doğu Geçidi", x: 20, z: 20, captureRadius: 10 },
  ],
  // Authored around the north-east enemy centre at (38, -38): every slot is grid-snapped,
  // clear of the 8x8 centre footprint and of its neighbours, and inside the
  // 18-unit starting control radius. §41 orders economy near the centre and the
  // Barracks between the centre and the front (here: the player's side is +z,
  // so the Barracks sits at -38, behind the base, matching §41's "merkez ile
  // sınır arasında" once the army rallies northward).
  // All offsets below move with ENEMY_START and remain within the enlarged
  // starting territory, so the AI opens from its actual new corner position.
  enemyBaseAnchors: [
    { buildingId: "farm", ...atEnemyBase(-12, 0) },
    { buildingId: "lumber_camp", ...atEnemyBase(12, 0) },
    // Faz 8: the Town age requires a quarry and a gold mine, and both must cover
    // a live deposit. The two enemy-side safe nodes sit at (-4,-14) and (4,-14),
    // so these are the only two slots on this map that can ever satisfy it — the
    // 6-wide footprint reaches a node up to 3 units off centre.
    { buildingId: "quarry", ...atEnemyBase(-6, 12) },
    { buildingId: "gold_mine", ...atEnemyBase(6, 12) },
    // The base depot sits in the gap the two extractors leave, where the spine
    // can touch all three from the z=-18 leg.
    { buildingId: "depot", ...atEnemyBase(0, 12) },
    { buildingId: "barracks", ...atEnemyBase(0, -12) },
    // Town military branch: the range is outside the tight opening ring, but
    // inside the Town control radius. It cannot compete with the first Barracks
    // for the early base slot and becomes legal only after the age transition.
    { buildingId: "archery_range", ...atEnemyBase(-12, -18) },
    // Faz M4: the AI's Market. Behind the Barracks, in the only 8x8 gap the base
    // ring leaves — clear of the spine (z = 8) and both expansion corridors, and
    // 22 units out, well inside the 28-unit starting control the trade rule
    // (KR-M4) requires it to stand in.
    { buildingId: "market", ...atEnemyBase(0, -22) },
    // Housing moved behind the base: the two former slots at (±12,-20) stood on
    // what is now the spine's branch down to the farm and lumber camp.
    { buildingId: "house", ...atEnemyBase(-12, -6) },
    { buildingId: "house", ...atEnemyBase(12, -6) },
    { buildingId: "house", ...atEnemyBase(-16, -6) },
    { buildingId: "house", ...atEnemyBase(16, -6) },
    { buildingId: "house", ...atEnemyBase(-12, -10) },
    { buildingId: "house", ...atEnemyBase(12, -10) },
  ],
  // Spur to the centre, spine across the base, then a branch down to each of the
  // two starting producers. The leg back along z=-18 is retraced on purpose:
  // segments are idempotent, so one polyline can express a branching network.
  enemyBaseRoute: [
    atEnemyBase(0, 6),
    atEnemyBase(0, 8),
    atEnemyBase(-12, 8),
    atEnemyBase(-12, 4),
    atEnemyBase(-12, 8),
    atEnemyBase(12, 8),
    atEnemyBase(12, 4),
  ],
  // West then east flank. Each outpost sits in neutral land just within the
  // 12-unit expansion reach of the enemy's starting territory; the depot and
  // production slots need the outpost's *connected* radius (12, not the
  // unconnected 8), so §47's "road before depot" ordering is enforced by the
  // geometry itself. The two are mirrors: §49 wants a second plan to be a real
  // alternative, not a worse consolation.
  enemyExpansions: [
    {
      id: "enemy_west",
      outpost: { buildingId: "outpost", ...atEnemyBase(-28, 6) },
      depot: { buildingId: "depot", ...atEnemyBase(-28, -2) },
      production: { buildingId: "farm", ...atEnemyBase(-28, 14) },
      routes: [
        // Joins the base spine at its west end, runs out along z = -18, then
        // covers the x = -24 corridor, which touches all three region slots. It
        // used to leave the centre up the x = -6 line; Faz 8's quarry now stands
        // there, and a road cell may never overlap a footprint.
        [
          atEnemyBase(-12, 8),
          atEnemyBase(-24, 8),
          atEnemyBase(-24, 14),
          atEnemyBase(-24, -2),
        ],
        // Fallback: leave the base northward and come at the corridor along
        // z = -8, clear of the z = -18 leg entirely. Nothing is authored on this
        // line, so an obstruction on the direct corridor does not retire the
        // region (§49 "yol rota fallback'i").
        [
          atEnemyBase(-12, 8),
          atEnemyBase(-12, 18),
          atEnemyBase(-24, 18),
          atEnemyBase(-24, 14),
          atEnemyBase(-24, -2),
        ],
      ],
    },
    {
      id: "enemy_east",
      outpost: { buildingId: "outpost", ...atEnemyBase(28, 6) },
      depot: { buildingId: "depot", ...atEnemyBase(28, -2) },
      production: { buildingId: "lumber_camp", ...atEnemyBase(28, 14) },
      routes: [
        [
          atEnemyBase(12, 8),
          atEnemyBase(24, 8),
          atEnemyBase(24, 14),
          atEnemyBase(24, -2),
        ],
        [
          atEnemyBase(12, 8),
          atEnemyBase(12, 18),
          atEnemyBase(24, 18),
          atEnemyBase(24, 14),
          atEnemyBase(24, -2),
        ],
      ],
    },
  ],
  resourceNodes: [
    { id: "player_safe_stone", resourceId: "stone", kind: "safe", x: -42, z: 26 },
    { id: "player_safe_gold", resourceId: "gold", kind: "safe", x: -34, z: 26 },
    { id: "enemy_safe_stone", resourceId: "stone", kind: "safe", x: 34, z: -26 },
    { id: "enemy_safe_gold", resourceId: "gold", kind: "safe", x: 42, z: -26 },
    { id: "external_stone", resourceId: "stone", kind: "external", x: -34, z: 16 },
    { id: "external_gold", resourceId: "gold", kind: "external", x: 34, z: 16 },
  ],
  trees: denseForestTrees([
    { id: "player-wood-1", forestId: "player-grove", x: -56, z: 40, capacity: 30, variant: "pine" },
    { id: "player-wood-2", forestId: "player-grove", x: -52, z: 42, capacity: 30, variant: "tree1" },
    { id: "player-wood-3", forestId: "player-grove", x: -48, z: 40, capacity: 30, variant: "tree2" },
    { id: "player-wood-4", forestId: "player-grove", x: -56, z: 34, capacity: 30, variant: "tree1" },
    { id: "player-wood-5", forestId: "player-grove", x: -52, z: 32, capacity: 30, variant: "pine" },
    { id: "player-wood-6", forestId: "player-grove", x: -48, z: 34, capacity: 30, variant: "tree2" },
    { id: "player-wood-7", forestId: "player-grove", x: -54, z: 28, capacity: 30, variant: "tree2" },
    { id: "player-wood-8", forestId: "player-grove", x: -48, z: 28, capacity: 30, variant: "pine" },
    { id: "enemy-wood-1", forestId: "enemy-grove", x: 48, z: -30, capacity: 30, variant: "pine" },
    { id: "enemy-wood-2", forestId: "enemy-grove", x: 52, z: -28, capacity: 30, variant: "tree1" },
    { id: "enemy-wood-3", forestId: "enemy-grove", x: 56, z: -30, capacity: 30, variant: "tree2" },
    { id: "enemy-wood-4", forestId: "enemy-grove", x: 46, z: -36, capacity: 30, variant: "tree1" },
    { id: "enemy-wood-5", forestId: "enemy-grove", x: 54, z: -36, capacity: 30, variant: "pine" },
    { id: "enemy-wood-6", forestId: "enemy-grove", x: 58, z: -38, capacity: 30, variant: "tree2" },
    { id: "enemy-wood-7", forestId: "enemy-grove", x: 48, z: -44, capacity: 30, variant: "tree2" },
    { id: "enemy-wood-8", forestId: "enemy-grove", x: 54, z: -44, capacity: 30, variant: "pine" },
    { id: "west-wood-1", forestId: "west-grove", x: -48, z: 10, capacity: 30, variant: "pine" },
    { id: "west-wood-2", forestId: "west-grove", x: -44, z: 12, capacity: 30, variant: "tree1" },
    { id: "west-wood-3", forestId: "west-grove", x: -40, z: 10, capacity: 30, variant: "tree2" },
    { id: "west-wood-4", forestId: "west-grove", x: -48, z: 4, capacity: 30, variant: "tree1" },
    { id: "west-wood-5", forestId: "west-grove", x: -42, z: 4, capacity: 30, variant: "pine" },
    { id: "west-wood-6", forestId: "west-grove", x: -38, z: 6, capacity: 30, variant: "tree2" },
    { id: "east-wood-1", forestId: "east-grove", x: 38, z: -4, capacity: 30, variant: "pine" },
    { id: "east-wood-2", forestId: "east-grove", x: 44, z: -4, capacity: 30, variant: "tree1" },
    { id: "east-wood-3", forestId: "east-grove", x: 48, z: -6, capacity: 30, variant: "tree2" },
    { id: "east-wood-4", forestId: "east-grove", x: 40, z: -10, capacity: 30, variant: "tree1" },
    { id: "east-wood-5", forestId: "east-grove", x: 46, z: -12, capacity: 30, variant: "pine" },
    { id: "east-wood-6", forestId: "east-grove", x: 52, z: -12, capacity: 30, variant: "tree2" },
    { id: "north-wood-1", forestId: "north-grove", x: -12, z: -46, capacity: 30, variant: "pine" },
    { id: "north-wood-2", forestId: "north-grove", x: -6, z: -44, capacity: 30, variant: "tree1" },
    { id: "north-wood-3", forestId: "north-grove", x: 0, z: -46, capacity: 30, variant: "tree2" },
    { id: "north-wood-4", forestId: "north-grove", x: -10, z: -52, capacity: 30, variant: "tree1" },
    { id: "north-wood-5", forestId: "north-grove", x: -2, z: -52, capacity: 30, variant: "pine" },
    { id: "south-wood-1", forestId: "south-grove", x: 4, z: 42, capacity: 30, variant: "pine" },
    { id: "south-wood-2", forestId: "south-grove", x: 10, z: 44, capacity: 30, variant: "tree1" },
    { id: "south-wood-3", forestId: "south-grove", x: 16, z: 42, capacity: 30, variant: "tree2" },
    { id: "south-wood-4", forestId: "south-grove", x: 6, z: 36, capacity: 30, variant: "tree1" },
    { id: "south-wood-5", forestId: "south-grove", x: 14, z: 36, capacity: 30, variant: "pine" },
    // Grove expansions (§ wood-supply pass): each authored grove gets extra
    // outward trees so a match is not starved of wood. denseForestTrees still
    // doubles every entry below, and the level Actor copy is regenerated to
    // match, so both the blockout and RTS_CoreMatch.level.json stay identical.
    { id: "player-wood-9", forestId: "player-grove", x: -58, z: 34, capacity: 30, variant: "pine" },
    { id: "player-wood-10", forestId: "player-grove", x: -58, z: 40, capacity: 30, variant: "tree1" },
    { id: "player-wood-11", forestId: "player-grove", x: -56, z: 28, capacity: 30, variant: "tree2" },
    { id: "player-wood-12", forestId: "player-grove", x: -56, z: 36, capacity: 30, variant: "pine" },
    { id: "player-wood-13", forestId: "player-grove", x: -56, z: 38, capacity: 30, variant: "tree1" },
    { id: "player-wood-14", forestId: "player-grove", x: -56, z: 42, capacity: 30, variant: "tree2" },
    { id: "enemy-wood-9", forestId: "enemy-grove", x: 52, z: -26, capacity: 30, variant: "pine" },
    { id: "enemy-wood-10", forestId: "enemy-grove", x: 56, z: -32, capacity: 30, variant: "tree1" },
    { id: "enemy-wood-11", forestId: "enemy-grove", x: 56, z: -28, capacity: 30, variant: "tree2" },
    { id: "enemy-wood-12", forestId: "enemy-grove", x: 54, z: -26, capacity: 30, variant: "pine" },
    { id: "enemy-wood-13", forestId: "enemy-grove", x: 56, z: -26, capacity: 30, variant: "tree1" },
    { id: "enemy-wood-14", forestId: "enemy-grove", x: 54, z: -24, capacity: 30, variant: "tree2" },
    { id: "west-wood-7", forestId: "west-grove", x: -50, z: 4, capacity: 30, variant: "tree1" },
    { id: "west-wood-8", forestId: "west-grove", x: -50, z: 10, capacity: 30, variant: "tree2" },
    { id: "west-wood-9", forestId: "west-grove", x: -48, z: 6, capacity: 30, variant: "pine" },
    { id: "west-wood-10", forestId: "west-grove", x: -48, z: 12, capacity: 30, variant: "tree1" },
    { id: "west-wood-11", forestId: "west-grove", x: -46, z: 10, capacity: 30, variant: "tree2" },
    { id: "west-wood-12", forestId: "west-grove", x: -46, z: 12, capacity: 30, variant: "pine" },
    { id: "east-wood-7", forestId: "east-grove", x: 36, z: -4, capacity: 30, variant: "tree1" },
    { id: "east-wood-8", forestId: "east-grove", x: 38, z: -10, capacity: 30, variant: "tree2" },
    { id: "east-wood-9", forestId: "east-grove", x: 38, z: -2, capacity: 30, variant: "pine" },
    { id: "east-wood-10", forestId: "east-grove", x: 42, z: -10, capacity: 30, variant: "tree1" },
    { id: "east-wood-11", forestId: "east-grove", x: 42, z: -4, capacity: 30, variant: "tree2" },
    { id: "east-wood-12", forestId: "east-grove", x: 44, z: -2, capacity: 30, variant: "pine" },
    { id: "north-wood-6", forestId: "north-grove", x: -14, z: -46, capacity: 30, variant: "pine" },
    { id: "north-wood-7", forestId: "north-grove", x: -12, z: -52, capacity: 30, variant: "tree1" },
    { id: "north-wood-8", forestId: "north-grove", x: -12, z: -44, capacity: 30, variant: "tree2" },
    { id: "north-wood-9", forestId: "north-grove", x: -8, z: -52, capacity: 30, variant: "pine" },
    { id: "north-wood-10", forestId: "north-grove", x: -8, z: -44, capacity: 30, variant: "tree1" },
    { id: "north-wood-11", forestId: "north-grove", x: -6, z: -42, capacity: 30, variant: "tree2" },
    { id: "south-wood-6", forestId: "south-grove", x: 2, z: 42, capacity: 30, variant: "pine" },
    { id: "south-wood-7", forestId: "south-grove", x: 4, z: 36, capacity: 30, variant: "tree1" },
    { id: "south-wood-8", forestId: "south-grove", x: 4, z: 44, capacity: 30, variant: "tree2" },
    { id: "south-wood-9", forestId: "south-grove", x: 8, z: 36, capacity: 30, variant: "pine" },
    { id: "south-wood-10", forestId: "south-grove", x: 8, z: 44, capacity: 30, variant: "tree1" },
    { id: "south-wood-11", forestId: "south-grove", x: 10, z: 46, capacity: 30, variant: "tree2" },
  ]),
  navigationBlockers: [
    { min: [-12, -1, -4], max: [12, 4, 4] },
  ],
};

/** Creates the non-interactive blockout landmarks for the Phase 2 field. */
export function createRtsMapBlockout(map: RtsMapBlockout = RTS_BLOCKOUT_MAP): Group {
  const root = new Group();
  root.name = "rts-map-blockout";

  // No start-position discs: the blockout drew a filled team-coloured circle
  // under each command centre to say whose base this was. The §64 team rings now
  // answer that on every unit and building, and the disc only added a coloured
  // patch of ground the centre's own ring had to compete with.
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
  const size = RTS_WORLD_HALF_EXTENT * 2;
  const geometry = new BoxGeometry(size, 4, 3);
  const north = new Mesh(geometry, material);
  north.name = "rts-natural-boundary";
  north.position.set(0, 2, -RTS_WORLD_HALF_EXTENT + 1.5);
  const south = north.clone();
  south.position.z = RTS_WORLD_HALF_EXTENT - 1.5;
  const sideGeometry = new BoxGeometry(3, 4, size - 6);
  const west = new Mesh(sideGeometry, material);
  west.name = "rts-natural-boundary";
  west.position.set(-RTS_WORLD_HALF_EXTENT + 1.5, 2, 0);
  const east = west.clone();
  east.position.x = RTS_WORLD_HALF_EXTENT - 1.5;
  return [north, south, west, east];
}

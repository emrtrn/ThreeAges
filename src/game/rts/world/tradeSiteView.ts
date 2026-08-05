/**
 * Click targets for the map's trade sites — supply plan Faz S6.
 *
 * A trade site has no object of its own. Its art is authored Level scenery (a
 * port mesh, a cut grove, a mine head), batched by the world loader into shared
 * `InstancedMesh`es with no per-placement `Object3D` to pick — and that art does
 * not even stand on the marker: the river port's mesh sits six units off, out on
 * the water side, because the marker is the *landward apron* the road has to
 * touch (plan §3.3). So "click the port" cannot mean "raycast the port model".
 *
 * What the player is actually pointing at is the **dock**: the 8×8 of ground the
 * site reserves, which is the thing the whole mechanic is about — where the road
 * connects. This mounts one never-drawn box over each dock and hands the
 * explored ones to {@link SelectionSystem} as a fourth pick list.
 *
 * Three properties are load-bearing:
 *
 * - **Never rendered, always raycastable.** `visible = false` keeps the boxes out
 *   of every draw and shadow pass, and costs them nothing at pick time: three.js
 *   raycasting does *not* consult `visible` (`Raycaster`'s `intersect` tests only
 *   `layers`, then calls `raycast` straight through). That asymmetry is the whole
 *   trick, and it was worth measuring rather than assuming — the first cut of
 *   this file used `visible` as the fog gate and a site in unexplored ground was
 *   still perfectly clickable.
 * - **{@link exploredMeshes} is therefore the gate.** Because visibility cannot
 *   do it, the fog rule is an explicit filter on the list handed out, and it has
 *   to be one: without it a player could click black ground and read a port's
 *   name, its owner and its rate out of it. That is the same explored-keyed rule
 *   the site's art already runs under (`vision/fogMask.ts`), applied to the one
 *   surface a pixel mask cannot reach, because a pick has no pixels.
 * - **Its own list.** Units, structures and centres each raycast an explicit set
 *   of meshes, so these cannot silently steal their picks, and ground picking
 *   uses a mathematical plane rather than scene geometry — so it is untouched too.
 */
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Object3D } from "three";

import type { TradeSiteBalance } from "../../data/gameDataTypes";
import type { RtsTradeSiteDefinition } from "../economy/tradeSiteSystem";

/**
 * Height of the pick box, in world units.
 *
 * Tall enough that the RTS camera's oblique view still lands on it when the
 * player aims at the near edge of a dock, short enough that it never intercepts
 * a click meant for something standing behind the site. It is a click volume,
 * not a collider: nothing in navigation, placement or combat reads it.
 */
const PICK_HEIGHT = 2;

export class TradeSiteView {
  private readonly root = new Group();
  private readonly siteByObject = new Map<Object3D, string>();
  /**
   * Sites the observer has scouted, and so the only ones that may be picked.
   *
   * Starts empty rather than full: a site is unclickable until a fog pass says
   * otherwise, the same "begin fully unknown" stance `FogView` takes with its
   * texture. Defaulting the other way would leave every site pickable for the
   * frames between construction and the first pass, which is exactly the window
   * a fog leak lives in — and being unselectable for a frame at boot costs
   * nothing, because there is nothing to inspect yet.
   */
  private readonly explored = new Set<string>();

  /**
   * @throws never for an unknown site type — {@link TradeSiteSystem} is
   *   constructed from the same two inputs and refuses one loudly there, so a
   *   second throw here would only race it. A site whose type is missing simply
   *   gets no proxy, which cannot happen in a world that started.
   */
  constructor(balance: TradeSiteBalance, definitions: readonly RtsTradeSiteDefinition[]) {
    this.root.name = "rts-trade-site-picks";
    // One material for every box, and it is only here because `Mesh.raycast`
    // returns early without one. Nothing ever draws it.
    const material = new MeshBasicMaterial();
    for (const definition of definitions) {
      const stats = balance[definition.siteType];
      if (!stats) continue;
      const mesh = new Mesh(
        new BoxGeometry(stats.dock.width, PICK_HEIGHT, stats.dock.depth),
        material,
      );
      mesh.name = `rts-trade-site-pick-${definition.id}`;
      mesh.position.set(definition.x, PICK_HEIGHT / 2, definition.z);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.tradeSiteId = definition.id;
      this.siteByObject.set(mesh, definition.id);
      this.root.add(mesh);
    }
    this.material = material;
  }

  private readonly material: MeshBasicMaterial;

  /** The subtree to add to the scene. */
  get object(): Group {
    return this.root;
  }

  /**
   * The pick list handed to {@link SelectionSystem} — explored sites only.
   *
   * The filter is the fog rule, not an optimisation; see the file header for why
   * `visible` cannot carry it.
   */
  targetMeshes(): readonly Object3D[] {
    return [...this.siteByObject].filter(([, siteId]) => this.explored.has(siteId)).map(([mesh]) => mesh);
  }

  /** The site a raycast hit belongs to, or null for anything else. */
  siteForObject(object: Object3D): string | null {
    return this.siteByObject.get(object) ?? null;
  }

  /**
   * §59: latch every site standing in ground the observer has explored.
   *
   * Keyed off `isExplored` rather than `isVisible`, matching the site's own art
   * and the trees and deposits beside it (GDD 08 §40): a port you scouted an
   * hour ago stays clickable when nothing of yours is near it. Called with no
   * predicate (fog off) every site is selectable, which is what "no fog" means.
   *
   * Not itself a latch — it recomputes from the predicate every call, because
   * `VisionSystem.isExplored` is already the latch and duplicating it here would
   * give a match restart two memories to clear instead of one.
   */
  syncExplored(isExplored?: (x: number, z: number) => boolean): void {
    this.explored.clear();
    for (const [mesh, siteId] of this.siteByObject) {
      if (isExplored?.(mesh.position.x, mesh.position.z) ?? true) this.explored.add(siteId);
    }
  }

  dispose(): void {
    for (const mesh of this.siteByObject.keys()) {
      (mesh as Mesh).geometry.dispose();
      this.root.remove(mesh);
    }
    this.material.dispose();
    this.siteByObject.clear();
    this.explored.clear();
  }
}

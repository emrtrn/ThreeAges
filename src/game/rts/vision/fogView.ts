/**
 * The player's fog overlay — Vertical Slice Plan v0.2 §59, GDD 08 §38–§40.
 *
 * One ground-sized plane carrying a {@link DataTexture} of one texel per vision
 * cell, not a mesh per cell. The territory overlay can afford per-cell meshes
 * because it only draws *owned* land; fog covers the whole 140×140 world, which
 * at the 2-unit grid is ~5k cells — 5k meshes rebuilt as the player scouts would
 * be exactly the cost §59's "görüş güncellemesi performans sorunu oluşturmuyor"
 * forbids. Here a refresh is a byte-array write plus one texture upload.
 *
 * The three §38 layers are drawn as alpha on a single black plane:
 *   unknown  → opaque      (a player sees nothing)
 *   explored → half        (terrain reads through; §40's remembered ground)
 *   visible  → clear
 *
 * `LinearFilter` smooths the cell edges into a soft frontier for free, which is
 * why the coarse grid does not read as a checkerboard.
 *
 * View only: it renders whatever {@link VisionSystem} resolved and never decides
 * what is visible. Units and structures are hidden by `fogVisibilityBinder.ts` —
 * a flat plane cannot occlude a 3D body, so object visibility is a separate job.
 */
import {
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  UnsignedByteType,
} from "three";

import type { UnitOwner } from "../units/unit";
import type { VisionSystem } from "./visionSystem";

/** Alpha applied to each §38 layer, as a 0–255 texel value. */
const UNKNOWN_ALPHA = 255;
const EXPLORED_ALPHA = 128;
const VISIBLE_ALPHA = 0;

export class FogView {
  readonly root = new Group();
  private readonly texture: DataTexture;
  private readonly data: Uint8Array;
  private readonly material: MeshBasicMaterial;
  private readonly geometry: PlaneGeometry;
  private readonly resolution: number;

  constructor(private readonly vision: VisionSystem, private readonly observer: UnitOwner) {
    this.root.name = "rts-fog-of-war";
    this.resolution = vision.gridResolution;
    this.data = new Uint8Array(this.resolution * this.resolution * 4);
    // Start fully unknown so the very first frame is dark rather than a flash of
    // the whole map before the first refresh lands.
    this.data.fill(UNKNOWN_ALPHA);

    // RGBA rather than a single red channel, despite only one value varying:
    // three's alphaMap shader samples the **green** channel
    // (`diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g`), so a RedFormat
    // texture reads as g=0 — alpha zero everywhere, and the fog renders
    // completely invisible while every unit test still passes. The value is
    // written to all four channels so the plane does not depend on which one
    // three decides to read.
    this.texture = new DataTexture(
      this.data,
      this.resolution,
      this.resolution,
      RGBAFormat,
      UnsignedByteType,
    );
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    // The grid is stored row 0 = world -Z, but the plane is a PlaneGeometry
    // turned by `rotateX(-PI/2)`, which sends local +Y to world -Z — so with
    // DataTexture's default `flipY = false` the fog renders mirrored along Z.
    // The symptom is subtle and easy to misread as a vision bug: the revealed
    // circle appears at (-38, -38) while the base that earned it sits at
    // (-38, +38), so the player's own town is fogged and an empty corner is
    // clear. Every unit test still passes, because the grid itself is correct.
    this.texture.flipY = true;
    this.texture.needsUpdate = true;

    const { worldHalfExtent } = vision.gridOptions;
    this.geometry = new PlaneGeometry(worldHalfExtent * 2, worldHalfExtent * 2);
    this.geometry.rotateX(-Math.PI / 2);

    this.material = new MeshBasicMaterial({
      color: 0x05070b,
      transparent: true,
      depthWrite: false,
      alphaMap: this.texture,
    });

    const mesh = new Mesh(this.geometry, this.material);
    mesh.name = "rts-fog-plane";
    // Above the territory cells (y 0.022) and the §58 objective rings (y 0.03):
    // fog has to hide your own control overlay too, or the shape of your
    // territory would quietly map the parts of the world you have never visited.
    mesh.position.set(0, 0.05, 0);
    mesh.renderOrder = 4;
    this.root.add(mesh);
  }

  /**
   * Re-upload the fog texture from the current vision grid.
   *
   * Called every simulation tick. The work is one pass over ~5k bytes plus a
   * texture upload; no allocation, no scene-graph churn.
   */
  refresh(): void {
    const { visible, explored } = this.vision.visibilityGrid(this.observer);
    const cells = visible.length;
    for (let cell = 0; cell < cells; cell += 1) {
      const alpha = visible[cell]
        ? VISIBLE_ALPHA
        : explored[cell] ? EXPLORED_ALPHA : UNKNOWN_ALPHA;
      const texel = cell * 4;
      this.data[texel] = alpha;
      this.data[texel + 1] = alpha;
      this.data[texel + 2] = alpha;
      this.data[texel + 3] = alpha;
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.root.clear();
  }
}

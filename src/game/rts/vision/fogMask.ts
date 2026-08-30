/**
 * Static map art under the fog, cut per pixel — Vertical Slice Plan v0.2 §59,
 * GDD 08 §39–§40.
 *
 * This replaces the reveal-the-whole-prop rule that came before it. That rule
 * asked one question per model — "has the player explored the ground at this
 * point?" — and there is no honest point to ask it at. A Level scales its
 * backdrop mountains 20–25×, so the pivot sits tens of metres inside the
 * silhouette and the player had to walk *into* a mountain to make it appear;
 * widening the test to the model's own bounds only moved the failure, because
 * bounds that large touch the opening vision and every mountain on the horizon
 * arrived on the first frame. Whichever way it was tuned, the moment it fired
 * the entire model appeared at once, including the parts standing in ground
 * nobody had been near.
 *
 * The question is wrong, not its tuning. A mountain is not *at* a place; it
 * occupies a range of places, and each of them has its own answer. So the test
 * moves to the fragment: {@link FogView}'s texture — the same one the ground
 * overlay draws, already blurred and already eased — is handed to the materials
 * as a world-space mask. Every pixel of scenery follows the fog state of the
 * ground directly beneath it: clear in current sight, half-visible in remembered
 * fog, and absent in unknown ground.
 *
 * **Why `explored` and not `visible`.** GDD 08 §40 keeps terrain and permanent
 * natural elements on the map once seen, so a ridge you scouted an hour ago is
 * still drawn when nothing of yours is near it. The mask threshold
 * ({@link MASK_RANGE_LOW}/{@link MASK_RANGE_HIGH}) is what encodes that: it sits
 * above the overlay's *explored* alpha, so only never-seen ground hides anything.
 *
 * **What this deliberately does not cover.** Units, structures and command
 * centres stay object-level in {@link FogVisibilityBinder}, and that is a
 * gameplay decision rather than a leftover: half of an enemy army rendering
 * across a fog boundary leaks the position of the other half. Trees, deposits
 * and wildlife keep their own `visible` loops for the reason those loops exist —
 * they already own `visible` for depletion, and a second writer would fight
 * them. Painted *foliage* is not one of those: it is decoration with no
 * simulation behind it, nothing writes its `visible`, and it is under this mask
 * like the rest of the Level's art (`RtsApp.loadAuthoredWorld`).
 *
 * View-side only: it reads the fog texture and patches materials. It never
 * decides what is visible, and the {@link VisionSystem} grid it ultimately comes
 * from stays exactly binary, so what the AI knows is untouched (TD-002).
 */
import type { Material, Mesh, MeshDepthMaterial, Object3D, Texture } from "three";

import {
  applyWorldMask,
  applyWorldMaskShadow,
  createWorldMaskUniforms,
  type WorldMaskUniforms,
} from "@engine/render-three/worldMaskPatch";

/**
 * Fog alpha below which nothing is hidden, as a 0–1 texture value.
 *
 * {@link FogView} draws visible ground at 0, explored at 128/255 ≈ 0.502 and
 * unknown at 1. This sits above explored with room to spare, which is §40 in one
 * number: ground the player has seen keeps its scenery as a remembered,
 * half-visible silhouette instead of dropping it entirely.
 */
const MASK_RANGE_LOW = 0.6;

/**
 * Fog alpha at which scenery is fully hidden.
 *
 * Short of 1 on purpose. The fog texture is gaussian-blurred before upload, so
 * the step from explored to unknown arrives as a ramp a few cells wide; ending
 * the dissolve before the ramp tops out keeps the fully-hidden region from
 * shrinking away from the fog the player actually sees on the ground, which
 * would show a rim of lit scenery standing in visibly black terrain.
 */
const MASK_RANGE_HIGH = 0.8;

/**
 * Binds {@link FogView}'s texture to the materials of the map's static art.
 *
 * One instance per match, constructed beside the fog view and fed by it. Holds
 * no per-prop state at all — where the old worklist tracked every authored
 * placement on the map and dropped them one at a time, this is a handful of
 * uniforms that the GPU re-reads for free every frame. The Level with ten
 * thousand placements now costs the same as the empty one.
 */
export class FogMask {
  private readonly uniforms: WorldMaskUniforms;
  /** Depth materials this created, owned here because nothing else can free them. */
  private readonly depthMaterials: MeshDepthMaterial[] = [];
  /** Every material patched so far, so a re-applied world does not double-patch. */
  private readonly patched = new Set<Material>();

  /**
   * @param span World-unit width the fog texture's 0..1 UV range covers. Must be
   *   the grid's `resolution * cellSize` and not `worldHalfExtent * 2` — those
   *   differ by one cell, because the grid centres a cell on each extreme, and
   *   the fog surface is built from the former (`fogView.createSurfaceGeometry`).
   *   Passing the wrong one slides the whole mask half a cell off the world.
   */
  constructor(span: number) {
    this.uniforms = createWorldMaskUniforms({
      span,
      rangeLow: MASK_RANGE_LOW,
      rangeHigh: MASK_RANGE_HIGH,
    });
  }

  /** Point the mask at the fog view's live texture. */
  setTexture(texture: Texture): void {
    this.uniforms.tWorldMask.value = texture;
  }

  /**
   * Put every material under this subtree behind the mask.
   *
   * Additive and safely re-callable, for the same reason the binder's old
   * `trackWorldProps` was: the blockout's art and the Level's authored world
   * finish loading independently, in an order neither controls, and materials are
   * shared freely inside each. Patching is idempotent per material.
   *
   * Shadows are patched alongside, per mesh rather than per material, because
   * `customDepthMaterial` is a property of the mesh.
   */
  apply(roots: readonly Object3D[]): void {
    for (const root of roots) {
      root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!material || this.patched.has(material)) continue;
          applyWorldMask(material, this.uniforms);
          this.patched.add(material);
        }
        if (!mesh.castShadow) return;
        const depth = applyWorldMaskShadow(mesh, this.uniforms);
        if (depth) this.depthMaterials.push(depth);
      });
    }
  }

  /**
   * Turn hiding off (match over) or back on.
   *
   * A uniform rather than an un-patching pass: the patch is compiled into the
   * program, and reverting it would recompile every material on the map at the
   * exact moment the victory card wants to be on screen.
   */
  setEnabled(enabled: boolean): void {
    this.uniforms.worldMaskStrength.value = enabled ? 1 : 0;
  }

  /**
   * Release what this owns and stop hiding.
   *
   * The order matters and the disable is not a courtesy. Patched materials
   * outlive this object — they belong to the scene — and three.js binds a 1×1
   * *white* texture to any sampler whose uniform is null, which the patch would
   * read as "unknown everywhere" and discard the entire map. Zeroing the strength
   * first makes the dangling sampler unreachable.
   */
  dispose(): void {
    this.setEnabled(false);
    for (const depth of this.depthMaterials) depth.dispose();
    this.depthMaterials.length = 0;
    this.patched.clear();
    this.uniforms.tWorldMask.value = null;
  }

  /** The live uniform block, for `test:engine` and the debug overlay. */
  get maskUniforms(): WorldMaskUniforms {
    return this.uniforms;
  }
}

/** Exposed so the engine test can pin the thresholds against `FogView`'s alphas. */
export const FOG_MASK_RANGE = { low: MASK_RANGE_LOW, high: MASK_RANGE_HIGH } as const;

/**
 * The fraction of a static-art fragment that the fog removes.
 *
 * Mirrors the GLSL expression in `worldMaskPatch.ts`: only the unknown
 * transition discards a fragment. Remembered terrain remains solid and receives
 * its separate colour veil through `fogMaskVeilFraction`. Kept here so engine
 * checks can pin the presentation contract without a WebGL readback.
 */
export function fogMaskHiddenFraction(maskValue: number): number {
  const value = Math.min(1, Math.max(0, maskValue));
  const width = MASK_RANGE_HIGH - MASK_RANGE_LOW;
  const edge = width <= 0 ? (value >= MASK_RANGE_HIGH ? 1 : 0) : Math.min(
    1,
    Math.max(0, (value - MASK_RANGE_LOW) / width),
  );
  return edge * edge * (3 - 2 * edge);
}

/** The opaque colour tint applied to remembered static scenery. */
export function fogMaskVeilFraction(maskValue: number): number {
  const value = Math.min(1, Math.max(0, maskValue));
  const hidden = fogMaskHiddenFraction(value);
  return value + (1 - value) * hidden;
}

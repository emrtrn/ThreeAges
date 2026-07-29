/**
 * Structure pick volumes — the click collision a building is selected by.
 *
 * A building model is art: arches, open courtyards, a gatehouse with a hole
 * through the middle. Raycasting the visual meshes means the player's click has
 * to land on solid geometry, so aiming at the *centre* of a building — the most
 * natural place to aim — routinely misses through a gap and clears the
 * selection instead. Unreal solves this by picking against a collision
 * primitive rather than the render mesh; this is that primitive.
 *
 * The volume is an invisible box covering the building's footprint and height.
 * It is `visible = true` with a fully transparent material on purpose: three.js
 * skips invisible objects during a raycast, so an actually-hidden box would
 * never be hit.
 */
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, type Object3D } from "three";

/** Shared name so callers can find (and deliberately never dispose) the volume. */
export const STRUCTURE_PICK_VOLUME_NAME = "rts-structure-pick-volume";

/** Floor for a volume's height, so a flat model is still clickable above ground. */
const MIN_PICK_HEIGHT = 1.5;

const bounds = new Box3();

/**
 * Build a footprint-sized pick box. Unit height by construction: {@link setPickVolumeHeight}
 * scales it, so the geometry is never rebuilt when a model swaps in.
 */
export function createPickVolume(width: number, depth: number, height: number): Mesh {
  const volume = new Mesh(
    new BoxGeometry(width, 1, depth),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  volume.name = STRUCTURE_PICK_VOLUME_NAME;
  // Never let an invisible box paint over the building it stands in for.
  volume.renderOrder = -1;
  volume.castShadow = false;
  volume.receiveShadow = false;
  setPickVolumeHeight(volume, height);
  return volume;
}

/** Resize a pick volume in place, keeping it seated on the ground plane. */
export function setPickVolumeHeight(volume: Mesh, height: number): void {
  const h = Math.max(MIN_PICK_HEIGHT, height);
  volume.scale.y = h;
  volume.position.y = h / 2;
}

/**
 * Match the volume to a freshly mounted building model.
 *
 * Height comes from the model's own bounds rather than the balance table: the
 * table sizes the *ground* footprint (placement, navigation), and a tower and a
 * granary that share a 3x3 footprint do not share a silhouette.
 */
export function fitPickVolumeToVisual(volume: Mesh, visual: Object3D, baseY: number): void {
  visual.updateWorldMatrix(true, true);
  bounds.setFromObject(visual);
  if (bounds.isEmpty()) return;
  setPickVolumeHeight(volume, bounds.max.y - baseY);
}

/** Default height for a building whose model has not loaded yet. */
export function footprintPickHeight(width: number, depth: number): number {
  return Math.max(width, depth) * 0.9;
}

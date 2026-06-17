/**
 * Procedural geometry for the Player Start marker actor.
 *
 * Like the built-in shapes, the marker persists as an ordinary model instance
 * (synthetic `marker:playerStart` asset) so it flows through the same instanced
 * render / selection / save pipeline. It is a wireframe capsule (a stand-in for
 * the spawned pawn) with a cone arrow showing the spawn facing.
 *
 * Materials are `MeshStandardMaterial` with `wireframe: true`: the editor's
 * unlit->lit conversion only rewrites `MeshBasicMaterial`, so a standard material
 * keeps its wireframe look, and emissive colour keeps it visible without relying
 * on scene lighting. The runtime never renders this asset.
 */
import {
  CapsuleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Marker green, chosen to read as an authoring gizmo rather than scene content. */
const MARKER_COLOR = "#46e08a";
/** Capsule body radius (world units; scene scale ≈ 1 unit per 2 m). */
const CAPSULE_RADIUS = 0.18;
/** Capsule cylinder segment length (excludes the two hemispherical caps). */
const CAPSULE_LENGTH = 0.5;
/** Lift so the capsule's base rests on the placement point (the pawn's feet). */
const CAPSULE_BASE_OFFSET = CAPSULE_LENGTH / 2 + CAPSULE_RADIUS;

function markerMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: MARKER_COLOR,
    emissive: MARKER_COLOR,
    emissiveIntensity: 0.6,
    wireframe: true,
    roughness: 1,
    metalness: 0,
  });
}

/**
 * Build the Player Start marker as a minimal GLTF-shaped object: a wireframe
 * capsule plus a cone arrow pointing along +Z (the pawn's forward), so the
 * downstream instanced-model builder renders it like any other asset.
 */
export function createPlayerStartMarkerGltf(): GLTF {
  const material = markerMaterial();

  const capsule = new Mesh(
    new CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_LENGTH, 6, 12),
    material,
  );
  capsule.name = "player-start-capsule";
  capsule.position.y = CAPSULE_BASE_OFFSET;

  // Cone points +Y by default; rotateX(90°) aims its apex down +Z (forward).
  const arrowGeometry = new ConeGeometry(0.12, 0.32, 12);
  arrowGeometry.rotateX(Math.PI / 2);
  const arrow = new Mesh(arrowGeometry, material);
  arrow.name = "player-start-arrow";
  arrow.position.set(0, CAPSULE_BASE_OFFSET, CAPSULE_RADIUS + 0.22);

  const scene = new Group();
  scene.name = "player-start-marker-root";
  scene.add(capsule, arrow);

  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: { version: "2.0", generator: "forge-player-start-marker" },
    userData: {},
  } as unknown as GLTF;
}

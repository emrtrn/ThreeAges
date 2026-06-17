/**
 * Procedural geometry for the Player Start marker actor.
 *
 * Like the built-in shapes, the marker persists as an ordinary model instance
 * (synthetic `marker:playerStart` asset) so it flows through the same instanced
 * render / selection / save pipeline. Visually it mimics an engine capsule
 * collision gizmo: an orange capsule drawn as exactly four thin "wires" — two
 * perpendicular vertical profile loops plus a ring at each cap junction — with a
 * thin blue gizmo-style arrow (shaft + cone) showing the spawn facing.
 *
 * The instanced-model builder only renders `Mesh` objects, so the wires are thin
 * solid tube/torus meshes (not `LineSegments`). Emissive `MeshStandardMaterial`
 * keeps them bright without scene lighting and survives the editor's unlit->lit
 * conversion (which only rewrites `MeshBasicMaterial`). The runtime never renders
 * this asset.
 */
import {
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Capsule wire colour (engine capsule-collision orange). */
const CAPSULE_COLOR = "#f5a623";
/** Direction arrow colour (gizmo blue). */
const ARROW_COLOR = "#2b7fff";
/** Capsule body radius (world units; scene scale ≈ 1 unit per 2 m). */
const CAPSULE_RADIUS = 0.18;
/** Half-length of the capsule's straight (cylindrical) section. */
const CAPSULE_HALF = 0.25;
/** Thin tube radius that makes a mesh read as a single wire. */
const WIRE_RADIUS = 0.008;
/** Lift so the capsule's base rests on the placement point (the pawn's feet). */
const CAPSULE_CENTER_Y = CAPSULE_HALF + CAPSULE_RADIUS;

function emissiveMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 1,
    metalness: 0,
  });
}

/**
 * Stadium (capsule profile) outline in a vertical plane: two hemispherical caps
 * joined by straight sides, centred on the capsule. `plane` picks which axis the
 * width runs along (`x` or `z`); height is always Y.
 */
function stadiumLoopPoints(plane: "x" | "z"): Vector3[] {
  const r = CAPSULE_RADIUS;
  const h = CAPSULE_HALF;
  const arc = 16;
  const side = 4;
  const point = (across: number, y: number): Vector3 =>
    plane === "x"
      ? new Vector3(across, y + CAPSULE_CENTER_Y, 0)
      : new Vector3(0, y + CAPSULE_CENTER_Y, across);

  const points: Vector3[] = [];
  // Top cap: from +across over the top to -across.
  for (let i = 0; i <= arc; i += 1) {
    const t = (i / arc) * Math.PI;
    points.push(point(r * Math.cos(t), h + r * Math.sin(t)));
  }
  // Left straight side, going down (skip endpoints shared with the caps).
  for (let i = 1; i < side; i += 1) {
    points.push(point(-r, h - (i / side) * (2 * h)));
  }
  // Bottom cap: from -across under the bottom to +across.
  for (let i = 0; i <= arc; i += 1) {
    const t = Math.PI + (i / arc) * Math.PI;
    points.push(point(r * Math.cos(t), -h + r * Math.sin(t)));
  }
  // Right straight side, going back up.
  for (let i = 1; i < side; i += 1) {
    points.push(point(r, -h + (i / side) * (2 * h)));
  }
  return points;
}

/** One vertical profile loop as a single thin closed tube ("wire"). */
function verticalWire(plane: "x" | "z", material: MeshStandardMaterial): Mesh {
  const curve = new CatmullRomCurve3(stadiumLoopPoints(plane), true, "catmullrom", 0);
  const mesh = new Mesh(new TubeGeometry(curve, 96, WIRE_RADIUS, 6, true), material);
  mesh.name = `player-start-wire-${plane}`;
  return mesh;
}

/** One horizontal ring (cap junction) as a thin torus laid flat in the XZ plane. */
function horizontalWire(y: number, material: MeshStandardMaterial): Mesh {
  const torus = new TorusGeometry(CAPSULE_RADIUS, WIRE_RADIUS, 6, 40);
  torus.rotateX(Math.PI / 2);
  const mesh = new Mesh(torus, material);
  mesh.position.y = CAPSULE_CENTER_Y + y;
  mesh.name = "player-start-ring";
  return mesh;
}

/** Thin gizmo-style arrow (shaft + cone) pointing along +Z (the pawn's forward). */
function forwardArrow(material: MeshStandardMaterial): Mesh[] {
  const shaftGeometry = new CylinderGeometry(0.012, 0.012, 0.3, 8);
  shaftGeometry.rotateX(Math.PI / 2);
  const shaft = new Mesh(shaftGeometry, material);
  shaft.position.set(0, CAPSULE_CENTER_Y, 0.15);
  shaft.name = "player-start-arrow-shaft";

  const headGeometry = new ConeGeometry(0.045, 0.12, 12);
  headGeometry.rotateX(Math.PI / 2);
  const head = new Mesh(headGeometry, material);
  head.position.set(0, CAPSULE_CENTER_Y, 0.36);
  head.name = "player-start-arrow-head";

  return [shaft, head];
}

/**
 * Build the Player Start marker as a minimal GLTF-shaped object: the four-wire
 * orange capsule plus a thin blue forward arrow, so the instanced-model builder
 * renders it like any other asset.
 */
export function createPlayerStartMarkerGltf(): GLTF {
  const capsuleMaterial = emissiveMaterial(CAPSULE_COLOR);
  const arrowMaterial = emissiveMaterial(ARROW_COLOR);

  const scene = new Group();
  scene.name = "player-start-marker-root";
  scene.add(
    verticalWire("x", capsuleMaterial),
    verticalWire("z", capsuleMaterial),
    horizontalWire(CAPSULE_HALF, capsuleMaterial),
    horizontalWire(-CAPSULE_HALF, capsuleMaterial),
    ...forwardArrow(arrowMaterial),
  );

  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: { version: "2.0", generator: "forge-player-start-marker" },
    userData: {},
  } as unknown as GLTF;
}

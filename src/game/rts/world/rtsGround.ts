/**
 * RTS blockout ground — Vertical Slice Plan v0.2 §20 ("Boş test sahnesi").
 *
 * Faz 1 needs only an empty, readable test field: a flat lit plane, a grid to
 * make camera motion perceptible, and a few reference markers at known
 * coordinates. Real map blockout arrives in Faz 2 (§24), so this stays a plain
 * placeholder with no gameplay meaning.
 */
import {
  BoxGeometry,
  Color,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";

export interface RtsGroundOptions {
  /** Half-extent of the square field in world units. */
  readonly halfExtent: number;
  readonly groundColor: string;
  readonly gridColor: string;
}

export const DEFAULT_RTS_GROUND_OPTIONS: RtsGroundOptions = {
  halfExtent: 60,
  groundColor: "#4b5d3a",
  gridColor: "#3a4a2d",
};

/**
 * Builds the ground group (plane + grid + corner reference posts). The plane
 * receives shadows so later lit units read against it; y = 0 is the walkable
 * surface all gameplay uses.
 */
export function createRtsGround(options: RtsGroundOptions = DEFAULT_RTS_GROUND_OPTIONS): Group {
  const group = new Group();
  group.name = "rts-ground";
  const size = options.halfExtent * 2;

  const plane = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ color: new Color(options.groundColor), roughness: 1 }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  plane.name = "rts-ground-plane";
  group.add(plane);

  const grid = new GridHelper(size, size / 2, "#8fa06a", "#63744a");
  grid.position.y = 0.01; // avoid z-fighting with the plane
  (grid.material as { opacity: number; transparent: boolean }).opacity = 0.55;
  (grid.material as { transparent: boolean }).transparent = true;
  group.add(grid);

  // Reference markers at known coordinates so camera pan/zoom is perceptible in
  // the otherwise-featureless field (removed once real map/units land in Faz 2).
  group.add(createMarker(0, 0, "#e8e2c0", 1.5)); // origin
  const e = options.halfExtent - 4;
  group.add(createMarker(e, e, "#c0392b", 3)); // +X +Z
  group.add(createMarker(-e, e, "#2980b9", 3)); // -X +Z
  group.add(createMarker(e, -e, "#27ae60", 3)); // +X -Z
  group.add(createMarker(-e, -e, "#f1c40f", 3)); // -X -Z

  return group;
}

/** A small emissive-ish post used only as a spatial reference in Faz 1. */
function createMarker(x: number, z: number, color: string, height: number): Mesh {
  const marker = new Mesh(
    new BoxGeometry(2, height, 2),
    new MeshStandardMaterial({ color: new Color(color), roughness: 0.7 }),
  );
  marker.position.set(x, height / 2, z);
  marker.castShadow = true;
  marker.name = "rts-ref-marker";
  return marker;
}

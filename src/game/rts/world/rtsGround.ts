/**
 * RTS blockout ground — Vertical Slice Plan v0.2 §20 ("Boş test sahnesi").
 *
 * Faz 1 needs only an empty, readable test field: a flat lit plane, a grid to
 * make camera motion perceptible, and a few reference markers at known
 * coordinates. Real map blockout arrives in Faz 2 (§24), so this stays a plain
 * placeholder with no gameplay meaning.
 */
import {
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

/** Shared square world extent for the Phase 1 ground and navigation bounds. */
export const RTS_WORLD_HALF_EXTENT = 60;

export const DEFAULT_RTS_GROUND_OPTIONS: RtsGroundOptions = {
  halfExtent: RTS_WORLD_HALF_EXTENT,
  groundColor: "#4b5d3a",
  gridColor: "#3a4a2d",
};

/**
 * Builds the ground group (plane + grid). The plane receives shadows so later
 * lit units read against it; y = 0 is the walkable surface all gameplay uses.
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

  return group;
}

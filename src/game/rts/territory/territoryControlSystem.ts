/**
 * Grid-backed territory ownership for the Phase 4 control-area proof.
 *
 * Sources contribute a circular world-space influence, while ownership is
 * stored and queried at the same 2-unit cell scale used by structure
 * placement. Keeping this as an isolated runtime service lets future outposts
 * replace or add sources without teaching placement about individual buildings.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";

import type { UnitOwner } from "../units/unit";
import { RTS_PLACEMENT_GRID_SIZE } from "../structures/placementGrid";
import { RTS_WORLD_HALF_EXTENT } from "../world/rtsGround";

export type TerritoryOwner = UnitOwner | "neutral";

export interface TerritorySource {
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface TerritoryControlOptions {
  readonly cellSize: number;
  readonly worldHalfExtent: number;
}

export const DEFAULT_TERRITORY_CONTROL_OPTIONS: TerritoryControlOptions = {
  cellSize: RTS_PLACEMENT_GRID_SIZE,
  worldHalfExtent: RTS_WORLD_HALF_EXTENT,
};

const OVERLAY_COLOR: Record<UnitOwner, Color> = {
  player: new Color("#2d7fd6"),
  enemy: new Color("#c0392b"),
};

/** Default phase-four starting territory radius, measured in world units. */
export const COMMAND_CENTER_CONTROL_RADIUS = 28;

/**
 * Ground clearance for the overlay quads, in world units.
 *
 * Deliberately tiny — `polygonOffset` on the overlay materials is what keeps the
 * quads out of a depth fight with the terrain. A *lift* cannot do that job on
 * sloped ground: raise it enough to clear the chord error on a steep cell and it
 * visibly hovers on a flat one; lower it and the cell's middle sinks under the
 * terrain and gets clipped away, which is what turned the overlay into a mottled
 * patchwork once the field stopped being a plane. This is here only to absorb the
 * residual chord error between the four subdivided samples.
 */
const OVERLAY_LIFT = 0.006;

/**
 * How many sub-quads each cell is split into per axis.
 *
 * A cell sampled only at its four corners spans the terrain as a flat chord, so
 * its middle dips below any ground that curves upward under it. Splitting 2×2
 * quarters that error for four extra triangles per cell — cheap next to sampling
 * every cell's height in the first place.
 */
const OVERLAY_SUBDIVISIONS = 2;

/**
 * A ground overlay material. `polygonOffset` — not a vertical lift — is what wins
 * the depth comparison against the terrain drawn underneath it, so the overlay can
 * sit almost exactly on the ground at any slope. `depthWrite: false` keeps it out
 * of the depth buffer for everything drawn after, which also excludes it from the
 * ambient-occlusion pass (see `writesSceneDepth` in the post-process pipeline).
 */
function createOverlayMaterial(color: Color, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

export class TerritoryControlSystem {
  readonly root = new Group();
  /**
   * Monotonic counter of every ownership recompute. `refresh` is the only writer
   * of the ownership grid, so this is an exact staleness key for anything that
   * memoises an answer derived from {@link ownsFootprint} — logistics does.
   */
  version = 0;
  private readonly ownership = new Map<string, TerritoryOwner>();
  private readonly materials: Record<UnitOwner, MeshBasicMaterial>;
  private readonly meshes: Record<UnitOwner, Mesh<BufferGeometry, MeshBasicMaterial>>;
  /** Rendered ground height at a world X/Z; flat-field fallback keeps Y at zero. */
  private groundHeightAt: (x: number, z: number) => number = () => 0;

  constructor(
    private readonly sources: () => readonly TerritorySource[],
    private readonly options: TerritoryControlOptions = DEFAULT_TERRITORY_CONTROL_OPTIONS,
  ) {
    if (!Number.isFinite(options.cellSize) || options.cellSize <= 0) {
      throw new RangeError("Territory cell size must be a positive finite number");
    }
    this.root.name = "rts-territory-overlay";
    this.materials = {
      player: createOverlayMaterial(OVERLAY_COLOR.player, 0.18),
      enemy: createOverlayMaterial(OVERLAY_COLOR.enemy, 0.14),
    };
    this.meshes = {
      player: this.createOverlayMesh("player"),
      enemy: this.createOverlayMesh("enemy"),
    };
    this.root.add(this.meshes.player, this.meshes.enemy);
  }

  /**
   * Terrain source for the overlay. Without it the quads sit on the flat field;
   * with it every corner is sampled so the overlay follows slopes instead of
   * disappearing under raised ground.
   */
  setGroundHeightSampler(sample: (x: number, z: number) => number): void {
    this.groundHeightAt = sample;
    this.refresh();
  }

  /** Recompute all ownership cells and their lightweight ground overlay. */
  refresh(): void {
    this.version += 1;
    this.ownership.clear();
    const extent = this.options.worldHalfExtent;
    const step = this.options.cellSize;
    const half = (step - 0.08) / 2;
    const corners: Record<UnitOwner, number[]> = { player: [], enemy: [] };
    // Resolved once, not per cell. The provider is not a plain field read: it
    // rebuilds its list from both building systems and asks the road graph whether
    // each outpost still reaches its capital — a network walk. Asking that for all
    // ~5k grid cells made one refresh cost thousands of road traversals, and a
    // refresh runs on every committed road, which is what kept road building
    // stalling for seconds late in a match. The source set cannot change midway
    // through a refresh, so one call is also the only coherent reading of it.
    const sources = this.sources();
    for (let x = -extent; x <= extent; x += step) {
      for (let z = -extent; z <= extent; z += step) {
        const owner = this.resolveOwner(x, z, sources);
        this.ownership.set(this.key(x, z), owner);
        if (owner === "neutral") continue;
        this.pushCell(corners[owner], x, z, half);
      }
    }
    this.uploadOverlay("player", corners.player);
    this.uploadOverlay("enemy", corners.enemy);
  }

  /** Returns the stored owner of the placement cell containing this point. */
  ownerAt(x: number, z: number): TerritoryOwner {
    const snappedX = this.snap(x);
    const snappedZ = this.snap(z);
    return this.ownership.get(this.key(snappedX, snappedZ)) ?? "neutral";
  }

  /** True only when every placement cell covered by a footprint is owned. */
  ownsFootprint(owner: UnitOwner, x: number, z: number, width: number, depth: number): boolean {
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return false;
    const step = this.options.cellSize;
    const snappedX = this.snap(x);
    const snappedZ = this.snap(z);
    for (let offsetX = -width / 2 + step / 2; offsetX < width / 2; offsetX += step) {
      for (let offsetZ = -depth / 2 + step / 2; offsetZ < depth / 2; offsetZ += step) {
        if (this.ownerAt(snappedX + offsetX, snappedZ + offsetZ) !== owner) return false;
      }
    }
    return true;
  }

  /**
   * Karakol-style expansion may bridge a short neutral gap, but can never be
   * dropped in friendly interior or enemy-owned territory.
   */
  canPlaceExpansion(
    owner: UnitOwner,
    x: number,
    z: number,
    width: number,
    depth: number,
    maximumGap: number,
  ): boolean {
    if (!Number.isFinite(maximumGap) || maximumGap <= 0) return false;
    const owners = this.footprintOwners(x, z, width, depth);
    if (owners.size === 0 || owners.has(this.opponentOf(owner))) return false;
    if (!owners.has("neutral")) return false;
    const step = this.options.cellSize;
    const snappedX = this.snap(x);
    const snappedZ = this.snap(z);
    const cellRange = Math.ceil(maximumGap / step);
    for (let xOffset = -cellRange; xOffset <= cellRange; xOffset += 1) {
      for (let zOffset = -cellRange; zOffset <= cellRange; zOffset += 1) {
        const candidateX = snappedX + xOffset * step;
        const candidateZ = snappedZ + zOffset * step;
        if (Math.hypot(candidateX - snappedX, candidateZ - snappedZ) <= maximumGap
          && this.ownerAt(candidateX, candidateZ) === owner) return true;
      }
    }
    return false;
  }

  dispose(): void {
    this.root.clear();
    this.meshes.player.geometry.dispose();
    this.meshes.enemy.geometry.dispose();
    this.materials.player.dispose();
    this.materials.enemy.dispose();
  }

  private createOverlayMesh(owner: UnitOwner): Mesh<BufferGeometry, MeshBasicMaterial> {
    const mesh = new Mesh(new BufferGeometry(), this.materials[owner]);
    mesh.name = `rts-territory-cells-${owner}`;
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  /**
   * One cell as an {@link OVERLAY_SUBDIVISIONS}² grid of quads, every vertex
   * sampled at its own terrain height so the patch bends with the slope it covers
   * instead of spanning it as one flat chord.
   */
  private pushCell(target: number[], x: number, z: number, half: number): void {
    const steps = OVERLAY_SUBDIVISIONS;
    const span = (half * 2) / steps;
    // One row of heights is reused as the next row's near edge, so a cell costs
    // (steps + 1)² samples rather than 4 per sub-quad.
    const heights: number[] = [];
    for (let row = 0; row <= steps; row += 1) {
      for (let column = 0; column <= steps; column += 1) {
        heights.push(this.groundHeightAt(x - half + column * span, z - half + row * span) + OVERLAY_LIFT);
      }
    }
    const heightAt = (row: number, column: number): number => heights[row * (steps + 1) + column]!;
    for (let row = 0; row < steps; row += 1) {
      for (let column = 0; column < steps; column += 1) {
        const x0 = x - half + column * span;
        const x1 = x0 + span;
        const z0 = z - half + row * span;
        const z1 = z0 + span;
        const y00 = heightAt(row, column);
        const y10 = heightAt(row, column + 1);
        const y01 = heightAt(row + 1, column);
        const y11 = heightAt(row + 1, column + 1);
        target.push(
          x0, y00, z0, x0, y01, z1, x1, y11, z1,
          x0, y00, z0, x1, y11, z1, x1, y10, z0,
        );
      }
    }
  }

  private uploadOverlay(owner: UnitOwner, positions: readonly number[]): void {
    const mesh = this.meshes[owner];
    mesh.geometry.dispose();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    mesh.geometry = geometry;
    mesh.visible = positions.length > 0;
  }

  /** Sources are passed in, never read here: see the note in {@link refresh}. */
  private resolveOwner(x: number, z: number, sources: readonly TerritorySource[]): TerritoryOwner {
    let winner: TerritorySource | null = null;
    let winnerDistance = Number.POSITIVE_INFINITY;
    for (const source of sources) {
      if (!Number.isFinite(source.radius) || source.radius <= 0) continue;
      const distance = Math.hypot(x - source.x, z - source.z);
      if (distance > source.radius || distance >= winnerDistance) continue;
      winner = source;
      winnerDistance = distance;
    }
    return winner?.owner ?? "neutral";
  }

  private footprintOwners(x: number, z: number, width: number, depth: number): Set<TerritoryOwner> {
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return new Set();
    const owners = new Set<TerritoryOwner>();
    const step = this.options.cellSize;
    const snappedX = this.snap(x);
    const snappedZ = this.snap(z);
    for (let offsetX = -width / 2 + step / 2; offsetX < width / 2; offsetX += step) {
      for (let offsetZ = -depth / 2 + step / 2; offsetZ < depth / 2; offsetZ += step) {
        owners.add(this.ownerAt(snappedX + offsetX, snappedZ + offsetZ));
      }
    }
    return owners;
  }

  private opponentOf(owner: UnitOwner): UnitOwner {
    return owner === "player" ? "enemy" : "player";
  }

  private snap(value: number): number {
    return Math.round(value / this.options.cellSize) * this.options.cellSize;
  }

  private key(x: number, z: number): string {
    return `${x}:${z}`;
  }
}

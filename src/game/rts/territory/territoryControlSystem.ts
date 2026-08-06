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

/** Ground clearance for the overlay quads, in world units. */
const OVERLAY_LIFT = 0.022;

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
      player: new MeshBasicMaterial({ color: OVERLAY_COLOR.player, transparent: true, opacity: 0.18, depthWrite: false }),
      enemy: new MeshBasicMaterial({ color: OVERLAY_COLOR.enemy, transparent: true, opacity: 0.14, depthWrite: false }),
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
    for (let x = -extent; x <= extent; x += step) {
      for (let z = -extent; z <= extent; z += step) {
        const owner = this.resolveOwner(x, z);
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
   * Two triangles for one cell, each corner lifted to its own terrain height so
   * the quad tilts with the slope it covers rather than cutting into it.
   */
  private pushCell(target: number[], x: number, z: number, half: number): void {
    const x0 = x - half;
    const x1 = x + half;
    const z0 = z - half;
    const z1 = z + half;
    const y00 = this.groundHeightAt(x0, z0) + OVERLAY_LIFT;
    const y10 = this.groundHeightAt(x1, z0) + OVERLAY_LIFT;
    const y01 = this.groundHeightAt(x0, z1) + OVERLAY_LIFT;
    const y11 = this.groundHeightAt(x1, z1) + OVERLAY_LIFT;
    target.push(
      x0, y00, z0, x0, y01, z1, x1, y11, z1,
      x0, y00, z0, x1, y11, z1, x1, y10, z0,
    );
  }

  private uploadOverlay(owner: UnitOwner, positions: readonly number[]): void {
    const mesh = this.meshes[owner];
    mesh.geometry.dispose();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    mesh.geometry = geometry;
    mesh.visible = positions.length > 0;
  }

  private resolveOwner(x: number, z: number): TerritoryOwner {
    let winner: TerritorySource | null = null;
    let winnerDistance = Number.POSITIVE_INFINITY;
    for (const source of this.sources()) {
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

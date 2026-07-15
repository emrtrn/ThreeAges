/**
 * Grid-backed territory ownership for the Phase 4 control-area proof.
 *
 * Sources contribute a circular world-space influence, while ownership is
 * stored and queried at the same 2-unit cell scale used by structure
 * placement. Keeping this as an isolated runtime service lets future outposts
 * replace or add sources without teaching placement about individual buildings.
 */
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
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
export const COMMAND_CENTER_CONTROL_RADIUS = 18;

export class TerritoryControlSystem {
  readonly root = new Group();
  private readonly ownership = new Map<string, TerritoryOwner>();
  private readonly cellGeometry: PlaneGeometry;
  private readonly materials: Record<UnitOwner, MeshBasicMaterial>;

  constructor(
    private readonly sources: () => readonly TerritorySource[],
    private readonly options: TerritoryControlOptions = DEFAULT_TERRITORY_CONTROL_OPTIONS,
  ) {
    if (!Number.isFinite(options.cellSize) || options.cellSize <= 0) {
      throw new RangeError("Territory cell size must be a positive finite number");
    }
    this.root.name = "rts-territory-overlay";
    this.cellGeometry = new PlaneGeometry(options.cellSize - 0.08, options.cellSize - 0.08);
    this.cellGeometry.rotateX(-Math.PI / 2);
    this.materials = {
      player: new MeshBasicMaterial({ color: OVERLAY_COLOR.player, transparent: true, opacity: 0.18, depthWrite: false }),
      enemy: new MeshBasicMaterial({ color: OVERLAY_COLOR.enemy, transparent: true, opacity: 0.14, depthWrite: false }),
    };
  }

  /** Recompute all ownership cells and their lightweight ground overlay. */
  refresh(): void {
    this.ownership.clear();
    this.root.clear();
    const extent = this.options.worldHalfExtent;
    const step = this.options.cellSize;
    for (let x = -extent; x <= extent; x += step) {
      for (let z = -extent; z <= extent; z += step) {
        const owner = this.resolveOwner(x, z);
        this.ownership.set(this.key(x, z), owner);
        if (owner === "neutral") continue;
        const cell = new Mesh(this.cellGeometry, this.materials[owner]);
        cell.name = `rts-territory-cell-${owner}`;
        cell.position.set(x, 0.022, z);
        cell.renderOrder = 1;
        this.root.add(cell);
      }
    }
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
    this.cellGeometry.dispose();
    this.materials.player.dispose();
    this.materials.enemy.dispose();
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

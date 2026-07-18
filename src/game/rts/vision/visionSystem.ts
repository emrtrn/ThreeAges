/**
 * Per-kingdom fog of war — Vertical Slice Plan v0.2 §59, GDD 08 §38–§42.
 *
 * §38's three layers are stored as two bits per cell rather than one enum, and
 * the distinction matters:
 *
 *  - **visible** is recomputed from scratch every refresh. It is "a vision
 *    source covers this cell *now*".
 *  - **explored** is a latch — once set it is never cleared for the rest of the
 *    match. It is "this kingdom has seen this cell at some point".
 *
 * `unknown` is then simply neither bit, `explored-but-not-visible` is the
 * §40 memory layer, and no third state has to be kept consistent.
 *
 * Symmetric by construction: the grid is per {@link UnitOwner}, so the AI reads
 * its own fog through the same query the player's renderer does. That is what
 * makes §59's "AI görünmeyen birimlerin gerçek konumunu bilmiyor" a structural
 * property rather than a promise — see `ai/aiVisionFilter.ts`.
 *
 * Pure TS: no three.js, no DOM (Forge boundary, CLAUDE.md / TD-002). The
 * renderer reads {@link VisionSystem.visibilityGrid} and builds its own texture.
 */
import type { UnitOwner } from "../units/unit";

/** A circular reveal contributed by a unit or structure for one refresh. */
export interface VisionSource {
  readonly owner: UnitOwner;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface VisionGridOptions {
  /** World units per cell. */
  readonly cellSize: number;
  /** Half the world's width; the grid spans [-halfExtent, +halfExtent]. */
  readonly worldHalfExtent: number;
}

/**
 * 2 world units matches the placement grid, so a fog cell never splits a
 * building footprint. `worldHalfExtent` mirrors `RTS_WORLD_HALF_EXTENT`
 * (`world/rtsGround.ts`), duplicated rather than imported to keep this module
 * free of three.js; `RtsApp` passes the real value at construction, so this
 * default only serves tests.
 */
export const DEFAULT_VISION_GRID_OPTIONS: VisionGridOptions = {
  cellSize: 2,
  worldHalfExtent: 70,
};

/** §38's three layers, as returned by {@link VisionSystem.stateAt}. */
export type VisionState = "unknown" | "explored" | "visible";

export class VisionSystem {
  private readonly resolution: number;
  private readonly cellCount: number;
  /** owner → 1 byte per cell, 1 while a source covers it this refresh. */
  private readonly visible: Record<UnitOwner, Uint8Array>;
  /** owner → 1 byte per cell, latched on first sight and never cleared. */
  private readonly explored: Record<UnitOwner, Uint8Array>;

  constructor(
    private readonly sources: () => readonly VisionSource[],
    private readonly options: VisionGridOptions = DEFAULT_VISION_GRID_OPTIONS,
  ) {
    const { cellSize, worldHalfExtent } = options;
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError("Vision cell size must be a positive finite number");
    }
    if (!Number.isFinite(worldHalfExtent) || worldHalfExtent <= 0) {
      throw new RangeError("Vision world half extent must be a positive finite number");
    }
    this.resolution = Math.floor((worldHalfExtent * 2) / cellSize) + 1;
    this.cellCount = this.resolution * this.resolution;
    this.visible = {
      player: new Uint8Array(this.cellCount),
      enemy: new Uint8Array(this.cellCount),
    };
    this.explored = {
      player: new Uint8Array(this.cellCount),
      enemy: new Uint8Array(this.cellCount),
    };
  }

  /** Cells per side. The renderer sizes its texture from this. */
  get gridResolution(): number {
    return this.resolution;
  }

  get gridOptions(): VisionGridOptions {
    return this.options;
  }

  /**
   * Recompute `visible` from the live sources and latch `explored`.
   *
   * Cost is Σ(area of each source) in cells, not world area × source count: each
   * source only walks its own bounding box. With ~30 sources at radius ≤30 on a
   * 2-unit grid that is a few thousand byte writes per tick, which is why §59's
   * "görüş güncellemesi performans sorunu oluşturmuyor" holds without a budget.
   */
  refresh(): void {
    this.visible.player.fill(0);
    this.visible.enemy.fill(0);
    for (const source of this.sources()) {
      if (!Number.isFinite(source.radius) || source.radius <= 0) continue;
      this.stamp(source);
    }
    for (const owner of ["player", "enemy"] as const) {
      const visible = this.visible[owner];
      const explored = this.explored[owner];
      for (let i = 0; i < this.cellCount; i += 1) {
        if (visible[i]) explored[i] = 1;
      }
    }
  }

  /** True when this kingdom has a vision source covering the point right now. */
  isVisible(owner: UnitOwner, x: number, z: number): boolean {
    const index = this.indexAt(x, z);
    return index >= 0 && this.visible[owner][index] === 1;
  }

  /** True when this kingdom has ever seen the point (§40 memory layer). */
  isExplored(owner: UnitOwner, x: number, z: number): boolean {
    const index = this.indexAt(x, z);
    return index >= 0 && this.explored[owner][index] === 1;
  }

  stateAt(owner: UnitOwner, x: number, z: number): VisionState {
    const index = this.indexAt(x, z);
    if (index < 0) return "unknown";
    if (this.visible[owner][index] === 1) return "visible";
    return this.explored[owner][index] === 1 ? "explored" : "unknown";
  }

  /**
   * Raw per-cell bytes for the renderer and the debug overlay, row-major from
   * the -x/-z corner. Returned by reference to avoid a per-frame copy — callers
   * read, never write.
   */
  visibilityGrid(owner: UnitOwner): {
    readonly visible: Uint8Array;
    readonly explored: Uint8Array;
    readonly resolution: number;
  } {
    return {
      visible: this.visible[owner],
      explored: this.explored[owner],
      resolution: this.resolution,
    };
  }

  /** Fraction of the map this kingdom has explored, for the debug overlay. */
  exploredFraction(owner: UnitOwner): number {
    const explored = this.explored[owner];
    let seen = 0;
    for (let i = 0; i < this.cellCount; i += 1) seen += explored[i]!;
    return this.cellCount === 0 ? 0 : seen / this.cellCount;
  }

  /** Match restart: forget everything, including the explored latch. */
  reset(): void {
    this.visible.player.fill(0);
    this.visible.enemy.fill(0);
    this.explored.player.fill(0);
    this.explored.enemy.fill(0);
  }

  private stamp(source: VisionSource): void {
    const { cellSize, worldHalfExtent } = this.options;
    const radiusCells = Math.ceil(source.radius / cellSize);
    const centerCol = this.axisIndex(source.x);
    const centerRow = this.axisIndex(source.z);
    const grid = this.visible[source.owner];
    const radiusSquared = source.radius * source.radius;
    for (let row = centerRow - radiusCells; row <= centerRow + radiusCells; row += 1) {
      if (row < 0 || row >= this.resolution) continue;
      const worldZ = row * cellSize - worldHalfExtent;
      const dz = worldZ - source.z;
      for (let col = centerCol - radiusCells; col <= centerCol + radiusCells; col += 1) {
        if (col < 0 || col >= this.resolution) continue;
        const worldX = col * cellSize - worldHalfExtent;
        const dx = worldX - source.x;
        // Squared compare: this is the innermost loop of the whole system.
        if (dx * dx + dz * dz > radiusSquared) continue;
        grid[row * this.resolution + col] = 1;
      }
    }
  }

  private axisIndex(value: number): number {
    return Math.round((value + this.options.worldHalfExtent) / this.options.cellSize);
  }

  /** Row-major cell index, or -1 for a point outside the grid. */
  private indexAt(x: number, z: number): number {
    const col = this.axisIndex(x);
    const row = this.axisIndex(z);
    if (col < 0 || col >= this.resolution || row < 0 || row >= this.resolution) return -1;
    return row * this.resolution + col;
  }
}

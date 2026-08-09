/**
 * RTS building placement controller — Vertical Slice Plan v0.2 §25 (Faz 2).
 *
 * Owns the *input* half only: the screen-to-ground ray and the ghost preview. The
 * rules (snap, validation, payment, site creation) moved to the headless
 * {@link StructureConstructionService} in Faz 5.0 so the AI opponent can build
 * through exactly the same path without a pointer (AI design §4).
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Group,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Raycaster,
  RingGeometry,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from "three";

import type { BuildingBalance, BuildingBalanceStats } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import type { PlacementResult } from "./placementGrid";
import type { StructureConstructionService } from "./structureConstructionService";
import { FLAT_RTS_GROUND, type RtsGroundSurface } from "../world/rtsTerrainSurface";

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const VALID_COLOR = new Color("#7dc86d");
const INVALID_COLOR = new Color("#d65b55");

/** Outline width in world units — a real measure, unlike a line's ignored `linewidth`. */
const FRAME_THICKNESS = 0.16;
/**
 * How far the draped outline clears the ground. Tiny on purpose: `polygonOffset`
 * does the depth-fighting work, and this only keeps the ribbon from being buried
 * by the chord error between two terrain samples.
 */
const FRAME_LIFT = 0.015;
/** World-unit spacing between ring samples — how closely the outline follows a slope. */
const FRAME_SAMPLE_STEP = 0.5;

/** One position on the outline ribbon: the paired outer and inner edge points. */
interface PlacementFrameSample {
  readonly outerX: number;
  readonly outerZ: number;
  readonly innerX: number;
  readonly innerZ: number;
}

/**
 * Walks the footprint rectangle counter-clockwise, emitting paired outer/inner
 * points at most {@link FRAME_SAMPLE_STEP} apart. Corners are exact (the outer and
 * inner rectangles miter there), and each edge starts at its own corner without
 * repeating the previous edge's end, so the ring closes cleanly.
 */
function placementFrameRing(halfWidth: number, halfDepth: number): PlacementFrameSample[] {
  const half = FRAME_THICKNESS * 0.5;
  const outerW = halfWidth + half;
  const outerD = halfDepth + half;
  // A footprint thinner than the outline itself would invert the inner rectangle.
  const innerW = Math.max(halfWidth - half, 0);
  const innerD = Math.max(halfDepth - half, 0);
  const corners: readonly (readonly [number, number])[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const samples: PlacementFrameSample[] = [];
  for (let corner = 0; corner < corners.length; corner += 1) {
    const [sx, sz] = corners[corner]!;
    const [ex, ez] = corners[(corner + 1) % corners.length]!;
    const startX = sx * outerW;
    const startZ = sz * outerD;
    const spanX = ex * outerW - startX;
    const spanZ = ez * outerD - startZ;
    const steps = Math.max(1, Math.ceil(Math.hypot(spanX, spanZ) / FRAME_SAMPLE_STEP));
    // `t < steps` (not `<=`) leaves the end corner to the next edge's start.
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      samples.push({
        outerX: startX + spanX * t,
        outerZ: startZ + spanZ * t,
        innerX: (sx + (ex - sx) * t) * innerW,
        innerZ: (sz + (ez - sz) * t) * innerD,
      });
    }
  }
  return samples;
}

/** Two triangles per ring segment, wrapping the last segment back to the first. */
function placementFrameIndices(sampleCount: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const outer = index * 2;
    const inner = outer + 1;
    const nextOuter = ((index + 1) % sampleCount) * 2;
    const nextInner = nextOuter + 1;
    indices.push(outer, inner, nextInner, outer, nextInner, nextOuter);
  }
  return indices;
}

export interface BuildingPlacementState {
  readonly activeBuildingId: string | null;
  readonly result: PlacementResult | null;
}

export class BuildingPlacementSystem {
  readonly root = new Group();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  private active: { id: string; stats: BuildingBalanceStats } | null = null;
  private ghost: Object3D | null = null;
  private placementFrame: Mesh | null = null;
  private frameRing: PlacementFrameSample[] = [];
  private previewFactory: ((buildingId: string, footprintWidth: number, footprintDepth: number) => Object3D | null) | null = null;
  /**
   * §51 "Karakol kontrol alanı önizlemesi". An outpost is bought for the ground
   * it opens, and that ground is invisible until the moment it is too late to
   * move the building — so the radius is drawn where the decision is made.
   * Only structures whose data declares a `territory` block get one, which is
   * the same fact `TerritoryControlSystem` reads.
   */
  private territoryPreview: Mesh | null = null;
  private result: PlacementResult | null = null;
  private ground: RtsGroundSurface = FLAT_RTS_GROUND;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly buildings: BuildingBalance,
    private readonly construction: StructureConstructionService,
    /** The kingdom this palette builds for — the human player. */
    private readonly owner: UnitOwner,
  ) {
    this.root.name = "rts-building-placement-preview";
    this.root.visible = false;
  }

  setPreviewFactory(factory: (buildingId: string, footprintWidth: number, footprintDepth: number) => Object3D | null): void {
    this.previewFactory = factory;
    if (this.active) this.rebuildGhost(this.active.id, this.active.stats);
  }

  /** Switch pointer/preview grounding once an authored Landscape has mounted. */
  setGroundSurface(ground: RtsGroundSurface): void {
    this.ground = ground;
  }

  /** Rebuild an active ghost after its type's researched visual level changes. */
  refreshPreview(): void {
    if (this.active) this.rebuildGhost(this.active.id, this.active.stats);
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  state(): BuildingPlacementState {
    return { activeBuildingId: this.active?.id ?? null, result: this.result };
  }

  begin(buildingId: string): boolean {
    const stats = this.buildings[buildingId];
    if (!stats || buildingId === "command_center") return false;
    this.active = { id: buildingId, stats };
    this.result = null;
    this.rebuildGhost(buildingId, stats);
    this.rebuildTerritoryPreview(stats);
    this.root.visible = true;
    return true;
  }

  cancel(): void {
    this.active = null;
    this.result = null;
    this.root.visible = false;
  }

  /** Update the ghost from a canvas-relative pointer position. */
  previewAt(screenX: number, screenY: number): BuildingPlacementState {
    if (!this.active) return this.state();
    const point = this.groundPoint(screenX, screenY);
    if (!point) return this.state();
    this.result = this.construction.validate(this.owner, this.active.id, point.x, point.z);
    if (!this.result) return this.state();
    this.root.position.set(this.result.x, this.ground.heightAt(this.result.x, this.result.z), this.result.z);
    // The outline is draped in world terms, so it has to be re-sampled wherever
    // the footprint lands — the root's own height only tracks the centre.
    this.updatePlacementFrameHeights();
    this.setGhostValid(this.result.valid);
    return this.state();
  }

  /** Confirm a currently valid proposal, creating its pending construction site. */
  confirmAt(screenX: number, screenY: number): BuildingPlacementState {
    const state = this.previewAt(screenX, screenY);
    if (!this.active || !state.result?.valid) return state;
    const build = this.construction.build(this.owner, this.active.id, state.result.x, state.result.z);
    if (!build.built) {
      this.result = build.result;
      this.setGhostValid(false);
      return this.state();
    }
    // Keep build mode active like an RTS palette; the following preview will be
    // invalid if it overlaps the site just created.
    this.result = null;
    return this.state();
  }

  /** Cancel the latest unbuilt site and refund its reservation in full. */
  cancelLatestConstruction(): boolean {
    return this.construction.cancelLatest(this.owner);
  }

  dispose(): void {
    disposePreviewObject(this.ghost);
    this.placementFrame?.geometry.dispose();
    disposeMaterial(this.placementFrame?.material);
    this.territoryPreview?.geometry.dispose();
    const territory = this.territoryPreview?.material;
    if (territory instanceof MeshBasicMaterial) territory.dispose();
    this.root.clear();
    this.ghost = null;
    this.placementFrame = null;
    this.territoryPreview = null;
  }

  private groundPoint(screenX: number, screenY: number): Vector3 | null {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.ground.intersectRay(this.raycaster.ray)
      ?? this.raycaster.ray.intersectPlane(GROUND_PLANE, this.hit)?.clone()
      ?? null;
  }

  private rebuildGhost(buildingId: string, stats: BuildingBalanceStats): void {
    if (this.ghost) {
      this.root.remove(this.ghost);
      disposePreviewObject(this.ghost);
    }
    const model = this.previewFactory?.(buildingId, stats.footprint.width, stats.footprint.depth);
    this.ghost = model ?? createFallbackPreview(stats);
    this.ghost.name = "rts-building-ghost";
    this.ghost.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.material = clonePreviewMaterial(child.material);
    });
    this.ghost.position.y += 0.02;
    this.root.add(this.ghost);
    this.rebuildPlacementFrame(stats);
  }

  /**
   * Builds the footprint outline as a **ribbon mesh**, not a line.
   *
   * `LineBasicMaterial.linewidth` is ignored by every desktop WebGL driver, so a
   * `LineLoop` outline is always one device pixel however far the camera is —
   * which reads as a shimmering hairline over textured ground and cannot be made
   * to read as a border. A ribbon is real geometry: its width is an authored world
   * measure, and every vertex can be dropped onto the terrain
   * ({@link updatePlacementFrameHeights}), which a flat loop at a fixed local `y`
   * could not do once the field stopped being a flat plane — one corner sank into
   * a slope while the opposite one floated over it.
   *
   * The vertex count is fixed at build time (the outline only moves, never
   * changes shape), so the per-pointer-move update rewrites positions in place
   * and never reallocates.
   */
  private rebuildPlacementFrame(stats: BuildingBalanceStats): void {
    if (this.placementFrame) {
      this.root.remove(this.placementFrame);
      this.placementFrame.geometry.dispose();
      disposeMaterial(this.placementFrame.material);
    }
    this.frameRing = placementFrameRing(
      stats.footprint.width * 0.5,
      stats.footprint.depth * 0.5,
    );
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(this.frameRing.length * 6), 3),
    );
    geometry.setIndex(placementFrameIndices(this.frameRing.length));
    const frame = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: DoubleSide,
        // Beats z-fighting with the ground without lifting the ribbon off it —
        // a lift is what makes an overlay float on one slope and sink on the next.
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    );
    frame.name = "rts-building-placement-frame";
    // The ribbon is rebuilt in world-height terms every move, so a bounding
    // sphere computed once would be wrong the moment the ground changed.
    frame.frustumCulled = false;
    frame.renderOrder = 3;
    this.placementFrame = frame;
    this.root.add(frame);
    this.updatePlacementFrameHeights();
  }

  /**
   * Drapes the outline over the terrain: each ring vertex takes the ground height
   * under its own world position, expressed relative to the root's (which sits at
   * the footprint centre's height). On flat ground this is a no-op that writes the
   * same y everywhere.
   */
  private updatePlacementFrameHeights(): void {
    const frame = this.placementFrame;
    if (!frame) return;
    const attribute = frame.geometry.getAttribute("position");
    const originX = this.root.position.x;
    const originY = this.root.position.y;
    const originZ = this.root.position.z;
    for (let index = 0; index < this.frameRing.length; index += 1) {
      const sample = this.frameRing[index]!;
      const outerY = this.ground.heightAt(originX + sample.outerX, originZ + sample.outerZ) - originY;
      const innerY = this.ground.heightAt(originX + sample.innerX, originZ + sample.innerZ) - originY;
      attribute.setXYZ(index * 2, sample.outerX, outerY + FRAME_LIFT, sample.outerZ);
      attribute.setXYZ(index * 2 + 1, sample.innerX, innerY + FRAME_LIFT, sample.innerZ);
    }
    attribute.needsUpdate = true;
  }

  /**
   * The disc an outpost would open, drawn at its *isolated* radius — the area it
   * opens the instant it completes. The larger connected radius is deliberately
   * not shown: it depends on a road that does not exist yet at placement time,
   * and promising ground the building will not open on its own would be the
   * preview lying about the very decision it exists to inform.
   */
  private rebuildTerritoryPreview(stats: BuildingBalanceStats): void {
    if (this.territoryPreview) {
      this.root.remove(this.territoryPreview);
      this.territoryPreview.geometry.dispose();
      const material = this.territoryPreview.material;
      if (material instanceof MeshBasicMaterial) material.dispose();
      this.territoryPreview = null;
    }
    const radius = stats.territory?.controlRadius;
    if (radius === undefined || radius <= 0) return;
    const preview = new Mesh(
      new RingGeometry(radius - 0.4, radius, 64),
      new MeshBasicMaterial({
        color: VALID_COLOR,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    preview.name = "rts-territory-preview";
    preview.rotation.x = -Math.PI / 2;
    preview.position.y = 0.06;
    this.territoryPreview = preview;
    this.root.add(preview);
  }

  private setGhostValid(valid: boolean): void {
    const color = valid ? VALID_COLOR : INVALID_COLOR;
    if (this.placementFrame?.material instanceof MeshBasicMaterial) {
      this.placementFrame.material.color.copy(color);
    }
    // The radius follows the ghost's verdict: a red disc reads as "this ground
    // is not what you would get", which is exactly true of a refused placement.
    const territory = this.territoryPreview?.material;
    if (territory instanceof MeshBasicMaterial) {
      territory.color.copy(valid ? VALID_COLOR : INVALID_COLOR);
    }
  }
}

function createFallbackPreview(stats: BuildingBalanceStats): Mesh {
  const material = new MeshStandardMaterial({
    color: VALID_COLOR,
    emissive: VALID_COLOR,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new Mesh(new BoxGeometry(stats.footprint.width, 0.32, stats.footprint.depth), material);
  mesh.position.y = 0.16;
  return mesh;
}

function clonePreviewMaterial(material: import("three").Material | import("three").Material[]): import("three").Material | import("three").Material[] {
  const clone = (item: import("three").Material): import("three").Material => {
    const copy = item.clone();
    copy.transparent = true;
    copy.opacity = 0.5;
    // Match an in-progress construction site. The river is a transparent
    // overlay rendered later, so the ghost must retain depth in order not to
    // be composited underneath water at the selected placement.
    copy.depthWrite = true;
    return copy;
  };
  return Array.isArray(material) ? material.map(clone) : clone(material);
}

function disposePreviewObject(root: Object3D | null): void {
  root?.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (!isSharedPreviewMesh(child)) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

function disposeMaterial(material: import("three").Material | import("three").Material[] | undefined): void {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
    return;
  }
  material.dispose();
}

function isSharedPreviewMesh(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.rtsSharedModel === true) return true;
  }
  return false;
}

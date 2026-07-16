/**
 * RTS building placement controller — Vertical Slice Plan v0.2 §25 (Faz 2).
 *
 * Owns the *input* half only: the screen-to-ground ray and the ghost mesh. The
 * rules (snap, validation, payment, site creation) moved to the headless
 * {@link StructureConstructionService} in Faz 5.0 so the AI opponent can build
 * through exactly the same path without a pointer (AI design §4).
 */
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from "three";

import type { BuildingBalance, BuildingBalanceStats } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import type { PlacementResult } from "./placementGrid";
import type { StructureConstructionService } from "./structureConstructionService";

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const VALID_COLOR = new Color("#7dc86d");
const INVALID_COLOR = new Color("#d65b55");

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
  private ghost: Mesh | null = null;
  private result: PlacementResult | null = null;

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
    this.rebuildGhost(stats);
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
    this.root.position.set(this.result.x, 0, this.result.z);
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
    this.ghost?.geometry.dispose();
    const material = this.ghost?.material;
    if (material instanceof MeshStandardMaterial) material.dispose();
    this.root.clear();
    this.ghost = null;
  }

  private groundPoint(screenX: number, screenY: number): Vector3 | null {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(GROUND_PLANE, this.hit)?.clone() ?? null;
  }

  private rebuildGhost(stats: BuildingBalanceStats): void {
    if (this.ghost) {
      this.root.remove(this.ghost);
      this.ghost.geometry.dispose();
      const material = this.ghost.material;
      if (material instanceof MeshStandardMaterial) material.dispose();
    }
    const geometry = new BoxGeometry(stats.footprint.width, 0.32, stats.footprint.depth);
    const material = new MeshStandardMaterial({
      color: VALID_COLOR,
      emissive: VALID_COLOR,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.ghost = new Mesh(geometry, material);
    this.ghost.name = "rts-building-ghost";
    this.ghost.position.y = 0.16;
    this.root.add(this.ghost);
  }

  private setGhostValid(valid: boolean): void {
    const material = this.ghost?.material;
    if (!(material instanceof MeshStandardMaterial)) return;
    material.color.copy(valid ? VALID_COLOR : INVALID_COLOR);
    material.emissive.copy(valid ? VALID_COLOR : INVALID_COLOR);
  }
}

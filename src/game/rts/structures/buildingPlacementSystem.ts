/**
 * RTS building placement controller — Vertical Slice Plan v0.2 §25 (Faz 2).
 *
 * Owns the screen-to-ground ghost, grid snap, collision validation, and the
 * narrow handoff that creates a pre-construction foundation. Worker assignment,
 * resources, cancellation, and build progress deliberately remain separate.
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

import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalance, BuildingBalanceStats } from "../../data/gameDataTypes";
import type { TerritoryControlSystem } from "../territory/territoryControlSystem";
import { ResourceWallet, type ResourceReservation } from "../economy/resourceWallet";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import {
  type PlacementResult,
  validateBuildingPlacement,
} from "./placementGrid";
import type { PlacedStructureSystem } from "./placedStructureSystem";
import type { PlacedStructure } from "./placedStructureSystem";

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
  private readonly reservations = new Map<number, ResourceReservation>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly buildings: BuildingBalance,
    private readonly structures: PlacedStructureSystem,
    private readonly wallet: ResourceWallet,
    private readonly navigation: RtsNavigation,
    private readonly occupiedBlockers: () => readonly NavBlocker[],
    private readonly territory: TerritoryControlSystem,
    private readonly onStructurePlaced: (structure: PlacedStructure) => void,
    private readonly onStructureCancelled: (structure: PlacedStructure) => void,
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
    this.result = validateBuildingPlacement(
      this.active.stats,
      point.x,
      point.z,
      this.occupiedBlockers(),
      {
        owner: "player",
        ownsFootprint: this.territory.ownsFootprint.bind(this.territory),
        canPlaceExpansion: this.territory.canPlaceExpansion.bind(this.territory),
      },
    );
    this.root.position.set(this.result.x, 0, this.result.z);
    this.setGhostValid(this.result.valid);
    return this.state();
  }

  /** Confirm a currently valid proposal, creating its pending construction site. */
  confirmAt(screenX: number, screenY: number): BuildingPlacementState {
    const state = this.previewAt(screenX, screenY);
    if (!this.active || !state.result?.valid) return state;
    const reservation = this.wallet.reserve(this.active.stats.cost);
    if (!reservation) {
      this.result = { ...state.result, valid: false, reason: "insufficient-resources" };
      this.setGhostValid(false);
      return this.state();
    }
    const structure = this.structures.place(this.active.stats, state.result.x, state.result.z);
    this.reservations.set(structure.id, reservation);
    this.navigation.setBlockers(this.occupiedBlockers());
    this.onStructurePlaced(structure);
    // Keep build mode active like an RTS palette; the following preview will be
    // invalid if it overlaps the site just created.
    this.result = null;
    return this.state();
  }

  /** Cancel the latest unbuilt site and refund its reservation in full. */
  cancelLatestConstruction(): boolean {
    const structure = this.structures.cancelLatest();
    if (!structure) return false;
    const reservation = this.reservations.get(structure.id);
    if (reservation) this.wallet.refund(reservation);
    this.reservations.delete(structure.id);
    this.navigation.setBlockers(this.occupiedBlockers());
    this.onStructureCancelled(structure);
    return true;
  }

  /** Forget site tokens after the match owner resets the wallet. */
  resetReservations(): void {
    this.reservations.clear();
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

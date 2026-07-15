/** Interactive start/end road drawing, preview, cost payment, and rendering. */
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
import type { ResourceWallet } from "../economy/resourceWallet";
import { RoadGraph, type RoadCell, type RoadPlan } from "./roadGraph";

const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);
const ROAD_COLOR = new Color("#8f7042");
const PREVIEW_COLOR = new Color("#d3c267");
const INVALID_COLOR = new Color("#d65b55");

export type RoadPlacementReason = "choose-start" | "choose-end" | "invalid-route" | "insufficient-resources";

export interface RoadPlacementState {
  readonly active: boolean;
  readonly start: RoadCell | null;
  readonly plan: RoadPlan | null;
  readonly reason: RoadPlacementReason | null;
}

export class RoadPlacementSystem {
  readonly root = new Group();
  private readonly permanent = new Group();
  private readonly preview = new Group();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  private readonly roadGeometry: BoxGeometry;
  private readonly roadMaterial = new MeshStandardMaterial({ color: ROAD_COLOR, roughness: 0.95 });
  private readonly previewMaterial = new MeshStandardMaterial({
    color: PREVIEW_COLOR,
    emissive: PREVIEW_COLOR,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  private active = false;
  private start: RoadCell | null = null;
  private plan: RoadPlan | null = null;
  private reason: RoadPlacementReason | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly roads: RoadGraph,
    private readonly wallet: ResourceWallet,
    private readonly blockers: () => readonly NavBlocker[],
  ) {
    this.root.name = "rts-roads";
    this.permanent.name = "rts-road-segments";
    this.preview.name = "rts-road-preview";
    this.roadGeometry = new BoxGeometry(this.roads.cellSize * 0.86, 0.07, this.roads.cellSize * 0.86);
    this.root.add(this.permanent, this.preview);
  }

  get isActive(): boolean {
    return this.active;
  }

  state(): RoadPlacementState {
    return { active: this.active, start: this.start, plan: this.plan, reason: this.reason };
  }

  begin(): void {
    this.active = true;
    this.start = null;
    this.plan = null;
    this.reason = "choose-start";
    this.clearPreview();
  }

  cancel(): void {
    this.active = false;
    this.start = null;
    this.plan = null;
    this.reason = null;
    this.clearPreview();
  }

  previewAt(screenX: number, screenY: number): RoadPlacementState {
    if (!this.active || !this.start) return this.state();
    const point = this.groundPoint(screenX, screenY);
    if (!point) return this.state();
    this.plan = this.roads.plan(this.start, point, this.blockers());
    this.reason = this.plan ? "choose-end" : "invalid-route";
    this.renderPreview(this.plan, this.plan ? PREVIEW_COLOR : INVALID_COLOR);
    return this.state();
  }

  confirmAt(screenX: number, screenY: number): RoadPlacementState {
    if (!this.active) return this.state();
    const point = this.groundPoint(screenX, screenY);
    if (!point) return this.state();
    if (!this.start) {
      const startPlan = this.roads.plan(point, point, this.blockers());
      if (!startPlan) {
        this.reason = "invalid-route";
        return this.state();
      }
      this.start = startPlan.cells[0] ?? null;
      this.reason = this.start ? "choose-end" : "invalid-route";
      return this.state();
    }
    const state = this.previewAt(screenX, screenY);
    if (!state.plan) return state;
    if (state.plan.woodCost > 0) {
      const reservation = this.wallet.reserve({ wood: state.plan.woodCost });
      if (!reservation) {
        this.reason = "insufficient-resources";
        this.renderPreview(state.plan, INVALID_COLOR);
        return this.state();
      }
      this.wallet.commit(reservation);
    }
    this.roads.commit(state.plan);
    this.renderPermanent();
    this.start = state.plan.cells.at(-1) ?? null;
    this.plan = null;
    this.reason = "choose-end";
    this.clearPreview();
    return this.state();
  }

  reset(): void {
    this.roads.clear();
    this.cancel();
    this.clearMeshes(this.permanent);
  }

  dispose(): void {
    this.clearMeshes(this.permanent);
    this.clearMeshes(this.preview);
    this.roadGeometry.dispose();
    this.roadMaterial.dispose();
    this.previewMaterial.dispose();
    this.root.clear();
  }

  private groundPoint(screenX: number, screenY: number): Vector3 | null {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.ndc.set((screenX / width) * 2 - 1, -(screenY / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(GROUND_PLANE, this.hit)?.clone() ?? null;
  }

  private renderPreview(plan: RoadPlan | null, color: Color): void {
    this.clearPreview();
    if (!plan) return;
    this.previewMaterial.color.copy(color);
    this.previewMaterial.emissive.copy(color);
    for (const cell of plan.cells) this.preview.add(this.createCellMesh(cell, this.previewMaterial, "preview"));
  }

  private renderPermanent(): void {
    this.clearMeshes(this.permanent);
    for (const segment of this.roads.all()) {
      this.permanent.add(this.createCellMesh(segment, this.roadMaterial, segment.kind));
    }
  }

  private createCellMesh(cell: RoadCell, material: MeshStandardMaterial, kind: string): Mesh {
    const mesh = new Mesh(this.roadGeometry, material);
    mesh.name = `rts-road-${kind}`;
    mesh.position.set(cell.x, 0.045, cell.z);
    mesh.receiveShadow = true;
    return mesh;
  }

  private clearPreview(): void {
    this.preview.clear();
  }

  private clearMeshes(group: Group): void {
    group.clear();
  }
}

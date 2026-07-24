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

import type { UnitOwner } from "../units/unit";
import type { RoadConstructionService } from "./roadConstructionService";
import {
  RoadGraph,
  type RoadCell,
  type RoadDirection,
  type RoadPlan,
  type RoadSegment,
} from "./roadGraph";

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
  private readonly previewGeometry: BoxGeometry;
  private readonly roadCenterGeometry: BoxGeometry;
  private readonly roadArmGeometry: BoxGeometry;
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
  /**
   * When an authored terrain is mounted the road look is painted onto it
   * ({@link RoadTerrainPainter}), so the box-mesh tiles must not also draw. The
   * translucent preview boxes stay — they remain a readable placement affordance.
   */
  private painted = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly roads: RoadGraph,
    private readonly construction: RoadConstructionService,
    /** The kingdom these road controls build for — the human player. */
    private readonly owner: UnitOwner,
  ) {
    this.root.name = "rts-roads";
    this.permanent.name = "rts-road-segments";
    this.preview.name = "rts-road-preview";
    const laneWidth = this.roads.cellSize * 0.56;
    this.previewGeometry = new BoxGeometry(this.roads.cellSize * 0.86, 0.07, this.roads.cellSize * 0.86);
    this.roadCenterGeometry = new BoxGeometry(laneWidth, 0.08, laneWidth);
    this.roadArmGeometry = new BoxGeometry(laneWidth, 0.08, this.roads.cellSize * 0.6);
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
    this.plan = this.construction.plan(this.start, point);
    this.reason = this.plan ? "choose-end" : "invalid-route";
    this.renderPreview(this.plan, this.plan ? PREVIEW_COLOR : INVALID_COLOR);
    return this.state();
  }

  confirmAt(screenX: number, screenY: number): RoadPlacementState {
    if (!this.active) return this.state();
    const point = this.groundPoint(screenX, screenY);
    if (!point) return this.state();
    if (!this.start) {
      const startPlan = this.construction.plan(point, point);
      if (!startPlan) {
        this.reason = "invalid-route";
        return this.state();
      }
      this.start = startPlan.cells[0] ?? null;
      this.reason = this.start ? "choose-end" : "invalid-route";
      return this.state();
    }
    const state = this.previewAt(screenX, screenY);
    if (!state.plan || !this.start) return state;
    const build = this.construction.build(this.owner, this.start, state.plan.cells.at(-1) ?? this.start);
    if (!build.built) {
      this.reason = build.reason;
      this.renderPreview(state.plan, INVALID_COLOR);
      return this.state();
    }
    this.start = build.plan.cells.at(-1) ?? null;
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
    this.previewGeometry.dispose();
    this.roadCenterGeometry.dispose();
    this.roadArmGeometry.dispose();
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
    for (const cell of plan.cells) this.preview.add(this.createPreviewMesh(cell));
  }

  /**
   * Switch between box-mesh tiles and terrain-painted roads. Painted mode drops
   * any standing box tiles; the caller ({@link RoadTerrainPainter}) owns the look
   * from then on. Re-rendering here keeps the two modes' visuals mutually exclusive.
   */
  setPaintedMode(enabled: boolean): void {
    if (this.painted === enabled) return;
    this.painted = enabled;
    this.renderNetwork();
  }

  /**
   * Rebuild every committed road tile. Public because roads can now be
   * committed headlessly by the AI, not only through this pointer flow. A no-op
   * for box geometry in painted mode — the mounted terrain carries the road paint.
   */
  renderNetwork(): void {
    this.clearMeshes(this.permanent);
    if (this.painted) return;
    for (const segment of this.roads.all()) {
      this.permanent.add(this.createSegmentMesh(segment));
    }
  }

  private createPreviewMesh(cell: RoadCell): Mesh {
    const mesh = new Mesh(this.previewGeometry, this.previewMaterial);
    mesh.name = "rts-road-preview";
    mesh.position.set(cell.x, 0.045, cell.z);
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Compose a tile from a central pad plus its actual cardinal exits. */
  private createSegmentMesh(segment: RoadSegment): Group {
    const tile = new Group();
    tile.name = `rts-road-${segment.kind}`;
    tile.position.set(segment.x, 0, segment.z);
    const center = new Mesh(this.roadCenterGeometry, this.roadMaterial);
    center.name = "rts-road-center";
    center.position.y = 0.045;
    center.receiveShadow = true;
    tile.add(center);
    for (const direction of segment.connections) tile.add(this.createRoadArm(direction));
    return tile;
  }

  private createRoadArm(direction: RoadDirection): Mesh {
    const arm = new Mesh(this.roadArmGeometry, this.roadMaterial);
    arm.name = `rts-road-arm-${direction}`;
    arm.position.y = 0.045;
    const offset = this.roads.cellSize * 0.34;
    if (direction === "east" || direction === "west") {
      arm.rotation.y = Math.PI / 2;
      arm.position.x = direction === "east" ? offset : -offset;
    } else {
      arm.position.z = direction === "south" ? offset : -offset;
    }
    arm.receiveShadow = true;
    return arm;
  }

  private clearPreview(): void {
    this.preview.clear();
  }

  private clearMeshes(group: Group): void {
    group.clear();
  }
}

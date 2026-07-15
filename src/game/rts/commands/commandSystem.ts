/**
 * RTS command system — Vertical Slice Plan v0.2 §21 ("Sağ tık hareket").
 *
 * Turns a contextual right-click into either an enemy attack order or a ground
 * move order for the current selection. It owns input-space raycasts and order
 * issuance only; movement and combat execution remain in the unit systems.
 */
import { Plane, Raycaster, Vector2, Vector3, type PerspectiveCamera } from "three";

import type { SelectionSystem } from "../selection/selectionSystem";
import type { CommandMarkerSystem } from "./commandMarker";
import { formationOffsets } from "../units/unitMovement";
import type { Unit } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";

/** The y = 0 walkable ground the runtime commands against. */
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

export class CommandSystem {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly selection: SelectionSystem,
    private readonly units: UnitSystem,
    private readonly markers: CommandMarkerSystem,
  ) {}

  /** Issue the contextual move-or-attack order at a screen position. */
  issueAt(x: number, y: number): void {
    const selected = this.selection.selected();
    if (selected.length === 0) return;

    const target = this.raycastUnit(x, y);
    if (target && target.owner !== selected[0]?.owner) {
      for (const unit of selected) unit.setAttackTarget(target);
      this.markers.spawn(target.position, "#ff7468");
      return;
    }

    const point = this.groundPoint(x, y);
    if (!point) return;

    const offsets = formationOffsets(selected.length);
    selected.forEach((unit, i) => {
      const offset = offsets[i] ?? { x: 0, z: 0 };
      unit.setMoveTarget(point.x + offset.x, point.z + offset.z);
    });
    this.markers.spawn(point);
  }

  /** Raycast a screen point against unit bodies before treating it as ground. */
  private raycastUnit(x: number, y: number): Unit | null {
    this.setNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.units.bodyMeshes(), false)[0];
    return hit ? this.units.unitForObject(hit.object) : null;
  }

  /** Raycast a screen pixel onto the ground plane, or null if it misses. */
  private groundPoint(x: number, y: number): Vector3 | null {
    this.setNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const point = this.raycaster.ray.intersectPlane(GROUND_PLANE, this.hit);
    return point ? point.clone() : null;
  }

  private setNdc(x: number, y: number): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
  }
}

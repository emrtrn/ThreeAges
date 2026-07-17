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
import { assignGroupDestinations } from "../units/groupOrders";
import type { UnitSystem } from "../units/unitSystem";
import { issueAttackOrder } from "../units/attackPathing";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { CombatTarget } from "../combat/combatTarget";
import type { UnitStance } from "../units/unit";
import type { Unit } from "../units/unit";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { PlacedStructure, PlacedStructureSystem } from "../structures/placedStructureSystem";

/** The y = 0 walkable ground the runtime commands against. */
const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

/** RtsApp owns the actual economy/construction hand-off; commands only pick it. */
export type WorkerStructureCommand = (workers: readonly Unit[], structure: PlacedStructure) => boolean;
/** RtsApp owns stationary-defense validation and player feedback. */
export type StructureAttackCommand = (structure: PlacedStructure, target: CombatTarget) => boolean;

export class CommandSystem {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly selection: SelectionSystem,
    private readonly units: UnitSystem,
    private readonly centers: CommandCenterSystem,
    private readonly navigation: RtsNavigation,
    private readonly markers: CommandMarkerSystem,
    private readonly structures: PlacedStructureSystem | null = null,
    private readonly onWorkerStructureCommand: WorkerStructureCommand | null = null,
    private readonly onWorkerOrderCancelled: ((workers: readonly Unit[]) => void) | null = null,
    private readonly onStructureAttackCommand: StructureAttackCommand | null = null,
  ) {}

  /** Issue the contextual move-or-attack order at a screen position. */
  issueAt(x: number, y: number): void {
    const selected = this.selection.selected();
    const target = this.raycastTarget(x, y);
    if (selected.length === 0) {
      const selectedStructure = this.selection.selectedStructure();
      if (selectedStructure && target && target.owner !== selectedStructure.owner
        && this.onStructureAttackCommand?.(selectedStructure, target)) {
        this.markers.spawn(target.position, "#ff7468");
      }
      return;
    }

    if (target && target.owner !== selected[0]?.owner) {
      this.clearWorkerTasks(selected);
      for (const unit of selected) issueAttackOrder(unit, target, this.navigation);
      this.markers.spawn(target.position, "#ff7468");
      return;
    }

    const structure = this.raycastStructure(x, y);
    const workers = selected.filter((unit) => unit.role === "worker");
    if (structure && workers.length > 0 && structure.owner === selected[0]?.owner
      && this.onWorkerStructureCommand?.(workers, structure)) {
      this.markers.spawn(structure.position, "#7ce08a");
      return;
    }

    const point = this.groundPoint(x, y);
    if (!point) return;

    this.clearWorkerTasks(selected);
    for (const { unit, path } of assignGroupDestinations(selected, point, this.navigation)) {
      if (path) {
        unit.setPlayerMovePath(path);
        if (unit.role === "worker") unit.waitBeforeReturningToWork();
      }
      else unit.stop();
    }
    this.markers.spawn(point);
  }

  /**
   * Attack-move the selection to the pointer (GDD 06 §25): units walk the route
   * but stop to fight anything they acquire, then resume. Workers are excluded —
   * an attack-move that drags the economy along is not what the player meant.
   */
  issueAttackMoveAt(x: number, y: number): void {
    const selected = this.selection.selected().filter((unit) => unit.role !== "worker");
    if (selected.length === 0) return;
    const point = this.groundPoint(x, y);
    if (!point) return;

    for (const { unit, destination, path } of assignGroupDestinations(selected, point, this.navigation)) {
      if (path) unit.setAttackMovePath(path, destination);
      else unit.stop();
    }
    this.markers.spawn(point, "#ffb45e");
  }

  /** Immediately stop every currently selected unit and clear attack pursuit. */
  issueStop(): void {
    const selected = this.selection.selected();
    this.clearWorkerTasks(selected);
    for (const unit of selected) unit.stop();
  }

  /** Set the stance of every selected combat unit (GDD 06 §26). */
  issueStance(stance: UnitStance): void {
    for (const unit of this.selection.selected()) {
      if (unit.role !== "worker") unit.setStance(stance);
    }
  }

  /** Ground position under a screen pixel, for tools that pick a map point. */
  groundPointAt(x: number, y: number): Vector3 | null {
    return this.groundPoint(x, y);
  }

  /** Raycast a screen point against units or command centres before ground. */
  private raycastTarget(x: number, y: number): CombatTarget | null {
    this.setNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = [
      ...this.units.bodyMeshes(),
      ...this.centers.targetMeshes(),
      ...(this.structures ? this.structures.targetMeshes() : []),
    ];
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    if (!hit) return null;
    return this.units.unitForObject(hit.object)
      ?? this.centers.centerForObject(hit.object)
      ?? this.structures?.structureForObject(hit.object)
      ?? null;
  }

  /** Raycast friendly construction/economy sites separately from combat targets. */
  private raycastStructure(x: number, y: number): PlacedStructure | null {
    if (!this.structures) return null;
    this.setNdc(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects([...this.structures.targetMeshes()], true)[0];
    return hit ? this.structures.structureForObject(hit.object) : null;
  }

  private clearWorkerTasks(selected: readonly Unit[]): void {
    const workers = selected.filter((unit) => unit.role === "worker");
    if (workers.length > 0) this.onWorkerOrderCancelled?.(workers);
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

/**
 * RTS selection system — Vertical Slice Plan v0.2 §21 ("Seçim ve komut").
 *
 * Turns pointer intents into a live selection of player units: a left click
 * raycasts one unit; a left box-drag selects every player unit whose projected
 * screen position falls inside the marquee. Selection rings are the unit's own
 * visual (Unit.setSelected), so this system only owns *which* units are chosen.
 * Enemy units are never player-selectable (plan §4.2: you command your army).
 *
 * The selection set is the command surface later steps read (right-click
 * move/attack in the next step), so it is exposed via {@link selected}.
 */
import { Raycaster, Vector2, Vector3, type PerspectiveCamera } from "three";

import type { RtsPointerHandler, RtsPointerRect } from "../input/rtsPointer";
import type { MarqueeOverlay } from "./marqueeOverlay";
import type { UnitSystem } from "../units/unitSystem";
import type { Unit } from "../units/unit";

/** Height above ground used when projecting a unit to screen (mid-body). */
const PROJECT_HEIGHT = 1.0;

export class SelectionSystem implements RtsPointerHandler {
  private readonly selectedUnits = new Set<Unit>();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly scratch = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly units: UnitSystem,
    private readonly marquee: MarqueeOverlay,
  ) {}

  /** Currently selected player units (command surface for later steps). */
  selected(): readonly Unit[] {
    return [...this.selectedUnits];
  }

  /** Remove a unit that died or otherwise left the field from the live selection. */
  remove(unit: Unit): void {
    if (!this.selectedUnits.delete(unit)) return;
    unit.setSelected(false);
  }

  /** Clear selection and transient marquee state for a match restart. */
  reset(): void {
    this.clear();
    this.marquee.hide();
  }

  onSelectClick(x: number, y: number, additive: boolean): void {
    const unit = this.raycastUnit(x, y);
    if (unit && unit.owner === "player") {
      if (additive) this.toggle(unit);
      else this.replaceWith([unit]);
      return;
    }
    // Clicked empty ground (or an enemy): clear unless additive.
    if (!additive) this.clear();
  }

  onSelectDrag(rect: RtsPointerRect): void {
    this.marquee.show(rect);
  }

  onSelectCommit(rect: RtsPointerRect, additive: boolean): void {
    this.marquee.hide();
    const inside = this.playerUnitsInRect(rect);
    if (additive) {
      for (const unit of inside) {
        this.selectedUnits.add(unit);
        unit.setSelected(true);
      }
    } else {
      this.replaceWith(inside);
    }
  }

  onSelectCancel(): void {
    this.marquee.hide();
  }

  private viewport(): { w: number; h: number } {
    return {
      w: this.canvas.clientWidth || window.innerWidth,
      h: this.canvas.clientHeight || window.innerHeight,
    };
  }

  private raycastUnit(x: number, y: number): Unit | null {
    const { w, h } = this.viewport();
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.units.bodyMeshes(), false);
    const first = hits[0];
    return first ? this.units.unitForObject(first.object) : null;
  }

  private playerUnitsInRect(rect: RtsPointerRect): Unit[] {
    const { w, h } = this.viewport();
    const minX = Math.min(rect.x0, rect.x1);
    const maxX = Math.max(rect.x0, rect.x1);
    const minY = Math.min(rect.y0, rect.y1);
    const maxY = Math.max(rect.y0, rect.y1);
    const result: Unit[] = [];
    // Marquee selection is a human-input concern: it never picks AI units.
    for (const unit of this.units.unitsOf("player")) {
      this.scratch.set(unit.position.x, PROJECT_HEIGHT, unit.position.z);
      this.scratch.project(this.camera);
      // Behind the camera → z outside [-1, 1]; skip.
      if (this.scratch.z < -1 || this.scratch.z > 1) continue;
      const px = (this.scratch.x * 0.5 + 0.5) * w;
      const py = (-this.scratch.y * 0.5 + 0.5) * h;
      if (px >= minX && px <= maxX && py >= minY && py <= maxY) result.push(unit);
    }
    return result;
  }

  private replaceWith(units: readonly Unit[]): void {
    this.clear();
    for (const unit of units) {
      this.selectedUnits.add(unit);
      unit.setSelected(true);
    }
  }

  private toggle(unit: Unit): void {
    if (this.selectedUnits.has(unit)) {
      this.selectedUnits.delete(unit);
      unit.setSelected(false);
    } else {
      this.selectedUnits.add(unit);
      unit.setSelected(true);
    }
  }

  private clear(): void {
    for (const unit of this.selectedUnits) unit.setSelected(false);
    this.selectedUnits.clear();
  }
}

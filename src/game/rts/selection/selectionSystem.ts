/**
 * RTS selection system — Vertical Slice Plan v0.2 §21 ("Seçim ve komut"),
 * extended by §51 ("Seçim panelleri").
 *
 * Turns pointer intents into a live selection of player units: a left click
 * raycasts one unit; a left box-drag selects every player unit whose projected
 * screen position falls inside the marquee. Selection rings are the selected
 * thing's own visual (`Unit.setSelected` / {@link setStructureSelected}), so
 * this system only owns *which* things are chosen. Enemy units and enemy
 * buildings are never player-selectable (plan §4.2: you command your kingdom).
 *
 * Faz 9 added a second selectable kind: one player structure. Units and a
 * structure are mutually exclusive — the selection answers exactly one question,
 * and a panel that had to describe "3 Guards and a Barracks" would answer
 * neither. A structure is click-only: a marquee is an army gesture, and sweeping
 * a box across the base to grab units should never also grab the buildings under
 * them.
 *
 * The selection set is the command surface later steps read (right-click
 * move/attack), so it is exposed via {@link selected}.
 */
import { Raycaster, Vector2, Vector3, type PerspectiveCamera } from "three";

import type { RtsPointerHandler, RtsPointerRect } from "../input/rtsPointer";
import type { MarqueeOverlay } from "./marqueeOverlay";
import type { UnitSystem } from "../units/unitSystem";
import type { Unit } from "../units/unit";
import {
  setStructureSelected,
  type PlacedStructure,
  type PlacedStructureSystem,
} from "../structures/placedStructureSystem";
import type { CommandCenter } from "../structures/commandCenter";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { TradeSiteView } from "../world/tradeSiteView";

/** Height above ground used when projecting a unit to screen (mid-body). */
const PROJECT_HEIGHT = 1.0;

export class SelectionSystem implements RtsPointerHandler {
  private readonly selectedUnits = new Set<Unit>();
  private selectedStructureRef: PlacedStructure | null = null;
  private selectedCenterRef: CommandCenter | null = null;
  /**
   * The selected trade site, by id — supply plan Faz S6.
   *
   * An id rather than an object because a site *is* an id: it has no runtime
   * instance to hold, only an authored definition and whatever the systems say
   * about it this frame. Holding the pick proxy instead would tie the selection
   * to a render object that exists purely to be raycast.
   */
  private selectedTradeSiteRef: string | null = null;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly scratch = new Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: PerspectiveCamera,
    private readonly units: UnitSystem,
    private readonly marquee: MarqueeOverlay,
    private readonly structures: PlacedStructureSystem,
    private readonly centers: CommandCenterSystem,
    /**
     * Faz S6's fourth pick list. Optional because a project need not author any
     * trade site — and because the sites load with the world, after this system
     * is built, so a required argument would force the order the other way round.
     */
    private readonly tradeSites: TradeSiteView | null = null,
  ) {}

  /** Currently selected player units (command surface for later steps). */
  selected(): readonly Unit[] {
    return [...this.selectedUnits];
  }

  /** The single selected player structure, if the selection is a building one. */
  selectedStructure(): PlacedStructure | null {
    return this.selectedStructureRef;
  }

  /** The selected command centre. Kept apart from {@link selectedStructure}
   * because the centre is a `CommandCenter`, not a `PlacedStructure` — it is
   * spawned by the match rather than built, so it has no construction, no
   * footprint data and no owner-paid cost. */
  selectedCenter(): CommandCenter | null {
    return this.selectedCenterRef;
  }

  /** The selected trade site's id, if the selection is a trade-site one. */
  selectedTradeSite(): string | null {
    return this.selectedTradeSiteRef;
  }

  /** Replace the live selection with player units chosen by a HUD command. */
  selectUnits(units: readonly Unit[]): void {
    this.replaceWith(units.filter((unit) => unit.owner === "player" && !unit.health.depleted));
  }

  /**
   * Add player units to the live selection, keeping what is already in it.
   *
   * The Shift half of a HUD command, and the same gesture the marquee's
   * `additive` commit performs — so it clears a selected structure for the same
   * reason: the moment the answer becomes an army, the building is not part of
   * it.
   */
  addUnits(units: readonly Unit[]): void {
    const additions = units.filter((unit) => unit.owner === "player" && !unit.health.depleted);
    if (additions.length === 0) return;
    this.clearStructure();
    for (const unit of additions) {
      this.selectedUnits.add(unit);
      unit.setSelected(true);
    }
  }

  /** Remove a unit that died or otherwise left the field from the live selection. */
  remove(unit: Unit): void {
    if (!this.selectedUnits.delete(unit)) return;
    unit.setSelected(false);
  }

  /**
   * Drop a selected structure that has left the field. Called against the live
   * list rather than per removal path because a building can leave in more than
   * one way — razed by combat, or cancelled from the palette — and a selection
   * that survived either would keep the panel describing a building that is not
   * there. This is the reconcile-against-the-live-list rule the rest of the
   * structure systems already follow.
   */
  reconcileStructures(live: readonly PlacedStructure[]): void {
    if (!this.selectedStructureRef) return;
    if (live.includes(this.selectedStructureRef)) return;
    // No setStructureSelected: the ring left with the object it hung on.
    this.selectedStructureRef = null;
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
    // Units win the pick when both are under the cursor: a unit standing on its
    // own foundation is the smaller, likelier target, and the building cannot
    // walk out from under the cursor to be clicked again.
    //
    // Additive is an army gesture and has no meaning for a single building.
    // Ignoring it (rather than clearing) keeps shift-click from silently
    // throwing away a group the player is still assembling.
    const structure = this.raycastStructure(x, y);
    if (structure && structure.owner === "player") {
      if (!additive) this.selectStructure(structure);
      return;
    }
    const center = this.raycastCenter(x, y);
    if (center && center.owner === "player") {
      if (!additive) this.selectCenter(center);
      return;
    }
    // Faz S6, and last of the four on purpose: a dock is a wide patch of ground,
    // so anything standing on or beside it is the likelier target. Unlike the
    // three above there is no owner test — a trade site belongs to whoever's
    // road reached it, and "who holds this" is the first thing the panel exists
    // to answer, so a rival's port must be selectable to be read. Nothing leaks
    // by it: {@link TradeSiteView.targetMeshes} hands over explored sites only,
    // and the panel shows a rival's buffer and fleet as unknown, not as zero.
    const tradeSite = this.raycastTradeSite(x, y);
    if (tradeSite) {
      if (!additive) this.selectTradeSite(tradeSite);
      return;
    }
    // Clicked empty ground (or something enemy-owned): clear unless additive.
    if (!additive) this.clear();
  }

  /**
   * Double-clicking a unit selects every live player unit of its *type*.
   *
   * Type, not role: this is the in-world twin of clicking that unit's chip in
   * the HUD army strip, and the two gestures answering differently — the chip
   * giving you 5 Muhafız, the double-click giving you 5 Muhafız and 3 Ağır
   * Muhafız because both are `role: "guard"` — would make one of them a trap.
   * It is also what the convention means everywhere else: a double-click
   * selects more of *this*.
   */
  onSelectDoubleClick(x: number, y: number, additive: boolean): void {
    const unit = this.raycastUnit(x, y);
    if (!unit || unit.owner !== "player") return;
    const matching = this.units.unitsOf("player").filter((candidate) => candidate.typeId === unit.typeId);
    if (!additive) {
      this.replaceWith(matching);
      return;
    }
    for (const candidate of matching) {
      this.selectedUnits.add(candidate);
      candidate.setSelected(true);
    }
  }

  onSelectDrag(rect: RtsPointerRect): void {
    this.marquee.show(rect);
  }

  onSelectCommit(rect: RtsPointerRect, additive: boolean): void {
    this.marquee.hide();
    const inside = this.playerUnitsInRect(rect);
    if (additive) {
      if (inside.length > 0) this.clearStructure();
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

  private raycastStructure(x: number, y: number): PlacedStructure | null {
    const { w, h } = this.viewport();
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // Recursive: a completed building's pick targets are the meshes *inside* a
    // loaded model, not the group registered for it.
    const hits = this.raycaster.intersectObjects([...this.structures.targetMeshes()], true);
    const first = hits[0];
    return first ? this.structures.structureForObject(first.object) : null;
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
      this.scratch.set(unit.position.x, unit.position.y + PROJECT_HEIGHT, unit.position.z);
      this.scratch.project(this.camera);
      // Behind the camera → z outside [-1, 1]; skip.
      if (this.scratch.z < -1 || this.scratch.z > 1) continue;
      const px = (this.scratch.x * 0.5 + 0.5) * w;
      const py = (-this.scratch.y * 0.5 + 0.5) * h;
      if (px >= minX && px <= maxX && py >= minY && py <= maxY) result.push(unit);
    }
    return result;
  }

  private raycastCenter(x: number, y: number): CommandCenter | null {
    const { w, h } = this.viewport();
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.centers.targetMeshes()], true);
    const first = hits[0];
    return first ? this.centers.centerForObject(first.object) : null;
  }

  private raycastTradeSite(x: number, y: number): string | null {
    if (!this.tradeSites) return null;
    const { w, h } = this.viewport();
    this.ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    // Not recursive: each proxy is a single mesh, and there is nothing inside it.
    const hits = this.raycaster.intersectObjects([...this.tradeSites.targetMeshes()], false);
    const first = hits[0];
    return first ? this.tradeSites.siteForObject(first.object) : null;
  }

  private selectStructure(structure: PlacedStructure): void {
    this.clear();
    this.selectedStructureRef = structure;
    setStructureSelected(structure, true);
  }

  /**
   * No selection ring, and there is nothing to hang one on: the site's art is a
   * batched Level instance and the proxy is deliberately invisible. The panel
   * appearing is the whole feedback, as it is for anything the player inspects
   * rather than commands.
   */
  private selectTradeSite(siteId: string): void {
    this.clear();
    this.selectedTradeSiteRef = siteId;
  }

  private selectCenter(center: CommandCenter): void {
    this.clear();
    this.selectedCenterRef = center;
    center.setSelected(true);
  }

  private replaceWith(units: readonly Unit[]): void {
    this.clear();
    for (const unit of units) {
      this.selectedUnits.add(unit);
      unit.setSelected(true);
    }
  }

  private toggle(unit: Unit): void {
    // Shift-clicking a unit while a building is selected starts an army
    // selection; the building is not part of that answer.
    this.clearStructure();
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
    this.clearStructure();
  }

  /**
   * Both building kinds are the same answer to the player, so they clear
   * together — and so does the trade site, which joins them for the reason the
   * whole selection is exclusive: the panel answers exactly one question, and
   * "a Barracks and a port" is not one.
   */
  private clearStructure(): void {
    if (this.selectedStructureRef) {
      setStructureSelected(this.selectedStructureRef, false);
      this.selectedStructureRef = null;
    }
    if (this.selectedCenterRef) {
      this.selectedCenterRef.setSelected(false);
      this.selectedCenterRef = null;
    }
    this.selectedTradeSiteRef = null;
  }
}

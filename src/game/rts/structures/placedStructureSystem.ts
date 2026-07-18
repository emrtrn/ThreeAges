/**
 * Phase 2 pre-construction structure sites.
 *
 * A confirmed placement creates a construction progress marker and a nav blocker, but has
 * no gameplay function until the worker/construction slice supplies progress.
 *
 * Faz 5.1: a placed structure is also a {@link CombatTarget}. Until then only
 * command centres carried health, so the AI's §60 target scoring had exactly one
 * thing it could ever choose — see plan §37.2.
 */
import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  type Object3D,
  type Vector3,
} from "three";

import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalanceStats, EconomyProductionBalance, StartingResources } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";
import { createTeamRing } from "../team/teamColors";
import { buildingFootprintBlocker } from "./placementGrid";
import { ConstructionComponent } from "./constructionComponent";

/** Completed-building tint per kingdom; outposts stay lighter to read as territory. */
const COMPLETED_COLOR: Record<UnitOwner, { readonly territory: string; readonly plain: string }> = {
  player: { territory: "#467a9f", plain: "#80684a" },
  enemy: { territory: "#9f4a46", plain: "#8a5a4a" },
};
const CONSTRUCTION_OPACITY = 0.5;
const COMPLETION_DROP_DURATION = 0.2;
const COMPLETION_DROP_HEIGHT = 2.5;

export interface PlacedStructure {
  readonly id: number;
  /** Which kingdom paid for and controls this structure (AI design §4). */
  readonly owner: UnitOwner;
  readonly stats: BuildingBalanceStats;
  readonly x: number;
  readonly z: number;
  readonly blocker: NavBlocker;
  readonly object: Group;
  readonly construction: ConstructionComponent;
  readonly progressFill: Mesh;
  /**
   * Data-owned durability (GDD §37 classes). A construction site carries its
   * finished building's health: it is a real object on the field from the moment
   * it is placed, and progress-scaled durability is a Faz 7 combat concern.
   */
  readonly health: HealthComponent;
  /** Faz 9 selection ring; the structure's counterpart to {@link Unit.setSelected}. */
  readonly selectionRing: Mesh;
  /** {@link CombatTarget}: the same world position the object sits at. */
  readonly position: Vector3;
  /** {@link CombatTarget}: every building is the §33 table's "structure" column. */
  readonly armorClass: "structure";
  /** Melee units strike the footprint edge rather than walking into the blocker. */
  readonly combatRadius: number;
  /** Level 1 at placement; per-instance upgrades may raise it up to 3. */
  level: number;
  /** Extra population a levelled housing building grants over its base capacity. */
  populationCapacityBonus: number;
  /** Current territory values; levelled outposts promote these without replacing the site. */
  territoryControlRadius: number | null;
  territoryConnectedControlRadius: number | null;
  /** Active absolute economy stats after the current age × level tier resolves. */
  economy: EconomyProductionBalance | null;
  /** Active per-arrow damage; range/cooldown remain on the static defense block. */
  defenseAttackDamage: number | null;
  /** Active Market commission for the current tier. */
  marketCommission: number | null;
  /** Active military production queue capacity for the current tier. */
  queueCapacity: number | null;
  /** Active global stock capacity contributed by this depot's current tier. */
  storageCapacity: StartingResources | null;
}

export class PlacedStructureSystem {
  readonly root = new Group();
  private readonly structures: PlacedStructure[] = [];
  private readonly structureByPickObjectId = new Map<number, PlacedStructure>();
  private readonly pickObjects = new Map<number, Object3D>();
  private nextId = 1;
  private completedVisualHandler: ((structure: PlacedStructure) => void) | null = null;
  private readonly dropAnimations = new Map<PlacedStructure, { readonly visual: Object3D; elapsed: number }>();

  constructor() {
    this.root.name = "rts-placed-structures";
  }

  place(owner: UnitOwner, stats: BuildingBalanceStats, x: number, z: number): PlacedStructure {
    const object = new Group();
    const id = this.nextId++;
    object.name = `rts-construction-site-${owner}-${id}`;
    object.position.set(x, 0, z);
    // Keep the construction site clickable without rendering the old brown
    // foundation slab underneath every building.
    const pickProxy = new Mesh(
      new BoxGeometry(stats.footprint.width, 0.3, stats.footprint.depth),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    pickProxy.name = "rts-construction-pick-proxy";
    pickProxy.position.y = 0.15;
    object.add(pickProxy);
    const progressFill = new Mesh(
      new BoxGeometry(stats.footprint.width - 0.4, 0.12, 0.36),
      new MeshStandardMaterial({ color: "#d8d05c", emissive: "#59520e", roughness: 0.7 }),
    );
    progressFill.name = "rts-construction-progress";
    progressFill.position.set(0, 0.3, -stats.footprint.depth / 2 - 0.35);
    progressFill.scale.x = 0.001;
    // Screen-projected DOM owns the player-facing construction indicator. Keep
    // this mesh only as a stable pick target for the construction site.
    progressFill.visible = false;
    object.add(progressFill);
    // Sized from the footprint rather than a fixed radius: the ring's job is to
    // say *which* building is selected, and a 6x6 depot and a 2x2 house cannot
    // share one radius without the ring reading as a different building's.
    const ringRadius = Math.max(stats.footprint.width, stats.footprint.depth) / 2 + 0.35;
    const selectionRing = new Mesh(
      new RingGeometry(ringRadius, ringRadius + 0.3, 32),
      new MeshStandardMaterial({
        color: new Color("#f2f27a"),
        emissive: new Color("#8f8f20"),
        roughness: 0.5,
      }),
    );
    selectionRing.name = "rts-structure-selection-ring";
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.05;
    selectionRing.visible = false;
    object.add(selectionRing);
    // Team ring sits just inside the selection ring, on the same footprint-derived
    // radius, so ownership reads at camera distance without a model tint.
    object.add(createTeamRing(owner, ringRadius - 0.35));
    this.root.add(object);
    const structure: PlacedStructure = {
      id,
      owner,
      stats,
      x,
      z,
      blocker: buildingFootprintBlocker(stats, x, z),
      object,
      construction: new ConstructionComponent(stats.constructionSeconds),
      progressFill,
      health: new HealthComponent(stats.maxHealth),
      selectionRing,
      position: object.position,
      armorClass: "structure",
      // The inscribed radius: a rectangular footprint is attackable from its
      // nearest edge, so the shorter side is what a melee unit must reach.
      combatRadius: Math.min(stats.footprint.width, stats.footprint.depth) / 2,
      level: 1,
      populationCapacityBonus: 0,
      territoryControlRadius: stats.territory?.controlRadius ?? null,
      territoryConnectedControlRadius: stats.territory?.connectedControlRadius ?? null,
      economy: stats.economy ?? null,
      defenseAttackDamage: stats.defense?.attackDamage ?? null,
      // The market system retains its legacy level ladder fallback until this
      // structure is completed and the active progression tier is applied.
      marketCommission: null,
      queueCapacity: null,
      storageCapacity: null,
    };
    this.structures.push(structure);
    this.registerPickTargets(structure, progressFill);
    this.registerPickTargets(structure, pickProxy);
    return structure;
  }

  navigationBlockers(): readonly NavBlocker[] {
    return this.structures.map((structure) => structure.blocker);
  }

  /** Apply active worker-seconds and promote the site visual when it completes. */
  advanceConstruction(structure: PlacedStructure, deltaSeconds: number, workerCount = 1): boolean {
    const justCompleted = structure.construction.advance(deltaSeconds, workerCount);
    structure.progressFill.scale.x = Math.max(0.001, structure.construction.progress);
    if (justCompleted) this.finishVisual(structure);
    return justCompleted;
  }

  /** Advance the presentation-only completion drop using real rendered time. */
  updateVisualAnimations(deltaSeconds: number): void {
    for (const [structure, animation] of this.dropAnimations) {
      if (!this.structures.includes(structure) || animation.visual.parent !== structure.object) {
        this.dropAnimations.delete(structure);
        continue;
      }
      animation.elapsed = Math.min(COMPLETION_DROP_DURATION, animation.elapsed + Math.max(0, deltaSeconds));
      const progress = animation.elapsed / COMPLETION_DROP_DURATION;
      animation.visual.position.y = COMPLETION_DROP_HEIGHT * (1 - progress);
      if (progress >= 1) this.dropAnimations.delete(structure);
    }
  }

  all(): readonly PlacedStructure[] {
    return this.structures;
  }

  /** Render objects that can receive a contextual worker command. */
  targetMeshes(): readonly Object3D[] {
    return [...this.pickObjects.values()];
  }

  /** Resolve a raycast hit on a foundation or completed visual back to its site. */
  structureForObject(object: Object3D): PlacedStructure | null {
    for (let current: Object3D | null = object; current; current = current.parent) {
      const structure = this.structureByPickObjectId.get(current.id);
      if (structure) return structure;
    }
    return null;
  }

  /** Lets the runtime replace completed placeholders without changing construction rules. */
  setCompletedVisualHandler(handler: (structure: PlacedStructure) => void): void {
    this.completedVisualHandler = handler;
  }

  /** Swap a completed box for an externally loaded building model. */
  setCompletedVisual(structure: PlacedStructure, visual: Object3D): void {
    this.removeVisual(structure, "rts-complete-building-placeholder");
    this.removeVisual(structure, "rts-complete-building-model");
    this.removeVisual(structure, "rts-construction-building-model");
    this.dropAnimations.delete(structure);
    visual.name = "rts-complete-building-model";
    structure.object.add(visual);
    this.registerPickTargets(structure, visual);
  }

  /** Show the finished model as a translucent in-progress construction site. */
  setConstructionVisual(structure: PlacedStructure, visual: Object3D): void {
    this.removeVisual(structure, "rts-construction-building-model");
    visual.name = "rts-construction-building-model";
    setObjectOpacity(visual, CONSTRUCTION_OPACITY);
    structure.object.add(visual);
    this.registerPickTargets(structure, visual);
  }

  /** Replace the construction placeholder and begin the short landing animation. */
  setCompletedVisualWithDrop(structure: PlacedStructure, visual: Object3D): void {
    this.setCompletedVisual(structure, visual);
    visual.position.y = COMPLETION_DROP_HEIGHT;
    this.dropAnimations.set(structure, { visual, elapsed: 0 });
  }

  /** One kingdom's structures. The Faz 5 AI reads its own base through this. */
  ownedBy(owner: UnitOwner): readonly PlacedStructure[] {
    return this.structures.filter((structure) => structure.owner === owner);
  }

  /** Remove a kingdom's newest unbuilt site. Targeted cancellation arrives with workers. */
  cancelLatest(owner: UnitOwner): PlacedStructure | null {
    let index = -1;
    for (let i = this.structures.length - 1; i >= 0; i -= 1) {
      const structure = this.structures[i];
      if (structure && structure.owner === owner && !structure.construction.complete) {
        index = i;
        break;
      }
    }
    if (index < 0) return null;
    const [structure] = this.structures.splice(index, 1);
    if (!structure) return null;
    this.disposeStructure(structure);
    return structure;
  }

  /** Remove a completed or unfinished structure; combat uses this destruction hook. */
  destroy(structure: PlacedStructure): boolean {
    const index = this.structures.indexOf(structure);
    if (index < 0) return false;
    this.structures.splice(index, 1);
    this.disposeStructure(structure);
    return true;
  }

  clear(): void {
    for (const structure of this.structures) this.disposeStructure(structure);
    this.structures.length = 0;
    this.dropAnimations.clear();
  }

  private disposeStructure(structure: PlacedStructure): void {
    for (const [objectId, pickStructure] of this.structureByPickObjectId) {
      if (pickStructure !== structure) continue;
      this.structureByPickObjectId.delete(objectId);
      this.pickObjects.delete(objectId);
    }
    this.root.remove(structure.object);
    this.dropAnimations.delete(structure);
    structure.object.traverse((child) => {
      if (!(child instanceof Mesh) || isSharedModelMesh(child)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
  }

  private finishVisual(structure: PlacedStructure): void {
    structure.object.remove(structure.progressFill);
    structure.progressFill.visible = false;
    const completed = new Mesh(
      new BoxGeometry(
        structure.stats.footprint.width * 0.72,
        Math.max(2.5, structure.stats.footprint.width * 0.45),
        structure.stats.footprint.depth * 0.72,
      ),
      new MeshStandardMaterial({
        color: structure.stats.territory
          ? COMPLETED_COLOR[structure.owner].territory
          : COMPLETED_COLOR[structure.owner].plain,
        roughness: 0.85,
      }),
    );
    completed.name = "rts-complete-building-placeholder";
    completed.position.y = completed.geometry.parameters.height / 2 + 0.18;
    completed.castShadow = true;
    completed.receiveShadow = true;
    structure.object.add(completed);
    this.registerPickTargets(structure, completed);
    this.completedVisualHandler?.(structure);
  }

  private registerPickTargets(structure: PlacedStructure, object: Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.userData.structureId = structure.id;
      this.structureByPickObjectId.set(child.id, structure);
      this.pickObjects.set(child.id, child);
    });
  }

  private removeVisual(structure: PlacedStructure, name: string): void {
    const visual = structure.object.getObjectByName(name);
    if (!visual) return;
    structure.object.remove(visual);
    this.unregisterPickTargets(visual);
    disposeObjectMeshes(visual);
  }

  private unregisterPickTargets(object: Object3D): void {
    object.traverse((child) => {
      this.structureByPickObjectId.delete(child.id);
      this.pickObjects.delete(child.id);
    });
  }
}

/**
 * The structure counterpart of `Unit.setSelected`. A free function rather than a
 * method because {@link PlacedStructure} is data the systems share, not a class:
 * the ring is the only piece of it selection owns.
 */
export function setStructureSelected(structure: PlacedStructure, selected: boolean): void {
  structure.selectionRing.visible = selected;
}

function disposeObjectMeshes(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const sharedModel = isSharedModelMesh(child);
    if (!sharedModel) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!sharedModel || material.userData.rtsOwnedByStructure === true) material.dispose();
    }
  });
}

function setObjectOpacity(root: Object3D, opacity: number): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const clone = (material: import("three").Material): import("three").Material => {
      const copy = material.clone();
      copy.userData.rtsOwnedByStructure = true;
      copy.transparent = true;
      copy.opacity = opacity;
      return copy;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(clone)
      : clone(child.material);
  });
}

function isSharedModelMesh(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.rtsSharedModel === true) return true;
  }
  return false;
}

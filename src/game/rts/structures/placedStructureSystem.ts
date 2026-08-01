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
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Vector3,
} from "three";

import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalanceStats, EconomyProductionBalance, StartingResources } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";
import { createTeamRing } from "../team/teamColors";
import { createSelectionRing } from "../selection/selectionRing";
import { buildingFootprintBlocker } from "./placementGrid";
import { ConstructionComponent } from "./constructionComponent";
import { createPickVolume, fitPickVolumeToVisual, footprintPickHeight } from "./pickVolume";
import {
  applyStructureDeformation,
  type StructureDeformation,
  type StructureDeformationTuning,
} from "./structureDeformation";

/** Completed-building tint per kingdom; outposts stay lighter to read as territory. */
const COMPLETED_COLOR: Record<UnitOwner, { readonly territory: string; readonly plain: string }> = {
  player: { territory: "#467a9f", plain: "#80684a" },
  enemy: { territory: "#9f4a46", plain: "#8a5a4a" },
};
const CONSTRUCTION_OPACITY = 0.5;
const COMPLETION_DROP_DURATION = 0.2;
const COMPLETION_DROP_HEIGHT = 2.5;
/**
 * How long a razed building's husk takes to shake and fall. Presentation only: the
 * structure leaves the simulation on the frame its health runs out, so its
 * footprint stops blocking navigation and its territory is recomputed
 * immediately. Letting the husk outlive the record is the whole point — a
 * building that vanished between two frames read as a rendering glitch rather
 * than as the thing the player just lost.
 */
const COLLAPSE_DURATION = 0.9;
/**
 * Ruin lifetime when the game layer names none — a fork with no damage table
 * still gets a readable ruin rather than a husk that never leaves. The authored
 * value comes through {@link StructureDamagePresentationHandler.ruinSeconds}.
 */
export const DEFAULT_RUIN_SECONDS = 14;
/** Never grow an unbounded scenery list, whatever the authored lifetime says. */
const MAX_RUINS = 10;
/** Economy scenery that reserves build space but units may walk through. */
const UNIT_PASS_THROUGH_STRUCTURE_IDS = new Set(["farm", "lumber_camp"]);
/** How far the husk's own materials move toward soot when it collapses in place. */
const CHARRED_COLOR = new Color("#241f1b");
/**
 * How far a toppling husk's geometry gives way as it falls. Modest, because the
 * fall already carries the motion — this only has to stop the building reading
 * as a solid prop being tipped over.
 */
const TOPPLE_DEFORMATION: StructureDeformationTuning = { squash: 0.34, splay: 0.16, buckle: 0.05 };
/**
 * A {@link collapsesInPlace} worksite has no fall to carry it, so the shape
 * change *is* the animation: it pancakes considerably harder.
 */
const IN_PLACE_DEFORMATION: StructureDeformationTuning = { squash: 0.58, splay: 0.26, buckle: 0.04 };
/**
 * Heavy damage only buckles — no squash, no splay. A building the player can
 * still repair must stay the same building, at the same height, on the same
 * footprint; what changes is that its walls stop being straight.
 */
const HEAVY_DAMAGE_DEFORMATION: StructureDeformationTuning = { squash: 0, splay: 0, buckle: 0.035 };

/** Health-driven presentation stages shared by every placed structure. */
export type StructureDamageStage = "normal" | "light" | "heavy" | "destroyed";

/**
 * Keep the visual thresholds in one authoritative place. The inclusive bounds
 * intentionally read as 100–66, 65–31, 30–1, then 0 in the authoring plan.
 */
export function structureDamageStage(healthRatio: number): StructureDamageStage {
  if (healthRatio <= 0) return "destroyed";
  if (healthRatio <= 0.3) return "heavy";
  if (healthRatio < 0.66) return "light";
  return "normal";
}

interface DamageMaterialOverride {
  readonly mesh: Mesh;
  readonly original: Material | Material[];
  replacement: Material | Material[];
}

interface DamagePresentation {
  readonly visual: Object3D;
  readonly materials: readonly DamageMaterialOverride[];
  readonly baseRotationX: number;
  readonly baseRotationZ: number;
  stage: Exclude<StructureDamageStage, "normal" | "destroyed">;
  /**
   * Buckling patch over {@link materials}, or null below the heavy stage. Held
   * so a stage change or a repair can drop it — it is bound to those exact
   * material clones and must not outlive them.
   */
  deformation: StructureDeformation | null;
  elapsed: number;
}

interface CollapseAnimation {
  readonly object: Object3D;
  /** Id only, never the record: the structure is gone by the time this animates. */
  readonly structureId: number;
  readonly originY: number;
  readonly originRotationZ: number;
  /** Zero for {@link collapsesInPlace} buildings, which shake but never topple. */
  readonly fallDirection: number;
  /** Vertex deformation driven alongside the fall; null if there was no model to deform. */
  readonly deformation: StructureDeformation | null;
  /** Captured at collapse: nothing can resolve the id back to a building later. */
  readonly ruinSeconds: number;
  elapsed: number;
}

/** A non-gameplay, non-pickable remnant left after the common collapse motion. */
interface RuinPresentation {
  readonly object: Object3D;
  readonly structureId: number;
  /**
   * Carried over from the collapse and left at full progress: the ruin is the
   * flattened shape the fall produced, so releasing the patch here would pop the
   * husk back to an intact building for the rest of its stay.
   */
  readonly deformation: StructureDeformation | null;
  /** Authored lifetime, carried over from the collapse that produced this ruin. */
  readonly ruinSeconds: number;
  elapsed: number;
}

/** Game-presentation events, kept separate from combat and removal rules. */
export interface StructureDamagePresentationHandler {
  /** Fires once on a health-stage transition for a completed structure. */
  onDamageStageChanged?(
    structure: PlacedStructure,
    previous: StructureDamageStage,
    next: StructureDamageStage,
  ): void;
  /** Fires once when the record leaves gameplay and its visible collapse begins. */
  onCollapse?(structure: PlacedStructure): void;
  /**
   * Fires when the husk finally leaves the scene — timed out, trimmed by
   * {@link MAX_RUINS}, or dropped on a match reset. Trailing presentation that
   * outlives the structure (smouldering smoke) stops here rather than guessing
   * the ruin's lifetime, so an early trim never leaves smoke over bare ground.
   */
  onRuinCleared?(structureId: number): void;
  /**
   * Whether this building settles where it stood instead of toppling sideways.
   *
   * A query rather than a rule of this system: which buildings have a silhouette
   * worth falling over is a game-content decision, authored in the damage table.
   * Absent (or no handler at all) means the shared topple, which is what keeps a
   * fork with no content catalog rendering something sensible.
   */
  collapsesInPlace?(structure: PlacedStructure): boolean;
  /**
   * How long this building's husk stays on the field after its fall, in seconds.
   * A query for the same reason {@link collapsesInPlace} is: how long a ruin is
   * worth looking at is a content decision. Absent falls back to
   * {@link DEFAULT_RUIN_SECONDS}.
   */
  ruinSeconds?(structure: PlacedStructure): number | undefined;
  /** Shape this building loses as it comes down; absent uses the code defaults. */
  collapseDeformation?(structure: PlacedStructure): StructureDeformationTuning | undefined;
  /** Shape a heavily damaged, still-standing building holds; absent uses the code default. */
  heavyDeformation?(structure: PlacedStructure): StructureDeformationTuning | undefined;
  /**
   * Fires on any frame a completed building's health fell.
   *
   * Detected here, by comparing against last frame, rather than reported from
   * the combat systems: every damage source — a unit's blow, a tower's arrow,
   * whatever lands next — passes through the same health component, so one check
   * covers all of them and no future weapon can forget to announce itself. The
   * cost of the approach is that simultaneous blows in one frame arrive as a
   * single event, which is the right granularity for presentation anyway.
   */
  onDamaged?(structure: PlacedStructure, amount: number): void;
}

export interface PlacedStructure {
  readonly id: number;
  /** Which kingdom paid for and controls this structure (AI design §4). */
  readonly owner: UnitOwner;
  readonly stats: BuildingBalanceStats;
  readonly x: number;
  readonly z: number;
  /** Ground elevation sampled when this foundation was placed. */
  groundY: number;
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
  /** Each structure's click collision box, resized when its model swaps in. */
  private readonly pickVolumes = new Map<PlacedStructure, Mesh>();
  private nextId = 1;
  private completedVisualHandler: ((structure: PlacedStructure) => void) | null = null;
  private readonly dropAnimations = new Map<PlacedStructure, { readonly visual: Object3D; elapsed: number }>();
  /**
   * Husks of razed buildings, detached from {@link structures} and owned only by
   * this list. Keyed by object rather than structure because the structure record
   * is gone by the time these animate — nothing may resolve a husk back to a
   * building that no longer exists.
   */
  private readonly collapses: CollapseAnimation[] = [];
  /** Opaque, short-lived remnants; gameplay has already released these cells. */
  private readonly ruins: RuinPresentation[] = [];
  /** Per-building copies keep health tinting from mutating shared GLTF materials. */
  private readonly damagePresentations = new Map<PlacedStructure, DamagePresentation>();
  /** Last announced health state; prevents presentation events from repeating per frame. */
  private readonly damageStages = new Map<PlacedStructure, StructureDamageStage>();
  /** Last frame's health, so a drop can be reported as an impact. See `onDamaged`. */
  private readonly lastHealth = new Map<PlacedStructure, number>();
  private damagePresentationHandler: StructureDamagePresentationHandler | null = null;
  /**
   * Monotonic counter of every membership change (place/cancel/destroy/clear).
   * Presentation that mirrors the standing set — the terrain's building ground
   * pads — dirty-checks on this instead of rebuilding the list every frame, the
   * same contract `RoadGraph.version` gives the painted roads.
   */
  version = 0;

  constructor() {
    this.root.name = "rts-placed-structures";
  }

  place(owner: UnitOwner, stats: BuildingBalanceStats, x: number, z: number, groundY = 0): PlacedStructure {
    const object = new Group();
    const id = this.nextId++;
    object.name = `rts-construction-site-${owner}-${id}`;
    object.position.set(x, groundY, z);
    // The building's click collision, in place from the first frame of
    // construction and never removed with a visual: clicking a courtyard, an
    // archway or the gap under a raised model still selects the building.
    const pickVolume = createPickVolume(
      stats.footprint.width,
      stats.footprint.depth,
      footprintPickHeight(stats.footprint.width, stats.footprint.depth),
    );
    object.add(pickVolume);
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
    const selectionRing = createSelectionRing(ringRadius, { name: "rts-structure-selection-ring" });
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
      groundY,
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
    this.version += 1;
    this.registerPickTargets(structure, progressFill);
    this.registerPickTargets(structure, pickVolume);
    this.pickVolumes.set(structure, pickVolume);
    return structure;
  }

  navigationBlockers(): readonly NavBlocker[] {
    return this.structures.map((structure) => structure.blocker);
  }

  /**
   * Blockers for unit pathfinding. Farms and lumber camps retain their full
   * footprint for placement/roads, but are intentionally pass-through ground so
   * workers cannot be boxed in between an economy site and a new building.
   */
  unitNavigationBlockers(): readonly NavBlocker[] {
    return this.structures
      .filter((structure) => !UNIT_PASS_THROUGH_STRUCTURE_IDS.has(structure.stats.id))
      .map((structure) => structure.blocker);
  }

  /**
   * Whether units may stand on this structure's footprint — the same rule
   * {@link unitNavigationBlockers} filters on, exposed because a farm being
   * walkable ground is also what lets its crew work *in* the field rather than
   * beside it. One set, so the two can never disagree.
   */
  static isUnitPassThrough(structure: PlacedStructure): boolean {
    return UNIT_PASS_THROUGH_STRUCTURE_IDS.has(structure.stats.id);
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
    for (const structure of this.structures) this.updateDamagePresentation(structure, deltaSeconds);
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
    for (let i = this.collapses.length - 1; i >= 0; i -= 1) {
      const collapse = this.collapses[i];
      if (!collapse) continue;
      collapse.elapsed = Math.min(COLLAPSE_DURATION, collapse.elapsed + Math.max(0, deltaSeconds));
      const progress = collapse.elapsed / COLLAPSE_DURATION;
      // A short unstable beat followed by a late, biased fall is generic enough
      // for every building tier. Keeping the root at ground level deliberately
      // avoids the former transparent, sinking-building failure mode.
      const shake = progress < 0.18
        ? Math.sin(progress * Math.PI * 12) * 0.035 * (1 - progress / 0.18)
        : 0;
      const fallProgress = Math.max(0, (progress - 0.14) / 0.86);
      const fall = fallProgress * fallProgress;
      collapse.object.rotation.z = collapse.originRotationZ + shake + collapse.fallDirection * 0.55 * fall;
      collapse.object.position.y = collapse.originY;
      // The shape gives way on the same curve as the fall, so the building is
      // already losing its silhouette while it goes over rather than deforming
      // as a separate beat afterwards.
      collapse.deformation?.setProgress(fall);
      if (progress >= 1) {
        this.collapses.splice(i, 1);
        this.ruins.push({
          object: collapse.object,
          structureId: collapse.structureId,
          deformation: collapse.deformation,
          ruinSeconds: collapse.ruinSeconds,
          elapsed: 0,
        });
        this.trimRuins();
      }
    }
    for (let i = this.ruins.length - 1; i >= 0; i -= 1) {
      const ruin = this.ruins[i];
      if (!ruin) continue;
      ruin.elapsed += Math.max(0, deltaSeconds);
      if (ruin.elapsed < ruin.ruinSeconds) continue;
      this.removeRuinAt(i);
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

  /** Opt-in bridge for smoke/debris or other game-owned damage presentation. */
  setDamagePresentationHandler(handler: StructureDamagePresentationHandler | null): void {
    this.damagePresentationHandler = handler;
  }

  /** Swap a completed box for an externally loaded building model. */
  setCompletedVisual(structure: PlacedStructure, visual: Object3D): void {
    this.clearDamagePresentation(structure);
    this.removeVisual(structure, "rts-complete-building-placeholder");
    this.removeVisual(structure, "rts-complete-building-model");
    this.removeVisual(structure, "rts-construction-building-model");
    this.dropAnimations.delete(structure);
    visual.name = "rts-complete-building-model";
    structure.object.add(visual);
    this.registerPickTargets(structure, visual);
    this.fitPickVolume(structure, visual);
  }

  /** Show the finished model as a translucent in-progress construction site. */
  setConstructionVisual(structure: PlacedStructure, visual: Object3D): void {
    this.clearDamagePresentation(structure);
    this.removeVisual(structure, "rts-construction-building-model");
    visual.name = "rts-construction-building-model";
    setObjectOpacity(visual, CONSTRUCTION_OPACITY);
    structure.object.add(visual);
    this.registerPickTargets(structure, visual);
    this.fitPickVolume(structure, visual);
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

  /** Remove one unbuilt site immediately, without the completed-building collapse visual. */
  cancel(structure: PlacedStructure): boolean {
    if (structure.construction.complete) return false;
    const index = this.structures.indexOf(structure);
    if (index < 0) return false;
    this.structures.splice(index, 1);
    this.version += 1;
    this.disposeStructure(structure);
    return true;
  }

  /** Remove a kingdom's newest unbuilt site for the legacy placement-mode cancel path. */
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
    const structure = this.structures[index];
    if (!structure) return null;
    return this.cancel(structure) ? structure : null;
  }

  /**
   * Remove a completed or unfinished structure; combat and player demolition use
   * this hook. The record leaves the simulation now — callers that rebuild
   * navigation and territory from `all()` are correct on the very next frame —
   * while the visual husk falls into a short-lived, non-blocking ruin over
   * {@link COLLAPSE_DURATION}.
   */
  destroy(structure: PlacedStructure): boolean {
    const index = this.structures.indexOf(structure);
    if (index < 0) return false;
    this.structures.splice(index, 1);
    this.version += 1;
    this.beginCollapse(structure);
    return true;
  }

  clear(): void {
    for (const structure of this.damagePresentations.keys()) this.clearDamagePresentation(structure);
    for (const structure of this.structures) this.disposeStructure(structure);
    this.structures.length = 0;
    this.version += 1;
    this.dropAnimations.clear();
    // A restart takes the husks with it: they belong to the finished match. Mid-
    // fall husks never became ruins, so they are announced here — otherwise the
    // smoke a worksite was venting would outlive the match that spawned it.
    for (const collapse of this.collapses) {
      this.root.remove(collapse.object);
      collapse.deformation?.dispose();
      disposeObjectMeshes(collapse.object);
      this.damagePresentationHandler?.onRuinCleared?.(collapse.structureId);
    }
    this.collapses.length = 0;
    for (let i = this.ruins.length - 1; i >= 0; i -= 1) this.removeRuinAt(i);
    this.damageStages.clear();
    this.lastHealth.clear();
  }

  /**
   * Hand a razed building's object over to the husk list. It stops being
   * pickable and selectable at once — a building the player can still click
   * after losing it is worse than one that disappears — but keeps its place in
   * the scene through the collapse and a brief, non-blocking ruin.
   */
  private beginCollapse(structure: PlacedStructure): void {
    this.clearDamagePresentation(structure);
    this.damageStages.delete(structure);
    this.lastHealth.delete(structure);
    this.damagePresentationHandler?.onCollapse?.(structure);
    this.unregisterPickTargets(structure.object);
    this.dropAnimations.delete(structure);
    this.pickVolumes.delete(structure);
    structure.selectionRing.visible = false;
    // Completed models share materials with every other building of their type,
    // so the husk needs its own opaque copies before it becomes an independent
    // ruin. No per-frame opacity mutation is used for the collapse.
    makeObjectMaterialsPrivate(structure.object);
    const inPlace = this.damagePresentationHandler?.collapsesInPlace?.(structure) ?? false;
    // Now that the copies are private, souring them is safe. A worksite that
    // never topples needs this: without it the husk would sit in its original
    // colours for the whole ruin window and read as an undamaged building.
    if (inPlace) charCollapsedMaterials(structure.object);
    // The model only — never `structure.object`, which also carries the pick
    // volume. That box is deliberately `visible` (three skips invisible objects
    // when raycasting), so deforming the whole structure would bend the
    // collision primitive along with the building.
    const visual = this.completedVisual(structure);
    this.collapses.push({
      object: structure.object,
      structureId: structure.id,
      originY: structure.object.position.y,
      originRotationZ: structure.object.rotation.z,
      // Stable per structure: repeated previews do not flip a building randomly.
      fallDirection: inPlace ? 0 : structure.id % 2 === 0 ? 1 : -1,
      // Applied after `makeObjectMaterialsPrivate` above: the patch mutates the
      // materials it is given, and the shared GLTF originals would carry this
      // husk's collapse onto every standing building of the same type.
      deformation: visual
        ? applyStructureDeformation(
            visual,
            // Authored per building; the code fallback keeps a catalog-less fork
            // rendering the same two shapes the collapse styles imply.
            this.damagePresentationHandler?.collapseDeformation?.(structure)
              ?? (inPlace ? IN_PLACE_DEFORMATION : TOPPLE_DEFORMATION),
            // Seeded like the fall direction, for the same reason: a building
            // buckles the same way every time it dies.
            structure.id,
          )
        : null,
      ruinSeconds: this.damagePresentationHandler?.ruinSeconds?.(structure) ?? DEFAULT_RUIN_SECONDS,
      elapsed: 0,
    });
  }

  private trimRuins(): void {
    while (this.ruins.length > MAX_RUINS) this.removeRuinAt(0);
  }

  private removeRuinAt(index: number): void {
    const ruin = this.ruins[index];
    if (!ruin) return;
    this.root.remove(ruin.object);
    ruin.deformation?.dispose();
    disposeObjectMeshes(ruin.object);
    this.ruins.splice(index, 1);
    this.damagePresentationHandler?.onRuinCleared?.(ruin.structureId);
  }

  private disposeStructure(structure: PlacedStructure): void {
    this.clearDamagePresentation(structure);
    this.damageStages.delete(structure);
    this.lastHealth.delete(structure);
    this.unregisterPickTargets(structure.object);
    this.root.remove(structure.object);
    this.dropAnimations.delete(structure);
    this.pickVolumes.delete(structure);
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
    this.fitPickVolume(structure, completed);
    this.completedVisualHandler?.(structure);
  }

  /** Applies the low-cost, data-independent part of the damage presentation. */
  private updateDamagePresentation(structure: PlacedStructure, deltaSeconds: number): void {
    this.reportImpact(structure);
    const stage = structure.construction.complete ? structureDamageStage(structure.health.ratio) : "normal";
    const previous = this.damageStages.get(structure) ?? "normal";
    if (stage !== previous) {
      this.damageStages.set(structure, stage);
      this.damagePresentationHandler?.onDamageStageChanged?.(structure, previous, stage);
    } else if (!this.damageStages.has(structure)) {
      this.damageStages.set(structure, stage);
    }
    if (!structure.construction.complete) {
      this.clearDamagePresentation(structure);
      return;
    }
    if (stage === "normal" || stage === "destroyed") {
      this.clearDamagePresentation(structure);
      return;
    }
    const visual = this.completedVisual(structure);
    if (!visual) return;
    let presentation = this.damagePresentations.get(structure);
    if (presentation?.visual !== visual) {
      this.clearDamagePresentation(structure);
      presentation = this.createDamagePresentation(visual, stage, structure.id, this.heavyTuning(structure));
      this.damagePresentations.set(structure, presentation);
    } else if (presentation.stage !== stage) {
      presentation.stage = stage;
      // The deformation is a patch over these exact material objects, so it has
      // to go before they are disposed and be rebuilt over the replacements.
      presentation.deformation?.dispose();
      presentation.deformation = null;
      for (const entry of presentation.materials) {
        disposeMaterials(entry.replacement);
        entry.replacement = createDamagedMaterials(entry.original, stage);
        entry.mesh.material = entry.replacement;
      }
      presentation.deformation = createDamageDeformation(visual, stage, structure.id, this.heavyTuning(structure));
    }
    presentation.elapsed += Math.max(0, deltaSeconds);
    const intensity = stage === "heavy" ? 1 : 0.28;
    // Imperceptible at rest, but enough irregularity that a critically damaged
    // building reads as unstable before it reaches zero health.
    visual.rotation.x = presentation.baseRotationX + Math.sin(presentation.elapsed * 10.7) * 0.006 * intensity;
    visual.rotation.z = presentation.baseRotationZ + Math.sin(presentation.elapsed * 7.3 + structure.id) * 0.011 * intensity;
  }

  /**
   * Announce a health drop as an impact, once per frame at most.
   *
   * A foundation is deliberately silent: it has no masonry to shed, and debris
   * coming off a half-built frame reads as a bug. The baseline is still tracked
   * while it builds, so the first blow after it completes is not misreported as
   * a fresh one.
   */
  private reportImpact(structure: PlacedStructure): void {
    const previous = this.lastHealth.get(structure);
    this.lastHealth.set(structure, structure.health.current);
    if (previous === undefined || structure.health.current >= previous) return;
    if (!structure.construction.complete) return;
    this.damagePresentationHandler?.onDamaged?.(structure, previous - structure.health.current);
  }

  private completedVisual(structure: PlacedStructure): Object3D | null {
    return structure.object.getObjectByName("rts-complete-building-model")
      ?? structure.object.getObjectByName("rts-complete-building-placeholder")
      ?? null;
  }

  /** Authored heavy-damage shape, or the code default for a catalog-less fork. */
  private heavyTuning(structure: PlacedStructure): StructureDeformationTuning {
    return this.damagePresentationHandler?.heavyDeformation?.(structure) ?? HEAVY_DAMAGE_DEFORMATION;
  }

  private createDamagePresentation(
    visual: Object3D,
    stage: Exclude<StructureDamageStage, "normal" | "destroyed">,
    seed: number,
    tuning: StructureDeformationTuning,
  ): DamagePresentation {
    const materials: DamageMaterialOverride[] = [];
    visual.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const original = child.material;
      const replacement = createDamagedMaterials(original, stage);
      child.material = replacement;
      materials.push({ mesh: child, original, replacement });
    });
    return {
      visual,
      materials,
      baseRotationX: visual.rotation.x,
      baseRotationZ: visual.rotation.z,
      stage,
      // After the swap above, so the patch lands on this structure's own copies
      // rather than on the shared GLTF materials every building of the type uses.
      deformation: createDamageDeformation(visual, stage, seed, tuning),
      elapsed: 0,
    };
  }

  private clearDamagePresentation(structure: PlacedStructure): void {
    const presentation = this.damagePresentations.get(structure);
    if (!presentation) return;
    // Before the materials go: the patch holds them, and a repaired building has
    // to come back straight. This is why the deformation is a uniform rather
    // than an edit to the vertex buffer — undoing it is dropping the clone.
    presentation.deformation?.dispose();
    presentation.deformation = null;
    for (const entry of presentation.materials) {
      entry.mesh.material = entry.original;
      disposeMaterials(entry.replacement);
    }
    presentation.visual.rotation.x = presentation.baseRotationX;
    presentation.visual.rotation.z = presentation.baseRotationZ;
    this.damagePresentations.delete(structure);
  }

  /**
   * Grow the click collision to the model that just arrived. The volume itself
   * is excluded from the measurement — it is a child of the same object, so
   * measuring the whole structure would feed the box its own bounds and let it
   * ratchet upward on every visual swap.
   */
  private fitPickVolume(structure: PlacedStructure, visual: Object3D): void {
    const volume = this.pickVolumes.get(structure);
    if (!volume) return;
    fitPickVolumeToVisual(volume, visual, structure.object.position.y);
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

/** Clone shared model materials once without changing their opaque render mode. */
function makeObjectMaterialsPrivate(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const clone = (material: import("three").Material): import("three").Material => {
      const copy = material.clone();
      copy.userData.rtsOwnedByStructure = true;
      return copy;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(clone)
      : clone(child.material);
  });
}

/**
 * Sour a husk's *already private* materials toward soot. Mutates in place rather
 * than cloning, which is only safe because {@link makeObjectMaterialsPrivate}
 * has just run — calling this on a live building would repaint every other
 * building sharing that GLTF material.
 */
function charCollapsedMaterials(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      const shaded = material as Material & { color?: Color; emissive?: Color; roughness?: number };
      shaded.color?.lerp(CHARRED_COLOR, 0.72);
      shaded.emissive?.multiplyScalar(0.15);
      if (typeof shaded.roughness === "number") shaded.roughness = Math.min(1, shaded.roughness + 0.25);
    }
  });
}

function createDamagedMaterials(
  source: Material | Material[],
  stage: Exclude<StructureDamageStage, "normal" | "destroyed">,
): Material | Material[] {
  const apply = (material: Material): Material => {
    const copy = material.clone();
    copy.userData.rtsOwnedByStructure = true;
    const colorMaterial = copy as Material & { color?: Color; emissive?: Color };
    if (colorMaterial.color) {
      // Colour is deliberately restrained: damage must be readable without
      // repainting the kingdom/age palette underneath the building model.
      colorMaterial.color.lerp(new Color("#302c29"), stage === "heavy" ? 0.5 : 0.23);
      colorMaterial.color.multiplyScalar(stage === "heavy" ? 0.82 : 0.92);
    }
    if (colorMaterial.emissive) colorMaterial.emissive.multiplyScalar(stage === "heavy" ? 0.45 : 0.75);
    return copy;
  };
  return Array.isArray(source) ? source.map(apply) : apply(source);
}

/**
 * Buckle a building that is nearly down, and only then.
 *
 * Light damage stays perfectly straight on purpose: the stage already reads
 * through colour, and a building that visibly bends the moment it is scratched
 * would make every skirmish look like a siege. The caller must have privatised
 * `visual`'s materials first — see {@link applyStructureDeformation}.
 */
function createDamageDeformation(
  visual: Object3D,
  stage: Exclude<StructureDamageStage, "normal" | "destroyed">,
  seed: number,
  tuning: StructureDeformationTuning,
): StructureDeformation | null {
  if (stage !== "heavy") return null;
  const deformation = applyStructureDeformation(visual, tuning, seed);
  // A held state, not an animation: the building stays bent until it is repaired
  // or it dies, so the progress is set once and never advanced.
  deformation?.setProgress(1);
  return deformation;
}

function disposeMaterials(materials: Material | Material[]): void {
  for (const material of Array.isArray(materials) ? materials : [materials]) material.dispose();
}

function isSharedModelMesh(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.rtsSharedModel === true) return true;
  }
  return false;
}

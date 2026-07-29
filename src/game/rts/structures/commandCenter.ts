/**
 * Command-centre placeholder — Vertical Slice Plan v0.2 Faz 1 match backbone.
 *
 * This is deliberately a visual/ownership shell. Health, targeting and match
 * results arrive in the following small plan steps rather than making the
 * placeholder responsible for the whole match loop.
 */
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";

import type { UnitOwner } from "../units/unit";
import { TEAM_COLOR, createTeamRing } from "../team/teamColors";
import { createSelectionRing } from "../selection/selectionRing";
import type {
  BuildingBalanceStats,
  EconomyProductionBalance,
  StartingResources,
} from "../../data/gameDataTypes";
import { HealthComponent } from "../units/health";
import type { UpgradableStructure } from "../progression/kingdomProgressionSystem";
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import { createPickVolume, fitPickVolumeToVisual } from "./pickVolume";

/** Temporary Faz 1 centre durability; building balance data arrives in Faz 2. */
export const COMMAND_CENTER_MAX_HEALTH = 300;
/** Initial buildable territory around a newly placed command centre. */
export const COMMAND_CENTER_CONTROL_RADIUS = 28;
const COMMAND_CENTER_FOOTPRINT = 7;
/** Top of the Faz 1 primitive tower; the pick volume's height until a model loads. */
const COMMAND_CENTER_PLACEHOLDER_HEIGHT = 7;
/**
 * The single child slot the centre's building model occupies. Whatever art is
 * current lives under this name, so replacing it is "remove the slot, add the
 * new one" rather than a guess at what the previous model was called.
 */
const COMMAND_CENTER_MODEL_SLOT = "rts-complete-building-model";


export class CommandCenter implements UpgradableStructure {
  readonly object = new Group();
  /**
   * The centre's own row in `balance/buildings.json`. Held so it can go through
   * the same {@link UpgradableStructure} level ladder as every other building
   * rather than carrying a hand-written level of its own.
   */
  readonly stats: BuildingBalanceStats;
  /** Ground elevation sampled when the match's starting foundation is mounted. */
  groundY: number;
  /**
   * A centre is spawned, not built, so it is complete from its first frame —
   * but the upgrade system asks every candidate this, so it answers.
   */
  readonly construction = { complete: true } as const;
  /** Shared bounded-health contract used by units and structures. */
  readonly health: HealthComponent;
  /**
   * Faz 9 §51 selection ring. Held on the centre rather than inside its swappable
   * visual: {@link setVisual} replaces the placeholder with a loaded model, and a
   * ring living in there would be disposed with it.
   */
  private readonly selectionRing: Mesh;
  /**
   * The centre's click collision, held here for the same reason as the ring:
   * {@link setVisual} disposes whatever visual it replaces, and a pick box
   * living inside one would leave the centre unselectable after a re-skin.
   */
  private readonly pickVolume: Mesh;
  /** Global tier level (1..3), owned by `KingdomProgressionSystem` like every building. */
  level = 1;
  controlRadius = COMMAND_CENTER_CONTROL_RADIUS;
  workerTrainingSeconds: number | null = null;
  /** Worker queue size supplied by the active age × level tier. */
  queueCapacity: number | null = null;
  // The centre has no housing, economy, market or defense data, but the tier
  // applier writes every field it knows about, so they exist and stay null.
  populationCapacityBonus = 0;
  economy: EconomyProductionBalance | null = null;
  defenseAttackDamage: number | null = null;
  marketCommission: number | null = null;
  storageCapacity: StartingResources | null = null;
  territoryConnectedControlRadius: number | null = null;

  /**
   * The centre's control radius under the {@link UpgradableStructure} name.
   *
   * A null write is ignored on purpose: the radius is an *age* benefit applied
   * by {@link applyTownUpgrade}, and the centre's tiers carry no `territory`
   * block, so letting the tier applier's "no territory data" null through would
   * erase a radius the age had already granted.
   */
  get territoryControlRadius(): number | null {
    return this.controlRadius;
  }

  set territoryControlRadius(value: number | null) {
    if (value !== null) this.controlRadius = value;
  }
  /** Lets melee units strike the outer footprint without entering its nav blocker. */
  readonly combatRadius = COMMAND_CENTER_FOOTPRINT / 2;
  /** {@link CombatTarget}: the centre is a building, so siege is the answer to it. */
  readonly armorClass = "structure" as const;

  constructor(
    readonly owner: UnitOwner,
    x: number,
    z: number,
    maxHealth = COMMAND_CENTER_MAX_HEALTH,
    stats: BuildingBalanceStats | null = null,
    groundY = 0,
  ) {
    this.object.name = `rts-command-center-${owner}`;
    this.groundY = groundY;
    this.object.position.set(x, groundY, z);
    this.health = new HealthComponent(maxHealth);
    this.stats = stats ?? placeholderCenterStats(maxHealth);
    const placeholder = new Group();
    placeholder.name = "rts-command-center-placeholder";

    const teamColor = new Color(TEAM_COLOR[owner]);
    const base = new Mesh(
      new BoxGeometry(7, 0.8, 7),
      new MeshStandardMaterial({ color: "#6d6250", roughness: 0.9 }),
    );
    base.position.y = 0.4;
    base.receiveShadow = true;
    base.castShadow = true;
    base.name = "rts-command-center-base";
    placeholder.add(base);

    const tower = new Mesh(
      new CylinderGeometry(2.1, 2.5, 4.4, 8),
      new MeshStandardMaterial({ color: teamColor, roughness: 0.65 }),
    );
    tower.position.y = 3;
    tower.castShadow = true;
    tower.receiveShadow = true;
    tower.name = "rts-command-center-tower";
    placeholder.add(tower);

    const roof = new Mesh(
      new ConeGeometry(2.8, 1.8, 8),
      new MeshStandardMaterial({ color: "#30333a", roughness: 0.75 }),
    );
    roof.position.y = 6.1;
    roof.castShadow = true;
    roof.name = "rts-command-center-roof";
    placeholder.add(roof);
    this.object.add(placeholder);

    const ringRadius = COMMAND_CENTER_FOOTPRINT / 2 + 0.35;
    this.selectionRing = createSelectionRing(ringRadius, {
      name: "rts-command-center-selection-ring",
    });
    this.object.add(this.selectionRing);
    // Added to `object`, not to the placeholder: `setVisual` disposes the
    // placeholder when the loaded model arrives, and a ring inside it would go
    // with it — the same reason the selection ring lives out here.
    this.object.add(createTeamRing(owner, ringRadius - 0.35));
    // Footprint-wide click collision, so clicking the middle of a gate or an
    // open courtyard selects the centre instead of falling through to ground.
    this.pickVolume = createPickVolume(
      COMMAND_CENTER_FOOTPRINT,
      COMMAND_CENTER_FOOTPRINT,
      COMMAND_CENTER_PLACEHOLDER_HEIGHT,
    );
    this.object.add(this.pickVolume);
  }

  get position() {
    return this.object.position;
  }

  /** The centre's counterpart of `Unit.setSelected` (plan §51). */
  setSelected(selected: boolean): void {
    this.selectionRing.visible = selected;
  }

  /**
   * Replace the Faz 1 primitive tower with an RTS building asset.
   *
   * The incoming visual is *renamed* to the slot it occupies, exactly as
   * `PlacedStructureSystem.setCompletedVisual` does, and the previous occupant is
   * found by that slot name. Matching on the visual's own name instead would miss
   * anything the caller happened to name differently — which is how a re-skin
   * (the pack finishing its load, a level-up, an age change) could leave the old
   * model standing inside the new one.
   */
  setVisual(visual: Object3D): void {
    const placeholder = this.object.getObjectByName("rts-command-center-placeholder");
    if (placeholder) {
      this.object.remove(placeholder);
      disposeObjectMeshes(placeholder);
    }
    const existing = this.object.getObjectByName(COMMAND_CENTER_MODEL_SLOT);
    if (existing) {
      this.object.remove(existing);
      // Shared Actor/glTF templates are skipped inside; only per-centre geometry
      // is actually released.
      disposeObjectMeshes(existing);
    }
    visual.name = COMMAND_CENTER_MODEL_SLOT;
    this.object.add(visual);
    fitPickVolumeToVisual(this.pickVolume, visual, this.object.position.y);
  }

  /** Static footprint used by Phase 2 placement validation and infantry nav. */
  navigationBlocker(): NavBlocker {
    const half = COMMAND_CENTER_FOOTPRINT / 2;
    return {
      min: [this.position.x - half, 0, this.position.z - half],
      max: [this.position.x + half, 6.5, this.position.z + half],
    };
  }

  /** Release the centre's placeholder mesh resources on a full match reset. */
  dispose(): void {
    disposeObjectMeshes(this.object);
    this.object.clear();
  }
}

/**
 * Stand-in row for callers that spawn a centre without the balance table (the
 * engine tests). It carries no `levels`/`progression`, so such a centre simply
 * has no upgrade path rather than inventing one.
 */
function placeholderCenterStats(maxHealth: number): BuildingBalanceStats {
  return {
    id: "command_center",
    label: "Merkez",
    footprint: { width: COMMAND_CENTER_FOOTPRINT, depth: COMMAND_CENTER_FOOTPRINT },
    cost: {},
    constructionSeconds: 0,
    maxHealth,
    visionRadius: 0,
  };
}

function disposeObjectMeshes(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh) || isSharedModelMesh(child)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

function isSharedModelMesh(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.rtsSharedModel === true) return true;
  }
  return false;
}

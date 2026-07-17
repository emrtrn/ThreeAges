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
  RingGeometry,
  type Object3D,
} from "three";

import type { UnitOwner } from "../units/unit";
import type { TownAgeBalance } from "../../data/gameDataTypes";
import { HealthComponent } from "../units/health";
import type { NavBlocker } from "@engine/navigation/gridNavigation";

/** Temporary Faz 1 centre durability; building balance data arrives in Faz 2. */
export const COMMAND_CENTER_MAX_HEALTH = 300;
/** Initial buildable territory around a newly placed command centre. */
export const COMMAND_CENTER_CONTROL_RADIUS = 28;
const COMMAND_CENTER_FOOTPRINT = 7;

const CENTER_TEAM_COLOR: Record<UnitOwner, string> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
};

export class CommandCenter {
  readonly object = new Group();
  /** Shared bounded-health contract used by units and structures. */
  readonly health: HealthComponent;
  /**
   * Faz 9 §51 selection ring. Held on the centre rather than inside its swappable
   * visual: {@link setVisual} replaces the placeholder with a loaded model, and a
   * ring living in there would be disposed with it.
   */
  private readonly selectionRing: Mesh;
  level = 1;
  controlRadius = COMMAND_CENTER_CONTROL_RADIUS;
  workerTrainingSeconds: number | null = null;
  /** Lets melee units strike the outer footprint without entering its nav blocker. */
  readonly combatRadius = COMMAND_CENTER_FOOTPRINT / 2;
  /** {@link CombatTarget}: the centre is a building, so siege is the answer to it. */
  readonly armorClass = "structure" as const;

  constructor(
    readonly owner: UnitOwner,
    x: number,
    z: number,
    maxHealth = COMMAND_CENTER_MAX_HEALTH,
  ) {
    this.object.name = `rts-command-center-${owner}`;
    this.object.position.set(x, 0, z);
    this.health = new HealthComponent(maxHealth);
    const placeholder = new Group();
    placeholder.name = "rts-command-center-placeholder";

    const teamColor = new Color(CENTER_TEAM_COLOR[owner]);
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
    this.selectionRing = new Mesh(
      new RingGeometry(ringRadius, ringRadius + 0.3, 32),
      new MeshStandardMaterial({
        color: new Color("#f2f27a"),
        emissive: new Color("#8f8f20"),
        roughness: 0.5,
      }),
    );
    this.selectionRing.name = "rts-command-center-selection-ring";
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.05;
    this.selectionRing.visible = false;
    this.object.add(this.selectionRing);
  }

  get position() {
    return this.object.position;
  }

  /** The centre's counterpart of `Unit.setSelected` (plan §51). */
  setSelected(selected: boolean): void {
    this.selectionRing.visible = selected;
  }

  /** Apply the data-owned Town benefit after a completed Settlement upgrade. */
  applyTownUpgrade(upgrade: TownAgeBalance["commandCenter"]): void {
    this.level = 2;
    this.health.upgradeMax(upgrade.maxHealth);
    this.controlRadius = upgrade.controlRadius;
    this.workerTrainingSeconds = upgrade.workerTrainingSeconds;
  }

  /** Replace the Faz 1 primitive tower with an RTS building asset. */
  setVisual(visual: Object3D): void {
    const placeholder = this.object.getObjectByName("rts-command-center-placeholder");
    if (placeholder) {
      this.object.remove(placeholder);
      disposeObjectMeshes(placeholder);
    }
    const existing = this.object.getObjectByName("rts-complete-building-model");
    if (existing) this.object.remove(existing);
    this.object.add(visual);
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

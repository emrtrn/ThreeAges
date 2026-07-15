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
} from "three";

import type { UnitOwner } from "../units/unit";
import { HealthComponent } from "../units/health";

/** Temporary Faz 1 centre durability; building balance data arrives in Faz 2. */
export const COMMAND_CENTER_MAX_HEALTH = 300;

const CENTER_TEAM_COLOR: Record<UnitOwner, string> = {
  player: "#2d7fd6",
  enemy: "#c0392b",
};

export class CommandCenter {
  readonly object = new Group();
  /** Shared bounded-health contract used by units and structures. */
  readonly health: HealthComponent;

  constructor(
    readonly owner: UnitOwner,
    x: number,
    z: number,
    maxHealth = COMMAND_CENTER_MAX_HEALTH,
  ) {
    this.object.name = `rts-command-center-${owner}`;
    this.object.position.set(x, 0, z);
    this.health = new HealthComponent(maxHealth);

    const teamColor = new Color(CENTER_TEAM_COLOR[owner]);
    const base = new Mesh(
      new BoxGeometry(7, 0.8, 7),
      new MeshStandardMaterial({ color: "#6d6250", roughness: 0.9 }),
    );
    base.position.y = 0.4;
    base.receiveShadow = true;
    base.castShadow = true;
    base.name = "rts-command-center-base";
    this.object.add(base);

    const tower = new Mesh(
      new CylinderGeometry(2.1, 2.5, 4.4, 8),
      new MeshStandardMaterial({ color: teamColor, roughness: 0.65 }),
    );
    tower.position.y = 3;
    tower.castShadow = true;
    tower.receiveShadow = true;
    tower.name = "rts-command-center-tower";
    this.object.add(tower);

    const roof = new Mesh(
      new ConeGeometry(2.8, 1.8, 8),
      new MeshStandardMaterial({ color: "#30333a", roughness: 0.75 }),
    );
    roof.position.y = 6.1;
    roof.castShadow = true;
    roof.name = "rts-command-center-roof";
    this.object.add(roof);
  }

  get position() {
    return this.object.position;
  }

  /** Release the centre's placeholder mesh resources on a full match reset. */
  dispose(): void {
    this.object.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
    this.object.clear();
  }
}

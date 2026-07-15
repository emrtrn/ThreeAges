/** Registry for the two Faz 1 command-centre placeholders. */
import { Group } from "three";

import type { UnitOwner } from "../units/unit";
import { CommandCenter } from "./commandCenter";

export class CommandCenterSystem {
  readonly root = new Group();
  private readonly centers = new Map<UnitOwner, CommandCenter>();

  constructor() {
    this.root.name = "rts-command-centers";
  }

  spawn(owner: UnitOwner, x: number, z: number, maxHealth?: number): CommandCenter {
    if (this.centers.has(owner)) {
      throw new Error(`Command center already exists for ${owner}`);
    }
    const center = new CommandCenter(owner, x, z, maxHealth);
    this.centers.set(owner, center);
    this.root.add(center.object);
    return center;
  }

  get(owner: UnitOwner): CommandCenter | null {
    return this.centers.get(owner) ?? null;
  }

  /** Every direct structure mesh accepted by contextual target raycasts. */
  targetMeshes(): import("three").Object3D[] {
    return this.all().flatMap((center) => center.object.children);
  }

  /** Resolve a raycast hit back to its centre. */
  centerForObject(object: import("three").Object3D): CommandCenter | null {
    return this.all().find((center) => center.object.children.includes(object)) ?? null;
  }

  /** Remove the current match's centres so fresh ones can be spawned. */
  clear(): void {
    for (const center of this.centers.values()) {
      this.root.remove(center.object);
      center.dispose();
    }
    this.centers.clear();
  }

  all(): readonly CommandCenter[] {
    return [...this.centers.values()];
  }
}

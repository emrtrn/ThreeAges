/** Registry for the two Faz 1 command-centre placeholders. */
import { Group } from "three";
import type { NavBlocker } from "@engine/navigation/gridNavigation";

import type { UnitOwner } from "../units/unit";
import type { BuildingBalanceStats } from "../../data/gameDataTypes";
import { CommandCenter } from "./commandCenter";

export class CommandCenterSystem {
  readonly root = new Group();
  private readonly centers = new Map<UnitOwner, CommandCenter>();

  constructor() {
    this.root.name = "rts-command-centers";
  }

  spawn(
    owner: UnitOwner,
    x: number,
    z: number,
    maxHealth?: number,
    stats: BuildingBalanceStats | null = null,
  ): CommandCenter {
    if (this.centers.has(owner)) {
      throw new Error(`Command center already exists for ${owner}`);
    }
    const center = new CommandCenter(owner, x, z, maxHealth, stats);
    this.centers.set(owner, center);
    this.root.add(center.object);
    return center;
  }

  get(owner: UnitOwner): CommandCenter | null {
    return this.centers.get(owner) ?? null;
  }

  /** Every direct structure mesh accepted by contextual target raycasts. */
  targetMeshes(): import("three").Object3D[] {
    return this.all().map((center) => center.object);
  }

  /** Resolve a raycast hit back to its centre. */
  centerForObject(object: import("three").Object3D): CommandCenter | null {
    return this.all().find((center) => isChildOf(object, center.object)) ?? null;
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

  /** Existing centres occupy both placement and ground-navigation space. */
  navigationBlockers(): readonly NavBlocker[] {
    return this.all().map((center) => center.navigationBlocker());
  }
}

function isChildOf(object: import("three").Object3D, parent: import("three").Object3D): boolean {
  for (let current: import("three").Object3D | null = object; current; current = current.parent) {
    if (current === parent) return true;
  }
  return false;
}

/**
 * RTS unit registry — Vertical Slice Plan v0.2 §21.
 *
 * Owns every live unit and the scene group they render into. Faz 1 systems
 * (selection now; movement, combat, match state next) query units through here
 * rather than reaching into the scene graph, keeping the registry the single
 * source of truth for "who is on the field".
 */
import { Group, type Object3D } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import { Unit, type UnitOwner, type UnitRole } from "./unit";

export class UnitSystem {
  /** Scene subtree holding all unit render objects. */
  readonly root = new Group();
  private readonly units: Unit[] = [];
  /** Body-mesh id → unit, for resolving raycast hits. */
  private readonly byBodyId = new Map<number, Unit>();

  constructor() {
    this.root.name = "rts-units";
  }

  spawn(
    owner: UnitOwner,
    x: number,
    z: number,
    stats: UnitBalanceStats,
    role: UnitRole = "guard",
  ): Unit {
    const unit = new Unit(owner, x, z, stats, role);
    this.units.push(unit);
    // The capsule body is the first child; index it for raycast resolution.
    const body = unit.object.children[0];
    if (body) this.byBodyId.set(body.id, unit);
    this.root.add(unit.object);
    return unit;
  }

  all(): readonly Unit[] {
    return this.units;
  }

  /** Live units of one kingdom. Faz 5 AI queries this exactly as the player does. */
  unitsOf(owner: UnitOwner): Unit[] {
    return this.units.filter((unit) => unit.owner === owner && !unit.health.depleted);
  }

  workersOf(owner: UnitOwner): Unit[] {
    return this.unitsOf(owner).filter((unit) => unit.role === "worker");
  }

  /** Clear every attack order aimed at a unit that can no longer be targeted. */
  clearAttackTargets(target: CombatTarget): void {
    for (const unit of this.units) {
      if (unit.attackTarget === target) unit.setAttackTarget(null);
    }
  }

  /** Remove a defeated unit from queries, raycasts and the rendered scene. */
  despawn(unit: Unit): boolean {
    const index = this.units.indexOf(unit);
    if (index < 0) return false;
    this.clearAttackTargets(unit);
    unit.stop();
    const body = unit.object.children[0];
    if (body) this.byBodyId.delete(body.id);
    this.units.splice(index, 1);
    this.root.remove(unit.object);
    unit.dispose();
    return true;
  }

  /** Remove all live units and release their placeholder render resources. */
  clear(): void {
    for (const unit of [...this.units]) this.despawn(unit);
  }

  /** Resolve a raycast-hit object (body mesh) back to its owning unit, if any. */
  unitForObject(object: Object3D): Unit | null {
    return this.byBodyId.get(object.id) ?? null;
  }

  /** Every body mesh, for raycasting against units. */
  bodyMeshes(): Object3D[] {
    return this.units
      .filter((unit) => !unit.health.depleted)
      .map((unit) => unit.object.children[0])
      .filter((o): o is Object3D => !!o);
  }
}

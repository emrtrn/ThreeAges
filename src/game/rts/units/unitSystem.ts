/**
 * RTS unit registry — Vertical Slice Plan v0.2 §21.
 *
 * Owns every live unit and the scene group they render into. Faz 1 systems
 * (selection now; movement, combat, match state next) query units through here
 * rather than reaching into the scene graph, keeping the registry the single
 * source of truth for "who is on the field".
 */
import { Group, type Object3D } from "three";

import { Unit, type UnitOwner } from "./unit";

export class UnitSystem {
  /** Scene subtree holding all unit render objects. */
  readonly root = new Group();
  private readonly units: Unit[] = [];
  /** Body-mesh id → unit, for resolving raycast hits. */
  private readonly byBodyId = new Map<number, Unit>();

  constructor() {
    this.root.name = "rts-units";
  }

  spawn(owner: UnitOwner, x: number, z: number): Unit {
    const unit = new Unit(owner, x, z);
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

  playerUnits(): Unit[] {
    return this.units.filter((unit) => unit.owner === "player");
  }

  /** Resolve a raycast-hit object (body mesh) back to its owning unit, if any. */
  unitForObject(object: Object3D): Unit | null {
    return this.byBodyId.get(object.id) ?? null;
  }

  /** Every body mesh, for raycasting against units. */
  bodyMeshes(): Object3D[] {
    return this.units.map((unit) => unit.object.children[0]).filter((o): o is Object3D => !!o);
  }
}

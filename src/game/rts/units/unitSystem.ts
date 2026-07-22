/**
 * RTS unit registry — Vertical Slice Plan v0.2 §21.
 *
 * Owns every live unit and the scene group they render into. Faz 1 systems
 * (selection now; movement, combat, match state next) query units through here
 * rather than reaching into the scene graph, keeping the registry the single
 * source of truth for "who is on the field".
 */
import { Group, type Object3D } from "three";

import type { Quaternion } from "three";

import type { UnitBalanceStats } from "../../data/gameDataTypes";
import type { CombatTarget } from "../combat/combatTarget";
import { Unit, type RtsPresentationHandle, type UnitOwner } from "./unit";

export class UnitSystem {
  /** Scene subtree holding all unit render objects. */
  readonly root = new Group();
  private readonly units: Unit[] = [];
  /** Presentation pick mesh id → unit, for resolving raycast hits. */
  private readonly byPickObjectId = new Map<number, Unit>();
  private presentationFactory: ((owner: UnitOwner, stats: UnitBalanceStats) => RtsPresentationHandle | null) | null = null;

  constructor() {
    this.root.name = "rts-units";
  }

  /** Role, speed and counters all ride on `stats` now — there is no role argument. */
  spawn(owner: UnitOwner, x: number, z: number, stats: UnitBalanceStats): Unit {
    const unit = new Unit(owner, x, z, stats, this.presentationFactory?.(owner, stats) ?? null);
    this.units.push(unit);
    this.registerPickTargets(unit);
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

  /** One kingdom's live combat units, for HUD group summaries and AI power. */
  armyOf(owner: UnitOwner): Unit[] {
    return this.unitsOf(owner).filter((unit) => unit.role !== "worker");
  }

  /** Refresh every health bar and billboard it toward the shared RTS camera. */
  updatePresentation(cameraQuaternion: Quaternion): void {
    for (const unit of this.units) unit.updatePresentation(cameraQuaternion);
  }

  setPresentationFactory(factory: ((owner: UnitOwner, stats: UnitBalanceStats) => RtsPresentationHandle | null) | null): void {
    this.presentationFactory = factory;
  }

  /** Refresh only units with a catalog-backed handle; a null result keeps the playable fallback. */
  refreshPresentations(): void {
    if (!this.presentationFactory) return;
    for (const unit of this.units) {
      const presentation = this.presentationFactory(unit.owner, unit.stats);
      if (!presentation) continue;
      this.unregisterPickTargets(unit);
      unit.replacePresentation(presentation);
      this.registerPickTargets(unit);
    }
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
    this.unregisterPickTargets(unit);
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
    for (let current: Object3D | null = object; current; current = current.parent) {
      const unit = this.byPickObjectId.get(current.id);
      if (unit) return unit;
    }
    return null;
  }

  /**
   * Every body mesh, for raycasting against units.
   *
   * Fogged units are excluded (§59). Three's raycaster tests an explicitly
   * listed object even when `visible` is false, so hiding a unit's render object
   * is not on its own enough to make it unclickable — without this filter a
   * player could still box-select or right-click-attack a unit they cannot see,
   * which is the omniscience the fog exists to remove. Both call sites
   * (`selectionSystem`, `commandSystem`) come through here, so this is the one
   * place it has to hold.
   */
  bodyMeshes(): Object3D[] {
    return this.units
      .filter((unit) => !unit.health.depleted && unit.object.visible)
      .flatMap((unit) => unit.presentationPickTargets());
  }

  private registerPickTargets(unit: Unit): void {
    for (const object of unit.presentationPickTargets()) this.byPickObjectId.set(object.id, unit);
  }

  private unregisterPickTargets(unit: Unit): void {
    for (const object of unit.presentationPickTargets()) this.byPickObjectId.delete(object.id);
  }
}

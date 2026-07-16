/** Data-owned T1 -> T2 building upgrades; Town is the sole current prerequisite. */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";
import type { ResourceReservation } from "../economy/resourceWallet";

export type StructureUpgradeResult = "started" | "no-eligible-structure" | "already-upgrading" | "not-town" | "insufficient-resources";
export interface StructureUpgradeEvent { readonly structure: PlacedStructure; readonly type: "completed" | "cancelled"; }
export interface StructureUpgradeSnapshot {
  readonly completed: boolean;
  readonly upgrading: boolean;
  readonly remainingSeconds: number;
}
interface UpgradeState {
  readonly owner: UnitOwner;
  readonly buildingId: string;
  readonly structures: readonly PlacedStructure[];
  readonly reservation: ResourceReservation;
  remainingSeconds: number;
}

export class StructureUpgradeSystem {
  private readonly upgrades = new Map<string, UpgradeState>();
  private readonly completedUpgrades = new Set<string>();
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly isTown: (owner: UnitOwner) => boolean,
  ) {}

  isUpgrading(structure: PlacedStructure): boolean {
    return this.upgrades.has(this.keyFor(structure.owner, structure.stats.id));
  }

  snapshot(owner: UnitOwner, buildingId: string): StructureUpgradeSnapshot {
    const upgrade = this.upgrades.get(this.keyFor(owner, buildingId));
    return {
      completed: this.completedUpgrades.has(this.keyFor(owner, buildingId)),
      upgrading: upgrade !== undefined,
      remainingSeconds: upgrade?.remainingSeconds ?? 0,
    };
  }

  start(owner: UnitOwner, buildingId: string): StructureUpgradeResult {
    if (!this.isTown(owner)) return "not-town";
    const key = this.keyFor(owner, buildingId);
    if (this.completedUpgrades.has(key)) return "no-eligible-structure";
    if (this.upgrades.has(key)) return "already-upgrading";
    const structures = this.structures.ownedBy(owner)
      .filter((item) => item.stats.id === buildingId && item.construction.complete && item.level === 1 && item.stats.upgrade);
    const structure = structures[0];
    if (!structure) return "no-eligible-structure";
    const statsUpgrade = structure.stats.upgrade;
    if (!statsUpgrade) return "no-eligible-structure";
    const reservation = this.kingdoms.get(owner).wallet.reserve(statsUpgrade.cost);
    if (!reservation) return "insufficient-resources";
    this.upgrades.set(key, {
      owner,
      buildingId,
      structures,
      reservation,
      remainingSeconds: statsUpgrade.durationSeconds,
    });
    return "started";
  }

  update(deltaSeconds: number): StructureUpgradeEvent[] {
    const events: StructureUpgradeEvent[] = [];
    for (const [key, upgrade] of this.upgrades) {
      const remainingStructures = upgrade.structures
        .filter((structure) => this.structures.all().includes(structure) && structure.construction.complete);
      if (remainingStructures.length === 0) {
        this.kingdoms.get(upgrade.owner).wallet.refund(upgrade.reservation);
        this.upgrades.delete(key);
        events.push({ structure: upgrade.structures[0]!, type: "cancelled" });
        continue;
      }
      upgrade.remainingSeconds = Math.max(0, upgrade.remainingSeconds - Math.max(0, deltaSeconds));
      if (upgrade.remainingSeconds > 0) continue;
      this.kingdoms.get(upgrade.owner).wallet.commit(upgrade.reservation);
      this.completedUpgrades.add(key);
      this.upgrades.delete(key);
      for (const structure of this.structures.ownedBy(upgrade.owner)) {
        if (structure.stats.id !== upgrade.buildingId || !structure.construction.complete) continue;
        if (this.applyCompletedUpgrade(structure)) events.push({ structure, type: "completed" });
      }
    }
    return events;
  }

  /** Finished type upgrades also promote buildings completed after the research. */
  applyCompletedUpgrade(structure: PlacedStructure): boolean {
    if (!structure.construction.complete || structure.level >= 2 || !structure.stats.upgrade) return false;
    if (!this.completedUpgrades.has(this.keyFor(structure.owner, structure.stats.id))) return false;
    this.promote(structure);
    return true;
  }

  reset(): void {
    for (const upgrade of this.upgrades.values()) this.kingdoms.get(upgrade.owner).wallet.refund(upgrade.reservation);
    this.upgrades.clear();
    this.completedUpgrades.clear();
  }

  private promote(structure: PlacedStructure): void {
    const upgrade = structure.stats.upgrade!;
    structure.level = 2;
    structure.health.upgradeMax(upgrade.maxHealth);
    if (structure.stats.id === "house") structure.populationCapacityBonus = 3;
    if (upgrade.territory) {
      structure.territoryControlRadius = upgrade.territory.controlRadius;
      structure.territoryConnectedControlRadius = upgrade.territory.connectedControlRadius;
    }
  }

  private keyFor(owner: UnitOwner, buildingId: string): string {
    return `${owner}:${buildingId}`;
  }
}

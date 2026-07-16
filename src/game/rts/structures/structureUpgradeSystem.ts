/** Data-owned T1 -> T2 building upgrades; Town is the sole current prerequisite. */
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { UnitOwner } from "../units/unit";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";
import type { ResourceReservation } from "../economy/resourceWallet";

export type StructureUpgradeResult = "started" | "no-eligible-structure" | "already-upgrading" | "not-town" | "insufficient-resources";
export interface StructureUpgradeEvent { readonly structure: PlacedStructure; readonly type: "completed" | "cancelled"; }
interface UpgradeState { readonly structure: PlacedStructure; readonly reservation: ResourceReservation; remainingSeconds: number; }

export class StructureUpgradeSystem {
  private readonly upgrades = new Map<number, UpgradeState>();
  constructor(
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly isTown: (owner: UnitOwner) => boolean,
  ) {}

  isUpgrading(structure: PlacedStructure): boolean { return this.upgrades.has(structure.id); }

  start(owner: UnitOwner, buildingId: string): StructureUpgradeResult {
    if (!this.isTown(owner)) return "not-town";
    const structure = this.structures.ownedBy(owner).find((item) => item.stats.id === buildingId && item.construction.complete && item.level === 1 && item.stats.upgrade);
    if (!structure) return "no-eligible-structure";
    if (this.upgrades.has(structure.id)) return "already-upgrading";
    const reservation = this.kingdoms.get(owner).wallet.reserve(structure.stats.upgrade!.cost);
    if (!reservation) return "insufficient-resources";
    this.upgrades.set(structure.id, { structure, reservation, remainingSeconds: structure.stats.upgrade!.durationSeconds });
    return "started";
  }

  update(deltaSeconds: number): StructureUpgradeEvent[] {
    const events: StructureUpgradeEvent[] = [];
    for (const [id, upgrade] of this.upgrades) {
      if (!this.structures.all().includes(upgrade.structure) || !upgrade.structure.construction.complete) {
        this.kingdoms.get(upgrade.structure.owner).wallet.refund(upgrade.reservation);
        this.upgrades.delete(id); events.push({ structure: upgrade.structure, type: "cancelled" }); continue;
      }
      upgrade.remainingSeconds = Math.max(0, upgrade.remainingSeconds - Math.max(0, deltaSeconds));
      if (upgrade.remainingSeconds > 0) continue;
      this.kingdoms.get(upgrade.structure.owner).wallet.commit(upgrade.reservation);
      upgrade.structure.level = 2;
      upgrade.structure.health.upgradeMax(upgrade.structure.stats.upgrade!.maxHealth);
      if (upgrade.structure.stats.id === "house") {
        upgrade.structure.populationCapacityBonus = 3;
      }
      this.upgrades.delete(id); events.push({ structure: upgrade.structure, type: "completed" });
    }
    return events;
  }

  reset(): void {
    for (const upgrade of this.upgrades.values()) this.kingdoms.get(upgrade.structure.owner).wallet.refund(upgrade.reservation);
    this.upgrades.clear();
  }
}

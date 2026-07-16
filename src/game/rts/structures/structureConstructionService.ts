/**
 * Headless, owner-aware building construction — Vertical Slice Plan v0.2 §38
 * (Faz 5.0).
 *
 * Faz 2 put validate → pay → place inside {@link BuildingPlacementSystem}, which
 * is driven by a pointer ray and a ghost mesh. The Faz 5 AI has neither, and
 * `07_ENEMY_AI_DESIGN_v0.2.md` §4 requires it to build through the *same* rules
 * the player does rather than a parallel shortcut path.
 *
 * So the rule half lives here as a pure world-space call, and the pointer/ghost
 * system above it keeps only the input and preview concerns.
 */
import type { NavBlocker } from "@engine/navigation/gridNavigation";
import type { BuildingBalance } from "../../data/gameDataTypes";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { RtsNavigation } from "../navigation/rtsNavigation";
import type { TerritoryControlSystem } from "../territory/territoryControlSystem";
import type { UnitOwner } from "../units/unit";
import { type PlacementResult, validateBuildingPlacement } from "./placementGrid";
import type { PlacedStructure, PlacedStructureSystem } from "./placedStructureSystem";

export type StructureBuildFailure =
  | "unknown-building"
  | "outside-map"
  | "outside-control"
  | "blocked"
  | "insufficient-resources";

export type StructureBuildResult =
  | { readonly built: true; readonly structure: PlacedStructure; readonly result: PlacementResult }
  | { readonly built: false; readonly reason: StructureBuildFailure; readonly result: PlacementResult | null };

export class StructureConstructionService {
  private readonly reservations = new Map<number, ResourceReservation>();

  constructor(
    private readonly buildings: BuildingBalance,
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
    private readonly navigation: RtsNavigation,
    private readonly occupiedBlockers: () => readonly NavBlocker[],
    private readonly territory: TerritoryControlSystem,
    private readonly onStructurePlaced: (structure: PlacedStructure) => void,
    private readonly onStructureCancelled: (structure: PlacedStructure) => void,
  ) {}

  /**
   * Validate a world-space proposal without spending anything. The AI scores
   * candidate anchors with this; the ghost preview renders from it.
   */
  validate(owner: UnitOwner, buildingId: string, x: number, z: number): PlacementResult | null {
    const stats = this.buildings[buildingId];
    if (!stats || buildingId === "command_center") return null;
    return validateBuildingPlacement(stats, x, z, this.occupiedBlockers(), {
      owner,
      ownsFootprint: this.territory.ownsFootprint.bind(this.territory),
      canPlaceExpansion: this.territory.canPlaceExpansion.bind(this.territory),
    });
  }

  /** Validate, reserve the owner's resources, and create the construction site. */
  build(owner: UnitOwner, buildingId: string, x: number, z: number): StructureBuildResult {
    const stats = this.buildings[buildingId];
    if (!stats || buildingId === "command_center") {
      return { built: false, reason: "unknown-building", result: null };
    }
    const result = this.validate(owner, buildingId, x, z);
    if (!result) return { built: false, reason: "unknown-building", result: null };
    if (!result.valid) {
      // A failed proposal always names a reason; default keeps the type total.
      return { built: false, reason: result.reason ?? "blocked", result };
    }
    const reservation = this.kingdoms.get(owner).wallet.reserve(stats.cost);
    if (!reservation) {
      return {
        built: false,
        reason: "insufficient-resources",
        result: { ...result, valid: false, reason: "insufficient-resources" },
      };
    }
    const structure = this.structures.place(owner, stats, result.x, result.z);
    this.reservations.set(structure.id, reservation);
    this.navigation.setBlockers(this.occupiedBlockers());
    this.onStructurePlaced(structure);
    return { built: true, structure, result };
  }

  /** Cancel one kingdom's latest unbuilt site and refund its reservation in full. */
  cancelLatest(owner: UnitOwner): boolean {
    const structure = this.structures.cancelLatest(owner);
    if (!structure) return false;
    const reservation = this.reservations.get(structure.id);
    if (reservation) this.kingdoms.get(owner).wallet.refund(reservation);
    this.reservations.delete(structure.id);
    this.navigation.setBlockers(this.occupiedBlockers());
    this.onStructureCancelled(structure);
    return true;
  }

  /** Forget site tokens after the match owner resets the wallets. */
  resetReservations(): void {
    this.reservations.clear();
  }
}

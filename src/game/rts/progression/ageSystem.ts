/**
 * Owner-scoped Settlement -> Town progression.
 *
 * The command centre is deliberately only a gate here: its control footprint
 * remains live while upgrading, while worker production queries
 * {@link isUpgrading} and pauses its queue. Later building/unit T2 unlocks can
 * read the same compact snapshot without taking ownership of age state.
 */
import type { AgeBalance, SettlementAge } from "../../data/gameDataTypes";
import type { ResourceReservation } from "../economy/resourceWallet";
import type { KingdomRegistry } from "../kingdom/kingdomRegistry";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { CommandCenterSystem } from "../structures/commandCenterSystem";
import type { UnitOwner } from "../units/unit";

export type AgeUpgradeResult =
  | "started"
  | "already-town"
  | "already-upgrading"
  | "no-command-center"
  | "command-center-level"
  | "missing-requirements"
  | "insufficient-resources";

export interface AgeSnapshot {
  readonly owner: UnitOwner;
  readonly age: SettlementAge;
  readonly upgrading: boolean;
  readonly remainingSeconds: number;
  readonly missingBuildingIds: readonly string[];
  /** In-age centre level the age demands (data), and the one the owner has. */
  readonly requiredCenterLevel: number;
  readonly centerLevel: number;
}

/**
 * Whether this owner has researched the centre far enough to start the age.
 *
 * Exported because the panel hides the age button outright below it rather than
 * greying it out: the age is not a thing the player is failing at yet, it is a
 * thing that has not opened, and the centre's own level-up button — sitting
 * right next to it — is the whole path to opening it.
 */
export function centerLevelReadyForTown(snapshot: AgeSnapshot): boolean {
  return snapshot.centerLevel >= snapshot.requiredCenterLevel;
}

/** T2 structure actions are available only after the Town transition commits. */
export function townUnlocksAvailable(snapshot: Pick<AgeSnapshot, "age" | "upgrading">): boolean {
  return snapshot.age === "town" && !snapshot.upgrading;
}

export interface AgeUpgradeEvent {
  readonly owner: UnitOwner;
  readonly type: "completed" | "cancelled";
}

interface UpgradeState {
  readonly reservation: ResourceReservation;
  remainingSeconds: number;
}

interface OwnerAgeState {
  age: SettlementAge;
  upgrade: UpgradeState | null;
}

export class AgeSystem {
  private readonly states = new Map<UnitOwner, OwnerAgeState>();

  constructor(
    owners: readonly UnitOwner[],
    private readonly balance: AgeBalance,
    private readonly centers: CommandCenterSystem,
    private readonly structures: PlacedStructureSystem,
    private readonly kingdoms: KingdomRegistry,
  ) {
    for (const owner of owners) this.states.set(owner, { age: "settlement", upgrade: null });
  }

  snapshot(owner: UnitOwner): AgeSnapshot {
    const state = this.stateFor(owner);
    return {
      owner,
      age: state.age,
      upgrading: state.upgrade !== null,
      remainingSeconds: state.upgrade?.remainingSeconds ?? 0,
      missingBuildingIds: state.age === "settlement" ? this.missingBuildings(owner) : [],
      requiredCenterLevel: this.balance.town.requiredCommandCenterLevel,
      centerLevel: this.centers.get(owner)?.level ?? 0,
    };
  }

  isUpgrading(owner: UnitOwner): boolean {
    return this.stateFor(owner).upgrade !== null;
  }

  /** Reserve all four resources and start the one-way Town upgrade. */
  startTownUpgrade(owner: UnitOwner): AgeUpgradeResult {
    const state = this.stateFor(owner);
    if (state.age === "town") return "already-town";
    if (state.upgrade) return "already-upgrading";
    const center = this.centers.get(owner);
    if (!center) return "no-command-center";
    // The centre's own gate comes before the town-wide one, mirroring how the
    // panel reads: this button lives on the centre, so what the centre itself
    // still owes is the first thing it can be refused for.
    if (center.level < this.balance.town.requiredCommandCenterLevel) return "command-center-level";
    if (this.missingBuildings(owner).length > 0) return "missing-requirements";
    const reservation = this.kingdoms.get(owner).wallet.reserve(this.balance.town.cost);
    if (!reservation) return "insufficient-resources";
    state.upgrade = { reservation, remainingSeconds: this.balance.town.upgradeSeconds };
    return "started";
  }

  /** Advance only active centre upgrades; a destroyed centre cancels and refunds. */
  update(deltaSeconds: number): AgeUpgradeEvent[] {
    const events: AgeUpgradeEvent[] = [];
    for (const [owner, state] of this.states) {
      const upgrade = state.upgrade;
      if (!upgrade) continue;
      if (!this.centers.get(owner)) {
        this.kingdoms.get(owner).wallet.refund(upgrade.reservation);
        state.upgrade = null;
        events.push({ owner, type: "cancelled" });
        continue;
      }
      upgrade.remainingSeconds = Math.max(0, upgrade.remainingSeconds - Math.max(0, deltaSeconds));
      if (upgrade.remainingSeconds > 0) continue;
      this.kingdoms.get(owner).wallet.commit(upgrade.reservation);
      this.centers.get(owner)?.applyTownUpgrade(this.balance.town.commandCenter);
      state.age = "town";
      state.upgrade = null;
      events.push({ owner, type: "completed" });
    }
    return events;
  }

  /** Reset is idempotent and refunds any still-open transition reservation. */
  reset(): void {
    for (const [owner, state] of this.states) {
      if (state.upgrade) this.kingdoms.get(owner).wallet.refund(state.upgrade.reservation);
      state.age = "settlement";
      state.upgrade = null;
    }
  }

  private missingBuildings(owner: UnitOwner): string[] {
    const completeIds = new Set(this.structures.ownedBy(owner)
      .filter((structure) => structure.construction.complete)
      .map((structure) => structure.stats.id));
    return this.balance.town.requiredBuildingIds.filter((id) => !completeIds.has(id));
  }

  private stateFor(owner: UnitOwner): OwnerAgeState {
    const state = this.states.get(owner);
    if (!state) throw new Error(`No age state registered for owner "${owner}"`);
    return state;
  }
}

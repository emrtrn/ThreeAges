/**
 * Per-kingdom economy state — Vertical Slice Plan v0.2 §37–§38 (Faz 5.0).
 *
 * Faz 1–4 grew a single implicit stockpile and population pool because only the
 * player ever spent anything. The Faz 5 AI opponent has to run the *same*
 * economic loop under the *same* limits (`07_ENEMY_AI_DESIGN_v0.2.md` §4), which
 * is only meaningful if each kingdom owns its own wallet and population cap.
 *
 * This is deliberately a thin record, not a god object: structures, units and
 * production stay in the shared owner-aware systems, and only the two genuinely
 * per-kingdom resources live here.
 */
import type { StartingResources } from "../../data/gameDataTypes";
import type { PlacedStructureSystem } from "../structures/placedStructureSystem";
import type { UnitOwner } from "../units/unit";
import type { UnitSystem } from "../units/unitSystem";
import { PopulationSystem } from "../economy/populationSystem";
import { ResourceWallet } from "../economy/resourceWallet";

/**
 * Match-start stockpile per kingdom. A plain record gives every kingdom the same
 * opening (the fair default); a resolver lets a preset hand one side a different
 * stockpile — used by test presets that deliberately starve the AI.
 */
export type StartingResourcesSource =
  | StartingResources
  | ((owner: UnitOwner) => StartingResources);

export interface Kingdom {
  readonly owner: UnitOwner;
  readonly wallet: ResourceWallet;
  readonly population: PopulationSystem;
}

/** Resolves the economy state a system should spend from, given a structure's owner. */
export class KingdomRegistry {
  private readonly kingdoms = new Map<UnitOwner, Kingdom>();

  constructor(
    owners: readonly UnitOwner[],
    units: UnitSystem,
    structures: PlacedStructureSystem,
    private readonly startingResources: StartingResourcesSource,
    basePopulationCapacity: number,
  ) {
    for (const owner of owners) {
      this.kingdoms.set(owner, {
        owner,
        wallet: new ResourceWallet(this.startingFor(owner)),
        population: new PopulationSystem(owner, units, structures, basePopulationCapacity),
      });
    }
  }

  private startingFor(owner: UnitOwner): StartingResources {
    return typeof this.startingResources === "function"
      ? this.startingResources(owner)
      : this.startingResources;
  }

  /** Throws rather than silently spending from the wrong kingdom's stockpile. */
  get(owner: UnitOwner): Kingdom {
    const kingdom = this.kingdoms.get(owner);
    if (!kingdom) throw new Error(`No kingdom registered for owner "${owner}"`);
    return kingdom;
  }

  all(): readonly Kingdom[] {
    return [...this.kingdoms.values()];
  }

  /** Restore every kingdom to its match-start economy. */
  reset(): void {
    for (const kingdom of this.kingdoms.values()) {
      kingdom.wallet.reset(this.startingFor(kingdom.owner));
      kingdom.population.reset();
    }
  }

  /** Advance every kingdom's rolling income window. */
  advance(deltaSeconds: number): void {
    for (const kingdom of this.kingdoms.values()) kingdom.wallet.advance(deltaSeconds);
  }
}

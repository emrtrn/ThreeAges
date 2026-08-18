/**
 * What a building costs *right now*, which is not the same question as what its
 * row in `buildings.json` says.
 *
 * This project's second age builds in stone rather than timber, so the price of
 * a house is a fact about the kingdom's tier as much as about the house. The
 * age-keyed table lives in the data ({@link BuildingBalanceStats.costByAge}) and
 * this module is the single place that reads it, so the palette's label, the
 * builder's reservation and the repair quote cannot drift into three different
 * answers to one question.
 *
 * Everything below is a pure function of data plus a tier. The systems that
 * spend resources take a {@link BuildingCostResolver} rather than a progression
 * system, which keeps them testable headlessly and keeps the age rule out of
 * code that has no business knowing about ages.
 */
import type { BuildingBalanceStats, SettlementAge, StartingResources } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";

/**
 * The price of raising this building in this age.
 *
 * Falls back to the base `cost` when the age names no override, which is what
 * lets a building that is priced the same everywhere stay a single line of data.
 */
export function buildingCostForAge(stats: BuildingBalanceStats, age: SettlementAge): StartingResources {
  return stats.costByAge?.[age] ?? stats.cost;
}

/**
 * Resolves a building's live price for one kingdom.
 *
 * Owner-aware rather than global: the two kingdoms reach Kasaba at their own
 * pace, so "the current age" is only ever a question about one of them.
 */
export type BuildingCostResolver = (owner: UnitOwner, stats: BuildingBalanceStats) => StartingResources;

/**
 * The resolver for a world with no progression system — every building is priced
 * at its base `cost`.
 *
 * Headless placement tests build without a tier, and a default that reached for
 * one would make them depend on a system they never opted into.
 */
export const baseBuildingCost: BuildingCostResolver = (_owner, stats) => stats.cost;

/**
 * What a building *is*, as one classification both the strategic and the
 * tactical layer read.
 *
 * `armyTargeting` scores a building class (§60) and a siege gun picks between
 * buildings in range (Askerî AI v2 §10.3). Those two used to be one table in the
 * AI and one absence in combat, and the absence is what let a gun standing in
 * front of a Karakol turn round and shell a house. One function, so "which
 * building matters more" cannot be answered two different ways.
 *
 * Derived from the balance row rather than from a hand-kept id list, so a new
 * economy building or a new territory building lands in the right class the day
 * it is authored.
 */
import type { BuildingBalanceStats } from "../../data/gameDataTypes";

export type StructureRole = "economy" | "depot" | "outpost" | "military" | "support" | "center";

/** The classes in the design's priority order, used for deterministic tie-breaks. */
export const STRUCTURE_ROLES: readonly StructureRole[] = [
  "economy",
  "depot",
  "outpost",
  "military",
  "support",
  "center",
];

/** Buildings that train troops. Their loss is what stops the enemy replacing an army. */
const MILITARY_BUILDING_IDS: readonly string[] = ["barracks", "archery_range"];

export function structureRoleFor(stats: BuildingBalanceStats): StructureRole {
  if (stats.economy) return "economy";
  if (stats.territory) return "outpost";
  if (stats.id === "depot") return "depot";
  if (MILITARY_BUILDING_IDS.includes(stats.id)) return "military";
  return "support";
}

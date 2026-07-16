/**
 * Match-start handicap for the playable RTS route. Presets may still supply
 * other resources (for example core_match's zero stone/gold), while food and
 * wood are intentionally asymmetric for player-facing testing.
 */
import type { StartingResources } from "../../data/gameDataTypes";
import type { UnitOwner } from "../units/unit";

export const PLAYER_STARTING_FOOD_AND_WOOD = 2_000;
export const AI_STARTING_FOOD_AND_WOOD = 100;

export function matchStartingResourcesFor(
  owner: UnitOwner,
  presetResources: StartingResources,
): StartingResources {
  const foodAndWood = owner === "player"
    ? PLAYER_STARTING_FOOD_AND_WOOD
    : AI_STARTING_FOOD_AND_WOOD;
  return { ...presetResources, food: foodAndWood, wood: foodAndWood };
}

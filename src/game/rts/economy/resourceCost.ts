/**
 * Arithmetic on a price, for the callers that build one rather than just pay it.
 *
 * A cost used to be a number in the places that only ever charged one resource —
 * a road's `woodCost` being the last of them — and every such number became a
 * lie the moment the project's second age started paving in stone. These three
 * helpers are what a `number` gave for free and a {@link StartingResources}
 * does not, so that no caller has to reach back for a single hard-coded
 * resource id to scale, total or test a price.
 */
import type { StartingResources } from "../../data/gameDataTypes";

/** One unit's price times `factor`, rounded up so a part-charge is never free. */
export function scaleResourceCost(perUnit: StartingResources, factor: number): StartingResources {
  if (factor <= 0) return {};
  const scaled: Record<string, number> = {};
  for (const [resourceId, amount] of Object.entries(perUnit)) {
    const price = Math.ceil(amount * factor);
    if (price > 0) scaled[resourceId] = price;
  }
  return scaled;
}

/**
 * The price collapsed to one number, for scoring rather than for spending.
 *
 * Adding stone to timber is meaningless as a *price* — nobody pays "6 resource"
 * — but it is exactly what a heuristic that used to rank routes by their wood
 * bill needs in order to keep ranking them once the bill changes material.
 */
export function resourceCostTotal(cost: StartingResources): number {
  let total = 0;
  for (const amount of Object.values(cost)) total += amount;
  return total;
}

/** True when nothing is owed — an all-existing road route, or a free building. */
export function isFreeCost(cost: StartingResources): boolean {
  return resourceCostTotal(cost) <= 0;
}

/**
 * Shared resource presentation — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * The player-facing name and display order of the four resources, in one place.
 * Faz 9 needed a fourth copy of this map (the HUD bar) next to the three already
 * in the build palette, which is the point at which a copy becomes a defect: the
 * HUD and the cost line could disagree about what "stone" is called.
 *
 * These are not balance values, so plan §14 does not force them into JSON — and
 * they cannot simply move there today: `resources.json` describes *deposits*, so
 * it only carries stone and gold. Food and wood are produced by buildings and
 * have no entry to hold a label. Giving all four a data-owned label is a
 * loader/validator change, and belongs with the balance data, not with the HUD.
 */

/**
 * Display order, cheapest commitment first. The HUD reads left to right in the
 * order the player unlocks them: food and wood open the match, stone and gold
 * gate the Town age.
 */
export const RESOURCE_ORDER: readonly string[] = ["food", "wood", "stone", "gold"];

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  food: "Yiyecek",
  wood: "Odun",
  stone: "Taş",
  gold: "Altın",
};

/** Falls back to the raw id so an unknown resource is visible, not invisible. */
export function resourceLabel(resourceId: string): string {
  return RESOURCE_LABELS[resourceId] ?? resourceId;
}

/** Stocks accumulate as floats, but the player-facing inventory never overstates them. */
export function formatInventoryAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

/** Costs in the order {@link RESOURCE_ORDER} defines, skipping what is free. */
export function formatResourceCost(cost: Readonly<Record<string, number>>): string {
  const entries = Object.entries(cost).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return "Ücretsiz";
  return entries
    .sort(([left], [right]) => resourceRank(left) - resourceRank(right))
    .map(([resourceId, amount]) => `${amount} ${resourceLabel(resourceId)}`)
    .join(" · ");
}

/**
 * §51 "Maliyet ve kilit durumu": can this stock pay this price right now?
 *
 * Pure, and here rather than inside the palette, so `test:engine` can hold the
 * lock to account without a browser — and so the answer cannot drift from
 * {@link formatResourceCost}, which prints the very price being judged. It is
 * only an *indication*: `ResourceWallet.reserve` remains the authority that
 * actually takes the money, and this must agree with it, never replace it.
 */
export function canAffordCost(
  cost: Readonly<Record<string, number>>,
  stock: Readonly<Record<string, number>>,
): boolean {
  return Object.entries(cost).every(([resourceId, amount]) => {
    if (!(amount > 0)) return true;
    // Floors the stock the same way the HUD prints it: a player shown "79 Odun"
    // must not be told they can afford 80 because the float is 79.6.
    return formatInventoryAmount(stock[resourceId] ?? 0) >= amount;
  });
}

function resourceRank(resourceId: string): number {
  const index = RESOURCE_ORDER.indexOf(resourceId);
  return index === -1 ? RESOURCE_ORDER.length : index;
}

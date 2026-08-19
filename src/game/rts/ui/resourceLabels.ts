/**
 * Shared resource presentation — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * The display order of the four resources, and the cost lines built from them.
 * Faz 9 needed a fourth copy of the name map (the HUD bar) next to the three
 * already in the build palette, which is the point at which a copy becomes a
 * defect: the HUD and the cost line could disagree about what "stone" is called.
 *
 * Localization Faz 2 finished that consolidation the other way round. The names
 * no longer live here at all — they are `common.resource.<id>.name`, and
 * `resources.json` no longer carries the second Turkish copy it used to (that
 * duplication is the one the Localization Plan's Faz 1 handover names). What is
 * left here is the *order*, which is presentation and not text, plus the two
 * cost formatters, which are here so the sentence a player reads and the
 * affordability check behind it cannot drift apart.
 */
import { t } from "../../localization/LocalizationService";

/**
 * Display order, cheapest commitment first. The HUD reads left to right in the
 * order the player unlocks them: food and wood open the match, stone and gold
 * gate the Town age.
 */
export const RESOURCE_ORDER: readonly string[] = ["food", "wood", "stone", "gold"];

/**
 * The player-facing name of one resource, in the active language.
 *
 * Falls back to the raw id so an unknown resource is visible, not invisible —
 * and so a data-driven resource nobody has written a name for yet reads as
 * `"amber"` rather than as a missing-key marker in the middle of a cost line.
 */
export function resourceLabel(resourceId: string): string {
  if (!RESOURCE_ORDER.includes(resourceId)) return resourceId;
  return t(`common.resource.${resourceId}.name`);
}

/** Stocks accumulate as floats, but the player-facing inventory never overstates them. */
export function formatInventoryAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

/** Costs in the order {@link RESOURCE_ORDER} defines, skipping what is free. */
export function formatResourceCost(cost: Readonly<Record<string, number>>): string {
  const entries = Object.entries(cost).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return t("common.cost.free");
  return entries
    .sort(([left], [right]) => resourceRank(left) - resourceRank(right))
    .map(([resourceId, amount]) => costEntry(amount, resourceId))
    .join(COST_SEPARATOR);
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

/**
 * What is still missing to pay this price, and how much of it — "120 Taş · 40
 * Altın". Null when the stock covers the cost.
 *
 * The counterpart of {@link canAffordCost}, and here beside it for the same
 * reason: "you cannot afford this" and "you are 120 stone short" are the same
 * judgement said twice, and a refusal that names no number is the defect this
 * replaces. Only shortfalls appear — a resource the player already has enough
 * of is not what is stopping them, and listing it buries the one that is.
 */
export function formatCostShortfall(
  cost: Readonly<Record<string, number>>,
  stock: Readonly<Record<string, number>>,
): string | null {
  const missing = Object.entries(cost)
    .filter(([, amount]) => amount > 0)
    // Floored like the HUD prints it, so the shortfall agrees with the number
    // the player is looking at rather than with the float behind it.
    .map(([resourceId, amount]) => [resourceId, amount - formatInventoryAmount(stock[resourceId] ?? 0)] as const)
    .filter(([, short]) => short > 0)
    .sort(([left], [right]) => resourceRank(left) - resourceRank(right));
  if (missing.length === 0) return null;
  return missing.map(([resourceId, short]) => costEntry(short, resourceId)).join(COST_SEPARATOR);
}

/**
 * "120 Taş" / "120 Stone" — one amount and one resource, ordered by the language
 * rather than by this file. Plan §10: a cost line is a sentence too, and
 * `${amount} ${name}` is the concatenation that language rules out.
 */
function costEntry(amount: number, resourceId: string): string {
  return t("common.cost.entry", { amount, resource: resourceLabel(resourceId) });
}

/**
 * Punctuation, not text: the same middot separates every list the RTS UI prints,
 * and a translator changing it in one place and not the others is a worse
 * outcome than not offering the choice.
 */
const COST_SEPARATOR = " · ";

function resourceRank(resourceId: string): number {
  const index = RESOURCE_ORDER.indexOf(resourceId);
  return index === -1 ? RESOURCE_ORDER.length : index;
}

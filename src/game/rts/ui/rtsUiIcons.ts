/**
 * Icon paths that are *not* reachable from balance data.
 *
 * Building and unit artwork comes from `balance/*.json` (`icon` / `portrait`),
 * so swapping that artwork is a data edit.  A handful of HUD and palette icons
 * have no data row to hang off — resource readouts are derived from the fixed
 * resource order, and the road / erase / temple palette entries are hardcoded
 * UI affordances rather than buildings.  Collecting them here means an art
 * swap is one edit in one file instead of a grep through the UI modules.
 *
 * Both `.svg` and `.png` are accepted (matching `UiAssetPath`); change the
 * extension here when the file on disk changes.
 */

/** Fallback art, so an unknown resource renders *something* over a broken image. */
const RESOURCE_ICON_FALLBACK = "/assets/ui/icons/resource-wood.png";

/** Per-resource HUD readout icons, keyed by the balance resource id. */
const RESOURCE_ICONS: Readonly<Record<string, string>> = {
  food: "/assets/ui/icons/resource-food.png",
  gold: "/assets/ui/icons/resource-gold.png",
  stone: "/assets/ui/icons/resource-stone.png",
  wood: RESOURCE_ICON_FALLBACK,
};

/** Build-palette entries that are tools or placeholders, not buildings. */
export const PALETTE_ROAD_ICON = "/assets/ui/icons/command-patrol.svg";
export const PALETTE_ROAD_ERASE_ICON = "/assets/ui/icons/command-stop.svg";
export const PALETTE_TEMPLE_SOON_ICON = "/assets/ui/icons/building-command-center.svg";

/**
 * Resolve the HUD icon for a resource.  Falls back rather than rendering a
 * broken image if a project adds a resource without art.
 */
export function resourceIconSrc(resourceId: string): string {
  return RESOURCE_ICONS[resourceId] ?? RESOURCE_ICON_FALLBACK;
}

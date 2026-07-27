/**
 * Icon paths that are *not* reachable from balance data.
 *
 * Building and unit artwork comes from `balance/*.json` (`icon`),
 * so swapping that artwork is a data edit.  A handful of HUD and palette icons
 * have no data row to hang off — resource readouts are derived from the fixed
 * resource order, and the road / erase palette entries are hardcoded UI
 * affordances rather than buildings.  Collecting them here means an art swap is
 * one edit in one file instead of a grep through the UI modules.
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
export const PALETTE_ROAD_ICON = "/assets/ui/icons/road.png";
export const PALETTE_ROAD_ERASE_ICON = "/assets/ui/icons/road-delete.png";

/** Player-command artwork shared by the selected-unit readout and tools. */
export const UNIT_ATTACK_MOVE_ICON = "/assets/ui/icons/command-attack-move.png";
export const UNIT_HOLD_ICON = "/assets/ui/icons/command-hold.png";
export const UNIT_FREE_ICON = PALETTE_ROAD_ICON;
export const UNIT_STOP_ICON = "/assets/ui/icons/command-stop.png";

/**
 * Resolve the HUD icon for a resource.  Falls back rather than rendering a
 * broken image if a project adds a resource without art.
 */
export function resourceIconSrc(resourceId: string): string {
  return RESOURCE_ICONS[resourceId] ?? RESOURCE_ICON_FALLBACK;
}

/**
 * Painted art arrives one file at a time, while `balance/*.json` names the
 * final `.png` for every row at once.  Without this, every building whose
 * artwork has not been drawn yet renders an empty card — the icon is the whole
 * face of a build button, so a miss is a blank tile, not a small gap.  Falls
 * back to the placeholder `.svg` beside it, once, so a genuinely missing file
 * cannot loop.
 */
export function attachIconFallback(icon: HTMLImageElement): void {
  icon.addEventListener(
    "error",
    () => {
      if (!icon.src.endsWith(".png")) return;
      icon.src = icon.src.slice(0, -".png".length) + ".svg";
    },
    { once: true },
  );
}

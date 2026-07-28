/**
 * What the UI should be pointing at right now — Hikâye / Öğretici Tur Modu,
 * Sürüm 2 (§12.4).
 *
 * The whole of the "which button do I press" feature reduces to this function.
 * It is pure and DOM-free on purpose: the interesting part is not the CSS pulse
 * but the *rule* about when a pointer is honest, and that rule has three cases
 * worth being able to test without a browser.
 *
 * 1. **No chain, no pointer.** A finished, abandoned or absent chain highlights
 *    nothing. The mode ends by the guidance disappearing, exactly as the card
 *    does.
 * 2. **A build step points at the palette.** One button, named by the data.
 * 3. **A structure action points twice, in order.** `trade-buy:wood` does not
 *    exist on screen until a Market is selected, so while it is not, the pointer
 *    is on the *building* — "click your Market" — and only once the right
 *    building is selected does it move to the button inside the panel. Pulsing a
 *    button the player cannot see would be indistinguishable from no hint at
 *    all, and pulsing both at once would be pointing at two different things.
 */
import type { MissionDirectorState } from "./missionDirector";

export interface MissionHighlight {
  /** Build-palette button id (a building id), or null. */
  readonly paletteBuildingId: string | null;
  /** Selection-panel action id, or null. */
  readonly actionId: string | null;
  /**
   * The building the player has to select before {@link actionId} can appear.
   * Null once they have. Presentation turns this into "select your Centre",
   * which is the one thing the panel itself cannot say — it is not open yet.
   */
  readonly selectBuildingId: string | null;
}

const NOTHING: MissionHighlight = { paletteBuildingId: null, actionId: null, selectBuildingId: null };

export function missionGuideHighlight(
  state: MissionDirectorState | null,
  /** The building the player currently has selected, if any. */
  selectedBuildingId: string | null,
): MissionHighlight {
  const guide = state?.step?.guide;
  if (!guide) return NOTHING;
  const { action } = guide;
  if (action.kind === "build") {
    return { paletteBuildingId: action.buildingId, actionId: null, selectBuildingId: null };
  }
  return selectedBuildingId === action.buildingId
    ? { paletteBuildingId: null, actionId: action.actionId, selectBuildingId: null }
    : { paletteBuildingId: null, actionId: null, selectBuildingId: action.buildingId };
}

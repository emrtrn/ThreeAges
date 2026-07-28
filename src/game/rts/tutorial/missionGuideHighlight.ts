/**
 * What the UI should be pointing at right now — Hikâye / Öğretici Tur Modu,
 * Sürüm 2 (§12.4).
 *
 * The whole of the "which button do I press" feature reduces to this function.
 * It is pure and DOM-free on purpose: the interesting part is not the CSS pulse
 * but the *rule* about when a pointer is honest, and that rule has four cases
 * worth being able to test without a browser.
 *
 * 1. **No chain, no pointer.** A finished, abandoned or absent chain highlights
 *    nothing. The mode ends by the guidance disappearing, exactly as the card
 *    does.
 * 2. **A build step points at the palette.** One button, named by the data.
 * 3. **…unless a connection step's building already stands.** A step asking for
 *    a *linked* producer stays open when the player builds one out of reach of
 *    the road, and at that moment the palette button is the wrong answer —
 *    pointing at it tells them to buy a second one, which is exactly how the
 *    first play-through ran out of wood. The pointer moves to the road tool
 *    instead, because the building they own is one road away from clearing the
 *    step.
 *
 *    Restricted to goals that measure a *connection*, and that restriction is
 *    the load-bearing part: "make room for population" is also a build step
 *    whose building the player may already own, and there the second House is
 *    genuinely the answer. Owning one Farm while the food line is unlinked and
 *    owning one House while the population is full look identical from the
 *    outside; only the goal tells them apart, which is why the rule reads the
 *    goal rather than trusting the caller to ask at the right moment.
 * 4. **A structure action points twice, in order.** `trade-buy:wood` does not
 *    exist on screen until a Market is selected, so while it is not, the pointer
 *    is on the *building* — "click your Market" — and only once the right
 *    building is selected does it move to the button inside the panel. Pulsing a
 *    button the player cannot see would be indistinguishable from no hint at
 *    all, and pulsing both at once would be pointing at two different things.
 */
import type { MissionDirectorState } from "./missionDirector";

/** The palette's road tool, whose button is keyed by this id rather than a building. */
export const ROAD_PALETTE_TARGET = "road";

/**
 * Something the pulse cannot say, because the control it names is not on screen.
 * Presentation turns it into one line on the mission card.
 */
export type MissionGuidePrompt =
  /** The panel action is behind a selection the player has not made. */
  | { readonly kind: "select-building"; readonly buildingId: string }
  /** The building stands but is not connected; the road tool is the answer. */
  | { readonly kind: "draw-road" };

export interface MissionHighlight {
  /** Build-palette button id — a building id or {@link ROAD_PALETTE_TARGET}. */
  readonly paletteTarget: string | null;
  /** Selection-panel action id, or null. */
  readonly actionId: string | null;
  readonly prompt: MissionGuidePrompt | null;
}

const NOTHING: MissionHighlight = { paletteTarget: null, actionId: null, prompt: null };

export function missionGuideHighlight(
  state: MissionDirectorState | null,
  /** The building the player currently has selected, if any. */
  selectedBuildingId: string | null,
  /**
   * How many completed buildings of the guide's own type the player owns.
   *
   * Only meaningful on a `build` guide, and only case 3 above reads it. Passed
   * in rather than read here so this stays a pure function of what it is shown —
   * the caller already holds the mission world snapshot.
   */
  completedGuideBuildings = 0,
): MissionHighlight {
  const step = state?.step;
  const guide = step?.guide;
  if (!step || !guide) return NOTHING;
  const { action } = guide;
  if (action.kind === "build") {
    const measuresConnection = step.goal.kind === "producer-linked" || step.goal.kind === "outpost-connected";
    return measuresConnection && completedGuideBuildings > 0
      ? { paletteTarget: ROAD_PALETTE_TARGET, actionId: null, prompt: { kind: "draw-road" } }
      : { paletteTarget: action.buildingId, actionId: null, prompt: null };
  }
  return selectedBuildingId === action.buildingId
    ? { paletteTarget: null, actionId: action.actionId, prompt: null }
    : {
      paletteTarget: null,
      actionId: null,
      prompt: { kind: "select-building", buildingId: action.buildingId },
    };
}

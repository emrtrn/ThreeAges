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
 * 4. **A road step points at the road tool, once.** No building is involved and
 *    none is named; the pointer arms the tool and the card says what the road is
 *    for. This is the *only* case that reaches the road tool as an instruction —
 *    case 3 reaches it as a correction, which is why they carry different
 *    prompts.
 * 5. **A structure action points twice, in order.** `trade-buy:wood` does not
 *    exist on screen until a Market is selected, so while it is not, the pointer
 *    is on the *building* — "click your Market" — and only once the right
 *    building is selected does it move to the button inside the panel. Pulsing a
 *    button the player cannot see would be indistinguishable from no hint at
 *    all, and pulsing both at once would be pointing at two different things.
 * 6. **…unless that button is going to refuse.** A Market trade for a stocked
 *    resource needs a lot on the shelf, and the shelf only fills from a caravan
 *    (`marketSupplySystem.ts`). A pointer on `trade-buy:wood` with an empty
 *    shelf sends the player to press a button that answers `out-of-stock` —
 *    which is the one failure the pulse is supposed to be incapable of, and the
 *    exact shape of the bug the chain shipped with (plan K1). What replaces it
 *    depends on *why* the shelf is empty, because the two answers are opposite
 *    instructions: with no live lane the work is a road, and with a lane already
 *    running the work is over and the only honest hint is that nothing is to be
 *    pressed yet. Case 3 is the same principle one layer down — never point at a
 *    control that is about to say no — and the two share `missionBuildQuota` and
 *    the shelf reading with the surfaces that do the refusing.
 */
import { missionBuildQuota } from "./missionBuildPolicy";
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
  | { readonly kind: "draw-road" }
  /**
   * The step's whole work is a road, and it has no building to talk about.
   *
   * Kept apart from `draw-road` rather than folded into it, because the two say
   * opposite things about what the player has already done. `draw-road` is a
   * correction — "the thing you built is not connected" — and names that
   * building. This one is an opening instruction with no building in it at all,
   * and a sentence naming one would be pointing at the wrong object.
   *
   * Shared with case 6's empty shelf rather than split in two, because there the
   * player's next move is the same move and the sentence would be the same
   * sentence. A second kind whose only difference is which step asked for it
   * would be a distinction with no consequence on screen.
   */
  | { readonly kind: "supply-road" }
  /**
   * The shelf is short but a lane is already carrying — there is nothing to
   * press, and saying so is the hint.
   *
   * The one prompt that accompanies *no* pointer at all, and deliberately: the
   * player has already done the work (paved to a site), so every control on
   * screen is the wrong answer. Telling them to pave again would be worse than
   * silence — it would read as the game not noticing the road they just drew.
   */
  | { readonly kind: "await-caravan" };

/**
 * Whether the Market would actually serve this step's purchase right now.
 *
 * Two facts rather than one, because "the shelf is empty" alone cannot choose
 * between the two sentences case 6 needs. Stated as narrow readings in the
 * tutorial layer's own vocabulary — the `MissionTradeSiteFact` precedent — so a
 * test can build one from a literal instead of standing up the trade system.
 */
export interface MissionMarketShelf {
  /** A full lot is on hand: `MarketTradeSystem.buy` will not say `out-of-stock`. */
  readonly stocked: boolean;
  /**
   * `MarketSupplyLineState` for the goal's resource, resolved across every site
   * that could feed it. Only `"supplying"` means goods are already on their way;
   * `cut`, `unclaimed` and `rival` are all "the answer is out on the map", which
   * is what makes them one branch. `absent` — no such site authored at all —
   * lands there too, and the level gate of Faz 0.5 is what keeps that from being
   * a road the player can never draw.
   */
  readonly supplyState: string;
}

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
  /**
   * How the Market's shelf reads for a `market-bought` step's resource, or null
   * when the step is not one — or when the project does not gate that resource's
   * buy side on stock at all, in which case there is no refusal to avoid.
   *
   * Passed in for the same reason as `completedGuideBuildings`: the caller holds
   * the trade and supply systems, and this function stays a pure statement of the
   * rule rather than a second reader of the economy.
   */
  marketShelf: MissionMarketShelf | null = null,
): MissionHighlight {
  const step = state?.step;
  const guide = step?.guide;
  if (!step || !guide) return NOTHING;
  const { action } = guide;
  if (action.kind === "road") {
    return { paletteTarget: ROAD_PALETTE_TARGET, actionId: null, prompt: { kind: "supply-road" } };
  }
  if (action.kind === "build") {
    const measuresConnection = step.goal.kind === "producer-linked" || step.goal.kind === "outpost-connected";
    // The step's *quota*, not merely one: "connect two Lumber Camps" with one
    // standing wants the second camp, and only once both are up is a missing
    // road the thing left to explain. Same number the palette refuses on, from
    // the same function, so the hint can never point somewhere the click is
    // then turned away from.
    const quota = missionBuildQuota(step, action.buildingId);
    return measuresConnection && quota !== null && completedGuideBuildings >= quota
      ? { paletteTarget: ROAD_PALETTE_TARGET, actionId: null, prompt: { kind: "draw-road" } }
      : { paletteTarget: action.buildingId, actionId: null, prompt: null };
  }
  // Case 6, and it is checked *before* the selection stage rather than after:
  // "select your Market" would be a true instruction leading to a button that
  // refuses, so the shelf has to settle the question before the pointer starts
  // walking the player towards it.
  //
  // Keyed on the goal as well as on the shelf, the way case 3 is: the caller can
  // only read a shelf for a step that names a resource to buy, but a rule that
  // depends on the caller having been careful is a rule that reads as luck. A
  // `market-trade` step is deliberately outside it — that goal takes either
  // direction, and a sale needs no shelf.
  if (step.goal.kind === "market-bought" && marketShelf !== null && !marketShelf.stocked) {
    return marketShelf.supplyState === "supplying"
      ? { paletteTarget: null, actionId: null, prompt: { kind: "await-caravan" } }
      : { paletteTarget: ROAD_PALETTE_TARGET, actionId: null, prompt: { kind: "supply-road" } };
  }
  return selectedBuildingId === action.buildingId
    ? { paletteTarget: null, actionId: action.actionId, prompt: null }
    : {
      paletteTarget: null,
      actionId: null,
      prompt: { kind: "select-building", buildingId: action.buildingId },
    };
}

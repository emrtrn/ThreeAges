/**
 * Build/train action surface — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * Faz 2 opened this as "the build palette (not the final HUD)" and every slice
 * since hung its readout here, because it was the only panel that existed. Faz 9
 * gave the readouts a home of their own ({@link RtsHudBar}), so what is left is
 * what the name always promised: the actions, their costs, their locks, and the
 * reason an action is refused. State the player only *reads* belongs to the bar.
 *
 * By the end of Faz 9 this is one thing: *placement*. Everything a building or a
 * unit does moved onto the thing that does it ({@link RtsSelectionPanel}) — the
 * production readout that made the player pick "Tarla #7" from a list of ids
 * standing in for the map, the training verbs, the age, and the level-ups. A
 * palette is where you buy a building you do not have yet; it is not where you
 * command the ones you do.
 *
 * The age snapshot is the one thing left that is not placement, and it earns its
 * place: it states what the Town milestone *does* to every building (re-skin +
 * level reset, KR-03) before the player owns one to click, which no building's
 * own panel can do.
 */
import { t } from "../../localization/LocalizationService";
import { markStaticAria, markStaticText, refreshStaticText } from "./rtsStaticText";
import type { BuildingBalance, StartingResources } from "../../data/gameDataTypes";
import { buildingCostForAge } from "../economy/buildingCost";
import { buildingUnlocked, type ProgressionSnapshot } from "../progression/kingdomProgressionSystem";
import type { RoadPlacementState } from "../roads/roadPlacementSystem";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";

import { canAffordCost, formatResourceCost } from "./resourceLabels";
import {
  attachIconFallback,
  PALETTE_ROAD_ERASE_ICON,
  PALETTE_ROAD_ICON,
} from "./rtsUiIcons";

/**
 * §51 "Yapı kategorileri". Grouped by the question the player is asking — "I
 * need income", "I need to move it", "I need soldiers" — not by the data's
 * shape. A flat pile of nine buildings made every choice a scan of the whole
 * list; the categories are what let the eye skip the four it does not want.
 *
 * Authored here rather than derived from the balance fields (`economy`,
 * `territory`, …) because a category is an editorial claim about *why* a player
 * reaches for a building. A Depot has no `economy` block but is the reason a
 * Farm pays: deriving would have filed it away from the decision it belongs to.
 *
 * Ekonomi is the drawer the game keeps filling, and a pile that size is scanned
 * item by item — the cost the categories were meant to remove in the first
 * place. So a category may break itself into named {@link BuildGroup}s inside
 * its own panel: three cards under "Gıda", three under "Ham Madde" is the size
 * an eye takes in at once. The decision stays on one screen — no tab to switch,
 * no shortcut digit to relearn — it just stops arriving as one heap.
 *
 * Two groups, not three, and that is what moved the Market. It was filed under
 * Ekonomi because it answers the producers' question from the other side ("I
 * need stone I cannot mine"), and that reading still holds — but a third group
 * of one card cost the panel a whole row of height for a single building, and
 * the palette grows from the bottom of the screen upward into the player's view.
 * Under "Yerleşim" it costs nothing: that tab already holds the two buildings
 * you place *inside* a settled town rather than out on a resource, which is
 * where a market stands anyway.
 */
interface BuildGroup {
  /** Localization key; resolved at render time, never at module load. */
  readonly titleKey: string;
  readonly buildingIds: readonly string[];
}

interface BuildCategory {
  readonly titleKey: string;
  /** Flat categories. Mutually exclusive with {@link BuildCategory.groups}. */
  readonly buildingIds?: readonly string[];
  /** Sub-headed categories: the ids live in the groups, in display order. */
  readonly groups?: readonly BuildGroup[];
  readonly includesRoad?: boolean;
}

const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    titleKey: "building.category.economy",
    groups: [
      { titleKey: "building.group.food", buildingIds: ["farm", "windmill", "hunting_camp", "pasture"] },
      { titleKey: "building.group.raw_materials", buildingIds: ["lumber_camp", "quarry", "gold_mine"] },
    ],
  },
  { titleKey: "building.category.logistics", buildingIds: ["depot", "outpost"], includesRoad: true },
  // The Tapınak files under "Yerleşim" rather than "Askerî": it trains nothing
  // and fires nothing — what it does is make a place worth standing in, which is
  // the same claim the House makes about ground the player has taken, and the
  // same one the Pazar makes.
  { titleKey: "building.category.settlement", buildingIds: ["house", "temple", "market"] },
  { titleKey: "building.category.military", buildingIds: ["barracks", "archery_range"] },
];

/**
 * The one reading of a category's contents, so the render loop and the "did
 * anybody file this building?" sweep cannot disagree about a grouped category.
 * A flat category is the degenerate case: one untitled group.
 */
function categoryGroups(category: BuildCategory): readonly BuildGroup[] {
  return category.groups ?? [{ titleKey: "", buildingIds: category.buildingIds ?? [] }];
}

/**
 * The tier a shut card is waiting for, as one sentence.
 *
 * Exported because the card's tooltip and the click refusal are the same claim
 * reaching the player through two surfaces, and a player told "Kasaba Çağında
 * açılır" by one and "Yerleşim Lv2" by the other has been told the gate is
 * arbitrary. The age names are the two the data ships; a fork relabelling them
 * changes `ages.json`, which is the same string this reads through its caller.
 */
/**
 * The refusal a placement reason resolves to — Plan §17.3 wants a *reason*, not
 * one "you cannot build here", and this table is what keeps the nine apart.
 * Keyed by the gameplay id, which never translates (§3.4).
 */
const PLACEMENT_ERROR_KEY: Readonly<Record<string, string>> = {
  "outside-map": "placement.error.outside_map",
  "outside-control": "placement.error.outside_control",
  "insufficient-resources": "placement.error.insufficient_resources",
  "missing-forest": "placement.error.missing_forest",
  "missing-game": "placement.error.missing_game",
  "missing-livestock": "placement.error.missing_livestock",
  "missing-adjacent-building": "placement.error.missing_adjacent_building",
  "enemy-occupied": "placement.error.enemy_occupied",
  "missing-resource-node": "placement.error.missing_resource_node",
};

export function buildingUnlockRequirement(
  stats: {
    readonly requiredAge?: BuildingBalance[string]["requiredAge"] | undefined;
    readonly requiredSettlementLevel?: number | undefined;
  },
  /** Naming the building makes it a whole sentence rather than a fragment a
   *  caller has to glue its own subject onto (Plan §10). */
  building?: string,
): string {
  const age = t(`common.age.${stats.requiredAge === "town" ? "town" : "settlement"}.name`);
  const level = stats.requiredSettlementLevel ?? 1;
  // Turkish says "Lv2 ile", never "Lv2'de": the locative harmonises with the
  // level *number*, so one suffix cannot be right for every tier. The
  // translation carries the whole sentence, and the number stays a parameter.
  const suffix = level > 1 ? "tier" : "age";
  return building === undefined
    ? t(`building.unlock.${suffix}`, { age, level })
    : t(`building.locked.${suffix}`, { building, age, level });
}

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly roadHint = document.createElement("p");
  private readonly buildButtons = new Map<
    string,
    {
      readonly button: HTMLButtonElement;
      readonly cost: HTMLSpanElement;
      /** The data row, held so the age can re-price the card without a rebuild. */
      readonly stats: BuildingBalance[string];
      /** The live price for the centre's current age; see {@link setTierState}. */
      price: StartingResources;
      readonly requiredAge: BuildingBalance[string]["requiredAge"];
      readonly requiredSettlementLevel: BuildingBalance[string]["requiredSettlementLevel"];
      /** Tier-gated shut. Held so the tooltip can outrank the price. */
      locked: boolean;
      /** What the lock is waiting for, in the player's words, or "" while open. */
      lockedReason: string;
      affordable: boolean;
    }
  >();
  private affordabilitySignature = "";
  private readonly actionMessage = document.createElement("p");
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly categoryPanels = new Map<string, HTMLElement>();
  /** Category identity is a localisation key, never its current display text. */
  private activeCategory = "building.category.economy";
  /** The initial category settles instantly; only player-driven changes resize. */
  private categoryAnimationReady = false;
  private categoryAnimationToken = 0;
  /** The palette waits long enough to avoid collapsing during a passing mouse move. */
  private static readonly COMPACT_DELAY_MS = 900;
  private compactTimer: number | undefined;
  private pointerIsInside = false;
  /**
   * Placement is *modal*: one pick arms the cursor until a right-click or a
   * different pick disarms it, and the road tool stays armed across a whole
   * drag. The button that armed it has to say so for that whole span, or the
   * player is reading the map to work out what a click will do.
   *
   * Held as two independent fields rather than one, because the two owners
   * ({@link BuildingPlacementState}, {@link RoadPlacementState}) push on their
   * own schedules and in either order — recomputing from both on every push is
   * what keeps a road highlight from being cleared by a placement tick that
   * happens to land after it.
   */
  private readonly roadButtons = new Map<"build" | "erase", HTMLButtonElement>();
  private armedBuildingId: string | null = null;
  private armedRoadMode: "build" | "erase" | null = null;
  /** The building the story chain is currently pointing at, if any. */
  private missionHighlightId: string | null = null;
  /**
   * The last state each pusher sent, and which of the two wrote the status line.
   *
   * Unlike the HUD bar and the selection panel — pushed every tick and every
   * frame respectively — the palette is told about placement only when placement
   * *happens*. That is right for placement and wrong for language: after a
   * switch the status line kept saying "Bir yapı seç" until the player next
   * armed or cancelled a tool, so the palette appeared to change language at
   * random. {@link retranslate} replays the last push instead.
   */
  private lastPlacementState: BuildingPlacementState | null = null;
  private lastRoadState: RoadPlacementState | null = null;
  private lastStatusSource: "placement" | "road" = "placement";
  /**
   * The live action message, held as the *call* that produces it rather than as
   * the sentence it produced. A refusal ("Kasaba çağı gerekli") stays on screen
   * until the next placement action clears it, which is long enough for a player
   * to change language underneath it.
   */
  private actionMessageSource: (() => string) | null = null;

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onChooseRoad: () => void = () => {},
    private readonly onChooseRoadErase: () => void = () => {},
  ) {
    this.root.className = "rts-build-palette ui-interactive";
    markStaticAria(this.root, "building.palette.aria");
    const title = document.createElement("strong");
    markStaticText(title, "building.palette.title");
    this.root.appendChild(title);
    // Anything the categories do not name still has to reach the player: a new
    // building added to the data must not vanish from the palette because nobody
    // filed it. It lands under "Diğer" instead.
    const categorised = new Set(
      BUILD_CATEGORIES.flatMap((category) => categoryGroups(category).flatMap((group) => group.buildingIds)),
    );
    const uncategorised = Object.keys(buildings)
      .filter((id) => id !== "command_center" && !categorised.has(id));
    const categories: readonly BuildCategory[] = uncategorised.length > 0
      ? [...BUILD_CATEGORIES, { titleKey: "building.category.other", buildingIds: uncategorised }]
      : BUILD_CATEGORIES;
    const tabRow = document.createElement("div");
    tabRow.className = "rts-build-tabs";
    this.root.appendChild(tabRow);
    const grid = document.createElement("div");
    grid.className = "rts-build-grid";
    this.root.appendChild(grid);
    for (const category of categories) {
      // A group whose buildings the data does not carry is not an empty heading:
      // it is dropped, so a fork that ships no market never draws a "Ticaret"
      // title over nothing.
      const groups = categoryGroups(category)
        .map((group) => ({ ...group, buildingIds: group.buildingIds.filter((id) => buildings[id]) }))
        .filter((group) => group.buildingIds.length > 0);
      if (groups.length === 0 && !category.includesRoad) continue;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "rts-build-tab";
      // Text from the key, identity *as* the key: the tab map and the panel
      // attribute must not change meaning when the language does.
      markStaticText(tab, category.titleKey);
      tab.addEventListener("click", () => this.selectCategory(category.titleKey));
      this.tabs.set(category.titleKey, tab);
      tabRow.appendChild(tab);
      const panel = document.createElement("div");
      panel.className = "rts-build-choices rts-build-category-panel";
      panel.dataset.rtsBuildCategory = category.titleKey;
      // Sub-headed categories nest one grid per group; flat ones keep the cards
      // as the panel's own children, so the card rules address them the same way
      // either side of the split.
      const grouped = groups.some((group) => group.titleKey !== "");
      panel.classList.toggle("is-grouped", grouped);
      let lastGrid = panel;
      for (const group of groups) {
        let target = panel;
        if (grouped) {
          const section = document.createElement("div");
          section.className = "rts-build-group";
          const heading = document.createElement("p");
          heading.className = "rts-build-group-title";
          markStaticText(heading, group.titleKey);
          const cards = document.createElement("div");
          cards.className = "rts-build-group-choices";
          section.append(heading, cards);
          panel.appendChild(section);
          target = cards;
        }
        for (const id of group.buildingIds) target.appendChild(this.createBuildChoice(id, buildings[id]!));
        lastGrid = target;
      }
      if (category.includesRoad) {
        lastGrid.appendChild(this.createRoadChoice("build"));
        // GDD 10 §44 "Yol Silme". Sits beside the tool that made the mistake,
        // because a paved tile reserves its ground: without this, a route drawn
        // across a stone or gold deposit locked that deposit out of the match.
        lastGrid.appendChild(this.createRoadChoice("erase"));
      }
      this.categoryPanels.set(category.titleKey, panel);
      grid.appendChild(panel);
    }
    this.actionMessage.className = "rts-build-action-message";
    this.root.appendChild(this.actionMessage);
    this.status.className = "rts-build-status";
    this.root.appendChild(this.status);
    this.roadHint.className = "rts-build-road-hint";
    this.roadHint.hidden = true;
    this.root.appendChild(this.roadHint);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.root.addEventListener("pointerenter", this.onPointerEnter);
    this.root.addEventListener("pointerleave", this.onPointerLeave);
    this.root.addEventListener("focusin", this.onFocusIn);
    this.root.addEventListener("focusout", this.onFocusOut);
    this.setState({ activeBuildingId: null, result: null });
    this.setTierState({ age: "settlement", level: 1 });
    this.selectCategory(this.activeCategory);
  }

  /** One build card, registered with the affordability/lock passes that drive it. */
  private createBuildChoice(id: string, stats: BuildingBalance[string]): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rts-build-choice";
    button.dataset.rtsBuilding = id;
    // Keep the action's accessible name concise while the visual label shows
    // the explicit resource cost needed for faster purchase decisions.
    markStaticAria(button, stats.nameKey);
    if (stats.icon) {
      const icon = document.createElement("img");
      icon.className = "rts-build-choice-icon";
      icon.src = stats.icon;
      icon.alt = "";
      attachIconFallback(icon);
      button.appendChild(icon);
    }
    const label = document.createElement("span");
    label.className = "rts-build-choice-label";
    markStaticText(label, stats.nameKey);
    const cost = document.createElement("span");
    cost.className = "rts-build-choice-cost";
    // Not marked: a cost is not a key but an amount rendered from `price`, which
    // the age re-prices. `retranslate` rebuilds it from the same call.
    cost.textContent = formatResourceCost(stats.cost);
    button.append(label, cost);
    button.addEventListener("click", () => this.onChoose(id));
    this.buildButtons.set(id, {
      button,
      cost,
      stats,
      price: stats.cost,
      requiredAge: stats.requiredAge,
      requiredSettlementLevel: stats.requiredSettlementLevel,
      locked: false,
      lockedReason: "",
      affordable: true,
    });
    return button;
  }

  /** The road tools wear the build card, but are keyed by mode rather than by id. */
  private createRoadChoice(mode: "build" | "erase"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rts-build-choice";
    button.dataset.rtsBuilding = mode === "build" ? "road" : "road-erase";
    const nameKey = `building.road.${mode === "build" ? "build" : "erase"}.name`;
    markStaticAria(button, nameKey);
    const icon = document.createElement("img");
    icon.className = "rts-build-choice-icon";
    icon.src = mode === "build" ? PALETTE_ROAD_ICON : PALETTE_ROAD_ERASE_ICON;
    icon.alt = "";
    attachIconFallback(icon);
    const label = document.createElement("span");
    label.className = "rts-build-choice-label";
    markStaticText(label, nameKey);
    const cost = document.createElement("span");
    cost.className = "rts-build-choice-cost";
    // The road's price is a sentence ("yol başına"), not an amount, so unlike a
    // building's cost it *is* a key and sweeps with the rest.
    markStaticText(cost, `building.road.${mode === "build" ? "build" : "erase"}.cost`);
    button.append(icon, label, cost);
    button.addEventListener("click", mode === "build" ? this.onChooseRoad : this.onChooseRoadErase);
    this.roadButtons.set(mode, button);
    return button;
  }

  setState(state: BuildingPlacementState): void {
    this.lastPlacementState = state;
    this.lastStatusSource = "placement";
    this.roadHint.hidden = true;
    this.armedBuildingId = state.activeBuildingId;
    this.syncArmedButtons();
    this.syncPlacementMode();
    if (!state.activeBuildingId) {
      this.status.textContent = t("placement.prompt.select_building");
      return;
    }
    if (!state.result) {
      this.status.textContent = t(state.activeBuildingId === "outpost"
        ? "placement.prompt.outpost"
        : "placement.prompt.pick_location");
      return;
    }
    if (state.result.valid) {
      this.status.textContent = t("placement.valid");
      return;
    }
    // A null reason (and any reason the table does not name) reads as the
    // generic overlap: the fallback is a sentence, never a blank status line.
    const reason = state.result.reason;
    this.status.textContent = t(
      (reason === null ? undefined : PLACEMENT_ERROR_KEY[reason]) ?? "placement.error.blocked",
    );
  }

  /**
   * What the centre's tier means, before the player owns a building to click.
   * The age resets every existing building to Level 1 and also opens any
   * building whose data declares Town as its first available age; a *level*
   * inside an age opens the buildings that age staged behind it — the Tarla
   * behind the Yerleşim Lv2 milestone, so the opening food is the Avcı Kulübesi
   * and the Ağıl.
   *
   * One gate, read from the data by {@link buildingUnlocked}, so the card and
   * the click handler cannot answer differently. An in-flight upgrade is not
   * consulted: the tier only moves on commit, so a Lv-up running inside Kasaba
   * must not shut a door the age already opened.
   */
  setTierState(snapshot: Pick<ProgressionSnapshot, "age" | "level">): void {
    for (const entry of this.buildButtons.values()) {
      entry.locked = !buildingUnlocked(entry, { age: snapshot.age, level: snapshot.level });
      entry.lockedReason = entry.locked ? buildingUnlockRequirement(entry) : "";
      entry.button.disabled = entry.locked;
      // The age can change what a building is bought with, so the card is
      // re-priced here rather than at creation. Both the label and the
      // affordability pass read `price`, which is what stops the palette from
      // quoting timber for a wall the builder will charge stone for.
      entry.price = buildingCostForAge(entry.stats, snapshot.age);
      entry.cost.textContent = formatResourceCost(entry.price);
      this.syncTitle(entry);
    }
    // §51's affordability pass short-circuits on an unchanged signature, and the
    // stock does not move just because the age did — without this the freshly
    // re-priced cards would keep the previous age's greyed-out state.
    this.affordabilitySignature = "";
  }

  /** Road mode is owned by the road system; the palette only narrates it. */
  setRoadState(state: RoadPlacementState): void {
    this.lastRoadState = state;
    this.lastStatusSource = "road";
    this.armedRoadMode = state.active ? state.mode : null;
    this.syncArmedButtons();
    this.syncPlacementMode();
    if (!state.active) {
      this.status.textContent = t("placement.prompt.select_building");
      this.roadHint.hidden = true;
      return;
    }
    this.roadHint.hidden = false;
    if (state.mode === "erase") {
      // The split warning is the §44 "bağlantı etkisi": it is the one erase whose
      // cost is not the tile itself, so it has to be readable before the click.
      this.status.textContent = t("road.status.erasing");
      this.roadHint.textContent = t(!state.target
        ? "road.hint.pick_tile"
        : state.target.splits
          ? "road.hint.splits"
          : "road.hint.erase");
      return;
    }
    this.status.textContent = t(state.start ? "road.status.drawing" : "road.status.draw_mode");
    this.roadHint.textContent = state.plan
      ? t("road.hint.plan", {
          cells: state.plan.newCells.length,
          cost: formatResourceCost(state.plan.cost),
        })
      : state.reason === "invalid-route"
        ? t("road.hint.invalid_route")
        : state.reason === "insufficient-resources"
          ? t("road.hint.insufficient_resources")
          : t(state.start ? "road.hint.pick_end" : "road.hint.pick_start");
  }

  /**
   * §51 "Maliyet ve kilit durumu": mark what the player cannot currently afford.
   *
   * Marked, not disabled. Stock moves every tick, and a button that greys out
   * from under a reaching hand is worse than one that answers — the same call
   * the age button makes. Picking an unaffordable building still starts the
   * ghost and the placement status still says "Kaynak yetersiz", so the refusal
   * is never silent; this only puts the fact where the choice is made.
   */
  setAffordability(stock: StartingResources): void {
    const signature = [...this.buildButtons.values()]
      .map((entry) => (canAffordCost(entry.price, stock) ? "1" : "0"))
      .join("");
    if (signature === this.affordabilitySignature) return;
    this.affordabilitySignature = signature;
    for (const entry of this.buildButtons.values()) {
      entry.affordable = canAffordCost(entry.price, stock);
      entry.button.classList.toggle("is-unaffordable", !entry.affordable);
      entry.cost.classList.toggle("is-unaffordable", !entry.affordable);
      this.syncTitle(entry);
    }
  }

  /**
   * The one reason the card gives for itself, worst first.
   *
   * A locked card is also, almost always, an unaffordable one — the age it
   * waits on is expensive. Written independently, the two passes overwrote each
   * other in whichever order they last ran, and the age lock lost: the player
   * hovering a shut Okçuluk Alanı was told a price, which reads as "save up"
   * when the answer is "reach Kasaba".
   */
  private syncTitle(entry: {
    button: HTMLButtonElement;
    price: StartingResources;
    locked: boolean;
    lockedReason: string;
    affordable: boolean;
  }): void {
    entry.button.title = entry.locked
      ? entry.lockedReason
      : entry.affordable
        ? ""
        : t("building.cost.insufficient", { cost: formatResourceCost(entry.price) });
  }

  /**
   * Point at the button the active story step is asking for (Sürüm 2 §12.4).
   *
   * Two things happen, and only on a *change* of target — this is pushed on
   * every mission poll:
   *
   * - the button gets a pulsing marker;
   * - its category tab is brought to the front, because the palette shows one
   *   category at a time and a pulse on a hidden panel is not a hint.
   *
   * The tab is switched once per target rather than continuously, so a player
   * who deliberately opens another category to look around is not dragged back
   * every quarter second. They are being pointed at a button, not steered.
   */
  setMissionHighlight(target: string | null): void {
    if (target === this.missionHighlightId) return;
    this.missionHighlightId = target;
    for (const [id, entry] of this.buildButtons) {
      entry.button.classList.toggle("is-mission-hint", id === target);
    }
    // The road tool is a palette button like any other from the pointer's side,
    // but it is keyed by mode rather than by building id — and only the *build*
    // mode is ever pointed at. Sending a player to the eraser would be sending
    // them to undo the thing the step just asked for.
    this.roadButtons.get("build")?.classList.toggle("is-mission-hint", target === "road");
    this.roadButtons.get("erase")?.classList.remove("is-mission-hint");
    if (target === null) return;
    this.root.hidden = false;
    this.expand();
    for (const [category, panel] of this.categoryPanels) {
      if (panel.querySelector(`[data-rts-building="${CSS.escape(target)}"]`)) {
        this.selectCategory(category);
        return;
      }
    }
  }

  /**
   * Persist completion/error feedback while placement hover state keeps changing.
   *
   * Takes a thunk, not a string: the messages are built by the caller out of
   * building names and refusal reasons, so there is no single key the palette
   * could re-resolve on its own. Asking again is the only way to get the same
   * sentence in another language.
   */
  setActionMessage(message: (() => string) | null): void {
    this.actionMessageSource = message;
    this.actionMessage.textContent = message?.() ?? "";
  }

  toggleVisible(): void {
    this.root.hidden = !this.root.hidden;
    if (!this.root.hidden) this.expand();
  }

  selectCategoryByIndex(index: number): void {
    const title = [...this.tabs.keys()][index];
    if (!title) return;
    this.root.hidden = false;
    this.expand();
    this.selectCategory(title);
  }

  /** Pointer and keyboard entry both make the current category available at once. */
  private readonly onPointerEnter = (): void => {
    this.pointerIsInside = true;
    this.expand();
  };

  private readonly onPointerLeave = (): void => {
    this.pointerIsInside = false;
    // A mouse click leaves focus on the tab/card that received it. That focus
    // must not override the player's subsequent move back to the map.
    this.scheduleCompact(true);
  };

  private readonly onFocusIn = (): void => {
    this.expand();
  };

  private readonly onFocusOut = (): void => {
    window.setTimeout(() => {
      if (!this.root.contains(document.activeElement)) this.scheduleCompact();
    }, 0);
  };

  private expand(): void {
    this.clearCompactTimer();
    this.root.classList.remove("is-compact");
  }

  private scheduleCompact(afterPointerLeave = false): void {
    if (
      !this.canAutoCompact()
      || this.pointerIsInside
      || (!afterPointerLeave && this.root.contains(document.activeElement))
    ) return;
    this.clearCompactTimer();
    this.compactTimer = window.setTimeout(() => {
      this.compactTimer = undefined;
      if (!this.pointerIsInside && (afterPointerLeave || !this.root.contains(document.activeElement))) {
        this.root.classList.add("is-compact");
      }
    }, RtsBuildPalette.COMPACT_DELAY_MS);
  }

  /** A touch-first device has no reliable hover affordance, so it stays expanded. */
  private canAutoCompact(): boolean {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }

  private clearCompactTimer(): void {
    if (this.compactTimer === undefined) return;
    window.clearTimeout(this.compactTimer);
    this.compactTimer = undefined;
  }

  /**
   * Mark whichever button currently owns the cursor. `aria-pressed` rides along
   * with the class because "armed until you disarm it" is a toggle, not a
   * one-shot action — a screen reader that announces it as a plain button
   * describes a mode the player cannot hear they are in.
   */
  private syncArmedButtons(): void {
    for (const [id, entry] of this.buildButtons) {
      const armed = id === this.armedBuildingId;
      entry.button.classList.toggle("is-armed", armed);
      entry.button.setAttribute("aria-pressed", String(armed));
    }
    for (const [mode, button] of this.roadButtons) {
      const armed = mode === this.armedRoadMode;
      button.classList.toggle("is-armed", armed);
      button.setAttribute("aria-pressed", String(armed));
    }
  }

  /** Keep the active placement mode legible even while its choices are tucked away. */
  private syncPlacementMode(): void {
    this.root.classList.toggle("has-placement-mode", this.armedBuildingId !== null || this.armedRoadMode !== null);
  }

  private selectCategory(title: string): void {
    const previousHeight = this.root.getBoundingClientRect().height;
    // An interrupted transition leaves an explicit height behind. Clear it before
    // measuring the new category's natural content height.
    this.root.classList.remove("is-category-resizing");
    this.root.style.height = "";
    this.activeCategory = title;
    for (const [category, tab] of this.tabs) tab.setAttribute("aria-pressed", String(category === title));
    for (const [category, panel] of this.categoryPanels) panel.hidden = category !== title;
    const nextHeight = this.root.getBoundingClientRect().height;
    if (!this.categoryAnimationReady) {
      this.categoryAnimationReady = true;
      return;
    }
    if (Math.abs(nextHeight - previousHeight) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const token = ++this.categoryAnimationToken;
    this.root.style.height = `${previousHeight}px`;
    this.root.classList.add("is-category-resizing");
    // Force the browser to commit the old height before it receives the target.
    void this.root.offsetHeight;
    this.root.style.height = `${nextHeight}px`;
    const finish = (event: TransitionEvent): void => {
      if (event.target !== this.root || event.propertyName !== "height") return;
      this.root.removeEventListener("transitionend", finish);
      if (token !== this.categoryAnimationToken) return;
      this.root.classList.remove("is-category-resizing");
      this.root.style.height = "";
    };
    this.root.addEventListener("transitionend", finish);
  }

  /**
   * Re-resolve everything written once — Plan §13, driven by `RtsApp`.
   *
   * The status line, the road hint and the affordability state are pushed every
   * frame and need nothing from here; what does not come back on its own is the
   * marked text, the prices and the lock tooltips, and those are what this
   * rebuilds. Nothing is recreated, so the open category and the armed building
   * survive a language change untouched.
   */
  retranslate(): void {
    refreshStaticText(this.root);
    for (const entry of this.buildButtons.values()) {
      entry.cost.textContent = formatResourceCost(entry.price);
      if (entry.locked) entry.lockedReason = buildingUnlockRequirement(entry);
      this.syncTitle(entry);
    }
    this.actionMessage.textContent = this.actionMessageSource?.() ?? "";
    // Only the pusher that wrote the line last, because the two disagree about
    // the road hint: replaying both in a fixed order would show a road prompt
    // over a building placement, or hide a live one.
    if (this.lastStatusSource === "road" && this.lastRoadState) this.setRoadState(this.lastRoadState);
    else if (this.lastPlacementState) this.setState(this.lastPlacementState);
  }

  dispose(): void {
    this.clearCompactTimer();
    this.root.removeEventListener("pointerenter", this.onPointerEnter);
    this.root.removeEventListener("pointerleave", this.onPointerLeave);
    this.root.removeEventListener("focusin", this.onFocusIn);
    this.root.removeEventListener("focusout", this.onFocusOut);
    this.root.remove();
  }
}

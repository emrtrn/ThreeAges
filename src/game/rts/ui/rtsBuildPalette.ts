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
  readonly title: string;
  readonly buildingIds: readonly string[];
}

interface BuildCategory {
  readonly title: string;
  /** Flat categories. Mutually exclusive with {@link BuildCategory.groups}. */
  readonly buildingIds?: readonly string[];
  /** Sub-headed categories: the ids live in the groups, in display order. */
  readonly groups?: readonly BuildGroup[];
  readonly includesRoad?: boolean;
}

const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    title: "Ekonomi",
    groups: [
      { title: "Gıda", buildingIds: ["farm", "windmill", "hunting_camp", "pasture"] },
      { title: "Ham Madde", buildingIds: ["lumber_camp", "quarry", "gold_mine"] },
    ],
  },
  { title: "Lojistik", buildingIds: ["depot", "outpost"], includesRoad: true },
  // The Tapınak files under "Yerleşim" rather than "Askerî": it trains nothing
  // and fires nothing — what it does is make a place worth standing in, which is
  // the same claim the House makes about ground the player has taken, and the
  // same one the Pazar makes.
  { title: "Yerleşim", buildingIds: ["house", "temple", "market"] },
  { title: "Askerî", buildingIds: ["barracks", "archery_range"] },
];

/**
 * The one reading of a category's contents, so the render loop and the "did
 * anybody file this building?" sweep cannot disagree about a grouped category.
 * A flat category is the degenerate case: one untitled group.
 */
function categoryGroups(category: BuildCategory): readonly BuildGroup[] {
  return category.groups ?? [{ title: "", buildingIds: category.buildingIds ?? [] }];
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
export function buildingUnlockRequirement(stats: {
  readonly requiredAge?: BuildingBalance[string]["requiredAge"] | undefined;
  readonly requiredSettlementLevel?: number | undefined;
}): string {
  const ageLabel = stats.requiredAge === "town" ? "Kasaba" : "Yerleşim";
  const level = stats.requiredSettlementLevel ?? 1;
  // "Lv2 ile" rather than "Lv2'de": the locative harmonises with the level
  // number, so `'de` is right for Lv2 (ikide) and wrong for Lv3 (üçte → `'te`).
  // No building requires Lv3 today, which is exactly why the bug would have
  // arrived with a tuning pass rather than with a code change.
  return level > 1
    ? `${ageLabel} Lv${level} ile açılır.`
    : `${ageLabel} Çağında açılır.`;
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
  private activeCategory = "Ekonomi";
  /** The initial category settles instantly; only player-driven changes resize. */
  private categoryAnimationReady = false;
  private categoryAnimationToken = 0;
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

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onChooseRoad: () => void = () => {},
    private readonly onChooseRoadErase: () => void = () => {},
  ) {
    this.root.className = "rts-build-palette ui-interactive";
    this.root.setAttribute("aria-label", "Yapı yerleştirme");
    const title = document.createElement("strong");
    title.textContent = "Yapı Kur";
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
      ? [...BUILD_CATEGORIES, { title: "Diğer", buildingIds: uncategorised }]
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
      tab.textContent = category.title;
      tab.addEventListener("click", () => this.selectCategory(category.title));
      this.tabs.set(category.title, tab);
      tabRow.appendChild(tab);
      const panel = document.createElement("div");
      panel.className = "rts-build-choices rts-build-category-panel";
      panel.dataset.rtsBuildCategory = category.title;
      // Sub-headed categories nest one grid per group; flat ones keep the cards
      // as the panel's own children, so the card rules address them the same way
      // either side of the split.
      const grouped = groups.some((group) => group.title !== "");
      panel.classList.toggle("is-grouped", grouped);
      let lastGrid = panel;
      for (const group of groups) {
        let target = panel;
        if (grouped) {
          const section = document.createElement("div");
          section.className = "rts-build-group";
          const heading = document.createElement("p");
          heading.className = "rts-build-group-title";
          heading.textContent = group.title;
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
      this.categoryPanels.set(category.title, panel);
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
    button.setAttribute("aria-label", stats.label);
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
    label.textContent = stats.label;
    const cost = document.createElement("span");
    cost.className = "rts-build-choice-cost";
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
    const text = mode === "build" ? "Yol" : "Yol Sil";
    button.setAttribute("aria-label", text);
    const icon = document.createElement("img");
    icon.className = "rts-build-choice-icon";
    icon.src = mode === "build" ? PALETTE_ROAD_ICON : PALETTE_ROAD_ERASE_ICON;
    icon.alt = "";
    attachIconFallback(icon);
    const label = document.createElement("span");
    label.className = "rts-build-choice-label";
    label.textContent = text;
    const cost = document.createElement("span");
    cost.className = "rts-build-choice-cost";
    cost.textContent = mode === "build" ? "Odun / hücre" : "İade yok";
    button.append(icon, label, cost);
    button.addEventListener("click", mode === "build" ? this.onChooseRoad : this.onChooseRoadErase);
    this.roadButtons.set(mode, button);
    return button;
  }

  setState(state: BuildingPlacementState): void {
    this.roadHint.hidden = true;
    this.armedBuildingId = state.activeBuildingId;
    this.syncArmedButtons();
    if (!state.activeBuildingId) {
      this.status.textContent = "Bir yapı seçin.";
      return;
    }
    if (!state.result) {
      this.status.textContent = state.activeBuildingId === "outpost"
        ? "Karakolu kontrol alanının hemen dışındaki nötr bir konuma yerleştirin."
        : "Haritada konum seçin.";
      return;
    }
    if (state.result.valid) {
      this.status.textContent = "Geçerli konum — yerleştirmek için tıklayın.";
      return;
    }
    this.status.textContent = state.result.reason === "outside-map"
      ? "Geçersiz konum: harita sınırı dışında."
      : state.result.reason === "outside-control"
        ? "Geçersiz konum: bu alanın kontrolü sizde değil."
      : state.result.reason === "insufficient-resources"
        ? "Kaynak yetersiz: inşaat maliyeti ayrılmadı."
        : state.result.reason === "missing-forest"
          ? "Oduncu Kampı için yakında kesilebilir ağaç gerekir."
        : state.result.reason === "missing-game"
          ? "Avcı Kulübesi için yakında av hayvanı gerekir."
        : state.result.reason === "missing-livestock"
          ? "Ağıl için yakında evcilleştirilebilir hayvan gerekir."
          : state.result.reason === "missing-adjacent-building"
            ? "Değirmen, tamamlanmış dost bir Tarlaya bitişik kurulmalı."
          : state.result.reason === "enemy-occupied"
          ? "Geçersiz konum: alanda düşman birlikleri var."
        : state.result.reason === "missing-resource-node"
          ? "Geçersiz konum: Taş Ocağı veya Altın Madeni uygun kaynak düğümünü örtmeli."
        : "Geçersiz konum: engel veya yapı ile çakışıyor.";
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
    this.armedRoadMode = state.active ? state.mode : null;
    this.syncArmedButtons();
    if (!state.active) {
      this.status.textContent = "Bir yapı seçin.";
      this.roadHint.hidden = true;
      return;
    }
    this.roadHint.hidden = false;
    if (state.mode === "erase") {
      // The split warning is the §44 "bağlantı etkisi": it is the one erase whose
      // cost is not the tile itself, so it has to be readable before the click.
      this.status.textContent = "Yol siliniyor";
      this.roadHint.textContent = !state.target
        ? "Bir yol karosuna tıklayın · Sağ tık: çık"
        : state.target.splits
          ? "Uyarı: bu karo ağı ikiye böler · Tıkla: sil · İade yok"
          : "Tıkla: sil · İade yok";
      return;
    }
    this.status.textContent = state.start ? "Yol çiziliyor" : "Yol çizimi";
    this.roadHint.textContent = state.plan
      ? `Sol tık: yolu kur · ${state.plan.newCells.length} hücre · ${formatResourceCost(state.plan.cost)}`
      : state.reason === "invalid-route"
        ? "Geçersiz rota · başka kare seç"
        : state.reason === "insufficient-resources"
          ? "Kaynak yetersiz · rota çizilemedi"
          : state.start
            ? "Ucu seçin · Sol tık: yolu kur"
            : "Sol tık: başlangıç seç · Sağ tık: çık";
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
        : `Kaynak yetersiz: ${formatResourceCost(entry.price)} gerekir.`;
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
    for (const [category, panel] of this.categoryPanels) {
      if (panel.querySelector(`[data-rts-building="${CSS.escape(target)}"]`)) {
        this.selectCategory(category);
        return;
      }
    }
  }

  /** Persist completion/error feedback while placement hover state keeps changing. */
  setActionMessage(message: string | null): void {
    this.actionMessage.textContent = message ?? "";
  }

  toggleVisible(): void {
    this.root.hidden = !this.root.hidden;
  }

  selectCategoryByIndex(index: number): void {
    const title = [...this.tabs.keys()][index];
    if (!title) return;
    this.root.hidden = false;
    this.selectCategory(title);
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

  dispose(): void {
    this.root.remove();
  }
}

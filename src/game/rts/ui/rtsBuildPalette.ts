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
import { townUnlocksAvailable, type ProgressionSnapshot } from "../progression/kingdomProgressionSystem";
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
 * The Market sits under "Ekonomi" for the same reason, not because it produces:
 * it converts. The player reaching for it is asking "I need stone/gold I cannot
 * mine", which is the same question the producers answer — a "Ticaret" category
 * of one would split that decision across two lists to scan.
 */
interface BuildCategory {
  readonly title: string;
  readonly buildingIds: readonly string[];
  readonly includesRoad?: boolean;
}

const BUILD_CATEGORIES: readonly BuildCategory[] = [
  { title: "Ekonomi", buildingIds: ["farm", "lumber_camp", "quarry", "gold_mine", "market"] },
  { title: "Lojistik", buildingIds: ["depot", "outpost"], includesRoad: true },
  // The Tapınak files under "Yerleşim" rather than "Askerî": it trains nothing
  // and fires nothing — what it does is make a place worth standing in, which is
  // the same claim the House makes about ground the player has taken.
  { title: "Yerleşim", buildingIds: ["house", "temple"] },
  { title: "Askerî", buildingIds: ["barracks", "archery_range"] },
];

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly roadHint = document.createElement("p");
  private readonly buildButtons = new Map<
    string,
    {
      readonly button: HTMLButtonElement;
      readonly cost: HTMLSpanElement;
      readonly price: StartingResources;
      readonly requiredAge: BuildingBalance[string]["requiredAge"];
    }
  >();
  private affordabilitySignature = "";
  private readonly actionMessage = document.createElement("p");
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly categoryPanels = new Map<string, HTMLElement>();
  private activeCategory = "Ekonomi";
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
    const categorised = new Set(BUILD_CATEGORIES.flatMap((category) => category.buildingIds));
    const uncategorised = Object.keys(buildings)
      .filter((id) => id !== "command_center" && !categorised.has(id));
    const groups: readonly BuildCategory[] = uncategorised.length > 0
      ? [...BUILD_CATEGORIES, { title: "Diğer", buildingIds: uncategorised }]
      : BUILD_CATEGORIES;
    const tabRow = document.createElement("div");
    tabRow.className = "rts-build-tabs";
    this.root.appendChild(tabRow);
    const grid = document.createElement("div");
    grid.className = "rts-build-grid";
    this.root.appendChild(grid);
    for (const category of groups) {
      const ids = category.buildingIds.filter((id) => buildings[id]);
      if (ids.length === 0 && !category.includesRoad) continue;
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "rts-build-tab";
      tab.textContent = category.title;
      tab.addEventListener("click", () => this.selectCategory(category.title));
      this.tabs.set(category.title, tab);
      tabRow.appendChild(tab);
      const choices = document.createElement("div");
      choices.className = "rts-build-choices rts-build-category-panel";
      choices.dataset.rtsBuildCategory = category.title;
      for (const id of ids) {
        const stats = buildings[id]!;
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
        this.buildButtons.set(id, { button, cost, price: stats.cost, requiredAge: stats.requiredAge });
        choices.appendChild(button);
      }
      if (category.includesRoad) {
        const road = document.createElement("button");
        road.type = "button";
        road.className = "rts-build-choice";
        road.dataset.rtsBuilding = "road";
        road.setAttribute("aria-label", "Yol");
        const icon = document.createElement("img");
        icon.className = "rts-build-choice-icon";
        icon.src = PALETTE_ROAD_ICON;
        icon.alt = "";
        attachIconFallback(icon);
        const label = document.createElement("span");
        label.className = "rts-build-choice-label";
        label.textContent = "Yol";
        const cost = document.createElement("span");
        cost.className = "rts-build-choice-cost";
        cost.textContent = "Odun / hücre";
        road.append(icon, label, cost);
        road.addEventListener("click", this.onChooseRoad);
        this.roadButtons.set("build", road);
        choices.appendChild(road);
        // GDD 10 §44 "Yol Silme". Sits beside the tool that made the mistake,
        // because a paved tile reserves its ground: without this, a route drawn
        // across a stone or gold deposit locked that deposit out of the match.
        const erase = document.createElement("button");
        erase.type = "button";
        erase.className = "rts-build-choice";
        erase.dataset.rtsBuilding = "road-erase";
        erase.setAttribute("aria-label", "Yol Sil");
        const eraseIcon = document.createElement("img");
        eraseIcon.className = "rts-build-choice-icon";
        eraseIcon.src = PALETTE_ROAD_ERASE_ICON;
        eraseIcon.alt = "";
        attachIconFallback(eraseIcon);
        const eraseLabel = document.createElement("span");
        eraseLabel.className = "rts-build-choice-label";
        eraseLabel.textContent = "Yol Sil";
        const eraseCost = document.createElement("span");
        eraseCost.className = "rts-build-choice-cost";
        eraseCost.textContent = "İade yok";
        erase.append(eraseIcon, eraseLabel, eraseCost);
        erase.addEventListener("click", this.onChooseRoadErase);
        this.roadButtons.set("erase", erase);
        choices.appendChild(erase);
      }
      this.categoryPanels.set(category.title, choices);
      grid.appendChild(choices);
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
    this.setAgeState({ age: "settlement", upgrading: false });
    this.selectCategory(this.activeCategory);
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
        : state.result.reason === "enemy-occupied"
          ? "Geçersiz konum: alanda düşman birlikleri var."
        : state.result.reason === "missing-resource-node"
          ? "Geçersiz konum: Taş Ocağı veya Altın Madeni uygun kaynak düğümünü örtmeli."
        : "Geçersiz konum: engel veya yapı ile çakışıyor.";
  }

  /**
   * What the age milestone means, before the player owns a building to click.
   * The age resets every existing building to Level 1 and also opens any
   * building whose data declares Town as its first available age.
   */
  setAgeState(snapshot: Pick<ProgressionSnapshot, "age" | "upgrading">): void {
    for (const { button, requiredAge } of this.buildButtons.values()) {
      const locked = requiredAge === "town" && !townUnlocksAvailable(snapshot);
      button.disabled = locked;
      button.title = locked ? "Kasaba Çağında açılır." : "";
    }
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
          : "Tıkla: sil · Odun iadesi yok";
      return;
    }
    this.status.textContent = state.start ? "Yol çiziliyor" : "Yol çizimi";
    this.roadHint.textContent = state.plan
      ? `Sağ tık: bitir · ${state.plan.newCells.length} hücre · ${state.plan.woodCost} Odun`
      : state.reason === "invalid-route"
        ? "Geçersiz rota · başka kare seç"
        : state.reason === "insufficient-resources"
          ? "Kaynak yetersiz · rota çizilemedi"
          : state.start
            ? "Ucu seçin · Sağ tık: bitir"
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
      const affordable = canAffordCost(entry.price, stock);
      entry.button.classList.toggle("is-unaffordable", !affordable);
      entry.cost.classList.toggle("is-unaffordable", !affordable);
      entry.button.title = affordable ? "" : `Kaynak yetersiz: ${formatResourceCost(entry.price)} gerekir.`;
    }
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
    this.activeCategory = title;
    for (const [category, tab] of this.tabs) tab.setAttribute("aria-pressed", String(category === title));
    for (const [category, panel] of this.categoryPanels) panel.hidden = category !== title;
  }

  dispose(): void {
    this.root.remove();
  }
}

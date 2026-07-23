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
  readonly includesTempleSoon?: boolean;
}

const BUILD_CATEGORIES: readonly BuildCategory[] = [
  { title: "Ekonomi", buildingIds: ["farm", "lumber_camp", "quarry", "gold_mine", "market"] },
  { title: "Lojistik", buildingIds: ["depot", "outpost"], includesRoad: true },
  { title: "Yerleşim", buildingIds: ["house"], includesTempleSoon: true },
  { title: "Askerî", buildingIds: ["barracks", "archery_range"] },
];

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
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

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onChooseRoad: () => void = () => {},
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
        icon.src = "/assets/ui/icons/command-patrol.svg";
        icon.alt = "";
        const label = document.createElement("span");
        label.className = "rts-build-choice-label";
        label.textContent = "Yol";
        const cost = document.createElement("span");
        cost.className = "rts-build-choice-cost";
        cost.textContent = "Odun / hücre";
        road.append(icon, label, cost);
        road.addEventListener("click", this.onChooseRoad);
        choices.appendChild(road);
      }
      if (category.includesTempleSoon) {
        const temple = document.createElement("button");
        temple.type = "button";
        temple.className = "rts-build-choice is-coming-soon";
        temple.disabled = true;
        temple.setAttribute("aria-label", "Tapınak — Yakında");
        const icon = document.createElement("img");
        icon.className = "rts-build-choice-icon";
        icon.src = "/assets/ui/icons/building-command-center.svg";
        icon.alt = "";
        const label = document.createElement("span");
        label.className = "rts-build-choice-label";
        label.textContent = "Tapınak";
        const status = document.createElement("span");
        status.className = "rts-build-choice-cost";
        status.textContent = "Yakında";
        temple.append(icon, label, status);
        choices.appendChild(temple);
      }
      this.categoryPanels.set(category.title, choices);
      grid.appendChild(choices);
    }
    this.actionMessage.className = "rts-build-action-message";
    this.root.appendChild(this.actionMessage);
    this.status.className = "rts-build-status";
    this.root.appendChild(this.status);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setState({ activeBuildingId: null, result: null });
    this.setAgeState({ age: "settlement", upgrading: false });
    this.selectCategory(this.activeCategory);
  }

  setState(state: BuildingPlacementState): void {
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
    if (!state.active) {
      this.status.textContent = "Bir yapı seçin.";
      return;
    }
    this.status.textContent = state.plan
      ? `Yol rotası hazır. Bitirmek için sağ tık yapın · ${state.plan.newCells.length} hücre, ${state.plan.woodCost} Odun.`
      : "Yol başlangıcını sol tıkla seçin; bitirmek için sağ tık yapın.";
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

  private selectCategory(title: string): void {
    this.activeCategory = title;
    for (const [category, tab] of this.tabs) tab.setAttribute("aria-pressed", String(category === title));
    for (const [category, panel] of this.categoryPanels) panel.hidden = category !== title;
  }

  dispose(): void {
    this.root.remove();
  }
}

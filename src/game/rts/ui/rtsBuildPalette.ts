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
 * standing in for the map, the training verbs, the age, and the T2 upgrades. A
 * palette is where you buy a building you do not have yet; it is not where you
 * command the ones you do.
 *
 * The age snapshot is the one thing left that is not placement, and it earns its
 * place: it states the Town gate *before* the player owns any T2-capable
 * building to click, which no building's own panel can do.
 */
import type { BuildingBalance, StartingResources } from "../../data/gameDataTypes";
import { townUnlocksAvailable, type AgeSnapshot } from "../progression/ageSystem";
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
 */
interface BuildCategory {
  readonly title: string;
  readonly buildingIds: readonly string[];
}

const BUILD_CATEGORIES: readonly BuildCategory[] = [
  { title: "Ekonomi", buildingIds: ["farm", "lumber_camp", "quarry", "gold_mine"] },
  { title: "Lojistik", buildingIds: ["depot", "outpost"] },
  { title: "Yerleşim", buildingIds: ["house"] },
  { title: "Askerî", buildingIds: ["barracks"] },
];

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly townUnlocks = document.createElement("p");
  private readonly buildButtons = new Map<
    string,
    { readonly button: HTMLButtonElement; readonly cost: HTMLSpanElement; readonly price: StartingResources }
  >();
  private affordabilitySignature = "";
  private readonly actionMessage = document.createElement("p");

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onCancel: () => void,
    private readonly onCancelLatest: () => void,
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
    for (const category of groups) {
      const ids = category.buildingIds.filter((id) => buildings[id]);
      if (ids.length === 0) continue;
      const heading = document.createElement("p");
      heading.className = "rts-build-category";
      heading.textContent = category.title;
      this.root.appendChild(heading);
      const choices = document.createElement("div");
      choices.className = "rts-build-choices";
      for (const id of ids) {
        const stats = buildings[id]!;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rts-build-choice";
        button.dataset.rtsBuilding = id;
        // Keep the action's accessible name concise while the visual label shows
        // the explicit resource cost needed for faster purchase decisions.
        button.setAttribute("aria-label", stats.label);
        const label = document.createElement("span");
        label.className = "rts-build-choice-label";
        label.textContent = stats.label;
        const cost = document.createElement("span");
        cost.className = "rts-build-choice-cost";
        cost.textContent = formatResourceCost(stats.cost);
        button.append(label, cost);
        button.addEventListener("click", () => this.onChoose(id));
        this.buildButtons.set(id, { button, cost, price: stats.cost });
        choices.appendChild(button);
      }
      this.root.appendChild(choices);
    }
    const controls = document.createElement("div");
    controls.className = "rts-build-choices";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "İptal";
    cancel.addEventListener("click", this.onCancel);
    controls.appendChild(cancel);
    const cancelLatest = document.createElement("button");
    cancelLatest.type = "button";
    cancelLatest.textContent = "Son İnşaatı İptal";
    cancelLatest.addEventListener("click", this.onCancelLatest);
    controls.appendChild(cancelLatest);
    this.root.appendChild(controls);
    this.townUnlocks.className = "rts-build-age";
    this.root.appendChild(this.townUnlocks);
    this.actionMessage.className = "rts-build-action-message";
    this.root.appendChild(this.actionMessage);
    this.status.className = "rts-build-status";
    this.root.appendChild(this.status);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setState({ activeBuildingId: null, result: null });
    this.setAgeState({ age: "settlement", upgrading: false });
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
        : state.result.reason === "missing-resource-node"
          ? "Geçersiz konum: Taş Ocağı veya Altın Madeni uygun kaynak düğümünü örtmeli."
        : "Geçersiz konum: engel veya yapı ile çakışıyor.";
  }

  /**
   * What the Town age opens. The T2 *buttons* left for the buildings themselves
   * (§51) — an upgrade is started on the Barracks, not across the screen from it
   * — so what remains here is the one thing the buildings cannot say: that the
   * age is the gate, before the player owns any of them to click.
   */
  setAgeState(snapshot: Pick<AgeSnapshot, "age" | "upgrading">): void {
    const unlocked = townUnlocksAvailable(snapshot);
    const text = unlocked
      ? "Kasaba açılımları: T2 Ev, Depo, Kışla ve Karakol açık — yükseltmeyi binanın kendi panelinden başlatın."
      : snapshot.upgrading
        ? "Kasaba açılımları: yükseltme tamamlanınca T2 Ev, Depo, Kışla ve Karakol açılır."
        : "Kasaba açılımları: T2 Ev, Depo, Kışla ve Karakol için Kasaba Çağı gerekir.";
    if (this.townUnlocks.textContent !== text) this.townUnlocks.textContent = text;
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

  dispose(): void {
    this.root.remove();
  }
}



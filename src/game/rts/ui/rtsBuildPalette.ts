/**
 * Build/train action surface — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * Faz 2 opened this as "the build palette (not the final HUD)" and every slice
 * since hung its readout here, because it was the only panel that existed. Faz 9
 * gave the readouts a home of their own ({@link RtsHudBar}), so what is left is
 * what the name always promised: the actions, their costs, their locks, and the
 * reason an action is refused. State the player only *reads* belongs to the bar.
 *
 * Age is the one deliberate overlap: the panel does not print the age, but it
 * still consumes the snapshot, because the T2 buttons' locked/unlocked state is
 * an age fact and reading it here is what keeps a button from lying about it.
 *
 * The Faz 3 production readout is also gone. It was a button list that made the
 * player pick a Farm out of "Tarla #7, Tarla #12" — a list of ids standing in
 * for the map, because at the time buildings could not be clicked. §51's
 * selection slice made them clickable, so the same facts are now on
 * {@link RtsSelectionPanel}, reached by clicking the building they describe.
 */
import type { BuildingBalance } from "../../data/gameDataTypes";
import { townUnlocksAvailable, type AgeSnapshot } from "../progression/ageSystem";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";
import type { StructureUpgradeSnapshot } from "../structures/structureUpgradeSystem";
import { formatResourceCost } from "./resourceLabels";

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly townUnlocks = document.createElement("p");
  private readonly townStructureUpgradeButtons = new Map<string, HTMLButtonElement>();
  private readonly structureUpgradeStates = new Map<string, StructureUpgradeSnapshot>();
  private townUnlocksAreAvailable = false;
  private readonly actionMessage = document.createElement("p");

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onCancel: () => void,
    private readonly onCancelLatest: () => void,
    private readonly onUpgradeBarracks: () => void,
    private readonly onUpgradeHouse: () => void,
    private readonly onUpgradeDepot: () => void,
    private readonly onUpgradeOutpost: () => void,
  ) {
    this.root.className = "rts-build-palette ui-interactive";
    this.root.setAttribute("aria-label", "Yapı yerleştirme");
    const title = document.createElement("strong");
    title.textContent = "Yapı Kur";
    this.root.appendChild(title);
    const choices = document.createElement("div");
    choices.className = "rts-build-choices";
    for (const [id, stats] of Object.entries(buildings)) {
      if (id === "command_center") continue;
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
      choices.appendChild(button);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "İptal";
    cancel.addEventListener("click", this.onCancel);
    choices.appendChild(cancel);
    const cancelLatest = document.createElement("button");
    cancelLatest.type = "button";
    cancelLatest.textContent = "Son İnşaatı İptal";
    cancelLatest.addEventListener("click", this.onCancelLatest);
    choices.appendChild(cancelLatest);
    const barracksUpgrade = document.createElement("button");
    barracksUpgrade.type = "button";
    barracksUpgrade.textContent = "Kışlayı T2 Yükselt";
    barracksUpgrade.addEventListener("click", this.onUpgradeBarracks);
    this.townStructureUpgradeButtons.set("barracks", barracksUpgrade);
    choices.appendChild(barracksUpgrade);
    const houseUpgrade = document.createElement("button");
    houseUpgrade.type = "button";
    houseUpgrade.textContent = "Evi T2 Yükselt";
    houseUpgrade.addEventListener("click", this.onUpgradeHouse);
    this.townStructureUpgradeButtons.set("house", houseUpgrade);
    choices.appendChild(houseUpgrade);
    const depotUpgrade = document.createElement("button");
    depotUpgrade.type = "button";
    depotUpgrade.textContent = "Depoyu T2 Yükselt";
    depotUpgrade.addEventListener("click", this.onUpgradeDepot);
    this.townStructureUpgradeButtons.set("depot", depotUpgrade);
    choices.appendChild(depotUpgrade);
    const outpostUpgrade = document.createElement("button");
    outpostUpgrade.type = "button";
    outpostUpgrade.textContent = "Karakolu T2 Yükselt";
    outpostUpgrade.addEventListener("click", this.onUpgradeOutpost);
    this.townStructureUpgradeButtons.set("outpost", outpostUpgrade);
    choices.appendChild(outpostUpgrade);
    this.root.appendChild(choices);
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
   * Age drives which upgrades are legal, not what the age *is* — the bar prints
   * that. This keeps the T2 buttons and their explanation on the same snapshot.
   * "Kasaba Çağına Geç" itself left for the centre's own panel (§51): starting
   * an age is something the Merkez does, and it is the one building that can.
   */
  setAgeState(snapshot: Pick<AgeSnapshot, "age" | "upgrading">): void {
    const unlocked = townUnlocksAvailable(snapshot);
    this.townUnlocksAreAvailable = unlocked;
    this.refreshStructureUpgradeButtons();
    const text = unlocked
      ? "Kasaba acilimlari: T2 Ev, Depo, Kisla ve Karakol kullanilabilir."
      : snapshot.upgrading
        ? "Kasaba acilimlari: yukseltme tamamlaninca T2 Ev, Depo, Kisla ve Karakol acilir."
        : "Kasaba acilimlari: T2 Ev, Depo, Kisla ve Karakol icin Kasaba Cagi gerekir.";
    if (this.townUnlocks.textContent !== text) this.townUnlocks.textContent = text;
  }

  /** Reflect the type-wide T2 research state without hiding the available upgrade paths. */
  setStructureUpgradeState(buildingId: string, snapshot: StructureUpgradeSnapshot): void {
    this.structureUpgradeStates.set(buildingId, snapshot);
    this.refreshStructureUpgradeButtons();
  }

  /** Persist completion/error feedback while placement hover state keeps changing. */
  setActionMessage(message: string | null): void {
    this.actionMessage.textContent = message ?? "";
  }

  dispose(): void {
    this.root.remove();
  }

  private refreshStructureUpgradeButtons(): void {
    for (const [buildingId, button] of this.townStructureUpgradeButtons) {
      const snapshot = this.structureUpgradeStates.get(buildingId);
      const disabled = !this.townUnlocksAreAvailable || snapshot?.upgrading === true || snapshot?.completed === true;
      button.disabled = disabled;
      button.title = !this.townUnlocksAreAvailable
        ? "Kasaba Cagi tamamlandiktan sonra acilir."
        : snapshot?.upgrading
          ? "Bu bina turunun T2 yukseltmesi suruyor."
          : snapshot?.completed
            ? "Bu bina turunun T2 yukseltmesi tamamlandi."
            : "";
    }
  }
}



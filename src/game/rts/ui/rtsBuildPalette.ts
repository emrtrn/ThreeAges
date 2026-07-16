/** Minimal Phase 2 build-mode control surface (not the final HUD). */
import type { AgeBalance, BuildingBalance, UnitBalanceStats } from "../../data/gameDataTypes";
import { townUnlocksAvailable, type AgeSnapshot } from "../progression/ageSystem";
import type { EconomyBuildingSnapshot } from "../economy/economyProductionSystem";
import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";
import type { StructureUpgradeSnapshot } from "../structures/structureUpgradeSystem";

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly resources = document.createElement("p");
  private readonly workers = document.createElement("p");
  private readonly population = document.createElement("p");
  private readonly income = document.createElement("p");
  private readonly age = document.createElement("p");
  private readonly townUnlocks = document.createElement("p");
  private readonly townUpgradeButton = document.createElement("button");
  private readonly trainChoices = document.createElement("div");
  private readonly trainButtons = new Map<string, HTMLButtonElement>();
  private trainSignature = "";
  private readonly townStructureUpgradeButtons = new Map<string, HTMLButtonElement>();
  private readonly structureUpgradeStates = new Map<string, StructureUpgradeSnapshot>();
  private townUnlocksAreAvailable = false;
  private readonly producerPanel = document.createElement("section");
  private readonly producerChoices = document.createElement("div");
  private readonly producerDetails = document.createElement("p");
  private readonly actionMessage = document.createElement("p");
  private selectedProducerId: number | null = null;
  private producerSignature = "";
  private producers: readonly EconomyBuildingSnapshot[] = [];
  private readonly logisticsStatuses = new Map<number, ProducerLogisticsStatus>();

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onCancel: () => void,
    private readonly onCancelLatest: () => void,
    private readonly onTrainUnit: (unitId: string) => void,
    private readonly onTrainWorker: () => void,
    private readonly onSetRallyPoint: () => void,
    private readonly onStartTownUpgrade: () => void,
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
      cost.textContent = formatBuildingCost(stats.cost);
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
    this.trainChoices.className = "rts-train-choices";
    choices.appendChild(this.trainChoices);
    const trainWorker = document.createElement("button");
    trainWorker.type = "button";
    trainWorker.textContent = "İşçi Üret";
    trainWorker.addEventListener("click", this.onTrainWorker);
    choices.appendChild(trainWorker);
    const rallyPoint = document.createElement("button");
    rallyPoint.type = "button";
    rallyPoint.textContent = "Toplanma Noktası";
    rallyPoint.title = "Kışladan çıkan birliklerin gideceği noktayı haritada seçin.";
    rallyPoint.addEventListener("click", this.onSetRallyPoint);
    choices.appendChild(rallyPoint);
    this.townUpgradeButton.type = "button";
    const townUpgrade = this.townUpgradeButton;
    townUpgrade.textContent = "Kasaba Çağına Geç";
    this.townUpgradeButton.addEventListener("click", this.onStartTownUpgrade);
    choices.appendChild(this.townUpgradeButton);
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
    this.resources.className = "rts-build-resources";
    this.root.appendChild(this.resources);
    this.workers.className = "rts-build-workers";
    this.root.appendChild(this.workers);
    this.population.className = "rts-build-population";
    this.root.appendChild(this.population);
    this.income.className = "rts-build-income";
    this.root.appendChild(this.income);
    this.age.className = "rts-build-age";
    this.root.appendChild(this.age);
    this.townUnlocks.className = "rts-build-age";
    this.root.appendChild(this.townUnlocks);
    this.producerPanel.className = "rts-production-panel";
    const producerTitle = document.createElement("strong");
    producerTitle.textContent = "Üretim Yapısı";
    this.producerPanel.appendChild(producerTitle);
    this.producerChoices.className = "rts-production-choices";
    this.producerPanel.appendChild(this.producerChoices);
    this.producerDetails.className = "rts-production-details";
    this.producerPanel.appendChild(this.producerDetails);
    this.root.appendChild(this.producerPanel);
    this.actionMessage.className = "rts-build-action-message";
    this.root.appendChild(this.actionMessage);
    this.status.className = "rts-build-status";
    this.root.appendChild(this.status);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setState({ activeBuildingId: null, result: null });
    this.setTownUnlockState({ age: "settlement", upgrading: false });
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

  setResources(resources: Readonly<Record<string, number>>): void {
    const labels: Record<string, string> = { food: "Yiyecek", wood: "Odun", stone: "Taş", gold: "Altın" };
    this.resources.textContent = Object.entries(resources)
      .map(([id, amount]) => `${labels[id] ?? id}: ${formatInventoryAmount(amount)}`)
      .join(" · ");
  }

  setIdleWorkerCount(count: number): void {
    const text = `Boşta işçi: ${count}`;
    if (this.workers.textContent !== text) this.workers.textContent = text;
  }

  setPopulation(used: number, capacity: number): void {
    const text = `Nüfus: ${used}/${capacity}`;
    if (this.population.textContent !== text) this.population.textContent = text;
  }

  setIncomeRates(rates: Readonly<Record<string, number>>): void {
    const labels: Record<string, string> = { food: "Yiyecek", wood: "Odun", stone: "Taş", gold: "Altın" };
    this.income.textContent = `Gelir: ${Object.entries(rates)
      .map(([id, amount]) => `${labels[id] ?? id} +${amount.toFixed(1)}/dk`)
      .join(" · ")}`;
  }

  /** Compact progression status; the button remains the explicit player action. */
  setAge(snapshot: AgeSnapshot, balance: AgeBalance): void {
    const text = snapshot.upgrading
      ? `Çağ: ${balance.settlement.label} → ${balance.town.label} (${Math.ceil(snapshot.remainingSeconds)} sn)`
      : `Çağ: ${snapshot.age === "town" ? balance.town.label : balance.settlement.label}`;
    if (this.age.textContent !== text) this.age.textContent = text;
    this.setTownUnlockState(snapshot);
  }

  private setTownUnlockState(snapshot: Pick<AgeSnapshot, "age" | "upgrading">): void {
    const unlocked = townUnlocksAvailable(snapshot);
    this.townUnlocksAreAvailable = unlocked;
    this.refreshStructureUpgradeButtons();
    this.townUpgradeButton.disabled = snapshot.upgrading || snapshot.age === "town";
    this.townUpgradeButton.title = snapshot.upgrading
      ? "Kasaba Cagi yukseltmesi suruyor."
      : snapshot.age === "town" ? "Kasaba Cagi zaten tamamlandi." : "";
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

  /** Render a compact, explicitly selectable view of completed production sites. */
  setProductionBuildings(producers: readonly EconomyBuildingSnapshot[]): void {
    this.producers = producers;
    if (!producers.some((producer) => producer.structureId === this.selectedProducerId)) {
      this.selectedProducerId = producers[0]?.structureId ?? null;
    }
    const signature = producers.map((producer) => `${producer.structureId}:${producer.structureLabel}`).join("|");
    if (signature !== this.producerSignature) {
      this.producerSignature = signature;
      this.producerChoices.replaceChildren();
      for (const producer of producers) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${producer.structureLabel} #${producer.structureId}`;
        button.addEventListener("click", () => {
          this.selectedProducerId = producer.structureId;
          this.renderSelectedProducer();
        });
        this.producerChoices.appendChild(button);
      }
    }
    this.renderSelectedProducer();
  }

  setProductionLogistics(statuses: ReadonlyMap<number, ProducerLogisticsStatus>): void {
    this.logisticsStatuses.clear();
    for (const [structureId, status] of statuses) this.logisticsStatuses.set(structureId, status);
    this.renderSelectedProducer();
  }

  /**
   * Render one button per Barracks-trainable unit. A locked unit stays visible
   * and disabled rather than hidden: the player needs to see that Barracks II
   * is what an Archer costs, which is a reason to upgrade (plan §45).
   */
  setTrainableUnits(
    units: readonly { readonly id: string; readonly stats: UnitBalanceStats; readonly unlocked: boolean }[],
  ): void {
    const signature = units.map((unit) => `${unit.id}:${unit.unlocked}`).join("|");
    if (signature === this.trainSignature) return;
    this.trainSignature = signature;
    this.trainChoices.replaceChildren();
    this.trainButtons.clear();
    for (const { id, stats, unlocked } of units) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rts-train-choice";
      button.dataset.rtsUnit = id;
      button.setAttribute("aria-label", `${stats.label} üret`);
      const label = document.createElement("span");
      label.className = "rts-train-choice-label";
      label.textContent = `${stats.label} Üret`;
      const cost = document.createElement("span");
      cost.className = "rts-train-choice-cost";
      cost.textContent = `${formatBuildingCost(stats.cost)} · ${stats.populationCost} Nüfus`;
      button.append(label, cost);
      button.disabled = !unlocked;
      button.title = unlocked
        ? `${stats.label}: ${stats.trainingSeconds} sn`
        : `${stats.label} için Kışla T${stats.requiredBuildingLevel} gerekir.`;
      button.addEventListener("click", () => this.onTrainUnit(id));
      this.trainButtons.set(id, button);
      this.trainChoices.appendChild(button);
    }
  }

  /** Persist completion/error feedback while placement hover state keeps changing. */
  setActionMessage(message: string | null): void {
    this.actionMessage.textContent = message ?? "";
  }

  private renderSelectedProducer(): void {
    const selected = this.producers.find((producer) => producer.structureId === this.selectedProducerId);
    if (!selected) {
      this.producerPanel.hidden = true;
      return;
    }
    this.producerPanel.hidden = false;
    for (const button of this.producerChoices.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.textContent === `${selected.structureLabel} #${selected.structureId}`));
    }
    this.producerDetails.textContent = [
      `İşçiler: ${selected.assignedWorkers}/${selected.workerCapacity} (${selected.workingWorkers} çalışıyor)`,
      `Üretim: ${selected.productionPerMinute.toFixed(1)} ${selected.resourceId}/dk`,
      `Yerel tampon: ${selected.localBuffer.toFixed(1)}/${selected.localBufferCapacity}`,
      selected.sourceRemaining === null ? null : `Düğüm: ${selected.sourceRemaining.toFixed(1)} kaldı`,
      `Durum: ${selected.status}`,
      `Lojistik: ${formatLogisticsStatus(this.logisticsStatuses.get(selected.structureId))}`,
    ].filter((part): part is string => part !== null).join(" · ");
    this.producerDetails.title = logisticsReason(this.logisticsStatuses.get(selected.structureId));
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

function formatLogisticsStatus(status: ProducerLogisticsStatus | undefined): string {
  const labels: Record<ProducerLogisticsStatus, string> = {
    linked: "Bağlı",
    "outside-control": "Kontrol Dışı",
    "unlinked-road": "Yol Yok",
    "unlinked-depot": "Depo Yok",
    "depot-occupied": "Depo İşgal Altında",
  };
  return status ? labels[status] : "Bekleniyor";
}

function logisticsReason(status: ProducerLogisticsStatus | undefined): string {
  const reasons: Record<ProducerLogisticsStatus, string> = {
    linked: "Bu üretim yapısı, aynı yol ağındaki Depoya bağlı.",
    "outside-control": "Kontrol alanı kaybedildi; Karakolu veya alanı geri alın.",
    "unlinked-road": "Yapı footprint’ine temas eden bir yol hücresi gerekli.",
    "unlinked-depot": "Aynı yol ağında tamamlanmış bir Depo gerekli.",
    "depot-occupied": "Bağlı Depo düşman işgali altında; işgali kaldırın.",
  };
  return status ? reasons[status] : "Yapı tamamlanınca lojistik bağlantısı hesaplanır.";
}

function formatBuildingCost(cost: Readonly<Record<string, number>>): string {
  const labels: Record<string, string> = { food: "Yiyecek", wood: "Odun", stone: "Taş", gold: "Altın" };
  const entries = Object.entries(cost).filter(([, amount]) => amount > 0);
  return entries.length === 0
    ? "Ücretsiz"
    : entries.map(([resourceId, amount]) => `${amount} ${labels[resourceId] ?? resourceId}`).join(" · ");
}

/** Stocks are accumulated as floats, but the player-facing inventory never overstates them. */
export function formatInventoryAmount(amount: number): number {
  return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}

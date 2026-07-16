/** Minimal Phase 2 build-mode control surface (not the final HUD). */
import type { AgeBalance, BuildingBalance } from "../../data/gameDataTypes";
import type { AgeSnapshot } from "../progression/ageSystem";
import type { EconomyBuildingSnapshot } from "../economy/economyProductionSystem";
import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly resources = document.createElement("p");
  private readonly workers = document.createElement("p");
  private readonly population = document.createElement("p");
  private readonly income = document.createElement("p");
  private readonly age = document.createElement("p");
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
    private readonly onTrainGuard: () => void,
    private readonly onTrainWorker: () => void,
    private readonly onStartTownUpgrade: () => void,
    private readonly onUpgradeBarracks: () => void,
    private readonly onUpgradeHouse: () => void,
    private readonly onUpgradeDepot: () => void,
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
    const trainGuard = document.createElement("button");
    trainGuard.type = "button";
    trainGuard.textContent = "Muhafız Üret";
    trainGuard.addEventListener("click", this.onTrainGuard);
    choices.appendChild(trainGuard);
    const trainWorker = document.createElement("button");
    trainWorker.type = "button";
    trainWorker.textContent = "İşçi Üret";
    trainWorker.addEventListener("click", this.onTrainWorker);
    choices.appendChild(trainWorker);
    const townUpgrade = document.createElement("button");
    townUpgrade.type = "button";
    townUpgrade.textContent = "Kasaba Çağına Geç";
    townUpgrade.addEventListener("click", this.onStartTownUpgrade);
    choices.appendChild(townUpgrade);
    const barracksUpgrade = document.createElement("button");
    barracksUpgrade.type = "button";
    barracksUpgrade.textContent = "Kışlayı T2 Yükselt";
    barracksUpgrade.addEventListener("click", this.onUpgradeBarracks);
    choices.appendChild(barracksUpgrade);
    const houseUpgrade = document.createElement("button");
    houseUpgrade.type = "button";
    houseUpgrade.textContent = "Evi T2 Yükselt";
    houseUpgrade.addEventListener("click", this.onUpgradeHouse);
    choices.appendChild(houseUpgrade);
    const depotUpgrade = document.createElement("button");
    depotUpgrade.type = "button";
    depotUpgrade.textContent = "Depoyu T2 Yükselt";
    depotUpgrade.addEventListener("click", this.onUpgradeDepot);
    choices.appendChild(depotUpgrade);
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
      .map(([id, amount]) => `${labels[id] ?? id}: ${amount}`)
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

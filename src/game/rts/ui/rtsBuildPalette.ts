/** Minimal Phase 2 build-mode control surface (not the final HUD). */
import type { BuildingBalance } from "../../data/gameDataTypes";
import type { EconomyBuildingSnapshot } from "../economy/economyProductionSystem";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly resources = document.createElement("p");
  private readonly workers = document.createElement("p");
  private readonly population = document.createElement("p");
  private readonly income = document.createElement("p");
  private readonly producerPanel = document.createElement("section");
  private readonly producerChoices = document.createElement("div");
  private readonly producerDetails = document.createElement("p");
  private readonly actionMessage = document.createElement("p");
  private selectedProducerId: number | null = null;
  private producerSignature = "";
  private producers: readonly EconomyBuildingSnapshot[] = [];

  constructor(
    buildings: BuildingBalance,
    private readonly onChoose: (id: string) => void,
    private readonly onCancel: () => void,
    private readonly onCancelLatest: () => void,
    private readonly onTrainGuard: () => void,
    private readonly onTrainWorker: () => void,
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
      button.textContent = stats.label;
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
    this.root.appendChild(choices);
    this.resources.className = "rts-build-resources";
    this.root.appendChild(this.resources);
    this.workers.className = "rts-build-workers";
    this.root.appendChild(this.workers);
    this.population.className = "rts-build-population";
    this.root.appendChild(this.population);
    this.income.className = "rts-build-income";
    this.root.appendChild(this.income);
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
      this.status.textContent = "Haritada konum seçin.";
      return;
    }
    if (state.result.valid) {
      this.status.textContent = "Geçerli konum — yerleştirmek için tıklayın.";
      return;
    }
    this.status.textContent = state.result.reason === "outside-map"
      ? "Geçersiz konum: harita sınırı dışında."
      : state.result.reason === "insufficient-resources"
        ? "Kaynak yetersiz: inşaat maliyeti ayrılmadı."
        : "Geçersiz konum: engel veya yapı ile çakışıyor.";
  }

  setResources(resources: Readonly<Record<string, number>>): void {
    const labels: Record<string, string> = { food: "Yiyecek", wood: "Odun" };
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
    const labels: Record<string, string> = { food: "Yiyecek", wood: "Odun" };
    this.income.textContent = `Gelir: ${Object.entries(rates)
      .map(([id, amount]) => `${labels[id] ?? id} +${amount.toFixed(1)}/dk`)
      .join(" · ")}`;
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
      `Durum: ${selected.status}`,
    ].join(" · ");
  }

  dispose(): void {
    this.root.remove();
  }
}

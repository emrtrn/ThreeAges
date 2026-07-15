/** Minimal Phase 2 build-mode control surface (not the final HUD). */
import type { BuildingBalance } from "../../data/gameDataTypes";
import type { BuildingPlacementState } from "../structures/buildingPlacementSystem";

export class RtsBuildPalette {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly resources = document.createElement("p");

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
    this.root.appendChild(choices);
    this.resources.className = "rts-build-resources";
    this.root.appendChild(this.resources);
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

  dispose(): void {
    this.root.remove();
  }
}

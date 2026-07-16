import type { RoadPlacementState } from "../roads/roadPlacementSystem";

/** Compact road-tool UI; placement remains entirely canvas-driven. */
export class RtsRoadControls {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("p");
  private readonly overlay = document.createElement("button");

  constructor(
    private readonly onBegin: () => void,
    private readonly onCancel: () => void,
    private readonly onToggleOverlay: () => void,
  ) {
    this.root.className = "rts-road-controls ui-interactive";
    this.root.setAttribute("aria-label", "Yol yerleştirme");
    const title = document.createElement("strong");
    title.textContent = "Yol";
    const begin = document.createElement("button");
    begin.type = "button";
    begin.textContent = "Yol Kur";
    begin.addEventListener("click", this.onBegin);
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Yolu İptal";
    cancel.addEventListener("click", this.onCancel);
    this.overlay.type = "button";
    this.overlay.textContent = "Ağ Görünümü";
    this.overlay.setAttribute("aria-pressed", "false");
    this.overlay.addEventListener("click", this.onToggleOverlay);
    this.status.className = "rts-road-status";
    this.root.append(title, begin, cancel, this.overlay, this.status);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    this.setState({ active: false, start: null, plan: null, reason: null });
  }

  setOverlayVisible(visible: boolean): void {
    this.overlay.setAttribute("aria-pressed", String(visible));
  }

  setState(state: RoadPlacementState): void {
    if (!state.active) {
      this.status.textContent = "Başlangıç ve bitiş seçerek rota çizin.";
      return;
    }
    if (state.reason === "choose-start") {
      this.status.textContent = "Yol başlangıcını seçin.";
      return;
    }
    if (state.reason === "invalid-route") {
      this.status.textContent = "Geçersiz rota: engel veya harita sınırı.";
      return;
    }
    if (state.reason === "insufficient-resources") {
      this.status.textContent = "Odun yetersiz: rota oluşturulamadı.";
      return;
    }
    const cost = state.plan?.woodCost ?? 0;
    this.status.textContent = state.plan
      ? `Rota: ${state.plan.newCells.length} yeni hücre · Maliyet: ${cost} Odun · Bitişi tıklayın.`
      : "Yol bitişini seçin.";
  }

  dispose(): void {
    this.root.remove();
  }
}

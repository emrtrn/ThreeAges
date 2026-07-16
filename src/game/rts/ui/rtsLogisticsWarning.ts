import type { ProducerLogisticsStatus } from "../economy/productionLogisticsSystem";

/** One compact warning for actionable production-route failures. */
export class RtsLogisticsWarning {
  private readonly root = document.createElement("aside");

  constructor() {
    this.root.className = "rts-logistics-warning ui-interactive";
    this.root.setAttribute("aria-live", "polite");
    this.root.hidden = true;
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  setStatuses(statuses: readonly ProducerLogisticsStatus[]): void {
    const status = statuses.find((candidate) => candidate !== "linked");
    if (!status) {
      this.root.hidden = true;
      return;
    }
    const messages: Record<Exclude<ProducerLogisticsStatus, "linked">, string> = {
      "outside-control": "Lojistik kesildi: üretim yapısı Kontrol Dışı.",
      "unlinked-road": "Lojistik kesildi: üretim yapısını yola bağlayın.",
      "unlinked-depot": "Lojistik kesildi: aynı yol ağında Depo yok.",
      "depot-occupied": "Lojistik kesildi: Depo düşman işgali altında.",
    };
    this.root.textContent = messages[status];
    this.root.hidden = false;
  }

  dispose(): void {
    this.root.remove();
  }
}

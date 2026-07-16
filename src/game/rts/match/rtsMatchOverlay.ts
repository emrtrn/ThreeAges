/** Minimal DOM presentation for the match result + restart loop. */
import type { RtsMatchOutcome } from "./rtsMatchState";

const RESULT_TEXT: Readonly<Record<Exclude<RtsMatchOutcome, "active">, {
  readonly title: string;
  readonly detail: string;
}>> = {
  victory: { title: "Zafer", detail: "Düşman merkezi yıkıldı." },
  defeat: { title: "Yenilgi", detail: "Merkeziniz yıkıldı." },
};

export class RtsMatchOverlay {
  private readonly root = document.createElement("div");

  constructor(onRestart: () => void) {
    this.root.className = "rts-match-overlay ui-interactive";
    this.root.innerHTML = `
      <section class="rts-match-card" role="status" aria-live="polite">
        <h1 data-rts-result-title>Zafer</h1>
        <p data-rts-result-detail>Düşman merkezi yıkıldı.</p>
        <button type="button" data-rts-restart>Yeniden Başlat</button>
      </section>`;
    const button = this.root.querySelector<HTMLButtonElement>("[data-rts-restart]");
    if (!button) throw new Error("RTS restart button was not created");
    button.addEventListener("click", onRestart);
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  /** Present a decided match. `active` is not a result and never reaches here. */
  showResult(outcome: Exclude<RtsMatchOutcome, "active">): void {
    const text = RESULT_TEXT[outcome];
    const title = this.root.querySelector<HTMLElement>("[data-rts-result-title]");
    const detail = this.root.querySelector<HTMLElement>("[data-rts-result-detail]");
    if (title) title.textContent = text.title;
    if (detail) detail.textContent = text.detail;
    this.root.classList.add("is-visible");
    this.root.querySelector<HTMLButtonElement>("[data-rts-restart]")?.focus();
  }

  hide(): void {
    this.root.classList.remove("is-visible");
  }

  dispose(): void {
    this.root.remove();
  }
}

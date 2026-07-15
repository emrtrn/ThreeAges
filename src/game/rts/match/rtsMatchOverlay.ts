/** Minimal DOM presentation for the Faz 1 victory + restart loop. */
export class RtsMatchOverlay {
  private readonly root = document.createElement("div");

  constructor(onRestart: () => void) {
    this.root.className = "rts-match-overlay ui-interactive";
    this.root.innerHTML = `
      <section class="rts-match-card" role="status" aria-live="polite">
        <h1>Zafer</h1>
        <p>Düşman merkezi yıkıldı.</p>
        <button type="button" data-rts-restart>Yeniden Başlat</button>
      </section>`;
    const button = this.root.querySelector<HTMLButtonElement>("[data-rts-restart]");
    if (!button) throw new Error("RTS restart button was not created");
    button.addEventListener("click", onRestart);
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  showVictory(): void {
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

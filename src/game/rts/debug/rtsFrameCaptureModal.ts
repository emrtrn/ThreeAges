/**
 * The captured-frame table: a centred, closable panel over a paused match.
 *
 * It renders a **frozen** capture and never updates while open — a paused match
 * costs nothing to simulate, so a live table would read every simulation row as
 * zero the instant it appeared. The pause exists so the numbers can be read,
 * not so they can be measured.
 */
import {
  formatRtsFrameCaptureText,
  type RtsFrameCapture,
  type RtsFrameCaptureRow,
} from "./rtsFrameCapture";

export interface RtsFrameCaptureModalOptions {
  /** Called when the player closes it — the app decides whether to resume. */
  readonly onClose: () => void;
}

export class RtsFrameCaptureModal {
  private readonly root = document.createElement("section");
  private readonly meta = document.createElement("p");
  private readonly body = document.createElement("tbody");
  private readonly copyButton = document.createElement("button");
  private capture: RtsFrameCapture | null = null;
  private copyResetHandle = 0;

  constructor(private readonly options: RtsFrameCaptureModalOptions) {
    this.root.className = "rts-frame-capture ui-interactive";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", "Kare maliyeti");
    this.root.hidden = true;

    const header = document.createElement("header");
    header.className = "rts-frame-capture-header";
    const title = document.createElement("h2");
    title.textContent = "Kare maliyeti";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "rts-frame-capture-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Kapat ve maça devam et");
    close.addEventListener("click", () => this.options.onClose());
    header.append(title, close);

    this.meta.className = "rts-frame-capture-meta";

    const table = document.createElement("table");
    table.className = "rts-frame-capture-table";
    const head = document.createElement("thead");
    head.innerHTML =
      "<tr><th scope=\"col\">İşlem</th><th scope=\"col\">Grup</th>" +
      "<th scope=\"col\">ms</th><th scope=\"col\">%</th>" +
      "<th scope=\"col\">ort</th><th scope=\"col\">tepe</th></tr>";
    table.append(head, this.body);

    const scroll = document.createElement("div");
    scroll.className = "rts-frame-capture-scroll";
    scroll.appendChild(table);

    const footer = document.createElement("footer");
    footer.className = "rts-frame-capture-footer";
    const note = document.createElement("p");
    // Both of these are ways to read the table wrong, so they are printed on it
    // rather than left to be remembered.
    note.innerHTML =
      "<strong>çizim</strong> = karenin GPU'ya gönderilme (CPU) süresi, GPU'nun çizim süresi değil. " +
      "<strong>tanı</strong> yalnızca debug rotasında vardır; oyun sürümünde bu maliyet yoktur.";
    this.copyButton.type = "button";
    this.copyButton.className = "rts-frame-capture-copy";
    this.copyButton.textContent = "Panoya kopyala";
    this.copyButton.addEventListener("click", () => void this.copyToClipboard());
    footer.append(note, this.copyButton);

    this.root.append(header, this.meta, scroll, footer);
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(capture: RtsFrameCapture): void {
    this.capture = capture;
    this.meta.textContent =
      `${capture.totalMs.toFixed(2)} ms toplam · ort ${capture.averageTotalMs.toFixed(2)} · ` +
      `tepe ${capture.maxTotalMs.toFixed(2)} (son ${capture.windowFrames} kare) · ` +
      `${capture.speed}X, ${capture.simulationSteps} simülasyon adımı · maç ${capture.matchSeconds.toFixed(1)} sn`;
    this.body.replaceChildren(...capture.rows.map((row) => this.renderRow(row)));
    this.resetCopyLabel();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.capture = null;
  }

  dispose(): void {
    if (this.copyResetHandle) clearTimeout(this.copyResetHandle);
    this.root.remove();
  }

  private renderRow(row: RtsFrameCaptureRow): HTMLTableRowElement {
    const tr = document.createElement("tr");
    tr.dataset.rtsCaptureKind = row.kind;
    const cells = [
      row.label,
      row.group ?? "—",
      row.frameMs.toFixed(2),
      `${(row.share * 100).toFixed(1)}%`,
      row.averageMs.toFixed(2),
      // A remainder has no meaningful peak: the group's worst frame and its
      // children's worst frames are not the same frame.
      row.maxMs > 0 ? row.maxMs.toFixed(2) : "—",
    ];
    for (const [index, text] of cells.entries()) {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.setAttribute("scope", "row");
      cell.textContent = text;
      tr.appendChild(cell);
    }
    // A single bar behind the row: the eye finds the expensive one before it has
    // finished reading any number.
    tr.style.setProperty("--rts-capture-share", `${(row.share * 100).toFixed(2)}%`);
    return tr;
  }

  private async copyToClipboard(): Promise<void> {
    if (!this.capture) return;
    const text = formatRtsFrameCaptureText(this.capture);
    try {
      await navigator.clipboard.writeText(text);
      this.flashCopyLabel("Kopyalandı");
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The capture is still worth having, so fall back to selecting it.
      this.flashCopyLabel("Kopyalanamadı — konsola yazıldı");
      console.info(text);
    }
  }

  private flashCopyLabel(text: string): void {
    this.copyButton.textContent = text;
    if (this.copyResetHandle) clearTimeout(this.copyResetHandle);
    this.copyResetHandle = window.setTimeout(() => this.resetCopyLabel(), 2000);
  }

  private resetCopyLabel(): void {
    if (this.copyResetHandle) clearTimeout(this.copyResetHandle);
    this.copyResetHandle = 0;
    this.copyButton.textContent = "Panoya kopyala";
  }
}

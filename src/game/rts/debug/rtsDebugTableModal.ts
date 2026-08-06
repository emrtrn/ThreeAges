/**
 * A centred, closable table over a paused match — the panel both the CPU frame
 * capture and the GPU sweep are shown in.
 *
 * It renders a **frozen** view and never updates while open. That is not a
 * shortcut: a paused match costs nothing to simulate, so a live CPU table would
 * read every simulation row as zero the instant it appeared. The pause exists so
 * the numbers can be read, not so they can be measured.
 */
import type { RtsDebugTableView } from "./rtsDebugTableView";

export interface RtsDebugTableModalOptions {
  /** Called when the player closes it — the app decides whether to resume. */
  readonly onClose: () => void;
}

export class RtsDebugTableModal {
  private readonly root = document.createElement("section");
  private readonly heading = document.createElement("h2");
  private readonly meta = document.createElement("p");
  private readonly head = document.createElement("thead");
  private readonly body = document.createElement("tbody");
  private readonly notes = document.createElement("div");
  private readonly copyButton = document.createElement("button");
  private view: RtsDebugTableView | null = null;
  private copyResetHandle = 0;

  constructor(private readonly options: RtsDebugTableModalOptions) {
    this.root.className = "rts-debug-table ui-interactive";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.hidden = true;

    const header = document.createElement("header");
    header.className = "rts-debug-table-header";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "rts-debug-table-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Kapat ve maça devam et");
    close.dataset.rtsDebugAction = "close-table";
    close.addEventListener("click", () => this.options.onClose());
    header.append(this.heading, close);

    this.meta.className = "rts-debug-table-meta";
    this.notes.className = "rts-debug-table-notes";

    const table = document.createElement("table");
    table.className = "rts-debug-table-grid";
    table.append(this.head, this.body);
    const scroll = document.createElement("div");
    scroll.className = "rts-debug-table-scroll";
    scroll.appendChild(table);

    const footer = document.createElement("footer");
    footer.className = "rts-debug-table-footer";
    this.copyButton.type = "button";
    this.copyButton.className = "rts-debug-table-copy";
    this.copyButton.addEventListener("click", () => void this.copyToClipboard());
    footer.append(this.notes, this.copyButton);

    this.root.append(header, this.meta, scroll, footer);
    const host = document.getElementById("ui-overlay") ?? document.body;
    host.appendChild(this.root);
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(view: RtsDebugTableView): void {
    this.view = view;
    this.root.setAttribute("aria-label", view.title);
    this.root.dataset.rtsDebugTable = view.title;
    this.heading.textContent = view.title;
    this.meta.textContent = view.meta;

    const headRow = document.createElement("tr");
    for (const column of view.columns) {
      const cell = document.createElement("th");
      cell.setAttribute("scope", "col");
      cell.dataset.align = column.align;
      cell.textContent = column.label;
      headRow.appendChild(cell);
    }
    this.head.replaceChildren(headRow);

    this.body.replaceChildren(...view.rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.rtsTableKind = row.kind;
      for (const [index, text] of row.cells.entries()) {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.setAttribute("scope", "row");
        cell.dataset.align = view.columns[index]?.align ?? "right";
        cell.textContent = text;
        tr.appendChild(cell);
      }
      // A bar behind the row: the expensive one is found before any number has
      // been read. Painted as a background gradient, so it costs no element.
      const share = Math.max(0, Math.min(1, row.share));
      tr.style.setProperty("--rts-table-share", `${(share * 100).toFixed(2)}%`);
      return tr;
    }));

    this.notes.replaceChildren(...view.notes.map((note) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = note;
      return paragraph;
    }));

    this.resetCopyLabel();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.view = null;
  }

  dispose(): void {
    if (this.copyResetHandle) clearTimeout(this.copyResetHandle);
    this.root.remove();
  }

  private async copyToClipboard(): Promise<void> {
    const view = this.view;
    if (!view) return;
    try {
      await navigator.clipboard.writeText(view.clipboardText);
      this.flashCopyLabel("Kopyalandı");
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // The measurement is still worth having, so it goes to the console.
      this.flashCopyLabel("Kopyalanamadı — konsola yazıldı");
      console.info(view.clipboardText);
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

/**
 * Boot / Level-travel loading overlay (Boot / Loading UX, P4.2–P4.4).
 *
 * A built-in, code-driven full-screen overlay mounted into `#ui-overlay` above
 * the gameplay UI. It shows a title, a progress bar, a phase status line and a
 * per-item detail line while a level's assets load, and an error state with a
 * Retry button when a boot/travel fails critically.
 *
 * Why built-in and not a `.ui.json` widget: the loading screen must render
 * *before any asset loads* (the manifest, UI defs and locale tables are
 * themselves fetched during boot), so it cannot depend on loading an authored
 * widget first. It stays generic — no game rules — and every `.forge-loading*`
 * class is override-friendly so a fork can restyle it. The runtime still mirrors
 * progress into the UI ViewModel (`loading.*` fields), so a fork that wants a
 * data-driven HUD element can bind those too.
 */

export class LoadingOverlay {
  private readonly root: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  private readonly errorBox: HTMLDivElement;
  private readonly errorMessage: HTMLDivElement;
  private readonly retryButton: HTMLButtonElement;
  private retryHandler: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.root = el("div", "forge-loading");
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    this.root.hidden = true;

    const panel = el("div", "forge-loading-panel");
    const title = el("div", "forge-loading-title");
    title.textContent = "Loading";

    const bar = el("div", "forge-loading-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    this.fill = el("div", "forge-loading-bar__fill");
    bar.appendChild(this.fill);

    this.status = el("div", "forge-loading-status");
    this.status.textContent = "Loading…";
    this.detail = el("div", "forge-loading-detail");
    this.detail.hidden = true;

    this.errorBox = el("div", "forge-loading-error");
    this.errorBox.hidden = true;
    this.errorMessage = el("div", "forge-loading-error-message");
    this.retryButton = document.createElement("button");
    this.retryButton.type = "button";
    this.retryButton.className = "forge-loading-retry";
    this.retryButton.textContent = "Retry";
    this.retryButton.addEventListener("click", this.handleRetry);
    this.errorBox.append(this.errorMessage, this.retryButton);

    panel.append(title, bar, this.status, this.detail, this.errorBox);
    this.root.appendChild(panel);
    host.appendChild(this.root);
  }

  get isVisible(): boolean {
    return !this.root.hidden;
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Sets the phase status line (e.g. "Loading models"). */
  setStatus(status: string): void {
    this.status.textContent = status;
  }

  /**
   * Updates the bar (0..1) and the per-item detail line. An empty detail hides
   * the line; the bar's ARIA value tracks the rounded percent.
   */
  setProgress(fraction: number, detail: string): void {
    const percent = Math.round(clamp01(fraction) * 100);
    this.fill.style.width = `${percent}%`;
    const bar = this.fill.parentElement;
    if (bar) bar.setAttribute("aria-valuenow", String(percent));
    if (detail) {
      this.detail.textContent = detail;
      this.detail.hidden = false;
    } else {
      this.detail.textContent = "";
      this.detail.hidden = true;
    }
  }

  /**
   * Switches the overlay to the error state: shows the message + Retry button,
   * wiring the button to `onRetry`. The overlay is shown if it was hidden.
   */
  showError(message: string, onRetry: () => void): void {
    this.retryHandler = onRetry;
    this.errorMessage.textContent = message;
    this.setStatus("Load failed");
    this.errorBox.hidden = false;
    this.show();
  }

  /** Leaves the error state (e.g. before a retry re-runs the load). */
  clearError(): void {
    this.retryHandler = null;
    this.errorBox.hidden = true;
    this.errorMessage.textContent = "";
  }

  dispose(): void {
    this.retryButton.removeEventListener("click", this.handleRetry);
    this.retryHandler = null;
    this.root.remove();
  }

  private readonly handleRetry = (): void => {
    const handler = this.retryHandler;
    if (handler) handler();
  };
}

function el(tag: "div", className: string): HTMLDivElement {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

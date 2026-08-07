/**
 * The RTS boot curtain
 * (`docs/planned/THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` Faz F1).
 *
 * What it hides is the plan's §2.2: the flat placeholder ground and the capsule
 * unit bodies. Both are deliberate fallbacks that must stay in the code — they
 * are what keeps a failed asset load playable — so the fix for "I can see the
 * placeholders" is to cover the moment they are on screen, not to delete them.
 *
 * The view is intentionally dumb: {@link ../loading/rtsLoadProgress} owns every
 * decision about what the bar means, and this file only renders the snapshot it
 * is handed.
 */
import type { RtsLoadProgressSnapshot } from "../loading/rtsLoadProgress";

/**
 * Background art, dropped in by the author (plan §10). Referenced before the
 * file exists on purpose: the CSS underneath paints a gradient, so a missing
 * file degrades to a plain dark curtain and the art goes live the moment it is
 * saved to this path — no code change in between. The cost is one 404 line in
 * the dev console until then.
 */
const LOADING_ART_URL = "/assets/ui/loading-background.jpg";

export class RtsLoadingScreen {
  private readonly root = document.createElement("div");
  private readonly bar = document.createElement("div");
  private readonly fill = document.createElement("span");
  private readonly status = document.createElement("p");
  private hideTimer = 0;
  private hidden = false;

  constructor() {
    this.root.className = "rts-loading-screen";
    // The witness the smoke suite waits on (plan §9): "the curtain is up" is
    // otherwise only expressible as a sleep, and a sleep is what makes a smoke
    // suite flaky on a slow CI box.
    this.root.dataset.rtsLoading = "loading";
    this.root.setAttribute("role", "status");
    this.root.setAttribute("aria-live", "polite");
    this.root.setAttribute("aria-busy", "true");

    const art = document.createElement("div");
    art.className = "rts-loading-art";
    art.style.backgroundImage = `url("${LOADING_ART_URL}")`;

    const panel = document.createElement("div");
    panel.className = "rts-loading-panel";

    const title = document.createElement("p");
    title.className = "rts-loading-title";
    title.textContent = "Yükleniyor";

    this.bar.className = "rts-loading-bar";
    this.bar.setAttribute("role", "progressbar");
    this.bar.setAttribute("aria-valuemin", "0");
    this.bar.setAttribute("aria-valuemax", "100");
    this.fill.className = "rts-loading-fill";
    this.bar.appendChild(this.fill);

    this.status.className = "rts-loading-status";
    this.status.dataset.rtsLoadingStatus = "";

    panel.append(title, this.bar, this.status);
    this.root.append(art, panel);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    // Rendered indeterminate from the first paint: at construction no loader has
    // reported a denominator yet, and showing a confident "%0" would claim a
    // measurement nobody has taken (plan T1).
    this.setProgress({ fraction: 0, determinate: false, complete: false });
  }

  setProgress(snapshot: RtsLoadProgressSnapshot): void {
    if (this.hidden) return;
    const percent = Math.round(snapshot.fraction * 100);
    this.bar.dataset.rtsLoadingMode = snapshot.determinate ? "determinate" : "indeterminate";
    if (snapshot.determinate) {
      this.fill.style.width = `${percent}%`;
      this.bar.setAttribute("aria-valuenow", String(percent));
      this.status.textContent = `%${percent}`;
    } else {
      // No width at all rather than a zero-width bar: the CSS animation owns the
      // fill in this mode, and an inline width would fight it.
      this.fill.style.removeProperty("width");
      this.bar.removeAttribute("aria-valuenow");
      this.status.textContent = "Hazırlanıyor…";
    }
  }

  /**
   * Lift the curtain. Idempotent because more than one thing can legitimately
   * decide the boot is over — completion, a failed load, or the timeout — and
   * whichever arrives first should win without the others having to check.
   */
  hide(): void {
    if (this.hidden) return;
    this.hidden = true;
    this.root.dataset.rtsLoading = "done";
    this.root.setAttribute("aria-busy", "false");
    this.root.classList.add("is-hiding");
    // Removed after the fade rather than on the transition event: a curtain that
    // never leaves the DOM keeps swallowing pointer events over the field, and
    // `transitionend` does not fire for a tab that was hidden mid-fade.
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      this.root.remove();
    }, RTS_LOADING_FADE_MS);
  }

  dispose(): void {
    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
    this.root.remove();
  }
}

/** Kept in step with the `.rts-loading-screen` transition in `style.css`. */
export const RTS_LOADING_FADE_MS = 420;

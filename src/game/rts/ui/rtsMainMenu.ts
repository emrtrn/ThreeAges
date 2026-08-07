/**
 * The main menu — `docs/planned/THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` Faz F2.
 *
 * This is the plan's whole point. The start card used to live inside `RtsApp`,
 * which meant the player answered "what kind of match?" *after* the entire match
 * had already been constructed behind them — seven awaits of balance data, an
 * Actor catalog and a Level, all spent staring at a bare canvas (plan §2.1), and
 * then any answer that disagreed with what had been built forced a
 * `location.reload()` and made them wait through it again (§2.3). Moving the card
 * in front of the app deletes both problems at once: nothing has been built yet,
 * so every answer is free.
 *
 * Deliberately kept as a *menu*, not a second `RtsMatchOverlay` mode. The overlay
 * is one card that blocks a field which already exists; this one has no field
 * behind it, so it owns the whole screen and the background art (§10) is the
 * screen rather than a scrim over a scene.
 *
 * It does keep the overlay's class names — `.rts-match-overlay`,
 * `.rts-match-card`, `.rts-match-actions` — and that is not laziness. Two things
 * hang off them: the modal skin, which the menu wants unchanged, and the smoke
 * suite, which finds the start button through them (plan §9). Reskinning the menu
 * separately would have cost a CSS copy and eight spec rewrites to look identical.
 */
import { RtsMatchSetup, type RtsMatchSetupValues } from "../match/rtsMatchSetup";

/**
 * Background art, dropped in by the author (plan §10). Referenced before the file
 * exists on purpose: the CSS underneath paints a gradient, so a missing file
 * degrades to a plain dark menu and the art goes live the moment it is saved to
 * this path — no code change in between. Same bargain as the loading curtain's.
 */
const MENU_ART_URL = "/assets/ui/menu-background.jpg";

export class RtsMainMenu {
  private readonly root = document.createElement("div");
  private readonly card = document.createElement("section");
  private readonly actions = document.createElement("div");
  private readonly startButton = document.createElement("button");
  private readonly setup: RtsMatchSetup;
  private disposed = false;

  constructor(initial: RtsMatchSetupValues) {
    this.setup = new RtsMatchSetup(initial);
    // `.rts-match-overlay` for the modal skin and the smoke hooks; `is-visible`
    // because unlike the overlay this one is never hidden — it is torn down.
    this.root.className = "rts-match-overlay rts-main-menu ui-interactive is-visible";
    this.root.dataset.rtsMainMenu = "";

    const art = document.createElement("div");
    art.className = "rts-main-menu-art";
    art.style.backgroundImage = `url("${MENU_ART_URL}")`;

    this.card.className = "rts-match-card rts-main-menu-card";
    this.card.dataset.tone = "neutral";
    // Focusable but not in the tab order: the menu wants the *card* to receive
    // focus on open (see `choose`), while Tab still lands on the start button.
    this.card.tabIndex = -1;

    const title = document.createElement("h1");
    title.textContent = "Sınır Krallıkları";
    const detail = document.createElement("p");
    detail.textContent = "Ekonomini kur, yolunu bağla ve düşman merkezini yık.";

    this.actions.className = "rts-match-actions";
    this.startButton.type = "button";
    this.startButton.textContent = "Maçı Başlat";
    this.startButton.dataset.rtsMatchAction = "start";
    this.startButton.dataset.primary = "true";
    this.actions.appendChild(this.startButton);

    this.card.append(title, detail, this.setup.element, this.actions);
    this.root.append(art, this.card);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
  }

  /**
   * Resolves with the player's setup when they commit, and never otherwise — a
   * menu with no "back" has nothing else to report.
   *
   * The menu removes itself from the DOM *synchronously*, inside the click
   * handler, before the promise resolves. That ordering is load-bearing: the
   * caller's next act is `new RtsApp(...)`, which mounts an overlay of its own
   * under the same `.rts-match-overlay` class, and two of them alive at once
   * would make every selector that matches it ambiguous.
   */
  choose(): Promise<RtsMatchSetupValues> {
    return new Promise((resolve) => {
      this.startButton.addEventListener("click", () => {
        if (this.disposed) return;
        const values = this.setup.values;
        this.dispose();
        resolve(values);
      }, { once: true });
      // Focus the card, not the button: a modal's first action is a shortcut
      // target, not an already-selected choice. Tab moves into the button and
      // then intentionally reveals its gold state — the same rule the match card
      // follows.
      this.card.focus({ preventScroll: true });
    });
  }

  dispose(): void {
    this.disposed = true;
    this.root.remove();
  }
}

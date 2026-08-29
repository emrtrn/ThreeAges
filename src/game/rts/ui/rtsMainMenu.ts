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
import { canPlayAudioFormat } from "@engine/audio/audioSubsystem";
import { onLocaleChanged, t } from "../../localization/LocalizationService";
import { RtsMatchSetup, type RtsMatchSetupValues } from "../match/rtsMatchSetup";
import { RtsLanguageSelect } from "./rtsLanguageSelect";
import { publicUrl } from "@engine/assets/publicUrl";

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
  private readonly title = document.createElement("h1");
  private readonly detail = document.createElement("p");
  private readonly setup: RtsMatchSetup;
  /**
   * The language picker (Localization Plan §27) lives here rather than only in
   * the pause menu because this is the first screen the game shows: a player
   * whose browser resolved a language they cannot read must be able to fix it
   * *before* committing to a match, not from a menu they have to start a match
   * to reach.
   */
  private readonly language = new RtsLanguageSelect("setup");
  /**
   * Shown only to a browser that cannot play the shipped audio format, and
   * absent from the DOM otherwise.
   *
   * The project ships Ogg Vorbis alone and WebKit refuses it (audio plan
   * §82.19), so Safari would run the whole game in silence. Supporting it means
   * a second encoding of 264 files, which is a scope decision that was made the
   * other way — and once "no sound here" is the accepted outcome, the only thing
   * left that would be *wrong* is not saying so. Silence with no explanation
   * reads as a broken build; a line that names the cause reads as a limitation.
   *
   * It belongs on this screen rather than in the match feed for the same reason
   * the language picker does: it is a fact about the browser, not about the
   * kingdom, and the player should have it before they commit to a match.
   */
  private readonly audioNotice: HTMLParagraphElement | null;
  private readonly stopLocaleWatch: () => void;
  private disposed = false;

  constructor(initial: RtsMatchSetupValues) {
    this.setup = new RtsMatchSetup(initial);
    // `.rts-match-overlay` for the modal skin and the smoke hooks; `is-visible`
    // because unlike the overlay this one is never hidden — it is torn down.
    this.root.className = "rts-match-overlay rts-main-menu ui-interactive is-visible";
    this.root.dataset.rtsMainMenu = "";

    const art = document.createElement("div");
    art.className = "rts-main-menu-art";
    art.style.backgroundImage = `url("${publicUrl(MENU_ART_URL)}")`;

    this.card.className = "rts-match-card rts-main-menu-card";
    this.card.dataset.tone = "neutral";
    // Focusable but not in the tab order: the menu wants the *card* to receive
    // focus on open (see `choose`), while Tab still lands on the start button.
    this.card.tabIndex = -1;

    this.title.textContent = t("menu.title");
    this.detail.textContent = t("menu.tagline");

    // The crest is intentionally decorative: the game title remains the screen's
    // only heading, while this gives the menu a proper heraldic focal point
    // without introducing a second, untranslated product name.
    const heading = document.createElement("header");
    heading.className = "rts-main-menu-heading";
    const crest = document.createElement("span");
    crest.className = "rts-main-menu-crest";
    crest.setAttribute("aria-hidden", "true");
    const crestMark = document.createElement("span");
    crestMark.className = "rts-main-menu-crest-mark";
    crest.appendChild(crestMark);
    heading.append(crest, this.title, this.detail);

    this.actions.className = "rts-match-actions";
    this.startButton.type = "button";
    this.startButton.textContent = t("menu.start_match");
    this.startButton.dataset.rtsMatchAction = "start";
    this.startButton.dataset.primary = "true";
    this.actions.appendChild(this.startButton);

    // Under the actions, not above them: the language is a setting about the
    // menu itself rather than one of the questions the card is asking, and
    // putting it in the setup block would make it look like a property of the
    // match about to be started.
    const footer = document.createElement("div");
    footer.className = "rts-main-menu-footer";
    footer.appendChild(this.language.element);

    // Asked once, here: `canPlayType` is a synchronous string answer and the
    // menu is the first thing built, so a browser that will be silent is known
    // before the player has spent anything on a match.
    if (canPlayAudioFormat()) {
      this.audioNotice = null;
    } else {
      this.audioNotice = document.createElement("p");
      this.audioNotice.className = "rts-main-menu-notice";
      this.audioNotice.dataset.rtsAudioNotice = "";
      this.audioNotice.textContent = t("menu.audio_unsupported");
      footer.prepend(this.audioNotice);
    }

    this.card.append(heading, this.setup.element, this.actions, footer);
    this.root.append(art, this.card);
    (document.getElementById("ui-overlay") ?? document.body).appendChild(this.root);
    // The menu is the only screen that can change its own language *while it is
    // the whole screen*, so it is the one that has to prove §13: nothing here is
    // rebuilt, every string is written again over the card the player is looking
    // at, and the match they had already set up is still set up.
    this.stopLocaleWatch = onLocaleChanged(() => this.applyLocale());
  }

  private applyLocale(): void {
    this.title.textContent = t("menu.title");
    this.detail.textContent = t("menu.tagline");
    this.startButton.textContent = t("menu.start_match");
    if (this.audioNotice) this.audioNotice.textContent = t("menu.audio_unsupported");
    this.setup.retranslate();
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
    this.stopLocaleWatch();
    this.language.dispose();
    this.root.remove();
  }
}

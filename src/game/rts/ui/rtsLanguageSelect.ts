/**
 * The language picker — Localization Plan §12.1, §13, §27.
 *
 * Faz 1 built a service that can change language without a reload and Faz 2
 * moved every visible string behind it, but nothing on screen ever called
 * `setLocale`: the game resolved a language at boot from `navigator.languages`
 * and then had no way to be told otherwise. This is that missing control, and it
 * is deliberately one component mounted twice rather than two pickers — a
 * language choice is one preference, and two implementations of it would be two
 * chances to persist it differently.
 *
 * Two things it does *not* do:
 *
 *  - **Translate the language names.** The options read `nativeName` from the
 *    registry, always: a player hunting for their language scans for the word
 *    they would write themselves. "Turkish" in an English list is useful to
 *    nobody who cannot already read English, and a player stranded in a language
 *    they cannot read is exactly who this control exists for.
 *  - **Offer the pseudo-locale.** `availableLocales()` is the registry's
 *    `enabled` set, and `qps-ploc` is not in it (Plan §20). It stays reachable
 *    through `?locale=qps-ploc`, and when it is active the picker admits so with
 *    a disabled row rather than silently showing the wrong language.
 */
import {
  activeLocale,
  availableLocales,
  changeLocale,
  onLocaleChanged,
  t,
} from "../../localization/LocalizationService";
import type { LocaleCode } from "../../localization/LocalizationTypes";

/**
 * Which host is mounting it. The picker has two homes with two established
 * shapes, and it borrows theirs rather than introducing a third:
 *
 *  - `setup` — the main menu card, where it sits beside the match-setup
 *    dropdowns and has to look like one of them.
 *  - `settings` — the pause card's settings block, a two-column grid of
 *    label-and-control rows.
 */
export type RtsLanguageSelectVariant = "setup" | "settings";

export class RtsLanguageSelect {
  readonly element = document.createElement("label");
  private readonly caption = document.createElement("span");
  private readonly select = document.createElement("select");
  private readonly stopLocaleWatch: () => void;
  /** The choice currently being loaded, so a second change cannot race it. */
  private applying: LocaleCode | null = null;

  constructor(variant: RtsLanguageSelectVariant = "setup") {
    this.element.className =
      variant === "settings"
        ? "rts-match-setting rts-language-select"
        : "rts-match-setup-field rts-language-select";
    this.caption.className =
      variant === "settings" ? "rts-match-setting-label" : "rts-match-setup-caption";
    this.select.dataset.rtsLanguage = "";

    this.select.addEventListener("change", () => {
      void this.apply(this.select.value);
    });

    if (variant === "settings") {
      const control = document.createElement("span");
      control.className = "rts-match-setting-control rts-language-select-control";
      control.appendChild(this.select);
      this.element.append(this.caption, control);
    } else {
      this.element.append(this.caption, this.select);
    }

    this.rebuildOptions();
    this.applyText();
    // Both hosts can be on screen while *another* surface changes the language
    // (the pause card is open behind nothing else, but `?locale=` and a future
    // second picker are both real), so the control follows the service rather
    // than assuming it is the only thing that moves it.
    this.stopLocaleWatch = onLocaleChanged(() => {
      this.rebuildOptions();
      this.applyText();
    });
  }

  /**
   * Re-resolve the caption and tooltip.
   *
   * Only these two: the option rows are native names and stay put in every
   * language, which is the whole point of reading them from the registry.
   */
  private applyText(): void {
    this.caption.textContent = t("common.language.label");
    this.element.title = t("common.language.hint");
  }

  /**
   * Rebuild the rows and select the active one.
   *
   * Rebuilt rather than merely re-selected because of the pseudo-locale row: it
   * exists only while a locale outside the offered set is active, so the list is
   * a function of the current locale and not a constant.
   */
  private rebuildOptions(): void {
    const current = activeLocale();
    this.select.replaceChildren();
    let offered = false;
    for (const descriptor of availableLocales()) {
      const option = document.createElement("option");
      option.value = descriptor.code;
      option.textContent = descriptor.nativeName;
      // Tell the browser what language this row is written in, so a CJK or
      // Cyrillic name is shaped and hyphenated by that language's rules rather
      // than by whatever the surrounding page happens to be (Plan §14.1).
      option.lang = descriptor.intlLocale;
      if (descriptor.code === current) offered = true;
      this.select.appendChild(option);
    }
    if (!offered) {
      // `?locale=qps-ploc` (or any forced, unshipped locale). Showing the first
      // real row selected would claim the game is speaking a language it is not,
      // and silently switching the player out of the locale they forced would
      // undo the thing they came to test.
      const option = document.createElement("option");
      option.value = current;
      option.textContent = current;
      option.disabled = true;
      this.select.insertBefore(option, this.select.firstChild);
    }
    this.select.value = current;
  }

  /**
   * Commit a choice.
   *
   * The control is disabled across the await because the bundle is a fetch: a
   * player who changes it twice in that window would otherwise queue two
   * switches whose order is decided by the network. On failure the service falls
   * back on its own and `rebuildOptions` puts the control back on whatever it
   * actually landed on — the picker never asserts a language the game is not
   * speaking.
   */
  private async apply(code: LocaleCode): Promise<void> {
    if (this.applying !== null || code === activeLocale()) return;
    this.applying = code;
    this.select.disabled = true;
    try {
      await changeLocale(code);
    } finally {
      this.applying = null;
      this.select.disabled = false;
      this.rebuildOptions();
    }
  }

  dispose(): void {
    this.stopLocaleWatch();
    this.element.remove();
  }
}

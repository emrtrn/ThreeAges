/**
 * Static text refresh — Localization Plan §13.
 *
 * Most of the HUD re-resolves its own text for free: the panels are pushed a
 * snapshot every frame and write their strings from it, so a language change is
 * visible on the next tick without anyone arranging it. What is left over is the
 * text written *once*, in a constructor — a panel's title, a tab's name, an aria
 * label — and that half has no frame to ride back in on.
 *
 * The pause card solved it first, by marking those elements with the key they
 * came from and sweeping the marks when the language changed. This is that trick
 * extracted, because the language picker (§27) turned a rare, developer-only
 * event into a control the player can reach in two clicks — and a HUD half in
 * the previous language is exactly what a picker makes visible.
 *
 * Marking, not re-building: a panel keeps its listeners, its scroll position and
 * its open category across a language change, because nothing is replaced.
 */
import { t } from "../../localization/LocalizationService";

/** Write `key`'s text into the element and remember the key for later sweeps. */
export function markStaticText(element: HTMLElement, key: string): void {
  element.dataset.rtsText = key;
  element.textContent = t(key);
}

/** Same, for a `title` tooltip. */
export function markStaticTitle(element: HTMLElement, key: string): void {
  element.dataset.rtsTitleText = key;
  element.title = t(key);
}

/**
 * Same, for `aria-label`.
 *
 * Worth marking even though nobody sees it: a screen-reader user is the one
 * player who cannot notice that a panel is still announcing itself in the
 * language they just left.
 */
export function markStaticAria(element: HTMLElement, key: string): void {
  element.dataset.rtsAriaText = key;
  element.setAttribute("aria-label", t(key));
}

/**
 * Re-resolve every marked element under `root`, `root` itself included.
 *
 * Cheap enough to call on any language change: this runs once per switch, not
 * per frame, and a HUD's static text is a few dozen nodes.
 */
export function refreshStaticText(root: HTMLElement): void {
  const visit = (element: HTMLElement): void => {
    const text = element.dataset.rtsText;
    if (text !== undefined) element.textContent = t(text);
    const title = element.dataset.rtsTitleText;
    if (title !== undefined) element.title = t(title);
    const aria = element.dataset.rtsAriaText;
    if (aria !== undefined) element.setAttribute("aria-label", t(aria));
  };
  visit(root);
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("[data-rts-text],[data-rts-title-text],[data-rts-aria-text]"))) {
    visit(element);
  }
}

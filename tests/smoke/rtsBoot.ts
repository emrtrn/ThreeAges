import { expect, type Page } from "@playwright/test";

/**
 * Shared RTS boot helpers for the smoke suite.
 *
 * The route now opens on a main menu rather than on a half-built match
 * (`src/game/rts/ui/rtsMainMenu.ts`, THREEAGES_RTS_MAIN_MENU_LOADING_PLAN Faz
 * F2), which moved the door every RTS spec goes through. Before F2, "Maçı Başlat"
 * was a button on a card inside a fully constructed `RtsApp`; after it, the same
 * button is the thing that *causes* `RtsApp` to be constructed. So the wait moved
 * with it: the boot to wait out is on the far side of the click, not the near one.
 *
 * Both halves stay explicit rather than collapsing into one `waitForSelector`.
 * Playwright's actionability check would eventually retry through a curtain, so
 * tests would mostly still pass — but the day they did not, the failure would read
 * "element intercepts pointer events" and point at a button, when what was
 * actually wrong was a slow load. Waiting for each phase by name is what keeps
 * that diagnosis one line long.
 */

/** The menu is up and its one button is real. */
export async function waitForRtsMenu(page: Page): Promise<void> {
  await expect(page.locator("[data-rts-main-menu]")).toBeVisible({ timeout: 30_000 });
}

/**
 * The match is built and on screen: `RtsApp` exists, and its curtain has opened.
 *
 * Only meaningful after the menu has been dismissed — before that there is no
 * `RtsApp`, and both checks below would either hang or pass vacuously.
 */
export async function waitForRtsBoot(page: Page): Promise<void> {
  // Proof RtsApp exists before asking about its curtain. `buildScene` stamps this
  // attribute; without the guard the check below could pass vacuously by running
  // in the window before the curtain was ever created.
  await expect(page.locator("#game-canvas"))
    .toHaveAttribute("data-rts-ground", /flat|landscape/, { timeout: 30_000 });
  // Absent *or* done: the curtain removes itself once its fade finishes, so both
  // readings mean the same thing to a caller about to click. Every curtain on the
  // page has to agree — the boot raises two of them in sequence (the menu's and
  // the match's), and for a moment during the handover both are in the DOM.
  await page.waitForFunction(
    () => {
      const curtains = [...document.querySelectorAll(".rts-loading-screen")];
      return curtains.every((curtain) => curtain.getAttribute("data-rts-loading") === "done");
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Go through the door a player goes through, and come back with a live match. */
export async function startRtsMatch(page: Page): Promise<void> {
  await waitForRtsMenu(page);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await waitForRtsBoot(page);
}

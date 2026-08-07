import { expect, type Page } from "@playwright/test";

/**
 * Shared RTS boot helpers for the smoke suite.
 *
 * The route grew a boot curtain (`src/game/rts/ui/rtsLoadingScreen.ts`,
 * THREEAGES_RTS_MAIN_MENU_LOADING_PLAN Faz F1): a full-screen layer that covers
 * the field — start card included — until the authored world and the Actor pack
 * have mounted and a frame with them in it has been drawn.
 *
 * That layer sits over "Maçı Başlat". Playwright's actionability check would
 * eventually retry through it, so tests would mostly still pass, but the failure
 * mode when they did not would be a bare "element intercepts pointer events"
 * pointing at the button rather than at the load that was actually slow. Waiting
 * for the curtain explicitly is what keeps that diagnosis one line long.
 */
export async function waitForRtsBoot(page: Page): Promise<void> {
  // Proof RtsApp exists before asking about its curtain. `buildScene` stamps this
  // attribute; without the guard the check below could pass vacuously by running
  // in the window before the curtain was ever created.
  await expect(page.locator("#game-canvas"))
    .toHaveAttribute("data-rts-ground", /flat|landscape/, { timeout: 30_000 });
  // Absent *or* done: the curtain removes itself once its fade finishes, so both
  // readings mean the same thing to a caller about to click.
  await page.waitForFunction(
    () => {
      const curtain = document.querySelector(".rts-loading-screen");
      return curtain === null || curtain.getAttribute("data-rts-loading") === "done";
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Wait out the boot curtain, then go through the door a player goes through. */
export async function startRtsMatch(page: Page): Promise<void> {
  await waitForRtsBoot(page);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
}

import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test("German is selectable from the menu and remains active in match settings", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // The URL starts the session in German; the picker must offer the same locale
  // as a normal supported choice, not as its disabled forced-locale escape row.
  await page.goto("/?rts&locale=de");
  await waitForRtsMenu(page);

  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("de");
  await expect(picker.locator('option[value="de"]')).toHaveText("Deutsch");
  await expect(menu.getByRole("button", { name: "Spiel starten", exact: true })).toBeVisible();

  // Exercise the player-facing runtime switch in both directions. The start
  // button is static menu text, so it proves the locale event retranslated an
  // already-open surface rather than merely changing the select's value.
  await picker.selectOption("tr");
  await expect(picker).toHaveValue("tr");
  await expect(menu.getByRole("button", { name: "Maçı Başlat", exact: true })).toBeVisible();
  await picker.selectOption("de");
  await expect(picker).toHaveValue("de");
  await expect(menu.getByRole("button", { name: "Spiel starten", exact: true })).toBeVisible();

  await menu.getByRole("button", { name: "Spiel starten", exact: true }).click();
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await expect(page.locator(".rts-language-select [data-rts-language]")).toHaveValue("de");
  await expect(page.locator(".rts-language-select")).toContainText("Sprache");

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.viewportWidth);

  await page.screenshot({ path: testInfo.outputPath("de-match-settings.png") });
  expect(errors).toEqual([]);
});

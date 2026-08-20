import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test.use({ viewport: { width: 1366, height: 768 } });

test("Russian is selectable, uses the Cyrillic font group, and remains active in match settings", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&locale=ru");
  await waitForRtsMenu(page);

  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("ru");
  await expect(picker.locator('option[value="ru"]')).toHaveText("Русский");
  await expect(menu.getByRole("button", { name: "Начать матч", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("html")).toHaveAttribute("data-locale-font-group", "latin-cyrillic");

  // Switching away and back proves the already-open menu re-translates and the
  // document-level font contract follows the active locale without a reload.
  await picker.selectOption("tr");
  await expect(picker).toHaveValue("tr");
  await expect(menu.getByRole("button", { name: "Maçı Başlat", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-locale-font-group", "latin");
  await picker.selectOption("ru");
  await expect(picker).toHaveValue("ru");
  await expect(menu.getByRole("button", { name: "Начать матч", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-locale-font-group", "latin-cyrillic");

  await menu.getByRole("button", { name: "Начать матч", exact: true }).click();
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await expect(page.locator(".rts-language-select [data-rts-language]")).toHaveValue("ru");
  await expect(page.locator(".rts-language-select")).toContainText("Язык");

  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.viewportWidth);

  await page.screenshot({ path: testInfo.outputPath("ru-match-settings.png") });
  expect(errors).toEqual([]);
});

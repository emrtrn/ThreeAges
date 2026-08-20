import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test("French is selectable and stays active in match settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&locale=fr");
  await waitForRtsMenu(page);
  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("fr");
  await expect(picker.locator('option[value="fr"]')).toHaveText("Français");
  const start = menu.getByRole("button", { name: "Démarrer la partie", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-language-select [data-rts-language]")).toHaveValue("fr");
  await expect(page.locator(".rts-language-select")).toContainText("Langue");
  expect(errors).toEqual([]);
});

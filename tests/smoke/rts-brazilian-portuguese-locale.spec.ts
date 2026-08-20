import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test("Brazilian Portuguese is selectable and stays active in match settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&locale=pt-BR");
  await waitForRtsMenu(page);
  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("pt-BR");
  await expect(picker.locator('option[value="pt-BR"]')).toHaveText("Português (Brasil)");
  const start = menu.getByRole("button", { name: "Iniciar partida", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-language-select [data-rts-language]")).toHaveValue("pt-BR");
  await expect(page.locator(".rts-language-select")).toContainText("Idioma");
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test("Spanish is selectable and stays active in match settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&locale=es-ES");
  await waitForRtsMenu(page);
  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("es-ES");
  await expect(picker.locator('option[value="es-ES"]')).toHaveText("Español (España)");
  const start = menu.getByRole("button", { name: "Iniciar partida", exact: true });
  await expect(start).toBeVisible();
  await start.click();
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-language-select [data-rts-language]")).toHaveValue("es-ES");
  await expect(page.locator(".rts-language-select")).toContainText("Idioma");
  expect(errors).toEqual([]);
});

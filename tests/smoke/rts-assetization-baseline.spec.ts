import { expect, test } from "@playwright/test";

/**
 * Assetization Faz A browser baseline.
 *
 * Later content-catalog and Actor Script work must not change the ordinary RTS
 * boot path merely by existing. Engine tests pin the flag resolver and legacy
 * authorities; this test is the browser-level witness that the default route
 * still starts a playable legacy match without runtime errors.
 */
test("Assetization Faz A: default RTS boot stays on the legacy visual path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  const contentAssetsEnabled = await page.evaluate(() => {
    const forge = (window as unknown as {
      __forge?: { config?: { flags?: { contentAssets?: unknown } } };
    }).__forge;
    return forge?.config?.flags?.contentAssets;
  });
  expect(contentAssetsEnabled, "the asset migration must stay opt-in during Faz A").toBe(false);

  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: active");

  expect(errors, "default RTS boot must not produce console errors").toEqual([]);
});

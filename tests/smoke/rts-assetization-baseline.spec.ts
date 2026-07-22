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

test("Assetization Faz C: the opt-in catalog loads Actor presentations without changing match boot", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug&flags=contentAssets");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-assets", "ready", { timeout: 30_000 });
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  const contentAssetsEnabled = await page.evaluate(() => {
    const forge = (window as unknown as {
      __forge?: { config?: { flags?: { contentAssets?: unknown } } };
    }).__forge;
    return forge?.config?.flags?.contentAssets;
  });
  expect(contentAssetsEnabled).toBe(true);

  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  expect(errors, "the catalog loader must not disturb the RTS match").toEqual([]);
});

test("Assetization Faz D: the opt-in authored Level drives the spatial layout of a live match", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Default boot resolves the legacy blockout — even though core_match now
  // carries a levelRef, the levelAssets gate keeps it opt-in.
  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "blockout");

  // With the flag on, the shipped RTS_CoreMatch Level loads and its markers
  // become the spatial authority for the whole match.
  await page.goto("/?rts&debug&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored", { timeout: 30_000 });
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: active");

  expect(errors, "the authored Level must adapt and boot a match without runtime errors").toEqual([]);
});

test("Assetization Faz C: Guard Actor Script is discoverable and opens from the Content Drawer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await page.locator("[data-content-search]").fill("BP_RTS_Guard");

  const guardActor = page.locator('[data-asset-path="assets/ThreeAges/Actors/Units/BP_RTS_Guard.actor.json"]');
  await expect(guardActor).toBeVisible();
  await guardActor.dblclick();
  await expect(page.locator(".as-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-as-title]")).toHaveText("BP_RTS_Guard");
  await expect(page.locator("[data-as-status]")).toHaveText("Ready.");

  expect(errors, "opening the authored Actor Script must not produce runtime errors").toEqual([]);
});

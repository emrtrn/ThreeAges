import { expect, test } from "@playwright/test";

test("River Water Details: selected Landscape exposes live water presentation controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/?editor&riverWaterDetailsSmoke=1");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const landscape = page.getByTestId("outliner-row").filter({ hasText: "Landscape" }).first();
  await expect(landscape).toBeVisible({ timeout: 30_000 });
  await landscape.click();
  await expect(page.locator("[data-river-water]").first()).toBeVisible();
  await expect(page.locator("[data-river-water-delete]")).toBeVisible();
  await expect(page.locator('[data-river-water-number="surfaceLevel"]')).toBeVisible();
  await expect(page.locator('[data-river-water-number="bedVisibility"]')).toBeVisible();
  await expect(page.locator('[data-river-water-number="absorptionDistance"]')).toBeVisible();
  await expect(page.locator('[data-river-water-number="foamIntensity"]')).toBeVisible();
  await expect(page.locator('[data-river-water-foam-add="point"]')).toBeVisible();
  await expect(page.locator('[data-river-water-profile-number]')).not.toHaveCount(0);
  await expect(page.locator('[data-river-water-reflection="reflectionMode"]')).toBeVisible();
  await expect(page.locator('[data-river-water-create]')).toBeVisible();

  await expect(page.locator('[data-river-water-number="flowSpeed"]')).toBeVisible();

  expect(errors).toEqual([]);
});

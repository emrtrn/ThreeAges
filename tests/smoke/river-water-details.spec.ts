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
  await expect(page.locator('[data-river-water-color="foamColor"]')).toBeVisible();
  await expect(page.locator('[data-river-water-number="foamOpacity"]')).toBeVisible();
  await expect(page.locator('[data-river-water-number="shoreWaveReach"]')).toBeVisible();
  await expect(page.locator('[data-river-water-foam-add="ring"]')).toBeVisible();
  await expect(page.locator('[data-river-water-foam-add="strip"]')).toHaveCount(0);
  await expect(page.locator('[data-river-water-foam-number$="positionX"]')).toHaveCount(0);
  await expect(page.locator('[data-river-water-foam-number$=":ringCount"]')).toHaveCount(0);
  await expect(page.locator('[data-river-water-profile-number]')).toHaveCount(0);
  await expect(page.locator('[data-river-water-reflection="reflectionMode"]')).toBeVisible();
  await expect(page.locator('[data-river-water-create]')).toBeVisible();

  await expect(page.locator('[data-river-water-number="flowSpeed"]')).toBeVisible();

  // Radial Foam is an explicit viewport-placement mode. Comparing the point count
  // before/after the canvas click proves this created a new authored point rather
  // than merely toggling the placement button or reading an inherited point.
  const foamStartGizmos = page.locator('[data-river-water-foam-select$=":start"]');
  const foamStartCount = await foamStartGizmos.count();
  await page.locator('[data-river-water-foam-add="ring"]').click();
  const viewport = page.getByTestId("forge-editor").locator("canvas");
  await expect(viewport).toBeVisible();
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Editor viewport canvas has no bounding box");
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(foamStartGizmos).toHaveCount(foamStartCount + 1);
  await expect(foamStartGizmos.last()).toBeVisible();

  // Radial Foam placement remains one undoable authoring command.
  await page.getByTestId("editor-undo").click();
  await expect(foamStartGizmos).toHaveCount(foamStartCount);
  await page.getByTestId("editor-redo").click();
  await expect(foamStartGizmos).toHaveCount(foamStartCount + 1);

  // The debounced save writes the temporary smoke level. Reloading proves the
  // point survives the same save/load path used by normal editor authoring.
  await page.waitForTimeout(750);
  await page.reload();
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("outliner-row").filter({ hasText: "Landscape" }).first().click();
  await expect(page.locator('[data-river-water-foam-select$=":start"]')).toHaveCount(foamStartCount + 1);

  expect(errors).toEqual([]);
});

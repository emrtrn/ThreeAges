import { expect, test } from "@playwright/test";

test("scene outliner smoke: filter, visibility, lock, and summary", async ({ page }) => {
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const rows = page.getByTestId("outliner-row");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const initialCount = await rows.count();
  await expect(page.getByTestId("outliner-summary")).toContainText(`${initialCount} actors`);

  const firstRow = rows.first();
  await firstRow.getByRole("button", { name: "Hide object" }).click();
  await expect(firstRow).toHaveClass(/is-hidden/);
  await firstRow.getByRole("button", { name: "Show object" }).click();
  await expect(firstRow).not.toHaveClass(/is-hidden/);

  await firstRow.getByRole("button", { name: "Lock object" }).click();
  await expect(firstRow.getByRole("button", { name: "Unlock object" })).toBeVisible();
  await firstRow.getByRole("button", { name: "Unlock object" }).click();
  await expect(firstRow.getByRole("button", { name: "Lock object" })).toBeVisible();

  await page.getByTestId("outliner-filter").click();
  const meshFilter = page.locator('[data-outliner-type-filter="mesh"]');
  const meshCount = await page.locator('[data-outliner-type="mesh"]').count();
  await meshFilter.uncheck();
  await expect(page.getByTestId("outliner-filter")).toHaveClass(/is-filtered/);
  await expect(rows).toHaveCount(initialCount - meshCount);
});

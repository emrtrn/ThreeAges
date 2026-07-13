import { expect, test } from "@playwright/test";

test("editor exposes generic Spline Actor point editing controls", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?editor&splinePointSmoke=1");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const details = page.locator('[data-inspector-pane="details"]');
  await page.getByTestId("add-actor-button").hover();
  await page.getByRole("button", { name: "Gameplay" }).hover();
  await page.locator("[data-add-spline]").click();
  await expect(details.getByRole("heading", { name: "Spline" })).toBeVisible();
  const pointButtons = details.locator("[data-spline-point]");
  const initialCount = await pointButtons.count();
  expect(initialCount).toBeGreaterThanOrEqual(2);

  await details.locator("[data-spline-point-add]").click();
  await expect(pointButtons).toHaveCount(initialCount + 1);
  await details.locator("[data-spline-point-type]").selectOption("linear");
  await expect(details.locator("[data-spline-point-type]")).toHaveValue("linear");
  await details.locator("[data-spline-split]").first().click();
  await expect(pointButtons).toHaveCount(initialCount + 2);

  expect(pageErrors).toEqual([]);
});

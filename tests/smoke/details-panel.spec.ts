import { expect, test } from "@playwright/test";

test("Details panel exposes redesigned transform and material controls", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("outliner-row").first()).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("add-actor-button").hover();
  await page.getByRole("button", { name: /^Shapes/ }).hover();
  await expect(page.getByTestId("add-shape-cube")).toBeVisible();
  await page.locator("#game-canvas").dispatchEvent("drop", {
    dataTransfer: await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.setData("application/x-3dgamedev-asset", "shape:cube");
      return data;
    }),
    clientX: 420,
    clientY: 320,
  });

  const details = page.locator('[data-inspector-pane="details"]');
  await expect(details.locator(".detail-heading")).toHaveCount(0);
  const sectionsToggle = details.locator("[data-details-sections-toggle]");
  await expect(sectionsToggle).toBeVisible();
  await expect(sectionsToggle).toHaveAttribute("aria-label", "Collapse all sections");
  await expect(details.locator(".detail-section-menu")).toHaveCount(0);
  await expect(details.locator("[data-add-component]")).toHaveCount(0);
  await expect(details.locator("[data-material-thumbnail]")).toBeVisible();

  const transform = details.locator('.detail-section[data-detail-section="transform"]');
  const toggle = transform.locator(".detail-section-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(transform.getByTestId("detail-px")).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(transform.getByTestId("detail-px")).toBeHidden();
  await toggle.click();
  await expect(transform.getByTestId("detail-px")).toBeVisible();

  await sectionsToggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sectionsToggle).toHaveAttribute("aria-label", "Expand all sections");
  await sectionsToggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const pivot = details.locator('.detail-section[data-detail-section="pivot"]');
  await expect(pivot.getByRole("button", { name: "Reset Pivot" })).toBeVisible();
  await expect(pivot.getByRole("button", { name: "Center Pivot" })).toBeVisible();
  await expect(pivot.getByRole("button", { name: "Use Base" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

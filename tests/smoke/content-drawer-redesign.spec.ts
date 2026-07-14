import { expect, test } from "@playwright/test";

test("Content Drawer exposes toolbar, breadcrumb, history, and view controls", async ({ page }) => {
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Content Drawer" }).click();

  const drawer = page.locator("[data-content-drawer]");
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.getByRole("button", { name: /Add/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /Import/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Save All" })).toBeVisible();
  await expect(drawer.locator("[data-content-item-count]")).toContainText(/items?/);
  await expect(drawer.locator(".content-breadcrumb").first()).toHaveText("All", { timeout: 30_000 });

  await drawer.locator("[data-content-add]").click();
  await expect(page.getByRole("button", { name: "New Folder" })).toBeVisible();
  await page.keyboard.press("Escape");

  await drawer.locator("[data-content-view]").click();
  await expect(drawer).toHaveAttribute("data-content-view", "small");

  await page.getByRole("button", { name: "Shapes" }).click();
  await expect(drawer.locator("[data-content-back]")).toBeEnabled();
  await drawer.locator("[data-content-back]").click();
  await expect(drawer.locator("[data-content-forward]")).toBeEnabled();
});

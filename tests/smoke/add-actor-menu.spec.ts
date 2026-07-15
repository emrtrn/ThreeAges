import { expect, test } from "@playwright/test";

test("Add Actor menu uses a flat hover-only category list", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const trigger = page.getByTestId("add-actor-button");
  const popover = page.locator("[data-add-actor-popover]");
  await expect(trigger).not.toHaveAttribute("title");
  await trigger.hover();
  await expect(popover).toBeVisible();

  await expect(popover.locator("[data-add-recent], .add-actor-section-title")).toHaveCount(0);
  const category = popover.getByRole("button", { name: /^Lights/ });
  await expect(category).toBeVisible();
  await expect(category).toHaveCSS("border-top-width", "0px");
  await expect(category).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await page.mouse.move(900, 700);
  await expect(popover).toBeHidden();
});

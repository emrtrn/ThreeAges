import { expect, test } from "@playwright/test";

test("Add Actor menu uses a flat hover-only category list", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".editor-topbar [title], .editor-topbar [data-tip]")).toHaveCount(0);

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

  const shapes = popover.getByRole("button", { name: /^Shapes/ });
  const volumes = popover.getByRole("button", { name: /^Volumes/ });
  expect(await shapes.locator("svg").innerHTML()).not.toBe(await volumes.locator("svg").innerHTML());

  await shapes.hover();
  const shapeRows = popover.locator('.add-actor-item[data-add-key^="shape:"]');
  await expect(shapeRows).toHaveCount(5);
  const shapeIcons = await shapeRows.locator("svg").evaluateAll((icons) =>
    icons.map((icon) => icon.innerHTML),
  );
  expect(new Set(shapeIcons).size).toBe(5);

  const gameplay = popover.getByRole("button", { name: /^Gameplay/ });
  await gameplay.hover();
  const targetPoint = popover.getByRole("button", { name: "Target Point" });
  const spline = popover.getByRole("button", { name: "Spline" });
  await expect(targetPoint).toBeVisible();
  await expect(spline).toBeVisible();
  expect(await targetPoint.locator("svg").innerHTML()).not.toBe(await spline.locator("svg").innerHTML());

  await page.mouse.move(900, 700);
  await expect(popover).toBeHidden();
});

test("Camera, view mode, Show, and Play menus use flat rows", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const cameraMenu = page.locator("[data-camera-popover]");
  await page.locator("[data-camera-button]").hover();
  await expect(cameraMenu).toBeVisible();
  await expect(cameraMenu.locator('[data-camera-view="perspective"]')).toHaveCSS(
    "border-top-width",
    "0px",
  );

  const viewModeMenu = page.locator("[data-viewmode-popover]");
  await page.locator("[data-viewmode-button]").hover();
  await expect(viewModeMenu).toBeVisible();
  await expect(viewModeMenu.locator('[data-view-mode="lit"]')).toHaveCSS(
    "border-top-width",
    "0px",
  );

  const showMenu = page.locator("[data-show-popover]");
  await page.locator("[data-show-button]").hover();
  await expect(showMenu).toBeVisible();
  await expect(showMenu.locator('[data-show-flag="collision"]')).toHaveCSS(
    "border-top-width",
    "0px",
  );

  await page.locator("[data-play-menu]").click();
  const playMenu = page.locator(".context-menu.play-options-menu");
  await expect(playMenu).toBeVisible();
  await expect(playMenu.getByRole("button", { name: "Play in New Tab" })).toHaveCSS(
    "border-top-width",
    "0px",
  );
});

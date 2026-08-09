import { expect, test } from "@playwright/test";

test("Content Drawer exposes toolbar, breadcrumb, history, and view controls", async ({ page }) => {
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();

  const drawer = page.locator("[data-content-drawer]");
  await expect(drawer).toHaveClass(/open/);
  await expect(page.getByTestId("forge-editor")).toHaveClass(/content-drawer-open/);
  await expect(drawer.getByRole("button", { name: /Add/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: /Import/ })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Save All" })).toBeVisible();
  await expect(drawer.locator("[data-content-item-count]")).toContainText(/items?/);

  const filter = drawer.getByRole("button", { name: "Filter assets" });
  await filter.click();
  await expect(filter).toHaveAttribute("aria-expanded", "true");
  // Clicking a neutral spot inside the drawer closes the popover without
  // collapsing the drawer (the title now owns the collapse control).
  await drawer.locator("[data-content-search]").click();
  await expect(filter).toHaveAttribute("aria-expanded", "false");

  await expect(drawer.locator(".content-breadcrumb").first()).toHaveText("All", { timeout: 30_000 });
  await expect(drawer.locator(".folder-row-icon").first()).toBeVisible();
  await expect(drawer.locator(".folder-glyph").first()).toBeVisible();

  await filter.click();
  await expect(filter).toHaveAttribute("aria-expanded", "true");
  await drawer.locator("[data-content-type-filter]").selectOption("staticMesh");
  await expect(filter).toHaveAttribute("aria-expanded", "false");
  await expect(filter).toHaveClass(/is-filtered/);
  // Choosing an option closes the popover, so reopen it before selecting again.
  await filter.click();
  await expect(filter).toHaveAttribute("aria-expanded", "true");
  await drawer.locator("[data-content-type-filter]").selectOption("__all__");
  await expect(filter).not.toHaveClass(/is-filtered/);

  await drawer.locator("[data-content-add]").click();
  await expect(page.getByRole("button", { name: "New Folder" })).toBeVisible();
  await page.keyboard.press("Escape");

  await drawer.locator("[data-content-view]").click();
  await expect(drawer).toHaveAttribute("data-content-view", "small");

  await page.getByRole("button", { name: "Shapes" }).click();
  await expect(drawer.locator("[data-content-back]")).toBeEnabled();
  await drawer.locator("[data-content-back]").click();
  await expect(drawer.locator("[data-content-forward]")).toBeEnabled();

  const [drawerBox, outlinerBox, detailsBox] = await Promise.all([
    drawer.boundingBox(),
    page.locator(".editor-outliner").boundingBox(),
    page.locator(".editor-details").boundingBox(),
  ]);
  expect(drawerBox).not.toBeNull();
  expect(outlinerBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(detailsBox!.x + 1);
  expect(outlinerBox!.y + outlinerBox!.height).toBeLessThanOrEqual(drawerBox!.y + 1);

  // The drawer's own header title is the sole toggle (no separate footer bar).
  // Collapsing leaves only the header strip docked and clickable.
  const toggle = drawer.locator("[data-content-toggle]");
  await toggle.click();
  await expect(page.getByTestId("forge-editor")).not.toHaveClass(/content-drawer-open/);
  await expect(toggle).toBeVisible();
  await expect(drawer.locator("[data-content-add]")).toBeHidden();
  // Clicking the docked header strip reopens it.
  await toggle.click();
  await expect(drawer).toHaveClass(/open/);
});

test("Content Drawer renders a sidecar-material static-mesh thumbnail", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();

  const folderPath = "assets/ThreeAges/StaticMeshes";
  const folder = page.locator(`button.folder-row[title="${folderPath}"]`);
  await expect(folder).toBeVisible({ timeout: 30_000 });
  await folder.click();

  // Dock has two authored material slots and a box UVW sidecar. The thumbnail
  // has to become a real rendered image rather than retaining its model extension
  // placeholder while those sidecars resolve.
  const dock = page.locator('[data-asset-path="assets/ThreeAges/StaticMeshes/Dock_FirstAge.gltf"]');
  const thumbnail = dock.locator("[data-asset-thumb] img");
  await expect(thumbnail).toBeVisible({ timeout: 30_000 });
  await expect(thumbnail).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(thumbnail).toHaveJSProperty("complete", true);
  await expect(thumbnail).toHaveJSProperty("naturalWidth", 192);

  expect(errors, "sidecar-backed Content Drawer thumbnail must not produce page errors").toEqual([]);
});

import { expect, test } from "@playwright/test";

/**
 * The Data Table editor is the balance-authoring surface (see the assetization
 * follow-up). Balance files live under `public/game-data/`, which is outside the
 * asset-rooted Content Browser, so they are reached from the topbar "Veri" menu
 * rather than a double-click. This smoke proves the discoverability + open +
 * render path — the exact thing that was missing — without saving, so it never
 * mutates the shipped balance data.
 */
test("Veri menu opens the units balance table with an editable per-field form", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  // The menu is a hover flyout like Camera/Show, populated from the injected
  // catalog's dataTables (units for ThreeAges).
  const menu = page.locator("[data-datatables-popover]");
  await page.locator("[data-datatables-button]").hover();
  await expect(menu).toBeVisible();
  const unitsButton = menu.locator('[data-datatable-id="units"]');
  await expect(unitsButton).toHaveText("Birim Dengesi");

  await unitsButton.click();

  // The editor opens with one section per unit id and real, editable inputs.
  const editor = page.locator(".dte-overlay");
  await expect(editor).toBeVisible();
  await expect(editor.locator(".dte-entry")).toHaveCount(4);
  const guard = editor.locator(".dte-entry", { hasText: "guard_placeholder" });
  await expect(guard).toBeVisible();
  // A known scalar leaf renders as a number input carrying the shipped value.
  const maxHealth = guard.locator(".dte-field", { hasText: "maxHealth" }).locator("input");
  await expect(maxHealth).toHaveValue("110");
  await expect(maxHealth).toHaveAttribute("type", "number");
  // A nested leaf is reachable at its dotted path.
  await expect(guard.locator(".dte-field", { hasText: "cost.food" }).locator("input")).toHaveValue("60");

  // Editing marks the Save button dirty (no save issued — data stays untouched).
  await maxHealth.fill("125");
  await maxHealth.dispatchEvent("change");
  await expect(page.locator("[data-dte-save]")).toHaveClass(/is-dirty/);

  // Close without saving; the overlay is dismissed.
  await page.locator("[data-dte-close]").click();
  await expect(editor).toHaveCount(0);
});

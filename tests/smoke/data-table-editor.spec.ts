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
  // Fields carry friendly Turkish labels + number-input constraints from the
  // catalog's field metadata, not the raw JSON keys.
  const maxHealth = guard.locator(".dte-field", { hasText: "Can" }).locator("input");
  await expect(maxHealth).toHaveValue("110");
  await expect(maxHealth).toHaveAttribute("type", "number");
  await expect(maxHealth).toHaveAttribute("min", "1");
  // A nested leaf is labelled and reachable.
  await expect(guard.locator(".dte-field", { hasText: "Maliyet: Yiyecek" }).locator("input")).toHaveValue("60");

  // Editing marks the Save button dirty (no save issued — data stays untouched).
  await maxHealth.fill("125");
  await maxHealth.dispatchEvent("change");
  await expect(page.locator("[data-dte-save]")).toHaveClass(/is-dirty/);

  // Per-entry "reset to defaults" restores the entry from git HEAD. This drives
  // the /__gamedata-defaults endpoint end-to-end: 125 → back to the committed 110.
  await guard.getByRole("button", { name: "Varsayılana dön" }).click();
  await expect(maxHealth).toHaveValue("110");
  // Resetting a still-not-saved edit leaves it dirty (ready to Save), untouched on disk.
  await expect(page.locator("[data-dte-save]")).toHaveClass(/is-dirty/);

  // Close without saving; the overlay is dismissed.
  await page.locator("[data-dte-close]").click();
  await expect(editor).toHaveCount(0);
});

test("Veri menu lists every registered balance table", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  const menu = page.locator("[data-datatables-popover]");
  await page.locator("[data-datatables-button]").hover();
  await expect(menu).toBeVisible();
  await expect(menu.locator("[data-datatable-id]")).toHaveText([
    "Birim Dengesi",
    "Yapı Dengesi",
    "Kaynak Dengesi",
    "Çağ Dengesi",
    "Yapay Zekâ Dengesi",
    "Yol Dengesi",
  ]);

  // A nested table (buildings) opens and renders its entries with reset buttons.
  await menu.locator('[data-datatable-id="buildings"]').click();
  const editor = page.locator(".dte-overlay");
  await expect(editor).toBeVisible();
  const center = editor.locator(".dte-entry", { hasText: "command_center" });
  await expect(center).toBeVisible();
  await expect(
    editor.locator(".dte-entry", { hasText: "barracks" }).getByRole("button", { name: "Varsayılana dön" }),
  ).toBeVisible();

  // Entries with repeated blocks render one collapsible sub-group per tier/level,
  // titled from the catalog's group labels; the tiers start collapsed to cut
  // clutter, so expand the first Settlement tier before reading its fields.
  const settlementTier1 = center.locator(".dte-group", { hasText: "Yerleşim çağı — Seviye 1" });
  await expect(settlementTier1).toBeVisible();
  await settlementTier1.locator(".dte-group-title").click();

  // Index-agnostic field metadata labels every progression tier at once: the
  // `progression.settlement.[].maxHealth` template reaches each concrete index.
  await expect(settlementTier1.locator(".dte-field", { hasText: "Yerleşim tier: Can" }).first()).toBeVisible();

  // Structural tier indices are read-only (editing them only breaks a save).
  await expect(
    settlementTier1.locator(".dte-field", { hasText: "Yerleşim tier: Seviye" }).first().locator("input"),
  ).toBeDisabled();

  // The level-1 territory value carries an explanatory hint (tooltip) so it is
  // not mistaken for an outpost's single control-radius source.
  const outpost = editor.locator(".dte-entry", { hasText: "outpost" });
  await expect(
    outpost.locator(".dte-field", { hasText: "Bölge: Kontrol yarıçapı" }).first(),
  ).toHaveAttribute("title", /Seviye 1/);

  // The editor is a modal overlay, so switching tables means closing first.
  await page.locator("[data-dte-close]").click();
  await expect(editor).toHaveCount(0);

  // A flat config (roads) labels its scalar top-level values distinctly.
  await page.locator("[data-datatables-button]").hover();
  await menu.locator('[data-datatable-id="roads"]').click();
  await expect(editor.locator(".dte-field", { hasText: "Hücre boyutu (birim)" }).locator("input")).toBeVisible();
});

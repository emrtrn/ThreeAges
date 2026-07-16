import { expect, test } from "@playwright/test";

test("RTS Phase 4 build palette exposes territory-gated economy structures without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator(".rts-build-palette")).toBeVisible();
  await expect(page.getByRole("region", { name: "Yol yerleştirme" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ağ Görünümü", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ağ Görünümü", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ağ Görünümü", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Oyun hızı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Normal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "4X", exact: true }).click();
  await expect(page.getByRole("button", { name: "4X", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Tarla", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Oduncu Kampı", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Karakol", exact: true })).toBeVisible();
  await expect(page.locator('[data-rts-building="house"]')).toContainText("80 Odun");
  await expect(page.locator('[data-rts-building="depot"]')).toContainText("120 Odun");
  await expect(page.locator('[data-rts-building="outpost"]')).toContainText("140 Odun");
  await expect(page.getByRole("button", { name: "İşçi Üret", exact: true })).toBeVisible();
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 9/20");
  await expect(page.locator(".rts-build-income")).toHaveText("Gelir: Yiyecek +0.0/dk · Odun +0.0/dk");
  await expect(page.locator(".rts-debug-overlay")).toContainText("kaynak hareketleri:");
  await expect(page.locator(".rts-debug-overlay")).toContainText("yollar: 0 düğüm · 0 kenar · 0 ağ");
  await expect(page.locator(".rts-debug-overlay")).toContainText("depolar: 0");
  await expect(page.locator(".rts-debug-overlay")).toContainText("üretim bağlantıları: 0");
  await expect(page.locator(".rts-logistics-warning")).toBeHidden();

  await page.getByRole("button", { name: "Yol Kur", exact: true }).click();
  await expect(page.locator(".rts-road-status")).toHaveText(
    "Yol başlangıcını sol tıkla seçin; sağ tıkla bitirin.",
  );
  await page.getByRole("button", { name: "Yolu İptal", exact: true }).click();

  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");

  await page.locator("#game-canvas").hover({ position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toContainText(/konum|çakışıyor|kontrol/);

  await page.locator("#game-canvas").click({ button: "right", position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toHaveText("Bir yapı seçin.");
  await page.getByRole("button", { name: "Karakol", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText(
    "Karakolu kontrol alanının hemen dışındaki nötr bir konuma yerleştirin.",
  );
  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "Tarla", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");
  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "İşçi Üret", exact: true }).click();
  // The match runs at 4X here, so the order can finish before this assertion:
  // accept either side of that race rather than depending on the timing.
  await expect(page.locator(".rts-build-action-message")).toHaveText(
    /İşçi üretim kuyruğa alındı \(\d+\/\d+\)\.|Yeni işçi Merkez'den çıktı\./,
  );
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 10/20");
  await expect(page.locator(".rts-debug-overlay")).toContainText("reserve: food -50");
  expect(errors).toEqual([]);
});

test("RTS Phase 7 palette gates the Archer and the Ram behind a tier-2 Barracks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts");
  await expect(page.locator(".rts-build-palette")).toBeVisible();

  // Plan §45: the whole core roster is visible from the start. A locked unit
  // stays on screen and explains itself — that is what makes Barracks II read
  // as a decision rather than a surprise.
  for (const unitId of ["guard_placeholder", "archer_placeholder", "siege_placeholder"]) {
    await expect(page.locator(`[data-rts-unit="${unitId}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-rts-unit="archer_placeholder"]')).toContainText("Okçu Üret");
  await expect(page.locator('[data-rts-unit="siege_placeholder"]')).toContainText("Koçbaşı Üret");
  await expect(page.locator('[data-rts-unit="archer_placeholder"]')).toHaveAttribute(
    "title",
    /Kışla T2 gerekir/,
  );
  // With no Barracks standing, nothing is trainable yet.
  await expect(page.locator('[data-rts-unit="guard_placeholder"]')).toBeDisabled();

  await expect(page.locator(".rts-selection-panel")).toBeHidden();
  expect(errors).toEqual([]);
});

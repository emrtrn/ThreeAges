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
  await expect(page.locator(".rts-road-status")).toHaveText("Yol başlangıcını seçin.");
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
  await expect(page.locator(".rts-build-action-message")).toHaveText("İşçi üretim kuyruğa alındı.");
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 10/20");
  await expect(page.locator(".rts-debug-overlay")).toContainText("reserve: food -50");
  expect(errors).toEqual([]);
});

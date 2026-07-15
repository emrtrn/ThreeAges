import { expect, test } from "@playwright/test";

test("RTS Phase 4 build palette exposes territory-gated economy structures without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator(".rts-build-palette")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarla", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Oduncu Kampı", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Karakol", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "İşçi Üret", exact: true })).toBeVisible();
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 5/20");
  await expect(page.locator(".rts-build-income")).toHaveText("Gelir: Yiyecek +0.0/dk · Odun +0.0/dk");
  await expect(page.locator(".rts-debug-overlay")).toContainText("kaynak hareketleri:");

  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");

  await page.locator("#game-canvas").hover({ position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toContainText(/konum|çakışıyor|kontrol/);

  await page.getByRole("button", { name: "İptal", exact: true }).click();
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
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 6/20");
  await expect(page.locator(".rts-debug-overlay")).toContainText("reserve: food -50");
  expect(errors).toEqual([]);
});

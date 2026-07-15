import { expect, test } from "@playwright/test";

test("RTS Phase 3 build palette exposes economy structures without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator(".rts-build-palette")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarla", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Oduncu Kampı", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "İşçi Üret", exact: true })).toBeVisible();
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 5/20");

  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");

  await page.locator("#game-canvas").hover({ position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toContainText(/konum|çakışıyor/);

  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "Tarla", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");
  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "İşçi Üret", exact: true }).click();
  await expect(page.locator(".rts-build-action-message")).toHaveText("İşçi üretim kuyruğa alındı.");
  await expect(page.locator(".rts-build-population")).toHaveText("Nüfus: 6/20");
  expect(errors).toEqual([]);
});

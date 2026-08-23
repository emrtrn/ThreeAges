import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

test("road placement remains armed to chain routes until right-click", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await startRtsMatch(page);
  await page.getByRole("button", { name: "Lojistik", exact: true }).click();
  await page.getByRole("button", { name: "Yol", exact: true }).click();

  await expect(page.locator(".rts-build-status")).toHaveText("Yol çizimi");
  await expect(page.locator(".rts-build-road-hint")).toHaveText("Sol tık: başlangıç seç · Sağ tık: çık");

  const canvas = page.locator("#game-canvas");
  await canvas.click({ position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toHaveText("Yol çiziliyor");
  await expect(page.locator(".rts-build-road-hint")).toHaveText("Ucu seçin · Sol tık: yolu kur");

  await canvas.hover({ position: { x: 720, y: 420 } });
  await expect(page.locator(".rts-build-road-hint")).toContainText(/Sol tık: yolu kur · \d+ hücre · \d+ Odun/);
  await canvas.click({ position: { x: 720, y: 420 } });
  await expect(page.locator(".rts-build-status")).toHaveText("Yol çiziliyor");
  await expect(page.locator(".rts-build-road-hint")).toHaveText("Ucu seçin · Sol tık: yolu kur");
  await canvas.hover({ position: { x: 800, y: 420 } });
  await expect(page.locator(".rts-build-road-hint")).toContainText(/Sol tık: yolu kur · \d+ hücre · \d+ Odun/);
  await canvas.click({ position: { x: 800, y: 420 } });
  await expect(page.locator(".rts-build-status")).toHaveText("Yol çiziliyor");
  await canvas.click({ button: "right", position: { x: 800, y: 420 } });
  await expect(page.locator(".rts-build-road-hint")).toBeHidden();
  await expect(page.locator(".rts-build-status")).toBeHidden();
  expect(errors).toEqual([]);
});

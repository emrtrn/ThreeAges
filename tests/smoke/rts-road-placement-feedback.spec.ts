import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

test("road placement separates the start, route preview, and finish feedback", async ({ page }) => {
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
  await expect(page.locator(".rts-build-road-hint")).toHaveText("Ucu seçin · Sağ tık: bitir");

  await canvas.hover({ position: { x: 720, y: 420 } });
  await expect(page.locator(".rts-build-road-hint")).toContainText(/Sağ tık: bitir · \d+ hücre · \d+ Odun/);
  await canvas.click({ button: "right", position: { x: 720, y: 420 } });
  await expect(page.locator(".rts-build-road-hint")).toBeHidden();
  expect(errors).toEqual([]);
});

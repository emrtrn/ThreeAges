import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

test("RTS graphics profile and adaptive preference apply and persist", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.removeItem("forge.userSettings"));

  await page.goto("/?rts&debug");
  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-perf", /.+/);
  const performanceWitness = JSON.parse(await page.locator("#game-canvas").getAttribute("data-rts-perf") ?? "null");
  expect(performanceWitness?.render?.drawCalls).toEqual(expect.any(Number));
  expect(performanceWitness?.render?.triangles).toEqual(expect.any(Number));
  expect(performanceWitness?.memory?.textures).toEqual(expect.any(Number));

  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  const quality = page.locator("[data-rts-graphics-quality]");
  const adaptive = page.locator("[data-rts-graphics-adaptive]");
  await expect(quality).toHaveAttribute("type", "range");
  await expect(quality).toHaveValue("1");
  await expect(page.locator("[data-rts-graphics-quality-value]")).toHaveText("Orta");
  await expect(adaptive).toBeChecked();

  const mediumBufferWidth = await page.locator("#game-canvas").evaluate((canvas) => canvas.width);
  await quality.press("Home");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-quality", "low");
  await expect.poll(() => page.locator("#game-canvas").evaluate((canvas) => canvas.width)).toBeLessThan(mediumBufferWidth);
  await adaptive.uncheck();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-adaptive", "false");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("forge.userSettings") ?? "null"));
  expect(stored?.payload?.graphics?.selectedQualityLevel).toBe("low");
  expect(stored?.payload?.graphics?.adaptiveOptimizationEnabled).toBe(false);
  expect(errors).toEqual([]);
});

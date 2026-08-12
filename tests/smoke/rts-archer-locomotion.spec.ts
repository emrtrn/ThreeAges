import { expect, test } from "@playwright/test";
import { waitForRtsBoot } from "./rtsBoot";

test("Archer Faz 1 acceptance preset boots 10v10 on the authored Actor pack", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/?rts&debug&preset=archer_locomotion_acceptance&mode=free");
  await waitForRtsBoot(page);
  await expect(page.locator("#game-canvas"))
    .toHaveAttribute("data-rts-content-assets", "ready", { timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-placeholders", "0");

  await expect.poll(async () => {
    const witness = await page.locator(".rts-debug-sim").textContent() ?? "";
    const lines = witness.split("\n");
    return {
      player: lines.filter((line) => /^#\d+ player\/archer\b/.test(line)).length,
      enemy: lines.filter((line) => /^#\d+ enemy\/archer\b/.test(line)).length,
      otherUnits: lines.filter((line) => /^#\d+ (?:player|enemy)\/(?!archer\b)/.test(line)).length,
    };
  }).toEqual({ player: 10, enemy: 10, otherUnits: 0 });

  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  expect(errors, "the Archer acceptance route must not produce browser errors").toEqual([]);
});

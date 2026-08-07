import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

test.use({ viewport: { width: 1366, height: 768 } });

test("story mission card states the objective plainly and can be collapsed", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&mission=frontier_road");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await startRtsMatch(page);

  const panel = page.locator("[data-rts-mission]");
  await expect(panel).toBeVisible();
  // Sürüm 2: the objective is an instruction, and the reason under it is open by
  // default now that it is one short sentence. The "0/1 …" counter that used to
  // sit between them is gone — the chain asks for one of a thing on nearly every
  // step, so it restated the title fourteen times in the goal's own vocabulary.
  await expect(panel.locator("[data-rts-mission-title]")).toHaveText("Oduncu Kampı Kur");
  await expect(panel.locator("[data-rts-mission-progress]")).toHaveCount(0);

  const toggle = panel.locator(".rts-mission-heading");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator(".rts-mission-content")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel.locator(".rts-mission-content")).toBeHidden();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  expect(errors).toEqual([]);
});

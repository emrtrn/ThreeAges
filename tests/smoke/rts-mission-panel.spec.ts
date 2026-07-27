import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1366, height: 768 } });

test("story mission card keeps the objective visible and reveals detail on demand", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&mission=frontier_road");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();

  const panel = page.locator("[data-rts-mission]");
  await expect(panel).toBeVisible();
  const toggle = panel.getByRole("button");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel.locator("[data-rts-mission-title]")).toBeVisible();
  await expect(panel.locator("[data-rts-mission-progress]")).toContainText("0/1 Oduncu Kampı");
  await expect(panel.locator(".rts-mission-content")).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator(".rts-mission-content")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  expect(errors).toEqual([]);
});

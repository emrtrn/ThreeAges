import { expect, test } from "@playwright/test";
import { waitForRtsBoot, waitForRtsMenu } from "./rtsBoot";

test.use({ viewport: { width: 1366, height: 768 } });

test("Simplified Chinese loads its CJK font and remains readable through match settings", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&locale=zh-CN");
  await waitForRtsMenu(page);
  const menu = page.locator("[data-rts-main-menu]");
  const picker = menu.locator("[data-rts-language]");
  await expect(picker).toHaveValue("zh-CN");
  await expect(picker.locator('option[value="zh-CN"]')).toHaveText("简体中文");
  await expect(menu.getByRole("button", { name: "开始比赛", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("data-locale-font-group", "cjk");
  await expect.poll(() => page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('400 16px "Noto Sans SC Subset"', "简体中文")
      && document.fonts.check('700 16px "Noto Sans SC Subset"', "开始比赛");
  })).toBe(true);

  await picker.selectOption("tr");
  await expect(menu.getByRole("button", { name: "Maçı Başlat", exact: true })).toBeVisible();
  await picker.selectOption("zh-CN");
  await expect(menu.getByRole("button", { name: "开始比赛", exact: true })).toBeVisible();

  await menu.getByRole("button", { name: "开始比赛", exact: true }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await waitForRtsBoot(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await expect(page.locator(".rts-language-select")).toContainText("语言");
  const viewport = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: testInfo.outputPath("zh-CN-match-settings.png") });
  expect(errors).toEqual([]);
});

test("Simplified Chinese keeps the mission and build palette inside the narrow HUD viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 840, height: 768 });
  await page.goto("/?rts&mission=frontier_road&locale=zh-CN");
  await waitForRtsMenu(page);
  await page.locator("[data-rts-main-menu] button").first().click();
  await waitForRtsBoot(page);
  await expect(page.locator("[data-rts-mission]")).toBeVisible();
  await expect(page.locator(".rts-build-palette")).toBeVisible();
  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const mission = rect("[data-rts-mission]");
    const palette = rect(".rts-build-palette");
    return {
      missionLeft: mission?.left, missionRight: mission?.right,
      paletteLeft: palette?.left, paletteRight: palette?.right,
      scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
    };
  });
  expect(bounds.missionLeft).toBeGreaterThanOrEqual(0);
  expect(bounds.missionRight).toBeLessThanOrEqual(bounds.width);
  expect(bounds.paletteLeft).toBeGreaterThanOrEqual(0);
  expect(bounds.paletteRight).toBeLessThanOrEqual(bounds.width);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
  await page.screenshot({ path: testInfo.outputPath("zh-CN-840.png") });
});

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 840, height: 768 } });

test("pseudo-locale keeps top notifications clear of the mission card at the narrow HUD breakpoint", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&mission=frontier_road&locale=qps-ploc");
  await expect(page.locator("[data-rts-main-menu]")).toBeVisible({ timeout: 30_000 });
  // qps-ploc deliberately mutates every visible label, so entering the match
  // must use the same ordinary button click a player makes without assuming the
  // Turkish or English accessible name.
  await page.locator("[data-rts-main-menu] button").first().click();
  await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll(".rts-loading-screen")]
      .every((screen) => screen.getAttribute("data-rts-loading") === "done"),
    undefined,
    { timeout: 30_000 },
  );

  const feed = page.locator(".rts-notification-feed");
  const mission = page.locator("[data-rts-mission]");
  await expect(feed).toBeVisible();
  await expect(mission).toBeVisible();
  await expect(page.locator(".rts-build-choice").first()).toHaveAttribute("title", /^\[!! .+ !!\]$/);

  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element.getBoundingClientRect();
    };
    const feedRect = rect(".rts-notification-feed");
    const missionRect = rect("[data-rts-mission]");
    return {
      feedRight: feedRect.right,
      missionLeft: missionRect.left,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(bounds.feedRight).toBeLessThanOrEqual(bounds.missionLeft);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("qps-840.png") });
});

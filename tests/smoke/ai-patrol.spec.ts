import { expect, test, type Page } from "@playwright/test";

const SMOKE_PATROL_SCENE_NAME = "__playwright-smoke-patrol";

test.setTimeout(210_000);

async function waitForConsoleText(
  page: Page,
  messages: readonly string[],
  text: string,
): Promise<void> {
  const seen = () => messages.some((message) => message.includes(text));
  if (seen()) return;
  await page.waitForEvent("console", {
    predicate: () => seen(),
    timeout: 60_000,
  });
}

test("runtime AI spline smoke: travel to the Playground route, agent follows the closed spline", async ({
  page,
  context,
}) => {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  await context.addInitScript(() => {
    localStorage.clear();
  });

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    consoleMessages.push(message.text());
  });

  // Boot the actor-stripped default smoke scene, then travel into the Playground
  // fixture. It retains the AI_Character and closed `spline-1` actor.
  await page.goto(`/?debug&aiPatrolSmoke=${Date.now()}`);
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#ui-overlay")).toBeVisible();
  await expect(page.locator(".forge-loading")).toBeHidden({ timeout: 30_000 });

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-ui-id="title"]')).toContainText("Save / Load");
  await page.locator('[data-ui-id="smoke-patrol"]').click();

  await waitForConsoleText(page, consoleMessages, SMOKE_PATROL_SCENE_NAME);
  await expect(page.locator(".forge-loading")).toBeHidden({ timeout: 30_000 });

  // The AI actor remains a live controller while its actor component follows the
  // Generic Spline. The old Target Point patrol is intentionally absent here.
  await expect(page.locator("#debug-stats")).toContainText(/controllers: [1-9]/, {
    timeout: 30_000,
  });
  await expect(page.locator("#debug-stats")).toContainText("spline followers (1)", {
    timeout: 30_000,
  });
  await expect(page.locator("#debug-stats")).toContainText("actor:0: spline-1", {
    timeout: 30_000,
  });

  const followerDistance = async (): Promise<number> => {
    const text = await page.locator("#debug-stats").textContent();
    const match = text?.match(/actor:0: spline-1 d:([0-9.]+)/);
    return match ? Number(match[1]) : Number.NaN;
  };
  const initialDistance = await followerDistance();
  await expect.poll(followerDistance, { timeout: 10_000 }).toBeGreaterThan(initialDistance + 0.5);

  expect(pageErrors).toEqual([]);
});

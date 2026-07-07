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

test("runtime AI patrol smoke: travel to route scene, agent patrols Target Points", async ({
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

  // Boot the (actor-stripped) default smoke scene, then use the pause menu to
  // travel into the dedicated patrol scene, which keeps the AI_Test controller
  // and the authored Target Point route.
  await page.goto(`/?debug&aiPatrolSmoke=${Date.now()}`);
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#ui-overlay")).toBeVisible();
  await expect(page.locator(".forge-loading")).toBeHidden({ timeout: 30_000 });

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-ui-id="title"]')).toContainText("Save / Load");
  await page.locator('[data-ui-id="smoke-patrol"]').click();

  await waitForConsoleText(page, consoleMessages, SMOKE_PATROL_SCENE_NAME);
  await expect(page.locator(".forge-loading")).toBeHidden({ timeout: 30_000 });

  // The AI_Test actor should be possessed by a live AIController...
  await expect(page.locator("#debug-stats")).toContainText(/controllers: [1-9]/, {
    timeout: 30_000,
  });
  // ...and actively path-following along the Target Point route (the nav block
  // only appears while at least one agent has a live path to a patrol target).
  await expect(page.locator("#debug-stats")).toContainText("ai nav", {
    timeout: 30_000,
  });

  expect(pageErrors).toEqual([]);
});

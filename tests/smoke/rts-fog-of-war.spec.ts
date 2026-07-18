import { expect, test, type Page } from "@playwright/test";

/**
 * Faz 11 §59 "Fog of War", behind the `fogOfWar` flag.
 *
 * The engine tests already drive the grid, the memory rules and the AI filter,
 * so what is left is the part they cannot reach: that the flag actually builds
 * the systems into a running match and ticks them, and that switching the flag
 * off leaves nothing behind — §13's "a disabled flag must cost nothing at
 * runtime".
 *
 * The assertions read the `?debug` block rather than the canvas. That block is
 * also the only surface reporting *both* kingdoms' fog, which makes it the right
 * place to check §59's symmetry: a screenshot can only ever show the player's
 * half of the claim. What it deliberately does not prove is that the fog plane
 * reached the scene graph — that would need a test-only global on the app, and
 * it is left to the visual pass in playtesting instead.
 */
async function openMatch(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
}

test("§59: fog builds into the match behind its flag and leaves no trace without it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMatch(page, "/?rts&debug&flags=fogOfWar");

  const overlay = page.locator(".rts-debug-overlay");
  await expect(overlay).toContainText("görüş:");
  await expect(overlay).toContainText("oyuncu: keşfedilmiş");
  await expect(overlay).toContainText("düşman: keşfedilmiş");

  // Both kingdoms start with their base revealed and nothing else. A fog that
  // began fully explored would be a no-op and one stuck at 0% would mean the
  // source collection never ran; neither failure throws, so neither would be
  // caught by the error check below.
  const exploredText = await overlay.textContent();
  const percentages = [...(exploredText ?? "").matchAll(/keşfedilmiş %([\d.]+)/g)]
    .map((match) => Number(match[1]));
  expect(percentages, "both kingdoms report an explored fraction").toHaveLength(2);
  for (const percent of percentages) {
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(60);
  }

  // The grid dimensions come from the real world extent, so a mis-wired option
  // object shows up here rather than as a subtly wrong-sized overlay.
  await expect(overlay).toContainText(/görüş: \d+×\d+ hücre · \d+ kaynak\/tick/);

  expect(errors, "the flagged path must not throw").toEqual([]);

  // Flag off: not merely hidden — absent, including the debug block.
  await openMatch(page, "/?rts&debug");
  await expect(page.locator(".rts-debug-overlay")).toBeVisible();
  await expect(page.locator(".rts-debug-overlay")).not.toContainText("görüş:");
  expect(errors, "and the default build must still be clean").toEqual([]);
});

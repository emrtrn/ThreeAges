import { expect, test, type Page } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

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
  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
}

test("§59: fog builds into the match behind its flag and leaves no trace without it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Since the menu (plan F2) every "Maçı Başlat" records the resolved setup, and a
  // stored choice outranks an absent `?flags=` in the boot's precedence chain. Both
  // legs below run in one tab, so without this the flag-off leg would inherit the
  // flagged leg's fog through session storage and the "leaves no trace" half of
  // this test would be asserting against a match that was asked for fog. Re-applied
  // on every navigation, which is why it is an init script rather than one call.
  await page.addInitScript(() => sessionStorage.removeItem("threeages.fogOfWar"));

  // This test used to open with a "before anything is clicked" reading, taken off
  // the start card that used to sit inside a fully built `RtsApp`: the scene was
  // already rendering behind it, so a fog texture left at its all-unknown fill with
  // nothing drawn on top would have shown the whole map to a player who had not
  // started yet. The main menu (plan F2) removed the moment rather than the check —
  // nothing is constructed until the click, and the curtain over the load does not
  // lift until the first frame is drawn (T2), so there is no longer any instant at
  // which an unfogged map could be on screen. What was worth asserting there is the
  // opening state itself, and that survives below: the match is read the moment it
  // is playable, and both kingdoms must already be fogged down to their own base.
  await openMatch(page, "/?rts&debug&flags=fogOfWar");

  const overlay = page.locator(".rts-debug-sim");
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

  // Flag off: not merely hidden — absent, including the debug block. The visible
  // panel is asserted alongside it so "no fog block" cannot silently become "no
  // debug route at all".
  await openMatch(page, "/?rts&debug");
  await expect(page.locator(".rts-debug-overlay")).toBeVisible();
  await expect(page.locator(".rts-debug-sim")).toContainText("maç:");
  await expect(page.locator(".rts-debug-sim")).not.toContainText("görüş:");
  expect(errors, "and the default build must still be clean").toEqual([]);
});

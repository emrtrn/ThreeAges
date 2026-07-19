import { expect, test, type Page } from "@playwright/test";

/**
 * Faz 11 §58 "Bölgesel Zafer", behind the `regionalVictory` flag.
 *
 * The engine tests already drive the counter itself — hold, stall, decay, and the
 * match ending — so what is left to prove is the part they cannot reach: that the
 * flag actually wires the systems into a running match, and that switching it off
 * leaves nothing behind. §13's "a disabled flag must cost nothing" and §60's "no
 * disabled icon, no reserved empty space" are both claims about the real page.
 */
async function openMatch(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
}

test("§58: the regional victory tracker runs behind its flag and leaves no trace without it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMatch(page, "/?rts&flags=regionalVictory");
  const tracker = page.locator("[data-rts-objectives]");
  await expect(tracker).toBeVisible();

  const toggle = tracker.getByRole("button", { name: "Görevler", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(tracker.locator(".rts-objective-content")).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(tracker.locator(".rts-objective-content")).toBeVisible();

  // §60 replaced the minimap with named strategic points, so the names are the
  // navigation aid and have to be on screen, not only in the world.
  await expect(tracker).toContainText("Batı Geçidi");
  await expect(tracker).toContainText("Doğu Geçidi");

  // Both passes sit ~60 units from either base against a 28-unit starting control
  // radius: at match start nobody owns one, which is what stops a regional victory
  // from being inherited rather than expanded toward.
  const points = tracker.locator(".rts-objective-point");
  await expect(points).toHaveCount(2);
  await expect(points.first()).toHaveAttribute("data-holder", "neutral");
  await expect(points.last()).toHaveAttribute("data-holder", "neutral");

  // Both kingdoms' counters are shown; hiding the enemy's is the surprise-defeat
  // failure §58's last acceptance box names.
  await expect(tracker.locator('.rts-objective-bar[data-owner="player"]')).toBeVisible();
  await expect(tracker.locator('.rts-objective-bar[data-owner="enemy"]')).toBeVisible();

  // Nothing is held, so nothing is banking time.
  await expect(tracker.locator('.rts-objective-bar[data-owner="player"]')).toHaveAttribute("data-phase", "decaying");

  expect(errors, "the flagged path must not throw").toEqual([]);

  // Flag off: not merely hidden — absent.
  await openMatch(page, "/?rts");
  await expect(page.locator("[data-rts-objectives]")).toHaveCount(0);
  expect(errors, "and the default build must still be clean").toEqual([]);
});

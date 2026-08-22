import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

/**
 * The editor -> runtime round trip: this project pins Play to its RTS preset.
 *
 * A wider viewport than the suite default because the editor toolbar overflows
 * 1280x720 and the Play button lands outside it, which Playwright refuses to
 * click. That is a layout issue in its own right, not something this test is
 * asserting about.
 */
test.use({ viewport: { width: 1920, height: 1080 } });

/**
 * Boots the editor and comes back with the level it is actually editing.
 *
 * The name in the toolbar is written by `loadContent`, which waits on the whole
 * scene load — every model, the landscape, the foliage sidecar — not just on the
 * manifest. That is the wait we want (Play saves the layout, so clicking before
 * the scene is built would save a half-loaded one), but it is minutes-scale work
 * on this project's gameplay-proof level, not the seconds the old 30s budget
 * assumed. Measured 2026-08-22: ~54s from `goto` to the name appearing. So the
 * budget is generous on purpose — a failure here means "boot broke", never
 * "boot was slower than a guess".
 */
async function openEditor(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("[data-project-name]")).not.toHaveText("loading level", { timeout: 120_000 });

  // Read the active level rather than naming one. The smoke harness repoints
  // `editor.defaultScene` at its own copy (`tests/smoke/global-setup.mjs`), so a
  // literal path here asserts the opposite of this test's title: it would demand
  // Play carry a level that is not the one being edited.
  //
  // From the toolbar's own tooltip, not from a fetch: it is what `loadContent`
  // wrote after the load settled, so it is the editor's answer rather than a
  // second reading of the same file that might have moved. It is also one
  // attribute read instead of a round trip through a page whose main thread is
  // busy rendering — 22s for that one `evaluate`, measured.
  const title = await page.locator("[data-project-name]").getAttribute("title");
  const activeLevel = title?.replace(/^Active level:\s*/, "");
  expect(activeLevel, "the editor must name the level it loaded").toBeTruthy();
  return activeLevel as string;
}

test("Play opens the menu, carrying the level being edited into the match", async ({ page, context }) => {
  // Editor boot alone is ~1 min here (see openEditor), and the match boot on the
  // far side of the menu is another one. The suite default of 150s does not fit
  // both halves of a round trip this test exists to make in one go.
  test.setTimeout(300_000);
  const activeLevel = await openEditor(page);

  const [runtime] = await Promise.all([
    context.waitForEvent("page"),
    page.getByTestId("editor-play").click(),
  ]);
  await runtime.waitForLoadState("domcontentloaded");
  // The map rides in the address; the match settings do not. Play answers "which
  // map", and the menu is where the author answers "which match" — conflating
  // the two is what used to drop them into whatever the last session left.
  expect(new URL(runtime.url()).searchParams.get("level")).toBe(activeLevel);
  expect(new URL(runtime.url()).searchParams.get("mode")).toBeNull();

  // The editor has said everything it is going to say, and leaving it open makes
  // the rest of this test unaffordable: two full-tilt WebGL pages share one
  // software GL, and every protocol call below was taking 8-38s with the editor
  // still rendering the same heavy level behind the match. Closing it is not a
  // speed trick — the round trip under test is finished on this side.
  await page.close();
  await startRtsMatch(runtime);
  await expect(runtime.locator("#game-canvas")).toHaveAttribute(
    "data-rts-level-ref",
    activeLevel,
    { timeout: 120_000 },
  );
  // What the round trip owes is a verdict on the level it carried, never a blank
  // page. Which verdict depends on the level, and this suite's is deliberately
  // unplayable: `prepareSmokeSourceScene` drops `actors`, and the RTS start
  // markers are actors (`BP_RTS_KingdomStart`), so the copy loses them. That is
  // also what mid-edit authoring looks like, which is the case worth pinning
  // here — a level that plays as authored is covered on the real map by
  // `rts-assetization-baseline.spec.ts`, not by a round trip through a fixture.
  const verdict = await runtime.locator("#game-canvas").getAttribute("data-rts-level");
  if (verdict === "authored") {
    await expect(runtime.locator("#game-canvas")).toHaveAttribute("data-rts-level-error", "");
  } else {
    expect(verdict, "a level Play carried over must be played or refused, not ignored").toBe("invalid");
    await expect(runtime.locator("#game-canvas")).toHaveAttribute("data-rts-level-error", /.+/);
  }
  await expect(runtime.locator("#game-canvas")).toBeVisible();
  await runtime.close();
});

test("a level the RTS cannot play falls back to the blockout map with a stated reason", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // The starter character scene has no Kingdom Start markers. Naming it is a
  // normal authoring mistake (or a mid-edit state), so it must degrade rather
  // than leave the player looking at nothing.
  // A level alone no longer skips the menu — it names a map, not a match — so the
  // match has to be started before it can be asked which level it resolved.
  await page.goto("/?rts&debug&level=assets/starter-content/Levels/Playground.level.json");
  await startRtsMatch(page);
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "invalid");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-error", /.+/);
  // Still playable, and the debug block names the file and the reason.
  await expect(page.locator(".rts-debug-sim")).toContainText("seviye REDDEDİLDİ");
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");

  // A malformed path is refused the same way — named and explained — rather than
  // quietly playing another map or throwing the route away.
  await page.goto("/?rts&debug&level=/etc/passwd.level.json");
  await startRtsMatch(page);
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "invalid");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-ref", "/etc/passwd.level.json");

  expect(errors, "a refused level must not throw past the boot path").toEqual([]);
});

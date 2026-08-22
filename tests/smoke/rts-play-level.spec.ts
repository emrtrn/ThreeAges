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

async function openEditor(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  // The project manifest arrives asynchronously, and Play reads the active level
  // from it — clicking earlier would open the bare preview URL with no level.
  await expect(page.locator("[data-project-name]")).not.toHaveText("loading level", { timeout: 30_000 });
}

test("Play opens the menu, carrying the level being edited into the match", async ({ page, context }) => {
  await openEditor(page);

  const [runtime] = await Promise.all([
    context.waitForEvent("page"),
    page.getByTestId("editor-play").click(),
  ]);
  await runtime.waitForLoadState("domcontentloaded");
  // The map rides in the address; the match settings do not. Play answers "which
  // map", and the menu is where the author answers "which match" — conflating
  // the two is what used to drop them into whatever the last session left.
  expect(new URL(runtime.url()).searchParams.get("level")).toBe(
    "assets/ThreeAges/Levels/RTS_GameplayProof.level.json",
  );
  expect(new URL(runtime.url()).searchParams.get("mode")).toBeNull();
  await startRtsMatch(runtime);
  await expect(runtime.locator("#game-canvas")).toHaveAttribute(
    "data-rts-level-ref",
    "assets/ThreeAges/Levels/RTS_GameplayProof.level.json",
    { timeout: 30_000 },
  );
  await expect(runtime.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored");
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

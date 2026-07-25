import { expect, test } from "@playwright/test";

/**
 * The editor -> runtime round trip: Play opens the level being edited.
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

test("Play opens the level being edited, and says so if that level is not playable", async ({ page, context }) => {
  await openEditor(page);

  const activeLevel = await page.evaluate(async () => {
    const response = await fetch("/project.3dgame.json");
    return ((await response.json()) as { editor: { defaultScene: string } }).editor.defaultScene;
  });

  const [runtime] = await Promise.all([
    context.waitForEvent("page"),
    page.getByTestId("editor-play").click(),
  ]);
  await runtime.waitForLoadState("domcontentloaded");
  // The saved scene is handed over explicitly, so the runtime cannot pick a
  // different map than the one that was just edited.
  expect(new URL(runtime.url()).searchParams.get("level")).toBe(activeLevel);
  await expect(runtime.locator("#game-canvas")).toHaveAttribute("data-rts-level-ref", activeLevel, { timeout: 30_000 });

  // The smoke suite edits a scene with no RTS markers in it, which is also what
  // mid-edit authoring looks like. That must read as a refusal with a reason,
  // not as a blank page: the route still boots, on the blockout map, saying why.
  const level = await runtime.locator("#game-canvas").getAttribute("data-rts-level");
  if (level === "invalid") {
    await expect(runtime.locator("#game-canvas")).toHaveAttribute("data-rts-level-error", /.+/);
  } else {
    expect(level, "a level with RTS markers plays as authored").toBe("authored");
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
  await page.goto("/?rts&debug&level=assets/starter-content/Levels/Playground.level.json");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "invalid", { timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-error", /.+/);
  // Still playable, and the overlay names the file and the reason.
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-debug-overlay")).toContainText("seviye REDDEDİLDİ");
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: active");

  // A malformed path is refused the same way — named and explained — rather than
  // quietly playing another map or throwing the route away.
  await page.goto("/?rts&debug&level=/etc/passwd.level.json");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "invalid", { timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-ref", "/etc/passwd.level.json");

  expect(errors, "a refused level must not throw past the boot path").toEqual([]);
});

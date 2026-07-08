import { expect, test } from "@playwright/test";

// Verifies the Behavior Tree editor opens a real `*.behavior.json` asset and
// derives its outline + validation from the engine normalizer. It drives the
// editor component directly (dynamic import) rather than navigating the Content
// Browser folder tree, keeping the smoke fast and deterministic. Read-only: it
// never saves, so no asset files are written and no cleanup is needed.
test("behavior tree editor renders outline and validation for a real asset", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });

  // Open the editor on the starter-content AI_Test behavior tree (selector root
  // with services + children) via the component's own dynamic-import entry point.
  await page.evaluate(async () => {
    const mod = await import("/src/editor/BehaviorTreeEditor.ts");
    await mod.BehaviorTreeEditor.open({
      path: "assets/starter-content/AI/AI_Test.behavior.json",
      label: "AI_Test",
    });
  });

  const win = page.locator(".bte-window");
  await expect(win).toBeVisible();
  await expect(win.locator("[data-bte-title]")).toHaveText("AI_Test");

  // Outline: the root node is a selector, and its services surface as chips.
  await expect(win.locator(".bte-node-kind").first()).toHaveText("selector");
  await expect(win.locator(".bte-chip-svc").first()).toContainText(
    "forge.updatePerceptionBlackboard",
  );

  // Validation: the real asset passes the engine normalizer.
  await expect(win.locator(".bte-ok")).toBeVisible();

  // Editing the raw JSON to something invalid flips validation to an error and
  // the outline still reflects the (now un-normalizable) shape without crashing.
  await win.locator("[data-bte-raw]").fill('{ "schema": 1, "type": "behaviorTree" }');
  await expect(win.locator(".bte-issue")).toBeVisible();

  // Close without saving.
  await page.keyboard.press("Escape");
  await expect(win).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

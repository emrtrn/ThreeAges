import { expect, test } from "@playwright/test";

test.setTimeout(210_000);

test("editor Landscape sculpt smoke: add, sculpt, undo, save, reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.getByTestId("outliner-row").first()).toBeVisible({ timeout: 30_000 });

  const rowCountBefore = await page.getByTestId("outliner-row").count();
  await page.getByTestId("add-actor-button").hover();
  await page.getByRole("button", { name: /^Terrain/ }).hover();
  await page.getByRole("button", { name: "Landscape" }).click();

  await expect(page.getByTestId("outliner-row")).toHaveCount(rowCountBefore + 1);
  await page.getByTestId("outliner-row").filter({ hasText: "Landscape" }).first().click();
  await expect(page.locator('[data-inspector-pane="details"] .detail-heading')).toContainText(
    "terrain / landscape",
  );
  await expect(page.locator('[data-landscape-tool="raise"]')).toBeVisible();

  await page.evaluate(() => {
    const setNumber = (key: string, value: string): void => {
      const input = document.querySelector<HTMLInputElement>(`[data-landscape-number="${key}"]`);
      if (!input) throw new Error(`missing landscape input: ${key}`);
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setNumber("brushSize", "10");
    setNumber("strength", "1");
  });
  await expect(page.locator('[data-landscape-number="brushSize"]')).toHaveValue("10");
  await expect(page.locator('[data-landscape-number="strength"]')).toHaveValue("1");

  const canvas = page.locator("#game-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing canvas bounds");
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 4);
  await page.mouse.up();

  await expect(page.getByTestId("editor-undo")).toBeEnabled();
  await page.getByTestId("editor-undo").click();
  await page.getByTestId("editor-redo").click();

  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-status")).toContainText("Saved", { timeout: 10_000 });

  const landscapeData = await page.evaluate(async () => {
    const response = await fetch(`/landscapes/landscape-1.landscape.json?smoke=${Date.now()}`);
    if (!response.ok) throw new Error(`Landscape sidecar fetch failed: ${response.status}`);
    return (await response.json()) as { heights: number[] };
  });
  expect(landscapeData.heights.some((height) => Math.abs(height) > 0.001)).toBeTruthy();

  await page.goto(`/?editor&landscapeSmokeReload=${Date.now()}`);
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("outliner-row").filter({ hasText: "Landscape" }).first().click();
  await expect(page.locator('[data-inspector-pane="details"] .detail-heading')).toContainText(
    "terrain / landscape",
  );
  const reloadedData = await page.evaluate(async () => {
    const response = await fetch(`/landscapes/landscape-1.landscape.json?reload=${Date.now()}`);
    if (!response.ok) throw new Error(`Landscape sidecar fetch failed: ${response.status}`);
    return (await response.json()) as { heights: number[] };
  });
  expect(reloadedData.heights.some((height) => Math.abs(height) > 0.001)).toBeTruthy();

  expect(pageErrors).toEqual([]);
});

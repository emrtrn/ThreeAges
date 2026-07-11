import { expect, test, type Page } from "@playwright/test";

test.setTimeout(210_000);

async function deleteExistingLandscape(page: Page): Promise<void> {
  const landscapeRows = page.getByTestId("outliner-row").filter({ hasText: "Landscape" });
  if ((await landscapeRows.count()) === 0) return;
  await landscapeRows.first().click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("outliner-row").filter({ hasText: "Landscape" })).toHaveCount(0);
  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-status")).toContainText("Saved", { timeout: 10_000 });
}

test("editor Landscape paint smoke: paint layer, save, reload", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.getByTestId("outliner-row").first()).toBeVisible({ timeout: 30_000 });

  await deleteExistingLandscape(page);
  await page.getByTestId("add-actor-button").hover();
  await page.getByRole("button", { name: /^Terrain/ }).hover();
  await page.getByRole("button", { name: "Landscape" }).click();

  const landscapeRows = page.getByTestId("outliner-row").filter({ hasText: "Landscape" });
  await expect(landscapeRows.first()).toBeVisible();
  await landscapeRows.first().click();
  await expect(page.locator('[data-inspector-pane="details"] .detail-heading')).toContainText(
    "terrain / landscape",
  );

  await page.locator('[data-landscape-mode="paint"]').click();
  await expect(page.locator('[data-landscape-paint-tool="paint"]')).toBeVisible();
  await page.locator('[data-landscape-layer="dirt"]').click();
  await page.locator("[data-landscape-view]").selectOption("layer");
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

  const canvas = page.locator("#game-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing canvas bounds");
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 3);
  await page.mouse.up();

  await page.getByTestId("editor-save").click();
  await expect(page.getByTestId("editor-status")).toContainText("Saved", { timeout: 10_000 });

  const landscapeData = await page.evaluate(async () => {
    const response = await fetch(`/landscapes/landscape-1.landscape.json?smoke=${Date.now()}`);
    if (!response.ok) throw new Error(`Landscape sidecar fetch failed: ${response.status}`);
    return (await response.json()) as {
      layers: Array<{ id: string; weights: number[] }>;
    };
  });
  const grass = landscapeData.layers.find((layer) => layer.id === "grass");
  const dirt = landscapeData.layers.find((layer) => layer.id === "dirt");
  expect(landscapeData.layers).toHaveLength(4);
  expect(dirt?.weights.some((weight) => weight > 0.05)).toBeTruthy();
  expect(grass?.weights.some((weight) => weight < 0.95)).toBeTruthy();

  await page.goto(`/?editor&landscapePaintReload=${Date.now()}`);
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("outliner-row").filter({ hasText: "Landscape" }).first().click();
  await page.locator('[data-landscape-mode="paint"]').click();
  await expect(page.locator('[data-landscape-layer="dirt"]')).toBeVisible();
  const reloadedData = await page.evaluate(async () => {
    const response = await fetch(`/landscapes/landscape-1.landscape.json?reload=${Date.now()}`);
    if (!response.ok) throw new Error(`Landscape sidecar fetch failed: ${response.status}`);
    return (await response.json()) as {
      layers: Array<{ id: string; weights: number[] }>;
    };
  });
  const reloadedDirt = reloadedData.layers.find((layer) => layer.id === "dirt");
  expect(reloadedDirt?.weights.some((weight) => weight > 0.05)).toBeTruthy();

  expect(pageErrors).toEqual([]);
});

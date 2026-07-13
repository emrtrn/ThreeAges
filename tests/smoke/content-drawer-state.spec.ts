import { expect, test } from "@playwright/test";

const CONTENT_DRAWER_LAST_FOLDER_STORAGE_PREFIX = "forge.editor.content-drawer.last-folder.v1:";

test("Content Drawer restores its last selected folder after a page refresh", async ({ page }) => {
  const folderPath = "assets/starter-content";

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();

  const folder = page.locator(`button.folder-row[title="${folderPath}"]`);
  await expect(folder).toBeVisible({ timeout: 30_000 });
  await folder.click();
  await expect(page.locator("[data-content-path]")).toHaveText(folderPath);

  await page.goto(`/?editor&contentDrawerStateReload=${Date.now()}`);
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  // The editor shell mounts before the asynchronous asset-tree restore completes.
  await expect(page.locator(`button.folder-row[title="${folderPath}"]`)).toBeVisible({
    timeout: 30_000,
  });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-path]")).toHaveText(folderPath);

  await page.evaluate((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  }, CONTENT_DRAWER_LAST_FOLDER_STORAGE_PREFIX);
});

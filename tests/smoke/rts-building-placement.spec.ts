import { expect, test } from "@playwright/test";

test("RTS Phase 4 build palette exposes territory-gated economy structures without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator(".rts-build-palette")).toBeVisible();
  await expect(page.getByRole("region", { name: "Yol yerleştirme" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ağ Görünümü", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ağ Görünümü", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ağ Görünümü", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Oyun hızı" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Normal", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "4X", exact: true }).click();
  await expect(page.getByRole("button", { name: "4X", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Tarla", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Oduncu Kampı", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Karakol", exact: true })).toBeVisible();
  await expect(page.locator('[data-rts-building="house"]')).toContainText("80 Odun");
  await expect(page.locator('[data-rts-building="depot"]')).toContainText("120 Odun");
  await expect(page.locator('[data-rts-building="outpost"]')).toContainText("140 Odun");
  await expect(page.getByRole("button", { name: "İşçi Üret", exact: true })).toBeVisible();
  await expect(page.locator(".rts-hud-population")).toHaveText("Nüfus: 9/20");
  await expect(page.locator(".rts-hud-age")).toHaveText("Çağ: Yerleşim");
  await expect(page.locator(".rts-hud-idle-workers")).toHaveText("Boşta işçi: 5");
  // Faz 9 §51: all four resources are on the bar, not the Faz 3 pair. A zero
  // stone income has to be *visible* to read as the reason the Town age stalls.
  for (const resourceId of ["food", "wood", "stone", "gold"]) {
    await expect(page.locator(`[data-rts-resource="${resourceId}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-rts-resource="${resourceId}"] .rts-hud-resource-income`),
    ).toHaveText("+0.0/dk");
  }
  await expect(page.locator(".rts-debug-overlay")).toContainText("kaynak hareketleri:");
  await expect(page.locator(".rts-debug-overlay")).toContainText("yollar: 0 düğüm · 0 kenar · 0 ağ");
  await expect(page.locator(".rts-debug-overlay")).toContainText("depolar: 0");
  await expect(page.locator(".rts-debug-overlay")).toContainText("üretim bağlantıları: 0");
  await expect(page.locator(".rts-hud-warning")).toBeHidden();
  // Nothing has happened yet, so the feed must be silent rather than empty-boxed.
  await expect(page.locator(".rts-notification-feed")).toBeHidden();

  await page.getByRole("button", { name: "Yol Kur", exact: true }).click();
  await expect(page.locator(".rts-road-status")).toHaveText(
    "Yol başlangıcını sol tıkla seçin; sağ tıkla bitirin.",
  );
  await page.getByRole("button", { name: "Yolu İptal", exact: true }).click();

  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");

  await page.locator("#game-canvas").hover({ position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toContainText(/konum|çakışıyor|kontrol/);

  await page.locator("#game-canvas").click({ button: "right", position: { x: 640, y: 420 } });
  await expect(page.locator(".rts-build-status")).toHaveText("Bir yapı seçin.");
  await page.getByRole("button", { name: "Karakol", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText(
    "Karakolu kontrol alanının hemen dışındaki nötr bir konuma yerleştirin.",
  );
  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "Tarla", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");
  await page.getByRole("button", { name: "İptal", exact: true }).click();
  await page.getByRole("button", { name: "İşçi Üret", exact: true }).click();
  // The match runs at 4X here, so the order can finish before this assertion:
  // accept either side of that race rather than depending on the timing.
  await expect(page.locator(".rts-build-action-message")).toHaveText(
    /İşçi üretim kuyruğa alındı \(\d+\/\d+\)\.|Yeni işçi Merkez'den çıktı\./,
  );
  await expect(page.locator(".rts-hud-population")).toHaveText("Nüfus: 10/20");
  await expect(page.locator(".rts-debug-overlay")).toContainText("reserve: food -50");
  expect(errors).toEqual([]);
});

test("RTS Phase 9 the HUD strip stays clear of the map at 1366x768 and 1920x1080", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // §52 asks for both resolutions to be usable. 1366x768 is the binding one: the
  // HUD, the speed controls and the debug overlay all compete for the top edge.
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?rts&debug");
    const hud = page.locator(".rts-hud-bar");
    await expect(hud).toBeVisible();

    const bar = await hud.boundingBox();
    if (!bar) throw new Error("HUD bar has no box");
    // §52 "UI haritanın kritik alanlarını aşırı kapatmıyor": the strip is a frame
    // edge, so it may cost map height once — but never a tenth of the screen.
    expect(bar.height).toBeLessThan(viewport.height * 0.1);
    expect(bar.width).toBe(viewport.width);

    // The bar owns the top edge, so everything that used to live there has to
    // start below it. This is the assertion that fails if the height variable
    // and the strip's real height drift apart.
    for (const selector of [".rts-debug-overlay", ".rts-game-speed"]) {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new Error(`${selector} has no box`);
      expect(box.y, `${selector} must clear the HUD bar`).toBeGreaterThanOrEqual(bar.y + bar.height);
    }

    // Nothing may push the page into a horizontal scroll at either width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test("RTS Phase 7 palette gates the Archer and the Ram behind a tier-2 Barracks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts");
  await expect(page.locator(".rts-build-palette")).toBeVisible();

  // Plan §45: the whole core roster is visible from the start. A locked unit
  // stays on screen and explains itself — that is what makes Barracks II read
  // as a decision rather than a surprise.
  for (const unitId of ["guard_placeholder", "archer_placeholder", "siege_placeholder"]) {
    await expect(page.locator(`[data-rts-unit="${unitId}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-rts-unit="archer_placeholder"]')).toContainText("Okçu Üret");
  await expect(page.locator('[data-rts-unit="siege_placeholder"]')).toContainText("Koçbaşı Üret");
  await expect(page.locator('[data-rts-unit="archer_placeholder"]')).toHaveAttribute(
    "title",
    /Kışla T2 gerekir/,
  );
  // With no Barracks standing, nothing is trainable yet.
  await expect(page.locator('[data-rts-unit="guard_placeholder"]')).toBeDisabled();

  await expect(page.locator(".rts-selection-panel")).toBeHidden();
  expect(errors).toEqual([]);
});

test("RTS Phase 7 a box-selected group takes a move order and every unit finishes it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const overlay = page.locator(".rts-debug-overlay");
  await expect(overlay).toContainText("birimler:");

  // Pan the starting Guards up off the bottom edge so the marquee below can be
  // drawn over them without crossing the build palette or the debug overlay.
  await canvas.click({ position: { x: 640, y: 400 } });
  await page.keyboard.down("s");
  await page.waitForTimeout(700);
  await page.keyboard.up("s");

  // Box-select the Guard line, then send it somewhere as one group. This is the
  // plan §45 group-movement path end to end — slot distribution, path following,
  // crowd separation and the congestion timeout all run together here, which the
  // headless suite only exercises one system at a time.
  await page.mouse.move(420, 520);
  await page.mouse.down();
  await page.mouse.move(900, 610, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".rts-selection-panel")).toBeVisible();

  await canvas.click({ button: "right", position: { x: 640, y: 300 } });
  await expect(overlay).toContainText(/yol:\d+/);

  // The acceptance that matters is that the order *ends*: no unit may be left
  // walking a route it can never finish (plan §46 "kalıcı sıkışma oluşmuyor").
  await expect(overlay).not.toContainText(/yol:\d+/, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

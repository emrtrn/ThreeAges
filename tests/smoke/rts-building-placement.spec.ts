import { expect, test, type Page } from "@playwright/test";

/**
 * Faz 9 §51: the match opens behind a start screen, so nothing is simulated
 * until the player asks for it. Every test below drives a running match, so
 * each one goes through the same door a player does.
 */
async function openMatch(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
}

/**
 * Faz 9 §51 moved the centre's verbs — worker training and the age — off the
 * palette and onto the centre's own panel, so reaching them now means selecting
 * the building, exactly as a player does. The centre starts below the opening
 * camera, hence the pan.
 *
 * The click sweeps candidates instead of trusting one point: where the centre
 * lands on screen depends on the viewport, and a single hard-coded point silently
 * selects *nothing* the moment a test sets a different size. Success is defined
 * by what the panel says, not by the coordinate that happened to work.
 */
async function selectCommandCenter(page: Page): Promise<void> {
  const canvas = page.locator("#game-canvas");
  await page.keyboard.down("s");
  await page.waitForTimeout(700);
  await page.keyboard.up("s");
  const panel = page.locator(".rts-selection-panel");
  const { width, height } = page.viewportSize() ?? { width: 1280, height: 720 };
  for (const offset of [0.47, 0.42, 0.53, 0.58]) {
    await canvas.click({ position: { x: Math.round(width / 2), y: Math.round(height * offset) } });
    if (await panel.isVisible() && (await panel.innerText()).includes("Merkez")) break;
  }
  await expect(panel, "the pan must leave the Merkez clickable").toContainText("Merkez");
}

test("RTS Phase 4 build palette exposes territory-gated economy structures without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMatch(page, "/?rts&debug");
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
  // §51: the palette is the *placement* surface now. Training a worker is
  // something the Merkez does, so its button left with the building.
  await expect(page.getByRole("button", { name: "İşçi Üret", exact: true })).toHaveCount(0);
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
  await selectCommandCenter(page);
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
    await openMatch(page, "/?rts&debug");
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

test("RTS Phase 9 match flow: start, pause, surrender, and restart back into play", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const overlay = page.locator(".rts-match-overlay");

  // §51: the start screen holds the match. The debug panel is the honest witness
  // that nothing is being simulated behind the card.
  await page.goto("/?rts&debug");
  await expect(overlay).toHaveClass(/is-visible/);
  // §53's clock is part of that witness: an opening spent behind the card would
  // show up here as time already on the board.
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: active · süre 0:00");
  await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
  await expect(overlay).not.toHaveClass(/is-visible/);

  // Escape pauses a running match...
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveClass(/is-visible/);
  await expect(page.locator("[data-rts-result-title]")).toHaveText("Duraklatıldı");
  // ...and resumes it, so the same key both opens and closes the menu.
  await page.keyboard.press("Escape");
  await expect(overlay).not.toHaveClass(/is-visible/);

  // Escape belongs to a pending placement first: a half-placed building is the
  // more immediate thing to back out of, and pausing instead would leave the
  // ghost armed under the menu.
  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText("Haritada konum seçin.");
  await page.keyboard.press("Escape");
  await expect(overlay, "the first Escape cancelled the placement").not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-build-status")).toHaveText("Bir yapı seçin.");
  await page.keyboard.press("Escape");
  await expect(overlay, "with nothing pending, Escape pauses").toHaveClass(/is-visible/);

  // §51 "Teslim ol". It is one click from throwing the match away next to
  // "Yeniden Başlat", so it asks first.
  await page.getByRole("button", { name: "Teslim Ol", exact: true }).click();
  await expect(page.locator('[data-rts-match-action="surrender"]')).toHaveText("Teslim olmayı onayla");
  await page.getByRole("button", { name: "Teslim olmayı onayla", exact: true }).click();

  // A resigned match must not be told its centre was razed — it is still standing.
  await expect(page.locator("[data-rts-result-title]")).toHaveText("Yenilgi");
  await expect(page.locator("[data-rts-result-detail]")).toHaveText("Teslim oldunuz.");
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: defeat");
  // §53: the result screen reports how long the match took — the number Kapı B's
  // "12–25 dakika" box is read against. Asserted as a shape, not a value: what
  // this can prove is that a real duration reaches the card, and a clock wired to
  // nothing would surface here as an empty or `NaN:aN` field.
  await expect(page.locator("[data-rts-result-duration]")).toHaveText(/^Süre: \d+:[0-5]\d$/);

  // Restart returns to a *running* match, not the start screen.
  await page.getByRole("button", { name: "Yeniden Başlat", exact: true }).click();
  await expect(overlay).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-debug-overlay")).toContainText("maç: active");
  await expect(page.locator(".rts-hud-population")).toHaveText("Nüfus: 9/20");
  // The confirm must not survive the match that armed it.
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-rts-match-action="surrender"]')).toHaveText("Teslim Ol");
  expect(errors).toEqual([]);
});

test("RTS Phase 9 pause actually stops the simulation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // The whole point of §51's pause is that the match *stops*, which no amount of
  // menu assertions can show. This drives a real order across the pause.
  await openMatch(page, "/?rts&debug");
  const idle = page.locator(".rts-hud-idle-workers");
  await expect(idle).toHaveText("Boşta işçi: 5");
  // Selected before the speed-up: the helper pans for 700ms of real time, which
  // at 8X would be nearly a minute of match the test never meant to spend.
  await selectCommandCenter(page);
  await page.getByRole("button", { name: "8X", exact: true }).click();

  // A worker takes 25s to train, so at 8X it lands in ~3s. Population cannot be
  // the witness here: queueing *reserves* the slot immediately, so it reads 10/20
  // whether or not the worker ever arrives. A spawned worker is idle, so the idle
  // count is what actually moves when the order completes.
  await page.getByRole("button", { name: "İşçi Üret", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  // §53: the clock is a simulation clock, and this is the one place the real app
  // can be made to say so. It has been running at 8X, so it must already be well
  // past the handful of wall seconds this test has taken — a wall-clock
  // stopwatch could not be here yet.
  const clockLine = async (): Promise<string> => {
    const text = await page.locator(".rts-debug-overlay").innerText();
    return text.split("\n")[0] ?? "";
  };
  const atPause = await clockLine();
  const pausedSeconds = Number(/süre (\d+):(\d\d)/.exec(atPause)?.[1] ?? -1) * 60
    + Number(/süre (\d+):(\d\d)/.exec(atPause)?.[2] ?? -1);
  expect(pausedSeconds, `8X must outrun the wall clock (${atPause})`).toBeGreaterThan(10);

  // Twice the time the order needs. If pause were cosmetic, the worker would
  // have arrived here and the count would read 6.
  await page.waitForTimeout(6000);
  await expect(idle, "a paused match trains nothing").toHaveText("Boşta işçi: 5");
  // And the clock is frozen with it: six wall seconds — 48 at this speed — add
  // nothing, because a paused match is not ticked at all.
  expect(await clockLine(), "a paused match ages no clock").toBe(atPause);

  await page.keyboard.press("Escape");
  await expect(idle, "and resuming finishes the order it was holding").toHaveText(
    "Boşta işçi: 6",
    { timeout: 30_000 },
  );
  expect(errors).toEqual([]);
});

test("RTS Phase 9 build tools: categories, the affordability lock, and settings that move the camera", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await openMatch(page, "/?rts&debug");

  // §51 "Yapı kategorileri": grouped by the question the player is asking.
  await expect(page.locator(".rts-build-category")).toHaveText([
    "Ekonomi", "Lojistik", "Yerleşim", "Askerî",
  ]);

  // §51 "Maliyet ve kilit durumu": every building shows its price, and the
  // opening stock affords all of them. (Draining the wallet to see the lock
  // appear needs 11 Houses' worth of successful placements — too fragile to
  // stake a smoke test on, so `canAffordCost` is held to account in
  // `test:engine` instead. This is the half a browser is needed for.)
  await expect(page.locator(".rts-build-choice.is-unaffordable")).toHaveCount(0);
  await expect(page.locator('[data-rts-building="gold_mine"]')).toContainText("140 Odun");

  // §51 "Karakol kontrol alanı önizlemesi": the disc an outpost would open is
  // drawn while it is still being aimed, and the placement reason reads with it.
  await page.getByRole("button", { name: "Karakol", exact: true }).click();
  await expect(page.locator(".rts-build-status")).toHaveText(
    "Karakolu kontrol alanının hemen dışındaki nötr bir konuma yerleştirin.",
  );
  await page.locator("#game-canvas").hover({ position: { x: 400, y: 560 } });
  await expect(page.locator(".rts-build-status")).toContainText(/Geçerli konum|Geçersiz konum/);
  await page.getByRole("button", { name: "İptal", exact: true }).click();

  // §52 "UI haritanın kritik alanlarını aşırı kapatmıyor". The criterion named
  // the palette by name: a Faz 2 pile 647px tall, the whole right column. Faz 9
  // moved every non-placement verb onto the building that performs it, and this
  // is the measurement that keeps them from drifting back.
  const palette = await page.locator(".rts-build-palette").boundingBox();
  if (!palette) throw new Error("no palette");
  expect(palette.height, "the palette may not reclaim the column").toBeLessThan(768 * 0.7);
  expect((palette.width * palette.height) / (1366 * 768)).toBeLessThan(0.16);

  // §51 "Minimal ayarlar" lives in the pause menu, and only the two settings
  // whose systems exist. A slider for audio the game does not play would be a
  // control the player drags while nothing happens (§13's "yarım sistem").
  await page.keyboard.press("Escape");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
  await expect(page.locator(".rts-match-setting")).toHaveText(["Kamera hızı", "Kamera yumuşatma"]);
  await expect(page.locator("[data-rts-setting]")).toHaveCount(2);

  expect(errors).toEqual([]);
});

test("RTS Phase 9 the Barracks panel gates the Archer and the Ram behind a tier-2 Barracks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Pinned: the build point below has to miss both the palette's column and the
  // selection panel's own box, and both are sized off the viewport. At the 1280
  // default the palette starts at x=948 and swallows this click.
  await page.setViewportSize({ width: 1366, height: 768 });
  await openMatch(page, "/?rts&debug");
  await expect(page.locator(".rts-build-palette")).toBeVisible();

  // §51: training is what a Barracks does, so the roster left the palette with
  // it. Nothing selected means no roster anywhere.
  await expect(page.locator(".rts-selection-panel")).toBeHidden();
  await expect(page.locator("[data-rts-action^='train:']")).toHaveCount(0);

  // Build one, then ask it what it can train.
  await page.getByRole("button", { name: "8X", exact: true }).click();
  await page.getByRole("button", { name: "Kışla", exact: true }).click();
  const site = { x: 950, y: 660 };
  await page.locator("#game-canvas").hover({ position: site });
  await expect(page.locator(".rts-build-status")).toHaveText("Geçerli konum — yerleştirmek için tıklayın.");
  await page.locator("#game-canvas").click({ position: site });
  await page.locator("#game-canvas").click({ button: "right", position: site });
  // Wait out construction, then select it. Retried rather than slept: the site
  // reads as a construction panel until it finishes, and "Kuyruk:" is the first
  // thing only a finished Barracks says.
  await expect(async () => {
    await page.locator("#game-canvas").click({ position: site });
    await expect(page.locator(".rts-selection-panel")).toContainText("Kuyruk:");
  }).toPass({ timeout: 40_000 });

  // Plan §45: the whole core roster is on it, locked entries included. A locked
  // unit stays on screen and explains itself — that is what makes Barracks II
  // read as a decision rather than a surprise. It now says so on the building
  // where the decision is made, and at the first moment it can be acted on.
  for (const unitId of ["guard_placeholder", "archer_placeholder", "siege_placeholder"]) {
    await expect(page.locator(`[data-rts-action="train:${unitId}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-rts-action="train:archer_placeholder"]')).toContainText("Okçu Üret");
  await expect(page.locator('[data-rts-action="train:siege_placeholder"]')).toContainText("Koçbaşı Üret");
  await expect(page.locator('[data-rts-action="train:archer_placeholder"]')).toHaveAttribute(
    "title",
    /Kışla Lv2 gerekir/,
  );
  await expect(page.locator('[data-rts-action="train:archer_placeholder"]')).toBeDisabled();
  // A T1 Barracks trains the Guard, and a legal action carries no excuse.
  await expect(page.locator('[data-rts-action="train:guard_placeholder"]')).toBeEnabled();
  await expect(page.locator('[data-rts-action="train:guard_placeholder"]')).toHaveAttribute("title", "");

  expect(errors).toEqual([]);
});

test("RTS Phase 7 a box-selected group takes a move order and every unit finishes it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openMatch(page, "/?rts&debug");
  const canvas = page.locator("#game-canvas");
  await expect(canvas).toBeVisible();
  const overlay = page.locator(".rts-debug-overlay");
  await expect(overlay).toContainText("birimler:");

  // Pan the starting Guards up off the bottom edge: they stand below the opening
  // camera, and no marquee can select what is not on screen.
  await page.keyboard.down("s");
  await page.waitForTimeout(700);
  await page.keyboard.up("s");

  // Select the Guard line, then send it somewhere as one group. This is the plan
  // §45 group-movement path end to end — slot distribution, path following, crowd
  // separation and the congestion timeout all run together here, which the
  // headless suite only exercises one system at a time.
  //
  // Finding the line is deliberately not a fixed marquee any more. That box
  // (420,520 → 900,610) was the flake §51 recorded: how far a 700 ms pan travels
  // depends on the frame rate, so the Guards fell inside it only some of the
  // time. A wide sweep fixes *that* but changes the test — it also catches the
  // five Workers, making this a nine-unit scenario the Faz 7 acceptance was never
  // written about. So: find one Guard, then let the game's own §21 gesture
  // ("çift tıkla aynı savaş birimi türünü seç") select exactly the Guards,
  // wherever they ended up.
  const panel = page.locator(".rts-selection-panel");
  const { width, height } = page.viewportSize() ?? { width: 1280, height: 720 };
  let guard: { x: number; y: number } | null = null;
  for (const fy of [0.72, 0.66, 0.78, 0.6, 0.84]) {
    for (const fx of [0.5, 0.42, 0.58, 0.34, 0.66]) {
      const point = { x: Math.round(width * fx), y: Math.round(height * fy) };
      await canvas.click({ position: point });
      if (await panel.isVisible() && (await panel.innerText()).includes("Muhafız")) {
        guard = point;
        break;
      }
    }
    if (guard) break;
  }
  if (!guard) throw new Error("the pan must leave a Muhafız on screen to select");
  await canvas.dblclick({ position: guard });
  await expect(panel, "the double-click selects the whole Guard line").toContainText(/[2-9] Muhafız/);

  await canvas.click({ button: "right", position: { x: 640, y: 300 } });
  await expect(overlay).toContainText(/yol:\d+/);

  // The acceptance that matters is that the order *ends*: no unit may be left
  // walking a route it can never finish (plan §46 "kalıcı sıkışma oluşmuyor").
  await expect(overlay).not.toContainText(/yol:\d+/, { timeout: 30_000 });
  expect(errors).toEqual([]);
});

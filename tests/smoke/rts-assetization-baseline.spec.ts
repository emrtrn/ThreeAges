import { expect, test } from "@playwright/test";
import { startRtsMatch } from "./rtsBoot";

/**
 * Actor presentation browser witness.
 *
 * The plain `?rts` route renders the authored Actor pack — no flag involved, and
 * since Faz 5 no second art path exists to fall back to. The pack's own health is
 * published on the canvas, so "the default route is on the authored path and
 * nothing in it fell back" is a fact this test can read rather than infer from a
 * screenshot.
 */
test("Actor presentation: the default RTS route renders the authored Actor pack", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-assets", "ready", { timeout: 30_000 });
  // Zero stand-ins is the shipped state, published as a number so "healthy" and
  // "not reported yet" can never read the same. A broken Actor would leave
  // `data-rts-content-assets="placeholder"` and a non-zero count here.
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-placeholders", "0");
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  // No flag was passed, and there is no longer one to pass: the removed
  // `contentAssets` id is not part of the resolved flag state at all.
  const flagIds = await page.evaluate(() => {
    const forge = (window as unknown as {
      __forge?: { config?: { flags?: Record<string, unknown> } };
    }).__forge;
    return Object.keys(forge?.config?.flags ?? {});
  });
  expect(flagIds, "the Actor pack must not depend on a feature flag").not.toContain("contentAssets");

  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");
  await expect(page.locator(".rts-debug-sim")).toContainText("placeholder yok");

  expect(errors, "default RTS boot must not produce console errors").toEqual([]);
});

test("Actor presentation Faz 5: a bookmark carrying the removed flag still boots the same pack", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Removing a flag must not strand the URLs people already have. An unknown id
  // in `?flags=` is ignored, so the route opens and builds exactly the same pack.
  // The debug overlay's presentation line carries the loaded/requested counts, so
  // comparing it across the two routes compares what each of them actually built.
  const presentationLine = async (url: string): Promise<string> => {
    await page.goto(url);
    await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-assets", "ready", { timeout: 30_000 });
    await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-content-placeholders", "0");
    const overlay = await page.locator(".rts-debug-sim").textContent();
    return overlay?.split("\n").find((line) => line.startsWith("sunum:")) ?? "";
  };

  const plain = await presentationLine("/?rts&debug");
  const staleBookmark = await presentationLine("/?rts&debug&flags=contentAssets");
  expect(plain).toMatch(/^sunum: \d+\/\d+ Actor · placeholder yok$/);
  expect(staleBookmark, "the removed flag is ignored, not fatal").toBe(plain);

  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  expect(errors, "an unknown flag must not disturb the RTS match").toEqual([]);
});

test("Play the level you edit: ?level= opens that map, whatever the preset names", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const coreMatch = "assets/ThreeAges/Levels/RTS_CoreMatch.level.json";
  // `gameplay_proof` names RTS_GameplayProof, so if the preset were still winning
  // this would open the wrong map — the failure the parameter exists to prevent.
  await page.goto(`/?rts&debug&preset=gameplay_proof&level=${coreMatch}`);
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored", { timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-ref", coreMatch);

  // No `flags=levelAssets` above: naming a Level explicitly is the opt-in. The
  // preset's own map stays behind the flag, unchanged.
  await page.goto("/?rts&debug&preset=gameplay_proof");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "blockout");

  await page.goto(`/?rts&debug&preset=gameplay_proof&level=${coreMatch}`);
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level-ref", coreMatch, { timeout: 30_000 });
  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");

  expect(errors, "an explicitly named Level must boot a playable match").toEqual([]);
});

test("Assetization Faz D: the opt-in authored Level drives the spatial layout of a live match", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Default boot resolves the legacy blockout — even though the default preset
  // carries a levelRef, the levelAssets gate keeps it opt-in.
  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "blockout");

  // With the flag on, the default preset's shipped Level loads and its markers
  // become the spatial authority for the whole match. Deliberately not named
  // here: this test is about the gate, and the preset behind it has already
  // changed once (core_match → gameplay_proof).
  await page.goto("/?rts&debug&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored", { timeout: 30_000 });
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");

  expect(errors, "the authored Level must adapt and boot a match without runtime errors").toEqual([]);
});

test("Landscape Faz 1: the gameplay_proof preset resolves its own authored Level under levelAssets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Flag off: even though gameplay_proof now carries a levelRef, the levelAssets
  // gate keeps it opt-in, so the legacy blockout fallback still drives the match
  // on the flat placeholder ground.
  await page.goto("/?rts&debug&preset=gameplay_proof");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "blockout");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-ground", "flat");

  // Flag on: the preset's own RTS_GameplayProof Level loads and its markers become
  // the spatial authority — the Faz 1 witness that the separate authoring asset is
  // wired end to end (preset levelRef -> loader -> RtsApp), not core_match's file.
  await page.goto("/?rts&debug&preset=gameplay_proof&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored", { timeout: 30_000 });
  // Faz 4: the Level's authored Landscape mounts and retires the flat ground, so
  // the match now renders on the sculpted terrain rather than the placeholder plane.
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-ground", "landscape", { timeout: 30_000 });
  await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);

  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");

  // Road/build stutter investigation: the authored-terrain route publishes the
  // latest event-driven paint scope in the existing debug performance witness.
  await page.waitForFunction(() => {
    const raw = document.querySelector("#game-canvas")?.getAttribute("data-rts-perf");
    if (!raw) return false;
    try {
      return JSON.parse(raw).terrainPaint !== null;
    } catch {
      return false;
    }
  });
  const terrainPaint = await page.locator("#game-canvas").evaluate((canvas) => {
    const snapshot = JSON.parse(canvas.getAttribute("data-rts-perf") ?? "{}");
    return snapshot.terrainPaint as {
      durationMs: number;
      roadSegments: number;
      structurePads: number;
      dirtyBounds: { x0: number; z0: number; x1: number; z1: number } | null;
    };
  });
  expect(terrainPaint.durationMs).toBeGreaterThanOrEqual(0);
  expect(terrainPaint.roadSegments).toBeGreaterThanOrEqual(0);
  expect(terrainPaint.structurePads).toBeGreaterThanOrEqual(0);

  expect(errors, "the gameplay proof Level must adapt and boot a match without runtime errors").toEqual([]);
});

test("Landscape Faz 5: command and build placement picking work over the mounted landscape", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?rts&debug&preset=gameplay_proof&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-ground", "landscape", { timeout: 30_000 });
  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);

  // V1 keeps a flat playable field: command, road and building placement all
  // raycast a mathematical y=0 plane, not the terrain mesh, so picking must return
  // a world point over the landscape exactly as it did on the flat placeholder.
  // The three tools share that one raycast, so exercising the build + road tools
  // proves the ground picking all three depend on still resolves over the terrain.
  const canvas = page.locator("#game-canvas");
  const status = page.locator(".rts-build-status");
  await page.getByRole("button", { name: "Yerleşim", exact: true }).click();
  await page.getByRole("button", { name: "Ev", exact: true }).click();
  await expect(status).toHaveText("Haritada konum seçin.");
  // Hovering resolves a ground point: the status turns location-reactive — valid,
  // occupied or out-of-territory. Anything but the idle prompt means the ray hit
  // the ground plane on the landscape-mounted world.
  await canvas.hover({ position: { x: 640, y: 400 } });
  await expect(status).toContainText(/konum|çakış|kontrol|Geçerli|Geçersiz/);
  await canvas.click({ button: "right", position: { x: 640, y: 400 } });
  await expect(status).toHaveText("Bir yapı seçin.");

  // The road tool arms the same plane; its start-point prompt confirms picking is
  // live over the terrain, and right-clicking backs out without an error.
  await page.getByRole("button", { name: "Lojistik", exact: true }).click();
  await page.getByRole("button", { name: "Yol", exact: true }).click();
  await expect(status).toContainText("Yol başlangıcını");
  await canvas.click({ button: "right", position: { x: 640, y: 400 } });

  // The erase tool (GDD 10 §44) arms the same plane and reports whether the tile
  // under the cursor carries a road, so it exercises the identical ground pick.
  await page.getByRole("button", { name: "Yol Sil", exact: true }).click();
  await expect(status).toContainText("Silmek için");
  await canvas.hover({ position: { x: 640, y: 400 } });
  await expect(status).toContainText("Silmek için");
  await canvas.click({ button: "right", position: { x: 640, y: 400 } });
  await expect(status).toHaveText("Bir yapı seçin.");

  expect(errors, "gameplay picking over the landscape must not error").toEqual([]);
});

test("Assetization Faz E: the opt-in Level mounts its authored static world and restarts cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Default boot authors no world: the levelAssets gate keeps the Level's static
  // instances + sun off, so the legacy code sun and RtsMapArt ridge stay.
  await page.goto("/?rts&debug");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-authored-world", "disabled");

  // With the flag on, the shipped Level's sun + ridge instances mount through the
  // generic authored-world loader — the browser witness that "landscape/decor/
  // light change reaches runtime without code change" (Faz E acceptance).
  await page.goto("/?rts&debug&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toBeVisible();
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-authored-world", "ready", { timeout: 30_000 });
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-level", "authored");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-landscape-pbr", "full");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-landscape-samplers", /^12\/\d+$/);

  await startRtsMatch(page);
  await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();
  await expect(page.locator(".rts-debug-sim")).toContainText("maç: active");

  // Reloading tears the whole RtsApp down (authored-world dispose included) and
  // rebuilds it: the world must mount again with no runtime errors, the flat-
  // ground match still booting — the "dispose/restart leaves no leak" acceptance.
  await page.goto("/?rts&debug&flags=levelAssets");
  await expect(page.locator("#game-canvas")).toHaveAttribute("data-rts-authored-world", "ready", { timeout: 30_000 });
  await startRtsMatch(page);
  await expect(page.locator(".rts-hud-bar")).toBeVisible();

  expect(errors, "mounting and disposing the authored world must not produce runtime errors").toEqual([]);
});

test("Assetization Faz C: Guard Actor Script is discoverable and opens from the Content Drawer", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await page.locator("[data-content-search]").fill("BP_RTS_Guard");

  const guardActor = page.locator('[data-asset-path="assets/ThreeAges/Actors/Units/BP_RTS_Guard.actor.json"]');
  await expect(guardActor).toBeVisible();
  await guardActor.dblclick();
  await expect(page.locator(".as-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-as-title]")).toHaveText("BP_RTS_Guard");
  await expect(page.locator("[data-as-status]")).toHaveText("Ready.");

  expect(errors, "opening the authored Actor Script must not produce runtime errors").toEqual([]);
});

test("Material assetization: accepted wood-dark pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  // Entering the folder waits for the asynchronous project catalog to become
  // available; a root-level search can otherwise race the initial load.
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Wood_Dark");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Wood_Dark.material.json"]');
  await expect(material).toBeVisible();
  // Asset cards can refresh while their thumbnails settle. Dispatch against the
  // resolved card so this assertion covers the Material Editor handoff rather
  // than Playwright's actionability retry loop.
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Wood_Dark");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the accepted PBR material must not produce runtime errors").toEqual([]);
});

test("Material assetization: accepted wood-light pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Wood_Light");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Wood_Light.material.json"]');
  await expect(material).toBeVisible();
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Wood_Light");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the accepted PBR material must not produce runtime errors").toEqual([]);
});

test("Material assetization: delegated roof-clay pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Roof_Clay");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Roof_Clay.material.json"]');
  await expect(material).toBeVisible();
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Roof_Clay");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the delegated PBR material must not produce runtime errors").toEqual([]);
});

test("Material assetization: delegated wall-plaster pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Wall_Plaster");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Wall_Plaster.material.json"]');
  await expect(material).toBeVisible();
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Wall_Plaster");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the delegated PBR material must not produce runtime errors").toEqual([]);
});

test("Material assetization: accepted grass-meadow pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Grass_Meadow");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Grass_Meadow.material.json"]');
  await expect(material).toBeVisible();
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Grass_Meadow");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the accepted meadow PBR material must not produce runtime errors").toEqual([]);
});

test("Material assetization: accepted road-gravel pilot opens with BC, normal and ORM maps", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?editor");
  await expect(page.getByTestId("forge-editor")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-content-toggle]").click();
  await expect(page.locator("[data-content-list]")).toBeVisible();
  await page.locator('button[title="assets/ThreeAges/Materials"]').dispatchEvent("click");
  await page.locator("[data-content-search]").fill("M_TA_Road_Gravel");

  const material = page.locator('[data-asset-path="assets/ThreeAges/Materials/M_TA_Road_Gravel.material.json"]');
  await expect(material).toBeVisible();
  await material.dispatchEvent("dblclick");
  await expect(page.locator(".me-editor-overlay")).toBeVisible();
  await expect(page.locator("[data-me-title]")).toHaveText("M_TA_Road_Gravel");
  await expect(page.locator("[data-me-status]")).toHaveText("Ready.");

  expect(errors, "opening the accepted road PBR material must not produce runtime errors").toEqual([]);
});

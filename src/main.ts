/**
 * Entry point: wires the DOM (canvas + UI overlay) to the scene layer.
 * Keep this file thin — composition only, no game or render logic.
 *
 * Routes (single codebase, one SceneApp):
 *   (default)  game mode — runtime render, no editor UI.
 *   ?editor    editor mode — same SceneApp + dynamically-imported EditorUi overlay
 *              (the editor bundle is a separate chunk, never loaded in game mode).
 *   ?debug     attaches the perf overlay in any mode.
 */
import { RuntimeSceneApp } from "@/scene/RuntimeSceneApp";
import { attachDebugStats } from "@/scene/debugStats";
import { installGlobalErrorHandlers } from "@/game/core/errorHandler";
import { setLogLevel, logger } from "@/game/core/logger";
import {
  createRuntimeConfig,
  readBootOptionsFromUrl,
  snapshotRuntimeConfig,
} from "@/game/core/runtimeConfig";
import { loadAgeBalance, loadAiBalance, loadAiLayoutBalance, loadAnimalBalance, loadBuildingBalance, loadCaravanBalance, loadGamePreset, loadMissionScript, loadResourceBalance, loadRoadBalance, loadTradeSiteBalance, loadUnitBalance } from "@/game/data/gameDataLoader";
import { loadRtsContentCatalog } from "@/game/rts/content/rtsContentLoader";
import {
  readStoredVictoryCondition,
  victoryChoiceEnablesRegional,
  victoryChoiceForFlag,
  victoryConditionFlagOverride,
  writeStoredVictoryCondition,
} from "@/game/rts/match/victoryConditionChoice";
import {
  fogChoiceEnablesFog,
  fogChoiceForFlag,
  fogOfWarFlagOverride,
  readStoredFogOfWar,
  writeStoredFogOfWar,
} from "@/game/rts/vision/fogOfWarChoice";
import {
  readStoredAiProfile,
  resolveAiProfile,
  writeStoredAiProfile,
} from "@/game/rts/match/aiProfileChoice";
import {
  markMissionSeen,
  missionScriptIdForMode,
  resolveMissionMode,
  writeMissionMode,
} from "@/game/rts/tutorial/missionModeChoice";
import type { RtsMatchSetupValues } from "@/game/rts/match/rtsMatchSetup";
import {
  matchSetupSearch,
  menuSearch,
  readMatchSetupFromUrl,
  urlPinsMatchSetup,
} from "@/game/rts/match/rtsMatchSetupUrl";
import { RtsLoadingScreen } from "@/game/rts/ui/rtsLoadingScreen";
import { resolveRtsLevelRef } from "@/game/rts/world/rtsLevelRef";
import type { GamePreset } from "@/game/data/gameDataTypes";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}

/**
 * Faz 0 production-foundation boot: install runtime error capture, resolve the
 * active preset + feature flags, and (in dev) expose a read-only snapshot for
 * the debug panel. Simulation-speed application lands with the Faz 1 game loop;
 * here the value is only resolved and logged.
 */
interface BootFoundationResult {
  readonly preset: GamePreset | null;
  /** Assetization Faz D's opt-in authored gameplay-Level gate. */
  readonly levelAssetsEnabled: boolean;
  /** Prosperity is debug-only in Phase 6 and never enters gameplay gates. */
  readonly prosperityDebugEnabled: boolean;
  /**
   * §58's second win condition (Faz 11). Unlike prosperity this *is* a gameplay
   * gate, which is exactly why it stays behind a flag until §58's acceptance
   * criteria are met in playtesting: `?flags=regionalVictory`.
   */
  readonly regionalVictoryEnabled: boolean;
  /**
   * §59's fog of war (Faz 11). Also a gameplay gate rather than a debug view —
   * it changes what *both* kingdoms know — so it stays behind a flag until §59's
   * acceptance criteria are measured: `?flags=fogOfWar`.
   */
  readonly fogOfWarEnabled: boolean;
}

/**
 * Where §78.1's match-setup choice lives: session storage, so it survives the
 * setup re-boot and dies with the tab. A match setting is not a saved profile —
 * a new tab should open on the default (§78.1: "Varsayılan yalnız askerî").
 *
 * Access is guarded because a browser with storage disabled throws on the
 * *property*, before any call: the game must still boot, just without a memory.
 */
function matchSetupStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Where the "you have met the story tur" bit lives (Hikâye / Öğretici Tur Modu,
 * Faz 2). Local rather than session, and that is the whole point: the *choice*
 * is a match setting, but whether this person has already been offered the tur
 * is a fact about them that has to outlive the tab, or every new tab would open
 * the tutorial again for someone who finished it last week.
 *
 * Guarded for the same reason as above: a browser with storage disabled throws
 * on the property, and the game must still boot — just without a memory.
 */
function missionSeenStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function bootFoundation(): Promise<BootFoundationResult> {
  installGlobalErrorHandlers();
  const isDev = import.meta.env.DEV;
  setLogLevel(isDev ? "debug" : "warn");

  const params = new URLSearchParams(location.search);
  // `gameplay_proof` is the shipped scenario: the authored Landscape, the river,
  // and the stockpile the story tur is balanced against. It replaced `core_match`
  // as the default (and as a file) once the flat blockout scenario stopped being
  // played — the blockout itself is still the fallback map and still pinned by
  // `RTS_CoreMatch.level.json`, which is code-mirror test data, not a preset.
  const presetId = params.get("preset") ?? "gameplay_proof";
  const log = logger("System");

  let preset: GamePreset | null = null;
  try {
    preset = await loadGamePreset(presetId);
  } catch (error) {
    // A bad/missing preset must not stop the app from booting; log and fall
    // back to defaults so the runtime stays playable (plan §12).
    log.warn(`Preset "${presetId}" unavailable; using defaults`, error);
  }

  // §78.1/§59: the start card's choices, made in a previous pass through this
  // boot. Each is null until the player picks it, which is what keeps `?flags=`
  // and the §72 test presets authoritative for anyone who never touched the card.
  // Merged into one override object because `flagOverrides` is the last word in
  // the precedence chain and there is only one of it — the two choices own
  // different flags, so a spread cannot lose either.
  const setupStorage = matchSetupStorage();
  const config = createRuntimeConfig(preset, {
    ...readBootOptionsFromUrl(isDev),
    flagOverrides: {
      ...victoryConditionFlagOverride(readStoredVictoryCondition(setupStorage)),
      ...fogOfWarFlagOverride(readStoredFogOfWar(setupStorage)),
    },
  });
  log.info(`runtime config ready (preset ${config.presetId})`);

  if (isDev) {
    (window as unknown as { __forge?: unknown }).__forge = {
      config: snapshotRuntimeConfig(config),
    };
  }
  return {
    preset,
    levelAssetsEnabled: config.flags.levelAssets,
    prosperityDebugEnabled: config.flags.prosperity,
    regionalVictoryEnabled: config.flags.regionalVictory,
    fogOfWarEnabled: config.flags.fogOfWar,
  };
}

/**
 * Everything a match needs that the *menu cannot change* — plan F3 (§7.3).
 *
 * Started while the menu is on screen and awaited after the click, which is the
 * whole reason the second curtain is short: by the time the player commits, the
 * balance tables, the Actor catalog and the `RtsApp` chunk are already in hand,
 * and only the setup-dependent loads (mission script, Level) are left.
 *
 * The two stragglers from plan §2.1 — caravan and trade-site balance — join the
 * `Promise.all` here. They were serial for no reason; nothing downstream of them
 * feeds the other eight.
 *
 * The `RtsApp` module rides along because it is the single largest thing the
 * click used to wait on, and which chunk to fetch is not a question the menu
 * answers either. The catalog stays a second step: it is built *from* the unit,
 * building and animal tables, so it cannot start before they land.
 */
async function preloadRtsMatchData() {
  const [
    rtsModule,
    unitBalance,
    buildingBalance,
    resourceBalance,
    animalBalance,
    ageBalance,
    roadBalance,
    aiBalance,
    aiLayoutBalance,
    caravanBalance,
    tradeSiteBalance,
  ] = await Promise.all([
    import("@/game/rts/RtsApp"),
    loadUnitBalance(),
    loadBuildingBalance(),
    loadResourceBalance(),
    loadAnimalBalance(),
    loadAgeBalance(),
    loadRoadBalance(),
    loadAiBalance(),
    loadAiLayoutBalance(),
    loadCaravanBalance(),
    loadTradeSiteBalance(),
  ]);
  // The Actor pack is how the RTS renders, so the catalog loads on every start.
  // A catalog that fails to load is fatal to the route on purpose: it is the
  // mapping from gameplay ids to art, and there is no second art path left to
  // quietly fall back to — a match booted without it would be an art-less match.
  const contentCatalog = await loadRtsContentCatalog(unitBalance, buildingBalance, animalBalance);
  return {
    RtsApp: rtsModule.RtsApp,
    unitBalance,
    buildingBalance,
    resourceBalance,
    animalBalance,
    ageBalance,
    roadBalance,
    aiBalance,
    aiLayoutBalance,
    caravanBalance,
    tradeSiteBalance,
    contentCatalog,
  };
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const canvas = requireElement<HTMLCanvasElement>("game-canvas");
  const editorEnabled = params.has("editor");
  const rtsRoute = !editorEnabled && params.has("rts");
  // Plan acceptance criterion 1: the RTS route must never show a bare black
  // canvas. The curtain goes up here, *before the first await* — `bootFoundation`
  // fetches a preset, and everything after it fetches more, so any later mount
  // point would still leave the first empty window uncovered. This one belongs to
  // the menu; `RtsApp` raises a second one of its own for the match load (plan
  // §3: the curtain appears twice, and both appearances are short).
  let bootCurtain = rtsRoute ? new RtsLoadingScreen() : null;

  const { preset, levelAssetsEnabled, prosperityDebugEnabled, regionalVictoryEnabled, fogOfWarEnabled } =
    await bootFoundation();

  const scriptMessageTraceLimit = import.meta.env.DEV && params.has("debug") ? 20 : 0;

  // RTS game route (Vertical Slice Plan v0.2 Faz 1). Gated behind ?rts so the
  // character runtime + editor stay the default until the RTS is promoted. Its
  // own lightweight runtime — never mixes with the character SceneApp above.
  if (rtsRoute) {
    const setupStorage = matchSetupStorage();
    const requestedMatchSeed = Number(params.get("seed"));
    // `let`, because the route can come back here: "Ana Menü" ends a match and
    // re-opens the menu, and the match started after that is a *new* match. A
    // pinned `?seed=` describes the boot it arrived with, not every match played
    // in the tab afterwards.
    let matchSeed = Number.isSafeInteger(requestedMatchSeed) ? requestedMatchSeed : Date.now();
    // What the menu opens on: the *resolved* boot state, not a table of defaults.
    // `regionalVictoryEnabled` / `fogOfWarEnabled` already came through
    // defaults → preset → `?flags=` → stored choice inside `bootFoundation`, so
    // seeding from them is what keeps a `?flags=regionalVictory` URL or a §72
    // test preset from being quietly contradicted by the menu it opens.
    const seededSetup: RtsMatchSetupValues = {
      missionMode: resolveMissionMode(setupStorage, missionSeenStorage()),
      victoryCondition: victoryChoiceForFlag(regionalVictoryEnabled),
      fogOfWar: fogChoiceForFlag(fogOfWarEnabled),
      aiProfile: resolveAiProfile(readStoredAiProfile(setupStorage), preset?.aiProfile),
    };
    let setup = readMatchSetupFromUrl(params, seededSetup);
    let preload: ReturnType<typeof preloadRtsMatchData> | undefined;
    // KARAR 3/4: a URL that already describes a match has answered the menu's
    // only question — a shared link, a refresh after the transition below, or the
    // editor's Play button handing over a Level to try. It answers it *once*: the
    // pause card's "Ana Menü" comes back here on purpose, and a player who asked
    // for the menu gets the menu whichever door they came in through.
    let showMenu = !urlPinsMatchSetup(params);
    // The route loops rather than returns, because a match is no longer the end of
    // it: menu → match → menu → match, all in one page. `RtsApp` is disposed and
    // rebuilt each pass; `preload` is not, so every match after the first opens on
    // data that is already in memory.
    for (;;) {
      if (showMenu) {
        const { RtsMainMenu } = await import("@/game/rts/ui/rtsMainMenu");
        // Seeded with the *last* setup rather than the URL's: on a return trip the
        // menu should open on the match that was just played, not on the one the
        // tab happened to be opened with.
        const menu = new RtsMainMenu(setup);
        // The menu is what the player is looking at now, so the curtain that was
        // covering the boot has nothing left to cover. Removed rather than faded:
        // the menu is already painted over it, so a fade would only be a layer
        // swallowing clicks for another 400ms.
        bootCurtain?.dispose();
        bootCurtain = null;
        if (!preload) {
          // F3: fill the time the player spends reading the menu. Started *after*
          // the menu's own chunk is in hand, so the first thing they wait for is
          // never queued behind the match load. Once only — a return trip finds
          // this already resolved, which is why the second match opens fast.
          preload = preloadRtsMatchData();
          // Nothing awaits this until the click, and an unawaited rejection is an
          // unhandled one. Swallowing it here only marks it handled — the real
          // `await` below is still the throw site, so a dead catalog fetch fails
          // at exactly the point it always did.
          preload.catch(() => {});
        }
        setup = await menu.choose();
        // §78.1's storage survives, but nothing reloads any more (plan §2.3): these
        // exist so a *new tab* opens on the match you last set up, not so the boot
        // can read back its own choice one navigation later.
        writeMissionMode(setupStorage, setup.missionMode);
        writeStoredVictoryCondition(setupStorage, setup.victoryCondition);
        writeStoredFogOfWar(setupStorage, setup.fogOfWar);
        writeStoredAiProfile(setupStorage, setup.aiProfile);
        // Declining the tur is an answer too, so it counts as having met the offer.
        if (setup.missionMode === "free") markMissionSeen(missionSeenStorage());
        // KARAR 3: the address follows the screen. The transition is not a
        // navigation (KARAR 2), so without this the URL would still say "menu"
        // while a match was being played, and the link the player copied would open
        // something else.
        history.pushState(null, "", matchSetupSearch(params, setup, matchSeed));
        // The second curtain (plan §3), raised before the awaits below rather than
        // after them, for the same reason as the first: the gap it covers is the
        // one where nothing is on screen yet.
        bootCurtain = new RtsLoadingScreen();
      }
      // The menu is the last word on both flags: it ran before anything was
      // constructed, so unlike the old start card there is no already-resolved
      // state for it to disagree with (plan §2.3, and why the four
      // `location.reload()` calls are gone).
      const regionalVictoryChosen = victoryChoiceEnablesRegional(setup.victoryCondition);
      const fogOfWarChosen = fogChoiceEnablesFog(setup.fogOfWar);

      // Already running if the menu was shown; started here for the pinned routes
      // (a shared link, a refresh, the editor's Play button), which have no menu to
      // overlap it with. Assigned rather than awaited in place so a later pass
      // reuses it instead of re-fetching everything.
      preload ??= preloadRtsMatchData();
      const {
        RtsApp,
        unitBalance,
        buildingBalance,
        resourceBalance,
        animalBalance,
        ageBalance,
        roadBalance,
        aiBalance,
        aiLayoutBalance,
        caravanBalance,
        tradeSiteBalance,
        contentCatalog,
      } = await preload;
      // Story/tutorial chain (Hikâye / Öğretici Tur Modu, Faz 1-2). The menu's mode
      // row decides, defaulting to the tur for a player who has never resolved the
      // offer and to free play for one who has; `?mission=<id>` still pins one
      // explicitly — a dev door, and the way a second chain would be tried before
      // the menu knows about it.
      //
      // A script that fails to load must not take the match down with it: the mode
      // is guidance layered over a match that is perfectly playable without it, so
      // a bad file costs the player their objectives and nothing else.
      const missionId = params.get("mission") ?? missionScriptIdForMode(setup.missionMode);
      let missionScript: Awaited<ReturnType<typeof loadMissionScript>> | undefined;
      if (missionId) {
        try {
          missionScript = await loadMissionScript(missionId, new Set(Object.keys(buildingBalance)));
        } catch (error) {
          logger("System").warn(`Mission "${missionId}" unavailable; playing an ordinary match`, error);
        }
      }
      // A story chain owns the match objective. Regional victory is an alternate
      // free-match win condition, so allowing both would let a player finish the
      // round before the teaching chain is complete. Keep the saved free-match
      // preference intact, but never construct the regional systems for a story.
      const storyModeRegionalVictoryEnabled = !missionScript && regionalVictoryChosen;
      // `?level=` (what the editor's Play button passes) outranks the preset's map,
      // so the level being edited is the level that opens. See `rtsLevelRef.ts`.
      //
      // Neither a malformed path nor a scene without RTS markers may leave a blank
      // page. Play opens whatever is being edited, and mid-edit that scene can be
      // missing a Kingdom Start or simply not be an RTS map at all — an ordinary
      // authoring state, not a crash. Refuse it, say why, and open the blockout map
      // so the round trip still lands somewhere playable. Silence is the one
      // unacceptable outcome: the whole point of `?level=` is that you can tell
      // which map you are on.
      const levelParam = params.get("level");
      let levelRef: string | null = null;
      let authoredLevel: Awaited<ReturnType<typeof import("@/game/rts/world/rtsLevelLoader")["loadRtsLevel"]>> | undefined;
      let levelLoadError: string | undefined;
      try {
        levelRef = resolveRtsLevelRef({
          levelParam,
          presetLevelRef: preset?.levelRef,
          levelAssetsEnabled,
        });
        if (levelRef) {
          authoredLevel = await (await import("@/game/rts/world/rtsLevelLoader")).loadRtsLevel(
            levelRef,
            { buildings: buildingBalance, resources: resourceBalance, animals: animalBalance },
          );
        }
      } catch (error) {
        levelLoadError = error instanceof Error ? error.message : String(error);
        // Name the value that was asked for, even when it never became a valid ref.
        levelRef = levelRef ?? levelParam;
        logger("System").error(`RTS Level "${levelRef}" could not be played`, error);
      }
      // Resolved by the pause card's "Ana Menü". The app reports rather than acts
      // (see `RtsApp.exitToMenu`), so the teardown happens here, on an empty stack,
      // after the click handler that asked for it has returned.
      let leaveMatch!: () => void;
      const leftMatch = new Promise<void>((resolve) => { leaveMatch = resolve; });
      const rts = new RtsApp(canvas, {
        debug: params.has("debug"),
        prosperityDebugEnabled,
        regionalVictoryEnabled: storyModeRegionalVictoryEnabled,
        fogOfWarEnabled: fogOfWarChosen,
        contentCatalog,
        ...(authoredLevel && levelRef
          ? { level: authoredLevel.definition, levelLayout: authoredLevel.layout, levelRef }
          : {}),
        ...(levelLoadError ? { levelRef: levelRef ?? "", levelLoadError } : {}),
        unitBalance,
        buildingBalance,
        resourceBalance,
        animalBalance,
        caravanBalance,
        tradeSiteBalance,
        ageBalance,
        roadBalance,
        aiBalance,
        aiLayoutBalance,
        matchSeed,
        // §72: the menu's difficulty row outranks the preset, which outranks the
        // fair baseline — the chain `seededSetup` already walked, with the menu's
        // answer on top of it.
        aiProfile: setup.aiProfile,
        // A bad preset must not turn the fallback RTS route into an unwinnable
        // no-build state; mirror the standard core-match stockpile.
        startingResources: preset?.startingResources ?? { food: 500, wood: 500 },
        startingUnits: preset?.startingUnits ?? {},
        // Enemy handicaps are opt-in: without them the AI mirrors the player.
        ...(preset?.enemyStartingResources
          ? { enemyStartingResources: preset.enemyStartingResources }
          : {}),
        ...(preset?.enemyStartingUnits
          ? { enemyStartingUnits: preset.enemyStartingUnits }
          : {}),
        // Same opt-in shape: without it the match opens at Settlement Lv1.
        ...(preset?.startingTier ? { startingTier: preset.startingTier } : {}),
        ...(missionScript ? { missionScript } : {}),
        onMissionResolved: () => markMissionSeen(missionSeenStorage()),
        onExitToMenu: leaveMatch,
      });
      // `RtsApp` mounts a curtain of its own in its constructor, so this one has
      // been handed over rather than dropped — no frame between them shows the
      // half-built field the two exist to hide.
      bootCurtain?.dispose();
      bootCurtain = null;
      rts.start();
      await leftMatch;
      // Everything the match owned goes now — GPU resources included — before the
      // menu mounts. The canvas keeps its WebGL context; the next `RtsApp` builds a
      // new renderer on it, exactly as the first one did over the context the
      // support probe opened (`engine/render-three/renderer.ts`).
      rts.dispose();
      showMenu = true;
      // A new match, so a new seed and an address that no longer describes the old
      // one. `pushState` rather than `back()`: history is a record of where the
      // player has been, and they have been in that match.
      matchSeed = Date.now();
      history.pushState(null, "", menuSearch(params));
    }
  }

  // The editor is a dev-time authoring tool (it also needs the dev save server).
  // Gating on import.meta.env.DEV lets Vite dead-code-eliminate the whole editor
  // — including the dynamic import — from the production game build, so the
  // package ships no editor UI at all. In dev, ?editor still loads it on demand.
  if (editorEnabled && import.meta.env.DEV) {
    const [
      { SceneApp },
      { EditorUi },
      { saveLayoutViaDevEndpoint },
      { setGameEditorCatalog },
      { GAME_EDITOR_CATALOG },
    ] = await Promise.all([
      import("@/scene/SceneApp"),
      import("@/editor/EditorUi"),
      import("@/editor/layoutSaver"),
      import("@/editor/gameEditorRegistry"),
      import("@/game/editorCatalog"),
    ]);
    // Inversion of control: the game supplies its editor catalogs here so the
    // editor stays generic (never imports @/game). This composition root is the
    // only module allowed to see both layers, so the contract check lives here.
    setGameEditorCatalog(GAME_EDITOR_CATALOG);
    const app = new SceneApp(canvas, { enabled: true, scriptMessageTraceLimit });
    app.setLayoutSaver(saveLayoutViaDevEndpoint);
    // EditorUi owns the perf overlay in editor mode: it exposes a Show > Stats
    // toggle and defaults the overlay on when the URL carried ?debug.
    new EditorUi(app);
    app.start();
    return;
  }

  const app = new RuntimeSceneApp(canvas, { scriptMessageTraceLimit, debug: params.has("debug") });

  // Perf readout (qa-poki standard) behind ?debug — invisible in production.
  if (params.has("debug")) {
    attachDebugStats(app, requireElement("debug-stats"));
  }

  app.start();
}

/**
 * A boot that dies behind the curtain would leave the player watching a progress
 * bar for a load that is never coming — the RTS route raises its curtain before
 * the first `await` now (plan F2), so every failure after that point is a failure
 * with something painted over it. Taking the curtain down is not error handling:
 * the rejection is re-thrown so `installGlobalErrorHandlers` still reports it. It
 * only makes sure the failure is *visible* rather than disguised as a slow load.
 */
void main().catch((error: unknown) => {
  for (const curtain of document.querySelectorAll(".rts-loading-screen")) curtain.remove();
  throw error;
});

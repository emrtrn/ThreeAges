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
  victoryConditionFlagOverride,
  writeStoredVictoryCondition,
  type VictoryConditionChoice,
} from "@/game/rts/match/victoryConditionChoice";
import {
  fogOfWarFlagOverride,
  readStoredFogOfWar,
  writeStoredFogOfWar,
  type FogOfWarChoice,
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

async function main(): Promise<void> {
  const { preset, levelAssetsEnabled, prosperityDebugEnabled, regionalVictoryEnabled, fogOfWarEnabled } =
    await bootFoundation();

  const params = new URLSearchParams(location.search);
  const canvas = requireElement<HTMLCanvasElement>("game-canvas");
  const editorEnabled = params.has("editor");
  const scriptMessageTraceLimit = import.meta.env.DEV && params.has("debug") ? 20 : 0;

  // RTS game route (Vertical Slice Plan v0.2 Faz 1). Gated behind ?rts so the
  // character runtime + editor stay the default until the RTS is promoted. Its
  // own lightweight runtime — never mixes with the character SceneApp above.
  if (!editorEnabled && params.has("rts")) {
    const { RtsApp } = await import("@/game/rts/RtsApp");
    const [unitBalance, buildingBalance, resourceBalance, animalBalance, ageBalance, roadBalance, aiBalance, aiLayoutBalance] = await Promise.all([
      loadUnitBalance(),
      loadBuildingBalance(),
      loadResourceBalance(),
      loadAnimalBalance(),
      loadAgeBalance(),
      loadRoadBalance(),
      loadAiBalance(),
      loadAiLayoutBalance(),
    ]);
    const caravanBalance = await loadCaravanBalance();
    const requestedMatchSeed = Number(params.get("seed"));
    const matchSeed = Number.isSafeInteger(requestedMatchSeed) ? requestedMatchSeed : Date.now();
    const tradeSiteBalance = await loadTradeSiteBalance();
    // The Actor pack is how the RTS renders, so the catalog loads on every start.
    // A catalog that fails to load is fatal to the route on purpose: it is the
    // mapping from gameplay ids to art, and there is no second art path left to
    // quietly fall back to — a match booted without it would be an art-less match.
    const contentCatalog = await loadRtsContentCatalog(unitBalance, buildingBalance, animalBalance);
    // Story/tutorial chain (Hikâye / Öğretici Tur Modu, Faz 1). Opt-in through
    // `?mission=<id>` until Faz 2 gives the start card a mode row; until then an
    // ordinary match is what every URL without the parameter still gets.
    //
    // A script that fails to load must not take the match down with it: the mode
    // is guidance layered over a match that is perfectly playable without it, so
    // a bad file costs the player their objectives and nothing else.
    // `?mission=<id>` still pins one explicitly — a dev door, and the way a
    // second chain would be tried before the card knows about it. Otherwise the
    // start card's mode row decides, defaulting to the tur for a player who has
    // never resolved the offer and to free play for one who has.
    const missionMode = resolveMissionMode(matchSetupStorage(), missionSeenStorage());
    const missionId = params.get("mission") ?? missionScriptIdForMode(missionMode);
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
    const storyModeRegionalVictoryEnabled = !missionScript && regionalVictoryEnabled;
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
    const rts = new RtsApp(canvas, {
      debug: params.has("debug"),
      prosperityDebugEnabled,
      regionalVictoryEnabled: storyModeRegionalVictoryEnabled,
      fogOfWarEnabled,
      // §78.1: store the choice and re-run this boot, which resolves the flag
      // through the same defaults → preset → URL → choice path as a cold start.
      // A reload rather than an in-place rebuild because §13 fixes flags at
      // resolve time; the cost is one reload of a start screen nobody has played.
      onVictoryConditionChange: (choice: VictoryConditionChoice) => {
        writeStoredVictoryCondition(matchSetupStorage(), choice);
        location.reload();
      },
      // §59: same store-and-reload shape, and the same §13 reason — the vision
      // system and its view layers resolve once, at construction.
      onFogOfWarChange: (choice: FogOfWarChoice) => {
        writeStoredFogOfWar(matchSetupStorage(), choice);
        location.reload();
      },
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
      // §72: the start card's difficulty row outranks the preset, which outranks
      // the fair baseline. Unlike the two rows above this is not a flag, so it
      // resolves here rather than through `flagOverrides` — but the precedence
      // and the "unchosen leaves the preset alone" rule are the same.
      aiProfile: resolveAiProfile(readStoredAiProfile(matchSetupStorage()), preset?.aiProfile),
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
      // Same store-and-reload shape as the victory condition: what the mode row
      // changes is which chain the *boot* loads, and §13 fixes that at resolve
      // time. One reload of a start screen nobody has played yet.
      onMissionModeChange: (choice) => {
        writeMissionMode(matchSetupStorage(), choice);
        // Declining is an answer too, so it counts as having met the offer.
        if (choice === "free") markMissionSeen(missionSeenStorage());
        location.reload();
      },
      // §72: same store-and-reload shape as the rows above — the profile is read
      // into the AI controller at construction, so it is a boot concern.
      onAiProfileChange: (choice) => {
        writeStoredAiProfile(matchSetupStorage(), choice);
        location.reload();
      },
      onMissionResolved: () => markMissionSeen(missionSeenStorage()),
    });
    rts.start();
    return;
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

void main();

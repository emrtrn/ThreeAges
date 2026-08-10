/**
 * RTS runtime composition root — Vertical Slice Plan v0.2 §20–§23 (Faz 1).
 *
 * A self-contained top-down RTS runtime for the "Üç Çağ" gameplay backbone,
 * deliberately separate from the character-oriented {@link RuntimeSceneApp}: it
 * owns a lightweight scene, a fixed rAF loop, and the small per-frame systems
 * introduced across Faz 1 (camera now; selection, units, combat, match state in
 * later steps). Reuses only the engine's WebGL renderer factory so the GL setup
 * matches the rest of Forge.
 *
 * Booted behind the `?rts` route (plan §13 feature-flag philosophy) so the
 * existing runtime + editor keep working untouched until the RTS is promoted to
 * the default game route.
 */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  type InstancedMesh,
  Matrix4,
  Mesh,
  type Object3D,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";

import { createSceneRenderer, readRenderMemory, readRenderStats } from "@engine/render-three/renderer";
import { advanceForgeMaterialAnimations } from "@engine/render-three/materials";
import { GltfModelLoader } from "@engine/render-three/gltfModelLoader";
import { VfxSubsystem } from "@engine/render-three/vfxSubsystem";
import { FrameMetricsMonitor } from "@engine/perf/frameMetrics";
import { AdaptiveQualityController } from "@engine/perf/adaptiveQuality";
import { classifyBottleneck } from "@engine/perf/bottleneckClassifier";
import { SubsystemProfiler } from "@engine/core/subsystemProfiler";
import { evaluatePerfBudget } from "@engine/perf/perfBudget";
import {
  applyQualityToPostProcess,
  effectiveDevicePixelRatio,
  resolveQualitySettings,
  type GraphicsPreferences,
  type QualitySettings,
} from "@engine/perf/qualityProfiles";
import {
  UserSettingsStore,
  defaultUserSettings,
  type UserSettings,
} from "@engine/persistence/userSettingsStore";
import { createLocalStorageAdapter } from "@engine/persistence/saveGameStore";
import { logger } from "@/game/core/logger";
import { projectFileUrl } from "@/project/ProjectSystem";
import type {
  AiBalance,
  AiLayoutBalance,
  AgeBalance,
  AiProfile,
  AnimalBalance,
  BuildingBalance,
  CaravanBalance,
  ResourceBalance,
  RoadBalance,
  SettlementAge,
  StartingResources,
  StartingTier,
  StartingUnits,
  TradeSiteBalance,
  UnitBalance,
} from "@/game/data/gameDataTypes";
import type { RtsContentCatalog } from "./content/rtsContentCatalog";
import {
  RtsActorVisualFactory,
  formatRtsActorPresentationDebug,
  rtsContentAssetsState,
  type RtsActorLoadReport,
} from "./content/rtsActorVisualFactory";
import { AiController } from "./ai/aiController";
import { SettlementAiSiteProvider } from "./ai/aiSiteProvider";
import { proceduralDepotRoadRank, proceduralRoadSiteFailure } from "./ai/aiRoadSiteFilter";
import { planSettlementLayout } from "./ai/settlementLayoutPlanner";
import { formatRtsAiDebug } from "./ai/aiDebugView";
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { RtsPointer } from "./input/rtsPointer";
import { createRtsGround, RTS_WORLD_HALF_EXTENT } from "./world/rtsGround";
import { AuthoredRtsGroundSurface, FLAT_RTS_GROUND, RtsDeckGroundSurface, type RtsGroundSurface } from "./world/rtsTerrainSurface";
import { RTS_PLACEMENT_GRID_SIZE } from "./structures/placementGrid";
import { createRtsMapBlockout, RTS_BLOCKOUT_MAP } from "./world/rtsMapBlockout";
import { resolveRtsSpatialLayout, type RtsSpatialLayout } from "./world/rtsSpatialLayout";
import type { RtsLevelDefinition } from "./world/rtsLevelAdapter";
import { RtsMapArt, collectWorldProps } from "./world/rtsMapArt";
import {
  levelAuthoredSun,
  levelHasAuthoredSun,
  levelHasAuthoredWorld,
  loadRtsAuthoredWorld,
} from "./world/rtsAuthoredWorld";
import { AuthoredEnvironment } from "@engine/render-three/authoredEnvironment";
import {
  applyProbeEnvMapToObject,
  bakeSphereReflectionCapture,
  disposeSphereReflectionCaptureBake,
  resolveSphereReflectionCapture,
  selectNearestReflectionCapture,
  type ReflectionCaptureProbe,
  type SphereReflectionCaptureBake,
} from "@engine/render-three/reflectionCapture";
import { readRotation } from "@engine/scene/transform";
import type { LandscapeSamplerBudget } from "@engine/render-three/landscape";
import {
  applyPostProcessToneMapping,
  createPostProcessAntialiasPass,
  createPostProcessEffectPasses,
  hasPostProcessEffectPasses,
  PostProcessPipeline,
  resolvePostProcess,
} from "@engine/render-three/postProcess";
import type { AuthoredWorldHandle } from "@/scene/authoredWorld";
import { applySceneBackgroundAndAmbient, resolveSceneWorldSettings } from "@/scene/SceneRuntimeCore";
import type { RoomLayout } from "@engine/scene/layout";
import { UnitSystem } from "./units/unitSystem";
import { Unit } from "./units/unit";
import { updateUnitMovement } from "./units/unitMovement";
import { settleStoppedUnitOverlaps } from "./units/unitSeparation";
import { updateUnitCombat, type CombatHit, type CombatShot } from "./units/unitCombat";
import { updateUnitDeaths } from "./units/unitDeath";
import { retaliateAgainstAttack, updateUnitEngagement } from "./combat/engagementSystem";
import { ProjectileSystem } from "./combat/projectileSystem";
import { FirebrandSystem } from "./combat/firebrandSystem";
import { CannonballSystem } from "./combat/cannonballSystem";
import { PendingImpactQueue } from "./combat/pendingImpacts";
import { StructureDefenseSystem } from "./combat/structureDefenseSystem";
import { SupportAuraSystem } from "./structures/supportAuraSystem";
import { combatImpactPoint, structureImpactPoint, type CombatTarget } from "./combat/combatTarget";
import { RtsNavigation } from "./navigation/rtsNavigation";
import { MarqueeOverlay } from "./selection/marqueeOverlay";
import { SelectionSystem } from "./selection/selectionSystem";
import { updateSelectionRingPulse } from "./selection/selectionRing";
import { CommandMarkerSystem } from "./commands/commandMarker";
import { CommandSystem } from "./commands/commandSystem";
import { CommandCenterSystem } from "./structures/commandCenterSystem";
import { COMMAND_CENTER_MAX_HEALTH, CommandCenter } from "./structures/commandCenter";
import {
  COMMAND_CENTER_VISUAL_FOOTPRINT,
  RtsBuildingVisuals,
} from "./structures/rtsBuildingVisuals";
import { updateStructureDestruction } from "./structures/structureDestruction";
import { RtsMatchState } from "./match/rtsMatchState";
import { RtsMatchFlow } from "./match/rtsMatchFlow";
import { RtsMatchClock, formatMatchDuration } from "./match/rtsMatchClock";
import { RtsMatchOverlay } from "./match/rtsMatchOverlay";
import type { RtsGraphicsQuality } from "./match/rtsMatchOverlay";
import { RtsDebugOverlay } from "./debug/rtsDebugOverlay";
import type { RtsPerfCost } from "./debug/formatRtsPerfDebug";
import { RtsSimulationWitness } from "./debug/rtsSimulationWitness";
import {
  buildRtsFrameCapture,
  rtsFrameCaptureTableView,
  type RtsFrameRegionSample,
} from "./debug/rtsFrameCapture";
import { RtsDebugTableModal } from "./debug/rtsDebugTableModal";
import { rtsGpuSweepTableView, rtsGpuSweepUnavailableView } from "./debug/rtsGpuSweep";
import { RtsGpuSweepRunner } from "./debug/rtsGpuSweepRunner";
import { GpuFrameTimer } from "@engine/perf/gpuTimer";
import {
  PlacedStructureSystem,
  structureDamageStage,
  type PlacedStructure,
  type StructureDamageStage,
} from "./structures/placedStructureSystem";
import {
  RTS_DAMAGE_SLOTS,
  rtsBuildingDamagePresentation,
  type RtsDamagePresentation,
  type RtsDamageSlot,
  type RtsDamageSlotName,
} from "./content/rtsContentCatalog";

/** Timer key for one building's one repeating slot. */
function slotTimerKey(structureId: number, slot: RtsDamageSlotName): string {
  return `${structureId}:${slot}`;
}
import { BuildingPlacementSystem } from "./structures/buildingPlacementSystem";
import { StructureConstructionService } from "./structures/structureConstructionService";
import { KingdomRegistry } from "./kingdom/kingdomRegistry";
import { RoadConstructionService } from "./roads/roadConstructionService";
import { planAutoRoadConnection } from "./roads/autoRoadConnector";
import { centerAccessRoadPlan } from "./roads/centerAccessRoad";
import { buildingUnlockRequirement, RtsBuildPalette } from "./ui/rtsBuildPalette";
import { RtsSelectionPanel } from "./ui/rtsSelectionPanel";
import { DEFAULT_RTS_FORMATION, type RtsFormationId } from "./units/formations/rtsFormationTypes";
import { RtsWorldProgressOverlay, type RtsWorldProgressEntry } from "./ui/rtsWorldProgressOverlay";
import {
  AGE_UP_ACTION,
  CANCEL_CONSTRUCTION_ACTION,
  CANCEL_TRAIN_ACTION,
  CANCEL_WORKER_ACTION,
  DEMOLISH_ACTION,
  RALLY_ACTION,
  REPAIR_ACTION,
  RESCUE_ACTION,
  TRADE_BUY_ACTION_PREFIX,
  TRADE_SELL_ACTION_PREFIX,
  TRAIN_ACTION_PREFIX,
  TRAIN_WORKER_ACTION,
  CENTER_LEVEL_UP_ACTION,
  type RtsSelectionView,
  type StructureDetailView,
  type CenterProgressionView,
  type StructureRepairView,
  type WorkerJob,
} from "./ui/rtsSelectionView";
import { RtsGameSpeedControls } from "./ui/rtsGameSpeedControls";
import type { ResourceChange } from "./economy/resourceWallet";
import { EconomyProductionSystem, producerHasSource } from "./economy/economyProductionSystem";
import { MarketTradeSystem, type MarketTradeResult } from "./economy/marketTradeSystem";
import { ResourceNodeSystem } from "./economy/resourceNodeSystem";
import { TradeSiteSystem } from "./economy/tradeSiteSystem";
import { TradeSiteView } from "./world/tradeSiteView";
import {
  MarketSupplySystem,
  marketSupplyLines,
  siteSupplyState,
  supplyLaneId,
  type MarketSupplyLine,
  type MarketSupplyState,
} from "./economy/marketSupplySystem";
import { ForestSystem } from "./economy/forestSystem";
import { PastureSystem } from "./wildlife/pastureSystem";
import { PredatorSystem } from "./wildlife/predatorSystem";
import { PredatorResponseSystem } from "./wildlife/predatorResponseSystem";
import { WildlifeRetaliationSystem } from "./wildlife/wildlifeRetaliation";
import { WildlifeSystem } from "./wildlife/wildlifeSystem";
import { WildlifeView } from "./wildlife/wildlifeView";
import { Caravan, CaravanSystem, type CaravanDispatch } from "./logistics/caravanSystem";
import { ProducerCaravanLanes, producerLaneId } from "./logistics/producerCaravanLanes";
import { CaravanView } from "./logistics/caravanView";
import { buildingUnlocked, KingdomProgressionSystem, type UpgradableStructure } from "./progression/kingdomProgressionSystem";
import { DepotLogisticsSystem } from "./economy/depotLogisticsSystem";
import { type ProducerLogisticsStatus, ProductionLogisticsSystem } from "./economy/productionLogisticsSystem";
import { LogisticsTransferSystem } from "./economy/logisticsTransferSystem";
import { LogisticsOccupationSystem } from "./economy/logisticsOccupationSystem";
import { ResourceCapacitySystem } from "./economy/resourceCapacitySystem";
import { roadLinkCellFor } from "./economy/depotLogisticsSystem";
import { WorkerConstructionSystem } from "./units/workerConstructionSystem";
import { StructureRepairSystem } from "./structures/structureRepairSystem";
import type { HealthComponent } from "./units/health";
import type { UnitOwner } from "./units/unit";
import { BarracksProductionSystem, unitQueueCapacityForBuildingLevel } from "./structures/barracksProductionSystem";
import { WorkerProductionSystem, workerQueueCapacityForCenterLevel, type WorkerCancelResult } from "./structures/workerProductionSystem";
import { RoadGraph } from "./roads/roadGraph";
import { RoadDebugView } from "./roads/roadDebugView";
import { RoadPlacementSystem } from "./roads/roadPlacementSystem";
import { RoadTerrainPainter } from "./roads/roadTerrainPainter";
import { simulationSteps, type RtsSimulationSpeed } from "./simulation/simulationSpeed";
import { RtsHudBar } from "./ui/rtsHudBar";
import { RtsLoadingScreen } from "./ui/rtsLoadingScreen";
import {
  RTS_LOAD_TRACK_WEIGHTS,
  RtsLoadTracker,
  type RtsLoadTrackDef,
  type RtsLoadTrackId,
} from "./loading/rtsLoadProgress";
import { RtsArmyRosterStrip } from "./ui/rtsArmyRosterStrip";
import { describeArmyRoster } from "./ui/rtsArmyRosterView";
import { RtsNotificationCenter } from "./ui/rtsNotifications";
import { RtsNotificationFeed } from "./ui/rtsNotificationFeed";
import { supplyNotice } from "./ui/rtsSupplyNotices";
import { RtsAttackWatch } from "./ui/rtsAttackWatch";
import { formatCostShortfall, formatResourceCost, resourceLabel, RESOURCE_ORDER } from "./ui/resourceLabels";
import { TerritoryControlSystem } from "./territory/territoryControlSystem";
import { StrategicPointSystem } from "./objectives/strategicPointSystem";
import { StrategicPointView } from "./objectives/strategicPointView";
import { RegionalVictorySystem } from "./objectives/regionalVictorySystem";
import { VisionSystem, type VisionSource } from "./vision/visionSystem";
import {
  EnemyMemorySystem,
  commandCenterMemoryId,
  type ObservableStructure,
} from "./vision/enemyMemorySystem";
import { FogMask } from "./vision/fogMask";
import { FogView } from "./vision/fogView";
import { GhostStructureView } from "./vision/ghostStructureView";
import { FogVisibilityBinder } from "./vision/fogVisibilityBinder";
import { VisionSystemAiFilter } from "./ai/aiVisionFilter";
import { formatVisionDebug } from "./vision/formatVisionDebug";
import { RtsObjectiveTracker } from "./ui/rtsObjectiveTracker";
import { RtsMissionPanel } from "./ui/rtsMissionPanel";
import { MissionDirector, type MissionDirectorState } from "./tutorial/missionDirector";
import { missionGuideHighlight } from "./tutorial/missionGuideHighlight";
import { MissionHintView } from "./tutorial/missionHintView";
import { missionBuildVerdict, type MissionBuildRefusal } from "./tutorial/missionBuildPolicy";
import type { MissionWorldSnapshot } from "./tutorial/missionPredicates";
import type { MissionScript } from "./tutorial/missionScript";
import type { AiObjectiveWatch } from "./ai/armyManager";

const MAX_PIXEL_RATIO = 2;
const ADAPTIVE_TICK_INTERVAL_SECONDS = 0.5;
const PERFORMANCE_SNAPSHOT_INTERVAL_SECONDS = 0.5;
/**
 * The measured frame regions, and which group each one sits inside.
 *
 * One table rather than the marks themselves being the definition: the capture
 * has to know that `ai` lives inside `simülasyon` to subtract it and report what
 * the step spent *outside* its named systems. A region measured in the frame
 * loop but missing here simply falls into that leftover — the arithmetic stays
 * correct, it just stops being itemised.
 *
 * `kare` is not listed: it is the whole frame, the denominator every share is
 * taken against.
 */
const PERF_REGION_PARENTS: Readonly<Record<string, string | undefined>> = {
  // Top level — these four partition the frame, and what they leave over is the
  // `ölçülmeyen` row.
  "simülasyon": undefined,
  "sunum": undefined,
  "çizim": undefined,
  "tanı": undefined,
  // Inside the simulation step (each runs once per sub-step).
  "ilerleme": "simülasyon",
  "birim hareketi": "simülasyon",
  "hayvanlar": "simülasyon",
  "inşaat": "simülasyon",
  "üretim": "simülasyon",
  "lojistik": "simülasyon",
  "eğitim kuyruğu": "simülasyon",
  "ai": "simülasyon",
  "hud eşitleme": "simülasyon",
  "savaş": "simülasyon",
  "görüş": "simülasyon",
  "zafer koşulu": "simülasyon",
  // Inside the rendered-frame presentation pass.
  "zemin oturtma": "sunum",
  "yapı görselleri": "sunum",
  "mermiler": "sunum",
  "birim sunumu": "sunum",
  "hayvan/kervan sunumu": "sunum",
  "sis görünümü": "sunum",
  "panel/görev arayüzü": "sunum",
  "çevre/bitki": "sunum",
  "kalite denetimi": "sunum",
};
/** Work that only exists because the debug route is open. */
const PERF_DEBUG_ONLY_REGIONS: ReadonlySet<string> = new Set(["tanı"]);
/** The whole-frame region; the denominator, never a row. */
const PERF_TOTAL_REGION = "kare";
/**
 * How often mission goals are re-checked, in real seconds. Objectives are polled
 * (see `tutorial/missionDirector.ts`) and the poll rebuilds the road/depot graph
 * projection, so it runs a few times a second: a quarter second is imperceptible
 * on "go build a depot" and a fraction of the cost of doing it every frame.
 */
const MISSION_POLL_SECONDS = 0.25;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
/**
 * How long the boot curtain will wait before opening on an unfinished load
 * (plan T3). Generous, because on a cold cache over a slow connection a full
 * Actor pack legitimately takes a while and cutting an honest load short would
 * show the player exactly the placeholders the curtain exists to hide. It is a
 * deadlock breaker, not a deadline.
 */
const RTS_BOOT_CURTAIN_TIMEOUT_MS = 20_000;
/** See {@link RtsApp.armFirstLoadedFrame} for why this is two and not one. */
const FRAMES_BEFORE_CURTAIN_LIFT = 2;
const SCENE_BACKGROUND = "#20262b";
/**
 * Height a defensive structure's weapon sits above its ground pivot — the
 * Karakol's fighting platform. Shared by both weapons on purpose: the bow it
 * carries in the Settlement age and the gun it is handed on reaching Town fire
 * from the same parapet, and two numbers here would read as two towers.
 */
const TOWER_MUZZLE_HEIGHT = 3.2;
const PLACEHOLDER_GUARD_ID = "guard_placeholder";
const PLACEHOLDER_WORKER_ID = "worker_placeholder";
const PLACEHOLDER_ARCHER_ID = "archer_placeholder";
const PLACEHOLDER_SIEGE_ID = "siege_placeholder";
/** Both camps open with equal standing defence. */
const STARTING_GUARD_COUNT = 3;
/** Archers, like artillery, are scenario-only at match start unless a preset asks for them. */
const STARTING_ARCHER_COUNT = 0;
/**
 * No artillery in a normal opening: siege unlocks at Town tier and must be paid
 * for at a Barracks. Only a preset that explicitly asks for it starts with any.
 */
const STARTING_SIEGE_COUNT = 0;
/**
 * Both kingdoms start with the same workers: the AI cannot run the economy
 * (AI design §34/§35) without them, and §39 requires it to earn everything else
 * through the same buildings and costs the player pays. Both camps also begin
 * with the same small Guard force, so neither gets a free opening advantage.
 */
const STARTING_WORKER_COUNT = 5;
const SETTLEMENT_POPULATION_CAPACITY = 20;
/**
 * Where the camera opens a match.
 *
 * Not the player's centre itself, and not the world origin either — both are
 * wrong for opposite reasons. The origin (the old default, which was simply
 * never set) leaves the player's town off-frame entirely; that only looked odd
 * while the whole map was lit, but under §59's fog the match opened on a black
 * screen. Framing the centre exactly instead puts the camera 32 units from the
 * world edge, and at the default 44-unit distance the ground plane runs out
 * inside the frame — the player opens on two bands of void.
 *
 * So the opening focus sits on the line from the base toward the middle of the
 * map, far enough in that the edge stays out of shot while the town still reads
 * as the subject. It is only the *opening* focus: the camera's own bounds are
 * unchanged, and panning back to the corner is still allowed.
 */
const OPENING_FOCUS_PULL_TOWARD_CENTER = 0.15;
/** Faz 5.0: both kingdoms run the same economy; only this one has a UI. */
const KINGDOM_OWNERS: readonly UnitOwner[] = ["player", "enemy"];
const PLAYER_OWNER: UnitOwner = "player";
/**
 * Command families for {@link RtsApp.announce}. One line per family in the feed:
 * a family is "orders the player will fire in bursts and only wants the latest
 * answer to", which is why it is deliberately coarse — five production refusals
 * in two seconds are one problem, not five notices.
 */
type RtsCommandSubject = "production" | "trade" | "structure" | "orders" | "workers" | "progression";
/**
 * Which *repeating* damage slot each health stage drives.
 *
 * Only smoke belongs on a timer: a burning building keeps burning whether or not
 * anything is hitting it. Debris used to sit here too, which meant a wounded
 * building shed masonry forever while standing untouched in the middle of the
 * map — it now fires from `impactDebris`, on the blow. Every timing, effect and
 * spawn point behind these names is authored in `rts-content.json`; nothing
 * about the damage presentation is written here.
 */
const STAGE_SLOTS: Readonly<Record<"light" | "heavy", readonly RtsDamageSlotName[]>> = {
  light: ["lightSmoke"],
  heavy: ["heavySmoke"],
};
/** Faz 5: the kingdom the AI opponent plays (plan §37). */
const AI_OWNER: UnitOwner = "enemy";
/**
 * §53: how long before the saldırmazlık (non-aggression) window closes the
 * player gets the actionable heads-up notice. Simulation seconds, so it scales
 * with game speed like the window it counts down to.
 */
const PEACE_HEADS_UP_SECONDS = 30;

export interface RtsAppOptions {
  /** `?debug`: shows the compact Faz 1 RTS state/debug panel. */
  readonly debug?: boolean;
  /** `?flags=prosperity`: debug information only; never a gameplay requirement. */
  readonly prosperityDebugEnabled?: boolean;
  /**
   * `?flags=regionalVictory` (§58, Faz 11): the second win condition.
   *
   * Off by default and genuinely absent when off — the objective systems are not
   * constructed, so there is no per-tick cost, no ring on the ground and no HUD
   * panel (plan §13, and §60's rule that a disabled feature leaves no reserved
   * empty space on screen).
   */
  readonly regionalVictoryEnabled?: boolean;
  /**
   * §59 (Faz 11): unknown / explored / visible layers, for both kingdoms.
   * Symmetric on purpose — see `ai/aiVisionFilter.ts`. On by default since the
   * system graduated; the main menu and a preset are the two doors that close it.
   */
  readonly fogOfWarEnabled?: boolean;
  /**
   * The gameplay-id -> Actor mapping the whole presentation hangs from. `main.ts`
   * always supplies it; it stays optional only for the harnesses that drive an
   * `RtsApp` without art, which then render the code-side boxes throughout.
   */
  readonly contentCatalog?: RtsContentCatalog;
  /** Faz D opt-in Level gameplay markers. Omitted keeps the blockout fallback. */
  readonly level?: RtsLevelDefinition;
  /** The path {@link level} was loaded from, published as a debugging witness. */
  readonly levelRef?: string;
  /**
   * Why {@link levelRef} could not be played, when it named a Level the RTS
   * refused. The match falls back to the blockout map and says so rather than
   * leaving the route blank.
   */
  readonly levelLoadError?: string;
  /**
   * Faz E opt-in raw Level layout, carrying the authored static world (instances,
   * lights, world settings) the markers omit. Present only under the `levelAssets`
   * flag; when it authors a world it is mounted and the matching legacy visuals
   * (the code sun and the {@link RtsMapArt} ridge) step aside.
   */
  readonly levelLayout?: RoomLayout;
  /** JSON-backed placeholder unit stats until full unit data is introduced. */
  readonly unitBalance: UnitBalance;
  /** JSON-backed footprint/cost/build-time definitions introduced in Faz 2. */
  readonly buildingBalance: BuildingBalance;
  /** Faz 6 finite stone/gold deposit profiles; consumed by the quarry/mine slice. */
  readonly resourceBalance: ResourceBalance;
  /** Huntable species stats; consumed by {@link WildlifeSystem}. */
  readonly animalBalance: AnimalBalance;
  /** V4 autonomous donkey stats; intentionally separate from huntable animals. */
  readonly caravanBalance: CaravanBalance;
  /** Supply-plan trade site kinds (port / timber camp / stone pit) — Faz S2. */
  readonly tradeSiteBalance: TradeSiteBalance;
  /** Faz 6 Settlement -> Town cost, prerequisites and upgrade duration. */
  readonly ageBalance: AgeBalance;
  /** Preset-owned initial stockpile for Phase 2 construction reservations. */
  readonly startingResources: StartingResources;
  /** Preset override for the opening forces; unset keys keep the defaults. */
  readonly startingUnits?: StartingUnits;
  /** Test-preset handicap: enemy-only stockpile/forces (see `GamePreset`). */
  readonly enemyStartingResources?: StartingResources;
  readonly enemyStartingUnits?: StartingUnits;
  /**
   * Test-preset opening centre tier for both kingdoms (see `GamePreset`). Unset
   * means the ordinary Settlement Lv1 start.
   */
  readonly startingTier?: StartingTier;
  /** Data-owned grid and wood cost for the Phase 4 road graph. */
  readonly roadBalance: RoadBalance;
  /** Data-owned AI cadences, thresholds and intent weights (Faz 5). */
  readonly aiBalance: AiBalance;
  /** Geometry-only base-layout tuning, intentionally separate from aiBalance. */
  readonly aiLayoutBalance: AiLayoutBalance;
  /** URL-published match seed; equal seeds reproduce the AI base plan. */
  readonly matchSeed: number;
  /** Difficulty profile the enemy kingdom runs with (AI design §70). */
  readonly aiProfile: AiProfile;
  /**
   * Story/tutorial chain to run alongside the match (`?mission=<id>`). Omitted
   * for an ordinary match, which is the default in every route.
   */
  readonly missionScript?: MissionScript;
  /**
   * The story offer has been answered: the chain was finished or abandoned. The
   * host records it so a returning player is not asked again.
   */
  readonly onMissionResolved?: () => void;
  /**
   * The player asked to leave this match and go back to the main menu (pause and
   * result cards). Reported rather than acted on: the host owns the app's
   * lifetime, so it is the only thing that may dispose it and re-open the menu —
   * this app cannot tear itself down from inside its own click handler.
   *
   * Omitted by a host that has no menu to return to, and the button then does not
   * exist at all rather than existing and doing nothing.
   */
  readonly onExitToMenu?: () => void;
}

function createRtsUserSettingsStore(): UserSettingsStore | null {
  try {
    return new UserSettingsStore({ storage: createLocalStorageAdapter(window.localStorage) });
  } catch {
    // Storage can be disabled (private mode / embedded browser); graphics still
    // work for the session, they simply cannot be remembered.
    return null;
  }
}

function rtsGraphicsQuality(level: GraphicsPreferences["selectedQualityLevel"]): RtsGraphicsQuality {
  return level === "low" ? "low" : level === "high" || level === "ultra" ? "high" : "medium";
}

/**
 * River reflections are deliberately a High-only visual: the shared `medium`
 * source is already a full extra scene render, while the old `high` source was
 * disproportionately costly for a top-down RTS camera.
 */
function riverReflectionQuality(quality: RtsGraphicsQuality): "medium" | null {
  return quality === "high" ? "medium" : null;
}

type ShadowCasterCategory = "actors" | "mapArt" | "other";

function shadowCasterCategory(object: Object3D): ShadowCasterCategory {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (current.userData.rtsActorPresentation) return "actors";
    if (current.name.startsWith("rts-map-model-")) return "mapArt";
  }
  return "other";
}

export class RtsApp {
  private readonly spatial: RtsSpatialLayout;
  private readonly openingFocus: { readonly x: number; readonly z: number };
  private readonly renderer: WebGLRenderer;
  /** Raw rendered-frame telemetry; drives RTS adaptive quality, never simulation. */
  private readonly frameMetrics = new FrameMetricsMonitor();
  private readonly userSettingsStore: UserSettingsStore | null;
  private userSettings: UserSettings = defaultUserSettings();
  private qualitySettings: QualitySettings = resolveQualitySettings("medium");
  private readonly adaptiveQuality: AdaptiveQualityController;
  private adaptiveTickAccumulator = 0;
  private performanceSnapshotAccumulator = 0;
  /**
   * Per-region frame costs for the `?debug` panel. Null off the debug route, and
   * every measurement site is a single null check there, so the instrument does
   * not become the thing it measures.
   */
  private readonly perfProfiler: SubsystemProfiler | null;
  /**
   * One frame's accumulated cost per region, flushed into the profiler at the
   * end of the frame. Regions inside the simulation step run once per sub-step
   * (up to 8 at §38's test speed), and what the panel must report is what the
   * *frame* paid — not one of its slices.
   */
  private readonly perfFrameCosts = new Map<string, number>();
  /**
   * Armed by the panel's capture button, disarmed by the frame that answers it.
   * The capture is taken from the **next** frame rather than the current one:
   * the click lands between frames, and pausing first would measure a frame with
   * no simulation in it at all.
   */
  private perfCaptureArmed = false;
  /** Simulation sub-steps the captured frame ran — 8X folds eight into one. */
  private perfCaptureSteps = 0;
  private readonly debugTableModal: RtsDebugTableModal | null;
  /**
   * Whether the capture is the one holding the match. Closing must only resume a
   * match *it* paused — otherwise opening a capture during the player's own
   * Escape pause would silently un-pause the game on close.
   */
  private frameCaptureOwnsPause = false;
  /**
   * GPU-side frame timing. Null when the debug route is off *or* when the
   * browser has no timer-query extension — the sweep says so rather than
   * reporting a table of zeros.
   */
  private readonly gpuTimer: GpuFrameTimer | null;
  /** The running GPU sweep, or null when no sweep is in progress. */
  private gpuSweep: RtsGpuSweepRunner | null = null;
  /**
   * Undoes the sweep step currently applied. Held only between the toggle and
   * the render on the same frame: the presentation pass rewrites some of the
   * visibility this touches every frame, so a step that persisted would be
   * overwritten by the next frame and leak on an interrupted sweep.
   */
  private gpuSweepRestore: (() => void) | null = null;
  /** The configurations of the running sweep; empty when none is running. */
  private gpuSweepPlan: readonly { readonly id: string; readonly apply: () => () => void }[] = [];
  /** Authored shadow frusta before the active profile scales their coverage. */
  private readonly shadowCameraExtents = new WeakMap<DirectionalLight, {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  }>();
  private readonly actorVisuals: RtsActorVisualFactory | null;
  private readonly buildingVisuals: RtsBuildingVisuals;
  private readonly mapArt: RtsMapArt;
  /**
   * Faz E authored static world mounted from the Level (null under the blockout
   * fallback). Its presence gates the legacy ridge art and the code sun.
   */
  private authoredWorld: AuthoredWorldHandle | null = null;
  /** Runtime terrain bridge; stays flat until a Landscape successfully mounts. */
  private groundSurface: RtsGroundSurface = FLAT_RTS_GROUND;
  /** Whether the Level intends to author a static world (known synchronously). */
  private readonly authoredWorldIntended: boolean;
  /** The code-side sun, kept so an authored directional light can retire it. */
  private codeSun: DirectionalLight | null = null;
  /**
   * The scene's ambient fill. Starts as a code-side fallback so the start screen is
   * lit before any Level exists, then the authored World Settings take it over
   * (`applySceneBackgroundAndAmbient`, which updates this light in place). Null once
   * a Level authors `ambientIntensity: 0`.
   */
  private codeAmbient: AmbientLight | null = null;
  /**
   * Shared authored-environment layer (Editor↔Runtime parity plan): applies the
   * Level's Sky Atmosphere, Sky Light, Height Fog and Cloud Layer so the RTS Play
   * route matches the editor. Constructed in the constructor once the renderer exists.
   */
  private readonly environment: AuthoredEnvironment;
  /**
   * Baked Sphere Reflection Captures from the Level's `reflectionCaptures`, in
   * probe order (hidden probes are skipped, not held as holes — nothing here
   * indexes back into the layout). Empty when the Level places none.
   */
  private reflectionCaptureBakes: SphereReflectionCaptureBake[] = [];
  /**
   * The authored static meshes whose material this swapped for a probe envMap
   * clone, kept so dispose can hand them their original material back and free
   * the clones (the clones are ours; the bases belong to the authored world).
   */
  private reflectionCaptureMeshes: InstancedMesh[] = [];
  /**
   * Authored Post Process composer (SMAA + bloom + tone mapping) built from the
   * Level's postProcess actor; null when the Level authors no effect passes, in
   * which case the render loop draws straight through the renderer as before.
   */
  private postProcessPipeline: PostProcessPipeline | null = null;
  /**
   * The flat placeholder ground (plane + grid), kept so an authored Landscape can
   * retire it once mounted — a sculpted terrain stands in for it, and leaving both
   * at y=0 would z-fight. Stays under a Landscape-less fallback.
   */
  private groundGroup: Group | null = null;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly units = new UnitSystem();
  private readonly wildlife: WildlifeSystem;
  private readonly pasture: PastureSystem;
  private readonly wildlifeRetaliation: WildlifeRetaliationSystem;
  private readonly predators: PredatorSystem;
  private readonly predatorResponse: PredatorResponseSystem;
  private readonly wildlifeRoot = new Group();
  private readonly wildlifeView = new WildlifeView(this.wildlifeRoot);
  private readonly caravanRoot = new Group();
  private readonly caravanView = new CaravanView(this.caravanRoot);
  private readonly centers = new CommandCenterSystem();
  private readonly structures = new PlacedStructureSystem();
  private readonly structureDamageModelLoader: GltfModelLoader;
  /**
   * RTS-owned use of the general Forge VFX runtime; effect assets stay editable.
   *
   * Grew past the buildings' damage slots when the artillery's blast became an
   * authored effect too, so anything in the match that bursts goes through this
   * one subsystem — one warm cache, one instance budget, one density setting.
   */
  private readonly structureDamageVfx = new VfxSubsystem({
    resolveEffectUrl: (effectId) => {
      const path = this.actorVisuals?.effectAssetPath(effectId);
      return path ? projectFileUrl(path) : null;
    },
    // Without this a sprite effect falls back to the engine's procedural round
    // blob, so an authored flipbook (the explosion's fireball, the dust cloud)
    // looked right in the effect editor's preview and wrong in the match.
    resolveTextureUrl: (textureId) => {
      const path = this.actorVisuals?.textureAssetPath(textureId);
      return path ? projectFileUrl(path) : null;
    },
    loadMeshModels: (modelIds) => this.loadStructureDamageModels(modelIds),
  });
  /**
   * Real-time accumulators for the repeating damage slots, keyed `<id>:<slot>`.
   * Reconciled against the live set every frame, so a building that heals, dies
   * or finishes construction drops its timers without a bespoke unsubscribe.
   */
  private readonly structureSlotElapsed = new Map<string, number>();
  /**
   * Smouldering husks of razed worksites, keyed by the id of a structure that no
   * longer exists. The position is captured at collapse because nothing can
   * resolve that id back to a building afterwards; entries leave only through
   * `onRuinCleared`, so the smoke and the husk disappear on the same frame.
   */
  private readonly structureRuinSmoke = new Map<number, {
    readonly position: [number, number, number];
    readonly effects: readonly string[];
    readonly intervalSeconds: number;
    readonly rotationKey: number;
    elapsed: number;
  }>();
  /**
   * Monotonic clock for the damage VFX, in real seconds. Impact debris throttles
   * against this rather than against an accumulator per building: an impact is
   * an event with no tick of its own, so "how long since the last one" needs a
   * shared reading of now, not a countdown somebody has to remember to advance.
   */
  private structureVfxClock = 0;
  /** {@link structureVfxClock} reading at each building's last impact burst. */
  private readonly structureImpactAt = new Map<number, number>();
  private readonly roads: RoadGraph;
  private readonly roadDebugView: RoadDebugView;
  private readonly territory = new TerritoryControlSystem(() => this.centers.all().map((center) => ({
    owner: center.owner,
    x: center.position.x,
    z: center.position.z,
    radius: center.controlRadius,
  })).concat(this.structures.all()
    .filter((structure) => structure.construction.complete && structure.stats.territory)
    .map((structure) => ({
      owner: structure.owner,
      x: structure.x,
      z: structure.z,
      radius: this.outpostConnectedToMainRoad(structure)
        ? structure.territoryConnectedControlRadius ?? 0
        : structure.territoryControlRadius ?? 0,
    }))));
  private readonly kingdoms: KingdomRegistry;
  private readonly progression: KingdomProgressionSystem;
  private readonly ai: AiController;
  private readonly structureConstruction: StructureConstructionService;
  private readonly roadConstruction: RoadConstructionService;
  private readonly workerConstruction: WorkerConstructionSystem;
  /** Owns what a repair costs and how fast it heals; the worker system staffs it. */
  private readonly structureRepair: StructureRepairSystem;
  private economyProduction: EconomyProductionSystem | null = null;
  private readonly resourceNodes: ResourceNodeSystem;
  /**
   * Supply plan Faz S2. Its buffers fill and stop; nothing collects them until
   * Faz S3 puts a caravan lane on the road between a site and a market.
   */
  private readonly tradeSites: TradeSiteSystem;
  /** Faz S6: the invisible dock boxes that make a trade site clickable. */
  private readonly tradeSiteView: TradeSiteView;
  /**
   * Supply plan Faz S3: which kingdom (if any) has run a road from a trade site
   * to one of its Markets, and the caravan lane that follows from it.
   */
  private readonly marketSupply: MarketSupplySystem;
  private readonly forests: ForestSystem;
  private readonly depotLogistics: DepotLogisticsSystem;
  private readonly productionLogistics: ProductionLogisticsSystem;
  private readonly caravans: CaravanSystem;
  private readonly logisticsOccupation: LogisticsOccupationSystem;
  private readonly resourceCapacity: ResourceCapacitySystem;
  private readonly logisticsTransfers: LogisticsTransferSystem;
  private readonly barracksProduction: BarracksProductionSystem;
  private readonly marketTrade: MarketTradeSystem;
  private readonly workerProduction: WorkerProductionSystem;
  /**
   * §58's objective slice, all four pieces null together whenever the
   * `regionalVictory` flag is off. One flag, one construction site: a half-built
   * combination — say the counter without the tracker — is exactly the state
   * §13 forbids, and making them a single conditional block is what makes that
   * combination unrepresentable.
   */
  private readonly strategicPoints: StrategicPointSystem | null;
  private readonly regionalVictory: RegionalVictorySystem | null;
  private readonly strategicPointView: StrategicPointView | null;
  /** §59 fog of war; all null while the `fogOfWar` flag is off. */
  private readonly vision: VisionSystem | null;
  private readonly enemyMemory: EnemyMemorySystem | null;
  private readonly fogView: FogView | null;
  private readonly ghostStructures: GhostStructureView | null;
  private readonly fogVisibility: FogVisibilityBinder | null;
  /** Per-fragment fog for the map's static art; see `vision/fogMask.ts`. */
  private readonly fogMask: FogMask | null;
  private readonly objectiveTracker: RtsObjectiveTracker | null;
  /**
   * Story/tutorial chain (Hikâye / Öğretici Tur Modu). Both null unless the boot
   * supplied a script, so an ordinary match carries no mission code at all.
   * The director only ever *reads* this app; nothing here may depend on it.
   */
  private readonly missions: MissionDirector | null;
  private readonly missionPanel: RtsMissionPanel | null;
  private readonly missionHint: MissionHintView | null;
  /**
   * Where the ring currently sits, so "Göster" has somewhere to go.
   *
   * Only ever a building the player already owns. An earlier pass also proposed
   * *placement* sites — solved against the placement validator and ranked by
   * road proximity — and play-testing retired it: a ranked-legal spot is not the
   * same thing as a sensible one, and the marker jumping to the next suggestion
   * the moment a building went down read as the game hurrying the player through
   * a step it had not finished explaining. Where to build is the decision the
   * tur is teaching, so the tur does not make it.
   */
  private missionMarker: { readonly x: number; readonly z: number } | null = null;
  /**
   * Real seconds since the last mission evaluation. Objectives are polled rather
   * than evented (see {@link MissionDirector}), and the poll rebuilds the
   * logistics snapshot, so it runs a few times a second instead of every frame —
   * far below anything a player can perceive in a "go build a depot" objective,
   * and far above what the graph rebuild would cost at 60Hz.
   */
  private missionPollTimer = 0;
  /** The chain's opening line is one-shot per match; reset by a restart. */
  private missionIntroPosted = false;
  /**
   * Enemy buildings razed this match, by building id — the one mission fact that
   * cannot be read from the world, because razing something removes it. Tallied
   * at the single destruction site so it cannot drift from what actually died,
   * and cleared by a restart so a fresh match never opens with a step pre-cleared.
   */
  private razedEnemyBuildings: Record<string, number> = {};
  /**
   * Market trades the player has completed this match — the second mission fact
   * with no reading in the world, since traded resources are indistinguishable
   * from mined ones the moment they land in the wallet. Counted at the single
   * call site that can succeed, so it cannot drift from what the wallet did.
   */
  private playerMarketTrades = 0;
  /**
   * Units of each resource bought at the Market this match. Counted beside
   * {@link playerMarketTrades} at the same single call site, in the lot size the
   * market actually moved rather than in clicks — the objective is written in
   * the resource the player sees arrive.
   */
  private playerMarketPurchases: Record<string, number> = {};
  /**
   * Units the player has trained this match, by role. Counted where a unit
   * actually walks out of a building rather than read off the live army, which
   * would also count the ones the preset handed out at match start — the bug
   * that let "train three Guards" clear itself before the Barracks existed.
   */
  private playerUnitsTrained: Record<string, number> = {};
  private readonly match = new RtsMatchState();
  /** §51: whether the simulation should be running; `match` owns who won. */
  private readonly flow = new RtsMatchFlow();
  /** §53: how long it has been running, in simulation time — Kapı B's instrument. */
  private readonly clock = new RtsMatchClock();
  private readonly matchOverlay: RtsMatchOverlay;
  private readonly debugOverlay: RtsDebugOverlay | null;
  /** The same debug route's hidden simulation readout (smoke-suite witness). */
  private readonly debugWitness: RtsSimulationWitness | null;
  private readonly navigation = new RtsNavigation();
  private readonly marquee = new MarqueeOverlay();
  private readonly commandMarkers = new CommandMarkerSystem();
  private readonly pointer: RtsPointer;
  private readonly selection: SelectionSystem;
  private readonly commands: CommandSystem;
  private readonly placement: BuildingPlacementSystem;
  private readonly roadPlacement: RoadPlacementSystem;
  /**
   * Paints committed roads onto the mounted terrain's dirt layer (Painted Roads
   * plan). Null until an authored Landscape mounts — a Landscape-less field keeps
   * the box-mesh render, so a failed/absent terrain never leaves roads invisible.
   */
  private roadPainter: RoadTerrainPainter | null = null;
  /**
   * A newly placed structure may also commit its short free access road. Keep
   * that road's visual/territory reaction pending until the structure pad joins
   * the same terrain repaint, rather than rebuilding the Landscape twice.
   */
  private roadCommitBatchDepth = 0;
  private roadCommitEffectsPending = false;
  private readonly buildPalette: RtsBuildPalette;
  /** Global, match-local preference; individual units do not own formation identity in V1. */
  private activeFormation: RtsFormationId = DEFAULT_RTS_FORMATION;
  private readonly selectionPanel = new RtsSelectionPanel(
    (id) => this.runSelectionAction(id),
    (formation) => {
      this.activeFormation = formation;
      this.commands.setFormation(formation);
    },
  );
  /** The building whose demolish is armed and awaiting its confirm click. */
  private demolishArmed: PlacedStructure | null = null;
  /** The unfinished site whose cancellation is armed and awaiting its confirm click. */
  private cancelConstructionArmed: PlacedStructure | null = null;
  private readonly worldProgressOverlay = new RtsWorldProgressOverlay();
  private buildingLabelCache: ReadonlyMap<string, string> | null = null;
  private readonly projectiles = new ProjectileSystem();
  private readonly firebrands = new FirebrandSystem();
  private readonly cannonballs = new CannonballSystem();
  /** Where the firing gun's barrel tip is; reused per shot, never held past `spawn`. */
  private readonly scratchMuzzle = new Vector3();
  /** Artillery damage waiting on the ball that is carrying it (see §21 wiring below). */
  private readonly pendingImpacts = new PendingImpactQueue();
  private readonly structureDefense = new StructureDefenseSystem();
  private readonly supportAuras = new SupportAuraSystem();
  private readonly hudBar = new RtsHudBar(
    () => this.selectIdleWorkers(),
    () => this.assignSelectedIdleWorkers(),
    () => this.togglePause(),
  );
  /**
   * The §51 population breakdown: one chip per unit type the player owns, each
   * a bulk-select for its type. Mounted into the HUD's status cluster below.
   */
  private readonly armyRoster = new RtsArmyRosterStrip(
    (typeId, additive) => this.selectUnitsOfType(typeId, additive),
  );
  /**
   * Which type the last roster click selected, and how far the camera has
   * walked through it. Repeat clicks on one chip tour that type's units;
   * clicking a different chip starts over, because the cursor only means
   * anything for the type it was counted against.
   */
  private rosterTourTypeId: string | null = null;
  private rosterTourIndex = 0;
  private readonly notifications = new RtsNotificationCenter();
  private readonly notificationFeed = new RtsNotificationFeed();
  /**
   * Last-seen logistics status per player producer, so {@link syncNotifications}
   * can tell a *transition* from a steady state: the "cut" warning is polled, but
   * "link restored" is news only on the frame the link actually returns. Keyed by
   * structure id; pruned as producers vanish so a reused id never reads a stale
   * status.
   */
  private readonly previousLogisticsStatus = new Map<number, ProducerLogisticsStatus>();
  /**
   * The trade-site twin of {@link previousLogisticsStatus} — supply plan Faz S5.
   * Same job, per site id rather than per structure id: the cut is polled, the
   * link and the hand-over are news only on the frame they happen.
   *
   * Not pruned, and it does not need to be: a trade site is authored, so the set
   * of ids is fixed for the whole match and no id is ever reused by something
   * else (KARAR 3-A — a site is never built and never destroyed).
   */
  private readonly previousSupplyState = new Map<string, MarketSupplyState>();
  /**
   * Trade sites that have supplied the player at least once this match.
   *
   * Monotonic on purpose. It is what separates "your road broke, repair it" from
   * "you never paved out there" — a distinction the road graph erases the moment
   * the road is gone, and one the player needs in both the panel and the warning.
   * Once a site has fed you, "repair it" stays the right advice for it, so
   * nothing here ever has to be taken back out.
   */
  private readonly everSuppliedSites = new Set<string>();
  /**
   * §53 saldırmazlık window: which of the three one-shot notices has fired.
   * 0 = nothing yet, 1 = "active" posted, 2 = heads-up posted, 3 = "ended"
   * posted (or the window is disabled). Advanced only forward, reset per match.
   */
  private peaceAnnounceStage = 0;
  /** §51 "saldırı altında": combat has no event bus, so health is sampled. */
  private readonly attackWatch = new RtsAttackWatch();
  private readonly gameSpeedControls: RtsGameSpeedControls;
  private readonly debugSpeedControls: RtsGameSpeedControls | null;
  private readonly unsubscribeWalletChanges: (() => void) | null;
  private readonly log = logger("System");
  /**
   * Boot curtain (plan F1). Covers the window in which the field is standing on
   * the flat placeholder ground with capsule units on it — both of which stay in
   * the code as failure fallbacks, so hiding them is the only correct fix.
   */
  private readonly loadingScreen: RtsLoadingScreen;
  private readonly loadTracker: RtsLoadTracker;
  /**
   * Asset tracks still outstanding. Separate from the tracker's own bookkeeping
   * because "every asset is in" is a different moment from "the boot is over":
   * the first drawn frame sits between them, and that gap is what T2 is about.
   */
  private readonly pendingAssetTracks = new Set<RtsLoadTrackId>();
  private loadTimeoutHandle = 0;
  /** Frames still to be drawn before the curtain may lift; see {@link armFirstLoadedFrame}. */
  private pendingFirstFrames = 0;
  /**
   * Whether the boot curtain has opened. Also the match's own start gun (plan
   * F2): with the start card gone there is nothing left for the player to press,
   * so "the field is visible" is what "the match may begin" now means.
   */
  private curtainLifted = false;
  private frameHandle = 0;
  private lastTime = 0;
  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") return;
    this.frameMetrics.reset();
    this.adaptiveTickAccumulator = 0;
    this.lastTime = performance.now();
  };
  private running = false;
  private disposed = false;
  private simulationSpeed: RtsSimulationSpeed = 1;
  private roadOverlayVisible = false;
  /** Armed by the palette's rally button; the next left-click on the map sets it. */
  private rallyPointPending = false;
  private lastW = 0;
  private lastH = 0;

  /** One simulation authority, mirrored into the player and debug pickers. */
  private setSimulationSpeed(speed: RtsSimulationSpeed): void {
    this.simulationSpeed = speed;
    this.gameSpeedControls.setSpeed(speed);
    this.debugSpeedControls?.setSpeed(speed);
  }

  /** Player-selected RTS base profile; automatic reductions remain transient. */
  private setGraphicsQuality(quality: RtsGraphicsQuality): void {
    const { customSettings: _discardCustomSettings, ...existing } = this.userSettings.graphics;
    const graphics: GraphicsPreferences = {
      ...existing,
      selectedQualityLevel: quality,
      manuallySelected: true,
      // RTS exposes the automatic toggle alongside every manual profile.
      allowAdaptiveFineTuning: true,
    };
    this.persistGraphics(graphics);
    this.adaptiveQuality.setBase(resolveQualitySettings(quality));
    this.applyQualitySettings(this.adaptiveQuality.currentSettings());
  }

  /** Records the player's adaptive-opt-in without changing their base profile. */
  private setGraphicsAdaptive(enabled: boolean): void {
    this.persistGraphics({ ...this.userSettings.graphics, adaptiveOptimizationEnabled: enabled });
    this.syncQualityDebug();
  }

  private persistGraphics(graphics: GraphicsPreferences): void {
    this.userSettings = { ...this.userSettings, graphics };
    this.userSettingsStore?.setGraphics(graphics);
  }

  /** Applies the RTS-supported subset of a shared Forge quality profile. */
  private applyQualitySettings(settings: QualitySettings): void {
    this.qualitySettings = settings;
    this.structureDamageVfx.setGlobalDensity(settings.particleDensity);
    // Effect density controls particles within each emitter; this companion cap
    // protects the match when many structures take damage on the same frame.
    this.structureDamageVfx.setMaxActiveInstances(Math.round(48 * settings.particleDensity));
    this.renderer.shadowMap.enabled = settings.shadowsEnabled;
    this.authoredWorld?.setRiverWaterReflectionQuality(
      riverReflectionQuality(rtsGraphicsQuality(this.userSettings.graphics.selectedQualityLevel)),
    );
    this.scene.traverse((object) => {
      if (!(object instanceof DirectionalLight) || !object.castShadow) return;
      const camera = object.shadow.camera;
      let base = this.shadowCameraExtents.get(object);
      if (!base) {
        base = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
        this.shadowCameraExtents.set(object, base);
      }
      camera.left = base.left * settings.shadowDistanceScale;
      camera.right = base.right * settings.shadowDistanceScale;
      camera.top = base.top * settings.shadowDistanceScale;
      camera.bottom = base.bottom * settings.shadowDistanceScale;
      camera.updateProjectionMatrix();
      if (object.shadow.mapSize.width === settings.shadowMapSize) return;
      object.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
      object.shadow.map?.dispose();
      object.shadow.map = null;
    });
    this.resize();
    if (this.options.levelLayout) this.applyAuthoredPostProcess(this.options.levelLayout);
    this.syncQualityDebug();
  }

  /** Browser-testable witness of player intent and transient adaptive state. */
  private syncQualityDebug(): void {
    this.canvas.dataset.rtsQuality = this.userSettings.graphics.selectedQualityLevel;
    this.canvas.dataset.rtsAdaptive = String(this.userSettings.graphics.adaptiveOptimizationEnabled);
    this.canvas.dataset.rtsQualityReductionDepth = String(this.adaptiveQuality.reductionDepth);
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RtsAppOptions,
  ) {
    this.spatial = resolveRtsSpatialLayout(this.options.level);
    this.groundSurface = new RtsDeckGroundSurface(FLAT_RTS_GROUND, this.spatial.walkableDecks);
    // Browser-visible witness of which spatial authority the match resolved:
    // the authored Level (Faz D opt-in) or the legacy rtsMapBlockout fallback.
    this.canvas.dataset.rtsLevel = this.options.levelLoadError
      ? "invalid"
      : this.options.level ? "authored" : "blockout";
    // *Which* map, not just "a map". The editor's Play hands over the level it is
    // editing, so being able to read back what actually opened is what turns
    // "my edits did not show up" from a guess into a one-glance answer.
    this.canvas.dataset.rtsLevelRef = this.options.levelRef ?? "";
    this.canvas.dataset.rtsLevelError = this.options.levelLoadError ?? "";
    this.canvas.dataset.rtsMatchSeed = String(this.options.matchSeed);
    // The cursor belongs to the RTS map surface only. HTML controls retain
    // their familiar browser pointer so their click affordance stays explicit.
    this.canvas.dataset.rtsCursor = "default";
    // Faz E: does the Level carry a static world to mount? Known synchronously so
    // buildScene / loadMapArt can gate the legacy ridge before the async load.
    this.authoredWorldIntended = this.options.levelLayout
      ? levelHasAuthoredWorld(this.options.levelLayout)
      : false;
    this.canvas.dataset.rtsAuthoredWorld = this.authoredWorldIntended ? "loading" : "disabled";
    // Road visual witness: box tiles until an authored terrain mounts and takes
    // over the paint (set to "painted" in setupRoadPainter).
    this.canvas.dataset.rtsRoads = "mesh";
    this.openingFocus = {
      x: this.spatial.playerStart.x * (1 - OPENING_FOCUS_PULL_TOWARD_CENTER),
      z: this.spatial.playerStart.z * (1 - OPENING_FOCUS_PULL_TOWARD_CENTER),
    };
    this.renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
    this.structureDamageModelLoader = new GltfModelLoader(this.renderer);
    this.userSettingsStore = createRtsUserSettingsStore();
    this.userSettings = this.userSettingsStore?.read() ?? defaultUserSettings();
    this.qualitySettings = resolveQualitySettings(
      this.userSettings.graphics.selectedQualityLevel,
      this.userSettings.graphics.customSettings,
    );
    this.adaptiveQuality = new AdaptiveQualityController(this.qualitySettings);
    this.environment = new AuthoredEnvironment({
      scene: this.scene,
      renderer: this.renderer,
      camera: this.cameraController.camera,
      resolveSunActor: () =>
        this.options.levelLayout ? levelAuthoredSun(this.options.levelLayout) : null,
    });
    this.actorVisuals = this.options.contentCatalog
      ? new RtsActorVisualFactory(this.renderer, this.options.contentCatalog)
      : null;
    this.canvas.dataset.rtsContentAssets = this.actorVisuals ? "loading" : "disabled";
    // Published from the start so "no placeholders" and "not reported yet" are
    // never the same reading for a test or a bug report.
    this.canvas.dataset.rtsContentPlaceholders = "0";
    // Boot curtain, raised before `buildScene()` below starts any of the loads it
    // is meant to cover. Which tracks exist is decided here, synchronously and
    // once: a track that appeared later would make the bar jump backwards as new
    // work was discovered, so a boot without an Actor pack or without an authored
    // world simply never declares that track and the rest renormalise over it.
    this.loadingScreen = new RtsLoadingScreen();
    const loadTracks: RtsLoadTrackDef[] = [{ id: "mapArt", weight: RTS_LOAD_TRACK_WEIGHTS.mapArt }];
    if (this.actorVisuals) loadTracks.push({ id: "actors", weight: RTS_LOAD_TRACK_WEIGHTS.actors });
    if (this.authoredWorldIntended) loadTracks.push({ id: "world", weight: RTS_LOAD_TRACK_WEIGHTS.world });
    for (const track of loadTracks) this.pendingAssetTracks.add(track.id);
    // Declared last so it is the final slice of the bar, which is exactly what it
    // is: the beat after the last promise, spent uploading and compiling.
    loadTracks.push({ id: "firstFrame", weight: RTS_LOAD_TRACK_WEIGHTS.firstFrame });
    this.loadTracker = new RtsLoadTracker(loadTracks, (snapshot) => {
      this.loadingScreen.setProgress(snapshot);
      if (snapshot.complete) this.finishBootCurtain();
    });
    // A one-item denominator for the step tracks. Without it the bar would stay
    // indeterminate for the whole boot waiting on a count that a step, by
    // definition, never produces — and the honest percentage the plan is built
    // around would never appear.
    this.loadTracker.report("firstFrame", 0, 1);
    // T3: no single hung fetch may trap the player behind the curtain over a game
    // that the fallbacks have kept perfectly playable. Whatever has not arrived by
    // now is not going to decide the boot.
    this.loadTimeoutHandle = window.setTimeout(() => {
      this.loadTimeoutHandle = 0;
      this.log.warn("RTS boot curtain timed out; opening the field with whatever loaded");
      this.loadTracker.settleAll();
    }, RTS_BOOT_CURTAIN_TIMEOUT_MS);
    this.buildingVisuals = new RtsBuildingVisuals(this.actorVisuals);
    this.mapArt = new RtsMapArt(this.renderer);
    // A road belongs to whoever holds the ground it runs over, so the graph reads
    // ownership straight off territory control rather than storing a payer.
    this.roads = new RoadGraph(this.options.roadBalance, this.territory);
    this.roadDebugView = new RoadDebugView(this.roads);
    this.roadOverlayVisible = Boolean(this.options.debug);
    this.roadDebugView.root.visible = this.roadOverlayVisible;
    this.depotLogistics = new DepotLogisticsSystem(this.structures, this.roads, this.centers);
    this.resourceCapacity = new ResourceCapacitySystem(this.structures, this.depotLogistics);
    this.logisticsOccupation = new LogisticsOccupationSystem(this.depotLogistics);
    this.productionLogistics = new ProductionLogisticsSystem(
      this.structures,
      this.roads,
      this.depotLogistics,
      this.territory,
      this.logisticsOccupation,
      this.centers,
    );
    this.resourceNodes = new ResourceNodeSystem(this.options.resourceBalance, this.spatial.resourceNodes);
    this.tradeSites = new TradeSiteSystem(this.options.tradeSiteBalance, this.spatial.tradeSites);
    // Faz S6: the click targets, built from the same two inputs the system is.
    // Added to the scene here rather than with the map art because these are not
    // art — they carry no pixels and load nothing, so there is no asynchronous
    // step to wait for and no frame in which a site is unselectable.
    this.tradeSiteView = new TradeSiteView(this.options.tradeSiteBalance, this.spatial.tradeSites);
    this.scene.add(this.tradeSiteView.object);
    this.forests = new ForestSystem(this.spatial.trees);
    this.wildlife = new WildlifeSystem(this.options.animalBalance, this.spatial.herds);
    this.wildlifeRetaliation = new WildlifeRetaliationSystem(this.units, this.wildlife);
    // V3 Faz 3. The territory grid is passed as the raw question rather than the
    // system, because that question — who holds this point — is the entirety of
    // what a wolf reads from it (KARAR 1).
    this.predators = new PredatorSystem(
      this.units,
      this.wildlife,
      (x, z) => this.territory.ownerAt(x, z),
    );
    // The active half of the answer to a mauling: the passive one (a struck
    // worker turning on the wolf, an idle soldier inside his nine-unit
    // acquisition circle) is why a garrison could watch a worker die from what
    // the player reads as arm's length.
    this.predatorResponse = new PredatorResponseSystem(this.units, this.navigation);
    this.kingdoms = new KingdomRegistry(
      KINGDOM_OWNERS,
      this.units,
      this.structures,
      (owner) =>
        owner === "enemy" && this.options.enemyStartingResources
          ? this.options.enemyStartingResources
          : this.options.startingResources,
      SETTLEMENT_POPULATION_CAPACITY,
    );
    this.progression = new KingdomProgressionSystem(
      KINGDOM_OWNERS,
      this.options.ageBalance,
      this.centers,
      this.structures,
      this.kingdoms,
      // Undefined keeps the system's own Settlement Lv1 opening.
      this.options.startingTier,
    );
    // §58. Built here — before the AI, which reads the objective watch — and
    // only when the flag is on, so `regionalVictory` off means these four are
    // null and nothing downstream ever asks them anything.
    if (this.options.regionalVictoryEnabled) {
      this.strategicPoints = new StrategicPointSystem(
        this.spatial.strategicPoints,
        (x, z) => this.territory.ownerAt(x, z),
        // Workers are excluded: §58 is contested by *force*, and letting a
        // wandering gatherer stall a counter would make the condition a
        // question of stray pathing rather than of holding ground.
        () => this.units.armyOf("player").concat(this.units.armyOf("enemy"))
          .filter((unit) => !unit.dying)
          .map((unit) => ({ owner: unit.owner, x: unit.position.x, z: unit.position.z })),
      );
      this.regionalVictory = new RegionalVictorySystem(KINGDOM_OWNERS, this.strategicPoints);
      this.strategicPointView = new StrategicPointView();
      this.objectiveTracker = new RtsObjectiveTracker();
    } else {
      this.strategicPoints = null;
      this.regionalVictory = null;
      this.strategicPointView = null;
      this.objectiveTracker = null;
    }
    // Same "absent means nothing exists" construction rule as §58 above: without
    // a script there is no director and no card, so an ordinary match never pays
    // for the mode and can never be changed by it.
    if (this.options.missionScript) {
      this.missions = new MissionDirector(this.options.missionScript);
      // "Göster" recentres rather than flying: the camera is the player's, and a
      // scripted sweep would take it away from them for as long as it lasted.
      this.missionPanel = new RtsMissionPanel(() => {
        if (this.missionMarker) this.cameraController.setFocus(this.missionMarker.x, this.missionMarker.z);
      });
      this.missionHint = new MissionHintView();
    } else {
      this.missions = null;
      this.missionPanel = null;
      this.missionHint = null;
    }
    // §59. Same construction rule as §58 above: the flag off means these five
    // are null and nothing downstream ever asks them anything, so a disabled
    // fog costs nothing at runtime (plan §13).
    if (this.options.fogOfWarEnabled) {
      this.vision = new VisionSystem(
        () => this.collectVisionSources(),
        { cellSize: RTS_PLACEMENT_GRID_SIZE, worldHalfExtent: RTS_WORLD_HALF_EXTENT },
      );
      this.enemyMemory = new EnemyMemorySystem(this.vision, () => this.collectObservableStructures());
      this.fogView = new FogView(this.vision, PLAYER_OWNER);
      // The mask reads the fog view's own texture, so scenery dissolves on the
      // same frontier the ground overlay draws — one blur, one fade, one source.
      this.fogMask = new FogMask(this.fogView.maskSpan);
      this.fogMask.setTexture(this.fogView.maskTexture);
      // §40 draws the last seen *building*, so the ghost needs the same art
      // lookup a live one goes through — fed only from remembered fields, which
      // is what keeps a ghost from silently tracking the truth.
      this.ghostStructures = new GhostStructureView(
        this.enemyMemory,
        PLAYER_OWNER,
        (remembered) => this.buildingVisuals.createRememberedVisual(
          remembered.buildingId,
          remembered.level,
          remembered.footprintWidth,
          remembered.footprintDepth,
          remembered.age,
        ),
      );
      this.fogVisibility = new FogVisibilityBinder(
        this.vision,
        this.units,
        this.structures,
        this.centers,
        PLAYER_OWNER,
      );
    } else {
      this.vision = null;
      this.enemyMemory = null;
      this.fogView = null;
      this.fogMask = null;
      this.ghostStructures = null;
      this.fogVisibility = null;
    }
    this.scene.background = new Color(SCENE_BACKGROUND);
    this.input = new RtsInput(canvas);
    this.selection = new SelectionSystem(
      canvas,
      this.cameraController.camera,
      this.units,
      this.marquee,
      this.structures,
      this.centers,
      this.tradeSiteView,
    );
    this.commands = new CommandSystem(
      canvas,
      this.cameraController.camera,
      this.selection,
      this.units,
      this.centers,
      this.navigation,
      this.commandMarkers,
      this.structures,
      (workers, structure) => this.assignSelectedWorkersToStructure(workers, structure),
      (workers) => this.releaseWorkerTasks(workers),
      (structure, target) => this.orderStructureAttack(structure, target),
    );
    this.structureRepair = new StructureRepairSystem(this.kingdoms);
    // Built before the two systems it cross-checks, and reads them through
    // closures rather than references: all three answer the same question about a
    // worker ("is somebody else already using him") and none of them may be the
    // only one that knows.
    this.pasture = new PastureSystem(
      this.units,
      this.structures,
      this.navigation,
      this.wildlife,
      (worker) => this.workerConstruction.stateFor(worker) !== "idle"
        || (this.economyProduction?.isAssigned(worker) ?? false),
    );
    this.workerConstruction = new WorkerConstructionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => (this.economyProduction?.isAssigned(worker) ?? false) || this.pasture.isShepherd(worker),
      (structure) => {
        if (structure.stats.territory) this.territory.refresh();
      },
      // Automatic recovery deliberately cannot take a shepherd: preemption exists
      // to stop a foundation deadlocking behind gathering, and stealing a worker
      // mid-drive would drop a calmed animal in the field. A player who asks by
      // name still gets him.
      (worker, source) => source === "manual"
        ? (this.economyProduction?.release(worker) ?? false) || this.pasture.release(worker)
        : this.economyProduction?.releaseAutomatic(worker) ?? false,
      // Only the player's sites pull in every idle worker: hand-picking three
      // more builders per foundation was busywork the player always did anyway.
      // The AI's build/economy managers stay on the tuned single-builder rule.
      (structure) => structure.owner === PLAYER_OWNER,
      (structure, deltaSeconds, workerCount) => this.structureRepair.advance(structure, deltaSeconds, workerCount),
    );
    this.economyProduction = new EconomyProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      // Both of the systems that pull their own workers, so a builder and a
      // shepherd are equally invisible to the producers' hiring pass.
      (worker) => this.workerConstruction.stateFor(worker) !== "idle" || this.pasture.isShepherd(worker),
      this.resourceNodes,
      this.forests,
      this.wildlife,
      (structure) => this.pasture.pennedYield(structure),
      // V3 Faz 7: only the AI's automatic assignments learn from a worker loss.
      // Player orders remain the player's decision, including the deliberate
      // choice to escort a worker into wolf territory.
      (owner, x, z) => owner === AI_OWNER && this.ai.workerLocationUnsafe(x, z),
    );
    this.logisticsTransfers = new LogisticsTransferSystem(
      this.economyProduction,
      this.productionLogistics,
      this.kingdoms,
      this.resourceCapacity,
    );
    const guard = this.options.unitBalance[PLACEHOLDER_GUARD_ID];
    const worker = this.options.unitBalance[PLACEHOLDER_WORKER_ID];
    if (!guard || !worker) throw new Error("Missing RTS unit balance definition");
    this.barracksProduction = new BarracksProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      this.options.unitBalance,
      this.kingdoms,
      // Centre-led progression: a level-up or age transition no longer pauses a
      // Barracks (plan §4 — only the centre's own worker queue pauses, and only
      // during the Town transition), so military production is never suspended here.
      () => false,
      (structure) => structure.queueCapacity ?? unitQueueCapacityForBuildingLevel(structure.level),
      // Plan §45: a Barracks whose ground has been taken stops training, the
      // same severance rule the economy's producers already live under.
      (structure) => this.territory.ownerAt(structure.x, structure.z) === structure.owner,
      PLACEHOLDER_GUARD_ID,
      (owner) => this.progression.tierFor(owner).age,
    );
    this.marketTrade = new MarketTradeSystem(
      this.options.buildingBalance,
      this.structures,
      this.kingdoms,
      // KR-M4: the same control predicate the Barracks is severed by, written
      // once here so a besieged Market and a besieged Barracks cannot disagree
      // about what "Kontrol Dışı" means.
      (structure) => this.territory.ownerAt(structure.x, structure.z) === structure.owner,
      this.resourceCapacity,
    );
    // Faz S3, and built here rather than beside the trade sites because it needs
    // the Market that was only just constructed: a supply site is nothing on its
    // own, it is one end of a road whose other end is a shelf.
    this.marketSupply = new MarketSupplySystem(
      this.options.tradeSiteBalance,
      this.tradeSites,
      this.roads,
      this.structures,
      this.marketTrade.stock,
      // The same control predicate as the trade itself: a supply lane must not
      // deliver into a Market its owner no longer holds the ground under.
      (structure) => this.territory.ownerAt(structure.x, structure.z) === structure.owner,
    );
    // One state machine, two lane providers (supply plan §3.4). The producer
    // line is listed first so its animals keep the roster order they had before
    // the trade sites existed.
    this.caravans = new CaravanSystem(this.options.caravanBalance, this.roads, [
      new ProducerCaravanLanes(
        this.options.caravanBalance,
        this.productionLogistics,
        this.roads,
        this.structures,
        this.centers,
        this.logisticsOccupation,
        (producerStructureId) => this.caravanDispatch(producerStructureId),
      ),
      this.marketSupply,
    ]);
    this.workerProduction = new WorkerProductionSystem(
      this.units,
      this.centers,
      this.navigation,
      worker,
      this.kingdoms,
      // Only the Town transition pauses the centre's worker queue (plan §4); a
      // plain level-up keeps it running.
      (owner) => this.progression.snapshot(owner).upgradeKind === "town",
      (owner) => this.centers.get(owner)?.workerTrainingSeconds ?? worker.trainingSeconds,
      (owner) => this.workerQueueCapacity(owner),
    );
    this.structureConstruction = new StructureConstructionService(
      this.options.buildingBalance,
      this.structures,
      this.kingdoms,
      this.navigation,
      () => this.occupancyBlockers(),
      this.territory,
      (structure) => {
        this.applyConstructionVisual(structure);
        this.assignWorkerToConstruction(structure);
        this.beginRoadCommitBatch();
        try {
          this.autoConnectRoad(structure);
          // The committed access road and this new building pad now share one
          // restore/repaint + geometry upload when Landscape presentation is on.
          this.syncStructurePads();
        } finally {
          this.endRoadCommitBatch(this.roadPainter !== null);
        }
        // Construction reserves every footprint for placement, but farms and
        // lumber camps are intentionally omitted from *unit* navigation.
        this.refreshNavigationBlockers();
      },
      (structure) => {
        this.workerConstruction.cancelStructure(structure);
        this.syncStructurePads();
        this.refreshNavigationBlockers();
      },
      (stats, x, z) => stats.economy?.requiresResourceNode
        && !this.resourceNodes.canExtractAt(
          stats.economy.resourceId,
          x,
          z,
          stats.economy.gatherRadius ?? 0,
          stats.footprint,
        )
        ? "missing-resource-node"
        : stats.economy?.requiresForest
          && !this.forests.hasLiveTreeNear(
            x,
            z,
            stats.economy.gatherRadius ?? 0,
            stats.footprint,
          )
          ? "missing-forest"
          // A hunting camp is placed *at the herd*, the same "beside the source"
          // rule a lumber camp follows. Live animals only: a herd that has been
          // hunted out must stop justifying a new camp, or the player builds one
          // over a field of carcasses.
          // Wild game only: cattle penned in a pasture are nobody's quarry, so a
          // camp raised beside a full pen would be legal and then immediately
          // report that its herd is gone.
          : stats.economy?.requiresGame
            && this.wildlife.huntableAnimalsNear(x, z, stats.economy.gatherRadius ?? 0).length === 0
            ? "missing-game"
            // A pasture is placed at the herd it will tame, the same rule one
            // building over — but a stricter reading of "a herd": only living,
            // still-wild animals of a species the table calls tameable. Deer in
            // reach must not make a pasture legal that could never fill, and
            // neither must animals already penned by someone.
            : stats.economy?.requiresLivestock
              && this.wildlife.tameableAnimalsNear(x, z, stats.economy.gatherRadius ?? 0).length === 0
              ? "missing-livestock"
              : null,
      // Roads, standing trees and live deposits all reserve build space without
      // blocking navigation: a camp is placed beside a grove and a mine beside a
      // deposit, never on top, so the buried source stays harvestable — and its
      // shrinking mesh stays visible as it is worked out.
      //
      // A trade site's dock reserves the same way for the mirror-image reason:
      // it is not a yield to protect but the site's own footprint, and the edge a
      // supply road connects through. A building parked on it would take that
      // edge away.
      () => [
        ...this.roads.occupancyBlockers(),
        ...this.forests.liveTreeBlockers(),
        ...this.resourceNodes.liveNodeBlockers(),
        ...this.tradeSites.dockBlockers(),
      ],
      () => this.units.all(),
      (x, z) => this.groundSurface.heightAt(x, z),
      // The centre-led tier gate, enforced for both kingdoms at the one door
      // every build goes through. The palette greys its cards and the AI drops
      // the want from its order, but an expansion recipe naming a Tarla by id
      // reaches the service without passing either — so this is where "Yerleşim
      // Lv2" is actually true.
      (owner, stats) => buildingUnlocked(stats, this.progression.tierFor(owner)),
    );
    this.roadConstruction = new RoadConstructionService(
      this.roads,
      this.kingdoms,
      // Standing trees and live stone/gold deposits reserve road cells too, so a
      // route bends around the yield rather than paving over it. Both stay out of
      // navigationBlockers() itself, which units path through to reach them.
      //
      // Deposits are the sharper case: an extractor footprint must *contain* the
      // deposit point, so one road tile on top of it refused every legal quarry
      // centre and — with no way to unpave a road — retired the deposit for good.
      // A dock is reserved against paving too: the supply lane touches it from
      // the outside exactly as a road touches a producer's footprint, so a route
      // driven *across* it would occupy the very cells that make the connection.
      () => [
        ...this.occupancyBlockers(),
        ...this.forests.liveTreeBlockers(),
        ...this.resourceNodes.liveNodeBlockers(),
        ...this.tradeSites.dockBlockers(),
      ],
      () => {
        this.onRoadTopologyCommitted();
      },
    );
    // Built last among the AI's dependencies: it drives the very same
    // construction/production services the player's UI does (AI design §4).
    const settlementPlan = (buildingIds?: readonly string[]) => planSettlementLayout({
        seed: this.options.matchSeed,
        owner: AI_OWNER,
        center: this.spatial.enemyStart,
        territory: {
          control: {
            owner: AI_OWNER,
            ownsFootprint: (owner, x, z, width, depth) => this.territory.ownsFootprint(owner, x, z, width, depth),
            canPlaceExpansion: (owner, x, z, width, depth, maximumGap) =>
              this.territory.canPlaceExpansion(owner, x, z, width, depth, maximumGap),
          },
        },
        map: this.spatial,
        buildings: this.options.buildingBalance,
        placement: { occupied: [...this.centers.navigationBlockers(), ...this.structures.navigationBlockers()] },
        layout: this.options.aiLayoutBalance,
        buildingIds: buildingIds ?? [...new Set(this.spatial.enemyBaseAnchors.map((anchor) => anchor.buildingId))],
        isSourceAvailable: (sourceId) => this.settlementSourceAvailable(sourceId),
      });
    const siteProvider = new SettlementAiSiteProvider(
      settlementPlan(),
      this.spatial.enemyBaseAnchors,
      (buildingId) => settlementPlan([buildingId]),
    );
    this.ai = new AiController({
      owner: AI_OWNER,
      // The player's own building table: the AI's wants are filtered by the same
      // tier gate the palette locks its cards with, so a Tarla it cannot build
      // never takes the build slot from the hunt that opens the food economy.
      buildings: this.options.buildingBalance,
      units: this.units,
      structures: this.structures,
      centers: this.centers,
      kingdoms: this.kingdoms,
      production: this.economyProduction,
      logistics: this.productionLogistics,
      townCost: this.options.ageBalance.town.cost,
      townRequiredBuildingIds: this.options.ageBalance.town.requiredBuildingIds,
      unitIdForRole: (role) => Object.entries(this.options.unitBalance)
        .find(([, stats]) => stats.role === role)?.[0] ?? null,
      marketTrade: this.marketTrade,
      // The fourth reader of "is somebody already using this worker", and the
      // last one to learn about herding (pasture plan V2 Faz 7). A shepherd
      // counted as idle is a worker the AI believes it can spend: `§19
      // IdleWorkerCount` feeds the `no-available-worker` bottleneck, so a kingdom
      // with its whole crew out driving cattle would read as fully staffed and
      // stop training the workers the drive is costing it.
      isWorkerBusy: (unit) => this.workerConstruction.stateFor(unit) !== "idle"
        || (this.economyProduction?.isAssigned(unit) ?? false)
        || this.pasture.isShepherd(unit),
      navigation: this.navigation,
      // §58: undefined while the flag is off, so the army manager is built with
      // a null provider and never spends a tick on objectives that do not exist.
      objectives: this.regionalVictory && this.strategicPoints
        ? () => this.aiObjectiveWatch()
        : null,
      // §59: same shape as `objectives`. Null while the flag is off, which is
      // what keeps the AI's enemy reads byte-for-byte unchanged by default.
      vision: this.vision && this.enemyMemory
        ? new VisionSystemAiFilter(this.vision, this.enemyMemory, AI_OWNER)
        : null,
      isPredatorDenLive: (homeX, homeZ) => this.predators.denIsLive(homeX, homeZ),
      anchors: this.spatial.enemyBaseAnchors,
      siteProvider,
      baseSiteFilter: (site) => proceduralRoadSiteFailure(
        site,
        this.options.buildingBalance,
        this.roadConstruction,
        this.spatial.enemyBaseRoute,
        AI_OWNER,
      ),
      baseSiteRanker: (site) => (proceduralDepotRoadRank(
        site,
        this.options.buildingBalance,
        this.roadConstruction,
        siteProvider.plannedSites(),
        AI_OWNER,
      ) ?? 0) + this.settlementThreatPenalty(site.x, site.z),
      baseRoute: this.spatial.enemyBaseRoute,
      expansions: this.spatial.enemyExpansions,
      construction: this.structureConstruction,
      roadConstruction: this.roadConstruction,
      workerProduction: this.workerProduction,
      barracksProduction: this.barracksProduction,
      progression: this.progression,
      balance: this.options.aiBalance,
      profile: this.options.aiProfile,
    });
    this.placement = new BuildingPlacementSystem(
      canvas,
      this.cameraController.camera,
      this.options.buildingBalance,
      this.structureConstruction,
      PLAYER_OWNER,
    );
    this.placement.setPreviewFactory((buildingId, width, depth) =>
      this.buildingVisuals.createPreviewForBuilding(
        buildingId,
        width,
        depth,
        this.ageOf(PLAYER_OWNER),
        this.progression.tierFor(PLAYER_OWNER).level,
      ));
    this.roadPlacement = new RoadPlacementSystem(
      canvas,
      this.cameraController.camera,
      this.roads,
      this.roadConstruction,
      PLAYER_OWNER,
    );
    this.buildPalette = new RtsBuildPalette(
      this.options.buildingBalance,
      (id) => {
        const stats = this.options.buildingBalance[id];
        if (stats && !buildingUnlocked(stats, this.progression.tierFor(PLAYER_OWNER))) {
          // Named from the data, not spelled out: the Okçuluk Alanı is only the
          // first Town-gated building and the Tarla only the first level-gated
          // one, and the next would have been refused under its neighbour's name.
          this.buildPalette.setActionMessage(`${stats.label} ${buildingUnlockRequirement(stats)}`);
          return;
        }
        if (!this.beginMissionGatedPlacement(id)) return;
        this.roadPlacement.cancel();
        this.syncRoadUi();
        this.placement.begin(id);
        this.syncPlacementUi();
      },
      () => {
        this.placement.cancel();
        this.roadPlacement.begin();
        this.syncPlacementUi();
        this.syncRoadUi();
      },
      () => {
        this.placement.cancel();
        this.roadPlacement.beginErase();
        this.syncPlacementUi();
        this.syncRoadUi();
      },
    );
    this.gameSpeedControls = new RtsGameSpeedControls(1, (speed) => this.setSimulationSpeed(speed), {
      speeds: [1, 2],
      mode: "player",
    });
    this.hudBar.mountUtilityControl(this.gameSpeedControls);
    this.hudBar.mountStatusControl(this.armyRoster);
    this.matchOverlay = new RtsMatchOverlay({
      onResume: this.resumeMatch,
      onRestart: this.restartMatch,
      onSurrender: this.surrenderMatch,
      // Applied live while the card is up: §51's pause deliberately keeps the
      // camera running, so the player can judge the dial by moving the map.
      onCameraSettings: (settings) => this.cameraController.setSettings(settings),
      graphicsSettings: {
        quality: rtsGraphicsQuality(this.userSettings.graphics.selectedQualityLevel),
        adaptiveEnabled: this.userSettings.graphics.adaptiveOptimizationEnabled,
      },
      onGraphicsQuality: (quality) => this.setGraphicsQuality(quality),
      onGraphicsAdaptive: (enabled) => this.setGraphicsAdaptive(enabled),
      onAbandonMission: () => this.abandonMission(),
      // Built only when the host offered a menu to go back to (§ "Ana Menü").
      ...(this.options.onExitToMenu ? { onExitToMenu: this.exitToMenu } : {}),
    });
    this.debugOverlay = this.options.debug
      ? new RtsDebugOverlay({
        // Ignored mid-sweep: arming a capture would pause the match under the
        // sweep and leave it measuring frames that are never drawn.
        onCaptureFrame: () => { if (!this.gpuSweep) this.perfCaptureArmed = true; },
        onSweepGpu: () => this.startGpuSweep(),
      })
      : null;
    this.debugWitness = this.options.debug ? new RtsSimulationWitness() : null;
    this.perfProfiler = this.options.debug ? new SubsystemProfiler() : null;
    // Debug-only on purpose, which is also why adaptive quality cannot depend on
    // it: that controller runs in the shipping build, where this timer does not
    // exist. It classifies from frame time and budget as before.
    this.gpuTimer = this.options.debug
      ? GpuFrameTimer.create(this.renderer.getContext() as WebGL2RenderingContext)
      : null;
    this.debugTableModal = this.options.debug
      ? new RtsDebugTableModal({ onClose: () => this.closeDebugTable() })
      : null;
    this.debugSpeedControls = this.debugOverlay
      ? new RtsGameSpeedControls(1, (speed) => this.setSimulationSpeed(speed), { mode: "debug" })
      : null;
    if (this.debugSpeedControls) this.debugOverlay?.mountControl(this.debugSpeedControls);
    if (this.options.levelLoadError) {
      // Recorded, not only logged: someone who just pressed Play and got an
      // unfamiliar map has this as the answer to why.
      this.debugWitness?.setLevelLines([
        `seviye REDDEDİLDİ: ${this.options.levelRef}`,
        `  ! ${this.options.levelLoadError}`,
        "  blokaj haritası ile devam ediliyor",
      ]);
    }
    if (this.options.prosperityDebugEnabled) {
      this.debugWitness?.setProgressionLines([
        "Refah: bilgi metriği etkin; çağ ve üretim için gereksinim değildir.",
      ]);
    }
    // Affordability is a live wallet-derived UI state. Previously this listener
    // existed only for the optional debug log, so a card could remain faded
    // after income arrived until any palette click happened to refresh it.
    this.unsubscribeWalletChanges = this.playerKingdom.wallet.subscribe((change: ResourceChange) => {
      this.debugWitness?.recordResourceChange(change);
      this.buildPalette.setAffordability(this.playerKingdom.wallet.snapshot());
    });
    // Composite pointer handler: left button drives selection, while right
    // button cancels active building placement or issues commands otherwise.
    // Keeps the systems decoupled (neither imports the other); this composition
    // root is the only place that sees both.
    this.pointer = new RtsPointer(canvas, {
      onSelectClick: (x, y, additive) => {
        if (this.rallyPointPending) {
          this.commitRallyPoint(x, y);
        } else if (this.roadPlacement.isActive) {
          this.roadPlacement.confirmAt(x, y);
          this.syncPlacementUi();
          this.syncRoadUi();
        } else if (this.placement.isActive) {
          this.confirmMissionGatedPlacement(x, y);
        } else {
          this.selection.onSelectClick(x, y, additive);
        }
      },
      onSelectDoubleClick: (x, y, additive) => {
        if (!this.rallyPointPending && !this.roadPlacement.isActive && !this.placement.isActive) {
          this.selection.onSelectDoubleClick(x, y, additive);
        }
      },
      onSelectDrag: (rect) => {
        if (!this.roadPlacement.isActive && !this.placement.isActive) this.selection.onSelectDrag(rect);
      },
      onSelectCommit: (rect, additive) => {
        if (this.rallyPointPending) {
          this.commitRallyPoint(rect.x1, rect.y1);
        } else if (this.roadPlacement.isActive) {
          this.roadPlacement.confirmAt(rect.x1, rect.y1);
          this.syncPlacementUi();
          this.syncRoadUi();
        } else if (this.placement.isActive) {
          this.confirmMissionGatedPlacement(rect.x1, rect.y1);
        } else {
          this.selection.onSelectCommit(rect, additive);
        }
      },
      onSelectCancel: () => {
        if (this.roadPlacement.isActive) {
          this.roadPlacement.cancel();
          this.syncRoadUi();
        } else if (!this.placement.isActive) {
          this.selection.onSelectCancel();
        }
      },
      onCommandClick: (x, y) => {
        // A contextual right-click cancels an unfinished placement before it can
        // be interpreted as a unit command. Successful building and road
        // placement already disarm themselves after their single confirmation.
        if (this.rallyPointPending) {
          this.rallyPointPending = false;
          this.buildPalette.setActionMessage("Toplanma noktası seçimi iptal edildi.");
          return;
        }
        if (this.roadPlacement.isActive) {
          this.roadPlacement.cancel();
          this.syncRoadUi();
          return;
        }
        if (this.placement.isActive) {
          this.placement.cancel();
          this.syncPlacementUi();
          return;
        }
        this.commands.issueAt(x, y);
      },
      // A right *drag* is the camera, not a command — the pointer only reports
      // it past its drag threshold, and suppresses the command click that would
      // otherwise land when the button comes back up.
      onCameraDrag: (dx, dy) => this.input.pushDragPan(dx, dy),
      onPointerHover: (x, y) => {
        if (this.roadPlacement.isActive) {
          this.roadPlacement.previewAt(x, y);
          this.syncRoadUi();
        } else if (this.placement.isActive) {
          this.placement.previewAt(x, y);
          this.syncPlacementUi();
        }
      },
    });
    this.buildScene();
    this.applyQualitySettings(this.qualitySettings);
    // A completed type-wide research also applies to buildings that finish
    // afterwards; the visual must be created at that inherited level.
    this.structures.setCompletedVisualHandler((structure) => {
      this.progression.applyToStructure(structure);
      this.applyStructureVisual(structure, true);
    });
    this.structures.setDamagePresentationHandler({
      onDamageStageChanged: (structure, _previous, next) => this.onStructureDamageStageChanged(structure, next),
      onCollapse: (structure) => this.onStructureCollapse(structure),
      onRuinCleared: (structureId) => this.structureRuinSmoke.delete(structureId),
      onDamaged: (structure) => this.onStructureImpact(structure),
      collapsesInPlace: (structure) =>
        this.structureDamagePresentation(structure)?.collapseStyle === "inPlace",
      // Undefined where the catalog has nothing to say, so the structure system
      // keeps its own default rather than having one restated here.
      ruinSeconds: (structure) => this.structureDamagePresentation(structure)?.ruinSeconds,
      collapseDeformation: (structure) => this.structureDamagePresentation(structure)?.collapseDeformation,
      heavyDeformation: (structure) => this.structureDamagePresentation(structure)?.heavyDeformation,
    });
    // Damage effects are warmed inside `loadActorVisuals`, which is where the
    // manifest that resolves their ids becomes readable.
    void this.loadActorVisuals();
    this.spawnStartingUnits();
    // §59: one fog pass before the first frame is drawn.
    //
    // `updateFogOfWar` otherwise only runs from `updateSimulation`, which is
    // gated on `match.active && flow.running` — so on the start screen it had
    // never run at all, and the world rendered in an inconsistent half-state:
    // the fog texture still held its initial all-unknown fill (black ground)
    // while the visibility binder had hidden nothing, leaving the enemy's base
    // and the whole forest legible on top of it. The player could read the map
    // before pressing "Maçı Başlat".
    this.updateFogOfWar();
    this.syncPlacementUi();
    this.syncAgeUi();
    this.syncRoadUi();
  }

  /** The human kingdom's economy — everything the HUD reads and writes. */
  private get playerKingdom() {
    return this.kingdoms.get(PLAYER_OWNER);
  }

  /** Building id → player-facing label, built once from the balance data. */
  private get buildingLabels(): ReadonlyMap<string, string> {
    this.buildingLabelCache ??= new Map(
      Object.entries(this.options.buildingBalance).map(([id, stats]) => [id, stats.label]),
    );
    return this.buildingLabelCache;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.input.attach();
    this.pointer.attach();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.resize();
    this.lastTime = performance.now();
    this.log.info(
      `RTS runtime started${this.options.debug ? " (debug)" : ""}`,
    );
    this.frameHandle = requestAnimationFrame(this.onFrame);
    // The runtime is live; the match waits for the curtain. §51's start screen is
    // gone — the player already answered its one question in the main menu, before
    // any of this was built (plan F2) — so what holds the simulation now is the
    // boot itself. Starting it here instead would run the AI's opening seconds
    // behind an opaque curtain, on a field the player has not been shown yet.
    this.beginMatchWhenBooted();
  }

  /**
   * Start the match at the first moment both halves are true: the runtime is
   * running, and the curtain is off the field. Either can land first — a boot
   * whose assets were all cached completes the curtain before `start()` is even
   * called — so both entry points ask, and whichever is second wins.
   */
  private beginMatchWhenBooted(): void {
    if (!this.running || !this.curtainLifted || this.disposed) return;
    this.beginMatch();
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    delete this.canvas.dataset.rtsCursor;
    // The canvas outlives this app — "Ana Menü" hands it straight to the menu —
    // so the boot witnesses go with the match they described. Left behind, they
    // would sit on the menu claiming a loaded world and an Actor pack that were
    // disposed a moment ago, and anything that waits on them (the smoke suite,
    // the debug readout) would read the *previous* match's boot as this one's.
    delete this.canvas.dataset.rtsGround;
    delete this.canvas.dataset.rtsMapArt;
    delete this.canvas.dataset.rtsAuthoredWorld;
    delete this.canvas.dataset.rtsAuthoredSlotMaterials;
    delete this.canvas.dataset.rtsAuthoredUvwMappings;
    delete this.canvas.dataset.rtsContentAssets;
    delete this.canvas.dataset.rtsContentPlaceholders;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    if (this.loadTimeoutHandle) window.clearTimeout(this.loadTimeoutHandle);
    this.loadTimeoutHandle = 0;
    this.loadingScreen.dispose();
    this.input.detach();
    this.pointer.detach();
    this.marquee.dispose();
    this.matchOverlay.dispose();
    this.debugSpeedControls?.dispose();
    this.debugOverlay?.dispose();
    this.debugWitness?.dispose();
    this.debugTableModal?.dispose();
    this.gpuTimer?.dispose();
    this.unsubscribeWalletChanges?.();
    this.buildPalette.dispose();
    this.selectionPanel.dispose();
    this.worldProgressOverlay.dispose();
    this.projectiles.dispose();
    this.firebrands.dispose();
    this.cannonballs.dispose();
    this.structureDamageVfx.dispose();
    this.hudBar.dispose();
    this.notificationFeed.dispose();
    this.gameSpeedControls.dispose();
    this.armyRoster.dispose();
    this.placement.dispose();
    this.roadPlacement.dispose();
    this.roadDebugView.dispose();
    this.territory.dispose();
    this.strategicPointView?.dispose();
    this.missionPanel?.dispose();
    this.missionHint?.dispose();
    // Reveal before disposing: the binder set `visible = false` on live scene
    // objects, and tearing the fog down without undoing that would leave them
    // permanently invisible to whatever renders next.
    this.fogVisibility?.revealAll();
    // Same reason, for the art the binder no longer owns: the patched materials
    // outlive this app, so the mask has to be switched off before the texture it
    // reads goes away.
    this.tradeSiteView.dispose();
    this.fogMask?.dispose();
    this.fogView?.dispose();
    this.ghostStructures?.dispose();
    this.objectiveTracker?.dispose();
    this.pasture.reset();
    this.workerConstruction.reset();
    this.structureRepair.reset();
    this.barracksProduction.reset();
    this.workerProduction.reset();
    this.structures.clear();
    this.centers.clear();
    this.wildlifeView.dispose();
    this.caravanView.dispose();
    this.actorVisuals?.dispose();
    this.mapArt.dispose();
    // Before the authored world goes: hand each probe-covered mesh its original
    // material back (which frees our envMap clones), then free the baked PMREM
    // targets. Restoring first matters — the authored world only knows how to
    // dispose the materials it created, and a clone left in place would be both
    // leaked and pointing at a target we are about to release.
    for (const mesh of this.reflectionCaptureMeshes) applyProbeEnvMapToObject(mesh, null);
    this.reflectionCaptureMeshes = [];
    for (const bake of this.reflectionCaptureBakes) disposeSphereReflectionCaptureBake(bake);
    this.reflectionCaptureBakes = [];
    // Faz E: release the authored world's GPU resources so restart/dispose leaves
    // no leaked geometry, materials or shadow maps behind.
    this.authoredWorld?.dispose();
    this.authoredWorld = null;
    // Free the authored sky/cloud domes + Sky Light capture and clear scene.environment.
    this.environment.teardown();
    this.postProcessPipeline?.dispose();
    this.postProcessPipeline = null;
    // The painter only referenced the authored terrain's data/object, now freed.
    this.roadPainter = null;
    this.renderer.dispose();
  }

  /**
   * One boot-load finished. Succeeded, failed, or had nothing to do — all three
   * settle it, because the curtain is waiting on the *work*, and a 404'd Actor
   * pack is work that is over. Leaving a failed track pending is how a loading
   * screen turns a degraded boot into no boot at all (plan T3).
   */
  private settleAssetTrack(id: RtsLoadTrackId): void {
    this.loadTracker.settle(id);
    if (!this.pendingAssetTracks.delete(id)) return;
    if (this.pendingAssetTracks.size === 0) this.armFirstLoadedFrame();
  }

  /**
   * The plan's T2. Every asset is in memory, and none of it is on the GPU yet:
   * the first frame that draws the real landscape and the real unit meshes pays
   * for their upload and their shader compilation. Lifting the curtain on the
   * last resolved promise would therefore end it precisely at the freeze it was
   * covering, and the player would watch the pop-in anyway — one beat later.
   *
   * So the shaders are compiled behind the curtain, and only then are frames
   * counted. Two, not one: the first is the frame the compile lands in, the
   * second is the first frame that is honestly cheap.
   *
   * **Not `compileAsync()`** — the same r184 hazard `RuntimeSceneApp` already
   * documents (see its `warmRuntimeShaders`). `compileAsync` runs the identical
   * synchronous `compile()` first and only then polls the materials for driver
   * readiness on a `setTimeout` loop; that poll reads `currentProgram.isReady()`
   * without checking that `currentProgram` exists, so one material without a
   * program throws *inside the timer*, outside this method's `await`/`catch`.
   * The promise then never settles, `pendingFirstFrames` is never armed, and the
   * curtain hangs until the T3 timeout — the exact failure the curtain exists to
   * prevent. Since the expensive half runs synchronously either way, the async
   * version was buying nothing but that deadlock.
   */
  private armFirstLoadedFrame(): void {
    if (this.disposed) return;
    try {
      this.renderer.compile(this.scene, this.cameraController.camera);
    } catch (error) {
      // A driver that refuses the preload still draws fine; it just pays the
      // compile in the frame instead. Worth a line, not a stall.
      this.log.warn("RTS shader precompile failed; the first frame may hitch", error);
    }
    this.pendingFirstFrames = FRAMES_BEFORE_CURTAIN_LIFT;
  }

  private finishBootCurtain(): void {
    if (this.curtainLifted) return;
    this.curtainLifted = true;
    if (this.loadTimeoutHandle) window.clearTimeout(this.loadTimeoutHandle);
    this.loadTimeoutHandle = 0;
    // Cleared so a load that lands after the timeout opened the curtain cannot
    // arm a second, pointless precompile against an already-visible field.
    this.pendingAssetTracks.clear();
    this.pendingFirstFrames = 0;
    this.loadingScreen.hide();
    this.beginMatchWhenBooted();
  }

  private buildScene(): void {
    // Hemispheric-ish fill: ambient for base visibility, one shadowing key light.
    // A boot-time fallback only: the Level's World Settings take this light over the
    // moment the authored world lands (see loadAuthoredWorld). Kept for the phase
    // before that, and for a Level that fails to load — the alternative is a dark
    // field on the start screen.
    this.codeAmbient = new AmbientLight(0xffffff, 0.65);
    this.scene.add(this.codeAmbient);
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(40, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    this.scene.add(sun);
    // Kept referenced so an authored directional light (Faz E) can retire it once
    // the Level's world has actually loaded — never before, so a load failure
    // leaves the field lit by this fallback rather than dark.
    this.codeSun = sun;

    this.groundGroup = createRtsGround();
    this.scene.add(this.groundGroup);
    // Witness of which ground the match renders on: the flat placeholder now, or
    // an authored Landscape once one mounts (see retireFlatGround).
    this.canvas.dataset.rtsGround = "flat";
    // Ridge placeholder only while the legacy blockout is the spatial authority.
    // With a Level loaded the blockers are the authored ones (river + bridges),
    // so the legacy central ridge box would be a grey wall across a map whose
    // chokepoint is the river — and it used to be visible until the authored
    // world finished mounting, or forever if that mount failed.
    const blockout = createRtsMapBlockout(RTS_BLOCKOUT_MAP, {
      includeRidge: !this.options.level,
    });
    this.scene.add(blockout);
    this.canvas.dataset.rtsMapArt = "loading";
    void this.loadMapArt(blockout);
    // Faz E: mount the Level's static world in parallel with the map art. The
    // ridge gate below (loadMapArt) already skipped the legacy ridge art when this
    // is intended, so the authored ridge does not double up with it.
    if (this.authoredWorldIntended && this.options.levelLayout) {
      void this.loadAuthoredWorld(this.options.levelLayout);
    }
    this.spawnCenters();
    this.seedCenterAccessRoads();
    this.cameraController.setFocus(this.openingFocus.x, this.openingFocus.z);
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.scene.add(this.centers.root);
    this.scene.add(this.structures.root);
    this.scene.add(this.structureDamageVfx.root);
    this.scene.add(this.placement.root);
    this.scene.add(this.roadPlacement.root);
    this.scene.add(this.roadDebugView.root);
    this.scene.add(this.territory.root);
    // Hidden until a building placement begins; syncPlacementUi() toggles it.
    this.territory.root.visible = false;
    if (this.strategicPointView) this.scene.add(this.strategicPointView.root);
    if (this.missionHint) this.scene.add(this.missionHint.root);
    // §59, after the ground overlays it has to cover and before the units it
    // must not: fogged units are hidden outright by the visibility binder, not
    // occluded by this plane.
    if (this.fogView) this.scene.add(this.fogView.root);
    if (this.ghostStructures) this.scene.add(this.ghostStructures.root);
    // Wildlife sits with the units rather than with the ground overlays: it is a
    // moving body on the field, and the fog binder treats it the same way.
    this.scene.add(this.wildlifeRoot);
    this.scene.add(this.caravanRoot);
    this.scene.add(this.units.root);
    this.scene.add(this.projectiles.root);
    this.scene.add(this.firebrands.root);
    this.scene.add(this.cannonballs.root);
    // The shell's blast is an authored effect, not something the cannonball
    // system draws: it reports the landing, this plays whatever the gun's
    // `impactEffect` names. Wired here rather than at construction because the
    // VFX subsystem is what resolves the id, and it is the scene's to own.
    this.cannonballs.setImpactHandler((effectId, position) => {
      if (effectId) this.playWorldEffect(effectId, [position.x, position.y, position.z]);
    });
    this.scene.add(this.commandMarkers.root);
  }

  /**
   * Match-start forces.
   *
   * Both sides open identically unless the preset hands the enemy its own
   * `enemyStartingUnits` handicap. Further military strength must come from a
   * Barracks each kingdom builds and pays for.
   */
  private spawnStartingUnits(): void {
    const guard = this.options.unitBalance[PLACEHOLDER_GUARD_ID];
    const worker = this.options.unitBalance[PLACEHOLDER_WORKER_ID];
    if (!guard || !worker) {
      throw new Error(`Missing unit balance definition "${PLACEHOLDER_GUARD_ID}"`);
    }
    const player = this.options.startingUnits ?? {};
    const enemy = this.options.enemyStartingUnits ?? player;
    // Only resolved when a preset actually opens with artillery, so a project
    // that drops the siege unit entirely still boots on the default presets.
    const siegeRequested =
      (player.siege ?? STARTING_SIEGE_COUNT) > 0 || (enemy.siege ?? STARTING_SIEGE_COUNT) > 0;
    const archerRequested =
      (player.archer ?? STARTING_ARCHER_COUNT) > 0 || (enemy.archer ?? STARTING_ARCHER_COUNT) > 0;
    const siege = this.options.unitBalance[PLACEHOLDER_SIEGE_ID];
    if (siegeRequested && !siege) {
      throw new Error(`Missing unit balance definition "${PLACEHOLDER_SIEGE_ID}"`);
    }
    const archer = this.options.unitBalance[PLACEHOLDER_ARCHER_ID];
    if (archerRequested && !archer) {
      throw new Error(`Missing unit balance definition "${PLACEHOLDER_ARCHER_ID}"`);
    }
    // Rows of `cols`, so a preset with a wide opening does not string units out
    // in one long line across the map.
    const cols = 5;
    const spawnSide = (
      owner: UnitOwner,
      counts: StartingUnits,
      center: { x: number; z: number },
      /** +1 spawns away from the player camp, -1 towards it. */
      facing: 1 | -1,
    ): void => {
      const guardCount = counts.guard ?? STARTING_GUARD_COUNT;
      const workerCount = counts.worker ?? STARTING_WORKER_COUNT;
      for (let i = 0; i < guardCount; i++) {
        const x = center.x - 6 + (i % cols) * 3;
        const z = center.z + facing * (7 + Math.floor(i / cols) * 3);
        this.units.spawn(owner, x, z, guard);
      }
      for (let i = 0; i < workerCount; i++) {
        const x = center.x - 4 + (i % cols) * 2;
        const z = center.z - facing * (8 + Math.floor(i / cols) * 2);
        this.units.spawn(owner, x, z, worker);
      }
      const archerCount = counts.archer ?? STARTING_ARCHER_COUNT;
      if (archer) {
        // Archers open behind the guard screen and in front of siege, matching
        // the same guard → archer → siege order the formation system uses.
        for (let i = 0; i < archerCount; i++) {
          const x = center.x - 6 + (i % cols) * 3;
          const z = center.z + facing * (5 + Math.floor(i / cols) * 3);
          this.units.spawn(owner, x, z, archer);
        }
      }
      const siegeCount = counts.siege ?? STARTING_SIEGE_COUNT;
      if (siege) {
        // Between the camp and the guard line: artillery is slow and fragile in
        // melee, so it opens behind the screen it is meant to shoot past.
        for (let i = 0; i < siegeCount; i++) {
          const x = center.x - 6 + (i % cols) * 3;
          const z = center.z + facing * (4 - Math.floor(i / cols) * 3);
          this.units.spawn(owner, x, z, siege);
        }
      }
    };
    spawnSide("player", player, this.spatial.playerStart, 1);
    spawnSide("enemy", enemy, this.spatial.enemyStart, -1);
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const rawDeltaMs = now - this.lastTime;
    // Quality observes the raw rAF interval; simulation still clamps stalls so
    // an alt-tab or breakpoint cannot accelerate an RTS match.
    this.frameMetrics.record(rawDeltaMs);
    const dt = Math.max(0, Math.min(rawDeltaMs / 1000, MAX_FRAME_SECONDS));
    this.lastTime = now;
    const frameMark = this.perfMark();

    this.resize();
    this.consumeCommandInput();
    // The territory fill masks the landscape texture, so it earns its clutter
    // only while the player is choosing where a building goes. Bind it to the
    // building-placement mode every frame — cheap and idempotent, so no cancel
    // path can leave it stale — and the ground reads as terrain the rest of the
    // time instead of a permanent control heatmap.
    this.territory.root.visible = this.placement.isActive;
    // The camera keeps running while paused and on the start screen: looking at
    // the map is not playing the match, and freezing it would trap the player
    // staring at whatever the last frame happened to show.
    this.cameraController.update(dt, this.input);
    this.perfCaptureSteps = 0;
    if (this.match.active && this.flow.running) {
      const simulationMark = this.perfMark();
      for (const simulationDt of simulationSteps(dt, this.simulationSpeed, MAX_FRAME_SECONDS)) {
        if (!this.match.active) break;
        this.commands.update(simulationDt);
        this.updateSimulation(simulationDt);
        this.perfCaptureSteps += 1;
      }
      this.perfMeasure("simülasyon", simulationMark);
    }
    if (this.debugWitness) {
      // Measured like everything else, because on this route it is a real cost:
      // the hidden readout rebuilds a line per unit per frame, and a panel that
      // hid the price of its own diagnostics would be lying about the frame.
      const witnessMark = this.perfMark();
      this.debugWitness.setElapsedSeconds(this.clock.seconds);
      // §59. Recomputing the source list here costs one array build per rendered
      // frame, which is why it only happens on the debug route.
      if (this.vision && this.enemyMemory) {
        this.debugWitness.setVisionLines(formatVisionDebug(
          this.vision,
          this.enemyMemory,
          this.collectVisionSources().length,
          this.clock.seconds,
        ));
      }
      this.debugWitness.setAiLines(
        formatRtsAiDebug(
          this.ai.snapshot(),
          this.ai.log.recent(),
          this.ai.economyMultiplier,
          this.options.aiBalance,
        ),
      );
      this.debugWitness.update(
        this.units,
        this.centers,
        this.match.outcome,
        this.workerConstruction,
        this.playerKingdom.wallet,
        this.economyProduction,
        this.playerKingdom.population,
        this.roads,
        this.depotLogistics,
        this.productionLogistics,
      );
      this.perfMeasure("tanı", witnessMark);
    }
    const presentationMark = this.perfMark();
    const groundMark = this.perfMark();
    this.roadDebugView.refresh();
    // Cheap when nothing was built: two integer compares (see syncStructurePads).
    this.syncStructurePads();
    this.syncUnitsToGround();
    this.perfMeasure("zemin oturtma", groundMark);
    const worldArtMark = this.perfMark();
    this.commandMarkers.update(dt);
    // One shared phase for every selected unit and building, on the rendered
    // delta: the rings must breathe together and at the same rate at any game speed.
    updateSelectionRingPulse(dt);
    this.structures.updateVisualAnimations(dt);
    this.updateStructureDamageVfx(dt);
    this.updateWorldProgressOverlay();
    this.perfMeasure("yapı görselleri", worldArtMark);
    // Presentation runs on the rendered-frame delta, not the simulation's: a
    // tracer and a health bar should look the same at any game speed.
    const projectileMark = this.perfMark();
    this.projectiles.update(dt);
    this.firebrands.update(dt);
    this.perfMeasure("mermiler", projectileMark);
    // Cannonballs are deliberately absent here: they gate damage now, so they
    // are advanced with the simulation in `updateSimulation`, not on this
    // rendered delta.
    const unitViewMark = this.perfMark();
    this.units.updatePresentation(
      dt,
      this.cameraController.camera.quaternion,
      this.cameraController.camera.position,
    );
    this.perfMeasure("birim sunumu", unitViewMark);
    // Rendered delta, like the units': a grazing animal should look the same at
    // any game speed. Distance throttling is left to the presentation itself.
    //
    // §59: the fog test rides along here rather than in `FogVisibilityBinder`,
    // because this is the loop that creates the bodies and the only one that runs
    // on the start screen — a herd fogged from the binder's schedule would graze
    // in plain sight until the first simulation tick.
    const herdViewMark = this.perfMark();
    this.wildlifeView.sync(this.wildlife.all(), dt, null, this.playerVisibilityTest(), PLAYER_OWNER);
    this.caravanView.sync(this.caravans.all(), dt, this.playerVisibilityTest(), PLAYER_OWNER);
    this.perfMeasure("hayvan/kervan sunumu", herdViewMark);
    // §59: the grid is a simulation fact and `updateFogOfWar` owns it; how far
    // the drawn frontier has eased toward it is presentation, so it runs here on
    // the rendered delta. Same reason as the wildlife above — at §38's 8x test
    // speed a fade driven by the simulation would collapse into a pop.
    const fogViewMark = this.perfMark();
    this.fogView?.advance(dt);
    this.perfMeasure("sis görünümü", fogViewMark);
    const hudViewMark = this.perfMark();
    this.selectionPanel.setSelection(this.selectionView());
    // Objectives run on the rendered-frame delta like the rest of the read-only
    // presentation: the story card is paced for a person reading it, not for the
    // simulation, so §38's 8x test speed must not race the chain past them.
    this.updateMissions(dt);
    // Notices expire on real seconds for the same reason a health bar animates
    // on them: at §38's 8x test speed a warning that vanished eight times faster
    // would be unreadable exactly when the match is hardest to follow.
    this.notifications.advance(dt);
    this.notificationFeed.setNotifications(this.notifications.active());
    this.perfMeasure("panel/görev arayüzü", hudViewMark);
    // Keep the authored sky/cloud domes centered on the camera and advance clouds.
    const environmentMark = this.perfMark();
    this.environment.update(dt);
    // Painted foliage culls per rendered frame against the live quality knob; a
    // no-op for a Level with no foliage or with distance culling disabled.
    this.authoredWorld?.updateFoliageCulling(
      this.cameraController.camera.position,
      this.qualitySettings.foliageCullDistanceScale,
    );
    this.perfMeasure("çevre/bitki", environmentMark);
    const qualityMark = this.perfMark();
    this.tickAdaptiveQuality(dt);
    this.perfMeasure("kalite denetimi", qualityMark);
    this.perfMeasure("sunum", presentationMark);
    // Authored Post Process (bloom/SMAA) composits the frame when present; otherwise
    // draw straight through the renderer.
    const renderMark = this.perfMark();
    // A sweep step's content is hidden for exactly this render and restored
    // immediately after, so nothing downstream — selection, picking, the next
    // frame's presentation pass — ever sees the doctored scene.
    advanceForgeMaterialAnimations(now / 1000);
    const sweepStep = this.applyGpuSweepStep();
    this.gpuTimer?.begin(sweepStep?.tag ?? 0);
    if (this.postProcessPipeline && !sweepStep?.bypassPostProcess) this.postProcessPipeline.render(dt);
    else this.renderer.render(this.scene, this.cameraController.camera);
    this.gpuTimer?.end();
    this.restoreGpuSweepStep();
    // T2: the curtain lifts on a frame that has been *drawn* with the loaded
    // assets in it, counted here rather than promised by the loader. This is the
    // difference between "the landscape has arrived" and "the landscape is on
    // screen" — the placeholders live in the gap between those two.
    if (this.pendingFirstFrames > 0 && --this.pendingFirstFrames === 0) {
      this.loadTracker.settle("firstFrame");
    }
    // What the CPU spent issuing the frame, not what the GPU spent drawing it:
    // WebGL is asynchronous, so this is the submission cost. The GPU's own time
    // comes back from the timer query a few frames later.
    this.perfMeasure("çizim", renderMark);
    this.perfMeasure("kare", frameMark);
    this.flushPerfFrame();
    this.collectGpuSamples();
    this.publishPerformanceSnapshot(dt);
  };

  /**
   * Start of a measured region — `0` when the debug profiler is off, so an
   * un-instrumented run pays one property read per site and nothing else.
   */
  private perfMark(): number {
    return this.perfProfiler ? performance.now() : 0;
  }

  /** Adds the elapsed time to this frame's tally for `id`. */
  private perfMeasure(id: string, startMs: number): void {
    if (!this.perfProfiler) return;
    this.perfFrameCosts.set(id, (this.perfFrameCosts.get(id) ?? 0) + (performance.now() - startMs));
  }

  /** Hands the frame's tallies to the rolling profiler and starts the next one. */
  private flushPerfFrame(): void {
    if (!this.perfProfiler) return;
    for (const [id, ms] of this.perfFrameCosts) this.perfProfiler.record(id, ms);
    this.perfProfiler.endFrame();
    // After the record, so the captured frame is inside the window it is being
    // compared against: "is this frame typical" is a question about a window
    // that includes it.
    if (this.perfCaptureArmed) this.takeFrameCapture();
    this.perfFrameCosts.clear();
  }

  /**
   * Freeze this frame's costs into a table and hold the match still while it is
   * read. Deliberately the last thing the frame does: the modal it opens must
   * not be part of the frame it is describing.
   */
  private takeFrameCapture(): void {
    this.perfCaptureArmed = false;
    const profiler = this.perfProfiler;
    const modal = this.debugTableModal;
    if (!profiler || !modal) return;
    const window = new Map(profiler.snapshot().subsystems.map((timing) => [timing.id, timing]));
    const total = this.perfFrameCosts.get(PERF_TOTAL_REGION) ?? 0;
    const totalWindow = window.get(PERF_TOTAL_REGION);
    const regions: RtsFrameRegionSample[] = [];
    for (const [id, frameMs] of this.perfFrameCosts) {
      if (id === PERF_TOTAL_REGION) continue;
      const timing = window.get(id);
      const parent = PERF_REGION_PARENTS[id];
      regions.push({
        id,
        ...(parent === undefined ? {} : { parent }),
        frameMs,
        averageMs: timing?.averageMs ?? 0,
        maxMs: timing?.maxMs ?? 0,
        ...(PERF_DEBUG_ONLY_REGIONS.has(id) ? { debugOnly: true } : {}),
      });
    }
    modal.show(rtsFrameCaptureTableView(buildRtsFrameCapture({
      totalMs: total,
      averageTotalMs: totalWindow?.averageMs ?? 0,
      maxTotalMs: totalWindow?.maxMs ?? 0,
      regions,
      simulationSteps: this.perfCaptureSteps,
      speed: this.simulationSpeed,
      windowFrames: totalWindow?.samples ?? 0,
      matchSeconds: this.clock.seconds,
    })));
    // Only now, and only if the match was actually running: a capture taken on
    // the start screen has nothing to hold still.
    this.frameCaptureOwnsPause = this.flow.pause();
  }

  /** Close the table and hand the match back exactly as it was found. */
  private closeDebugTable(): void {
    this.debugTableModal?.hide();
    if (!this.frameCaptureOwnsPause) return;
    this.frameCaptureOwnsPause = false;
    this.flow.resume();
  }

  /**
   * The GPU sweep's configurations, in the order they are measured.
   *
   * Each one returns its own undo, so a step can never be restored by guesswork
   * about what it changed. They are applied around the render call alone (see
   * {@link applyGpuSweepStep}), which is why hiding a root here is safe even
   * though the presentation pass rewrites some of that visibility every frame.
   */
  private gpuSweepSteps(): readonly { readonly id: string; readonly apply: () => () => void }[] {
    const hide = (objects: readonly (Object3D | null | undefined)[]) => (): (() => void) => {
      const hidden = objects.filter((object): object is Object3D => !!object && object.visible);
      for (const object of hidden) object.visible = false;
      return () => { for (const object of hidden) object.visible = true; };
    };
    const steps: { id: string; apply: () => () => void }[] = [
      {
        // Not `shadowMap.enabled`, which forces every affected material to
        // recompile: the recompile would land inside the very frame being timed
        // and be reported as the cost of shadows. Freezing the update measures
        // the thing that actually recurs — re-rendering the shadow map.
        id: "gölge haritası",
        apply: () => {
          const previous = this.renderer.shadowMap.autoUpdate;
          this.renderer.shadowMap.autoUpdate = false;
          return () => {
            this.renderer.shadowMap.autoUpdate = previous;
            this.renderer.shadowMap.needsUpdate = true;
          };
        },
      },
      {
        id: "birimler",
        apply: hide([this.units.root, this.wildlifeRoot, this.caravanRoot]),
      },
      {
        id: "yapılar",
        apply: hide([
          this.centers.root,
          this.structures.root,
          this.structureDamageVfx.root,
          this.tradeSiteView?.object,
        ]),
      },
      {
        // Everything the Level authored, plus the flat fallback ground: the
        // whole floor of the world as one number.
        id: "arazi/harita",
        apply: hide([this.groundGroup, this.authoredWorld?.root]),
      },
      {
        id: "mermiler/efektler",
        apply: hide([this.projectiles.root, this.firebrands.root, this.cannonballs.root]),
      },
      {
        id: "dünya arayüzü",
        apply: hide([
          this.territory.root,
          this.roadDebugView.root,
          this.placement.root,
          this.roadPlacement.root,
          this.commandMarkers.root,
          this.strategicPointView?.root,
          this.missionHint?.root,
          this.ghostStructures?.root,
          this.fogView?.root,
        ]),
      },
    ];
    // `arazi/harita` above is the floor as a whole, and when it dominates the
    // frame that is the end of the finding rather than the start of one: the row
    // bundles a full-screen multi-layer terrain shader together with every
    // authored prop and every painted plant. These split it, and like every
    // other row they are savings rather than parts — the total is not their sum,
    // and what they leave over is the map art.
    const terrain = this.authoredWorld?.landscapes.map((mounted) => mounted.object) ?? [];
    if (terrain.length > 0) steps.push({ id: "↳ arazi (landscape)", apply: hide(terrain) });
    const painted = this.authoredWorld?.foliageRoot;
    if (painted) steps.push({ id: "↳ bitki örtüsü", apply: hide([painted]) });
    // The third piece of the floor, and the one the first two leave standing:
    // every Static Mesh placement and spline-generated batch the Level authored.
    // Painted foliage is a separate system from a *placed* tree, and measuring
    // one is not measuring the other.
    const mapArt = this.authoredWorld?.staticInstanceMeshes ?? [];
    if (mapArt.length > 0) steps.push({ id: "↳ harita sanatı", apply: hide(mapArt) });
    // The fourth piece, and the only one that is not just its own pixels: a
    // `sharedPlanar` River Water renders the entire scene a second time, from a
    // mirrored camera, into a fixed-size target — driven from the ribbon's own
    // draw, so it disappears exactly when the ribbon does. A row measuring the
    // water is therefore measuring that nested pass, which is the point.
    const rivers = this.authoredWorld?.riverWaterObjects ?? [];
    if (rivers.length > 0) steps.push({ id: "↳ nehir suyu", apply: hide(rivers) });
    // Only worth a row when there is a chain to bypass; otherwise the step would
    // measure the untouched frame twice and report the difference as noise.
    if (this.postProcessPipeline) steps.push({ id: "son işlem (post)", apply: () => () => {} });
    return steps;
  }

  /** Begin a sweep, unless one is already running or GPU timing is unavailable. */
  private startGpuSweep(): void {
    if (this.gpuSweep) return;
    if (!this.gpuTimer) {
      this.debugTableModal?.show(rtsGpuSweepUnavailableView(
        "Bu tarayıcıda GPU zamanlayıcı eklentisi yok.",
      ));
      this.frameCaptureOwnsPause = this.flow.pause();
      return;
    }
    // Closed first: the sweep needs real frames to measure, and a table already
    // on screen means one is being read rather than drawn.
    if (this.debugTableModal?.open) this.closeDebugTable();
    // Paused for the whole sweep, not just to read the result: every step is a
    // comparison between whole frames, and an army that marched across the map
    // between the baseline and the last step would be measured as the cost of
    // whatever happened to be turned off at the time. Rendering continues while
    // paused, which is all the sweep needs.
    //
    // Pausing does not make the run safe on its own, and this is where that
    // shows: a still, cheap scene is exactly what lets the GPU drop a power
    // state, and the untouched frame then measures several times slower at the
    // end of the sweep than at the start. The schedule bracketing each step
    // with its own baselines is what survives that; see `rtsGpuSweep`.
    this.frameCaptureOwnsPause = this.flow.pause();
    // Built once per sweep: the plan closes over scene roots, and rebuilding it
    // per frame would allocate a set of closures inside the frames being timed.
    this.gpuSweepPlan = this.gpuSweepSteps();
    this.gpuSweep = new RtsGpuSweepRunner(this.gpuSweepPlan.map((step) => ({ id: step.id })));
  }

  /**
   * Hide whatever the current sweep step removes, for this render only.
   * @returns the step's sample tag, or null when no sweep is running.
   */
  private applyGpuSweepStep(): { readonly tag: number; readonly bypassPostProcess: boolean } | null {
    const sweep = this.gpuSweep;
    const step = sweep?.currentStep();
    if (!step) return null;
    // The schedule interleaves untouched baselines between the steps, so which
    // configuration to apply comes from the step itself rather than from its
    // position: `null` is a baseline frame, and the rest index the cached plan.
    const configured = step.planIndex === null ? null : this.gpuSweepPlan[step.planIndex];
    this.gpuSweepRestore = configured ? configured.apply() : null;
    return { tag: step.tag, bypassPostProcess: step.id === "son işlem (post)" };
  }

  private restoreGpuSweepStep(): void {
    const restore = this.gpuSweepRestore;
    this.gpuSweepRestore = null;
    restore?.();
  }

  /**
   * Drain finished GPU results, feed the running sweep, and finish it when every
   * configuration has been measured.
   *
   * Results lag the frame that produced them, which is why the sweep is driven
   * from here rather than from the render call: a step only ends once its
   * samples have actually come back, not once its frames have been drawn.
   */
  private collectGpuSamples(): void {
    const timer = this.gpuTimer;
    if (!timer) return;
    const before = timer.disjointCount;
    const samples = timer.poll();
    const sweep = this.gpuSweep;
    if (!sweep) return;
    if (timer.disjointCount > before) sweep.noteDisjoint();
    for (const sample of samples) sweep.acceptSample(sample.tag, sample.ms);
    sweep.noteFrame();
    const render = readRenderStats(this.renderer);
    const outcome = sweep.advance({
      speed: this.simulationSpeed,
      matchSeconds: this.clock.seconds,
      drawCalls: render.drawCalls,
      triangles: render.triangles,
    });
    if (outcome.kind === "running") return;
    this.gpuSweep = null;
    this.gpuSweepPlan = [];
    // The match is already held by `startGpuSweep`, so the pause flag is left
    // exactly as it was: re-pausing here would report "we did not pause it" and
    // the close would strand the player in a paused match.
    this.debugTableModal?.show(
      outcome.kind === "done"
        ? rtsGpuSweepTableView(outcome.sweep)
        : rtsGpuSweepUnavailableView(outcome.reason),
    );
  }

  /**
   * A debug-route-only performance witness for repeatable browser captures.
   * It is intentionally sampled (rather than updated every frame) so observing
   * draw calls and frame percentiles cannot become the performance problem.
   */
  private publishPerformanceSnapshot(deltaSeconds: number): void {
    if (!this.options.debug) return;
    this.performanceSnapshotAccumulator += deltaSeconds;
    if (this.performanceSnapshotAccumulator < PERFORMANCE_SNAPSHOT_INTERVAL_SECONDS) return;
    this.performanceSnapshotAccumulator = 0;
    const frame = this.frameMetrics.metrics();
    const spikes = this.frameMetrics.spikeCounts();
    const render = readRenderStats(this.renderer);
    const memory = readRenderMemory(this.renderer);
    const shadowCasters = this.shadowCasterStats();
    const graph = this.sceneGraphStats();
    const frameStats = {
      averageMs: frame.averageFrameTimeMs,
      p95Ms: frame.p95FrameTimeMs,
      sampleCount: frame.sampleCount,
      over33ms: spikes.over33ms,
      over50ms: spikes.over50ms,
      over100ms: spikes.over100ms,
    };
    this.canvas.dataset.rtsPerf = JSON.stringify({
      frame: { ...frameStats, windowSeconds: frame.sampleWindowSeconds },
      render,
      memory,
      shadowCasters,
      graph,
      // Event-driven terrain work, not a per-frame timer. Browser performance
      // captures can correlate a road/build hitch with its exact repaint scope.
      terrainPaint: this.roadPainter?.snapshot() ?? null,
      quality: this.userSettings.graphics.selectedQualityLevel,
      adaptiveEnabled: this.userSettings.graphics.adaptiveOptimizationEnabled,
      adaptiveReductionDepth: this.adaptiveQuality.reductionDepth,
    });
    // The on-screen panel rides the same sample: one traversal, one set of
    // counters, so the visible readout and the recorded witness can never
    // disagree about the frame they are describing.
    this.debugOverlay?.setPerformance({
      frame: frameStats,
      render,
      memory,
      // Read back from the renderer rather than recomputed from the profile: the
      // number that matters is the buffer being shaded, and `resize` is what
      // last decided it.
      viewport: {
        width: this.lastW,
        height: this.lastH,
        pixelRatio: this.renderer.getPixelRatio(),
      },
      gpu: this.gpuTimer?.stats() ?? null,
      shadows: [
        { label: "aktörler", ...shadowCasters.actors },
        { label: "harita", ...shadowCasters.mapArt },
        { label: "diğer", ...shadowCasters.other },
      ],
      costs: this.perfCosts(),
      graph,
      quality: {
        level: this.userSettings.graphics.selectedQualityLevel,
        adaptiveEnabled: this.userSettings.graphics.adaptiveOptimizationEnabled,
        reductionDepth: this.adaptiveQuality.reductionDepth,
      },
      scene: {
        units: this.units.all().length,
        structures: this.structures.all().length,
        caravans: this.caravans.all().length,
        wildlife: this.wildlife.all().length,
      },
    });
  }

  /**
   * The measured frame regions, in a fixed reading order rather than the
   * profiler's cost order: `kare` is the whole frame and the rest are its parts,
   * so a list that re-sorted itself every half second would make the nesting
   * unreadable exactly when it matters.
   */
  private perfCosts(): RtsPerfCost[] {
    const profiler = this.perfProfiler;
    if (!profiler) return [];
    const timings = new Map(profiler.snapshot().subsystems.map((timing) => [timing.id, timing]));
    const order: readonly { readonly id: string; readonly nested?: boolean }[] = [
      { id: "kare" },
      { id: "simülasyon" },
      { id: "ai", nested: true },
      { id: "görüş", nested: true },
      { id: "sunum" },
      { id: "çizim" },
      { id: "tanı" },
    ];
    const costs: RtsPerfCost[] = [];
    for (const entry of order) {
      const timing = timings.get(entry.id);
      if (!timing) continue;
      costs.push({
        label: entry.id,
        averageMs: timing.averageMs,
        lastMs: timing.lastMs,
        maxMs: timing.maxMs,
        ...(entry.nested ? { nested: true } : {}),
      });
    }
    return costs;
  }

  /**
   * How much graph `renderer.render` has to walk, sampled on the snapshot
   * cadence rather than per frame — counting it every frame would add a
   * traversal to the very cost it is there to explain.
   *
   * `traverseVisible` deliberately, not `traverse`: three.js abandons an
   * invisible subtree whole, so a hidden branch is not part of what the frame
   * pays for and counting it would overstate the finding.
   */
  private sceneGraphStats(): { objects: number; meshes: number } {
    let objects = 0;
    let meshes = 0;
    this.scene.traverseVisible((object) => {
      objects += 1;
      if ((object as { isMesh?: boolean }).isMesh === true) meshes += 1;
    });
    return { objects, meshes };
  }

  /** Shadow-caster inventory for a debug performance report, sampled not hot-path. */
  private shadowCasterStats(): Record<ShadowCasterCategory, { meshes: number; triangles: number }> {
    const out: Record<ShadowCasterCategory, { meshes: number; triangles: number }> = {
      actors: { meshes: 0, triangles: 0 },
      mapArt: { meshes: 0, triangles: 0 },
      other: { meshes: 0, triangles: 0 },
    };
    this.scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.castShadow || !object.visible) return;
      const geometry = object.geometry;
      const vertexCount = geometry.index?.count ?? geometry.getAttribute("position")?.count ?? 0;
      const bucket = out[shadowCasterCategory(object)];
      bucket.meshes += 1;
      bucket.triangles += Math.floor(vertexCount / 3);
    });
    return out;
  }

  /** Applies at most one reversible quality rung from a settled frame-time trend. */
  private tickAdaptiveQuality(deltaSeconds: number): void {
    this.adaptiveTickAccumulator += deltaSeconds;
    if (this.adaptiveTickAccumulator < ADAPTIVE_TICK_INTERVAL_SECONDS) return;
    const dt = this.adaptiveTickAccumulator;
    this.adaptiveTickAccumulator = 0;
    const active =
      this.match.active &&
      this.flow.running &&
      this.userSettings.graphics.adaptiveOptimizationEnabled &&
      this.userSettings.graphics.allowAdaptiveFineTuning;
    const update = this.adaptiveQuality.update({
      metrics: this.frameMetrics.metrics(),
      preferences: this.userSettings.graphics,
      deltaSeconds: dt,
      active,
      classify: () => this.classifyQualityBottleneck(),
    });
    if (update.settings && update.kind !== "none") this.applyQualitySettings(update.settings);
  }

  private classifyQualityBottleneck() {
    const render = readRenderStats(this.renderer);
    const memory = readRenderMemory(this.renderer);
    return classifyBottleneck({
      metrics: this.frameMetrics.metrics(),
      subsystems: null,
      budget: evaluatePerfBudget({
        drawCalls: render.drawCalls,
        triangles: render.triangles,
        textures: memory.textures,
      }),
      targetFrameTimeMs: this.userSettings.graphics.targetFrameRate === 30 ? 33.3 : 16.7,
    });
  }

  /**
   * Advance the story/tutorial chain — Hikâye / Öğretici Tur Modu, Faz 1.
   *
   * Read-only in both directions: it asks the world what is true and tells the
   * card and the feed. Nothing in the simulation is gated on it, so a mission
   * that misbehaves costs the player a wrong sentence, never a wrong match.
   */
  private updateMissions(dt: number): void {
    const missions = this.missions;
    if (!missions) return;
    // Only while the match is genuinely being played. Behind the start card or a
    // pause the world is frozen, and ticking objectives there would let the chain
    // announce progress at a player who is not looking at the field.
    if (!this.match.active || !this.flow.running) return;

    if (!this.missionIntroPosted) {
      this.missionIntroPosted = true;
      this.notifications.post({ kind: "mission", subject: "intro", text: missions.intro });
    }

    // Every frame, unlike the objectives themselves: what the pointer answers to
    // is the *selection*, which moves at pointer speed. A guide resolved on the
    // 4Hz poll would leave the player looking at a freshly selected Market for a
    // quarter second before the button they were told to press lit up.
    this.syncMissionGuide(missions.state());
    this.missionHint?.update(dt);

    this.missionPollTimer += dt;
    if (this.missionPollTimer < MISSION_POLL_SECONDS) return;
    this.missionPollTimer = 0;

    for (const event of missions.evaluate(this.missionWorldSnapshot())) {
      // A newly activated step is *not* announced: the card below already says
      // it, and posting the same instruction twice trains the player to read
      // neither. Only what the card cannot show goes to the feed — that a step
      // just cleared, and that the chain is over.
      if (event.kind === "step-completed") {
        this.notifications.post({
          kind: "mission",
          subject: `done:${event.step.id}`,
          text: `Görev tamam: ${event.step.title}`,
        });
      } else if (event.kind === "chain-finished") {
        this.notifications.post({ kind: "mission", subject: "outro", text: missions.outro });
        // Finishing resolves the offer exactly as declining it does: the player
        // has met the tur, and the next tab should open on a free match.
        this.options.onMissionResolved?.();
      }
    }
    this.missionPanel?.setState(missions.state());
    // Again after the chain may have moved: a step that just cleared must not
    // leave the previous step's button pulsing until the next frame.
    this.syncMissionGuide(missions.state());
  }

  /**
   * Point the UI at whatever the active step is asking for — Sürüm 2 §12.4.
   *
   * The decision is {@link missionGuideHighlight}'s, and it is pure; this only
   * hands the answer to the three surfaces that can show it. A finished,
   * abandoned or guide-less step resolves to nulls, which is what clears them —
   * there is no separate "stop pointing" path to forget to call.
   */
  private syncMissionGuide(state: MissionDirectorState): void {
    const guide = state.step?.guide;
    const guideBuildingId = guide?.action.buildingId ?? null;
    const highlight = missionGuideHighlight(
      state,
      this.selection.selectedStructure()?.stats.id ?? null,
      guideBuildingId === null ? 0 : this.completedPlayerBuildings(guideBuildingId),
    );
    this.buildPalette.setMissionHighlight(highlight.paletteTarget);
    this.selectionPanel.setMissionHighlight(highlight.actionId);
    this.missionPanel?.setGuidePrompt(
      highlight.prompt === null
        ? null
        : highlight.prompt.kind === "draw-road"
          ? `${this.buildingLabels.get(guideBuildingId ?? "") ?? "Yapı"} kuruldu ama bağlı değil — Yol aracıyla Merkez'in yoluna bağla.`
          : `Önce ${this.buildingLabels.get(highlight.prompt.buildingId) ?? highlight.prompt.buildingId} yapısını seç.`,
    );
    this.syncMissionMarker(highlight.prompt, guideBuildingId);
  }

  /**
   * Ring the building the player has to act on — and nothing else.
   *
   * The ring answers exactly one question: *which* building on the map. That is
   * a question the panel cannot answer, because the panel is not open yet
   * ("select your Market") or because the map holds several buildings and only
   * one of them is missing its road. Both point at something that already
   * exists; neither is a suggestion about ground.
   *
   * No search, no timer, no cache: the answer is a building's position, so it is
   * looked up on the frame it is needed.
   */
  private syncMissionMarker(
    prompt: ReturnType<typeof missionGuideHighlight>["prompt"],
    guideBuildingId: string | null,
  ): void {
    if (!this.missionHint) return;
    this.missionMarker = prompt === null
      ? null
      : this.playerBuildingPosition(prompt.kind === "select-building" ? prompt.buildingId : guideBuildingId);
    this.missionHint.setTarget(
      this.missionMarker,
      this.missionMarker ? this.groundSurface.heightAt(this.missionMarker.x, this.missionMarker.z) : 0,
    );
    this.missionPanel?.setShowTargetAvailable(this.missionMarker !== null);
  }

  /** One place, both queues: the Centre's workers and the Barracks' soldiers. */
  private tallyTrainedUnit(role: string): void {
    this.playerUnitsTrained[role] = (this.playerUnitsTrained[role] ?? 0) + 1;
  }

  private completedPlayerBuildings(buildingId: string): number {
    return this.structures.ownedBy(PLAYER_OWNER)
      .filter((structure) => structure.stats.id === buildingId && structure.construction.complete).length;
  }

  /**
   * Where the player's own building of this type stands. The centre is not a
   * `PlacedStructure` — it has its own system — so it is looked up there, which
   * is also what makes "select your Centre" point at the right thing.
   */
  private playerBuildingPosition(buildingId: string | null): { readonly x: number; readonly z: number } | null {
    if (buildingId === null) return null;
    if (buildingId === "command_center") {
      const center = this.centers.get(PLAYER_OWNER);
      return center ? { x: center.position.x, z: center.position.z } : null;
    }
    const owned = this.structures.ownedBy(PLAYER_OWNER)
      .find((structure) => structure.stats.id === buildingId && structure.construction.complete);
    return owned ? { x: owned.x, z: owned.z } : null;
  }

  /**
   * The story tur's build pacing (§12.5), applied at the player's palette and
   * nowhere else. Returns the refusal to show, or null to let the click through.
   */
  private missionBuildRefusal(buildingId: string): MissionBuildRefusal | null {
    const step = this.missions?.state().step ?? null;
    if (!step) return null;
    const owned = this.structures.ownedBy(PLAYER_OWNER).filter((structure) => structure.stats.id === buildingId);
    const verdict = missionBuildVerdict({
      buildingId,
      step,
      completed: owned.filter((structure) => structure.construction.complete).length,
      pending: owned.filter((structure) => !structure.construction.complete).length,
    });
    return verdict.allowed ? null : verdict.refusal;
  }

  /**
   * Arm or refuse a placement, with the refusal said out loud.
   *
   * A silent refusal would be the worst of both: the player clicks the pulsing
   * button, nothing happens, and the pacing rule reads as a broken UI.
   */
  /**
   * The second mission gate runs again at confirmation time. The selected
   * building can have become unavailable while its preview was following the
   * pointer, so a refused confirmation disarms the tool and says why.
   */
  private confirmMissionGatedPlacement(x: number, y: number): void {
    const buildingId = this.placement.state().activeBuildingId;
    if (buildingId !== null && !this.beginMissionGatedPlacement(buildingId)) {
      this.placement.cancel();
      this.syncPlacementUi();
      return;
    }
    this.placement.confirmAt(x, y);
    this.syncPlacementUi();
  }

  private beginMissionGatedPlacement(buildingId: string): boolean {
    const refusal = this.missionBuildRefusal(buildingId);
    if (refusal === null) return true;
    const label = this.buildingLabels.get(buildingId) ?? buildingId;
    this.buildPalette.setActionMessage(
      refusal === "already-building"
        ? `${label} zaten inşa ediliyor — bitmesini bekle.`
        : `Bu görev için bir ${label} yeterli.`,
    );
    return false;
  }

  /**
   * The world as a mission goal sees it: the two narrow fact lists
   * `missionPredicates.ts` declares, and nothing else. Producer facts come
   * straight from the logistics graph the selection panel already reads, so an
   * objective and the panel explaining it can never disagree about whether a
   * farm is linked.
   */
  /** Whether a story chain is live — the only state the escape hatch applies to. */
  private missionRunning(): boolean {
    const missions = this.missions;
    return missions !== null && !missions.state().finished;
  }

  /**
   * "Serbest oyuna çevir": end the chain, keep the match. Reports it once so the
   * card vanishing is explained rather than merely noticed, and tells the host so
   * the offer is not re-made on the player's next tab.
   */
  private abandonMission(): void {
    if (!this.missions?.abandon()) return;
    this.missionPanel?.setState(null);
    // Abandoning happens from the pause menu, where `updateMissions` has already
    // returned early — so the pointers have to be taken down here rather than
    // waiting for a frame that will not come until the player unpauses.
    this.syncMissionGuide(this.missions.state());
    this.options.onMissionResolved?.();
    this.notifications.post({
      kind: "mission",
      subject: "abandoned",
      text: "Görev zinciri kapatıldı. Maç serbest devam ediyor.",
    });
  }

  private missionWorldSnapshot(): MissionWorldSnapshot {
    const population = this.playerKingdom.population.snapshot();
    return {
      structures: this.structures.all().map((structure) => ({
        owner: structure.owner,
        buildingId: structure.stats.id,
        complete: structure.construction.complete,
        // Only asked of a structure that projects control, which is the only
        // kind the notion means anything for — and the same call the territory
        // system already makes to decide that structure's radius, so an
        // objective and the control area on screen can never disagree.
        ...(structure.stats.territory
          ? { roadConnected: this.outpostConnectedToMainRoad(structure) }
          : {}),
      })),
      producers: this.productionLogistics.snapshots(),
      units: this.units.all().map((unit) => ({ owner: unit.owner, role: unit.role })),
      tier: this.progression.tierFor(PLAYER_OWNER),
      populationHeadroom: Math.max(0, population.capacity - population.used),
      razedEnemyBuildings: this.razedEnemyBuildings,
      marketTrades: this.playerMarketTrades,
      marketPurchases: this.playerMarketPurchases,
      unitsTrained: this.playerUnitsTrained,
    };
  }

  /**
   * Parse every effect the match can reach, once, at boot.
   *
   * Derived from the tables rather than listed here, so an author who assigns a
   * newly imported effect gets it warmed without touching code. A ref that no
   * longer resolves is not fatal — `playWorldEffect` still retries, and one dead
   * slot must not cost the match its other VFX.
   */
  private warmStructureDamageEffects(): void {
    const effectIds = new Set<string>();
    // The guns' bursts warm even where there is no content catalog: they are
    // named in `balance/units.json`, which every match has, and a first shell
    // that had to wait on IO would land well before its explosion did.
    for (const stats of Object.values(this.options.unitBalance)) {
      if (stats.impactEffect) effectIds.add(stats.impactEffect);
    }
    const catalog = this.options.contentCatalog;
    if (catalog) {
      for (const buildingId of Object.keys(this.options.buildingBalance)) {
        const presentation = rtsBuildingDamagePresentation(catalog, buildingId);
        for (const slot of RTS_DAMAGE_SLOTS) {
          for (const effectId of presentation.slots[slot].effects) effectIds.add(effectId);
        }
      }
    }
    void Promise.all([...effectIds].map((effectId) => this.structureDamageVfx.warm(effectId)));
  }

  /** The authored damage presentation for this building, or null with no catalog. */
  private structureDamagePresentation(structure: PlacedStructure): RtsDamagePresentation | null {
    const catalog = this.options.contentCatalog;
    return catalog ? rtsBuildingDamagePresentation(catalog, structure.stats.id) : null;
  }

  /** Fires a repeating slot's single rotated effect; one-shot slots use `playSlotBurst`. */
  private playSlotRotation(structure: PlacedStructure, slot: RtsDamageSlot, rotationKey: number): void {
    if (slot.effects.length === 0) return;
    // Keyed by structure rather than by trigger, so one building's debris stays
    // the same debris for its whole life instead of flickering between presets.
    const effectId = slot.effects[rotationKey % slot.effects.length];
    if (effectId) this.playWorldEffect(effectId, this.slotPosition(structure, slot));
  }

  /** A one-shot slot is a composed burst: every effect it names fires together. */
  private playSlotBurst(structure: PlacedStructure, slot: RtsDamageSlot): void {
    const position = this.slotPosition(structure, slot);
    for (const effectId of slot.effects) this.playWorldEffect(effectId, position);
  }

  /** Restarts the slots a health stage owns, so a threshold reads immediately. */
  private onStructureDamageStageChanged(structure: PlacedStructure, stage: StructureDamageStage): void {
    const presentation = this.structureDamagePresentation(structure);
    for (const slot of RTS_DAMAGE_SLOTS) this.structureSlotElapsed.delete(slotTimerKey(structure.id, slot));
    if (!presentation || !structure.construction.complete) return;
    if (stage !== "light" && stage !== "heavy") return;
    for (const slotName of STAGE_SLOTS[stage]) {
      this.structureSlotElapsed.set(slotTimerKey(structure.id, slotName), 0);
      this.playSlotRotation(structure, presentation.slots[slotName], structure.id);
    }
  }

  /**
   * Shed debris because something hit this building.
   *
   * Throttled on the authored `minIntervalSeconds` floor rather than played per
   * blow: a building under fire from a whole army takes a hit every few frames,
   * and one burst per hit would drown the effect budget in debris the player
   * cannot read as individual impacts anyway.
   */
  private onStructureImpact(structure: PlacedStructure): void {
    const presentation = this.structureDamagePresentation(structure);
    if (!presentation) return;
    const slot = presentation.slots.impactDebris;
    if (slot.effects.length === 0) return;
    const last = this.structureImpactAt.get(structure.id);
    const floor = slot.minIntervalSeconds ?? 0;
    if (last !== undefined && this.structureVfxClock - last < floor) return;
    this.structureImpactAt.set(structure.id, this.structureVfxClock);
    this.playSlotRotation(structure, slot, structure.id);
  }

  /** A collapse has already left gameplay; this is presentation only. */
  private onStructureCollapse(structure: PlacedStructure): void {
    for (const slot of RTS_DAMAGE_SLOTS) this.structureSlotElapsed.delete(slotTimerKey(structure.id, slot));
    const presentation = this.structureDamagePresentation(structure);
    if (!presentation) return;
    this.playSlotBurst(structure, presentation.slots.collapseDust);
    this.playSlotBurst(structure, presentation.slots.collapseDebris);
    // The husk outlives the record, so its trailing smoke has to be captured now:
    // nothing can resolve this id back to a building on a later frame.
    const ruinSmoke = presentation.slots.ruinSmoke;
    if (ruinSmoke.effects.length === 0) return;
    const position = this.slotPosition(structure, ruinSmoke);
    this.structureRuinSmoke.set(structure.id, {
      position,
      effects: ruinSmoke.effects,
      intervalSeconds: ruinSmoke.intervalSeconds ?? 1,
      rotationKey: structure.id,
      elapsed: 0,
    });
    this.playSlotRotation(structure, ruinSmoke, structure.id);
  }

  /** Keeps damage VFX sparse and frame-rate independent, at the authored intervals. */
  private updateStructureDamageVfx(dt: number): void {
    this.structureDamageVfx.advance(dt);
    this.structureVfxClock += Math.max(0, dt);
    const live = new Set<string>();
    const liveIds = new Set<number>();
    for (const structure of this.structures.all()) {
      // Collected before the filters below: an impact throttle belongs to a
      // building that exists, not to one that happens to be damaged right now.
      liveIds.add(structure.id);
      if (!structure.construction.complete) continue;
      const stage = structureDamageStage(structure.health.ratio);
      if (stage !== "light" && stage !== "heavy") continue;
      const presentation = this.structureDamagePresentation(structure);
      if (!presentation) continue;
      for (const slotName of STAGE_SLOTS[stage]) {
        const slot = presentation.slots[slotName];
        const interval = slot.intervalSeconds;
        if (slot.effects.length === 0 || interval === undefined) continue;
        const key = slotTimerKey(structure.id, slotName);
        live.add(key);
        const elapsed = (this.structureSlotElapsed.get(key) ?? 0) + Math.max(0, dt);
        if (elapsed >= interval) {
          this.playSlotRotation(structure, slot, structure.id);
          this.structureSlotElapsed.set(key, elapsed % interval);
        } else {
          this.structureSlotElapsed.set(key, elapsed);
        }
      }
    }
    for (const key of this.structureSlotElapsed.keys()) {
      if (!live.has(key)) this.structureSlotElapsed.delete(key);
    }
    // A match reset drops live buildings without a collapse, so `onRuinCleared`
    // cannot be the only thing that ends an impact throttle.
    for (const id of this.structureImpactAt.keys()) {
      if (!liveIds.has(id)) this.structureImpactAt.delete(id);
    }
    // Not reconciled against `structures.all()` like the loop above: these
    // buildings are gone from the simulation by definition. `onRuinCleared` is
    // the only thing that ends an entry.
    for (const smoke of this.structureRuinSmoke.values()) {
      smoke.elapsed += Math.max(0, dt);
      if (smoke.elapsed < smoke.intervalSeconds) continue;
      smoke.elapsed %= smoke.intervalSeconds;
      const effectId = smoke.effects[smoke.rotationKey % smoke.effects.length];
      if (effectId) this.playWorldEffect(effectId, smoke.position);
    }
  }

  /** Plays a warmed effect without ever making a gameplay event wait on IO. */
  private playWorldEffect(effectId: string, position: [number, number, number]): void {
    if (this.structureDamageVfx.play(effectId, { position }) !== null) return;
    // An early hit before the match-start warm finished should still be visible;
    // retry once the cached definition settles, without blocking the frame.
    void this.structureDamageVfx.warm(effectId).then((definition) => {
      if (definition && !this.disposed) {
        this.structureDamageVfx.play(effectId, { position });
      }
    });
  }

  /**
   * Load the debris models an effect's renderer names.
   *
   * The former hand-written URL allowlist is gone: an id resolves when it is a
   * manifested `staticMesh` and not otherwise. That is the same guarantee the
   * allowlist gave — a VFX asset can never name an arbitrary path or URL — but it
   * no longer costs a code change per imported model, which is the whole point of
   * moving the assignment into the table.
   */
  private async loadStructureDamageModels(modelIds: readonly string[]): Promise<readonly Object3D[]> {
    const models = await Promise.all(modelIds.map(async (id): Promise<Object3D | null> => {
      const path = this.actorVisuals?.staticMeshAssetPath(id);
      if (!path) return null;
      try {
        return (await this.structureDamageModelLoader.load(id, projectFileUrl(path))).scene;
      } catch {
        return null;
      }
    }));
    return models.filter((model): model is Object3D => model !== null);
  }

  /**
   * Resolve a slot's anchor to a world position.
   *
   * The mode is derived from the footprint rather than authored in world units so
   * one table entry stays right for a 2x2 house and a 6x6 depot; the offset on
   * top of it is the author's own nudge.
   */
  private slotPosition(structure: PlacedStructure, slot: RtsDamageSlot): [number, number, number] {
    const roofHeight = Math.max(
      1.2,
      Math.min(4, Math.max(structure.stats.footprint.width, structure.stats.footprint.depth) * 0.42),
    );
    const base = slot.anchor.mode === "roof"
      ? roofHeight
      : slot.anchor.mode === "center"
        ? roofHeight / 2
        : 0;
    const [dx, dy, dz] = slot.anchor.offset;
    return [structure.x + dx, structure.groundY + base + dy, structure.z + dz];
  }

  private updateWorldProgressOverlay(): void {
    const trainingSeconds = this.options.unitBalance[PLACEHOLDER_WORKER_ID]?.trainingSeconds ?? 1;
    const entries: RtsWorldProgressEntry[] = this.structures.all()
      // Own sites only. This bar answers "how far along is my build" — the two
      // entries below it are already player-scoped — but it carried no owner
      // filter, so it drew the enemy's construction progress as well. That was a
      // leak before §59 and a hard one after: the overlay is screen-space DOM,
      // so hiding the building's scene object does nothing to the label floating
      // above it, and the enemy's build timings stayed legible through the fog.
      .filter((structure) => structure.owner === PLAYER_OWNER)
      .filter((structure) => !structure.construction.complete)
      .map((structure) => ({
        id: `construction-${structure.id}`,
        x: structure.x,
        y: 8,
        z: structure.z,
        progress: structure.construction.progress,
        label: `İnşa %${Math.floor(structure.construction.progress * 100)}`,
      }));
    const center = this.centers.get(PLAYER_OWNER);
    const age = this.progression.snapshot(PLAYER_OWNER);
    const queue = this.workerProduction.queueSnapshot(PLAYER_OWNER);
    if (center && queue.trainingRemainingSeconds !== null) {
      const duration = center.workerTrainingSeconds ?? trainingSeconds;
      entries.push({
        id: "player-worker-production",
        x: center.position.x,
        y: 9,
        z: center.position.z,
        progress: 1 - Math.min(1, queue.trainingRemainingSeconds / duration),
        // Only the Town transition pauses this queue. Ordinary centre level-ups
        // leave worker production running, so their world label must not claim
        // the active order was suspended.
        label: age.upgrading && age.upgradeKind === "town"
          ? `İşçi duraklatıldı · ${queue.queued}/${queue.capacity}`
          : `İşçi üretiliyor · ${queue.queued}/${queue.capacity}`,
      });
    }
    for (const structure of this.structures.all()) {
      // Production is the player's own business: what the enemy is training and
      // how far along it is stays behind the same ownership boundary construction
      // progress does, because the overlay is screen-space DOM and hiding the
      // building's scene object does nothing to a label floating above it.
      if (structure.owner === PLAYER_OWNER) {
        const queue = this.barracksProduction.queueSnapshot(structure);
        if (structure.construction.complete && queue.trainingRemainingSeconds !== null && queue.trainingDurationSeconds !== null) {
          entries.push({
            id: `military-production-${structure.id}`,
            x: structure.x,
            y: 8.5,
            z: structure.z,
            progress: 1 - Math.min(1, queue.trainingRemainingSeconds / queue.trainingDurationSeconds),
            label: `${queue.trainingLabel ?? "Asker"} üretiliyor · ${queue.queued}/${queue.capacity}`,
          });
        }
      }
      // Centre-led progression has no per-building upgrade bar: the level and age
      // ladder is the kingdom's, shown once on the centre below, not on each
      // building (plan §5 — the world progress bar lives only on the Merkez).
      //
      // Health is the one bar that is *not* an ownership question. Below full
      // health it is up — the rule units already live under (`HealthBar.set`
      // hides itself at ratio 1) — for whoever the player can currently see.
      // On their own buildings it says which ones are waiting for a repair crew;
      // on the enemy's it answers the question an attack is actually asking,
      // "will this wall fall before my ram dies". Gated on live visibility rather
      // than ownership, so it leaks nothing the player is not already looking at.
      const health = this.structureHealthEntry(
        structure,
        `structure-health-${structure.id}`,
        structure.x,
        8.5,
        structure.z,
      );
      if (health) entries.push(health);
    }
    for (const other of this.centers.all()) {
      const centerHealth = this.structureHealthEntry(
        other,
        `command-center-health-${other.owner}`,
        other.position.x,
        // The player's own centre shares its airspace with the worker queue and
        // the progression bar; the enemy's has neither above it.
        other.owner !== PLAYER_OWNER ? 9 : age.upgrading ? 7 : queue.trainingRemainingSeconds !== null ? 7.5 : 9,
        other.position.z,
      );
      if (centerHealth) entries.push(centerHealth);
    }
    // Centre-led progression is the longest thing the player ever waits on and
    // the only one with no field presence but the selection panel — which is
    // closed whenever they are doing anything else. One bar covers both the level
    // ladder and the age transition, and they are mutually exclusive by nature.
    if (center && age.upgrading && age.nextAction) {
      const duration = age.nextAction.durationSeconds;
      const label = age.upgradeKind === "town"
        ? `${this.options.ageBalance.town.label} Çağı · ${Math.ceil(age.remainingSeconds)} sn`
        : `${this.tierLabel(age.nextAction.targetAge, age.nextAction.targetLevel)} · ${Math.ceil(age.remainingSeconds)} sn`;
      entries.push({
        id: "player-center-progression",
        x: center.position.x,
        y: 11,
        z: center.position.z,
        progress: duration > 0 ? 1 - Math.min(1, age.remainingSeconds / duration) : 0,
        label,
      });
    }
    this.worldProgressOverlay.update(this.cameraController.camera, this.canvas.clientWidth, this.canvas.clientHeight, entries);
  }

  /**
   * One damaged building's world health bar, or null when it does not warrant
   * one. Shared by placed structures and command centres, which live in separate
   * registries but are the same thing to a player watching a wall come down.
   *
   * The hostile case carries a "Düşman" prefix instead of a colour of its own:
   * the fill already encodes *how hurt* the building is (healthy/warning/
   * critical), and overloading that same fill with *whose* it is would cost the
   * reading the tone exists for. During a siege both sets of bars are on screen
   * at once, so which is which has to be legible without decoding a hue.
   */
  private structureHealthEntry(
    target: { readonly owner: UnitOwner; readonly health: HealthComponent },
    id: string,
    x: number,
    y: number,
    z: number,
  ): RtsWorldProgressEntry | null {
    const { health, owner } = target;
    if (health.depleted || health.ratio >= 1) return null;
    // An enemy building is shown only while the player can actually see it. Own
    // buildings never consult vision: they carry their own sight, and a fog bug
    // must not be able to blind the player to their own base being razed.
    if (owner !== PLAYER_OWNER && !(this.vision?.isVisible(PLAYER_OWNER, x, z) ?? true)) return null;
    const current = Math.ceil(health.current);
    const max = Math.ceil(health.max);
    return {
      id,
      x,
      y,
      z,
      progress: health.ratio,
      label: owner === PLAYER_OWNER ? `Can ${current}/${max}` : `Düşman · ${current}/${max}`,
      variant: "health",
      healthTone: health.ratio >= 0.6 ? "healthy" : health.ratio >= 0.3 ? "warning" : "critical",
    };
  }


  /**
   * Drain this frame's edge-triggered orders. Attack-move needs a map position,
   * so it uses the live pointer — the same place a right-click would have read.
   */
  private consumeCommandInput(): void {
    // Drained before the unit orders: pause is about the match, not the
    // selection, and it must answer even when the simulation is frozen.
    if (this.input.consumeCommand("pause")) {
      // Escape means "undo the thing I am in the middle of", and an open capture
      // is the innermost of those. Handled here rather than with a key listener
      // of its own so it cannot race the pause it would otherwise stack on top of.
      if (this.debugTableModal?.open) this.closeDebugTable();
      else this.togglePause();
    }
    if (this.input.consumeCommand("focusCenter")) this.focusCameraOnCenter();
    if (this.input.consumeCommand("toggleBuildPalette")) this.buildPalette.toggleVisible();
    if (this.input.consumeCommand("buildCategory1")) this.buildPalette.selectCategoryByIndex(0);
    if (this.input.consumeCommand("buildCategory2")) this.buildPalette.selectCategoryByIndex(1);
    if (this.input.consumeCommand("buildCategory3")) this.buildPalette.selectCategoryByIndex(2);
    if (this.input.consumeCommand("buildCategory4")) this.buildPalette.selectCategoryByIndex(3);
    if (this.input.consumeStopRequest()) this.commands.issueStop();
    if (this.input.consumeCommand("hold")) this.commands.issueStance("hold");
    if (this.input.consumeCommand("aggressive")) this.commands.issueStance("aggressive");
    if (this.input.consumeCommand("selectIdleWorkers")) this.selectIdleWorkers();
    if (this.input.consumeCommand("assignIdleWorkers")) this.assignSelectedIdleWorkers();
    if (!this.input.consumeCommand("attackMove")) return;
    const pointer = this.input.pointerPosition();
    if (pointer) this.commands.issueAttackMoveAt(pointer.x, pointer.y);
  }

  /**
   * Snap the camera focus onto the player's own centre (Home).
   *
   * Focus only — zoom is left where the player put it, because this answers
   * "where am I" and not "how close am I". A destroyed centre falls back to the
   * opening focus rather than doing nothing: the key is pressed by somebody who
   * is lost, and a silent no-op at the exact moment the base burned down reads
   * as a broken key rather than as an answer.
   */
  private focusCameraOnCenter(): void {
    const center = this.centers.get(PLAYER_OWNER);
    if (center) this.cameraController.setFocus(center.position.x, center.position.z);
    else this.cameraController.setFocus(this.openingFocus.x, this.openingFocus.z);
  }

  /**
   * Every damageable thing on the field, for target acquisition.
   *
   * Wildlife enters this list by **state, never by species** (V3 §3.4): a
   * predator that is hunting somebody, or one standing on a kingdom's ground.
   * `nearestHostile` compares owners alone and an animal is `"wild"`, so a
   * roster-wide entry would make every grazing deer hostile to both kingdoms —
   * half the army would break off a raid to chase venison. Both states are ones
   * an animal walks out of again; a Guard already trading blows with one keeps
   * its own target, which is how a started fight finishes rather than being
   * called off mid-swing.
   */
  private combatTargets() {
    return [
      ...this.units.all(),
      ...this.centers.all(),
      ...this.structures.all(),
      ...this.predators.hostile(),
      // A donkey is only offered while it is actually travelling and the other
      // kingdom can see it. This mirrors the predator's state-gated target list:
      // an army does not peel away from its fight to chase a loading caravan in
      // fog, but an ambush on a road it controls is a real tactical choice.
      ...this.caravans.all().filter((caravan) => this.isCaravanAttackable(caravan)),
    ];
  }

  private isCaravanAttackable(caravan: Caravan): boolean {
    if (caravan.health.depleted || caravan.dying) return false;
    if (caravan.phase !== "outbound" && caravan.phase !== "inbound") return false;
    const observer = caravan.owner === PLAYER_OWNER ? AI_OWNER : PLAYER_OWNER;
    return this.vision?.isVisible(observer, caravan.position.x, caravan.position.z) ?? true;
  }

  /**
   * A caravan's load is a property of the producer it serves, not a global
   * donkey tuning. This reads the live age × level economy row, so upgrades
   * immediately raise the next trip's threshold without respawning the animal.
   */
  private caravanDispatch(producerStructureId: number): CaravanDispatch | null {
    const producer = this.economyProduction?.snapshots()
      .find((snapshot) => snapshot.structureId === producerStructureId);
    if (!producer) return null;
    const wallet = this.kingdoms.get(producer.owner).wallet;
    const canReceive = this.resourceCapacity.availableFor(
      producer.owner,
      producer.resourceId,
      wallet.amount(producer.resourceId),
    ) > 0;
    const carryCapacity = Math.max(1, producer.maximumProductionPerMinute);
    return {
      carryCapacity,
      canReceive,
      // A partial trip is allowed only when the producer has truly stopped:
      // a full buffer or a spent source. An idle/arriving worker has not made a
      // shipment yet, so its donkey remains visibly parked.
      ready: canReceive
        && producer.localBuffer > 0
        && (producer.localBuffer >= carryCapacity
          || producer.status === "buffer-full"
          || !producerHasSource(producer.status)),
    };
  }

  private commitRallyPoint(x: number, y: number): void {
    const point = this.commands.groundPointAt(x, y);
    this.rallyPointPending = false;
    if (!point) {
      // Still a mode prompt rather than a result: the click missed the ground, so
      // the palette line keeps asking for the one it is waiting on.
      this.buildPalette.setActionMessage("Toplanma noktası için harita üzerinde bir konum seçin.");
      return;
    }
    this.barracksProduction.setRallyPoint(PLAYER_OWNER, point);
    this.commandMarkers.spawn(point, "#8fe08f");
    this.buildPalette.setActionMessage(null);
    this.announce("orders", "Toplanma noktası belirlendi.");
  }

  /** Advance match systems; camera and UI keep the unscaled rendered-frame delta. */
  private updateSimulation(dt: number): void {
    // Aged on the same step as the systems below, which is what makes it a
    // simulation clock rather than a stopwatch: it scales with §38's speed and
    // stops on pause because it is only ever ticked from here (§53).
    const progressionMark = this.perfMark();
    this.clock.advance(dt);
    this.kingdoms.advance(dt);
    // Centre-led progression: one event stream for level-ups and the Town
    // transition alike. On completion every one of the owner's completed
    // structures — the centre included — has already been re-tiered atomically by
    // the system; here we re-skin them into the new tier and refresh territory.
    for (const event of this.progression.update(dt)) {
      const isPlayer = event.owner === PLAYER_OWNER;
      const tierLabel = this.tierLabel(event.age, event.level);
      if (event.type === "completed") {
        for (const structure of event.structures) this.applyUpgradedVisual(structure);
        this.territory.refresh();
        // Faz 5: promote the road paint to the new age's layer (dirt→cobblestone
        // at Town) in one repaint. Topology/logistics are untouched — only the
        // painted layer changes; a no-op when the age's layer is unchanged.
        //
        // Driven for *whichever* kingdom aged up, not only the player's: roads
        // take the age of the kingdom whose ground they cross, so promoting them
        // all on the player's transition is what used to cobble the enemy's.
        if (this.roadPainter) {
          this.roadPainter.setLayer(event.owner, this.roadLayerForAge(event.age));
          this.syncRoadVisuals();
        }
        if (isPlayer) this.placement.refreshPreview();
      }
      // §51 wants the AI's age-up called out; only the Town event marks it, since
      // a level-up is not a milestone the player needs warning about.
      if (!isPlayer) {
        if (event.type === "completed" && event.kind === "town") {
          this.notifications.post({
            kind: "enemy-age-upgraded",
            text: `Düşman ${this.options.ageBalance.town.label} Çağına geçti.`,
          });
        }
        continue;
      }
      if (event.type === "completed") {
        this.notifications.post({
          kind: "age-upgraded",
          text: event.kind === "town"
            ? `${this.options.ageBalance.town.label} Çağı tamamlandı: tüm yapılarınız ${tierLabel} oldu.`
            : `${tierLabel} tamamlandı: tüm yapılarınız gelişti.`,
        });
      }
      // A completed upgrade already has its own `age-upgraded` notice above; only
      // the cancellation needs saying here, and it is not the player's doing.
      if (event.type !== "completed") {
        this.announce("progression", "Merkez yıkıldığı için ilerleme iptal edildi; kaynaklar iade edildi.", "refused");
      }
    }
    this.perfMeasure("ilerleme", progressionMark);
    // Acquisition before movement: a unit that picks up a target this tick
    // should start walking toward it on the same tick, not the next one.
    const movementMark = this.perfMark();
    updateUnitEngagement(this.units.all(), {
      navigation: this.navigation,
      targets: this.combatTargets(),
    });
    updateUnitMovement(this.units.all(), dt, { navigation: this.navigation });
    // Moving bodies pass through one another. When an order ends, settle a real
    // idle overlap once instead of continuously pushing the whole stopped group.
    settleStoppedUnitOverlaps(this.units.all(), this.navigation);
    this.perfMeasure("birim hareketi", movementMark);
    // Wildlife moves on the simulation delta like every other body, so the
    // game-speed control carries it too. Deliberately *not* a navigation
    // agent and deliberately not a nav blocker: a herd is scenery that can be
    // hunted, and paying for pathfinding per animal per frame would be the
    // most expensive way to solve the least important problem.
    // Every body on the field frightens game, not just the hunter who claimed
    // it: a herd that scattered for its assigned hunter and ignored an army
    // walking through it would read as scenery with one scripted reaction.
    // Ahead of the herd's own tick so a lead set this frame moves the animal this
    // frame: the shepherd's position has just been updated above, and a drive that
    // aimed at where he stood last tick would trail a step behind all the way home.
    const wildlifeMark = this.perfMark();
    this.pasture.update(dt);
    // V3 Faz 3, and ahead of the herd's tick for the same reason the drive is: a
    // quarry chosen this frame has to move the wolf this frame, or every chase
    // trails one step behind the worker it is aimed at.
    const predatorStrikes = this.predators.update(dt);
    for (const strike of predatorStrikes) {
      // V3 Faz 4, closing V1 §3.9's debt. Every other blow in the match reaches
      // `resolveCombatHit` and gets a defensive answer out of it; the wolf's does
      // not, because `updateUnitCombat` never landed it. So the call is made here
      // instead — a mauled worker turns on the wolf exactly as he turns on a
      // raider, rather than being eaten without ever reacting. He still never
      // *picks* the fight: `updateUnitEngagement` skips workers outright, so this
      // is the one door into it and it only opens on a hit already taken.
      retaliateAgainstAttack(strike.victim, strike.predator, this.navigation);
      this.ai.reportPredatorStrike(strike);
    }
    // And the garrison answers it. Run every tick rather than only on a bite,
    // because half of what it does is the walk back to the post once the wolf
    // is dead. Owner-agnostic: the AI's workers are covered by the AI's
    // soldiers on the same terms, with no AI-side code.
    this.predatorResponse.update(predatorStrikes);
    this.wildlife.update(dt, this.units.all().map((unit) => unit.position));
    // Last of the three, and it has to be: a blow lands on whoever is *still*
    // standing over the animal after both of them have moved this frame. A bull
    // struck at the top of the tick would be hitting last frame's contact.
    this.wildlifeRetaliation.update(dt);
    this.perfMeasure("hayvanlar", wildlifeMark);
    const constructionMark = this.perfMark();
    this.workerConstruction.update(dt);
    // Settle repair jobs whose building was razed or demolished since the last
    // tick; an untouched job is refunded here exactly as a cancelled one is.
    this.structureRepair.update(this.structures.all());
    this.perfMeasure("inşaat", constructionMark);
    const productionMark = this.perfMark();
    this.economyProduction?.update(dt);
    // Faz S2: the trade sites fill their own buffers. Ticked beside the
    // producers because that is what they are — a facility with an output rate
    // and a local buffer — and since Faz S3 their goods reach a market the same
    // way a producer's reach the stockpile: down a road, on a donkey.
    this.tradeSites.update(dt);
    this.syncForestVisibility();
    this.perfMeasure("üretim", productionMark);
    // Simulation owns the route state; the animation itself advances above on
    // rendered time, so the speed picker cannot change its playback rate.
    //
    // One arrival stream, two receivers: each recognises its own lane prefix and
    // ignores the other's, which is what keeps a producer's load going to the
    // wallet and a trade site's to the market shelf (supply plan §3.4).
    const logisticsMark = this.perfMark();
    const arrivals = this.caravans.update(dt);
    this.logisticsTransfers.update(arrivals);
    this.marketSupply.deliver(arrivals);
    this.perfMeasure("lojistik", logisticsMark);
    // Only the human kingdom's production is narrated; the AI's own queue events
    // are surfaced by its decision log in a later slice.
    const trainingMark = this.perfMark();
    for (const event of this.workerProduction.update(dt)) {
      if (event.owner !== PLAYER_OWNER) continue;
      if (event.type === "completed") {
        this.tallyTrainedUnit("worker");
        this.announce("production", "Yeni işçi Merkez'den çıktı.");
      } else this.announce("production", "İşçi çıkışı engelli; Merkez çevresini açın.", "refused");
    }
    for (const event of this.barracksProduction.update(dt)) {
      if (event.structure.owner !== PLAYER_OWNER) continue;
      if (event.type === "completed") {
        const role = this.options.unitBalance[event.unitId]?.role;
        if (role) this.tallyTrainedUnit(role);
        // "<yapı>: <birlik> hazır." rather than "<birlik> <yapı>'ndan çıktı.":
        // the ablative `-ndan` is only correct for a label that already ends in
        // a possessive ("Okçuluk Alanı'ndan"), and wrong for one that does not
        // ("Kışla'dan"). Kışla trains the Guard and the Siege gun, so two of the
        // three trainable units said it wrong.
        this.announce("production", `${event.structure.stats.label}: ${event.label} hazır.`);
      } else {
        this.announce("production", `${event.label} çıkışı engelli; ${event.structure.stats.label} çevresini açın.`, "refused");
      }
    }
    this.perfMeasure("eğitim kuyruğu", trainingMark);
    // The AI decides on the same scaled match delta as every other system, so
    // the game-speed control accelerates it too (plan §38 test mode).
    const aiMark = this.perfMark();
    this.ai.update(dt);
    this.perfMeasure("ai", aiMark);
    const hudMark = this.perfMark();
    this.syncHudBar();
    this.syncAgeUi();
    this.syncEconomyUi();
    this.syncNotifications();
    this.announcePeaceWindow();
    this.perfMeasure("hud eşitleme", hudMark);
    // Before any blow lands this tick: a unit standing in a Tapınak's field must
    // already be protected when it is hit, not from the tick after. The same
    // pass mends units and clears the protection of everyone who left a field.
    const combatMark = this.perfMark();
    this.supportAuras.update(this.structures.all(), this.units.all(), dt);
    // Shells fired on an earlier tick land first, so a wall that is about to be
    // finished off by one is already rubble before this tick's guns pick targets.
    this.pendingImpacts.update(dt, (hit) => this.resolveCombatHit(hit));
    // The shell's flight also runs on the simulation delta, not the rendered
    // one: it is carrying a blow now, and the two must arrive together at any
    // game speed — and neither may advance while the match is paused.
    this.cannonballs.update(dt);
    updateUnitCombat(
      this.units.all(),
      dt,
      (hit) => this.resolveCombatHit(hit),
      {
        onShot: (shot) => this.launchShot(shot),
        impacts: this.pendingImpacts,
      },
    );
    this.structureDefense.update(this.structures.all(), this.combatTargets(), dt, (shot) => {
      // The Town-age Karakol fires the Topçu's gun rather than its bow, so it
      // gets the Topçu's presentation whole: a lobbed ball, an authored blast
      // where it lands, and — through the flight time returned here — a blow
      // that waits for both.
      if (shot.defense.attackVfx === "cannonball") {
        return this.cannonballs.spawn(
          shot.attacker.position,
          combatImpactPoint(shot.attacker.position, shot.target),
          shot.defense.impactEffect ?? null,
          TOWER_MUZZLE_HEIGHT,
        );
      }
      // A completed Karakol is two Archer attacks at once. Offset the two
      // tracers very slightly so the volley reads as two arrows rather than one.
      this.projectiles.spawn(
        shot.attacker.owner,
        shot.attacker.position,
        shot.target.position,
        TOWER_MUZZLE_HEIGHT,
        shot.shotIndex === 0 ? -0.14 : 0.14,
      );
      return 0;
    });
    updateUnitDeaths(this.units, this.selection, dt);
    this.destroyRuinedStructures();
    this.perfMeasure("savaş", combatMark);
    // §59, before the objectives below and before anything reads the AI: fog is
    // the lens every other system's enemy reads pass through this tick, so it
    // has to be current first. It runs after the deaths/demolitions above for
    // the same reason §58 does — a dead scout stops revealing on the tick it
    // dies, not the tick after.
    const visionMark = this.perfMark();
    this.updateFogOfWar();
    this.perfMeasure("görüş", visionMark);
    // §58, after the deaths and demolitions this tick: a point whose holding
    // outpost just fell has already stopped being held by the time it is scored.
    const victoryMark = this.perfMark();
    this.updateRegionalVictory(dt);
    const outcome = this.match.update(this.centers);
    // Resolved second, so a centre razed on the same tick keeps the more
    // specific reason — `resolveRegionalControl` is a no-op on a decided match.
    const regional = this.match.resolveRegionalControl(this.regionalVictory?.winner() ?? null);
    this.perfMeasure("zafer koşulu", victoryMark);
    if (this.match.outcome !== "active" && (outcome !== "active" || regional)) {
      this.log.info(`Match ended: ${this.match.outcome} (${this.match.reason})`);
      this.showMatchResult();
    }
  }

  /**
   * Show a weapon going off and say how long its shot needs to arrive.
   *
   * Everything but the artillery answers `0` — a sword lands where it swings and
   * an arrow's tracer is decoration over a blow that has already been struck.
   * The Topçu's shell is the exception: its damage waits in
   * {@link pendingImpacts} for exactly the flight time returned here, so the
   * building takes the hit when the ball reaches it rather than when the gun
   * fires.
   */
  private launchShot(shot: CombatShot): number {
    const attackVfx = shot.attacker.stats.structureAttackVfx;
    // The Topçu's shot *is* a lobbed iron ball, so it replaces the arrow tracer
    // rather than joining it — and it lands on a soldier as readily as on a
    // wall, which is why this one is not gated on the target class.
    if (attackVfx === "cannonball") {
      // Off the barrel's tip when the Actor marks one, so the ball appears where
      // the smoke would be rather than out of the carriage's axle. A gun whose
      // art marks no muzzle keeps the old behaviour whole: its own position, and
      // the projectile system's default launch height.
      const muzzle = shot.attacker.muzzleWorldPosition(this.scratchMuzzle);
      return this.cannonballs.spawn(
        muzzle ?? shot.attacker.position,
        combatImpactPoint(shot.attacker.position, shot.target),
        // The blast belongs to the gun, not to what it hit: the same shell is
        // the same explosion on a wall and on a soldier.
        shot.attacker.stats.impactEffect ?? null,
        // The muzzle's world position already *is* the launch height.
        muzzle ? 0 : undefined,
      );
    }
    if (shot.ranged) {
      this.projectiles.spawn(shot.attacker.owner, shot.attacker.position, shot.target.position);
    }
    // A Guard's blow against a building is thrown fire, not a swing: same
    // point-blank attack and same damage, shown as an attempt to burn the
    // structure down (`structureAttackVfx` in balance/units.json).
    if (attackVfx === "firebrand" && shot.target.armorClass === "structure") {
      this.firebrands.spawn(shot.attacker.position, structureImpactPoint(shot.attacker.position, shot.target));
    }
    return 0;
  }

  /**
   * A blow that has actually landed — whether it was struck this tick or fired
   * a second ago and only now arrived. Everything downstream of damage hangs
   * here so a delayed shell provokes the same response as an instant one.
   */
  private resolveCombatHit(hit: CombatHit): void {
    this.debugWitness?.recordHit(hit);
    if (hit.target instanceof Caravan && hit.change.depleted && hit.target.beginDeath()) {
      this.units.clearAttackTargets(hit.target);
      if (hit.target.owner === PLAYER_OWNER) {
        this.notifications.post({
          kind: "caravan-destroyed",
          subject: hit.target.id,
          text: "Kervan vuruldu: taşıdığı yük kayboldu.",
        });
      }
    }
    if (hit.target instanceof Unit) {
      retaliateAgainstAttack(hit.target, hit.attacker, this.navigation);
    }
  }

  /**
   * §59: refresh the vision grid, reconcile each kingdom's memory, then push the
   * result to the three view layers.
   *
   * Order is load-bearing. Memory asks vision what is visible, the ghost view
   * asks memory what is remembered, and the visibility binder asks vision what
   * to hide — running these in any other order shows the player one frame of
   * last tick's world.
   */
  private updateFogOfWar(): void {
    const vision = this.vision;
    if (!vision) return;
    vision.refresh();
    this.enemyMemory?.refresh(this.clock.seconds);
    this.fogView?.refresh();
    this.ghostStructures?.refresh();
    this.fogVisibility?.refresh();
  }

  /**
   * §59/GDD 08 §41: every unit and structure reveals for its own kingdom.
   *
   * Construction sites count from placement rather than completion — an
   * unfinished building the enemy could walk up to unseen would be a blind spot
   * inside one's own base — which is why this reads `structures.all()` without
   * a `construction.complete` gate.
   */
  private collectVisionSources(): readonly VisionSource[] {
    const sources: VisionSource[] = [];
    for (const unit of this.units.all()) {
      if (unit.health.depleted) continue;
      sources.push({
        owner: unit.owner,
        x: unit.position.x,
        z: unit.position.z,
        radius: unit.stats.visionRadius,
      });
    }
    for (const structure of this.structures.all()) {
      if (structure.health.depleted) continue;
      sources.push({
        owner: structure.owner,
        x: structure.x,
        z: structure.z,
        radius: structure.stats.visionRadius,
      });
    }
    for (const center of this.centers.all()) {
      if (center.health.depleted) continue;
      sources.push({
        owner: center.owner,
        x: center.position.x,
        z: center.position.z,
        radius: this.options.buildingBalance["command_center"]?.visionRadius ?? 0,
      });
    }
    return sources;
  }

  /** The structure feed §40's memory reconciles against, centres included. */
  private collectObservableStructures(): readonly ObservableStructure[] {
    const observable: ObservableStructure[] = [];
    for (const structure of this.structures.all()) {
      if (structure.health.depleted) continue;
      observable.push({
        id: structure.id,
        owner: structure.owner,
        buildingId: structure.stats.id,
        x: structure.x,
        z: structure.z,
        groundY: structure.groundY,
        level: structure.level,
        age: this.ageOf(structure.owner),
        footprintWidth: structure.stats.footprint.width,
        footprintDepth: structure.stats.footprint.depth,
        healthRatio: structure.health.ratio,
      });
    }
    for (const center of this.centers.all()) {
      if (center.health.depleted) continue;
      observable.push({
        id: commandCenterMemoryId(center.owner),
        owner: center.owner,
        buildingId: "command_center",
        x: center.position.x,
        z: center.position.z,
        groundY: center.groundY,
        // The centre's own level, so a remembered one is the art the observer
        // saw rather than a permanent level 1.
        level: center.level,
        age: this.ageOf(center.owner),
        // The visual footprint, not the nav one: this feeds the ghost renderer,
        // which has to fit what `applyToCenter` fitted the live centre to.
        footprintWidth: COMMAND_CENTER_VISUAL_FOOTPRINT,
        footprintDepth: COMMAND_CENTER_VISUAL_FOOTPRINT,
        healthRatio: center.health.ratio,
      });
    }
    return observable;
  }

  /**
   * §58: recount the objectives, age the counters, and warn.
   *
   * The warning is a notification while the tracker is a panel, and the split is
   * deliberate: the panel answers "what is the state" continuously, the notice
   * fires once when the state becomes the player's problem.
   * {@link RtsNotificationCenter} de-duplicates by kind, so posting on every tick
   * inside the window raises one notice, not hundreds.
   */
  private updateRegionalVictory(dt: number): void {
    const points = this.strategicPoints;
    const victory = this.regionalVictory;
    if (!points || !victory) return;
    points.refresh();
    victory.advance(dt);
    this.strategicPointView?.setStatuses(points.all());
    this.objectiveTracker?.setState({ points: points.all(), progress: victory.all() });
    if (victory.warning(AI_OWNER)) {
      this.notifications.post({
        kind: "regional-victory-warning",
        text: `Düşman stratejik geçitleri tutuyor: ${formatMatchDuration(victory.progressFor(AI_OWNER).remainingSeconds)} kaldı.`,
      });
    }
  }

  /** §58: the read-only view of the objective race the AI's army acts on. */
  private aiObjectiveWatch(): AiObjectiveWatch | null {
    const points = this.strategicPoints;
    const victory = this.regionalVictory;
    if (!points || !victory) return null;
    return {
      // The *player's* counter is the one the AI has to answer; its own counter
      // climbing is not a reason to send the army anywhere.
      urgent: victory.warning(PLAYER_OWNER),
      contestable: points.all()
        .filter((status) => status.holder === PLAYER_OWNER)
        .map((status) => ({
          id: status.point.id,
          name: status.point.name,
          x: status.point.x,
          z: status.point.z,
        })),
    };
  }

  /**
   * Faz 5.1: a destroyed footprint frees ground and can shrink a control area,
   * and both are cached — every other system reconciles against the live
   * structure list on its own tick.
   */
  private destroyRuinedStructures(): void {
    let territoryChanged = false;
    const destroyed = updateStructureDestruction(this.structures, (structure) => {
      if (structure.stats.territory) territoryChanged = true;
      // Tallied here rather than by a mission-side observer: this callback is
      // the one place a depleted structure is removed, so a count taken here
      // cannot miss a path the way a set of call sites can.
      if (structure.owner !== PLAYER_OWNER) {
        const id = structure.stats.id;
        this.razedEnemyBuildings[id] = (this.razedEnemyBuildings[id] ?? 0) + 1;
      }
      this.log.info(`${structure.stats.label} destroyed (${structure.owner})`);
    });
    if (destroyed.length === 0) return;
    if (territoryChanged) this.territory.refresh();
    this.selection.reconcileStructures(this.structures.all());
    this.refreshNavigationBlockers();
  }

  /** P4 uses live source state without moving source ownership out of the Level. */
  private settlementSourceAvailable(sourceId: string): boolean {
    if (sourceId.startsWith("node:")) {
      const id = sourceId.slice("node:".length);
      return this.resourceNodes.snapshots().some((node) => node.id === id && !node.depleted);
    }
    if (sourceId.startsWith("forest:")) {
      const forestId = sourceId.slice("forest:".length);
      return this.forests.snapshots().some((tree) => tree.forestId === forestId && !tree.depleted);
    }
    if (sourceId.startsWith("herd:")) {
      const herdId = sourceId.slice("herd:".length);
      return this.wildlife.snapshots().some((animal) => animal.herdId === herdId
        && !animal.dead && animal.remainingMeat > 0 && animal.owner === null);
    }
    return true;
  }

  /**
   * When raiders close on the base, planned sites nearer them and farther from
   * the command centre lose the tie-break. The original seed order remains when
   * no player army is threatening this base.
   */
  private settlementThreatPenalty(x: number, z: number): number {
    const threats = this.units.armyOf(PLAYER_OWNER).filter((unit) => !unit.health.depleted);
    const nearest = threats.reduce((distance, unit) => Math.min(distance,
      Math.hypot(unit.position.x - x, unit.position.z - z)), Number.POSITIVE_INFINITY);
    const threatRadius = 24;
    if (nearest >= threatRadius) return 0;
    const outerDistance = Math.hypot(x - this.spatial.enemyStart.x, z - this.spatial.enemyStart.z);
    return (threatRadius - nearest) * 100 + outerDistance * 2;
  }

  private spawnCenters(): void {
    // Faz 5.1: every structure's durability is data now, the centre included, so
    // there is one place to tune a match's length rather than two.
    const stats = this.options.buildingBalance["command_center"] ?? null;
    const maxHealth = stats?.maxHealth ?? COMMAND_CENTER_MAX_HEALTH;
    const playerCenter = this.centers.spawn(
      "player",
      this.spatial.playerStart.x,
      this.spatial.playerStart.z,
      maxHealth,
      stats,
      this.groundSurface.heightAt(this.spatial.playerStart.x, this.spatial.playerStart.z),
    );
    const enemyCenter = this.centers.spawn(
      "enemy",
      this.spatial.enemyStart.x,
      this.spatial.enemyStart.z,
      maxHealth,
      stats,
      this.groundSurface.heightAt(this.spatial.enemyStart.x, this.spatial.enemyStart.z),
    );
    // Settlement Lv1 tier values (worker queue capacity today) before any research.
    for (const center of this.centers.all()) this.progression.applyToStructure(center);
    this.buildingVisuals.applyToCenter(playerCenter, this.ageOf(playerCenter.owner));
    this.buildingVisuals.applyToCenter(enemyCenter, this.ageOf(enemyCenter.owner));
  }

  /** Seed a free all-sides road loop around each command centre at match start. */
  private seedCenterAccessRoads(): void {
    for (const center of this.centers.all()) {
      this.roads.commit(centerAccessRoadPlan(this.roads, {
        x: center.position.x,
        z: center.position.z,
        footprint: center.stats.footprint,
      }));
    }
    this.syncRoadVisuals();
  }

  /**
   * Worker queue size for a kingdom's centre. The active age × level tier owns
   * it; the hard-coded ladder remains only for a centre spawned without balance
   * data, which has no tiers to read.
   */
  private workerQueueCapacity(owner: UnitOwner): number {
    const center = this.centers.get(owner);
    return center?.queueCapacity ?? workerQueueCapacityForCenterLevel(center?.level ?? 1);
  }

  /** The art family a kingdom's buildings currently belong to (Settlement/Town). */
  private ageOf(owner: UnitOwner) {
    return this.progression.tierFor(owner).age;
  }

  /** Player-facing name of one tier, e.g. "Yerleşim Lv2" / "Kasaba Lv1". */
  private tierLabel(age: SettlementAge, level: number): string {
    const ageLabel = age === "town"
      ? this.options.ageBalance.town.label
      : this.options.ageBalance.settlement.label;
    return `${ageLabel} Lv${level}`;
  }

  /**
   * Re-skin one levelled building. The centre and a placed structure hold their
   * model in different places, so the level-up sweep — which now covers both —
   * routes through here rather than assuming a {@link PlacedStructure}.
   */
  private applyUpgradedVisual(structure: UpgradableStructure): void {
    if (structure instanceof CommandCenter) {
      this.buildingVisuals.applyToCenter(structure, this.ageOf(structure.owner));
      return;
    }
    this.applyStructureVisual(structure as PlacedStructure);
  }

  private applyStructureVisual(structure: PlacedStructure, animate = false): void {
    const visual = this.buildingVisuals.createForStructure(structure, this.ageOf(structure.owner));
    if (!visual) return;
    if (animate) this.structures.setCompletedVisualWithDrop(structure, visual);
    else this.structures.setCompletedVisual(structure, visual);
  }

  private applyConstructionVisual(structure: PlacedStructure): void {
    const visual = this.buildingVisuals.createConstructionVisual(
      structure,
      this.ageOf(structure.owner),
      this.progression.tierFor(structure.owner).level,
    );
    if (visual) this.structures.setConstructionVisual(structure, visual);
  }

  private async loadMapArt(blockout: import("three").Group): Promise<void> {
    // One step rather than a count: `mapArt.apply` is a single opaque await, so
    // the honest thing the bar can say about it is "started" and "done". It
    // carries a small weight for exactly that reason.
    this.loadTracker.report("mapArt", 0, 1);
    try {
      // Faz E ridge gate: when the Level authors its own static world, the ridge
      // comes from that (mounted by loadAuthoredWorld). Map art still owns the
      // forest and the external-resource landmark, so only the ridge steps aside.
      await this.mapArt.apply(blockout, this.forests, this.resourceNodes, {
        includeRidge: !this.authoredWorldIntended,
      });
      // §59/GDD 08 §39: resource deposits, ridges and trees must not be readable
      // in ground the player has never scouted. Registered here rather than at
      // construction because the art loads asynchronously — at construction time
      // there is nothing to hide yet.
      this.fogMask?.apply(collectWorldProps(blockout));
      // The art arrives after setup's fog pass, and on the start screen there is
      // no simulation tick coming to catch it up — so the newly built props and
      // forest get their first fog pass here, or they would render unfogged
      // until the player pressed "Maçı Başlat".
      this.updateFogOfWar();
      this.syncForestVisibility();
      this.canvas.dataset.rtsMapArt = "ready";
    } catch (error) {
      this.log.warn("RTS map art could not be loaded", error);
      this.canvas.dataset.rtsMapArt = "fallback";
    } finally {
      this.settleAssetTrack("mapArt");
    }
  }

  /**
   * Faz E: mount the Level's authored static world (instances + lights).
   *
   * On success the authored subtree joins the scene, its directional sun retires
   * the code sun, and the blockout's placeholder ridge box is removed so the
   * authored ridge stands alone. On failure everything falls back: the code sun
   * still lights the field and the placeholder ridge remains, so a bad/missing
   * asset never leaves an unplayable dark or ridge-less map.
   */
  private async loadAuthoredWorld(layout: RoomLayout): Promise<void> {
    try {
      const handle = await loadRtsAuthoredWorld(
        layout,
        this.renderer,
        (message, error) => this.log.warn(message, error),
        this.options.levelRef,
        (loaded, total) => this.loadTracker.report("world", loaded, total),
        riverReflectionQuality(rtsGraphicsQuality(this.userSettings.graphics.selectedQualityLevel)),
      );
      if (this.disposed) {
        handle.dispose();
        return;
      }
      this.authoredWorld = handle;
      this.scene.add(handle.root);
      this.canvas.dataset.rtsAuthoredSlotMaterials = String(handle.staticSlotMaterialCount);
      this.canvas.dataset.rtsAuthoredUvwMappings = String(handle.staticUvwMappingCount);
      this.canvas.dataset.rtsAuthoredMeshPaint = String(handle.meshPaintedPlacementCount);
      const landscapeSamplerBudget = handle.landscapes[0]?.object.userData.landscapeSamplerBudget as
        | LandscapeSamplerBudget
        | undefined;
      if (landscapeSamplerBudget) {
        this.canvas.dataset.rtsLandscapePbr = landscapeSamplerBudget.pbrEnabled ? "full" : "albedo-only";
        this.canvas.dataset.rtsLandscapeSamplers =
          `${landscapeSamplerBudget.requiredTextureUnits}/${landscapeSamplerBudget.availableTextureUnits ?? "unknown"}`;
      }
      // §59/GDD 08 §39: every model the Level authors falls under the fog, with
      // no game code naming it. This is the whole answer to "I placed a prop in
      // the editor and it was visible on ground I had never scouted" — the fog
      // used to cover exactly one hard-coded group, so a new placement was
      // unfogged by construction rather than by oversight.
      //
      // The mask starts fully unknown (`FogView` fills its texture before the
      // first refresh), so the world is never drawn unfogged for even one frame,
      // and it cuts per fragment — a backdrop mountain that straddles the
      // frontier is drawn up to it rather than waiting to arrive whole.
      this.fogMask?.apply(handle.staticInstanceMeshes);
      // The world arrives after setup's fog pass, and on the start screen there
      // is no simulation tick coming to catch it up — the same reason the map
      // art does this a few lines into its own loader.
      this.updateFogOfWar();
      // Retire the code sun only now that a real authored directional light exists.
      if (this.codeSun && levelHasAuthoredSun(layout)) {
        this.scene.remove(this.codeSun);
        this.codeSun.dispose();
        this.codeSun = null;
      }
      // Authored lights arrive asynchronously, after the initial profile was
      // applied to the fallback sun. Bring their shadow maps under the same
      // live profile before the first authored-world frame is shown.
      this.applyQualitySettings(this.qualitySettings);
      // Editor↔Runtime parity (Faz 1): apply the Level's authored environment
      // singletons through the shared layer so Play matches the editor viewport —
      // the Sky Atmosphere dome, its Sky Light (IBL) bounce, Exponential Height Fog
      // and the Cloud Layer. A Level authoring none of these leaves the RTS look
      // unchanged (each apply is a no-op / clears to the default).
      this.environment.applySky(layout);
      this.environment.applyReflection(layout, true);
      this.applyAuthoredPostProcess(layout);
      this.environment.applyFog(layout);
      this.environment.applyClouds(layout);
      // Editor↔Runtime parity: hand the ambient fill and the background over to the
      // Level's World Settings — the same call `RuntimeSceneApp` makes, so what the
      // World Settings panel shows in the viewport is what the match renders.
      //
      // The ambient is *not* retired when the Level authors a Sky Light. Forge adds
      // the two (World Settings fill + sky IBL bounce) and the editor viewport shows
      // them added, so retiring one here would make the panel lie about the result.
      // A Level that wants sky bounce alone says so by authoring `ambientIntensity: 0`,
      // which drops the light entirely.
      this.codeAmbient = applySceneBackgroundAndAmbient({
        scene: this.scene,
        ambientLight: this.codeAmbient,
        settings: resolveSceneWorldSettings(layout),
        ambientName: "rts-world-ambient",
      });
      // Retire the flat placeholder ground only once an authored Landscape has
      // actually mounted — a terrain now covers the field, and the two overlapping
      // at y=0 would z-fight. A Landscape-less world (or a failed load) keeps it.
      if (handle.landscapeCount > 0) {
        this.retireFlatGround();
        this.mountGroundSurface(handle);
        this.setupRoadPainter(handle);
      }
      // The blockout still drew a placeholder ridge box from the marker blocker;
      // remove it so it does not sit under the authored ridge mesh. Only when the
      // Level is also the spatial authority: if adaptation failed we fell back to
      // the blockout's own ridge blocker, and deleting its box would leave an
      // invisible wall across the middle of the map.
      const placeholder = this.options.level ? this.scene.getObjectByName("rts-central-ridge") : null;
      if (placeholder instanceof Mesh) {
        placeholder.removeFromParent();
        placeholder.geometry.dispose();
        for (const material of Array.isArray(placeholder.material) ? placeholder.material : [placeholder.material]) {
          material.dispose();
        }
      }
      // Last, once the whole world is standing — terrain, roads, props, sky — so
      // the probes capture what the player will actually see reflected.
      this.buildAuthoredReflectionCaptures(layout, handle);
      this.canvas.dataset.rtsAuthoredWorld = "ready";
    } catch (error) {
      this.log.warn("RTS authored world could not be loaded", error);
      this.canvas.dataset.rtsAuthoredWorld = "fallback";
    } finally {
      // In `finally` so the fallback path opens the curtain too: a Level that
      // failed to mount leaves the flat ground standing, and the player is
      // better off looking at it than at a bar that never fills.
      this.settleAssetTrack("world");
    }
  }

  /**
   * Editor↔Runtime parity: bakes the Level's Sphere Reflection Captures and routes
   * the authored statics they cover onto the probe's envMap, so a polished prop
   * mirrors the sky in the match exactly as it does in the editor viewport after a
   * Recapture. Static and one-shot at load, like the editor's bake — nothing here
   * runs per frame, and a Level placing no probes pays nothing.
   *
   * Two things are taken off the world for the duration of the capture. Fog of war
   * starts *fully unknown*, so a cubemap rendered at this moment would store a
   * black map and every probe-covered surface would reflect a void; the mask is a
   * uniform (`setEnabled`, no recompile) and the fog surface is one group, so both
   * come off and go straight back. This is the RTS's version of the editor hiding
   * its gizmos and helpers before baking.
   */
  private buildAuthoredReflectionCaptures(layout: RoomLayout, handle: AuthoredWorldHandle): void {
    const captures = layout.reflectionCaptures ?? [];
    this.canvas.dataset.rtsReflectionCaptures = "0";
    if (captures.length === 0) return;
    const fogRoot = this.fogView?.root ?? null;
    const fogRootVisible = fogRoot?.visible ?? false;
    this.fogMask?.setEnabled(false);
    if (fogRoot) fogRoot.visible = false;
    try {
      for (const actor of captures) {
        const resolved = resolveSphereReflectionCapture(actor);
        if (resolved.hidden) continue;
        this.reflectionCaptureBakes.push(
          bakeSphereReflectionCapture(this.renderer, this.scene, {
            ...resolved,
            position: [...actor.position],
            rotation: readRotation(actor),
          }),
        );
      }
    } finally {
      if (fogRoot) fogRoot.visible = fogRootVisible;
      this.fogMask?.setEnabled(true);
    }
    this.canvas.dataset.rtsReflectionCaptures = String(this.reflectionCaptureBakes.length);
    if (this.reflectionCaptureBakes.length === 0) return;
    this.applyReflectionCaptureEnvMaps(handle);
  }

  /**
   * Hands each covered authored static mesh the probe's envMap.
   *
   * Where {@link RuntimeSceneApp} re-splits its instance groups so every single
   * placement can take its own nearest probe, this assigns **per batched mesh** and
   * only when *every* instance in it resolves to the same probe. That is the whole
   * design: an RTS map draws its art as a few big `InstancedMesh` batches, and
   * splitting one so that six trees inside a probe get their own material would
   * trade the batching this route is built on for a reflection nobody looks at. A
   * mesh whose instances disagree — or that reaches outside every probe — keeps the
   * global sky environment, which is the correct fallback rather than a compromise.
   * A distinctly-placed prop (the case probes are actually placed for) is its own
   * one-instance batch, so it takes the probe.
   *
   * The fog mask is *not* re-applied to the clones: `assignProbeEnvMapMaterial`
   * forwards the base material's own `onBeforeCompile` — the mask patch — ahead of
   * the capture patch, so the clone is already masked. Patching it a second time
   * would inject the mask GLSL twice. Shadows are untouched either way, since the
   * masked depth material hangs off the mesh, not off its material.
   */
  private applyReflectionCaptureEnvMaps(handle: AuthoredWorldHandle): void {
    const probes: ReflectionCaptureProbe[] = this.reflectionCaptureBakes.map((bake) => ({
      position: bake.position,
      radius: bake.radius,
      priority: bake.priority,
    }));
    const globalEnv = this.scene.environment;
    const globalEnvIntensity = this.scene.environmentIntensity;
    const matrix = new Matrix4();
    const point = new Vector3();
    for (const mesh of handle.staticInstanceMeshes) {
      const bake = this.sharedProbeForInstancedMesh(mesh, probes, matrix, point);
      if (!bake) continue;
      applyProbeEnvMapToObject(mesh, bake, globalEnv, globalEnvIntensity);
      this.reflectionCaptureMeshes.push(mesh);
    }
  }

  /**
   * The one probe covering every instance of `mesh`, or null when they disagree or
   * any of them falls outside all probes. Instances are tested at their origin
   * rather than their bounds centre — a probe radius is authored in whole world
   * units and the difference is a fraction of one.
   *
   * The map-wide batches this walks (thousands of trees) bail on the first
   * uncovered instance, so the common no-probe-nearby case costs one test.
   */
  private sharedProbeForInstancedMesh(
    mesh: InstancedMesh,
    probes: readonly ReflectionCaptureProbe[],
    matrix: Matrix4,
    point: Vector3,
  ): SphereReflectionCaptureBake | null {
    mesh.updateWorldMatrix(true, false);
    let shared: number | null = null;
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);
      const probe = selectNearestReflectionCapture([point.x, point.y, point.z], probes);
      if (probe === null) return null;
      if (shared === null) shared = probe;
      else if (shared !== probe) return null;
    }
    return shared === null ? null : (this.reflectionCaptureBakes[shared] ?? null);
  }

  /**
   * Editor↔Runtime parity (Faz 3): builds the authored Post Process composer (SMAA
   * + bloom + tone mapping) from the Level's postProcess actor. The RTS route has no
   * quality profiles, so the authored effects apply directly (ungated). A Level with
   * no postProcess — or one with only tone mapping and no effect passes — leaves the
   * pipeline null and the render loop draws straight through the renderer as before.
   */
  private applyAuthoredPostProcess(layout: RoomLayout): void {
    const actor = layout.postProcess ?? null;
    const authored = actor ? resolvePostProcess(actor) : null;
    const resolved = authored ? applyQualityToPostProcess(authored, this.qualitySettings) : null;
    applyPostProcessToneMapping(this.renderer, resolved);
    this.environment.applySkyPostProcessExposure(resolved, layout);
    if (!hasPostProcessEffectPasses(resolved)) {
      this.postProcessPipeline?.dispose();
      this.postProcessPipeline = null;
      return;
    }
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.postProcessPipeline ??= new PostProcessPipeline({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.cameraController.camera,
      width,
      height,
    });
    this.postProcessPipeline.setEffectPasses(
      createPostProcessEffectPasses(resolved, {
        scene: this.scene,
        camera: this.cameraController.camera,
        width,
        height,
        bloomResolutionScale: this.qualitySettings.bloomResolutionScale,
      }),
    );
    this.postProcessPipeline.setAntialiasPass(
      createPostProcessAntialiasPass(resolved, { width, height }),
    );
  }

  /**
   * Removes and frees the flat placeholder ground (plane + grid) once an authored
   * Landscape has taken over. Picking is unaffected: command/placement/road all
   * raycast a mathematical y=0 plane, not this mesh, so the V1 flat-ground contract
   * holds without the visual plane standing under the terrain.
   */
  private retireFlatGround(): void {
    const ground = this.groundGroup;
    if (!ground) return;
    this.groundGroup = null;
    this.canvas.dataset.rtsGround = "landscape";
    ground.removeFromParent();
    ground.traverse((child) => {
      if (child instanceof Mesh || child instanceof GridHelper) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          material.dispose();
        }
      }
    });
  }

  /**
   * Painted Roads (plan Faz 3): once a terrain mounts, hand the road look to the
   * Landscape paint. The box-mesh render steps aside (painted mode), and whatever
   * is already committed — a resumed match, an AI's early road — is painted at
   * once. A Landscape-less field never reaches here, so it keeps the box tiles.
   */
  private setupRoadPainter(handle: AuthoredWorldHandle): void {
    const terrain = handle.landscapes[0];
    if (!terrain) return;
    this.roadPainter = new RoadTerrainPainter(
      terrain,
      this.options.roadBalance.cellSize,
      this.options.roadBalance.visual,
      this.options.roadBalance.buildingPad,
    );
    this.roadPlacement.setPaintedMode(true);
    this.canvas.dataset.rtsRoads = "painted";
    // Start each kingdom on the layer for its own current age (settlement →
    // dirt), which also covers a resumed match where one side is already Town.
    for (const center of this.centers.all()) {
      this.roadPainter.setLayer(center.owner, this.roadLayerForAge(this.ageOf(center.owner)));
    }
    // Centres already stand when the terrain mounts, so their pads come with the
    // first paint rather than one building later.
    this.syncStructurePads();
  }

  /**
   * A Landscape can finish loading after the match's centres and opening units
   * were created. Re-sample their foundation heights once, then hand the same
   * ground source to every pointer-facing RTS tool.
   */
  private mountGroundSurface(handle: AuthoredWorldHandle): void {
    const terrain = handle.landscapes[0];
    if (!terrain) return;
    this.groundSurface = new RtsDeckGroundSurface(
      new AuthoredRtsGroundSurface(terrain),
      this.spatial.walkableDecks,
    );
    this.commands.setGroundSurface(this.groundSurface);
    this.placement.setGroundSurface(this.groundSurface);
    this.roadPlacement.setGroundSurface(this.groundSurface);
    this.territory.setGroundHeightSampler((x, z) => this.groundSurface.heightAt(x, z));
    // §59: the fog surface is draped over the same ground as the territory
    // overlay. Without this it stays the flat quad it is built as, and any
    // landscape taller than the overlay clearance simply stands through it.
    this.fogView?.setGroundHeightSampler((x, z) => this.groundSurface.heightAt(x, z));
    for (const center of this.centers.all()) {
      center.groundY = this.groundSurface.heightAt(center.position.x, center.position.z);
      center.object.position.y = center.groundY;
    }
    for (const structure of this.structures.all()) {
      structure.groundY = this.groundSurface.heightAt(structure.x, structure.z);
      structure.object.position.y = structure.groundY;
    }
    this.syncUnitsToGround();
  }

  /**
   * Building ground pads: the terrain under every standing building is cleared to
   * the pad layer, the same way a road paints its corridor — a building on bare
   * grass reads as dropped onto the field. Presentation only: this mirrors the
   * building systems and never writes footprints, navigation or territory back.
   *
   * The revision is the sum of the two building systems' monotonic counters, so
   * any place/cancel/destroy/clear on either side moves it and the pad list is
   * rebuilt exactly once per change. The repaint itself is the road painter's,
   * because a landscape has a single pristine snapshot to restore against.
   *
   * The authored trade-site docks ride in the same list. They never change, so
   * they cost nothing after the first rebuild, and they need to be here rather
   * than painted once at mount because the painter restores to its pristine
   * snapshot on every repaint — a dock painted outside this list would be wiped
   * by the next road the player lays.
   */
  private syncStructurePads(): void {
    const painter = this.roadPainter;
    if (!painter) return;
    painter.setStructurePads(this.structures.version + this.centers.version, () => [
      // Paint only: the ground under an authored site stays at the level's own
      // elevation, or the scenery standing on it would come off the terrain.
      ...this.tradeSites.dockFootprints().map((dock) => ({
        x: dock.x,
        z: dock.z,
        width: dock.width,
        depth: dock.depth,
        flatten: false,
      })),
      ...this.centers.all().map((center) => ({
        x: center.position.x,
        z: center.position.z,
        width: center.stats.footprint.width,
        depth: center.stats.footprint.depth,
        groundY: center.groundY,
      })),
      ...this.structures.all().map((structure) => ({
        x: structure.x,
        z: structure.z,
        width: structure.stats.footprint.width,
        depth: structure.stats.footprint.depth,
        groundY: structure.groundY,
      })),
    ]);
    painter.sync(this.roads.all(), this.roads.version, this.roads.ownershipVersion);
  }

  /**
   * RTS pathfinding deliberately remains X/Z-only; this is the one visual
   * grounding pass that makes every unit follow the authored heightfield without
   * changing navigation or the editor-authored blocking-volume contract.
   */
  private syncUnitsToGround(): void {
    for (const unit of this.units.all()) {
      unit.position.y = this.groundSurface.heightAt(unit.position.x, unit.position.z);
    }
    // Wildlife rides the same surface. It roams in 2D and never asks the
    // navigation grid anything, so without this a herd grazes at y = 0 and
    // sinks into (or floats over) any authored landscape.
    for (const animal of this.wildlife.all()) {
      animal.position.y = this.groundSurface.heightAt(animal.position.x, animal.position.z);
    }
    for (const caravan of this.caravans.all()) {
      caravan.position.y = this.groundSurface.heightAt(caravan.position.x, caravan.position.z);
    }
  }

  /**
   * The paint layer roads use at a given age (Painted Roads Faz 5). Centre-led
   * progression promotes the *look* only — same topology, a richer layer
   * (settlement → dirt, town → cobblestone). Unmapped ages fall back to the
   * default layer, so a data gap degrades to the dirt path, never to nothing.
   */
  private roadLayerForAge(age: SettlementAge): string {
    const visual = this.options.roadBalance.visual;
    return visual.ageLayers?.[age] ?? visual.layerId;
  }

  /**
   * The one road-visual refresh, driven by every committed topology change
   * (player or AI) through {@link RoadConstructionService}'s commit hook. Box
   * tiles rebuild in mesh mode (a no-op in painted mode); the terrain repaints
   * when a painter is mounted, dirty-checked on `RoadGraph.version`.
   */
  private syncRoadVisuals(): void {
    this.roadPlacement.renderNetwork();
    this.roadPainter?.sync(this.roads.all(), this.roads.version, this.roads.ownershipVersion);
  }

  /** Defer a road commit's presentation effects while its structure pad is prepared. */
  private beginRoadCommitBatch(): void {
    this.roadCommitBatchDepth += 1;
  }

  /**
   * Flush a deferred road commit. With mounted terrain, `syncStructurePads` has
   * already rendered the current graph and new pad together; mesh-road fallback
   * still needs its normal network refresh.
   */
  private endRoadCommitBatch(terrainAlreadySynced: boolean): void {
    this.roadCommitBatchDepth = Math.max(0, this.roadCommitBatchDepth - 1);
    if (this.roadCommitBatchDepth > 0 || !this.roadCommitEffectsPending) return;
    this.roadCommitEffectsPending = false;
    if (!terrainAlreadySynced) this.syncRoadVisuals();
    this.territory.refresh();
  }

  /** Handles player and AI road changes; only structure placement batches it. */
  private onRoadTopologyCommitted(): void {
    if (this.roadCommitBatchDepth > 0) {
      this.roadCommitEffectsPending = true;
      return;
    }
    this.syncRoadVisuals();
    // A committed road can link an outpost to its main network, which grows
    // that outpost's control radius. This lives on the service rather than the
    // pointer handler so an AI-built road refreshes territory too.
    this.territory.refresh();
  }

  /**
   * §59: tree visibility, through the forest's own single writer.
   *
   * Shared by the simulation tick and the two setup paths so all three apply the
   * identical rule — the predicate is `undefined` while the flag is off, which is
   * what keeps a fogless build's forest exactly as it was.
   */
  private syncForestVisibility(): void {
    const isExplored = this.vision
      ? (x: number, z: number) => this.vision!.isExplored(PLAYER_OWNER, x, z)
      : undefined;
    this.mapArt.syncForest(this.forests, isExplored);
    // Deposits follow the identical rule (depleted or unscouted), so they are
    // refreshed by the same three callers rather than a parallel schedule.
    this.mapArt.syncResourceNodes(this.resourceNodes, isExplored);
    // Faz S6, and a third caller of the same predicate. These boxes are never
    // drawn, so this is not a visual act at all: it is what decides whether a
    // site can be *clicked*, and so what stops a player picking black ground and
    // reading a port's name, owner and rate out of it. The site's art is already
    // cut by the fog mask on the same explored alpha; this covers the one
    // surface a pixel mask cannot, because a pick has no pixels.
    this.tradeSiteView.syncExplored(isExplored);
  }

  /**
   * §59: what the player's kingdom can see *right now*, or `undefined` while the
   * fog flag is off.
   *
   * The moving half of {@link syncForestVisibility}'s rule. Wildlife reads this
   * one rather than `isExplored` for the same reason enemy units do: a remembered
   * animal is a claim about where something is, and the herd left that spot.
   */
  private playerVisibilityTest(): ((x: number, z: number) => boolean) | undefined {
    return this.vision ? (x, z) => this.vision!.isVisible(PLAYER_OWNER, x, z) : undefined;
  }

  /**
   * §51: let the simulation run.
   *
   * This used to be the start card's button handler, and most of it was the
   * machinery for a choice made *after* the app was built: if the card asked for
   * a rule this app had not been constructed with, it handed the choice back to
   * the host and the host reloaded the page. All of that went with plan F2 — the
   * menu now runs before construction, so by the time this is reached every
   * choice is already baked in and there is nothing left to reconcile. §13's
   * "flags are read-only once resolved" holds by construction rather than by a
   * reload.
   */
  private readonly beginMatch = (): void => {
    if (!this.flow.begin()) return;
    this.matchOverlay.hide();
    this.log.info("RTS match started");
  };

  private readonly resumeMatch = (): void => {
    if (!this.flow.resume()) return;
    this.matchOverlay.hide();
  };

  /**
   * "Ana Menü": hand the route back to the host, which disposes this app and
   * re-opens the menu.
   *
   * Deliberately not `this.dispose()`. The call arrives from a click listener on
   * an overlay this app owns, and disposing mid-listener would delete the element
   * the event is still being dispatched on. The host resolves a promise instead,
   * so the teardown happens one microtask later, on an empty stack.
   *
   * Unconfirmed, like "Yeniden Başlat" and unlike "Teslim Ol": both throw the
   * current match away, and neither writes a defeat into the record.
   */
  private readonly exitToMenu = (): void => {
    this.log.info("Leaving the match for the main menu");
    this.options.onExitToMenu?.();
  };

  /**
   * §51 "Teslim ol". Routed through the match's own one-way door, so resigning
   * lands on the same defeat screen a razed centre does — with its own reason.
   */
  private readonly surrenderMatch = (): void => {
    if (!this.match.surrender()) return;
    this.log.info("Defeat: the player surrendered");
    this.showMatchResult();
  };

  /**
   * Pause, unless there is a pending placement to back out of first. Escape
   * means "undo the thing I am in the middle of", and a half-placed building is
   * more immediate than the menu.
   */
  private readonly togglePause = (): void => {
    if (!this.match.active || this.flow.phase === "start") return;
    if (this.placement.state().activeBuildingId !== null) {
      this.placement.cancel();
      this.syncPlacementUi();
      return;
    }
    if (this.roadPlacement.state().active) {
      this.roadPlacement.cancel();
      this.syncRoadUi();
      return;
    }
    if (this.rallyPointPending) {
      this.rallyPointPending = false;
      this.buildPalette.setActionMessage("Toplanma noktası seçimi iptal edildi.");
      return;
    }
    if (!this.flow.togglePause()) return;
    if (this.flow.phase === "paused") this.matchOverlay.showPause(this.missionRunning());
    else this.matchOverlay.hide();
  };

  private showMatchResult(): void {
    const outcome = this.match.outcome;
    const reason = this.match.reason;
    if (outcome === "active" || reason === null) return;
    // §53: the result screen is where the duration is actually read — it is the
    // one moment the match has a final length to report.
    this.matchOverlay.showResult(outcome, reason, this.clock.seconds);
  }

  /** Restore all Faz 1 match-owned systems without reloading the browser route. */
  private readonly restartMatch = (): void => {
    this.selection.reset();
    // The tour counted units that no longer exist; a stale cursor would send
    // the camera to a position in a list the new match never had.
    this.rosterTourTypeId = null;
    this.rosterTourIndex = 0;
    this.economyProduction?.reset();
    this.logisticsOccupation.reset();
    this.logisticsTransfers.reset();
    this.caravans.reset();
    this.pasture.reset();
    this.workerConstruction.reset();
    // Dropped rather than refunded: `kingdoms.reset()` below restores every
    // wallet to its match-start stockpile, so a refund here would be paid into
    // an account that is about to be replaced.
    this.structureRepair.reset();
    this.barracksProduction.reset();
    this.progression.reset();
    this.workerProduction.reset();
    this.ai.reset();
    this.units.clear();
    this.centers.clear();
    this.structures.clear();
    this.roadPlacement.reset();
    // Restart clears the graph (bumping its version without a commit hook), so the
    // painter is reset explicitly: pristine terrain restored, ready to repaint.
    this.roadPainter?.reset();
    this.projectiles.clear();
    this.firebrands.clear();
    this.cannonballs.clear();
    // The shells those guns had in the air belong to the match that just ended;
    // landing them on a fresh field would damage whatever now stands there. The
    // towers' guns keep their own queue, so it is emptied alongside.
    this.pendingImpacts.clear();
    this.structureDefense.clear();
    // The units it was tracking are gone with the match; the readout must not
    // keep answering for them.
    this.supportAuras.clear();
    this.rallyPointPending = false;
    this.structureConstruction.resetReservations();
    this.kingdoms.reset();
    // A new match opens at the base rate: carrying a wrecked price index over
    // would price the first trade of a fresh game off the last one's spree.
    this.marketTrade.reset();
    this.resourceNodes.reset();
    this.tradeSites.reset();
    // Every site goes back to nobody; a new match must not open with the last
    // one's port already claimed.
    this.marketSupply.reset();
    this.forests.reset();
    this.commandMarkers.clear();
    // A restart is a new match, not a continuation: carrying a cooldown over
    // would mute a real notice in the first seconds of the next game, and a
    // stale health baseline would read the fresh centre as already damaged.
    this.notifications.reset();
    this.notificationFeed.setNotifications([]);
    this.previousLogisticsStatus.clear();
    // ...and the supply watch with it (Faz S5). Carrying `everSuppliedSites`
    // over would open the next match advising the player to *repair* a road they
    // have not built yet, on a site the new game has handed back to nobody.
    this.previousSupplyState.clear();
    this.everSuppliedSites.clear();
    // A fresh match reopens the saldırmazlık window, so its notices must be
    // allowed to fire again from the top.
    this.peaceAnnounceStage = 0;
    // Likewise the story chain: a restart replays it from the first objective,
    // intro included. The director derives its own position from the world, so
    // this only has to un-latch the finish and the one-shot intro.
    this.missions?.reset();
    this.missionIntroPosted = false;
    this.missionPollTimer = 0;
    this.razedEnemyBuildings = {};
    this.playerMarketTrades = 0;
    this.playerMarketPurchases = {};
    this.playerUnitsTrained = {};
    this.missionPanel?.setState(null);
    this.missionMarker = null;
    if (this.missions) this.syncMissionGuide(this.missions.state());
    this.attackWatch.reset();
    this.match.reset();
    this.clock.reset();
    // §58: a restart is a new match. A counter carried over would start the
    // fresh game part-way to a regional loss the player never played.
    this.strategicPoints?.reset();
    this.regionalVictory?.reset();
    // §59: likewise the explored latch and every remembered building. A restart
    // that kept the old map revealed would hand the player a scouting report
    // for a match they have not played.
    this.vision?.reset();
    this.enemyMemory?.reset();
    this.fogVisibility?.revealAll();
    // "Yeniden Başlat" is reachable from the pause menu as well as the result
    // screen, so the flow has to be told too — otherwise restarting a paused
    // match would rebuild the world and leave it frozen behind a hidden menu.
    this.flow.restart();
    this.spawnCenters();
    this.seedCenterAccessRoads();
    // A restart is a fresh match, so the view returns to the opening framing too
    // — otherwise the player restarts into wherever they had scrolled to, which
    // under fog is very likely unexplored ground.
    this.cameraController.setFocus(this.openingFocus.x, this.openingFocus.z);
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.spawnStartingUnits();
    // §59: the reset above cleared the explored latch, so the fresh world needs
    // its first fog pass here too — a restart from the pause menu goes straight
    // back to a running match, but one from the result screen does not.
    this.updateFogOfWar();
    this.syncForestVisibility();
    this.placement.cancel();
    this.syncPlacementUi();
    this.syncAgeUi();
    this.syncRoadUi();
    this.matchOverlay.hide();
    this.log.info("RTS match restarted");
  };

  /** Sync renderer + camera to the canvas's CSS size when it changes. */
  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const ratio = effectiveDevicePixelRatio(window.devicePixelRatio, this.qualitySettings);
    // A profile can change while CSS dimensions remain stable. Apply the drawing
    // buffer ratio before the size early return so Low/High takes effect at once.
    this.renderer.setPixelRatio(ratio);
    this.postProcessPipeline?.setPixelRatio(ratio);
    if (width === this.lastW && height === this.lastH) return;
    this.lastW = width;
    this.lastH = height;
    this.renderer.setSize(width, height, false);
    this.postProcessPipeline?.setSize(width, height);
    this.cameraController.setViewport(width, height);
  }

  private navigationBlockers() {
    return [
      ...this.spatial.navigationBlockers,
      ...this.centers.navigationBlockers(),
      ...this.structures.unitNavigationBlockers(),
    ];
  }

  /** Building and road placement keeps every structure footprint reserved. */
  private occupancyBlockers() {
    return [
      ...this.spatial.navigationBlockers,
      ...this.centers.navigationBlockers(),
      ...this.structures.navigationBlockers(),
    ];
  }

  /**
   * "Main road" means the road network of the outpost's *own* kingdom. This used
   * to resolve the player's centre for every outpost, so an AI outpost was
   * judged against a centre it does not own and never earned its connected
   * control radius — the radius its expansion depot and production slots need to
   * be placeable at all.
   */
  private outpostConnectedToMainRoad(structure: PlacedStructure): boolean {
    const outpostRoad = roadLinkCellFor(
      this.roads, structure.owner, structure.x, structure.z,
      structure.stats.footprint.width, structure.stats.footprint.depth,
    );
    const center = this.centers.get(structure.owner);
    const centerRoad = center && roadLinkCellFor(this.roads, structure.owner, center.position.x, center.position.z, 8, 8);
    if (!outpostRoad || !centerRoad) return false;
    return this.roads.connected(outpostRoad, centerRoad, structure.owner);
  }

  private refreshNavigationBlockers(): void {
    this.navigation.setBlockers(this.navigationBlockers());
  }

  /**
   * Pave a short access road under a freshly placed building so it touches the
   * network without the player hand-drawing the last tiles (Option A). Runs at
   * the tail of construction, once the new footprint is already a blocker, so
   * the route bends *up to* the building and ends on a cell that touches it —
   * exactly what {@link roadCellTouchingFootprint} needs to read it as linked.
   *
   * Player-only and free: the AI funds its own spine through the wood-charged
   * {@link RoadConstructionService} (AI design §4), and the player's building
   * price is taken to already cover its access road, so nothing is billed here.
   */
  private autoConnectRoad(structure: PlacedStructure): void {
    if (structure.owner !== PLAYER_OWNER) return;
    const maxNewCells = this.options.roadBalance.autoConnect?.maxCells ?? 0;
    if (maxNewCells <= 0) return;
    const plan = planAutoRoadConnection(
      this.roads,
      {
        x: structure.x,
        z: structure.z,
        width: structure.stats.footprint.width,
        depth: structure.stats.footprint.depth,
      },
      (start, end) => this.roadConstruction.plan(start, end, structure.owner),
      { maxNewCells, owner: structure.owner },
    );
    if (plan) this.roadConstruction.commitFree(plan);
  }

  private syncPlacementUi(): void {
    this.buildPalette.setState(this.placement.state());
    this.buildPalette.setAffordability(this.playerKingdom.wallet.snapshot());
    // The roster left with the palette's train buttons (§51): it is pushed to
    // the Barracks' own panel now, and only while that Barracks is selected.
    this.syncHudBar();
    this.syncEconomyUi();
  }

  /** Push the §51 readouts. The bar decides nothing; it only diffs its cells. */
  private syncHudBar(): void {
    this.hudBar.setResources(
      this.playerKingdom.wallet.snapshot(),
      this.playerIncomeRates(),
      this.resourceCapacity.capacityFor(PLAYER_OWNER),
    );
    this.hudBar.setIdleWorkerCount(this.workerConstruction.idleWorkerCount(PLAYER_OWNER));
    const population = this.playerKingdom.population.snapshot();
    this.hudBar.setPopulation(population.used, population.capacity);
    this.syncArmyRoster();
    this.hudBar.setAge(this.progression.snapshot(PLAYER_OWNER), this.options.ageBalance);
    this.hudBar.setMatchDuration(this.clock.seconds);
  }

  /**
   * All four resources, not the Faz 3 pair. The HUD's job in a four-resource
   * economy is to show which income is the one holding the Town age back, and a
   * missing row cannot do that — a zero stone rate has to be *visible* to read
   * as the reason (Faz 8 hit exactly this: AI scoring averaged its incomes and
   * a healthy three hid a zero stone).
   */
  private playerIncomeRates(): Record<string, number> {
    const rates: Record<string, number> = {};
    for (const resourceId of RESOURCE_ORDER) {
      rates[resourceId] = this.economyProduction?.productionPerMinute(PLAYER_OWNER, resourceId) ?? 0;
    }
    return rates;
  }

  private syncRoadUi(): void {
    this.buildPalette.setRoadState(this.roadPlacement.state());
  }

  /** Load the opt-in Actor Script presentation pack after legacy gameplay booted. */
  private async loadActorVisuals(): Promise<void> {
    if (!this.actorVisuals) return;
    try {
      await this.actorVisuals.load((loaded, total) => this.loadTracker.report("actors", loaded, total));
      if (this.disposed) return;
      this.reportActorVisuals(this.actorVisuals.report());
      // The shell's art, which no Actor references because a shot in flight is a
      // pooled mesh rather than a placed Actor. A catalog that maps no such prop
      // leaves the system on its procedural iron sphere.
      const cannonball = await this.actorVisuals.loadPropModel("cannonball");
      if (this.disposed) return;
      if (cannonball) this.cannonballs.setBallModel(cannonball);
      this.warmStructureDamageEffects();
      this.units.setPresentationFactory((owner, stats) =>
        this.actorVisuals?.createUnitPresentation(
          Object.entries(this.options.unitBalance).find(([, value]) => value === stats)?.[0] ?? "",
          owner,
          stats.moveSpeed,
        ) ?? null);
      this.units.refreshPresentations();
      this.wildlifeView.setPresentationFactory((species, moveSpeed, walkClipSpeed) =>
        this.actorVisuals?.createAnimalPresentation(species, moveSpeed, walkClipSpeed) ?? null);
      this.caravanView.setPresentationFactory((moveSpeed, walkClipSpeed) =>
        this.actorVisuals?.createCaravanPresentation(moveSpeed, walkClipSpeed) ?? null);
      this.placement.setPreviewFactory((buildingId, width, depth) =>
        this.buildingVisuals.createPreviewForBuilding(
          buildingId,
          width,
          depth,
          this.ageOf(PLAYER_OWNER),
          this.progression.tierFor(PLAYER_OWNER).level,
        ));
      for (const center of this.centers.all()) this.buildingVisuals.applyToCenter(center, this.ageOf(center.owner));
      for (const structure of this.structures.all()) {
        if (structure.construction.complete) this.applyStructureVisual(structure);
        else this.applyConstructionVisual(structure);
      }
    } catch (error) {
      // Only a pack-wide failure reaches here now — an unreachable manifest, with
      // which no reference resolves at all. A single broken Actor is handled
      // per-Actor inside `load()` and shows as a placeholder instead.
      this.log.warn("RTS Actor presentation pack could not be loaded; using legacy visuals", error);
      this.canvas.dataset.rtsContentAssets = "fallback";
    } finally {
      // `finally` covers the pack-wide failure above *and* the `disposed` early
      // return in the try: neither may leave the curtain waiting on a track that
      // will never report again.
      this.settleAssetTrack("actors");
    }
  }

  /**
   * Make the pack's health readable without a screenshot: the canvas dataset is
   * the browser test's witness, the log names each broken ref, and the `?debug`
   * overlay carries the running count so a placeholder cannot sit unnoticed in a
   * corner of the map for a whole match.
   */
  private reportActorVisuals(report: RtsActorLoadReport): void {
    this.canvas.dataset.rtsContentAssets = rtsContentAssetsState(report);
    this.canvas.dataset.rtsContentPlaceholders = String(report.failures.length);
    for (const failure of report.failures) {
      this.log.warn(`RTS Actor placeholder in use — ${failure.reason}`);
    }
    if (report.failures.length > 0) {
      this.log.warn(
        `RTS Actor pack loaded ${report.loaded}/${report.requested} Actors; ${report.failures.length} placeholder(s) in use`,
      );
    }
    this.debugWitness?.setPresentationLines(formatRtsActorPresentationDebug(report));
  }

  /**
   * Build the §51 panel's answer from the live systems.
   *
   * The panel is told what is true and never asks; this is the same contract the
   * HUD bar runs on, and it is what keeps the panel's text under `test:engine`
   * (see {@link describeSelection}). Buildings win nothing here: a unit
   * selection is checked first because {@link SelectionSystem} guarantees the
   * two are mutually exclusive, and asking in a fixed order is cheaper than
   * asserting it twice.
   */
  private selectionView(): RtsSelectionView {
    // A pending demolish belongs to the building it was aimed at. Selecting
    // anything else disarms it, so the confirm step can never be inherited by a
    // building the player never armed.
    if (this.demolishArmed && this.selection.selectedStructure() !== this.demolishArmed) {
      this.demolishArmed = null;
    }
    if (this.cancelConstructionArmed && (
      this.selection.selectedStructure() !== this.cancelConstructionArmed
      || this.cancelConstructionArmed.construction.complete
    )) {
      this.cancelConstructionArmed = null;
    }
    const units = this.selection.selected();
    if (units.length > 0) {
      return {
        kind: "units",
        formation: { active: this.activeFormation },
        units: units.map((unit) => ({
          id: unit.id,
          role: unit.role,
          stats: unit.stats,
          health: unit.health.current,
          maxHealth: unit.health.max,
          stance: unit.stance,
          order: unit.attackMoveTarget !== null
            ? "attack-moving"
            : unit.attackTarget !== null
              ? "attacking"
              : unit.hasMovementOrder
                ? "moving"
                : "idle",
          job: unit.role === "worker" ? this.workerJob(unit) : null,
          // Standing on ground the grid forbids means the unit was caught under a
          // footprint; that is the only state the rescue button reacts to.
          trapped: !this.navigation.isWalkable(unit.position.x, unit.position.z),
        })),
      };
    }
    const structure = this.selection.selectedStructure();
    if (structure) {
      return {
        kind: "structure",
        structure: {
          id: structure.id,
          label: structure.stats.label,
          icon: structure.stats.icon,
          level: structure.level,
          ageLabel: this.ageOf(structure.owner) === "town" ? "Kasaba" : "Yerleşim",
          health: structure.health.current,
          maxHealth: structure.health.max,
          demolishArmed: this.demolishArmed === structure,
          cancelConstructionArmed: this.cancelConstructionArmed === structure,
          repair: this.structureRepairView(structure),
          detail: this.structureDetail(structure),
        },
      };
    }
    const tradeSite = this.tradeSiteSelectionView();
    if (tradeSite) return tradeSite;
    const center = this.selection.selectedCenter();
    if (!center) return { kind: "none" };
    return {
      kind: "structure",
      structure: {
        id: 0,
        label: this.options.buildingBalance["command_center"]?.label ?? "Merkez",
        icon: this.options.buildingBalance["command_center"]?.icon,
        level: center.level,
        ageLabel: this.ageOf(center.owner) === "town" ? "Kasaba" : "Yerleşim",
        health: center.health.current,
        maxHealth: center.health.max,
        detail: {
          kind: "center",
          queue: this.workerProduction.queueSnapshot(PLAYER_OWNER),
          controlRadius: center.controlRadius,
          workerStats: this.options.unitBalance["worker_placeholder"]!,
          // The centre is the kingdom's whole progression surface (plan §5): one
          // action, whether a level-up or the Town transition.
          progression: this.centerProgressionView(PLAYER_OWNER),
        },
      },
    };
  }

  /**
   * The selected trade site's panel state — supply plan Faz S6.
   *
   * Every number is quoted from the system that owns it, never recomputed: the
   * claim and the state come from {@link MarketSupplySystem} (through Faz S5's
   * `siteSupplyState`, so the panel and the feed cannot disagree), the fleet
   * count from the live caravan roster, the rate and the capacities from the
   * balance row.
   *
   * The two nullable fields are the fog line drawn one step further in than the
   * pick proxy draws it. Standing on explored ground is enough to *see* whose a
   * site is — that is what the road touching it looks like from outside. It is
   * not enough to read what is stacked inside it or how many animals are running
   * it, so a rival's buffer and fleet come back null and the panel says
   * "unknown" rather than "zero".
   */
  private tradeSiteSelectionView(): RtsSelectionView | null {
    const siteId = this.selection.selectedTradeSite();
    if (siteId === null) return null;
    const snapshot = this.marketSupply.snapshots().find((candidate) => candidate.siteId === siteId);
    if (!snapshot) return null;
    const state = siteSupplyState(
      snapshot,
      PLAYER_OWNER,
      this.everSuppliedSites.has(siteId),
      this.vision?.isExplored(PLAYER_OWNER, snapshot.x, snapshot.z) ?? true,
    );
    const held = snapshot.owner === PLAYER_OWNER;
    const laneId = supplyLaneId(siteId);
    return {
      kind: "trade-site",
      site: {
        siteId,
        label: snapshot.label,
        icon: this.options.tradeSiteBalance[snapshot.siteType]?.icon,
        resourceId: snapshot.resourceId,
        state,
        // Read off the claim rather than off `state`: `cut` says nothing about
        // who holds it, and a besieged market leaves the site in the player's
        // hands (KARAR 4-A) while the lane is stopped.
        holder: held ? "self" : snapshot.owner !== null ? "rival" : null,
        perMinute: this.options.tradeSiteBalance[snapshot.siteType]?.perMinute ?? 0,
        bufferCapacity: snapshot.bufferCapacity,
        buffered: held ? snapshot.buffered : null,
        caravansOnRoad: held
          ? this.caravans.snapshots().filter((caravan) => caravan.laneId === laneId).length
          : null,
        caravanCount: snapshot.caravanCount,
      },
    };
  }

  /**
   * The repair verb's state for the §51 panel, or null when there is nothing to
   * offer: an enemy building, an unfinished foundation, or one at full health
   * with no crew already on it.
   *
   * The running case is checked before the damage case on purpose — a crew that
   * has just finished the last hit point is still worth showing until the job
   * closes, and the panel needs the "Tamiri Durdur" button to stay put rather
   * than vanish under the cursor mid-repair.
   */
  private structureRepairView(structure: PlacedStructure): StructureRepairView | null {
    if (structure.owner !== PLAYER_OWNER || !structure.construction.complete) return null;
    const job = this.structureRepair.snapshot(structure);
    const quote = this.structureRepair.quote(structure);
    if (!job && !quote) return null;
    return {
      missingHealth: quote?.missingHealth ?? 0,
      cost: quote?.cost ?? {},
      workerSeconds: quote?.workerSeconds ?? 0,
      active: job !== null,
      progress: job?.progress ?? 0,
      workers: this.workerConstruction.assignedRepairWorkers(structure),
      stock: this.kingdoms.get(PLAYER_OWNER).wallet.snapshot(),
    };
  }

  /**
   * The centre's progression view for the §51 panel: the live snapshot (which
   * carries the single next action), how far an in-flight action has run, and the
   * labels the Town action needs to name what it still waits on.
   */
  private centerProgressionView(owner: UnitOwner): CenterProgressionView {
    const snapshot = this.progression.snapshot(owner);
    const action = snapshot.nextAction;
    const progress = snapshot.upgrading && action && action.durationSeconds > 0
      ? Math.min(1, Math.max(0, (action.durationSeconds - snapshot.remainingSeconds) / action.durationSeconds))
      : 0;
    return {
      snapshot,
      progress,
      requiredBuildingLabels: this.buildingLabels,
      settlementLabel: this.options.ageBalance.settlement.label,
      townLabel: this.options.ageBalance.town.label,
      stock: this.kingdoms.get(owner).wallet.snapshot(),
    };
  }

  /**
   * Run a button the selection panel offered. The panel hands back an id and
   * nothing else: the verbs, and the messages they answer with, stay here next
   * to every other command path — which is what keeps a panel button and the
   * same order issued any other way from drifting into two behaviours.
   */
  /**
   * Player-ordered demolition of one of their own buildings (plan §64).
   *
   * First click arms, second click razes. The razing itself is expressed as
   * lethal damage rather than a direct `structures.destroy` call: that routes it
   * through {@link updateStructureDestruction}, the one place a depleted
   * structure is removed, so territory refresh, navigation blockers, selection
   * reconciliation and the log entry all happen exactly as they do when siege
   * takes the same building down. A second removal path would have to restate
   * every one of those and could drift from them.
   */
  private demolishSelectedStructure(): void {
    const structure = this.selection.selectedStructure();
    if (!structure || structure.owner !== PLAYER_OWNER) return;
    if (this.demolishArmed !== structure) {
      this.demolishArmed = structure;
      this.announce("structure", `${structure.stats.label} yıkılacak. Onaylamak için tekrar basın.`, "refused");
      return;
    }
    this.demolishArmed = null;
    structure.health.damage(structure.health.max);
    this.announce("structure", `${structure.stats.label} yıkıldı.`);
  }

  /**
   * Order — or call off — the repair of the selected building (the "Tamir Et"
   * button, and the same path a right-click with workers takes).
   *
   * Payment happens first and staffing second, then the order is *undone* if no
   * worker could be sent. The other order — find a worker, then charge — would
   * leave a crew walking toward a job the kingdom turned out not to be able to
   * afford, and the player watching workers abandon a building for no stated
   * reason. Refunding an unstarted job is exactly what `cancel` already does.
   */
  private repairSelectedStructure(workers: readonly Unit[] = []): void {
    const structure = this.selection.selectedStructure();
    if (!structure || structure.owner !== PLAYER_OWNER) return;
    this.orderStructureRepair(structure, workers);
  }

  /** Shared by the panel button and the contextual worker order. */
  private orderStructureRepair(structure: PlacedStructure, workers: readonly Unit[]): boolean {
    if (structure.owner !== PLAYER_OWNER) return false;
    if (this.structureRepair.isRepairing(structure)) {
      // Adding workers to a running repair is not a cancel: the player pointing
      // more hands at a job they already ordered means "faster", and only the
      // button — which carries no crew — can mean "stop".
      if (workers.length > 0) {
        if (!this.staffStructureRepair(structure, workers)) {
          this.announce("structure", "Tamir ekibi dolu; daha fazla işçi eklenemedi.", "refused");
        }
        return true;
      }
      this.workerConstruction.cancelRepair(structure);
      this.structureRepair.cancel(structure);
      this.announce("structure", `${structure.stats.label} tamiri durduruldu.`, "refused");
      return true;
    }
    const quote = this.structureRepair.quote(structure);
    const result = this.structureRepair.begin(structure);
    if (result !== "started") {
      const message: Record<typeof result, string> = {
        "not-repairable": "Yalnız tamamlanmış yapılar tamir edilebilir.",
        undamaged: `${structure.stats.label} zaten tam canda.`,
        "already-repairing": `${structure.stats.label} zaten tamir ediliyor.`,
        "insufficient-resources": quote
          ? `${structure.stats.label} tamiri için kaynak yetersiz (${formatResourceCost(quote.cost)}).`
          : `${structure.stats.label} tamiri için kaynak yetersiz.`,
      };
      this.announce("structure", message[result], "refused");
      return true;
    }
    if (this.staffStructureRepair(structure, workers)) return true;
    // Nobody could be sent, so the order never happened: unwind it in full.
    this.structureRepair.cancel(structure);
    this.announce("structure", "Tamir için uygun işçi yok.", "refused");
    return true;
  }

  /** Send the given workers — or the nearest free ones — to an open repair job. */
  private staffStructureRepair(structure: PlacedStructure, workers: readonly Unit[]): boolean {
    const assigned = workers.length > 0
      ? this.workerConstruction.assignRepairWorkers(structure, workers).assignedWorkers
      : this.workerConstruction.assignNearestForRepair(structure).assigned
        ? this.workerConstruction.assignedRepairWorkers(structure)
        : 0;
    if (assigned === 0) return false;
    this.announce("structure", `${assigned} işçi ${structure.stats.label} tamirine gönderildi.`);
    return true;
  }

  /** Cancel exactly the selected foundation; a finished building must use demolition instead. */
  private cancelSelectedConstruction(): void {
    const structure = this.selection.selectedStructure();
    if (!structure || structure.owner !== PLAYER_OWNER || structure.construction.complete) return;
    if (this.cancelConstructionArmed !== structure) {
      this.cancelConstructionArmed = structure;
      this.announce("structure", `${structure.stats.label} inşaatı iptal edilecek. Onaylamak için tekrar basın.`, "refused");
      return;
    }
    this.cancelConstructionArmed = null;
    if (!this.structureConstruction.cancel(PLAYER_OWNER, structure)) return;
    this.selection.reconcileStructures(this.structures.all());
    this.announce("structure", `${structure.stats.label} inşaatı iptal edildi; kaynaklar iade edildi.`);
  }

  private runSelectionAction(id: string): void {
    if (id === TRAIN_WORKER_ACTION) {
      this.queueWorker();
      return;
    }
    if (id === AGE_UP_ACTION) {
      this.startTownUpgrade();
      return;
    }
    if (id === RALLY_ACTION) {
      this.placement.cancel();
      this.roadPlacement.cancel();
      this.rallyPointPending = true;
      this.buildPalette.setActionMessage("Toplanma noktası için haritada bir konum seçin.");
      return;
    }
    if (id === RESCUE_ACTION) {
      this.rescueTrappedSelection();
      return;
    }
    if (id === DEMOLISH_ACTION) {
      this.demolishSelectedStructure();
      return;
    }
    if (id === REPAIR_ACTION) {
      this.repairSelectedStructure();
      return;
    }
    if (id === CANCEL_CONSTRUCTION_ACTION) {
      this.cancelSelectedConstruction();
      return;
    }
    if (id === CANCEL_WORKER_ACTION) {
      this.cancelWorkerOrder();
      return;
    }
    if (id === CANCEL_TRAIN_ACTION) {
      this.cancelLatestUnitOrder();
      return;
    }
    if (id === CENTER_LEVEL_UP_ACTION) {
      // Centre-led progression: the one in-age level-up (Lv1→2 / Lv2→3) lifts the
      // whole kingdom, only ever started from the selected Merkez.
      this.startCenterLevelUpgrade();
      return;
    }
    if (id.startsWith(TRAIN_ACTION_PREFIX)) {
      this.queueUnit(id.slice(TRAIN_ACTION_PREFIX.length));
      return;
    }
    if (id.startsWith(TRADE_BUY_ACTION_PREFIX)) {
      this.trade("buy", id.slice(TRADE_BUY_ACTION_PREFIX.length));
      return;
    }
    if (id.startsWith(TRADE_SELL_ACTION_PREFIX)) {
      this.trade("sell", id.slice(TRADE_SELL_ACTION_PREFIX.length));
      return;
    }
    // An unknown id means the view offered a button nothing implements: that is
    // a wiring bug, and swallowing it would present the player a dead button.
    throw new Error(`Unhandled selection action: ${id}`);
  }

  /**
   * Walk every trapped unit in the selection out to the nearest clear ground.
   *
   * "Trapped" is the same test the panel used to offer the button: standing on a
   * cell the navigation grid forbids, which for a friendly unit means a footprint
   * closed over it. Each such unit gets a collision-exempt escort ({@link
   * Unit.beginRescue}) toward the nearest walkable point; a unit with no clear
   * ground anywhere within reach is left as-is rather than sent nowhere.
   */
  private rescueTrappedSelection(): void {
    const trapped = this.selection.selected()
      .filter((unit) => !this.navigation.isWalkable(unit.position.x, unit.position.z));
    if (trapped.length === 0) {
      this.announce("orders", "Kurtarılacak sıkışmış birim yok.", "refused");
      return;
    }
    let rescued = 0;
    for (const unit of trapped) {
      const exit = this.navigation.nearestWalkable(unit.position.x, unit.position.z);
      if (!exit) continue;
      unit.beginRescue(exit.x, exit.z);
      rescued += 1;
    }
    if (rescued > 0) this.announce("orders", `${rescued} birim boş zemine çıkarılıyor.`);
    else this.announce("orders", "Yakında boş zemin bulunamadı; birimler kurtarılamadı.", "refused");
  }

  /**
   * A worker answers to two systems, so the panel needs the one that currently
   * holds it. Economy is asked first: only an assigned worker is in it at all,
   * and construction reports an unassigned worker as "idle" — the same word it
   * uses for a genuinely free one.
   */
  private workerJob(worker: Unit): WorkerJob {
    // A shepherd is asked about first: he is in neither of the other two, and
    // calming an animal is standing work while the rest of the drive is a walk.
    const herding = this.pasture.stateFor(worker);
    if (herding !== "idle") return herding === "calming" ? "producing" : "moving";
    if (this.economyProduction?.isAssigned(worker)) {
      // "gathering" is a worker kneeling at a tree or a deposit: as much at work
      // as one standing in a field, and the panel must not call it "moving".
      const state = this.economyProduction.stateFor(worker);
      return state === "producing" || state === "gathering" ? "producing" : "moving";
    }
    return this.workerConstruction.stateFor(worker);
  }

  /**
   * Push the per-type census behind the HUD's army strip.
   *
   * Only workers can report as idle here, because {@link isIdleWorker} is the
   * only "free for work" rule the game currently owns — a soldier standing
   * still is between orders, not unemployed, and badging it would turn a
   * decision prompt into noise. The roster takes the predicate rather than the
   * rule, so giving soldiers their own idleness later is a change here and
   * nowhere else.
   */
  private syncArmyRoster(): void {
    const selected = new Set(this.selection.selected());
    this.armyRoster.setRoster(describeArmyRoster(this.units.unitsOf(PLAYER_OWNER), {
      isIdle: (unit) => this.isIdleWorker(unit),
      isSelected: (unit) => selected.has(unit),
    }));
  }

  /**
   * Select every live player unit of one type (a roster chip click).
   *
   * Repeating the click tours the type instead of re-selecting it: the second
   * press is a player who has the units and now wants to *find* them, which is
   * the question the strip otherwise cannot answer. Shift adds to the selection
   * and never moves the camera — assembling a mixed group is a different intent
   * from inspecting one type.
   */
  private selectUnitsOfType(typeId: string, additive: boolean): void {
    // `unitsOf` is in spawn order, so the tour visits a type in a stable order
    // rather than reshuffling under the player between presses.
    const matching = this.units.unitsOf(PLAYER_OWNER).filter((unit) => unit.typeId === typeId);
    // The chip only exists while the type has live units, but a unit can die
    // between the frame that drew it and the click that arrives.
    const sample = matching[0];
    if (!sample) return;

    if (additive) {
      this.selection.addUnits(matching);
      this.rosterTourTypeId = null;
      this.announce("orders", `${matching.length} ${sample.stats.label} seçime eklendi.`);
      return;
    }

    this.selection.selectUnits(matching);
    if (this.rosterTourTypeId === typeId) {
      this.rosterTourIndex = (this.rosterTourIndex + 1) % matching.length;
      const target = matching[this.rosterTourIndex]!;
      this.cameraController.setFocus(target.position.x, target.position.z);
    } else {
      this.rosterTourTypeId = typeId;
      this.rosterTourIndex = 0;
    }
    this.announce("orders", `${matching.length} ${sample.stats.label} seçildi.`);
  }

  /** Select every player worker that is free for automatic staffing (I). */
  private selectIdleWorkers(): void {
    const workers = this.units.workersOf(PLAYER_OWNER).filter((worker) => this.isIdleWorker(worker));
    this.selection.selectUnits(workers);
    if (workers.length > 0) this.announce("workers", `${workers.length} boşta işçi seçildi.`);
    else this.announce("workers", "Seçilecek boşta işçi yok.", "refused");
  }

  /** Return selected free workers to the normal construction-then-production queue (R). */
  private assignSelectedIdleWorkers(): void {
    const workers = this.selection.selected().filter((worker) => this.isIdleWorker(worker));
    if (workers.length === 0) {
      this.announce("workers", "İşe gönderilecek boşta işçi seçili değil.", "refused");
      return;
    }
    for (const worker of workers) worker.resumeAutomaticWorkerAssignment();
    this.workerConstruction.assignIdleWorkers();
    this.economyProduction?.assignIdleWorkers();
    const assigned = workers.filter((worker) => !this.isIdleWorker(worker)).length;
    if (assigned > 0) this.announce("workers", `${assigned} işçi uygun işe gönderildi.`);
    else this.announce("workers", "Şu anda işçi bekleyen uygun bir iş yok.", "refused");
  }

  private isIdleWorker(worker: Unit): boolean {
    return worker.role === "worker"
      && !worker.blocksAutomaticWorkerAssignment
      && this.workerConstruction.stateFor(worker) === "idle"
      && !(this.economyProduction?.isAssigned(worker) ?? false)
      && !this.pasture.isShepherd(worker);
  }

  private structureDetail(structure: PlacedStructure): StructureDetailView {
    if (!structure.construction.complete) {
      return {
        kind: "construction",
        progress: structure.construction.progress,
        assignedWorkers: this.workerConstruction.assignedWorkers(structure),
      };
    }
    const production = this.economyProduction?.snapshots(structure.owner)
      .find((snapshot) => snapshot.structureId === structure.id);
    if (production) {
      const livestock = this.pasture.snapshots(structure.owner)
        .find((pasture) => pasture.structureId === structure.id);
      const caravan = this.caravans.snapshots()
        .find((candidate) => candidate.laneId === producerLaneId(structure.id)) ?? null;
      const dispatch = this.caravanDispatch(structure.id);
      const logistics = this.productionLogistics.snapshots()
        .find((producer) => producer.structureId === structure.id) ?? null;
      return {
        kind: "producer",
        production,
        logistics: logistics?.status ?? null,
        transport: logistics?.transport ?? null,
        caravan,
        caravanStorageFull: dispatch !== null && !dispatch.canReceive,
        livestock: livestock
          ? {
            pennedAnimals: livestock.pennedAnimals,
            livestockCapacity: livestock.livestockCapacity,
            shepherds: livestock.shepherds,
          }
          : null,
      };
    }
    if (structure.stats.id === "depot") {
      const depot = this.depotLogistics.snapshots().find((node) => node.structureId === structure.id);
      return {
        kind: "depot",
        status: depot?.status ?? "unlinked",
        componentId: depot?.componentId ?? null,
        linkedProducers: this.productionLogistics.snapshots()
          .filter((producer) => producer.depotStructureId === structure.id).length,
        occupied: this.logisticsOccupation.occupierFor(structure.id) !== null,
        contribution: structure.storageCapacity ?? {},
        capacity: this.resourceCapacity.capacityFor(structure.owner),
        stock: this.kingdoms.get(structure.owner).wallet.snapshot(),
      };
    }
    if (structure.stats.territory) {
      return {
        kind: "outpost",
        controlRadius: structure.territoryControlRadius ?? 0,
        connectedControlRadius: structure.territoryConnectedControlRadius,
        roadConnected: this.outpostConnectedToMainRoad(structure),
      };
    }
    // Keyed on the data, not on an id: a building trades because its balance
    // declares a market block, which is the same rule `MarketTradeSystem` gates
    // on. An id check here would let a renamed building show the panel and then
    // be refused by the system.
    if (structure.stats.market) {
      const trade = this.marketTrade.snapshotFor(structure.owner);
      if (trade) {
        return {
          kind: "market",
          trade,
          connected: this.territory.ownerAt(structure.x, structure.z) === structure.owner,
          // Faz S5. Keyed off the stocked list rather than the price list: a
          // resource that buys freely has no supply chain to report, and a line
          // for it would invite the panel to advise a road nothing needs.
          supply: this.marketSupplyLinesFor(structure.owner, Object.keys(trade.stock)),
        };
      }
    }
    if (this.barracksProduction.trainableUnits(structure).length > 0) {
      return {
        kind: "military",
        queue: this.barracksProduction.queueSnapshot(structure),
        rallySet: this.barracksProduction.rallyPoint(structure.owner) !== null,
        // Deliberately the *same* predicate the production system is wired with
        // (see `new BarracksProductionSystem`), not an equivalent-looking one: a
        // panel that judged connection by footprint while training judged it by
        // centre point would call a working Barracks "Kontrol Dışı".
        connected: this.territory.ownerAt(structure.x, structure.z) === structure.owner,
        // Centre-led progression never pauses a Barracks (plan §4), so military
        // production is never suspended by a level-up or age transition.
        upgrading: false,
        // The tier gate comes from the system that enforces it, never from a
        // level check written again here (plan §45: the gate lives in data).
        roster: this.barracksProduction.trainableUnits(structure),
      };
    }
    // Keyed on the data for the same reason the Market is: a building projects a
    // support field because its balance declares an `aura` block, which is the
    // exact condition `SupportAuraSystem` acts on.
    if (structure.stats.aura) {
      return {
        kind: "aura",
        radius: structure.stats.aura.radius,
        healPerSecond: structure.stats.aura.healPerSecond,
        damageResistance: structure.stats.aura.damageResistance,
        sustainedUnits: this.supportAuras.sustainedCount(structure.owner),
      };
    }
    // Population is the only thing a House does, and the panel reads it the same
    // way `PopulationSystem` totals it — data plus whatever T2 granted.
    return {
      kind: "passive",
      populationCapacity: (structure.stats.populationCapacity ?? 0) + structure.populationCapacityBonus,
    };
  }

  private syncEconomyUi(): void {
    this.logisticsOccupation.sync();
    const logistics = this.productionLogistics.snapshots()
      .filter((producer) => producer.owner === PLAYER_OWNER);
    // The per-producer detail left with the palette's id list (§51): those facts
    // now reach the player by clicking the building. What the bar still needs is
    // the kingdom-wide question — is *anything* severed right now.
    this.hudBar.setLogisticsStatuses(logistics.map((producer) => producer.status));
  }

  /**
   * Raise the §51 notifications whose conditions are *polled* rather than
   * evented. The two age notices are not here: `AgeSystem.update` already
   * reports them as owner-scoped events, and re-deriving them from a snapshot
   * would be a second, weaker source of the same truth.
   *
   * Every branch posts unconditionally and lets {@link RtsNotificationCenter}
   * decide what the player actually sees. That is the point of the split: this
   * method answers "is it true right now", the notification centre answers "has
   * the player already been told" — mixing the two is how a feed starts to spam.
   */
  private syncNotifications(): void {
    const population = this.playerKingdom.population.snapshot();
    if (population.used >= population.capacity) {
      this.notifications.post({
        kind: "population-full",
        text: `Nüfus dolu (${population.used}/${population.capacity}): yeni birim üretmek için Ev kurun.`,
      });
    }

    for (const producer of this.economyProduction?.snapshots(PLAYER_OWNER) ?? []) {
      // Renewable producers report null, and a live deposit is not news.
      if (producer.sourceRemaining === null || producer.sourceRemaining > 0) continue;
      this.notifications.post({
        // Keyed by resource, not by building: two exhausted quarries are one
        // problem ("there is no more stone here"), and the player solves both
        // with the same decision.
        kind: "resource-depleted",
        subject: producer.resourceId,
        text: `${resourceLabel(producer.resourceId)} yatağı tükendi: ${producer.structureLabel} artık üretmiyor.`,
      });
    }

    const livingProducers = new Set<number>();
    for (const producer of this.productionLogistics.snapshots()) {
      if (producer.owner !== PLAYER_OWNER) continue;
      livingProducers.add(producer.structureId);
      const subject = String(producer.structureId);
      const previous = this.previousLogisticsStatus.get(producer.structureId);
      this.previousLogisticsStatus.set(producer.structureId, producer.status);
      if (producer.status !== "linked") {
        this.notifications.post({
          kind: "logistics-cut",
          subject,
          text: `${resourceLabel(producer.resourceId)} üretimi durdu: lojistik bağlantısı kesildi.`,
        });
        continue;
      }
      // Linked now. Only announce the *recovery* when we had actually warned the
      // player it was cut — a producer built already-linked is not news. Clearing
      // the warning at once (rather than letting it time out) is the point: the
      // green notice and the red one must not sit on screen together.
      if (previous !== undefined && previous !== "linked") {
        this.notifications.dismiss({ kind: "logistics-cut", subject });
        this.notifications.post({
          kind: "logistics-restored",
          subject,
          text: `${resourceLabel(producer.resourceId)} lojistik bağlantısı kuruldu: depoya aktarım başladı.`,
        });
      }
    }
    // Drop vanished producers so a later structure that reuses the id does not
    // inherit a stale "was cut" status and fire a phantom recovery notice.
    for (const structureId of [...this.previousLogisticsStatus.keys()]) {
      if (!livingProducers.has(structureId)) this.previousLogisticsStatus.delete(structureId);
    }

    this.syncSupplyNotifications();
    this.syncUnderAttackNotifications();
  }

  /**
   * The Market panel's supply sentences — supply plan Faz S5.
   *
   * Reads its fog predicate from the same place {@link syncForestVisibility}
   * does, and for the same reason: a trade site is a static world object, so
   * what a kingdom may know about it stops at the ground it has explored. With
   * the fog flag off the predicate is omitted and everything is known, which is
   * what "no fog" has to mean.
   */
  private marketSupplyLinesFor(owner: UnitOwner, resourceIds: readonly string[]): readonly MarketSupplyLine[] {
    const vision = this.vision;
    return marketSupplyLines(this.marketSupply.snapshots(), owner, resourceIds, {
      everSupplied: this.everSuppliedSites,
      ...(vision ? { isExplored: (x: number, z: number) => vision.isExplored(owner, x, z) } : {}),
    });
  }

  /**
   * §2 item 7 made audible — supply plan Faz S5.
   *
   * The loop and the memory only; which frame is news belongs to
   * {@link supplyNotice}, where `test:engine` can reach it. Only the human
   * kingdom is narrated, for the same reason only its producers are.
   *
   * The fog predicate is the one from {@link marketSupplyLinesFor}, so the feed
   * and the panel cannot disagree about who holds a site. It changes nothing
   * here in practice — every bad-news branch is already gated on having been
   * supplied, which needs a road, which needs the ground — and passing it anyway
   * is what keeps that a property of the rule rather than a coincidence of this
   * call site.
   */
  private syncSupplyNotifications(): void {
    for (const site of this.marketSupply.snapshots()) {
      const everSupplied = this.everSuppliedSites.has(site.siteId);
      const state = siteSupplyState(
        site,
        PLAYER_OWNER,
        everSupplied,
        this.vision?.isExplored(PLAYER_OWNER, site.x, site.z) ?? true,
      );
      const previous = this.previousSupplyState.get(site.siteId);
      this.previousSupplyState.set(site.siteId, state);
      if (state === "supplying") this.everSuppliedSites.add(site.siteId);
      // The *pre-update* memory: a site supplying for the first time has never
      // fed this kingdom yet, and the good-news branch does not consult it.
      const notice = supplyNotice(site, state, previous, everSupplied);
      if (notice.clearCut) this.notifications.dismiss({ kind: "supply-cut", subject: site.siteId });
      if (notice.post) this.notifications.post(notice.post);
    }
  }

  /**
   * §53 saldırmazlık (non-aggression) window — three one-shot notices instead of
   * a remaining-time counter. The AI holds its "attack" intent until
   * `army.peaceSeconds` (see {@link scoreIntent}); the player has no other honest
   * way to learn that window exists or when it closes, so it is announced rather
   * than shown as a second clock beside the HUD's elapsed timer.
   *
   * Driven off {@link RtsMatchClock} simulation seconds like every other §51
   * notice, so it scales with §38's game speed and freezes on pause for free. The
   * stage guard — not the notification centre's dedup — is what keeps each notice
   * to a single raise: posting every frame would *refresh* the "active" line and
   * leave it up for the whole window. A zero or negative `peaceSeconds` means the
   * window is disabled, so nothing is announced.
   */
  private announcePeaceWindow(): void {
    if (this.peaceAnnounceStage >= 3) return;
    const peaceSeconds = this.options.aiBalance.army.peaceSeconds;
    if (peaceSeconds <= 0) {
      this.peaceAnnounceStage = 3;
      return;
    }
    const now = this.clock.seconds;
    if (this.peaceAnnounceStage === 0) {
      this.notifications.post({
        kind: "peace-active",
        text: `Saldırmazlık süresi etkin: düşman ilk ${formatMatchDuration(peaceSeconds)} boyunca saldırmayacak.`,
      });
      this.peaceAnnounceStage = 1;
    }
    // Heads-up only inside the window: a large tick (or 8x speed) can jump past
    // both thresholds in one frame, and a "bitmek üzere" line posted after the
    // window has already closed would be a lie the very next stage corrects.
    const headsUpAt = Math.max(0, peaceSeconds - PEACE_HEADS_UP_SECONDS);
    if (this.peaceAnnounceStage === 1 && now >= headsUpAt && now < peaceSeconds) {
      const remaining = Math.max(1, Math.ceil(peaceSeconds - now));
      this.notifications.post({
        kind: "peace-ending",
        text: `Saldırmazlık süresi bitmek üzere (${remaining} sn): savunmanı hazırla!`,
      });
      this.peaceAnnounceStage = 2;
    }
    if (now >= peaceSeconds) {
      this.notifications.post({
        kind: "peace-ended",
        text: "Saldırmazlık süresi sona erdi — düşman artık saldırabilir!",
      });
      this.peaceAnnounceStage = 3;
    }
  }

  /**
   * One watch over all three target kinds. They are sampled together because the
   * watch's contract is "what lost health since the last look" — splitting it
   * per kind would need three baselines advanced in lockstep for no gain.
   *
   * Workers joined in V3 Faz 4 (§3.10), and by health rather than by attacker:
   * the watch never asks *what* took the health off, so a worker mauled by a wolf
   * and one shot by a raider read the same, which is right — both are "somebody
   * out there is dying and you have not looked". A dead worker leaves the sample
   * list and the watch forgets him, so his removal cannot read as a fresh wound.
   */
  private syncUnderAttackNotifications(): void {
    const center = this.centers.get(PLAYER_OWNER);
    const outposts = this.structures.ownedBy(PLAYER_OWNER)
      .filter((structure) => structure.stats.territory !== undefined);
    const workers = this.units.unitsOf(PLAYER_OWNER).filter((unit) => unit.role === "worker");
    const damaged = this.attackWatch.observe([
      ...(center ? [{ id: "center", health: center.health.current }] : []),
      ...outposts.map((outpost) => ({ id: `outpost:${outpost.id}`, health: outpost.health.current })),
      ...workers.map((worker) => ({ id: `worker:${worker.id}`, health: worker.health.current })),
    ]);
    let woundedWorkers = 0;
    for (const id of damaged) {
      if (id === "center") {
        this.notifications.post({
          kind: "center-under-attack",
          text: "Merkeziniz saldırı altında!",
        });
        continue;
      }
      if (id.startsWith("worker:")) {
        woundedWorkers += 1;
        continue;
      }
      this.notifications.post({
        kind: "outpost-under-attack",
        // Keyed per outpost: two outposts under attack are two places the player
        // has to choose between, which is the decision the notice exists to prompt.
        subject: id,
        text: "Karakolunuz saldırı altında.",
      });
    }
    // Deliberately *not* keyed per worker, unlike the outposts. A raid catches
    // whole crews at once, and four workers would be four lines — the entire feed
    // (`MAX_ACTIVE_NOTIFICATIONS`), pushing out the centre warning that is the
    // more urgent of the two. One line that says how many keeps the same
    // information in one slot.
    if (woundedWorkers > 0) {
      this.notifications.post({
        kind: "worker-under-attack",
        text: woundedWorkers > 1
          ? `${woundedWorkers} işçiniz saldırı altında!`
          : "İşçiniz saldırı altında!",
      });
    }
  }

  private assignWorkerToConstruction(structure: PlacedStructure): void {
    const result = this.workerConstruction.assignNearest(structure);
    // Both kingdoms build through this hook, but only the human has a palette:
    // narrating an AI site here would put the AI's problems in the player's HUD.
    if (structure.owner !== PLAYER_OWNER || result.assigned) return;
    this.announce("workers", result.reason === "no-idle-worker"
      ? "İnşaat bekliyor: boşta işçi yok."
      : "İnşaat bekliyor: işçi bu yapıya erişemiyor.", "refused");
  }

  /** Handle a selected Karakol's right-click target order. */
  private orderStructureAttack(structure: PlacedStructure, target: CombatTarget): boolean {
    const result = this.structureDefense.orderAttack(structure, target);
    const message: Record<typeof result, string> = {
      ordered: `${structure.stats.label} hedefe yönlendirildi.`,
      "not-defensive": "Bu yapı saldırı emri veremez.",
      incomplete: "Karakol tamamlanmadan saldırı emri verilemez.",
      "out-of-range": "Hedef Karakol menzilinin dışında.",
    };
    this.announce("orders", message[result], result === "ordered" ? "done" : "refused");
    return true;
  }

  /** Contextual worker order: a foundation builds; a finished producer gathers. */
  private assignSelectedWorkersToStructure(workers: readonly Unit[], structure: PlacedStructure): boolean {
    if (structure.owner !== PLAYER_OWNER) return false;
    if (!structure.construction.complete) {
      const result = this.workerConstruction.assignWorkers(structure, workers);
      if (result.assignedWorkers > 0) {
        this.announce("workers", `${result.assignedWorkers} işçi inşaata atandı.`);
      } else {
        this.announce("workers", result.reason === "unreachable"
          ? "İşçiler bu inşaata erişemiyor."
          : "İnşaat için uygun işçi yok.", "refused");
      }
      return true;
    }
    // A damaged building the worker has nothing else to do at is a repair order.
    // The two gestures cannot both be the right-click, so the tie is broken by
    // what the worker could otherwise be there for: a Farm or a Camp keeps
    // meaning "go and gather" even while damaged (its repair is one click away on
    // the panel), and a House, a Barracks or a wall — where gathering is not a
    // thing — means the only work there is. A repair already running always wins:
    // pointing more workers at it is the player reinforcing their own order.
    if (this.structureRepair.isRepairing(structure)
      || (structure.health.ratio < 1 && !structure.stats.economy)) {
      return this.orderStructureRepair(structure, workers);
    }
    if (!structure.stats.economy || !this.economyProduction) return false;
    // A direct gathering order transfers workers out of construction first.
    for (const worker of workers) this.workerConstruction.release(worker);
    const result = this.economyProduction.assignWorkers(structure, workers);
    if (result.assignedWorkers > 0) {
      this.announce("workers", `${result.assignedWorkers} işçi ${structure.stats.label} görevine atandı.`);
    } else {
      this.announce("workers", "Bu yapıda uygun işçi kontenjanı yok.", "refused");
    }
    return true;
  }

  /** A move, attack, or stop order is an explicit request to leave current work. */
  private releaseWorkerTasks(workers: readonly Unit[]): void {
    for (const worker of workers) {
      this.workerConstruction.release(worker);
      this.economyProduction?.release(worker);
      // A shepherd taken off the job lets go of his animal with him
      // (`PastureSystem.release`), so an ordered-away drive leaves a wild cow
      // rather than one frozen mid-lead.
      this.pasture.release(worker);
    }
  }

  private queueUnit(unitId: string): void {
    const label = this.options.unitBalance[unitId]?.label ?? unitId;
    const stats = this.options.unitBalance[unitId];
    const requiredTier = stats
      ? `${stats.requiredAge === "town" ? this.options.ageBalance.town.label : this.options.ageBalance.settlement.label} Lv${stats.requiredSettlementLevel}`
      : "gerekli kademe";
    const buildingLabel = stats
      ? this.options.buildingBalance[stats.productionBuildingId]?.label ?? stats.productionBuildingId
      : "askerî yapı";
    const result = this.barracksProduction.queueUnit(PLAYER_OWNER, unitId);
    const queuedCount = this.barracksProduction.queuedCount(PLAYER_OWNER);
    const queueCapacity = this.barracksProduction.queueCapacity(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      queued: `${label} üretim kuyruğa alındı (${queuedCount}/${queueCapacity}).`,
      "unknown-unit": `${label} askerî yapıda üretilemiyor.`,
      "no-completed-production-building": `Önce tamamlanmış bir ${buildingLabel} kurun.`,
      "requires-town-age": `${label} Kasaba Çağında açılır.`,
      "requires-production-building-upgrade": `${label} için ${requiredTier} gerekir (Merkezden yükseltin).`,
      "queue-full": `Üretim kuyruğu dolu (${queuedCount}/${queueCapacity}).`,
      "exit-blocked": `${label} çıkışı engelli; ${buildingLabel} çevresini açın.`,
      "insufficient-resources": `${label} için kaynak yetersiz.`,
      "population-full": "Nüfus dolu: önce Ev kurun.",
      "structure-upgrading": `${buildingLabel} seviye yükseltmesi sürerken ${label} üretimi durur.`,
      disconnected: `${buildingLabel} kontrol alanınızın dışında kaldı; üretim durdu.`,
    };
    this.announce("production", message[result], result === "queued" ? "done" : "refused");
    this.syncPlacementUi();
  }

  /**
   * Take the newest order back off the selected building's queue.
   *
   * Scoped to the selection because that is the queue the player is looking at:
   * the ✕ was drawn on *this* building's progress bar, and cancelling at another
   * Barracks would refund an order they never saw placed.
   */
  private cancelLatestUnitOrder(): void {
    const structure = this.selection.selectedStructure();
    if (!structure || structure.owner !== PLAYER_OWNER) return;
    const cancelled = this.barracksProduction.cancelLatestUnit(structure);
    const queue = this.barracksProduction.queueSnapshot(structure);
    if (cancelled) {
      this.announce("production", `${cancelled.label} siparişi iptal edildi; maliyeti iade edildi (${queue.queued}/${queue.capacity}).`);
    } else {
      this.announce("production", `${structure.stats.label} kuyruğunda iptal edilecek sipariş yok.`, "refused");
    }
    this.syncPlacementUi();
  }

  /** The centre's counterpart to {@link cancelLatestUnitOrder}: one worker order back. */
  private cancelWorkerOrder(): void {
    const label = this.options.unitBalance["worker_placeholder"]?.label ?? "İşçi";
    const result = this.workerProduction.cancelWorker(PLAYER_OWNER);
    const queued = this.workerProduction.queuedCount(PLAYER_OWNER);
    const capacity = this.workerQueueCapacity(PLAYER_OWNER);
    const message: Record<WorkerCancelResult, string> = {
      cancelled: `${label} siparişi iptal edildi; maliyeti iade edildi (${queued}/${capacity}).`,
      "not-queued": `Merkez kuyruğunda iptal edilecek ${label} siparişi yok.`,
    };
    this.announce("production", message[result], result === "cancelled" ? "done" : "refused");
    this.syncPlacementUi();
  }

  /**
   * Trade one lot at the Market (plan Faz M2). The panel leaves affordability to
   * the click, so this is where a player who cannot pay finds out — and the
   * answer names the price they were short of rather than a generic refusal,
   * since the price is the thing that moved since they last looked.
   */
  private trade(direction: "buy" | "sell", resourceId: string): void {
    const label = resourceLabel(resourceId);
    const snapshot = this.marketTrade.snapshotFor(PLAYER_OWNER);
    const quote = snapshot?.prices.find((price) => price.resourceId === resourceId);
    const lot = snapshot?.lotSize ?? 0;
    const result = direction === "buy"
      ? this.marketTrade.buy(PLAYER_OWNER, resourceId)
      : this.marketTrade.sell(PLAYER_OWNER, resourceId);
    if (result === "traded") {
      this.playerMarketTrades += 1;
      if (direction === "buy") {
        this.playerMarketPurchases[resourceId] = (this.playerMarketPurchases[resourceId] ?? 0) + lot;
      }
    }
    const message: Record<MarketTradeResult, string> = {
      traded: direction === "buy"
        ? `${lot} ${label} alındı (${quote?.buyPrice ?? 0} altın).`
        : `${lot} ${label} satıldı (+${quote?.sellPrice ?? 0} altın).`,
      "untraded-resource": `${label} Pazar'da işlem görmüyor.`,
      "no-completed-market": "Önce tamamlanmış bir Pazar kurun.",
      disconnected: "Pazar kontrol alanınızın dışında kaldı; ticaret durdu.",
      "out-of-stock": `Pazarda ${lot} ${label} yok; bir arz noktasına yol çekin.`,
      "insufficient-gold": `${lot} ${label} için ${quote?.buyPrice ?? 0} altın gerekir.`,
      "insufficient-resources": `Satmak için ${lot} ${label} gerekir.`,
      "storage-full": "Depolama kapasitesi dolu; Depo kurun veya yükseltin.",
    };
    this.announce("trade", message[result], result === "traded" ? "done" : "refused");
    this.syncPlacementUi();
  }

  private queueWorker(): void {
    const result = this.workerProduction.queueWorker(PLAYER_OWNER);
    const queuedCount = this.workerProduction.queuedCount(PLAYER_OWNER);
    const queueCapacity = this.workerQueueCapacity(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      queued: `İşçi üretim kuyruğa alındı (${queuedCount}/${queueCapacity}).`,
      "queue-full": `İşçi üretim kuyruğu dolu (${queuedCount}/${queueCapacity}).`,
      "insufficient-resources": "İşçi için 50 yiyecek gerekli.",
      "population-full": "Nüfus dolu: önce Ev kurun.",
      "no-command-center": "İşçi üretmek için Merkez gerekli.",
      "center-upgrading": "Merkez Kasaba Çağına yükselirken işçi üretimi durur.",
    };
    this.announce("production", message[result], result === "queued" ? "done" : "refused");
    this.syncPlacementUi();
  }

  private startTownUpgrade(): void {
    // Read before the call: a started upgrade has already reserved the cost, and
    // a shortfall computed after it would be measuring the wrong wallet.
    const cost = this.options.ageBalance.town.cost;
    const before = this.progression.snapshot(PLAYER_OWNER);
    const missing = before.nextAction?.missingBuildingIds ?? [];
    const missingLabels = missing.map((id) => this.buildingLabels.get(id) ?? id);
    const shortfall = formatCostShortfall(cost, this.kingdoms.get(PLAYER_OWNER).wallet.snapshot());
    const result = this.progression.startTownUpgrade(PLAYER_OWNER);
    const snapshot = this.progression.snapshot(PLAYER_OWNER);
    const townLabel = this.options.ageBalance.town.label;
    const message: Record<typeof result, string> = {
      started: `${townLabel} Çağı yükseltmesi başladı (${this.options.ageBalance.town.upgradeSeconds} sn). Merkez işçi üretimi durdu.`,
      "already-town": `Zaten ${townLabel} Çağındasınız.`,
      "already-upgrading": `Merkez ilerlemesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`,
      "no-command-center": `${townLabel} Çağı için Merkez gerekli.`,
      "settlement-level":
        `${townLabel} Çağı için önce ${this.options.ageBalance.settlement.label} Lv3 gerekir (şu an Lv${snapshot.level}).`,
      "missing-requirements": `${townLabel} Çağı için eksik yapılar: ${missingLabels.join(", ")}.`,
      "insufficient-resources": shortfall
        ? `${townLabel} Çağı için ${shortfall} daha gerekli (toplam ${formatResourceCost(cost)}).`
        : `${townLabel} Çağı için kaynak yetersiz (${formatResourceCost(cost)}).`,
    };
    this.announce("progression", message[result], result === "started" ? "done" : "refused");
    this.syncAgeUi();
  }

  /**
   * Start the kingdom's next centre level-up (Lv1→2 / Lv2→3). The whole kingdom
   * advances together on completion; a level-up carries no building prerequisite.
   */
  private startCenterLevelUpgrade(): void {
    const before = this.progression.snapshot(PLAYER_OWNER);
    const action = before.nextAction;
    const targetLabel = action && action.kind === "level"
      ? this.tierLabel(action.targetAge, action.targetLevel)
      : this.tierLabel(before.age, before.level);
    const cost = action?.cost ?? {};
    const shortfall = formatCostShortfall(cost, this.kingdoms.get(PLAYER_OWNER).wallet.snapshot());
    const result = this.progression.startLevelUpgrade(PLAYER_OWNER);
    const snapshot = this.progression.snapshot(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      started: `${targetLabel} yükseltmesi başladı: tamamlanınca tüm yapılarınız gelişir.`,
      "at-max-level": "Krallık en yüksek kademede.",
      "already-upgrading": `Merkez ilerlemesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`,
      "no-command-center": "Seviye yükseltmesi için Merkez gerekli.",
      "insufficient-resources": shortfall
        ? `${targetLabel} için ${shortfall} daha gerekli (toplam ${formatResourceCost(cost)}).`
        : `${targetLabel} için kaynak yetersiz.`,
    };
    this.announce("progression", message[result], result === "started" ? "done" : "refused");
    this.syncAgeUi();
  }

  /**
   * Answer a player command in the notification feed.
   *
   * The build palette's message line used to carry these, which put "Muhafız
   * siparişi iptal edildi" under a panel about *placing buildings* — and only
   * while that panel was open. The split is now by what the text is, not by
   * which panel happened to have a spare row:
   *
   * - The palette's line describes the palette's own modal state: what the next
   *   click will place, and why a pick was refused. It persists because the mode
   *   persists.
   * - Everything that reports the *result* of a command comes here, where the
   *   game's other one-shot news already lives, and expires on its own.
   *
   * {@link subject} is the command family, so a burst of orders in one family
   * (five Üret presses) replaces its own line instead of pushing the feed's four
   * slots full and evicting a "Merkez saldırı altında". A success also retires a
   * live refusal from the same family: the player has just proved it stale.
   */
  private announce(subject: RtsCommandSubject, text: string, tone: "done" | "refused" = "done"): void {
    if (tone === "done") this.notifications.dismiss({ kind: "command-refused", subject });
    this.notifications.post({ kind: tone === "refused" ? "command-refused" : "command", subject, text });
  }

  private syncAgeUi(): void {
    this.buildPalette.setTierState(this.progression.snapshot(PLAYER_OWNER));
  }

}

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
  Scene,
  type WebGLRenderer,
} from "three";

import { createSceneRenderer } from "@engine/render-three/renderer";
import { logger } from "@/game/core/logger";
import type {
  AiBalance,
  AgeBalance,
  AiProfile,
  BuildingBalance,
  ResourceBalance,
  RoadBalance,
  StartingResources,
  StartingUnits,
  UnitBalance,
} from "@/game/data/gameDataTypes";
import { AiController } from "./ai/aiController";
import { formatRtsAiDebug } from "./ai/aiDebugView";
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { RtsPointer } from "./input/rtsPointer";
import { createRtsGround, RTS_WORLD_HALF_EXTENT } from "./world/rtsGround";
import { RTS_PLACEMENT_GRID_SIZE } from "./structures/placementGrid";
import { createRtsMapBlockout, RTS_BLOCKOUT_MAP } from "./world/rtsMapBlockout";
import { RtsMapArt, collectWorldProps } from "./world/rtsMapArt";
import { UnitSystem } from "./units/unitSystem";
import { Unit } from "./units/unit";
import { updateUnitMovement } from "./units/unitMovement";
import { updateUnitSeparation } from "./units/unitSeparation";
import { updateUnitCombat } from "./units/unitCombat";
import { updateUnitDeaths } from "./units/unitDeath";
import { retaliateAgainstAttack, updateUnitEngagement } from "./combat/engagementSystem";
import { ProjectileSystem } from "./combat/projectileSystem";
import { StructureDefenseSystem } from "./combat/structureDefenseSystem";
import type { CombatTarget } from "./combat/combatTarget";
import { RtsNavigation } from "./navigation/rtsNavigation";
import { MarqueeOverlay } from "./selection/marqueeOverlay";
import { SelectionSystem } from "./selection/selectionSystem";
import { CommandMarkerSystem } from "./commands/commandMarker";
import { CommandSystem } from "./commands/commandSystem";
import { CommandCenterSystem } from "./structures/commandCenterSystem";
import { COMMAND_CENTER_MAX_HEALTH, CommandCenter } from "./structures/commandCenter";
import { RtsBuildingVisuals } from "./structures/rtsBuildingVisuals";
import { updateStructureDestruction } from "./structures/structureDestruction";
import { RtsMatchState } from "./match/rtsMatchState";
import { RtsMatchFlow } from "./match/rtsMatchFlow";
import { RtsMatchClock, formatMatchDuration } from "./match/rtsMatchClock";
import { RtsMatchOverlay } from "./match/rtsMatchOverlay";
import { RtsDebugOverlay } from "./debug/rtsDebugOverlay";
import { PlacedStructureSystem, type PlacedStructure } from "./structures/placedStructureSystem";
import { BuildingPlacementSystem } from "./structures/buildingPlacementSystem";
import { StructureConstructionService } from "./structures/structureConstructionService";
import { KingdomRegistry } from "./kingdom/kingdomRegistry";
import { RoadConstructionService } from "./roads/roadConstructionService";
import { RtsBuildPalette } from "./ui/rtsBuildPalette";
import { RtsSelectionPanel } from "./ui/rtsSelectionPanel";
import { RtsWorldProgressOverlay, type RtsWorldProgressEntry } from "./ui/rtsWorldProgressOverlay";
import {
  AGE_UP_ACTION,
  DEMOLISH_ACTION,
  RALLY_ACTION,
  TRADE_BUY_ACTION_PREFIX,
  TRADE_SELL_ACTION_PREFIX,
  TRAIN_ACTION_PREFIX,
  TRAIN_WORKER_ACTION,
  UPGRADE_ACTION,
  type RtsSelectionView,
  type StructureDetailView,
  type StructureUpgradeView,
  type UpgradeGain,
  type WorkerJob,
} from "./ui/rtsSelectionView";
import { RtsGameSpeedControls } from "./ui/rtsGameSpeedControls";
import type { ResourceChange } from "./economy/resourceWallet";
import { EconomyProductionSystem } from "./economy/economyProductionSystem";
import { MarketTradeSystem, type MarketTradeResult } from "./economy/marketTradeSystem";
import { ResourceNodeSystem } from "./economy/resourceNodeSystem";
import { ForestSystem } from "./economy/forestSystem";
import { AgeSystem } from "./progression/ageSystem";
import { DepotLogisticsSystem } from "./economy/depotLogisticsSystem";
import { ProductionLogisticsSystem } from "./economy/productionLogisticsSystem";
import { LogisticsTransferSystem } from "./economy/logisticsTransferSystem";
import { LogisticsOccupationSystem } from "./economy/logisticsOccupationSystem";
import { ResourceCapacitySystem } from "./economy/resourceCapacitySystem";
import { roadCellTouchingFootprint } from "./economy/depotLogisticsSystem";
import { WorkerConstructionSystem } from "./units/workerConstructionSystem";
import type { UnitOwner } from "./units/unit";
import { BarracksProductionSystem, unitQueueCapacityForBuildingLevel } from "./structures/barracksProductionSystem";
import { WorkerProductionSystem, workerQueueCapacityForCenterLevel } from "./structures/workerProductionSystem";
import { StructureUpgradeSystem, type UpgradableStructure } from "./structures/structureUpgradeSystem";
import { RoadGraph } from "./roads/roadGraph";
import { RoadDebugView } from "./roads/roadDebugView";
import { RoadPlacementSystem } from "./roads/roadPlacementSystem";
import { simulationSteps, type RtsSimulationSpeed } from "./simulation/simulationSpeed";
import { RtsRoadControls } from "./ui/rtsRoadControls";
import { RtsHudBar } from "./ui/rtsHudBar";
import { RtsNotificationCenter } from "./ui/rtsNotifications";
import { RtsNotificationFeed } from "./ui/rtsNotificationFeed";
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
import { FogView } from "./vision/fogView";
import { GhostStructureView } from "./vision/ghostStructureView";
import { FogVisibilityBinder } from "./vision/fogVisibilityBinder";
import { VisionSystemAiFilter } from "./ai/aiVisionFilter";
import { formatVisionDebug } from "./vision/formatVisionDebug";
import { RtsObjectiveTracker } from "./ui/rtsObjectiveTracker";
import type { AiObjectiveWatch } from "./ai/armyManager";

const MAX_PIXEL_RATIO = 2;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
const SCENE_BACKGROUND = "#20262b";
const PLACEHOLDER_GUARD_ID = "guard_placeholder";
const PLACEHOLDER_WORKER_ID = "worker_placeholder";
/** Both camps open with equal standing defence. */
const STARTING_GUARD_COUNT = 3;
/**
 * Both kingdoms start with the same workers: the AI cannot run the economy
 * (AI design §34/§35) without them, and §39 requires it to earn everything else
 * through the same buildings and costs the player pays. Both camps also begin
 * with the same small Guard force, so neither gets a free opening advantage.
 */
const STARTING_WORKER_COUNT = 5;
const SETTLEMENT_POPULATION_CAPACITY = 20;
const PLAYER_CENTER_POSITION = RTS_BLOCKOUT_MAP.playerStart;
const ENEMY_CENTER_POSITION = RTS_BLOCKOUT_MAP.enemyStart;
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
const OPENING_FOCUS = {
  x: PLAYER_CENTER_POSITION.x * (1 - OPENING_FOCUS_PULL_TOWARD_CENTER),
  z: PLAYER_CENTER_POSITION.z * (1 - OPENING_FOCUS_PULL_TOWARD_CENTER),
};
/** Faz 5.0: both kingdoms run the same economy; only this one has a UI. */
const KINGDOM_OWNERS: readonly UnitOwner[] = ["player", "enemy"];
const PLAYER_OWNER: UnitOwner = "player";
/** How long a building's health bar stays up after the last hit it took. */
const HEALTH_BAR_LINGER_SECONDS = 6;
/**
 * Linger key for the command centre. Negative because {@link PlacedStructureSystem}
 * hands out positive ids, so the centre can share the map without colliding with
 * a building.
 */
const CENTER_HEALTH_BAR_KEY = -1;
/** Faz 5: the kingdom the AI opponent plays (plan §37). */
const AI_OWNER: UnitOwner = "enemy";

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
   * `?flags=fogOfWar` (§59, Faz 11): unknown / explored / visible layers, for
   * both kingdoms. Symmetric on purpose — see `ai/aiVisionFilter.ts`.
   */
  readonly fogOfWarEnabled?: boolean;
  /** JSON-backed placeholder unit stats until full unit data is introduced. */
  readonly unitBalance: UnitBalance;
  /** JSON-backed footprint/cost/build-time definitions introduced in Faz 2. */
  readonly buildingBalance: BuildingBalance;
  /** Faz 6 finite stone/gold deposit profiles; consumed by the quarry/mine slice. */
  readonly resourceBalance: ResourceBalance;
  /** Faz 6 Settlement -> Town cost, prerequisites and upgrade duration. */
  readonly ageBalance: AgeBalance;
  /** Preset-owned initial stockpile for Phase 2 construction reservations. */
  readonly startingResources: StartingResources;
  /** Preset override for the opening forces; unset keys keep the defaults. */
  readonly startingUnits?: StartingUnits;
  /** Test-preset handicap: enemy-only stockpile/forces (see `GamePreset`). */
  readonly enemyStartingResources?: StartingResources;
  readonly enemyStartingUnits?: StartingUnits;
  /** Data-owned grid and wood cost for the Phase 4 road graph. */
  readonly roadBalance: RoadBalance;
  /** Data-owned AI cadences, thresholds and intent weights (Faz 5). */
  readonly aiBalance: AiBalance;
  /** Difficulty profile the enemy kingdom runs with (AI design §70). */
  readonly aiProfile: AiProfile;
}

export class RtsApp {
  private readonly renderer: WebGLRenderer;
  private readonly buildingVisuals: RtsBuildingVisuals;
  private readonly mapArt: RtsMapArt;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly units = new UnitSystem();
  private readonly centers = new CommandCenterSystem();
  private readonly structures = new PlacedStructureSystem();
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
  private readonly ages: AgeSystem;
  private readonly ai: AiController;
  private readonly structureConstruction: StructureConstructionService;
  private readonly roadConstruction: RoadConstructionService;
  private readonly workerConstruction: WorkerConstructionSystem;
  private economyProduction: EconomyProductionSystem | null = null;
  private readonly resourceNodes: ResourceNodeSystem;
  private readonly forests: ForestSystem;
  private readonly depotLogistics: DepotLogisticsSystem;
  private readonly productionLogistics: ProductionLogisticsSystem;
  private readonly logisticsOccupation: LogisticsOccupationSystem;
  private readonly resourceCapacity: ResourceCapacitySystem;
  private readonly logisticsTransfers: LogisticsTransferSystem;
  private readonly barracksProduction: BarracksProductionSystem;
  private readonly marketTrade: MarketTradeSystem;
  private readonly workerProduction: WorkerProductionSystem;
  private readonly structureUpgrades: StructureUpgradeSystem;
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
  private readonly objectiveTracker: RtsObjectiveTracker | null;
  private readonly match = new RtsMatchState();
  /** §51: whether the simulation should be running; `match` owns who won. */
  private readonly flow = new RtsMatchFlow();
  /** §53: how long it has been running, in simulation time — Kapı B's instrument. */
  private readonly clock = new RtsMatchClock();
  private readonly matchOverlay: RtsMatchOverlay;
  private readonly debugOverlay: RtsDebugOverlay | null;
  private readonly navigation = new RtsNavigation();
  private readonly marquee = new MarqueeOverlay();
  private readonly commandMarkers = new CommandMarkerSystem();
  private readonly pointer: RtsPointer;
  private readonly selection: SelectionSystem;
  private readonly commands: CommandSystem;
  private readonly placement: BuildingPlacementSystem;
  private readonly roadPlacement: RoadPlacementSystem;
  private readonly buildPalette: RtsBuildPalette;
  private readonly selectionPanel = new RtsSelectionPanel((id) => this.runSelectionAction(id));
  /** The building whose demolish is armed and awaiting its confirm click. */
  private demolishArmed: PlacedStructure | null = null;
  /** Per-building last-seen health and how long its bar still has to live. */
  private readonly healthBarLinger = new Map<number, { health: number; remaining: number }>();
  private readonly worldProgressOverlay = new RtsWorldProgressOverlay();
  private buildingLabelCache: ReadonlyMap<string, string> | null = null;
  private readonly projectiles = new ProjectileSystem();
  private readonly structureDefense = new StructureDefenseSystem();
  private readonly roadControls: RtsRoadControls;
  private readonly hudBar = new RtsHudBar(
    () => this.selectIdleWorkers(),
    () => this.assignSelectedIdleWorkers(),
    () => this.togglePause(),
  );
  private readonly notifications = new RtsNotificationCenter();
  private readonly notificationFeed = new RtsNotificationFeed();
  /** §51 "saldırı altında": combat has no event bus, so health is sampled. */
  private readonly attackWatch = new RtsAttackWatch();
  private readonly gameSpeedControls: RtsGameSpeedControls;
  private readonly unsubscribeWalletChanges: (() => void) | null;
  private readonly log = logger("System");
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private disposed = false;
  private simulationSpeed: RtsSimulationSpeed = 1;
  private roadOverlayVisible = false;
  /** Armed by the palette's rally button; the next left-click on the map sets it. */
  private rallyPointPending = false;
  private lastW = 0;
  private lastH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RtsAppOptions,
  ) {
    this.renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
    this.buildingVisuals = new RtsBuildingVisuals(this.renderer);
    this.mapArt = new RtsMapArt(this.renderer);
    this.roads = new RoadGraph(this.options.roadBalance);
    this.roadDebugView = new RoadDebugView(this.roads);
    this.roadOverlayVisible = Boolean(this.options.debug);
    this.roadDebugView.root.visible = this.roadOverlayVisible;
    this.depotLogistics = new DepotLogisticsSystem(this.structures, this.roads);
    this.resourceCapacity = new ResourceCapacitySystem(this.structures);
    this.logisticsOccupation = new LogisticsOccupationSystem(this.depotLogistics);
    this.productionLogistics = new ProductionLogisticsSystem(this.structures, this.roads, this.depotLogistics, this.territory, this.logisticsOccupation);
    this.resourceNodes = new ResourceNodeSystem(this.options.resourceBalance, RTS_BLOCKOUT_MAP.resourceNodes);
    this.forests = new ForestSystem(RTS_BLOCKOUT_MAP.trees);
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
    this.ages = new AgeSystem(KINGDOM_OWNERS, this.options.ageBalance, this.centers, this.structures, this.kingdoms);
    // §58. Built here — before the AI, which reads the objective watch — and
    // only when the flag is on, so `regionalVictory` off means these four are
    // null and nothing downstream ever asks them anything.
    if (this.options.regionalVictoryEnabled) {
      this.strategicPoints = new StrategicPointSystem(
        RTS_BLOCKOUT_MAP.strategicPoints,
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
      this.ghostStructures = new GhostStructureView(this.enemyMemory, PLAYER_OWNER);
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
      this.ghostStructures = null;
      this.fogVisibility = null;
    }
    this.structureUpgrades = new StructureUpgradeSystem(
      this.structures,
      this.kingdoms,
      (owner) => this.ages.snapshot(owner).age,
      // The centre levels on the same ladder as every other building; it is just
      // not a placed structure, so the system has to be told where to find it.
      (owner) => {
        const center = this.centers.get(owner);
        return center ? [center] : [];
      },
    );
    this.scene.background = new Color(SCENE_BACKGROUND);
    this.input = new RtsInput(canvas);
    this.selection = new SelectionSystem(
      canvas,
      this.cameraController.camera,
      this.units,
      this.marquee,
      this.structures,
      this.centers,
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
    this.workerConstruction = new WorkerConstructionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => this.economyProduction?.isAssigned(worker) ?? false,
      (structure) => {
        if (structure.stats.territory) this.territory.refresh();
      },
      (worker, source) => source === "manual"
        ? this.economyProduction?.release(worker) ?? false
        : this.economyProduction?.releaseAutomatic(worker) ?? false,
    );
    this.economyProduction = new EconomyProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => this.workerConstruction.stateFor(worker) !== "idle",
      this.resourceNodes,
      this.forests,
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
      (structure) => this.structureUpgrades.isUpgrading(structure),
      (structure) => structure.queueCapacity ?? unitQueueCapacityForBuildingLevel(structure.level),
      // Plan §45: a Barracks whose ground has been taken stops training, the
      // same severance rule the economy's producers already live under.
      (structure) => this.territory.ownerAt(structure.x, structure.z) === structure.owner,
      PLACEHOLDER_GUARD_ID,
      (owner) => this.ages.snapshot(owner).age,
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
    this.workerProduction = new WorkerProductionSystem(
      this.units,
      this.centers,
      this.navigation,
      worker,
      this.kingdoms,
      (owner) => this.ages.isUpgrading(owner),
      (owner) => this.centers.get(owner)?.workerTrainingSeconds ?? worker.trainingSeconds,
      (owner) => this.workerQueueCapacity(owner),
    );
    this.structureConstruction = new StructureConstructionService(
      this.options.buildingBalance,
      this.structures,
      this.kingdoms,
      this.navigation,
      () => this.navigationBlockers(),
      this.territory,
      (structure) => {
        this.applyConstructionVisual(structure);
        this.assignWorkerToConstruction(structure);
      },
      (structure) => this.workerConstruction.cancelStructure(structure),
      (stats, x, z) => stats.economy?.requiresResourceNode
        && !this.resourceNodes.canExtractAt(
          stats.economy.resourceId,
          x,
          z,
          stats.footprint.width,
          stats.footprint.depth,
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
          : null,
      () => this.roads.occupancyBlockers(),
      () => this.units.all(),
    );
    this.roadConstruction = new RoadConstructionService(
      this.roads,
      this.kingdoms,
      () => this.navigationBlockers(),
      () => {
        this.roadPlacement.renderNetwork();
        // A committed road can link an outpost to its main network, which grows
        // that outpost's control radius. This lives on the service rather than
        // the pointer handler so an AI-built road refreshes territory too.
        this.territory.refresh();
      },
    );
    // Built last among the AI's dependencies: it drives the very same
    // construction/production services the player's UI does (AI design §4).
    this.ai = new AiController({
      owner: AI_OWNER,
      units: this.units,
      structures: this.structures,
      centers: this.centers,
      kingdoms: this.kingdoms,
      production: this.economyProduction,
      logistics: this.productionLogistics,
      ages: this.ages,
      townCost: this.options.ageBalance.town.cost,
      townRequiredBuildingIds: this.options.ageBalance.town.requiredBuildingIds,
      unitIdForRole: (role) => Object.entries(this.options.unitBalance)
        .find(([, stats]) => stats.role === role)?.[0] ?? null,
      marketTrade: this.marketTrade,
      isWorkerBusy: (unit) => this.workerConstruction.stateFor(unit) !== "idle"
        || (this.economyProduction?.isAssigned(unit) ?? false),
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
      anchors: RTS_BLOCKOUT_MAP.enemyBaseAnchors,
      baseRoute: RTS_BLOCKOUT_MAP.enemyBaseRoute,
      expansions: RTS_BLOCKOUT_MAP.enemyExpansions,
      construction: this.structureConstruction,
      roadConstruction: this.roadConstruction,
      workerProduction: this.workerProduction,
      barracksProduction: this.barracksProduction,
      structureUpgrades: this.structureUpgrades,
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
        this.structureUpgrades.levelFor(PLAYER_OWNER, buildingId),
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
        const requiredAge = this.options.buildingBalance[id]?.requiredAge;
        if (requiredAge === "town" && this.ages.snapshot(PLAYER_OWNER).age !== "town") {
          this.buildPalette.setActionMessage("Okçuluk Alanı Kasaba Çağında açılır.");
          return;
        }
        this.roadPlacement.cancel();
        this.syncRoadUi();
        this.placement.begin(id);
        this.syncPlacementUi();
      },
      () => {
        this.placement.cancel();
        this.syncPlacementUi();
      },
      () => {
        this.placement.cancelLatestConstruction();
        this.selection.reconcileStructures(this.structures.all());
        this.buildPalette.setActionMessage(null);
        this.syncPlacementUi();
      },
    );
    this.roadControls = new RtsRoadControls(
      () => {
        this.placement.cancel();
        this.roadPlacement.begin();
        this.syncPlacementUi();
        this.syncRoadUi();
      },
      () => {
        this.roadPlacement.cancel();
        this.syncRoadUi();
      },
      () => {
        this.roadOverlayVisible = !this.roadOverlayVisible;
        this.roadDebugView.root.visible = this.roadOverlayVisible;
        this.roadControls.setOverlayVisible(this.roadOverlayVisible);
      },
    );
    this.roadControls.setOverlayVisible(this.roadOverlayVisible);
    this.gameSpeedControls = new RtsGameSpeedControls(1, (speed) => {
      this.simulationSpeed = speed;
    });
    this.hudBar.mountUtilityControl(this.gameSpeedControls);
    this.matchOverlay = new RtsMatchOverlay({
      onStart: this.beginMatch,
      onResume: this.resumeMatch,
      onRestart: this.restartMatch,
      onSurrender: this.surrenderMatch,
      // Applied live while the card is up: §51's pause deliberately keeps the
      // camera running, so the player can judge the dial by moving the map.
      onCameraSettings: (settings) => this.cameraController.setSettings(settings),
    });
    this.debugOverlay = this.options.debug ? new RtsDebugOverlay() : null;
    if (this.options.prosperityDebugEnabled) {
      this.debugOverlay?.setProgressionLines([
        "Refah: bilgi metriği etkin; çağ ve üretim için gereksinim değildir.",
      ]);
    }
    // Affordability is a live wallet-derived UI state. Previously this listener
    // existed only for the optional debug log, so a card could remain faded
    // after income arrived until any palette click happened to refresh it.
    this.unsubscribeWalletChanges = this.playerKingdom.wallet.subscribe((change: ResourceChange) => {
      this.debugOverlay?.recordResourceChange(change);
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
          this.placement.confirmAt(x, y);
          this.syncPlacementUi();
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
          this.placement.confirmAt(rect.x1, rect.y1);
          this.syncPlacementUi();
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
        // Both placement tools persist after a successful left-click so players
        // can keep building. A contextual right-click exits the active tool
        // before it can be interpreted as a unit command.
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
    // A completed type-wide research also applies to buildings that finish
    // afterwards; the visual must be created at that inherited level.
    this.structures.setCompletedVisualHandler((structure) => {
      this.structureUpgrades.applyCompletedUpgrade(structure);
      this.applyStructureVisual(structure, true);
    });
    void this.loadBuildingVisuals();
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
    this.resize();
    this.lastTime = performance.now();
    this.log.info(
      `RTS runtime started${this.options.debug ? " (debug)" : ""}`,
    );
    // The runtime is live but the match is not: §51's start screen holds the
    // simulation until the player asks for it. The scene still renders behind
    // the card, so the opening position is something they can look at first.
    this.matchOverlay.showStart();
    this.frameHandle = requestAnimationFrame(this.onFrame);
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.input.detach();
    this.pointer.detach();
    this.marquee.dispose();
    this.matchOverlay.dispose();
    this.debugOverlay?.dispose();
    this.unsubscribeWalletChanges?.();
    this.buildPalette.dispose();
    this.selectionPanel.dispose();
    this.worldProgressOverlay.dispose();
    this.projectiles.dispose();
    this.roadControls.dispose();
    this.hudBar.dispose();
    this.notificationFeed.dispose();
    this.gameSpeedControls.dispose();
    this.placement.dispose();
    this.roadPlacement.dispose();
    this.roadDebugView.dispose();
    this.territory.dispose();
    this.strategicPointView?.dispose();
    // Reveal before disposing: the binder set `visible = false` on live scene
    // objects, and tearing the fog down without undoing that would leave them
    // permanently invisible to whatever renders next.
    this.fogVisibility?.revealAll();
    this.fogView?.dispose();
    this.ghostStructures?.dispose();
    this.objectiveTracker?.dispose();
    this.workerConstruction.reset();
    this.barracksProduction.reset();
    this.workerProduction.reset();
    this.structures.clear();
    this.centers.clear();
    this.buildingVisuals.dispose();
    this.mapArt.dispose();
    this.renderer.dispose();
  }

  private async loadBuildingVisuals(): Promise<void> {
    try {
      await this.buildingVisuals.load();
      if (this.disposed) return;
      this.placement.setPreviewFactory((buildingId, width, depth) =>
        this.buildingVisuals.createPreviewForBuilding(
          buildingId,
          width,
          depth,
          this.ageOf(PLAYER_OWNER),
          this.structureUpgrades.levelFor(PLAYER_OWNER, buildingId),
        ));
      for (const center of this.centers.all()) this.buildingVisuals.applyToCenter(center, this.ageOf(center.owner));
      for (const structure of this.structures.all()) {
        if (structure.construction.complete) this.applyStructureVisual(structure);
        else this.applyConstructionVisual(structure);
      }
    } catch (error) {
      // Keep the original construction visuals usable if an optional art asset
      // is unavailable in a development build or an interrupted reload.
      this.log.warn("First Age RTS building models could not be loaded", error);
    }
  }

  private buildScene(): void {
    // Hemispheric-ish fill: ambient for base visibility, one shadowing key light.
    this.scene.add(new AmbientLight(0xffffff, 0.65));
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

    this.scene.add(createRtsGround());
    const blockout = createRtsMapBlockout();
    this.scene.add(blockout);
    void this.loadMapArt(blockout);
    this.spawnCenters();
    this.cameraController.setFocus(OPENING_FOCUS.x, OPENING_FOCUS.z);
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.scene.add(this.centers.root);
    this.scene.add(this.structures.root);
    this.scene.add(this.placement.root);
    this.scene.add(this.roadPlacement.root);
    this.scene.add(this.roadDebugView.root);
    this.scene.add(this.territory.root);
    if (this.strategicPointView) this.scene.add(this.strategicPointView.root);
    // §59, after the ground overlays it has to cover and before the units it
    // must not: fogged units are hidden outright by the visibility binder, not
    // occluded by this plane.
    if (this.fogView) this.scene.add(this.fogView.root);
    if (this.ghostStructures) this.scene.add(this.ghostStructures.root);
    this.scene.add(this.units.root);
    this.scene.add(this.projectiles.root);
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
    };
    spawnSide("player", player, PLAYER_CENTER_POSITION, 1);
    spawnSide("enemy", enemy, ENEMY_CENTER_POSITION, -1);
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS));
    this.lastTime = now;

    this.resize();
    this.consumeCommandInput();
    // The camera keeps running while paused and on the start screen: looking at
    // the map is not playing the match, and freezing it would trap the player
    // staring at whatever the last frame happened to show.
    this.cameraController.update(dt, this.input);
    if (this.match.active && this.flow.running) {
      for (const simulationDt of simulationSteps(dt, this.simulationSpeed, MAX_FRAME_SECONDS)) {
        if (!this.match.active) break;
        this.commands.update(simulationDt);
        this.updateSimulation(simulationDt);
      }
    }
    if (this.debugOverlay) {
      this.debugOverlay.setElapsedSeconds(this.clock.seconds);
      // §59. Recomputing the source list here costs one array build per rendered
      // frame, which is why it only happens when the overlay is actually up.
      if (this.vision && this.enemyMemory) {
        this.debugOverlay.setVisionLines(formatVisionDebug(
          this.vision,
          this.enemyMemory,
          this.collectVisionSources().length,
          this.clock.seconds,
        ));
      }
      this.debugOverlay.setAiLines(
        formatRtsAiDebug(
          this.ai.snapshot(),
          this.ai.log.recent(),
          this.ai.economyMultiplier,
          this.options.aiBalance,
        ),
      );
    }
    this.debugOverlay?.update(
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
    this.roadDebugView.refresh();
    this.commandMarkers.update(dt);
    this.structures.updateVisualAnimations(dt);
    this.updateHealthBarLinger(dt);
    this.updateWorldProgressOverlay();
    // Presentation runs on the rendered-frame delta, not the simulation's: a
    // tracer and a health bar should look the same at any game speed.
    this.projectiles.update(dt);
    this.units.updatePresentation(this.cameraController.camera.quaternion);
    this.selectionPanel.setSelection(this.selectionView());
    // Notices expire on real seconds for the same reason a health bar animates
    // on them: at §38's 8x test speed a warning that vanished eight times faster
    // would be unreadable exactly when the match is hardest to follow.
    this.notifications.advance(dt);
    this.notificationFeed.setNotifications(this.notifications.active());
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  /** Present player construction, training, and damaged-building health above all world geometry. */
  /**
   * Keep a building's health bar up for a few seconds after it is hit, then let
   * it go (plan §64 "seçim ve sağlık göstergeleri").
   *
   * Bars used to stay up for as long as a building was below full health, on the
   * reasoning that buildings do not regenerate so the information stays true.
   * True, but it made a besieged base indistinguishable from one that took a
   * stray arrow an hour ago: a dozen permanent bars, none of them urgent. A bar
   * that appears when a building is *being hit* is the thing the player has to
   * react to, and the standing health figure is still one click away in the
   * selection panel.
   *
   * Damage is detected by watching health fall rather than by a combat hook,
   * because every source that can hurt a building — siege, defence fire, a razed
   * neighbour — already lands on the same value, and one observer cannot miss a
   * path the way a set of call sites can. Real seconds, not simulation ones, for
   * the reason the surrounding presentation code gives: at 8x a warning that
   * expired eight times faster would be unreadable when it matters most.
   */
  private updateHealthBarLinger(dt: number): void {
    const seen = new Set<number>();
    const observe = (key: number, current: number): void => {
      seen.add(key);
      const previous = this.healthBarLinger.get(key);
      const remaining = previous && current < previous.health
        ? HEALTH_BAR_LINGER_SECONDS
        : Math.max(0, (previous?.remaining ?? 0) - dt);
      this.healthBarLinger.set(key, { health: current, remaining });
    };
    for (const structure of this.structures.all()) observe(structure.id, structure.health.current);
    const center = this.centers.get(PLAYER_OWNER);
    if (center) observe(CENTER_HEALTH_BAR_KEY, center.health.current);
    // Drop razed buildings so a rebuilt one on a recycled id cannot inherit a
    // stale bar — and so the map does not grow for a whole match.
    for (const key of [...this.healthBarLinger.keys()]) {
      if (!seen.has(key)) this.healthBarLinger.delete(key);
    }
  }

  /** True while a building was hit recently enough to still warrant a bar. */
  private healthBarVisible(key: number): boolean {
    return (this.healthBarLinger.get(key)?.remaining ?? 0) > 0;
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
    const age = this.ages.snapshot(PLAYER_OWNER);
    const queue = this.workerProduction.queueSnapshot(PLAYER_OWNER);
    if (center && queue.trainingRemainingSeconds !== null) {
      const duration = center.workerTrainingSeconds ?? trainingSeconds;
      entries.push({
        id: "player-worker-production",
        x: center.position.x,
        y: 9,
        z: center.position.z,
        progress: 1 - Math.min(1, queue.trainingRemainingSeconds / duration),
        // The age upgrade pauses this queue, so its bar would otherwise sit
        // frozen under the age's with nothing to explain why it stopped.
        label: age.upgrading
          ? `İşçi duraklatıldı · ${queue.queued}/${queue.capacity}`
          : `İşçi üretiliyor · ${queue.queued}/${queue.capacity}`,
      });
    }
    for (const structure of this.structures.all()) {
      // The overlay is screen-space, so it must keep the same ownership boundary
      // as construction progress: enemy damage or production cannot be read
      // through fog merely because its DOM node is not occluded by the world.
      if (structure.owner !== PLAYER_OWNER) continue;

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
      if (!structure.health.depleted && structure.health.ratio < 1 && this.healthBarVisible(structure.id)) {
        entries.push({
          id: `structure-health-${structure.id}`,
          x: structure.x,
          y: queue.trainingRemainingSeconds !== null ? 7 : 8.5,
          z: structure.z,
          progress: structure.health.ratio,
          label: `Can ${Math.ceil(structure.health.current)}/${Math.ceil(structure.health.max)}`,
          variant: "health",
        });
      }
    }
    if (center && !center.health.depleted && center.health.ratio < 1 && this.healthBarVisible(CENTER_HEALTH_BAR_KEY)) {
      entries.push({
        id: "player-command-center-health",
        x: center.position.x,
        y: age.upgrading ? 7 : queue.trainingRemainingSeconds !== null ? 7.5 : 9,
        z: center.position.z,
        progress: center.health.ratio,
        label: `Can ${Math.ceil(center.health.current)}/${Math.ceil(center.health.max)}`,
        variant: "health",
      });
    }
    // The age is the longest thing the player ever waits on and the only one
    // with no field presence at all — it ran for 105 seconds visible nowhere
    // but the selection panel, which is closed whenever they are doing anything
    // else. It sits above the worker bar because it outranks it: it is what
    // paused it.
    if (center && age.upgrading) {
      const duration = this.options.ageBalance.town.upgradeSeconds;
      entries.push({
        id: "player-age-upgrade",
        x: center.position.x,
        y: 11,
        z: center.position.z,
        progress: duration > 0 ? 1 - Math.min(1, age.remainingSeconds / duration) : 0,
        label: `Kasaba Çağı · ${Math.ceil(age.remainingSeconds)} sn`,
      });
    }
    this.worldProgressOverlay.update(this.cameraController.camera, this.canvas.clientWidth, this.canvas.clientHeight, entries);
  }

  /**
   * Drain this frame's edge-triggered orders. Attack-move needs a map position,
   * so it uses the live pointer — the same place a right-click would have read.
   */
  private consumeCommandInput(): void {
    // Drained before the unit orders: pause is about the match, not the
    // selection, and it must answer even when the simulation is frozen.
    if (this.input.consumeCommand("pause")) this.togglePause();
    if (this.input.consumeStopRequest()) this.commands.issueStop();
    if (this.input.consumeCommand("hold")) this.commands.issueStance("hold");
    if (this.input.consumeCommand("aggressive")) this.commands.issueStance("aggressive");
    if (this.input.consumeCommand("selectIdleWorkers")) this.selectIdleWorkers();
    if (this.input.consumeCommand("assignIdleWorkers")) this.assignSelectedIdleWorkers();
    if (!this.input.consumeCommand("attackMove")) return;
    const pointer = this.input.pointerPosition();
    if (pointer) this.commands.issueAttackMoveAt(pointer.x, pointer.y);
  }

  /** Every damageable thing on the field, for target acquisition. */
  private combatTargets() {
    return [...this.units.all(), ...this.centers.all(), ...this.structures.all()];
  }

  private commitRallyPoint(x: number, y: number): void {
    const point = this.commands.groundPointAt(x, y);
    this.rallyPointPending = false;
    if (!point) {
      this.buildPalette.setActionMessage("Toplanma noktası için harita üzerinde bir konum seçin.");
      return;
    }
    this.barracksProduction.setRallyPoint(PLAYER_OWNER, point);
    this.commandMarkers.spawn(point, "#8fe08f");
    this.buildPalette.setActionMessage("Toplanma noktası belirlendi.");
  }

  /** Advance match systems; camera and UI keep the unscaled rendered-frame delta. */
  private updateSimulation(dt: number): void {
    // Aged on the same step as the systems below, which is what makes it a
    // simulation clock rather than a stopwatch: it scales with §38's speed and
    // stops on pause because it is only ever ticked from here (§53).
    this.clock.advance(dt);
    this.kingdoms.advance(dt);
    for (const event of this.ages.update(dt)) {
      if (event.type === "completed") {
        // KR-03: the age is the milestone. Every one of the owner's buildings
        // drops to Level 1 and re-skins into the new age family (Settlement ->
        // First Age, Town -> Second Age), and any in-flight level-up is refunded.
        this.rebuildForAge(event.owner);
        const center = this.centers.get(event.owner);
        if (center) this.buildingVisuals.applyToCenter(center, this.ageOf(center.owner));
        this.territory.refresh();
      }
      // §51 wants the AI's age-up called out, and only this event knows it: the
      // player has no other honest way to learn the opponent got stronger
      // (there is no fog yet, but scanning the enemy base is not a HUD).
      if (event.owner !== PLAYER_OWNER) {
        if (event.type === "completed") {
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
          text: `${this.options.ageBalance.town.label} Çağı tamamlandı: tüm binalarınız Kasaba Lv1 değerlerine yükseldi.`,
        });
      }
      this.buildPalette.setActionMessage(event.type === "completed"
        ? "Kasaba Çağı tamamlandı."
        : "Merkez yıkıldığı için çağ yükseltmesi iptal edildi; kaynaklar iade edildi.");
    }
    for (const event of this.structureUpgrades.update(dt)) {
      // The world consequences of a level-up belong to whichever kingdom bought
      // it — the AI levels the same way, and a Level 2 outpost of its own has to
      // claim its wider radius exactly as the player's does.
      if (event.type === "completed") {
        for (const structure of event.structures) this.applyUpgradedVisual(structure);
        this.placement.refreshPreview();
      }
      if (event.structures.some((structure) => structure.stats.territory)) this.territory.refresh();
      // Only the message is the player's; the AI has the debug panel instead.
      if (event.structure.owner !== PLAYER_OWNER) continue;
      this.buildPalette.setActionMessage(event.type === "completed"
        ? `${event.structure.stats.label} Lv${event.level} yükseltmesi tamamlandı.`
        : `${event.structure.stats.label} yıkıldığı için yükseltme iptal edildi; kaynaklar iade edildi.`);
    }
    // Acquisition before movement: a unit that picks up a target this tick
    // should start walking toward it on the same tick, not the next one.
    updateUnitEngagement(this.units.all(), {
      navigation: this.navigation,
      targets: this.combatTargets(),
    });
    updateUnitMovement(this.units.all(), dt, { navigation: this.navigation });
    // Separation runs after movement so it corrects the overlap this frame's
    // steps actually created, rather than one frame of stale positions.
    updateUnitSeparation(this.units.all(), dt, { navigation: this.navigation });
    this.workerConstruction.update(dt);
    this.economyProduction?.update(dt);
    this.syncForestVisibility();
    this.logisticsTransfers.update();
    // Only the human kingdom's production narrates into the build palette; the
    // AI's own queue events are surfaced by its decision log in a later slice.
    for (const event of this.workerProduction.update(dt)) {
      if (event.owner !== PLAYER_OWNER) continue;
      this.buildPalette.setActionMessage(event.type === "completed"
        ? "Yeni işçi Merkez'den çıktı."
        : "İşçi çıkışı engelli; Merkez çevresini açın.");
    }
    for (const event of this.barracksProduction.update(dt)) {
      if (event.structure.owner !== PLAYER_OWNER) continue;
      this.buildPalette.setActionMessage(
        event.type === "completed"
          ? `${event.label} ${event.structure.stats.label}'ndan çıktı.`
          : `${event.label} çıkışı engelli; ${event.structure.stats.label} çevresini açın.`,
      );
    }
    // The AI decides on the same scaled match delta as every other system, so
    // the game-speed control accelerates it too (plan §38 test mode).
    this.ai.update(dt);
    this.syncHudBar();
    this.syncAgeUi();
    this.syncEconomyUi();
    this.syncNotifications();
    updateUnitCombat(
      this.units.all(),
      dt,
      (hit) => {
        this.debugOverlay?.recordHit(hit);
        if (hit.ranged) this.projectiles.spawn(hit.attacker.owner, hit.attacker.position, hit.target.position);
        if (hit.target instanceof Unit) {
          retaliateAgainstAttack(hit.target, hit.attacker, this.navigation);
        }
      },
    );
    this.structureDefense.update(this.structures.all(), this.combatTargets(), dt, (hit) => {
      // A completed Karakol is two Archer attacks at once. Offset the two
      // tracers very slightly so the volley reads as two arrows rather than one.
      this.projectiles.spawn(
        hit.attacker.owner,
        hit.attacker.position,
        hit.target.position,
        3.2,
        hit.arrowIndex === 0 ? -0.14 : 0.14,
      );
    });
    updateUnitDeaths(this.units, this.selection, dt);
    this.destroyRuinedStructures();
    // §59, before the objectives below and before anything reads the AI: fog is
    // the lens every other system's enemy reads pass through this tick, so it
    // has to be current first. It runs after the deaths/demolitions above for
    // the same reason §58 does — a dead scout stops revealing on the tick it
    // dies, not the tick after.
    this.updateFogOfWar();
    // §58, after the deaths and demolitions this tick: a point whose holding
    // outpost just fell has already stopped being held by the time it is scored.
    this.updateRegionalVictory(dt);
    const outcome = this.match.update(this.centers);
    // Resolved second, so a centre razed on the same tick keeps the more
    // specific reason — `resolveRegionalControl` is a no-op on a decided match.
    const regional = this.match.resolveRegionalControl(this.regionalVictory?.winner() ?? null);
    if (this.match.outcome !== "active" && (outcome !== "active" || regional)) {
      this.log.info(`Match ended: ${this.match.outcome} (${this.match.reason})`);
      this.showMatchResult();
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
    this.ghostStructures?.refresh(this.clock.seconds);
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
        level: structure.level,
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
        level: 1,
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
      this.log.info(`${structure.stats.label} destroyed (${structure.owner})`);
    });
    if (destroyed.length === 0) return;
    if (territoryChanged) this.territory.refresh();
    this.selection.reconcileStructures(this.structures.all());
    this.refreshNavigationBlockers();
  }

  private spawnCenters(): void {
    // Faz 5.1: every structure's durability is data now, the centre included, so
    // there is one place to tune a match's length rather than two.
    const stats = this.options.buildingBalance["command_center"] ?? null;
    const maxHealth = stats?.maxHealth ?? COMMAND_CENTER_MAX_HEALTH;
    const playerCenter = this.centers.spawn(
      "player",
      PLAYER_CENTER_POSITION.x,
      PLAYER_CENTER_POSITION.z,
      maxHealth,
      stats,
    );
    const enemyCenter = this.centers.spawn(
      "enemy",
      ENEMY_CENTER_POSITION.x,
      ENEMY_CENTER_POSITION.z,
      maxHealth,
      stats,
    );
    // Settlement Lv1 tier values (worker queue capacity today) before any research.
    for (const center of this.centers.all()) this.structureUpgrades.applyCompletedUpgrade(center);
    this.buildingVisuals.applyToCenter(playerCenter, this.ageOf(playerCenter.owner));
    this.buildingVisuals.applyToCenter(enemyCenter, this.ageOf(enemyCenter.owner));
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
    return this.ages.snapshot(owner).age;
  }

  /**
   * Age transition consequence (KR-03): reset every owned building to Level 1
   * and applies the new age's Lv1 stats before rebuilding its model. Only completed
   * buildings get a finished model; sites keep the translucent model at their
   * type's currently researched level (which is Level 1 after this reset).
   */
  private rebuildForAge(owner: UnitOwner): void {
    this.structureUpgrades.resetOwner(owner);
    for (const structure of this.structures.ownedBy(owner)) {
      if (structure.construction.complete) this.applyStructureVisual(structure);
      else this.applyConstructionVisual(structure);
    }
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
      this.structureUpgrades.levelFor(structure.owner, structure.stats.id),
    );
    if (visual) this.structures.setConstructionVisual(structure, visual);
  }

  private async loadMapArt(blockout: import("three").Group): Promise<void> {
    try {
      await this.mapArt.apply(blockout, RTS_BLOCKOUT_MAP, this.forests);
      // §59/GDD 08 §39: resource deposits, ridges and trees must not be readable
      // in ground the player has never scouted. Registered here rather than at
      // construction because the art loads asynchronously — at construction time
      // there is nothing to hide yet.
      this.fogVisibility?.trackWorldProps(collectWorldProps(blockout));
      // The art arrives after setup's fog pass, and on the start screen there is
      // no simulation tick coming to catch it up — so the newly built props and
      // forest get their first fog pass here, or they would render unfogged
      // until the player pressed "Maçı Başlat".
      this.updateFogOfWar();
      this.syncForestVisibility();
    } catch (error) {
      this.log.warn("RTS map art could not be loaded", error);
    }
  }

  /**
   * §59: tree visibility, through the forest's own single writer.
   *
   * Shared by the simulation tick and the two setup paths so all three apply the
   * identical rule — the predicate is `undefined` while the flag is off, which is
   * what keeps a fogless build's forest exactly as it was.
   */
  private syncForestVisibility(): void {
    this.mapArt.syncForest(
      this.forests,
      this.vision ? (x, z) => this.vision!.isExplored(PLAYER_OWNER, x, z) : undefined,
    );
  }

  /** §51: leave the start screen and let the simulation run. */
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
    if (this.flow.phase === "paused") this.matchOverlay.showPause();
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
    this.economyProduction?.reset();
    this.logisticsOccupation.reset();
    this.logisticsTransfers.reset();
    this.workerConstruction.reset();
    this.barracksProduction.reset();
    this.structureUpgrades.reset();
    this.workerProduction.reset();
    this.ages.reset();
    this.ai.reset();
    this.units.clear();
    this.centers.clear();
    this.structures.clear();
    this.roadPlacement.reset();
    this.projectiles.clear();
    this.rallyPointPending = false;
    this.structureConstruction.resetReservations();
    this.kingdoms.reset();
    // A new match opens at the base rate: carrying a wrecked price index over
    // would price the first trade of a fresh game off the last one's spree.
    this.marketTrade.reset();
    this.resourceNodes.reset();
    this.forests.reset();
    this.commandMarkers.clear();
    // A restart is a new match, not a continuation: carrying a cooldown over
    // would mute a real notice in the first seconds of the next game, and a
    // stale health baseline would read the fresh centre as already damaged.
    this.notifications.reset();
    this.notificationFeed.setNotifications([]);
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
    // A restart is a fresh match, so the view returns to the opening framing too
    // — otherwise the player restarts into wherever they had scrolled to, which
    // under fog is very likely unexplored ground.
    this.cameraController.setFocus(OPENING_FOCUS.x, OPENING_FOCUS.z);
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
    if (width === this.lastW && height === this.lastH) return;
    this.lastW = width;
    this.lastH = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(width, height, false);
    this.cameraController.setViewport(width, height);
  }

  private navigationBlockers() {
    return [
      ...RTS_BLOCKOUT_MAP.navigationBlockers,
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
    const outpostRoad = roadCellTouchingFootprint(
      this.roads, structure.x, structure.z, structure.stats.footprint.width, structure.stats.footprint.depth,
    );
    const center = this.centers.get(structure.owner);
    const centerRoad = center && roadCellTouchingFootprint(this.roads, center.position.x, center.position.z, 8, 8);
    if (!outpostRoad || !centerRoad) return false;
    return this.roads.connected(outpostRoad, centerRoad);
  }

  private refreshNavigationBlockers(): void {
    this.navigation.setBlockers(this.navigationBlockers());
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
    this.hudBar.setAge(this.ages.snapshot(PLAYER_OWNER), this.options.ageBalance);
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
    this.roadControls.setState(this.roadPlacement.state());
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
    const units = this.selection.selected();
    if (units.length > 0) {
      return {
        kind: "units",
        units: units.map((unit) => ({
          id: unit.id,
          role: unit.role,
          stats: unit.stats,
          health: unit.health.current,
          maxHealth: unit.health.max,
          stance: unit.stance,
          job: unit.role === "worker" ? this.workerJob(unit) : null,
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
          portrait: structure.stats.portrait,
          level: structure.level,
          ageLabel: this.ageOf(structure.owner) === "town" ? "Kasaba" : "Yerleşim",
          health: structure.health.current,
          maxHealth: structure.health.max,
          demolishArmed: this.demolishArmed === structure,
          detail: this.structureDetail(structure),
          // Null when the data gives this building no `levels` at all — the
          // absence of an upgrade path is the data's statement, not a UI decision.
          upgrade: this.structureUpgradeView(structure),
        },
      };
    }
    const center = this.selection.selectedCenter();
    if (!center) return { kind: "none" };
    return {
      kind: "structure",
      structure: {
        id: 0,
        label: this.options.buildingBalance["command_center"]?.label ?? "Merkez",
        portrait: this.options.buildingBalance["command_center"]?.portrait,
        level: center.level,
        ageLabel: this.ageOf(center.owner) === "town" ? "Kasaba" : "Yerleşim",
        health: center.health.current,
        maxHealth: center.health.max,
        detail: {
          kind: "center",
          queue: this.workerProduction.queueSnapshot(PLAYER_OWNER),
          age: this.ages.snapshot(PLAYER_OWNER),
          controlRadius: center.controlRadius,
          workerStats: this.options.unitBalance["worker_placeholder"]!,
          requiredBuildingLabels: this.buildingLabels,
          ageCost: this.options.ageBalance.town.cost,
          stock: this.kingdoms.get(PLAYER_OWNER).wallet.snapshot(),
        },
        // The centre's radius and worker speed still ride on the age, but its
        // in-age Lv1→3 ladder is the same research every other building runs.
        upgrade: this.structureUpgradeView(center),
      },
    };
  }

  /**
   * The selected building's level-up view: the system snapshot, what the next
   * level buys (gain line), and how far an in-flight upgrade has run (progress
   * bar). Null when the data gives the building no `levels` at all.
   */
  private structureUpgradeView(structure: UpgradableStructure): StructureUpgradeView | null {
    if (!structure.stats.levels) return null;
    const snapshot = this.structureUpgrades.snapshot(structure);
    const next = structure.stats.levels.find((entry) => entry.level === snapshot.level + 1);
    const nextTier = structure.stats.progression?.[this.ageOf(structure.owner)]
      .find((entry) => entry.level === snapshot.level + 1);
    const gain: UpgradeGain | null = next || nextTier
      ? {
          maxHealth: nextTier?.maxHealth ?? next!.maxHealth,
          maxHealthDelta: (nextTier?.maxHealth ?? next!.maxHealth) - structure.health.max,
          populationCapacity: nextTier?.populationCapacity ?? next?.populationCapacity ?? null,
          controlRadius: nextTier?.territory?.controlRadius ?? next?.territory?.controlRadius ?? null,
          tradeCommission: nextTier?.tradeCommission ?? next?.tradeCommission ?? null,
          workerCapacity: nextTier?.economy?.workerCapacity ?? null,
          perWorkerPerMinute: nextTier?.economy?.perWorkerPerMinute ?? null,
          localBufferCapacity: nextTier?.economy?.localBufferCapacity ?? null,
          carryCapacity: nextTier?.economy?.carryCapacity ?? null,
          attackDamage: nextTier?.defense?.attackDamage ?? null,
          queueCapacity: nextTier?.queueCapacity ?? null,
          storageCapacity: nextTier?.storageCapacity ?? null,
        }
      : null;
    // While upgrading, `next` is the in-flight step (level is bumped only on
    // completion), so its duration is the total the remaining time counts down.
    const progress = snapshot.upgrading && next && next.durationSeconds > 0
      ? Math.min(1, Math.max(0, (next.durationSeconds - snapshot.remainingSeconds) / next.durationSeconds))
      : 0;
    return {
      snapshot,
      gain,
      progress,
      lockedReason: this.ages.isUpgrading(structure.owner)
        ? "Kasaba Çağına geçiliyor; çağ tamamlanana kadar yapı yükseltmeleri kapalı."
        : null,
      stock: this.kingdoms.get(structure.owner).wallet.snapshot(),
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
      this.buildPalette.setActionMessage(`${structure.stats.label} yıkılacak. Onaylamak için tekrar basın.`);
      return;
    }
    this.demolishArmed = null;
    structure.health.damage(structure.health.max);
    this.buildPalette.setActionMessage(`${structure.stats.label} yıkıldı.`);
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
    if (id === DEMOLISH_ACTION) {
      this.demolishSelectedStructure();
      return;
    }
    if (id === UPGRADE_ACTION) {
      // The selected building identifies a type-wide research; all completed
      // structures of that type receive the level together.
      const selected = this.selection.selectedStructure() ?? this.selection.selectedCenter();
      if (selected) this.startStructureUpgrade(selected);
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
   * A worker answers to two systems, so the panel needs the one that currently
   * holds it. Economy is asked first: only an assigned worker is in it at all,
   * and construction reports an unassigned worker as "idle" — the same word it
   * uses for a genuinely free one.
   */
  private workerJob(worker: Unit): WorkerJob {
    if (this.economyProduction?.isAssigned(worker)) {
      return this.economyProduction.stateFor(worker) === "producing" ? "producing" : "moving";
    }
    return this.workerConstruction.stateFor(worker);
  }

  /** Select every player worker that is free for automatic staffing (I). */
  private selectIdleWorkers(): void {
    const workers = this.units.workersOf(PLAYER_OWNER).filter((worker) => this.isIdleWorker(worker));
    this.selection.selectUnits(workers);
    this.buildPalette.setActionMessage(workers.length > 0
      ? `${workers.length} boşta işçi seçildi.`
      : "Seçilecek boşta işçi yok.");
  }

  /** Return selected free workers to the normal construction-then-production queue (R). */
  private assignSelectedIdleWorkers(): void {
    const workers = this.selection.selected().filter((worker) => this.isIdleWorker(worker));
    if (workers.length === 0) {
      this.buildPalette.setActionMessage("İşe gönderilecek boşta işçi seçili değil.");
      return;
    }
    for (const worker of workers) worker.resumeAutomaticWorkerAssignment();
    this.workerConstruction.assignIdleWorkers();
    this.economyProduction?.assignIdleWorkers();
    const assigned = workers.filter((worker) => !this.isIdleWorker(worker)).length;
    this.buildPalette.setActionMessage(assigned > 0
      ? `${assigned} işçi uygun işe gönderildi.`
      : "Şu anda işçi bekleyen uygun bir iş yok.");
  }

  private isIdleWorker(worker: Unit): boolean {
    return worker.role === "worker"
      && !worker.blocksAutomaticWorkerAssignment
      && this.workerConstruction.stateFor(worker) === "idle"
      && !(this.economyProduction?.isAssigned(worker) ?? false);
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
      return {
        kind: "producer",
        production,
        logistics: this.productionLogistics.snapshots()
          .find((producer) => producer.structureId === structure.id)?.status ?? null,
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
        upgrading: this.structureUpgrades.isUpgrading(structure),
        // The tier gate comes from the system that enforces it, never from a
        // level check written again here (plan §45: the gate lives in data).
        roster: this.barracksProduction.trainableUnits(structure),
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

    for (const producer of this.productionLogistics.snapshots()) {
      if (producer.owner !== PLAYER_OWNER || producer.status === "linked") continue;
      this.notifications.post({
        kind: "logistics-cut",
        subject: String(producer.structureId),
        text: `${resourceLabel(producer.resourceId)} üretimi durdu: lojistik bağlantısı kesildi.`,
      });
    }

    this.syncUnderAttackNotifications();
  }

  /**
   * One watch over both target kinds. They are sampled together because the
   * watch's contract is "what lost health since the last look" — splitting it
   * per kind would need two baselines advanced in lockstep for no gain.
   */
  private syncUnderAttackNotifications(): void {
    const center = this.centers.get(PLAYER_OWNER);
    const outposts = this.structures.ownedBy(PLAYER_OWNER)
      .filter((structure) => structure.stats.territory !== undefined);
    const damaged = this.attackWatch.observe([
      ...(center ? [{ id: "center", health: center.health.current }] : []),
      ...outposts.map((outpost) => ({ id: `outpost:${outpost.id}`, health: outpost.health.current })),
    ]);
    for (const id of damaged) {
      if (id === "center") {
        this.notifications.post({
          kind: "center-under-attack",
          text: "Merkeziniz saldırı altında!",
        });
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
  }

  private assignWorkerToConstruction(structure: PlacedStructure): void {
    const result = this.workerConstruction.assignNearest(structure);
    // Both kingdoms build through this hook, but only the human has a palette:
    // narrating an AI site here would put the AI's problems in the player's HUD.
    if (structure.owner !== PLAYER_OWNER) return;
    this.buildPalette.setActionMessage(result.assigned
      ? null
      : result.reason === "no-idle-worker"
        ? "İnşaat bekliyor: boşta işçi yok."
        : "İnşaat bekliyor: işçi bu yapıya erişemiyor.");
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
    this.buildPalette.setActionMessage(message[result]);
    return true;
  }

  /** Contextual worker order: a foundation builds; a finished producer gathers. */
  private assignSelectedWorkersToStructure(workers: readonly Unit[], structure: PlacedStructure): boolean {
    if (structure.owner !== PLAYER_OWNER) return false;
    if (!structure.construction.complete) {
      const result = this.workerConstruction.assignWorkers(structure, workers);
      this.buildPalette.setActionMessage(result.assignedWorkers > 0
        ? `${result.assignedWorkers} işçi inşaata atandı.`
        : result.reason === "unreachable"
          ? "İşçiler bu inşaata erişemiyor."
          : "İnşaat için uygun işçi yok.");
      return true;
    }
    if (!structure.stats.economy || !this.economyProduction) return false;
    // A direct gathering order transfers workers out of construction first.
    for (const worker of workers) this.workerConstruction.release(worker);
    const result = this.economyProduction.assignWorkers(structure, workers);
    this.buildPalette.setActionMessage(result.assignedWorkers > 0
      ? `${result.assignedWorkers} işçi ${structure.stats.label} görevine atandı.`
      : "Bu yapıda uygun işçi kontenjanı yok.");
    return true;
  }

  /** A move, attack, or stop order is an explicit request to leave current work. */
  private releaseWorkerTasks(workers: readonly Unit[]): void {
    for (const worker of workers) {
      this.workerConstruction.release(worker);
      this.economyProduction?.release(worker);
    }
  }

  private queueUnit(unitId: string): void {
    const label = this.options.unitBalance[unitId]?.label ?? unitId;
    const stats = this.options.unitBalance[unitId];
    const requiredLevel = stats?.requiredBuildingLevel ?? 2;
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
      "requires-production-building-upgrade": `${label} için ${buildingLabel} Lv${requiredLevel} yükseltmesi gerekir.`,
      "queue-full": `Üretim kuyruğu dolu (${queuedCount}/${queueCapacity}).`,
      "exit-blocked": `${label} çıkışı engelli; ${buildingLabel} çevresini açın.`,
      "insufficient-resources": `${label} için kaynak yetersiz.`,
      "population-full": "Nüfus dolu: önce Ev kurun.",
      "structure-upgrading": `${buildingLabel} seviye yükseltmesi sürerken ${label} üretimi durur.`,
      disconnected: `${buildingLabel} kontrol alanınızın dışında kaldı; üretim durdu.`,
    };
    this.buildPalette.setActionMessage(message[result]);
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
    const message: Record<MarketTradeResult, string> = {
      traded: direction === "buy"
        ? `${lot} ${label} alındı (${quote?.buyPrice ?? 0} altın).`
        : `${lot} ${label} satıldı (+${quote?.sellPrice ?? 0} altın).`,
      "untraded-resource": `${label} Pazar'da işlem görmüyor.`,
      "no-completed-market": "Önce tamamlanmış bir Pazar kurun.",
      disconnected: "Pazar kontrol alanınızın dışında kaldı; ticaret durdu.",
      "insufficient-gold": `${lot} ${label} için ${quote?.buyPrice ?? 0} altın gerekir.`,
      "insufficient-resources": `Satmak için ${lot} ${label} gerekir.`,
      "storage-full": "Depolama kapasitesi dolu; Depo kurun veya yükseltin.",
    };
    this.buildPalette.setActionMessage(message[result]);
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
    this.buildPalette.setActionMessage(message[result]);
    this.syncPlacementUi();
  }

  private startTownUpgrade(): void {
    // Read before the call: a started upgrade has already reserved the cost, and
    // a shortfall computed after it would be measuring the wrong wallet.
    const cost = this.options.ageBalance.town.cost;
    const shortfall = formatCostShortfall(cost, this.kingdoms.get(PLAYER_OWNER).wallet.snapshot());
    const result = this.ages.startTownUpgrade(PLAYER_OWNER);
    const snapshot = this.ages.snapshot(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      started: `Kasaba Çağı yükseltmesi başladı (${this.options.ageBalance.town.upgradeSeconds} sn). Merkez işçi üretimi durdu.`,
      "already-town": "Zaten Kasaba Çağındasınız.",
      "already-upgrading": `Kasaba Çağı yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`,
      "no-command-center": "Kasaba Çağı için Merkez gerekli.",
      "command-center-level":
        `Kasaba Çağı için Merkez Lv${snapshot.requiredCenterLevel} gerekir (şu an Lv${snapshot.centerLevel}).`,
      "missing-requirements": `Kasaba Çağı için eksik yapılar: ${snapshot.missingBuildingIds.join(", ")}.`,
      "insufficient-resources": shortfall
        ? `Kasaba Çağı için ${shortfall} daha gerekli (toplam ${formatResourceCost(cost)}).`
        : `Kasaba Çağı için kaynak yetersiz (${formatResourceCost(cost)}).`,
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncAgeUi();
  }

  /**
   * Start the selected building type's next in-age level research.
   *
   * The selected instance is only the command surface: House/Depot/Barracks
   * research applies its completed level to every completed matching structure.
   */
  private startStructureUpgrade(structure: UpgradableStructure): void {
    if (this.ages.isUpgrading(structure.owner)) {
      this.buildPalette.setActionMessage("Kasaba Çağına geçiliyor; çağ tamamlanana kadar yapı yükseltmeleri kapalı.");
      return;
    }
    const label = structure.stats.label;
    const nextLevel = structure.level + 1;
    // Read before the call, for the same reason the age button does: a started
    // research has already reserved its cost out of this wallet.
    const nextCost = this.structureUpgrades.snapshot(structure).nextCost ?? {};
    const shortfall = formatCostShortfall(nextCost, this.kingdoms.get(structure.owner).wallet.snapshot());
    const result = this.structureUpgrades.start(structure);
    const startedNote: Record<string, string> = {
      barracks: " Birlik üretimi geçici olarak durur.",
      depot: " Yol bağlantısı korunur.",
      outpost: " Kontrol alanı tamamlanınca büyür.",
    };
    const message: Record<typeof result, string> = {
      started: `Tüm ${label} yapıları için Lv${nextLevel} yükseltmesi başladı.${startedNote[structure.stats.id] ?? ""}`,
      "no-eligible-structure": `Yükseltilecek ${label} yok.`,
      "at-max-level": `${label} zaten en yüksek seviyede.`,
      "under-construction": `${label} önce inşaatını tamamlamalı.`,
      "already-upgrading": `${label} yükseltmesi zaten sürüyor.`,
      "insufficient-resources": shortfall
        ? `${label} Lv${nextLevel} için ${shortfall} daha gerekli (toplam ${formatResourceCost(nextCost)}).`
        : `${label} Lv${nextLevel} için kaynak yetersiz.`,
    };
    this.buildPalette.setActionMessage(message[result]);
  }

  private syncAgeUi(): void {
    this.buildPalette.setAgeState(this.ages.snapshot(PLAYER_OWNER));
  }

}

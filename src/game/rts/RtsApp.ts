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
  UnitBalance,
} from "@/game/data/gameDataTypes";
import { AiController } from "./ai/aiController";
import { formatRtsAiDebug } from "./ai/aiDebugView";
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { RtsPointer } from "./input/rtsPointer";
import { createRtsGround } from "./world/rtsGround";
import { createRtsMapBlockout, RTS_BLOCKOUT_MAP } from "./world/rtsMapBlockout";
import { RtsMapArt } from "./world/rtsMapArt";
import { UnitSystem } from "./units/unitSystem";
import { updateUnitMovement } from "./units/unitMovement";
import { updateUnitSeparation } from "./units/unitSeparation";
import { updateUnitCombat } from "./units/unitCombat";
import { updateUnitDeaths } from "./units/unitDeath";
import { updateUnitEngagement } from "./combat/engagementSystem";
import { ProjectileSystem } from "./combat/projectileSystem";
import { RtsNavigation } from "./navigation/rtsNavigation";
import { MarqueeOverlay } from "./selection/marqueeOverlay";
import { SelectionSystem } from "./selection/selectionSystem";
import { CommandMarkerSystem } from "./commands/commandMarker";
import { CommandSystem } from "./commands/commandSystem";
import { CommandCenterSystem } from "./structures/commandCenterSystem";
import { COMMAND_CENTER_MAX_HEALTH } from "./structures/commandCenter";
import { RtsBuildingVisuals } from "./structures/rtsBuildingVisuals";
import { updateStructureDestruction } from "./structures/structureDestruction";
import { RtsMatchState } from "./match/rtsMatchState";
import { RtsMatchOverlay } from "./match/rtsMatchOverlay";
import { RtsDebugOverlay } from "./debug/rtsDebugOverlay";
import { PlacedStructureSystem, type PlacedStructure } from "./structures/placedStructureSystem";
import { BuildingPlacementSystem } from "./structures/buildingPlacementSystem";
import { StructureConstructionService } from "./structures/structureConstructionService";
import { KingdomRegistry } from "./kingdom/kingdomRegistry";
import { RoadConstructionService } from "./roads/roadConstructionService";
import { RtsBuildPalette } from "./ui/rtsBuildPalette";
import { RtsSelectionPanel } from "./ui/rtsSelectionPanel";
import { RtsGameSpeedControls } from "./ui/rtsGameSpeedControls";
import type { ResourceChange } from "./economy/resourceWallet";
import { EconomyProductionSystem } from "./economy/economyProductionSystem";
import { ResourceNodeSystem } from "./economy/resourceNodeSystem";
import { AgeSystem } from "./progression/ageSystem";
import { DepotLogisticsSystem } from "./economy/depotLogisticsSystem";
import { ProductionLogisticsSystem } from "./economy/productionLogisticsSystem";
import { LogisticsTransferSystem } from "./economy/logisticsTransferSystem";
import { LogisticsOccupationSystem } from "./economy/logisticsOccupationSystem";
import { roadCellTouchingFootprint } from "./economy/depotLogisticsSystem";
import { WorkerConstructionSystem } from "./units/workerConstructionSystem";
import type { Unit, UnitOwner } from "./units/unit";
import { BarracksProductionSystem, guardQueueCapacityForAgeLevel } from "./structures/barracksProductionSystem";
import { WorkerProductionSystem, workerQueueCapacityForCenterLevel } from "./structures/workerProductionSystem";
import { StructureUpgradeSystem } from "./structures/structureUpgradeSystem";
import { RoadGraph } from "./roads/roadGraph";
import { RoadDebugView } from "./roads/roadDebugView";
import { RoadPlacementSystem } from "./roads/roadPlacementSystem";
import { simulationSteps, type RtsSimulationSpeed } from "./simulation/simulationSpeed";
import { RtsRoadControls } from "./ui/rtsRoadControls";
import { RtsHudBar } from "./ui/rtsHudBar";
import { RtsNotificationCenter } from "./ui/rtsNotifications";
import { RtsNotificationFeed } from "./ui/rtsNotificationFeed";
import { RtsAttackWatch } from "./ui/rtsAttackWatch";
import { resourceLabel, RESOURCE_ORDER } from "./ui/resourceLabels";
import { TerritoryControlSystem } from "./territory/territoryControlSystem";

const MAX_PIXEL_RATIO = 2;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
const SCENE_BACKGROUND = "#20262b";
const PLACEHOLDER_GUARD_ID = "guard_placeholder";
const PLACEHOLDER_WORKER_ID = "worker_placeholder";
/** The human player opens with a small standing defence. */
const PLAYER_GUARD_COUNT = 4;
/**
 * Both kingdoms start with the same workers: the AI cannot run the economy
 * (AI design §34/§35) without them, and §39 requires it to earn everything else
 * through the same buildings and costs the player pays. It starts with no army
 * on purpose — its Guards come out of a Barracks it has to build first, so the
 * opening is economic rather than a rush.
 */
const STARTING_WORKER_COUNT = 5;
const SETTLEMENT_POPULATION_CAPACITY = 20;
const PLAYER_CENTER_POSITION = RTS_BLOCKOUT_MAP.playerStart;
const ENEMY_CENTER_POSITION = RTS_BLOCKOUT_MAP.enemyStart;
/** Faz 5.0: both kingdoms run the same economy; only this one has a UI. */
const KINGDOM_OWNERS: readonly UnitOwner[] = ["player", "enemy"];
const PLAYER_OWNER: UnitOwner = "player";
/** Faz 5: the kingdom the AI opponent plays (plan §37). */
const AI_OWNER: UnitOwner = "enemy";

export interface RtsAppOptions {
  /** `?debug`: shows the compact Faz 1 RTS state/debug panel. */
  readonly debug?: boolean;
  /** `?flags=prosperity`: debug information only; never a gameplay requirement. */
  readonly prosperityDebugEnabled?: boolean;
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
  private readonly depotLogistics: DepotLogisticsSystem;
  private readonly productionLogistics: ProductionLogisticsSystem;
  private readonly logisticsOccupation: LogisticsOccupationSystem;
  private readonly logisticsTransfers: LogisticsTransferSystem;
  private readonly barracksProduction: BarracksProductionSystem;
  private readonly workerProduction: WorkerProductionSystem;
  private readonly structureUpgrades: StructureUpgradeSystem;
  private readonly match = new RtsMatchState();
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
  private readonly selectionPanel = new RtsSelectionPanel();
  private readonly projectiles = new ProjectileSystem();
  private readonly roadControls: RtsRoadControls;
  private readonly hudBar = new RtsHudBar();
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
    this.logisticsOccupation = new LogisticsOccupationSystem(this.depotLogistics);
    this.productionLogistics = new ProductionLogisticsSystem(this.structures, this.roads, this.depotLogistics, this.territory, this.logisticsOccupation);
    this.resourceNodes = new ResourceNodeSystem(this.options.resourceBalance, RTS_BLOCKOUT_MAP.resourceNodes);
    this.kingdoms = new KingdomRegistry(
      KINGDOM_OWNERS,
      this.units,
      this.structures,
      this.options.startingResources,
      SETTLEMENT_POPULATION_CAPACITY,
    );
    this.ages = new AgeSystem(KINGDOM_OWNERS, this.options.ageBalance, this.centers, this.structures, this.kingdoms);
    this.structureUpgrades = new StructureUpgradeSystem(
      this.structures,
      this.kingdoms,
      (owner) => this.ages.snapshot(owner).age === "town",
    );
    this.scene.background = new Color(SCENE_BACKGROUND);
    this.input = new RtsInput(canvas);
    this.selection = new SelectionSystem(
      canvas,
      this.cameraController.camera,
      this.units,
      this.marquee,
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
    );
    this.logisticsTransfers = new LogisticsTransferSystem(
      this.economyProduction,
      this.productionLogistics,
      this.kingdoms,
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
      (owner) => guardQueueCapacityForAgeLevel(this.centers.get(owner)?.level ?? 1),
      // Plan §45: a Barracks whose ground has been taken stops training, the
      // same severance rule the economy's producers already live under.
      (structure) => this.territory.ownerAt(structure.x, structure.z) === structure.owner,
      PLACEHOLDER_GUARD_ID,
    );
    this.workerProduction = new WorkerProductionSystem(
      this.units,
      this.centers,
      this.navigation,
      worker,
      this.kingdoms,
      (owner) => this.ages.isUpgrading(owner),
      (owner) => this.centers.get(owner)?.workerTrainingSeconds ?? worker.trainingSeconds,
      (owner) => workerQueueCapacityForCenterLevel(this.centers.get(owner)?.level ?? 1),
    );
    this.structureConstruction = new StructureConstructionService(
      this.options.buildingBalance,
      this.structures,
      this.kingdoms,
      this.navigation,
      () => this.navigationBlockers(),
      this.territory,
      (structure) => this.assignWorkerToConstruction(structure),
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
        : null,
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
      isWorkerBusy: (unit) => this.workerConstruction.stateFor(unit) !== "idle"
        || (this.economyProduction?.isAssigned(unit) ?? false),
      navigation: this.navigation,
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
        this.buildPalette.setActionMessage(null);
        this.syncPlacementUi();
      },
      (unitId) => this.queueUnit(unitId),
      () => this.queueWorker(),
      () => {
        this.placement.cancel();
        this.roadPlacement.cancel();
        this.rallyPointPending = true;
        this.buildPalette.setActionMessage("Toplanma noktası için haritada bir konum seçin.");
        this.syncPlacementUi();
        this.syncRoadUi();
      },
      () => this.startTownUpgrade(),
      () => this.startBarracksUpgrade(),
      () => this.startHouseUpgrade(),
      () => this.startDepotUpgrade(),
      () => this.startOutpostUpgrade(),
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
    this.matchOverlay = new RtsMatchOverlay(this.restartMatch);
    this.debugOverlay = this.options.debug ? new RtsDebugOverlay() : null;
    if (this.options.prosperityDebugEnabled) {
      this.debugOverlay?.setProgressionLines([
        "Refah: bilgi metriği etkin; çağ ve üretim için gereksinim değildir.",
      ]);
    }
    this.unsubscribeWalletChanges = this.debugOverlay
      ? this.playerKingdom.wallet.subscribe((change: ResourceChange) => this.debugOverlay?.recordResourceChange(change))
      : null;
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
    this.structures.setCompletedVisualHandler((structure) => {
      this.structureUpgrades.applyCompletedUpgrade(structure);
      this.applyStructureVisual(structure);
    });
    void this.loadBuildingVisuals();
    this.spawnStartingUnits();
    this.syncPlacementUi();
    this.syncAgeUi();
    this.syncStructureUpgradeUi();
    this.syncRoadUi();
  }

  /** The human kingdom's economy — everything the HUD reads and writes. */
  private get playerKingdom() {
    return this.kingdoms.get(PLAYER_OWNER);
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
    this.projectiles.dispose();
    this.roadControls.dispose();
    this.hudBar.dispose();
    this.notificationFeed.dispose();
    this.gameSpeedControls.dispose();
    this.placement.dispose();
    this.roadPlacement.dispose();
    this.roadDebugView.dispose();
    this.territory.dispose();
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
      for (const center of this.centers.all()) this.buildingVisuals.applyToCenter(center);
      for (const structure of this.structures.all()) this.applyStructureVisual(structure);
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
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.scene.add(this.centers.root);
    this.scene.add(this.structures.root);
    this.scene.add(this.placement.root);
    this.scene.add(this.roadPlacement.root);
    this.scene.add(this.roadDebugView.root);
    this.scene.add(this.territory.root);
    this.scene.add(this.units.root);
    this.scene.add(this.projectiles.root);
    this.scene.add(this.commandMarkers.root);
  }

  /**
   * Match-start forces.
   *
   * The Faz 1 arrangement gave the enemy three free Guards and no workers — a
   * selection/combat fixture. With a real opponent that was backwards: it was an
   * unearned army *and* an economy the AI could never run, so the AI's only
   * possible opening was to walk those Guards at the player.
   *
   * Faz 5 gives the enemy the workers instead. Its army now has to come out of a
   * Barracks it builds and pays for (§34 → §55), which is what makes the AI
   * opening economic rather than a rush.
   */
  private spawnStartingUnits(): void {
    const guard = this.options.unitBalance[PLACEHOLDER_GUARD_ID];
    const worker = this.options.unitBalance[PLACEHOLDER_WORKER_ID];
    if (!guard || !worker) {
      throw new Error(`Missing unit balance definition "${PLACEHOLDER_GUARD_ID}"`);
    }
    const cols = 5;
    for (let i = 0; i < PLAYER_GUARD_COUNT; i++) {
      const x = PLAYER_CENTER_POSITION.x - 6 + (i % cols) * 3;
      const z = PLAYER_CENTER_POSITION.z + 7 + Math.floor(i / cols) * 3;
      this.units.spawn("player", x, z, guard);
    }
    for (let i = 0; i < STARTING_WORKER_COUNT; i++) {
      this.units.spawn("player", -4 + i * 2, PLAYER_CENTER_POSITION.z - 8, worker);
      this.units.spawn("enemy", -4 + i * 2, ENEMY_CENTER_POSITION.z + 8, worker);
    }
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS));
    this.lastTime = now;

    this.resize();
    this.consumeCommandInput();
    this.cameraController.update(dt, this.input);
    if (this.match.active) {
      for (const simulationDt of simulationSteps(dt, this.simulationSpeed, MAX_FRAME_SECONDS)) {
        if (!this.match.active) break;
        this.updateSimulation(simulationDt);
      }
    }
    if (this.debugOverlay) {
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
    // Presentation runs on the rendered-frame delta, not the simulation's: a
    // tracer and a health bar should look the same at any game speed.
    this.projectiles.update(dt);
    this.units.updatePresentation(this.cameraController.camera.quaternion);
    this.selectionPanel.setSelection(this.selection.selected());
    // Notices expire on real seconds for the same reason a health bar animates
    // on them: at §38's 8x test speed a warning that vanished eight times faster
    // would be unreadable exactly when the match is hardest to follow.
    this.notifications.advance(dt);
    this.notificationFeed.setNotifications(this.notifications.active());
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  /**
   * Drain this frame's edge-triggered orders. Attack-move needs a map position,
   * so it uses the live pointer — the same place a right-click would have read.
   */
  private consumeCommandInput(): void {
    if (this.input.consumeStopRequest()) this.commands.issueStop();
    if (this.input.consumeCommand("hold")) this.commands.issueStance("hold");
    if (this.input.consumeCommand("aggressive")) this.commands.issueStance("aggressive");
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
    this.kingdoms.advance(dt);
    for (const event of this.ages.update(dt)) {
      if (event.type === "completed") {
        const center = this.centers.get(event.owner);
        if (center) this.buildingVisuals.applyToCenter(center);
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
          text: `${this.options.ageBalance.town.label} Çağı tamamlandı: T2 yükseltmeleri açıldı.`,
        });
      }
      this.buildPalette.setActionMessage(event.type === "completed"
        ? "Kasaba Çağı tamamlandı."
        : "Merkez yıkıldığı için çağ yükseltmesi iptal edildi; kaynaklar iade edildi.");
    }
    for (const event of this.structureUpgrades.update(dt)) {
      // The world consequences of a tier upgrade belong to whichever kingdom
      // bought it — Faz 8 gave the AI the same research, and a T2 outpost of its
      // own has to claim its wider radius exactly as the player's does.
      if (event.type === "completed") this.applyStructureVisual(event.structure);
      if (event.structure.stats.territory) this.territory.refresh();
      // Only the message is the player's; the AI has the debug panel instead.
      if (event.structure.owner !== PLAYER_OWNER) continue;
      this.buildPalette.setActionMessage(event.type === "completed"
        ? `${event.structure.stats.label} T2 yükseltmesi tamamlandı.`
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
          ? `${event.label} Kışla'dan çıktı.`
          : `${event.label} çıkışı engelli; Kışla çevresini açın.`,
      );
    }
    // The AI decides on the same scaled match delta as every other system, so
    // the game-speed control accelerates it too (plan §38 test mode).
    this.ai.update(dt);
    this.syncHudBar();
    this.syncAgeUi();
    this.syncStructureUpgradeUi();
    this.syncEconomyUi();
    this.syncNotifications();
    updateUnitCombat(
      this.units.all(),
      dt,
      (hit) => {
        this.debugOverlay?.recordHit(hit);
        if (hit.ranged) this.projectiles.spawn(hit.attacker.owner, hit.attacker.position, hit.target.position);
      },
    );
    updateUnitDeaths(this.units, this.selection, dt);
    this.destroyRuinedStructures();
    const outcome = this.match.update(this.centers);
    if (outcome !== "active") {
      this.log.info(outcome === "victory"
        ? "Victory: enemy command center destroyed"
        : "Defeat: the player's command center was destroyed");
      this.matchOverlay.showResult(outcome);
    }
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
    this.refreshNavigationBlockers();
  }

  private spawnCenters(): void {
    // Faz 5.1: every structure's durability is data now, the centre included, so
    // there is one place to tune a match's length rather than two.
    const maxHealth = this.options.buildingBalance["command_center"]?.maxHealth
      ?? COMMAND_CENTER_MAX_HEALTH;
    const playerCenter = this.centers.spawn(
      "player",
      PLAYER_CENTER_POSITION.x,
      PLAYER_CENTER_POSITION.z,
      maxHealth,
    );
    const enemyCenter = this.centers.spawn(
      "enemy",
      ENEMY_CENTER_POSITION.x,
      ENEMY_CENTER_POSITION.z,
      maxHealth,
    );
    this.buildingVisuals.applyToCenter(playerCenter);
    this.buildingVisuals.applyToCenter(enemyCenter);
  }

  private applyStructureVisual(structure: PlacedStructure): void {
    const visual = this.buildingVisuals.createForStructure(structure);
    if (visual) this.structures.setCompletedVisual(structure, visual);
  }

  private async loadMapArt(blockout: import("three").Group): Promise<void> {
    try {
      await this.mapArt.apply(blockout, RTS_BLOCKOUT_MAP);
    } catch (error) {
      this.log.warn("RTS map art could not be loaded", error);
    }
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
    this.resourceNodes.reset();
    this.commandMarkers.clear();
    // A restart is a new match, not a continuation: carrying a cooldown over
    // would mute a real notice in the first seconds of the next game, and a
    // stale health baseline would read the fresh centre as already damaged.
    this.notifications.reset();
    this.notificationFeed.setNotifications([]);
    this.attackWatch.reset();
    this.match.reset();
    this.spawnCenters();
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.spawnStartingUnits();
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
    this.buildPalette.setTrainableUnits(this.barracksProduction.trainableUnits(PLAYER_OWNER));
    this.syncHudBar();
    this.syncEconomyUi();
  }

  /** Push the §51 readouts. The bar decides nothing; it only diffs its cells. */
  private syncHudBar(): void {
    this.hudBar.setResources(this.playerKingdom.wallet.snapshot(), this.playerIncomeRates());
    this.hudBar.setIdleWorkerCount(this.workerConstruction.idleWorkerCount(PLAYER_OWNER));
    const population = this.playerKingdom.population.snapshot();
    this.hudBar.setPopulation(population.used, population.capacity);
    this.hudBar.setAge(this.ages.snapshot(PLAYER_OWNER), this.options.ageBalance);
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

  private syncEconomyUi(): void {
    const production = this.economyProduction?.snapshots(PLAYER_OWNER) ?? [];
    this.logisticsOccupation.sync();
    const logistics = this.productionLogistics.snapshots()
      .filter((producer) => producer.owner === PLAYER_OWNER);
    this.buildPalette.setProductionBuildings(production);
    this.buildPalette.setProductionLogistics(new Map(
      logistics.map((producer) => [producer.structureId, producer.status]),
    ));
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
    const result = this.barracksProduction.queueUnit(PLAYER_OWNER, unitId);
    const queuedCount = this.barracksProduction.queuedCount(PLAYER_OWNER);
    const queueCapacity = this.barracksProduction.queueCapacity(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      queued: `${label} üretim kuyruğa alındı (${queuedCount}/${queueCapacity}).`,
      "unknown-unit": `${label} Kışla'da üretilemiyor.`,
      "no-completed-barracks": "Önce tamamlanmış bir Kışla kurun.",
      "requires-barracks-upgrade": `${label} için Kışla T2 yükseltmesi gerekir.`,
      "queue-full": `Üretim kuyruğu dolu (${queuedCount}/${queueCapacity}).`,
      "exit-blocked": `${label} çıkışı engelli; Kışla çevresini açın.`,
      "insufficient-resources": `${label} için kaynak yetersiz.`,
      "population-full": "Nüfus dolu: önce Ev kurun.",
      "structure-upgrading": `Kışla T2 yükseltmesi sürerken ${label} üretimi durur.`,
      disconnected: "Kışla kontrol alanınızın dışında kaldı; üretim durdu.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncPlacementUi();
  }

  private queueWorker(): void {
    const result = this.workerProduction.queueWorker(PLAYER_OWNER);
    const queuedCount = this.workerProduction.queuedCount(PLAYER_OWNER);
    const queueCapacity = workerQueueCapacityForCenterLevel(this.centers.get(PLAYER_OWNER)?.level ?? 1);
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
    const result = this.ages.startTownUpgrade(PLAYER_OWNER);
    const snapshot = this.ages.snapshot(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      started: `Kasaba Çağı yükseltmesi başladı (${this.options.ageBalance.town.upgradeSeconds} sn). Merkez işçi üretimi durdu.`,
      "already-town": "Zaten Kasaba Çağındasınız.",
      "already-upgrading": `Kasaba Çağı yükseltmesi sürüyor (${Math.ceil(snapshot.remainingSeconds)} sn).`,
      "no-command-center": "Kasaba Çağı için Merkez gerekli.",
      "missing-requirements": `Kasaba Çağı için eksik yapılar: ${snapshot.missingBuildingIds.join(", ")}.`,
      "insufficient-resources": "Kasaba Çağı için kaynak yetersiz.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncStructureUpgradeUi();
    this.syncAgeUi();
  }

  private startBarracksUpgrade(): void {
    const result = this.structureUpgrades.start(PLAYER_OWNER, "barracks");
    const message: Record<typeof result, string> = {
      started: "Kışla T2 yükseltmesi başladı; Muhafız üretimi geçici olarak durur.",
      "no-eligible-structure": "Yükseltilecek tamamlanmış T1 Kışla yok.",
      "already-upgrading": "Kışla T2 yükseltmesi zaten sürüyor.",
      "not-town": "Kışlayı T2 yükseltmek için önce Kasaba Çağına geçin.",
      "insufficient-resources": "Kışla T2 için kaynak yetersiz.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncStructureUpgradeUi();
  }

  private startHouseUpgrade(): void {
    const result = this.structureUpgrades.start(PLAYER_OWNER, "house");
    const message: Record<typeof result, string> = {
      started: "Ev T2 yükseltmesi başladı.",
      "no-eligible-structure": "Yükseltilecek tamamlanmış T1 Ev yok.",
      "already-upgrading": "Ev T2 yükseltmesi zaten sürüyor.",
      "not-town": "Evi T2 yükseltmek için önce Kasaba Çağına geçin.",
      "insufficient-resources": "Ev T2 için kaynak yetersiz.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncStructureUpgradeUi();
  }

  private startDepotUpgrade(): void {
    const result = this.structureUpgrades.start(PLAYER_OWNER, "depot");
    const message: Record<typeof result, string> = {
      started: "Depo T2 yükseltmesi başladı; yol bağlantısı korunur.",
      "no-eligible-structure": "Yükseltilecek tamamlanmış T1 Depo yok.",
      "already-upgrading": "Depo T2 yükseltmesi zaten sürüyor.",
      "not-town": "Depoyu T2 yükseltmek için önce Kasaba Çağına geçin.",
      "insufficient-resources": "Depo T2 için kaynak yetersiz.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncStructureUpgradeUi();
  }

  private startOutpostUpgrade(): void {
    const result = this.structureUpgrades.start(PLAYER_OWNER, "outpost");
    const message: Record<typeof result, string> = {
      started: "Karakol T2 yükseltmesi başladı; kontrol alanı tamamlanınca büyür.",
      "no-eligible-structure": "Yükseltilecek tamamlanmış T1 Karakol yok.",
      "already-upgrading": "Karakol T2 yükseltmesi zaten sürüyor.",
      "not-town": "Karakolu T2 yükseltmek için önce Kasaba Çağına geçin.",
      "insufficient-resources": "Karakol T2 için kaynak yetersiz.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncStructureUpgradeUi();
  }

  private syncAgeUi(): void {
    this.buildPalette.setAgeState(this.ages.snapshot(PLAYER_OWNER));
  }

  private syncStructureUpgradeUi(): void {
    for (const buildingId of ["barracks", "house", "depot", "outpost"]) {
      this.buildPalette.setStructureUpgradeState(buildingId, this.structureUpgrades.snapshot(PLAYER_OWNER, buildingId));
    }
  }
}

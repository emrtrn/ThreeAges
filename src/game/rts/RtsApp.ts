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
  AiProfile,
  BuildingBalance,
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
import { updateUnitCombat } from "./units/unitCombat";
import { updateUnitDeaths } from "./units/unitDeath";
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
import { RtsGameSpeedControls } from "./ui/rtsGameSpeedControls";
import type { ResourceChange } from "./economy/resourceWallet";
import { EconomyProductionSystem } from "./economy/economyProductionSystem";
import { DepotLogisticsSystem } from "./economy/depotLogisticsSystem";
import { ProductionLogisticsSystem } from "./economy/productionLogisticsSystem";
import { LogisticsTransferSystem } from "./economy/logisticsTransferSystem";
import { LogisticsOccupationSystem } from "./economy/logisticsOccupationSystem";
import { roadCellTouchingFootprint } from "./economy/depotLogisticsSystem";
import { WorkerConstructionSystem } from "./units/workerConstructionSystem";
import type { UnitOwner } from "./units/unit";
import { BarracksProductionSystem } from "./structures/barracksProductionSystem";
import { WorkerProductionSystem } from "./structures/workerProductionSystem";
import { RoadGraph } from "./roads/roadGraph";
import { RoadDebugView } from "./roads/roadDebugView";
import { RoadPlacementSystem } from "./roads/roadPlacementSystem";
import { simulationSteps, type RtsSimulationSpeed } from "./simulation/simulationSpeed";
import { RtsRoadControls } from "./ui/rtsRoadControls";
import { RtsLogisticsWarning } from "./ui/rtsLogisticsWarning";
import {
  COMMAND_CENTER_CONTROL_RADIUS,
  TerritoryControlSystem,
} from "./territory/territoryControlSystem";

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
  /** JSON-backed placeholder unit stats until full unit data is introduced. */
  readonly unitBalance: UnitBalance;
  /** JSON-backed footprint/cost/build-time definitions introduced in Faz 2. */
  readonly buildingBalance: BuildingBalance;
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
    radius: COMMAND_CENTER_CONTROL_RADIUS,
  })).concat(this.structures.all()
    .filter((structure) => structure.construction.complete && structure.stats.territory)
    .map((structure) => ({
      owner: structure.owner,
      x: structure.x,
      z: structure.z,
      radius: this.outpostConnectedToMainRoad(structure)
        ? structure.stats.territory?.connectedControlRadius ?? 0
        : structure.stats.territory?.controlRadius ?? 0,
    }))));
  private readonly kingdoms: KingdomRegistry;
  private readonly ai: AiController;
  private readonly structureConstruction: StructureConstructionService;
  private readonly roadConstruction: RoadConstructionService;
  private readonly workerConstruction: WorkerConstructionSystem;
  private economyProduction: EconomyProductionSystem | null = null;
  private readonly depotLogistics: DepotLogisticsSystem;
  private readonly productionLogistics: ProductionLogisticsSystem;
  private readonly logisticsOccupation: LogisticsOccupationSystem;
  private readonly logisticsTransfers: LogisticsTransferSystem;
  private readonly barracksProduction: BarracksProductionSystem;
  private readonly workerProduction: WorkerProductionSystem;
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
  private readonly roadControls: RtsRoadControls;
  private readonly logisticsWarning: RtsLogisticsWarning;
  private readonly gameSpeedControls: RtsGameSpeedControls;
  private readonly unsubscribeWalletChanges: (() => void) | null;
  private readonly log = logger("System");
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private disposed = false;
  private simulationSpeed: RtsSimulationSpeed = 1;
  private roadOverlayVisible = false;
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
    this.kingdoms = new KingdomRegistry(
      KINGDOM_OWNERS,
      this.units,
      this.structures,
      this.options.startingResources,
      SETTLEMENT_POPULATION_CAPACITY,
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
    );
    this.workerConstruction = new WorkerConstructionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => this.economyProduction?.isAssigned(worker) ?? false,
      (structure) => {
        if (structure.stats.territory) this.territory.refresh();
      },
      (worker) => this.economyProduction?.release(worker) ?? false,
    );
    this.economyProduction = new EconomyProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => this.workerConstruction.stateFor(worker) !== "idle",
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
      guard,
      this.kingdoms,
    );
    this.workerProduction = new WorkerProductionSystem(
      this.units,
      this.centers,
      this.navigation,
      worker,
      this.kingdoms,
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
      isWorkerBusy: (unit) => this.workerConstruction.stateFor(unit) !== "idle"
        || (this.economyProduction?.isAssigned(unit) ?? false),
      navigation: this.navigation,
      anchors: RTS_BLOCKOUT_MAP.enemyBaseAnchors,
      expansion: RTS_BLOCKOUT_MAP.enemyExpansion,
      construction: this.structureConstruction,
      roadConstruction: this.roadConstruction,
      workerProduction: this.workerProduction,
      barracksProduction: this.barracksProduction,
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
      () => this.queueGuard(),
      () => this.queueWorker(),
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
    this.logisticsWarning = new RtsLogisticsWarning();
    this.gameSpeedControls = new RtsGameSpeedControls(1, (speed) => {
      this.simulationSpeed = speed;
    });
    this.matchOverlay = new RtsMatchOverlay(this.restartMatch);
    this.debugOverlay = this.options.debug ? new RtsDebugOverlay() : null;
    this.unsubscribeWalletChanges = this.debugOverlay
      ? this.playerKingdom.wallet.subscribe((change: ResourceChange) => this.debugOverlay?.recordResourceChange(change))
      : null;
    // Composite pointer handler: left button drives selection, while right
    // button cancels active building placement or issues commands otherwise.
    // Keeps the systems decoupled (neither imports the other); this composition
    // root is the only place that sees both.
    this.pointer = new RtsPointer(canvas, {
      onSelectClick: (x, y, additive) => {
        if (this.roadPlacement.isActive) {
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
      onSelectDrag: (rect) => {
        if (!this.roadPlacement.isActive && !this.placement.isActive) this.selection.onSelectDrag(rect);
      },
      onSelectCommit: (rect, additive) => {
        if (this.roadPlacement.isActive) {
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
        // Placement deliberately persists after each confirmed structure so
        // players can build in sequence. A contextual right-click exits that
        // mode before it can be interpreted as a unit command.
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
    this.structures.setCompletedVisualHandler((structure) => this.applyStructureVisual(structure));
    void this.loadBuildingVisuals();
    this.spawnStartingUnits();
    this.syncPlacementUi();
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
    this.log.info(`RTS runtime started${this.options.debug ? " (debug)" : ""}`);
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
    this.roadControls.dispose();
    this.logisticsWarning.dispose();
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
      this.units.spawn("player", -4 + i * 2, PLAYER_CENTER_POSITION.z - 8, worker, "worker");
      this.units.spawn("enemy", -4 + i * 2, ENEMY_CENTER_POSITION.z + 8, worker, "worker");
    }
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const dt = Math.max(0, Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS));
    this.lastTime = now;

    this.resize();
    if (this.input.consumeStopRequest()) this.commands.issueStop();
    this.cameraController.update(dt, this.input);
    if (this.match.active) {
      for (const simulationDt of simulationSteps(dt, this.simulationSpeed, MAX_FRAME_SECONDS)) {
        if (!this.match.active) break;
        this.updateSimulation(simulationDt);
      }
    }
    if (this.debugOverlay) {
      this.debugOverlay.setAiLines(
        formatRtsAiDebug(this.ai.snapshot(), this.ai.log.recent(), this.ai.economyMultiplier),
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
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  /** Advance match systems; camera and UI keep the unscaled rendered-frame delta. */
  private updateSimulation(dt: number): void {
    this.kingdoms.advance(dt);
    updateUnitMovement(this.units.all(), dt);
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
          ? "Muhafız Kışla'dan çıktı."
          : "Muhafız çıkışı engelli; Kışla çevresini açın.",
      );
    }
    // The AI decides on the same scaled match delta as every other system, so
    // the game-speed control accelerates it too (plan §38 test mode).
    this.ai.update(dt);
    this.buildPalette.setIdleWorkerCount(this.workerConstruction.idleWorkerCount(PLAYER_OWNER));
    this.buildPalette.setResources(this.playerKingdom.wallet.snapshot());
    const population = this.playerKingdom.population.snapshot();
    this.buildPalette.setPopulation(population.used, population.capacity);
    this.syncEconomyUi();
    updateUnitCombat(this.units.all(), dt, (hit) => this.debugOverlay?.recordHit(hit));
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
    this.workerProduction.reset();
    this.ai.reset();
    this.units.clear();
    this.centers.clear();
    this.structures.clear();
    this.roadPlacement.reset();
    this.structureConstruction.resetReservations();
    this.kingdoms.reset();
    this.commandMarkers.clear();
    this.match.reset();
    this.spawnCenters();
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.spawnStartingUnits();
    this.placement.cancel();
    this.syncPlacementUi();
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

  private outpostConnectedToMainRoad(structure: PlacedStructure): boolean {
    const outpostRoad = roadCellTouchingFootprint(
      this.roads, structure.x, structure.z, structure.stats.footprint.width, structure.stats.footprint.depth,
    );
    const playerCenter = this.centers.all().find((center) => center.owner === "player");
    const centerRoad = playerCenter && roadCellTouchingFootprint(this.roads, playerCenter.position.x, playerCenter.position.z, 8, 8);
    if (!outpostRoad || !centerRoad) return false;
    return this.roads.connected(outpostRoad, centerRoad);
  }

  private refreshNavigationBlockers(): void {
    this.navigation.setBlockers(this.navigationBlockers());
  }

  private syncPlacementUi(): void {
    this.buildPalette.setState(this.placement.state());
    this.buildPalette.setResources(this.playerKingdom.wallet.snapshot());
    this.buildPalette.setIdleWorkerCount(this.workerConstruction.idleWorkerCount(PLAYER_OWNER));
    const population = this.playerKingdom.population.snapshot();
    this.buildPalette.setPopulation(population.used, population.capacity);
    this.syncEconomyUi();
  }

  private syncRoadUi(): void {
    this.roadControls.setState(this.roadPlacement.state());
  }

  private syncEconomyUi(): void {
    const production = this.economyProduction?.snapshots(PLAYER_OWNER) ?? [];
    this.logisticsOccupation.sync();
    const logistics = this.productionLogistics.snapshots()
      .filter((producer) => producer.owner === PLAYER_OWNER);
    this.buildPalette.setIncomeRates({
      food: this.economyProduction?.productionPerMinute(PLAYER_OWNER, "food") ?? 0,
      wood: this.economyProduction?.productionPerMinute(PLAYER_OWNER, "wood") ?? 0,
    });
    this.buildPalette.setProductionBuildings(production);
    this.buildPalette.setProductionLogistics(new Map(
      logistics.map((producer) => [producer.structureId, producer.status]),
    ));
    this.logisticsWarning.setStatuses(logistics.map((producer) => producer.status));
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

  private queueGuard(): void {
    const result = this.barracksProduction.queueGuard(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      queued: "Muhafız üretim kuyruğa alındı.",
      "no-completed-barracks": "Önce tamamlanmış bir Kışla kurun.",
      "already-training": "Kışla zaten bir Muhafız üretiyor.",
      "exit-blocked": "Muhafız çıkışı engelli; Kışla çevresini açın.",
      "insufficient-resources": "Muhafız için kaynak yetersiz.",
      "population-full": "Nüfus dolu: önce Ev kurun.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncPlacementUi();
  }

  private queueWorker(): void {
    const result = this.workerProduction.queueWorker(PLAYER_OWNER);
    const message: Record<typeof result, string> = {
      queued: "İşçi üretim kuyruğa alındı.",
      "already-training": "Merkez zaten bir İşçi üretiyor.",
      "insufficient-resources": "İşçi için 50 yiyecek gerekli.",
      "population-full": "Nüfus dolu: önce Ev kurun.",
      "no-command-center": "İşçi üretmek için Merkez gerekli.",
    };
    this.buildPalette.setActionMessage(message[result]);
    this.syncPlacementUi();
  }
}

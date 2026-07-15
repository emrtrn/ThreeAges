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
import type { BuildingBalance, RoadBalance, StartingResources, UnitBalance } from "@/game/data/gameDataTypes";
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { RtsPointer } from "./input/rtsPointer";
import { createRtsGround } from "./world/rtsGround";
import { createRtsMapBlockout, RTS_BLOCKOUT_MAP } from "./world/rtsMapBlockout";
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
import { RtsMatchState } from "./match/rtsMatchState";
import { RtsMatchOverlay } from "./match/rtsMatchOverlay";
import { RtsDebugOverlay } from "./debug/rtsDebugOverlay";
import { PlacedStructureSystem, type PlacedStructure } from "./structures/placedStructureSystem";
import { BuildingPlacementSystem } from "./structures/buildingPlacementSystem";
import { RtsBuildPalette } from "./ui/rtsBuildPalette";
import { RtsGameSpeedControls } from "./ui/rtsGameSpeedControls";
import { ResourceWallet } from "./economy/resourceWallet";
import type { ResourceChange } from "./economy/resourceWallet";
import { EconomyProductionSystem } from "./economy/economyProductionSystem";
import { DepotLogisticsSystem } from "./economy/depotLogisticsSystem";
import { ProductionLogisticsSystem } from "./economy/productionLogisticsSystem";
import { PopulationSystem } from "./economy/populationSystem";
import { WorkerConstructionSystem } from "./units/workerConstructionSystem";
import { BarracksProductionSystem } from "./structures/barracksProductionSystem";
import { WorkerProductionSystem } from "./structures/workerProductionSystem";
import { RoadGraph } from "./roads/roadGraph";
import { RoadDebugView } from "./roads/roadDebugView";
import { RoadPlacementSystem } from "./roads/roadPlacementSystem";
import { simulationSteps, type RtsSimulationSpeed } from "./simulation/simulationSpeed";
import { RtsRoadControls } from "./ui/rtsRoadControls";
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
const PLAYER_GUARD_COUNT = 0;
const PLAYER_WORKER_COUNT = 5;
const SETTLEMENT_POPULATION_CAPACITY = 20;
const PLAYER_CENTER_POSITION = RTS_BLOCKOUT_MAP.playerStart;
const ENEMY_CENTER_POSITION = RTS_BLOCKOUT_MAP.enemyStart;

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
}

export class RtsApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly units = new UnitSystem();
  private readonly centers = new CommandCenterSystem();
  private readonly structures = new PlacedStructureSystem();
  private readonly roads: RoadGraph;
  private readonly roadDebugView: RoadDebugView | null;
  private readonly territory = new TerritoryControlSystem(() => this.centers.all().map((center) => ({
    owner: center.owner,
    x: center.position.x,
    z: center.position.z,
    radius: COMMAND_CENTER_CONTROL_RADIUS,
  })).concat(this.structures.all()
    .filter((structure) => structure.construction.complete && structure.stats.territory)
    .map((structure) => ({
      owner: "player" as const,
      x: structure.x,
      z: structure.z,
      radius: structure.stats.territory?.controlRadius ?? 0,
    }))));
  private readonly wallet: ResourceWallet;
  private readonly population: PopulationSystem;
  private readonly workerConstruction: WorkerConstructionSystem;
  private economyProduction: EconomyProductionSystem | null = null;
  private readonly depotLogistics: DepotLogisticsSystem;
  private readonly productionLogistics: ProductionLogisticsSystem;
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
  private readonly gameSpeedControls: RtsGameSpeedControls;
  private readonly unsubscribeWalletChanges: (() => void) | null;
  private readonly log = logger("System");
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private simulationSpeed: RtsSimulationSpeed = 1;
  private lastW = 0;
  private lastH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RtsAppOptions,
  ) {
    this.renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
    this.roads = new RoadGraph(this.options.roadBalance);
    this.roadDebugView = this.options.debug ? new RoadDebugView(this.roads) : null;
    this.depotLogistics = new DepotLogisticsSystem(this.structures, this.roads);
    this.productionLogistics = new ProductionLogisticsSystem(this.structures, this.roads, this.depotLogistics);
    this.wallet = new ResourceWallet(this.options.startingResources);
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
    );
    this.economyProduction = new EconomyProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      (worker) => this.workerConstruction.stateFor(worker) !== "idle",
    );
    this.population = new PopulationSystem(this.units, this.structures, SETTLEMENT_POPULATION_CAPACITY);
    const guard = this.options.unitBalance[PLACEHOLDER_GUARD_ID];
    const worker = this.options.unitBalance[PLACEHOLDER_WORKER_ID];
    if (!guard || !worker) throw new Error("Missing RTS unit balance definition");
    this.barracksProduction = new BarracksProductionSystem(
      this.units,
      this.structures,
      this.navigation,
      guard,
      this.wallet,
      this.population,
    );
    this.workerProduction = new WorkerProductionSystem(
      this.units,
      this.centers,
      this.navigation,
      worker,
      this.wallet,
      this.population,
    );
    this.placement = new BuildingPlacementSystem(
      canvas,
      this.cameraController.camera,
      this.options.buildingBalance,
      this.structures,
      this.wallet,
      this.navigation,
      () => this.navigationBlockers(),
      this.territory,
      (structure) => this.assignWorkerToConstruction(structure),
      (structure) => this.workerConstruction.cancelStructure(structure),
    );
    this.roadPlacement = new RoadPlacementSystem(
      canvas,
      this.cameraController.camera,
      this.roads,
      this.wallet,
      () => this.navigationBlockers(),
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
    );
    this.gameSpeedControls = new RtsGameSpeedControls(1, (speed) => {
      this.simulationSpeed = speed;
    });
    this.matchOverlay = new RtsMatchOverlay(this.restartMatch);
    this.debugOverlay = this.options.debug ? new RtsDebugOverlay() : null;
    this.unsubscribeWalletChanges = this.debugOverlay
      ? this.wallet.subscribe((change: ResourceChange) => this.debugOverlay?.recordResourceChange(change))
      : null;
    // Composite pointer handler: left button drives selection, right button
    // issues commands. Keeps the two systems decoupled (neither imports the
    // other); this composition root is the only place that sees both.
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
      onCommandClick: (x, y) => this.commands.issueAt(x, y),
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
    this.spawnTestUnits();
    this.syncPlacementUi();
    this.syncRoadUi();
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
    this.gameSpeedControls.dispose();
    this.placement.dispose();
    this.roadPlacement.dispose();
    this.roadDebugView?.dispose();
    this.territory.dispose();
    this.workerConstruction.reset();
    this.barracksProduction.reset();
    this.workerProduction.reset();
    this.structures.clear();
    this.renderer.dispose();
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
    this.scene.add(createRtsMapBlockout());
    this.spawnCenters();
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.scene.add(this.centers.root);
    this.scene.add(this.structures.root);
    this.scene.add(this.placement.root);
    this.scene.add(this.roadPlacement.root);
    if (this.roadDebugView) this.scene.add(this.roadDebugView.root);
    this.scene.add(this.territory.root);
    this.scene.add(this.units.root);
    this.scene.add(this.commandMarkers.root);
  }

  /**
   * Faz 1 step 2: a small mixed force so selection is exercised end-to-end. The
   * player Guards cluster near their start; a few enemy units stand apart (not
   * selectable). Replaced by match-driven spawns once the match backbone lands.
   */
  private spawnTestUnits(): void {
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
    for (let i = 0; i < 3; i++) {
      this.units.spawn("enemy", ENEMY_CENTER_POSITION.x - 3 + i * 3, ENEMY_CENTER_POSITION.z + 9, guard);
    }
    for (let i = 0; i < PLAYER_WORKER_COUNT; i++) {
      this.units.spawn("player", -4 + i * 2, PLAYER_CENTER_POSITION.z - 8, worker, "worker");
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
    this.debugOverlay?.update(
      this.units,
      this.centers,
      this.match.outcome,
      this.workerConstruction,
      this.wallet,
      this.economyProduction,
      this.population,
      this.roads,
      this.depotLogistics,
      this.productionLogistics,
    );
    this.roadDebugView?.refresh();
    this.commandMarkers.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  };

  /** Advance match systems; camera and UI keep the unscaled rendered-frame delta. */
  private updateSimulation(dt: number): void {
    this.wallet.advance(dt);
    updateUnitMovement(this.units.all(), dt);
    this.workerConstruction.update(dt);
    this.economyProduction?.update(dt);
    const workerEvent = this.workerProduction.update(dt);
    if (workerEvent) {
      this.buildPalette.setActionMessage(workerEvent === "completed"
        ? "Yeni işçi Merkez'den çıktı."
        : "İşçi çıkışı engelli; Merkez çevresini açın.");
    }
    for (const event of this.barracksProduction.update(dt)) {
      this.buildPalette.setActionMessage(
        event.type === "completed"
          ? "Muhafız Kışla'dan çıktı."
          : "Muhafız çıkışı engelli; Kışla çevresini açın.",
      );
    }
    this.buildPalette.setIdleWorkerCount(this.workerConstruction.idleWorkerCount());
    this.buildPalette.setResources(this.wallet.snapshot());
    const population = this.population.snapshot();
    this.buildPalette.setPopulation(population.used, population.capacity);
    this.syncEconomyUi();
    updateUnitCombat(this.units.all(), dt, (hit) => this.debugOverlay?.recordHit(hit));
    updateUnitDeaths(this.units, this.selection, dt);
    if (this.match.update(this.centers) === "victory") {
      this.log.info("Victory: enemy command center destroyed");
      this.matchOverlay.showVictory();
    }
  }

  private spawnCenters(): void {
    this.centers.spawn(
      "player",
      PLAYER_CENTER_POSITION.x,
      PLAYER_CENTER_POSITION.z,
      COMMAND_CENTER_MAX_HEALTH,
    );
    this.centers.spawn(
      "enemy",
      ENEMY_CENTER_POSITION.x,
      ENEMY_CENTER_POSITION.z,
      COMMAND_CENTER_MAX_HEALTH,
    );
  }

  /** Restore all Faz 1 match-owned systems without reloading the browser route. */
  private readonly restartMatch = (): void => {
    this.selection.reset();
    this.economyProduction?.reset();
    this.workerConstruction.reset();
    this.barracksProduction.reset();
    this.workerProduction.reset();
    this.population.reset();
    this.units.clear();
    this.centers.clear();
    this.structures.clear();
    this.roadPlacement.reset();
    this.placement.resetReservations();
    this.wallet.reset(this.options.startingResources);
    this.commandMarkers.clear();
    this.match.reset();
    this.spawnCenters();
    this.territory.refresh();
    this.refreshNavigationBlockers();
    this.spawnTestUnits();
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

  private refreshNavigationBlockers(): void {
    this.navigation.setBlockers(this.navigationBlockers());
  }

  private syncPlacementUi(): void {
    this.buildPalette.setState(this.placement.state());
    this.buildPalette.setResources(this.wallet.snapshot());
    this.buildPalette.setIdleWorkerCount(this.workerConstruction.idleWorkerCount());
    const population = this.population.snapshot();
    this.buildPalette.setPopulation(population.used, population.capacity);
    this.syncEconomyUi();
  }

  private syncRoadUi(): void {
    this.roadControls.setState(this.roadPlacement.state());
  }

  private syncEconomyUi(): void {
    const production = this.economyProduction?.snapshots() ?? [];
    this.buildPalette.setIncomeRates({
      food: this.economyProduction?.productionPerMinute("food") ?? 0,
      wood: this.economyProduction?.productionPerMinute("wood") ?? 0,
    });
    this.buildPalette.setProductionBuildings(production);
  }

  private assignWorkerToConstruction(structure: PlacedStructure): void {
    const result = this.workerConstruction.assignNearest(structure);
    this.buildPalette.setActionMessage(result.assigned
      ? null
      : result.reason === "no-idle-worker"
        ? "İnşaat bekliyor: boşta işçi yok."
        : "İnşaat bekliyor: işçi bu yapıya erişemiyor.");
  }

  private queueGuard(): void {
    const result = this.barracksProduction.queueGuard();
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
    const result = this.workerProduction.queueWorker();
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

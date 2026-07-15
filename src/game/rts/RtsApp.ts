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
import type { BuildingBalance, StartingResources, UnitBalance } from "@/game/data/gameDataTypes";
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
import { PlacedStructureSystem } from "./structures/placedStructureSystem";
import { BuildingPlacementSystem } from "./structures/buildingPlacementSystem";
import { RtsBuildPalette } from "./ui/rtsBuildPalette";
import { ResourceWallet } from "./economy/resourceWallet";

const MAX_PIXEL_RATIO = 2;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
const SCENE_BACKGROUND = "#20262b";
const PLACEHOLDER_GUARD_ID = "guard_placeholder";
const PLAYER_GUARD_COUNT = 20;
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
}

export class RtsApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly units = new UnitSystem();
  private readonly centers = new CommandCenterSystem();
  private readonly structures = new PlacedStructureSystem();
  private readonly wallet: ResourceWallet;
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
  private readonly buildPalette: RtsBuildPalette;
  private readonly log = logger("System");
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private lastW = 0;
  private lastH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RtsAppOptions,
  ) {
    this.renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
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
    this.placement = new BuildingPlacementSystem(
      canvas,
      this.cameraController.camera,
      this.options.buildingBalance,
      this.structures,
      this.wallet,
      this.navigation,
      () => this.navigationBlockers(),
    );
    this.buildPalette = new RtsBuildPalette(
      this.options.buildingBalance,
      (id) => {
        this.placement.begin(id);
        this.syncPlacementUi();
      },
      () => {
        this.placement.cancel();
        this.syncPlacementUi();
      },
      () => {
        this.placement.cancelLatestConstruction();
        this.syncPlacementUi();
      },
    );
    this.matchOverlay = new RtsMatchOverlay(this.restartMatch);
    this.debugOverlay = this.options.debug ? new RtsDebugOverlay() : null;
    // Composite pointer handler: left button drives selection, right button
    // issues commands. Keeps the two systems decoupled (neither imports the
    // other); this composition root is the only place that sees both.
    this.pointer = new RtsPointer(canvas, {
      onSelectClick: (x, y, additive) => {
        if (this.placement.isActive) {
          this.placement.confirmAt(x, y);
          this.syncPlacementUi();
        } else {
          this.selection.onSelectClick(x, y, additive);
        }
      },
      onSelectDrag: (rect) => {
        if (!this.placement.isActive) this.selection.onSelectDrag(rect);
      },
      onSelectCommit: (rect, additive) => {
        if (this.placement.isActive) {
          this.placement.confirmAt(rect.x1, rect.y1);
          this.syncPlacementUi();
        } else {
          this.selection.onSelectCommit(rect, additive);
        }
      },
      onSelectCancel: () => {
        if (!this.placement.isActive) this.selection.onSelectCancel();
      },
      onCommandClick: (x, y) => this.commands.issueAt(x, y),
      onPointerHover: (x, y) => {
        if (this.placement.isActive) {
          this.placement.previewAt(x, y);
          this.syncPlacementUi();
        }
      },
    });
    this.buildScene();
    this.spawnTestUnits();
    this.syncPlacementUi();
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
    this.buildPalette.dispose();
    this.placement.dispose();
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
    this.refreshNavigationBlockers();
    this.scene.add(this.centers.root);
    this.scene.add(this.structures.root);
    this.scene.add(this.placement.root);
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
    if (!guard) {
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
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = now;

    this.resize();
    if (this.input.consumeStopRequest()) this.commands.issueStop();
    this.cameraController.update(dt, this.input);
    if (this.match.active) {
      updateUnitMovement(this.units.all(), dt);
      updateUnitCombat(this.units.all(), dt, (hit) => this.debugOverlay?.recordHit(hit));
      updateUnitDeaths(this.units, this.selection, dt);
      if (this.match.update(this.centers) === "victory") {
        this.log.info("Victory: enemy command center destroyed");
        this.matchOverlay.showVictory();
      }
    }
    this.debugOverlay?.update(this.units, this.centers, this.match.outcome);
    this.commandMarkers.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
  };

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
    this.units.clear();
    this.centers.clear();
    this.structures.clear();
    this.placement.resetReservations();
    this.wallet.reset(this.options.startingResources);
    this.commandMarkers.clear();
    this.match.reset();
    this.spawnCenters();
    this.refreshNavigationBlockers();
    this.spawnTestUnits();
    this.placement.cancel();
    this.syncPlacementUi();
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
  }
}

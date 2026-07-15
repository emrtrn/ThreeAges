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
import type { UnitBalance } from "@/game/data/gameDataTypes";
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { RtsPointer } from "./input/rtsPointer";
import { createRtsGround } from "./world/rtsGround";
import { UnitSystem } from "./units/unitSystem";
import { updateUnitMovement } from "./units/unitMovement";
import { RtsNavigation } from "./navigation/rtsNavigation";
import { MarqueeOverlay } from "./selection/marqueeOverlay";
import { SelectionSystem } from "./selection/selectionSystem";
import { CommandMarkerSystem } from "./commands/commandMarker";
import { CommandSystem } from "./commands/commandSystem";

const MAX_PIXEL_RATIO = 2;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
const SCENE_BACKGROUND = "#20262b";
const PLACEHOLDER_GUARD_ID = "guard_placeholder";

export interface RtsAppOptions {
  /** `?debug`: reserved for the Faz 1 step-5 debug overlay (no-op for now). */
  readonly debug?: boolean;
  /** JSON-backed placeholder unit stats until full unit data is introduced. */
  readonly unitBalance: UnitBalance;
}

export class RtsApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly units = new UnitSystem();
  private readonly navigation = new RtsNavigation();
  private readonly marquee = new MarqueeOverlay();
  private readonly commandMarkers = new CommandMarkerSystem();
  private readonly pointer: RtsPointer;
  private readonly selection: SelectionSystem;
  private readonly commands: CommandSystem;
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
      this.navigation,
      this.commandMarkers,
    );
    // Composite pointer handler: left button drives selection, right button
    // issues commands. Keeps the two systems decoupled (neither imports the
    // other); this composition root is the only place that sees both.
    this.pointer = new RtsPointer(canvas, {
      onSelectClick: (x, y, additive) => this.selection.onSelectClick(x, y, additive),
      onSelectDrag: (rect) => this.selection.onSelectDrag(rect),
      onSelectCommit: (rect, additive) => this.selection.onSelectCommit(rect, additive),
      onSelectCancel: () => this.selection.onSelectCancel(),
      onCommandClick: (x, y) => this.commands.issueAt(x, y),
    });
    this.buildScene();
    this.spawnTestUnits();
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
    const cols = 4;
    for (let i = 0; i < 8; i++) {
      const x = -4.5 + (i % cols) * 3;
      const z = 4 + Math.floor(i / cols) * 3;
      this.units.spawn("player", x, z, guard.maxHealth);
    }
    for (let i = 0; i < 3; i++) {
      this.units.spawn("enemy", -3 + i * 3, -16, guard.maxHealth);
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
    updateUnitMovement(this.units.all(), dt);
    this.commandMarkers.update(dt);
    this.renderer.render(this.scene, this.cameraController.camera);
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
}

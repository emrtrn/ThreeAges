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
import { RtsCameraController } from "./camera/rtsCameraController";
import { RtsInput } from "./input/rtsInput";
import { createRtsGround } from "./world/rtsGround";

const MAX_PIXEL_RATIO = 2;
/** Clamp rAF delta so an alt-tab stall or breakpoint can't teleport the camera. */
const MAX_FRAME_SECONDS = 1 / 15;
const SCENE_BACKGROUND = "#20262b";

export interface RtsAppOptions {
  /** `?debug`: reserved for the Faz 1 step-5 debug overlay (no-op for now). */
  readonly debug?: boolean;
}

export class RtsApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController = new RtsCameraController();
  private readonly input: RtsInput;
  private readonly log = logger("System");
  private frameHandle = 0;
  private lastTime = 0;
  private running = false;
  private lastW = 0;
  private lastH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RtsAppOptions = {},
  ) {
    this.renderer = createSceneRenderer(canvas, MAX_PIXEL_RATIO);
    this.scene.background = new Color(SCENE_BACKGROUND);
    this.input = new RtsInput(canvas);
    this.buildScene();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.input.attach();
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
  }

  private readonly onFrame = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.onFrame);

    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = now;

    this.resize();
    this.cameraController.update(dt, this.input);
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

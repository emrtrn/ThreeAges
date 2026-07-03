/**
 * Live particle preview for the Particle Effect Editor (dev-only).
 *
 * Owns its own `WebGLRenderer` / `Scene` / raf loop (like the mesh editors) and
 * reuses the shared orbit camera + studio rig (`assetViewportCamera.ts`). The
 * effect is simulated by the same runtime {@link ParticleEffect} the game path
 * uses, fed the flat definition collapsed from the editor's rich
 * {@link ParticleEffectDefinition} — so what the author sees here is what the
 * `/` route renders.
 *
 * Preview state (elapsed time, particle buffers, play/pause) lives entirely in
 * this class and the `ParticleEffect` instance, never in the asset data (plan
 * task: "editor preview state ayrı tutulur"). One-shot effects auto-replay after
 * a short pause so the author keeps seeing the burst.
 *
 * VFX Lite Faz 2 keeps this minimal (grid from the rig + play/pause/restart);
 * Faz 3 layers on axis/origin/bounds helpers, a speed control, alive-particle
 * diagnostics and a warning overlay.
 */
import {
  PerspectiveCamera,
  Scene,
  Spherical,
  Vector3,
  WebGLRenderer,
} from "three";

import { ParticleEffect, toRuntimeParticleEffect } from "@engine/render-three/particleEffect";
import type { ParticleEffectDefinition } from "@engine/vfx/particleEffectTypes";
import { OrbitViewportCamera, createAssetViewportRig } from "@/editor/assetViewportCamera";

/** Seconds a finished one-shot waits before it auto-replays in the preview. */
const ONE_SHOT_REPLAY_DELAY = 0.4;

export class ParticleEffectPreviewViewport {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.01, 200);
  private readonly orbit: OrbitViewportCamera;
  private readonly spherical = new Spherical(6, 1.15, 0.7);
  private readonly target = new Vector3(0, 1, 0);
  private readonly resizeObserver: ResizeObserver;

  private definition: ParticleEffectDefinition | null = null;
  private effect: ParticleEffect | null = null;
  private rafId = 0;
  private lastTime = 0;
  private playing = true;
  private replayCooldown = 0;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.append(this.renderer.domElement);

    createAssetViewportRig(this.scene);

    this.orbit = new OrbitViewportCamera(this.camera, this.spherical, this.target, () => 4);
    this.orbit.update();
    this.orbit.bind(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  /** Swaps in a new definition, rebuilding the simulated effect from scratch. */
  setDefinition(definition: ParticleEffectDefinition): void {
    this.definition = definition;
    this.rebuildEffect();
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /** Restarts the effect from the beginning (fresh particle buffers). */
  restart(): void {
    this.replayCooldown = 0;
    this.rebuildEffect();
    this.playing = true;
  }

  private rebuildEffect(): void {
    if (this.effect) {
      this.scene.remove(this.effect.object3D);
      this.effect.dispose();
      this.effect = null;
    }
    if (!this.definition) return;
    const runtime = toRuntimeParticleEffect(this.definition);
    this.effect = new ParticleEffect(runtime);
    this.effect.setOrigin(0, 0, 0);
    this.scene.add(this.effect.object3D);
  }

  private readonly tick = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.playing && this.effect) {
      if (this.replayCooldown > 0) {
        this.replayCooldown -= dt;
        if (this.replayCooldown <= 0) this.rebuildEffect();
      } else {
        this.effect.update(dt);
        if (this.effect.isFinished()) this.replayCooldown = ONE_SHOT_REPLAY_DELAY;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    if (this.effect) {
      this.scene.remove(this.effect.object3D);
      this.effect.dispose();
      this.effect = null;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

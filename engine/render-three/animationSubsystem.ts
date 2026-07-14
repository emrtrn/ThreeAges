import type { AnimationMixer } from "three";

import type { EngineUpdateContext, Subsystem } from "@engine/core/Subsystem";
import {
  consumeDistanceUpdateDelta,
  isFarFromFocus,
  type DistanceUpdateRateSettings,
} from "@engine/perf/distanceUpdateRate";

/** Stable registry id for the animation subsystem. */
export const ANIMATION_SUBSYSTEM_ID = "render-three.animation";

export interface AnimationMixerRegistration {
  /** Squared distance from the runtime's focus point, or null when unavailable. */
  readonly distanceSquared?: () => number | null;
}

export interface AnimationDistanceUpdateSettings extends DistanceUpdateRateSettings {
  /** Shared focus is intentionally host-owned: editor hosts never opt in. */
}

interface MixerEntry {
  readonly mixer: AnimationMixer;
  readonly distanceSquared?: () => number | null;
  accumulatedSeconds: number;
}

/**
 * Advances Three.js `AnimationMixer`s once per engine tick.
 *
 * Owns the live mixer set (a mixer is added as each character's clip starts
 * playing) and steps every mixer by the tick's `deltaSeconds`. This is the work
 * that previously ran inline in the `SceneApp` rAF loop; moving it behind a
 * subsystem proves the engine-core tick drives real per-frame work.
 *
 * Three-touching, so it lives in `engine/render-three`, not `engine/core`.
 */
export class AnimationSubsystem implements Subsystem {
  readonly id = ANIMATION_SUBSYSTEM_ID;
  private readonly mixers: MixerEntry[] = [];
  private distanceUpdateSettings: AnimationDistanceUpdateSettings = {};

  /** Registers a mixer to be advanced on each tick; returns it for chaining. */
  add(mixer: AnimationMixer, registration: AnimationMixerRegistration = {}): AnimationMixer {
    this.mixers.push({
      mixer,
      ...(registration.distanceSquared ? { distanceSquared: registration.distanceSquared } : {}),
      accumulatedSeconds: 0,
    });
    return mixer;
  }

  /**
   * Enables the optional Phase 7 far-animation cadence. Empty settings preserve
   * the old every-frame mixer update, so existing editor and game callers keep
   * their exact animation behaviour until a fork provides an extension value.
   */
  setDistanceUpdateSettings(settings: AnimationDistanceUpdateSettings): void {
    this.distanceUpdateSettings = { ...settings };
    for (const entry of this.mixers) entry.accumulatedSeconds = 0;
  }

  /** Drops all mixers (e.g. when the scene is torn down or reloaded). */
  clear(): void {
    this.mixers.length = 0;
  }

  update(context: EngineUpdateContext): void {
    for (const entry of this.mixers) {
      const deltaSeconds = consumeDistanceUpdateDelta({
        deltaSeconds: context.deltaSeconds,
        accumulatedSeconds: entry.accumulatedSeconds,
        isFar: isFarFromFocus(entry.distanceSquared?.(), this.distanceUpdateSettings),
        settings: this.distanceUpdateSettings,
      });
      entry.accumulatedSeconds = deltaSeconds === 0
        ? entry.accumulatedSeconds + Math.max(0, context.deltaSeconds)
        : 0;
      if (deltaSeconds > 0) entry.mixer.update(deltaSeconds);
    }
  }

  dispose(): void {
    this.clear();
  }
}

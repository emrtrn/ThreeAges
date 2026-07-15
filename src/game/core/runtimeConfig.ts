/**
 * Runtime configuration — Vertical Slice Plan v0.2 §13 / §72.
 *
 * Collapses the debug/release split and the active preset into one read-only
 * object the game reads at boot. Faz 0 only *reads* gameSpeed and flags; the
 * actual simulation-speed application arrives with the Faz 1 game loop.
 *
 * Pure resolution logic (createRuntimeConfig) is decoupled from the browser so
 * it stays trivially testable; readBootOptionsFromUrl is the thin DOM adapter.
 *
 * No three.js / DOM-render imports (Forge boundary).
 */
import {
  resolveFeatureFlags,
  snapshotFeatureFlags,
  type FeatureFlag,
  type FeatureFlagState,
} from "./featureFlags";
import type { GamePreset } from "../data/gameDataTypes";

export interface RuntimeConfig {
  /** True in the dev server / debug build, false in the shipped game build. */
  isDev: boolean;
  /** Id of the preset in effect, or "default" when none was supplied. */
  presetId: string;
  /** Effective simulation speed multiplier (preset value, overridable). */
  gameSpeed: number;
  /** Resolved, frozen feature-flag state. */
  flags: FeatureFlagState;
}

export interface BootOptions {
  isDev: boolean;
  /** Comma-separated flag allowlist from the URL, e.g. "fogOfWar,minimap". */
  urlFlags?: string | null;
  /** Optional gameSpeed override (e.g. from a debug URL param). */
  gameSpeedOverride?: number | null;
}

const DEFAULT_GAME_SPEED = 1;

/**
 * Build the effective runtime config from an (optional) preset plus boot
 * options. Flag precedence follows resolveFeatureFlags: defaults → preset →
 * URL. gameSpeed comes from the preset unless a numeric override is given.
 */
export function createRuntimeConfig(
  preset: GamePreset | null,
  opts: BootOptions,
): RuntimeConfig {
  const flags = resolveFeatureFlags(preset?.flags, opts.urlFlags ?? null);
  const gameSpeed =
    typeof opts.gameSpeedOverride === "number" && opts.gameSpeedOverride > 0
      ? opts.gameSpeedOverride
      : (preset?.gameSpeed ?? DEFAULT_GAME_SPEED);
  return {
    isDev: opts.isDev,
    presetId: preset?.id ?? "default",
    gameSpeed,
    flags,
  };
}

/** Read boot options from the current browser URL (dev conveniences). */
export function readBootOptionsFromUrl(isDev: boolean): BootOptions {
  const params = new URLSearchParams(location.search);
  const speedRaw = params.get("gameSpeed");
  const speed = speedRaw !== null ? Number.parseFloat(speedRaw) : NaN;
  return {
    isDev,
    urlFlags: params.get("flags"),
    gameSpeedOverride: Number.isFinite(speed) ? speed : null,
  };
}

/** Plain, serializable view for the debug panel / window bridge. */
export function snapshotRuntimeConfig(
  config: RuntimeConfig,
): Record<string, unknown> {
  return {
    isDev: config.isDev,
    presetId: config.presetId,
    gameSpeed: config.gameSpeed,
    flags: snapshotFeatureFlags(config.flags),
  };
}

export type { FeatureFlag };

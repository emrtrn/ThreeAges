/**
 * Feature flags — Vertical Slice Plan v0.2 §13.
 *
 * Incomplete / conditional systems live behind a flag so a half-built feature
 * never breaks the default playable build. Flags are read-only at runtime after
 * they are resolved once from (defaults → active preset → URL override).
 *
 * Rules (plan §13):
 *  - A disabled flag must cost nothing at runtime (callers guard with isEnabled).
 *  - Flag state must be visible in the debug panel (see snapshotFeatureFlags).
 *  - Presets decide flag combinations; a half-built system is never added to the
 *    default vertical_slice preset.
 *
 * Pure TS: no three.js / DOM-render imports (Forge boundary, CLAUDE.md / TD-002).
 */

/** The canonical flag set (plan §13). All default OFF — each is a later or
 *  conditional system, not part of Ürün A's core.
 *
 *  `contentAssets` is the migration gate for
 *  `docs/planned/THREEAGES_RTS_CONTENT_ASSETIZATION_PLAN.md`: with it off the
 *  RTS resolves visuals through the legacy code-side tables
 *  (`rtsBuildingArt`, `rtsMapArt`, `Unit`'s placeholder geometry), which stay
 *  the only authority until each phase's acceptance is met. Turning it on
 *  (`?flags=contentAssets`) selects the Content Drawer asset path instead. It
 *  is never added to a shipped preset before the plan's §13 removal gate. */
export const FEATURE_FLAG_IDS = [
  "age3",
  "regionalVictory",
  "fogOfWar",
  "minimap",
  "prosperity",
  "tower",
  "advancedAI",
  "finalAssets",
  "contentAssets",
] as const;

export type FeatureFlag = (typeof FEATURE_FLAG_IDS)[number];

export type FeatureFlagState = Readonly<Record<FeatureFlag, boolean>>;

const DEFAULT_FLAGS: FeatureFlagState = Object.freeze(
  Object.fromEntries(FEATURE_FLAG_IDS.map((id) => [id, false])) as Record<
    FeatureFlag,
    boolean
  >,
);

export function isFeatureFlag(value: string): value is FeatureFlag {
  return (FEATURE_FLAG_IDS as readonly string[]).includes(value);
}

/**
 * Resolve the effective flag state. Later sources win over earlier ones:
 *   1. built-in defaults (all off)
 *   2. `overrides` (typically the active preset's `flags`)
 *   3. `urlFlags` — a comma-separated allowlist, e.g. `?flags=fogOfWar,minimap`
 *      (dev convenience; each listed flag is forced ON, unknown ids ignored).
 *
 * Unknown ids are dropped rather than throwing so a stale URL never hard-fails
 * the boot; callers wanting strict validation use validateGameData on presets.
 */
export function resolveFeatureFlags(
  overrides?: Partial<Record<string, boolean>>,
  urlFlags?: string | null,
): FeatureFlagState {
  const flags: Record<FeatureFlag, boolean> = { ...DEFAULT_FLAGS };

  if (overrides) {
    for (const [id, value] of Object.entries(overrides)) {
      if (isFeatureFlag(id) && typeof value === "boolean") {
        flags[id] = value;
      }
    }
  }

  if (urlFlags) {
    for (const raw of urlFlags.split(",")) {
      const id = raw.trim();
      if (isFeatureFlag(id)) flags[id] = true;
    }
  }

  return Object.freeze(flags);
}

/** Read a single flag from a resolved state. */
export function isEnabled(state: FeatureFlagState, flag: FeatureFlag): boolean {
  return state[flag];
}

/** Debug-panel snapshot: a plain object copy, safe to display / serialize. */
export function snapshotFeatureFlags(
  state: FeatureFlagState,
): Record<FeatureFlag, boolean> {
  return { ...state };
}

/**
 * Whether the next match is played under fog of war — §59, offered on the §78.1
 * match setup card.
 *
 * Mirrors `match/victoryConditionChoice.ts` deliberately: same shape, same
 * storage-as-a-parameter discipline, same "a browser that cannot remember must
 * still boot" rule. Three setup choices behaving three different ways would be a
 * worse surprise than one more small module.
 *
 * The one place it differs from the victory condition is the default. Fog is ON
 * unless someone says otherwise — the flag's built-in default was turned around
 * in `core/featureFlags.ts`, so this module never has to force it. `null` here
 * still means "the player has not chosen", and an unchosen session leaves the
 * preset and `?flags=` exactly as they were, which is what keeps a §72 test
 * preset able to author a fog-less match.
 *
 * The choice is not a live setting. §13 keeps flags read-only once resolved, so
 * this module only stores the selection and the boot path resolves it — the same
 * one-way order as every other flag. Nothing here reaches into a running match.
 *
 * Pure TS: no three.js / DOM imports, and storage arrives as a parameter so the
 * resolution is testable outside a browser (Forge boundary, CLAUDE.md).
 */

/**
 * Named as what the *match* is like, not as a settings toggle. "Kapalı" would
 * read as switching off a graphics effect; what the player is actually choosing
 * is whether the map is hidden from them, and both rows say so.
 */
export const FOG_OF_WAR_CHOICES = ["on", "off"] as const;

export type FogOfWarChoice = (typeof FOG_OF_WAR_CHOICES)[number];

/**
 * Fog is the shipped match. It is the mode the AI is symmetric under
 * (`ai/aiVisionFilter.ts`) and the one scouting, the ghost markers and the
 * memory layer exist for; a match without it is the deliberate exception.
 */
export const DEFAULT_FOG_OF_WAR: FogOfWarChoice = "on";

/** Where the selection survives the match-setup reload (see `main.ts`). */
export const FOG_OF_WAR_STORAGE_KEY = "threeages.fogOfWar";

export function isFogOfWarChoice(value: string): value is FogOfWarChoice {
  return (FOG_OF_WAR_CHOICES as readonly string[]).includes(value);
}

/** The one mapping from a choice to §59's flag. */
export function fogChoiceEnablesFog(choice: FogOfWarChoice): boolean {
  return choice === "on";
}

/** The inverse: what an already-resolved flag state means on the card. */
export function fogChoiceForFlag(fogEnabled: boolean): FogOfWarChoice {
  return fogEnabled ? "on" : "off";
}

/**
 * Fog for the match about to start — the tur's one non-negotiable rule.
 *
 * A story chain **forces fog on**, the mirror of what `main.ts` already does to
 * regional victory: the tur fixes the shape of the match it teaches, and the
 * setup card hides these controls while it is selected, so what the free-match
 * rows hold is a preference for a *different* match. Letting a fog-less run of
 * that preference through was the bug — the mode meant to teach this game would
 * open the whole map, and every lesson that starts with not knowing where
 * something is (scouting, the remembered-building markers, an enemy who is blind
 * in exactly the same way) is gone before the first objective.
 *
 * Deliberately not a *default* the way the difficulty is (`resolveAiProfile`):
 * a default answers "what if the player has not said", and a hidden control
 * never lets them say. So this is the rule, and it holds no matter where the
 * other answer came from — stored choice, preset, or `?flags=`.
 */
export function fogEnabledForMatch(chosen: boolean, missionRunning: boolean): boolean {
  return missionRunning || chosen;
}

/** The slice of `Storage` this needs; keeps the module free of DOM types. */
export interface FogOfWarStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read a stored choice, or `null` when the player has not chosen yet.
 *
 * `null` is deliberately distinct from `"on"`, even though both end in a fogged
 * match today: an unchosen session must leave the preset and `?flags=` exactly
 * as they were, so a preset authoring `fogOfWar: false` still produces the match
 * it asked for. Only an explicit selection overrides them.
 *
 * A storage that throws (privacy mode, disabled cookies) is treated as empty —
 * the start card must open even when nothing can be remembered.
 */
export function readStoredFogOfWar(
  storage: FogOfWarStorage | null | undefined,
): FogOfWarChoice | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(FOG_OF_WAR_STORAGE_KEY);
  } catch {
    return null;
  }
  return raw !== null && isFogOfWarChoice(raw) ? raw : null;
}

/** Persist a selection. Failure is silent for the same reason as above. */
export function writeStoredFogOfWar(
  storage: FogOfWarStorage | null | undefined,
  choice: FogOfWarChoice,
): void {
  if (!storage) return;
  try {
    storage.setItem(FOG_OF_WAR_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: the choice still applies to the match being set up, it just
    // will not survive the reload. Better than failing the boot.
  }
}

/**
 * The flag override a stored choice contributes to the boot config, or `null`
 * when there is nothing to say. Fed to `BootOptions.flagOverrides`, which wins
 * over both the preset and `?flags=` — and it is the only source that can turn
 * fog *off*, since `?flags=` can only force a flag on.
 */
export function fogOfWarFlagOverride(
  choice: FogOfWarChoice | null,
): Readonly<Record<string, boolean>> | null {
  return choice === null ? null : { fogOfWar: fogChoiceEnablesFog(choice) };
}

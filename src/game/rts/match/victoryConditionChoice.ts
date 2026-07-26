/**
 * The player's victory-condition choice — Vertical Slice Plan v0.2 §78.1
 * "Maç Kurulum Ekranı".
 *
 * §58's regional victory shipped fully behind the `regionalVictory` feature
 * flag, whose only door was `?flags=regionalVictory` or a §72 test preset — a
 * URL parameter. §58's four acceptance criteria passed the 2026-07-18 playtest,
 * so the condition is now an offered *route* rather than an unfinished system,
 * and §78.1 gives it a door on the start card.
 *
 * The choice is not a live setting. §13 keeps flags read-only once resolved, so
 * this module only stores the selection and the boot path resolves it — the same
 * one-way order as every other flag. Nothing here reaches into a running match.
 *
 * Pure TS: no three.js / DOM imports, and storage arrives as a parameter so the
 * resolution is testable outside a browser (Forge boundary, CLAUDE.md).
 */

/**
 * Two routes, not a checkbox per condition. Military victory is never optional —
 * a razed centre always ends the match — so the real question is whether a
 * *second* route is open, and naming both sides keeps the card from implying
 * that picking regional turns the military one off.
 */
export const VICTORY_CONDITION_CHOICES = ["military", "military_regional"] as const;

export type VictoryConditionChoice = (typeof VICTORY_CONDITION_CHOICES)[number];

/**
 * §78.1: military only. The second route is something the player opts into, not
 * a rule they meet without being asked.
 */
export const DEFAULT_VICTORY_CONDITION: VictoryConditionChoice = "military";

/** Where the selection survives the match-setup reload (see `main.ts`). */
export const VICTORY_CONDITION_STORAGE_KEY = "threeages.victoryCondition";

export function isVictoryConditionChoice(value: string): value is VictoryConditionChoice {
  return (VICTORY_CONDITION_CHOICES as readonly string[]).includes(value);
}

/** The one mapping from a choice to §58's flag. */
export function victoryChoiceEnablesRegional(choice: VictoryConditionChoice): boolean {
  return choice === "military_regional";
}

/** The inverse: what an already-resolved flag state means on the card. */
export function victoryChoiceForFlag(regionalEnabled: boolean): VictoryConditionChoice {
  return regionalEnabled ? "military_regional" : "military";
}

/** The slice of `Storage` this needs; keeps the module free of DOM types. */
export interface VictoryConditionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read a stored choice, or `null` when the player has not chosen yet.
 *
 * `null` is deliberately distinct from `"military"`: an unchosen session must
 * leave the preset and `?flags=` exactly as they were, so a dev URL and a §72
 * test preset keep working. Only an explicit selection overrides them.
 *
 * A storage that throws (privacy mode, disabled cookies) is treated as empty —
 * the start card must open even when nothing can be remembered.
 */
export function readStoredVictoryCondition(
  storage: VictoryConditionStorage | null | undefined,
): VictoryConditionChoice | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(VICTORY_CONDITION_STORAGE_KEY);
  } catch {
    return null;
  }
  return raw !== null && isVictoryConditionChoice(raw) ? raw : null;
}

/** Persist a selection. Failure is silent for the same reason as above. */
export function writeStoredVictoryCondition(
  storage: VictoryConditionStorage | null | undefined,
  choice: VictoryConditionChoice,
): void {
  if (!storage) return;
  try {
    storage.setItem(VICTORY_CONDITION_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: the choice still applies to the match being set up, it just
    // will not survive the reload. Better than failing the boot.
  }
}

/**
 * The flag override a stored choice contributes to the boot config, or `null`
 * when there is nothing to say. Fed to `BootOptions.flagOverrides`, which wins
 * over both the preset and `?flags=` — a choice the player made on the card must
 * beat a default they never saw.
 */
export function victoryConditionFlagOverride(
  choice: VictoryConditionChoice | null,
): Readonly<Record<string, boolean>> | null {
  return choice === null ? null : { regionalVictory: victoryChoiceEnablesRegional(choice) };
}

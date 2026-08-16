/**
 * Which opponent the next match is played against — §72's AI profiles, offered
 * on the §78.1 match setup card.
 *
 * Mirrors `victoryConditionChoice.ts` and `vision/fogOfWarChoice.ts` on purpose:
 * same shape, same storage-as-a-parameter discipline, same "a browser that
 * cannot remember must still boot" rule. Four setup choices behaving four
 * different ways would be a worse surprise than one more small module.
 *
 * Where it differs from those two: difficulty is not a feature flag. There is no
 * `flagOverrides` entry to contribute and no `?flags=` door — the profile is a
 * preset field (`aiProfile`), so this module's job is the one resolution the
 * boot needs: an explicit choice wins, otherwise the preset decides, otherwise
 * the fair baseline. `null` from storage is deliberately distinct from
 * `"normal"`, or a §72 preset asking for `hard` would be silently levelled down
 * for every player who never opened the card.
 *
 * §13 still holds: the profile is read once, when `AiController` is constructed,
 * so a change here is a *boot* concern and the host stores it and re-boots
 * rather than reaching into a running match.
 *
 * Pure TS: no three.js / DOM imports, and storage arrives as a parameter so the
 * resolution is testable outside a browser (Forge boundary, CLAUDE.md).
 */
import { AI_PROFILES, type AiProfile } from "../../data/gameDataTypes";

/** The fair baseline: no economy bonus, and the reaction delay §72 pins at 1s. */
export const DEFAULT_AI_PROFILE: AiProfile = "normal";

/** Where the selection survives the match-setup reload (see `main.ts`). */
export const AI_PROFILE_STORAGE_KEY = "threeages.aiProfile";

export function isAiProfile(value: string): value is AiProfile {
  return (AI_PROFILES as readonly string[]).includes(value);
}

/** The slice of `Storage` this needs; keeps the module free of DOM types. */
export interface AiProfileStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read a stored choice, or `null` when the player has not chosen yet.
 *
 * A storage that throws (privacy mode, disabled cookies) is treated as empty —
 * the start card must open even when nothing can be remembered.
 */
export function readStoredAiProfile(
  storage: AiProfileStorage | null | undefined,
): AiProfile | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(AI_PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
  return raw !== null && isAiProfile(raw) ? raw : null;
}

/** Persist a selection. Failure is silent for the same reason as above. */
export function writeStoredAiProfile(
  storage: AiProfileStorage | null | undefined,
  choice: AiProfile,
): void {
  if (!storage) return;
  try {
    storage.setItem(AI_PROFILE_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: the choice still applies to the match being set up, it just
    // will not survive the reload. Better than failing the boot.
  }
}

/**
 * The profile the match boots with: the player's choice, else the preset's, else
 * the baseline. The whole precedence chain in one function, because the card
 * seeds itself from the same answer the AI is built with — a card showing "Zor"
 * over a normal opponent would be lying.
 *
 * `storyMode` is the one exception, and it exists because of what the two
 * defaults meant together. The shipped scenario preset asks for `hard`; a player
 * who has never chosen a difficulty has no stored answer, so the preset won —
 * and the mission mode defaults to the tur for exactly that same player. The
 * person being offered "let me show you the ropes" was being handed the fastest,
 * economy-boosted opponent in the game to learn them against.
 *
 * It moves the *default* only. An explicit choice still wins in both directions:
 * a player who picks "Zor" on the card gets it with the tur running, which is
 * the whole reason the two rows are separate questions.
 */
export function resolveAiProfile(
  chosen: AiProfile | null,
  presetProfile: AiProfile | null | undefined,
  /** Whether the match being set up runs a story chain. */
  storyMode = false,
): AiProfile {
  if (chosen) return chosen;
  return storyMode ? DEFAULT_AI_PROFILE : presetProfile ?? DEFAULT_AI_PROFILE;
}

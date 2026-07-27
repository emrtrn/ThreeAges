/**
 * Whether the next match runs the story chain — Hikâye / Öğretici Tur Modu, Faz 2.
 *
 * Mirrors `match/victoryConditionChoice.ts` deliberately: same shape, same
 * storage-as-a-parameter discipline, same "a browser that cannot remember must
 * still boot" rule. Two setup choices behaving differently would be a worse
 * surprise than one extra module.
 *
 * Where it differs, and why, is the *two* pieces of state:
 *
 * - **The choice** is a match setting and lives in session storage, like the
 *   victory condition. A new tab is a new match, not a saved profile.
 * - **`seen`** is a one-bit fact about the person, and lives in local storage:
 *   they have either been offered the tur and dealt with it, or they have not.
 *   Without it there is no honest default. Defaulting to the tur forever means a
 *   veteran dismisses it every single tab; defaulting to free play means the one
 *   player the mode was built for never finds it. The bit is what lets the
 *   default be "story the first time, free play after" — the answer that is
 *   right for both of them.
 *
 * `seen` is set by *any* resolution: finishing the chain, abandoning it
 * mid-match, or picking free play on the card. All three mean the same thing —
 * the offer was made and answered — and a player who skipped it once should not
 * be asked again on their next tab.
 *
 * Pure TS: no three.js / DOM imports (Forge boundary, CLAUDE.md).
 */

export const MISSION_MODE_CHOICES = ["story", "free"] as const;

export type MissionModeChoice = (typeof MISSION_MODE_CHOICES)[number];

/** The chain shipped with the template; the only one the card can offer today. */
export const DEFAULT_MISSION_SCRIPT_ID = "frontier_road";

export const MISSION_MODE_STORAGE_KEY = "threeages.missionMode";
export const MISSION_SEEN_STORAGE_KEY = "threeages.missionSeen";

export function isMissionModeChoice(value: string): value is MissionModeChoice {
  return (MISSION_MODE_CHOICES as readonly string[]).includes(value);
}

/** The slice of `Storage` this needs; keeps the module free of DOM types. */
export interface MissionModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The mode the card should open on.
 *
 * An explicit choice this session wins. Otherwise it is the tur for a player who
 * has never resolved the offer, and free play for one who has.
 */
export function resolveMissionMode(
  session: MissionModeStorage | null | undefined,
  local: MissionModeStorage | null | undefined,
): MissionModeChoice {
  const stored = read(session, MISSION_MODE_STORAGE_KEY);
  if (stored !== null && isMissionModeChoice(stored)) return stored;
  return hasSeenMission(local) ? "free" : "story";
}

export function writeMissionMode(
  session: MissionModeStorage | null | undefined,
  choice: MissionModeChoice,
): void {
  write(session, MISSION_MODE_STORAGE_KEY, choice);
}

export function hasSeenMission(local: MissionModeStorage | null | undefined): boolean {
  return read(local, MISSION_SEEN_STORAGE_KEY) === "1";
}

/**
 * Record that the offer has been made and answered. Called on every resolution —
 * finished, abandoned, or declined on the card — because all three answer it.
 */
export function markMissionSeen(local: MissionModeStorage | null | undefined): void {
  write(local, MISSION_SEEN_STORAGE_KEY, "1");
}

/**
 * The script id a resolved mode asks the boot to load, or null for free play.
 * The one place the mode is turned into a file name, so a future card offering
 * more than one chain changes here and nowhere else.
 */
export function missionScriptIdForMode(mode: MissionModeChoice): string | null {
  return mode === "story" ? DEFAULT_MISSION_SCRIPT_ID : null;
}

function read(storage: MissionModeStorage | null | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    // Privacy mode / disabled storage. Treated as "nothing remembered", which
    // means a first-time default — the safe side of this particular error.
    return null;
  }
}

function write(storage: MissionModeStorage | null | undefined, key: string, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // The choice still applies to the match being set up; it just will not
    // survive the reload. Better than failing the boot.
  }
}

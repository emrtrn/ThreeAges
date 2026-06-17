/**
 * One-shot editor -> runtime camera handoff.
 *
 * When the editor's Play button opens the game route, it stashes the current
 * viewport camera pose here; the runtime's default camera Game Mode reads it once
 * on boot so Play continues from exactly where the editor was looking. This is a
 * temporary session override — never written to the layout — so opening `/`
 * directly (no handoff) just uses the scene's default framing.
 *
 * Shared by the editor (`SceneApp`/`EditorUi`) and the runtime (`RuntimeSceneApp`);
 * it only touches `localStorage` and plain data, so neither bundle pulls the
 * other in.
 */

const STORAGE_KEY = "forge.play.cameraPose";

/** A camera pose: world position and orientation quaternion (x, y, z, w). */
export interface PlayCameraPose {
  readonly position: [number, number, number];
  readonly quaternion: [number, number, number, number];
}

function isFiniteTuple(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Persists the pose for the next runtime boot. No-op if storage is unavailable. */
export function writePlayCameraPose(pose: PlayCameraPose): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pose));
  } catch {
    // Private-mode / disabled storage: Play still works, just without handoff.
  }
}

/**
 * Reads and clears the stashed pose. Returns null when there is none or the
 * stored value is malformed. Clearing makes the handoff one-shot, so a later
 * manual reload of `/` falls back to the scene's default framing.
 */
export function consumePlayCameraPose(): PlayCameraPose | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) localStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      isFiniteTuple((parsed as PlayCameraPose).position, 3) &&
      isFiniteTuple((parsed as PlayCameraPose).quaternion, 4)
    ) {
      return parsed as PlayCameraPose;
    }
  } catch {
    // Corrupt JSON — ignore and fall back to default framing.
  }
  return null;
}

/**
 * Which Level an RTS match opens.
 *
 * Two things can name one: the URL (`?rts&level=<path>`, what the editor's Play
 * button hands over) and the active preset (`levelRef`, the match's shipped map).
 * Keeping the choice in one pure function is the point — when the two disagreed
 * silently, the editor could save one map and Play could open another, which
 * looks like "my edits did not apply" rather than like the wiring bug it is.
 *
 * The URL wins, and it wins *without* the `levelAssets` flag: naming a Level
 * explicitly is the opt-in. Falling back to the preset's map because a flag was
 * missing would be the same silent divergence in a new place.
 */

export class RtsLevelRefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RtsLevelRefError";
  }
}

/**
 * Accept only a public-root-relative `.level.json` path. The value reaches
 * `fetch` through `projectFileUrl`, so a leading slash or a `..` segment is
 * refused here rather than being resolved against something outside the project.
 */
export function requireRtsLevelRef(value: string, where: string): string {
  if (
    !value.endsWith(".level.json")
    || value.startsWith("/")
    || value.includes("..")
    || value.includes("\\")
    || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)
  ) {
    throw new RtsLevelRefError(`${where}: must be a public-relative .level.json path (got "${value}")`);
  }
  return value;
}

export interface RtsLevelRefRequest {
  /** `?level=` from the URL, or null when absent. */
  readonly levelParam: string | null;
  /** The active preset's shipped map, if it has one. */
  readonly presetLevelRef?: string | undefined;
  /** Whether `?flags=levelAssets` opted the preset's map in. */
  readonly levelAssetsEnabled: boolean;
}

/**
 * The Level to load, or `null` for the code blockout fallback.
 *
 * A malformed `?level=` throws instead of falling through to the preset: the
 * caller asked for a specific map, and quietly playing a different one is the
 * exact failure this resolver exists to remove.
 */
export function resolveRtsLevelRef(request: RtsLevelRefRequest): string | null {
  if (request.levelParam !== null && request.levelParam !== "") {
    return requireRtsLevelRef(request.levelParam, "?level");
  }
  if (request.levelAssetsEnabled && request.presetLevelRef) {
    return requireRtsLevelRef(request.presetLevelRef, "preset levelRef");
  }
  return null;
}

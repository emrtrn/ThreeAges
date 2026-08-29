/**
 * Where the built game is served from.
 *
 * A published game does not own the origin root. itch.io serves a project under
 * `html-classic.itch.zone/html/<id>/`, and a root-absolute `/assets/x.png` there
 * resolves past the game to the *host's* root and 404s — the whole page loads as
 * a blank canvas with no error the player can act on. Vite's `base` is therefore
 * `"./"` in a build (see vite.config.ts), and every public file the runtime
 * fetches or points an element at goes through here instead of being written
 * with a leading slash.
 *
 * Authored paths keep their leading slash. `/assets/ui/icons/x.png` is the
 * spelling in `balance/*.json`, in `UiAssetPath`, and in the engine tests that
 * pin those rows, so it stays the canonical *project* path; this resolves it to
 * a *deploy* URL at the point of use, and accepts either spelling so a caller
 * cannot get it wrong.
 *
 * Read lazily, never at module scope: `tools/engine-tests.ts` imports engine
 * modules under node, where `import.meta.env` does not exist at all. Only a
 * caller that actually builds a URL needs the base, so only that caller asks.
 */

/** The deploy base, always with a trailing slash. `"/"` outside a Vite bundle. */
export function deployBaseUrl(): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/**
 * Resolve a public-root-relative path for `fetch`, `src`, or a three.js loader.
 * Accepts `assets/x.png`, `/assets/x.png`, and backslashes.
 */
export function publicUrl(publicRelativePath: string): string {
  const normalized = publicRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `${deployBaseUrl()}${normalized}`;
}

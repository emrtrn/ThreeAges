/**
 * Data-table (game-data JSON) I/O for the editor (dev-only).
 *
 * Loads a balance file from the project public root and saves it back through
 * the dev `/__save-gamedata` endpoint, which guards the path and JSON shape
 * server-side (see `tools/saveValidator.ts`). The deep, project-specific rule
 * check is the caller's job (the injected `EditorDataTableDef.validate`), run
 * before saving. Mirrors the pattern of `soundCueStore.ts` / `uiWidgetStore.ts`.
 */
import { projectFileUrl } from "@/project/ProjectSystem";

/**
 * Fetch and parse a data-table JSON document. Returns the raw parsed value
 * (an object keyed by entry id); shape validation is left to the caller's
 * injected validator so this stays generic across every balance file.
 */
export async function loadDataTable(path: string): Promise<unknown> {
  const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Data table fetch failed: HTTP ${response.status} (${path})`);
  }
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new Error(`Data table is not valid JSON (${path})`, { cause });
  }
}

export async function saveDataTable(
  path: string,
  data: unknown,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-gamedata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Data table save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

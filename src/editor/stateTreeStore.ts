/**
 * StateTree asset I/O for the editor (dev-only).
 *
 * Loads `*.stateTree.json` assets as raw text (so a malformed file stays editable
 * in the raw-JSON pane instead of being silently replaced) and saves them back
 * through the dev `/__save-state-tree` endpoint, which re-validates and normalises
 * the payload server-side via `normalizeAiStateTreeAsset`
 * (see `tools/saveValidator.ts`). Mirrors the pattern of `behaviorTreeStore.ts`.
 */
import type { AiStateTreeAsset } from "@engine/ai/stateTreeAsset";
import { projectFileUrl } from "@/project/ProjectSystem";

/** A minimal valid StateTree — the starting point for a new/missing asset. */
export function fallbackStateTree(): AiStateTreeAsset {
  return { schema: 1, type: "stateTree", states: [{ id: "Idle" }] };
}

/** The default asset serialized as pretty JSON, used to seed the raw-JSON pane. */
export function defaultStateTreeJson(): string {
  return `${JSON.stringify(fallbackStateTree(), null, 2)}\n`;
}

/**
 * Fetches the raw file text for a `*.stateTree.json` asset. Returns the default
 * template when the file is missing so the editor always has valid seed content;
 * a present-but-malformed file is returned verbatim so the user can repair it.
 */
export async function loadStateTreeText(path: string): Promise<string> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return defaultStateTreeJson();
    const text = await response.text();
    return text.trim().length > 0 ? text : defaultStateTreeJson();
  } catch {
    return defaultStateTreeJson();
  }
}

/**
 * Saves a parsed StateTree object through the dev endpoint. The server
 * re-normalises the payload, so an invalid shape rejects with a descriptive
 * error rather than writing a broken asset.
 */
export async function saveStateTreeAsset(
  path: string,
  stateTree: unknown,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-state-tree", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, stateTree }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `StateTree save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

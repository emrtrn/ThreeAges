/**
 * Behavior Tree asset I/O for the editor (dev-only).
 *
 * Loads `*.behavior.json` assets as raw text (so a malformed file stays editable
 * in the raw-JSON pane instead of being silently replaced) and saves them back
 * through the dev `/__save-behavior` endpoint, which re-validates and normalises
 * the payload server-side via `normalizeAiBehaviorTreeAsset`
 * (see `tools/saveValidator.ts`). Mirrors the pattern of `soundCueStore.ts`.
 */
import type { AiBehaviorTreeAsset } from "@engine/ai/behaviorAsset";
import { projectFileUrl } from "@/project/ProjectSystem";

/** A minimal valid Behavior Tree — the starting point for a new/missing asset. */
export function fallbackBehaviorTree(): AiBehaviorTreeAsset {
  return { schema: 1, type: "behaviorTree", root: { kind: "selector", children: [] } };
}

/** The default asset serialized as pretty JSON, used to seed the raw-JSON pane. */
export function defaultBehaviorTreeJson(): string {
  return `${JSON.stringify(fallbackBehaviorTree(), null, 2)}\n`;
}

/**
 * Fetches the raw file text for a `*.behavior.json` asset. Returns the default
 * template when the file is missing so the editor always has valid seed content;
 * a present-but-malformed file is returned verbatim so the user can repair it.
 */
export async function loadBehaviorTreeText(path: string): Promise<string> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return defaultBehaviorTreeJson();
    const text = await response.text();
    return text.trim().length > 0 ? text : defaultBehaviorTreeJson();
  } catch {
    return defaultBehaviorTreeJson();
  }
}

/**
 * Saves a parsed Behavior Tree object through the dev endpoint. The server
 * re-normalises the payload, so an invalid shape rejects with a descriptive
 * error rather than writing a broken asset.
 */
export async function saveBehaviorTreeAsset(
  path: string,
  behavior: unknown,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch("/__save-behavior", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, behavior }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Behavior Tree save failed: HTTP ${response.status}`);
  }
  return { path: body.path ?? path, changed: body.changed ?? false };
}

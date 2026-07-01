/**
 * Dialogue asset I/O for the editor (dev-only).
 *
 * Loads `*.dialoguevoice.json` / `*.dialogue.json` assets from the project
 * public root and saves them back through the dev `/__save-dialogue-voice` and
 * `/__save-dialogue-line` endpoints, which re-validate + normalise the payload
 * server-side (see `tools/saveValidator.ts`). Mirrors `soundCueStore.ts`.
 */
import type {
  DialogueLineAsset,
  DialogueVoiceAsset,
} from "@engine/dialogue/dialogueTypes";
import { projectFileUrl } from "@/project/ProjectSystem";

function fallbackVoice(name: string): DialogueVoiceAsset {
  return { schema: 1, type: "dialogueVoice", id: "voice", name, gender: "neutral" };
}

function fallbackLine(name: string): DialogueLineAsset {
  return { schema: 1, type: "dialogueLine", id: "line", spokenText: name, contexts: [] };
}

export async function loadDialogueVoiceAsset(
  path: string,
  fallbackName = "Dialogue Voice",
): Promise<DialogueVoiceAsset> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return fallbackVoice(fallbackName);
    const data = (await response.json()) as DialogueVoiceAsset;
    if (data?.schema !== 1 || data?.type !== "dialogueVoice") return fallbackVoice(fallbackName);
    return data;
  } catch {
    return fallbackVoice(fallbackName);
  }
}

export async function loadDialogueLineAsset(
  path: string,
  fallbackName = "Dialogue Line",
): Promise<DialogueLineAsset> {
  try {
    const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
    if (!response.ok) return fallbackLine(fallbackName);
    const data = (await response.json()) as DialogueLineAsset;
    if (data?.schema !== 1 || data?.type !== "dialogueLine") return fallbackLine(fallbackName);
    if (!Array.isArray(data.contexts)) data.contexts = [];
    return data;
  } catch {
    return fallbackLine(fallbackName);
  }
}

async function postSave(
  url: string,
  body: unknown,
  fallbackPath: string,
): Promise<{ path: string; changed: boolean }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
    changed?: boolean;
  };
  if (!response.ok || !result.ok) {
    throw new Error(result.error ?? `Dialogue save failed: HTTP ${response.status}`);
  }
  return { path: result.path ?? fallbackPath, changed: result.changed ?? false };
}

export function saveDialogueVoiceAsset(
  path: string,
  voice: DialogueVoiceAsset,
): Promise<{ path: string; changed: boolean }> {
  return postSave("/__save-dialogue-voice", { path, voice }, path);
}

export function saveDialogueLineAsset(
  path: string,
  line: DialogueLineAsset,
): Promise<{ path: string; changed: boolean }> {
  return postSave("/__save-dialogue-line", { path, line }, path);
}

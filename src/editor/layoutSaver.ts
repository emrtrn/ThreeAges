import type { LayoutSavePayload, LayoutSaveResult } from "@/scene/SceneApp";

export async function saveLayoutViaDevEndpoint(
  payload: LayoutSavePayload,
): Promise<LayoutSaveResult> {
  let response: Response;
  try {
    response = await fetch("/__save-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `Layout save endpoint is not reachable. Start the Forge editor dev server with \`npm.cmd run editor\` and open http://127.0.0.1:5173/?editor. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    path?: string;
  };
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Save failed: HTTP ${response.status}`);
  }
  return body.path === undefined ? {} : { path: body.path };
}

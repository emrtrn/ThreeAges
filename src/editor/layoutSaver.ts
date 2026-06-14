import type { LayoutSavePayload, LayoutSaveResult } from "@/scene/SceneApp";

export async function saveLayoutViaDevEndpoint(
  payload: LayoutSavePayload,
): Promise<LayoutSaveResult> {
  const response = await fetch("/__save-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

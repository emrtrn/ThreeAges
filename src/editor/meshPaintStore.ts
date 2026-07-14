/** Editor-only persistence for `<layout>.meshpaint.json` placement sidecars. */
import type { LayoutMeshPaintData } from "@engine/scene/meshPaint";

export async function saveMeshPaintData(path: string, meshPaint: LayoutMeshPaintData): Promise<void> {
  const response = await fetch("/__save-meshpaint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, meshPaint }),
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!response.ok || !body.ok) throw new Error(body.error ?? `Mesh Paint save failed: HTTP ${response.status}`);
}

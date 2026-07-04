import { assetType, type EditableAsset } from "@engine/assets/manifest";
import type { EditableSelection } from "@/scene/SceneApp";

export function renderMaterialSection(
  selection: EditableSelection,
  editableAssets: readonly EditableAsset[],
): string {
  if (selection.kind !== "instance") return "";
  const materialAssets = editableAssets.filter((asset) => assetType(asset) === "material");
  const options = [`<option value="" ${selection.materialSlot ? "" : "selected"}>None</option>`]
    .concat(
      materialAssets.map(
        (asset) =>
          `<option value="${escapeHtml(asset.id)}" ${
            selection.materialSlot === asset.id ? "selected" : ""
          }>${escapeHtml(asset.displayName ?? asset.name)}</option>`,
      ),
    )
    .join("");
  return `
      <div class="detail-section">
        <div class="detail-section-title">Materials</div>
        <label class="detail-row">
          <span>Element 0</span>
          <select data-material-slot ${selection.locked ? "disabled" : ""}>${options}</select>
        </label>
      </div>
    `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

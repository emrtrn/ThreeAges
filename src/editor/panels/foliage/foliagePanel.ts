import type {
  FoliageTargetFilters,
  FoliageTool,
  FoliageToolSettings,
  FoliageTypeView,
} from "@/scene/SceneApp";

/** A pickable asset row (id + display name) for the type dropdowns. */
export interface FoliageAssetOption {
  id: string;
  name: string;
}

export interface FoliagePanelOptions {
  body: HTMLElement;
  settings: FoliageToolSettings;
  types: FoliageTypeView[];
  /** `foliageType` assets in the project not yet added to the active list. */
  availableTypeAssets: FoliageAssetOption[];
  /** Static-mesh assets, for the "new foliage type from mesh" flow. */
  staticMeshAssets: FoliageAssetOption[];
  apply(patch: Partial<FoliageToolSettings>): void;
  setActiveType(id: string): void;
  addType(assetId: string): void;
  removeType(assetId: string): void;
  createType(name: string, meshAssetId: string): void;
}

const TOOLS: { id: FoliageTool; label: string; tip: string }[] = [
  { id: "select", label: "Select", tip: "Navigate/select (no painting)" },
  { id: "paint", label: "Paint", tip: "Paint the active foliage type" },
  { id: "erase", label: "Erase", tip: "Erase any foliage under the brush" },
  { id: "single", label: "Single", tip: "Place one instance per click" },
  { id: "remove", label: "Remove", tip: "Erase only the active type" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderFoliagePanel(options: FoliagePanelOptions): void {
  options.body.innerHTML = renderHtml(options);
  bindInputs(options);
}

function renderHtml(options: FoliagePanelOptions): string {
  const { settings, types } = options;
  const toolButtons = TOOLS.map(
    (tool) =>
      `<button type="button" class="foliage-tool${
        settings.tool === tool.id ? " active" : ""
      }" data-foliage-tool="${tool.id}" title="${escapeHtml(tool.tip)}">${tool.label}</button>`,
  ).join("");

  const typeRows =
    types.length === 0
      ? `<div class="detail-hint">No foliage types yet. Add one below.</div>`
      : types
          .map(
            (type) => `
        <label class="foliage-type-row${
          settings.activeTypeId === type.id ? " active" : ""
        }">
          <input type="radio" name="foliage-active-type" value="${escapeHtml(type.id)}" ${
            settings.activeTypeId === type.id ? "checked" : ""
          } />
          <span class="foliage-type-name">${escapeHtml(type.name)}</span>
          <span class="foliage-type-count">${type.instanceCount}</span>
          <button type="button" class="foliage-type-remove" data-foliage-remove="${escapeHtml(
            type.id,
          )}" title="Remove type + its instances">✕</button>
        </label>`,
          )
          .join("");

  const availableOptions = options.availableTypeAssets
    .map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`)
    .join("");
  const meshOptions = options.staticMeshAssets
    .map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`)
    .join("");

  return `
    <div class="detail-heading">
      <strong>Foliage Mode</strong>
      <span>Paint static-mesh foliage</span>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Tools</div>
      <div class="foliage-tools">${toolButtons}</div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Brush Options</div>
      <label class="detail-row">
        <span>Brush Size</span>
        <input type="number" min="0.1" step="0.5" value="${settings.brushSize}" data-foliage-brush-size />
      </label>
      <label class="detail-row">
        <span>Paint Density</span>
        <input type="number" min="0" max="4" step="0.1" value="${settings.paintDensity}" data-foliage-paint-density />
      </label>
      <label class="detail-row">
        <span>Erase Density</span>
        <input type="number" min="0" max="1" step="0.1" value="${settings.eraseDensity}" data-foliage-erase-density />
      </label>
      <label class="detail-row">
        <span>Random Seed</span>
        <input type="number" min="1" step="1" value="${settings.randomSeed}" data-foliage-seed />
      </label>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Filters</div>
      <label class="detail-row detail-toggle">
        <span>Landscape</span>
        <input type="checkbox" ${settings.filters.landscape ? "checked" : ""} data-foliage-filter="landscape" />
      </label>
      <label class="detail-row detail-toggle">
        <span>Static Mesh</span>
        <input type="checkbox" ${settings.filters.staticMesh ? "checked" : ""} data-foliage-filter="staticMesh" />
      </label>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Foliage Types</div>
      <div class="foliage-type-list">${typeRows}</div>
      <div class="foliage-add-row">
        <select data-foliage-add-select ${availableOptions ? "" : "disabled"}>
          ${availableOptions || `<option value="">No unused types</option>`}
        </select>
        <button type="button" data-foliage-add ${availableOptions ? "" : "disabled"}>Add</button>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">New Type From Mesh</div>
      <label class="detail-row">
        <span>Mesh</span>
        <select data-foliage-new-mesh>${
          meshOptions || `<option value="">No static meshes</option>`
        }</select>
      </label>
      <label class="detail-row">
        <span>Name</span>
        <input type="text" placeholder="Grass" data-foliage-new-name />
      </label>
      <button type="button" class="foliage-create" data-foliage-create ${
        meshOptions ? "" : "disabled"
      }>Create Foliage Type</button>
    </div>
  `;
}

function bindInputs(options: FoliagePanelOptions): void {
  const { body } = options;

  body.querySelectorAll<HTMLButtonElement>("[data-foliage-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      options.apply({ tool: button.dataset.foliageTool as FoliageTool });
    });
  });

  body.querySelectorAll<HTMLInputElement>('input[name="foliage-active-type"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) options.setActiveType(input.value);
    });
  });

  body.querySelectorAll<HTMLButtonElement>("[data-foliage-remove]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const id = button.dataset.foliageRemove;
      if (id) options.removeType(id);
    });
  });

  const numberInput = (
    selector: string,
    key: "brushSize" | "paintDensity" | "eraseDensity" | "randomSeed",
  ): void => {
    body.querySelector<HTMLInputElement>(selector)?.addEventListener("change", (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      if (Number.isFinite(value)) options.apply({ [key]: value } as Partial<FoliageToolSettings>);
    });
  };
  numberInput("[data-foliage-brush-size]", "brushSize");
  numberInput("[data-foliage-paint-density]", "paintDensity");
  numberInput("[data-foliage-erase-density]", "eraseDensity");
  numberInput("[data-foliage-seed]", "randomSeed");

  body.querySelectorAll<HTMLInputElement>("[data-foliage-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const filters: FoliageTargetFilters = { ...options.settings.filters };
      const key = input.dataset.foliageFilter as keyof FoliageTargetFilters;
      filters[key] = input.checked;
      options.apply({ filters });
    });
  });

  const addSelect = body.querySelector<HTMLSelectElement>("[data-foliage-add-select]");
  body.querySelector<HTMLButtonElement>("[data-foliage-add]")?.addEventListener("click", () => {
    const id = addSelect?.value;
    if (id) options.addType(id);
  });

  body.querySelector<HTMLButtonElement>("[data-foliage-create]")?.addEventListener("click", () => {
    const mesh = body.querySelector<HTMLSelectElement>("[data-foliage-new-mesh]")?.value ?? "";
    const nameInput = body.querySelector<HTMLInputElement>("[data-foliage-new-name]");
    const name = (nameInput?.value ?? "").trim() || "Foliage Type";
    if (mesh) options.createType(name, mesh);
  });
}

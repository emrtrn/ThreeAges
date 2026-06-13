import type { EditableAsset } from "@/scene/assetLoader";
import type {
  EditableSceneObject,
  EditableSelection,
  EditableTransform,
  EditorHistoryState,
  SceneApp,
} from "@/scene/SceneApp";

type Tool = "select" | "move" | "rotate" | "scale";

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  move: "Move",
  rotate: "Rotate",
  scale: "Scale",
};

export class EditorUi {
  private root: HTMLDivElement;
  private contentList: HTMLDivElement;
  private outlinerList: HTMLDivElement;
  private detailsBody: HTMLDivElement;
  private statusText: HTMLDivElement;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private selected: EditableSelection | null = null;
  private detailsBaseline: EditableTransform | null = null;

  constructor(private readonly app: SceneApp) {
    document.body.classList.add("editor-mode");

    this.root = document.createElement("div");
    this.root.id = "editor-ui";
    this.root.className = "editor-shell";
    this.root.innerHTML = `
      <header class="editor-topbar">
        <div class="editor-brand">
          <strong>3DGameDev Editor</strong>
          <span data-project-name>loading project</span>
        </div>
        <div class="editor-tools" data-tools></div>
        <div class="editor-snaps">
          <label>
            <span>Move</span>
            <select data-snap="move">
              <option value="1" selected>1</option>
              <option value="10">10</option>
              <option value="100">100</option>
            </select>
          </label>
          <label>
            <span>Rotate</span>
            <select data-snap="rotate">
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15" selected>15</option>
              <option value="30">30</option>
              <option value="45">45</option>
              <option value="90">90</option>
            </select>
          </label>
          <label>
            <span>Scale</span>
            <select data-snap="scale">
              <option value="0.05">0.05</option>
              <option value="0.1" selected>0.1</option>
              <option value="0.25">0.25</option>
              <option value="0.5">0.5</option>
              <option value="1">1</option>
            </select>
          </label>
        </div>
        <div class="editor-actions">
          <button type="button" data-action="undo" title="Undo">Undo</button>
          <button type="button" data-action="redo" title="Redo">Redo</button>
          <button type="button" data-action="delete">Delete</button>
          <button type="button" data-action="save" class="primary">Save Layout</button>
        </div>
      </header>
      <aside class="editor-panel editor-content">
        <div class="panel-title">Content Browser</div>
        <div class="content-tabs">
          <button type="button" class="active" data-filter="all">All</button>
          <button type="button" data-filter="furniture">Furniture</button>
          <button type="button" data-filter="room">Room</button>
          <button type="button" data-filter="character">Characters</button>
        </div>
        <div class="content-list" data-content-list></div>
      </aside>
      <aside class="editor-panel editor-outliner">
        <div class="panel-title">Scene Outliner</div>
        <div class="outliner-list" data-outliner-list></div>
      </aside>
      <aside class="editor-panel editor-details">
        <div class="panel-title">Details</div>
        <div class="details-body" data-details-body></div>
      </aside>
      <footer class="editor-status" data-status>Ready</footer>
    `;

    const overlay = document.getElementById("ui-overlay");
    if (!overlay) throw new Error("Missing #ui-overlay");
    overlay.append(this.root);

    this.contentList = requireElement(this.root, "[data-content-list]");
    this.outlinerList = requireElement(this.root, "[data-outliner-list]");
    this.detailsBody = requireElement(this.root, "[data-details-body]");
    this.statusText = requireElement(this.root, "[data-status]");
    this.undoButton = requireElement(this.root, '[data-action="undo"]');
    this.redoButton = requireElement(this.root, '[data-action="redo"]');
    const projectName = requireElement(this.root, "[data-project-name]");

    this.buildToolbar();
    this.bindActions();
    this.renderDetails(null);

    this.app.onSelectionChanged = (selection) => {
      this.selected = selection;
      this.detailsBaseline = null;
      this.renderDetails(selection);
    };
    this.app.onSceneObjectsChanged = (objects) => this.renderOutliner(objects);
    this.app.onHistoryChanged = (state) => this.renderHistory(state);
    this.app.onStatus = (message, tone) => this.setStatus(message, tone);

    this.renderOutliner(this.app.getSceneObjects());
    this.renderHistory(this.app.getHistoryState());
    void this.loadContent(projectName);
  }

  private buildToolbar(): void {
    const tools = requireElement(this.root, "[data-tools]");
    (["select", "move", "rotate", "scale"] as Tool[]).forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = TOOL_LABELS[tool];
      button.dataset.tool = tool;
      if (tool === "move") button.classList.add("active");
      button.addEventListener("click", () => {
        for (const item of this.toolButtons.values()) item.classList.remove("active");
        button.classList.add("active");
        this.app.setEditorTool(tool);
      });
      tools.append(button);
      this.toolButtons.set(tool, button);
    });
  }

  private bindActions(): void {
    this.root.querySelector('[data-action="undo"]')?.addEventListener("click", () => {
      this.app.undo();
    });
    this.root.querySelector('[data-action="redo"]')?.addEventListener("click", () => {
      this.app.redo();
    });
    this.root.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
      this.app.deleteSelected();
    });
    this.root.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      void this.save();
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        this.root
          .querySelectorAll("[data-filter]")
          .forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        this.filterContent(button.dataset.filter ?? "all");
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>("[data-snap]").forEach((select) => {
      select.addEventListener("change", () => {
        const value = Number(select.value);
        if (!Number.isFinite(value)) return;
        if (select.dataset.snap === "move") this.app.setSnapSettings({ move: value });
        if (select.dataset.snap === "rotate") this.app.setSnapSettings({ rotate: value });
        if (select.dataset.snap === "scale") this.app.setSnapSettings({ scale: value });
      });
    });

    window.addEventListener("keydown", (event) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
        return;
      }
      if (event.code === "KeyZ" && !event.shiftKey) {
        event.preventDefault();
        this.app.undo();
      } else if (event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey)) {
        event.preventDefault();
        this.app.redo();
      }
    });
  }

  private async loadContent(projectName: HTMLElement): Promise<void> {
    const assets = await this.app.getEditableAssets();
    projectName.textContent = "project catalog";
    this.contentList.replaceChildren(
      ...assets.map((asset) => this.createAssetCard(asset)),
    );
  }

  private createAssetCard(asset: EditableAsset): HTMLElement {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "asset-card";
    card.draggable = true;
    card.dataset.category = categoryFilter(asset);
    card.dataset.assetId = asset.id;
    card.innerHTML = `
      <span class="asset-thumb">${iconFor(asset)}</span>
      <span class="asset-meta">
        <strong>${asset.displayName}</strong>
        <small>${asset.catalogCategory}</small>
      </span>
    `;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("application/x-3dgamedev-asset", asset.id);
      event.dataTransfer!.effectAllowed = "copy";
      this.setStatus(`Dragging ${asset.id}.`);
    });
    card.addEventListener("click", () => {
      this.app.beginAssetPlacement(asset.id);
    });
    return card;
  }

  private filterContent(filter: string): void {
    this.contentList.querySelectorAll<HTMLElement>(".asset-card").forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });
  }

  private renderOutliner(objects: EditableSceneObject[]): void {
    if (objects.length === 0) {
      this.outlinerList.innerHTML = `
        <div class="empty-details">
          <strong>No objects</strong>
          <span>Scene</span>
        </div>
      `;
      return;
    }

    this.outlinerList.replaceChildren(
      ...objects.map((object) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "outliner-row";
        row.dataset.objectId = object.id;
        if (object.selected) row.classList.add("active");
        row.innerHTML = `
          <span class="outliner-kind">${object.kind === "character" ? "C" : "I"}</span>
          <span class="outliner-meta">
            <strong>${object.label}</strong>
            <small>${object.assetId} - ${formatPosition(object.position)}</small>
          </span>
        `;
        row.addEventListener("click", () => this.app.selectSceneObject(object.id));
        return row;
      }),
    );
  }

  private renderHistory(state: EditorHistoryState): void {
    this.undoButton.disabled = !state.canUndo;
    this.redoButton.disabled = !state.canRedo;
    this.undoButton.title = state.undoLabel ? `Undo ${state.undoLabel}` : "Undo";
    this.redoButton.title = state.redoLabel ? `Redo ${state.redoLabel}` : "Redo";
  }

  private renderDetails(selection: EditableSelection | null): void {
    if (!selection) {
      this.detailsBody.innerHTML = `
        <div class="empty-details">
          <strong>No selection</strong>
          <span>Viewport</span>
        </div>
      `;
      return;
    }

    this.detailsBody.innerHTML = `
      <div class="detail-heading">
        <strong>${selection.label}</strong>
        <span>${selection.kind} / ${selection.assetId}</span>
      </div>
      ${numberInput("X", "x", selection.position[0])}
      ${numberInput("Y", "y", selection.position[1])}
      ${numberInput("Z", "z", selection.position[2])}
      ${numberInput("Rotation Y", "rotationYDeg", selection.rotationYDeg)}
      ${numberInput("Scale", "scale", selection.scale, 0.05)}
    `;

    this.detailsBody.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.addEventListener("focus", () => this.beginDetailsEdit());
      input.addEventListener("input", () => {
        this.beginDetailsEdit();
        this.applyDetails();
      });
      input.addEventListener("change", () => this.commitDetailsEdit());
    });
  }

  private beginDetailsEdit(): void {
    this.detailsBaseline ??= this.app.captureSelectedTransform();
  }

  private commitDetailsEdit(): void {
    this.beginDetailsEdit();
    this.applyDetails();
    this.app.commitSelectedTransform(this.detailsBaseline);
    this.detailsBaseline = null;
  }

  private applyDetails(): void {
    if (!this.selected) return;
    const value = (name: string): number => {
      const input = this.detailsBody.querySelector<HTMLInputElement>(
        `input[name="${name}"]`,
      );
      return Number(input?.value ?? 0);
    };
    this.app.updateSelectedTransform(
      {
        position: [value("x"), value("y"), value("z")],
        rotationYDeg: value("rotationYDeg"),
        scale: Math.max(0.05, value("scale")),
      },
      {
        notifySelection: false,
      },
    );
  }

  private async save(): Promise<void> {
    try {
      await this.app.saveLayout();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  private setStatus(
    message: string,
    tone: "info" | "success" | "warning" | "error" = "info",
  ): void {
    this.statusText.textContent = message;
    this.statusText.dataset.tone = tone;
  }
}

function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing editor element: ${selector}`);
  return element as T;
}

function numberInput(label: string, name: string, value: number, step = 0.1): string {
  return `
    <label class="detail-row">
      <span>${label}</span>
      <input name="${name}" type="number" step="${step}" value="${Number(value.toFixed(3))}" />
    </label>
  `;
}

function categoryFilter(asset: EditableAsset): "room" | "character" | "furniture" {
  if (asset.placement.surface === "room") return "room";
  if (asset.placement.surface === "character") return "character";
  return "furniture";
}

function iconFor(asset: EditableAsset): string {
  if (asset.placement.surface === "room") return "R";
  if (asset.placement.surface === "character") return "C";
  return "M";
}

function formatPosition(position: [number, number, number]): string {
  return position.map((value) => Number(value.toFixed(2))).join(", ");
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

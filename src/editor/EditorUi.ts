// Editor-only styles. Importing here (rather than statically in index.html)
// keeps them in the dev-only editor chunk, out of the production game build.
import "./editorUi.css";
import {
  assetPath,
  assetRecordById,
  assetType,
  inferAssetTypeFromPath,
  isModelAssetType,
  type EditableAsset,
} from "@engine/assets/manifest";
import type {
  EditableSceneObject,
  EditableSelection,
  EditorProjectInfo,
  EditorHistoryState,
  EditorSnapSettings,
  EditorWorldSettings,
  EditableTransform,
  EditableTransformSnapshot,
  SceneApp,
} from "@/scene/SceneApp";
import type { MetadataSchema } from "@engine/scene/metadataSchema";
import {
  AMBIENT_SOUND_ASSET_ID,
  isShapePrimitiveType,
  PLAYER_START_ASSET_ID,
  shapeAssetId,
  type ShapePrimitiveType,
} from "@engine/scene/shapes";
import { writePlayCameraPose } from "@/play/cameraHandoff";
import { ThumbnailRenderer, type ThumbnailMaterialPreview } from "./ThumbnailRenderer";
import {
  createProjectContent,
  deleteProjectContent,
  fetchProjectDir,
  findProjectDir,
  flattenProjectFiles,
  importProjectAsset,
  normalizeProjectPath,
  openProjectLevel,
  renameProjectContent,
  type ContentNewKind,
  type ProjectDirNode,
} from "@/project/ProjectAssetTree";
import { projectFileUrl } from "@/project/ProjectSystem";
import { loadAssetMaterialSlots } from "@/scene/assetMaterialSlotsLoader";
import {
  getGameEditorCatalog,
  type EditorGameModeOption,
} from "@/editor/gameEditorRegistry";
import { loadActorScript } from "@/editor/actorScriptStore";
import {
  PARENT_CLASSES,
  PARENT_CLASS_DESCRIPTIONS,
  PARENT_CLASS_LABELS,
  type ParentClass,
} from "@engine/scene/actorScript";
import {
  FORGE_MATERIAL_PRESETS,
  normalizeForgeMaterialDef,
  type ForgeMaterialPreset,
} from "@engine/assets/material";
import {
  PARTICLE_EFFECT_PRESETS,
  PARTICLE_PRESET_DESCRIPTIONS,
  PARTICLE_PRESET_LABELS,
  type ParticleEffectPreset,
} from "@engine/vfx/particleEffectPresets";
import {
  nextTransformTool,
  type EditorTool,
  type TransformSpace,
} from "@editor/core/tools";
import {
  bindInstanceDetails,
  renderInstanceDetails,
} from "./panels/details/instanceDetails";
import {
  bindCollisionOverrideInputs,
  renderCollisionSection,
} from "./panels/details/collisionDetails";
import { renderMaterialSection } from "./panels/details/materialDetails";
import {
  bindPhysicsInputs,
  renderPhysicsSection,
} from "./panels/details/physicsDetails";
import {
  bindComponentsInputs,
  renderComponentsSection,
} from "./panels/details/componentDetails";
import {
  bindMetadataInputs,
  renderMetadataSections,
} from "./panels/details/metadataDetails";
import {
  renderBlockingVolumeDetails,
  renderLightDetails,
  renderReflectionCaptureDetails,
  renderReflectionPlaneDetails,
  renderReflectiveSurfaceDetails,
  renderWorldWidgetDetails,
  type SpecialActorDetailsOptions,
} from "./panels/details/specialActorDetails";
import {
  renderCloudDetails,
  renderFogDetails,
  renderPostDetails,
  renderSkyDetails,
  type EnvironmentDetailsOptions,
} from "./panels/details/environmentDetails";
import { renderWorldSettingsPanel } from "./panels/world/worldSettingsPanel";
import { renderOutlinerPanel } from "./panels/outliner/outlinerPanel";
import {
  CONTENT_FILTER_ALL,
  contentItemMatchesQuery,
  isActorScriptItem,
  isContentTypeFilter,
  isLevelItem,
  isUiWidgetItem,
  renderContentAssetsPanel,
  renderContentFilterOptions,
  type BrowserAssetItem,
  type BrowserFolderItem,
  type ContentTypeFilter,
} from "./panels/content/contentPanel";

type InspectorTab = "details" | "world";

/** Typed assets the Content Browser context menu can create (besides folders). */
const CONTENT_NEW_ITEMS: ReadonlyArray<{ kind: ContentNewKind; label: string }> = [
  { kind: "level", label: "Level" },
  { kind: "material", label: "Material" },
  { kind: "particle", label: "Particle" },
  { kind: "script", label: "Script" },
  { kind: "sound", label: "Sound" },
  { kind: "soundCue", label: "Sound Cue" },
  { kind: "dialogueVoice", label: "Dialogue Voice" },
  { kind: "dialogueLine", label: "Dialogue Line" },
  { kind: "ui", label: "UI" },
];

const MATERIAL_PRESET_LABELS: Record<ForgeMaterialPreset, string> = {
  standard: "Standard Surface",
  textured: "Textured Surface",
  metal: "Metal",
  glass: "Glass",
  emissive: "Emissive",
  basic: "Unlit Basic",
};

const MATERIAL_PRESET_DESCRIPTIONS: Record<ForgeMaterialPreset, string> = {
  standard: "General lit PBR material with neutral roughness.",
  textured: "Standard material prepared for texture slots.",
  metal: "Reflective metal starter values.",
  glass: "Simple transparent glass-like starter values.",
  emissive: "Self-lit surface for signs, screens, and glow accents.",
  basic: "Unlit material for simple debug or UI-like surfaces.",
};

/** A context-menu entry: a clickable item or a visual separator. */
type ContextMenuItem =
  | { separator: true }
  | { separator?: false; label: string; enabled?: boolean; danger?: boolean; run: () => void };

const TOOL_LABELS: Record<EditorTool, string> = {
  select: "Select",
  move: "Move",
  rotate: "Rotate",
  scale: "Scale",
};

export class EditorUi {
  private root: HTMLDivElement;
  private contentList: HTMLDivElement;
  private contentDrawer: HTMLElement;
  private contentToggle: HTMLButtonElement;
  private contentRootLabel: HTMLElement;
  private contentPathLabel: HTMLElement;
  private contentStatus: HTMLElement;
  private contentSearch: HTMLInputElement;
  private contentTypeFilter: HTMLSelectElement;
  private contentDevelopmentToggle: HTMLInputElement;
  private contentSizeToggle: HTMLButtonElement;
  private folderTree: HTMLElement;
  private outlinerList: HTMLDivElement;
  private detailsBody: HTMLDivElement;
  private worldSettingsBody: HTMLDivElement;
  private statusText: HTMLElement;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private toolButtons = new Map<EditorTool, HTMLButtonElement>();
  private readonly thumbnailRenderer = new ThumbnailRenderer();
  private readonly materialPreviewCache = new Map<string, Promise<ThumbnailMaterialPreview | undefined>>();
  private readonly modelMaterialPreviewCache = new Map<string, Promise<ThumbnailMaterialPreview | undefined>>();
  private activeTool: EditorTool = "move";
  private projectInfo: EditorProjectInfo | null = null;
  private metadataSchema: MetadataSchema | null = null;
  private editableAssets: EditableAsset[] = [];
  private assetTreeRoot: ProjectDirNode | null = null;
  /** All project Actor Script classes discovered for editor pickers (game mode / pawn). */
  private projectActorClasses: { path: string; name: string; parentClass: ParentClass }[] = [];
  /** Project `gameMode` Actor Scripts discovered for the World Settings dropdown. */
  private projectGameModes: EditorGameModeOption[] = [];
  private selectedFolder = "";
  private collapsedFolderPaths = new Set<string>();
  /** Content Browser asset card highlighted as selected (orange). */
  private selectedAssetId: string | null = null;
  /** Content Browser folder card highlighted as selected. */
  private selectedContentFolderPath: string | null = null;
  /** Last asset-grid summary status, restored when the selection is cleared. */
  private contentListStatus = "";
  /** Cached 1x1 transparent image used to suppress the native drag thumbnail. */
  private emptyDragImage: HTMLImageElement | null = null;
  private contentQuery = "";
  private contentType: ContentTypeFilter = CONTENT_FILTER_ALL;
  private contentDrawerOpen = false;
  private contentDrawerTall = false;
  private showDevelopmentContent = false;
  private contentRefreshTimer = 0;
  private outlinerObjects: EditableSceneObject[] = [];
  private outlinerFilter = "";
  private selected: EditableSelection | null = null;
  private worldSettings: EditorWorldSettings | null = null;
  private detailsBaseline: EditableTransformSnapshot[] | null = null;
  private detailsScale: [number, number, number] | null = null;
  private transformClipboard: EditableTransform | null = null;
  private contextMenu: HTMLElement | null = null;
  private contextMenuCleanup: (() => void) | null = null;
  /** Hidden file input reused by the Content Browser Import flow. */
  private importInput: HTMLInputElement | null = null;
  /** Folder the next Import upload targets (set when Import is clicked). */
  private importTargetDir = "";

  constructor(private readonly app: SceneApp) {
    document.body.classList.add("editor-mode");
    // Preload the transparent drag image so setDragImage works on the first drag.
    this.getEmptyDragImage();

    this.root = document.createElement("div");
    this.root.id = "editor-ui";
    this.root.className = "editor-shell";
    this.root.dataset.testid = "forge-editor";
    this.root.addEventListener("contextmenu", (event) => event.preventDefault());
    this.root.innerHTML = `
      <header class="editor-topbar">
        <div class="editor-brand">
          <strong>Forge Editor</strong>
          <span data-project-name>loading project</span>
        </div>
        <div class="editor-tools" data-tools></div>
        <div class="editor-snaps">
          <label class="snap-toggle">
            <input type="checkbox" data-snap-toggle="move" checked />
            <span>Grid</span>
          </label>
          <label>
            <span>Move</span>
            <select data-snap="move">
              <option value="0.25">0.25</option>
              <option value="0.5">0.5</option>
              <option value="1" selected>1</option>
            </select>
          </label>
          <label class="snap-toggle">
            <input type="checkbox" data-snap-toggle="rotate" checked />
            <span>Rot</span>
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
          <label class="snap-toggle">
            <input type="checkbox" data-snap-toggle="scale" checked />
            <span>Scale</span>
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
          <div class="add-actor-menu">
            <button type="button" data-add-actor-button data-testid="add-actor-button" title="Add actor">+ Add Actor</button>
            <div class="add-actor-popover" data-add-actor-popover>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Lights</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-actor="directional">Directional Light</button>
                  <button type="button" data-add-actor="point">Point Light</button>
                  <button type="button" data-add-actor="spot">Spot Light</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Shapes</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-shape="cube" data-testid="add-shape-cube">Cube</button>
                  <button type="button" data-add-shape="sphere">Sphere</button>
                  <button type="button" data-add-shape="cylinder">Cylinder</button>
                  <button type="button" data-add-shape="cone">Cone</button>
                  <button type="button" data-add-shape="plane">Plane</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Volumes</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-blocking-volume>Blocking Volume</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Visual Effects</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-sky-atmosphere>Sky Atmosphere</button>
                  <button type="button" data-add-height-fog>Exponential Height Fog</button>
                  <button type="button" data-add-cloud-layer>Cloud Layer</button>
                  <button type="button" data-add-reflection-plane>Mirror Plane</button>
                  <button type="button" data-add-reflective-surface>Reflective Surface</button>
                  <button type="button" data-add-reflection-capture>Sphere Reflection Capture</button>
                  <button type="button" data-add-post-process>Post Process</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Sounds</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-ambient-sound>Ambient Sound</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">UI</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-world-widget>World Widget</button>
                </div>
              </div>
              <div class="add-actor-category">
                <button type="button" class="add-actor-category-label">Gameplay</button>
                <div class="add-actor-submenu">
                  <button type="button" data-add-player-start>Player Start</button>
                </div>
              </div>
            </div>
          </div>
          <div class="show-menu">
            <button type="button" data-show-button title="Show flags">Show</button>
            <div class="show-popover" data-show-popover>
              <div class="add-actor-section-title">Show Flags</div>
              <label>
                <input type="checkbox" data-show-flag="collision" />
                Collision
              </label>
              <label>
                <input type="checkbox" data-show-flag="ai-navigation" />
                AI Navigation
              </label>
            </div>
          </div>
          <button type="button" data-action="undo" data-testid="editor-undo" title="Undo">Undo</button>
          <button type="button" data-action="redo" data-testid="editor-redo" title="Redo">Redo</button>
          <button type="button" data-action="delete">Delete</button>
          <button type="button" data-action="play" data-testid="editor-play" title="Save & open runtime (P)">Play</button>
          <button type="button" data-action="save" data-testid="editor-save" class="primary">Save Layout</button>
        </div>
      </header>
      <aside class="editor-panel editor-outliner">
        <div class="panel-title">Scene Outliner</div>
        <input
          class="outliner-search"
          type="search"
          data-outliner-search
          placeholder="Search"
        />
        <div class="outliner-list" data-outliner-list></div>
      </aside>
      <aside class="editor-panel editor-details">
        <div class="inspector-tabs" role="tablist" aria-label="Inspector">
          <button
            type="button"
            class="inspector-tab active"
            data-inspector-tab="details"
            role="tab"
            aria-selected="true"
          >Details</button>
          <button
            type="button"
            class="inspector-tab"
            data-inspector-tab="world"
            role="tab"
            aria-selected="false"
          >World Settings</button>
        </div>
        <div class="inspector-pane" data-inspector-pane="details">
          <div class="details-body" data-details-body></div>
        </div>
        <div class="inspector-pane" data-inspector-pane="world" hidden>
          <div class="details-body world-settings-body" data-world-settings-body></div>
        </div>
      </aside>
      <section class="editor-content-drawer" data-content-drawer aria-hidden="true">
        <div class="content-drawer-top">
          <div class="content-drawer-title">
            <strong>Content Drawer</strong>
            <span data-content-root>assets</span>
          </div>
          <input
            class="content-search"
            type="search"
            data-content-search
            placeholder="Search assets"
          />
          <div class="content-filters" data-content-filters>
            <select class="content-filter" data-content-type-filter aria-label="Asset type">
              <option value="${CONTENT_FILTER_ALL}">All types</option>
            </select>
            <label class="content-dev-toggle" title="Show DevelopmentContent assets">
              <input type="checkbox" data-content-development-toggle />
              <span>Dev Content</span>
            </label>
          </div>
          <button
            type="button"
            class="content-size-toggle"
            data-content-size-toggle
            aria-pressed="false"
            title="Toggle drawer height"
          >Tall</button>
          <button type="button" data-content-refresh>Refresh</button>
        </div>
        <div class="content-drawer-body">
          <nav class="folder-tree" data-folder-tree aria-label="Asset folders"></nav>
          <section class="content-assets">
            <div class="content-path" data-content-path>assets</div>
            <div class="content-list" data-content-list></div>
          </section>
        </div>
        <div class="content-drawer-status" data-content-status>Loading assets</div>
      </section>
      <footer class="editor-status">
        <button type="button" class="content-drawer-toggle" data-content-toggle aria-expanded="false">
          Content Drawer
        </button>
        <span data-status data-testid="editor-status">Ready</span>
      </footer>
    `;

    const overlay = document.getElementById("ui-overlay");
    if (!overlay) throw new Error("Missing #ui-overlay");
    overlay.append(this.root);

    this.contentList = requireElement(this.root, "[data-content-list]");
    this.contentDrawer = requireElement(this.root, "[data-content-drawer]");
    this.contentToggle = requireElement(this.root, "[data-content-toggle]");
    this.contentRootLabel = requireElement(this.root, "[data-content-root]");
    this.contentPathLabel = requireElement(this.root, "[data-content-path]");
    this.contentStatus = requireElement(this.root, "[data-content-status]");
    this.contentSearch = requireElement(this.root, "[data-content-search]");
    this.contentTypeFilter = requireElement(this.root, "[data-content-type-filter]");
    this.contentDevelopmentToggle = requireElement(this.root, "[data-content-development-toggle]");
    this.contentSizeToggle = requireElement(this.root, "[data-content-size-toggle]");
    this.folderTree = requireElement(this.root, "[data-folder-tree]");
    this.outlinerList = requireElement(this.root, "[data-outliner-list]");
    this.detailsBody = requireElement(this.root, "[data-details-body]");
    this.worldSettingsBody = requireElement(this.root, "[data-world-settings-body]");
    this.statusText = requireElement(this.root, "[data-status]");
    this.undoButton = requireElement(this.root, '[data-action="undo"]');
    this.redoButton = requireElement(this.root, '[data-action="redo"]');
    const projectName = requireElement(this.root, "[data-project-name]");

    this.buildToolbar();
    this.bindActions();
    this.renderDetails(null);
    this.renderWorldSettings(this.app.getWorldSettings());

    this.app.onSelectionChanged = (selection) => {
      this.selected = selection;
      this.detailsBaseline = null;
      this.renderDetails(selection);
    };
    this.app.onSceneObjectsChanged = (objects) => this.renderOutliner(objects);
    this.app.onHistoryChanged = (state) => this.renderHistory(state);
    this.app.onWorldSettingsChanged = (settings) => this.renderWorldSettings(settings);
    this.app.onPivotEditModeChanged = () => this.renderDetails(this.selected);
    this.app.onStatus = (message, tone) => this.setStatus(message, tone);

    this.renderOutliner(this.app.getSceneObjects());
    this.renderHistory(this.app.getHistoryState());
    void this.loadContent(projectName);
  }

  private buildToolbar(): void {
    const tools = requireElement(this.root, "[data-tools]");
    (["select", "move", "rotate", "scale"] as EditorTool[]).forEach((tool) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = TOOL_LABELS[tool];
      button.dataset.tool = tool;
      if (tool === "move") button.classList.add("active");
      button.addEventListener("click", () => {
        this.setActiveTool(tool);
      });
      tools.append(button);
      this.toolButtons.set(tool, button);
    });

    const spaceButton = document.createElement("button");
    spaceButton.type = "button";
    spaceButton.className = "space-toggle";
    spaceButton.dataset.spaceToggle = "";
    spaceButton.title = "Toggle transform space (X)";
    spaceButton.addEventListener("click", () => {
      this.updateSpaceButton(this.app.toggleTransformSpace());
    });
    tools.append(spaceButton);
  }

  private setActiveTool(tool: EditorTool): void {
    this.activeTool = tool;
    for (const [itemTool, item] of this.toolButtons) {
      item.classList.toggle("active", itemTool === tool);
    }
    this.app.setEditorTool(tool);
  }

  private updateSpaceButton(space: TransformSpace): void {
    const button = this.root.querySelector<HTMLButtonElement>("[data-space-toggle]");
    if (!button) return;
    button.textContent = space === "local" ? "Local" : "World";
    button.classList.toggle("active", space === "local");
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
    this.root.querySelector('[data-action="play"]')?.addEventListener("click", () => {
      void this.playTest();
    });
    const collisionToggle = this.root.querySelector<HTMLInputElement>(
      '[data-show-flag="collision"]',
    );
    if (collisionToggle) {
      collisionToggle.checked = this.app.getShowCollision();
      collisionToggle.addEventListener("change", () => {
        this.app.setShowCollision(collisionToggle.checked);
      });
    }
    const aiNavigationToggle = this.root.querySelector<HTMLInputElement>(
      '[data-show-flag="ai-navigation"]',
    );
    if (aiNavigationToggle) {
      aiNavigationToggle.checked = this.app.getShowAiNavigation();
      aiNavigationToggle.addEventListener("change", () => {
        this.app.setShowAiNavigation(aiNavigationToggle.checked);
      });
    }
    this.root.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      void this.save();
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-add-actor]").forEach((button) => {
      const type = button.dataset.addActor;
      if (type === "directional" || type === "point" || type === "spot") {
        button.draggable = true;
        button.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("application/x-forge-light-actor", type);
          event.dataTransfer!.effectAllowed = "copy";
          event.dataTransfer?.setDragImage(this.getEmptyDragImage(), 0, 0);
          this.app.beginLightDragPreview(type);
          this.setStatus(`Dragging ${formatLightTypeLabel(type)} - drop in the viewport to place.`);
        });
        button.addEventListener("dragend", () => {
          this.app.endAssetDragPreview();
        });
      }
      button.addEventListener("click", () => {
        this.setStatus("Drag the actor into the viewport to place it.", "info");
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>("[data-add-shape]").forEach((button) => {
      const type = button.dataset.addShape;
      if (isShapePrimitiveType(type)) {
        const assetId = shapeAssetId(type);
        button.draggable = true;
        button.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("application/x-3dgamedev-asset", assetId);
          event.dataTransfer!.effectAllowed = "copy";
          event.dataTransfer?.setDragImage(this.getEmptyDragImage(), 0, 0);
          this.app.beginAssetDragPreview(assetId);
          this.setStatus(`Dragging ${formatShapeTypeLabel(type)} - drop in the viewport to place.`);
        });
        button.addEventListener("dragend", () => {
          this.app.endAssetDragPreview();
        });
      }
      button.addEventListener("click", () => {
        this.setStatus("Drag the actor into the viewport to place it.", "info");
      });
    });

    const playerStartButton = this.root.querySelector<HTMLButtonElement>("[data-add-player-start]");
    if (playerStartButton) {
      playerStartButton.draggable = true;
      playerStartButton.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("application/x-3dgamedev-asset", PLAYER_START_ASSET_ID);
        event.dataTransfer!.effectAllowed = "copy";
        event.dataTransfer?.setDragImage(this.getEmptyDragImage(), 0, 0);
        this.app.beginAssetDragPreview(PLAYER_START_ASSET_ID);
        this.setStatus("Dragging Player Start - drop in the viewport to place.");
      });
      playerStartButton.addEventListener("dragend", () => {
        this.app.endAssetDragPreview();
      });
      playerStartButton.addEventListener("click", () => {
        this.setStatus("Drag the actor into the viewport to place it.", "info");
      });
    }

    const ambientSoundButton = this.root.querySelector<HTMLButtonElement>("[data-add-ambient-sound]");
    if (ambientSoundButton) {
      ambientSoundButton.draggable = true;
      ambientSoundButton.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("application/x-3dgamedev-asset", AMBIENT_SOUND_ASSET_ID);
        event.dataTransfer!.effectAllowed = "copy";
        event.dataTransfer?.setDragImage(this.getEmptyDragImage(), 0, 0);
        this.app.beginAssetDragPreview(AMBIENT_SOUND_ASSET_ID);
        this.setStatus("Dragging Ambient Sound - drop in the viewport to place.");
      });
      ambientSoundButton.addEventListener("dragend", () => {
        this.app.endAssetDragPreview();
      });
      ambientSoundButton.addEventListener("click", () => {
        this.setStatus("Drag the actor into the viewport to place it.", "info");
      });
    }

    // Sky Atmosphere is a transform-less singleton environment actor: click to add
    // (or select the existing one) rather than drag-to-place.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-sky-atmosphere]")
      ?.addEventListener("click", () => {
        this.app.addSkyAtmosphere();
      });

    // Height Fog is a transform-less singleton environment actor: click to add
    // (or select the existing one) rather than drag-to-place.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-height-fog]")
      ?.addEventListener("click", () => {
        this.app.addHeightFog();
      });

    // Cloud Layer is a transform-less singleton environment actor: click to add
    // (or select the existing one) rather than drag-to-place.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-cloud-layer]")
      ?.addEventListener("click", () => {
        this.app.addCloudLayer();
      });

    // Reflection Plane (Planar mirror) is a placed actor with a transform.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-reflection-plane]")
      ?.addEventListener("click", () => {
        this.app.addReflectionPlane();
      });

    // Reflective Surface (textured glossy planar reflection) is a placed actor.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-reflective-surface]")
      ?.addEventListener("click", () => {
        this.app.addReflectiveSurface();
      });

    // Sphere Reflection Capture (probe) is a placed actor with a transform.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-reflection-capture]")
      ?.addEventListener("click", () => {
        this.app.addReflectionCapture();
      });

    // Blocking Volume (parametric blockout brush) is a placed actor with a transform.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-blocking-volume]")
      ?.addEventListener("click", () => {
        this.app.addBlockingVolume();
      });

    // Post Process is a transform-less singleton environment actor.
    this.root
      .querySelector<HTMLButtonElement>("[data-add-post-process]")
      ?.addEventListener("click", () => {
        this.app.addPostProcess();
      });

    // World Widget is a placed world-space UI billboard (anchor + Details fields).
    this.root
      .querySelector<HTMLButtonElement>("[data-add-world-widget]")
      ?.addEventListener("click", () => {
        this.app.addWorldWidget(this.firstUiWidgetAssetId());
      });

    this.root.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.inspectorTab;
        if (tab === "details" || tab === "world") this.setInspectorTab(tab);
      });
    });

    this.updateSpaceButton(this.app.getTransformSpace());

    this.contentToggle.addEventListener("click", () => {
      this.setContentDrawerOpen(!this.contentDrawerOpen);
    });

    this.root.querySelector("[data-content-refresh]")?.addEventListener("click", () => {
      void this.refreshAssetTree();
    });

    this.contentSizeToggle.addEventListener("click", () => {
      this.setContentDrawerTall(!this.contentDrawerTall);
    });

    // Right-click empty asset-grid space -> create content in the current folder.
    // (Right-clicking a card stops propagation and shows the asset menu instead.)
    this.contentList.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.openContentContextMenu(event, this.selectedFolder);
    });

    // Click empty asset-grid space -> clear the current asset selection.
    this.contentList.addEventListener("click", (event) => {
      if (event.target === this.contentList) this.clearContentSelection();
    });

    this.contentSearch.addEventListener("input", () => {
      this.contentQuery = this.contentSearch.value.trim().toLocaleLowerCase();
      this.renderContentAssets();
    });

    this.contentTypeFilter.addEventListener("change", () => {
      const value = this.contentTypeFilter.value;
      this.contentType = isContentTypeFilter(value) ? value : CONTENT_FILTER_ALL;
      this.renderContentAssets();
    });

    this.contentDevelopmentToggle.addEventListener("change", () => {
      this.setDevelopmentContentVisible(this.contentDevelopmentToggle.checked);
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

    this.root.querySelectorAll<HTMLInputElement>("[data-snap-toggle]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.dataset.snapToggle === "move") {
          this.app.setSnapSettings({ moveEnabled: input.checked });
        }
        if (input.dataset.snapToggle === "rotate") {
          this.app.setSnapSettings({ rotateEnabled: input.checked });
        }
        if (input.dataset.snapToggle === "scale") {
          this.app.setSnapSettings({ scaleEnabled: input.checked });
        }
      });
    });

    this.root.querySelector<HTMLInputElement>("[data-outliner-search]")?.addEventListener(
      "input",
      (event) => {
        const input = event.currentTarget as HTMLInputElement;
        this.outlinerFilter = input.value.trim().toLocaleLowerCase();
        this.renderOutliner(this.outlinerObjects);
      },
    );

    window.addEventListener("keydown", (event) => this.handleKeyDown(event));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.app.isCameraNavigating()) return;
    if (event.metaKey || event.altKey || isEditableTarget(event.target)) return;

    if (event.ctrlKey) {
      if (event.code === "KeyZ" && !event.shiftKey) {
        event.preventDefault();
        this.app.undo();
      } else if (event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey)) {
        event.preventDefault();
        this.app.redo();
      } else if (event.code === "KeyS") {
        event.preventDefault();
        void this.save();
      } else if (event.code === "KeyD") {
        event.preventDefault();
        this.app.duplicateSelected();
      } else if (event.code === "KeyG") {
        event.preventDefault();
        this.app.groupSelected();
      } else if (event.code === "KeyA") {
        event.preventDefault();
        this.app.selectAllObjects();
      }
      return;
    }

    if (event.code === "Escape") {
      event.preventDefault();
      this.app.clearSelection();
    } else if (event.code === "KeyQ") {
      event.preventDefault();
      this.setActiveTool("select");
    } else if (event.code === "KeyW") {
      event.preventDefault();
      this.setActiveTool("move");
    } else if (event.code === "KeyE") {
      event.preventDefault();
      this.setActiveTool("rotate");
    } else if (event.code === "KeyR") {
      event.preventDefault();
      this.setActiveTool("scale");
    } else if (event.code === "Space") {
      event.preventDefault();
      this.setActiveTool(nextTransformTool(this.activeTool));
    } else if (event.code === "Delete") {
      event.preventDefault();
      this.app.deleteSelected();
    } else if (event.code === "KeyF") {
      event.preventDefault();
      this.app.focusSelected();
    } else if (event.code === "Digit1") {
      event.preventDefault();
      this.app.setTechnicalView("top");
    } else if (event.code === "Digit2") {
      event.preventDefault();
      this.app.setTechnicalView("front");
    } else if (event.code === "Digit3") {
      event.preventDefault();
      this.app.setTechnicalView("side");
    } else if (event.code === "KeyH" && event.shiftKey) {
      event.preventDefault();
      this.app.showHiddenObjects();
    } else if (event.code === "KeyH") {
      event.preventDefault();
      this.app.hideSelected();
    } else if (event.code === "KeyX") {
      event.preventDefault();
      this.updateSpaceButton(this.app.toggleTransformSpace());
    } else if (event.code === "KeyP") {
      event.preventDefault();
      void this.playTest();
    } else if (event.code === "End") {
      event.preventDefault();
      this.app.snapSelected();
    }
  }

  /**
   * Play/Test: saves the layout, then opens the game in a new tab. Single
   * codebase â€” the game is this same app's default route (`/`), so Play just
   * opens it; a project may still override with an external `editor.previewUrl`.
   */
  private async playTest(): Promise<void> {
    try {
      await this.app.saveLayout();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
      return;
    }
    // Hand the current viewport camera pose to the runtime (default camera mode
    // starts there). Temporary session override â€” not written to the layout.
    writePlayCameraPose(this.app.getPlayCameraPose());
    const previewUrl = this.projectInfo?.manifest.editor.previewUrl ?? "/";
    const opened = window.open(previewUrl, "_blank", "noopener");
    if (opened) {
      this.setStatus(`Saved. Opening game: ${previewUrl}`, "success");
    } else {
      this.setStatus(`Saved. Popup blocked â€” open ${previewUrl} manually.`, "warning");
    }
  }

  private async loadContent(projectName: HTMLElement): Promise<void> {
    try {
      const [projectInfo, assets] = await Promise.all([
        this.app.getEditorProjectInfo(),
        this.app.getEditableAssets(),
      ]);
      this.syncSnapControls(this.app.getSnapSettings());
      this.projectInfo = projectInfo;
      this.metadataSchema = this.app.getMetadataSchema();
      this.editableAssets = assets;
      this.selectedFolder = normalizeProjectPath(projectInfo.assetRoot);
      projectName.textContent = projectInfo.rootName;
      this.contentRootLabel.textContent = this.selectedFolder;
      await this.refreshAssetTree({ quiet: true });
    } catch (error) {
      this.contentStatus.textContent = error instanceof Error ? error.message : String(error);
      this.setStatus(this.contentStatus.textContent, "error");
    }
  }

  /** Toggles the drawer's open DOM state + the periodic refresh interval (no immediate fetch). */
  private applyContentDrawerState(open: boolean): void {
    this.contentDrawerOpen = open;
    this.contentDrawer.classList.toggle("open", open);
    this.contentDrawer.setAttribute("aria-hidden", String(!open));
    this.contentToggle.classList.toggle("active", open);
    this.contentToggle.setAttribute("aria-expanded", String(open));

    window.clearInterval(this.contentRefreshTimer);
    this.contentRefreshTimer = 0;
    if (open) {
      this.contentRefreshTimer = window.setInterval(() => {
        void this.refreshAssetTree({ quiet: true });
      }, 7000);
    }
  }

  private setContentDrawerOpen(open: boolean): void {
    this.applyContentDrawerState(open);
    if (open) void this.refreshAssetTree({ quiet: true });
  }

  private setContentDrawerTall(tall: boolean): void {
    this.contentDrawerTall = tall;
    this.contentDrawer.classList.toggle("is-tall", tall);
    this.contentSizeToggle.classList.toggle("active", tall);
    this.contentSizeToggle.setAttribute("aria-pressed", String(tall));
    this.contentSizeToggle.textContent = tall ? "Short" : "Tall";
  }

  private setDevelopmentContentVisible(visible: boolean): void {
    this.showDevelopmentContent = visible;
    this.contentDevelopmentToggle.checked = visible;
    this.ensureVisibleSelectedFolder();
    this.renderFolderTree();
    this.renderContentFilters();
    this.renderContentAssets();
  }

  /**
   * Reveals an asset in the Content Browser (Toolbar â†’ Browse from an open
   * editor): opens the drawer, navigates to the asset's folder (expanding
   * ancestors and clearing any type/search filter that would hide it), then
   * selects + briefly flashes the card. Best-effort â€” a missing folder falls
   * back to the asset root. Uses a single authoritative refresh so the flash is
   * never clobbered by a concurrent reload.
   */
  async revealContentAsset(path: string): Promise<void> {
    this.applyContentDrawerState(true);
    await this.refreshAssetTree({ quiet: true });
    if (!this.assetTreeRoot) {
      this.setStatus(`In Content Browser: ${path}`);
      return;
    }
    const normalized = normalizeProjectPath(path);
    if (isDevelopmentContentPath(normalized)) {
      this.showDevelopmentContent = true;
      this.contentDevelopmentToggle.checked = true;
    }
    const root = this.assetTreeRoot.path;
    const parentDir = normalized.includes("/")
      ? normalized.slice(0, normalized.lastIndexOf("/"))
      : root;
    // Pick the folder that holds the asset; fall back to the asset root.
    const folder =
      parentDir === root || findProjectDir(this.assetTreeRoot.children ?? [], parentDir)
        ? parentDir
        : root;
    this.selectedFolder = folder;
    // Expand every ancestor so the folder is visible in the tree.
    const segments = folder.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      this.collapsedFolderPaths.delete(segments.slice(0, i).join("/"));
    }
    // Clear any filter/search that would hide the target card.
    this.contentType = CONTENT_FILTER_ALL;
    this.contentTypeFilter.value = CONTENT_FILTER_ALL;
    this.contentQuery = "";
    this.contentSearch.value = "";
    this.renderFolderTree();
    this.renderContentFilters();
    this.renderContentAssets();
    this.flashContentCard(path);
  }

  /** Selects + briefly highlights the Content Browser card for `path`, scrolling it into view. */
  private flashContentCard(path: string): void {
    const card = this.contentList.querySelector<HTMLElement>(
      `.asset-card[data-asset-path="${CSS.escape(path)}"]`,
    );
    if (!card) {
      this.setStatus(`In Content Browser: ${path}`);
      return;
    }
    if (card.dataset.assetId) this.setSelectedAsset(card.dataset.assetId);
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    card.classList.add("is-revealed");
    window.setTimeout(() => card.classList.remove("is-revealed"), 1600);
    this.setStatus(`Revealed in Content Browser: ${path}`, "info");
  }

  private async refreshAssetTree(options: { quiet?: boolean } = {}): Promise<void> {
    if (!this.projectInfo) return;
    try {
      const assetRoot = normalizeProjectPath(this.projectInfo.assetRoot);
      if (!options.quiet) this.contentStatus.textContent = "Refreshing assets";
      const tree = await fetchProjectDir(assetRoot);
      const rootName = tree.root.split("/").at(-1) ?? "assets";
      this.assetTreeRoot = {
        name: rootName,
        path: tree.root,
        type: "dir",
        children: tree.children,
      };
      if (!this.selectedFolder) this.selectedFolder = tree.root;
      if (this.selectedFolder !== tree.root && !findProjectDir(tree.children, this.selectedFolder)) {
        this.selectedFolder = tree.root;
      }
      this.ensureVisibleSelectedFolder();
      this.contentRootLabel.textContent = `${this.projectInfo.rootName} / ${tree.root}`;
      this.contentStatus.textContent = `${this.visibleProjectFiles().length} files`;
      this.renderFolderTree();
      this.renderContentFilters();
      this.renderContentAssets();
      void this.refreshProjectActorClasses();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.contentStatus.textContent = message;
      if (!options.quiet) this.setStatus(message, "error");
    }
  }

  /**
   * Scans the project's `*.actor.json` files and caches each class's name +
   * parent class, then derives the editor pickers that depend on it: the World
   * Settings Game Mode dropdown ({@link projectGameModes}) and (on demand) the
   * Game Mode "Default Pawn Class" picker. Re-renders the World Settings tab when
   * the discovered Game Mode set changed.
   */
  private async refreshProjectActorClasses(): Promise<void> {
    if (!this.assetTreeRoot) return;
    const actorPaths = flattenProjectFiles([this.assetTreeRoot])
      .filter((file) => file.path.endsWith(".actor.json"))
      .map((file) => normalizeProjectPath(file.path));
    this.projectActorClasses = await Promise.all(
      actorPaths.map(async (path) => {
        const def = await loadActorScript(path, path);
        return { path, name: def.name || path, parentClass: def.parentClass };
      }),
    );

    const next: EditorGameModeOption[] = this.projectActorClasses
      .filter((cls) => cls.parentClass === "gameMode")
      .map((cls) => ({
        id: cls.path,
        displayName: cls.name,
        description: "Project Game Mode (Actor Script).",
      }));
    const changed =
      next.length !== this.projectGameModes.length ||
      next.some((option, index) => {
        const prev = this.projectGameModes[index];
        return !prev || prev.id !== option.id || prev.displayName !== option.displayName;
      });
    if (!changed) return;
    this.projectGameModes = next;
    this.renderWorldSettings(this.worldSettings ?? this.app.getWorldSettings());
  }

  private renderFolderTree(): void {
    if (!this.assetTreeRoot) {
      this.folderTree.innerHTML = `<div class="empty-details">No asset folders</div>`;
      return;
    }
    this.ensureVisibleSelectedFolder();
    this.folderTree.replaceChildren(this.createFolderRow(this.assetTreeRoot, 0));
  }

  private createFolderRow(node: ProjectDirNode, depth: number): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "folder-node";
    const childDirs =
      node.children?.filter((child) => child.type === "dir" && this.shouldShowContentPath(child.path)) ??
      [];
    const hasChildDirs = childDirs.length > 0;
    const isCollapsed = hasChildDirs && this.collapsedFolderPaths.has(node.path);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "folder-row";
    button.classList.toggle("has-children", hasChildDirs);
    button.style.setProperty("--depth", String(depth));
    button.classList.toggle("active", node.path === this.selectedFolder);
    button.title = node.path;
    if (hasChildDirs) button.setAttribute("aria-expanded", String(!isCollapsed));
    button.innerHTML = `
      <span class="folder-caret">${hasChildDirs ? (isCollapsed ? ">" : "v") : ""}</span>
      <span class="folder-name">${escapeHtml(node.name)}</span>
    `;
    button.addEventListener("click", () => {
      this.selectedFolder = node.path;
      if (hasChildDirs) {
        if (isCollapsed) {
          this.collapsedFolderPaths.delete(node.path);
        } else {
          this.collapsedFolderPaths.add(node.path);
        }
      }
      this.renderFolderTree();
      this.renderContentAssets();
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (node === this.assetTreeRoot) {
        this.openContentContextMenu(event, node.path);
      } else {
        this.openContentFolderContextMenu(event, this.toBrowserFolderItem(node));
      }
    });
    wrapper.append(button);

    if (!isCollapsed) {
      for (const child of childDirs) {
        wrapper.append(this.createFolderRow(child, depth + 1));
      }
    }
    return wrapper;
  }

  private renderContentAssets(): void {
    if (!this.assetTreeRoot || !this.projectInfo) {
      this.contentListStatus = renderContentAssetsPanel({
        contentList: this.contentList,
        contentPathLabel: this.contentPathLabel,
        contentStatus: this.contentStatus,
        projectLoaded: false,
        rootPath: null,
        selectedFolder: this.selectedFolder,
        folders: [],
        assets: [],
        fileCount: 0,
        missingManifestAssetCount: 0,
        selectedAssetId: this.selectedAssetId,
        selectedContentFolderPath: this.selectedContentFolderPath,
        isActiveLevel: (item) => this.isActiveLevel(item),
        getEmptyDragImage: () => this.getEmptyDragImage(),
        setSelectedAsset: (assetId) => this.setSelectedAsset(assetId),
        setSelectedContentFolder: (path) => this.setSelectedContentFolder(path),
        navigateToContentFolder: (path) => this.navigateToContentFolder(path),
        openAssetContextMenu: (event, item) => this.openAssetContextMenu(event, item),
        openContentFolderContextMenu: (event, item) =>
          this.openContentFolderContextMenu(event, item),
        openMeshEditor: (item) => this.openMeshEditor(item),
        openActorScriptEditor: (item) => this.openActorScriptEditor(item),
        openMaterialEditor: (item) => this.openMaterialEditor(item),
        openSoundCueEditor: (item) => this.openSoundCueEditor(item),
        openParticleEffectEditor: (item) => this.openParticleEffectEditor(item),
        openDialogueEditor: (item) => this.openDialogueEditor(item),
        openLevel: (item) => this.openLevel(item),
        openUiWidgetEditor: (item) => this.openUiWidgetEditor(item),
        renderAssetThumbnail: (item, thumb) => this.renderAssetThumbnail(item, thumb),
        renderMaterialThumbnail: (item, thumb) => this.renderMaterialThumbnail(item, thumb),
        renderTextureThumbnail: (item, thumb) => this.renderTextureThumbnail(item, thumb),
        beginAssetDragPreview: (assetId) => this.app.beginAssetDragPreview(assetId),
        endAssetDragPreview: () => this.app.endAssetDragPreview(),
        setStatus: (message, tone) => this.setStatus(message, tone),
      });
      return;
    }

    const selected =
      this.selectedFolder === this.assetTreeRoot.path
        ? this.assetTreeRoot
        : findProjectDir(this.assetTreeRoot.children ?? [], this.selectedFolder);
    const children = selected?.children ?? [];
    const folders = children
      .filter((child) => child.type === "dir" && this.shouldShowContentPath(child.path))
      .map((folder) => this.toBrowserFolderItem(folder))
      .filter((item) => contentItemMatchesQuery(item, this.contentQuery));
    const files = children.filter((child) => child.type === "file");
    const assets = files
      .filter((file) => this.shouldDisplayAssetFile(file))
      .map((file) => this.toBrowserAssetItem(file))
      .filter((item) => this.contentType === CONTENT_FILTER_ALL || item.type === this.contentType)
      .filter((item) => contentItemMatchesQuery(item, this.contentQuery));
    this.contentListStatus = renderContentAssetsPanel({
      contentList: this.contentList,
      contentPathLabel: this.contentPathLabel,
      contentStatus: this.contentStatus,
      projectLoaded: true,
      rootPath: this.assetTreeRoot.path,
      selectedFolder: this.selectedFolder,
      folders,
      assets,
      fileCount: files.length,
      missingManifestAssetCount: this.countMissingManifestAssetFiles(),
      selectedAssetId: this.selectedAssetId,
      selectedContentFolderPath: this.selectedContentFolderPath,
      isActiveLevel: (item) => this.isActiveLevel(item),
      getEmptyDragImage: () => this.getEmptyDragImage(),
      setSelectedAsset: (assetId) => this.setSelectedAsset(assetId),
      setSelectedContentFolder: (path) => this.setSelectedContentFolder(path),
      navigateToContentFolder: (path) => this.navigateToContentFolder(path),
      openAssetContextMenu: (event, item) => this.openAssetContextMenu(event, item),
      openContentFolderContextMenu: (event, item) => this.openContentFolderContextMenu(event, item),
      openMeshEditor: (item) => this.openMeshEditor(item),
      openActorScriptEditor: (item) => this.openActorScriptEditor(item),
      openMaterialEditor: (item) => this.openMaterialEditor(item),
      openSoundCueEditor: (item) => this.openSoundCueEditor(item),
      openParticleEffectEditor: (item) => this.openParticleEffectEditor(item),
      openDialogueEditor: (item) => this.openDialogueEditor(item),
      openLevel: (item) => this.openLevel(item),
      openUiWidgetEditor: (item) => this.openUiWidgetEditor(item),
      renderAssetThumbnail: (item, thumb) => this.renderAssetThumbnail(item, thumb),
      renderMaterialThumbnail: (item, thumb) => this.renderMaterialThumbnail(item, thumb),
      renderTextureThumbnail: (item, thumb) => this.renderTextureThumbnail(item, thumb),
      beginAssetDragPreview: (assetId) => this.app.beginAssetDragPreview(assetId),
      endAssetDragPreview: () => this.app.endAssetDragPreview(),
      setStatus: (message, tone) => this.setStatus(message, tone),
    });
  }

  private renderContentFilters(): void {
    const allItems = this.assetTreeRoot
      ? flattenProjectFiles([this.assetTreeRoot])
          .filter((file) => this.shouldDisplayAssetFile(file))
          .map((file) => this.toBrowserAssetItem(file))
      : [];
    this.contentType = renderContentFilterOptions(this.contentTypeFilter, allItems, this.contentType);
  }

  private shouldDisplayAssetFile(file: ProjectDirNode): boolean {
    if (file.type !== "file") return false;
    if (!this.shouldShowContentPath(file.path)) return false;
    const name = file.name.toLocaleLowerCase();
    return !(
      name === "manifest.json" ||
      name === "catalog.json" ||
      name === "metadata-schema.json" ||
      name.endsWith(".collision.json") ||
      name.endsWith(".materials.json") ||
      name.endsWith(".uvw.json")
    );
  }

  private toBrowserFolderItem(folder: ProjectDirNode): BrowserFolderItem {
    return {
      key: folder.path,
      label: folder.name,
      path: folder.path,
      type: "folder",
      fileCount: folder.children?.filter((child) => child.type === "file").length ?? 0,
      descendantFileCount: flattenProjectFiles([folder]).length,
    };
  }

  private toBrowserAssetItem(file: ProjectDirNode): BrowserAssetItem {
    const editable = this.editableAssetByProjectPath().get(file.path);
    const base = {
      key: file.path,
      label: editable?.displayName ?? file.name,
      category: editable?.catalogCategory ?? file.ext ?? "file",
      path: file.path,
      ext: file.ext ?? "file",
      type: editable ? assetType(editable) : (inferAssetTypeFromPath(file.path) ?? "file"),
    } satisfies Omit<BrowserAssetItem, "editable">;
    return editable ? { ...base, editable } : base;
  }

  private editableAssetByProjectPath(): Map<string, EditableAsset> {
    // The Content Browser directory tree (`/__project-dir`) is public-scoped, so
    // its file paths are "assets/...". Manifest `asset.path` is also public-root
    // relative. Index both the bare "assets/..." key and the legacy
    // "public/assets/..." form so a manifest-registered file is matched instead
    // of being treated as "not registered" (which blocks drag-to-place).
    const publicDir = this.projectInfo?.manifest.publicDir ?? "public";
    const byPath = new Map<string, EditableAsset>();
    for (const asset of this.editableAssets) {
      const path = normalizeProjectPath(assetPath(asset));
      byPath.set(path, asset);
      const publicPrefixedPath = normalizeProjectPath(`${publicDir}/${path}`);
      if (publicPrefixedPath !== path) byPath.set(publicPrefixedPath, asset);
    }
    return byPath;
  }

  private shouldShowContentPath(path: string): boolean {
    return this.showDevelopmentContent || !isDevelopmentContentPath(path);
  }

  private ensureVisibleSelectedFolder(): void {
    if (!this.assetTreeRoot) return;
    if (!this.shouldShowContentPath(this.selectedFolder)) {
      this.selectedFolder = this.assetTreeRoot.path;
    }
  }

  private visibleProjectFiles(): ProjectDirNode[] {
    return this.assetTreeRoot
      ? flattenProjectFiles([this.assetTreeRoot]).filter((file) => this.shouldDisplayAssetFile(file))
      : [];
  }

  private countMissingManifestAssetFiles(): number {
    if (!this.assetTreeRoot || !this.projectInfo) return 0;
    const publicDir = this.projectInfo.manifest.publicDir ?? "public";
    const filePaths = new Set(this.visibleProjectFiles().map((file) => normalizeProjectPath(file.path)));
    return this.editableAssets.filter((asset) => {
      const path = normalizeProjectPath(assetPath(asset));
      if (!this.shouldShowContentPath(path)) return false;
      if (filePaths.has(path)) return false;
      return !filePaths.has(normalizeProjectPath(`${publicDir}/${path}`));
    }).length;
  }

  /** A preloaded 1x1 transparent image used as the drag image so the browser
   *  doesn't render its default card snapshot during a drag. */
  private getEmptyDragImage(): HTMLImageElement {
    if (!this.emptyDragImage) {
      const image = new Image();
      image.src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      this.emptyDragImage = image;
    }
    return this.emptyDragImage;
  }

  /** Highlight a single Content Browser asset card without re-rendering the
   *  whole grid (re-renders re-apply the class from `selectedAssetId`). */
  private setSelectedAsset(assetId: string | null): void {
    this.selectedAssetId = assetId;
    if (assetId !== null) this.selectedContentFolderPath = null;
    for (const card of this.contentList.querySelectorAll<HTMLElement>(".asset-card")) {
      card.classList.toggle("is-selected", card.dataset.assetId === assetId);
    }
  }

  private setSelectedContentFolder(path: string | null): void {
    this.selectedContentFolderPath = path;
    if (path !== null) this.selectedAssetId = null;
    for (const card of this.contentList.querySelectorAll<HTMLElement>(".asset-card")) {
      card.classList.toggle("is-selected", card.dataset.folderPath === path);
    }
  }

  private navigateToContentFolder(path: string): void {
    this.selectedFolder = path;
    const segments = path.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      this.collapsedFolderPaths.delete(segments.slice(0, i).join("/"));
    }
    this.clearContentSelection();
    this.renderFolderTree();
    this.renderContentAssets();
  }

  /** Drops the Content Browser asset selection and restores the grid summary. */
  private clearContentSelection(): void {
    if (this.selectedAssetId === null && this.selectedContentFolderPath === null) return;
    this.setSelectedAsset(null);
    this.setSelectedContentFolder(null);
    this.contentStatus.textContent = this.contentListStatus;
  }

  /** Right-click menu for a single Content Browser asset card. */
  private openAssetContextMenu(event: MouseEvent, item: BrowserAssetItem): void {
    const items: ContextMenuItem[] = [];
    const activeLevel = this.isActiveLevel(item);
    if (isLevelItem(item)) {
      // A level's primary action is choosing it as the project's default scene.
      // The active level shows a disabled marker instead (it is already default).
      if (activeLevel) {
        items.push({ label: "✓ Default Level", enabled: false, run: () => {} });
      } else {
        items.push({ label: "Set Default Level", run: () => void this.openLevel(item) });
      }
      items.push({ separator: true });
    } else {
      const opener = this.assetEditorOpener(item);
      if (opener) {
        items.push({ label: "Open", run: opener });
        items.push({ separator: true });
      }
    }
    // The active level is locked: renaming or deleting it would leave
    // `defaultScene` pointing at a missing file, so both are disabled.
    items.push({
      label: "Rename...",
      enabled: !activeLevel,
      run: () => void this.renameContentAsset(item),
    });
    items.push({ label: "Copy Path", run: () => void this.copyContentAssetPath(item) });
    items.push({ separator: true });
    items.push({
      label: "Delete",
      danger: true,
      enabled: !activeLevel,
      run: () => void this.deleteContentAsset(item),
    });
    this.openContextMenu(event, items);
  }

  /** Right-click menu for a Content Browser folder card/tree row. */
  private openContentFolderContextMenu(event: MouseEvent, item: BrowserFolderItem): void {
    const items: ContextMenuItem[] = [
      { label: "Open", run: () => this.navigateToContentFolder(item.path) },
      { separator: true },
      { label: "New Folder", run: () => void this.createContent("folder", item.path) },
      { label: "Import...", run: () => this.startImport(item.path) },
      { separator: true },
      { label: "Rename...", run: () => void this.renameContentFolder(item) },
      { label: "Copy Path", run: () => void this.copyContentFolderPath(item) },
      { separator: true },
      {
        label: "Delete",
        danger: true,
        run: () => void this.deleteContentFolder(item),
      },
    ];
    this.openContextMenu(event, items);
  }

  /** Returns an action opening the editor that matches `item`, or null. */
  private assetEditorOpener(item: BrowserAssetItem): (() => void) | null {
    if (isLevelItem(item)) return () => void this.openLevel(item);
    if (item.type === "material") return () => void this.openMaterialEditor(item);
    if (isUiWidgetItem(item)) return () => void this.openUiWidgetEditor(item);
    if (isActorScriptItem(item)) return () => void this.openActorScriptEditor(item);
    if (item.type === "soundCue") return () => void this.openSoundCueEditor(item);
    if (item.type === "effect") return () => void this.openParticleEffectEditor(item);
    if (item.type === "dialogueVoice" || item.type === "dialogueLine") {
      return () => void this.openDialogueEditor(item);
    }
    if (item.type !== "file" && isModelAssetType(item.type)) {
      return () => void this.openMeshEditor(item);
    }
    return null;
  }

  /**
   * Opens a level for editing: makes it the project's active scene
   * (`editor.defaultScene`) via the dev endpoint, then reloads so boot rebuilds
   * the whole scene from the new default. A full reload is intentional — the
   * scene build path (physics, behaviors, reflections, widgets, runtime) is the
   * boot path, so reusing it avoids a fragile in-place teardown. Switching the
   * active scene also changes where Save writes, so this is gated on a confirm
   * when the current level has undoable (possibly unsaved) edits.
   */
  private async openLevel(item: BrowserAssetItem): Promise<void> {
    if (this.isActiveLevel(item)) {
      this.setStatus(`${item.label} is already the active level.`, "info");
      return;
    }
    if (
      this.app.getHistoryState().canUndo &&
      !window.confirm(
        `Open "${item.label}"?\nUnsaved changes to the current level will be lost.`,
      )
    ) {
      return;
    }
    try {
      await openProjectLevel(item.path);
      this.setStatus(`Opening ${item.label}…`, "success");
      window.location.reload();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /**
   * True when `item` is the level the project currently loads + saves
   * (`editor.defaultScene`). The active level is locked in the Content Browser:
   * it can't be deleted or renamed (either would break the next scene load), and
   * it is the one "Set Default Level" hides since it is already the default.
   */
  private isActiveLevel(item: BrowserAssetItem): boolean {
    if (!isLevelItem(item)) return false;
    const current = this.projectInfo?.manifest.editor.defaultScene;
    return Boolean(current && normalizeProjectPath(current) === normalizeProjectPath(item.path));
  }

  /** Prompts for a new base name and renames the asset file via the dev endpoint. */
  private async renameContentAsset(item: BrowserAssetItem): Promise<void> {
    if (this.isActiveLevel(item)) {
      this.setStatus(
        `"${item.label}" is the active level and is locked. Set another level as default before renaming it.`,
        "warning",
      );
      return;
    }
    const fileName = item.path.split("/").at(-1) ?? item.path;
    const dot = fileName.indexOf(".");
    const currentBase = dot > 0 ? fileName.slice(0, dot) : fileName;
    const next = window.prompt("Rename asset", currentBase);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentBase) return;
    try {
      const result = await renameProjectContent(item.path, trimmed);
      this.setStatus(`Renamed to ${result.path}`, "success");
      if (result.registered) {
        try {
          this.editableAssets = await this.app.reloadEditableAssets();
        } catch {
          // Keep the stale list; the tree refresh below still shows the new name.
        }
      }
      await this.refreshAssetTree({ quiet: false });
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /** Confirms, then deletes the asset file (and sidecars/manifest entry). */
  private async deleteContentAsset(item: BrowserAssetItem): Promise<void> {
    if (this.isActiveLevel(item)) {
      this.setStatus(
        `"${item.label}" is the active level and is locked. Set another level as default before deleting it.`,
        "warning",
      );
      return;
    }
    if (!window.confirm(`Delete "${item.label}"? This cannot be undone.`)) return;
    try {
      const result = await deleteProjectContent(item.path);
      if (item.editable && this.selectedAssetId === item.editable.id) {
        this.setSelectedAsset(null);
      }
      this.setStatus(`Deleted ${result.path}`, "success");
      if (result.registered) {
        try {
          this.editableAssets = await this.app.reloadEditableAssets();
        } catch {
          // Keep the stale list; the tree refresh below drops the deleted card.
        }
      }
      await this.refreshAssetTree({ quiet: false });
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /** Prompts for a new folder name and updates descendant path references server-side. */
  private async renameContentFolder(item: BrowserFolderItem): Promise<void> {
    const currentBase = item.path.split("/").at(-1) ?? item.label;
    const next = window.prompt("Rename folder", currentBase);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentBase) return;
    try {
      const result = await renameProjectContent(item.path, trimmed);
      this.selectedFolder = replaceContentPathPrefix(this.selectedFolder, item.path, result.path);
      if (this.selectedContentFolderPath) {
        this.selectedContentFolderPath = replaceContentPathPrefix(
          this.selectedContentFolderPath,
          item.path,
          result.path,
        );
      }
      this.collapsedFolderPaths = new Set(
        [...this.collapsedFolderPaths].map((path) =>
          replaceContentPathPrefix(path, item.path, result.path),
        ),
      );
      this.setStatus(`Renamed folder to ${result.path}`, "success");
      if (result.registered) {
        try {
          this.editableAssets = await this.app.reloadEditableAssets();
        } catch {
          // Keep the stale list; the tree refresh below still shows the new paths.
        }
      }
      await this.refreshAssetTree({ quiet: false });
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /** Confirms, then deletes a folder and asks the server to scrub stale references. */
  private async deleteContentFolder(item: BrowserFolderItem): Promise<void> {
    const hasFiles = item.descendantFileCount > 0;
    const message = hasFiles
      ? `Delete folder "${item.label}" and ${item.descendantFileCount} file(s)?\n\nForge will remove descendant manifest entries and clean level references to deleted assets/classes so the project can keep loading. This cannot be undone.`
      : `Delete empty folder "${item.label}"? This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      const parent = parentContentPath(item.path) ?? this.assetTreeRoot?.path ?? "";
      const result = await deleteProjectContent(item.path);
      if (isSameOrDescendantContentPath(this.selectedFolder, item.path)) {
        this.selectedFolder = parent;
      }
      if (
        this.selectedContentFolderPath &&
        isSameOrDescendantContentPath(this.selectedContentFolderPath, item.path)
      ) {
        this.selectedContentFolderPath = null;
      }
      this.collapsedFolderPaths = new Set(
        [...this.collapsedFolderPaths].filter((path) => !isSameOrDescendantContentPath(path, item.path)),
      );
      this.setStatus(
        `Deleted ${result.path} (${result.deletedFiles} file(s), ${result.removedAssets} asset(s), ${result.cleanedLayouts} level file(s) cleaned)`,
        "success",
      );
      if (result.registered || result.removedAssets > 0) {
        try {
          this.editableAssets = await this.app.reloadEditableAssets();
        } catch {
          // Keep the stale list; the tree refresh below drops deleted files.
        }
      }
      await this.refreshAssetTree({ quiet: false });
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /** Copies the folder's public-relative path to the clipboard. */
  private async copyContentFolderPath(item: BrowserFolderItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.path);
      this.setStatus(`Copied ${item.path}`, "success");
    } catch {
      this.setStatus(`Path: ${item.path}`, "info");
    }
  }

  /** Copies the asset's public-relative path to the clipboard. */
  private async copyContentAssetPath(item: BrowserAssetItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.path);
      this.setStatus(`Copied ${item.path}`, "success");
    } catch {
      this.setStatus(`Path: ${item.path}`, "info");
    }
  }

  private renderTextureThumbnail(item: BrowserAssetItem, thumb: HTMLElement): void {
    thumb.replaceChildren();
    const image = document.createElement("img");
    image.alt = "";
    image.src = projectFileUrl(item.path);
    thumb.append(image);
  }

  private async renderMaterialThumbnail(item: BrowserAssetItem, thumb: HTMLElement): Promise<void> {
    try {
      const material = await this.resolveMaterialPreview(item);
      if (!material) throw new Error("Material preview unavailable");
      const imageUrl = await this.thumbnailRenderer.renderMaterial(item.editable?.id ?? item.path, material);
      if (!thumb.isConnected) return;
      thumb.replaceChildren();
      const image = document.createElement("img");
      image.alt = "";
      image.src = imageUrl;
      thumb.append(image);
    } catch {
      if (thumb.isConnected) thumb.textContent = item.ext.toUpperCase();
    }
  }

  private resolveMaterialPreview(item: BrowserAssetItem): Promise<ThumbnailMaterialPreview | undefined> {
    const key = item.editable?.id ?? item.path;
    let cached = this.materialPreviewCache.get(key);
    if (!cached) {
      cached = this.resolveMaterialPreviewUncached(item);
      this.materialPreviewCache.set(key, cached);
    }
    return cached;
  }

  private async resolveMaterialPreviewUncached(
    item: BrowserAssetItem,
  ): Promise<ThumbnailMaterialPreview | undefined> {
    return this.resolveMaterialPreviewById(item.editable?.id, item.path);
  }

  private resolveModelDefaultMaterialPreview(item: BrowserAssetItem): Promise<ThumbnailMaterialPreview | undefined> {
    const key = item.editable?.id ?? item.path;
    let cached = this.modelMaterialPreviewCache.get(key);
    if (!cached) {
      cached = this.resolveModelDefaultMaterialPreviewUncached(item);
      this.modelMaterialPreviewCache.set(key, cached);
    }
    return cached;
  }

  private async resolveModelDefaultMaterialPreviewUncached(
    item: BrowserAssetItem,
  ): Promise<ThumbnailMaterialPreview | undefined> {
    const slots = await loadAssetMaterialSlots(item.path);
    const materialId = slots.slots[0];
    return materialId ? this.resolveMaterialPreviewById(materialId) : undefined;
  }

  private async resolveMaterialPreviewById(
    materialId: string | undefined,
    fallbackPath?: string,
  ): Promise<ThumbnailMaterialPreview | undefined> {
    const materialRecord = materialId
      ? assetRecordById({ version: 1, generated: "", ktx2: false, assets: this.editableAssets }, materialId)
      : undefined;
    const materialPath = materialRecord ? assetPath(materialRecord) : fallbackPath;
    if (!materialPath) return undefined;
    const response = await fetch(projectFileUrl(materialPath));
    if (!response.ok) return undefined;
    const def = normalizeForgeMaterialDef(await response.json(), materialRecord?.name ?? "Material");
    const baseColorTexturePath = this.texturePathById(def.baseColorTexture);
    const normalTexturePath = this.texturePathById(def.normalTexture);
    const roughnessTexturePath = this.texturePathById(def.roughnessTexture);
    const metalnessTexturePath = this.texturePathById(def.metalnessTexture);
    const aoTexturePath = this.texturePathById(def.aoTexture);
    const opacityTexturePath = this.texturePathById(def.opacityTexture);
    const emissiveTexturePath = this.texturePathById(def.emissiveTexture);
    const ormTexturePath = this.texturePathById(def.ormTexture);
    const layer1BaseColorTexturePath = this.texturePathById(def.layerBlend?.layer1.baseColorTexture ?? null);
    const layer1NormalTexturePath = this.texturePathById(def.layerBlend?.layer1.normalTexture ?? null);
    const layer1RoughnessTexturePath = this.texturePathById(def.layerBlend?.layer1.roughnessTexture ?? null);
    const layer1MetalnessTexturePath = this.texturePathById(def.layerBlend?.layer1.metalnessTexture ?? null);
    const layer1OpacityTexturePath = this.texturePathById(def.layerBlend?.layer1.opacityTexture ?? null);
    const layer1EmissiveTexturePath = this.texturePathById(def.layerBlend?.layer1.emissiveTexture ?? null);
    const layer1AoTexturePath = this.texturePathById(def.layerBlend?.layer1.aoTexture ?? null);
    const layerBlendMaskTexturePath = this.texturePathById(def.layerBlend?.maskTexture ?? null);
    return {
      materialType: def.materialType,
      baseColor: def.baseColor,
      ...(baseColorTexturePath ? { baseColorTextureUrl: projectFileUrl(baseColorTexturePath) } : {}),
      ...(normalTexturePath ? { normalTextureUrl: projectFileUrl(normalTexturePath) } : {}),
      ...(roughnessTexturePath ? { roughnessTextureUrl: projectFileUrl(roughnessTexturePath) } : {}),
      ...(metalnessTexturePath ? { metalnessTextureUrl: projectFileUrl(metalnessTexturePath) } : {}),
      ...(aoTexturePath ? { aoTextureUrl: projectFileUrl(aoTexturePath) } : {}),
      ...(opacityTexturePath ? { opacityTextureUrl: projectFileUrl(opacityTexturePath) } : {}),
      ...(emissiveTexturePath ? { emissiveTextureUrl: projectFileUrl(emissiveTexturePath) } : {}),
      ...(ormTexturePath ? { ormTextureUrl: projectFileUrl(ormTexturePath) } : {}),
      ...(def.layerBlend ? { layerBlend: def.layerBlend } : {}),
      ...(layer1BaseColorTexturePath ? { layer1BaseColorTextureUrl: projectFileUrl(layer1BaseColorTexturePath) } : {}),
      ...(layer1NormalTexturePath ? { layer1NormalTextureUrl: projectFileUrl(layer1NormalTexturePath) } : {}),
      ...(layer1RoughnessTexturePath ? { layer1RoughnessTextureUrl: projectFileUrl(layer1RoughnessTexturePath) } : {}),
      ...(layer1MetalnessTexturePath ? { layer1MetalnessTextureUrl: projectFileUrl(layer1MetalnessTexturePath) } : {}),
      ...(layer1OpacityTexturePath ? { layer1OpacityTextureUrl: projectFileUrl(layer1OpacityTexturePath) } : {}),
      ...(layer1EmissiveTexturePath ? { layer1EmissiveTextureUrl: projectFileUrl(layer1EmissiveTexturePath) } : {}),
      ...(layer1AoTexturePath ? { layer1AoTextureUrl: projectFileUrl(layer1AoTexturePath) } : {}),
      ...(layerBlendMaskTexturePath ? { layerBlendMaskTextureUrl: projectFileUrl(layerBlendMaskTexturePath) } : {}),
      uvTiling: def.uvTiling,
      roughness: def.roughness,
      metalness: def.metalness,
      aoIntensity: def.aoIntensity,
      opacity: def.opacity,
      alphaMode: def.alphaMode,
      alphaTest: def.alphaTest,
      side: def.side,
      emissive: def.emissive,
      emissiveIntensity: def.emissiveIntensity,
    };
  }

  private texturePathById(textureId: string | null): string | undefined {
    if (!textureId) return undefined;
    const texture = assetRecordById(
      { version: 1, generated: "", ktx2: false, assets: this.editableAssets },
      textureId,
    );
    return texture ? assetPath(texture) : undefined;
  }

  private async renderAssetThumbnail(
    item: BrowserAssetItem,
    thumb: HTMLElement,
  ): Promise<void> {
    try {
      const material = await this.resolveModelDefaultMaterialPreview(item);
      const imageUrl = await this.thumbnailRenderer.renderModel(
        projectFileUrl(item.path),
        material,
      );
      if (!thumb.isConnected) return;
      thumb.replaceChildren();
      const image = document.createElement("img");
      image.alt = "";
      image.src = imageUrl;
      thumb.append(image);
    } catch {
      if (thumb.isConnected) thumb.textContent = item.ext.toUpperCase();
    }
  }

  /**
   * Opens the asset editor that matches the model asset type.
   */
  private async openMeshEditor(item: BrowserAssetItem): Promise<void> {
    if (item.type === "skeletalMesh") {
      await this.openSkeletalMeshEditor(item);
      return;
    }
    await this.openStaticMeshEditor(item);
  }

  /**
   * Opens the Static Mesh editor for a model asset (Content Browser
   * double-click). Dynamically imported so its Three.js geometry helpers stay
   * out of the editor entry until a model is actually opened.
   */
  private async openStaticMeshEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { StaticMeshEditor } = await import("@/editor/StaticMeshEditor");
      StaticMeshEditor.open({
        modelPath: item.path,
        ...(item.editable ? { assetId: item.editable.id } : {}),
        label: item.label,
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        onStatus: (message, tone) => this.setStatus(message, tone),
        onMaterialSlotsSaved: (assetId) => {
          this.modelMaterialPreviewCache.delete(assetId);
          this.renderContentAssets();
          void this.app.refreshAssetMaterialSlots(assetId);
        },
        onAssetUvwSaved: (assetId) => {
          void this.app.refreshAssetUvwMapping(assetId);
        },
        onCollisionSaved: () => {
          // Pick up the just-saved sidecar (preset/complexity/primitives) so the
          // scene's Show Collision overlay, Play-mode physics, and the Details
          // Simulate Physics guard (complexAsSimple → static-only) reflect it.
          void this.app.refreshAssetCollision().then(() => this.renderDetails(this.selected));
        },
      });
    } catch (error) {
      this.setStatus(
        `Could not open Static Mesh editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Opens the Persona-style Skeletal Mesh editor for skinned character assets.
   */
  private async openSkeletalMeshEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { SkeletalMeshEditor } = await import("@/editor/SkeletalMeshEditor");
      SkeletalMeshEditor.open({
        modelPath: item.path,
        ...(item.editable ? { assetId: item.editable.id } : {}),
        label: item.label,
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        onStatus: (message, tone) => this.setStatus(message, tone),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Skeletal Mesh editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Opens the form-based Material Editor for a `*.material.json` asset.
   * Kept behind a dynamic import like the other asset editors.
   */
  private async openMaterialEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { MaterialEditor } = await import("@/editor/MaterialEditor");
      await MaterialEditor.open({
        path: item.path,
        label: item.label.replace(/\.(material|mat)\.json$/i, ""),
        ...(item.editable ? { materialId: item.editable.id } : {}),
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        hideDevelopmentContent: !this.showDevelopmentContent,
        onStatus: (message, tone) => this.setStatus(message, tone),
        onSaved: () => {
          const key = item.editable?.id ?? item.path;
          this.materialPreviewCache.delete(key);
          this.modelMaterialPreviewCache.clear();
          this.thumbnailRenderer.clearCache();
          this.renderContentAssets();
          if (item.editable) void this.app.refreshMaterialAsset(item.editable.id);
        },
        onApplyToSelected: (materialId) => this.app.setSelectionMaterialSlot(materialId),
        onBrowse: () => this.setStatus(`In Content Browser: ${item.path}`),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Material Editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Opens the UMG Lite UI Widget editor for a `*.ui.json` asset. Kept behind a
   * dynamic import like the other asset editors.
   */
  private async openUiWidgetEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { UiWidgetEditor } = await import("@/editor/UiWidgetEditor");
      await UiWidgetEditor.open({
        path: item.path,
        label: item.label.replace(/\.ui\.json$/i, ""),
        onStatus: (message, tone) => this.setStatus(message, tone),
        onSaved: () => this.renderContentAssets(),
      });
    } catch (error) {
      this.setStatus(
        `Could not open UI Widget editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Opens the node-graph Sound Cue editor for a `*.soundcue.json` asset.
   * Kept behind a dynamic import like the other asset editors.
   */
  private async openSoundCueEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { SoundCueEditor } = await import("@/editor/SoundCueEditor");
      await SoundCueEditor.open({
        path: item.path,
        label: item.label.replace(/\.soundcue\.json$/i, ""),
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        onStatus: (message, tone) => this.setStatus(message, tone),
        onSaved: () => this.renderContentAssets(),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Sound Cue editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Opens the VFX Lite Particle Effect editor for a `*.effect.json` asset.
   * Kept behind a dynamic import like the other asset editors.
   */
  private async openParticleEffectEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { ParticleEffectEditor } = await import("@/editor/ParticleEffectEditor");
      await ParticleEffectEditor.open({
        path: item.path,
        label: item.label.replace(/\.effect\.json$/i, ""),
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        hideDevelopmentContent: !this.showDevelopmentContent,
        onStatus: (message, tone) => this.setStatus(message, tone),
        onSaved: () => this.renderContentAssets(),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Particle Effect editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  private async openDialogueEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { DialogueEditor } = await import("@/editor/DialogueEditor");
      const mode = item.type === "dialogueVoice" ? "voice" : "line";
      const suffix = mode === "voice" ? /\.dialoguevoice\.json$/i : /\.dialogue\.json$/i;
      await DialogueEditor.open({
        mode,
        path: item.path,
        label: item.label.replace(suffix, ""),
        // Line mode: speaker/target suggestions come from the project's voices,
        // and the audio-source picker + preview from its sound / soundCue assets.
        voicePaths: this.editableAssets
          .filter((asset) => assetType(asset) === "dialogueVoice")
          .map((asset) => assetPath(asset)),
        audioAssets: this.editableAssets
          .filter((asset) => assetType(asset) === "sound" || assetType(asset) === "soundCue")
          .map((asset) => ({
            id: asset.id,
            name: asset.displayName ?? asset.name,
            assetType: assetType(asset) as "sound" | "soundCue",
            path: assetPath(asset),
          })),
        onStatus: (message, tone) => this.setStatus(message, tone),
        onSaved: () => this.renderContentAssets(),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Dialogue editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  private renderOutliner(objects: EditableSceneObject[]): void {
    this.outlinerObjects = objects;
    renderOutlinerPanel({
      body: this.outlinerList,
      objects,
      filter: this.outlinerFilter,
      selectSceneObject: (id, options) => this.app.selectSceneObject(id, options),
      renameSceneObject: (id, name) => this.app.renameSceneObject(id, name),
      setSceneObjectHidden: (id, hidden) => this.app.setSceneObjectHidden(id, hidden),
      setSceneObjectLocked: (id, locked) => this.app.setSceneObjectLocked(id, locked),
      parentObjectsTo: (childIds, parentId) => this.app.parentObjectsTo(childIds, parentId),
      openOutlinerContextMenu: (event, object) => this.openOutlinerContextMenu(event, object),
    });
  }

  /** Right-click menu for outliner rows: rename / duplicate / group / delete. */
  private openOutlinerContextMenu(event: MouseEvent, object: EditableSceneObject): void {
    const selectedCount = this.outlinerObjects.filter((entry) => entry.selected).length;
    const inGroup =
      object.groupId !== undefined ||
      this.outlinerObjects.some((entry) => entry.selected && entry.groupId);

    const ensureSelected = (): void => {
      if (!object.selected) this.app.selectSceneObject(object.id);
    };

    const items: ContextMenuItem[] = [
      {
        label: "Rename",
        enabled: true,
        run: () => {
          const next = window.prompt("Rename object", object.label);
          if (next !== null) this.app.renameSceneObject(object.id, next);
        },
      },
      {
        label: "Duplicate",
        enabled: true,
        run: () => {
          ensureSelected();
          this.app.duplicateSelected();
        },
      },
      {
        label: "Group Selected",
        enabled: selectedCount >= 2,
        run: () => this.app.groupSelected(),
      },
      {
        label: "Ungroup",
        enabled: inGroup,
        run: () => {
          ensureSelected();
          this.app.ungroupSelected();
        },
      },
      {
        label: "Parent to active",
        enabled: selectedCount >= 2,
        run: () => this.app.parentSelectionToActive(),
      },
      {
        label: "Unparent",
        enabled:
          object.parentId !== undefined ||
          this.outlinerObjects.some((entry) => entry.selected && entry.parentId),
        run: () => {
          ensureSelected();
          this.app.unparentSelected();
        },
      },
      {
        label: "Delete",
        enabled: true,
        danger: true,
        run: () => {
          ensureSelected();
          this.app.deleteSelected();
        },
      },
    ];

    this.openContextMenu(event, items);
  }

  /**
   * Builds and positions a context menu at the pointer, wiring outside-click /
   * Escape / blur dismissal. Shared by the outliner and the Content Browser.
   */
  private openContextMenu(event: MouseEvent, items: ContextMenuItem[]): void {
    this.closeContextMenu();

    const menu = document.createElement("div");
    menu.className = "context-menu";
    for (const item of items) {
      if (item.separator) {
        const divider = document.createElement("div");
        divider.className = "context-menu-separator";
        menu.appendChild(divider);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = `context-menu-item${item.danger ? " danger" : ""}`;
      button.textContent = item.label;
      button.disabled = item.enabled === false;
      button.addEventListener("click", () => {
        this.closeContextMenu();
        item.run();
      });
      menu.appendChild(button);
    }
    document.body.appendChild(menu);

    const margin = 8;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(event.clientX, window.innerWidth - rect.width - margin);
    const top = Math.min(event.clientY, window.innerHeight - rect.height - margin);
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
    this.contextMenu = menu;

    const onPointerDown = (pointerEvent: Event): void => {
      if (!menu.contains(pointerEvent.target as Node)) this.closeContextMenu();
    };
    const onKeyDown = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.code === "Escape") this.closeContextMenu();
    };
    // Defer so the opening event doesn't immediately dismiss the menu.
    window.setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", this.closeContextMenu);
    this.contextMenuCleanup = () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", this.closeContextMenu);
    };
  }

  /** Right-click menu for the Content Browser: New Folder / Import / typed assets. */
  private openContentContextMenu(event: MouseEvent, dir: string): void {
    const items: ContextMenuItem[] = [
      { label: "New Folder", run: () => void this.createContent("folder", dir) },
      { separator: true },
      { label: "Import...", run: () => this.startImport(dir) },
      { separator: true },
      ...CONTENT_NEW_ITEMS.map((item) => ({
        label: item.label,
        run: () => void this.createContent(item.kind, dir),
      })),
    ];
    this.openContextMenu(event, items);
  }

  /** Prompts for a name, then creates the folder/typed stub and refreshes the tree. */
  private async createContent(kind: ContentNewKind, dir: string): Promise<void> {
    // A "Script" is an Actor Script class-asset: pick its parent class first
    // (Unreal's Pick Parent Class dialog), like creating a Blueprint Class.
    let parentClass: ParentClass | undefined;
    let materialPreset: ForgeMaterialPreset | undefined;
    let particlePreset: ParticleEffectPreset | undefined;
    if (kind === "script") {
      const picked = await this.pickParentClass();
      if (!picked) return;
      parentClass = picked;
    } else if (kind === "material") {
      const picked = await this.pickMaterialPreset();
      if (!picked) return;
      materialPreset = picked;
    } else if (kind === "particle") {
      const picked = await this.pickParticlePreset();
      if (!picked) return;
      particlePreset = picked;
    }
    const label = kind === "folder" ? "folder" : kind === "script" ? "Actor Script" : `${kind} asset`;
    const name = window.prompt(`New ${label} name`, "");
    if (name === null || !name.trim()) return;
    try {
      const result = await createProjectContent({
        kind,
        dir,
        name: name.trim(),
        ...(parentClass ? { parentClass } : {}),
        ...(materialPreset ? { materialPreset } : {}),
        ...(particlePreset ? { particlePreset } : {}),
      });
      this.setStatus(`Created ${result.path}`, "success");
      if (result.registeredId) {
        try {
          this.editableAssets = await this.app.reloadEditableAssets();
        } catch {
          // Keep the stale list; the tree refresh below still shows the new file.
        }
      }
      await this.refreshAssetTree({ quiet: false });
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  /**
   * Modal mirroring Unreal's "Pick Parent Class": resolves to the chosen
   * {@link ParentClass}, or null when cancelled. Used when creating an Actor
   * Script from the Content Browser.
   */
  private pickParentClass(): Promise<ParentClass | null> {
    return new Promise((resolvePick) => {
      const overlay = document.createElement("div");
      overlay.className = "parent-class-overlay";
      const options = PARENT_CLASSES.map(
        (cls) => `
        <button type="button" class="parent-class-option" data-parent-class="${cls}">
          <span class="parent-class-name">${escapeHtml(PARENT_CLASS_LABELS[cls])}</span>
          <span class="parent-class-desc">${escapeHtml(PARENT_CLASS_DESCRIPTIONS[cls])}</span>
        </button>`,
      ).join("");
      overlay.innerHTML = `
        <div class="parent-class-dialog" role="dialog" aria-label="Pick Parent Class">
          <header class="parent-class-head">Pick Parent Class</header>
          <div class="parent-class-list">${options}</div>
          <footer class="parent-class-foot">
            <button type="button" class="parent-class-cancel" data-parent-cancel>Cancel</button>
          </footer>
        </div>
      `;
      document.body.append(overlay);
      const finish = (value: ParentClass | null): void => {
        cleanup();
        resolvePick(value);
      };
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") finish(null);
      };
      const cleanup = (): void => {
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
      };
      window.addEventListener("keydown", onKey, true);
      overlay.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === overlay || target.closest("[data-parent-cancel]")) {
          finish(null);
          return;
        }
        const option = target.closest<HTMLElement>("[data-parent-class]");
        if (option) finish(option.dataset.parentClass as ParentClass);
      });
    });
  }

  /**
   * Material creation starts with a small preset picker. The preset only seeds
   * the JSON defaults; the upcoming Material Editor remains free to change them.
   */
  private pickMaterialPreset(): Promise<ForgeMaterialPreset | null> {
    return new Promise((resolvePick) => {
      const overlay = document.createElement("div");
      overlay.className = "parent-class-overlay";
      const options = FORGE_MATERIAL_PRESETS.map(
        (preset) => `
        <button type="button" class="parent-class-option" data-material-preset="${preset}">
          <span class="parent-class-name">${escapeHtml(MATERIAL_PRESET_LABELS[preset])}</span>
          <span class="parent-class-desc">${escapeHtml(MATERIAL_PRESET_DESCRIPTIONS[preset])}</span>
        </button>`,
      ).join("");
      overlay.innerHTML = `
        <div class="parent-class-dialog" role="dialog" aria-label="Pick Material Preset">
          <header class="parent-class-head">Pick Material Preset</header>
          <div class="parent-class-list">${options}</div>
          <footer class="parent-class-foot">
            <button type="button" class="parent-class-cancel" data-material-preset-cancel>Cancel</button>
          </footer>
        </div>
      `;
      document.body.append(overlay);
      const finish = (value: ForgeMaterialPreset | null): void => {
        cleanup();
        resolvePick(value);
      };
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") finish(null);
      };
      const cleanup = (): void => {
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
      };
      window.addEventListener("keydown", onKey, true);
      overlay.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === overlay || target.closest("[data-material-preset-cancel]")) {
          finish(null);
          return;
        }
        const option = target.closest<HTMLElement>("[data-material-preset]");
        if (option) finish(option.dataset.materialPreset as ForgeMaterialPreset);
      });
    });
  }

  /**
   * Particle effect creation starts with a starter preset picker (§5.1). The
   * preset seeds the `*.effect.json` body; the Particle Effect Editor is free to
   * change everything afterwards.
   */
  private pickParticlePreset(): Promise<ParticleEffectPreset | null> {
    return new Promise((resolvePick) => {
      const overlay = document.createElement("div");
      overlay.className = "parent-class-overlay";
      const options = PARTICLE_EFFECT_PRESETS.map(
        (preset) => `
        <button type="button" class="parent-class-option" data-particle-preset="${preset}">
          <span class="parent-class-name">${escapeHtml(PARTICLE_PRESET_LABELS[preset])}</span>
          <span class="parent-class-desc">${escapeHtml(PARTICLE_PRESET_DESCRIPTIONS[preset])}</span>
        </button>`,
      ).join("");
      overlay.innerHTML = `
        <div class="parent-class-dialog" role="dialog" aria-label="Pick Particle Preset">
          <header class="parent-class-head">Pick Particle Preset</header>
          <div class="parent-class-list">${options}</div>
          <footer class="parent-class-foot">
            <button type="button" class="parent-class-cancel" data-particle-preset-cancel>Cancel</button>
          </footer>
        </div>
      `;
      document.body.append(overlay);
      const finish = (value: ParticleEffectPreset | null): void => {
        cleanup();
        resolvePick(value);
      };
      const onKey = (event: KeyboardEvent): void => {
        if (event.key === "Escape") finish(null);
      };
      const cleanup = (): void => {
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
      };
      window.addEventListener("keydown", onKey, true);
      overlay.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        if (target === overlay || target.closest("[data-particle-preset-cancel]")) {
          finish(null);
          return;
        }
        const option = target.closest<HTMLElement>("[data-particle-preset]");
        if (option) finish(option.dataset.particlePreset as ParticleEffectPreset);
      });
    });
  }

  /**
   * Opens the Actor Script editor for a `*.actor.json` class-asset (Content
   * Browser double-click). Dynamically imported so its panels stay out of the
   * editor entry until a class is actually opened.
   */
  private async openActorScriptEditor(item: BrowserAssetItem): Promise<void> {
    try {
      const { ActorScriptEditor } = await import("@/editor/ActorScriptEditor");
      // Freshly scan project classes so a Game Mode's Default Pawn Class picker
      // lists the latest character/pawn Actor Scripts (incl. just-created ones).
      await this.refreshProjectActorClasses();
      const pawnClassRefs = this.projectActorClasses
        .filter((cls) => cls.parentClass === "character" || cls.parentClass === "pawn")
        .map((cls) => ({ path: cls.path, name: cls.name }));
      await ActorScriptEditor.open({
        path: item.path,
        label: item.label.replace(/\.actor\.json$/i, ""),
        behaviorScriptIds: getGameEditorCatalog().behaviorScriptIds,
        assetIds: this.editableAssets.map((asset) => asset.id),
        assets: this.editableAssets.map((asset) => ({
          id: asset.id,
          name: asset.displayName ?? asset.name,
          assetType: assetType(asset),
          path: assetPath(asset),
        })),
        pawnClassRefs,
        onStatus: (message, tone) => this.setStatus(message, tone),
        onBrowse: () => void this.revealContentAsset(item.path),
        onPlay: () => void this.playTest(),
      });
    } catch (error) {
      this.setStatus(
        `Could not open Actor Script editor: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /** Lazily builds the hidden file input the Import flow reuses. */
  private ensureImportInput(): HTMLInputElement {
    if (this.importInput) return this.importInput;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept =
      ".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,.basis,.hdr,.exr,.mp3,.wav,.ogg,.json";
    input.style.display = "none";
    input.addEventListener("change", () => void this.handleImportFiles());
    document.body.appendChild(input);
    this.importInput = input;
    return input;
  }

  /** Opens the OS file picker; selected files upload into `dir`. */
  private startImport(dir: string): void {
    this.importTargetDir = dir;
    const input = this.ensureImportInput();
    input.value = ""; // allow re-selecting the same file twice in a row
    input.click();
  }

  /** Uploads the picked files into the target folder, then refreshes the tree. */
  private async handleImportFiles(): Promise<void> {
    const files = Array.from(this.importInput?.files ?? []);
    if (files.length === 0) return;
    const dir = this.importTargetDir;
    let imported = 0;
    const errors: string[] = [];
    for (const file of files) {
      try {
        await importProjectAsset(dir, file);
        imported += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (errors.length === 0) {
      this.setStatus(`Imported ${imported} file${imported === 1 ? "" : "s"}`, "success");
    } else {
      const tone = imported === 0 ? "error" : "warning";
      this.setStatus(`Imported ${imported}/${files.length}. ${errors[0]}`, tone);
    }
    // The import endpoint registers each asset in the manifest; re-read it so the
    // new entries resolve as editable (clears the "loose file" badge).
    if (imported > 0) {
      try {
        this.editableAssets = await this.app.reloadEditableAssets();
      } catch {
        // Keep the stale list; the tree refresh below still shows the new file.
      }
    }
    await this.refreshAssetTree({ quiet: false });
  }

  private closeContextMenu = (): void => {
    this.contextMenuCleanup?.();
    this.contextMenuCleanup = null;
    this.contextMenu?.remove();
    this.contextMenu = null;
  };

  private renderHistory(state: EditorHistoryState): void {
    this.undoButton.disabled = !state.canUndo;
    this.redoButton.disabled = !state.canRedo;
    this.undoButton.title = state.undoLabel ? `Undo ${state.undoLabel}` : "Undo";
    this.redoButton.title = state.redoLabel ? `Redo ${state.redoLabel}` : "Redo";
  }

  private setInspectorTab(tab: InspectorTab): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-inspector-tab]").forEach((button) => {
      const active = button.dataset.inspectorTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    this.root.querySelectorAll<HTMLElement>("[data-inspector-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.inspectorPane !== tab;
    });
    if (tab === "world") this.renderWorldSettings(this.worldSettings ?? this.app.getWorldSettings());
  }

  private renderWorldSettings(settings: EditorWorldSettings): void {
    this.worldSettings = settings;
    renderWorldSettingsPanel({
      body: this.worldSettingsBody,
      settings,
      projectGameModes: this.projectGameModes,
      setWorldSettings: (values) => this.app.setWorldSettings(values),
    });
  }

  private specialActorDetailsOptions(selection: EditableSelection): SpecialActorDetailsOptions {
    return {
      body: this.detailsBody,
      selection,
      editableAssets: this.editableAssets,
      setDetailsScale: (scale) => {
        this.detailsScale = scale;
      },
      beginDetailsEdit: () => this.beginDetailsEdit(),
      applyDetails: () => this.applyDetails(),
      applyScaleInput: (input) => this.applyScaleInput(input),
      commitDetailsEdit: () => this.commitDetailsEdit(),
      setSelectionScaleLocked: (locked) => this.app.setSelectionScaleLocked(locked),
      renameSceneObject: (id, name) => this.app.renameSceneObject(id, name),
      handleDetailToggle: (toggle, checked) => this.handleDetailToggle(toggle, checked),
      setSelectedLightSettings: (values) => this.app.setSelectedLightSettings(values),
      setSelectedReflectionPlane: (patch) => this.app.setSelectedReflectionPlane(patch),
      setSelectedReflectiveSurface: (patch) => this.app.setSelectedReflectiveSurface(patch),
      setSelectedBlockingVolume: (patch) => this.app.setSelectedBlockingVolume(patch),
      setSelectedReflectionCapture: (patch) => this.app.setSelectedReflectionCapture(patch),
      setSelectedWorldWidget: (patch) => this.app.setSelectedWorldWidget(patch),
      isSelectedReflectionCaptureBakeStale: () =>
        this.app.isSelectedReflectionCaptureBakeStale(),
      recaptureSelectedReflectionCapture: () => this.app.recaptureSelectedReflectionCapture(),
      recaptureAllReflectionCaptures: () => this.app.recaptureAllReflectionCaptures(),
    };
  }

  private environmentDetailsOptions(selection: EditableSelection): EnvironmentDetailsOptions {
    return {
      body: this.detailsBody,
      selection,
      setDetailsScale: (scale) => {
        this.detailsScale = scale;
      },
      setSkyAtmosphere: (patch, label) => this.app.setSkyAtmosphere(patch, label),
      setHeightFog: (patch, label) => this.app.setHeightFog(patch, label),
      setCloudLayer: (patch, label) => this.app.setCloudLayer(patch, label),
      setPostProcess: (patch, label) => this.app.setPostProcess(patch, label),
      recaptureSkyLightCapture: () => this.app.recaptureSkyLightCapture(),
    };
  }

  private renderDetails(selection: EditableSelection | null): void {
    if (!selection) {
      this.detailsScale = null;
      this.detailsBody.innerHTML = `
        <div class="empty-details">
          <strong>No selection</strong>
          <span>Viewport</span>
        </div>
      `;
      return;
    }
    if (selection.kind === "light") {
      renderLightDetails(this.specialActorDetailsOptions(selection));
      return;
    }
    if (selection.kind === "sky" && selection.sky) {
      renderSkyDetails(this.environmentDetailsOptions(selection));
      return;
    }
    if (selection.kind === "fog" && selection.fog) {
      renderFogDetails(this.environmentDetailsOptions(selection));
      return;
    }
    if (selection.kind === "cloud" && selection.cloud) {
      renderCloudDetails(this.environmentDetailsOptions(selection));
      return;
    }
    if (selection.kind === "post" && selection.post) {
      renderPostDetails(this.environmentDetailsOptions(selection));
      return;
    }
    if (selection.kind === "reflectionPlane") {
      renderReflectionPlaneDetails(this.specialActorDetailsOptions(selection));
      return;
    }
    if (selection.kind === "reflectiveSurface" && selection.reflectiveSurface) {
      renderReflectiveSurfaceDetails(this.specialActorDetailsOptions(selection));
      return;
    }
    if (selection.kind === "blockingVolume" && selection.blockingVolume) {
      renderBlockingVolumeDetails(this.specialActorDetailsOptions(selection));
      return;
    }
    if (selection.kind === "reflectionCapture" && selection.reflectionCapture) {
      renderReflectionCaptureDetails(this.specialActorDetailsOptions(selection));
      return;
    }
    if (selection.kind === "worldWidget" && selection.worldWidget) {
      renderWorldWidgetDetails(this.specialActorDetailsOptions(selection));
      return;
    }

    this.detailsScale = [...selection.scale];
    this.detailsBody.innerHTML = renderInstanceDetails({
      selection,
      pivotEditActive: this.app.isPivotEditMode(),
      sections: {
        material: renderMaterialSection(selection, this.editableAssets),
        collision: renderCollisionSection(selection),
        physics: renderPhysicsSection({
          selection,
          locked: selection.locked,
          complexAsSimple: this.app.assetCollisionComplexity(selection.assetId) === "complexAsSimple",
        }),
        components: renderComponentsSection(selection, this.editableAssets),
        metadata: renderMetadataSections(selection, this.metadataSchema),
      },
    });

    bindInstanceDetails({
      body: this.detailsBody,
      selection,
      beginDetailsEdit: () => this.beginDetailsEdit(),
      applyDetails: () => this.applyDetails(),
      applyScaleInput: (input) => this.applyScaleInput(input),
      commitDetailsEdit: () => this.commitDetailsEdit(),
      setSelectionScaleLocked: (locked) => this.app.setSelectionScaleLocked(locked),
      commitPivotInput: () => this.commitPivotInput(),
      applySelectionPivotPreset: (preset) => this.app.applySelectionPivotPreset(preset),
      togglePivotEditMode: () => this.app.togglePivotEditMode(),
      renameSceneObject: (id, name) => this.app.renameSceneObject(id, name),
      handleDetailAction: (action) => this.handleDetailAction(action),
      handleDetailToggle: (toggle, checked) => this.handleDetailToggle(toggle, checked),
      setSelectionCollisionPreset: (preset) => this.app.setSelectionCollisionPreset(preset),
      bindCollisionOverrideInputs: (currentSelection) =>
        bindCollisionOverrideInputs({
          body: this.detailsBody,
          selection: currentSelection,
          currentSelection: () => this.selected,
          setSelectionCollisionOverrides: (patch) =>
            this.app.setSelectionCollisionOverrides(patch),
        }),
      setSelectionMaterialSlot: (assetId) => this.app.setSelectionMaterialSlot(assetId),
      bindPhysicsInputs: () =>
        bindPhysicsInputs({
          body: this.detailsBody,
          setSelectionPhysics: (patch) => this.app.setSelectionPhysics(patch),
        }),
      bindComponentsInputs: () =>
        bindComponentsInputs({
          body: this.detailsBody,
          editableAssets: this.editableAssets,
          currentSelection: () => this.selected,
          setSelectionAudio: (audio) => this.app.setSelectionAudio(audio),
          setSelectionBehavior: (behavior) => this.app.setSelectionBehavior(behavior),
          setSelectionParticle: (particle) => this.app.setSelectionParticle(particle),
          setSelectionInteraction: (interaction) => this.app.setSelectionInteraction(interaction),
          setSelectionMovingPlatform: (platform) => this.app.setSelectionMovingPlatform(platform),
        }),
      bindMetadataInputs: () =>
        bindMetadataInputs({
          body: this.detailsBody,
          schema: this.metadataSchema,
          currentSelection: () => this.selected,
          setSelectionMetadata: (key, value, label) =>
            this.app.setSelectionMetadata(key, value, label),
        }),
    });
  }

  /** First `*.ui.json` widget asset id (for a new World Widget), or "" when none. */
  private firstUiWidgetAssetId(): string {
    const widget = this.editableAssets.find(
      (asset) => assetType(asset) === "ui" && assetPath(asset).toLowerCase().endsWith(".ui.json"),
    );
    return widget?.id ?? "";
  }

  private handleDetailAction(action: string): void {
    switch (action) {
      case "reset":
        this.resetSelectedTransform();
        break;
      case "copy":
        this.copySelectedTransform();
        break;
      case "paste":
        this.pasteSelectedTransform();
        break;
      case "snap-floor":
        this.app.snapSelectedToFloor();
        break;
      case "snap-wall":
        this.app.snapSelectedToWall();
        break;
    }
  }

  private handleDetailToggle(toggle: string, checked: boolean): void {
    if (!this.selected) return;
    switch (toggle) {
      case "locked":
        this.app.setSceneObjectLocked(this.selected.id, checked);
        break;
      case "castShadow":
        this.app.setSelectionCastShadow(checked);
        break;
      case "collision":
        this.app.setSelectionCollision(checked);
        break;
      case "simulatePhysics":
        this.app.setSelectionSimulatePhysics(checked);
        break;
    }
  }

  /** Resets rotation to 0 and scale to 1, leaving position untouched. */
  private resetSelectedTransform(): void {
    const before = this.app.captureSelectedTransforms();
    if (before.length === 0) return;
    this.app.updateSelectedTransforms({ rotation: [0, 0, 0], scale: [1, 1, 1] });
    this.app.commitSelectedTransforms(before, "Reset transform");
  }

  private copySelectedTransform(): void {
    const transform = this.app.captureSelectedTransform();
    if (!transform) return;
    this.transformClipboard = transform;
    this.setStatus("Transform copied.", "info");
  }

  private pasteSelectedTransform(): void {
    const clip = this.transformClipboard;
    if (!clip) {
      this.setStatus("Transform clipboard is empty.", "warning");
      return;
    }
    const before = this.app.captureSelectedTransforms();
    if (before.length === 0) return;
    this.app.updateSelectedTransforms({
      position: [...clip.position],
      rotation: [...clip.rotation],
      scale: [...clip.scale],
    });
    this.app.commitSelectedTransforms(before, "Paste transform");
  }

  /**
   * Keeps the scale inputs consistent before applying: with the lock on, editing
   * one axis scales the others by the same ratio (Unreal-style proportional lock).
   */
  private applyScaleInput(input: HTMLInputElement): void {
    if (!this.detailsScale) return;
    const index = Number(input.dataset.axis);
    if (!Number.isInteger(index) || index < 0 || index > 2) return;

    const next = Math.max(0.01, Number(input.value) || 0);
    const previous = this.detailsScale;

    if (this.selected?.scaleLocked) {
      const prevAxis = previous[index] ?? 0;
      const ratio = prevAxis !== 0 ? next / prevAxis : 0;
      this.detailsScale =
        ratio > 0
          ? [previous[0] * ratio, previous[1] * ratio, previous[2] * ratio]
          : [next, next, next];
    } else {
      const updated: [number, number, number] = [...previous];
      updated[index] = next;
      this.detailsScale = updated;
    }

    this.detailsScale = this.detailsScale.map((value) =>
      Number(value.toFixed(3)),
    ) as [number, number, number];

    // Reflect the recomputed siblings back into the fields the user is not typing in.
    this.detailsBody
      .querySelectorAll<HTMLInputElement>('input[data-detail="scale"]')
      .forEach((field) => {
        const fieldIndex = Number(field.dataset.axis);
        if (fieldIndex !== index && this.detailsScale) {
          field.value = String(this.detailsScale[fieldIndex]);
        }
      });
  }

  private beginDetailsEdit(): void {
    this.detailsBaseline ??= this.app.captureSelectedTransforms();
  }

  private commitDetailsEdit(): void {
    this.beginDetailsEdit();
    this.applyDetails();
    this.app.commitSelectedTransforms(this.detailsBaseline ?? []);
    this.detailsBaseline = null;
  }

  private applyDetails(): void {
    if (!this.selected || !this.detailsScale) return;
    const value = (name: string): number => {
      const input = this.detailsBody.querySelector<HTMLInputElement>(
        `input[name="${name}"]`,
      );
      return Number(input?.value ?? 0);
    };
    this.app.updateSelectedTransforms(
      {
        position: [value("px"), value("py"), value("pz")],
        rotation: [value("rx"), value("ry"), value("rz")],
        scale: [
          Math.max(0.01, this.detailsScale[0]),
          Math.max(0.01, this.detailsScale[1]),
          Math.max(0.01, this.detailsScale[2]),
        ],
      },
      {
        notifySelection: false,
      },
    );
  }

  /** Reads the three pivot fields and applies them (own undo step, not the transform baseline). */
  private commitPivotInput(): void {
    const value = (axis: number): number => {
      const input = this.detailsBody.querySelector<HTMLInputElement>(
        `input[data-pivot][data-axis="${axis}"]`,
      );
      return Number(input?.value ?? 0);
    };
    this.app.setSelectionPivot([value(0), value(1), value(2)]);
  }

  private async save(): Promise<void> {
    try {
      await this.app.saveLayout();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error), "error");
    }
  }

  private syncSnapControls(settings: EditorSnapSettings): void {
    this.setSnapSelect("move", settings.move);
    this.setSnapSelect("rotate", settings.rotate);
    this.setSnapSelect("scale", settings.scale);
    this.setSnapToggle("move", settings.moveEnabled);
    this.setSnapToggle("rotate", settings.rotateEnabled);
    this.setSnapToggle("scale", settings.scaleEnabled);
  }

  private setSnapSelect(key: "move" | "rotate" | "scale", value: number): void {
    const select = this.root.querySelector<HTMLSelectElement>(`select[data-snap="${key}"]`);
    if (!select) return;
    const textValue = String(value);
    if (![...select.options].some((option) => option.value === textValue)) {
      const option = document.createElement("option");
      option.value = textValue;
      option.textContent = textValue;
      select.append(option);
    }
    select.value = textValue;
  }

  private setSnapToggle(key: "move" | "rotate" | "scale", checked: boolean): void {
    const input = this.root.querySelector<HTMLInputElement>(`input[data-snap-toggle="${key}"]`);
    if (input) input.checked = checked;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isDevelopmentContentPath(path: string): boolean {
  const normalizedPath = normalizeProjectPath(path).toLocaleLowerCase();
  const normalized = normalizedPath.startsWith("public/assets/")
    ? normalizedPath.slice("public/".length)
    : normalizedPath;
  return normalized === "assets/developmentcontent" || normalized.startsWith("assets/developmentcontent/");
}

function isSameOrDescendantContentPath(path: string, folder: string): boolean {
  const normalizedPath = normalizeProjectPath(path);
  const normalizedFolder = normalizeProjectPath(folder);
  return normalizedPath === normalizedFolder || normalizedPath.startsWith(`${normalizedFolder}/`);
}

function replaceContentPathPrefix(path: string, fromFolder: string, toFolder: string): string {
  const normalizedPath = normalizeProjectPath(path);
  const normalizedFrom = normalizeProjectPath(fromFolder);
  const normalizedTo = normalizeProjectPath(toFolder);
  if (normalizedPath === normalizedFrom) return normalizedTo;
  if (!normalizedPath.startsWith(`${normalizedFrom}/`)) return normalizedPath;
  return `${normalizedTo}/${normalizedPath.slice(normalizedFrom.length + 1)}`;
}

function parentContentPath(path: string): string | null {
  const normalized = normalizeProjectPath(path);
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0) return null;
  return normalized.slice(0, slash);
}

function formatShapeTypeLabel(type: ShapePrimitiveType): string {
  switch (type) {
    case "cube":
      return "Cube";
    case "sphere":
      return "Sphere";
    case "cylinder":
      return "Cylinder";
    case "cone":
      return "Cone";
    case "plane":
      return "Plane";
  }
}

function formatLightTypeLabel(type: "directional" | "point" | "spot"): string {
  if (type === "directional") return "Directional Light";
  if (type === "point") return "Point Light";
  return "Spot Light";
}


function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

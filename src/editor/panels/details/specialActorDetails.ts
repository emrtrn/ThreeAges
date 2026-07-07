import { assetType, type EditableAsset } from "@engine/assets/manifest";
import type { BrushShape, LayoutLightActor, Vec3 } from "@engine/scene/layout";
import { BRUSH_SHAPES } from "@engine/scene/blockingVolume";
import type {
  EditableAiNavigationVolume,
  EditableBlockingVolume,
  EditableSelection,
  TargetPointReference,
} from "@/scene/SceneApp";
import { scaleRow, vectorRow } from "./transformRows";

type CaptureNumericKey = "radius" | "intensity" | "resolution" | "near" | "far" | "priority";
type SurfaceNumericKey =
  | "reflectionStrength"
  | "fresnelPower"
  | "fresnelBias"
  | "distortion"
  | "resolution";

interface TransformBindOptions {
  body: HTMLElement;
  selection: EditableSelection;
  beginDetailsEdit: () => void;
  applyDetails: () => void;
  applyScaleInput: (input: HTMLInputElement) => void;
  commitDetailsEdit: () => void;
  setSelectionScaleLocked: (locked: boolean) => void;
  renameSceneObject: (id: string, name: string) => void;
  handleDetailToggle: (toggle: string, checked: boolean) => void;
}

export interface SpecialActorDetailsOptions extends TransformBindOptions {
  editableAssets: readonly EditableAsset[];
  targetPoints: readonly TargetPointReference[];
  setDetailsScale: (scale: Vec3) => void;
  setSelectedLightSettings: (values: Partial<LayoutLightActor>) => void;
  setSelectedReflectionPlane: (patch: { color?: string; resolution?: number | undefined }) => void;
  setSelectedReflectiveSurface: (patch: {
    material?: string | null;
    reflectionStrength?: number;
    fresnelPower?: number;
    fresnelBias?: number;
    distortion?: number;
    tint?: string;
    resolution?: number | undefined;
  }) => void;
  setSelectedBlockingVolume: (patch: {
    brushShape?: BrushShape;
    size?: Vec3;
    brushSides?: number;
    renderInGame?: boolean;
    color?: string;
  }) => void;
  setSelectedAiNavigationVolume: (patch: {
    size?: Vec3;
    color?: string;
  }) => void;
  setSelectedTargetPoint: (patch: {
    nextTargetPoint?: string | undefined;
    startPoint?: boolean;
    waitTime?: number;
    acceptanceRadius?: number;
    speedOverride?: number | null;
    patrolTag?: string;
    color?: string;
  }) => void;
  setSelectedReflectionCapture: (patch: {
    radius?: number;
    intensity?: number;
    resolution?: number;
    near?: number;
    far?: number;
    parallax?: boolean;
    priority?: number;
  }) => void;
  setSelectedWorldWidget: (patch: {
    widget?: string;
    worldPos?: Vec3;
    entityId?: string;
    offset3d?: Vec3;
    offset?: [number, number];
    maxDistance?: number;
  }) => void;
  isSelectedReflectionCaptureBakeStale: () => boolean;
  recaptureSelectedReflectionCapture: () => void;
  recaptureAllReflectionCaptures: () => void;
}

export function renderLightDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  options.setDetailsScale([1, 1, 1]);
  const lockedAttr = selection.locked ? "disabled" : "";
  const isPoint = selection.lightType === "point";
  const isSpot = selection.lightType === "spot";
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>light / ${escapeHtml(selection.lightType ?? selection.assetId)}</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="${escapeHtml(selection.assetId)}" />
      </label>
      <div class="detail-row">
        <span>Type</span>
        <span class="detail-value">${escapeHtml(selection.lightType ?? "light")}</span>
      </div>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${!isPoint ? vectorRow("Rotation", "r", selection.rotation, 1, selection.locked) : ""}
      <div class="detail-section">
        <div class="detail-section-title">Light</div>
        <label class="detail-row">
          <span>Color</span>
          <input data-light-color type="color" value="${escapeHtml(selection.color ?? "#ffffff")}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Intensity</span>
          <input data-light-number="intensity" type="number" step="0.1" min="0" max="20"
            value="${selection.intensity ?? 1}" ${lockedAttr} />
        </label>
        ${
          isPoint || isSpot
            ? `<label class="detail-row">
              <span>Distance</span>
              <input data-light-number="distance" type="number" step="0.1" min="0" max="100"
                value="${selection.distance ?? (isPoint ? 8 : 10)}" ${lockedAttr} />
            </label>
            <label class="detail-row">
              <span>Decay</span>
              <input data-light-number="decay" type="number" step="0.1" min="0" max="8"
                value="${selection.decay ?? 2}" ${lockedAttr} />
            </label>`
            : ""
        }
        ${
          isSpot
            ? `<label class="detail-row">
              <span>Angle</span>
              <input data-light-number="angle" type="number" step="1" min="1" max="90"
                value="${selection.angle ?? 30}" ${lockedAttr} />
            </label>
            <label class="detail-row">
              <span>Penumbra</span>
              <input data-light-number="penumbra" type="number" step="0.05" min="0" max="1"
                value="${selection.penumbra ?? 0.35}" ${lockedAttr} />
            </label>`
            : ""
        }
        <label class="detail-toggle">
          <input type="checkbox" data-light-toggle="castShadow" ${
            selection.castShadow ? "checked" : ""
          } ${lockedAttr} />
          <span>Cast Shadow</span>
        </label>
      </div>
      ${actorLockSection(selection)}
    `;

  bindPositionRotation(options);
  bindNameAndLock(options);

  body.querySelector<HTMLInputElement>("[data-light-color]")?.addEventListener(
    "change",
    (event) => {
      options.setSelectedLightSettings({ color: (event.currentTarget as HTMLInputElement).value });
    },
  );

  body.querySelectorAll<HTMLInputElement>("[data-light-number]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.lightNumber;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      if (key === "intensity") options.setSelectedLightSettings({ intensity: value });
      if (key === "distance") options.setSelectedLightSettings({ distance: value });
      if (key === "decay") options.setSelectedLightSettings({ decay: value });
      if (key === "angle") options.setSelectedLightSettings({ angle: value });
      if (key === "penumbra") options.setSelectedLightSettings({ penumbra: value });
    });
  });

  body.querySelector<HTMLInputElement>("[data-light-toggle]")?.addEventListener(
    "change",
    (event) => {
      options.setSelectedLightSettings({
        castShadow: (event.currentTarget as HTMLInputElement).checked,
      });
    },
  );
}

export function renderReflectionPlaneDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>reflection / planar mirror</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="Mirror Plane" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${vectorRow("Rotation", "r", selection.rotation, 1, selection.locked)}
      ${scaleRow(selection.scale, selection.scaleLocked, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Reflection</div>
        <label class="detail-row">
          <span>Tint</span>
          <input data-reflection-plane-color type="color"
            value="${escapeHtml(selection.color ?? "#888888")}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Resolution</span>
          <select data-reflection-plane-resolution ${lockedAttr}>
            ${[128, 256, 512, 1024, 2048]
              .map(
                (res) =>
                  `<option value="${res}" ${
                    (selection.reflectionResolution ?? 512) === res ? "selected" : ""
                  }>${res}px</option>`,
              )
              .join("")}
          </select>
        </label>
        <div class="detail-hint">Higher resolution = sharper mirror, more GPU cost.</div>
      </div>
      ${actorLockSection(selection)}
    `;

  bindTransformInputs(options, true);
  bindNameAndLock(options);

  body
    .querySelector<HTMLInputElement>("[data-reflection-plane-color]")
    ?.addEventListener("change", (event) => {
      options.setSelectedReflectionPlane({
        color: (event.currentTarget as HTMLInputElement).value,
      });
    });

  body
    .querySelector<HTMLSelectElement>("[data-reflection-plane-resolution]")
    ?.addEventListener("change", (event) => {
      const value = Number((event.currentTarget as HTMLSelectElement).value);
      if (!Number.isFinite(value)) return;
      options.setSelectedReflectionPlane({ resolution: value });
    });
}

export function renderReflectiveSurfaceDetails(options: SpecialActorDetailsOptions): void {
  const { body, editableAssets, selection } = options;
  const surface = selection.reflectiveSurface;
  if (!surface) return;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  const materialAssets = editableAssets.filter((asset) => assetType(asset) === "material");
  const materialOptions = [
    `<option value="" ${surface.material ? "" : "selected"}>Default (glossy)</option>`,
  ]
    .concat(
      materialAssets.map(
        (asset) =>
          `<option value="${escapeHtml(asset.id)}" ${
            surface.material === asset.id ? "selected" : ""
          }>${escapeHtml(asset.displayName ?? asset.name)}</option>`,
      ),
    )
    .join("");
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>reflection / reflective surface</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="Reflective Surface" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${vectorRow("Rotation", "r", selection.rotation, 1, selection.locked)}
      ${scaleRow(selection.scale, selection.scaleLocked, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Material</div>
        <label class="detail-row">
          <span>Surface</span>
          <select data-surface-material ${lockedAttr}>${materialOptions}</select>
        </label>
        <div class="detail-hint">Albedo + normal map + roughness come from this material (asphalt, marble, ...).</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Reflection</div>
        <label class="detail-row">
          <span>Strength</span>
          <input data-surface-field="reflectionStrength" type="number" min="0" max="1" step="0.05"
            value="${surface.reflectionStrength}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Fresnel Power</span>
          <input data-surface-field="fresnelPower" type="number" min="0" max="16" step="0.5"
            value="${surface.fresnelPower}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Fresnel Bias</span>
          <input data-surface-field="fresnelBias" type="number" min="0" max="1" step="0.02"
            value="${surface.fresnelBias}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Distortion</span>
          <input data-surface-field="distortion" type="number" min="0" max="1" step="0.01"
            value="${surface.distortion}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Tint</span>
          <input data-surface-tint type="color" value="${escapeHtml(surface.tint)}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Resolution</span>
          <select data-surface-field="resolution" ${lockedAttr}>
            ${[128, 256, 512, 1024, 2048]
              .map(
                (res) =>
                  `<option value="${res}" ${
                    surface.resolution === res ? "selected" : ""
                  }>${res}px</option>`,
              )
              .join("")}
          </select>
        </label>
        <div class="detail-hint">Lower roughness + higher strength = sharper reflection; fresnel concentrates it at grazing angles.</div>
      </div>
      ${actorLockSection(selection)}
    `;

  bindTransformInputs(options, true);
  bindNameAndLock(options);

  body
    .querySelector<HTMLSelectElement>("[data-surface-material]")
    ?.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      options.setSelectedReflectiveSurface({ material: value || null });
    });

  body
    .querySelector<HTMLInputElement>("[data-surface-tint]")
    ?.addEventListener("change", (event) => {
      options.setSelectedReflectiveSurface({
        tint: (event.currentTarget as HTMLInputElement).value,
      });
    });

  body
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-surface-field]")
    .forEach((field) => {
      field.addEventListener("change", () => {
        const key = field.dataset.surfaceField as SurfaceNumericKey | undefined;
        if (!key) return;
        const value = Number(field.value);
        if (!Number.isFinite(value)) return;
        const patch: Partial<Record<SurfaceNumericKey, number>> = {};
        patch[key] = value;
        options.setSelectedReflectiveSurface(patch);
      });
    });
}

export function renderBlockingVolumeDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  const volume = selection.blockingVolume;
  if (!volume) return;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  const shapeOptions = BRUSH_SHAPES.map(
    (shape) =>
      `<option value="${shape}" ${volume.brushShape === shape ? "selected" : ""}>${
        formatBrushShapeLabel(shape)
      }</option>`,
  ).join("");
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>volume / blocking volume</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="Blocking Volume" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${vectorRow("Rotation", "r", selection.rotation, 1, selection.locked)}
      ${scaleRow(selection.scale, selection.scaleLocked, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Brush Settings</div>
        <label class="detail-row">
          <span>Brush Shape</span>
          <select data-brush-shape ${lockedAttr}>${shapeOptions}</select>
        </label>
        ${brushDimensionRows(volume, lockedAttr)}
        <label class="detail-row">
          <span>Color</span>
          <input data-brush-color type="color" value="${escapeHtml(volume.color)}" ${lockedAttr} />
        </label>
        <div class="detail-hint">Brush dimensions are world units; the transform scale multiplies them.</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Actor</div>
        <label class="detail-toggle">
          <input type="checkbox" data-brush-render-in-game ${volume.renderInGame ? "checked" : ""} />
          <span>Render in Game</span>
        </label>
        <label class="detail-toggle">
          <input type="checkbox" data-detail-toggle="locked" ${selection.locked ? "checked" : ""} />
          <span>Lock Movement</span>
        </label>
      </div>
    `;

  bindTransformInputs(options, true);
  bindNameAndLock(options);

  body
    .querySelector<HTMLSelectElement>("[data-brush-shape]")
    ?.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value as BrushShape;
      options.setSelectedBlockingVolume({ brushShape: value });
    });

  body.querySelectorAll<HTMLInputElement>("[data-brush-dim]").forEach((input) => {
    input.addEventListener("change", () => {
      options.setSelectedBlockingVolume(readBrushDimensions(body, volume));
    });
  });

  body
    .querySelector<HTMLInputElement>("[data-brush-color]")
    ?.addEventListener("change", (event) => {
      options.setSelectedBlockingVolume({
        color: (event.currentTarget as HTMLInputElement).value,
      });
    });

  body
    .querySelector<HTMLInputElement>("[data-brush-render-in-game]")
    ?.addEventListener("change", (event) => {
      options.setSelectedBlockingVolume({
        renderInGame: (event.currentTarget as HTMLInputElement).checked,
      });
    });
}

export function renderAiNavigationVolumeDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  const volume = selection.aiNavigationVolume;
  if (!volume) return;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>volume / AI navigation volume</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="AI Navigation Volume" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${vectorRow("Rotation", "r", selection.rotation, 1, selection.locked)}
      ${scaleRow(selection.scale, selection.scaleLocked, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Navigation Bounds</div>
        ${navigationVolumeDimensionRows(volume, lockedAttr)}
        <label class="detail-row">
          <span>Color</span>
          <input data-ai-nav-color type="color" value="${escapeHtml(volume.color)}" ${lockedAttr} />
        </label>
        <div class="detail-hint">AI pathfinding is allowed inside this volume; the transform scale multiplies its size.</div>
      </div>
      ${actorLockSection(selection)}
    `;

  bindTransformInputs(options, true);
  bindNameAndLock(options);

  body.querySelectorAll<HTMLInputElement>("[data-ai-nav-size]").forEach((input) => {
    input.addEventListener("change", () => {
      options.setSelectedAiNavigationVolume({ size: readNavigationVolumeSize(body, volume) });
    });
  });

  body
    .querySelector<HTMLInputElement>("[data-ai-nav-color]")
    ?.addEventListener("change", (event) => {
      options.setSelectedAiNavigationVolume({
        color: (event.currentTarget as HTMLInputElement).value,
      });
    });
}

export function renderTargetPointDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  const point = selection.targetPoint;
  if (!point) return;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>ai / target point</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="Target Point" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      ${vectorRow("Rotation", "r", selection.rotation, 1, selection.locked)}
      ${scaleRow(selection.scale, selection.scaleLocked, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Patrol</div>
        <label class="detail-toggle">
          <input data-target-point-start type="checkbox"
            ${point.startPoint ? "checked" : ""} ${lockedAttr} />
          <span>Start Point</span>
        </label>
        <label class="detail-row">
          <span>Next Target</span>
          ${targetPointSelect(point, options.targetPoints, lockedAttr)}
        </label>
        <label class="detail-row">
          <span>Wait Time</span>
          <input data-target-point-number="waitTime" type="number" min="0" step="0.1"
            value="${point.waitTime}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Acceptance</span>
          <input data-target-point-number="acceptanceRadius" type="number" min="0.01" step="0.05"
            value="${point.acceptanceRadius}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Speed</span>
          <input data-target-point-number="speedOverride" type="number" min="0" step="0.1"
            value="${point.speedOverride ?? ""}" placeholder="default" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Route Tag</span>
          <input data-target-point-field="patrolTag" type="text"
            value="${escapeHtml(point.patrolTag)}" placeholder="route id" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Color</span>
          <input data-target-point-color type="color" value="${escapeHtml(point.color)}" ${lockedAttr} />
        </label>
      </div>
      ${actorLockSection(selection)}
    `;

  bindTransformInputs(options, true);
  bindNameAndLock(options);

  body
    .querySelector<HTMLInputElement>("[data-target-point-start]")
    ?.addEventListener("change", (event) => {
      options.setSelectedTargetPoint({
        startPoint: (event.currentTarget as HTMLInputElement).checked,
      });
    });

  body
    .querySelector<HTMLSelectElement>("[data-target-point-next]")
    ?.addEventListener("change", (event) => {
      options.setSelectedTargetPoint({
        nextTargetPoint: (event.currentTarget as HTMLSelectElement).value,
      });
    });

  body
    .querySelectorAll<HTMLInputElement>("[data-target-point-field]")
    .forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.targetPointField as "patrolTag" | undefined;
        if (!key) return;
        options.setSelectedTargetPoint({ [key]: input.value });
      });
    });

  body
    .querySelectorAll<HTMLInputElement>("[data-target-point-number]")
    .forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.targetPointNumber as
          | "waitTime"
          | "acceptanceRadius"
          | "speedOverride"
          | undefined;
        if (!key) return;
        const value = input.value.trim() === "" ? null : Number(input.value);
        if (value !== null && !Number.isFinite(value)) return;
        if (key === "speedOverride") {
          options.setSelectedTargetPoint({ speedOverride: value });
          return;
        }
        if (value === null) return;
        options.setSelectedTargetPoint({ [key]: value });
      });
    });

  body
    .querySelector<HTMLInputElement>("[data-target-point-color]")
    ?.addEventListener("change", (event) => {
      options.setSelectedTargetPoint({
        color: (event.currentTarget as HTMLInputElement).value,
      });
    });
}

export function renderWorldWidgetDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  const widget = selection.worldWidget;
  if (!widget) return;
  options.setDetailsScale([...selection.scale]);
  const p = selection.position;
  const o3 = widget.offset3d;
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>ui / world widget</span>
      </div>
      <label class="detail-row">
        <span>Widget</span>
        <input data-ww-field="widget" type="text" value="${escapeHtml(widget.widget)}"
          placeholder="ui asset id (e.g. world-label)" />
      </label>
      <div class="detail-section">
        <div class="detail-section-title">Anchor</div>
        <label class="detail-row"><span>World X</span>
          <input data-ww-pos="0" type="number" step="0.1" value="${p[0]}" /></label>
        <label class="detail-row"><span>World Y</span>
          <input data-ww-pos="1" type="number" step="0.1" value="${p[1]}" /></label>
        <label class="detail-row"><span>World Z</span>
          <input data-ww-pos="2" type="number" step="0.1" value="${p[2]}" /></label>
        <label class="detail-row"><span>Entity Id</span>
          <input data-ww-field="entityId" type="text" value="${escapeHtml(widget.entityId)}"
            placeholder="actor:0 (optional, tracks entity)" /></label>
        <label class="detail-row"><span>Offset X</span>
          <input data-ww-off3="0" type="number" step="0.1" value="${o3[0]}" /></label>
        <label class="detail-row"><span>Offset Y</span>
          <input data-ww-off3="1" type="number" step="0.1" value="${o3[1]}" /></label>
        <label class="detail-row"><span>Offset Z</span>
          <input data-ww-off3="2" type="number" step="0.1" value="${o3[2]}" /></label>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Screen</div>
        <label class="detail-row"><span>Offset X (px)</span>
          <input data-ww-off="0" type="number" step="1" value="${widget.offset[0]}" /></label>
        <label class="detail-row"><span>Offset Y (px)</span>
          <input data-ww-off="1" type="number" step="1" value="${widget.offset[1]}" /></label>
        <label class="detail-row"><span>Max Distance</span>
          <input data-ww-field="maxDistance" type="number" min="0" step="1"
            value="${widget.maxDistance}" /></label>
      </div>
      <div class="detail-hint">World-space billboard. Anchor by a world point or an entity id; offsets nudge it. Position is edited numerically here (no gizmo yet).</div>
    `;

  body.querySelectorAll<HTMLInputElement>("[data-ww-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.wwField;
      if (key === "widget") options.setSelectedWorldWidget({ widget: input.value.trim() });
      else if (key === "entityId") options.setSelectedWorldWidget({ entityId: input.value.trim() });
      else if (key === "maxDistance") {
        const value = Number(input.value);
        options.setSelectedWorldWidget({ maxDistance: Number.isFinite(value) ? value : 0 });
      }
    });
  });

  body.querySelectorAll<HTMLInputElement>("[data-ww-pos]").forEach((input) => {
    input.addEventListener("change", () =>
      options.setSelectedWorldWidget({ worldPos: readWorldWidgetVec(body, "ww-pos", selection.position) }),
    );
  });
  body.querySelectorAll<HTMLInputElement>("[data-ww-off3]").forEach((input) => {
    input.addEventListener("change", () =>
      options.setSelectedWorldWidget({ offset3d: readWorldWidgetVec(body, "ww-off3", widget.offset3d) }),
    );
  });
  body.querySelectorAll<HTMLInputElement>("[data-ww-off]").forEach((input) => {
    input.addEventListener("change", () =>
      options.setSelectedWorldWidget({ offset: readWorldWidgetOffset(body, widget.offset) }),
    );
  });
}

export function renderReflectionCaptureDetails(options: SpecialActorDetailsOptions): void {
  const { body, selection } = options;
  const capture = selection.reflectionCapture;
  if (!capture) return;
  options.setDetailsScale([...selection.scale]);
  const lockedAttr = selection.locked ? "disabled" : "";
  const resolutions = [64, 128, 256, 512, 1024];
  const bakeStale = options.isSelectedReflectionCaptureBakeStale();
  body.innerHTML = `
      <div class="detail-heading">
        <strong>${escapeHtml(selection.label)}</strong>
        <span>reflection / sphere capture</span>
      </div>
      <label class="detail-row">
        <span>Name</span>
        <input data-detail-name type="text" value="${escapeHtml(selection.label)}"
          placeholder="Sphere Reflection Capture" />
      </label>
      ${vectorRow("Location", "p", selection.position, 0.1, selection.locked)}
      <div class="detail-section">
        <div class="detail-section-title">Reflection Capture</div>
        <label class="detail-row">
          <span>Radius</span>
          <input data-capture-field="radius" type="number" min="0.1" step="0.1"
            value="${capture.radius}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Resolution</span>
          <select data-capture-field="resolution" ${lockedAttr}>
            ${resolutions
              .map(
                (res) =>
                  `<option value="${res}" ${
                    capture.resolution === res ? "selected" : ""
                  }>${res}px</option>`,
              )
              .join("")}
          </select>
        </label>
        <label class="detail-row">
          <span>Intensity</span>
          <input data-capture-field="intensity" type="number" min="0" max="4" step="0.05"
            value="${capture.intensity}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Near</span>
          <input data-capture-field="near" type="number" min="0.001" step="0.1"
            value="${capture.near}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Far</span>
          <input data-capture-field="far" type="number" min="0.1" step="1"
            value="${capture.far}" ${lockedAttr} />
        </label>
        <label class="detail-row">
          <span>Priority</span>
          <input data-capture-field="priority" type="number" step="1"
            value="${capture.priority}" ${lockedAttr} />
        </label>
        <label class="detail-toggle">
          <input type="checkbox" data-capture-field="parallax"
            ${capture.parallax ? "checked" : ""} ${lockedAttr} />
          <span>Parallax Correction</span>
        </label>
        ${
          bakeStale
            ? `<div class="detail-hint detail-hint-warning">Bake is stale - the probe moved or near/far changed since capture. Press Recapture.</div>`
            : ""
        }
        <button type="button" data-capture-recapture class="detail-button${
          bakeStale ? " detail-button-warning" : ""
        }">Recapture</button>
        <button type="button" data-capture-recapture-all class="detail-button">Recapture All</button>
        <div class="detail-hint">Static capture: bakes a cubemap from this point - press Recapture after moving the probe or scene.</div>
      </div>
      ${actorLockSection(selection)}
    `;

  bindPositionRotation(options);
  bindNameAndLock(options);

  body
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-capture-field]")
    .forEach((field) => {
      field.addEventListener("change", () => {
        const key = field.dataset.captureField as CaptureNumericKey | "parallax" | undefined;
        if (!key) return;
        if (key === "parallax") {
          options.setSelectedReflectionCapture({ parallax: (field as HTMLInputElement).checked });
          return;
        }
        const value = Number(field.value);
        if (!Number.isFinite(value)) return;
        const patch: Partial<Record<CaptureNumericKey, number>> = {};
        patch[key] = value;
        options.setSelectedReflectionCapture(patch);
      });
    });

  body
    .querySelector<HTMLButtonElement>("[data-capture-recapture]")
    ?.addEventListener("click", () => {
      options.recaptureSelectedReflectionCapture();
    });

  body
    .querySelector<HTMLButtonElement>("[data-capture-recapture-all]")
    ?.addEventListener("click", () => {
      options.recaptureAllReflectionCaptures();
    });
}

function bindTransformInputs(options: TransformBindOptions, includeScale: boolean): void {
  bindPositionRotation(options);
  if (includeScale) bindScale(options);
}

function bindPositionRotation({
  body,
  beginDetailsEdit,
  applyDetails,
  commitDetailsEdit,
}: TransformBindOptions): void {
  body.querySelectorAll<HTMLInputElement>('input[data-detail="pr"]').forEach((input) => {
    input.addEventListener("focus", () => beginDetailsEdit());
    input.addEventListener("input", () => {
      beginDetailsEdit();
      applyDetails();
    });
    input.addEventListener("change", () => commitDetailsEdit());
  });
}

function bindScale(options: TransformBindOptions): void {
  const { body, selection } = options;
  body.querySelectorAll<HTMLInputElement>('input[data-detail="scale"]').forEach((input) => {
    input.addEventListener("focus", () => options.beginDetailsEdit());
    input.addEventListener("input", () => {
      options.beginDetailsEdit();
      options.applyScaleInput(input);
      options.applyDetails();
    });
    input.addEventListener("change", () => options.commitDetailsEdit());
  });

  body.querySelector<HTMLButtonElement>("[data-scale-lock]")?.addEventListener("click", () => {
    options.setSelectionScaleLocked(!selection.scaleLocked);
  });
}

function bindNameAndLock(options: TransformBindOptions): void {
  const { body, selection } = options;
  const nameInput = body.querySelector<HTMLInputElement>("[data-detail-name]");
  nameInput?.addEventListener("change", () => {
    options.renameSceneObject(selection.id, nameInput.value);
  });

  body.querySelectorAll<HTMLInputElement>("[data-detail-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () =>
      options.handleDetailToggle(toggle.dataset.detailToggle ?? "", toggle.checked),
    );
  });
}

function actorLockSection(selection: EditableSelection): string {
  return `
      <div class="detail-section">
        <div class="detail-section-title">Actor</div>
        <label class="detail-toggle">
          <input type="checkbox" data-detail-toggle="locked" ${selection.locked ? "checked" : ""} />
          <span>Lock Movement</span>
        </label>
      </div>`;
}

function targetPointSelect(
  point: NonNullable<EditableSelection["targetPoint"]>,
  targetPoints: readonly TargetPointReference[],
  lockedAttr: string,
): string {
  const candidates = targetPoints.filter((candidate) => candidate.id !== point.id);
  const selected = point.nextTargetPoint;
  const hasSelected = candidates.some((candidate) => candidate.id === selected);
  const missingOption =
    selected && !hasSelected
      ? `<option value="${escapeHtml(selected)}" selected>Missing: ${escapeHtml(selected)}</option>`
      : "";
  const options = candidates
    .map((candidate) => {
      const label = `${candidate.name} (${candidate.id})`;
      return `<option value="${escapeHtml(candidate.id)}" ${
        candidate.id === selected ? "selected" : ""
      }>${escapeHtml(label)}</option>`;
    })
    .join("");
  return `
          <select data-target-point-next ${lockedAttr}>
            <option value="" ${selected ? "" : "selected"}>None</option>
            ${missingOption}
            ${options}
          </select>`;
}

function brushDimensionRows(volume: EditableBlockingVolume, lockedAttr: string): string {
  const numberRow = (label: string, attr: string, value: number, step = 0.1): string => `
        <label class="detail-row">
          <span>${label}</span>
          <input data-brush-dim ${attr} type="number" min="0.01" step="${step}"
            value="${value}" ${lockedAttr} />
        </label>`;
  if (volume.brushShape === "box") {
    return (
      numberRow("X", 'data-brush-size="0"', volume.size[0]) +
      numberRow("Y", 'data-brush-size="1"', volume.size[1]) +
      numberRow("Z", 'data-brush-size="2"', volume.size[2])
    );
  }
  if (volume.brushShape === "sphere") {
    return numberRow("Radius", "data-brush-radius", volume.size[0] / 2);
  }
  return (
    numberRow("Radius", "data-brush-radius", volume.size[0] / 2) +
    numberRow("Height", "data-brush-height", volume.size[1]) +
    `
        <label class="detail-row">
          <span>Sides</span>
          <input data-brush-dim data-brush-sides type="number" min="3" max="128" step="1"
            value="${volume.brushSides}" ${lockedAttr} />
        </label>`
  );
}

function navigationVolumeDimensionRows(volume: EditableAiNavigationVolume, lockedAttr: string): string {
  return [0, 1, 2]
    .map((axis) => {
      const label = axis === 0 ? "X" : axis === 1 ? "Y" : "Z";
      return `
        <label class="detail-row">
          <span>${label}</span>
          <input data-ai-nav-size="${axis}" type="number" min="0.01" step="0.1"
            value="${volume.size[axis]}" ${lockedAttr} />
        </label>`;
    })
    .join("");
}

function readNavigationVolumeSize(body: HTMLElement, volume: EditableAiNavigationVolume): Vec3 {
  const size: Vec3 = [volume.size[0], volume.size[1], volume.size[2]];
  for (let axis = 0; axis < 3; axis += 1) {
    const input = body.querySelector<HTMLInputElement>(`[data-ai-nav-size="${axis}"]`);
    if (!input) continue;
    const value = Number(input.value);
    if (Number.isFinite(value) && value > 0) size[axis] = value;
  }
  return size;
}

function readBrushDimensions(
  body: HTMLElement,
  volume: EditableBlockingVolume,
): { size: Vec3; brushSides?: number } {
  const readPositive = (attr: string, fallback: number): number => {
    const input = body.querySelector<HTMLInputElement>(`[${attr}]`);
    if (!input) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  if (volume.brushShape === "box") {
    return {
      size: [
        readPositive('data-brush-size="0"', volume.size[0]),
        readPositive('data-brush-size="1"', volume.size[1]),
        readPositive('data-brush-size="2"', volume.size[2]),
      ],
    };
  }
  if (volume.brushShape === "sphere") {
    const diameter = readPositive("data-brush-radius", volume.size[0] / 2) * 2;
    return { size: [diameter, diameter, diameter] };
  }
  const diameter = readPositive("data-brush-radius", volume.size[0] / 2) * 2;
  const height = readPositive("data-brush-height", volume.size[1]);
  const sides = readPositive("data-brush-sides", volume.brushSides);
  return { size: [diameter, height, diameter], brushSides: sides };
}

function readWorldWidgetVec(body: HTMLElement, attr: string, fallback: Vec3): Vec3 {
  const vec: Vec3 = [fallback[0], fallback[1], fallback[2]];
  for (let i = 0; i < 3; i += 1) {
    const input = body.querySelector<HTMLInputElement>(`[data-${attr}="${i}"]`);
    if (input) {
      const value = Number(input.value);
      if (Number.isFinite(value)) vec[i] = value;
    }
  }
  return vec;
}

function readWorldWidgetOffset(body: HTMLElement, fallback: [number, number]): [number, number] {
  const out: [number, number] = [fallback[0], fallback[1]];
  for (let i = 0; i < 2; i += 1) {
    const input = body.querySelector<HTMLInputElement>(`[data-ww-off="${i}"]`);
    if (input) {
      const value = Number(input.value);
      if (Number.isFinite(value)) out[i] = value;
    }
  }
  return out;
}

function formatBrushShapeLabel(shape: BrushShape): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

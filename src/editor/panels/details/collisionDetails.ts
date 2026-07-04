import {
  COLLISION_CHANNELS,
  COLLISION_ENABLED_VALUES,
  COLLISION_OBJECT_CHANNELS,
  COLLISION_PRESET_IDS,
  COLLISION_RESPONSE_VALUES,
  PHYSICAL_MATERIAL_IDS,
  type CollisionChannel,
  type CollisionEnabled,
  type CollisionObjectChannel,
  type CollisionPresetId,
  type CollisionResponse,
  type CollisionResponseMap,
} from "@engine/scene/collision";
import type { EditableSelection } from "@/scene/SceneApp";

const COLLISION_PRESET_LABELS: Record<CollisionPresetId, string> = {
  noCollision: "No Collision",
  blockAll: "Block All",
  overlapAll: "Overlap All",
  blockAllDynamic: "Block All Dynamic",
  overlapAllDynamic: "Overlap All Dynamic",
  pawn: "Pawn",
  physicsActor: "Physics Actor",
  trigger: "Trigger",
  custom: "Custom",
};

const COLLISION_ENABLED_LABELS: Record<CollisionEnabled, string> = {
  none: "No Collision",
  query: "Query Only",
  physics: "Physics Only",
  queryAndPhysics: "Query and Physics",
};

const COLLISION_OBJECT_LABELS: Record<CollisionObjectChannel, string> = {
  worldStatic: "World Static",
  worldDynamic: "World Dynamic",
  pawn: "Pawn",
  physicsBody: "Physics Body",
  trigger: "Trigger",
};

const COLLISION_CHANNEL_LABELS: Record<CollisionChannel, string> = {
  worldStatic: "World Static",
  worldDynamic: "World Dynamic",
  pawn: "Pawn",
  physicsBody: "Physics Body",
  trigger: "Trigger",
  visibility: "Visibility",
  camera: "Camera",
};

const COLLISION_RESPONSE_LABELS: Record<CollisionResponse, string> = {
  ignore: "Ignore",
  overlap: "Overlap",
  block: "Block",
};

export interface SelectionCollisionOverridePatch {
  collisionEnabled?: CollisionEnabled | undefined;
  objectType?: CollisionObjectChannel | undefined;
  responses?: CollisionResponseMap | undefined;
  physicalMaterialId?: string | undefined;
  generateOverlapEvents?: boolean | undefined;
  simulationGeneratesHitEvents?: boolean | undefined;
}

export interface CollisionDetailsBindOptions {
  body: HTMLElement;
  selection: EditableSelection;
  currentSelection: () => EditableSelection | null;
  setSelectionCollisionOverrides: (patch: SelectionCollisionOverridePatch) => void;
}

/**
 * Per-object Collision section. Mirrors Unreal's component-level collision:
 * the Collision toggle plus a preset override that defaults to the asset's
 * collision definition ("inherit") until the user picks one.
 */
export function renderCollisionSection(selection: EditableSelection): string {
  // Actor instances carry collision/physics on their class, not per-instance
  // (overrides are a deferred phase), so the instance Details stays transform-only.
  if (selection.kind === "actor") return "";
  const presetOptions = [
    `<option value="" ${selection.collisionPreset ? "" : "selected"}>Inherit (asset default)</option>`,
  ]
    .concat(
      COLLISION_PRESET_IDS.map(
        (id) =>
          `<option value="${id}" ${
            selection.collisionPreset === id ? "selected" : ""
          }>${COLLISION_PRESET_LABELS[id]}</option>`,
      ),
    )
    .join("");
  const enabledOptions = [
    `<option value="" ${selection.collisionEnabled ? "" : "selected"}>Inherit (preset)</option>`,
  ]
    .concat(
      COLLISION_ENABLED_VALUES.map(
        (id) =>
          `<option value="${id}" ${
            selection.collisionEnabled === id ? "selected" : ""
          }>${COLLISION_ENABLED_LABELS[id]}</option>`,
      ),
    )
    .join("");
  const objectOptions = [
    `<option value="" ${selection.objectType ? "" : "selected"}>Inherit (preset)</option>`,
  ]
    .concat(
      COLLISION_OBJECT_CHANNELS.map(
        (id) =>
          `<option value="${id}" ${
            selection.objectType === id ? "selected" : ""
          }>${COLLISION_OBJECT_LABELS[id]}</option>`,
      ),
    )
    .join("");
  const physicalMaterialOptions = [
    `<option value="" ${selection.physicalMaterialId ? "" : "selected"}>Inherit (asset default)</option>`,
  ]
    .concat(
      PHYSICAL_MATERIAL_IDS.map(
        (id) =>
          `<option value="${id}" ${
            selection.physicalMaterialId === id ? "selected" : ""
          }>${id}</option>`,
      ),
    )
    .join("");
  const overlapValue =
    selection.generateOverlapEvents === undefined
      ? ""
      : selection.generateOverlapEvents
        ? "true"
        : "false";
  const hitValue =
    selection.simulationGeneratesHitEvents === undefined
      ? ""
      : selection.simulationGeneratesHitEvents
        ? "true"
        : "false";
  const eventOptions = (current: string): string =>
    [
      `<option value="" ${current === "" ? "selected" : ""}>Inherit (default on)</option>`,
      `<option value="true" ${current === "true" ? "selected" : ""}>Enabled</option>`,
      `<option value="false" ${current === "false" ? "selected" : ""}>Disabled</option>`,
    ].join("");
  const responseRows =
    selection.collisionPreset === "custom" || selection.responses
      ? COLLISION_CHANNELS.map((channel) => {
          const value = selection.responses?.[channel] ?? "";
          const options = [`<option value="" ${value ? "" : "selected"}>Inherit</option>`]
            .concat(
              COLLISION_RESPONSE_VALUES.map(
                (response) =>
                  `<option value="${response}" ${
                    value === response ? "selected" : ""
                  }>${COLLISION_RESPONSE_LABELS[response]}</option>`,
              ),
            )
            .join("");
          return `
              <label class="detail-row">
                <span>${COLLISION_CHANNEL_LABELS[channel]}</span>
                <select data-collision-response="${channel}">${options}</select>
              </label>
            `;
        }).join("")
      : "";
  return `
      <div class="detail-section">
        <div class="detail-section-title">Collision</div>
        <label class="detail-toggle">
          <input type="checkbox" data-detail-toggle="collision" ${
            selection.collision ? "checked" : ""
          } />
          <span>Collision</span>
        </label>
        <label class="detail-row">
          <span>Collision Presets</span>
          <select data-collision-preset>${presetOptions}</select>
        </label>
        <label class="detail-row">
          <span>Collision Enabled</span>
          <select data-collision-enabled>${enabledOptions}</select>
        </label>
        <label class="detail-row">
          <span>Object Type</span>
          <select data-collision-object-type>${objectOptions}</select>
        </label>
        <label class="detail-row">
          <span>Phys Material Override</span>
          <select data-collision-physical-material>${physicalMaterialOptions}</select>
        </label>
        <label class="detail-row">
          <span>Generate Overlap Events</span>
          <select data-collision-overlap-events>${eventOptions(overlapValue)}</select>
        </label>
        <label class="detail-row">
          <span>Simulation Generates Hit Events</span>
          <select data-collision-hit-events>${eventOptions(hitValue)}</select>
        </label>
        ${responseRows}
      </div>
    `;
}

export function bindCollisionOverrideInputs({
  body,
  selection,
  currentSelection,
  setSelectionCollisionOverrides,
}: CollisionDetailsBindOptions): void {
  if (selection.kind === "actor") return;
  body.querySelector<HTMLSelectElement>("[data-collision-enabled]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionCollisionOverrides({
        collisionEnabled: value ? (value as CollisionEnabled) : undefined,
      });
    },
  );
  body.querySelector<HTMLSelectElement>("[data-collision-object-type]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionCollisionOverrides({
        objectType: value ? (value as CollisionObjectChannel) : undefined,
      });
    },
  );
  body.querySelector<HTMLSelectElement>("[data-collision-physical-material]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionCollisionOverrides({
        physicalMaterialId: value || undefined,
      });
    },
  );
  body.querySelector<HTMLSelectElement>("[data-collision-overlap-events]")?.addEventListener(
    "change",
    (event) => {
      setSelectionCollisionOverrides({
        generateOverlapEvents: parseOptionalBoolean((event.target as HTMLSelectElement).value),
      });
    },
  );
  body.querySelector<HTMLSelectElement>("[data-collision-hit-events]")?.addEventListener(
    "change",
    (event) => {
      setSelectionCollisionOverrides({
        simulationGeneratesHitEvents: parseOptionalBoolean(
          (event.target as HTMLSelectElement).value,
        ),
      });
    },
  );
  body.querySelectorAll<HTMLSelectElement>("[data-collision-response]").forEach((select) => {
    select.addEventListener("change", () => {
      const channel = select.dataset.collisionResponse as CollisionChannel | undefined;
      if (!channel) return;
      const next: CollisionResponseMap = {
        ...(currentSelection()?.responses ?? selection.responses),
      };
      const value = select.value as CollisionResponse | "";
      if (value) next[channel] = value;
      else delete next[channel];
      setSelectionCollisionOverrides({
        responses: Object.keys(next).length > 0 ? next : undefined,
      });
    });
  });
}

function parseOptionalBoolean(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

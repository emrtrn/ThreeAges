import {
  isDefaultMetadataValue,
  metadataGroupsForTarget,
  type MetadataFieldDef,
  type MetadataSchema,
} from "@engine/scene/metadataSchema";
import type { MetadataValue } from "@engine/scene/layout";
import type { EditableSelection } from "@/scene/SceneApp";

export interface MetadataDetailsBindOptions {
  body: HTMLElement;
  schema: MetadataSchema | null;
  currentSelection: () => EditableSelection | null;
  setSelectionMetadata: (
    key: string,
    value: MetadataValue | undefined,
    label: string,
  ) => void;
}

/**
 * Renders schema-driven gameplay metadata groups for the selection. The editor
 * core stays generic: groups/fields come from the project's metadata schema.
 */
export function renderMetadataSections(
  selection: EditableSelection,
  schema: MetadataSchema | null,
): string {
  // Environment singletons + reflection planes + world widgets carry no
  // schema-driven metadata.
  if (!selectionSupportsMetadata(selection)) return "";

  const groups = metadataGroupsForTarget(schema, {
    kind: selection.kind,
    category: selection.category,
  });
  if (groups.length === 0) return "";
  return groups
    .map(
      (group) => `
      <div class="detail-section">
        <div class="detail-section-title">${escapeHtml(group.title)}</div>
        ${group.fields.map((field) => renderMetadataField(field, selection)).join("")}
      </div>`,
    )
    .join("");
}

export function bindMetadataInputs(options: MetadataDetailsBindOptions): void {
  options.body
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-meta-key]")
    .forEach((input) => {
      input.addEventListener("change", () => commitMetadataInput(options, input));
    });
}

function renderMetadataField(field: MetadataFieldDef, selection: EditableSelection): string {
  const raw = selection.metadata[field.key] ?? field.default;
  const attr = `data-meta-key="${escapeHtml(field.key)}" data-meta-type="${field.type}"`;
  const label = escapeHtml(field.label);

  if (field.type === "boolean") {
    const checked = raw === true ? "checked" : "";
    return `<label class="detail-toggle">
        <input type="checkbox" ${attr} ${checked} />
        <span>${label}</span>
      </label>`;
  }

  if (field.type === "select") {
    const current = typeof raw === "string" ? raw : "";
    const options = [`<option value="">—</option>`]
      .concat(
        (field.options ?? []).map(
          (option) =>
            `<option value="${escapeHtml(option)}" ${
              option === current ? "selected" : ""
            }>${escapeHtml(option)}</option>`,
        ),
      )
      .join("");
    return `<label class="detail-row">
        <span>${label}</span>
        <select ${attr}>${options}</select>
      </label>`;
  }

  if (field.type === "number") {
    const value = typeof raw === "number" ? String(raw) : "";
    const min = field.min !== undefined ? `min="${field.min}"` : "";
    const max = field.max !== undefined ? `max="${field.max}"` : "";
    const step = field.step !== undefined ? `step="${field.step}"` : "";
    return `<label class="detail-row">
        <span>${label}</span>
        <input type="number" ${attr} ${min} ${max} ${step}
          value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder ?? "")}" />
      </label>`;
  }

  // text + tags share a free-text input; tags is comma-separated.
  const value =
    field.type === "tags"
      ? (Array.isArray(raw) ? raw : []).join(", ")
      : typeof raw === "string"
        ? raw
        : "";
  const placeholder =
    field.placeholder ?? (field.type === "tags" ? "comma, separated, tags" : "");
  const listAttr = field.suggestions?.length
    ? `list="meta-list-${escapeHtml(field.key)}"`
    : "";
  const datalist = field.suggestions?.length
    ? `<datalist id="meta-list-${escapeHtml(field.key)}">${field.suggestions
        .map((option) => `<option value="${escapeHtml(option)}"></option>`)
        .join("")}</datalist>`
    : "";
  return `<label class="detail-row">
      <span>${label}</span>
      <input type="text" ${attr} ${listAttr} value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}" />
      ${datalist}
    </label>`;
}

function commitMetadataInput(
  options: MetadataDetailsBindOptions,
  input: HTMLInputElement | HTMLSelectElement,
): void {
  const key = input.dataset.metaKey;
  const type = input.dataset.metaType as MetadataFieldDef["type"] | undefined;
  if (!key || !type) return;
  const field = metadataFieldFor(options.schema, options.currentSelection(), key);
  if (!field) return;

  let value: MetadataValue | undefined;
  if (type === "boolean") {
    value = (input as HTMLInputElement).checked;
  } else if (type === "number") {
    const num = Number(input.value);
    value = input.value.trim() === "" || Number.isNaN(num) ? undefined : num;
  } else if (type === "tags") {
    value = input.value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  } else {
    value = input.value;
  }

  if (value !== undefined && isDefaultMetadataValue(field, value)) value = undefined;
  options.setSelectionMetadata(key, value, `Set ${field.label}`);
}

function metadataFieldFor(
  schema: MetadataSchema | null,
  selection: EditableSelection | null,
  key: string,
): MetadataFieldDef | null {
  if (!selection || !selectionSupportsMetadata(selection)) return null;

  const groups = metadataGroupsForTarget(schema, {
    kind: selection.kind,
    category: selection.category,
  });
  for (const group of groups) {
    const field = group.fields.find((entry) => entry.key === key);
    if (field) return field;
  }
  return null;
}

function selectionSupportsMetadata(
  selection: EditableSelection,
): selection is EditableSelection & { kind: "instance" | "character" } {
  return selection.kind === "instance" || selection.kind === "character";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import type { EditableSceneObject } from "@editor/core/editableScene";

export interface OutlinerPanelOptions {
  body: HTMLElement;
  objects: readonly EditableSceneObject[];
  filter: string;
  selectSceneObject: (id: string, options?: { additive?: boolean }) => void;
  renameSceneObject: (id: string, name: string) => void;
  setSceneObjectHidden: (id: string, hidden: boolean) => void;
  setSceneObjectLocked: (id: string, locked: boolean) => void;
  parentObjectsTo: (childIds: string[], parentId: string) => void;
  openOutlinerContextMenu: (event: MouseEvent, object: EditableSceneObject) => void;
}

export function renderOutlinerPanel(options: OutlinerPanelOptions): void {
  const { objects, filter } = options;

  if (filter) {
    const matches = objects.filter((object) => {
      const haystack = `${object.label} ${object.assetId} ${object.kind}`.toLocaleLowerCase();
      return haystack.includes(filter);
    });
    replaceOutlinerRows(options, matches.map((object) => ({ object, depth: 0 })), objects.length);
    return;
  }

  replaceOutlinerRows(options, orderOutlinerTree(objects), objects.length);
}

/** Depth-first order so children render indented under their parent. */
function orderOutlinerTree(
  objects: readonly EditableSceneObject[],
): Array<{ object: EditableSceneObject; depth: number }> {
  const byNodeId = new Map<string, EditableSceneObject>();
  for (const object of objects) {
    if (object.nodeId) byNodeId.set(object.nodeId, object);
  }
  const childrenByParent = new Map<string, EditableSceneObject[]>();
  for (const object of objects) {
    if (!object.parentId || !byNodeId.has(object.parentId)) continue;
    const list = childrenByParent.get(object.parentId) ?? [];
    list.push(object);
    childrenByParent.set(object.parentId, list);
  }

  const ordered: Array<{ object: EditableSceneObject; depth: number }> = [];
  const visited = new Set<string>();
  const walk = (object: EditableSceneObject, depth: number): void => {
    if (visited.has(object.id)) return;
    visited.add(object.id);
    ordered.push({ object, depth });
    if (object.nodeId) {
      for (const child of childrenByParent.get(object.nodeId) ?? []) walk(child, depth + 1);
    }
  };
  for (const object of objects) {
    if (!object.parentId || !byNodeId.has(object.parentId)) walk(object, 0);
  }
  // Any leftover (cycle) objects get appended at root depth.
  for (const object of objects) if (!visited.has(object.id)) walk(object, 0);
  return ordered;
}

function replaceOutlinerRows(
  options: OutlinerPanelOptions,
  entries: Array<{ object: EditableSceneObject; depth: number }>,
  totalCount: number,
): void {
  if (entries.length === 0) {
    options.body.innerHTML = `
        <div class="empty-details">
          <strong>${totalCount === 0 ? "No objects" : "No matches"}</strong>
          <span>Scene</span>
        </div>
      `;
    return;
  }

  let dragIds: string[] = [];
  options.body.replaceChildren(
    ...entries.map((entry) =>
      buildOutlinerRow(options, entry.object, entry.depth, () => dragIds, (next) => {
        dragIds = next;
      }),
    ),
  );
}

function buildOutlinerRow(
  options: OutlinerPanelOptions,
  object: EditableSceneObject,
  depth: number,
  getDragIds: () => readonly string[],
  setDragIds: (ids: string[]) => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "outliner-row";
  row.dataset.objectId = object.id;
  row.dataset.testid = "outliner-row";
  row.draggable = true;
  if (object.selected) row.classList.add("active");
  if (object.hidden) row.classList.add("is-hidden");
  if (object.groupId) row.classList.add("is-grouped");
  row.style.paddingLeft = `${8 + depth * 14}px`;
  row.innerHTML = `
      <span class="outliner-kind">${outlinerKindLabel(object.kind)}</span>
      <span class="outliner-meta">
        <strong>${object.groupId ? "⛓ " : ""}${object.label}</strong>
        <small>${object.assetId} - ${formatPosition(object.position)}</small>
      </span>
      <span class="outliner-actions">
        <button type="button" class="outliner-toggle${object.hidden ? " on" : ""}"
          data-action="hidden" title="${object.hidden ? "Show object" : "Hide object"}">${object.hidden ? "🙈" : "👁"}</button>
        <button type="button" class="outliner-toggle${object.locked ? " on" : ""}"
          data-action="locked" title="${object.locked ? "Unlock object" : "Lock object"}">${object.locked ? "🔒" : "🔓"}</button>
      </span>
    `;
  row.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".outliner-actions")) return;
    options.selectSceneObject(object.id, {
      additive: event.ctrlKey || event.shiftKey,
    });
  });
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    options.openOutlinerContextMenu(event, object);
  });
  row.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest(".outliner-actions")) return;
    const nextName = window.prompt("Rename object", object.label);
    if (nextName === null) return;
    options.renameSceneObject(object.id, nextName);
  });
  row.querySelector<HTMLButtonElement>('[data-action="hidden"]')?.addEventListener("click", () => {
    options.setSceneObjectHidden(object.id, !object.hidden);
  });
  row.querySelector<HTMLButtonElement>('[data-action="locked"]')?.addEventListener("click", () => {
    options.setSceneObjectLocked(object.id, !object.locked);
  });

  // Drag-and-drop parenting: drag a row (or the whole multi-selection if the
  // dragged row is part of it) onto another row to parent it there.
  row.addEventListener("dragstart", (event) => {
    const selectedIds = options.objects
      .filter((entry) => entry.selected)
      .map((entry) => entry.id);
    const nextDragIds = object.selected && selectedIds.length > 1 ? selectedIds : [object.id];
    setDragIds(nextDragIds);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", nextDragIds.join(","));
    }
    row.classList.add("is-dragging");
  });
  row.addEventListener("dragend", () => {
    setDragIds([]);
    row.classList.remove("is-dragging");
    for (const el of options.body.querySelectorAll(".drop-target")) {
      el.classList.remove("drop-target");
    }
  });
  row.addEventListener("dragover", (event) => {
    const dragIds = getDragIds();
    if (dragIds.length === 0) return;
    if (dragIds.includes(object.id)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    row.classList.add("drop-target");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("drop-target");
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("drop-target");
    const childIds = getDragIds().filter((id) => id !== object.id);
    setDragIds([]);
    if (childIds.length > 0) options.parentObjectsTo(childIds, object.id);
  });
  return row;
}

function formatPosition(position: [number, number, number]): string {
  return position.map((value) => Number(value.toFixed(2))).join(", ");
}

function outlinerKindLabel(kind: EditableSceneObject["kind"]): string {
  if (kind === "character") return "C";
  if (kind === "light") return "L";
  if (kind === "sky") return "S";
  if (kind === "fog") return "F";
  if (kind === "cloud") return "K";
  if (kind === "reflectionPlane") return "M";
  if (kind === "reflectiveSurface") return "R";
  if (kind === "reflectionCapture") return "O";
  if (kind === "post") return "P";
  if (kind === "worldWidget") return "W";
  return "I";
}

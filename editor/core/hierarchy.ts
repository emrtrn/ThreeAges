import { cloneSelection, type Selection } from "./selection";

export interface SelectionHierarchyFields {
  groupId?: string;
  nodeId?: string;
  parentId?: string;
}

export type SelectionHierarchyResolver = (
  selection: Selection,
) => SelectionHierarchyFields | null | undefined;

export function groupedSelections(
  selection: Selection,
  allSelections: Selection[],
  resolve: SelectionHierarchyResolver,
): Selection[] {
  const groupId = resolve(selection)?.groupId;
  if (!groupId) return [cloneSelection(selection)];

  const members = allSelections.filter((entry) => resolve(entry)?.groupId === groupId);
  return members.length > 0 ? members.map(cloneSelection) : [cloneSelection(selection)];
}

export function childSelections(
  selection: Selection,
  allSelections: Selection[],
  resolve: SelectionHierarchyResolver,
): Selection[] {
  const nodeId = resolve(selection)?.nodeId;
  if (!nodeId) return [];
  return allSelections.filter((entry) => resolve(entry)?.parentId === nodeId);
}

export function descendantSelections(
  selection: Selection,
  allSelections: Selection[],
  resolve: SelectionHierarchyResolver,
): Selection[] {
  const result: Selection[] = [];
  const visited = new Set<string>();

  const walk = (current: Selection): void => {
    const nodeId = resolve(current)?.nodeId;
    if (nodeId) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
    }
    for (const child of childSelections(current, allSelections, resolve)) {
      result.push(child);
      walk(child);
    }
  };

  walk(selection);
  return result;
}

import {
  NAVIGATION_ROLE_VALUES,
  type NavigationFloorCut,
  type NavigationRole,
} from "@engine/scene/collision";
import type { EditableSelection } from "@/scene/SceneApp";

const NAVIGATION_ROLE_LABELS: Record<NavigationRole, string> = {
  auto: "Auto",
  walkable: "Walkable Surface",
  obstacleOnly: "Obstacle Only",
  ignored: "Ignored",
};

const NAVIGATION_FLOOR_CUT_LABELS: Record<NavigationFloorCut, string> = {
  hole: "Full Hole",
  under: "Under Only (keep top)",
};

export function renderNavigationSection(selection: EditableSelection): string {
  if (selection.kind !== "instance") return "";
  const options = [
    `<option value="" ${selection.navigationRole ? "" : "selected"}>Inherit (asset default)</option>`,
  ]
    .concat(
      NAVIGATION_ROLE_VALUES.map(
        (role) =>
          `<option value="${role}" ${
            selection.navigationRole === role ? "selected" : ""
          }>${NAVIGATION_ROLE_LABELS[role]}</option>`,
      ),
    )
    .join("");
  const floorCut = selection.navigationFloorCut;
  const floorCutOptions = [
    `<option value="" ${floorCut ? "" : "selected"}>Off</option>`,
  ]
    .concat(
      (["hole", "under"] as NavigationFloorCut[]).map(
        (mode) =>
          `<option value="${mode}" ${
            floorCut === mode ? "selected" : ""
          }>${NAVIGATION_FLOOR_CUT_LABELS[mode]}</option>`,
      ),
    )
    .join("");
  return `
      <div class="detail-section">
        <div class="detail-section-title">AI Navigation</div>
        <label class="detail-row">
          <span>Navigation Role</span>
          <select data-navigation-role>${options}</select>
        </label>
        <label class="detail-row" title="Carve the AI nav floor around this object (agent-radius clearance). Full Hole removes the whole footprint; Under Only keeps a walkable top (stairs/ramps) and clears only the surrounding ground.">
          <span>Cut Nav Floor</span>
          <select data-navigation-floor-cut>${floorCutOptions}</select>
        </label>
      </div>
    `;
}

export function bindNavigationInputs(
  body: HTMLElement,
  setSelectionNavigationRole: (role: NavigationRole | undefined) => void,
  setSelectionNavigationFloorCut: (value: NavigationFloorCut | undefined) => void,
): void {
  body.querySelector<HTMLSelectElement>("[data-navigation-role]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionNavigationRole(value ? (value as NavigationRole) : undefined);
    },
  );
  body.querySelector<HTMLSelectElement>("[data-navigation-floor-cut]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionNavigationFloorCut(value ? (value as NavigationFloorCut) : undefined);
    },
  );
}

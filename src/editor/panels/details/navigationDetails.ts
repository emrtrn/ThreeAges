import {
  NAVIGATION_ROLE_VALUES,
  type NavigationRole,
} from "@engine/scene/collision";
import type { EditableSelection } from "@/scene/SceneApp";

const NAVIGATION_ROLE_LABELS: Record<NavigationRole, string> = {
  auto: "Auto",
  walkable: "Walkable Surface",
  obstacleOnly: "Obstacle Only",
  ignored: "Ignored",
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
  return `
      <div class="detail-section">
        <div class="detail-section-title">AI Navigation</div>
        <label class="detail-row">
          <span>Navigation Role</span>
          <select data-navigation-role>${options}</select>
        </label>
      </div>
    `;
}

export function bindNavigationInputs(
  body: HTMLElement,
  setSelectionNavigationRole: (role: NavigationRole | undefined) => void,
): void {
  body.querySelector<HTMLSelectElement>("[data-navigation-role]")?.addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setSelectionNavigationRole(value ? (value as NavigationRole) : undefined);
    },
  );
}

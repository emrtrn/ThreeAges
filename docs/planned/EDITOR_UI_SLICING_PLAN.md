# Editor UI Slicing Plan

> Created: 2026-07-04
> Scope: reduce `src/editor/EditorUi.ts` growth without changing editor behavior.

`EditorUi.ts` is the current shell for toolbar wiring, outliner, Content Drawer,
Details panel renderers, World Settings, context menus, and overlay editor
launching. New editor features should not add another large renderer directly to
this class. Add a small module owned by the feature and keep `EditorUi` as the
composition/wiring layer.

## Target Shape

- `EditorUi.ts`: shell, shared status, toolbar commands, high-level panel wiring.
- `src/editor/panels/details/`: Details panel renderer/binders by selected actor
  family.
- `src/editor/panels/content/`: Content Drawer tree/cards/context menus.
- `src/editor/panels/outliner/`: outliner row rendering and hierarchy DnD.
- `src/editor/panels/world/`: World Settings renderer/binders.

## First Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move pure Details HTML helpers (`vectorRow`, `scaleRow`, `pivotRow`,
   `axisField`) into `src/editor/panels/details/transformRows.ts`.
2. `[x]` Move generic instance/character Details rendering and binding into
   `src/editor/panels/details/instanceDetails.ts`.
3. `[x]` Keep behavior identical and prove with:
   - `npx tsc --noEmit`
   - `npm run test:engine`
   - `npm run smoke:browser`

Evidence (2026-07-04):

- `src/editor/panels/details/transformRows.ts` owns the transform row helpers.
- `src/editor/panels/details/instanceDetails.ts` owns generic Details HTML and
  DOM binding for instance/character/actor selections.
- `EditorUi.ts` still owns composition, status, toolbar, save/load, and the
  larger material/collision/physics/components/metadata sub-renderers.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run smoke:browser` (1 Chromium smoke).

## Rules

- Do not move save/load ownership while slicing; `/__save-*` stores stay as-is.
- Keep renderer functions pure where possible: input selection + project/editor
  catalog data in, HTML/event bind descriptors out.
- A slice is complete only when the browser smoke still covers select/place,
  transform, undo/redo, save, reload, and Play route boot.

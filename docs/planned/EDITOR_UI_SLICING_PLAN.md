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
  larger physics/components/metadata sub-renderers.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run smoke:browser` (1 Chromium smoke).

## Second Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move the instance Materials Details renderer into
   `src/editor/panels/details/materialDetails.ts`.
2. `[x]` Move Collision Details rendering, label maps, optional boolean parsing,
   and collision override DOM binding into
   `src/editor/panels/details/collisionDetails.ts`.
3. `[x]` Keep `EditorUi.ts` as the composition layer for the remaining Details
   sections and app command callbacks.

Evidence (2026-07-04):

- `src/editor/panels/details/materialDetails.ts` owns the material slot HTML.
- `src/editor/panels/details/collisionDetails.ts` owns Collision Details HTML
  and override binding while preserving the current-selection response merge.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Third Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move Physics Details rendering, default damping constants, constraint
   row helpers, and physics input binding into
   `src/editor/panels/details/physicsDetails.ts`.
2. `[x]` Keep `EditorUi.ts` responsible only for passing
   `assetCollisionComplexity(...) === "complexAsSimple"` and the
   `setSelectionPhysics` callback.

Evidence (2026-07-04):

- `src/editor/panels/details/physicsDetails.ts` owns Physics Details HTML and
  input binding for mass/damping/gravity/constraint fields.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Fourth Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move optional component Details rendering for Audio, Behavior,
   Particle, Interaction, and Moving Platform into
   `src/editor/panels/details/componentDetails.ts`.
2. `[x]` Move component add/remove defaults and DOM input binding into the same
   module, while keeping `EditorUi.ts` responsible for app command callbacks and
   current selection access.

Evidence (2026-07-04):

- `src/editor/panels/details/componentDetails.ts` owns optional component card
  HTML, add/remove defaults, and input commit logic.
- `EditorUi.ts` now passes only `editableAssets`, `currentSelection`, and the
  `setSelection*` callbacks for component editing.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Remaining Roadmap `[ ] Not Started`

Current `EditorUi.ts` remainder map after the first four slices:

- Metadata Details: `renderMetadataSections(...)`, `bindMetadataInputs(...)`.
- Special actor Details: light, reflection plane, reflective surface, blocking
  volume, world widget, reflection capture.
- Environment singleton Details: sky, fog, cloud, post-process.
- World Settings: `renderWorldSettings(...)`.
- Outliner and History: `renderOutliner(...)`, `renderHistory(...)`.
- Content Drawer: asset list/filter rendering, asset detail popover, context
  menu actions, drag/drop card wiring.

The next work should continue as small behavior-preserving extractions. Do not
start by moving save/load endpoints, editor boot, toolbar commands, or overlay
editor launching.

## Fifth Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move schema-driven Metadata Details rendering into
   `src/editor/panels/details/metadataDetails.ts`.
2. `[x]` Move metadata field lookup, default handling, and DOM input binding
   into the same module.
3. `[x]` Keep `EditorUi.ts` responsible only for passing the current
   `MetadataSchema`, selection, and the metadata update callback.
4. `[x]` Preserve current behavior for string, number, boolean, enum, tag, and
   default-value clearing.
5. `[x]` Prove with:
   - `npx.cmd tsc --noEmit`
   - `npm.cmd run test:engine`
   - `npm.cmd run verify:imports`
   - `npm.cmd run smoke:browser`

Evidence (2026-07-04):

- `src/editor/panels/details/metadataDetails.ts` owns Metadata Details HTML,
  field lookup, default-value clearing, and DOM input binding.
- `EditorUi.ts` now passes only the active `MetadataSchema`, current selection,
  and `setSelectionMetadata(...)` callback for metadata editing.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Sixth Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move placed special actor Details renderers into
   `src/editor/panels/details/specialActorDetails.ts`:
   - light
   - reflection plane
   - reflective surface
   - blocking volume
   - world widget
   - reflection capture
2. `[x]` Reuse existing transform row helpers instead of duplicating location /
   rotation / scale HTML.
3. `[x]` Keep `EditorUi.ts` responsible for routing by `selection.kind` and
   passing app callbacks such as recapture, setter commands, and details edit
   lifecycle hooks.
4. `[x]` Prove with the same validation gate as the fifth slice.

Evidence (2026-07-04):

- `src/editor/panels/details/specialActorDetails.ts` owns placed special actor
  Details HTML and DOM binding for lights, reflection planes, reflective
  surfaces, blocking volumes, world widgets, and reflection captures.
- `EditorUi.ts` keeps the `selection.kind` routing and passes app callbacks,
  editor edit lifecycle hooks, editable assets, and capture recapture commands.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Seventh Extraction Slice `[x] Completed 2026-07-04`

1. `[x]` Move environment singleton Details renderers into
   `src/editor/panels/details/environmentDetails.ts`:
   - sky atmosphere
   - height fog
   - cloud layer
   - post-process
2. `[x]` Keep singleton visibility/hidden behavior and numeric clamping exactly
   as-is.
3. `[x]` Keep `EditorUi.ts` responsible only for routing and app callbacks.
4. `[x]` Prove with the same validation gate as the fifth slice.

Evidence (2026-07-04):

- `src/editor/panels/details/environmentDetails.ts` owns environment singleton
  Details HTML and DOM binding for Sky Atmosphere, Height Fog, Cloud Layer, and
  Post Process.
- `EditorUi.ts` keeps the `selection.kind` routing and passes only Details body,
  scale assignment, environment setter callbacks, and sky-light recapture.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (596 checks), `npm.cmd run verify:imports`, `npm.cmd run smoke:browser`
  (1 Chromium smoke).

## Eighth Extraction Slice `[ ] Planned`

1. `[ ]` Move World Settings rendering and DOM binding into
   `src/editor/panels/world/worldSettingsPanel.ts`.
2. `[ ]` Keep `EditorUi.ts` responsible for owning the panel element and passing
   `setWorldSettings(...)`.
3. `[ ]` Preserve snap settings, game mode selection, gravity, ambient light, and
   Kill Z behavior.
4. `[ ]` Prove with the same validation gate as the fifth slice.

## Ninth Extraction Slice `[ ] Planned`

1. `[ ]` Move Outliner row rendering, selection state, visibility/lock controls,
   hierarchy affordances, and drag/drop binding into
   `src/editor/panels/outliner/outlinerPanel.ts`.
2. `[ ]` Keep `EditorUi.ts` responsible for app command callbacks and selected
   object state.
3. `[ ]` Leave History panel extraction separate unless it becomes naturally
   small; otherwise move it to `src/editor/panels/outliner/historyPanel.ts` in a
   follow-up slice.
4. `[ ]` Prove with the same validation gate as the fifth slice.

## Tenth Extraction Slice `[ ] Planned`

1. `[ ]` Move Content Drawer asset rendering, filters, asset detail popover, and
   card interaction binding into `src/editor/panels/content/contentPanel.ts`.
2. `[ ]` Keep Content Browser create/rename/delete/import endpoint ownership in
   `EditorUi.ts` or existing project/content services until a separate
   endpoint-focused plan exists.
3. `[ ]` Preserve asset drag/drop placement, context menus, active folder/filter
   state, and thumbnail behavior.
4. `[ ]` Prove with:
   - `npx.cmd tsc --noEmit`
   - `npm.cmd run test:engine`
   - `npm.cmd run verify:imports`
   - `npm.cmd run smoke:browser`
   - a manual or Playwright check for Content Drawer asset placement if the
     existing smoke does not cover the moved path deeply enough.

## Rules

- Do not move save/load ownership while slicing; `/__save-*` stores stay as-is.
- Keep renderer functions pure where possible: input selection + project/editor
  catalog data in, HTML/event bind descriptors out.
- A slice is complete only when the browser smoke still covers select/place,
  transform, undo/redo, save, reload, and Play route boot.

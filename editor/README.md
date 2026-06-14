# Editor

Editor-only modules live here as they are extracted from `src/editor` and the
editor-owned parts of `src/scene/SceneApp.ts`.

Planned boundaries:

- `core`: editor state, selection, command stack, undo/redo.
- `gizmos`: transform gizmo, grid, snap, helper rendering.
- `inspector`: Details panel, property editors, metadata controls.
- `level-design`: placement tools, hierarchy/outliner, authoring workflows.
- `importer`: future raw asset import and thumbnail generation.

Rules:

- Editor modules may depend on engine modules.
- Editor modules must stay behind the dev-only `?editor` dynamic import.
- Editor state must not be serialized into runtime layout files.

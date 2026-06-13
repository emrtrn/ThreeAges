# Session Handoff - 2026-06-13

Use this file to re-establish context in a new chat.

## Current Shape

- `C:\Users\emret\Desktop\3DGameDev` is the reusable Three.js editor/platform.
- `C:\Users\emret\Desktop\home-makeover` is the real Home Makeover game project.
- The editor does not get copied into game projects.
- Game projects are opened through `project.3dgame.json`.
- Active project reference: `projects/active.project-ref.json`.

## Working Launch Paths

- VS Code `Ctrl+Shift+B`: opens Project Browser.
- VS Code task `Open Active Project Editor`: opens the editor for the active project.
- Project Browser URL: `http://127.0.0.1:5173/`
- Editor URL: `http://127.0.0.1:5173/?editor&debug`

## Implemented

- Project Browser / Launcher with Recent Projects, New Project, Open Project, Package Project.
- Windows folder picker Browse buttons for New/Open/Package path fields.
- `studio` CLI:
  - `npm run studio -- new <template> <targetPath>`
  - `npm run studio -- open <projectPath>`
  - `npm run studio -- preview <projectPath>`
  - `npm run studio -- package <projectPath>`
- Templates:
  - `templates/basic-three-project`
  - `templates/home-makeover-like`
- Runtime-only packaging to `builds/<project>-web` with `package-report.json`.
- Architecture contract: `docs/ARCHITECTURE.md`.
- Plugin hook deferral note: `docs/PLUGIN_HOOKS.md`.
- Launch workflow: `docs/LAUNCH_WORKFLOW.md`.

## Home Makeover State

- Active project should normally point to `C:\Users\emret\Desktop\home-makeover\project.3dgame.json`.
- Home Makeover assets are in the game project, not the editor project.
- Content Browser uses `home-makeover/public/assets/catalog.json`.
- Runtime asset loading uses `home-makeover/public/assets/manifest.json`.
- A Content Browser empty-state race was fixed by making `SceneApp.getEditableAssets()` wait for active project loading.

## Next Useful Work

1. Add Scene Outliner.
2. Add undo/redo command stack.
3. Improve Content Browser with previews and placement-rule indicators.
4. Harden project manifest validation and add tests.
5. Add package preview/open-output affordance.

## Validation Already Run

- `npm run build` in `3DGameDev` passed after the folder picker and Content Browser race fix.
- `npm run studio -- package C:\Users\emret\Desktop\home-makeover` passed and produced `builds/home-makeover-web`.

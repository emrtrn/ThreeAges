# MEMORY - 3DGameDev Editor Platform

Last update: 2026-06-13 (project browser/editor platform handoff)

## Active State

- `3DGameDev` is now the reusable Three.js editor, project browser, and packaging tool.
- The real Home Makeover game project now lives at `C:\Users\emret\Desktop\home-makeover`.
- Active platform roadmap: `docs/2026-06-13-editor-platform-roadmap.md`.
- Architecture boundary contract: `docs/ARCHITECTURE.md`.
- Project loading now uses `projects/active.project-ref.json` -> external `project.3dgame.json`, and project files are served through `/__project-file/...`.
- The launcher opens at `/`; the editor opens at `/?editor&debug`.
- CLI: `npm run studio -- new/open/preview/package`.
- Runtime-only packages are written under `builds/<project>-web` with `package-report.json`.
- Project Browser has New/Open/Package actions, Recent Projects, Windows folder-picker Browse buttons, and opens the active project editor.
- Creating a project through `studio new` or Project Browser now automatically sets it as the active project.
- `SceneApp` waits for active project loading before Content Browser asks for editable assets; this fixed the empty Content Browser race.
- `home-makeover` has `public/assets/catalog.json` plus `public/assets/manifest.json`; Content Browser uses catalog metadata, while runtime loading uses the optimized manifest.

## Current Boundaries

- Editor/platform code remains here: Project Browser, editor UI, transform gizmo, Content Browser, Details panel, authoring save flow, launcher scripts, future CLI, templates, and packaging orchestration.
- Game runtime code, GDD, game docs, assets, layouts, asset pipeline, and package config belong in external game project folders.
- Final web packages must be runtime-only.

## Next Steps

1. Harden project-system validation and add tests.
2. Add richer Scene Outliner and undo/redo command implementation.
3. Expand asset catalog UI around placement rules and previews.

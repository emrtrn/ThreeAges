# 3DGameDev Editor Platform

This workspace is the reusable Three.js editor, launcher, and packaging tool for multiple 3D web game projects.

Primary external game project right now:

- `C:\Users\emret\Desktop\home-makeover`

## Role Split

- `3DGameDev` owns editor and launcher code: Project Browser, viewport, transform gizmo, Content Browser, Details panel, save/load authoring flow, future templates, CLI, and packaging orchestration.
- Game projects own game runtime code, GDD, assets, levels/layouts, data, package scripts, and final web output.
- Final packages must not include editor UI, gizmos, launcher code, dev middleware, GDD, source docs, templates, or raw authoring files.

## Current Roadmap

Use `docs/2026-06-13-editor-platform-roadmap.md` as the active roadmap.
Use `docs/ARCHITECTURE.md` as the boundary contract before editor/platform refactors.
Use `docs/LAUNCH_WORKFLOW.md` for the practical VS Code and URL launch path.

## Working Rules

- Keep editor core free of project-specific game rules.
- Keep project runtime free of editor UI imports.
- Prefer manifest/config-driven project data over hardcoded Home Makeover paths.
- Project loading is manifest-driven through `projects/active.project-ref.json` and external `project.3dgame.json` files.
- Do not copy the whole editor app into game projects; use templates and project manifests instead.

## Current Capabilities

- Project Browser opens at `http://127.0.0.1:5173/`.
- Active Project Editor opens at `http://127.0.0.1:5173/?editor&debug`.
- Project Browser can create projects from `templates/basic-three-project` and `templates/home-makeover-like`.
- Project Browser can set/open an active project and package it.
- Browse buttons in Project Browser open a Windows folder picker for target/open/package paths.
- CLI entrypoint: `npm run studio -- new/open/preview/package`.
- Runtime-only package output: `builds/<project>-web` with `package-report.json`.
- Active external project is normally `C:\Users\emret\Desktop\home-makeover`.

## Near-Term Order

1. Add Scene Outliner.
2. Implement undo/redo command stack for editor actions.
3. Improve asset catalog UI with previews and placement-rule affordances.
4. Harden project-system validation and add smoke tests around project switching.
5. Improve package reports and package preview flow.

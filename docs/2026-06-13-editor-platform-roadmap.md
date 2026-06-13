# 3DGameDev Editor Platform Roadmap

> Created: 2026-06-13 | Status: living roadmap
> Scope: turn `3DGameDev` into a reusable Three.js editor/launcher while moving `home-makeover` into its own game project folder.

## Direction

`3DGameDev` is the editor and project launcher. Game projects are separate folders opened by the editor. Final web packages contain only game runtime output, never editor UI or authoring tools.

Core rule:

- Editor code stays in `3DGameDev`.
- Game code, GDD, assets, levels, data, and runtime build config stay in each game project.
- Packaged output is a separate web-ready folder with no GDD, source docs, editor panels, gizmos, launcher code, or dev middleware.

## Accepted Ideas

- Use a `project.3dgame.json` file as the project contract, similar in spirit to Unreal's `.uproject`.
- Keep three modes distinct: Editor Mode, Preview Mode, and Package Mode.
- Drive Content Browser and placement behavior from asset metadata/catalog JSON instead of hardcoded sidebars.
- Add an `ARCHITECTURE.md` contract before deeper refactors so agent work has hard boundaries.
- Add a simple CLI before a full launcher UI: `studio new`, `studio open`, `studio preview`, `studio package`.
- Keep plugin support minimal and later: asset types, panels, tools, runtime hooks. Do not start with node editors, shader graphs, material graphs, or a generic engine scope.
- Consider package boundaries later (`editor-core`, `editor-ui`, `scene-runtime`, `asset-system`, `project-system`, `build-system`, `shared-types`) only after the first project split is proven.

## Project Manifest Draft

```json
{
  "schema": 1,
  "name": "home-makeover",
  "type": "three-game",
  "version": "0.1.0",
  "entry": "src/main.ts",
  "publicDir": "public",
  "editor": {
    "defaultScene": "public/layouts/render-test-room.json",
    "assetCatalog": "public/assets/catalog.json",
    "assetManifest": "public/assets/manifest.json",
    "gridSize": 1,
    "snapRotationDeg": 15
  },
  "scripts": {
    "preview": "npm run dev",
    "build": "npm run build",
    "package": "npm run build"
  },
  "output": {
    "distDir": "dist"
  }
}
```

## Revised Todo List

### Phase 1 - Split Current Project

- [x] Create `C:\Users\emret\Desktop\home-makeover` as the real game project.
- [x] Move Home Makeover GDD, game docs, assets, layouts, runtime source, and game package files into `home-makeover`.
- [x] Keep editor UI, transform gizmo, selection tools, save-layout authoring flow, launcher scripts, and future project browser work in `3DGameDev`.
- [x] Rename `3DGameDev` package identity from `home-makeover` to an editor/platform name.
- [x] Add `project.3dgame.json` to `home-makeover`.
- [x] Add a minimal sample/open-project config in `3DGameDev` that points to the external `home-makeover` folder.
- [x] Verify both folders build or run in their intended role.

Exit criteria: `3DGameDev` can be described as the editor, `home-makeover` can be described as the game, and neither folder needs the other's source identity to be understood.

### Phase 2 - Architecture Contract

- [x] Create `docs/ARCHITECTURE.md` for the editor platform.
- [x] Define hard boundaries: editor core has no game-specific logic; project runtime does not import editor UI; final package excludes editor-only code.
- [x] Define standard file types: project manifest, asset catalog, runtime asset manifest, level/layout JSON, prefab JSON.
- [x] Define the first undo/redo command model for editor actions.
- [x] Define Editor Mode, Preview Mode, and Package Mode responsibilities.

Exit criteria: future Codex/Claude tasks can cite one architecture contract instead of rediscovering boundaries.

### Phase 3 - Project System

- [x] Implement project manifest loading and validation.
- [x] Add project path resolution for external folders.
- [x] Replace hardcoded `render-test-room` paths with manifest-driven scene/layout paths.
- [x] Standardize save/load so editor writes project files through a project-system layer.
- [x] Keep dev middleware editor-only.

Exit criteria: editor opens a project from manifest and saves level/layout data back into that project.

### Phase 4 - Asset Catalog

- [x] Add `public/assets/catalog.json` or equivalent project asset catalog.
- [x] Include metadata fields: id, name, type, category, model path, preview path, placement rules, and optional gameplay tags.
- [x] Generate Content Browser from asset catalog.
- [x] Use placement metadata for floor/wall eligibility, rotation, scaling, snapping, and category filters.
- [x] Keep optimized runtime asset manifest separate from authoring catalog if needed.

Exit criteria: adding an asset to the catalog is enough for the editor to show and place it without sidebar code changes.

### Phase 5 - Templates

- [x] Add `templates/basic-three-project`.
- [x] Add `templates/home-makeover-like` only after the real `home-makeover` split proves the shared shape.
- [x] Use `project.template.json` with replaceable project name and paths.
- [x] Include only starter runtime, starter assets/data, and starter docs in templates; never include editor app source.

Exit criteria: a new project can be created from a template without copying editor code.

### Phase 6 - CLI First

- [x] Add a small `studio` CLI or npm script wrapper.
- [x] Implement `studio new <template> <targetPath>`.
- [x] Implement `studio open <projectPath>`.
- [x] Implement `studio preview <projectPath>`.
- [x] Implement `studio package <projectPath>`.

Exit criteria: VS Code workflow can create, open, preview, and package a project without a launcher UI.

### Phase 7 - Launcher UI

- [x] Add Unreal Project Browser-like start screen.
- [x] Add Recent Projects.
- [x] Add New Project from template.
- [x] Add Open Project by selecting a manifest or folder.
- [x] Add Package Project action that calls the same packaging path as the CLI.

Exit criteria: launcher is a UI over the same project-system and CLI/build behavior, not a separate implementation.

### Phase 8 - Runtime-Only Packaging

- [x] Define package output folder convention.
- [x] Build only runtime entry and runtime assets.
- [x] Exclude editor UI, project browser, gizmos, details panels, authoring middleware, GDD, source docs, templates, raw assets, and development scripts.
- [x] Add a package report: included files, skipped files, package size, warnings.
- [x] Add a smoke check for packaged output.

Exit criteria: packaged output is directly uploadable to a static web host and contains no editor-only code.

### Phase 9 - Minimal Plugin Hooks Later

- [x] Document that plugin registration starts only after at least one non-Home-Makeover project needs it.
- [x] Define the first allowed hook types: asset type registration, custom panels, custom tools, and runtime hooks.
- [x] Keep plugin API small and documented.
- [x] Document broad engine features to avoid until a real project needs them.

Exit criteria for now: plugin implementation is intentionally deferred, and the future hook surface is documented without turning the platform into a general-purpose engine.

## Not Doing Now

- Full pnpm/Turborepo migration.
- Node editor.
- Shader graph or material graph.
- Physics editor.
- General-purpose Unity/Unreal replacement scope.
- Copying the whole editor into every game project.

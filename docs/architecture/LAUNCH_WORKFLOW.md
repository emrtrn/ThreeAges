# Launch Workflow

Single codebase: one dev server, one app, two routes.

## URLs

- **Game:** `http://127.0.0.1:5173/`
- **Editor:** `http://127.0.0.1:5173/?editor` (add `&debug` for the perf overlay)

Start the dev server with `npm run dev` (LAN) or `npm run dev:local`
(`127.0.0.1:5173`, strict port).

## Play / Test (one server)

The game and the editor are the **same app** rendered by the same `SceneApp`, so
there is no second server to run. In the editor, **P** (or the toolbar **Play**
button) saves the current layout and opens the game route (`/`) in a new tab — the
game loads the layout you just saved, so you test exactly what you authored.

(A project can still point Play at an external runtime by setting
`editor.previewUrl` in `public/project.3dgame.json`; absent, Play opens `/`.)

## Authoring data

The editor reads and writes this repo's own `public/`:

- Layout: `public/<editor.defaultScene>` (e.g. `public/layouts/render-test-room.json`)
- Assets: `public/assets/manifest.json` + `public/assets/models/...`
- Manifest: `public/project.3dgame.json`

Saving is a localhost-only dev endpoint (`/__save-layout`); it does not exist in
the production build.

## Packaging

`npm run build` produces the game in `dist/`. The editor is a separate chunk that
the default (game) route never loads, and the dev middleware is dev-only — so the
package contains no editor UI or authoring server.

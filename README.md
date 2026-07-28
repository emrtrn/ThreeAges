# Forge

**Forge** is a general-purpose, reusable [Three.js](https://threejs.org/) **game
template** with a built-in editor mode. The editor is not a separate tool — it is
a dev-only mode of the same runtime (`?editor`), so every game you build from
Forge ships its own authoring environment during development and a clean,
runtime-only bundle in production. Forge is not tied to any single game: each
concrete game is a **fork** of this template that swaps in its own data, assets,
and rules while pulling engine/editor improvements back from upstream.

## Proven vertical

The end-to-end path that is wired and tested today is a **single-player,
third-person 3D web game**:

- Game framework: Game Mode / PlayerController / PlayerState / Pawn.
- Character movement (walk / jump / slopes / step-up-down / moving platforms) and
  a spring-arm follow camera.
- Level travel between layouts, slot-based save/load
  ([save-game contract](docs/architecture/SAVE_GAME_CONTRACT.md)), and kill-Z
  respawn.
- Boot / loading UX, plus a win/lose + restart game-rules layer.

Other single-player 3D genres are feasible on the same generic core (a free-fly
camera mode also ships), but only the third-person vertical is proven end to end.

## Modes (routes)

Run the dev server, then open:

- **Game Mode** — `http://127.0.0.1:5173/` — runtime render, no editor UI.
- **Editor Mode** — `http://127.0.0.1:5173/?editor` — the same runtime plus the
  editor UI (viewport gizmos, outliner, details, content browser, undo/redo,
  Play). Dev-only; excluded from production builds.
- Add `?debug` to either route for the performance overlay.

## Quick start

```bash
npm install
npm run dev          # dev server (Game Mode + Editor Mode)
npm run build        # production build → dist/ (runtime only, no editor)
npm run build:verify # tsc + build + engine tests + strict dist scan
```

After editing TypeScript, run `npx tsc --noEmit` — the dev server does not
type-check.

## Browser performance capture

`npm run perf:browser` runs a repeatable Chromium capture against the game. It
writes a readable JSON summary and a raw Chrome DevTools Performance trace under
`test-results/browser-perf/`. The default is an *idle, warmed-runtime* baseline;
it does not replace a gameplay stress scenario.

```bash
npm run perf:browser
# Measure an RTS match instead (the runner starts the match automatically).
$env:PERF_URL = "http://127.0.0.1:4174/?rts&debug"; npm run perf:browser
# Measure a production preview or another already-running target.
$env:PERF_URL = "http://127.0.0.1:4173/?debug"; npm run perf:browser
# Optional CI gate: fail only when P95 exceeds this frame-time budget.
$env:PERF_MAX_P95_MS = "33.3"; npm run perf:browser
# For a hardware/GPU investigation, show Chromium instead of using headless mode.
$env:PERF_HEADLESS = "false"; npm run perf:browser
```

Open the reported `*.trace.json` file in Chrome DevTools â†’ Performance â†’ Load
profile. Keep the browser, viewport and scenario fixed when comparing runs.
Headless captures are repeatable CI evidence, but only same-machine, visible
browser captures are suitable for player-facing GPU performance conclusions.

### RTS quality matrix

`npm run perf:rts` exercises the same RTS match under Low, Medium, High and
Medium-with-adaptive-quality. Every row uses a fixed WASD pan plus wheel-zoom
sequence after warm-up, then records frame pacing, Chrome main-thread counters,
draw calls, triangles, GPU resource counts and adaptive-reduction depth. It
writes a JSON data file, a short Markdown comparison and one DevTools trace per
profile under `test-results/rts-perf/`.

```bash
npm run perf:rts
# Fast local check: five seconds per quality row.
$env:RTS_PERF_DURATION_MS = "5000"; npm run perf:rts
# Increase shader/asset warm-up independently when examining first-load effects.
$env:RTS_PERF_WARMUP_MS = "10000"; npm run perf:rts
# Run only the sustained-load adaptive row while investigating a reduction.
$env:RTS_PERF_PROFILES = "adaptive"; npm run perf:rts
# Optional CI gate: fail if any row exceeds the P95 budget.
$env:RTS_PERF_MAX_P95_MS = "33.3"; npm run perf:rts
# Visible Chromium is required for player-facing GPU conclusions.
$env:RTS_PERF_HEADLESS = "false"; npm run perf:rts
```

The adaptive row reports whether a real sustained bottleneck caused a temporary
reduction; it does not manufacture load merely to force a reduction. Keep the
browser, viewport, map and duration fixed when comparing report files.

## Product envelope

- **Primary target:** desktop browser; keyboard + mouse (pointer-look) is the
  first-class input path.
- **Secondary input (works, not first-class):** gamepad and touch /
  virtual-joystick.
- **Deliberate non-goals** (out of scope by design, not backlog): networked
  multiplayer / replication, VR / AR (WebXR), 2D / sprite engines, and native
  mobile packaging.

The full boundary contract and product envelope live in
[`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md).

## Making a game from Forge

A game is a **fork** of this repository, not a throwaway copy. The fork keeps all
game-specific code and data confined to `public/` + `src/game`, sets `upstream`
to Forge, and pulls platform improvements with
`git fetch upstream && git merge upstream/main`. See
[`docs/planned/GAME_FORK_WORKFLOW.md`](docs/planned/GAME_FORK_WORKFLOW.md) for the
full fork/sync workflow.

## Documentation

- [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md) —
  boundary contract, ownership rules, product envelope.
- [`docs/architecture/LAUNCH_WORKFLOW.md`](docs/architecture/LAUNCH_WORKFLOW.md) —
  practical VS Code and URL launch paths.
- [`docs/architecture/UNREAL_BASICS_LESSONS.md`](docs/architecture/UNREAL_BASICS_LESSONS.md) —
  the roadmap plus the Unreal-derived architecture lessons.
- [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — agent working rules for
  this repo.

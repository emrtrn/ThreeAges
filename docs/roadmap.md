# 3DGameDev Roadmap

This workspace is a reusable Three.js single-codebase game template. The editor
is a built-in development route (`/?editor`), not a separate launcher or
external-project platform.

## Current Direction

- Keep one `SceneApp` for both Game Mode (`/`) and Editor Mode (`/?editor`).
- Keep project data local under `public/`.
- Keep editor code behind the dev-only dynamic import so production builds stay
  runtime-only.
- Use `npm run build` as the package path and verify `dist/` contains no editor
  UI or authoring middleware.

## Near-Term Order

1. Add smoke tests around manifest/layout loading and the game/editor route
   split.
2. Continue reducing editor-only code in the default game chunk.
3. Improve Content Browser previews and placement-rule affordances.
4. Expand schema-driven Details panel coverage.
5. Later: migrate `home-makeover` onto a copy of this template.

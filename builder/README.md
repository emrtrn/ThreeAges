# Builder

Build and package verification modules live here.

Planned boundaries:

- `web`: runtime-only web build checks, production package validation, and
  future cook/manifest generation.

Rules:

- Production output must contain runtime game files only.
- Editor UI, authoring middleware, docs, raw authoring assets, and local dev
  scripts must not be required by the packaged game.
- Build checks should report regressions without changing source files.

# Project

**Project ownership lives in `public/` (data) and `src/project` (manifest/path
helpers), not here.** This top-level `project/` is a **reserved placeholder**;
the `@project/*` path alias points here and is currently unused. Keeping live
project files in `public/` (loaded through `src/project`) avoids a disruptive
move that every downstream fork would have to merge.

Current state:

- `public/project.3dgame.json` is the active manifest.
- `public/layouts/` stores active layout JSON.
- `public/assets/` stores active runtime assets and manifests.
- `src/project/` holds the loader / public-path helpers (`ProjectSystem`,
  content/asset tree).

Rules:

- Do not move live project files out of `public/` until loaders, save
  middleware, and build output are migrated together.
- Project files must remain hand-readable and serializable.
- Runtime references should use manifest-relative paths or asset IDs, not
  absolute filesystem paths.

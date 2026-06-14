# Project

Project configuration and authoring data will move here when the project data
boundary is migrated from `public/`.

Current state:

- `public/project.3dgame.json` is still the active manifest.
- `public/layouts/` still stores active layout JSON.
- `public/assets/` still stores active runtime assets and manifests.

Rules:

- Do not move live project files out of `public/` until loaders, save
  middleware, and build output are migrated together.
- Project files must remain hand-readable and serializable.
- Runtime references should use manifest-relative paths or asset IDs, not
  absolute filesystem paths.

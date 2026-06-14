# Game

Project-specific runtime code will live here once the template has a separated
game layer.

For now, gameplay is still mixed into the current single-codebase prototype.
Move code here only when the ownership is clear and the build remains green.

Rules:

- Game code may depend on engine modules.
- Game code must not import editor modules.
- Game rules, scoring, missions, save data, and runtime UI belong here or in
  project data, not in generic engine/editor modules.

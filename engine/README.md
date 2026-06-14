# Engine

Runtime engine modules live here as they are extracted from the current
single-codebase prototype.

Planned boundaries:

- `core`: lifecycle, events, time, logging, subsystem contracts.
- `scene`: serializable scene/entity/component data and layout contracts.
- `render-three`: Three.js renderer adapter and runtime render binding.
- `assets`: asset IDs, manifests, dependencies, and runtime lookup.
- `input`: input actions, contexts, and device adapters.
- `audio`: Web Audio-backed runtime audio system.
- `physics-rapier`: Rapier-backed physics adapter.
- `scripting`: TypeScript behavior/runtime script layer.

Rules:

- Engine modules must not import `editor/*`.
- Generic engine data must not store Three.js, DOM, or Rapier runtime objects.
- Game/runtime code talks to engine interfaces, not editor implementation.

# Engine AI

Generic, DOM-free AI decision layer for the engine spine (Unreal-inspired
AIController / Blackboard / Behavior Tree, adapted to Forge — see
`docs/planned/AI_SYSTEM_RESEARCH_AND_PLAN.md`).

Current files:

- `blackboard.ts`: a per-agent typed key/value memory (`UBlackboardComponent`).
  Keys are declared up front; writes are validated against each key's kind and
  are never serialized to the layout (runtime state only).
- `aiController.ts`: the runtime brain that possesses one NPC pawn
  (`AAIController`) — pawn id, blackboard, current goal, debug snapshot. The
  per-frame decision tick (Behavior Tree runner) lands in Faz 2.
- `aiSubsystem.ts`: a `Subsystem` that derives one `AIController` per entity
  carrying an `AIController` component, ticks them, exposes a debug snapshot, and
  carries a `setEnabled` Play-mode gate.
- `behaviorAsset.ts`: authored `*.blackboard.json` and `*.behavior.json`
  schemas/normalizers. Save validators and future runtime loaders share this
  module so editor saves and runtime execution agree on the canonical shape.
- `behaviorRunner.ts`: runtime Behavior Tree runner plus built-in task/service
  registries. `forge.updatePerceptionBlackboard` bridges sensed sight/hearing
  and gameplay-script stimuli into declared Blackboard keys.
- `../perception/perception.ts`: pure sight/hearing/gameplay-stimulus contracts
  used by `AISubsystem` to keep per-controller sensed-target debug state.

## engine/behavior vs engine/ai

Both tick entities derived from the scene, but they own different altitudes:

- `engine/behavior` (`BehaviorSubsystem`) runs **small per-actor scripts** —
  begin/tick/overlap/hit/message handlers that mutate a transform or emit a
  script message. Cheap, stateless-ish, one function per event binding.
- `engine/ai` (`AISubsystem`) runs **long-lived NPC decision-making** — goal
  selection, memory (blackboard), and (Faz 2+) a Behavior Tree, perception, and
  path following. One controller per possessed pawn, with its own memory.

AI tasks reach game actions through the existing `ScriptMessageBus`
(`emitScriptMessage` / `subscribeScriptMessage`); there is no separate AI bus.
Runtime hosts also bridge selected script messages (`Damage.*`, `alert`,
`ui-action`, `game-event`) back into AI perception as one-tick stimuli, so
Behavior Tree services can react without polling game-specific state.

Rules:

- No Three.js, DOM, Rapier, or editor imports here.
- Project-specific AI actions (attack, patrol, flee, …) are game content and live
  in a runtime location (`src/game/ai/`), not here.
- Value imports use relative paths so the engine-test bundler (which resolves no
  path aliases) can bundle this folder.
- AI runtime state (blackboard values, active node, perception) is never written
  back to the layout; it is a debug-inspect / save-game concern only.

# Damage Convention (`Damage.Apply`)

> Status: `src/game` convention (A6). This is **not** an engine feature — the
> engine has no health/damage model. It is a message contract plus two reusable
> template behaviors that a concrete project (fork) binds to and extends.
> Mirrors Unreal's `Apply Damage` → `Event AnyDamage` pattern with Forge's
> data-driven Actor Script message bindings.

Forge's actor scripts already route gameplay through the script message bus
(`context.messages.send/emit`, Message Bindings). Damage is just a **named
message with a standard payload** on top of that bus, so it needs no new engine
surface — any actor can deal or take damage by sending/binding one message type.

## The message

**Type:** `Damage.Apply` — sent to a specific target actor (Message Binding
`target: "self"` on the receiver).

**Payload:**

| Field | Type | Meaning |
| --- | --- | --- |
| `amount` | `number` | Damage points to subtract. `<= 0` is ignored. |
| `instigator` | `EntityRef?` | Who caused it. Defaults to the message `source`, then the receiver itself. |
| `damageType` | `string?` | Optional category (`"fire"`, `"fall"`, …) a fork can branch on. |

**Deal damage from any behavior:**

```ts
context.messages.send(targetEntityId, "Damage.Apply", {
  amount: 25,
  instigator: context.entityId,
  damageType: "fire",
});
```

## Template behaviors (`src/game/behaviors.ts`)

### `apply-damage` — the receiver (Unreal `Event AnyDamage`)

Bind it to the `Damage.Apply` message (`target: "self"`). It tracks health in
`ScriptState`, subtracts the incoming `amount`, and re-broadcasts the result.

Params:

| Param | Default | Meaning |
| --- | --- | --- |
| `maxHealth` | `100` | Starting health (the ScriptState `health` seed). |
| `persistHealth` | `false` | Persist `health` into the save-game snapshot. |
| `destroyOnDeath` | `false` | `context.actor.destroy()` the actor when health hits 0. |

Emits:

- `Health.Changed` — `{ entityId, health, maxHealth, delta, instigator }` every
  time damage lands. A fork's HUD / health bar binds to this.
- `Damage.Died` — `{ entityId, instigator }` once, when health reaches 0. A fork
  binds this to score, ragdoll, respawn, loot, etc.

Further damage after death is ignored (health stays 0, no repeat `Damage.Died`).

### `damage-zone` — a sender (hazard / projectile)

Bind it to the actor's `overlap` (sensor) or `hit` (blocking) event. On a begin
edge it routes `params.damage` to the touched actor via `Damage.Apply`, tagging
itself as the instigator.

Params:

| Param | Default | Meaning |
| --- | --- | --- |
| `damage` | `10` | Damage points to deal per contact. |
| `damageType` | — | Optional category forwarded in the payload. |
| `once` | `false` | One-shot per victim (projectile). Off = re-applies on every fresh contact (walk-in spikes). |

## What stays in the fork

The engine and this convention deliberately own no project rules. A concrete
game:

- Chooses starting health / resistances via the binding `params` (or its own
  receiver behavior).
- Binds `Health.Changed` / `Damage.Died` to its HUD, scoring, death flow.
- May replace `apply-damage` with a richer receiver (armor, damage types,
  team checks) — the `Damage.Apply` payload contract is the only thing to keep
  stable so senders and receivers stay interoperable.

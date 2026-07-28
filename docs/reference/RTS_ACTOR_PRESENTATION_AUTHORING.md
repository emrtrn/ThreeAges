# RTS Actor Presentation Authoring

How a building or unit gets its look in the RTS. There is one path: the Content
Catalog names an Actor Script, the Actor names manifest assets, and the runtime
builds a component tree from that. No code-side art table exists any more, so
changing a model never means editing TypeScript.

## The three files

| File | Owns |
| --- | --- |
| `public/game-data/content/rts-content.json` | gameplay id → Actor reference |
| `public/assets/ThreeAges/Actors/**/*.actor.json` | the component tree: which meshes, where |
| `public/assets/manifest.json` | `assetId` → model file on disk |

Balance data (`public/game-data/balance/*.json`) stays out of this entirely.
Cost, health, footprint, build time and production rules are never read from an
Actor, and an Actor never changes them.

## Catalog entry

```json
"barracks": {
  "levels": {
    "1": "assets/.../BP_RTS_Barracks_FirstAge_T1.actor.json",
    "2": "assets/.../BP_RTS_Barracks_FirstAge_T2.actor.json",
    "3": "assets/.../BP_RTS_Barracks_FirstAge_T3.actor.json"
  },
  "ages": {
    "settlement": { "1": "...FirstAge_T1...", "2": "...", "3": "..." },
    "town":       { "1": "...SecondAge_T1...", "2": "...", "3": "..." }
  }
}
```

- `ages` is looked up first, `levels` is the age-agnostic fallback. A building
  whose art does not change with the age can author `levels` alone — the resource
  camps ship one model each and map every level to it.
- `constructionActorRef` is optional and no building currently authors one.
  Without it a site shows the very building being raised (the completed Actor for
  the same age and level), drawn translucent by the caller. Author one only when
  the scaffold is genuinely different art — and note that it is a *single* Actor
  for every age and level, so a scaffold that just re-points at one tier's mesh
  will freeze every site at that tier.
- The level ceiling comes from age balance (`1 + levelUpgrades.length`), not from
  the art pack. Adding a fourth level to an age fails the coverage test until its
  Actors exist.

Every playable identity must be mapped. There is no silent fallback: an id the
catalog cannot answer for renders as a magenta stand-in, and the count is
published on the canvas (`data-rts-content-placeholders`) and in the `?debug`
overlay.

## Actor file

```json
{
  "schema": 1,
  "type": "actor",
  "name": "BP_RTS_Farm_SecondAge_T2",
  "parentClass": "actor",
  "variables": [],
  "components": [
    { "id": "root", "component": "Transform", "props": {} },
    {
      "id": "field",
      "component": "StaticMeshComponent",
      "parent": "root",
      "props": { "assetId": "farm-secondage-level2" }
    },
    {
      "id": "wheat",
      "component": "StaticMeshComponent",
      "parent": "root",
      "props": { "assetId": "farm-secondage-level2-wheat" }
    }
  ],
  "interfaces": [], "references": [], "dispatchers": [],
  "eventBindings": [], "messageBindings": [], "construction": null
}
```

### Multiple meshes

Add another mesh component. Each one becomes its own node in the runtime tree, so
two `StaticMeshComponent`s are two models — not one replacing the other. This is
the normal way to build a piece of art out of shipped assets (a field plus its
crop, a building plus its crates).

A second component with **no** `position` is drawn at its parent's origin. If the
two models were exported around the same origin that is exactly right and they
line up on their own; if they were not, give the second one a local offset rather
than expecting the fit to sort it out.

### Local transforms

`props` accepts `position` ([x, y, z] in metres), `rotation` ([x, y, z] in
**degrees**) and `scale` ([x, y, z]). They are local to the component's `parent`.

```json
{ "id": "pivot", "component": "Transform", "parent": "root",
  "props": { "position": [1.5, 0, 0], "rotation": [0, 90, 0] } },
{ "id": "crates", "component": "StaticMeshComponent", "parent": "pivot",
  "props": { "assetId": "crate-big-stack2", "position": [0, 0.4, 0] } }
```

A bare `Transform` is kept as a real node, so grouping several meshes under one
and moving that node moves them together.

Two things to know before you tune numbers:

- **The whole Actor is fitted to the gameplay footprint.** The runtime measures
  the bounds of the entire tree, scales the root so the widest axis fills 86% of
  the footprint, and lifts it so the bottom sits on the foundation (y = 0.18).
  Only the root is scaled, so your local offsets keep their proportions — a crate
  1.5 m from the field's centre stays 1.5 m from it in the model's own terms.
  Do not compensate for the fit by hand; author at the model's natural scale.
- **Coplanar faces z-fight.** Two meshes sharing a surface (a floor slab and a
  deck laid exactly on it) will flicker. Give one a small deliberate offset —
  a centimetre is enough — or merge them in the source asset.

### Units

Unit Actors use `SkeletalMeshComponent` and may declare a `selectionRadius`
variable, which is what the selection ring reads:

```json
"variables": [
  { "key": "selectionRadius", "label": "Selection Radius", "type": "number",
    "min": 0.1, "max": 4, "step": 0.1, "default": 0.5 }
]
```

Units that have no authored Actor keep their role-shaped code silhouette. That is
a deliberate, listed exception, not a gap to fill with the nearest character
mesh — three roles sharing one model reads worse than three distinct silhouettes.

## Rules the validator enforces

A pack that breaks any of these fails `npm run test:engine` *and* refuses to load
at runtime (that one Actor becomes a stand-in; the rest of the pack is
unaffected). The error always names the reference and the component.

- Every mesh component has a non-empty `assetId`.
- The `assetId` is in the manifest, and its type matches the component:
  `StaticMeshComponent` → `staticMesh`, `SkeletalMeshComponent` → `skeletalMesh`.
- Component ids are unique within the Actor. A duplicate would silently drop one
  of the two meshes.
- Every `parent` names an existing component, and the parent chain has no cycle.
- An Actor referenced by the catalog has at least one mesh component.

## Adding a model: the whole loop

1. Put the file under `public/assets/` and add a manifest row for it (`id`,
   `assetType`, `path`, `runtime.bytes`).
2. Write or edit the `.actor.json`.
3. Point the catalog entry at it.
4. `npx tsc --noEmit && npm run test:engine && npm run check:assets`.
5. For anything that changes what reaches the screen, also
   `npx playwright test tests/smoke/rts-assetization-baseline.spec.ts`.

Open `/?rts&debug` and read the `sunum:` line in the overlay — it reports how many
Actors loaded out of how many were asked for, and names anything standing in.

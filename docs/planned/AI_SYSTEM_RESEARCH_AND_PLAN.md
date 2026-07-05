# AI Sistemi Arastirmasi ve Forge Plani

> Tarih: 2026-06-29
> Revizyon: 2026-07-02 — plan koda karsi dogrulandi; save-path detaylari,
> CharacterMovement AI girisi, editor Play modu, asset manifest ve dialogue
> entegrasyonu duzeltildi/eklendi (bkz. "Revizyon notlari").
> Revizyon: 2026-07-04 — Faz 0 + Faz 1 uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-05 - Faz 2 asset schema/save/manifest altyapi dilimi
> uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-05 - Faz 2 runtime runner + temel task/decorator dilimi
> uygulandi (bkz. asagidaki checkbox'lar).
> Durum: Faz 1 uygulandi; Faz 2'nin asset altyapisi ve runtime runner dilimi
> tamamlandi. Son tam gate yesil (`tsc`, `test:engine` 607 check,
> `build:verify`, `check:assets`). Faz 2 editor form ve gelismis
> service/decorator isleri planli.
> Amac: Unreal Engine AI dokumanlarindaki temel sistemi inceleyip Forge icin
> uygulanabilir, data-driven ve editor/runtime sinirlarina uygun bir AI mimarisi
> tanimlamak.

## Kaynaklar

Bu dokuman resmi Unreal Engine dokumanlarina gore hazirlandi:

- Artificial Intelligence:
  <https://dev.epicgames.com/documentation/unreal-engine/artificial-intelligence-in-unreal-engine>
- AI Controllers:
  <https://dev.epicgames.com/documentation/unreal-engine/ai-controllers-in-unreal-engine>
- Behavior Trees:
  <https://dev.epicgames.com/documentation/unreal-engine/behavior-trees-in-unreal-engine>
- Behavior Tree Overview:
  <https://dev.epicgames.com/documentation/unreal-engine/behavior-tree-in-unreal-engine---overview>
- Behavior Tree Node Reference:
  <https://dev.epicgames.com/documentation/unreal-engine/behavior-tree-node-reference-in-unreal-engine>
- AI Perception:
  <https://dev.epicgames.com/documentation/unreal-engine/ai-perception-in-unreal-engine>
- Environment Query System:
  <https://dev.epicgames.com/documentation/unreal-engine/environment-query-system-overview-in-unreal-engine>
- Navigation System:
  <https://dev.epicgames.com/documentation/unreal-engine/navigation-system-in-unreal-engine>
- State Tree:
  <https://dev.epicgames.com/documentation/unreal-engine/state-tree-in-unreal-engine>
- Smart Objects:
  <https://dev.epicgames.com/documentation/unreal-engine/smart-objects-in-unreal-engine>

## Unreal AI sisteminin ozeti

Unreal tarafinda AI tek bir "zeka" sinifi degil, birkac katmanin beraber calismasi:

| Unreal kavrami | Ne is yapar | Forge karsiligi |
| --- | --- | --- |
| AIController | PlayerController gibi Pawn/Character possess eder; insan inputu yerine cevre ve oyun durumuna gore karar verir. | Runtime-only `AIController` session/instance. NPC pawn'ini possess eder, input yerine karar cikisi uretir. (`src/game/playerController.ts` icindeki `possess()`/`unpossess()` modelinin AI paraleli.) |
| Blackboard | Behavior Tree ve servislerin okudugu/yazdigi ajan hafizasi. | Agent basina typed `AiBlackboardState`; serialize edilen asset semasi ayridir, runtime degerleri layout'a yazilmaz. |
| Behavior Tree | Karar akisidir. Unreal'da event-driven calisir; Decorator/Service/Task ayrimi vardir. | Ilk versiyonda JSON asset + TypeScript task/action registry. Visual graph sonra. |
| Decorator | Dal calisabilir mi kararini verir. | Saf predicate: blackboard/world/perception/query okur. |
| Service | Dal aktifken periyodik check ve Blackboard update yapar. | Throttled evaluator: gorus, hedef mesafe, EQS sonucu, cooldown gibi verileri gunceller. |
| Task | Yapilacak eylem: move, wait, attack, set blackboard, send message. | `AiTask` registry. Hareket icin CharacterMovement/Nav, oyun eylemi icin `BehaviorContext.messages`. |
| AI Perception | Sight, hearing, damage gibi stimulus kaynaklarini dinler ve AI'ya veri verir. | `AiPerceptionSubsystem`: vision cone/raycast, hearing event, damage/gameplay stimulus. |
| EQS | Ortamdan aday nokta/actor toplar, testlerle skorlar, en uygun item'i dondurur. | `AiQuerySubsystem`: grid/ring/actor/tag generator + distance/visibility/nav-reachable tests. |
| Navigation System | Collision'dan nav mesh/graph uretir; ajanlar pathfinding ve avoidance kullanir. | Ilk etapta nav grid/waypoint graph; sonra Recast/Detour veya navmesh adapter. |
| StateTree | State machine + selector + evaluator + task tabanli daha genel AI akisi. | Behavior Tree'den sonra "AiStateTree" olarak boss/quest/civilian gibi uzun omurlu state mantigi. |
| Smart Objects | Level'a yerlestirilmis, ajanlarin query edip rezerve edebildigi kullanilabilir aktiviteler. | `SmartObjectComponent`: slot, tag, claim/release, interaction task. |

## Forge mevcut durum

- Runtime/editor ayrimi zaten net: `/` `RuntimeSceneApp`, `/?editor` `SceneApp`.
  AI runtime kodu editor import etmemeli. Dikkat: **iki host da** gameplay
  subsystem'lerini kurar — `SceneApp` editor Play modu icin `BehaviorSubsystem`
  olusturur ve edit modda `setEnabled(false)` ile kapatir. AI subsystem ayni
  cift-host modelini izlemelidir; sadece `RuntimeSceneApp`'e baglamak editor
  Play'de AI'yi olu birakir.
- `BehaviorSubsystem` (`engine/behavior/behaviorSubsystem.ts`) mevcut ve
  actor'leri `BehaviorComponent` uzerinden tick ediyor. `BehaviorContext`
  icinde `messages`, `world`, `state`, `physics`, `audio`,
  `interactionComponent` gibi AI davranislari icin kullanilabilir yuzeyler var.
  Ayrica `ScriptMessageBus` non-behavior runtime kaynaklarina acik:
  `emitScriptMessage()` / `subscribeScriptMessage()` — perception/damage
  koprusu icin hazir giris noktasi. (Uyari: `clear()` scene teardown'da tum
  abonelikleri dusurur; rebuild sonrasi yeniden abone olunmali.)
- Actor Script sistemi Unreal Actor Blueprint benzeri: parent class
  (`actor|pawn|character|playerController|gameMode` — henuz `aiController`
  yok), component template (`ACTOR_COMPONENT_KINDS`), event binding,
  reference/interface/message binding tasiyor (`engine/scene/actorScript.ts`).
- Game Mode, PlayerController, Pawn/Character ve CharacterMovement hatti artik
  runtime tarafinda birinci sinif. AIController bu hattin dogal devamidir.
- **Kritik kisit:** `CharacterMovementSubsystem`
  (`src/game/characterMovementSystem.ts`) bugun yalnizca possess edilmis
  pawn'i tick eder (`isPlayerControlled` filtresi) ve hareket girisini dogrudan
  global `ActionMap`'ten okur (`actions.held("move-forward")` vb.). AI suruslu
  bir pawn su an CharacterMovement tarafindan **hic tick edilmez**. Faz 3'ten
  once ajan-basina move-intent saglayan bir input-provider refactoru sart.
- `RuntimeSceneApp` input, physics, characterMovement, behavior, audio,
  dialogue, animation ve UI subsystem orkestrasyonunu zaten yapiyor
  (constructor + `registerSubsystem` + scene build sonrasi `setEntities`).
  AI sisteminin runtime insertion point'i burasi olmalidir, editor tarafina
  karar mantigi konmamalidir.
- Dialogue/Conversation sistemi tamam (`engine/dialogue/`: `DialogueSubsystem`,
  `ConversationRunner`, `ConversationDirector`). NPC AI ile dogal temas
  noktasi: bir Behavior Tree task'i konusma baslatabilir, konusma durumu
  blackboard'a yazilabilir.
- `?debug` overlay'inin kurulu bir deseni var (`src/scene/debugStats.ts`):
  host uzerinde `get*DebugSnapshot()` getter + DOM'suz, unit-test edilebilir
  `format*Debug()` formatter. AI debug ayni deseni izlemeli
  (`getAiDebugSnapshot` + `formatAiDebug`).
- Engine test harness'i (`tools/engine-tests.ts`, `npm run test:engine`) path
  alias cozmez: `engine/ai/*` dosyalarindaki **value importlar relative**
  olmali (mevcut `engine/behavior` basligindaki kuralin aynisi).
- Mevcut `BehaviorSubsystem`, kucuk script davranislari icin yeterli; fakat uzun
  omurlu NPC karari, hedef secimi, path takip, algi hafizasi ve debug icin ayri
  bir `AISubsystem` gerekir.

## Forge icin temel mimari karari

Forge AI sistemi Unreal'i birebir kopyalamamali. Dogru yaklasim:

- Data asset'ler Unreal ilhamli olsun: `*.blackboard.json`, `*.behavior.json`,
  ileride `*.stateTree.json`, `*.eqs.json`.
- Runtime generic engine katmani DOM/Three/editor bagimsiz olsun:
  `engine/ai/*`, `engine/navigation/*`, `engine/perception/*` gibi.
- Oyun-spesifik eylemler `src/game/ai/*` veya `src/game/scripts/*` altinda
  TypeScript olarak yazilsin; editor sadece bu asset ve parametreleri author etsin.
- Ilk fazda visual node editor yazilmasin. Once asset schema, runtime execution,
  debug snapshot ve basit editor form/paneli gelsin.
- AI debug verisi kayda yazilmasin. Blackboard runtime degerleri, active tree node,
  perception stimuli, path ve query sonuclari debug overlay/editor inspect olarak
  gosterilsin.

## Onerilen dosya ve sorumluluk bolumu

| Alan | Oneri |
| --- | --- |
| `engine/ai/` | AIController, Blackboard, BehaviorTree runner, node contracts, asset normalizer, debug snapshot. Value importlar relative (engine-test bundler alias cozmez). |
| `engine/perception/` | Generic stimulus, sight/hearing/damage perception, listener/source index. |
| `engine/navigation/` | Nav agent, path request/result, grid/graph pathfinding, avoidance adapter. |
| `engine/query/` veya `engine/ai/eqs*` | EQS benzeri generator/test/score runner. |
| `src/game/ai/` | Project task registry: attack, patrol, flee, use smart object, send game messages. |
| `src/editor/` | AI asset editors, visualizers, debug panels. Editor runtime kodunu import etmez. |
| `engine/assets/manifest.ts` | Yeni `AssetType` degerleri (`behaviorTree`, `blackboard`, ileride `stateTree`, `eqsQuery`) + compound extension eslemesi. |
| `tools/saveValidator.ts` + `vite.config.ts` | Yeni AI sidecar save endpointleri (`/__save-behavior` vb.), `WRITE_ENDPOINTS` listesi, `validateSave*Payload` fonksiyonlari — engine normalizer'i yeniden kullanarak (soundCue/dialogue/actor pattern'i). |

## Veri modeli taslagi

### Blackboard asset

```json
{
  "schema": 1,
  "type": "blackboard",
  "keys": [
    { "key": "target", "kind": "entity", "default": null },
    { "key": "lastKnownTargetPosition", "kind": "vec3", "default": null },
    { "key": "hasLineOfSight", "kind": "boolean", "default": false },
    { "key": "patrolPoint", "kind": "vec3", "default": null }
  ]
}
```

### Behavior tree asset

```json
{
  "schema": 1,
  "type": "behaviorTree",
  "blackboard": "assets/AI/Enemy.blackboard.json",
  "root": {
    "kind": "selector",
    "children": [
      {
        "kind": "sequence",
        "decorators": [{ "kind": "blackboard", "key": "hasLineOfSight", "op": "equals", "value": true }],
        "children": [
          { "kind": "task", "task": "forge.moveToBlackboard", "params": { "key": "target" } },
          { "kind": "task", "task": "game.attackTarget" }
        ]
      },
      { "kind": "task", "task": "game.patrol" }
    ]
  }
}
```

### AI Controller component / class

Ilk uygulanabilir secenek: Actor Script Character/Pawn uzerine bir
`AIController` component eklemek:

```json
{
  "component": "AIController",
  "props": {
    "behaviorTree": "assets/AI/Enemy.behavior.json",
    "blackboard": "assets/AI/Enemy.blackboard.json",
    "perception": {
      "sightRadius": 18,
      "fieldOfViewDeg": 110,
      "hearingRadius": 12
    },
    "navAgent": {
      "radius": 0.35,
      "height": 1.8,
      "maxSpeed": 3.2
    }
  }
}
```

Save-path notu: `/__save-actor` payload'i `normalizeActorScriptDef`
(`engine/scene/actorScript.ts`) uzerinden dogrulanir ve `tools/saveValidator.ts`
bu fonksiyonu yeniden kullanir. Component kind allowlist'i
`ACTOR_COMPONENT_KINDS` + `isActorComponentKind` gate'idir; component `props`
ise `normalizeParams` ile **opak JSON** olarak gecer. Yani Faz 1'de
`"AIController"`i `ACTOR_COMPONENT_KINDS`'a eklemek save tarafi icin yeterlidir;
ayri bir props allowlist'i gerekmez. (Ileride per-instance AI override'lari
`LayoutPlacement`'a taninirsa o zaman `applyTransformFields` allowlist gotcha'si
devreye girer.)

Ikinci, Unreal'a daha yakin secenek: `parentClass: "aiController"` Actor Script
asset'i ve pawn uzerinde `aiControllerClassRef`. Bu daha temiz ama editor/runtime
semalarina daha fazla dokunur (`PARENT_CLASSES` + picker + spawn hatti). Bu
yuzden Faz 1 icin component, Faz 4+ icin class asset onerilir.

## Mevcut sistemlerle entegrasyon noktalari

- **CharacterMovement:** AI hareketi icin `CharacterMovementSubsystem`'e
  ajan-basina move-intent kaynagi eklenmeli (bkz. Faz 3). AI ajanlar da
  `reportLocomotion` yolundan gecirilirse locomotion animasyon durumlari
  (`src/game/locomotionAnimation.ts`) NPC'ler icin bedavaya gelir.
- **ScriptMessageBus:** damage/alert/game-event stimuluslari icin
  `BehaviorSubsystem.subscribeScriptMessage()` hazir; AI task'lari oyun
  eylemlerini `emitScriptMessage()`/`BehaviorContext.messages` ile yayar.
  Ilk fazlarda ayri bir AI event bus gerekmez.
- **Dialogue/Conversation:** `forge.startConversation` gibi bir task
  `ConversationDirector`/`DialogueSubsystem`'i tetikleyebilir; NPC bark'lari
  (tehdit gorunce tek satir dialogue line) ucuz bir ilk entegrasyon.
- **Audio:** hearing stimulus icin ilk kaynak, mevcut ses calma noktalarina
  eklenecek `emitNoise(position, loudness, sourceEntityId)` koprusu.
- **Debug overlay:** `RuntimeStatsApp`'e `getAiDebugSnapshot()` getter'i,
  `src/scene/debugStats.ts`'e saf `formatAiDebug()` formatter'i (mevcut
  `formatGameModeDebug`/`formatUiDebug` deseni; formatter DOM'suz oldugu icin
  engine testinde dogrulanir).

## Fazlar

### Faz 0 - Arastirma kapatma ve mimari sozlesme

- [x] Bu dokumani AI sistemi icin kaynak plan kabul et.
- [x] `docs/architecture/UNREAL_BASICS_LESSONS.md` icine AI planina kisa link ekle.
- [x] `docs/architecture/ARCHITECTURE.md` icinde AI runtime/editor sinirini bir
      paragrafla netlestir. ("AI runtime / editor boundary" alt basligi eklendi.)
- [x] `engine/behavior` ile yeni `engine/ai` sorumluluk farkini yaz
      (`engine/behavior/README.md` guncellendi + yeni `engine/ai/README.md`):
      `BehaviorSubsystem` kucuk script tick/message, `AISubsystem` karar ve ajan
      orkestrasyonu.
- [x] Security notu: Faz 1 yeni dev endpoint / generated content / behavior stub
      *eklemedi* (yalnizca engine runtime + component reader + editor icon/kind).
      Codex Security diff scan gerektiren yuzey Faz 2'de (`/__save-behavior`
      endpoint) devreye girecek — o zaman istenecek (Codex oturumlari icin handoff).

### Faz 1 - Minimal AIController + Blackboard + debug snapshot

Hedef: Bir NPC ajaninin runtime'da possess edilmesi, kendi hafizasini tutmasi ve
debug'da izlenebilmesi.

- [x] `engine/ai/blackboard.ts` ekle: typed key schema, runtime value store,
      serialize edilmeyen per-agent state. (Declared-key-only, kind-validated
      set/clear/reset, vec3 clone-in/out, debug snapshot.)
- [x] `engine/ai/aiController.ts` ekle: pawn entity id, controller id,
      blackboard, current goal, debug snapshot.
- [x] `engine/ai/aiSubsystem.ts` ekle: AIController instance lifecycle,
      `setEntities`, `update`, `dispose` + `setEnabled` gate
      (BehaviorSubsystem/PhysicsSubsystem modeliyle ayni: edit modda kapali).
- [x] `ACTOR_COMPONENT_KINDS`'a (`engine/scene/actorScript.ts`) `"AIController"`
      ekle — `isActorComponentKind` gate'i ayni zamanda `/__save-actor` save
      allowlist'idir (`normalizeActorScriptDef` saveValidator tarafindan
      yeniden kullanilir); ayri props allowlist gerekmez. (Editor: `COMPONENT_ICONS`
      + `defaultComponentProps` girisleri de eklendi.)
- [x] `engine/scene/components.ts` icine `AIControllerComponent` tipi +
      `readAIControllerComponent` reader ekle. (Ayrica `AIPerceptionConfig` /
      `AINavAgentConfig` + inline `blackboardKeys` sema okumasi.)
- [x] `RuntimeSceneApp` icinde `AISubsystem` kur (`registerSubsystem`), entity
      listesini runtime scene build sonrasinda bagla (`startSceneRuntime` `ai:`).
- [x] `SceneApp` (editor) icinde de kur: edit modda `setEnabled(false)`, Play
      modunda etkin — aksi halde editor Play'de AI calismaz.
- [x] `?debug` overlay: `getAiDebugSnapshot()` (her iki host) + `formatAiDebug()`
      ile aktif AI sayisi, possessed pawn, active goal, blackboard key sayisi
      (`src/scene/debugStats.ts` deseni).
- [x] Test: headless engine test ile blackboard default/read/write
      (`tools/engine-tests.ts`; `engine/ai` value importlari relative).
- [x] Test: runtime smoke — AIController component'li entity AISubsystem uzerinden
      derive + tick edilir, crash yok (headless).
- [x] Validation: `npx tsc --noEmit`, `npm run test:engine` (594 check),
      `npm run build:verify`, `npm run check:assets` — hepsi yesil.

### Faz 2 - Behavior Tree runtime, visual editor olmadan

Hedef: Unreal Behavior Tree'nin sade JSON karsiligi; Selector/Sequence/Decorator/
Service/Task modeli.

- [x] `*.behavior.json` ve `*.blackboard.json` schema + engine-side normalizer
      tanimla (orn. `engine/ai/behaviorAsset.ts`; loader ve saveValidator ayni
      normalizer'i paylasir — `normalizeAssetSkeleton` modeliyle ayni ilke).
- [x] Dev save endpointleri: `vite.config.ts` icine `/__save-behavior` (+
      `/__save-blackboard`), `WRITE_ENDPOINTS` listesine ekleme,
      `tools/saveValidator.ts` icine `validateSave*Payload` — mevcut
      soundCue/dialogue endpoint pattern'i.
- [x] `engine/assets/manifest.ts`: yeni `AssetType` degerleri (`behaviorTree`,
      `blackboard`) + compound extension eslemesi (`.behavior.json`,
      `.blackboard.json`); `npm run check:assets` yesil kalmali.
- [x] Behavior Tree runner ekle:
      - [x] `selector`
      - [x] `sequence`
      - [x] `task`
      - [x] `decorator`
      - [x] `service`
      - [x] `wait`
      - [x] `subtree` icin basit asset referansi.
- [ ] Event-driven yaklasim icin blackboard key change ve perception event
      invalidation modeli ekle; her frame tum agaci pahali sekilde tarama.
- [x] Node-specific mutable data'yi node asset'inde degil agent runtime memory'de
      tut; Unreal'in shared node instance riskini Forge'da bastan engelle.
- [x] `src/game/ai/tasks.ts` icinde task registry kur.
- [ ] Built-in tasklar:
      - [x] `forge.wait`
      - [x] `forge.setBlackboard`
      - [x] `forge.sendMessage` (ScriptMessageBus uzerinden)
      - [x] `forge.moveToPosition`
      - [x] `forge.moveToBlackboard`
      - [x] (opsiyonel) `forge.startConversation` — DialogueSubsystem koprusu.
- [ ] Built-in decoratorlar:
      - [x] blackboard compare
      - [ ] distance compare
      - [ ] cooldown
      - [ ] has perception stimulus
- [ ] Built-in serviceler:
      - [ ] update target distance
      - [ ] update line of sight
      - [ ] refresh query result
- [ ] Editor ilk surum: JSON asset create/edit formu, node tree text outline,
      task/decorator/service parametre editoru.
- [x] Debug: active node path, last status, task duration, failed decorator.
- [x] Test: selector/sequence/decorator/task runner unit tests.
- [ ] Test: enemy patrol/chase sample layout.
- [x] Validation: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`.

Tamamlanan Faz 2 altyapi notu (2026-07-05):

- `engine/ai/behaviorAsset.ts` eklendi; Blackboard ve Behavior Tree asset
  normalizer'lari `tools/saveValidator.ts` tarafindan da kullaniliyor.
- `/__save-blackboard` ve `/__save-behavior` localhost-only authoring endpointleri
  eklendi; path traversal ve compound extension guard'lari test edildi.
- Content Browser typed stub uretimi `blackboard` / `behaviorTree` icin acildi.
- `engine/assets/manifest.ts` `.blackboard.json` ve `.behavior.json` dosyalarini
  AI asset type olarak siniflandiriyor.
- Dogrulama: `npx.cmd tsc --noEmit` ve `npm.cmd run test:engine` yesil
  (`602 checks passed`). Full `build:verify` ayrica calistirildi.

Tamamlanan Faz 2 runtime runner notu (2026-07-05):

- `engine/ai/behaviorRunner.ts` eklendi; selector/sequence/task/wait/subtree,
  blackboard decorator, service interval tick'i ve agent-basina node memory
  destekleniyor.
- `AISubsystem` behavior/blackboard asset library aliyor, runtime/editor Play
  host'lari manifest'teki AI asset'lerini engine normalizer'lariyla yukluyor ve
  AI task registry `src/game/ai/tasks.ts` uzerinden enjekte ediliyor.
- Built-in tasklar: `forge.wait`, `forge.setBlackboard`, `forge.sendMessage`,
  `forge.startConversation`, `forge.moveToPosition`, `forge.moveToBlackboard`. Hareket task'lari Faz 3
  move-intent/path following callback'i gelene kadar callback yoksa failure
  dondurur.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`607 checks passed`), `npm.cmd run build:verify`, `npm.cmd run check:assets`.

### Faz 3 - Navigation ve path following

Hedef: AI hareketi `CharacterMovement` ile uyumlu, path tabanli ve debug
edilebilir olsun.

- [ ] **On kosul — CharacterMovement AI giris refactoru:**
      `CharacterMovementSubsystem` bugun `isPlayerControlled` disindaki
      entity'leri hic tick etmiyor ve inputu global `ActionMap`'ten okuyor.
      Ajan-basina move-intent saglayan bir provider ekle (orn.
      `getMoveIntent(entityId): { direction, speed, jump? } | null` opsiyonu):
      player icin ActionMap'ten, AI icin AISubsystem'den beslenir. Boylece
      yercekimi/step/collision cozumu ve `reportLocomotion` animasyon yolu
      NPC'ler icin de calisir.
- [ ] `engine/navigation` contract ekle:
      - [ ] `NavAgent`
      - [ ] `PathRequest`
      - [ ] `PathResult`
      - [ ] `PathFollowingState`
- [ ] Ilk uygulama olarak collision AABB'lerinden 2D grid/waypoint graph uret.
- [ ] Static blocker AABB'lerini mevcut `PhysicsQuery.staticBlockerAabbs()`
      yuzeyinden besle (`engine/behavior/behaviorSubsystem.ts` interface'i,
      `engine/physics/physicsSubsystem.ts` implementasyonu).
- [ ] `forge.moveToPosition` task'ini path request + path following ile calistir.
- [ ] Ajan hareketini transform teleport yerine yukaridaki move-intent
      provider'i uzerinden uygula.
- [ ] Basit local avoidance ekle: ajanlar arasi separation ve stuck recovery.
- [ ] Debug draw:
      - [ ] nav grid/graph
      - [ ] path polyline
      - [ ] current waypoint
      - [ ] blocked/stuck state.
- [ ] Editor `Show > AI Navigation` gorunumunu ekle.
- [ ] Test: obstacle etrafini dolasan path.
- [ ] Test: path yoksa task failure.
- [ ] Validation: TypeScript, engine tests, build verify, mumkunse Playwright
      viewport smoke.

### Faz 4 - Perception

Hedef: NPC kararlarini game-state polling yerine stimulus ve algi eventleriyle
beslemek.

- [ ] `engine/perception` contract ekle:
      - [ ] `PerceptionListener`
      - [ ] `StimulusSource`
      - [ ] `PerceivedStimulus`
      - [ ] dominant/priority sense.
- [ ] Sight:
      - [ ] radius
      - [ ] field of view
      - [ ] line-of-sight ray/AABB test
      - [ ] target lost grace period.
- [ ] Hearing:
      - [ ] `emitNoise(position, loudness, sourceEntityId)`
      - [ ] radius attenuation
      - [ ] last heard position blackboard update.
- [ ] Damage/gameplay stimulus:
      - [ ] `damage`, `alert`, `ui-action`, `game-event` gibi mevcut script
            message eventlerinden perception'a bridge —
            `BehaviorSubsystem.subscribeScriptMessage()` ile; scene rebuild
            (`clear()`) aboneligi dusurur, yeniden abone olmayi unutma.
- [ ] AIController component props icinde perception config expose et.
- [ ] Behavior Tree serviceleri perception result'larini Blackboard'a yazsin.
- [ ] Debug:
      - [ ] sight cone
      - [ ] hearing radius
      - [ ] current sensed targets
      - [ ] last known positions.
- [ ] Test: target FOV disindayken gorulmez, FOV icinde ve obstruction yokken gorulur.
- [ ] Test: noise event blackboard'a last heard position yazar.
- [ ] Validation: TypeScript, engine tests, build verify, Playwright editor debug smoke.

### Faz 5 - EQS benzeri query sistemi

Hedef: "nereye gitmeli?", "en iyi cover neresi?", "hangi pickup yakin ve guvenli?"
gibi kararlar data-driven sorgu ile cozulsun.

- [ ] `*.eqs.json` veya `*.query.json` asset schema tanimla (+ manifest
      `AssetType` ve save endpoint, Faz 2 pattern'i).
- [ ] Generatorlar:
      - [ ] points around querier
      - [ ] grid around context
      - [ ] actors by tag/interface/classRef
      - [ ] smart objects by tag.
- [ ] Contextler:
      - [ ] querier
      - [ ] target entity
      - [ ] blackboard entity/position
      - [ ] all actors of tag/interface.
- [ ] Testler:
      - [ ] distance min/max/score
      - [ ] line of sight
      - [ ] nav reachable
      - [ ] occupancy/reservation free
      - [ ] dot/FOV.
- [ ] Behavior Tree task: `forge.runQueryToBlackboard`.
- [ ] Query debug:
      - [ ] generated candidates
      - [ ] per-test score
      - [ ] winner item
      - [ ] failure reason.
- [ ] Editor ilk surum: query asset formu + viewport candidate overlay.
- [ ] Performance: query tick interval, candidate cap, debug-only expensive details.
- [ ] Test: best patrol point / best cover point deterministic sample.
- [ ] Validation: full local gate ve Playwright overlay smoke.

### Faz 6 - Smart Objects

Hedef: Level'daki kullanilabilir aktiviteleri AI ve oyuncu icin ortak, rezerve
edilebilir data haline getirmek.

- [ ] `SmartObjectComponent` ekle (mevcut `InteractionComponent` ile iliskisini
      netlestir: interaction oyuncu-tetiklemeli tek atim, smart object
      rezerve edilebilir slot):
      - [ ] tags
      - [ ] slots
      - [ ] interaction position
      - [ ] cooldown
      - [ ] reservedBy.
- [ ] Runtime reservation API:
      - [ ] query
      - [ ] claim
      - [ ] use
      - [ ] release
      - [ ] expire.
- [ ] EQS generator: smart objects by tag/search radius.
- [ ] Behavior Tree task: `forge.claimSmartObject`, `forge.useSmartObject`.
- [ ] Message bridge: use baslayinca actor script message emit et.
- [ ] Editor marker/Details UI: slot gizmo, tag editor, reservation debug.
- [ ] Test: iki ajan ayni slotu ayni anda alamaz.
- [ ] Test: claim timeout release eder.
- [ ] Validation: TypeScript, engine tests, build verify.

### Faz 7 - AI asset authoring ve Content Browser entegrasyonu

Hedef: AI sistemi kodla calismakla kalmasin, editor icinde uretilip
baglanabilsin.

- [ ] Content Browser create menu (Faz 2'de eklenen manifest `AssetType`
      degerleri uzerine kurulur):
      - [ ] Blackboard
      - [ ] Behavior Tree
      - [ ] EQS Query
      - [ ] ileride State Tree.
- [ ] Actor Script Editor:
      - [ ] AIController component add/remove.
      - [ ] behavior tree picker.
      - [ ] blackboard picker.
      - [ ] perception/nav agent settings.
- [ ] Behavior Tree Editor v1:
      - [ ] tree outline
      - [ ] add/remove/reorder node
      - [ ] node details panel
      - [ ] validation errors.
- [ ] Runtime debug inspector:
      - [ ] selected AI actor blackboard values
      - [ ] active behavior path
      - [ ] perception stimuli
      - [ ] path/query overlay toggles.
- [ ] Save validation: tum yeni sidecar formatlari `tools/saveValidator.ts`
      icinde engine normalizer'lari yeniden kullanarak dogrulanmali; olasi yeni
      layout alanlari icin `applyTransformFields` allowlist gotcha'si gecerli.
- [ ] Security: AI-generated behavior stublari, dev endpoint veya file write
      degisiklikleri icin Codex Security diff scan calistirmayi planla (Codex
      oturumlari icin handoff notu).
- [ ] Validation: full local gate + Playwright `?editor` smoke.

### Faz 8 - StateTree secenegi

Hedef: Behavior Tree'nin iyi olmadigi uzun omurlu state akislari icin StateTree
benzeri sistem.

- [ ] `*.stateTree.json` schema:
      - [ ] states
      - [ ] selectors/transitions
      - [ ] evaluators
      - [ ] tasks
      - [ ] parameters/context data.
- [ ] Runtime runner: active state path, transition guards, enter/tick/exit.
- [ ] Behavior Tree ile ortak task/condition registry kullan.
- [ ] GameMode, boss fight, civilian routine, quest actor gibi use-case'leri
      Behavior Tree yerine StateTree ile modelle.
- [ ] Editor ilk surum: nested state outline + transition table.
- [ ] Debug: active state, last transition reason, evaluator values.
- [ ] Test: patrol -> alert -> chase -> search -> patrol state akisi.
- [ ] Validation: full local gate + Playwright debug smoke.

## Ilk uygulanabilir vertical slice onerisi

En dusuk riskli ilk sprint:

1. Blackboard runtime store.
2. AIController component.
3. Behavior Tree runner icin sadece `selector`, `sequence`, `task`, basit
   blackboard decorator.
4. `forge.wait`, `forge.setBlackboard`, `forge.sendMessage` tasklari.
5. Debug snapshot (`getAiDebugSnapshot` + `formatAiDebug`).
6. Bir `Enemy.behavior.json` sample'i: idle -> message emit.

Bu slice navigation/perception/EQS beklemeden AI karar altyapisini dogrular ve
CharacterMovement refactoru gerektirmez (hareket yok). Sonraki sprintte
move-intent provider refactoru + path following, ardindan perception eklenir.

## Kabul kriterleri

- Runtime route AI kullanirken editor import etmez.
- Editor route AI asset'lerini author eder ama runtime decision code'u editor
  shell'e tasimaz.
- AI, editor Play modunda da calisir (`SceneApp` wiring); edit modda
  `setEnabled(false)` ile kapalidir.
- AI runtime state layout JSON'a geri yazilmaz.
- Yeni sidecar formatlari saveValidator'da engine normalizer'lariyla dogrulanir;
  yeni layout alanlari bilincli allowlist edilir.
- Behavior Tree node runtime memory'si agent basina ayridir.
- Debug snapshot olmadan AI feature tamam sayilmaz.
- Engine-level AI kodu DOM, Three.js ve editor bagimliligi tasimaz; render/debug
  visualizer ayri katmanda kalir. Value importlar relative kalir ki
  `npm run test:engine` harness'i kossun.
- Oyun-spesifik combat/mission/score kararlari `src/game` tarafinda kalir.

## Acik kararlar

- Ilk nav implementasyonu grid/waypoint mi, yoksa dogrudan Recast/Detour
  entegrasyonu mu olacak?
- AIController once component olarak mi kalacak, yoksa `parentClass:
  "aiController"` Actor Script class'i mi acilacak?
- Behavior Tree visual editor ne zaman gerekli? Ilk fazlarda JSON/form editor
  yeterli gorunuyor.
- ~~AI task'lari mevcut `BehaviorSubsystem` mesaj API'ini mi kullanacak?~~
  Cozuldu (2026-07-02): `ScriptMessageBus` non-behavior kaynaklari zaten
  destekliyor (`emitScriptMessage`/`subscribeScriptMessage`); ilk fazlarda ayri
  bus yok, performans verisi cikarsa yeniden degerlendirilir.
- Move-intent provider'in kesin sekli: `CharacterMovementSubsystemOptions`'a
  eklenen bir callback mi, yoksa entity-basina kayitli bir input source
  registry'si mi? (Faz 3 basinda kararlastirilacak.)
- Multiplayer/replication su an kapsam disi; ileride AI state replication
  sozlesmesi ayrica planlanmali.

## Revizyon notlari (2026-07-02)

Plan koda karsi dogrulandi; su duzeltmeler yapildi:

1. **Save-path duzeltmesi:** Faz 1'deki "saveValidator'a component props
   allowlist ekle" maddesi yanlisti — `/__save-actor` zaten
   `normalizeActorScriptDef`'i kullaniyor ve component props opak JSON olarak
   geciyor; gercek is `ACTOR_COMPONENT_KINDS`'a kind eklemek.
2. **CharacterMovement kisiti eklendi:** subsystem yalnizca possessed pawn'i
   tick ediyor ve global `ActionMap` okuyor; AI hareketi icin move-intent
   provider refactoru Faz 3'e on kosul olarak yazildi.
3. **Editor Play modu eklendi:** `SceneApp` de gameplay subsystem'leri kuruyor
   (`setEnabled` gate); AI subsystem cift-host wiring gerektirir.
4. **Asset pipeline somutlastirildi:** yeni sidecar'lar icin
   `engine/assets/manifest.ts` `AssetType` + compound extension, vite dev
   endpoint + `WRITE_ENDPOINTS` + `validateSave*Payload` maddeleri eklendi
   (soundCue/dialogue pattern'i).
5. **Dialogue entegrasyonu eklendi:** tamamlanan `engine/dialogue` sistemiyle
   temas noktalari (`forge.startConversation`, NPC bark) not edildi.
6. **Debug/test desenleri baglandi:** `debugStats.ts` snapshot/formatter deseni
   ve engine-test relative-import kurali ilgili maddelere islendi;
   ScriptMessageBus'in `clear()` abonelik dusurme davranisi perception
   koprusune uyari olarak eklendi.

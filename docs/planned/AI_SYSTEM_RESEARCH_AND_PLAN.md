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
> Revizyon: 2026-07-05 - Faz 3 CharacterMovement AI move-intent on kosulu
> uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-05 - Faz 3 grid navigation + runtime path-following ilk
> dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-05 - Faz 3 local avoidance + stuck recovery dilimi
> uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-05 - Faz 3 AI navigation debug draw + editor Show gorunumu
> uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 3 AI Navigation Volume authoring ve runtime
> bounds dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 Perception contract + sight/hearing debug state
> ilk dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 Behavior Tree perception service + Blackboard
> bridge dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 sight target-lost grace dilimi uygulandi
> (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 script message -> gameplay stimulus bridge
> dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 dominant/priority sense helper dilimi
> uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 debug last known positions dilimi uygulandi
> (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 4 sight cone + hearing radius debug overlay
> dilimi uygulandi ve Faz 4 gate kapatildi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 5 query asset schema/save/runtime runner ilk
> dilimi uygulandi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-06 - Faz 5 query debug snapshot ve
> actorsByInterface/classRef + target context dilimi uygulandi.
> Revizyon: 2026-07-06 - Faz 5 query viewport candidate overlay dilimi
> uygulandi.
> Revizyon: 2026-07-06 - Faz 5 all-actors tag/interface query context dilimi
> uygulandi.
> Revizyon: 2026-07-06 - Faz 5 query task interval/cache performans dilimi
> uygulandi.
> Revizyon: 2026-07-06 - Faz 5/6 Smart Object component, runtime reservation
> store ve query generator/filter ilk dilimi uygulandi.
> Revizyon: 2026-07-06 - Faz 6 Smart Object Behavior Tree claim/use task ve
> script message bridge dilimi uygulandi.
> Revizyon: 2026-07-06 - Playground `AI_Test` demo davranisi, target distance
> service ve `moveTo` speed parametresi eklendi.
> Revizyon: 2026-07-06 - AI controlled CharacterMovement actor'lar player spawn/
> possession adayindan ayrildi; AI character locomotion animasyonu eklendi.
> Revizyon: 2026-07-06 - Behavior Tree selector'lari reactive priority
> davranisina gecirildi; patrol sirasinda gorus/chase dallari her tick yeniden
> degerlendirilir.
> Revizyon: 2026-07-06 - AI sight trace'i karakter kok pozisyonu yerine
> kapsul/goz yuksekliginden atilir; CharacterMovement runtime diger karakter
> kapsullerini dinamik blocker olarak kullanir.
> Revizyon: 2026-07-06 - AI perception yakin awareness radius ve canlı
> transform sync destegi eklendi; hareket eden player/AI pozisyonlari algida
> guncel kalir.
> Revizyon: 2026-07-06 - Unreal Target Point benzeri patrol route authoring
> isi checklist olarak eklendi.
> Revizyon: 2026-07-06 - NavMesh agent radius / clearance benzeri AI path
> guvenlik mesafesi isi checklist olarak eklendi.
> Revizyon: 2026-07-06 - Target Point actor authoring ilk dilimi uygulandi
> (bkz. asagidaki checklist).
> Revizyon: 2026-07-06 - Target Point `nextTargetPoint` editor picker dilimi
> uygulandi (bkz. asagidaki checklist).
> Revizyon: 2026-07-07 - Target Point runtime index + patrol Behavior Tree
> task'lari (`forge.setPatrolTarget` / `moveToPatrolTarget` /
> `advancePatrolTarget`, stop/loop/nearest/failure modlari) uygulandi
> (bkz. asagidaki checklist).
> Revizyon: 2026-07-07 - Target Point `Show > AI Navigation` route overlay
> (nokta marker + `next` link oku + aktif AI hedef highlight) uygulandi
> (bkz. asagidaki checklist).
> Revizyon: 2026-07-07 - AI Navigation clearance / effective radius ilk dilimi
> uygulandi: `NavAgent.clearancePadding` + `PathRequest.safetyMargin`
> (`cellSize * 0.5` default), effective-radius blocker/bounds erozyonu ve
> AIController navAgent clearance wiring (bkz. asagidaki checklist).
> Revizyon: 2026-07-07 - AI Navigation ara vs final waypoint acceptance ayrimi
> uygulandi: saf `advanceWaypoint` helper'i + `AI_INTERMEDIATE_WAYPOINT_ACCEPTANCE`
> (`min(cellSize * 0.35, 0.2)`); cömert final acceptance kose kestiremiyor.
> Revizyon: 2026-07-07 - AI Navigation segment-safe path compression dilimi
> uygulandi: waypoint shortcut segmentleri effective-radius blocker/bounds
> kontrolunden geciyor; guvensiz kisayollarda grid noktasi korunuyor.
> Revizyon: 2026-07-07 - AI Navigation debug overlay clearance ilk dilimi
> uygulandi: raw blocker footprint, inflated forbidden footprint ve canli AI
> clearance halkasi ayni shared overlay helper'inda ayri ciziliyor.
> Revizyon: 2026-07-07 - AI Navigation debug overlay path clearance violation
> dilimi uygulandi: inflated forbidden alanini kesen path segmentleri turuncu
> overlay olarak ayrica ciziliyor.
> Revizyon: 2026-07-07 - AI Navigation debug overlay selected-agent radius/
> clearance dilimi uygulandi: secili AI icin agent capsule radius ve effective
> clearance halkalari ayri overlay objeleri olarak ciziliyor.
> Revizyon: 2026-07-07 - AI Navigation path cost iyilestirmesi uygulandi:
> inflated blocker'a yakin grid hucreleri ek maliyet aliyor, rota mumkunse
> koridor ortasina yaklasiyor.
> Revizyon: 2026-07-07 - AI Navigation clearance test hardening uygulandi:
> dar kose, dar gecit failure ve ara waypoint acceptance test maddeleri
> engine regression kapsaminda kapatildi.
> Revizyon: 2026-07-07 - AI Navigation clearance Playwright smoke uygulandi:
> editor Show overlay ve runtime debug path-following waypoint smoke eklendi.
> Revizyon: 2026-07-07 - Faz 2 built-in decorator seti tamamlandi: `distance`
> (pawn->hedef mesafe compare), `cooldown` (agent/node runtime memory ile hiz
> siniri) ve `hasPerceptionStimulus` (sense/minStrength/LOS filtreli) decorator'lar
> engine normalizer + runner + testleriyle eklendi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-07 - Faz 2 built-in service seti kapandi: `forge.refreshQueryBlackboard`
> service'i eklendi (dal aktifken query winner'ini blackboard'a tazeler, sonuc
> yoksa null'lar); `update target distance` / `update line of sight` mevcut
> `updateTargetDistanceBlackboard` / `updatePerceptionBlackboard` service'leriyle
> reconcile edildi (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-07 - Faz 7 ilk dilimi: Content Browser create menu'ye AI
> asset turleri eklendi (`AI Blackboard` / `AI Behavior Tree` / `AI Query (EQS)`);
> client `ContentNewKind` union'i genisletildi ve mevcut Faz 2 stub backend'ine
> baglandi. Yan etkisiz Playwright smoke ile menu girisleri dogrulandi.
> Revizyon: 2026-07-07 - Faz 7: Actor Script Editor AIController component'ine
> Behavior Tree + Blackboard asset path picker'lari eklendi (mesh picker kalibi;
> deger = asset path, bilinmeyen/elle girilmis path korunur). Perception/nav
> agent tuning halen Advanced raw props'ta.
> Revizyon: 2026-07-08 - Faz 7 Actor Script Editor AIController perception/
> nav-agent Details number field'lari eklendi; bu tuning artik raw props yerine
> dedicated form alanlarindan editleniyor (bkz. asagidaki checklist).
> Revizyon: 2026-07-08 - Faz 7 Behavior Tree Editor v1 ilk dilimi: `*.behavior.json`
> icin modal editor (yapisal outline + engine normalizer validation + raw-JSON
> authoring + `/__save-behavior` save). Node-form CRUD sonraki dilim.
> Revizyon: 2026-07-08 - Faz 7 Behavior Tree Editor node-form CRUD dilimi:
> outline node'lari secilebilir; Node Details formu (kind/id + task/seconds/
> behavior) ve Add Child / Remove / Move up-down toolbar'i eklendi. Raw JSON tek
> kaynak-of-truth olarak kaldi (yapisal duzenlemeler clone'u mutate edip raw'a
> geri serialize eder), yeni save yuzeyi yok. BT Editor v1 kapandi; kalan Faz 7:
> runtime debug inspector + decorator/service form authoring (sonraki dilim).
> Revizyon: 2026-07-08 - Faz 7 Behavior Tree Editor decorator/service form
> authoring dilimi: Node Details formuna kart tabanli decorator (blackboard/
> distance/cooldown/hasPerceptionStimulus) ve service (name/interval) editorleri
> eklendi; add/remove/convert mutasyonlari `mutateTree` raw-JSON kaynak-of-truth'u
> uzerinden gecer, yeni save yuzeyi yok. Kalan Faz 7: runtime debug inspector.
> Revizyon: 2026-07-08 - Faz 7 runtime debug inspector dilimi: `?debug` overlay'e
> saf `formatAiInspector` eklendi; odakli controller'in tam blackboard degerleri,
> active behavior path ve perception stimuli listesi gosterilir (path/query
> overlay draw'lari zaten Faz 3/4/5'ten mevcut). Interaktif per-actor secim +
> ayri DOM panel sonraki is olarak birakildi.
> Revizyon: 2026-07-08 - Faz 8 StateTree asset schema/save/manifest altyapi
> ilk dilimi uygulandi: `engine/ai/stateTreeAsset.ts` normalizer'i (hiyerarsik
> states, guard'li transitions, tasks, evaluators) Behavior Tree'nin decorator/
> service/param registry'sini yeniden kullanir; `.stateTree.json` manifest
> siniflandirmasi, `/__save-state-tree` dev endpoint'i, `stateTree` content-new
> stub'i ve Content Browser create menu girisi eklendi. Runtime runner + editor
> outline sonraki dilim (bkz. asagidaki checkbox'lar).
> Revizyon: 2026-07-08 - Faz 8 StateTree runtime runner dilimi uygulandi:
> `engine/ai/stateTreeRunner.ts` (hiyerarsik state selection, enter/tick/exit,
> guard'li + event'li transitions, global evaluators, per-agent runtime memory).
> Paylasilan condition semantigi `engine/ai/aiConditions.ts`'e cikarildi; hem
> Behavior Tree hem StateTree ayni decorator degerlendirmesini ve ayni
> `AiTaskRegistry`/`AiTaskContext` task registry'sini kullanir. patrol -> alert
> -> chase -> search -> patrol engine testi eklendi. Subsystem/AIController
> wiring + editor outline sonraki dilim.
> Revizyon: 2026-07-08 - Faz 8 StateTree subsystem/AIController wiring dilimi
> uygulandi: AIController component `stateTree` asset path'i tasir; `AISubsystem`
> `stateTree` asset library'sini yukler, her controller icin StateTree varsa
> `AiStateTreeRunner` (yoksa Behavior Tree runner) kurar ve tick eder (StateTree
> her ikisi de authored ise kazanir), blackboard StateTree asset'inin
> referansindan cozulur. Debug snapshot StateTree runner'i tasir; `?debug`
> overlay `st` satiri + `formatAiInspector` state/last-transition blogu, Actor
> Script Editor AIController formuna State Tree asset picker eklendi. Runtime/
> editor host loader'lari `.stateTree.json` asset'lerini yukler. Kalan Faz 8:
> nested state outline editor + parameters/context data + Playwright smoke.
> Revizyon: 2026-07-08 - Faz 8 StateTree Editor v1 dilimi uygulandi:
> `src/editor/StateTreeEditor.ts` (Content Browser'dan `.stateTree.json` acar) +
> `src/editor/stateTreeStore.ts` (load/`/__save-state-tree` save). Modal editor
> hiyerarsik state outline (task/transition/child rozetleri + enter-condition
> chip'leri), transition tablosu (`from → to` + event/guard ozeti), raw-JSON
> authoring ve engine normalizer (`normalizeAiStateTreeAsset`) validation'i
> paylasir; raw JSON tek kaynak-of-truth, ayri save yuzeyi yok. State/transition
> form CRUD sonraki dilim (BT Editor dilimlemesiyle ayni). Playwright smoke
> (`tests/smoke/state-tree-editor.spec.ts`) outline/transition/validation'i
> dogrular. Kalan Faz 8: state/transition form CRUD + parameters/context data +
> GameMode/boss/civilian use-case ornekleri.
> Revizyon: 2026-07-08 - Faz 8 StateTree Editor form CRUD dilimi uygulandi
> (BT Editor node-form CRUD dilimimin paraleli): state outline artik secilebilir;
> State Details formu id duzenleme, add-child / remove / move up-down, task CRUD
> (task adi + params count-hint) ve transition CRUD (hedef state dropdown'i +
> event + guard-condition count-hint) tasir. Yapisal edit'ler raw-JSON clone'unu
> mutate edip geri serialize eder (tek kaynak-of-truth, yeni save yuzeyi yok);
> enter/transition guard `conditions` ve task `params` bilincli olarak raw kalir.
> Playwright smoke CRUD akisini (add-child/rename/add-task/add-transition/remove/
> reorder) dogrulayacak sekilde genisletildi. Kalan Faz 8: rich condition-card
> authoring (paylasilan helper) + parameters/context data + use-case ornekleri.
> Revizyon: 2026-07-08 - Faz 8 StateTree condition-card authoring dilimi
> uygulandi: State Details formu secili state `enter` guard'lari ve transition
> `conditions` guard'lari icin blackboard/distance/cooldown/perception kartlari
> tasir. Kart editleri raw JSON tek kaynak-of-truth'a geri serialize edilir ve
> engine normalizer validation'undan gecer. Kalan Faz 8: parameters/context data
> + use-case ornekleri.
> Durum: Faz 1 uygulandi; Faz 2'nin asset altyapisi ve runtime runner dilimi
> tamamlandi. Son tam gate yesil (`tsc`, `test:engine` 653 check,
> `build:verify`, `check:assets`). Faz 3 CharacterMovement AI move-intent
> provider on kosulu ve ilk grid navigation/path-following dilimi tamamlandi.
> Basit local avoidance + stuck recovery, runtime `?debug` AI navigation draw
> ve editor `Show > AI Navigation` gorunumu tamamlandi. AI Navigation Volume
> (Unreal NavMesh Bounds Volume karsiligi) editor authoring + runtime bounds
> olarak eklendi. Faz 4 Perception ilk diliminde saf sight/hearing contract'i,
> runtime `AISubsystem` perception snapshot'i ve `?debug` sensed-target satiri
> eklendi. Faz 4 service bridge ile sight/hearing perception sonuclari Behavior
> Tree servisinden Blackboard'a yazilabiliyor. Sight target-lost grace ile kisa
> LOS kopmalarinda son hedef bilgisi korunabiliyor. Script message bridge ile
> `Damage.*`, `alert`, `ui-action` ve `game-event` mesajlari gameplay stimulus
> olarak AI perception'a dusuyor. Dominant stimulus siralamasi artik merkezi
> sense priority helper'i uzerinden yapiliyor. Debug overlay son bilinen /
> duyulan stimulus pozisyonlarini blackboard'dan gosterebiliyor; runtime
> `?debug` ve editor `Show > AI Navigation` artik AI perception sight cone ve
> hearing radius wireframe'lerini de cizebiliyor. Faz 5 query asset schema,
> dev save endpoint, content-new stub, runtime query runner ve
> `forge.runQueryToBlackboard` task ilk dilimi tamamlandi. Faz 2 editor form ve
> gelismis decorator isleri planli. Query debug snapshot'i ve overlay satiri,
> actor interface/classRef generator'lari ve target entity context'i eklendi.
> Runtime `?debug` ve editor `Show > AI Navigation`, son query adaylarini ve
> kazanan item'i viewport wireframe overlay olarak cizebiliyor. Query
> context'leri artik tag/interface ile bulunan tum aktor referanslarini
> distance/LOS/nav/dot testlerinde kullanabiliyor. `forge.runQueryToBlackboard`
> task'i opsiyonel `interval` / `intervalSeconds` ile son sonucu cache'leyip
> pahali query tekrarlarini sinirlayabiliyor. Smart Object authored component
> reader'i, runtime-only reservation store'u, `smartObjectsByTag` query
> generator'i ve `reservationFree` query testi ilk dilim olarak eklendi.
> Behavior Tree task'lari Smart Object claim/use akisini calistirabiliyor ve
> use basladiginda hedef actor'a script message emit edebiliyor. Playground
> `AI_Test` actor'u blackboard/behavior asset'lerine baglanarak devriye,
> goruste kovalamaca ve yakin mesafede punch intent mesaji demosu calistirir.
> AI controlled CharacterMovement actor'lar artik default player pawn spawn'ini
> engellemez ve AI character ref'leri hareket raporundan idle/walk/run animasyon
> secimini runtime'da yapar. Runtime AI sight source filtresi statik prop'lari
> hedef listesinden cikarir; `moveTo` task'lari authored `acceptanceRadius`
> ile hedefe varis toleransi tasiyabilir. Behavior Tree selector'lari her tick
> oncelikli dallari bastan yokladigi icin devriye gibi running dalda kalan ajan
> guncel perception blackboard'una gore chase/attack dallarina kesebilir. AI
> sight trace'i artik karakterin kapsul/goz yuksekliginden atildigi icin zemin
> collider'i gorusu perdelemez; CharacterMovement runtime diger karakter
> kapsullerini gecici blocker olarak cozer, bu da player/AI ic ice gecmesini
> engeller. Runtime transform sink'i AI subsystem entity snapshot'ini da
> gunceller; `nearSightRadius` yakin temas algisi ile chase/attack dallarinin
> oyuncu yaklastiginda LOS blocker'ina takilmadan tetiklenmesini saglar.
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
- [x] Built-in decoratorlar:
      - [x] blackboard compare
      - [x] distance compare
      - [x] cooldown
      - [x] has perception stimulus
- [x] Built-in serviceler:
      - [x] update target distance (`forge.updateTargetDistanceBlackboard`)
      - [x] update line of sight (`forge.updatePerceptionBlackboard`
            `hasLineOfSightKey` yazar; perception service'ine katlanmis)
      - [x] refresh query result (`forge.refreshQueryBlackboard`)
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

Tamamlanan Faz 2 built-in decorator seti notu (2026-07-07):

- `engine/ai/behaviorAsset.ts` decorator semasi union'a genisletildi:
  `AiDecoratorDef = blackboard | distance | cooldown | hasPerceptionStimulus`.
  Normalizer kind bazli dogrulama yapar; saveValidator ayni normalizer'i
  yeniden kullandigi icin `.behavior.json` save yolu ek allowlist gerektirmez.
  - `distance`: `key` (entity veya vec3 blackboard degeri) ile pawn arasi mesafeyi
    `op` (`lt|lte|gt|gte`) ve `value` esigine gore karsilastirir; world query veya
    pozisyon yoksa guvenli failure.
  - `cooldown`: `seconds` boyunca dalin yeniden calismasini engelleyen hiz siniri;
    son gecis zamani agent-basina/node-basina runtime memory'de (`cooldownReadyAt`)
    tutulur, authored asset immutable kalir.
  - `hasPerceptionStimulus`: controller'in anlik perception snapshot'inda
    opsiyonel `sense` / `minStrength` / `requireLineOfSight` filtrelerine uyan bir
    stimulus varsa gecer.
- `engine/ai/behaviorRunner.ts` `decoratorsPass` kind bazli
  `decoratorPasses` dagitimiyla yeniden yazildi; `failedDecorator` etiketi her
  decorator turu icin ayri (`distance:target:lte`, `cooldown:1`,
  `perception:sight`).
- Test: normalizer distance/cooldown/perception canonicalizasyon + gecersiz
  op/value/sense throw'lari; runner distance->cooldown->perception gate akisi
  (perception yoksa idle, hedef uzaksa distance fail, menzilde attack + cooldown
  penceresi, cooldown sonrasi tekrar attack) kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`678 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS.

Tamamlanan Faz 2 built-in service seti notu (2026-07-07):

- `forge.refreshQueryBlackboard` service'i (`engine/ai/behaviorRunner.ts`
  default service registry) eklendi. `forge.runQueryToBlackboard` task'inin
  aksine tree akisini success/failure ile yonetmez; kendi service interval'inde
  calisip query winner'ini (`resultKey`, opsiyonel `slotResultKey`) blackboard'a
  yazar, kazanan yoksa key'leri null'lar. Boylece bir ajan kovalarken "en iyi
  cover" gibi degerler dal aktif kaldigi surece taze kalir.
- `update target distance` ve `update line of sight` maddeleri mevcut
  `forge.updateTargetDistanceBlackboard` ve `forge.updatePerceptionBlackboard`
  (`hasLineOfSightKey`) service'leriyle reconcile edildi; ayri LOS service'i
  gerekmedi.
- Test: service ilk tick'te winner yazar, interval icinde skip eder, interval
  dolunca winner kaybolursa key'i null'lar.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`679 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS.

### Faz 3 - Navigation ve path following

Hedef: AI hareketi `CharacterMovement` ile uyumlu, path tabanli ve debug
edilebilir olsun.

- [x] **On kosul — CharacterMovement AI giris refactoru:**
      `CharacterMovementSubsystem` bugun `isPlayerControlled` disindaki
      entity'leri hic tick etmiyor ve inputu global `ActionMap`'ten okuyor.
      Ajan-basina move-intent saglayan bir provider ekle (orn.
      `getMoveIntent(entityId): { direction, speed, jump? } | null` opsiyonu):
      player icin ActionMap'ten, AI icin AISubsystem'den beslenir. Boylece
      yercekimi/step/collision cozumu ve `reportLocomotion` animasyon yolu
      NPC'ler icin de calisir.
- [x] `engine/navigation` contract ekle:
      - [x] `NavAgent`
      - [x] `PathRequest`
      - [x] `PathResult`
      - [x] `PathFollowingState`
- [x] Ilk uygulama olarak collision AABB'lerinden 2D grid/waypoint graph uret.
- [x] Static blocker AABB'lerini mevcut `PhysicsQuery.staticBlockerAabbs()`
      yuzeyinden besle (`engine/behavior/behaviorSubsystem.ts` interface'i,
      `engine/physics/physicsSubsystem.ts` implementasyonu).
- [x] `forge.moveToPosition` task'ini path request + path following ile calistir.
- [x] Ajan hareketini transform teleport yerine yukaridaki move-intent
      provider'i uzerinden uygula.
- [x] Basit local avoidance ekle: ajanlar arasi separation ve stuck recovery.
- [x] Debug draw:
      - [x] nav grid/graph
      - [x] path polyline
      - [x] current waypoint
      - [x] blocked/stuck state.
- [x] Editor `Show > AI Navigation` gorunumunu ekle.
- [x] Editor/runtime `AI Navigation Volume` ekle: Unreal NavMesh Bounds
      Volume benzeri authored bounds; volume varsa pathfinding bu alanla
      sinirlanir, volume yoksa mevcut collision/blocker tabanli otomatik bounds
      davranisi korunur.
- [x] Test: obstacle etrafini dolasan path.
- [x] Test: path yoksa task failure.
- [x] Test: authored nav bounds icinde path success, disinda failure.
- [x] Validation: TypeScript, engine tests, build verify.
- [x] Playwright/browser viewport smoke.

Tamamlanan Faz 3 move-intent notu (2026-07-05):

- `CharacterMovementSubsystem` artik player input ile AI world-space
  `CharacterMoveIntent` kaynagini ayni collision/step/gravity/locomotion
  hattindan geciriyor; player possession filtresi korunuyor.
- Runtime host `AISubsystem.moveTo` callback'ini `forge.moveToPosition` /
  `forge.moveToBlackboard` icin duz-cizgi move-intent hedeflerine bagliyor.
  Gercek path request/path following ve obstacle etrafi dolasma hala Faz 3'te
  siradaki is.
- Test: AI-driven unpossessed character intent ile hareket eder, yaw/velocity ve
  locomotion raporu uretilir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`608 checks passed`), `npm.cmd run build:verify`, `npm.cmd run check:assets`.

Tamamlanan Faz 3 grid navigation/path-following notu (2026-07-05):

- `engine/navigation/gridNavigation.ts` eklendi; `NavAgent`, `PathRequest`,
  `PathResult`, `PathFollowingState` sozlesmeleri ve AABB blocker'lardan
  agent-radius ile sisirilmis 2D grid pathfinding var.
- Runtime `AISubsystem.moveTo` callback'i artik `PhysicsQuery.staticBlockerAabbs()`
  uzerinden path request kuruyor, bulunan path'i waypoint state olarak sakliyor
  ve `CharacterMovementSubsystem` move-intent provider'ina siradaki waypoint'i
  veriyor. Transform teleport yok.
- Test: grid navigation static blocker etrafindan rota bulur; blocked goal
  failure doner.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`610 checks passed`).

Tamamlanan Faz 3 local avoidance/stuck recovery notu (2026-07-05):

- `engine/navigation/localAvoidance.ts` eklendi; planar ajan separation steering,
  co-located ajanlar icin deterministik itme, magnitude clamp ve stuck progress
  window yardimcilari var.
- Runtime path-following `CharacterMovementSubsystem` move-intent provider'ina
  `deltaSeconds` geciyor; AI ajanlari yakin karakterlerden separation vektoru
  aliyor, progress kaybi algilaninca ayni hedef icin sinirli replan yapiyor ve
  recovery tukenirse task failure durumunu sakliyor.
- `?debug` overlay'i AI nav snapshot satirlarini gosteriyor: follower status,
  waypoint ilerlemesi, replan sayisi ve stall suresi. Bu metinsel debug'dir;
  nav grid/path cizimi ve editor `Show > AI Navigation` gorunumu hala acik.
- Test: separation steering overlap/clear/planar/clamp/co-located davranislari,
  stuck state threshold/reset ve AI nav formatter kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`613 checks passed`), `npm.cmd run build:verify` yesil. Playwright/browser
  viewport smoke bu dilimde calistirilmadi.

Tamamlanan Faz 3 AI navigation debug draw notu (2026-07-05):

- `engine/render-three/aiNavigationView.ts` eklendi; nav grid, static blocker
  footprint, path polyline, current waypoint ve failure goal isaretleri ortak
  Three.js helper'iyle ciziliyor.
- Runtime `?debug` modu `AiNavigationDebugSnapshot` icine blocker AABB'lerini,
  cell size bilgisini ve takip edilen path noktalarini ekleyip sahneye live AI
  navigation overlay'i basiyor. Stuck follower path'i sari, failure kirmizi
  gosteriliyor.
- Editor toolbar `Show > AI Navigation` toggle'i eklendi; collision overlay ile
  ayni collider verisinden nav blocker footprint + grid gorunumu uretiliyor ve
  transform/collision sidecar degisimlerinde yeniden kuruluyor.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run build:verify` yesil; hedefli
  Playwright smoke `Show > AI Navigation` toggle'inin checkbox state'ini, canvas
  degisimini ve browser error olmamasini dogruladi.

Tamamlanan Faz 3 AI Navigation Volume notu (2026-07-06):

- `LayoutAiNavigationVolume` ve `engine/scene/aiNavigationVolume.ts` eklendi;
  editor/runtime icin boyut, transform, renk, hidden/locked ve save validator
  allowlist'i tanimli.
- Editor `Add Actor > Volumes > AI Navigation Volume` komutu eklendi. Volume
  secilebilir, Outliner/Details yuzeyi vardir; Location/Rotation/Scale, Size
  X/Y/Z ve Color duzenlenebilir. Selection outline, picking, delete, undo/redo
  ve autosave mevcut editor actor kalibina baglandi.
- Runtime pathfinding `aiNavigationVolumes` alanindan AABB bounds uretir.
  Sahnede en az bir volume varsa `findGridPath` start/goal icin authored bounds
  zorunlu tutar ve grid'i bu volume'lerin birlesimiyle sinirlar; volume yoksa
  onceki otomatik blocker tabanli bounds davranisi devam eder.
- AI Navigation debug draw helper'i authored bounds footprint'lerini de cizer;
  editor `Show > AI Navigation` ve runtime `?debug` bu bounds bilgisini
  gosterir.
- Test: grid navigation authored bounds success/failure, AI Navigation Volume
  resolve/unique/AABB/save validator round-trip kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`618 checks passed`), `npm.cmd run build:verify` yesil. Hedefli Playwright
  smoke `tests/smoke/ai-navigation-volume.spec.ts` ile volume ekleme, Details,
  Show flag, save/reload kaliciligi ve browser error olmamasi dogrulandi.

### Faz 4 - Perception

Hedef: NPC kararlarini game-state polling yerine stimulus ve algi eventleriyle
beslemek.

- [x] `engine/perception` contract ekle:
      - [x] `PerceptionListener`
      - [x] `StimulusSource`
      - [x] `PerceivedStimulus`
      - [x] dominant/priority sense.
- [x] Sight:
      - [x] radius
      - [x] field of view
      - [x] line-of-sight ray/AABB test
      - [x] target lost grace period.
- [x] Hearing:
      - [x] `emitNoise(position, loudness, sourceEntityId)`
      - [x] radius attenuation
      - [x] last heard position blackboard update.
- [x] Damage/gameplay stimulus:
      - [x] `damage`, `alert`, `ui-action`, `game-event` gibi mevcut script
            message eventlerinden perception'a bridge —
            `BehaviorSubsystem.subscribeScriptMessage()` ile; scene rebuild
            (`clear()`) aboneligi dusurur, yeniden abone olmayi unutma.
- [x] AIController component props icinde perception config expose et.
- [x] Behavior Tree serviceleri perception result'larini Blackboard'a yazsin.
- [x] Debug:
      - [x] sight cone
      - [x] hearing radius
      - [x] current sensed targets
      - [x] last known positions.
- [x] Test: target FOV disindayken gorulmez, FOV icinde ve obstruction yokken gorulur.
- [x] Test: noise event blackboard'a last heard position yazar.
- [x] Validation: TypeScript, engine tests, build verify, Playwright editor debug smoke.

Tamamlanan Faz 4 Perception contract/sight-hearing notu (2026-07-06):

- `engine/perception/perception.ts` eklendi; `PerceptionListener`,
  `StimulusSource`, `PerceivedStimulus`, sight FOV/radius/LOS AABB testi ve
  hearing noise radius attenuation saf engine modulu olarak tanimli.
- `AIController` artik authored perception config'ini ve runtime sensed stimulus
  snapshot'ini tasiyor; runtime state layout'a yazilmiyor.
- `AISubsystem` entity transform'larindan perception source/listener uretir,
  `emitNoise(position, sourceEntityId, loudness)` ile bir tick'lik hearing
  stimulus'u tuketir ve LOS icin host'un `PhysicsSubsystem.staticBlockerAabbs()`
  yuzeyini kullanir.
- Runtime ve editor Play host'lari `AISubsystem` perception blocker provider'ini
  physics subsystem'e baglar; editor edit-mode AI gate davranisi korunur.
- `?debug` AI formatter'i en guclu sensed stimulus'u kisa metin satiri olarak
  gosterir (`sense enemy: sight:player d:4.0`).
- Test: sight radius/FOV/LOS, hearing loudness attenuation, `AISubsystem`
  perception snapshot/noise tuketimi ve debug formatter kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`622 checks passed`), `npm.cmd run build:verify` yesil.

Tamamlanan Faz 4 Behavior Tree perception service notu (2026-07-06):

- `createDefaultAiServiceRegistry()` eklendi ve `AISubsystem` varsayilan service
  registry olarak bunu kullanir.
- Built-in `forge.updatePerceptionBlackboard` service'i controller'in runtime
  perception snapshot'indeki en guclu sight/hearing stimulus'larini authored
  Blackboard key'lerine yazar:
  `targetKey`, `hasLineOfSightKey`, `lastKnownPositionKey`,
  `lastHeardPositionKey`, `lastHeardSourceKey`.
- Sight kayboldugunda `hasLineOfSightKey` false olur; son target silinmez.
  Hearing stimulus'u bir tick'lik event olarak tuketilir, ancak service
  `lastHeardPosition` / `lastHeardSource` blackboard degerlerini kalici runtime
  hafiza olarak gunceller.
- Test: runner-level service write, `AISubsystem` noise -> Blackboard
  `lastHeardPosition` akisi kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`624 checks passed`).

Tamamlanan Faz 4 target-lost grace notu (2026-07-06):

- `AIController` perception config'i `targetLostGraceSeconds` alanini okuyabilir.
  Deger verilmezse onceki anlik sight davranisi korunur.
- `AISubsystem`, aktif sight kesildiginde son sight stimulus'unu tanimli grace
  suresi boyunca `lineOfSight: false` olarak tutar; bu sayede service son hedef
  ve son bilinen pozisyonu kullanabilir ama `hasLineOfSight` false kalir.
- Grace state'i scene rebuild/clear ve perception config/transform yoklugunda
  temizlenir; sure doldugunda stimulus debug snapshot'tan duser.
- Test: hedef gorulur -> blocker LOS'u keser -> grace boyunca target korunur ve
  `hasLineOfSight=false` olur -> sure dolunca sight stimulus'u temizlenir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`625 checks passed`).

Tamamlanan Faz 4 script message gameplay stimulus notu (2026-07-06):

- `PerceptionSense` `damage`, `alert` ve `gameplay` sense'lerini tasiyabilir;
  script kaynakli stimulus'lar orijinal `eventType` bilgisini de korur.
- `AISubsystem.emitScriptStimulus()` mevcut `Damage.*`, `damage`, `alert`,
  `ui-action` ve `game-event` mesajlarini bir tick'lik perception stimulus'una
  cevirir. Target/source AI'yi dogrudan ilgilendiriyorsa mesafe siniri aranmaz;
  diger ajanlar authored `hearingRadius` icinde duyabilir.
- Runtime host ve editor Play host, `startSceneRuntime()` sonrasi
  `BehaviorSubsystem.subscribeScriptMessage()` ile bridge aboneliklerini yeniden
  kurar; scene teardown/dispose yolunda unsubscribe edilir.
- `forge.updatePerceptionBlackboard` opsiyonel
  `lastStimulusPositionKey`, `lastStimulusSourceKey`,
  `lastStimulusSenseKey`, `lastStimulusEventKey` parametrelerini destekler.
- Test: targeted `Damage.Apply` mesaji AI perception'a `damage` stimulus'u olarak
  duser, service blackboard stimulus key'lerini yazar ve stimulus sonraki tick'te
  debug snapshot'tan temizlenir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`626 checks passed`), `npm.cmd run build:verify` yesil.

Tamamlanan Faz 4 dominant/priority sense notu (2026-07-06):

- `engine/perception/perception.ts` icinde merkezi
  `PERCEPTION_SENSE_PRIORITY`, `comparePerceivedStimuli()` ve
  `dominantPerceivedStimulus()` helper'lari eklendi.
- Varsayilan oncelik sirasinda `damage` > `sight` > `alert` > `hearing` >
  `gameplay`; ayni sense icinde strength ve distance siralamasi korunur.
- `evaluatePerception()` ve `AISubsystem` birlesik perception listeleri ayni
  comparator'u kullanir; debug overlay'in ilk stimulus satiri da bu merkezi
  siralamayi takip eder.
- Test: zayif `damage` stimulus'unun guclu `hearing` stimulus'una dominant
  gelmesi ve ayni sense icinde strength secimi kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`627 checks passed`), `npm.cmd run build:verify` yesil.

Tamamlanan Faz 4 debug last known positions notu (2026-07-06):

- `formatAiDebug()` blackboard snapshot'indeki `lastKnown*`, `lastHeard*` ve
  `lastStimulus*` vec3 key'lerini kompakt `known <pawn>` satiri olarak gosterir.
- Genel vec3 blackboard key'leri debug overlay'e basilmiyor; sadece perception
  hafizasi gibi adlandirilmis pozisyonlar seciliyor ve ilk 3 girdiyle
  sinirlandiriliyor.
- Test: `lastKnownTargetPosition`, `lastHeardPosition`,
  `lastStimulusPosition` gorunur; `patrolPosition` gizli kalir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`628 checks passed`), `npm.cmd run build:verify` yesil.

Tamamlanan Faz 4 sight/hearing debug overlay notu (2026-07-06):

- `AIControllerDebugSnapshot` artik authored perception config'i, pawn
  pozisyonu ve forward vektorunu debug-only olarak tasir; runtime state yine
  layout'a yazilmaz.
- `engine/render-three/aiNavigationView.ts` icindeki ortak debug helper'i
  perception girdilerinden sight cone ve hearing radius wireframe'lerini
  uretir. Runtime `?debug` ve editor `Show > AI Navigation` ayni helper'i
  kullandigi icin navigation/path overlay ile perception overlay ayrismadan
  birlikte gorunur.
- Test: `AISubsystem` debug snapshot pose/config akisi ve
  `createAiNavigationView()` sight cone + hearing radius child uretimi kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`630 checks passed`), `npm.cmd run build:verify` yesil. Hedefli Playwright
  smoke `tests/smoke/ai-navigation-volume.spec.ts` ile editor Show overlay
  yuzeyi ve save/reload akisi browser'da dogrulandi.

### Faz 5 - EQS benzeri query sistemi

Hedef: "nereye gitmeli?", "en iyi cover neresi?", "hangi pickup yakin ve guvenli?"
gibi kararlar data-driven sorgu ile cozulsun.

- [x] `*.eqs.json` veya `*.query.json` asset schema tanimla (+ manifest
      `AssetType` ve save endpoint, Faz 2 pattern'i).
- [x] Generatorlar:
      - [x] points around querier
      - [x] grid around context
      - [x] actors by tag
      - [x] actors by interface/classRef
      - [x] smart objects by tag.
- [x] Contextler:
      - [x] querier
      - [x] target entity
      - [x] blackboard entity/position
      - [x] all actors of tag/interface.
- [x] Testler:
      - [x] distance min/max/score
      - [x] line of sight
      - [x] nav reachable
      - [x] occupancy/reservation free
      - [x] dot/FOV.
- [x] Behavior Tree task: `forge.runQueryToBlackboard`.
- [x] Query debug:
      - [x] generated candidates
      - [x] per-test score
      - [x] winner item
      - [x] failure reason.
- [ ] Editor ilk surum: query asset formu.
- [x] Runtime/editor `AI Navigation` viewport candidate overlay.
- [x] Performance: query tick interval, candidate cap, debug-only expensive details.
- [x] Test: best patrol point / best cover point deterministic sample.
- [x] Validation: full local gate ve Playwright AI Navigation smoke.

Tamamlanan Faz 5 query schema/runtime ilk dilim notu (2026-07-06):

- `engine/ai/queryAsset.ts` ve `engine/ai/queryRunner.ts` eklendi; query asset
  normalizer'i generator/context/test semasini canonical hale getiriyor.
- Manifest `aiQuery` tipi ve `.query.json` compound extension tanindi; Content
  Browser `aiQuery` stub'u ve `/__save-query` dev endpoint'i Faz 2 save pattern'i
  ile eklendi.
- Runtime runner ilk dilimde `pointsAroundQuerier`, `gridAroundContext`,
  `actorsByTag`, `distance`, `lineOfSight`, `navReachable` ve `dot` testlerini
  destekliyor.
- `AISubsystem` query asset library'sini Behavior Tree runner'a bagliyor;
  `forge.runQueryToBlackboard` task'i kazanan entity/pozisyonu Blackboard'a
  yazabiliyor.
- Test: query schema/save/manifest/content-new, scoring/filtering, nav reachable
  ve Behavior Tree task bridge kapsandi.

Tamamlanan Faz 5 query debug/generator genisletme notu (2026-07-06):

- Query runner adaylara per-test sonucunu (`pass`, skor, neden) ekliyor ve
  `AIController` son query sonucunu debug-only snapshot olarak sakliyor.
- `formatAiDebug()` son query icin kazanan, skor, aday sayisi veya failure
  reason satiri basiyor; runtime state layout'a yazilmiyor.
- Generator kapsami `actorsByInterface` ve `actorsByClassRef` ile genisledi;
  `targetEntity` context varsayilan `target` Blackboard entity key'ini veya
  opsiyonel authored key'i okuyabiliyor.
- Test: AISubsystem query debug snapshot, overlay formatter, interface/classRef
  generator ve target context kapsandi.

Tamamlanan Faz 5 query viewport overlay notu (2026-07-06):

- `createAiNavigationView()` query adaylarini AI Navigation overlay'e ekliyor:
  normal aday, failed-test aday ve winner marker'i ayri renk/adlarla ciziliyor.
- Runtime `?debug` ve editor `Show > AI Navigation`, `AISubsystem`
  debug snapshot'indaki son query adaylarini ayni render-three helper'ina
  bagliyor.
- Test: `createAiNavigationView` query candidate/failed/winner marker'lari
  kapsandi; full local gate ve Playwright AI Navigation smoke gecti.

Tamamlanan Faz 5 all-actors context notu (2026-07-06):

- Query context semasi `allActorsWithTag` ve `allActorsWithInterface`
  destekliyor; tag/interface alanlari save normalizer tarafindan zorunlu
  dogrulaniyor.
- `gridAroundContext`, distance, line-of-sight, nav-reachable ve dot testleri
  coklu context referanslariyla calisiyor. Distance en yakin referansi, LOS/nav
  herhangi basarili referansi, dot ise en iyi aciyi kullanir.
- Test: tag/interface context normalizer hatalari ve deterministik best-cover
  secimi kapsandi.

Tamamlanan Faz 5 query performans notu (2026-07-06):

- `forge.runQueryToBlackboard` task'i opsiyonel `interval` veya
  `intervalSeconds` parametresiyle ayni query/resultKey icin son sonucu cache'ler.
  Aralik dolmadan pahali query runner tekrar cagrilmaz; son kazanan Blackboard'a
  yeniden yazilarak Behavior Tree akisi success/failure semantigini korur.
- Query asset `maxCandidates` cap'i runtime runner'da aday degerlendirmesini
  sinirlamaya devam eder; debug snapshot zaten top-N candidate ile kisitlidir.
- Test: cached query sonucu aralik icinde tekrar kullanilir, aralik dolunca query
  tekrar calisir ve Blackboard yeni kazanana guncellenir.

Tamamlanan Faz 5/6 Smart Object query/reservation ilk dilim notu (2026-07-06):

- `SmartObjectComponent` authored data olarak eklendi; tags, slots,
  interaction position, cooldown ve enabled alanlari okunuyor. `reservedBy`
  layout/actor asset'e yazilmiyor; runtime state olarak tutuluyor.
- `SmartObjectReservationStore` runtime-only query/claim/use/release/expire API
  sagliyor ve `AISubsystem` query calistirirken bu store'u runner'a bagliyor.
- Query semasi `smartObjectsByTag` generator'i ve `reservationFree` testini
  destekliyor; slot adaylari query debug snapshot'inda slot id tasiyabiliyor.
- `forge.runQueryToBlackboard` opsiyonel `slotResultKey` ile query winner slot
  id'sini Blackboard'a yazabiliyor.
- `forge.claimSmartObject` ve `forge.useSmartObject` Behavior Tree task'lari
  Blackboard entity/slot key'lerinden hedefi cozer; `use` basladiginda hedef
  actor'a `smart-object.use` veya authored `messageType` ile script message
  emit eder.
- Actor Script Editor add-component listesine `SmartObject` eklendi ve raw props
  ile baslanabilir varsayilan component data'si seed ediliyor.
- Test: SmartObject component reader, claim/use/release/expire davranisi ve
  rezerve edilmis slotlarin query'de elenmesi; Behavior Tree query -> claim ->
  use -> targeted message akisi kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`645 checks passed`), `npm.cmd run build:verify` yesil.

Tamamlanan Playground `AI_Test` demo notu (2026-07-06):

- `public/assets/starter-content/AI/AI_Test.blackboard.json` ve
  `AI_Test.behavior.json` eklendi; `AI_Test.actor.json` bu asset'lere baglandi.
- Behavior akisi: patrol noktalarinda yavas gezin, goruste oyuncunun canli
  pozisyonuna hizli kos, gorus kaybinda son bilinen noktayi arastir, saldiri
  menzilinde `ai.attack.intent` / `punch` mesaji emit et.
- `forge.updateTargetDistanceBlackboard` servisi hedef entity pozisyonundan
  `targetDistance`, `inAttackRange` ve opsiyonel live target position key'lerini
  yazar.
- `forge.moveToPosition` ve `forge.moveToBlackboard` task'lari opsiyonel
  `speed` parametresini runtime path-following intent'ine tasir; demo patrol ve
  chase hizlarini authored data ile ayirir.
- Ayni task'lar opsiyonel `acceptanceRadius` / `acceptance` parametresiyle
  varis toleransini path-following'e tasir; AI_Test patrol noktalarinda
  hedefe cok yakin kalip sonsuz yurumeye devam etmez.
- Runtime AI perception, sight kaynaklarini karakter/pawn/input-move entity'leri
  ile sinirlayabilir; Playground AI_Test statik prop'lari oyuncu hedefi sanmaz.
- AI controlled Actor Script character'lar TPS GameMode player seciminden
  filtrelenir; default player pawn Player Start'ta spawn/possess edilmeye devam
  eder.
- AI character locomotion animator'u CharacterMovement raporunu okuyup skeleton
  sidecar'daki anim-set/blend-space ile idle/walk/run secimini yapar.
- Not: George animasyon setinde punch montage yok; bu dilim saldiri kararini ve
  intent mesajini gosterir. Gercek punch animasyonu icin skeletal sidecar'a
  montage/clip tanimi eklenmeli.

Planlanan Target Point tabanli patrol route authoring checklist'i:

- [x] Unreal `Target Point` karsiligi genel amacli `TargetPoint` sahne aktoru
      tanimla; `Add Actor` menusuyle sahneye eklenebilsin.
- [x] Target Point editor/render temsili ekle: edit modda ikon/gizmo gorunsun,
      Play/runtime'da varsayilan olarak gizli kalsin.
- [x] Target Point Details panel alanlari:
      - [x] `name`
      - [x] `nextTargetPoint`
      - [x] `waitTime`
      - [x] `acceptanceRadius`
      - [x] `speedOverride`
      - [x] `patrolTag` veya `routeId`.
- [x] `nextTargetPoint` icin actor reference picker ekle; ayni level icindeki
      Target Point aktorlerini listeleyip secime izin versin.
- [x] Save/load validation: yeni Target Point layout alanlari
      `tools/saveValidator.ts` allowlist'ine eklensin ve round-trip testlensin.
- [x] Runtime query/lookup: Target Point entity'lerini id/tag/route bilgisiyle
      AI task'larinin okuyabilecegi generic indeks haline getir.
- [x] Behavior Tree task/service seti:
      - [x] `forge.setPatrolTarget`
      - [x] `forge.moveToPatrolTarget`
      - [x] `forge.advancePatrolTarget`
      - [x] hedef yoksa `stop`, `loop`, `nearest`, `failure` modlari.
- [x] Route baslangic authoring: Target Point aktorunde `startPoint` bayragi
      (Details "Start Point" checkbox). Isaretli nokta rotanin baslangicidir;
      isaretlenmezse runtime authored ilk noktaya duser. `setPatrolTarget`
      baslangici `targetId` > `mode: nearest` > start-flagli nokta > ilk nokta
      sirasiyla cozer. (Blackboard `currentPatrolTarget` / opsiyonel `lastKey`
      runtime ilerlemesini zaten tasiyor; ayri `patrolStartTarget` /
      `patrolRouteTag` alanlarina gerek kalmadi.)
- [x] Debug/viewport overlay: Target Point noktalarini, `next` baglantilarini,
      aktif AI hedefini ve rotayi `Show > AI Navigation` icinde ciz.
- [x] AI_Test demo refactoru: behavior JSON'daki sabit `moveToPosition`
      koordinatlari `setPatrolTarget` / `moveToPatrolTarget` /
      `advancePatrolTarget` (`mode: loop`) task'lariyla degistirildi; Playground
      `target-point-1 -> 2 -> 3 -> 1` rotasini okuyor ve `target-point-1`
      `startPoint` olarak isaretli.
- [ ] Ilerleme yolu: ilk surum tek `nextTargetPoint`; sonraki surumde
      `nextTargets[]` + agirlik/branch ile patrol graph destekle.
- [ ] Testler:
      - [x] Target Point save/load round-trip.
      - [x] `nextTargetPoint` referansi kirik oldugunda guvenli failure.
      - [x] patrol task'i hedefe varinca siradaki Target Point'e gecer.
      - [x] loop rota deterministik calisir.
      - [x] debug overlay route segmentlerini uretir.
- [ ] Validation: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`,
      `npm.cmd run build:verify`, Playwright `?editor` Add Actor + Details smoke
      ve runtime Playground patrol smoke.

Tamamlanan Target Point actor authoring ilk dilim notu (2026-07-06):

- `LayoutTargetPoint`, `resolveTargetPoint`, unique id/name helper'lari ve
  editor-only `createTargetPointObject()` marker'i eklendi.
- `Add Actor > Gameplay > Target Point`, Outliner/selection/picking/gizmo,
  Details panel alanlari ve undoable add/delete/edit akisi baglandi.
- `tools/saveValidator.ts` `targetPoints` allowlist'i authored patrol alanlarini
  round-trip eder; runtime state/unknown alanlar kayda gecmez.
- Test: Target Point defaults/unique helper, render marker ve save/load
  round-trip kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`656 checks passed`), `npm.cmd run build:verify` yesil, Playwright
  `target-point.spec.ts` editor Add Actor + Details save/reload smoke yesil.

Tamamlanan Target Point next picker dilim notu (2026-07-06):

- Details panelindeki `nextTargetPoint` serbest metin alani, sahnedeki diger
  Target Point aktorlerini listeleyen select picker'a cevrildi.
- Picker kendi Target Point'ini seceneklerden cikarir; eski/kirik authored id
  varsa `Missing: <id>` olarak gorunur ve kullanici degistirene kadar korunur.
- Playwright `target-point.spec.ts` iki Target Point olusturup ilk noktada
  `target-point-2` secimini save/reload sonrasi dogrular.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run build:verify` ve
  `npx.cmd playwright test target-point.spec.ts` yesil.

Tamamlanan Target Point runtime index + patrol task dilim notu (2026-07-07):

- `engine/ai/targetPoints.ts` eklendi; authored `LayoutTargetPoint` aktorleri
  `TargetPointEntry` kayitlarina donusturulur (`targetPointEntriesFromLayout`) ve
  `createTargetPointIndex` generic bir index sunar: `get`, `all`, `byTag`,
  `next` (single-link `nextTargetPoint`), `first`, planar `nearest`. Saf engine
  modulu; value importlar relative.
- `AISubsystem.setTargetPoints()` index'i yerinde swap eder; runner'lara stabil
  bir `targetPointsProxy` uzerinden gecirildigi icin patrol ilerlemesi kaybolmadan
  guncellenebilir. Runtime host (`RuntimeSceneApp`) ve editor Play host
  (`SceneApp`) `startSceneRuntime` oncesi `layout.targetPoints`'i besler; scene
  teardown/clear index'i bosaltir. AI runtime state layout'a yazilmaz.
- `AiTaskContext.targetPoints` yuzeyi + uc built-in task eklendi:
  - `forge.setPatrolTarget`: rota baslangicini secer (`targetId`, ya da
    `tag`/`routeId` + `first`/`nearest` mode); gecerli mevcut hedefi korur
    (`force` ile sifirlanir), opsiyonel `positionKey` ile pozisyonu da yazar.
  - `forge.moveToPatrolTarget`: mevcut hedefi cozer, authored
    `speedOverride`/`acceptanceRadius` (params override) ile `moveTo` cagirir;
    kirik/eksik id guvenli failure verir (move request atmaz).
  - `forge.advancePatrolTarget`: `nextTargetPoint`'i takip eder; rota bitince
    `mode` = `loop` (default, tag'in ilk noktasi) / `nearest` / `stop` / `failure`;
    opsiyonel `lastKey` onceki noktayi kaydeder.
- Test: layout mapping, index get/byTag/next/first/nearest (+ excludeId, dup id),
  setPatrolTarget seed/preserve, moveToPatrolTarget authored speed/acceptance +
  broken-ref failure, advancePatrolTarget next->loop determinizmi ve
  stop/failure/broken-ref modlari kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`662 checks passed`), `npm.cmd run build:verify` yesil. Kalan: AIController/
  Blackboard patrol authoring alanlari, `Show > AI Navigation` route overlay,
  AI_Test demo'nun sabit koordinatlardan Target Point rotasina tasinmasi ve
  Playwright patrol smoke.

Tamamlanan Target Point route overlay dilim notu (2026-07-07):

- `createAiNavigationView` yeni `routes` girisi aliyor
  (`AiTargetPointRouteView`): her Target Point icin cross marker, `next`
  noktasina yonlu link (ok basli) ve aktif AI hedefi icin highlight halkasi
  cizer. Rota pozisyonlari view bounds hesabina dahil edilir.
- Editor `Show > AI Navigation` ve runtime `?debug` ayni render helper'ina
  `layout.targetPoints`'ten uretilen route view'i besliyor. Aktif hedef,
  herhangi bir canli AI controller'in blackboard'unda string olarak tuttugu
  Target Point id'lerinden cikariliyor (patrol key adindan bagimsiz).
- Test: `createAiNavigationView` route marker (`ai-route-point`), link
  (`ai-route-link`) ve aktif highlight (`ai-route-active`) child'larini uretir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`663 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: AIController/Blackboard patrol authoring alanlari, AI_Test
  demo'nun Target Point rotasina tasinmasi ve Playwright patrol smoke.

Tamamlanan Target Point start-flag authoring dilim notu (2026-07-07):

- `LayoutTargetPoint.startPoint?: boolean` alani eklendi; `resolveTargetPoint` /
  `TARGET_POINT_DEFAULTS` (default false), `cloneTargetPoint` ve
  `tools/saveValidator.ts` allowlist'i (`startPoint === true` iken korunur, aksi
  halde dusurulur) round-trip eder.
- Details paneli "Start Point" checkbox'i eklendi. Isaretlemek undoable; ayni
  `patrolTag` grubundaki diger start bayraklarini temizler (rota basina tek
  baslangic). `setTargetPointStart` tum noktalari yerinde mutasyonla tek komutta
  gunceller, dizi kimligini korur.
- Runtime `TargetPointEntry.startPoint` + `TargetPointIndex.start(tag?)`
  (authored sirada ilk bayrakli nokta) eklendi. `resolvePatrolStart` artik
  `targetId` > `mode: nearest` > `start()` > `first()` sirasiyla cozer, boylece
  AI_Test `setPatrolTarget` sabit id olmadan isaretli baslangictan basliyor.
- AI_Test behavior JSON sabit `targetId`'yi biraktigi icin start bayragina
  dayaniyor; Playground `target-point-1` `startPoint: true`.
- Test: `index.start` tag-scoped/none-flagged, `setPatrolTarget` start-flag
  tercihi, `startPoint` layout mapping ve save allowlist round-trip/false-drop
  kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`667 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: Playwright `?editor` Start Point toggle smoke ve runtime patrol
  smoke.

Planlanan AI Navigation clearance / agent radius checklist'i:

- [x] Unreal/Recast `Agent Radius` karsiligi icin Forge navigation sozlesmesini
      netlestir: path noktasi capsule merkezi icindir; engeller agent radius +
      ek guvenlik payi kadar erozyona ugratilmis kabul edilir.
      (`engine/navigation/gridNavigation.ts` modul doc'una yazildi.)
- [x] `NavAgent` modeline optional `clearancePadding` ekle; effective blocker
      sisirme mesafesi `agent.radius + clearancePadding + gridSafetyMargin`
      olarak hesaplansin.
- [x] `gridSafetyMargin` icin cell size kaynakli hata payini tanimla
      (baslangic onerisi: `cellSize * 0.5`) ve testlerle kilitle. (Opsiyonel
      `PathRequest.safetyMargin` override; default `cellSize * 0.5`.)
- [x] AIController `navAgent` props/Details alanlarina `clearancePadding`
      ekle; varsayilan degeri dar koridorlari tamamen kapatmayacak sekilde
      dusuk tut (onerilen ilk deger: `0.1` veya `0.15`). (`AINavAgentConfig`
      alani + reader; default component props seed'inde `clearancePadding: 0.1`.
      navAgent tuning diger alanlar gibi opak props olarak edit ediliyor; ayri
      dedicated Details widget'i henuz yok.)
- [x] `findGridPath` icinde blocker passability testleri effective radius ile
      calissin; authored nav bounds da ayni effective radius ile iceriden
      daraltilsin.
- [x] Ara waypoint varis toleransini final hedef toleransindan ayir:
      - [x] `acceptanceRadius` sadece final goal icin kullanilsin.
      - [x] ara waypoint gecisi `intermediateWaypointAcceptance` ile sinirli
            kalsin (onerilen ilk deger: `min(cellSize * 0.35, 0.2)`).
- [x] Path compression guvenli hale gelsin:
      - [x] iki waypoint arasindaki duz segment effective radius ile sisirilmis
            blocker'lari kesiyorsa ara grid noktalarini koru.
      - [x] segment-safe compression testi ekle.
- [x] Debug/viewport overlay:
      - [x] raw static blocker AABB'leri ayri renkte goster.
      - [x] inflated/eroded forbidden alanlari ayri renkte goster.
      - [x] path segmenti clearance ihlali yapiyorsa kirmizi/turuncu ciz.
      - [x] secili AI icin agent radius + clearance halkasi ciz.
- [x] Path cost iyilestirmesi:
      - [x] nearest-obstacle distance veya clearance score hesapla.
      - [x] A* maliyetine duvara yakin hucreler icin ek cost ekle.
      - [x] AI mecbur kalmadikca koridorun ortasina yakin rota secsin.
- [x] Testler:
      - [x] dar kose path'i capsule radius + clearance kadar uzak waypoint
            uretir.
      - [x] clearance cok buyukse dar gecit failure verir.
      - [x] final acceptance buyuk olsa bile ara waypoint erken atlanip kose
            kesilmez.
      - [x] path compression duvar kosesi uzerinden shortcut uretmez.
      - [x] debug overlay inflated blocker segmentlerini uretir.
      - [x] debug overlay clearance ihlali yapan path segmentini vurgular.
      - [x] debug overlay secili AI agent radius + clearance halkasini uretir.
      - [x] path cost genis koridorda duvar dibi yerine orta hatta yaklasir.
- [x] Validation: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`,
      `npm.cmd run build:verify`, Playwright `?editor` AI Navigation overlay
      smoke ve runtime Playground kose-donus smoke.

Tamamlanan AI Navigation clearance / effective radius ilk dilim notu (2026-07-07):

- `engine/navigation/gridNavigation.ts` navigation sozlesmesi netlestirildi:
  path noktasi capsule merkezidir, engeller `effectiveRadius = agent.radius +
  agent.clearancePadding + safetyMargin` kadar erozyona ugrar. `NavAgent`'a
  optional `clearancePadding` (default 0) ve `PathRequest`'e optional
  `safetyMargin` (default `cellSize * 0.5`, `0` ile kapatilabilir) eklendi.
- `findGridPath` blocker passability testleri ve authored nav bounds erozyonu
  artik effective radius kullaniyor; mevcut path-around/goal-blocked/authored-
  bounds ve query `navReachable` testleri yeni default margin ile yesil kaldi.
- `AINavAgentConfig.clearancePadding` alani + `readNavAgentConfig` okumasi
  eklendi; `RuntimeSceneApp.aiNavAgentForEntity` AIController navAgent'tan
  clearance'i path request'e tasiyor. Editor default component props seed'i
  `clearancePadding: 0.1` ile geliyor (opak props). Runtime AI state layout'a
  yazilmaz.
- Test: safetyMargin ve clearancePadding'in bir seridi lane'i kapatmasi (open
  vs shut) deterministik olarak kilitlendi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`669 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS. Kalan: final vs ara waypoint acceptance
  ayrimi, segment-safe path compression, clearance-aware path cost / koridor
  ortalama, ve debug overlay'de raw vs eroded blocker + agent clearance halkasi.

Tamamlanan waypoint acceptance ayrimi dilim notu (2026-07-07):

- `engine/navigation/gridNavigation.ts` icine saf, DOM'suz `advanceWaypoint`
  (+ `WaypointAcceptance` / `WaypointAdvance`) helper'i eklendi. Path-follower
  cursor'unu, her waypoint icin ayri kabul yariçapiyla ilerletir: ara
  waypoint'ler `intermediate` (dar), sadece final hedef authored `final`
  (`acceptanceRadius`) yariçapini kullanir. Boylece cömert bir final acceptance,
  ajanin bir kose waypoint'ini erken atlayip sisirilmis blocker'i kesmesine yol
  acmaz.
- `RuntimeSceneApp.aiMoveIntentForEntity` waypoint ilerletme dongusu bu helper'a
  tasindi; `AI_INTERMEDIATE_WAYPOINT_ACCEPTANCE = min(cellSize * 0.35, 0.2)`
  sabiti eklendi. Final goal acceptance davranisi (authored `acceptanceRadius`)
  degismedi.
- Test: `advanceWaypoint` cömert final radius'a ragmen ara kose waypoint'ini
  korur, kose'ye varinca hedefe ilerler ama final acceptance dolana kadar
  "arrived" olmaz, final hedef cömert yariçapi onurlandirir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`670 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: segment-safe path compression, clearance-aware path cost /
  koridor ortalama, ve debug overlay'de raw vs eroded blocker + clearance
  halkasi.

Tamamlanan segment-safe path compression dilim notu (2026-07-07):

- `findGridPath` artik raw grid hucre merkezlerini compression girdisine dahil
  ediyor; gercek `start`/`goal` grid merkezinde olmadiginda ilk/son segmentin
  planlanan koridoru kisaltip blocker kosesinden gecmesi engelleniyor.
- Compression sadece anchor -> aday waypoint segmenti effective-radius ile
  sisirilmis blocker'lara carpmiyor ve authored bounds icinde kaliyorsa ara
  noktayi atliyor. Segment guvensizse ilgili grid noktasi korunuyor.
- Test: ince blocker kosesinde eski compression'in uretebilecegi shortcut
  senaryosu `findGridPath` ustunden kilitlendi; uretilen tum segmentlerin
  blocker'a carpmadigi dogrulaniyor.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`671 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: clearance-aware path cost / koridor ortalama, debug overlay'de
  raw vs eroded blocker + clearance halkasi ve Playwright runtime/editor smoke.

Tamamlanan AI Navigation debug overlay clearance ilk dilim notu (2026-07-07):

- Shared `createAiNavigationView` render helper'i `inflatedBlockers` ve
  `agentClearances` girdilerini aliyor; raw blocker footprint, inflated
  forbidden footprint ve AI clearance halkasi ayri object/color olarak uretilir.
- Runtime `?debug` snapshot'i path-following yapan ajanlar icin gercek effective
  clearance'i (`agent.radius + clearancePadding + cellSize * 0.5`) hesaplar;
  blocker footprint'leri aktif ajanlar arasindaki en buyuk clearance ile
  sisirilmis debug alanina cevrilir.
- Editor `Show > AI Navigation`, edit modda varsayilan Forge ajan clearance'i
  ile inflated blocker alanlarini gosterir; Play modda canli AI debug
  pozisyonlari icin clearance halkalari cizer. Secili AI'ya ozel tek halka ve
  path-segment violation renklendirmesi sonraki debug dilimine kaldi.
- Test: `createAiNavigationView` raw blocker, inflated blocker ve agent
  clearance ring object'lerini uretir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`672 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: secili AI'ya ozel clearance halkasi, clearance ihlali yapan
  path segmenti renklendirmesi, clearance-aware path cost / koridor ortalama ve
  Playwright runtime/editor smoke.

Tamamlanan AI Navigation debug overlay path clearance violation dilim notu (2026-07-07):

- `createAiNavigationView` path segmentlerini `inflatedBlockers` ile 2D segment
  vs AABB testi uzerinden karsilastirir; ihlal eden segmentler mevcut path
  cizgisinin ustune `ai-nav-path-clearance-violation` turuncu overlay olarak
  bindirilir.
- Normal path rengi/status cizimi korunur; bu dilim sadece debug gorseli
  ekler, pathfinding ya da runtime hareket davranisini degistirmez.
- Test: inflated forbidden alanindan gecen follower path'i base path'i
  korurken violation overlay object'i uretir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`673 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan: secili AI'ya ozel clearance halkasi, clearance-aware path cost /
  koridor ortalama ve Playwright runtime/editor smoke.

Tamamlanan AI Navigation debug overlay selected-agent radius/clearance dilim notu (2026-07-07):

- `AiNavAgentClearanceView` artik `agentRadius` ve `selected` girdilerini tasir;
  selected AI icin normal clearance halkasina ek olarak
  `ai-nav-selected-agent-radius` ve `ai-nav-selected-agent-clearance` object'leri
  uretilir.
- Editor `Show > AI Navigation`, aktif actor/character selection id'sini AI
  controller pawn entity id'siyle eslestirir ve selection degisince overlay'i
  yeniler.
- Runtime debug snapshot'i path-following ajanlar icin gercek agent radius ve
  effective clearance'i beslemeye devam eder; runtime selection olmadigi icin
  selected highlight editor Play/Show yuzeyine aittir.
- Test: selected AI radius + clearance ring object'leri kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`674 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS. Kalan: Playwright runtime/editor smoke.

Tamamlanan AI Navigation path cost iyilestirme dilim notu (2026-07-07):

- `findGridPath` passable hucre setini degistirmeden, inflated blocker'a yakin
  hucreler icin mesafe tabanli ek maliyet hesaplar. Bu, dar gecitleri kapatmaz;
  yalnizca alternatif rota varsa duvar dibini daha pahali yapar.
- Clearance pressure, hucrenin inflated AABB'ye en yakin 2D mesafesinden
  turetilir ve A* `g` maliyetine eklenir; hesaplar coord-key cache ile tekrar
  kullanilir.
- Test: genis koridorda start/goal duvar dibinde olsa bile rota orta hatta
  yaklasir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`675 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS. Kalan: Playwright runtime/editor
  smoke.

Tamamlanan AI Navigation clearance test hardening notu (2026-07-07):

- Dar kose regression'i, capsule radius + clearance ile sisirilmis blocker
  alanina waypoint ya da segment girmedigini dogrular.
- Dar gecit failure maddesi mevcut `clearance padding erodes obstacles by extra
  slack` testiyle; buyuk clearance padding'in gecidi kapattigi kapsandi.
- Buyuk final acceptance maddesi mevcut `advanceWaypoint keeps intermediate
  waypoints tight and honors the final acceptance` testiyle; ara waypoint'in
  final acceptance tarafindan erken atlanmadigi kapsandi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`676 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS.

Tamamlanan AI Navigation clearance Playwright smoke notu (2026-07-07):

- `tests/smoke/ai-navigation-clearance.spec.ts`, editor `Show > AI Navigation`
  toggle/canvas/browser-error smoke ve runtime patrol sahnesinde debug `ai nav`
  + `following wp:n/m` smoke kapsar.
- Playwright global setup/teardown, takipli smoke fixture dosyalarini silmeden
  onceki icerigi geri yukleyecek sekilde sertlestirildi.
- Dogrulama: hedefli `npx.cmd playwright test
  tests/smoke/ai-navigation-clearance.spec.ts` yesil (`2 passed`);
  `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`676 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS. Full `npm.cmd run smoke:browser`
  denemesi arac zaman asimina takildi; hedefli clearance smoke ve local gate
  yesil.

### Faz 6 - Smart Objects

Hedef: Level'daki kullanilabilir aktiviteleri AI ve oyuncu icin ortak, rezerve
edilebilir data haline getirmek.

- [x] `SmartObjectComponent` ekle (mevcut `InteractionComponent` ile iliskisini
      netlestir: interaction oyuncu-tetiklemeli tek atim, smart object
      rezerve edilebilir slot):
      - [x] tags
      - [x] slots
      - [x] interaction position
      - [x] cooldown
      - [x] reservedBy (runtime-only reservation store; asset'e yazilmaz).
- [x] Runtime reservation API:
      - [x] query
      - [x] claim
      - [x] use
      - [x] release
      - [x] expire.
- [x] EQS generator: smart objects by tag/search radius.
- [x] Behavior Tree task: `forge.claimSmartObject`, `forge.useSmartObject`.
- [x] Message bridge: use baslayinca actor script message emit et.
- [ ] Editor marker/Details UI: slot gizmo, tag editor, reservation debug.
- [x] Test: iki ajan ayni slotu ayni anda alamaz.
- [x] Test: claim timeout release eder.
- [x] Validation: TypeScript, engine tests, build verify.

### Faz 7 - AI asset authoring ve Content Browser entegrasyonu

Hedef: AI sistemi kodla calismakla kalmasin, editor icinde uretilip
baglanabilsin.

- [~] Content Browser create menu (Faz 2'de eklenen manifest `AssetType`
      degerleri uzerine kurulur):
      - [x] Blackboard (`AI Blackboard`)
      - [x] Behavior Tree (`AI Behavior Tree`)
      - [x] EQS Query (`AI Query (EQS)`)
      - [ ] ileride State Tree.
- [~] Actor Script Editor:
      - [x] AIController component add/remove (Faz 1 generic add-component listesi).
      - [x] behavior tree picker (Details `Behavior Tree` select).
      - [x] blackboard picker (Details `Blackboard` select).
      - [x] perception/nav agent settings (Details number field'lari; artik raw
            props gerekmez).
- [x] Behavior Tree Editor v1 (modal, Content Browser double-click / Open):
      - [x] tree outline (composite/task/wait/subtree + decorator/service chips),
            now selectable (click a node row to edit it).
      - [x] add/remove/reorder node (Add Child kind picker / Remove / Move up /
            Move down toolbar on the selected node).
      - [x] node details panel (kind/id + kind-specific task/seconds/behavior
            fields; engine normalizer re-validated live + on save).
      - [x] decorator/service *form* authoring (blackboard/distance/cooldown/
            hasPerceptionStimulus decorators + service name/interval, add/remove/
            convert per node). Only task/service `params` + blackboard vec3 values
            remain raw-JSON edits.
      - [x] validation errors (engine `normalizeAiBehaviorTreeAsset`).
- [~] Runtime debug inspector (`?debug` overlay `formatAiInspector`, focused
      controller):
      - [x] selected AI actor blackboard values (full key/kind/value list)
      - [x] active behavior path (status/elapsed/failed decorator + `a > b > c`)
      - [x] perception stimuli (sense/source/distance/strength/LOS list)
      - [x] path/query overlay toggles (already via runtime `?debug` +
            editor `Show > AI Navigation` nav/perception/query draws).
      - [ ] interactive per-actor selection / dedicated DOM panel (later; the
            focus rule is currently deterministic — first controller sensing a
            target, else the first controller).
- [ ] Save validation: tum yeni sidecar formatlari `tools/saveValidator.ts`
      icinde engine normalizer'lari yeniden kullanarak dogrulanmali; olasi yeni
      layout alanlari icin `applyTransformFields` allowlist gotcha'si gecerli.
- [ ] Security: AI-generated behavior stublari, dev endpoint veya file write
      degisiklikleri icin Codex Security diff scan calistirmayi planla (Codex
      oturumlari icin handoff notu).
- [ ] Validation: full local gate + Playwright `?editor` smoke.

Tamamlanan Faz 7 Content Browser AI create menu dilim notu (2026-07-07):

- `src/project/ProjectAssetTree.ts` client `ContentNewKind` union'i
  `blackboard` / `behaviorTree` / `aiQuery` ile genisletildi; `createProjectContent`
  bunlari mevcut `/__content-new` endpoint'ine gecirir (server tarafi Faz 2'de
  zaten stub + `AI/` klasor + manifest register + validator ile hazirdi ve
  `resolveContentNewFile` icin test kapsamindaydi).
- `src/editor/EditorUi.ts` `CONTENT_NEW_ITEMS` listesine `AI Blackboard`,
  `AI Behavior Tree`, `AI Query (EQS)` girisleri eklendi; `createContent` prompt
  etiketi menu label'indan turetiliyor (Script'in "Actor Script" ozel durumu
  korunuyor).
- Test: `tests/smoke/content-new-ai.spec.ts` yan etkisiz smoke — content drawer
  acilir, create context menu tetiklenir ve uc AI girisi dogrulanir; dosya
  yaratilmaz, temizlik gerekmez.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run build:verify` yesil (verify:dist
  --strict PASS, editor stringleri game bundle'a sizmaz), hedefli
  `npx.cmd playwright test tests/smoke/content-new-ai.spec.ts` yesil (`1 passed`).
  Kalan Faz 7: Actor Script Editor AIController picker'lari, Behavior Tree Editor
  v1, runtime debug inspector.

Tamamlanan Faz 7 Actor Script Editor AIController picker dilim notu (2026-07-07):

- `src/editor/ActorScriptEditor.ts` AIController component'i icin iki asset picker
  eklendi: `Behavior Tree` (`props.behaviorTree`) ve `Blackboard`
  (`props.blackboard`). Mevcut MeshRenderer mesh picker kalibi birebir izlendi:
  `aiControllerFields` render + `assetPathPickerField` (deger = asset **path**,
  cunku `readAIControllerComponent` path okur) + `bindAIControllerDetails` wiring;
  bilinmeyen/elle girilmis path `(unknown)` secenegi olarak korunur, secim
  temizlenince key silinir. Perception/nav agent tuning halen Advanced raw props.
- Picker adaylari `options.assets` manifest listesinden `assetType`
  (`behaviorTree` / `blackboard`) ile filtrelenir; AIController component ekle/
  cikar zaten Faz 1 generic add-component listesinden geliyordu.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run build:verify` yesil
  (verify:dist --strict PASS — editor picker kodu game bundle'a sizmaz).
  Not: Actor editor'u acan uctan uca Playwright smoke bu ortamda cold-vite
  editor derlemesi + tekrarli kosu yavasligi nedeniyle kararsiz oldugundan
  (`smoke:browser` da gecmiste zaman asimina ugramisti) eklenmedi; degisiklik
  test edilmis mesh picker kalibinin birebir aynasi ve runtime reader ayni prop
  key'lerini kullaniyor. Yan etkisiz `content-new-ai` smoke editor boot + content
  browser akisini ayrica dogruluyor.

Tamamlanan Faz 7 Actor Script Editor perception/nav-agent Details dilim notu (2026-07-08):

- `src/editor/ActorScriptEditor.ts` AIController component'ine iki dedicated
  Details bolumu eklendi: `Perception` (`sightRadius`, `nearSightRadius`,
  `fieldOfViewDeg`, `hearingRadius`, `targetLostGraceSeconds`) ve `Nav Agent`
  (`radius`, `height`, `maxSpeed`, `clearancePadding`). Boylece bu tuning artik
  Advanced raw props JSON'undan degil, mevcut `numberField` kalibindaki number
  input'lardan yapiliyor.
- Alanlar nested `props.perception` / `props.navAgent` object'ine yazar
  (`data-as-ai-perception-num` / `data-as-ai-nav-num` + yeni `readObjectProp`
  helper'i object yoksa yerinde seed eder); bu tam olarak
  `readAIControllerComponent` -> `readPerceptionConfig` / `readNavAgentConfig`
  key'leridir, dolayisiyla opak component props uzerinden save round-trip eder.
- Commit on change + `renderDetails()` ile raw-props view senkron kalir; asset
  path picker'lari (behavior/blackboard) onceki gibi calisir.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`704 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS — editor picker kodu game bundle'a sizmaz). Editor uctan uca Playwright
  smoke onceki AIController picker dilimindeki cold-vite kararsizligi nedeniyle
  eklenmedi; degisiklik test edilmis numberField kalibinin aynasi ve runtime
  reader ayni key'leri okur. Kalan Faz 7: Behavior Tree Editor v1, runtime debug
  inspector.

Tamamlanan Faz 7 Behavior Tree Editor v1 (outline + validation) dilim notu (2026-07-08):

- `src/editor/BehaviorTreeEditor.ts` (+ `behaviorTreeStore.ts`, `.bte-*` CSS)
  eklendi: `*.behavior.json` icin Content Browser double-click / "Open" ile acilan
  modal editor. Diger asset editorleri gibi `?editor` dinamik importunun arkasinda
  (game bundle'a sizmaz).
- Sol panel yapisal outline: composite/task/wait/subtree agaci + her node icin
  decorator ve service chip'leri; sag panel raw-JSON authoring alani. Her
  duzenlemede metin parse edilip engine `normalizeAiBehaviorTreeAsset`'ten
  gecirilir (save endpoint'inin kullandigi ayni validator), boylece outline ve
  validation panel her zaman kaydedilecek sekli yansitir.
- Save, parse edilmis objeyi `/__save-behavior`'a gonderir; sunucu yeniden
  normalize eder, gecersiz agac descriptive hata ile save'i bloklar. Node-form
  CRUD (add/remove/reorder + per-node property alanlari) sonraki dilim; v1
  raw-JSON tabanli oldugu icin test edilmis normalizer ve guard'li endpoint
  yeniden kullanilir, yeni save yuzeyi yok.
- Wiring: `contentPanel.ts` `openBehaviorTreeEditor` + `behaviorTree` dblclick,
  `EditorUi.ts` iki options object + `assetEditorOpener` case + dinamik import
  metodu.
- Test: `tests/smoke/behavior-tree-editor.spec.ts` (yan etkisiz, read-only) —
  editor gercek `AI_Test.behavior.json`'i acar, root selector + service chip
  outline'ini ve `✓ Valid` durumunu dogrular, gecersiz JSON'da validation error'a
  doner, browser error yok. Hedefli `npx.cmd playwright test
  behavior-tree-editor.spec.ts` yesil (`1 passed`).
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`704 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS). Kalan Faz 7: BT Editor node-form CRUD/reorder + node details, runtime
  debug inspector.

Tamamlanan Faz 7 Behavior Tree Editor node-form CRUD/node details dilim notu (2026-07-08):

- `src/editor/BehaviorTreeEditor.ts` outline node'lari artik secilebilir: her
  `<li class="bte-node">` `data-bte-path` (root'tan cocuk index yolu) tasir,
  delegated click en icteki node'u secer (`closest` nested cocugu ust node'a
  tercih eder), secili satir `.is-selected` ile vurgulanir. Acilista root
  otomatik secili gelir.
- Sag panel yeniden yapilandirildi (`.bte-raw-wrap` -> `.bte-right`): ustte
  **Node Details** formu, altta **Asset JSON** raw pane. Form secili node'un
  `kind` (select, kind donusumu), `id` ve kind-ozel alanlarini (`task` /
  `seconds` / `behavior`) editler; composite icin cocuk sayisi + decorator/service
  sayilari ipucu satiri gosterilir (bunlarin *form* authoring'i sonraki dilim,
  hala JSON pane'de editleniyor).
- Toolbar: **Add Child** (kind picker `<select>` + buton, sadece selector/sequence
  aktif), **Remove** (root disinda), **Move up/down** (kardesler arasi, sinirda
  disabled). Alan degisiklikleri `change` event'inde commit eder (raw textarea
  fokusunu bozmadan).
- Mimari: raw JSON tek kaynak-of-truth olarak kalir. `mutateTree(fn)` raw'i parse
  edip deep-clone eder, `fn` secili node'u/agaci mutate eder ve yeni secim yolunu
  dondurur, sonra clone `JSON.stringify` ile raw pane'e geri yazilir + `renderDerived`
  ile outline/form/validation yenilenir. Boylece structured edit'ler de ayni
  `normalizeAiBehaviorTreeAsset` + `/__save-behavior` yolundan gecer; yeni save
  yuzeyi yok. Raw JSON elle editlenince stale secim otomatik dusurulur.
- CSS: `.bte-node-row` hover/`.is-selected`, `.bte-form*`, `.bte-btn`,
  `.bte-input` stilleri `editorUi.css`'e eklendi; kullanilmayan `.bte-raw-wrap`
  kaldirildi.
- Test: `tests/smoke/behavior-tree-editor.spec.ts` genisletildi (hala read-only,
  save yok) — gercek `AI_Test` acilir, kontrollu bir sequence agacina raw fill
  yapilir (bellek ici), sonra Add Child -> task edit -> Move up (raw'da sira
  degisimi dogrulanir) -> Remove -> root kind donusumu (selector) akisi surulur,
  her adimda `✓ Valid` korunur, browser error yok. Hedefli `npx.cmd playwright
  test behavior-tree-editor.spec.ts` yesil (`1 passed`).
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (`704 checks passed`), `npm.cmd run build:verify` (verify:imports + build +
  test:engine + verify:dist --strict) hepsi yesil — editor node-form kodu game
  bundle'a sizmaz. Kalan Faz 7: runtime debug inspector + decorator/service form
  authoring.

Tamamlanan Faz 7 Behavior Tree Editor decorator/service form authoring dilim notu (2026-07-08):

- `src/editor/BehaviorTreeEditor.ts` Node Details formu decorator ve service
  bolumleriyle genisletildi; bu iki liste artik raw-JSON yerine kart tabanli
  formdan editleniyor.
  - **Decorators:** kind picker ile `blackboard` / `distance` / `cooldown` /
    `hasPerceptionStimulus` eklenir; her kart kind-ozel alanlar gosterir
    (blackboard: key/op + equals/notEquals icin value; distance: key/op/value;
    cooldown: seconds; perception: sense/minStrength/requireLineOfSight). Kind
    donusumu `key`'i korur, yeni default seed'i (target/lte/2 vb.) tree'yi ekleme
    aninda gecerli tutar. Blackboard value alani JSON-ish parse eder
    (`true`/`42`/`"text"`/vec3), parse basarisizsa duz string'e duser.
  - **Services:** `+ Service` bir default (`forge.updatePerceptionBlackboard`)
    ekler; kart service adi + opsiyonel interval alani tasir. `params` haritalari
    form kapsami disinda (count hint + Asset JSON pane'de editlenir).
- Mimari degismedi: tum decorator/service mutasyonlari `mutateDecorators` /
  `mutateServices` -> `mutateTree` uzerinden raw JSON'u parse/clone/mutate/
  serialize eder; liste bosalinca `decorators`/`services` key'i node'dan silinir.
  Tek kaynak-of-truth raw JSON, tek validasyon `normalizeAiBehaviorTreeAsset`,
  tek save yolu `/__save-behavior` — yeni save yuzeyi yok.
- CSS: `.bte-section-sub`, `.bte-cards`, `.bte-card*`, `.bte-btn-sm` eklendi.
- Test: `tests/smoke/behavior-tree-editor.spec.ts` genisletildi (hala read-only):
  root'a distance decorator ekle -> chip + `✓ Valid` dogrula -> key form edit'i
  raw'a yansir -> service ekle -> chip dogrula -> decorator remove -> chip/card
  kaybolur, her adimda gecerli kalir, browser error yok. Hedefli
  `npx.cmd playwright test behavior-tree-editor.spec.ts` yesil (`1 passed`).
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`
  (`704 checks passed`), `npm.cmd run build:verify` (verify:dist --strict PASS —
  editor form kodu game bundle'a sizmaz), `npm.cmd run check:assets` PASS.
  Kalan Faz 7: runtime debug inspector.

Tamamlanan Faz 7 runtime debug inspector dilim notu (2026-07-08):

- `src/scene/debugStats.ts` icine saf `formatAiInspector(snapshot, topBlackboard,
  topStimuli)` formatter'i eklendi ve runtime `?debug` overlay zincirine
  `aiInspectorText` ile baglandi (`formatAiDebug` DOM'suz deseninin zengin
  kardesi). `formatAiDebug` her controller icin tek satirlik ozet verirken,
  inspector **tek odakli controller**'i tam detaya acar:
  - active behavior path: `lastStatus` + `elapsedSeconds` + `failedDecorator` +
    `a > b > c` yol zinciri.
  - blackboard: her key `key [kind] = value` (bool/number/string/vec3/entity/null
    tip-bazli compact render), `topBlackboard` (default 8) ile capped + "+N more".
  - perception: anlik stimuli listesi (`sense:source d:.. s:.. los/noLos`),
    `topStimuli` (default 4) ile capped.
  - query: mevcut `formatAiQueryDebug` ile son query sonucu.
- Odak kurali deterministik: stimulus algilayan ilk controller, yoksa ilk
  controller — kalabalik sahnede overlay bounded kalir. Subsystem gated off ise
  (editor edit mode canli deger tasimaz) ve controller yoksa `[]` doner, boylece
  `?editor&debug` overlay'i kirletmez; canli veri runtime `/?debug`'ta gorunur.
- Path/query overlay toggle'lari bu dilimde ayrica eklenmedi: runtime `?debug` ve
  editor `Show > AI Navigation` zaten nav grid, path polyline, perception sight
  cone/hearing radius ve query candidate/winner wireframe'lerini ciziyor
  (Faz 3/4/5 dilimleri). Interaktif per-actor secim + ayri DOM panel sonraki is.
- Test: `formatAiInspector expands the focused controller with values, path and
  stimuli` engine testi — iki controller'dan stimulus algilayani odaklar, tam
  path/bb/sense render'ini ve gated-off `[]` davranisini dogrular.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`705 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS — debug inspector runtime overlay kodu, editor'a bagimli degil),
  `npm.cmd run check:assets` PASS.

### Faz 8 - StateTree secenegi

Hedef: Behavior Tree'nin iyi olmadigi uzun omurlu state akislari icin StateTree
benzeri sistem.

- [~] `*.stateTree.json` schema:
      - [x] states
      - [x] selectors/transitions
      - [x] evaluators
      - [x] tasks
      - [ ] parameters/context data.
- [x] Runtime runner: active state path, transition guards, enter/tick/exit.
      (`engine/ai/stateTreeRunner.ts`: hiyerarsik selection, enter/exit memory
      temizligi, leaf-first transition oncelikligi, `postEvent` event kuyrugu.)
- [x] Behavior Tree ile ortak task/condition registry kullan. Enter/transition
      guard'lari ve BT decorator'lari ayni `engine/ai/aiConditions.ts`
      degerlendirmesinden gecer; her iki runner ayni `AiTaskRegistry` /
      `AiTaskContext` / `AiServiceRegistry` yuzeyini ve ayni
      `PRESERVE_TASK_MEMORY` task-memory yasam dongusunu paylasir.
- [ ] GameMode, boss fight, civilian routine, quest actor gibi use-case'leri
      Behavior Tree yerine StateTree ile modelle.
- [x] Editor ilk surum: nested state outline + transition table.
      (`src/editor/StateTreeEditor.ts`: modal editor, hiyerarsik **secilebilir**
      state outline + transition tablosu + raw-JSON authoring + engine normalizer
      validation + `/__save-state-tree` save. State Details formu id/add-child/
      remove/reorder + task CRUD + transition CRUD (to-dropdown + event) tasir;
      enter/transition guard `conditions` blackboard/distance/cooldown/perception
      kartlariyla editlenir; task `params` count-hint + raw kalir.)
- [x] Debug: active state, last transition reason, evaluator values. (Runner
      `getDebugSnapshot()` activePath + lastTransition {from,to,reason} + lastStatus
      uretir; subsystem dilimiyle `?debug` overlay'e `st` satiri (`formatAiDebug`)
      ve `formatAiInspector` state/last-transition blogu baglandi.)
- [x] Test: patrol -> alert -> chase -> search -> patrol state akisi. (Engine
      unit test; ayrica nested child selection + evaluator + paylasilan registry.)
- [~] Validation: full local gate + Playwright debug smoke. (`tsc`, `test:engine`
      709 check, `build:verify`, `check:assets` yesil; Playwright smoke
      runtime/editor dilimiyle gelecek.)

Tamamlanan Faz 8 StateTree asset schema/save/manifest notu (2026-07-08):

- `engine/ai/stateTreeAsset.ts` eklendi; `AiStateTreeAsset` = hiyerarsik
  `states` (nested `states`), `enter` guard'lari, `tasks`, guard'li
  `transitions` (`to` + opsiyonel `event` + `conditions`) ve global
  `evaluators`. Normalizer state id'lerini tekil zorunlu tutar ve her
  transition `to` hedefinin var olan bir state'e cozuldugunu dogrular.
- `engine/ai/behaviorAsset.ts` decorator/service/param normalizer'lari
  `normalizeAiDecorators` / `normalizeAiServices` / `normalizeAiParams` olarak
  re-export edildi; StateTree bunlari yeniden kullanir (condition/service
  sekli icin tek kaynak-of-truth).
- `engine/assets/manifest.ts`: `stateTree` AssetType + `.stateTree.json`
  compound extension siniflandirmasi.
- `/__save-state-tree` localhost-only dev endpoint'i (`vite.config.ts` +
  `WRITE_ENDPOINTS`) ve `validateSaveAiStateTreePayload` (`tools/saveValidator.ts`,
  ayni engine normalizer'ini yeniden kullanir, compound-ext + `..` guard'li).
- Content Browser: `stateTree` content-new kind'i (client `ContentNewKind`
  union'i + create menu "AI State Tree" girisi); stub minimal gecerli StateTree
  (`states: [{ id: "Idle" }]`).
- Test: normalizer hiyerarsik canonicalize + malformed (bos states, sema, tekil
  id, bilinmeyen transition hedefi, eksik id) reddi; content-new stub round-trip;
  save payload compound-ext dogrulamasi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`707 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS.

Tamamlanan Faz 8 StateTree runtime runner notu (2026-07-08):

- `engine/ai/stateTreeRunner.ts` eklendi (`AiStateTreeRunner`). Model: sibling
  state'ler `enter` guard'lariyla secilir (ilk gecen), aktif state ve aktif
  cocuklari her tick `tasks`'larini kok->yaprak calistirir, `transitions`
  guard'li (opsiyonel `event`) ve leaf-first oncelikli degerlendirilir. Aktif
  zincir degisince state memory'si (task memory + enter/transition cooldown)
  cikan state'lerde temizlenir. Global `evaluators` aktif state'ten bagimsiz,
  kendi interval'inde tik atar. `postEvent(name)` bir sonraki tick'te event'li
  transition'lari tetikler. Runtime memory controller basina/state basina ayri;
  authored asset immutable kalir.
- Paylasilan condition semantigi `engine/ai/aiConditions.ts`'e cikarildi
  (`aiDecoratorsPass` + blackboard/distance/cooldown/hasPerceptionStimulus).
  `behaviorRunner.ts` kendi private decorator metodlarini birakip bu tek
  kaynagi kullanacak sekilde refactor edildi (davranis ayni; tum mevcut BT
  testleri yesil). `PRESERVE_TASK_MEMORY` behaviorRunner'dan export edilip
  StateTree'de ayni task-memory yasam dongusu icin kullanildi.
- StateTree runner task/evaluator'lari `src/game/ai/tasks.ts`'in besledigi ayni
  `AiTaskRegistry` / `createDefaultAiServiceRegistry` uzerinden calisir; boylece
  `forge.moveToPosition`, `forge.sendMessage`, perception service'leri vb.
  BT ile birebir ayni implementasyondan gecer.
- `getDebugSnapshot()`: activePath (kok->yaprak id zinciri), lastStatus,
  lastTransition ({from, to, reason: "initial" | "conditions" | "event:<name>"}),
  elapsedSeconds.
- Test: `patrol -> alert -> chase -> search -> patrol` blackboard/event
  transition akisi; nested `Combat > Melee|Ranged` enter-condition secimi +
  evaluator blackboard yazimi + paylasilan task registry cagrisi.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`709 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS.

Tamamlanan Faz 8 subsystem/AIController wiring notu (2026-07-08):

- `AIControllerComponent` (`engine/scene/components.ts`) artik opsiyonel
  `stateTree` asset path'i tasir; `readAIControllerComponent` bunu okur.
  Component props opak JSON oldugu icin `.actor.json` save yolu ek allowlist
  gerektirmez.
- `AIController` (`engine/ai/aiController.ts`) `stateTreeAsset` option/field'i
  ve debug snapshot'ta `stateTreeAsset` + `stateTree` (runner debug) alanlarini
  tasir. `getDebugSnapshot(runner)` artik `{ behavior? , stateTree? }` alir.
- `AISubsystem` (`engine/ai/aiSubsystem.ts`) `AiAssetLibrary.stateTrees`
  map'ini yukler; runner store'u `behavior | stateTree` union entry'sine cevrildi.
  `rebuildRunners` her controller icin StateTree referansi cozulurse
  `AiStateTreeRunner`, aksi halde `AiBehaviorRunner` kurar (**StateTree her ikisi
  de authored ise kazanir**). Blackboard `component.blackboard ??
  stateTree.blackboard ?? behavior.blackboard` sirasiyla cozulur. Her iki runner
  ayni `runnerOptions()` (task/service registry, moveTo, world, targetPoints,
  smartObjects, query) yuzeyini paylasir.
- Runtime (`RuntimeSceneApp`) ve editor Play (`SceneApp`) host loader'lari
  manifest'teki `stateTree` asset'lerini `normalizeAiStateTreeAsset` ile yukleyip
  `setAssetLibrary({ ..., stateTrees })` ile besler.
- Debug: `formatAiDebug` StateTree controller'lari icin `st` satiri (status +
  elapsed + aktif leaf state) uretir; `formatAiInspector` odakli controller
  StateTree kullaniyorsa `st:` blogu (asset, aktif state path, last transition
  `from → to (reason)`) gosterir, aksi halde mevcut `bt:` blogu.
- Editor: Actor Script Editor AIController formuna State Tree asset picker'i
  (`data-as-ai-statetree`, mesh/behavior picker kalibi) eklendi; secim
  `props.stateTree`'ye yazilir, bilinmeyen/elle girilmis path korunur.
- Test: `AISubsystem runs a StateTree when the AIController references a stateTree
  asset` — StateTree behaviorTree'yi bastirir, blackboard StateTree asset'inden
  cozulur, tick guard transition'ini surer (Idle -> Alert), debug snapshot
  `stateTree` dolu / `behavior` null.
- Dogrulama: `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` yesil
  (`710 checks passed`), `npm.cmd run build:verify` yesil (verify:dist --strict
  PASS), `npm.cmd run check:assets` PASS. Playwright debug smoke kalan Faz 8
  isinde.

Tamamlanan Faz 8 StateTree Editor v1 notu (2026-07-08):

- `src/editor/stateTreeStore.ts` eklendi (behaviorTreeStore kalibi): `.stateTree.json`
  raw text loader (dosya yoksa/bozuksa duzenlenebilir kalir) + `/__save-state-tree`
  saver. Server payload'i `normalizeAiStateTreeAsset` ile yeniden dogrular.
- `src/editor/StateTreeEditor.ts` eklendi (BT Editor v1 ilk diliminin paraleli):
  modal overlay, sol tarafta **hiyerarsik state outline** (state id + task/
  transition/child rozetleri + enter-condition chip'leri), **transition tablosu**
  (tum state'lerin cikan gecisleri `from → to` + event chip / guard ozeti / `always`)
  ve validation paneli; sag tarafta raw-JSON textarea. Raw JSON tek kaynak-of-truth:
  her edit `normalizeAiStateTreeAsset`'ten gecer, outline/table/validation ondan
  turer. State/transition form CRUD bilincli olarak sonraki dilim (BT Editor ayni
  sekilde v1'de sadece outline+raw, node-form CRUD sonraki dilimdi).
- `ste-*` CSS blogu (`src/editor/editorUi.css`) eklendi; her editorun kendi
  prefix'li blogu oldugu konvansiyonu izlendi (mor "State Tree" temasi).
- Wiring: Content Browser `stateTree` item'i cift-tiklamada editoru acar
  (`contentPanel.ts` `openStateTreeEditor` opsiyonu + dblclick, `EditorUi`
  `assetEditorOpener` route'u + iki options binding'i + `openStateTreeEditor`
  dinamik-import metodu). Editor dinamik import arkasinda, game bundle'a girmez.
- Test: `tests/smoke/state-tree-editor.spec.ts` — editor acilir, hiyerarsik
  outline (Patrol/Alert/Look/Chase) + task rozeti, transition tablosu (guard'li
  Patrol→Alert + event Chase→Patrol), gecerli/gecersiz JSON validation gecisi ve
  browser error olmamasi dogrulanir (salt-okunur, kayit yok).
- Dogrulama: `npx.cmd tsc --noEmit` yesil, `npm.cmd run build:verify` yesil
  (verify:dist --strict PASS, 710 engine check), hedefli Playwright smoke PASS.

Tamamlanan Faz 8 StateTree Editor form CRUD notu (2026-07-08):

- `StateTreeEditor` outline'i **secilebilir** hale getirildi (`data-ste-path` =
  nested `states` indeksleri; delegated click en ic state'i secer) ve saga bir
  **State Details** formu eklendi (raw pane'in ustunde, BT Editor form+raw
  duzeni gibi).
- Form yetenekleri: id duzenleme; toolbar `+ Child State` / `Remove` (son
  top-level state'i silmeyi engeller) / `↑` / `↓`; **Tasks** karti CRUD (task
  adi input'u + params count-hint); **Transitions** karti CRUD (hedef state
  `<select>`'i + event input'u + guard-condition count-hint). Outline basligindaki
  `+ State` top-level state ekler.
- Tum yapisal edit'ler `mutateTree` uzerinden gecer: raw JSON parse -> deep clone
  -> mutate -> `normalizeAiStateTreeAsset`'li re-render + raw'a geri serialize.
  Raw JSON tek kaynak-of-truth kalir; enter/transition guard `conditions` ve task
  `params` bilincli olarak count-hint + raw duzenlenir (rich condition-card
  authoring paylasilan helper ile sonraki dilim).
- `renderDerived` gecici bozuk-JSON edit'lerinde secimi korur (yalniz gecerli
  ama stale path'lerde temizler), boylece JSON duzeltilince secim geri gelir.
- `ste-*` form CSS'i (toolbar/btn/card/input/secilebilir satir) eklendi.
- Test: `tests/smoke/state-tree-editor.spec.ts` add-child -> rename -> add-task
  -> add-transition -> remove -> reorder CRUD akisini ve her adimda normalizer
  validation'ini dogrulayacak sekilde genisletildi.
- Dogrulama: `npx.cmd tsc --noEmit` yesil, `npm.cmd run build:verify` yesil
  (verify:dist --strict PASS, 710 engine check), genisletilmis Playwright smoke
  PASS. BT Editor'e dokunulmadi (kendi smoke'u etkilenmez).

Tamamlanan Faz 8 StateTree condition-card authoring notu (2026-07-08):

- `StateTreeEditor` State Details formuna iki condition-card yuzeyi eklendi:
  secili state `enter` guard'lari ve her transition'in `conditions` guard'lari.
  Kartlar Behavior Tree decorator semantigiyle ayni condition seklini author eder:
  `blackboard`, `distance`, `cooldown`, `hasPerceptionStimulus`.
- Add/remove/convert/edit akislari raw JSON clone'unu mutate edip geri serialize
  eder; yeni save yuzeyi yok. Normalizer validation paneli her edit sonrasi ayni
  `normalizeAiStateTreeAsset` sonucunu gosterir.
- UI: `ste-input-sm`, `ste-card-subtitle`, `ste-cond-card` stilleri eklendi;
  condition kartlari transition kartlarinin icinde ayri hafif blok olarak kalir.
- Test: `tests/smoke/state-tree-editor.spec.ts` transition guard key editini,
  enter cooldown guard eklemeyi, raw JSON yansimasini ve validation'in yesil
  kalmasini dogrular.
- Dogrulama: `npx.cmd tsc --noEmit` yesil, hedefli Playwright StateTree editor
  smoke PASS, `npm.cmd run build:verify` yesil (710 engine check,
  verify:dist --strict PASS), `npm.cmd run check:assets` PASS (baseline
  thumbnail/sidecar warning'leriyle).

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

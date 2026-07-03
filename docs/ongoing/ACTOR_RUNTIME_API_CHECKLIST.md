# Actor Runtime API — Unreal Ortak Aktör Fonksiyonları Kapanış Planı

> Tarih: 2026-07-03
> Durum: Aktif plan. Kod henüz yazılmadı.
> Amaç: Unreal'ın her aktörde bulunan ortak blueprint fonksiyonları (Set
> Visibility, Destroy Actor, Spawn Actor, Set Timer, GetActorLocation…) ile
> Forge'un aktör-script/behavior yüzeyi karşılaştırıldı; eksik çıkan runtime
> yeteneklerini fazlara bölerek kapatmak.
> Kaynak analiz: `engine/scene/actorScript.ts` (event kind'lar),
> `engine/behavior/behaviorSubsystem.ts` (BehaviorContext/ScriptWorld/ScriptState),
> `engine/scene/actorInstance.ts` (instance→entity düzleştirme),
> `src/game/behaviors.ts` (kayıtlı davranışlar).
> Kapsam dışı: networking, AI sistemi (`docs/planned/AI_SYSTEM_RESEARCH_AND_PLAN.md`),
> hasar sisteminin oyun kuralları (yalnız mesaj konvansiyonu backlog'da).

---

## Durum Lejantı

- `[ ]` başlanmadı
- `[~]` devam ediyor (nerede durduğu Progress Log'da)
- `[x]` bitti ve doğrulandı

Her `[x]` öncesi değişmez gate (projenin yerleşik ritmi):

```bash
npx tsc --noEmit        # temiz olmalı
npm run test:engine     # tüm check'ler geçmeli
npm run build           # başarılı olmalı
# veya birleşik: npm run build:verify  (build + engine tests + strict dist scan)
```

Sınır kuralları (CLAUDE.md / ARCHITECTURE.md):

- `engine/*` editor/game import etmez; oyun kuralları `src/game/*`'da kalır.
  Yeni komut yüzeyleri **engine'de interface, host'ta (RuntimeSceneApp /
  SceneApp) implementasyon** desenini izler (mevcut `AudioBus` emsali).
- `ActorScriptDef`'e eklenen her yeni alan/event kind
  `normalizeActorScriptDef`'ten geçmek zorunda (saveValidator bunu yeniden
  kullanır); yeni event kind'lar `ACTOR_EVENT_KINDS` + `isActorEventKind` +
  editör picker'ına birlikte işlenir, yoksa kayıtta sessizce düşer.
- Runtime state (gizlenen/yok edilen aktörler dahil) asla layout dosyalarına
  yazılmaz — kalıcılık yalnız save-game snapshot kanalından
  (`getPersistentStateSnapshot`) akar. `Layout Data ≠ Save Game Data`.

---

## Araştırma Özeti — Unreal ↔ Forge Eşlemesi

Bizde zaten karşılığı olanlar (yeniden yapılmayacak):

| Unreal | Forge karşılığı |
|---|---|
| Event Tick | `BehaviorUpdate` her tick + `tick` event kind |
| SetActorLocation/Rotation/Scale, TeleportTo (self) | `context.transform` yerinde mutasyon |
| Overlap/Hit (polling) | `physics.contactsForEntity()`; interaction'da begin/end (`onInteractionOverlap`) |
| GetAllActorsOfClass / WithTag | `world.byClassRef / byTag / byName / withInterface / nearestWithInterface` |
| Blueprint Interface çağrısı | `interfaces` + mesajla çağrı (`Usable.Use` deseni) |
| Event Dispatcher / Custom Event | `dispatchers` + `messages.emit/send` + `messageBindings` |
| Possess | Game Mode possess akışı + `isPlayerControlled` |
| PlaySoundAtLocation | `context.audio.playOneShot` (spatial dahil) |

Eksikler ve bu plandaki yeri:

| Unreal | Bizde durum | Faz |
|---|---|---|
| SetActorHiddenInGame / SetVisibility | Yalnız `collectible`'a özel host sink'i | **A1** |
| DestroyActor | Yok (collectible bile silinmiyor, gizleniyor) | **A1** |
| SetTimer / Delay / ClearTimer | Yok — cooldown'lar elle dt sayıyor | **A2** |
| SetLifeSpan | Yok | **A2** |
| GetActorLocation (başka aktörün), GetDistanceTo, ForwardVector | Yok — `ScriptWorld` yalnız id döndürür | **A3** |
| Gerçek BeginPlay/EndPlay + Overlap Begin/End/Hit event'leri | Etiket var, semantik yok; ilk binding tek Behavior'a çöküyor | **A4** |
| SpawnActor (oyun ortası) | Yalnız sahne kuruluşunda | **A5** |
| SetActorEnableCollision, AddImpulse/Launch, ApplyDamage, runtime Attach/Detach, tick interval, Owner/Instigator | Yok | **A6 (backlog)** |

---

## Genel Bakış ve Önerilen Sıra

| # | Faz | Bağımlılık | Neden bu sırada |
|---|-----|-----------|-----------------|
| A1 | Aktör komut yüzeyi: Visibility + Destroy | — | En sık ihtiyaç; feature-başına host sink çoğalmasını durdurur; A2/A5'in temeli. |
| A2 | Timer / Delay / LifeSpan | A1 (yalnız lifeSpan→destroy) | Ucuz ve bağımsız; UE'de en çok kullanılan düğümlerden. |
| A3 | ScriptWorld veri erişimi | — | Salt-okunur, ucuz; AI-yazımlı behavior'ların ifade gücünü büyütür. |
| A4 | Event yönlendirme + çoklu binding (B4) | — | Veri modeli değişikliği; overlap/hit/beginPlay gerçek semantik kazanır. |
| A5 | Runtime SpawnActor | A1 (destroy simetrisi); A4 önerilir | En büyük iş; subsystem'lere tekil ekleme + render shell instantiation. |
| A6 | Backlog | tetikleyici bazlı | İhtiyaç doğunca tek tek çekilir. |

Önerilen akış: **A1 → A2 → A3 → A4 → A5**. A2 ve A3 birbirinden bağımsızdır,
A1 sonrası paralel/istenen sırada koşulabilir.

---

# A1 — Aktör Komut Yüzeyi: SetVisibility + Destroy

## Amaç

Behavior'ların herhangi bir aktörü genel bir API ile gizleyip/gösterip yok
edebilmesi. Bugün görünürlük yalnız özellik-başına host sink'leriyle var
(`onCollectibleCollected` → objeyi gizle, `onActorLightToggle` → ışığı kapat);
her yeni ihtiyaç yeni sink demek. Unreal karşılığı: `SetActorHiddenInGame`,
`DestroyActor`.

## Mevcut durum (kanıt)

- `BehaviorContext`'te aktörün render/yaşam döngüsüne dokunan hiçbir üye yok
  (`engine/behavior/behaviorSubsystem.ts:76-93`); tek yazılabilir şey kendi
  `transform`'u.
- Collectible gizleme host'ta özel yol: `RuntimeSceneApp` sink'i objeyi
  `visible=false` yapıyor (`src/scene/RuntimeSceneApp.ts` — collectible hide).
- Destroy hiç yok: "toplanan" pickup fizikte/behavior setinde yaşamaya devam
  ediyor, yalnız görünmüyor.
- Emsal desen hazır: `AudioBus` engine'de interface, host'ta implementasyon;
  komut yüzeyi aynı deseni izleyebilir.

## Karar noktası

**Seçenek A — tipli komut yüzeyi (öneri):** engine'de `ActorCommands`
interface'i (`context.actor`), BehaviorSubsystem komutları kuyruğa alır ve
tick sonunda host sink'ine teslim eder (deterministik: mutasyonlar tick
bitince uygulanır). Keşfedilebilir, tipli, `AudioBus` emsaliyle uyumlu.
**Seçenek B — ayrılmış script mesajları** (`Actor.SetVisibility` vb.): mevcut
mesaj busına biner ama stringly-typed'dır ve payload doğrulaması dağılır.
Öneri: **A**; mesaj tarafı istenirse üstüne ince bir köprü olarak eklenir.

## Checklist

- [x] **A1.1 — Engine komut çekirdeği:** `ActorCommands` interface'i
  (`setVisibility(visible: boolean)`, `destroy()`; hedef self) +
  `BehaviorContext.actor` alanı (opsiyonel yerine her zaman-mevcut yapıldı —
  subsystem her context'te sağlıyor; `messages`/`world`/`state` ile tutarlı).
  BehaviorSubsystem komutları tick içinde kuyruklar, message flush sonrası host
  sink'ine sıralı teslim eder. Destroy edilen entity aynı tick'ten sonra:
  instance listesinden, indekslerden, mesaj aboneliklerinden düşer; `runtimeState`
  korunur (persist markerı re-save için yaşar); host `physics.removeEntity` ile
  gövdeyi kaldırdığından sonraki contact sorguları boş döner.
- [x] **A1.2 — Host uygulaması:** `RuntimeSceneApp` `actorCommandSink`:
  visibility → `setActorObjectVisible` (actor instance objesi + instanced-static
  slot collapse yolu genelleştirildi); destroy → `destroyActorEntity`
  (`physics.removeEntity` + render objesi söküm + `actorObjects`/`actorMeshScales`/
  `characterRefs` temizliği). Engine tarafı behavior/mesaj temizliğini kendi yapar.
  `PhysicsSubsystem.removeEntity` eklendi (incremental; rapier gövdesi free +
  contact filtresi). `actorEntities` authored liste korunur (reload'da yeniden
  kurulur). Not: possessed character-parent aktör mid-play destroy'u A6 kapsamı
  (character movement/anim subsystem kaydı kalır); A1 hedefi trigger/pickup/efekt
  aktörleri.
- [x] **A1.3 — Kalıcılık etkileşimi:** komutlara `persist` opsiyonu
  (`setVisibility(false, { persist: true })` / `destroy({ persist: true })`).
  Rezerve `ScriptState` anahtarları (`__actorHidden`/`__actorDestroyed`) persist
  kanalına yazılır (`getPersistentStateSnapshot`'a girer); `applyPersistentStateSnapshot`
  sonu `applyPersistedActorEffects` ile fresh sahnede etkiyi anında yeniden
  uygular (restore sahne kurulduktan sonra koşuyor). Layout dosyasına asla yazılmaz.
- [x] **A1.4 — Sink migrasyonu:** `collectible` gizlemesi generic yüzeye taşındı
  (`context.actor.setVisibility(false)`); davranış birebir korundu — kendi
  `collected` persist + `hidden` latch mantığıyla save-restore'da yeniden hide.
  `onCollectibleCollected` opsiyonu + host `setCollectibleCollected` kaldırıldı.
  `lamp-toggle` ışık görünürlüğü ayrı kaldı (ışık `enabled` ≠ aktör görünürlüğü —
  karar: ışık toggle intensity/visible'ı ayrı `onActorLightToggle` sink'inde).
- [x] **A1.5 — Test + docs:** 3 headless test eklendi (visibility komutu sink'e
  ulaşır; destroy sonrası tick/mesaj/contact kesilir; persist restore'da yeniden
  uygulanır) + 2 collectible testi yeni sink'e uyarlandı. `ARCHITECTURE.md`
  boundary notu + bu doküman güncellendi. Gate yeşil: tsc + build + 540 engine
  check + verify:dist --strict.

## Kabul kriterleri

- Bir behavior `context.actor.setVisibility(false)` çağrısıyla kendini
  gizleyebilir; ertesi tick render objesi görünmez.
- `destroy()` edilen aktör: contact üretmez, mesaj almaz, tick almaz; sahne
  reload'unda temiz kurulur.
- `persist` ile gizlenen/yok edilen aktör save→load sonrası aynı durumda gelir.
- Collectible davranışı migrasyon sonrası birebir korunur (mevcut headless
  testleri geçer).

---

# A2 — Timer / Delay / LifeSpan

## Amaç

Unreal'ın `SetTimerByEvent` / `Delay` / `SetLifeSpan` üçlüsünün karşılığı:
behavior'ların "N saniye sonra şunu yap"ı, her seferinde elle dt muhasebesi
yazmadan ifade edebilmesi.

## Mevcut durum (kanıt)

- Hiçbir timer/delay altyapısı yok (`engine/` grep: dialogue/audio dışında
  timer izi yok).
- Cooldown'lar elle: `stepInteractionTrigger` kendi dt sayacını taşıyor
  (`src/game/interaction.ts`); her yeni gecikmeli davranış aynı kalıbı
  kopyalamak zorunda.
- Mesaj busı hazır teslim kanalı: süre dolumu self-targeted script mesajı
  olarak teslim edilirse `messageBindings` üzerinden hiç yeni kavram
  öğrenmeden tüketilir.

## Checklist

- [x] **A2.1 — Engine timer çekirdeği:** `ScriptTimers`
  (`after(seconds, message, payload?)` → handle, `clear(handle)`) —
  `BehaviorContext.timers`. Süre dolunca self-targeted script mesajı
  kuyruklanır (mevcut flush düzenine girer). Timer'lar subsystem tick'iyle
  ilerler (Play duraklarsa timer da durur), `setEntities`/`clear`'da sıfırlanır.
- [x] **A2.2 — LifeSpan:** `actor.setLifeSpan(seconds)` komutu (A1 destroy'a
  bağlanır); 0 = iptal (Unreal semantiği). Karar noktası: class'ta opsiyonel
  `lifeSpan` değişkeni mi (spawn edilen geçici efekt aktörleri için), yalnız
  komut yüzeyi mi — instance→entity düzleştirmesine özel alan sokma maliyetiyle
  birlikte değerlendirilir. Karar: A2 v1 yalnız komut yüzeyini ekledi; authored
  class/instance `lifeSpan` alanı A5 spawn edilen geçici actor ihtiyacıyla birlikte
  tekrar değerlendirilecek.
- [ ] **A2.3 — (Opsiyonel temizlik) cooldown migrasyonu:** interaction
  cooldown'unun timer çekirdeğine taşınması *değerlendirilir* — davranış
  değişmeyecekse dokunma (saf `stepInteractionTrigger` test yüzeyi değerli).
- [x] **A2.4 — Test:** deterministik headless testler (sahte dt ile: tek
  ateşleme, clear, reload'da sızıntı yok, duraklatılmış subsystem'de ilerlemez).

## Kabul kriterleri

- `timers.after(2, "Door.Close")` mesajı ~2sn sonra tam bir kez teslim edilir;
  `clear` edilen timer hiç ateşlenmez.
- Sahne reload'u aktif timer sızdırmaz; Play duraklatılınca timer ilerlemez.
- `setLifeSpan(5)` verilen aktör 5sn sonra destroy olur (A1 yolundan).

---

# A3 — ScriptWorld Veri Erişimi (GetActorLocation ve akrabaları)

## Amaç

`ScriptWorld` bugün yalnız kimlik (EntityRef) döndürüyor; bir behavior bulduğu
aktörün *konumunu okuyamıyor* — mesafe/bakış-yönü/takip mantığı yazılamıyor
(tek istisna: `nearestWithInterface` içine gömülü mesafe). Unreal karşılığı:
`GetActorLocation`, `GetDistanceTo`, `GetActorForwardVector`.

## Mevcut durum (kanıt)

- `ScriptWorld` interface'i: `self/ref/byName/byTag/byClassRef/withInterface/
  nearestWithInterface` — hepsi id döndürür
  (`engine/behavior/behaviorSubsystem.ts:48-60`).
- Runtime transform'lar zaten subsystem'in elinde
  (`runtimeEntities` → `transform`), dışa açılmıyor.

## Checklist

- [x] **A3.1 — Salt-okunur transform erişimi:** `world.transformOf(ref)`
  (readonly snapshot/kopya — başka aktörün transform'u *mutasyona kapalı*
  kalır, yazma yüzeyi yalnız self `context.transform`) + `world.distanceTo(ref)`.
- [x] **A3.2 — Yön helper'ları:** saf util'ler (`forward/right/upVectorFromRotation`
  — Euler'den, engine'de) + istenirse `world.forwardOf(ref)` inceltmesi.
- [ ] **A3.3 — (Backlog'a devir) hız erişimi:** `velocityOf` —
  CharacterMovement hız state'i `src/game`'de yaşıyor; engine yüzeyine taşımak
  sınır kararı gerektirir. Bu fazda kapsam dışı, A6'ya not edildi.
- [x] **A3.4 — Test + örnek:** headless testler + kataloğa küçük bir örnek
  behavior (ör. mesafe-tetikli `proximity-toggle` veya `look-at`) — yüzeyin
  gerçekten yeterli olduğunu kanıtlar.

## Kabul kriterleri

- Bir behavior `world.byTag("door")[0]` ile bulduğu aktörün konumuna mesafe
  hesaplayıp buna göre davranabilir.
- Dönen transform'un mutasyonu kaynak aktörü **etkilemez** (kopya/readonly —
  testle kanıtlı).

---

# A4 — Gerçek Event Yönlendirme + Çoklu Binding (B4)

## Amaç

`beginPlay/tick/overlap/hit/interact` etiketlerini gerçek semantiğe bağlamak:
BeginPlay bir kez ateşlenir, Overlap begin/end kenarları other-actor
payload'ıyla gelir, bir class birden çok event binding'i aynı anda taşır.
Unreal karşılığı: `Event BeginPlay`, `Event ActorBeginOverlap/EndOverlap`,
`Event Hit` — ayrı ayrı bağlanabilen event'ler.

## Mevcut durum (kanıt)

- `ACTOR_EVENT_KINDS` beş kind tanımlıyor ama semantik taşımıyor
  (`engine/scene/actorScript.ts:79-98`).
- Instance düzleştirmesi **ilk** binding'i tek `Behavior` bileşenine indirger;
  gerisi düşer (`engine/scene/actorInstance.ts:63-77` — "B4 later phase"
  olarak belgeli).
- Overlap/hit semantiği behavior'ların `contactsForEntity` poll'lamasından
  geliyor; "ilk contact + once" kalıbı `goal-reached`/`checkpoint`/
  `level-travel`/`collectible`'da elle kopyalanmış (`src/game/behaviors.ts`).

## Checklist

- [x] **A4.1 — Veri modeli:** entity çoklu behavior taşır (öneri: mevcut tek
  `Behavior` bileşeni yerine `bindings: [{event, scriptId, params}]` listesi
  taşıyan bileşen; geriye uyum: tekil `Behavior` okunmaya devam eder).
  `actorInstanceToEntity` ilk-binding çökmesini kaldırır. `normalizeActorScriptDef`
  zaten listeyi taşıyor — validator etkisi yalnız yeni bileşen alanı.
- [x] **A4.2 — Dispatch çekirdeği:** BehaviorSubsystem event yönlendirmesi:
  `beginPlay` = setEntities sonrası ilk tick'te bir kez; `tick` = her kare;
  `overlap` = contact diff'inden begin/end kenarları (envelope'ta other-actor
  id + begin/end bayrağı); `hit` = non-sensor contact; `interact` = mevcut
  interaction akışına bağlanır. Kenar algılama subsystem'de bir kez yaşar,
  behavior'lardaki kopya "once" kalıpları ölür. Not: `interact` için engine
  `emitActorEvent(entityId, "interact", payload)` hook'u eklendi; mevcut game
  `interact` behavior'ı cooldown/input gating nedeniyle ayrı kalır.
- [x] **A4.3 — Karar: `endPlay` kind'ı** eklenip eklenmeyeceği (destroy +
  sahne teardown'unda ateşlenir). Karar: A4'e alınmadı; destroy/teardown
  lifecycle garantileriyle birlikte A6 backlog'a bırakıldı.
- [x] **A4.4 — Editör uyumu:** `ActorScriptEditor` Event Bindings UI'ının
  çoklu binding + yeni event kind semantiğiyle uyumu doğrulanır (kind başına
  açıklama metni güncellenir).
- [x] **A4.5 — Davranış migrasyonu:** `goal-reached`/`checkpoint`/`level-travel`
  "ilk contact + once" kalıbı overlap-begin event'ine sadeleştirilir —
  davranış birebir korunarak (mevcut testler referans).
- [x] **A4.6 — Test:** çoklu binding (beginPlay+tick+overlap aynı class'ta),
  beginPlay tek ateşleme, overlap begin/end kenarları, reload sonrası
  beginPlay yeniden ateşlenir.

## Kabul kriterleri

- Bir class'ta üç binding (beginPlay + tick + overlap) aynı anda çalışır.
- `overlap` binding'i begin ve end kenarlarını other-actor id'siyle alır.
- Mevcut davranışların dış davranışı değişmez (testler yeşil kalır).

---

# A5 — Runtime SpawnActor

## Amaç

Oyun sırasında bir Actor Script class'ından yeni instance spawn edebilmek
(mermi, pickup, efekt aktörü…). Unreal karşılığı: `SpawnActor from Class`.
Destroy (A1) ile birlikte tam yaşam döngüsü kapanır.

## Mevcut durum (kanıt)

- Spawn yalnız sahne kuruluşunda: `actorInstanceToEntity` layout'taki
  placement'ları düzleştirir; `RuntimeSceneApp.spawnDefaultPawnActor` boot'ta
  koşar. Oyun ortası ekleme yolu yok.
- Subsystem'ler entity setini toptan alır (`setEntities`); tekil ekleme API'si
  yok (fizik, behavior, render shell).

## Checklist

- [x] **A5.1 — Karar: ekleme stratejisi.** İncremental entity ekleme (öneri:
  `physics/behavior/render`'a `addEntity` yolu — spawn başına tam rebuild
  maliyeti yok) vs `setEntities` rebuild (basit ama pahalı ve state sıfırlar —
  timer/persist etkileşimi kirli). Karar: **incremental addEntity**. `setEntities`
  rebuild'i A2 timer/lifespan state'ini, A4 beginPlay/message subscription
  durumunu ve mevcut runtime state'i spawn başına sıfırlayacağı için v1'de
  kullanılmadı. `PhysicsSubsystem.addEntity`, `BehaviorSubsystem.addEntity` ve
  runtime render shell tekil ekleme yolu eklendi.
- [x] **A5.2 — Komut:** `actor.spawn(classRef, transform, params?)` (A1
  komut yüzeyine eklenir). Id tahsisi: layout `actor:<n>` şemasıyla çakışmayan
  ayrı namespace (öneri: `spawned:<n>`). Class çözümü: `*.actor.json`
  fetch/cache — async; spawn komutu kuyruklanır, class hazır olunca instantiate.
  Uygulama: `ActorCommands.spawn` tick sonu host sink'ine `ActorSpawnRequest`
  düşürüyor; runtime shell `loadActorClass` cache'ini kullanıp `spawned:<n>`
  id'siyle entity üretiyor. `params`, spawned class'ın behavior/event/message
  binding param'larına merge ediliyor (exposed-on-spawn v1).
- [x] **A5.3 — Render shell instantiation:** mesh/light/particle/audio
  bileşenlerinin host'ta kurulumu; asset async yüklemesinin spawn gecikmesine
  etkisi belgelenir (öneri: sık spawn'lanacak class'lar için pre-warm cache).
  Uygulama: spawned actor mesh asset'i eksikse async yükleniyor, host object
  entity id ile track ediliyor (`actor:<n>` ve `spawned:<n>` aynı yol), Light
  component attach ediliyor, `autoPlay` Audio/ParticleEmitter tekil entity için
  çalıştırılıyor. Not: ilk spawn, class/mesh/effect/audio cache miss kadar
  gecikebilir; sık spawn edilecek sınıflar için sonraki işte pre-warm API'si
  eklenebilir.
- [x] **A5.4 — Yaşam döngüsü bütünlüğü:** spawn edilen aktör tick/contact/
  mesaj alır; `destroy()` ile temiz söküm (A1 yolu); `beginPlay` binding'i
  spawn'da ateşlenir (A4 sonrası). Save-game etkileşimi **karar noktası**:
  v1'de spawned aktörler snapshot'a girmez (belgelenir) — kalıcı spawn
  ihtiyacı doğarsa ayrı iş. Karar: v1 spawned aktörler save-game snapshot'a
  yazılmaz ve sahne reload/level travel sırasında düşer; `destroy()` A1 host
  sink'iyle physics/render/behavior kayıtlarını temizler. `beginPlay`, spawned
  entity `BehaviorSubsystem.addEntity` ile eklendikten sonraki ilk behavior
  update'inde çalışır.
- [~] **A5.5 — Test:** headless (behavior/fizik kaydı, id çakışmasızlığı,
  destroy sökümü, reload sızıntısızlığı) + render smoke (spawn edilen mesh
  görünür). Headless kapsam eklendi: spawn request clone/params, `spawned:<n>`
  id helper'ları, incremental behavior+physics add, beginPlay/tick/overlap/
  message delivery, destroy cleanup ve rebuild sonrası spawned entity düşmesi.
  Full local gate yeşil: `npm run build:verify`. Browser/render smoke bu
  oturumda Playwright aracı callable olmadığı için çalıştırılamadı; kalan iş
  yalnızca spawned mesh'in gerçek browser sahnesinde görünür olduğunu doğrulamak.

## Kabul kriterleri

- Bir behavior oyun sırasında `classRef` spawn eder; aktör ertesi tick'ten
  itibaren tick/contact alır, render'da görünür.
- Spawn + destroy döngüsü sızıntısızdır (tekrarlı spawn/destroy sonrası
  entity/gövde/abonelik sayıları sabit kalır).
- Sahne reload'u spawned aktörleri temiz düşürür.

---

# A6 — Backlog (tetikleyici bazlı, sıra yok)

- [x] **Collision toggle:** `actor.setCollisionEnabled(bool)`
  (SetActorEnableCollision). Engine: `ActorCommands.setCollisionEnabled`
  (`ActorCommandOptions.persist` destekli, rezerve anahtar
  `__actorCollisionDisabled`), `ActorCommandSink.setCollisionEnabled?` (opsiyonel,
  `spawn?` emsali), tick-sonu komut kuyruğu + `applyPersistedActorEffects`
  restore (hide'dan bağımsız). Physics: `PhysicsSubsystem.setEntityCollisionEnabled`
  — disabled entity contact üretiminden ve movement blocker/surface
  toplayıcılarından düşer (possessed pawn açılmış kapıdan geçer), Rapier canlıysa
  collider'lar `setEnabled(false)`; `setEntities`/`clear`/`removeEntity`'de sıfırlanır.
  Host: `RuntimeSceneApp` sink → `setEntityCollisionEnabled`. 3 headless test
  (komut sink'e ulaşır; disable contact+blocker düşürür ve re-enable/rebuild geri
  getirir; persist restore hide'dan bağımsız yeniden uygular). Gate yeşil:
  `npm run build:verify` (tsc + build + 555 engine check + strict dist scan).
- [x] **İtki/fırlatma:** `AddImpulse` / `LaunchCharacter`. Yazma yüzeyi salt-okunur
  `PhysicsQuery`'den ayrı tutuldu: `ActorCommands.addImpulse(vec)` (simüle dinamik
  gövde) + `launch(vec, options?)` (karakter) tick-sonu kuyruğa giriyor,
  `ActorCommandSink.addImpulse?`/`launch?` (opsiyonel emsal). Engine:
  `PhysicsSubsystem.applyImpulse` (Rapier canlı + `simulatePhysics` ise
  `body.applyImpulse`, aksi no-op). Game: `CharacterMovementSubsystem.launch` —
  yukarı bileşen mevcut vertical-motion state'ine enjekte olup airborne/arc
  sağlıyor, yatay bileşen decay eden knockback (blocker'lara karşı resolve,
  `LAUNCH_HORIZONTAL_DAMPING`); `xyOverride`/`zOverride` (Unreal semantiği);
  `setEntities`/`clear`/`resetEntityTransform`'da sıfırlanıyor. Host:
  `RuntimeSceneApp` impulse→physics, launch→character. 2 headless test (komut→sink
  vektör+options teslimi; karakter launch airborne/land + yatay decay). Gate yeşil:
  `npm run build:verify` (tsc + build + 566 engine check + strict dist scan).
- [x] **Hasar konvansiyonu:** `Damage.Apply` mesaj standardı + `AnyDamage`
  şablonu (motor değil, `src/game` konvansiyonu + doc). Mesaj payload'ı
  `{ amount, instigator?, damageType? }`; iki şablon behavior: `apply-damage`
  (receiver — Message Binding `Damage.Apply`/self; ScriptState health,
  `maxHealth`/`persistHealth`/`destroyOnDeath` param; `Health.Changed` +
  ölümde `Damage.Died` yayıyor) ve `damage-zone` (sender — overlap/hit begin'de
  dokunduğu aktöre `Damage.Apply` yolluyor, `damage`/`damageType`/`once` param).
  Doc: `docs/reference/DAMAGE_CONVENTION.md` (payload sözleşmesi + fork'ta kalan
  kurallar). Motor değişmedi; yalnız `src/game` + doc. 2 headless test (receiver
  health→Died→destroy; sender overlap→receiver aynı update'te). Gate yeşil:
  `npm run build:verify` (tsc + build + 564 engine check + strict dist scan).
- [ ] **Runtime attach/detach:** `AttachToActor` karşılığı (editörde parenting
  var, runtime'da yok). Tetikleyici: taşınan/tutulan obje mekaniği.
- [x] **Tick kontrolü:** aktör-başına tick enable/interval (`SetActorTickEnabled`
  + Actor Tick Interval). Engine: `ActorCommands.setTickEnabled(bool)` +
  `setTickInterval(seconds)` A1 komut yüzeyine eklendi; `BehaviorSubsystem` her
  entity için opsiyonel `TickControl` (`enabled`/`interval`/`accumulator`) tutuyor,
  yalnız `tick` kind'ı gated (beginPlay/overlap/hit/interact etkilenmez). Throttled
  tick, biriken elapsed süreyi `engine.deltaSeconds` olarak alır (time-integrated
  mantık bozulmaz); komutlar tick içinde anında etki eder (host sink gerekmez).
  `tickControl` seti `setEntities`/`clear`/`detachEntity` ve entity yok olduğunda
  temizlenir. 2 headless test (interval throttle + accumulated dt + reload reset;
  enable/disable geçişi). Gate yeşil: `npm run build:verify` (tsc + build +
  559 engine check + strict dist scan).
- [x] **Owner/Instigator:** spawn eden aktörün kimliği (Unreal Owner). Engine:
  `BehaviorSubsystem.addEntity(entity, { owner })` spawn edilen entity → spawner
  eşlemesini `owners` map'inde tutuyor; `ScriptWorld.ownerOf(ref)` +
  `BehaviorContext.owner` (self kısayolu) çözüyor. `ownerOf`, owner canlı runtime
  entity değilse null döner (layout aktörü, unowned, ya da owner play'den çıkmış);
  `detachEntity` entity'yi hem owned-child hem owner tarafından temizliyor,
  `setEntities`/`clear` sıfırlıyor. Host: `RuntimeSceneApp.spawnRuntimeActor`
  `addEntity`'ye `{ owner: request.sourceEntityId }` geçiyor (A5 spawn simetrisi).
  1 headless test (spawner çözümü + `context.owner` aynası + authored actor null +
  owner ölünce null). Gate yeşil: `npm run build:verify` (tsc + build +
  562 engine check + strict dist scan).
- [x] **Hız erişimi (A3.3 devri):** `world.velocityOf(ref)` (Unreal GetVelocity).
  Sınır kararı: hız kaynağı `src/game`'de kalmaya devam ediyor; engine yalnız salt-
  okunur `EntityVelocityProvider` interface'ini tüketiyor (`AudioBus`/PhysicsQuery
  emsali), host onu birleştiriyor. `CharacterMovementSubsystem.velocityOf`
  (kinematik pawn için uygulanan pozisyon deltasından; teleport/respawn stale hızı
  düşürüyor) + `PhysicsSubsystem.velocityOf` (Rapier dinamik gövde `linvel`);
  `RuntimeSceneApp` provider'da karakter-önce fizik-sonra sıralıyor.
  `world.velocityOf` bilinmeyen ref/provider'sızda null. Örnek behavior
  `velocity-gate` (self hızını okuyup eşik geçişinde `Velocity.Changed` yayıyor).
  3 headless test (provider delegasyonu + unknown ref null + provider'sız null;
  karakter uygulanan-hareket hızı + teleport reset). Gate yeşil:
  `npm run build:verify` (tsc + build + 561 engine check + strict dist scan).
- [x] **EndPlay lifecycle (A4.3 devri):** `endPlay` event kind'ı. Engine:
  `ACTOR_EVENT_KINDS`/`LABELS`/`DESCRIPTIONS`'e `endPlay` eklendi (normalize +
  saveValidator + editör picker `isActorEventKind`/tek-kaynak sabitlerden otomatik
  akıyor); `ActorEndPlayReason` (`"destroyed" | "teardown"`) +
  `ActorEventEnvelope.reason` + `payload.reason`; `BehaviorInstance.firedEndPlay`
  ile yaşam başına tek ateşleme. Ateşleme noktaları: `actor.destroy()` /
  lifespan → `processActorCommand` detach'ten **önce** `reason: "destroyed"`;
  scene reload (`setEntities` rebuild) + disposal (`clear`) → `dispatchEndPlayForAll`
  `reason: "teardown"` (dünya wipe'ından önce, state sağlam). Runtime spawn/despawn:
  despawn = destroy yolu → kapsanıyor. Mesajlaşma teardown'da best-effort
  (bus temizlenir); yerel cleanup garanti. Host değişikliği yok (davranış-yönlü
  event). 2 headless test (destroy tek ateşleme + reason; teardown + reload re-arm,
  yaşam başına tek). Gate yeşil: `npm run build:verify` (tsc + build + 557 engine
  check + strict dist scan).

---

## Progress Log

- 2026-07-03: Doküman oluşturuldu (Unreal ortak aktör API'si ↔ Forge
  behavior yüzeyi karşılaştırma araştırmasından). Kod yazılmadı; tüm maddeler
  `[ ]`.
- 2026-07-03: **A1 tamamlandı** (SetVisibility + Destroy). Engine:
  `ActorCommands` (`context.actor`), tick-sonu komut kuyruğu, `ActorCommandSink`,
  destroy internal cleanup (instance/index/mesaj aboneliği düşürme, runtimeState
  koruma), rezerve-anahtar persist/restore (`__actorHidden`/`__actorDestroyed`);
  `PhysicsSubsystem.removeEntity` eklendi. Host: `actorCommandSink` →
  `setActorObjectVisible` + `destroyActorEntity`. `collectible` generic yüzeye
  taşındı, `onCollectibleCollected` kaldırıldı. 3 yeni + 2 uyarlanmış test; gate
  yeşil (tsc + vite build + 540 engine check + verify:dist --strict). Sıradaki: A2.
- 2026-07-03: **A2 kodlandı** (Timer / Delay / LifeSpan). Engine:
  `ScriptTimers` (`context.timers.after/clear`) eklendi; süre dolumu self-targeted
  script mesajı olarak mevcut `messageBindings` yolundan teslim ediliyor.
  `actor.setLifeSpan(seconds)` A1 destroy kuyruğuna bağlandı; `0`/geçersiz süre
  aktif lifespan'ı iptal ediyor. Timer/lifespan state'i `setEntities`/`clear` ve
  destroy cleanup'ta düşüyor; disabled subsystem'de ilerlemiyor. A2.3 cooldown
  migrasyonu davranış değişikliği getirmediği için bu turda yapılmadı. Gate yeşil:
  tsc + vite build + 544 engine check + verify:dist --strict.
- 2026-07-03: **A3 kodlandı** (ScriptWorld veri erişimi). Engine:
  `world.transformOf(ref)`, `world.distanceTo(ref)`, `world.forwardOf/rightOf/upOf(ref)`
  eklendi; transform sonucu kopya snapshot, yön helper'ları Three bağımsız
  `engine/scene/transform.ts` saf matematiği. Runtime örneği olarak
  `proximity-toggle` behavior kataloğa eklendi ve `world.byTag` + `world.distanceTo`
  ile yakınlık kenarı mesajı yayıyor. A3.3 `velocityOf` kapsam dışı kalmaya devam
  ediyor. Gate yeşil: tsc + vite build + 547 engine check + verify:dist --strict.
- 2026-07-03: **A4 çekirdeği kodlandı** (event binding dispatch). Engine:
  `EventBindings` component reader eklendi; `actorInstanceToEntity` artık
  Actor Script `eventBindings` listesini tek `Behavior`'a çökertmeden taşıyor,
  legacy `Behavior` component node'u geriye uyumlu tick fallback olarak kalıyor.
  `BehaviorSubsystem` beginPlay/tick/overlap/hit/interact event envelope'larını
  `context.event` üzerinden teslim ediyor; overlap/hit contact diff'i subsystem'de
  tutuluyor; host/runtime kaynakları için `emitActorEvent` hook'u eklendi. Testler:
  beginPlay/tick/interact, reload sonrası beginPlay, overlap/hit begin/end ve
  actorInstance flattening. Gate yeşil: tsc + vite build + 550 engine check +
  verify:dist --strict.
- 2026-07-03: **A4.4/A4.5 tamamlandı.** Editor Event Binding Details paneli
  event kind açıklamalarını tek kaynak olan `ACTOR_EVENT_DESCRIPTIONS` üzerinden
  gösteriyor. `goal-reached`/`checkpoint`/`level-travel` artık Actor Script
  `overlap` begin event'iyle çalışıyor; legacy düz `Behavior` bileşeni için
  contact polling fallback'i korunuyor. Testler EventBindings yoluna taşındı.
  Gate yeşil: tsc + vite build + 550 engine check + verify:dist --strict.
- 2026-07-03: **A5 kodlandı** (Runtime SpawnActor). Karar: spawn için
  `setEntities` rebuild yerine incremental ekleme seçildi; böylece timer,
  message subscription, beginPlay state ve runtime state spawn başına
  sıfırlanmıyor. Engine: `ActorCommands.spawn(classRef, transform, params?)`,
  `ActorSpawnRequest`, `BehaviorSubsystem.addEntity`, `PhysicsSubsystem.addEntity`,
  `spawned:<n>` id helper'ları ve spawn params merge'i eklendi. Host:
  `RuntimeSceneApp` runtime-only spawned actor id üretip class cache'ten resolve
  ediyor, mesh asset'i gerekirse async yüklüyor, mesh/light/audio/particle render
  shell'ini kuruyor, physics + behavior world'e tekil entity ekliyor. Spawned
  aktörler v1'de save-game snapshot'a yazılmıyor ve scene reload/level travel'da
  düşüyor. Testler: spawn request clone/params, incremental behavior+physics
  lifecycle, beginPlay/tick/overlap/message delivery, destroy cleanup ve spawned
  id/params flattening. Gate yeşil: `npm run build:verify` (tsc + Vite build +
  552 engine check + strict dist scan). Browser/render smoke bu oturumda
  Playwright aracı callable olmadığı için çalıştırılamadı; A5.5 bu doğrulama
  için `[~]` bırakıldı.
- 2026-07-03: **A6 — Collision toggle kodlandı** (`SetActorEnableCollision`).
  Engine: `ActorCommands.setCollisionEnabled(enabled, options?)` A1 komut yüzeyine
  eklendi; tick-sonu kuyruğa `collision` komutu düşüyor, `{ persist: true }`
  rezerve `__actorCollisionDisabled` anahtarını yazıyor, `applyPersistedActorEffects`
  restore'da hide'dan bağımsız olarak yeniden uyguluyor. `ActorCommandSink`'e
  opsiyonel `setCollisionEnabled?` (mevcut `spawn?` emsali — test sink'leri
  kırılmadı). Physics: `PhysicsSubsystem.setEntityCollisionEnabled(entityId, enabled)`
  — disabled entity placeholder contact döngüsünden + `addAabbSensorContacts` +
  `staticBlockerAabbs` + `staticSurfaceTriangles`'dan atlanıyor, Rapier canlıysa
  collider'lar `collider.setEnabled(false)`; `collisionDisabled` seti
  `setEntities`/`clear`/`removeEntity`'de temizleniyor, static toggle blocker
  cache'ini invalide ediyor. Host: `RuntimeSceneApp` actorCommandSink →
  `setEntityCollisionEnabled`. 3 yeni headless test (komut sink'e ulaşır; disable
  contact+blocker düşürür, re-enable + setEntities rebuild geri getirir; persist
  restore hide'dan bağımsız yeniden uygular). ARCHITECTURE.md komut yüzeyi notu
  güncellendi. Gate yeşil: `npm run build:verify` (tsc + Vite build + 555 engine
  check + strict dist scan). Kalan A6: impulse/launch, hasar konvansiyonu, runtime
  attach/detach, tick kontrolü, owner/instigator, velocity, endPlay — hepsi
  tetikleyici bekliyor.
- 2026-07-03: **A6 — EndPlay lifecycle kodlandı** (A4.3 devri). Engine:
  `ACTOR_EVENT_KINDS`/`LABELS`/`DESCRIPTIONS`'e `endPlay` eklendi — loader
  `normalizeEventBinding` (`isActorEventKind`), saveValidator (aynı normalize) ve
  editör Event Binding picker (tek-kaynak sabitler) otomatik kapsıyor, ek editör
  kodu yok. `ActorEndPlayReason` (`"destroyed" | "teardown"`),
  `ActorEventEnvelope.reason` + `payload.reason`, `BehaviorInstance.firedEndPlay`
  (yaşam başına tek). `dispatchEndPlayEvents`/`dispatchEndPlayForAll` eklendi;
  `actor.destroy()`/lifespan → detach'ten önce `reason:"destroyed"`, scene reload
  (`setEntities` rebuild) + disposal (`clear`) → wipe'tan önce `reason:"teardown"`.
  Runtime despawn = destroy yolu → kapsanıyor. Teardown'da mesaj best-effort
  (bus temizlenir), yerel cleanup garanti; host değişikliği yok. 2 headless test
  (destroy tek ateşleme + reason payload; teardown + reload re-arm, yaşam başına
  tek). Gate yeşil: `npm run build:verify` (tsc + Vite build + 557 engine check +
  strict dist scan). Kalan A6: impulse/launch, hasar konvansiyonu, runtime
  attach/detach, tick kontrolü, owner/instigator, velocity — hepsi tetikleyici
  bekliyor.
- 2026-07-03: **A6 — Tick kontrolü kodlandı** (`SetActorTickEnabled` + tick
  interval). Engine: `ActorCommands.setTickEnabled(bool)` + `setTickInterval(seconds)`
  A1 komut yüzeyine eklendi; `BehaviorSubsystem` entity başına opsiyonel `TickControl`
  (`enabled`/`interval`/`accumulator`) tutuyor, `computeTickDecisions` her frame
  yalnız `tick` kind'ını gate'liyor (beginPlay/overlap/hit/interact etkilenmez),
  throttled tick biriken süreyi `deltaSeconds` olarak alıyor. Komutlar tick içinde
  anında etki ediyor (host sink yok); `tickControl` `setEntities`/`clear`/
  `detachEntity`/entity-yokluğunda temizleniyor. 2 headless test (interval
  throttle + accumulated dt + reload reset; enable/disable geçişi). Gate yeşil:
  `npm run build:verify` (tsc + Vite build + 559 engine check + strict dist scan).
  Kalan A6: impulse/launch, hasar konvansiyonu, runtime attach/detach,
  owner/instigator, velocity.
- 2026-07-03: **A6 — Hız erişimi kodlandı** (A3.3 devri; Unreal GetVelocity).
  Engine: `EntityVelocityProvider` interface + `ScriptWorld.velocityOf(ref)` +
  `BehaviorSubsystemOptions.velocityProvider`; `world.velocityOf` bilinmeyen ref/
  provider'sızda null. `PhysicsSubsystem.velocityOf` (Rapier dinamik `linvel`, aksi
  null). Game: `CharacterMovementSubsystem` frame başına uygulanan pozisyon
  deltasından hız tutuyor + `velocityOf`; `setEntities`/`clear`'da sıfırlanıyor,
  `resetEntityTransform` (teleport/respawn) stale hızı düşürüyor. Host:
  `RuntimeSceneApp` velocityProvider'ı karakter-önce fizik-sonra birleştiriyor.
  Örnek behavior `velocity-gate` (self hızı eşik geçişinde `Velocity.Changed`).
  3 headless test. Gate yeşil: `npm run build:verify` (tsc + Vite build +
  561 engine check + strict dist scan). Kalan A6: impulse/launch, hasar
  konvansiyonu, runtime attach/detach, owner/instigator.
- 2026-07-03: **A6 — Owner/Instigator kodlandı** (Unreal Owner). Engine:
  `BehaviorSubsystem.addEntity(entity, { owner })` spawn edilen entity → spawner
  eşlemesini `owners` map'inde tutuyor; `ScriptWorld.ownerOf(ref)` +
  `BehaviorContext.owner` çözüyor (owner canlı değilse null). `detachEntity`
  hem child hem owner tarafını temizliyor, `setEntities`/`clear` sıfırlıyor. Host:
  `spawnRuntimeActor` `addEntity`'ye `{ owner: request.sourceEntityId }` geçiyor.
  1 headless test. Gate yeşil: `npm run build:verify` (tsc + Vite build +
  562 engine check + strict dist scan). Kalan A6: impulse/launch, hasar
  konvansiyonu, runtime attach/detach.
- 2026-07-03: **A6 — Hasar konvansiyonu kodlandı** (`Damage.Apply`, motor değil).
  `src/game` konvansiyonu + doc: `Damage.Apply` mesajı payload'ı
  `{ amount, instigator?, damageType? }`; `apply-damage` receiver behavior
  (ScriptState health, `maxHealth`/`persistHealth`/`destroyOnDeath`,
  `Health.Changed` + ölümde `Damage.Died`) ve `damage-zone` sender behavior
  (overlap/hit begin → `Damage.Apply`, `damage`/`damageType`/`once`).
  `docs/reference/DAMAGE_CONVENTION.md` payload sözleşmesini + fork sorumluluğunu
  belgeliyor. Engine dokunulmadı. 2 headless test. Gate yeşil: `npm run build:verify`
  (tsc + Vite build + 564 engine check + strict dist scan). Kalan A6:
  impulse/launch, runtime attach/detach.
- 2026-07-03: **A6 — İtki/fırlatma kodlandı** (`AddImpulse` / `LaunchCharacter`).
  Yazma yüzeyi salt-okunur `PhysicsQuery`'den ayrı: `ActorCommands.addImpulse(vec)` +
  `launch(vec, options?)` tick-sonu kuyruğu + opsiyonel `ActorCommandSink.addImpulse?`/
  `launch?`. Engine: `PhysicsSubsystem.applyImpulse` (Rapier `body.applyImpulse`,
  aksi no-op). Game: `CharacterMovementSubsystem.launch` (yukarı → vertical-motion
  airborne/arc; yatay → decay eden knockback, blocker-resolve; `xy/zOverride`;
  lifecycle temizlik). Host: impulse→physics, launch→character. 2 headless test.
  Gate yeşil: `npm run build:verify` (tsc + Vite build + 566 engine check +
  strict dist scan). Kalan A6: runtime attach/detach.

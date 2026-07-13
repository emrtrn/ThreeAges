# Runtime ve Gameplay Kalan Isler Checklist

> Tarih: 2026-07-05
> Kaynak: `docs/ongoing/FORGE_YETERLILIK_ANALIZI.md` Baslik 4
> Durum: Baslik 4 `[~] Kismi`; behavior-state sizintisi kapandi, runtime smoke
> kismen geldi. Bu dokuman kalan isleri fazlara ayirir.

Forge runtime/gameplay cekirdegi ucuca calisiyor: Game Mode, pawn/character,
input, camera, actor/component modeli, level travel, save/load, boot/loading ve
game rules katmanlari kodda mevcut ve headless test altinda. `[x] Yeterli` icin
kalan isler uc ana riski kapatmali:

- runtime browser smoke kapsami eksik;
- `src/scene/RuntimeSceneApp.ts` ikinci buyuk kabuk olarak buyuyor;
- save-game zarfinin fork tuketicisi icin yazili sozlesmesi yok.

Kapsam disi:

- Baslik 5 asset pipeline ve 6 veri semasi genel analizi.
- Yeni AI sistemi implementasyonu. Bu dokuman yalniz move-intent siralamasini ve
  facing varsayimi notunu ilgili yol haritasina baglar.
- Networking, multiplayer, full level streaming.

## Durum Lejanti

- `[ ]` baslanmadi
- `[~]` devam ediyor
- `[x]` bitti ve dogrulandi
- `[>]` yol haritasi / bilincli backlog

## Ortak Gate

Kod degistiren her faz sonunda:

```bash
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run verify:imports
npm.cmd run smoke:browser
```

Engine/runtime davranisini veya paket sinirini etkileyen dilimler icin pratikse
tam gate:

```bash
npm.cmd run build:verify
```

Sadece dokuman degistiren fazlarda gate zorunlu degil; yine de ana analiz
dokumani ve bu checklist birlikte guncellenmeli.

Guvenlik notu: Bu plan save/load, dev fixture endpointleri veya dosya yazma
sinirlarini degistirecek bir implementasyon dilimine donerse Codex Security
taramasi ayrica onayla istenmeli; sessiz tarama calistirilmemeli.

## Faz Sirasi

| Faz | Durum | Bagimlilik | Amac |
| --- | --- | --- | --- |
| P0 | `[x]` | - | Kapanan behavior-state bulgusunu ve mevcut runtime smoke tabanini sabitle. |
| P1 | `[x]` | P0 | Runtime browser smoke borcunu kapat. (P1.1-P1.7 tamam) |
| P2 | `[x]` | P1 onerilir | `RuntimeSceneApp` kabugunu davranis koruyan modullere bol. (P2.1-P2.6 tamam) |
| P3 | `[x]` | P0 | Save-game zarf sozlesmesini yazili hale getir. (SAVE_GAME_CONTRACT.md) |
| P4 | `[x]` | P3 onerilir | AI move-intent kanitini ve +z-forward facing backlog'unu guncel dokumanlara bagla. |
| P5 | `[~]` | P1-P4 | Baslik 4 kararini tekrar degerlendir ve ana analiz kaydini guncelle. |

Onerilen akis: **P1 -> P3 -> P2 -> P4 -> P5**. P2 buyuk refactor riski tasidigi
icin once browser smoke kapsamini guclendirmek daha dogru sinirdir.

---

## P0 - Mevcut Temel ve Kapanan Bulgular

Amac: Son iki uygulama diliminin kabul edilen baseline oldugunu dokumanda net
tutmak; sonraki fazlar ayni yuzeyleri tekrar kesfetmesin.

Checklist:

- [x] **P0.1 - Behavior registry scene-omru:** `RuntimeSceneApp.buildScene(...)`
  boot/travel rebuild basinda taze behavior registry kuruyor.
- [x] **P0.2 - Collision chime state:** `collisionAudioPlayed` module-global set
  yerine registry kapsaminda tutuluyor.
- [x] **P0.3 - Headless regresyonlar:** ayni `portal:0` ve ayni `mover` id'si
  yeni scene visit'te tekrar calisabiliyor.
- [x] **P0.4 - Runtime smoke tabani:** `tests/smoke/runtime-playflow.spec.ts`
  `/` boot, loading overlay kapanisi, HUD mount, Save/Load quick
  write+load round-trip ve `travel:` UI mesaji ile target level load akisini
  dogruluyor.

Kabul kriteri:

- Baslik 4'te Aksiyon 1 tamam, Aksiyon 2 kismi olarak gorunmeli.

---

## P1 - Runtime Browser Smoke Kapsamini Kapat

Amac: Runtime/gameplay dongusunu yalniz headless testlerle degil, gercek Chromium
akisiyle de kanitlamak. Bu faz Baslik 4'teki Aksiyon 2'yi kapatir.

Checklist:

- [x] **P1.1 - Fixture haritasi:** `__playwright-smoke` source sahnesine pawn'in
  ileri (-Z) yuru cizgisi uzerinde iki gameplay sensoru eklendi (checkpoint
  z=-4, portal z=-10, ikisi de origin disinda; hareketsiz smoke'lari bootta
  tetiklemez). Target sahnesine geri-donus portali eklendi. Tek fixture seti
  locomotion + checkpoint + portal round-trip + debug overlay icin yeterli.
- [x] **P1.2 - Yuru/zipla smoke:** `tests/smoke/runtime-locomotion.spec.ts`.
  Klavye (`window` uzerinden, pointer-lock gerektirmez) ile pawn'i surer:
  `?debug` game-mode blogundaki `planar` hizi ve `(grounded)`/`(airborne)`
  gecisiyle hareket + jump dogrulanir. Deterministik.
- [x] **P1.3 - Portal sensor gidis-gelis:** `tests/smoke/runtime-portal.spec.ts`.
  UI mesaji degil, gercek `level-travel` sensoru: pawn portal hacmine yuruyor,
  target level yukleniyor, arrival sahnesindeki geri-donus portali ayni oturumda
  kaynagi ikinci kez yukluyor (taze per-scene behavior registry). **Kok neden
  duzeltildi** (bkz. asagi) — bu yol daha once hic ateslenmiyordu.
- [x] **P1.4 - Checkpoint autosave:** `tests/smoke/runtime-checkpoint.spec.ts`.
  Pawn checkpoint sensorune yuruyor, quick slot autosave yaziliyor, quick-load
  sonrasi pawn checkpoint transform'una respawn ediyor (yeni `?debug`
  `pos:` readout'u ile dogrulanir).
- [x] **P1.5 - `?debug` overlay smoke:** locomotion smoke icinde: `/?debug` ile
  game mode / memory / budget / ui / script messages readout bloklari mount
  oluyor, konsolda yeni hata yok.

**Kok neden / motor duzeltmesi (P1.3+P1.4'u acan):** Player Start default pawn'i
(`Script_GameMode` -> `spawnDefaultPawnActor`) fizik govdesine giriyor ve
transform'u her frame senkronlaniyordu, ama flat `placement.behavior`
(`checkpoint`/`level-travel`) tetikleyicileri hic atesleneMIYORdu: BehaviorSubsystem
her tick'e sentetik bir `{ kind: "tick" }` zarfi veriyor, `triggerOverlapBegins`
(`src/game/behaviors.ts`) ise `if (context.event)` ile bu tick'i "overlap degil"
diye kisa devre yapip contact-polling fallback'ine hic ulasmiyordu. Fix: tick
zarfini contact-polling yoluna yonlendir. Regression testi:
`engine-tests.ts` "flat tick Behavior fires from physics contact polling".
Ayrica `?debug` game-mode snapshot'ina pawn `position` eklendi (P1.2 + P1.4
respawn dogrulamasi icin gozlenebilir sinyal).

- [x] **P1.6 - Actor Runtime API browser borcu (A5.5):**
  `tests/smoke/runtime-script-message.spec.ts`. Pawn, source sahnesindeki bir
  `interact` sensorune yuruyor; davranis A6 mesaj bus'i uzerinden
  "Interaction.Activated" script mesaji yayiyor ve `?debug` "script messages"
  bloğunda gozlenebiliyor (Actor Runtime API mesajlasma yolunun gercek play
  oturumunda calistiginin tarayici kaniti). A5.5 acik notu kapandi. (Not: gozlem
  bu fix'e bagli — `interact` de ayni contact-polling yolunu kullaniyor.)
- [x] **P1.7 - Dokuman senkronu:** Bu checklist P1 bulgulari + motor
  duzeltmesiyle guncellendi. Ana analiz (Baslik 4) ve completed checklist
  senkronu P5'te tam gate ile yapilir; runtime smoke borcu artik kapali.

Not: yeni yuru-tabanli smoke'lar (`runtime-locomotion`, `runtime-checkpoint`,
`runtime-portal`, `runtime-script-message`) tek/ikili kosuda kararli gecer; yeni
`pos:` readout ve manuel yuru-dongusu (tight `expect.poll` yerine) determinizmi
korur. smoke:browser CI'da degil (yerel gate).

Kabul kriterleri:

- `npm.cmd run smoke:browser` editor smoke + runtime playflow smoke'larini yesil
  gecirir.
- Runtime smoke gercek input, gercek sensor travel ve checkpoint autosave'i
  kapsar.
- Behavior-state sizintisi ayni browser round-trip akisiyle de tekrar
  acilmadigini kanitlar.

---

## P2 - `RuntimeSceneApp` Dilimleme

Amac: `src/scene/RuntimeSceneApp.ts` davranisini degistirmeden shell boyutunu ve
gelecek ozelliklerin kabuga yigilmamasini kontrol altina almak. Bu faz Baslik 4
Aksiyon 3'u kapatir.

Kural: Ilk dilimler davranis koruyan extraction olmali. Save/load endpoint
semantigi, layout yazma, game rules veya Game Mode sozlesmeleri bu fazda yeniden
tasarlanmamali.

Hedef sorumluluk ayrimi:

- `RuntimeSceneApp.ts`: boot kompozisyonu, scene lifecycle sirasi, renderer
  sahipligi, yuksek seviye wiring.
- `src/scene/runtimeTravelCoordinator.ts`: travel queue/state, loading overlay
  handoff, travel error sonucu.
- `src/scene/runtimeSaveCoordinator.ts`: save store, UI slot komutlari,
  checkpoint write, pending restore uygulama sozlesmesi.
- `src/scene/runtimeActorSpawnCoordinator.ts`: runtime actor id uretimi,
  spawn/destroy kayitlari, owner/instigator baglama.
- `src/scene/runtimeDebugSnapshot.ts`: `?debug` icin gameplay/ui/loading/memory
  snapshot toparlama, yan etkisiz okuma.

### P2.1 Remainder Map (metot -> hedef modul)

`RuntimeSceneApp.ts` metotlarinin sorumluluk siniflandirmasi. Her extraction
deps-interface deseni kullanir: coordinator kendi state'ini (store/latch/queue)
sahiplenir, gameplay-facing capture/apply ve subsystem erisimi shell'de kalip
callback ile verilir. Bu, scene sinirini editor/game import kurallarini bozmadan
korur.

- **Save (P2.3 — `runtimeSaveCoordinator.ts`, TAMAM):**
  `handleUiMessage` (eski `handleSaveGameUiMessage`), `writeSlot`/`loadSlot`/
  `deleteSlot`, `writeCheckpointSave`, `refreshUiFields`, `setStatus`,
  `requestSaveGameLoad` (shell wrapper delegasyon), `applyPendingRestore` (eski
  `applyPendingSaveRestore`). Sahiplenen state: `saveGameStore`,
  `pendingSaveRestore`. Shell'de kalan deps callback'leri: `collectCurrentSaveState`
  (game-mode/behavior/entity okur), `applyRestore` (persistent snapshot +
  `applySavedPlayerTransform`), `enqueueLevelTravel`, `clearScreens`, `uiStore`.
- **Travel (P2.2 — `runtimeTravelCoordinator.ts`, TAMAM):** `travelState`,
  `requestLevelTravel`, `enqueueLevelTravel`, `runTravel`, `holdLoadingMinimum`
  coordinator'a tasindi; `levelTravel.ts` saf state machine olarak kaldi.
  `requestSaveGameLoad` travel'i tetikledigi icin save coordinator'in
  `enqueueLevelTravel` callback'i artik `travelCoordinator.enqueueLevelTravel`'e
  gidiyor; iki coordinator arasi tek yon bagimlilik korundu (`clearPendingRestore`
  deps callback'i ile travel -> save). **Sapma:** loading-overlay handoff
  (`beginLoadingUi`/`finishLoadingUi`/`setLoadingStatus`) shell'de kaldi — boot
  lifecycle (`loadActiveProjectScene` + per-faz `setLoadingStatus`) ile paylasimli
  oldugu icin travel-scope module'e cekmek shell -> coordinator yon kuralini
  bozardi; coordinator bunlari deps callback (`beginLoadingUi`/`finishLoadingUi`/
  `showLoadError`) uzerinden cagiriyor.
- **Spawn (P2.4 — `runtimeActorSpawnCoordinator.ts`, TAMAM):** `nextRuntimeActorId`
  sayaci + `nextSpawnedActorEntityId` id-uretimi + `spawnRuntimeActor` orkestrasyonu
  coordinator'a tasindi. **Kapsam karari:** `registerActorEntity`,
  `destroyActorEntity` ve `actorEntityById`/`actorEntities` koleksiyonlari shell'de
  KALDI — bunlar scene-build sahipli (her level build'de doluyor, 8+ yerden okunuyor);
  coordinator'a almak shell -> coordinator yon kuralini ters cevirirdi. destroy saf
  koleksiyon temizligi, coordinator'in sahiplendigi hicbir state'e dokunmuyor, o yuzden
  shell'de birakildi (plan zaten "once id/registry cekirdegi, sonra spawn/destroy
  kademeli" diyordu). Scene-build wiring (`loadActorClass`/`loadActorMeshModels`/
  `addActorObject`/physics+behavior `addEntity`/autoplay) deps-callback olarak verildi;
  spawn evaluation-order (index arg vs entityId artimi) birebir korundu.
- **Debug snapshot (P2.5 — `runtimeDebugSnapshot.ts`, TAMAM):** saf okumalar
  `getPerfMemorySnapshot`, `getGameModeDebugSnapshot`, `getUiDebugSnapshot` yan
  etkisiz `build*` helper'larina alindi (shell metotlari artik ince delegasyon). Tek-satir delegasyonlar (`getRenderStats`,
  `getSubsystemProfileSnapshot`, `getVfxDebugSnapshot`,
  `getScriptMessageDebugSnapshot`, `getAiDebugSnapshot`) dusuk deger — shell'de
  kalabilir. Uyari: AI nav debug view kumesi (`getAiNavigationDebugSnapshot`,
  `aiPerceptionView`, `aiQueryView`, `aiTargetPointRouteView`,
  `aiAgentClearanceView`, `updateAiNavigationDebugView`) pathfinding helper'lariyla
  (`aiNavAgentForEntity`, `aiEffectiveClearanceRadius`) paylasimli — saf "debug"
  degil; AI kumesiyle birlikte degerlendirilmeli, debug modulune zorla cekilmemeli.
- **Shell'de kalan (kompozisyon/lifecycle/render — coordinator hedefi degil):**
  `constructor`, `start`, `dispose`, `buildScene`, `teardownScene`,
  `loadActiveProjectScene`, `handleResize`; tum ortam/render builder'lari
  (`applyRuntimeSky/Fog/Clouds/Reflection/PostProcess`, `buildRuntime*`,
  `landscape*`, `addLight`, `addCharacter`, `syncInstanceTransform`); AI
  pathfinding cekirdegi (`requestAiMove`, `buildAiPath`, `aiMoveIntentForEntity`,
  nav sampler'lar); UI store guncellemeleri (`updateUiStore`, `updateUiInput`,
  `openPauseMenu`); `updateAudioListener`, `applyKillZ`, `applyPlayCameraHandoff`.

Checklist:

- [x] **P2.1 - Remainder map:** `RuntimeSceneApp.ts` icin metot/sorumluluk
  haritasi cikarildi (yukaridaki "P2.1 Remainder Map" bolumu); hangi metotlar
  travel/save/spawn/debug olarak tasinacak deps-interface deseniyle isaretlendi.
- [x] **P2.2 - Travel coordinator extraction:** `src/scene/runtimeTravelCoordinator.ts`
  (`RuntimeTravelCoordinator` + `RuntimeTravelCoordinatorDeps`). `travelState`,
  `requestLevelTravel`, `enqueueLevelTravel`, `runTravel`, `holdLoadingMinimum`
  coordinator'a tasindi; `levelTravel.ts` saf state machine olarak kaldi. Scene
  teardown/build, loading overlay handoff ve pending-restore temizligi shell'de
  deps callback olarak kaldi; davranis birebir korundu. `RuntimeSceneApp.ts`
  4784 -> 4724 satir. Dogrulama: `tsc` temiz, `test:engine` 779 checks,
  `verify:imports` PASS, `runtime-portal` + `runtime-checkpoint` +
  `runtime-locomotion` browser smoke yesil (travel round-trip + save/pending-restore
  travel + locomotion kanitli).
- [x] **P2.3 - Save coordinator extraction:** `src/scene/runtimeSaveCoordinator.ts`
  (`RuntimeSaveCoordinator` + `RuntimeSaveCoordinatorDeps`). `SaveGameStore` ve
  pending-restore latch'ini sahiplenir; quick slot write/load/delete, checkpoint
  save, UI field refresh, reserved `save:*` UI mesajlari ve pending-restore
  uygulamasi buraya tasindi. Gameplay capture/apply (`collectCurrentSaveState`,
  `applySavedPlayerTransform`) ve level travel shell'de deps callback olarak kaldi;
  davranis birebir korundu. `RuntimeSceneApp.ts` 4885 -> 4784 satir. Dogrulama:
  `tsc` temiz, `test:engine` 777 checks, `verify:imports` PASS,
  `runtime-checkpoint` + `runtime-portal` browser smoke yesil (save autosave +
  load round-trip + travel/pending-restore kanitli). (`runtime-playflow` bu
  makinede boot/scene-load 60s zaman asimiyla flaky — main'de de ayni sekilde
  duser, bu extraction'dan bagimsiz cevresel bir sorun.)
- [x] **P2.4 - Runtime actor spawn extraction:** `src/scene/runtimeActorSpawnCoordinator.ts`
  (`RuntimeActorSpawnCoordinator` + `RuntimeActorSpawnCoordinatorDeps`).
  `nextRuntimeActorId` sayaci + `nextSpawnedActorEntityId` id-uretimi +
  `spawnRuntimeActor` orkestrasyonu (class yukle -> entity kur -> register ->
  mesh/render/physics/behavior -> autoplay) + owner/instigator attribution buraya
  tasindi; teardown `reset()` cagiriyor. Scene-build sahipli registry
  (`actorEntityById`/`actorEntities`/`registerActorEntity`) ve `destroyActorEntity`
  bilincli olarak shell'de kaldi (bkz. yukaridaki kapsam karari), deps-callback ile
  eriliyor. `RuntimeSceneApp.ts` 4710 -> 4685 satir. Dogrulama: `tsc` temiz,
  `test:engine` 789 checks (+3 yeni: layout yokken sessiz drop, sirali wiring + owner
  attribution, id-collision skip; stub deps ile canli sahne olmadan), `verify:imports`
  PASS, `runtime-portal` browser smoke yesil (boot + teardown/reset + travel round-trip).
- [x] **P2.5 - Debug snapshot extraction:** `src/scene/runtimeDebugSnapshot.ts`
  (`buildPerfMemorySnapshot` / `buildGameModeDebugSnapshot` / `buildUiDebugSnapshot`).
  Uc gercek "resolution logic" tasiyan snapshot uretimi (memory heap guard,
  possessed-pawn null-branching, UI host default-fallback) yan etkisiz saf
  fonksiyonlara alindi; subsystem erisimi shell'de deps-callback (`locomotionReportOf`/
  `movementModeOf`/`positionOf` + `host`/`fields`) uzerinde kaldi. Snapshot tipleri
  `RuntimeSceneApp.ts`'te export kaldi (module type-only import eder — sifir runtime
  bagimliligi, game bundle genislemez). Tek-satir subsystem delegasyonlari
  (`getRenderStats`/`getVfxDebugSnapshot`/vs.) ve AI nav debug kumesi bilincli olarak
  shell'de birakildi. Debug kapaliyken maliyet artmaz (builder'lar yalniz `?debug`
  formatter'larindan cagriliyor). `RuntimeSceneApp.ts` 4724 -> 4691 satir. Dogrulama:
  `tsc` temiz, `test:engine` 784 checks (+5 yeni saf-builder testi: heap guard,
  possessed/unpossessed dallanmasi, UI host boottan once/sonra), `verify:imports`
  PASS, `runtime-locomotion` smoke yesil (`?debug` game-mode/memory/ui readout'lari
  yeni builder'lardan geciyor).
- [x] **P2.6 - Yeni ozellik kurali:** `docs/architecture/ARCHITECTURE.md`
  Dependency Rules'a "Runtime features come as modules, not shell code" alt basligi
  eklendi: yeni runtime ozelligi kabuga metot/alan yiginca degil, kendi state'ini
  sahiplenen kucuk coordinator + deps-callback interface olarak `src/scene/` altinda
  gelir; saf resolution/assembly logic serbest fonksiyon/modul olur. Precedent olarak
  `runtimeSaveCoordinator` / `runtimeTravelCoordinator` / `runtimeDebugSnapshot` +
  `levelTravel` sayildi; shell -> coordinator tek yon ve `RuntimeSceneApp -> editor`
  yasagi vurgulandi.

Kabul kriterleri:

- Public runtime davranisi degismez; browser smoke ve engine tests yesil kalir.
- `RuntimeSceneApp.ts` kompozisyon kabuguna yaklasir; yeni moduller scene
  sinirini editor/game import kurallarini bozmadan korur.
- `verify:imports` yesil kalir; `RuntimeSceneApp -> editor` yasagi korunur.

---

## P3 - Save-Game Zarf Sozlesmesi

Amac: Fork tuketicisinin save tasarimini tahminle degil, yazili sozlesmeyle
yapmasini saglamak. Bu faz Baslik 4 Aksiyon 4'u kapatir.

Dokuman: `docs/architecture/SAVE_GAME_CONTRACT.md` (yazildi).

Checklist:

- [x] **P3.1 - Kaydedilen alanlar:** Envelope (`schema`/`gameId`/`createdAt`/
  `updatedAt`/`payload`) + `GameSaveState` payload (`activeLevelPath`, `player`
  {position + facingYawDeg}, `flags` = opt-in persistent script state) tablo
  halinde; slot key semasi + schema=1 / migrate-hook durumu aciklandi.
- [x] **P3.2 - Bilerek kaydedilmeyen alanlar:** Layout/scene geometrisi, editor
  state, runtime-spawned/destroyed actor'lar (opt-in marker haric), transient
  behavior latch'leri, UI ephemeral state, physics impulse/velocity, kamera, AI
  runtime state, VFX/audio/timer listelendi.
- [x] **P3.3 - Opt-in persistent-state deseni:** `context.state.persist(key,
  value)` ornegi; reserved hidden/collision/destroyed marker'lari; restore'un
  transform'dan once uygulandigi; migration'in envelope seviyesinde yapilacagi.
- [x] **P3.4 - Load/travel sozlesmesi:** `requestSaveGameLoad` -> kayitli level'a
  travel -> scene build sonrasi `applyPendingSaveRestore` (level eslesmesi
  sarti) -> flags sonra player transform; portal travel'in pendingRestore'u
  temizledigi yazildi.
- [x] **P3.5 - Validator gotcha:** Save payload'inin localStorage-only oldugu ve
  `tools/saveValidator.ts`'ten gecmedigi; layout allowlist zorunlulugunun
  authoring'e ait ayri bir konu oldugu; save state'in layout'a yazilmayacagi
  vurgulandi.
- [x] **P3.6 - Baglanti guncellemeleri:** `docs/architecture/ARCHITECTURE.md`
  ("Layout Data ≠ Save Game Data" paragrafi) ve `README.md` (slot-based
  save/load satiri) sozlesmeye link veriyor.

Kabul kriterleri:

- Bir fork gelistiricisi hangi state'in kaydolacagini ve neyin bilincli olarak
  kaydolmayacagini tek dokumandan anlayabilir.
- Baslik 4'teki "save zarfi beyansiz" riski kapali olarak isaretlenir.

---

## P4 - AI Move-Intent ve Facing Varsayimi Yol Haritasi

Amac: Baslik 4'te kalan kucuk bilinen sinirlari dogru yere baglamak; bu faz
runtime yeterliligini bloklayan yeni AI implementasyonu degildir.

Checklist:

- [x] **P4.1 - AI plan baglantisi:** Eski AI plani tamamlanip
  `C:\Users\emret\Documents\Forge-Archive` altina tasindi (in-repo kayit:
  `docs/COMPLETED_WORK_INDEX.md`). Move-intent on kosulu planlanmakla kalmadi:
  `CharacterMovementSubsystemOptions.getMoveIntent(...)` ve
  `RuntimeSceneApp.aiMoveIntentForEntity(...)` ile AI path-following sonucunu
  ayni CharacterMovement hattina verir.
- [x] **P4.2 - Facing varsayimi:** `+z-forward` mesh varsayimi ve ters bakan
  asset icin gelecek skeleton-sidecar override siniri aktif
  `docs/backlog/SKELETAL_FACING_OVERRIDE_BACKLOG.md` dokumaninda yazildi.
- [x] **P4.3 - Validator onkosulu:** Backlog, skeleton sidecar'a alan
  eklendiginde `tools/saveValidator.ts` ile
  `src/scene/assetSkeletonLoader.ts` validate/loader sozlesmesinin ayni dilimde
  birlikte guncellenecegini ve testlenecegini aciklar.
- [x] **P4.4 - Tetikleyici kriterleri:** Backlog'un aktif implementasyona
  donus kriterleri yazildi: ilk gercek oyun forkunda ters-forward skeletal
  asset, animator-authored facing metadata veya `+z`'ye donusturmeden import
  gereksinimi.

Kabul kriterleri:

- AI move-intent uygulanmis; kalan facing siniri
  `SKELETAL_FACING_OVERRIDE_BACKLOG.md` altinda bilincli backlog olarak kalir ve
  runtime yeterlilik kararini bloklayan belirsizlik olmaktan cikar.

---

## P5 - Baslik 4 Yeterlilik Karari

Amac: Fazlar tamamlaninca ana analiz dokumanindaki Baslik 4 kararini kanitla
yeniden degerlendirmek.

Checklist:

- [~] **P5.1 - Full gate:** Pratikse su komutlari ayni son dilimde calistir:
  `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`,
  `npm.cmd run build:verify`, `npm.cmd run smoke:browser`.
  Ilk deneme (2026-07-13) `npx.cmd tsc --noEmit` asamasinda, aktif Foliage Mode
  calisma-agaci degisikliklerinde `AssetType`e eklenen `foliageType` icin
  `tools/saveValidator.ts` `ASSET_TYPE_CATEGORY` eslemesinin eksik olmasi
  nedeniyle durdu. Bu checklist dilimiyle ilgisiz olan degisiklik tamamlaninca
  tum gate yeniden calistirilacak.
- [ ] **P5.2 - Ana analiz guncellemesi:** `FORGE_YETERLILIK_ANALIZI.md` Baslik
  4 durum/kanit/eksikler/karar/aksiyonlar alanlarini yeni kanitlarla guncelle.
- [ ] **P5.3 - Kanit ve Aksiyon Kaydi:** Ana dokumanin tablo sonuna kapanis
  satiri ekle.
- [ ] **P5.4 - Checklist tasima karari:** Bu dokuman tum fazlar `[x]` olunca
  the completed-work archive listed in `docs/COMPLETED_WORK_INDEX.md` altina tasinabilir.

`[x] Yeterli` icin minimum karar kosulu:

- Browser smoke runtime oynanis dongusunu gercek input + sensor travel +
  checkpoint autosave ile kanitliyor.
- `RuntimeSceneApp` icin yeni ozelliklerin kabuga yigilmasini durduran uygulanmis
  moduller ve yazili kural var.
- Save-game zarfi fork tuketicisi icin yazili ve linklenmis.
- AI/facing sinirlari bilincli backlog olarak ilgili planlara bagli.

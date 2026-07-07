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
| P1 | `[ ]` | P0 | Runtime browser smoke borcunu kapat. |
| P2 | `[ ]` | P1 onerilir | `RuntimeSceneApp` kabugunu davranis koruyan modullere bol. |
| P3 | `[ ]` | P0 | Save-game zarf sozlesmesini yazili hale getir. |
| P4 | `[ ]` | P3 onerilir | AI move-intent ve +z-forward facing varsayimini yol haritasina bagla. |
| P5 | `[ ]` | P1-P4 | Baslik 4 kararini tekrar degerlendir ve ana analiz kaydini guncelle. |

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

- [ ] **P1.1 - Fixture haritasi:** Mevcut `__playwright-smoke` layout/menu
  fixture'larini incele; yuru/zipla, portal sensor, checkpoint sensor ve debug
  overlay icin tek fixture seti yeterli mi karar ver.
- [ ] **P1.2 - Yuru/zipla smoke:** Chromium testinde runtime sahnesini ac,
  klavye input'u ile pawn hareketini ve jump/grounded degisimini gozlenebilir
  bir runtime sinyalinden dogrula. Test canvas focus/pointer-lock kirilganligina
  karsi deterministik olmali.
- [ ] **P1.3 - Portal sensor gidis-gelis:** `travel:` UI mesajini degil, gercek
  `level-travel` sensor davranisini kullan. Oyuncuyu portal alanina sok, hedef
  level'in yuklendigini dogrula, geri donus trigger'inin ayni testte ikinci kez
  calistigini kanitla.
- [ ] **P1.4 - Checkpoint autosave:** Oyuncuyu checkpoint sensorune sok; ilgili
  slotun yazildigini, load sonrasi player transform/respawn noktasinin
  checkpoint'e dondugunu dogrula.
- [ ] **P1.5 - `?debug` overlay smoke:** `/?debug` veya esdeger route ile
  runtime'i ac; perf/gameplay/ui/loading/memory readout'larinin mount oldugunu ve
  konsolda yeni hata olmadigini dogrula.
- [ ] **P1.6 - Actor Runtime API browser borcu (A5.5):** Actor spawn/destroy veya
  script message akisindan biri browser smoke icinde gozlenebilir hale getir;
  archived completed doc ACTOR_RUNTIME_API_CHECKLIST.md (see docs/COMPLETED_WORK_INDEX.md) icindeki acik A5.5 notunu
  kapat.
- [ ] **P1.7 - Dokuman senkronu:** Baslik 4, bu checklist ve ilgili completed
  checklist'lerde runtime smoke borcu artik acik kalmamali.

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

Checklist:

- [ ] **P2.1 - Remainder map:** `RuntimeSceneApp.ts` icin metot/sorumluluk
  haritasi cikar; hangi metotlar travel/save/spawn/debug olarak tasinacak
  dokumana islenir.
- [ ] **P2.2 - Travel coordinator extraction:** `travelState`,
  `requestLevelTravel`, queue process ve loading overlay handoff'unu kucuk
  coordinator'a al. `levelTravel.ts` saf state machine olarak kalmali.
- [ ] **P2.3 - Save coordinator extraction:** `SaveGameStore`, quick slot
  write/load/delete, checkpoint save, UI field refresh ve pending restore
  uygulamasini bir modulle sinirla.
- [ ] **P2.4 - Runtime actor spawn extraction:** `spawnRuntimeActor`, id uretimi,
  owner/instigator ve live actor registry guncellemelerini kucuk bir modulle
  sinirla.
- [ ] **P2.5 - Debug snapshot extraction:** `?debug` overlay icin snapshot
  uretimini yan etkisiz helper'lara al; debug kapaliyken runtime maliyeti
  artmamali.
- [ ] **P2.6 - Yeni ozellik kurali:** `docs/architecture/ARCHITECTURE.md` veya
  uygun workflow dokumanina "runtime ozellikleri once modul/coordinator olarak
  gelir; kabuga dogrudan buyuk renderer/manager eklenmez" kuralini ekle.

Kabul kriterleri:

- Public runtime davranisi degismez; browser smoke ve engine tests yesil kalir.
- `RuntimeSceneApp.ts` kompozisyon kabuguna yaklasir; yeni moduller scene
  sinirini editor/game import kurallarini bozmadan korur.
- `verify:imports` yesil kalir; `RuntimeSceneApp -> editor` yasagi korunur.

---

## P3 - Save-Game Zarf Sozlesmesi

Amac: Fork tuketicisinin save tasarimini tahminle degil, yazili sozlesmeyle
yapmasini saglamak. Bu faz Baslik 4 Aksiyon 4'u kapatir.

Onerilen dokuman: `docs/architecture/SAVE_GAME_CONTRACT.md`

Checklist:

- [ ] **P3.1 - Kaydedilen alanlar:** Current level path, player transform,
  opt-in persistent script state, slot metadata ve schema version alanlarini
  acikla.
- [ ] **P3.2 - Bilerek kaydedilmeyen alanlar:** Layout data, editor state,
  spawned/destroyed runtime actors, transient behavior latch'leri, UI ephemeral
  state, physics impulse/velocity gibi alanlari listele.
- [ ] **P3.3 - Opt-in persistent-state deseni:** Actor Script veya behavior'in
  hangi kosulda save'e state yazabilecegini ve migration hook'un nasil
  kullanilacagini ornekle.
- [ ] **P3.4 - Load/travel sozlesmesi:** Save load'un once kayitli level'a
  travel ettigini, restore'un scene build sonrasinda uygulandigini yaz.
- [ ] **P3.5 - Validator gotcha:** Yeni layout/sidecar alanlari icin
  `tools/saveValidator.ts` allowlist zorunlulugunu hatirlat; save-game runtime
  state'inin layout'a yazilmayacagini tekrar vurgula.
- [ ] **P3.6 - Baglanti guncellemeleri:** `README.md`,
  `docs/architecture/ARCHITECTURE.md` veya fork workflow dokumanindan yeni
  sozlesmeye link ver.

Kabul kriterleri:

- Bir fork gelistiricisi hangi state'in kaydolacagini ve neyin bilincli olarak
  kaydolmayacagini tek dokumandan anlayabilir.
- Baslik 4'teki "save zarfi beyansiz" riski kapali olarak isaretlenir.

---

## P4 - AI Move-Intent ve Facing Varsayimi Yol Haritasi

Amac: Baslik 4'te kalan kucuk bilinen sinirlari dogru yere baglamak; bu faz
runtime yeterliligini bloklayan yeni AI implementasyonu degildir.

Checklist:

- [ ] **P4.1 - AI plan baglantisi:** `docs/planned/AI_SYSTEM_RESEARCH_AND_PLAN.md`
  icinde AI/NPC hareketinin move-intent refactor'una bagli oldugunu netlestir.
- [ ] **P4.2 - Facing varsayimi:** `+z-forward` mesh varsayimini kabul edilmis
  mevcut sinir olarak yaz; ters bakan asset icin gelecek cozumun skeleton sidecar
  facing override'i oldugunu not et.
- [ ] **P4.3 - Validator onkosulu:** Skeleton sidecar'a yeni facing alanlari
  eklenecekse `tools/saveValidator.ts` ve
  `src/scene/assetSkeletonLoader.ts` validate/loader sozlesmesinin birlikte
  guncellenecegini belirt.
- [ ] **P4.4 - Tetikleyici kriterleri:** Hangi durumda bu backlog'un aktif ise
  donusecegini yaz: NPC locomotion baslamasi, ters-forward skeletal asset'in
  ilk gercek oyun forkunda kullanilmasi, veya animator-authored facing metadata
  ihtiyaci.

Kabul kriterleri:

- AI/facing sinirlari Baslik 4'te bilincli backlog olarak kalir; runtime
  yeterlilik kararini bloklayan belirsizlik olmaktan cikar.

---

## P5 - Baslik 4 Yeterlilik Karari

Amac: Fazlar tamamlaninca ana analiz dokumanindaki Baslik 4 kararini kanitla
yeniden degerlendirmek.

Checklist:

- [ ] **P5.1 - Full gate:** Pratikse su komutlari ayni son dilimde calistir:
  `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`,
  `npm.cmd run build:verify`, `npm.cmd run smoke:browser`.
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

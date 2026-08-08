# ThreeAges RTS - Ana Menu ve Yukleme Ekrani Plani

Olusturulma tarihi: 2026-08-08
Durum: **F1, F2, F3 ve (planda olmayan) F5 kod olarak bitti (2026-08-08);
gorsel kabul kullanicidadir. F4 (dogrulama) kaldi.**

F2 ile ana menu ayri bir asama oldu: `?rts` artik once perde, sonra menu, sonra
mac aciyor. Dort `location.reload()` silindi, baslangic karti `RtsApp`'ten cikip
menuye tasindi, `RtsApp` maci perde kalkinca kendisi basliyor. Ilk bos siyah
canvas penceresi de kapandi - perde artik `main()`'in **ilk await'inden once**
kuruluyor.

F3 ile mac yuklemesi tiklamadan *once* basliyor: menu ekrandayken sekiz balance
JSON, caravan, tradeSite, Actor katalogu ve `RtsApp` chunk'i cekiliyor, seri
duran iki balance cagrisi da `Promise.all`'a katildi (§2.1 adim 3-4). Tiklamadan
sonra yalniz ayara bagli olanlar kaliyor: mission script + level JSON.

F5 (§7.5) planin disindan geldi: menu bir asama olduktan sonra tek yonlu
kalmasi tutarsizdi, artik duraklatma ve sonuc kartlarinda "Ana Menü" var ve rota
menu → mac → menu diye donuyor.

Kalan: F4 (dogrulama; §9'daki spec sirasi borcu).

F1 sirasinda planin bir ifadesi duzeltildi: §5'in "firstFrame" izi paydasiz
dusunulmustu, ama paydasiz bir iz butun cubugu boot boyunca *belirsiz* modda
birakiyor (determinate kurali her canli izin paydasini sart kosuyor). Iz artik
tek adimlik bir payda ile bildiriliyor (`report("firstFrame", 0, 1)`); yuzde bu
sayede gorunuyor. §7.1'e islendi.

Bu plan bir gorsel sikayetle basladi: "oyun acilista landscape gostermeden once
duz bir zemin gosteriyor, birimlerden once kapsul gosteriyor." Kod okununca
sikayetin **kendisi semptomdu**; asil bulgu asagida §2.1'de. Plan o bulguya gore
kuruldu, sikayete gore degil.

## 1. Bulgunun ozeti

Iki placeholder (duz zemin + kapsul) bilincli birer "playable fallback"tir ve
kaldirilmalari degil, **gorunmez kilinmalari** gerekir. Ama olculdugunde asil
kayip yer onlar cikmadi: RTS rotasi, `new RtsApp(...)` cagrilmadan **once** yedi
ayri await adimi kosuyor ve bu surenin tamaminda ekranda bos bir canvas var -
baslangic karti bile yok. Yani bugun oyuncunun gordugu sira sudur:

1. Bos siyah canvas (tum veri yuklemesi burada)
2. Yarim kurulmus sahne + uzerinde baslangic karti
3. Kart durur, arkada landscape ve modeller tek tek "pop" eder

Kullanicinin onerdigi cozum - **menu ile mac'i iki ayri asamaya ayirmak** - bu
uc adimin ucunu de kapatiyor. Plan budur.

## 2. Bugunku durum (olculmus)

### 2.1 Boot sirasi: `new RtsApp` oncesi yedi await

`src/main.ts`, RTS rotasi (`?rts`, satir 179-329). Hepsi seri veya yari seri:

| # | Adim | Yer |
| --- | --- | --- |
| 1 | `bootFoundation()` -> preset fetch | `main.ts:130` |
| 2 | 8 balance JSON (`Promise.all`) | `main.ts:181-190` |
| 3 | `loadCaravanBalance()` - **seri, paralel degil** | `main.ts:191` |
| 4 | `loadTradeSiteBalance()` - **seri, paralel degil** | `main.ts:194` |
| 5 | `loadRtsContentCatalog(...)` | `main.ts:199` |
| 6 | `loadMissionScript(...)` | `main.ts:211-219` |
| 7 | `loadRtsLevel(...)` (level JSON) | `main.ts:247-250` |
| 8 | `new RtsApp(...)` | `main.ts:258` |
| 9 | `rts.start()` | `main.ts:329` |

Adim 3 ve 4'un `Promise.all`'a katilmamasi ayri, kucuk ve bagimsiz bir kayiptir;
F3'te duzeltilecek (§7.3).

### 2.2 Iki placeholder

**Duz zemin.** `createRtsGround()` sahneye hemen giriyor
(`RtsApp.ts:2006-2010`, `canvas.dataset.rtsGround = "flat"`); authored world
`void this.loadAuthoredWorld(...)` ile beklenmeden baslatiliyor
(`RtsApp.ts:2025-2027`). Landscape mount edilince `retireFlatGround()`
(`RtsApp.ts:4221-4235`) onu siliyor ve witness `"landscape"` oluyor
(cagri yeri: `RtsApp.ts:4149-4153`).

**Kapsuller.** `void this.loadActorVisuals(); this.spawnStartingUnits();`
(`RtsApp.ts:1857-1858`) - birimler model paketi gelmeden doguyor ve
`installPresentation(null, ...)` yolundan `CapsuleGeometry`/`BoxGeometry` govde
takiyor (`unit.ts:714-730`). Paket gelince `units.refreshPresentations()`
(`RtsApp.ts:4803` -> `unitSystem.ts:73-82`) gercek GLB ile degistiriyor.

**Ikisi de kalacak.** Yukleme basarisiz olursa (`dataset.rtsAuthoredWorld =
"fallback"`, `RtsApp.ts:4168-4171`) oyun bosluga dusmesin diye sigortadirlar.
Bu plan onlari silmez, **perdenin arkasinda birakir**.

### 2.3 Dort `location.reload()`

Su an dort ayar secildiginde sayfa bastan yukleniyor, cunku §13 bayraklari
kurulusta sabitliyor:

| Ayar | Yer |
| --- | --- |
| Zafer kosulu | `main.ts:267-270` |
| Savas sisi | `main.ts:273-276` |
| Hikaye/ogretici modu | `main.ts:315-320` |
| Zorluk (AI profili) | `main.ts:323-326` |

**Menu, RtsApp'ten once yasadigi anda dordu de gereksizlesir.** Secim yalnizca
bir degisken olur; RtsApp zaten sonra kurulacaktir. Bu, planin kod *silen* tek
parcasi ve en buyuk sadelesmesi.

### 2.4 `RtsMatchOverlay` uc is birden yapiyor

`src/game/rts/match/rtsMatchOverlay.ts` tek sinifta uc karti tasiyor:

- **Baslangic karti** - `showStart` (`RtsApp.ts:1901`), kurulum satirlari
  `buildSetup()` (`rtsMatchOverlay.ts:319`), buton `"Maçı Başlat"`
  (`rtsMatchOverlay.ts:644`)
- **Duraklama karti** - `showPause` (`RtsApp.ts:4532`)
- **Sonuc karti** - `showResult` (`RtsApp.ts:4542`)

Menuye tasinacak olan **yalniz birincisidir**. Duraklama ve sonuc kartlari
RtsApp'te kalir; onlar calisan bir macin parcasidir.

## 3. Hedef akis

```text
/?rts acilir
   |
   v
[YUKLEME EKRANI]  loading-background.jpg + ilerleme cubugu
   |  (menunun ihtiyaci olan asgari veri + on-yukleme baslar)
   v
[ANA MENU]  menu-background.jpg + ortada mevcut kurulum karti
   |  ayarlar degistirilir -> reload YOK, sadece degisken
   |  "Maçı Başlat"
   v
[YUKLEME EKRANI]  ayni perde, ikinci kez: RtsApp kuruluyor
   |  gercek ilerleme cubugu (actor pack + authored world + map art)
   |  %100 + ilk cizilmis kare
   v
[OYUN]  perde acilir, sahne tam kurulmus halde gorunur
```

Perde iki kez cikar ama ikisi de kisadir: ilki yalnizca menunun kendisini
bekler, ikincisi §7.3'un on-yuklemesi sayesinde isin yarisini bitmis bulur.

## 4. Kilitlenen kararlar

**KARAR 1 - Menu `?rts` rotasinda kalir, `/` degil.** `/` su an Forge'un
karakter runtime'i (`main.ts:364`) ve CLAUDE.md template'i genel tutmayi sart
kosuyor. ThreeAges'in menusu ThreeAges'in rotasinda durur.

**KARAR 2 - Sayfa yenilemesi yok; ayni sayfada gecis.** "Maçı Başlat" bir
`location.href` atamasi degil, DOM teardown + `new RtsApp(...)` olur. Gerekcesi
dogrudan §7.3'tur: reload, menude on-yukledigimiz her seyi coper.

**KARAR 3 - URL yine de ayarlari yansitir.** Gecis aninda `history.pushState`
ile adres `?rts&...` haline gelir. Boylece o link paylasildiginda veya sayfa
yenilendiginde menu atlanir ve dogrudan o mac acilir. Kullanicinin "ayarlara
uygun olarak olusturulan yola gidecek" ifadesi bu sekilde karsilanir - hem SPA
hizini hem gercek rotayi verir.

**KARAR 4 - Editor Play yolu menuyu atlar.** `?level=` ile gelen istek
(editorun Play butonu, `rtsLevelRef.ts`) dogrudan yukleme -> oyun akisina
duser. Yazar bir seviyeyi denemek icin menuden gecmez.

**KARAR 5 - Iki placeholder silinmez.** §2.2'deki gerekce. Perde onlari
gizler; hata halinde hala oradadirlar.

**KARAR 6 - Ilerleme cubugu uydurulmaz.** §5'te gercek payda var. Payda
bilinmeden once cubuk *belirsiz* (indeterminate) modda durur, payda gelince
determinate'e geceer. Zaman bazli sahte animasyon yazilmayacak.

## 5. Ilerleme cubugunun gercek kaynaklari

Uc bagimsiz iz, hepsinin paydasi yuklemenin **icinde** biliniyor:

| Iz | Payda | Tick | Agirlik |
| --- | --- | --- | --- |
| Actor pack | `rtsContentCatalogRefs(catalog).length` (`rtsActorVisualFactory.ts:210-211`) | her `loadActor(ref)` settle (`:216-224`) | buyuk |
| Authored world | `sceneModelAssetIds(layout).length` (`authoredWorld.ts:319`) | her model + landscape sidecar/layer texture (`:393-425`) | buyuk |
| Map art | tek adim | `loadMapArt` (`RtsApp.ts:4047`) | kucuk |

Ikisi de `Promise.all` oldugu icin ilerleme **dogrusal degil patlamalidir**.
Bu kabul edilir: sahte degildir, ve yanlis bir dogrusallik vaadi vermez.

Mevcut witness'lar (smoke suiti bunlari zaten okuyor, korunacak):
`canvas.dataset.rtsAuthoredWorld` (`RtsApp.ts:1081`, `:4167`, `:4170`),
`rtsContentAssets` (`:1108`), `rtsMapArt` (`:2020`), `rtsGround`
(`:2010`, `:4225`). Bunlara `data-rts-loading` eklenir.

## 6. Dort tuzak

**T1 - Payda gec geliyor.** Toplam sayi iki manifest fetch'i bitmeden
bilinmiyor. Cozum: KARAR 6'daki indeterminate -> determinate gecisi.

**T2 - %100 hazir demek degil.** Son promise cozuldukten sonra GPU upload ve
ilk karenin shader derlemesi var; cubuk %100'de donar, sonra ekran acilir.
Cozum: son dilim buna ayrilir - `renderer.compile()` + iki cizilmis kare
beklenir, perde **gercekten cizilmis ilk kareden sonra** kalkar.

**`compileAsync()` degil** (bu ilk yazilista tersi secilmisti; §7.1'e bakiniz).
three r184'te `compileAsync` once ayni senkron `compile()`'i kosuyor, sonra
`setTimeout` dongusuyle materyallerin surucu hazirligini yokluyor - ve o yoklama
`currentProgram.isReady()`'yi `currentProgram` var mi diye bakmadan cagiriyor.
Programsiz tek bir materyal timer'in *icinde* firlatiyor; hata `await`/`catch`
zincirinin disinda kaliyor, promise hic cozulmuyor, ilk-kare sayaci hic
kurulmuyor ve perde T3 timeout'una (20 sn) kadar asili kaliyor. Pahali yari
zaten iki durumda da senkron kostugu icin async surum bu kilitlenmeden baska
hicbir sey kazandirmiyordu. `RuntimeSceneApp.warmRuntimeShaders()` ayni tuzagi
zaten belgelemis; RTS rotasi simdi onunla ayni karari veriyor.

**T3 - Hata yollari perdeyi kapatmali.** `dataset.rtsAuthoredWorld = "fallback"`
ve actor pack'in `catch`'i (`RtsApp.ts:4821`) de "bitti" sayilir. Ustune sert
bir timeout (~20 sn): tek bir olu fetch oyuncuyu perdede kilitlemez.

**T4 - Smoke suiti.** §9.

## 7. Fazlar

### 7.1 F1 - Yukleme ekrani + ilerleme cekirdegi — **BITTI (2026-08-08)**

- `src/game/rts/ui/rtsLoadingScreen.ts`: tam ekran katman, arka plan gorseli,
  ilerleme cubugu, `data-rts-loading` witness'i (`loading` / `done`).
  `#ui-overlay` altina baglanir (mevcut kartlarin yaptigi gibi,
  `rtsMatchOverlay.ts:303`).
- `src/game/rts/loading/rtsLoadProgress.ts`: agirlikli izler,
  `report(track, done, total)` / `settle(track)` / `settleAll()`. DOM'suz, cunku
  cubugun aritmetigi engine check'iyle pinlenebilecek tek parcasi - alti check
  yazildi (indeterminate gecisi, monotonluk, hatanin perdeyi acmasi, ilk kare
  son dilimi, agirlik renormalizasyonu, bos yuk).
- **Plan duzeltmesi:** `firstFrame` izi paydasiz tasarlanmisti; determinate
  kurali her canli izin paydasini sart kostugu icin bu, cubugu boot boyunca
  belirsiz modda birakiyordu. Iz artik tek adimlik payda ile bildiriliyor
  (`report("firstFrame", 0, 1)`), tipki `mapArt` gibi.
- **T2 once `compileAsync()` ile yapildi; bu bir hataydi ve geri alindi
  (2026-08-08).** Gerekce "compile senkron, perdeyi dondururdu" idi - ama
  `compileAsync` de ayni `compile()`'i kosuyor, ustune bir de kilitlenen bir
  hazirlik yoklamasi ekliyor. Semptom: perde ~20 saniye asili kalip T3
  timeout'uyla aciliyor. Ayrinti §6/T2'de. `armFirstLoadedFrame()` artik senkron
  ve `renderer.compile()` cagiriyor.
- Opsiyonel `onProgress` gecisleri:
  - `RtsActorVisualFactory.load(onProgress?)`
  - `AuthoredWorldOptions.onProgress?` (`src/scene/authoredWorld.ts` - engine
    tarafi, ama **opsiyonel** oldugu icin editor etkilenmez)
  - `loadRtsAuthoredWorld(...)` bunu gecirir (`rtsAuthoredWorld.ts:58-72`)
- T2 ve T3 burada uygulanir.
- CSS `src/style.css` icine, mevcut `.rts-match-overlay` bloklarinin
  (satir 223+) yanina.

F1 tek basina bugunku boot'un uzerinde calisir; menu olmadan da bir kazanctir.

### 7.2 F2 - Ana menu — **BITTI (2026-08-08)**

- Kurulum kartini `RtsMatchOverlay`'den ayirdik: satirlar, radyolar ve uc
  dropdown `src/game/rts/match/rtsMatchSetup.ts`'e (`RtsMatchSetup`) tasindi.
  Duraklama/sonuc kartlari `RtsMatchOverlay`'de kaldi (§2.4); `showStart`, dort
  opsiyonel handler ve `setupPopulated` mekanizmasi silindi.
- `src/game/rts/ui/rtsMainMenu.ts`: tam ekran katman, arka plan gorseli, ortada
  o kart. `.rts-match-overlay` / `.rts-match-card` sinif adlarini **bilerek**
  odunc aliyor - modal derisi ve §9'un smoke kancalari o adlara bagli.
- **Dort `location.reload()` silindi** (§2.3). Menu `RtsApp`'ten once kostugu
  icin uzlastirilacak bir sey kalmadi: `beginMatch()` 40 satirdan 4 satira indi.
  `sessionStorage` yazimi korundu ama artik yalnizca *yeni sekmenin* son kurulumu
  hatirlamasi icin - hicbir sey yeniden yuklenmiyor.
- **Baslangic karti yok; maci perde basliyor.** `RtsApp.start()` artik kart
  gostermiyor; `finishBootCurtain()` maci baslatiyor (`beginMatchWhenBooted`).
  Bunun yeri onemli: maci `start()`'ta baslatmak, AI'nin ilk saniyelerini oyuncuya
  hic gosterilmemis bir alanda, opak perdenin arkasinda oynatirdi.
- KARAR 2/3: menu teardown -> `history.pushState` -> ikinci perde ->
  `new RtsApp(...)` -> `rts.start()`. URL parametreleri
  `src/game/rts/match/rtsMatchSetupUrl.ts`'te: `mode`, `victory`, `fog`,
  `difficulty`, `seed`.
- KARAR 4 + KARAR 3'un atlatma yolu ayni kapida: `urlPinsMatchSetup()` -
  `?level=` (editor Play) **veya** `?mode=` (paylasilan link / yenileme) menuyu
  atlar.
- **Perde `main()`'in ilk await'inden once kuruluyor.** `bootFoundation()` bir
  preset cekiyor; perdeyi ondan sonra kurmak, kapatmak istedigimiz ilk bos
  pencereyi acik birakirdi. Kabul kriteri 1 bu satirla karsilaniyor.

### 7.3 F3 - Menude on-yukleme — **BITTI (2026-08-08)**

Menu ekranda dururken, **ayardan bagimsiz** olan her sey arka planda cekilir:
8 balance JSON + caravan + tradeSite (§2.1 adim 3-4 buraya `Promise.all`
icinde girer) + `loadRtsContentCatalog`. Ayara bagli olanlar (level JSON,
mission script) tiklama aninda baslar.

Bu, ikinci perdenin neden kisa olacaginin tek sebebidir; KARAR 2 de buradan
cikar.

Uygulama (`src/main.ts`, `preloadRtsMatchData()`):

- On-yuk tek bir fonksiyon oldu; `Promise.all` artik on bir dal tasiyor - sekiz
  balance + caravan + tradeSite + **`import("@/game/rts/RtsApp")`**. Modul
  chunk'i da ayardan bagimsizdir ve tiklamanin bekledigi tek en buyuk parcaydi,
  o yuzden o da menunun altina girdi. `loadRtsContentCatalog` ikinci adim olarak
  kaliyor: unit/building/animal tablolarindan **turetiliyor**, onlardan once
  baslayamaz.
- Baslatma noktasi menunun **kendi chunk'i geldikten sonra**
  (`import("@/game/rts/ui/rtsMainMenu")` await'inin ardindan). Oncesinde
  baslatmak, oyuncunun bekledigi ilk seyi mac yukunun arkasina kuyruklardi.
- `preload.catch(() => {})` sadece "sahipsiz rejection" damgasi icin; gercek
  `await` asagida durdugu icin olu bir katalog fetch'i **eskisiyle ayni yerde**
  firlatiyor (katalog hatasi rotaya hala olumcul).
- Menusuz yollar (paylasilan link, yenileme, editor Play) ayni fonksiyonu
  `preload ?? preloadRtsMatchData()` ile tiklama yerine kapida basliyor -
  ortusecek bir menuleri yok, davranis degismedi.

### 7.4 F4 - Dogrulama

`npx tsc --noEmit`, `npm run test:engine`, smoke spec guncellemesi (§9), ve
kapanista `npm run build:verify`.

### 7.5 F5 - Mactan ana menuye donus — **BITTI (2026-08-08)**

Planda yoktu; F3'ten sonra kullanici istedi. Menu bir asama oldugu anda tek yonlu
olmasi tutarsizdi - maci birakmanin tek yolu sayfayi yenilemekti.

- Duraklatma karti: **"Ana Menü"** butonu, "Yeniden Başlat" ile "Teslim Ol"
  arasinda (`rtsMatchOverlay.ts`, `key: "exit-to-menu"`). Onaysiz, cunku restart
  gibi maci harciyor, sicile yenilgi yazmiyor.
- **Sonuc kartina da eklendi.** Bitmis bir mac duraklatilamiyor
  (`togglePause`, `!this.match.active` erken donusu), yani sonuc karti menuye
  cikisi olmayan tek ekran olurdu.
- `RtsApp` kendini yikmiyor: `onExitToMenu` opsiyonel bir host handler'i
  (`RtsAppOptions`). Cagri, uygulamanin kendi overlay'inin click listener'i
  icinden geliyor; orada `dispose()` cagirmak, event'in hala uzerinde
  dagitildigi elementi silmek olurdu. Host bir promise cozuyor, yikim bir
  microtask sonra bos stack'te oluyor. Handler verilmezse buton hic kurulmuyor.
- `main.ts` artik **donguye giriyor**: menu → mac → menu → mac, tek sayfada.
  `RtsApp` her turda yikilip yeniden kuruluyor; `preload` **kurulmuyor**, bu
  yuzden ikinci mac veriyi bellekten aciyor.
- `RtsApp.dispose()` bes boot witness'ini de siliyor (`rtsGround`, `rtsMapArt`,
  `rtsAuthoredWorld`, `rtsContentAssets`, `rtsContentPlaceholders`). Canvas
  uygulamayi asiyor; birakilsalardi menu, bir onceki macin boot'unu bu macinki
  gibi ilan eden bir canvas uzerinde otururdu.
- URL: `menuSearch(params)` (`rtsMatchSetupUrl.ts`) - `matchSetupSearch`'in
  tersi. Bes kurulum parametresini dusuruyor; `mode` dustugu icin menude
  yapilan yenileme oyuncuyu yeni terk ettigi maca geri atmiyor, `seed` dustugu
  icin sonraki mac gercekten yeni bir mac. `?level=` **bilerek kaliyor**
  (KARAR 4): editorden gelen yazar hala o haritayi deniyor.
- Iki engine check'i: `matchSetupSearch` → `menuSearch` gidis-donusu ve
  `?level=`'in kalmasi.
- Renderer: `dispose()` WebGL context'ini oldurmuyor (`forceContextLoss` yok),
  yeni `RtsApp` ayni canvas uzerinde yeni bir `WebGLRenderer` kuruyor - ilk
  boot'un zaten yaptigi sey (`engine/render-three/renderer.ts` destek yoklamasi
  context'i aciyor, `WebGLRenderer` ayni context'i devraliyor).

## 8. Dokunulacak dosyalar

| Dosya | Is | Faz |
| --- | --- | --- |
| `src/game/rts/ui/rtsLoadingScreen.ts` | **yeni** - perde (DOM) | F1 ✅ |
| `src/game/rts/loading/rtsLoadProgress.ts` | **yeni** - sayac (DOM'suz) | F1 ✅ |
| `src/game/rts/RtsApp.ts` | perde baglantisi, `onProgress` yayilimi, ilk-kare sayaci | F1 ✅ |
| `src/game/rts/content/rtsActorVisualFactory.ts` | opsiyonel `onProgress` | F1 ✅ |
| `src/scene/authoredWorld.ts` | opsiyonel `onProgress` (engine, geriye uyumlu) | F1 ✅ |
| `src/game/rts/world/rtsAuthoredWorld.ts` | `onProgress` gecisi | F1 ✅ |
| `src/style.css` | perde stilleri | F1 ✅ |
| `tools/engine-tests.ts` | alti sayac check'i | F1 ✅ |
| `tests/smoke/rtsBoot.ts` | **yeni** - `waitForRtsBoot` / `startRtsMatch` | F1 ✅ |
| `tests/smoke/rts-*.spec.ts` (7 dosya) | 15 tiklama yardimciya baglandi | F1 ✅ |
| `src/game/rts/ui/rtsMainMenu.ts` | **yeni** - menu (DOM) | F2 ✅ |
| `src/game/rts/match/rtsMatchSetup.ts` | **yeni** - kurulum satirlari (DOM) | F2 ✅ |
| `src/game/rts/match/rtsMatchSetupUrl.ts` | **yeni** - URL <-> kurulum, menu atlama | F2 ✅ |
| `src/main.ts` | boot yeniden sirali; dort reload silindi; perde ilk await'ten once | F2 ✅ |
| `src/game/rts/match/rtsMatchOverlay.ts` | kurulum karti + `showStart` cikarildi | F2 ✅ |
| `src/game/rts/RtsApp.ts` | dort handler silindi; mac perde kalkinca basliyor | F2 ✅ |
| `src/style.css` | menu stilleri | F2 ✅ |
| `tests/smoke/rtsBoot.ts` | bekleme tiklamanin **oteki** tarafina gecti | F2 ✅ |
| `src/main.ts` | ayardan bagimsiz yukleri menu acikken baslat (`preloadRtsMatchData`) | F3 ✅ |
| `src/game/rts/match/rtsMatchOverlay.ts` | duraklatma + sonuc kartina "Ana Menü" | F5 ✅ |
| `src/game/rts/RtsApp.ts` | `onExitToMenu` host handler'i; `dispose()` witness'lari siliyor | F5 ✅ |
| `src/game/rts/match/rtsMatchSetupUrl.ts` | `menuSearch()` - kurulum parametrelerini dusur | F5 ✅ |
| `src/main.ts` | rota donguye girdi: menu → mac → menu | F5 ✅ |
| `tools/engine-tests.ts` | iki URL gidis-donus check'i | F5 ✅ |
| `tests/smoke/rts-*.spec.ts` | tiklama oncesi canvas iddialarinin sirasi (§9) | F4 |

## 9. Smoke etkisi

Sekiz RTS spec'i ayni kapidan geciyor:
`rts-assetization-baseline`, `rts-building-placement`, `rts-fog-of-war`,
`rts-graphics-quality`, `rts-mission-panel`, `rts-play-level`,
`rts-regional-victory`, `rts-road-placement-feedback`.

Ortak kalip (`rts-building-placement.spec.ts:8-13`):

```ts
await page.goto(route);
await expect(page.locator(".rts-match-overlay")).toHaveClass(/is-visible/);
await page.getByRole("button", { name: "Maçı Başlat", exact: true }).click();
await expect(page.locator(".rts-match-overlay")).not.toHaveClass(/is-visible/);
```

Karar: **`.rts-match-overlay` sinif adi ve `"Maçı Başlat"` etiketi korunur**, ki
degisiklik minimum olsun.

**F1'de yapildi.** Perde tam ekran ve tiklamayi yutuyor. Playwright bunu zaten
yeniden deneyerek asardi - yani spec'ler muhtemelen yine gecerdi - ama gectikleri
gun degil *gecmedikleri* gun onemli: hata "element intercepts pointer events"
diye butonu isaret ederdi, gercekte yavas olan yuklemeyken. Bu yuzden 15 cagri
noktasi ortak bir yardimciya baglandi:

- **yeni** `tests/smoke/rtsBoot.ts` - `waitForRtsBoot(page)` (once
  `data-rts-ground` ile RtsApp'in var oldugunu dogrular, ki perde kontrolu
  bosuna gecmesin; sonra perdenin `done` olmasini/DOM'dan cikmasini bekler) ve
  `startRtsMatch(page)`.
- 7 spec dosyasindaki 15 `"Maçı Başlat"` tiklamasi `startRtsMatch(page)` oldu.

**F2'de kapi tasindi.** F1'de `"Maçı Başlat"` tam kurulmus bir `RtsApp` icindeki
kartin butonuydu; F2'de ayni buton `RtsApp`'i **kuran** sey. Yani beklenecek boot
tiklamanin oncesinde degil sonrasinda. `rtsBoot.ts` buna gore ucе bolundu -
`waitForRtsMenu` / `waitForRtsBoot` / `startRtsMatch` - ve perde kontrolu
`querySelectorAll` ile *butun* perdelerin `done` olmasini ariyor (devir aninda
menunun ve macin perdeleri kisa bir an birlikte DOM'da).
`rts-graphics-quality.spec.ts` yardimciyi atlayip butona dogrudan tikliyordu;
o cagri da `startRtsMatch(page)` oldu.

**F4'e kalan borc — spec sirasi.** Bazi spec'ler tiklamadan *once* canvas
iddiasi yapiyor (`rts-assetization-baseline.spec.ts:19` `data-rts-content-assets`
= `ready`, `:23` `data-rts-content-placeholders`, `:55-56` ayni ikisi). Menu
oncesinde `RtsApp` yok, dolayisiyla o oznitelikler de yok: bu iddialar
`startRtsMatch(page)`'in **altina** tasinmali. Mekanik bir degisiklik, ama
suite kosulmadan yapilmadi - F4 kosarken tek seferde.

## 10. Gorsel varliklar

Ikisi de `public/assets/ui/` altina (yaninda `arma.png`, `frame.png`,
`panel.png` duruyor):

| Dosya | Guvenli alan |
| --- | --- |
| `menu-background.jpg` | **Orta** ~%40 genislik / ~%70 yukseklik kartin altinda kalir; ilgi kenar ucte birlerde ve ustte olmali |
| `loading-background.jpg` | **Alt %20** cubuk ve metin icin gorece sakin/koyu olmali |

1920x1080, `object-fit: cover`. Gorseller gelene kadar ikisi de duz renk
placeholder ile calisir; dosya birakildiginda baska hicbir sey degismez.

**Ikisi de yerinde (2026-08-08):** `loading-background.jpg` (370 KB) ve
`menu-background.jpg` (611 KB). Yani placeholder gradient'leri artik yalnizca
sigorta - dosya silinirse ekran bos kalmaz, koyu bir zemine duser.

Uretim prompt'lari: `THREEAGES_RTS_MENU_ART_PROMPTS.md`.

## 11. Kabul kriterleri

1. `/?rts` acildiginda bos siyah canvas **hic gorunmez**; ilk gorunen sey
   yukleme perdesidir.
2. Menu ayarlarindan hicbiri sayfayi yeniden yuklemez.
3. Ilerleme cubugu gercek sayima dayanir; zamana bagli sahte ilerleme yoktur.
4. Perde, ilk **cizilmis** kareden sonra kalkar - acilinca duz zemin veya
   kapsul gorunmez (T2).
5. Actor pack veya authored world yuklenemezse perde yine kalkar ve oyun
   fallback gorunumuyle oynanabilir kalir (T3).
6. `?level=` ile gelen editor Play istegi menuyu atlar (KARAR 4).
7. Sekiz RTS smoke spec'i yesil.
8. **Gorsel kabul kullanicidadir**: perdenin, menunun ve gecisin nasil
   gorundugu ekrana bakilarak onaylanir (CLAUDE.md "Visual acceptance").

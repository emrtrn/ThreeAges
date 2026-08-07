# ThreeAges RTS - Ana Menu ve Yukleme Ekrani Plani

Olusturulma tarihi: 2026-08-08
Durum: **Plan yazildi, kod yazilmadi. F1-F4 planli, baslanmadi.**

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

```
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
Cozum: son dilim buna ayrilir - `renderer.compile()` + iki `requestAnimationFrame`
beklenir, perde **gercekten cizilmis ilk kareden sonra** kalkar.

**T3 - Hata yollari perdeyi kapatmali.** `dataset.rtsAuthoredWorld = "fallback"`
ve actor pack'in `catch`'i (`RtsApp.ts:4821`) de "bitti" sayilir. Ustune sert
bir timeout (~20 sn): tek bir olu fetch oyuncuyu perdede kilitlemez.

**T4 - Smoke suiti.** §9.

## 7. Fazlar

### 7.1 F1 - Yukleme ekrani + ilerleme cekirdegi

- `src/game/rts/ui/rtsLoadingScreen.ts`: tam ekran katman, arka plan gorseli,
  ilerleme cubugu, `data-rts-loading` witness'i (`loading` / `done`).
  `#ui-overlay` altina baglanir (mevcut kartlarin yaptigi gibi,
  `rtsMatchOverlay.ts:303`).
- Kucuk bir toplayici: agirlikli izler, `report(track, done, total)`.
- Opsiyonel `onProgress` gecisleri:
  - `RtsActorVisualFactory.load(onProgress?)`
  - `AuthoredWorldOptions.onProgress?` (`src/scene/authoredWorld.ts` - engine
    tarafi, ama **opsiyonel** oldugu icin editor etkilenmez)
  - `loadRtsAuthoredWorld(...)` bunu gecirir (`rtsAuthoredWorld.ts:58-72`)
- T2 ve T3 burada uygulanir.
- CSS `src/style.css` icine, mevcut `.rts-match-overlay` bloklarinin
  (satir 223+) yanina.

F1 tek basina bugunku boot'un uzerinde calisir; menu olmadan da bir kazanctir.

### 7.2 F2 - Ana menu

- Kurulum kartini `RtsMatchOverlay`'den ayir: `buildSetup()`
  (`rtsMatchOverlay.ts:319`) ve baslangic kartinin govdesi bagimsiz olarak
  kullanilabilir hale gelir. Duraklama/sonuc kartlari yerinde kalir (§2.4).
- `src/game/rts/ui/rtsMainMenu.ts`: arka plan gorseli + ortada o kart.
- Dort `location.reload()` silinir (§2.3); secimler menunun state'i olur ve
  `new RtsApp(...)` cagrisina parametre olarak akar. `sessionStorage` yazimi
  korunur (yenileme sonrasi hatirlanmasi icin), ama artik **reload tetiklemez**.
- KARAR 2/3'un gecisi: menu teardown -> `history.pushState` -> yukleme perdesi
  -> `new RtsApp(...)` -> `rts.start()`.
- KARAR 4'un atlatma yolu.

### 7.3 F3 - Menude on-yukleme

Menu ekranda dururken, **ayardan bagimsiz** olan her sey arka planda cekilir:
8 balance JSON + caravan + tradeSite (§2.1 adim 3-4 buraya `Promise.all`
icinde girer) + `loadRtsContentCatalog`. Ayara bagli olanlar (level JSON,
mission script) tiklama aninda baslar.

Bu, ikinci perdenin neden kisa olacaginin tek sebebidir; KARAR 2 de buradan
cikar.

### 7.4 F4 - Dogrulama

`npx tsc --noEmit`, `npm run test:engine`, smoke spec guncellemesi (§9), ve
kapanista `npm run build:verify`.

## 8. Dokunulacak dosyalar

| Dosya | Is |
| --- | --- |
| `src/game/rts/ui/rtsLoadingScreen.ts` | **yeni** |
| `src/game/rts/ui/rtsMainMenu.ts` | **yeni** |
| `src/main.ts` | boot yeniden sirali; dort reload silinir |
| `src/game/rts/match/rtsMatchOverlay.ts` | kurulum karti ayrilir |
| `src/game/rts/RtsApp.ts` | perde baglantisi, `onProgress` yayilimi |
| `src/game/rts/content/rtsActorVisualFactory.ts` | opsiyonel `onProgress` |
| `src/scene/authoredWorld.ts` | opsiyonel `onProgress` (engine, geriye uyumlu) |
| `src/game/rts/world/rtsAuthoredWorld.ts` | `onProgress` gecisi |
| `src/style.css` | perde + menu stilleri |
| `tests/smoke/rts-*.spec.ts` | §9 |

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
degisiklik minimum olsun. Eklenecek tek sey, tiklamadan sonra
`data-rts-loading="done"` beklemektir - artik tiklama maci degil yuklemeyi
baslatiyor.

## 10. Gorsel varliklar

Ikisi de `public/assets/ui/` altina (yaninda `arma.png`, `frame.png`,
`panel.png` duruyor):

| Dosya | Guvenli alan |
| --- | --- |
| `menu-background.jpg` | **Orta** ~%40 genislik / ~%70 yukseklik kartin altinda kalir; ilgi kenar ucte birlerde ve ustte olmali |
| `loading-background.jpg` | **Alt %20** cubuk ve metin icin gorece sakin/koyu olmali |

1920x1080, `object-fit: cover`. Gorseller gelene kadar ikisi de duz renk
placeholder ile calisir; dosya birakildiginda baska hicbir sey degismez.

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

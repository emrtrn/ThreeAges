# ThreeAges RTS Liman ve Balikcilik (Yiyecek) Uygulama Plani

Olusturulma tarihi: 2026-07-25
Durum: Planlandi - uygulama baslamadi
Kapsam: Elde bulunan alti `Port_*` modelini, nehir kiyisina kurulan ve isciyle
yiyecek ureten oynanabilir bir RTS binasina cevirmek.

## 1. Hedef

Oyuncu, nehir kiyisina **Liman** kurup yiyecek uretebilir. Liman tarlanin
alternatifi degil, rakibidir:

> **Tarla guvenli ama yavas; Liman hizli ama konumu zorunlu olarak sinirda.**

Bu direk teknik olarak bedava geliyor: dogrulanan olcumlere gore nehir haritanin
tam ortasinda, iki usse de ~60 birim uzakta (bkz. §3.3). Merkez kontrol yaricapi
28 oldugu icin kiyi hicbir oyuncunun baslangic kontrol alaninda degildir.
Balikcilik boylece kendiliginden bir **karakol ile genisleme** oyununa baglanir.

V1'in oynanis hedefi **kiyiya kurulan, isciyle calisan, sinirsiz yiyecek ureten
bina**dir. Balik surusu tukenmesi, balikci teknesi birimi, nehir uzerinden
ticaret ve koprulu gecis bu planin disindadir (bkz. §4.6).

## 2. Basari Tanimi

Asagidaki akisin calismasi hedeflenir:

1. Nehri olan bir Level'da (`gameplay_proof`) oyuncu build paletinden Liman'i secer.
2. Ghost, kiyidan uzakta kirmizi ve "Yakinda su yok" gerekcesiyle reddedilir;
   kiyi seridinde yesile doner.
3. Liman kurulur, isci atanir, yiyecek uretip depoya tasinir.
4. Liman modeli dogru cagin/seviyenin varyantidir, iskelesi suya bakar ve su
   alti kismi su yuzeyinin altinda kalir.
5. Nehri olmayan Level'da (`core_match`) Liman sessizce kurulamaz; hicbir sistem
   hata vermez, kasabaya gecis kilitlenmez.
6. AI, yiyecek uretimini "tarla sayisi" ile degil "yiyecek ureten yapi" ile
   olcer; limanla beslenen bir ekonomiyi acliktaymis gibi gormez.

## 3. Mevcut Durum - Dogrulanan Baslangic Noktasi

### 3.1 Eldeki varliklar

`public/assets/ThreeAges/StaticMeshes/`:

| Model | X | Y | Z |
| --- | --- | --- | --- |
| `Port_FirstAge_Level1` | -0.14 -> 1.17 | **-0.42** -> 0.55 | -1.05 -> -0.33 |
| `Port_FirstAge_Level2` | -0.67 -> 1.17 | -0.42 -> 0.55 | -1.05 -> 0.93 |
| `Port_FirstAge_Level3` | -0.67 -> 1.17 | -0.42 -> 0.57 | -1.05 -> 0.93 |
| `Port_SecondAge_Level1` | -0.58 -> 1.17 | -0.42 -> 1.01 | -1.05 -> 1.83 |
| `Port_SecondAge_Level2` | (ayni aile) | | |
| `Port_SecondAge_Level3` | -1.49 -> 1.17 | -0.42 -> 1.21 | -1.05 -> 1.83 |

Iki sonuc: modeller **asimetrik** (iskele bir yone uzuyor, suya bakmasi gerekir)
ve **Y'de negatife iniyor** (-0.42 = su altinda kalmasi gereken kisim).

Ek olarak `Dock_FirstAge.gltf` (kucuk iskele propu) mevcut; balik noktasi
dekoru olarak kullanilabilir. Liman icin **ikon yok** —
`public/assets/ui/icons/building-port.svg` uretilmelidir.

Isim kalibi `rtsBuildingArt.ts` icindeki `aged` sablonuna birebir uyar:
`Port_${family}_Level${level}`.

### 3.2 Nehrin mevcut durumu

| Alan | Mevcut durum | Bu plandaki sonuc |
| --- | --- | --- |
| Nehir gorseli | `RTS_GameplayProof.level.json` -> `riverWaters[0]`, `surfaceLevel: -1`, `splineRef: spline-1` | Ayni actor su verisinin tek otoritesi olur |
| Nehir guzergahi | `landscapes/landscape-1.landscape.json` -> `spline-1`, 6 nokta, y = -2, `deform.lowerTerrain + flatten` | Kiyi testinin merkez hatti bu polyline'dir |
| Gecilmezlik | Nehir boyunca elle dizilmis 33 adet `BP_RTS_NavigationBlocker` (10x10x5) | Degismez; liman footprinti bu blocker'larla cakisamaz |
| Simulasyonun su bilgisi | **Yok.** `rtsLevelAdapter` yalniz `actors` + `splines` okur; `layout.riverWaters` ve landscape spline'lari adapter'a hic girmez | `RtsLevelDefinition.water` alani dogar |
| Varsayilan preset | `main.ts` -> `core_match`; o Level'da `landscapes: 0`, `riverWaters: 0` | Balikcilik nehri olan Level'larda acilir, digerlerinde sessiz kalir |

Nehir polyline'i (landscape lokal, XZ):
`(-67.7,-67.1) -> (-46.3,-31.4) -> (-13.6,-18.5) -> (12.5,20.4) -> (48.3,38.4) -> (66.8,66.5)`
Toplam uzunluk ~197 birim. Landscape 129x129 vertex x 1.094 spacing = ~140 birim,
`RTS_WORLD_HALF_EXTENT = 70` ile ortusur.

### 3.3 Konum analizi

- Oyuncu basi `(-46.6, 37.8)` -> nehre en kisa mesafe **~61 birim**.
- Dusman basi `(38, -38)` -> nehre en kisa mesafe **~64 birim**.
- Merkez kontrol yaricapi 28 (`ages.json`), karakol izole yaricapi 16-36.

Yani kiyi her iki oyuncu icin de genisleme mesafesindedir ve nehir cekismeli
orta bolgedir. Bu, §1'deki tasarim direginin veri karsiligidir.

### 3.4 Kritik teknik bulgu - hangi uretim kolu

`economyProductionSystem` iki uretim kolu tasir:

- **Orman kolu** (`requiresForest`): isci **agacin kendi noktasina** yol planlar
  (`findReachableTree` -> `navigation.plan(worker.position, treePoint)`), kesip
  kampa geri tasir.
- **Tarla/ocak kolu**: isci yapinin kenarindaki approach noktasinda calisir,
  tasima turu yoktur.

Balik noktasi suyun icinde olacagi icin nav blocker'a duser, `plan` null doner,
her balik noktasi reddedilir ve liman **hic uretmez**. Bu yuzden V1 kesin olarak
**tarla/ocak kolunu** kullanir: isci su ile hic temas etmez, sorun dogmadan
biter. Kiyiya yurume + balik tasima varyanti V2'ye birakilir.

## 4. Tasarim Kararlari

### 4.1 Su verisinin kaynagi - KARAR BEKLIYOR (oneri: B)

- **A) Yeni isaretci:** `BP_RTS_FishingGround.actor.json` markerlari elle nehre
  dizilir (aynen `BP_RTS_Tree` gibi). Basit ama 197 birimlik nehir icin onlarca
  marker elle yerlestirmek demek.
- **B) Nehir spline'indan turet (onerilen):** adapter `layout.riverWaters` +
  landscape spline'ini okur, polyline'i ornekler, `distanceToShore(x, z)` verir.
  Marker yazmaya gerek yok; nehri olan her Level'da kendiliginden calisir,
  nehri olmayanda sessizce kapali kalir.

Karar B ise §5 ve Faz 1 oldugu gibi uygulanir; A ise Faz 1 yerine yeni marker
+ adapter dali yazilir ve `RtsWaterSystem` marker listesinden beslenir.

### 4.2 Yonelim - KARAR BEKLIYOR (mekanigin tek gercek gorsel engeli)

`PlacedStructure` bir rotasyon alani tasimaz; tum binalar sabit yonde durur.
Liman modeli asimetriktir; iskelesi suya bakmazsa goruntu bozulur. Secenekler:

- **B1 (onerilen):** `PlacedStructure`a opsiyonel `yaw` alani; liman kurulurken
  en yakin su merkez-hatti noktasina dogru otomatik hesaplanir. Oyuncuya
  ek girdi yuku yoktur, yalniz limanda etkin olur.
- **B2:** genel 4 yonlu elle dondurme (placement sirasinda tus). Daha buyuk is,
  tum binalari etkiler, ayri bir dilim olmasi daha dogru.

### 4.3 Dikey hizalama - KARAR BEKLIYOR (oneri: waterline anchor)

`rtsBuildingVisuals.ts` icindeki `fitModelToFootprint` modeli
`FOUNDATION_TOP = 0.18`e kaldirir. Limanin -0.42'lik su alti kismi boylece
havada kalir; ustune, yapilar arazi yuksekligi ornekemez ve su yuzeyi -1'dedir.
Oneri: sanat cozumlemesine opsiyonel `artAnchor: "foundation" | "waterline"`
eklenir; `waterline` olan yapilar `riverWater.surfaceLevel`e gore oturur ve
negatif Y'ye inmesine izin verilir.

### 4.4 Hangi harita - KARAR BEKLIYOR

Nehir yalniz `RTS_GameplayProof`ta var, varsayilan preset ise `core_match`.
Secenekler:

- **D1 (onerilen, kucuk):** V1 nehirli Level'larla sinirli kalir
  (`?preset=gameplay_proof`). `core_match` degismez.
- **D2 (buyuk):** nehir + landscape `RTS_CoreMatch`e tasinir. Ayri bir seviye
  authoring isi; `THREEAGES_RTS_LANDSCAPE_LEVEL_PLAN.md` §1.1'deki "Iki Nehir
  Arasi" konseptiyle birlikte ele alinmalidir.

### 4.5 Yas kapisi ve kasaba sarti

Iki cagin da modeli oldugu icin `requiredAge` **konulmaz**; Liman Yerlesim
cagindan itibaren kurulabilir. `ages.json -> town.requiredBuildingIds`
listesine **eklenmez**: aksi halde nehri olmayan haritalarda kasabaya gecis
kilitlenir.

### 4.6 Kapsam disi (V2 adaylari)

- Balik surusu tukenmesi/yenilenmesi (sonlu kaynak, orman modeli).
- Iscinin kiyiya yuruyup balik tasimasi (§3.4'teki pathing isi).
- Balikci teknesi birimi, nehir ustunde birim hareketi.
- Nehir uzerinden ticaret, koprulu gecis, su ustu savas.

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/world/rtsWaterSystem.ts` | **Yeni.** Polyline ornekleme + `distanceTo(x, z)` + `hasWater` |
| `src/game/rts/world/rtsLevelAdapter.ts` | `riverWaters` + landscape spline'i imzaya ekle, `RtsLevelDefinition.water` uret |
| `src/game/rts/world/rtsLevelLoader.ts` | Landscape sidecar spline'ini adapter'a tasi |
| `src/game/data/gameDataTypes.ts` | `EconomyProductionBalance`: `requiresWater?`, `waterRange?` |
| `src/game/data/validateGameData.ts` | `requiresForest` blokunun ikizi dogrulama |
| `src/game/editorCatalog.ts` | Details panelinde iki yeni alan |
| `src/game/rts/structures/placementGrid.ts` | `PlacementFailure` -> `"missing-water"` |
| `src/game/rts/structures/structureConstructionService.ts` | `StructureBuildFailure` -> `"missing-water"` |
| `src/game/rts/RtsApp.ts` | `additionalPlacementFailure` zincirine ucuncu dal |
| `src/game/rts/economy/economyProductionSystem.ts` | `requiresWater` uretimini tarla kolunda kilitle (su kaybolursa durdur) |
| `src/game/rts/structures/rtsBuildingArt.ts` | `port` icin `aged` eslemesi: basename `Port_<family>_Level<level>` |
| `src/game/rts/structures/rtsBuildingVisuals.ts` | `artAnchor` / waterline hizalama (§4.3) |
| `src/game/rts/structures/placedStructureSystem.ts` | `yaw` alani (§4.2, karar B1 ise) |
| `src/game/rts/ui/rtsBuildPalette.ts` | "Ekonomi" kategorisine `port`; `missing-water` gerekcesi |
| `src/game/rts/ui/rtsSelectionView.ts` | `"missing-water": "Yakinda su yok"` |
| `src/game/rts/ai/aiEconomyManager.ts` | `buildingCounts["farm"] === 0` yerine "yiyecek ureten yapi" olcusu |
| `tools/engine-tests.ts` | Su mesafesi, placement reddi, art path ve validator testleri |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/game-data/balance/buildings.json` | `port` girdisi (§6) |
| `public/assets/ui/icons/building-port.svg` | **Yeni.** Palet ikonu |
| `public/game-data/balance/ai.json` | `buildingTargets` (AI'nin liman kurmasi istenirse) |
| `public/assets/ThreeAges/Levels/RTS_GameplayProof.level.json` | Kiyiya uzanan genisleme hatti / kabul senaryosu |

### 5.3 Allowlist notu

Bu plan `LayoutPlacement` / singleton environment actor alanlarina **yeni alan
eklemiyor**; `tools/saveValidator.ts` allowlist'ine dokunmaya gerek yoktur.
§4.1'de A secilirse yeni actor bir marker asset'i olur (`BP_RTS_Tree` gibi) ve
generic actor yolundan gecer — yine allowlist isi cikmaz. §4.2'de `yaw` yalniz
runtime `PlacedStructure` alanidir, Level'a serialize edilmez; edilecekse
allowlist kurali devreye girer ve o zaman CLAUDE.md kuralina uyulur.

## 6. Balans Verisi (oneri)

Referans: Tarla 3 isci x 10/dk, tampon 40, maliyet 50 odun.

| | Yerlesim L1 | L2 | L3 | Kasaba L1 | L2 | L3 |
| --- | --- | --- | --- | --- | --- | --- |
| isci kapasitesi | 3 | 4 | 4 | 5 | 5 | 6 |
| yiyecek/isci/dk | 14 | 16 | 18 | 22 | 25 | 28 |
| yerel tampon | 60 | 80 | 100 | 140 | 170 | 200 |
| maxHealth | 120 | 130 | 140 | 160 | 175 | 190 |

Sabitler: `cost: { wood: 90 }`, `constructionSeconds: 40`,
`footprint: 6x6`, `visionRadius: 10`, `waterRange: 6`,
`economy.resourceId: "food"`, `economy.requiresWater: true`.

Denge mantigi: isci basina tarlanin ~%40 ustunde, ama dayanikliligi dusuk,
konumu zorunlu olarak sinirda ve yasal zemin yalniz kiyi seridi.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi ve envanter

Amac: §4'teki dort acik karari yazili hale getirmek; yeniden yapmayi onlemek.

- [ ] §4.1 su kaynagi karari (A: marker / B: spline) kilitlenir.
- [ ] §4.2 yonelim karari (B1: otomatik yaw / B2: elle 4 yon) kilitlenir.
- [ ] §4.3 dikey hizalama karari (waterline anchor) kilitlenir.
- [ ] §4.4 hedef harita karari (D1: yalniz gameplay_proof / D2: core_match'e tasi)
  kilitlenir.
- [ ] Mevcut `?preset=gameplay_proof` nehir gorunumu icin ekran goruntusu
  referansi alinir (Faz 5 karsilastirmasi icin).
- [ ] Bu dosyadaki "KARAR BEKLIYOR" etiketleri secilen secenekle degistirilir.

Kabul:

- Dort kararin hicbiri kod yazilirken tartisilmaz.
- Kapsam disi listesi (§4.6) V1'e sizmaz.

### Faz 1 - Su verisini simulasyona tasima

Amac: Simulasyonun "su nerede" sorusuna cevap verebilmesi. Bu fazda **hicbir
oynanis degisikligi yok**; yalniz veri akar.

- [ ] `rtsWaterSystem.ts`: nehir polyline'ini ornekleyip `distanceTo(x, z)`,
  `hasWater` ve `nearestPoint(x, z)` veren saf (renderer'siz) sinif.
- [ ] `rtsLevelAdapter`: `layout.riverWaters` + landscape spline'i imzaya eklenir;
  `RtsLevelDefinition.water` uretilir. Nehir yoksa `null`.
- [ ] `rtsLevelLoader`: landscape sidecar spline verisini adapter'a tasir.
- [ ] Landscape lokal pozisyonundan dunya uzayina donusum (landscape
  `position`) dogrulanir; `spline-1` y = -2, su yuzeyi -1 farki kayda gecer.
- [ ] Engine testi: `spline-1` verisiyle bilinen noktalarin mesafeleri
  (oyuncu basi ~61, dusman basi ~64) dogrulanir.
- [ ] Engine testi: `RTS_CoreMatch` icin `water === null` ve hicbir uyari/hata
  uretilmedigi dogrulanir.

Kabul:

- [ ] Nehirli Level'da `water` doludur, nehirsizde `null`dur.
- [ ] Hicbir mevcut mac davranisi degismemistir (`npm run test:engine` yesil).

### Faz 2 - Veri semasi ve dogrulama

Amac: `port` verisinin sema tarafindan taninmasi.

- [ ] `EconomyProductionBalance`: `requiresWater?: boolean`, `waterRange?: number`
  (yorumlariyla, mevcut `requiresForest` alanlarinin uslubunda).
- [ ] `validateGameData`: `requiresWater` boolean dogrulamasi; `true` ise
  `waterRange > 0` zorunlulugu.
- [ ] `editorCatalog`: `economy.requiresWater` ve `economy.waterRange` alanlari.
- [ ] Engine testi: `requiresWater: true` + eksik/negatif `waterRange`
  `GameDataError` verir.

Kabul:

- [ ] `npx tsc --noEmit` ve `npm run test:engine` yesildir.
- [ ] Mevcut hicbir bina verisi yeni alanlar yuzunden reddedilmez.

### Faz 3 - Yerlestirme kurali

Amac: Limanin yalniz kiyiya kurulabilmesi ve reddin oyuncuya okunur olmasi.

- [ ] `PlacementFailure` ve `StructureBuildFailure` -> `"missing-water"`.
- [ ] `RtsApp` `additionalPlacementFailure` zincirine ucuncu dal:
  `requiresWater` ise footprint merkezinin su merkez hattina uzakligi
  `waterRange` icinde olmali.
- [ ] Footprintin su nav blocker'lari ile cakismadigi mevcut `blocked` kurali
  ile zaten saglanir; test ile kilitlenir (liman suya insa edilemez).
- [ ] `rtsSelectionView` -> `"missing-water": "Yakinda su yok"`.
- [ ] `rtsBuildPalette` -> ayni gerekce metni ghost geri bildiriminde.
- [ ] Engine testi: kiyidan uzak nokta `missing-water`, kiyi seridi `valid`,
  su ustu `blocked`.
- [ ] Engine testi: nehirsiz Level'da her liman onerisi `missing-water` verir
  (crash veya sessiz gecis yok).

Kabul:

- [ ] Ghost kiyi seridinde yesil, disinda kirmizi + dogru gerekce.
- [ ] Su ustune liman kurulamaz.

### Faz 4 - Bina verisi ve palet

Amac: Limanin oyuncu icin var olmasi.

- [ ] `buildings.json` -> `port` girdisi (§6 tablosu; Yerlesim ve Kasaba
  progression dizileri dolu).
- [ ] `building-port.svg` ikonu uretilir.
- [ ] `rtsBuildPalette` "Ekonomi" kategorisine `port` eklenir.
- [ ] `ages.json -> town.requiredBuildingIds` **degistirilmez** (§4.5) —
  test ile kilitlenir.
- [ ] Engine testi: `port` balance verisi dogrulamadan gecer; `economy.resourceId`
  `"food"`dur.

Kabul:

- [ ] Liman paletten secilebilir; ikon ve etiket ("Liman") gorunur.
- [ ] Kasabaya gecis sarti degismemistir.

### Faz 5 - Gorsel: model, yonelim, su hizalama

Amac: Limanin kiyida inandirici gorunmesi.

- [ ] `rtsBuildingArt` -> `port` `aged` eslemesi; `allBuildingMeshPaths()` alti
  yolu da preload eder.
- [ ] Engine testi: `buildingMeshPath("port", "settlement", 1..3)` ve
  `("port", "town", 1..3)` beklenen alti dosyayi verir; seviye 0 ve 9 clamp'lenir.
- [ ] §4.3 karari: `artAnchor` ile liman `riverWater.surfaceLevel`e oturur;
  su alti kismi (-0.42) su yuzeyinin altinda kalir.
- [ ] §4.2 karari: liman en yakin su noktasina bakacak sekilde donuk kurulur.
- [ ] Ghost onizlemesi ile kurulmus yapinin yonelim ve yuksekligi ayni olur
  (onizleme yalan soylemez).
- [ ] Insaat placeholder'i -> tamamlanma animasyonu (`COMPLETION_DROP_HEIGHT`)
  su seviyesinde bozulmadigi kontrol edilir.
- [ ] Gorsel kabul: alti varyantin her biri kiyida ekran goruntusuyle kayda
  gecer (Faz 0 referansiyle karsilastirilir).

Kabul:

- [ ] Iskele suya bakar, govde su yuzeyinde oturur, model havada/gomulu degildir.
- [ ] Cag ve seviye degisiminde dogru varyant yuklenir.

### Faz 6 - Uretim ve denge dogrulamasi

Amac: Limanin gercekten yiyecek uretmesi ve tarlaya karsi konumunun olcumu.

- [ ] `economyProductionSystem`: `requiresWater` uretimi tarla kolunda calisir;
  isci yapinin approach noktasinda uretir, su ile temas etmez.
- [ ] Isci atama, yerel tampon dolumu ve depoya transfer akisi limanda calisir.
- [ ] Seviye atlama (`progression`) isci kapasitesi ve `perWorkerPerMinute`
  degerlerini uygular.
- [ ] Liman yikilinca isciler serbest kalir, kaynak sizmasi olmaz.
- [ ] Engine testi: sabit sureli uretim beklenen yiyecek miktarini verir.
- [ ] Manuel denge kaydi: ayni isci sayisiyla tarla vs liman dakika basi yiyecek;
  §6 hedefinden sapma varsa veri guncellenir (kod degil).

Kabul:

- [ ] Liman uretir, tasir, seviye atlar ve yikilir; hicbir isci kilitlenmez.
- [ ] Liman/tarla orani §6'daki tasarim niyetiyle uyumludur.

### Faz 7 - AI uyumu

Amac: AI'nin limani gormesi ve yanlis teshis koymamasi.

- [ ] `aiEconomyManager`: `buildingCounts["farm"] === 0` -> "yiyecek ureten
  herhangi bir yapi yok" olcusu (veri surulu, sabit id degil).
- [ ] Engine testi: yalniz limanla beslenen AI `no-food-production` teshisi
  almaz.
- [ ] Karar: AI liman kuracak mi? Kuracaksa `ai.json -> buildingTargets` girdisi
  **ve** kiyi aday noktasi skorlamasi (`intentScorer` / anchor uretimi) gerekir.
  Kurmayacaksa bu bilincli olarak kayda gecirilir.
- [ ] AI hicbir kosulda kurulamayacak yere liman onerip build dongusunu
  bosa dondurmez (nehirsiz haritada liman hedefi olmamali).

Kabul:

- [ ] Limanla beslenen ekonomi AI tarafindan saglikli gorulur.
- [ ] AI'nin liman davranisi (kuruyor / kurmuyor) yazili ve testlidir.

### Faz 8 - Seviye icerigi ve kabul maci

Amac: Mekanigin gercek bir macta oynanabilir olmasi.

- [ ] `RTS_GameplayProof`ta oyuncu ve dusman icin kiyiya uzanan genisleme hatti
  (karakol zinciri veya kiyi expansion marker'i) yerlestirilir.
- [ ] Kiyi seridinde en az bir 6x6 liman footprintinin gercekten yasal oldugu
  in-editor dogrulanir (nav blocker + kontrol alani birlikte).
- [ ] Tam mac kabulu: karakol -> kiyi -> liman -> yiyecek akisi tamamlanir.
- [ ] `core_match` (nehirsiz) macinda hicbir regresyon olmadigi dogrulanir.
- [ ] `git status` temiz birakilir; editor dev server'in kirlettigi Level
  dosyalari bilincli commit edilir veya geri alinir.

Kabul:

- [ ] Nehirli haritada liman oynanabilir bir yiyecek stratejisidir.
- [ ] Nehirsiz haritada hicbir sey bozulmamistir.

## 8. Test ve Gate

Her fazdan sonra:

```powershell
npx tsc --noEmit
npm.cmd run test:engine
```

Faz 5 ve Faz 8'den sonra ek olarak:

```powershell
npm.cmd run build:verify
npm.cmd run check:assets
```

Gorsel kabul (Faz 5) ve mac kabulu (Faz 8) kontrollu manuel test olarak kayda
gecirilir; otomasyon bunlarin yerine gecmez.

## 9. Riskler ve Onlemler

| Risk | Etki | Onlem |
| --- | --- | --- |
| Balik noktasini suya koyup isciyi oraya yollamak | Liman hic uretmez (pathing null) | V1 tarla/ocak kolunu kullanir (§3.4); tasima V2 |
| Rotasyonsuz asimetrik model | Iskele karaya bakar, goruntu bozulur | Faz 0'da §4.2 karari; Faz 5'te kilitlenir |
| `FOUNDATION_TOP` ile su yuzeyi cakismasi | Model havada veya gomulu durur | `artAnchor: waterline` (§4.3) |
| Kiyinin kontrol alani disinda olmasi | Liman hic kurulamaz sanilir | Bilincli tasarim (§1); Faz 8'de genisleme hatti authoring'i |
| `town.requiredBuildingIds`e liman eklemek | Nehirsiz haritada kasaba kilitlenir | §4.5 kurali; Faz 4'te test ile kilitlenir |
| AI'nin yiyecegi "tarla" ile olcmesi | Limanli ekonomi acliktaymis gibi gorulur | Faz 7 |
| Su verisini iki yerden turetmek (marker + spline) | Cift otorite, sessiz uyusmazlik | §4.1'de tek kaynak secilir |
| Nehri `core_match`e tasima isini bu plana sizdirmak | Kapsam patlar, seviye authoring isi kod dilimine karisir | §4.4 D1 varsayilan; D2 ayri plan |

## 10. Tamamlanma Kapisi

- [ ] Nehir verisi simulasyona akar; nehirsiz Level'da `null` ve sessizdir.
- [ ] `port` verisi sema dogrulamasindan gecer, palette gorunur.
- [ ] Liman yalniz kiyiya kurulur; ret gerekcesi oyuncuya okunur.
- [ ] Alti model varyanti dogru cag/seviyede, dogru yonde ve su seviyesinde oturur.
- [ ] Liman isciyle yiyecek uretir, tasir, seviye atlar, yikilir.
- [ ] AI yiyecek teshisini limanla da dogru kurar.
- [ ] `gameplay_proof`ta karakol -> kiyi -> liman -> yiyecek maci kabul edilir.
- [ ] `core_match` regresyonsuzdur.
- [ ] TypeScript, engine, build ve asset gate'leri yesildir.
- [ ] Gorsel ve mac kabul kayitlari alinmistir.

## 11. Uygulama Sirasi

Once **Faz 0**: §4'teki dort karar. Ozellikle §4.4 (hangi harita) ve §4.2
(rotasyon) kod yazilmadan netlesmelidir; ikisi de sonradan degisirse yapilan isi
geri aldirir.

Sonra **Faz 1** (su verisi) — oynanisa dokunmayan, tek basina test edilebilir,
en dusuk riskli dilim. Faz 2-4 veri/kural katmani, Faz 5 gorsel, Faz 6-7 denge
ve AI, Faz 8 seviye kabulu.

Faz 5'in `aged` model eslemesi tek satirdir ve tek basina test edilebilir;
aceleye gerek duyulursa Faz 1'e paralel yurutulebilir, ama `port` balance verisi
(Faz 4) olmadan ekranda gorunmez.

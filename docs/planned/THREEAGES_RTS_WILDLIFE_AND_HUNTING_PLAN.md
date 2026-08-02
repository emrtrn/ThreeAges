# ThreeAges RTS Yaban Hayati, Avcilik ve Hayvan Varliklari Plani

Olusturulma tarihi: 2026-08-01
Durum: **V1 tamamlandi (Faz 0-7, 2026-08-02).** Kabul maci oynandi ve gecti;
§2'deki dokuz madde oyunda calisiyor. Kararlar §4te kilitli.

**Dosya arsive tasinmiyor (kullanici karari, 2026-08-02).** §10'un son maddesi
askiya alindi: yol haritasinin devami (§12) bu dosyadan yurutulecek. **V2 - Agil
ve evcillestirme basladi (2026-08-02)** ve kendi plan dosyasindan yurutuluyor:
`THREEAGES_RTS_V2_PASTURE_AND_TAMING_PLAN.md` (§12). V3 ve V4 onu izler.
**V5 (suvari / Cag 3) yapilmayacaktir.**
Kapsam: `public/assets/ThreeAges/Animals/` altindaki 12 animasyonlu hayvan
modelini, oyunun ekonomi/savas/lojistik cercevesine oturan gercek RTS
sistemlerine cevirmek. V1 hedefi **avlanma**dir; kalan turler icin yol haritasi
§12'de tanimlanir.

## 1. Hedef

Haritadaki hayvanlar dekor degil, **oynanis tasiyan varliklar** olur. V1'de
oyuncu bir gaye sahiplenir:

> **Tarla sonsuz ama yavas. Liman hizli ama sinirda. Av hizli ve bedava ama BITER.**

Bugun yiyecek yalnizca Tarla'dan gelir ve Tarla sonsuzdur; bu yuzden ekonomide
hicbir **zamanlama baskisi** yoktur. Sonlu av eti, haritadaki suruleri ilk
dakikalarin en degerli varligi yapar, sonra tukenir ve oyuncuyu tarlaya/limana
gecmeye zorlar. Bu, mevcut ekonomiye eksik olan tek ekseni ekler.

Liman plani (`THREEAGES_RTS_PORT_AND_FISHING_PLAN.md`) "guvenli ve yavas" ile
"hizli ve sinirda" eksenini kurmustur. Bu plan ucuncu ekseni ekler ve iki plan
birbiriyle **catismaz**: uc yiyecek kolu ayni AI olcusunu paylasir (§5.1,
`aiEconomyManager`).

## 2. Basari Tanimi

Asagidaki akisin calismasi hedeflenir:

1. Oyuncu haritada otlayan bir geyik surusu gorur; sure `Idle` / `Eating` /
   `Walk` kliplerini oynatarak dolasir.
2. Oyuncu surunun yakinina build paletinden **Avci Kulubesi** kurar. Sururun
   uzaginda ghost kirmizidir ve "Yakinda av yok" gerekcesini verir.
3. Kulube tamamlanir, isci atanir; avci en yakin hayvani rezerve eder, ona
   yurur, hayvan kacar, avci kovalar.
4. Menzile girince avci `attack` rolune gecer; hayvan `Idle_HitReact` oynar,
   sonra `Death` klibiyle duser ve **les** durumuna gecer.
5. Avci les basinda `work` rolune (`Eating` klibi) gecer, `carryCapacity`
   kadar et yukler, kulubeye doner, yerel tampona bosaltir.
6. Et, mevcut yol/depo zinciriyle merkeze tasinir; HUD'da yiyecek artar.
7. Suru tukenince kulube `source-depleted` durumuna gecer ve oyuncuyu yeni bir
   suruye ya da tarlaya yonlendirir.
8. AI, yiyecek uretimini "tarla sayisi" ile degil "yiyecek ureten yapi" ile
   olcer; avcilikla beslenen bir ekonomiyi acliktaymis gibi gormez.
9. Yaban hayvani **nufus saymaz** ve nav grid'i bloklamaz.

## 3. Mevcut Durum - Dogrulanan Baslangic Noktasi

### 3.1 Eldeki varliklar

`public/assets/ThreeAges/Animals/` - 12 model, hepsi tek skinli
(`skins: 1`), **iki ayri rig ailesi**:

| Aile | Modeller | Klip | Ayirt edici klipler |
| --- | --- | --- | --- |
| Toynakli | Alpaca, Bull, Cow, Deer, Donkey, Horse, Horse_White, Stag | 13 | `Attack_Headbutt`, `Attack_Kick`, `Idle_Headlow`, `Jump_toIdle` |
| Yirtici/kopek | Fox, Husky, ShibaInu, Wolf | 12 | tek `Attack`, `Idle_2_HeadLow`, `Jump_ToIdle` |

Iki ailenin ortak klipleri: `Idle`, `Idle_2`, `Walk`, `Gallop`, `Gallop_Jump`,
`Eating`, `Death`, `Idle_HitReact1`, `Idle_HitReact2`.

**Kritik bulgu - klip adi buyuk/kucuk harf farki.** Iki aile yalniz anlamca
degil, **yazimda da** ayrisir: `Jump_toIdle` / `Jump_ToIdle` ve
`Idle_Headlow` / `Idle_2_HeadLow`. Tek bir `animationSet` sablonu iki aileye
birden uygulanamaz; uygulanirsa klip sessizce cozulmez ve hayvan T-pose ya da
donmus idle'da kalir. Iki ayri sidecar sablonu zorunludur (§7 Faz 1).

Boyut: her model ~3 MB (Cow: 3.114.187 bayt); 12 turun tamami ~37 MB. Bu,
V1'in tur secimini dogrudan etkiler (§4.4).

### 3.2 Manifest durumu

12 hayvanin tamami `public/assets/manifest.json` icinde zaten kayitlidir:
`assetType: "skeletalMesh"`, `category: "Animals"`, `placeable: true`,
`placement.surface: "character"`, `runtime.loadGroup: "Animals"`.

**Eksik olan `.skeleton.json` sidecar'lari.** Bugun tum projede tek sidecar
`public/assets/starter-content/SkeletalMeshes/UAL1_Standard_RM.skeleton.json`
dosyasidir. Hayvanlarin `animationSet`'i yoktur, yani
`src/game/rts/units/rtsUnitAnimation.ts` rolleri hicbir kliple eslesmez. Ilk
somut is kalemi budur.

### 3.3 Animasyon rol eslemesi - cerceve zaten uyuyor

`rtsUnitAnimation.ts` semantik rolleri (`idle | walk | run | work | attack |
death`) hayvan kliplerine birebir oturur:

| RTS rolu | Toynakli klip | Yirtici klip |
| --- | --- | --- |
| `idle` | `Idle` / `Idle_2` | `Idle` / `Idle_2` |
| `walk` | `Walk` | `Walk` |
| `run` | `Gallop` | `Gallop` |
| `work` | `Eating` | `Eating` |
| `attack` | `Attack_Headbutt` | `Attack` |
| `death` | `Death` | `Death` |

`Eating` klibinin `work` roluna dusmesi bedava bir kazanctir: otlayan sure,
kodda zaten var olan "bir noktada durup is yapiyor" durumudur ve
`classifyRtsAnimation` bunu hicbir degisiklik olmadan secer.

`rtsLocomotionTuning(moveSpeed)` esikleri birim `moveSpeed`'inden turetir, yani
yavas inek ile hizli geyik ayni kodla dogru klibe duser; sabit bir hiz esigi
yoktur. Animasyon tarafi icin **kod degisikligi beklenmemektedir**; is,
sidecar authoring isidir.

### 3.4 Ekonomi modeli - avciligin baglanacagi desen

Mevcut model uretici bina + atanmis isci uzerinedir
(`src/game/rts/economy/economyProductionSystem.ts`). Isci durum makinesi:

```text
idle -> moving -> moving-to-source -> gathering -> returning -> unloading
```

Iki kaynak tipi vardir:

| Sistem | Rezervasyon | Tukenme davranisi |
| --- | --- | --- |
| `ForestSystem` | **Agac basina bir isci** (`reserveNearest`) | Agac kaybolur, blocker'i kalkar |
| `ResourceNodeSystem` | Yok, paylasimli yatak | Yatak kaybolur, blocker'i kalkar |

Avlanma **`ForestSystem` desenidir**: bir hayvani ayni anda iki avci
avlayamaz, tipki bir agaci iki oduncunun kesememesi gibi. `reserveNearest` /
`harvest` / `releaseReservation` uclusu birebir karsilik bulur.

Toplanan mal binanin `localBuffer`'ina gider, oradan yol + depo zinciriyle
merkeze tasinir (`ProductionLogisticsSystem`). Avciligin bu zinciri
**atlamamasi** tasarimin merkezindedir (§4.1).

### 3.5 Kritik teknik bulgu - sahiplik modeli

```ts
export type UnitOwner = "player" | "enemy";   // src/game/rts/units/unit.ts:38
```

Hayvanlarin ucuncu bir sahibi olmalidir ve bunun **iki yolu vardir; biri
tuzaktir**:

- `UnitOwner`'a `"wild"` eklemek `teamColors`, `kingdomRegistry`,
  `aiBlackboard` (`AI_RESOURCE_IDS` / owner dongusu), `populationSystem`,
  `selection` ve `vision` yollarinin hepsini kirar.
- **En kritik somut hasar:** `PopulationSystem.snapshot()` nufusu
  `units.unitsOf(this.owner).length` ile sayar
  (`src/game/rts/economy/populationSystem.ts:39`). Hayvanlar Unit yapilirsa
  **her inek bir nufus yer** ve neden hicbir yerde gorunmez.

Karar §4.2'de kilitlenir; onerilen yol ayri bir `WildlifeSystem`'dir.

Ek bulgu: `TerritoryOwner` zaten `UnitOwner | "neutral"` genisletmesini
yapmistir (`src/game/rts/territory/territoryControlSystem.ts:22`), yani
"ucuncu sahip" fikri kod tabaninda yabanci degildir; ornek alinacak desen
oradadir.

### 3.6 Kritik bulgu - `characters[]` RTS'te gorunmez (Faz 1'de olculdu)

Content Browser'dan sahneye birakilan bir skeletal mesh, Level'in
**`characters[]`** dizisine yazilir. Bu dizi:

- **editor viewport'unda cizilir** (`SceneApp` karakterleri isler), ama
- **`?rts` Play rotasinda cizilmez.** Dogrulandi: `src/game/rts/**` altinda
  `characters` gecen tek satir yoktur; `loadRtsAuthoredWorld`'un sardigi
  `src/scene/authoredWorld.ts` yalnizca `instances`, `lights`, `landscapes`,
  `splines`, `riverWaters` ve foliage mount eder.

RTS yolunda `actors[]` **veri tasiyan marker**'lardir; `rtsLevelAdapter` onlari
okur (`BP_RTS_Tree`, `BP_RTS_KingdomStart`, `Resource *`) ve agaci/yatagi
RtsApp kendisi cizer. Yani RTS'te bir canliyi haritaya koymanin yolu
`characters[]` degil, **marker actor + onu spawn eden sistem**dir.

Sonuc - bu plan icin bir degisiklik gerektirmez, tersine plani dogrular:
suruler `BP_RTS_Herd` marker'i olarak author edilir (§5.1, Faz 2) ve
`WildlifeSystem` tarafindan spawn edilir. Ancak bu, **Faz 1'in gorsel kabulunun
neden editorde yapildigini** ve hayvanlarin Play'de neden ancak Faz 2'den sonra
gorunecegini acikca kaydeder. Genel `characters[]` parity bosluğu bu planin
kapsami disindadir; ayri bir isdir.

### 3.7 Ikinci bulgu - `characters[]` animasyonu klip adini birebir arar

`characters[]` yolunun animasyonu, sidecar'in `animationSet`'ini **hic
okumaz**. `createSceneCharacterMixer` (`src/scene/SceneRuntimeCore.ts:786`)
dogrudan klip adiyla eslesir:

```ts
const clip = animationName ? gltf.animations.find((c) => c.name === animationName) : null;
if (!clip) return null;   // eslesme yoksa mixer yok, yani hic animasyon yok
```

Content Browser'dan birakilan karakterin varsayilan `animation` degeri ise
`"idle"`dir (`src/scene/SceneApp.ts:3124`) - **kucuk harfle**. Hayvan
varliklari `Idle` (buyuk I) tasir, dolayisiyla esleme basarisiz olur ve hayvan
sessizce hareketsiz kalir. Details panelindeki alan zaten "Clip (Play)"
etiketlidir ve gercek klip adlarini listeler; dogru deger elle secilebilir.

Bu, §3.6 ile birlesince Faz 1'in gorsel kabulunun **nerede** yapilmasi
gerektigini kesinlestirir: klip oynatimi **Skeletal Mesh Editor**'un kendi
onizlemesinde dogrulanir (`SkeletalMeshEditor.ts` klip secip oynatir ve
`animationSet`'i kullanir). Viewport'a birakilan bir karakter, sidecar'i degil
ham klip adini kullandigi icin sidecar'in dogrulugu hakkinda **hicbir sey
soylemez**.

### 3.8 Ucuncu bulgu - klip kalibrasyonu model olcegini bilmez

Faz 2'nin gorsel kabulunde yakalandi: hayvanlar animasyonlarina gore **hizli
yuruyordu** (ayak kaymasi). Sebep tek bir varsayim:

```text
oynatma hizi = planarSpeed / walkClipSpeed        (rtsUnitAnimation.ts)
walkClipSpeed = moveSpeed * 0.5                   (RTS_LOCOMOTION_CALIBRATION)
```

Motor "yurume klibi `moveSpeed`'in yarisinda dogal gorunur" varsayar ve bunu
kendi de yazar ("no clip declares the speed it was authored for"). Bu varsayim
**scale 1** cizilen her sey icin dogrudur - butun unit'ler oyle. Hayvan ise
author edilmis bir olcek tasir (geyik 0.2), yani adimi besde bir yer kaplar ve
klibinin dogal hizi da yaklasik besde birdir. Kalibrasyon ~5 kat yuksek kalir.

**Onemli: hayvani yavaslatmak bunu duzeltmez.** Oran `hiz / klipHizi`
oldugundan hizi yariya indirmek animasyonu da yariya indirir; uyusmazlik
degismeden kalir. Yalnizca kalibrasyon sabiti duzeltebilir.

Cozum, tek sayilik bir yama yerine kendi kendini duzelten bir esitlik:

- `animals.json` her ture bir **`walkClipSpeed`** tasir - yurume klibinin dogal
  gorundugu yer hizi, author edilmis olcekte.
- Otlama hizi **tam olarak bu deger**dir (`RoamProfile.walkSpeed`). Boylece
  oynatma hizi her ayarda tam **1.0** olur ve ayak kaymasi tanim geregi imkansiz
  hale gelir.
- `rtsLocomotionTuning` bir `walkClipSpeed` override'i kabul eder; **yalnizca
  kalibrasyon** override edilir, esikler asla - neyin yurume neyin kosma
  sayildigi oyunun hiz gercegidir ve onu kaydirmak otlayan hayvani dortnala
  sokardi.
- Kacis (Faz 5) diger yaridir: `moveSpeed` ile kosar, dortnal klibi zaten ona
  kalibrelidir.

Eski `WILDLIFE_ROAM_SPEED_FRACTION = 0.25` sabiti kaldirildi; otlama hizi artik
turetilmis degil, author edilmis bir sayidir ve editorde "Hayvan Dengesi"
tablosundan ayarlanir. Yeni bir tur eklenirken bu sayi gozle bulunur.

### 3.9 Savas tarafi - isci karsilik verme yolu

`src/game/rts/units/unitCombat.ts:60`:

```ts
if (unit.role === "worker" && !unit.autoAcquired) continue;
```

Isciler yalnizca `autoAcquired` yoluyla (`retaliateAgainstAttack`) karsilik
verebilir. Yirtici hayvan saldirisi bu yolu tetiklemezse **isciler sessizce
olur**. V3'te (kurt) bu yolun yaban hayvani icin de calistigi dogrulanmalidir.

`CombatTarget` arayuzu (`src/game/rts/combat/combatTarget.ts`) `owner`,
`position`, `health`, `armorClass` ister. Hayvanin avlanabilir olmasi icin bu
arayuze uymasi yeterlidir; Unit olmasi gerekmez.

## 4. Tasarim Kararlari

### 4.1 Av modeli - KARAR: B, kamp modeli (2026-08-01 kilitlendi)

Degerlendirilen iki secenek:

- **A - Serbest av (AoE modeli).** Isciye sag tik ile hayvan hedefi verilir,
  isci saldirir, hayvan olur, les bir yiyecek kaynagi olur, isci en yakin
  depoya tasir. **Secilmedi.**
- **B - Kamp modeli. SECILEN.** Surunun yakinina **Avci Kulubesi** kurulur,
  isci atanir, kulube menzilindeki hayvanlari otomatik avlatir.

Gerekce tasarimsaldir: bu oyunda **hicbir kaynak yol/depo zincirini atlayarak
merkeze gitmez**. Serbest av, lojistik oyununu bypass eden tek istisna olurdu
ve oyunun kendi kimligini delerdi. Kamp modeli ayrica `ForestSystem` desenini
neredeyse birebir kullanir; en ucuz ve en tutarli yoldur.

A'nin verdigi "bir hayvani tiklayip avlatma" hazzi kalici olarak kaybedilmez:
kamp menzilindeki bir hayvana **manuel hedef verme** V1 sonrasi cila katmani
olarak eklenebilir (§4.5). Bu, B'nin uzerine eklenen bir emirdir; A'ya donus
degildir.

### 4.2 Sahiplik - KARAR: B, ayri `WildlifeSystem` (2026-08-01 kilitlendi)

**A - `UnitOwner`'a `"wild"` eklemek.** Durust ama §3.5'teki tum yollari kirar.
**Secilmedi.**

**B - Ayri `WildlifeSystem`. SECILEN.** `UnitSystem`'in paraleli; hayvanlar
Unit degildir. Yalnizca `CombatTarget["owner"]` genisletilir:

```ts
export type CombatTargetOwner = UnitOwner | "wild";
```

Kazanc: nufus, AI blackboard, takim rengi ve secim yollari **hic
dokunulmadan** dogru kalir. Evcillestirilen hayvan da (V2, Agil)
`WildlifeSystem` icinde bir `owner` alani tasir; Unit olmasina gerek yoktur.

### 4.3 Uc Cag anlatisi - kabul edilen cerceve

12 asseti dagini ozelliklere serpmek yerine cag ilerlemesinin gorsel anlatisi
yapilir. Bu hem daha az kod hem daha guclu kimliktir:

| Cag | Iliski | Asset |
| --- | --- | --- |
| 1 - Yerlesim | **Avlarsin** | Deer, Stag, yabani Cow/Bull |
| 2 - Kasaba | **Evcillestirirsin** | Cow, Bull, Alpaca, Donkey, Husky, ShibaInu |
| 3 - (henuz yok) | **Binersin** | Horse, Horse_White |
| Her cagda | **Doga geri saldirir** | Wolf, Fox |

Not: `public/game-data/balance/ages.json` bugun yalniz `settlement` ve `town`
tasir; ucuncu cag ileriye donuktur. Ayrica
`src/game/data/gameDataTypes.ts:109` "Cavalry is deliberately out of the
vertical slice" der - suvari bilincli ertelenmistir ve bu plan onu dogal
sirasinda geri getirir (§12).

### 4.4 V1 tur secimi - KARAR: Deer + Stag (2026-08-01 kilitlendi)

12 turun tamami ~37 MB ve hepsi skinned mesh'tir. V1 **iki tur** gonderir:
`Deer` (temel av) ve `Stag` (yuksek verimli nadir av). Ikisi de toynakli
ailedendir, yani **tek sidecar sablonu** yeter ve `loadGroup: "Animals"` tek
seferde iki asset yukler.

Geri cekilme yolu acik tutulur: performans riski (§9) buyurse Stag Faz 7'ye
ertelenir ve V1 yalniz `Deer` ile gonderilir.

### 4.5 Kapsam disi (V1 sonrasi adaylar)

Asagidakiler V1'e **sizmayacaktir**:

- Agil / evcillestirme / hayvan cogalmasi (V2, §12)
- Yirtici baskisi, kurt/tilki (V3, §12)
- Esek lojistigi (V4, §12)
- Suvari, at, Cag 3 (V5, §12)
- Kesif kopegi (bagimsiz, §12)
- Kamp menzilindeki hayvana manuel hedef verme (V1.1 cilasi)
- Suru yeniden dogusu / respawn - **av sonlu olmalidir**, planin ana ekseni
  budur; respawn V1'de acikca yoktur
- Hayvan derisi/yun gibi ikinci kaynak turu

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/wildlife/wildlifeSystem.ts` | **Yeni.** Renderer'siz suru/hayvan durumu; `reserveNearest` / `harvest` / `releaseReservation` / `liveAnimalsNear` / `snapshots` (ForestSystem ikizi) |
| `src/game/rts/wildlife/wildlifeRoaming.ts` | **Yeni.** Saf dolasma + kacma davranisi (suru merkezi + `roamRadius`, avci yaklasinca kacis) |
| `src/game/rts/wildlife/wildlifePresentation.ts` | **Yeni.** `rtsUnitPresentation` ikizi; klip surusu ve yon |
| `src/game/rts/economy/resourceSource.ts` | **Yeni.** `ResourceSource` arayuzu (`reserveNearest` / `harvest` / `remainingNear`); Forest, ResourceNode ve Wildlife uclusu uygular |
| `src/game/rts/economy/economyProductionSystem.ts` | Ucuncu kaynak dali yerine `ResourceSource` uzerinden tekillestirme (§5.4); `requiresGame` kolu |
| `src/game/rts/combat/combatTarget.ts` | `owner` tipini `CombatTargetOwner = UnitOwner \| "wild"` olarak genislet |
| `src/game/rts/world/rtsSpatialLayout.ts` | `RtsSpatialLayout`'a `herds: readonly RtsHerdDefinition[]` |
| `src/game/rts/world/rtsLevelAdapter.ts` | `BP_RTS_Herd` vakasi (`BP_RTS_Tree` deseninin ikizi): `herdId`, `species`, `count`, `roamRadius` |
| `src/game/rts/world/rtsMapBlockout.ts` | `RTS_BLOCKOUT_MAP` fallback'ine suru tanimlari |
| `src/game/data/gameDataTypes.ts` | `EconomyProductionBalance`: `requiresGame?`; yeni `AnimalBalance` tipi |
| `src/game/data/validateGameData.ts` | `requiresForest` blokunun ikizi dogrulama; sifir/negatif et kapasitesi ve `roamRadius >= gatherRadius` reddi |
| `src/game/editorCatalog.ts` | Details panelinde `requiresGame` alani |
| `src/game/rts/structures/placementGrid.ts` | `PlacementFailure` -> `"missing-game"` |
| `src/game/rts/structures/structureConstructionService.ts` | `StructureBuildFailure` -> `"missing-game"` |
| `src/game/rts/RtsApp.ts` | `WildlifeSystem` kurulumu + update sirasi; `additionalPlacementFailure` zincirine yeni dal; fog binder'a hayvan kaydi |
| `src/game/rts/ui/rtsBuildPalette.ts` | "Ekonomi" kategorisine `hunting_camp`; `missing-game` gerekcesi |
| `src/game/rts/ui/rtsSelectionView.ts` | `"missing-game": "Yakinda av yok"` |
| `src/game/rts/vision/fogVisibilityBinder.ts` | Hayvanlarin sis altinda gizlenmesi |
| `src/game/rts/ai/aiEconomyManager.ts` | `buildingCounts["farm"] === 0` yerine "yiyecek ureten yapi" olcusu (liman planiyla **ortak** duzeltme) |
| `src/game/rts/ai/aiBuildManager.ts` | AI'nin suru yakinina avci kulubesi kurmasi |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/assets/ThreeAges/Animals/Deer.skeleton.json` | **Yeni.** Toynakli `animationSet` |
| `public/assets/ThreeAges/Animals/Stag.skeleton.json` | **Yeni.** Ayni sablon |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Deer.actor.json` | **Yeni.** `BP_RTS_Worker` deseni |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Stag.actor.json` | **Yeni.** |
| `public/game-data/content/rts-content.json` | Yeni `animals` bolumu (`actorRef` eslemeleri) |
| `public/game-data/balance/animals.json` | **Yeni.** Tur basina et kapasitesi, hiz, saglik, `roamRadius` (§6) |
| `public/game-data/balance/buildings.json` | `hunting_camp` girdisi (§6) |
| `public/assets/ui/icons/building-hunting-camp.svg` | **Yeni.** Palet ikonu |
| `public/game-data/balance/ai.json` | `buildingTargets`'a avci kulubesi |
| `public/assets/ThreeAges/Levels/*.level.json` | Suru yerlesimi ve kabul senaryosu |

### 5.3 Allowlist notu

Bu plan **CLAUDE.md'nin ikinci allowlist yuzeyine dokunur**:
`*.skeleton.json` sidecar'i. `Deer.skeleton.json` / `Stag.skeleton.json`
yalnizca mevcut `animationSet` semasini kullandigi surece yeni alan yoktur ve
`tools/saveValidator.ts` degismez.

Ancak sidecar'a **yeni bir alan** eklenirse (ornegin tur basina bir
`meatCapacity` ya da av-ozel bir `preview` alani), bu alan
`validateAssetSkeletonDef` -> `validateAnimationSet` zincirine eklenmezse
**kayitta sessizce dusurulur**. Kural: hayvan verisi sidecar'a degil,
`public/game-data/balance/animals.json`'a yazilir. Bu, allowlist isini
tamamen disarida birakir.

`BP_RTS_Herd` marker'i `BP_RTS_Tree` gibi generic actor yolundan gecer;
`LayoutPlacement` allowlist'ine dokunmaz.

### 5.4 `ResourceSource` cikarimi - hayvandan bagimsiz kazanc

`economyProductionSystem.ts` bugun kaynak dalini

```ts
requiresForest ? forests : requiresResourceNode ? resourceNodes : null
```

uclu zinciriyle cozer ve bu zincir **iki ayri yerde** (`snapshots` ve uretim
dongusu) tekrarlanir. Ucuncu bir dal eklemek tekrari uce cikarir. Bunun yerine
kucuk bir `ResourceSource` arayuzu cikarilir; Forest, ResourceNode ve Wildlife
uclusu de uygular. Bu, avciliktan bagimsiz olarak da dogru bir sadelestirmedir
ve liman plani da ayni zincire dokunacagi icin once bu yapilmalidir.

## 6. Balans Verisi (oneri)

### 6.1 `animals.json`

| Alan | Deer | Stag |
| --- | --- | --- |
| `label` | Geyik | Erkek Geyik |
| `meatCapacity` | 120 | 200 |
| `maxHealth` | 40 | 70 |
| `moveSpeed` | 7.5 | 7.0 |
| `fleeRadius` | 9 | 9 |
| `roamRadius` | 10 | 10 |
| `rigFamily` | `ungulate` | `ungulate` |

`meatCapacity` **hayvan basinadir** ve suru buyuklugu Level'da author edilir.
6 geyiklik bir sure = 720 yiyecek; bu, iki tarlanin yaklasik 2 dakikalik
uretimine karsilik gelir - kasitli olarak "erken oyunu hizlandirir, sonra
biter" buyuklugunde.

Referans: agac kapasitesi Level'da instance basina author edilir
(`RtsTreeDefinition.capacity`). Hayvanda varsayilan turden gelir, Level
isterse override eder.

### 6.2 `hunting_camp`

Referans: Tarla 3 isci x 20/dk, tampon 40, maliyet 40 odun. Oduncu kampi
`gatherRadius: 20`, `carryCapacity: 30`, maliyet 80 odun.

| | Yerlesim L1 | L2 | L3 | Kasaba L1 | L2 | L3 |
| --- | --- | --- | --- | --- | --- | --- |
| isci kapasitesi | 3 | 3 | 4 | 4 | 5 | 5 |
| yiyecek/isci/dk | 30 | 34 | 38 | 45 | 50 | 55 |
| yerel tampon | 50 | 60 | 80 | 100 | 120 | 140 |
| tasima kapasitesi | 25 | 30 | 35 | 45 | 50 | 55 |
| maxHealth | 100 | 110 | 120 | 130 | 140 | 150 |

Sabitler: `cost: { wood: 60 }`, `constructionSeconds: 25`,
`footprint: 6x6`, `visionRadius: 10`, `gatherRadius: 18`,
`economy.resourceId: "food"`, `economy.requiresGame: true`.

Denge mantigi: isci basina tarlanin ~%50 ustunde ve daha ucuz, ama toplam
verim surunun `meatCapacity` toplamiyla **sert sinirlidir**. Kulube tukenen
suruden sonra bos bir bina olarak kalir; bu, oyuncuya "tasin ya da tarlaya
gec" mesajini verir.

**`gatherRadius` uyarisi.** Deger yerel kalmalidir. Orman `gatherRadius`'unda
ogrenilen ders gecerlidir: harita kosegenine (~198 birim) yaklasan bir yaricap
tum suruleri tek global havuza cevirir ve kaynak yerelligini yok eder. 18,
`roamRadius` 10'un uzerinde kalarak kacan hayvani menzilde tutar (§8).

### 6.3 `resources.json`'a dokunulmuyor

`food` icin `safeNode`/`externalNode` profili **eklenmez**. Hayvanlar
kapasitesini kendi tanimindan tasir (agac deseni), yatak deseni degil. Bu,
`ResourceNodeSystem`'in safe/external ayrimini avcilik icin gereksiz kilar ve
iki sistemin karismasini onler.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi ve envanter

Amac: §4'teki uc acik karari yazili hale getirmek.

- [x] §4.1 av modeli karari kilitlendi: **B - kamp modeli** (2026-08-01).
- [x] §4.2 sahiplik karari kilitlendi: **B - ayri `WildlifeSystem`**
  (2026-08-01).
- [x] §4.4 V1 tur secimi kilitlendi: **Deer + Stag** (2026-08-01).
- [x] Bu dosyadaki "KARAR BEKLIYOR" etiketleri secilen secenekle degistirildi.
- [x] Kapsam disi listesi (§4.5) V1'e sizmayacagi teyit edildi.

Kabul: uc kararin hicbiri kod yazilirken yeniden tartisilmaz. **Faz 0
tamamlandi.**

### Faz 1 - Sidecar ve gorsel dogrulama (oynanis yok)

Amac: Hayvanin ekranda dogru klibi oynatmasi. Bu fazda hicbir oynanis yoktur.

- [x] `Deer.skeleton.json` yazildi; `animationSet`: `idle: "Idle"`,
  `walk: "Walk"`, `run: "Gallop"`, `jump: "Gallop_Jump"`,
  `fall: "Jump_toIdle"`, `work: "Eating"`, `attack: "Attack_Headbutt"`,
  `death: "Death"`. (`jump`/`fall` RTS'te kullanilmaz ama klipler gercektir ve
  `ANIMATION_SET_ROLES` bunlari tanir; bos birakmak `resolveLocomotionClip`'i
  idle'a dusururdu.)
- [x] `Stag.skeleton.json` ayni sablondan uretildi (ayni toynakli aile).
- [x] `BP_RTS_Deer.actor.json` / `BP_RTS_Stag.actor.json` yazildi
  (`BP_RTS_Worker.actor.json` deseni, `SkeletalMeshComponent` + `assetId`
  `deer`/`stag`, `selectionRadius` 0.6 / 0.7).
- [x] Model olcegi actor'e kondu: Deer `scale: [0.2, 0.2, 0.2]` (kullanici
  kararı, editorde denenerek bulundu), Stag `0.22` (ayni rig, biraz iri olan
  tur - **turetilmis varsayim**, kullanici duzeltebilir). Olcek burada durur
  cunku `rtsActorPresentationTree.ts:114` `props.scale`'i okuyup uygular; yani
  Faz 2'de suru spawn'i dogru boyutta gelir.
- [x] Klip adlarinin gltf'te gercekten var oldugu engine testiyle pinlendi:
  "RTS wildlife sidecars name clips the shipped animal models actually carry".
  Testin kirmizyya donebildigi dogrulandi (Deer'a kopek ailesinin `Attack`
  klibi verilip suite kirmizi goruldu, sonra geri alindi).

**Dogrulanan bulgu - klipler yerinde (in-place), root motion yok.** Sidecar
yazilmadan once olculdu: hayvan animasyonlari sahne kokunu
(`AnimalArmature`) hic animate etmez, yalnizca 46 kemigi surer. Kok kemik
(`Body`) klip boyunca yalnizca salinir - Walk'ta dX=0.12, Gallop'ta dZ=0.23
birimlik **sinirli bir aralik**, ilerleyen bir kayma degil. Bu yuzden
sidecar'larda `rootMotion` girdisi **yoktur** ve olmamalidir: RTS birimi
simulasyon tarafindan tasinir, klip de ilerletseydi hayvan cift hareket
ederdi. Yeni bir tur eklenirken bu olcum tekrarlanmalidir.

**Faz 1'den cikarilan madde - `rts-content.json` `animals` bolumu.** Uygulama
sirasinda dogrulandi: `validateUnits` her anahtari `context.unitBalance[id]`
ile capraz kontrol eder ve bilinmeyen id'de yuklemeyi patlatir
(`rtsContentCatalog.ts:429`). `animals` bolumu de ayni sozlesmeyi tasimalidir,
yani bir **anahtar otoritesine** ihtiyaci vardir - o da `animals.json`'dir.
Bolumu anahtar otoritesi olmadan eklemek, katalogun tum degerini veren
"bilinmeyen id sessizce placeholder'a dusmez" kuralini animal'lar icin devre
disi birakirdi. Bu yuzden bolum, `animals.json` ile birlikte **Faz 2'ye**
tasindi. Faz 1'in gorsel kabulu bolume ihtiyac duymaz (asagi bkz.).

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1198 check) ve
  `npm run build:verify` (`verify:dist --strict` dahil) yesil.
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici Skeletal Mesh Editor'de
  dogruladi: 13 klibin tamami oynuyor ve rol eslemeleri
  (`idle`/`walk`/`run`/`work`/`attack`/`death`) dogru. §3.6/§3.7 geregi
  viewport'a birakilan bir karakter ne `?rts` Play'de gorunur ne de sidecar'i
  kullanir; klip oynatimini dogrulayan tek yer Skeletal Mesh Editor'un kendi
  onizlemesidir. Bunun icin Playwright/screenshot kaniti uretilmedi;
  kullaniciya bakmasi soylendi (CLAUDE.md kurali).

**Faz 1 tamamlandi (2026-08-02).**

### Faz 2 - `WildlifeSystem` ve dolasma (oynanis yok)

Amac: Hayvanlarin haritada var olmasi ve dolasmasi. Avlanma yoktur.

- [x] `wildlifeSystem.ts`: renderer'siz suru/hayvan durumu, `snapshots()`,
  `liveAnimalsNear()`, `all()`.
- [x] `wildlifeRoaming.ts`: saf dolasma (suru merkezi + `roamRadius`) + **seed'li
  PRNG**. `Math.random` kasitli olarak kullanilmadi: bir hayvanin nerede
  durdugu avcinin ona erisip erisemeyecegini belirler, yani dolasma dekor
  degil simulasyondur ve headless AI ile oyuncunun ayni tarlayi gormesi
  gerekir. Seed hayvan id'sinden turetilir.
- [x] `wildlifeView.ts` (planda yoktu, gerekti): snapshot'lari Object3D'ye
  baglayan sunum katmani. Otlayan hayvan `working: true` ile `work` roluna,
  yani `Eating` klibine duser - duran sure heykel tarlasina donmez.
- [x] `CombatTargetOwner` genisletmesi yapildi; hayvan `CombatTarget` uyumlu
  ama kimse hedef almiyor (`engagementSystem`'e verilmiyorlar).
- [x] `RtsSpatialLayout.herds` + `rtsLevelAdapter`'da `BP_RTS_Herd` vakasi +
  `BP_RTS_Herd.actor.json` marker'i.
- [x] `RTS_BLOCKOUT_MAP` fallback'ine suru eklendi.
- [x] **Iki Level'a da suru marker'i eklendi** (`RTS_CoreMatch`,
  `RTS_GameplayProof`). Bu planda yoktu ve atlanirsa Faz 2 gorunmez olurdu:
  `?rts` rotasi Level'i yukler, blockout fallback'ini degil, yani yalniz
  blockout'a eklenen suru kimsenin oynamadigi haritada otlardi. Engine testi
  bunu artik pinliyor.
- [x] `animals.json` + `validateGameData` dogrulamalari + editor Data Table
  girdisi ("Hayvan Dengesi"), boylece denge elle ayarlanabilir.
- [x] `rts-content.json`'a `animals` bolumu (Faz 1'den tasindi); anahtarlari
  `animals.json`'a karsi dogrulanir, `RtsContentCatalogValidationContext`'e
  `animalBalance` eklendi; `rtsContentValidation.ts` ve `rtsContentCatalog.ts`
  bolumu tanir.
- [x] `RtsApp` hayvanlari mount eder ve update sirasina baglar: otlama
  **simulasyon delta'sinda** (oyun hizi kontrolu hayvani da tasir), sunum
  **render delta'sinda** (herhangi bir hizda ayni gorunur) - birimlerin
  ayrimiyla ayni.
- [x] Hayvanlar **NavBlocker uretmez** (§9) ve nav ajani da degildir; bir sure
  avlanabilir dekordur, hayvan basina kare basina yol bulma en onemsiz sorunu
  cozmenin en pahali yolu olurdu.
- [x] Hayvanlar nufus saymaz - engine testiyle pinlendi (§8).
- [x] Hayvanlar `syncUnitsToGround` ile ayni zemin yuzeyine oturtulur. Planda
  yoktu; hayvan 2D dolastigi ve nav grid'e hicbir sey sormadigi icin bu
  olmadan author edilmis bir Landscape'te y = 0'da kalir, yani zemine gomulur
  ya da havada otlar.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1205 check) ve
  `npm run build:verify` yesil.
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici `?rts` Play rotasinda
  dogruladi: suruler dogru boyutta gorunuyor, dolasip otluyor, zemine oturuyor
  ve nufus sayaci etkilenmemis. Ayni gecise ait tek kusur - animasyona gore
  hizli yurume - §3.8'de teshis edilip duzeltildi ve tekrar dogrulandi.

**Faz 2 tamamlandi (2026-08-02).** V1 hedefi acisindan durum: hayvanlar
haritada yasiyor ama henuz avlanamiyor. Sirada Faz 3.

### Faz 3 - Kaynak arayuzu tekillestirmesi

Amac: Ucuncu kaynak dalini eklemeden once tekrari kaldirmak (§5.4).

- [x] `resourceSource.ts` arayuzu cikarildi: `ResourceReach` (uretici konumu +
  `gatherRadius` + kaynak id + footprint, bes gevsek argumanin yerine tek deger),
  `ReservedResourceSource` ve `ResourceSource`
  (`remainingNear` / `nearestSourceDistanceSquared` / `reserveNearest` /
  `harvest` / `releaseReservation`).
- [x] `ForestSystem` ve `ResourceNodeSystem` arayuzu uygular; davranis
  degismedi. Imza uyumu icin degisenler: `ForestSystem.remainingNear` ve
  `reserveNearest` artik `ResourceReach` alir,
  `nearestLiveTreeDistanceSquared` -> `nearestSourceDistanceSquared`,
  `harvest(workerId, sourceId, requested)`;
  `ResourceNodeSystem.remainingAt` -> `remainingNear`, `nearestLiveNodeNear` ->
  `reserveNearest` (rezervasyon tutmaz), `extractFrom` -> `harvest`, ve bos bir
  `releaseReservation`. Yerlestirme sorgulari (`hasLiveTreeNear`,
  `canExtractAt`, `extract`) konumsal imzalariyla durdu - `RtsApp` ve testler
  onlari kullaniyor ve toplama dongusunun parcasi degiller.
- [x] `economyProductionSystem` zinciri tek bir `requirementFor()` icinde
  cozulur; `snapshots()` ve uretim dongusu ayni cozumu kullanir.
  `updateForestProducer` + `updateNodeProducer` (~110'ar satir, ikizi) tek bir
  `updateGatheringProducer`'a indi; ayni sekilde
  `findReachableTree`/`findReachableNode` -> `findReachableSource`,
  `moveWorkerToTree`/`moveWorkerToNode` -> `moveWorkerToSource`,
  `preferredForestProducer` -> `preferredProducer`.

**Iki davranis farki tek bir ozellige indi.** Orman ile yatak gercekten iki
yerde ayrisiyordu: (1) erisilemeyen bir agac atlanip komsusu denenir, erisilemez
bir yatakta isci serbest birakilir; (2) yukunu bosaltan oduncu daha yakin bir
kampa gecebilir, madenci gecemez. Ikisi de ayni alt gercegin sonucu - **ayni
turden kaynaklar birbirinin yerine gecer mi** - ve arayuzde tek bir
`sourcesAreInterchangeable` bayragi olarak durur (orman `true`, yatak `false`).
Bu, "davranis degismez" kabulunu bir dilek olmaktan cikarip derleyicinin
gorebildigi bir sozlesmeye cevirir; Faz 5'te suru bu bayragi kendi dogrusuyla
doldurur.

`ForestSystem.harvest` `sourceId`'yi **okumaz**: bir oduncu ancak ormanin ona
verdigi govdeyi kesebilir, yani rezervasyon otoritedir. Parametre arayuz
sozlesmesi geregi durur ve bu gerekce kodda yazilidir.

Kabul:

- [x] Hicbir oynanis degisikligi yok: `npx tsc --noEmit`,
  `npm run test:engine` (1205 check - Faz 2 ile ayni sayi) ve
  `npm run build:verify` yesil.
- [x] Refactor gercekten kapsanmis durumda; iki yolu da zaman icinde suren
  mevcut testler yesil kaldi: "RTS lumber camps require individual trees and
  workers carry wood back to camp", "RTS wood workers switch to a nearer camp
  after delivering their exhausted tree" (orman + kamp gecisi) ve "RTS miners
  walk to the deposit, cut a load there, and carry it back to the mine"
  (yatak). Bu faz saf refactor oldugu icin yeni test eklenmedi - §8'de de
  istenmiyor.

**Faz 3 tamamlandi (2026-08-02).** Sirada Faz 4 - Avci Kulubesi ve yerlestirme
kurali.

### Faz 4 - Avci Kulubesi ve yerlestirme kurali

- [x] `buildings.json` -> `hunting_camp` (§6.2 tablosu birebir; alti kademeli
  `progression` dahil).
- [x] `requiresGame` alani: `EconomyProductionBalance` tipi,
  `validateGameData` (boolean + `gatherRadius`/`carryCapacity` zorunlu ve > 0,
  orman/yatak bloklarinin ikizi) ve editor Details alani.
- [x] `PlacementFailure` / `StructureBuildFailure` -> `"missing-game"`.
- [x] `RtsApp.additionalPlacementFailure` zincirine ucuncu dal:
  `wildlife.liveAnimalsNear(x, z, gatherRadius)` bos ise `missing-game`.
  **Yalniz yasayan hayvan sayilir** - avlanip bitmis bir suru yeni bir kulubeyi
  hakli cikarmaya devam etmemeli.
- [x] Build paleti ("Ekonomi" kategorisi, Tarla'nin hemen yaninda - ikisi de
  yiyecek uretir ve oyuncunun sordugu soru aynidir), "Avci Kulubesi icin
  yakinda av hayvani gerekir." gerekcesi ve
  `public/assets/ui/icons/building-hunting-camp.svg` ikonu (boynuz + kulube;
  bina siluetleri palet olceginde birbirine benzedigi icin okunan parca
  boynuzdur). `rtsSelectionView` -> `"missing-game": "Yakinda av yok"`.

**Planda olmayan ama zorunlu olan madde - `requirementFor`'a ucuncu dal.**
Faz 3'un tekillestirdigi zincir `requiresGame`'i tanimasaydi, kurulan kulube
**yenilenebilir** dala duser ve tarla gibi yoktan yiyecek uretirdi; avlanamayan
bir kulubeden cok daha kotusu budur. Bu yuzden dal Faz 4'te eklendi ama
kaynagi henuz `null`: kulube kurulur, dogru gerekceyle **bos durur**
(`missing-game`) ve Faz 5 ayni dala `WildlifeSystem`'i verir.
`EconomyProductionStatus` de bu yuzden simdi `"missing-game"` tasiyor.

**Gorsel: `BP_RTS_HuntingCamp` (kullanici secimi, 2026-08-02).** Kulube kendi
Actor'unu tasir (`houses-firstage-3-level3` static mesh'i) ve oduncu kampi gibi
**tum cag ve kademelerde ayni** modeli kullanir. Actor manifest'e
`threeages-rts-huntingcamp-actor` olarak kaydedildi; diger bina Actor'lerinin
deseni budur. Ilk uygulamada gecici olarak `BP_RTS_LumberCamp`'e bakiyordu -
icerik kapsam testi her binanin bir Actor cozmesini sart kostugu icin bos
birakilamazdi.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1207 check) ,
  `npm run build:verify` ve `npm run check:assets` yesil.
- [x] Yerlestirme kurali **engine testiyle** pinlendi: "Faz 4: a hunting camp is
  refused away from live game and legal beside a herd" - suru uzerinde
  `valid`, `gatherRadius * 3` uzaginda `missing-game`.
- [x] **Menzil ve yerellik sozlesmeleri** (§8'in iki maddesi) pinlendi: "Faz 4: a
  gathering camp's reach stays local and still covers the herd it was built
  for". Her tur icin `roamRadius < gatherRadius` **iki tablodan hesaplanarak**
  dogrulanir (ayar pinlenmez), ve **her** sonlu kaynakli bina icin
  `gatherRadius < RTS_WORLD_HALF_EXTENT / 2` - orman dersinin genellenmis hali.
  Testin kirmiziya donebildigi dogrulandi: `gatherRadius` gecici olarak 5
  yapilinca suite "deer roams 10, past the hunting camp's reach of 5" ile
  kirildi, sonra geri alindi.
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici `?rts` Play rotasinda
  dogruladi: surunun uzaginda ghost kirmizi ve gerekceli, suru yakininda yesil.
  Ayni gecise ait tek istek - kulubeye kendi modelinin verilmesi - yukarida
  uygulandi.

**Faz 4 tamamlandi (2026-08-02).** Kulube kurulabiliyor ama henuz avlanmiyor;
"Yakinda av yok" durumu Faz 5'e kadar dogru davranistir. Sirada Faz 5.

**Not - veri dosyalarina PowerShell ile yazmayin.** Bu fazda
`Set-Content`/`Get-Content -Raw` ile yapilan tek bir gecici duzenleme
`buildings.json`'a BOM ekledi ve butun Turkce etiketleri bozdu (`Taş Ocağı` ->
mojibake); dosya git'teki surumden geri alinip degisiklik yeniden uygulandi.
Bu dosyalar UTF-8/LF'dir; duzenleme dosya araclariyla yapilmalidir.

### Faz 5 - Avlanma dongusu

- [x] `WildlifeSystem implements ResourceSource`. Ucuncu dal **eklenmedi** -
  Faz 4'te acilan `requiresGame` dalina kaynak verildi, hepsi bu.
- [x] Avci hayvana yurur; hayvan `fleeRadius` icinde kacar, avci kovalar.
- [x] Sikisinca avci `attack` pozuna gecer (`Unit.setHunting`).
- [x] Saglik bitince **les**: `Death` klibi (`dying` zaten sunuma gidiyordu) ve
  `remainingMeat = meatCapacity`.
- [x] Avci `work` pozunda leşi keser, `carryCapacity` doldurur, kulubeye doner,
  bosaltir - hepsi Faz 3'te tekillestirilmis **ayni** dongude.
- [x] Et yol/depo zincirine akar: kulube diger ureticiler gibi `localBuffer`
  doldurur ve `withdrawBuffered` ile cekilir; avciliga ozel bir yol yoktur
  (§4.1'in butun gerekcesi buydu).
- [x] **Histerezis** (§9) - asagida.
- [x] Suru tukenince kulube `source-depleted` bildirir.

**Arayuze iki kavram eklendi; ikisi de gercek genellemedir.**

1. `ResourceSource.positionOf(sourceId)` - kaynagin **su anki** yeri. Agac ve
   yatak icin sabit, yani takip kontrolu onlar icin hic tetiklenmez; hayvan icin
   kacisin ta kendisi. Olmasaydi avci hayvanin *bulundugu* yere degil *oldugu*
   yere yururdu.
2. `harvest` artik `{ amount, working }` dondurur. Ayrim sart: **calisiyor ama
   hicbir sey kazanmadi** durumu, hayvani heniz devirmemis avcidir. Eskiden
   `0` donmek "gezi bitti, eve don" demekti; av bu yuzden hic baslayamazdi.
   Agac ve yatak `working: amount > 0` dondurur - davranislari birebir ayni
   kalir. Loop bu ikiliden **pozu da** turetir: `working && amount <= 0` ise
   saldiri pozu, degilse calisma pozu. Boylece jenerik dongu "yaban hayati"
   diye bir sey bilmeden dogru klibi surer.

`Unit.setHunting` eklendi: `setWorking`'in ikizi, ayni sistem tarafindan
yazilir. Gerekce somut - avcinin **saldiri hedefi yoktur**, hicbir zaman darbe
alisverisi yapmaz, yani `isTradingBlows()` onu hayvan onunde bos bos dururken
gosterirdi. Sunum-yalniz; hasar buradan gecmez, oldurme islemi kaynagin kendi
isidir.

**Uc davranis hatasi olcumle bulundu ve duzeltildi.** Tasarim kagit uzerinde
dogruydu; kod calistirilinca degildi:

1. **Kacis sinirsizdi.** Av isciden hizli (7.5'e karsi 6), yani duz kacan bir
   geyik gitti. Olculdu: tek geyik 90 birim asti ve **haritadan cikti**, avci
   pesinde; kulube surusunu tek atis yapmadan kaybetti. Cozum `keepInHerdGround`
   - kacis sururun cemberine kelepcelenir, hayvan hiz ustunlugunu kendi
   otlagini turlayarak harcar. Yan kazanc: §8'in menzil sozlesmesi
   (`roamRadius < gatherRadius`) artik **ortalamada degil kelimesi kelimesine**
   dogru; kacan hayvan kulubenin menzilinden cikamaz.
2. **Her karede yol planlaniyordu.** Kacan hayvan tikte 1.875 birim gidiyor,
   `WORK_RANGE` ise 1.25 - yani takip kontrolu her tik yeni yol istiyor ve
   yuruyusu daha ilk adim atilmadan sifirliyordu. Cozum iki esik: yolda
   `SOURCE_FOLLOW_SLACK` (gevsek, kovalamaca yol planini dovmesin), kaynagin
   basinda `WORK_RANGE` (sikí, yoksa avci leşi dort adim oteden kesiyor - bu da
   olculdu).
3. **Hayvan hic kosaya sikismiyordu.** `fleeRadius` icindeki her insan kacisi
   tetikledigi icin, hayvani deviren avci tam da kapattigi mesafeyi yeniden
   aciyordu: olculdu, 5 saniyelik `huntSeconds` **65 saniye** surdu. Cozum
   `CAUGHT_DISTANCE` - bu mesafenin icinde hayvan kacmaz, durur ve tehdide
   doner. Sikisan av, olum klibinin de dogru yonde oynadigi andir.

**Histerezis (§9): kulube surunun *kendisine* baglidir, konumuna degil.** Bir
hayvan, kendisi menzildeyse **ya da sururunun merkezi** menzildeyse avlanabilir
sayilir. Sebep somut: hayvan kulubeden uzaga kacar ve durdugu yerde olur;
"nerede dustuyse orayla" olculseydi, avci rezervasyonu birakir birakmaz les
menzilden cikar ve kulube **yerde et dururken** `source-depleted` derdi. Bu
kural bilerek yerlestirme kuralindan ayridir: nereye **kurulabilecegi** hala
gorunen hayvanlarla ilgili yerel bir sorudur (`liveAnimalsNear`), ne
**isleyebilecegi** ise kuruldugu suruyu izler.

**Kapsam disi birakilan tek madde - `Idle_HitReact`.** `animationSet` semasinda
`hitReact` diye bir rol yok; eklemek sidecar semasini ve CLAUDE.md'nin ikinci
allowlist yuzeyini (`tools/saveValidator.ts`) degistirmek demek. Av anlatisini
`Gallop` kacis + sikisma + `Death` zaten tasiyor; hit-react ayri ve
allowlist'e dokunan bir is olarak ertelendi.

Yeni balans alanlari (`animals.json`): `fleeSeconds`, `fleeRecoverySeconds`,
`huntSeconds`. Av hasari **turetilir** (`maxHealth / huntSeconds`), yani ayari
yapan "bu tur kac saniyede devrilir" okur, aritmetik yapmaz - ve hayvan V3'te
kurdun/ordunun vurabilecegi gercek bir can cubugu tasimaya devam eder.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1210 check) ve
  `npm run build:verify` yesil.
- [x] §2'nin 1-7 adimlari **tek bir engine testinde uctan uca** kosuyor:
  "Faz 5: a hunter runs down its quarry, butchers it, and banks exactly what the
  carcass held". Kulube kurulur, avci kovalar, saldiri pozunu takar, hayvan
  duser, les temizlenir ve bankaya giren miktar `animals.json`'daki
  `meatCapacity`'den **hesaplanarak** dogrulanir. Ayrica avin bitmesiyle
  `source-depleted` ve iscinin serbest birakilmasi pinlenir.
- [x] Rezervasyon sozlesmesi (§8) pinlendi: iki avci ayni hayvani alamaz,
  rezervasyon **kacisi asar** ve birakildiginda hayvan yeniden alinabilir.
- [x] Titreme (§9) testin icinde pinlendi: et yerde dururken kulube hicbir tikte
  `source-depleted` demiyor.
- [x] Yakalanabilirlik validator'a girdi: bir kacis, isci onu telafi
  suresinde kapatabileceginden uzun surerse `validateGameData` dosya ve alan
  adiyla reddeder ("can never be caught"). Bu, kovalamaca hatasinin bir
  **yol bulma arizasi gibi** gorunen turunu veriye kapatir.
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici `?rts` Play rotasinda
  dogruladi: avci geyigi kovaliyor, sikistiriyor, hayvan dusuyor, les basinda
  calisip eti kulubeye tasiyor.

**Faz 5 tamamlandi (2026-08-02).** V1 hedefi acisindan durum: §2'nin 1-7
adimlari oyunda calisiyor. Kalan iki faz oynanis degil **uyum**dur - AI'nin
avcilikla beslenen bir ekonomiyi ac sanmamasi (Faz 6) ve sis + kabul maci
(Faz 7). Sirada Faz 6; **ayri bir oturumda** ele alinacak.

### Faz 6 - AI uyumu

- [x] `aiEconomyManager` yiyecek olcusu bina adindan **kaynak kimligine**
  cevrildi. Blackboard'a `resourceProducerCounts` eklendi: tamamlanmis
  ureticiler **kaynak basina** sayilir ve kaynagi bitmis olan sayilmaz
  (`producerHasSource`, `economyProductionSystem.ts`). **Liman planiyla ortak
  duzeltmedir**; liman `resourceId: "food"` tasidigi gun hicbir ek is
  gerektirmeden ayni olcuye girer.
- [x] AI suru yakinina avci kulubesi kurabilir. Bu **`aiBuildManager`
  degisikligi cikmadi** (§5.1 tablosu onu tahmin ediyordu): §40 geregi aday
  yerler serbest arama degil **author edilmis anchor**tir, yani is iki yerde
  bitti - `buildOrder`'a bir satir ve haritaya bir anchor.
- [x] AI, tukenmis suruden kulubeyi terk edip tarlaya gecer. Buna da **yeni
  kural yazilmadi**; asagida.
- [x] `ai.json` `buildingTargets`: `hunting_camp: 1` (yerlesim ve kasaba).

**Olcu neden dort kaynagin hepsine uygulandi.** Plan yalniz yiyecegi istiyordu,
ama `detectBottleneck` ayni hatayi dort kez yapiyordu: odun `lumber_camp`
sayisi, tas `quarry`, altin `gold_mine`. Hepsi ayni iki yonde yaniliyor -
kaynagini baska bir bina veren ekonomiyi ac sanmak, ve **kaynagi bitmis** bir
binayi arz saymak. Ikinci yon avcilikta teorik degil: kulube tukenmis suruden
sonra ayakta kalir. Dort satirin dordu de `resourceProducerCounts` okuyunca AI
darbogaz sozlugu bina adlarindan tamamen kurtuldu ve **kod kisaldi**.

**Kulube acilis sirasinda nereye kondu.** Iki temel uretecinin arkasina,
askeriyenin onune (`buildOrder`). Tarlanin arkasinda cunku kasaba gecisi
tarlayi **adiyla** sart kosuyor; yalniz avla acan bir AI hic kurmadigi bir
binaya takilirdi. Askeriyenin onunde cunku suru, haritada degeri **yalniz
azalan** tek varlik: kulubenin toplam verimi surunun tuttugu ete esittir, yani
gec kurulan kulube kucuk kurulmus kulubedir.

**"Tukenen suruden tarlaya gecis" neden kendiliginden calisiyor.** Uc mevcut
davranisin toplami: (1) tukenen kulube iscilerini birakir (Faz 5'te pinlendi),
(2) `resourceProducerCounts` onu artik yiyecek arzi saymaz, yani
`no-food-production` **dogru anda** doner, (3) `short("hunting_camp")` yanlis
kalir (bina hala ayakta, hedef 1) ve sira dogal olarak tarlaya duser. Bu, "suru
bitti" diye bir AI kurali yazmadan cikan sonuctur; yazsaydik ayni seyi iki
yerden bilen bir sistem olurdu.

**Anchor: `atEnemyBase(-12, 12)` = (26,-26).** Uc kisitin ayni anda saglandigi
tek nokta:

- `enemy-deer` suru merkezine 5.7 birim; hayvan `roamRadius` 10'un en uzak
  kenarinda otlasa bile kulubenin 18 birimlik menzilinde kalir.
- Tas ocagi slotuna (32,-26) **tam 6 birim** - iki 6x6 ayak izi kenar kenara,
  ust uste degil.
- z = -30 yol omurgasindan bir yol hucresi otede. Bu ucuncusu atlanabilir
  gorunuyordu ve degildi: yol degmeyen bir uretici tamponunu doldurup durur,
  yani suru dibindeki ama teslimat yapamayan bir kulube **yiyecek arzi degil,
  `disconnectedProducers` sayacinda bir satirdir**.

Anchor hem `RTS_BLOCKOUT_MAP`'e hem **iki Level'a** eklendi; CoreMatch blockout
aynasi oldugu icin sira da birebir korundu.

**Test kosumuna yaban hayati baglandi (`aiTestWorld`).** Planda yoktu, zorunlu
cikti: AI harness'inda `WildlifeSystem` yoktu, yani AI'nin kurdugu kulube
`missing-game` bildirir, hicbir sey uretmez ve "AI avla yasayabilir" iddiasi
tam da onu olcecek harness'ta olculemezdi. Ormanin ayni sebeple eklenmis olmasi
(`RTS_BLOCKOUT_MAP.trees`) burada da gecerli. Ekleme RtsApp'i birebir taklit
eder: ayni suruler, ayni `missing-game` yerlestirme dali, ve `update` sirasi
hareket **sonrasi** / uretim **oncesi**.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1212 check),
  `npm run build:verify` ve `npm run check:assets` yesil.
- [x] Olcu sozlesmesi pinlendi: "Faz 6: a kingdom fed by hunting is not
  diagnosed as starving, and a spent camp is". Iki yon de ayri ayri: yalniz
  kulubeyle beslenen ekonomi darbogazsiz, ayni ekonomi suru bitince
  `no-food-production` - ve ardindan istenen bina **tarla**.
- [x] Harita sozlesmesi pinlendi: "Faz 6: the AI's hunting camp anchor is
  authored on a herd it can work and a road it can ship from". Menzil iki
  tablodan hesaplanir (mesafe + `roamRadius` <= `gatherRadius`), yol temasi
  author edilmis omurga gercekten dosenip `roadCellTouchingFootprint` ile
  olculur. Editorde suru marker'i tasindiginda kirmiziya donen test budur.
- [x] Acilis testi genisletildi: AI ~5 dakikalik acilisinda kulubeyi gercekten
  **kuruyor** ve kurdugu kulube `missing-game` bildirmiyor - "sirada var"
  degil, "yasal bir yere ulasti".
- [x] Olcek testi: `roamRadius` ve `gatherRadius` yariya indirilerek kosuldu.
  Ilk kirilan **bu fazin testi degil**, Faz 5'in mevcut av dongusu testi oldu
  (menzili yarilanan kulube kendi surusune yetismiyor) - yani yeni testler
  suitin mevcut ayar duyarliligini artirmiyor. `animals.json`/`buildings.json`
  x2 kosumu ise GDD'nin kendi gorus yaricapi tavanina (<= 35) takiliyor; bu da
  bu fazdan bagimsiz, validator'un kasitli siniri.

Kabul olcutu (avcilikla beslenen AI kendini ac sanmaz; kasabaya gecis
kilitlenmez) saglandi. **Faz 6 tamamlandi (2026-08-02).** Sirada Faz 7.

### Faz 7 - Sis, seviye icerigi ve kabul maci

- [x] Hayvanlar sis altinda gizlenir. Kural `isWildlifeVisible` olarak
  `wildlifeView.ts`e cikarildi; `sync` onun uzerinde doner ve `RtsApp` sis
  kapaliyken hicbir yuklem gecirmez, yani fogsuz bir mac bire bir eskisi gibi
  cizer.
- [x] Kabul Level'lari sozlesmeye baglandi (asagida; icerik Faz 2'den beri
  yerindeydi, eksik olan pindi).
- [x] Tam mac oynanir: av ile acilis, tukenme, tarlaya gecis. **Kabul alindi
  (2026-08-02).** Ayni gecise ait tek kusur - temizlenen lesin sahnede kalmasi -
  asagida duzeltildi.

**Planda kural `fogVisibilityBinder`daydi; `wildlifeView.sync` icine kondu.**
Uc gerekce, ucuncusu belirleyici:

1. Tek yazar kurali. `rtsMapArt.syncForest` ayni sebeple binder'in disindadir ve
   gerekcesini kendi kodunda yazar: `visible`i zaten suren bir dongu varken
   ikinci bir yazar onunla her tik kavga eder.
2. Govdeler `sync` icinde **tembel** dogar. Binder kendi programinda kossaydi,
   yeni dogan bir suru ilk simulasyon tikine kadar bir kare aciktan cizilirdi.
3. **Binder mac baslamadan hic kosmaz.** `updateFogOfWar` simulasyon tikinden
   gelir; baslangic ekraninda simulasyon yoktur (kod bunu `mapArt` icin zaten
   soyluyor). Hayvan govdeleri ise render dongusunde dogar - yani binder yolunda
   suru, oyuncu "Maci Baslat" diyene kadar sisin icinde acikta otlardi.

Binder'in bas yorumuna bu iki istisnayi (agac/yatak ve hayvan) ve nedenini
gosteren bir not birakildi; "sis neyi gizler" sorusunu binder'dan soran biri
yolunu bulur.

**Kural agacin degil birimin kuralidir** (`isVisible`, `isExplored` degil).
GDD 08 §40 *kalici dogal ogeleri* gorulduyse haritada birakir; hareket eden
seye ayni hafizayi vermez. Hatirlanan bir orman hala orada duruyordur, hatirlanan
bir suru ise yurumustur, rakip tarafindan avlanmistir ya da ikisi birden - ve o
hafizaya kurulan kulubenin avlayacak hicbir seyi yoktur. Les de gizlenir: ondan
okunan sey "surada et var"dir ve baskasinin avcisi onu temizledigi an yanlis olur.

**Seviye icerigi olculdu: sart zaten saglaniyordu, pin eksikti.** Iki Level de
Faz 2'den beri uc suru tasiyor - her kralligin kendi 28'lik kontrol yaricapi
icinde bir geyik surusu, ve ikisinin de disinda merkez erkek geyik surusu. Faz
7'de yapilan is mevcut Level testini iki yonlu hale getirmek oldu: **her**
baslangic icin kendi topragi icinde bir suru, **ve** ikisinin de disinda bir
suru. Yaricap `COMMAND_CENTER_CONTROL_RADIUS`tan okunur, 28 yazilmaz. Testin
kirmiziya donebildigi dogrulandi (`player-deer` gecici olarak elenip suite
"RTS_CoreMatch opens every kingdom with game inside its own starting ground" ile
kirildi, sonra geri alindi). Eski hali yalnizca "disarida bir suru var mi" diye
soruyordu; tek surulu bir harita o testi gecerdi ve dersin yarisi kaybolurdu.

**Kayda gecen iki bulgu - ikisinde de kod degistirilmedi.**

1. **Merkez odul esit uzaklikta degil.** `central-stag` (0,16) oyuncu
   baslangicina 43.9, dusmana 66 birim. Ikisi de 28'in disinda, yani §7'nin
   sarti saglanir; ama "ortadaki odul" pratikte oyuncuya daha yakindir. Ridge
   (`x` ∈ [-12,12], `z` ∈ [-4,4]) ve "suru merkezi ridge'e bir `roamRadius`tan
   yakin olamaz" kurali x = 0 hattinda daha simetrik bir nokta birakmiyor; esit
   uzaklik ancak (16,16) gibi kosegen bir noktada saglanir ve orasi
   `RTS_GameplayProof`un nehir blocker'lariyla kesisme riski tasir. Ayrica
   harita zaten nokta-simetrik degil: `external_stone` (-34,16) oyuncuya 22.4,
   dusmana 90 birimdir. Harita dengesi bu planin kapsami disi - istenirse ayri
   bir is kalemi.
2. **Yerlestirme sis okumaz.** Kesfedilmemis alandaki bir hayvan
   `liveAnimalsNear` sorgusunda gorunur, yani ghost orada yesile donebilir.
   Davranis orman ve yataklarda birebir ayni (`hasLiveTreeNear`,
   `canExtractAt`), yani avciliga ozgu yeni bir acik degil - kaynak
   yerlestirmesinin genel bir bilgi sizintisi. Duzeltmesi de avciliga ozgu
   olamaz: zincir AI ile paylasilir ve oyuncunun gorusuyle kapatilirsa AI'nin
   insaati oyuncunun sisine takilir. Ayri ve ortak bir is olarak birakildi.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1213 check),
  `npm run build:verify` (`verify:dist --strict` dahil) yesil.
- [x] Sis sozlesmesi pinlendi: "Faz 7: fog hides a herd, and unlike a forest it
  hides it again when the scout leaves". Test **gercek `WildlifeView.sync`**
  dongusunu surer (GL gerektirmez), kuralin kopyasini degil: kesfedilmemis suru
  cizilmez, goz uzerine gelince cizilir, goz cekilince - `isExplored` hala
  dogruyken - yeniden gizlenir, ve yuklem verilmediginde her sey cizilir. Testin
  kirmiziya donebildigi dogrulandi (`visible` her zaman `true` yapilinca suite
  "a herd in unscouted ground is not on the map" ile kirildi, sonra geri alindi).
- [x] Kabul maci: §2'deki 9 madde uctan uca (kullanici, 2026-08-02).

**Kabul macinin cikardigi tek duzeltme - temizlenen les sahnede kaliyordu.**
Olculdu: eti alinmis hayvan macin sonuna kadar dustugu yerde duruyor, yani
avlanan her suru otladigi yerde bir mezarlik birakiyor. Sebep sunum
tarafindaydi; `WildlifeView` bir govdeyi hicbir zaman geri almiyordu.

Duzeltme agacin kuralidir (`isTreeVisible`): `spent` bir hayvan artik cizilmez,
tuttugu sunum `dispose` edilip sahne grafigninden dusurulur. Uc ayrinti kasitli:

- **Simulasyon kaydi kalir.** Orman da kutugu Map'inde tutar; kayit silinseydi
  elinde hala o rezervasyon olan bir avcinin `positionOf` sorgusu bosluga
  duserdi. Giden sey govdedir, kayit degil.
- **`spent` kontrolu `handleFor`dan once.** Sonra olsaydi les her karede yeni
  bir govde dogurur, her karede silinirdi.
- **Toplama kuralı "cizilmedi" uzerinden yazildi**, `spent` uzerinden degil: bir
  govdenin sahneden cikmasinin ikinci yolu - hayvanin listeden tamamen kalkmasi,
  ki V2'de evcillesen hayvan suruden boyle ayrilacak - ayni tek kuralla kapanir.
  Tarama yalnizca sayilar tutmadigi tikte yapilir; diger her kare tek bir
  tamsayi karsilastirmasidir.

Pinlendi: "a carcass picked clean leaves the field, and its art is released with
it" - yarim kesilmis les sahnede kalir (yoksa avci ikinci yuke doner ve hicbir
sey bulamaz), temizlenen les cikar, sunumu `dispose` edilir, sonraki tiklerde
yeniden dogmaz ve kaynak id'si hala cozulur. Testin kirmiziya donebildigi
dogrulandi (`spent` atlamasi devre disi birakilinca suite "the spent carcass left
the field" ile kirildi, sonra geri alindi). `npm run test:engine` 1214 check.

Kabul: §2'deki 9 madde eksiksiz. **Faz 7 tamamlandi (2026-08-02); V1 bitti.**

## 8. Test ve Gate

`tools/engine-tests.ts`'e eklenecekler. CLAUDE.md kurali geregi **ayar degil
sozlesme** dogrulanir; hicbir test bir buyuklugu pinlemez.

- [x] **Klip varligi (Faz 1'de uygulandi):** her turun `animationSet`'inde
  adlandirilan her klip, o turun `.gltf` dosyasinda gercekten vardir; ayrica
  alti RTS rolunun (`idle`/`walk`/`run`/`work`/`attack`/`death`) hepsi
  eslenmistir. Iki rig ailesinin buyuk/kucuk harf farki (§3.1) tam olarak bu
  testin yakaladigi hata turudur. Test `Animals/` altindaki **her** sidecar'i
  tarar, yani V2+ turleri eklendiginde kendiliginden kapsar.
- [x] **Menzil sozlesmesi (Faz 4'te uygulandi):** her tur icin `roamRadius <
  hunting_camp gatherRadius`. Kacan hayvan kalici olarak erisilemez bir yere
  gidemez. (Orman `gatherRadius` dersinin genellenmis hali.) Deger iki tablodan
  hesaplanir, pinlenmez.
- [x] **Yerellik (Faz 4'te uygulandi):** `gatherRadius`, `RTS_WORLD_HALF_EXTENT
  / 2`nin altinda kalir; global havuz olusmaz. Test yalniz avci kulubesini
  degil, **her** sonlu kaynakli binayi tarar.
- [x] **Nufus (Faz 2'de uygulandi):** yaban hayvani
  `PopulationSystem.snapshot()` sayimina girmez.
- [x] **Turetim (Faz 5'te uygulandi):** bir lesin verdigi toplam yiyecek,
  `animals.json`'daki `meatCapacity`'den **hesaplanarak** dogrulanir; boylece
  her ayarda gecerli kalir.
- [x] **Icerik cozumu (Faz 2'de uygulandi):** her turun `actorRef`'i cozulur;
  eksik esleme sessizce placeholder'a dusmez.
- [x] **Rezervasyon (Faz 5'te uygulandi):** bir hayvani ayni anda iki avci
  rezerve edemez; rezervasyon kacisi asar ve birakildiginda hayvan yeniden
  alinabilir.
- [x] **AI olcusu (Faz 6'da uygulandi):** yalniz avcilikla beslenen bir ekonomi
  darbogazsiz okunur, kaynagi bitmis bir kulube ise yiyecek arzi sayilmaz.
  Hicbir buyukluk pinlenmez; olculen sey hangi **kaynagin** uretildigidir.
- [x] **Harita/tablo uyumu (Faz 6'da uygulandi):** AI'nin avci kulubesi
  anchor'i, bir surunun tum dolasma cemberini menzilinde tutar ve author
  edilmis yol omurgasina deger. Mesafe haritadan, yaricaplar iki tablodan
  hesaplanir.
- [x] **Sis (Faz 7'de uygulandi):** kesfedilmemis alandaki hayvan cizilmez ve
  goz cekildiginde - `isExplored` hala dogruyken - yeniden gizlenir; agacin
  aksine. Test gercek `WildlifeView.sync` dongusunu surer.
- [x] **Seviye dersi (Faz 7'de uygulandi):** her Level, her krallik icin kendi
  baslangic kontrol yaricapi icinde bir suru ve ikisinin de disinda en az bir
  suru tasir. Yaricap `COMMAND_CENTER_CONTROL_RADIUS`tan okunur.
- [x] **Les temizligi (Faz 7'de uygulandi):** eti alinmis hayvan sahneden cikar
  ve sunumu birakilir; yarim kesilmis les kalir. Test gercek `WildlifeView.sync`
  dongusunu surer.
- [x] **Validator:** sifir/negatif `meatCapacity` (Faz 2) ve yakalanamaz kacis
  ayari (Faz 5) `validateGameData` tarafindan dosya ve alan adiyla reddedilir.
  `roamRadius >= gatherRadius` iki tablo birden gerektirdigi icin engine
  testinde durur (Faz 4).

Kapi: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`.
Olcek testi: `animals.json` ve `buildings.json`'daki her buyukluk olceklenip
`npm run test:engine` yeniden calistirilir; **yesil kalmalidir**.

Gorsel kabul kullanicidadir; hayvan gorunumu/olcegi/animasyonu icin otomatik
kani uretilmez.

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Hareket eden kaynak, sabit kaynak sozlesmesini deler.** `ResourceNodeSystem` dokumantasyonu "kuculen mesh tukenmeyi gosterir" ilkesi uzerine kuruludur. Kacan hayvan `gatherRadius` disina cikinca `sourceRemaining` sayi<->null arasinda ziplar ve durum `producing` ile `source-depleted` arasinda titrer. | Rezervasyon gecici menzil disina cikisa dayanir (histerezis). Durum yalnizca **rezervasyon birakildiktan sonra** `source-depleted` olur. Faz 5 checklist maddesi. |
| **Performans.** 12 model x ~3 MB ~= 37 MB ve hepsi skinned mesh. Ayrica `ForestSystem` her sorguda `[...this.trees.values()].filter()` yapar; sabit agacta kabul edilebilir, her kare hareket eden 30 hayvanda degil. | V1 iki tur gonderir (§4.4). `loadGroup: "Animals"` tembel yuklenmede kalir. Sorgu maliyeti `THREEAGES_RTS_PERFORMANCE_CONTINUATION.md` ile birlikte ele alinir; gerekirse uzak hayvan icin LOD/statik dusurme. |
| **Hayvanlar NavBlocker yapilirsa nav grid her kare yeniden kurulur.** | Hayvan blocker uretmez; ayrim `unitSeparation` isidir. Faz 2 checklist maddesi. |
| **Isciler yirtici saldirisina sessizce kurban gider** (`unitCombat.ts:60`). | V1'de yirtici yoktur; V3'te `retaliateAgainstAttack` yolunun yaban hayvani icin calistigi dogrulanir. |
| **AI aclik yanilsamasi.** `aiEconomyManager` yiyecegi tarla sayisiyla olcer. | Faz 6 ilk maddesi; liman planiyla ortak duzeltme. |
| **`UnitOwner` genisletme tuzagi** (§3.5): sessiz nufus tuketimi. | §4.2 karari B; nufus testi (§8) tuzagi kalici olarak kapatir. |
| **Sidecar'a veri kacmasi.** Hayvan verisi sidecar'a yazilirsa allowlist isi cikar ve alan sessizce dusebilir. | Kural: hayvan verisi `animals.json`'a yazilir (§5.3). |

## 10. Tamamlanma Kapisi

V1 icin bu kapi **gecildi (2026-08-02)**:

- [x] §2'deki dokuz madde uctan uca calisir.
- [x] §8'deki tum sozlesme testleri gecer; olcek testi yesil kalir.
- [x] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify` yesil.
- [x] Kullanici gorsel kabulu verdi (geyik olcegi, animasyonu, olum ve les
  gorunumu; les temizligi kabul macinda duzeltildi - Faz 7).
- [x] §4.5 kapsam disi listesinden hicbir sey V1'e sizmadi.
- [ ] ~~Bu dosya `docs/COMPLETED_WORK_INDEX.md`'ye eklenip arsive tasinir.~~
  **Askiya alindi (kullanici karari, 2026-08-02):** yol haritasinin devami
  (§12) bu dosyadan yurutulecek, yani dosya `docs/planned/` altinda kalir.
  Arsivleme V4 bittiginde yeniden degerlendirilir.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7.

Faz 3 (kaynak arayuzu) Faz 5'ten **once** gelmelidir; aksi halde ucuncu kaynak
dali tekrari uce cikarir. Faz 1 ve Faz 2 birbirinden bagimsizdir ve sirasi
degistirilebilir, ancak Faz 1'in gorsel kabulu erken alinmasi risk azaltir.

## 12. Yol Haritasi - V1 Sonrasi

V1 disindaki sekiz asset icin kabul edilen yon. Her biri ayri bir plan
dosyasini hak eder; burada yalnizca gerekce ve maliyet kaydedilir.

**Kapsam karari (2026-08-02):** sira **V2 -> V3 -> V4**. **V5 (suvari, at,
Cag 3) yapilmayacaktir** - `ages.json`'in ucuncu cagi acilmadikca dayanagi yok
ve maliyeti digerlerinin toplamina yakin. `Horse` / `Horse_White` bu yuzden V1
sonrasi kapsamin **disindadir**; asset'ler dosyada durur, sistem yazilmaz.
Bagimsiz "kesif kopegi" maddesi bu siranin disinda, istenildigi an alinabilir.

### V2 - Agil ve evcillestirme (Cow, Bull, Alpaca)

**Plani yazildi ve basladi (2026-08-02):**
`docs/planned/THREEAGES_RTS_V2_PASTURE_AND_TAMING_PLAN.md`. Orada Faz 0
kilitlendi: gudme **agil kamp modeliyle** yapilir (bu dosyanin §4.1 kararinin
ikizi), V2 **Cow + Bull** gonderir (Alpaca'nin dayandigi biyom sistemi yok,
V2.1'e), ve boganin karsilik vermesi V2'de kendi fazinda kalir. Asagidaki
gerekce kayit icin durur.

Inek geyikten farkli olmalidir: **oldurmek yerine yakalanabilir**. Isci yabani
inegi guder, Agil'a sokar; hayvan artik oyuncunundur ve **iscisiz yavas
yiyecek uretir**, kapasite dolunca cogalir.

Kazanc: haritadaki suruler **yaris hedefi** olur. Rakip senden once avlarsa o
et bir daha kimseye gitmez; sen guder ve agila sokarsan kalici gelir olur. Ayni
asset uzerinde iki farkli stratejik karar - cok verimli bir tasarim.

`Bull` yuksek verimlidir ama `Attack_Headbutt` klibi vardir: saldirildiginda
karsilik verir. Risk/odul bedava gelir. `Alpaca` dag biyomunun inegidir.

Maliyet: orta. `WildlifeSystem`'e `owner` alani ve gudme emri gerekir.

### V3 - Yirtici baskisi (Wolf, Fox)

Bugun harita tamamen edilgendir; disari cikmanin tek riski rakip AI'dir. Kurt
bunu degistirir: bolge disindaki yalniz isciye saldirir. Bu, Karakol'u ve
avciya muhafiz eslik ettirmeyi **ilk kez gercekten anlamli** kilar. Kurtlar
geyik de avlar - harita canli gorunur, bedava atmosfer.

`Fox` korunmasiz tarla tamponundan calip kacar, ya da tamamen ambiyanstir.

Maliyet: dusuk (V1 altyapisi uzerine). Onkosul: §3.9'daki karsilik verme
yolunun dogrulanmasi.

### V4 - Esek lojistigi (Donkey) - en yuksek getirili madde

Oyunun **zaten** yollari, depolari, `carryCapacity`'si ve bir yol grafigi
vardir; ama kaynak tasima `ProductionLogisticsSystem` icinde **soyut** olarak
gerceklesir - yolda hareket eden hicbir sey yoktur.

Yuk esegi bunu gorunur kilar: uretici binanin tamponunu yol uzerinden depoya
tasiyan, yukseltilebilir, saldiriya acik bir katir kervani. Yollar birden
**islevi gorunen** bir seye donusur; yol kesme ve baskin taktigi dogar.

Bu jenerik bir "hayvan ekleme" degil, **oyunun kendi ayirt edici sistemine
gorsel govde vermektir**. Getiri/maliyet oraninin en yuksek oldugu madde
budur.

Maliyet: orta-yuksek. `ProductionLogisticsSystem`'in soyut transferini
tasiyiciya baglamak gerekir.

### V5 - Suvari ve Cag 3 (Horse, Horse_White) - YAPILMAYACAK

**Kapsam disi (kullanici karari, 2026-08-02).** Asagidaki gerekce kayit icin
durur; yol haritasi V4'te biter. Suvari borcu (`gameDataTypes.ts:109`) acik
kalir ve ucuncu cag gundeme gelirse yeniden degerlendirilir.

`UnitRoleId`'ye `cavalry` eklenir, Ahir binasi acilir. Bu, bilincli ertelenmis
suvari borcunu kapatir (`gameDataTypes.ts:109`).

`Horse_White` ayni rig, farkli dokudur: **Kral/Kahraman binegi**.
`strategicPointSystem` ve `regionalVictory` zaten vardir; "Krali koru"
modu icin bedava gelen bir asset.

Maliyet: yuksek. `ages.json`'a ucuncu cagin eklenmesini bekler.

### Bagimsiz - Kesif kopegi (Husky, ShibaInu)

Roster'da (`guard/archer/siege/worker`) **kesif birimi yoktur**, ama
`visionRadius` zaten birim basina veridir (`units.json`) ve sis + dusman
hafizasi sistemi hazirdir (`enemyMemorySystem.ts`).

`Husky`: hizli, ucuz, gorusu genis, dovusmez -> Cag 1 kesif birimi. Neredeyse
sifir yeni sistem gerektirir - **en dusuk maliyetli madde**, herhangi bir
zamanda alinabilir.

`ShibaInu`: koy kopegi (merkez cevresi ambiyans) ya da "bekci": dusman
yaklasinca erken uyari (`RtsAttackWatch` zaten vardir).

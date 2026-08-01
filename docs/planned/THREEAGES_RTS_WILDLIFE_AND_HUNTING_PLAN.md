# ThreeAges RTS Yaban Hayati, Avcilik ve Hayvan Varliklari Plani

Olusturulma tarihi: 2026-08-01
Durum: Planlandi - uygulama baslamadi. Acik kararlar §4'te.
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

### 3.8 Savas tarafi - isci karsilik verme yolu

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
- [ ] **Gorsel kabul kullanicidadir:** `?rts` Play rotasinda sure haritada
  dolasir, dururken otlar (`Eating`), yururken `Walk` oynatir; nufus ve AI
  sayaclarinda hicbir degisiklik olmaz.

### Faz 3 - Kaynak arayuzu tekillestirmesi

Amac: Ucuncu kaynak dalini eklemeden once tekrari kaldirmak (§5.4).

- [ ] `resourceSource.ts` arayuzu cikarilir.
- [ ] `ForestSystem` ve `ResourceNodeSystem` arayuzu uygular (davranis
  degismez).
- [ ] `economyProductionSystem` uclu zinciri iki yerde birden arayuz uzerinden
  cozer.

Kabul: hicbir oynanis degisikligi yok, mevcut testler yesil kalir.

### Faz 4 - Avci Kulubesi ve yerlestirme kurali

- [ ] `buildings.json` -> `hunting_camp` (§6.2).
- [ ] `requiresGame` alani tip + validator + editor catalog.
- [ ] `PlacementFailure`/`StructureBuildFailure` -> `"missing-game"`.
- [ ] `RtsApp.additionalPlacementFailure` zincirine yeni dal.
- [ ] Build paleti + "Yakinda av yok" gerekcesi + ikon.

Kabul: sururun uzaginda ghost kirmizi ve gerekceli; suru yakininda yesil.

### Faz 5 - Avlanma dongusu

- [ ] `WildlifeSystem` `reserveNearest` / `harvest` / `releaseReservation`
  uclusunu uygular (`ForestSystem` ikizi).
- [ ] Avci hayvana yurur; hayvan `fleeRadius` icinde kacar (`Gallop`), avci
  kovalar.
- [ ] Menzilde `attack` rolu; hayvan `Idle_HitReact` oynar.
- [ ] Saglik bitince `Death` klibi -> **les** durumu
  (`remaining = meatCapacity`).
- [ ] Avci `gathering` durumuna gecer (`Eating`/`work` klibi), `carryCapacity`
  doldurur, kulubeye doner, `unloading`.
- [ ] Et yol/depo zinciriyle merkeze akar.
- [ ] **Histerezis:** rezervasyon, hayvanin gecici olarak `gatherRadius`
  disina cikmasina dayanir (§9). Durum `producing` <-> `source-depleted`
  arasinda titremez.
- [ ] Suru tukenince kulube `source-depleted` bildirir.

Kabul: §2'deki 1-7 adimlari uctan uca calisir.

### Faz 6 - AI uyumu

- [ ] `aiEconomyManager` yiyecek olcusu "tarla sayisi"ndan "yiyecek ureten
  yapi"ya cevrilir. **Liman planiyla ortak duzeltmedir**; iki plandan hangisi
  once uygularsa digeri devralir.
- [ ] AI suru yakinina avci kulubesi kurabilir (`aiBuildManager`).
- [ ] AI, tukenmis suruden kulubeyi terk edip tarlaya gecebilir.
- [ ] `ai.json` `buildingTargets` guncellenir.

Kabul: avcilikla beslenen AI kendini ac sanmaz; kasabaya gecis kilitlenmez.

### Faz 7 - Sis, seviye icerigi ve kabul maci

- [ ] `fogVisibilityBinder` hayvanlari sis altinda gizler.
- [ ] Kabul Level'ina en az iki suru yerlestirilir: biri baslangic kontrol
  yaricapi (28) icinde, biri disinda - "guvenli az / disarida cok" dersini
  ogretmek icin.
- [ ] Tam mac oynanir: av ile acilis, tukenme, tarlaya gecis.

Kabul: §2'deki 9 madde eksiksiz.

## 8. Test ve Gate

`tools/engine-tests.ts`'e eklenecekler. CLAUDE.md kurali geregi **ayar degil
sozlesme** dogrulanir; hicbir test bir buyuklugu pinlemez.

- [x] **Klip varligi (Faz 1'de uygulandi):** her turun `animationSet`'inde
  adlandirilan her klip, o turun `.gltf` dosyasinda gercekten vardir; ayrica
  alti RTS rolunun (`idle`/`walk`/`run`/`work`/`attack`/`death`) hepsi
  eslenmistir. Iki rig ailesinin buyuk/kucuk harf farki (§3.1) tam olarak bu
  testin yakaladigi hata turudur. Test `Animals/` altindaki **her** sidecar'i
  tarar, yani V2+ turleri eklendiginde kendiliginden kapsar.
- [ ] **Menzil sozlesmesi:** her tur icin `roamRadius < hunting_camp
  gatherRadius`. Kacan hayvan kalici olarak erisilemez bir yere gidemez.
  (Orman `gatherRadius` dersinin genellenmis hali.)
- [ ] **Yerellik:** `gatherRadius`, harita kosegeninin makul bir kesrinin
  altinda kalir; global havuz olusmaz.
- [ ] **Nufus:** yaban hayvani `PopulationSystem.snapshot()` sayimina
  girmez.
- [ ] **Turetim:** bir lesin verdigi toplam yiyecek, `animals.json`'daki
  `meatCapacity`'den **hesaplanarak** dogrulanir; boylece her ayarda gecerli
  kalir.
- [ ] **Icerik cozumu:** her turun `actorRef`'i cozulur; eksik esleme
  sessizce placeholder'a dusmez.
- [ ] **Rezervasyon:** bir hayvani ayni anda iki avci rezerve edemez;
  avci olunce/serbest kalinca rezervasyon birakilir.
- [ ] **Validator:** sifir/negatif `meatCapacity` ve `roamRadius >=
  gatherRadius` `validateGameData` tarafindan dosya ve alan adiyla reddedilir.

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

Bu plan asagidakilerin hepsi saglandiginda tamamlanmis sayilir:

- §2'deki dokuz madde uctan uca calisir.
- §8'deki tum sozlesme testleri gecer; olcek testi yesil kalir.
- `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify` yesil.
- Kullanici gorsel kabulu verir (geyik olcegi, animasyonu, olum ve les
  gorunumu).
- §4.5 kapsam disi listesinden hicbir sey V1'e sizmamistir.
- Bu dosya `docs/COMPLETED_WORK_INDEX.md`'ye eklenip arsive tasinir.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7.

Faz 3 (kaynak arayuzu) Faz 5'ten **once** gelmelidir; aksi halde ucuncu kaynak
dali tekrari uce cikarir. Faz 1 ve Faz 2 birbirinden bagimsizdir ve sirasi
degistirilebilir, ancak Faz 1'in gorsel kabulu erken alinmasi risk azaltir.

## 12. Yol Haritasi - V1 Sonrasi

V1 disindaki sekiz asset icin kabul edilen yon. Her biri ayri bir plan
dosyasini hak eder; burada yalnizca gerekce ve maliyet kaydedilir.

### V2 - Agil ve evcillestirme (Cow, Bull, Alpaca)

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

Maliyet: dusuk (V1 altyapisi uzerine). Onkosul: §3.8'deki karsilik verme
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

### V5 - Suvari ve Cag 3 (Horse, Horse_White)

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

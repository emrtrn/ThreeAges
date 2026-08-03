# ThreeAges RTS V2 - Agil ve Evcillestirme Plani

Olusturulma tarihi: 2026-08-02
Durum: **TAMAMLANDI - Faz 0-7, gorsel kabul dahil (2026-08-03).**
Kabul maci kullanici tarafindan oynandi ve onaylandi: sigir icin yaris, gudme,
kalici gelir ve tarlaya gerek kalmadan Kasaba'ya gecis dogrulandi. Sira
V3'tedir (`THREEAGES_RTS_V3_PREDATOR_PRESSURE_PLAN.md`).
Onkosul: `THREEAGES_RTS_WILDLIFE_AND_HUNTING_PLAN.md` V1 (Faz 0-7) tamamlandi.

Bu dosya, yaban hayati yol haritasinin (`...WILDLIFE_AND_HUNTING_PLAN.md` §12)
**V2** maddesini yurutur. V1 dosyasi yol haritasinin surucusu olarak
`docs/planned/` altinda kalir; bu dosya onun altindaki tek surumun plani.

## 1. Hedef

V1 haritaya **sonlu** bir yiyecek kolu ekledi: av biter. V2 ayni asset'ler
uzerine **kalici** kolu ekler ve boylece surulere ikinci bir stratejik anlam
yukler:

> **Geyigi avlarsin - bir kere yersin. Inegi gudersin - surekli yersin.**

Kazanc yalnizca bir bina degil, bir **yaris**tir. Yabani sigir haritada
paylasilan tek varliktir: rakip senden once avlarsa o et bir daha kimseye
gitmez; sen gudup agila sokarsan kalici gelir olur. Ayni model uzerinde iki
farkli karar, tek asset maliyeti.

Ikinci kazanc ekonomiktir: agil **iscisiz uretir**. Bugun her yiyecek kolu
(tarla, avci kulubesi) isci yer, yani yiyecek ile nufus/asker arasinda tek yonlu
bir takas vardir. Agil bu takasi kirar - onu kuran oyuncu iscilerini baska yere
kaydirabilir; bedeli, evcillestirmenin onden odenen zamanidir.

## 2. Basari Tanimi

1. Haritada otlayan bir **yabani sigir** surusu vardir; geyikle ayni sekilde
   dolasir, kacar ve (istenirse) avlanabilir.
2. Oyuncu surunun yakinina **Agil** kurar. Sururun uzaginda ghost kirmizidir ve
   "Yakinda evcil hayvan yok" gerekcesini verir.
3. Agil tamamlanir, isci atanir; **cobam** en yakin evcillestirilebilir hayvani
   rezerve eder, ona yurur, hayvan kacar, coban kovalar.
4. Sikisinca coban `work` roluna gecer ve hayvani `tameSeconds` boyunca
   sakinlestirir. Hayvan **olmez**; avdan ayrildigi nokta budur.
5. Sakinlesen hayvan cobanin pesine takilir ve agila kadar surulur.
6. Agila girince hayvan **oyuncunundur**: yabani suruden dusar, agilin cevresinde
   kucuk bir cemberde otlar, avci kulubelerinin hedefi olmaktan cikar.
7. Agil **hicbir isci calismadan** yiyecek uretir; uretim penin nufusuyla
   olculur ve mevcut yol/depo zinciriyle merkeze akar.
8. Zamanla surude **cogalma** olur: pen kapasitesine kadar yeni hayvan dogar.
   Kapasite dolunca coban isi biter ve agil kendi basina calisir.
9. **Boga** gudulurken karsilik verir: `Attack_Headbutt` oynatir ve cobana hasar
   verir. Riski goze alan oyuncu daha yuksek verimli hayvani kazanir.
10. AI ayni ekonomiyi kurabilir ve agille beslenen bir kralligi ac sanmaz.
11. Evcil hayvan **nufus saymaz** ve nav grid'i bloklamaz (V1 kuralinin devami).

## 3. Mevcut Durum - Olculen Baslangic Noktasi

### 3.1 Cow ve Bull, Deer ile **birebir ayni rig**

Uc modelin `.gltf` animasyon listesi olculdu; Cow, Bull, Alpaca ve Deer'in
**13 klip adi kelimesi kelimesine ayni**:

```text
Attack_Headbutt, Attack_Kick, Death, Eating, Gallop, Gallop_Jump, Idle,
Idle_2, Idle_Headlow, Idle_HitReact1, Idle_HitReact2, Jump_toIdle, Walk
```

Yani V1 §3.1'in "iki rig ailesi, buyuk/kucuk harf tuzagi" uyarisi V2'yi
**vurmuyor**: `Deer.skeleton.json` sablonu Cow ve Bull'a oldugu gibi kopyalanir.
Tuzak V3'te (Wolf/Fox, yirtici ailesi) geri gelir.

Iki modelin sahne kokleri farklidir (Cow/Bull `Head`, Deer/Alpaca `Ear4.L`), ama
sidecar kok adi tasimaz; bu yalnizca gltf ihracat sirasidir.

### 3.2 Varliklar zaten manifest'te

`cow` ve `bull` `public/assets/manifest.json` icinde kayitli:
`assetType: "skeletalMesh"`, `category: "Animals"`, `runtime.loadGroup:
"Animals"`. Yeni bir import isi yoktur; eksik olan `.skeleton.json` sidecar'i,
Actor'u ve balans satiridir.

Boyut: Cow 3.114.187 bayt; iki tur ~6 MB. V1'in §4.4 gerekcesiyle **iki tur**
gonderilir (Alpaca V2.1'e; projede biyom sistemi olmadigi icin bugun Cow'un
kopyasindan fazlasi olamaz - karar §4.2).

### 3.3 Kod tabani V2'yi zaten bekliyor - iki yerde yazili

V1 sirasinda iki karar acikca V2'ye acik birakildi:

- `rtsContentCatalog.ts:49`: *"No `ownerActorRefs` twin ... A tamed animal (the
  pasture, V2) would be the first thing to want one, and it can add the field
  then."* - evcil hayvana takim rengi/ayri Actor vermek istenirse yeri hazir.
- `wildlifeView.ts:136`: toplama kurali `spent` uzerine degil **"cizilmedi"**
  uzerine yazildi, gerekcesi de yazili: *"an animal gone from the roster
  entirely, which is how a tamed one will leave the herd in V2"*. Yani hayvan
  yabani listeden cikarilirsa sunumu **kendiliginden** birakilir; V2 bu yolda
  yeni bir temizlik kodu yazmaz.

### 3.4 Kritik bulgu - evcillestirme `ResourceSource`'tan **gecemez**

Ilk refleks, avciligin Faz 3'te tekillestirdigi toplama dongusunu yeniden
kullanmaktir. Olculdu: **gecmez**, ve sebebi mekanik degil anlamsaldir.

`ResourceSource.harvest` bir **sayi** dondurur (`amount`); dongu bunu iscinin
`cargoAmount`'ina ekler, isci eve doner ve sayi `localBuffer`'a bosalir.
`localBuffer` ise `ProductionLogisticsSystem` tarafindan **binanin
`resourceId`'si olarak** merkeze tasinir. Evcillestirilen inek bu yoldan
gecseydi, agil onu **yiyecek olarak depoya gonderirdi**.

Dolayisiyla gudme bir **toplama seferi** degil, bir **is**tir - ve kod tabaninda
bunun deseni zaten var: `WorkerConstructionSystem`. Insaat sistemi de bos
iscileri kendi cekip kendi durum makinesinde yurutur; `EconomyProductionSystem`
ona yalnizca `isWorkerConstructing(worker)` diye sorar. `PastureSystem` bu
desenin ikizidir (§5.1).

### 3.5 Kritik bulgu - uretim modeli ucuncu bir sekildir

`EconomyProductionSystem` bugun **iki** uretim sekli tanir:

| Sekil | Cikti | Ornek |
| --- | --- | --- |
| Yenilenebilir | `calisanIsci * perWorkerPerMinute` | Tarla |
| Toplayici | isci seferleri (`ResourceSource`) | Oduncu, maden, avci kulubesi |

Agil ucuncusudur: cikti **pen nufusuyla** olculur, isciyle degil. Bu, planin
ana kazanci olan "iscisiz uretim"in ta kendisidir, yani kacinilabilir bir sekil
degil - hedefin kendisi.

Somut sonuc: `EconomyProductionBalance.perWorkerPerMinute` bugun **zorunlu ve
> 0** (`validateGameData.ts:540,548`), ayrica kademe matrisinde her tier icin
tekrar zorunlu (`:790`). Agilin uretim hizi isci basina degildir, yani bu alan
agil icin **anlamsizdir**. Karar §4.4: alan `requiresLivestock` binalarda
istege bagli hale gelir ve yerine `perAnimalPerMinute` gecer. Alani "hayvan
basina" diye yeniden yorumlamak (isim yalani) kasitli olarak reddedildi -
CLAUDE.md'nin balans kurali, ayarlanan tablodaki bir alanin adiyla anlaminin
ayrismasina karsi.

### 3.6 Kritik bulgu - yaban hayvani **raycast hedefi degil**

`commandSystem.raycastTarget` yalnizca `units.bodyMeshes()`,
`centers.targetMeshes()` ve `structures.targetMeshes()` tarar. Hayvan govdeleri
`WildlifeView`'in kendi `Group`'unda durur ve hicbir secim/emir yoluna kayitli
degildir.

Yani "isciyi sec, inege sag tikla" modeli bedava degildir: hayvan govdelerinin
pick hedefi olmasi, `Object3D -> WildlifeAnimal` cozumu ve AI icin ikinci bir
kod yolu gerekir. Bu, §4.1 kararinin (kamp modeli) somut fiyat etiketidir.

### 3.7 `owner` genisletmesi bir alan, tip degisikligi degil

`WildlifeAnimal.owner` bugun `readonly owner = "wild" as const`, ama tip zaten
`CombatTargetOwner = UnitOwner | "wild"` (V1 Faz 2). Yani sahiplik degistirmek
**tip tabanina dokunmaz**; yalnizca alanin `readonly` olmaktan cikip
`WildlifeSystem` tarafindan yazilmasi gerekir.

Buna baglı zorunlu bir duzeltme var: `WildlifeSystem.huntable()` bugun yalnizca
`spent` filtreler. Evcil hayvan cikinca **avci kulubesi kendi inegini avlar**.
Filtre `owner === "wild"` olmalidir (Faz 4).

### 3.8 Yakalanabilirlik validator'u sigira da uygulanir

`validateAnimalBalance` her tur icin `moveSpeed * fleeSeconds < 6 *
fleeRecoverySeconds` sartini kosar (`FASTEST_HUNTER_SPEED = 6`). Sigir ayari bu
sarti saglamak zorundadir; saglamazsa yukleme dosya ve alan adiyla patlar. §6'daki
sayilar bu kontrolden gecirilmistir.

## 4. Tasarim Kararlari (Faz 0 - 2026-08-02 kilitlendi)

### 4.1 Evcillestirme modeli - KARAR: A, agil kamp modeli

Degerlendirilen: (A) Agil sururun yanina kurulur, atanan isci otomatik olarak en
yakin evcillestirilebilir hayvani sakinlestirip agila surer. (B) Isci secilip
hayvana sag tik verilir. (C) Once A, sonra cila olarak B.

**Secilen: A.** Gerekce V1 §4.1'in birebir devamidir - bu oyunda hicbir kaynak
lojistik zincirini atlamaz - ve §3.6'daki somut fiyat: B, hayvan govdelerini
secim/emir yoluna sokmayi ve AI icin ikinci bir yol acmayi gerektirir. Manuel
guduş, V2 bittikten sonra A'nin uzerine eklenebilecek bir cila olarak acik
kalir; A'ya donus degil, A'nin uzerine bir emirdir.

### 4.2 Tur secimi - KARAR: Cow + Bull

Alpaca **V2 kapsami disindadir**. Gerekce: "dag biyomunun inegi" tanimi bir
biyom sistemine dayanir ve projede boyle bir sistem yok; bugun eklenirse Cow'un
rakamlari degistirilmis kopyasi olur. Sidecar sablonu ayni oldugu icin V2.1'de
eklemek birkac satirlik istir.

### 4.3 Boga karsilik verme - KARAR: V2'de, kendi fazinda (Faz 6)

Yaban hayvani -> birim hasari yolu V2'de acilir. Gerekce: bogayi gutmek gercek
bir risk olmadan "yavas inek"tir, ve acilan yol V3'un kurdunun **tam olarak**
ihtiyac duydugu yoldur. Kendi fazinda durdugu icin sikisirsa dusurulebilir.

### 4.4 Uretim alani - KARAR: `perAnimalPerMinute` + tur carpani

Agilin ekonomi bloğu `perWorkerPerMinute` yerine `perAnimalPerMinute` tasir
(§3.5). Tur farki `animals.json`'daki `pastureYield` carpanindadir (Inek 1.0,
Boga 1.6). Uretim = `perAnimalPerMinute * toplam(pastureYield)`.

Iki bilgi iki yerde durur ve her birinin tek anlami vardir: **bina** agilin ne
kadar iyi oldugunu, **tur** hayvanin ne kadar iyi oldugunu soyler. Bu,
`perWorkerPerMinute * isciSayisi` ile ayni sekildir.

### 4.5 Kapsam disi (V2'ye sizmayacaklar)

- Alpaca (V2.1)
- Yirtici baskisi, kurt/tilki (V3)
- Esek lojistigi (V4)
- Suvari / at / Cag 3 (yapilmayacak, V1 §12)
- Kesif kopegi (bagimsiz)
- Menzildeki hayvana manuel gudme emri (V2 sonrasi cila, §4.1)
- Evcil hayvani kesip ete cevirme (agilin "hasat" modu)
- Rakibin agilindaki hayvani calma/baskin
- Deri/yun gibi ikinci kaynak turu
- Hayvan basina tekil saglik/yas/uretkenlik simulasyonu

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/wildlife/pastureSystem.ts` | **Yeni.** Gudme isi + pen rosteri + cogalma. `WorkerConstructionSystem` deseni (§3.4) |
| `src/game/rts/wildlife/wildlifeRetaliation.ts` | **Yeni (Faz 6).** Tutulan hayvanin claim sahibine vurmasi; tek kural, hedef edinme yok |
| `src/game/rts/wildlife/wildlifeSystem.ts` | `owner` yazilabilir; `tame(animalId, owner, pen)`; `huntable` yalniz `wild`; `tameableAnimalsNear` |
| `src/game/rts/wildlife/wildlifeRoaming.ts` | Pen profili: kucuk cember, kacis yok; surulen hayvanin cobani takip etmesi |
| `src/game/rts/wildlife/wildlifeView.ts` | `isWildlifeVisible` owner farkindaligi: kendi hayvanin hep cizilir |
| `src/game/rts/economy/economyProductionSystem.ts` | Ucuncu uretim sekli: `requiresLivestock` dali, cikti pen nufusundan |
| `src/game/data/gameDataTypes.ts` | `EconomyProductionBalance`: `requiresLivestock`, `livestockCapacity`, `perAnimalPerMinute`; `AnimalBalanceStats`: `tameable`, `tameSeconds`, `pastureYield`, `breedSeconds`, `retaliation` |
| `src/game/data/validateGameData.ts` | `requiresGame` blokunun ikizi; `perWorkerPerMinute` agilda istege bagli; tur/agil capraz sartlari |
| `src/game/editorCatalog.ts` | Details panelinde yeni ekonomi alanlari; Faz 6'da hayvan tablosuna evcillestirme + `retaliation` alanlari |
| `src/game/rts/structures/placementGrid.ts` | `PlacementFailure` -> `"missing-livestock"` |
| `src/game/rts/structures/structureConstructionService.ts` | `StructureBuildFailure` -> `"missing-livestock"` |
| `src/game/rts/RtsApp.ts` | `PastureSystem` kurulumu + update sirasi; yerlestirme dali; sis yuklemi |
| `src/game/rts/ui/rtsBuildPalette.ts` | "Ekonomi" kategorisine `pasture`; `missing-livestock` gerekcesi |
| `src/game/rts/ui/rtsSelectionView.ts` | `"missing-livestock"` etiketi; agil panelinde pen sayaci |
| `src/game/rts/ai/aiBuildManager.ts` / `aiEconomyManager.ts` | Acilis sirasi + anchor (V1 Faz 6'daki gibi muhtemelen yalniz veri) |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/assets/ThreeAges/Animals/Cow.skeleton.json` | **Yeni.** Deer sablonunun kopyasi (§3.1) |
| `public/assets/ThreeAges/Animals/Bull.skeleton.json` | **Yeni.** Ayni sablon |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Cow.actor.json` | **Yeni.** `BP_RTS_Deer` deseni |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Bull.actor.json` | **Yeni.** |
| `public/assets/ThreeAges/Actors/Buildings/BP_RTS_Pasture.actor.json` | **Yeni.** Agil gorseli (kulube deseni) |
| `public/game-data/balance/animals.json` | `cow`, `bull` girdileri + mevcut turlere `tameable: false` |
| `public/game-data/balance/buildings.json` | `pasture` girdisi (§6.2) |
| `public/game-data/content/rts-content.json` | `animals` bolumune `cow`/`bull`; `buildings` bolumune `pasture` |
| `public/assets/ui/icons/building-pasture.svg` | **Yeni.** Palet ikonu |
| `public/game-data/balance/ai.json` | `buildingTargets`'a agil |
| `public/assets/ThreeAges/Levels/*.level.json` | Yabani sigir surusu + AI anchor'i |

### 5.3 Allowlist notu

V1 §5.3 kurali aynen gecerlidir: **hayvan verisi sidecar'a yazilmaz**,
`animals.json`'a yazilir. `Cow.skeleton.json` / `Bull.skeleton.json` yalnizca
mevcut `animationSet` semasini kullanir, yani `tools/saveValidator.ts`
degismez. `BP_RTS_Cow` / `BP_RTS_Pasture` generic actor yolundan gecer;
`LayoutPlacement` allowlist'ine dokunmaz.

## 6. Balans Verisi (oneri)

### 6.1 `animals.json` - yeni turler

| Alan | `cow` | `bull` | Gerekce |
| --- | --- | --- | --- |
| `label` | İnek | Boğa | |
| `meatCapacity` | 150 | 220 | Geyikten iri; avlamak da hala bir secenek |
| `maxHealth` | 60 | 100 | |
| `moveSpeed` | 5.5 | 6.0 | Isciden yavas/esit - sigir kacici degil |
| `walkClipSpeed` | 1.1 | 1.2 | §3.8 ayak kaymasi kurali |
| `fleeRadius` | 7 | 6 | Geyikten (9) daha az urkek |
| `fleeSeconds` | 1.2 | 1.0 | |
| `fleeRecoverySeconds` | 3.5 | 3.5 | Yakalanabilirlik: 6.6 < 21 ve 6.0 < 21 |
| `huntSeconds` | 7 | 11 | |
| `roamRadius` | 8 | 8 | Agil `gatherRadius` 16'nin altinda |
| `tameable` | true | true | |
| `tameSeconds` | 8 | 14 | Boga daha zor - riskin ilk yarisi |
| `pastureYield` | 1.0 | 1.6 | §4.4 tur carpani |
| `breedSeconds` | 90 | 130 | |

| `retaliation` | (yok) | `{ damage: 5, attacksPerMinute: 20 }` | §4.3, Faz 6 |

Mevcut `deer` / `stag`: `tameable: false`. Alan **zorunlu** olur (varsayilan
yok): "bu tur evcillesir mi" sorusu her tur icin bilincli cevaplanmalidir,
sessizce `false`'a dusmemeli. `retaliation` ise tersine **istege baglidir**:
yoklugu "bu hayvan boyun eger" demektir ve turlerin cogunun dogru cevabi budur.

Boganin sayilari: 3 saniyede bir 5 hasar, yani 14 saniyelik sakinlestirme
boyunca ~4 vurus = ~20-23 hasar. 60 canli bir isci icin bu yaklasik yarim coban;
bogayi almak gercek bir bedel odetir ama tek seferde oldurmez. Ikinci yari
zaten §6.1'de: boga daha yavas urer ve daha uzun sakinlesir.

### 6.2 `pasture`

Referans: Tarla 3 isci x 20/dk (60/dk, uc isci yer), maliyet 40 odun. Avci
kulubesi 3 isci x 30/dk, maliyet 60 odun, sonlu.

| | Yerlesim L1 | L2 | L3 | Kasaba L1 | L2 | L3 |
| --- | --- | --- | --- | --- | --- | --- |
| coban kapasitesi | 2 | 2 | 3 | 3 | 3 | 4 |
| pen kapasitesi | 4 | 5 | 6 | 8 | 10 | 12 |
| `perAnimalPerMinute` | 9 | 10 | 11 | 13 | 14 | 15 |
| yerel tampon | 40 | 50 | 70 | 90 | 110 | 130 |

Sabitler: `cost: { wood: 70 }`, `constructionSeconds: 30`, `footprint: 6x6`,
`visionRadius: 10`, `gatherRadius: 16`, `economy.resourceId: "food"`,
`economy.requiresLivestock: true`.

Denge mantigi: dolu bir Yerlesim L1 agili 4 inek x 9 = **36/dk, sifir isci**.
Ayni yiyecek tarladan 1.8 isci ister. Agil tarlayi gecmez, ama **isci
harcamaz** - takas budur. Bedeli onden odenir: dort inegi gudmek iki cobanin
birkac dakikasini alir ve o sure boyunca hicbir sey uretilmez.

`gatherRadius` uyarisi V1 §6.2 ile ayni: 16, `roamRadius` 8'in uzerinde kalir
(kacan hayvan menzilde kalir) ve `RTS_WORLD_HALF_EXTENT / 2`nin altindadir
(global havuz olusmaz). Ikisi de engine testiyle pinlenir.

### 6.3 `resources.json`'a dokunulmuyor

V1 §6.3 ile ayni gerekce: agil kapasitesini kendi tanimindan tasir, yatak
profiline ihtiyaci yoktur.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi

- [x] §4.1 gudme modeli: **A, agil kamp modeli** (2026-08-02).
- [x] §4.2 tur secimi: **Cow + Bull**, Alpaca V2.1'e (2026-08-02).
- [x] §4.3 boga karsilik verme: **V2'de, Faz 6** (2026-08-02).
- [x] §4.4 uretim alani: `perAnimalPerMinute` + `pastureYield` (2026-08-02).
- [x] §4.5 kapsam disi listesi yazildi.

**Faz 0 tamamlandi (2026-08-02).**

### Faz 1 - Varlik ve veri (oynanis yok)

Amac: Inek ve boganin dogru klipleri oynatmasi ve veri tablolarinda var olmasi.

- [x] `Cow.skeleton.json` / `Bull.skeleton.json` - `Deer.skeleton.json`'in
  **birebir** kopyasi. §3.1 olculdugu icin bu bir varsayim degil: iki modelin
  klip adlari kelimesi kelimesine ayni.
- [x] `BP_RTS_Cow.actor.json` / `BP_RTS_Bull.actor.json` (`BP_RTS_Deer` deseni).
  Olcek **turetilmis varsayim**: Cow `0.22` (Stag ile ayni), Bull `0.24` (ayni
  rig, en iri tur). `selectionRadius` 0.7 / 0.8. Kullanici editorde duzeltebilir;
  olcegin yeri `props.scale`'dir ve suru spawn'i onu okur (V1 Faz 1).
- [x] `animals.json`: `cow` + `bull` girdileri (§6.1 tablosu birebir); mevcut iki
  ture `tameable: false`.
- [x] `gameDataTypes` + `validateGameData`: `tameable` **zorunlu** boolean;
  `tameSeconds` / `pastureYield` / `breedSeconds` yalniz `tameable` turlerde
  zorunlu ve > 0, ve evcillesmeyen bir turde **tasinmasi reddedilir** (sessizce
  yok sayilmaz).
- [x] `rts-content.json` `animals` bolumune `cow` / `bull` actorRef'leri. Bu
  Faz 1'de zorunluydu, ertelenemezdi: mevcut test her turun bir Actor cozmesini
  sart kosuyor ("species ... resolves to an Actor").
- [x] Klip varligi testi kendiliginden kapsadi: `Animals/` altindaki her
  sidecar'i tarayan V1 testi iki yeni dosyayi da dogruladi.

**Yakalanabilirlik olculdu, tahmin edilmedi.** `validateAnimalBalance` her tur
icin `moveSpeed * fleeSeconds < 6 * fleeRecoverySeconds` ister (§3.8). Inek
6.6 < 21, boga 6.0 < 21 - ikisi de rahat gecer; sigir zaten geyikten daha az
kaciciydi, yani bu sart tasarimi kisitlamadi.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1217 check),
  `npm run build:verify` (`verify:dist --strict` dahil) ve
  `npm run check:assets` yesil. Yeni dosyalar `check:assets`'te Deer/Stag ile
  **birebir ayni uyari profilinde** (sidecar ve yaban hayati Actor'leri
  manifest'e kayitli degildir, yol/konvansiyondan cozulur).
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici Skeletal Mesh Editor'de
  dogruladi: Cow ve Bull kliplerini oynuyor ve rol eslemeleri dogru. V1 §3.7
  geregi klip oynatimini dogrulayan tek yer orasidir (viewport'a birakilan
  karakter sidecar'i degil ham klip adini kullanir), ve CLAUDE.md kurali geregi
  bunun icin otomatik kani uretilmedi.

**Faz 1 tamamlandi (2026-08-02).**

### Faz 2 - Yabani sigir haritada (oynanis yok)

Amac: Sigirin `?rts` rotasinda gorunmesi ve otlamasi. Evcillestirme yoktur.

- [x] `RTS_BLOCKOUT_MAP.herds` + **iki Level'a da** uc yeni suru (V1 Faz 2 dersi:
  yalniz blockout'a eklenen suru kimsenin oynamadigi haritada otlar).
- [x] Konumlar cekismeli: `player-cattle` (-18,14) ve `enemy-cattle` (18,-14)
  dorder inek, `central-bull` (0,-16) uc boga. Ucu de her iki baslangicin
  kontrol yaricapinin (28) disinda - en yakini 31.2, yani "biraz genislersen
  senin olur, asla bedava degil".
- [x] Mevcut Level testi iki yonlu kaldi; uzerine V2 sozlesmesi eklendi (§8).

**Konum secimi olcumle yapildi, uc kisit ayni anda saglandi.**

1. **Cekisme.** Her sigir surusu iki baslangic yaricapinin da disinda.
2. **Adalet cift halinde kurulur.** Tam esit uzaklikta olan noktalarin hepsi
   `x = z` kosegeni uzerindedir (cikarildi: `|P-A| = |P-B|` -> `a = b`) - ve o
   kosegen `RTS_GameplayProof`'un **nehri**dir (blocker'lar (-13.5,-18.4),
   (-7.2,-10.7), (0.2,2.4), (5.2,11) hattinda olculdu). V1 §7'nin "esit uzaklik
   ancak (16,16) gibi kosegen bir noktada saglanir ve orasi nehir riski tasir"
   notu boylece dogrulandi. Cozum: her suruyu **merkez etrafinda bir baskasiyla
   eslemek**. Geyik geyige, sigir sigira, ve **boga geyige** - `central-bull`
   (0,-16), `central-stag` (0,16)'nin aynasidir. Sonuc: iki kralligin gordugu
   yuruyus mesafeleri kumesi **birebir ayni** (17.9 / 31.2 / 43.9 / 66.0 / 76.4
   / 90.7). Bu, V1 §7'nin "merkez odul esit uzaklikta degil" bulgusunu da
   kapatir - stag'in oyuncuya yakinligini artik boga dusman tarafinda
   dengeliyor.
3. **Ridge temizligi.** Her suru merkezi, orta ridge blocker'ina (x ∈ [-12,12],
   z ∈ [-4,4]) kendi `roamRadius`'undan uzak: sigir 11.7, boga 12 - hayvanlar
   nav ajani olmadigi icin ridge'e cikan bir suru geri itilemezdi (V1 Faz 2).

**Olculen ve kayda gecen bulgu - `RTS_GameplayProof`'un baslangiclari simetrik
degil.** Oyuncu (-40,40), dusman (38,-38). Iki birimlik bu kaymanin yaban
hayatiyla ilgisi yok, ama "iki kralligin yuruyus kumesi ayni" sozlesmesini o
Level'da olanaksiz kiliyor. Bu yuzden sozlesme **blockout'a** karsi pinlendi -
duzenin tasarlandigi ve baslangiclarin yapisi geregi simetrik oldugu yer orasi.
Level'lar icin pinlenen sey daha zayif ama dogru: sigir vardir ve **hicbiri
bedava degildir**. Baslangiclari esitlemek harita dengesi isidir, bu planin
kapsami disi (V1 §7).

Sahnedeki hayvan sayisi 14'ten **25**'e cikti (V1 §9 performans riski). Sayilar
kasitli olarak kucuk tutuldu (4+4+3); gorsel kabulde takilirsa ilk dusurulecek
yer bu sayilardir, tur listesi degil.

Kabul:

- [x] `npx tsc --noEmit`, `npm run test:engine` (1218 check),
  `npm run build:verify` ve `npm run check:assets` yesil.
- [x] Adalet sozlesmesi pinlendi: "V2 Faz 2: the authored herd layout offers both
  kingdoms the same walks to game". Testin kirmiziya donebildigi dogrulandi
  (`enemy-cattle` gecici olarak x=22'ye tasinip suite "31.2 vs 28.8" ile kirildi,
  sonra geri alindi).
- [x] **Gorsel kabul alindi (2026-08-02).** Kullanici `?rts` rotasinda dogruladi:
  sigir ve boga dogru boyutta gorunuyor, dolasip otluyor ve zemine oturuyor.
  Turetilmis olcek varsayimlari (Cow `0.22`, Bull `0.24`) ve `walkClipSpeed`
  ayarlari (1.1 / 1.2) **oldugu gibi kabul edildi** - duzeltme istenmedi, yani
  §3.8'in ayak kaymasi denklemi bu iki tur icin de tutuyor. 25 hayvanlik sahnede
  performans sikayeti cikmadi, yani suru sayilarini (4+4+3) dusurme geri cekilme
  yoluna gerek kalmadi.

**Faz 2 tamamlandi (2026-08-02).** V2 hedefi acisindan durum: yabani sigir
haritada yasiyor ve avlanabiliyor, ama henuz evcillestirilemiyor. Sirada Faz 3.

### Faz 3 - Agil binasi ve yerlestirme kurali

- [x] `buildings.json` -> `pasture` (§6.2 tablosu, alti kademe). Sabitler
  birebir; `maxHealth` planda yoktu, Avci Kulubesi profili alindi (100-120 /
  130-150).
- [x] `requiresLivestock` / `livestockCapacity` / `perAnimalPerMinute`:
  `gameDataTypes`, `validateGameData` (`requiresGame` blokunun ikizi),
  kademe matrisi, editor Details alani (taban + iki cag tier'i).
- [x] `perWorkerPerMinute` agilda istege bagli (§3.5) - hem taban hem kademe
  dogrulamasinda. Ikizi de kondu: `livestockCapacity` / `perAnimalPerMinute`
  agil olmayan binada **reddedilir**, sessizce dusurulmez.
- [x] `PlacementFailure` / `StructureBuildFailure` -> `"missing-livestock"`.
- [x] `RtsApp.additionalPlacementFailure` dorduncu dal:
  `wildlife.tameableAnimalsNear(...)` bos ise `missing-livestock`. **Yalniz
  yasayan ve yabani** hayvan sayilir - `owner === "wild"` suzgeci bugun
  tautoloji, Faz 4'te sahiplik yazilabilir olunca calismaya baslar.
- [x] Build paleti (Ekonomi kategorisi, Avci Kulubesi'nin yaninda), ikon
  (`building-pasture.svg`), `rtsSelectionView` etiketi ("Yakinda evcil hayvan
  yok"), `BP_RTS_Pasture.actor.json` + manifest kaydi + `rts-content.json`.
- [x] `EconomyProductionStatus` -> `"missing-livestock"`; `requirementFor`'a
  **dordoncu dal degil**, ayri bir uretim sekli dali (§3.5). Bina kurulur,
  dogru gerekceyle bos durur; Faz 4 ona pen verir.

**Planda yazmayan, uygulamanin cikardigi uc sey.**

1. **§8'in "agil kendiliginden girer" varsayimi yanlisti.** Yerellik testinin
   dongusu `requiresGame || requiresForest || requiresResourceNode` suzuyor;
   agil bunlarin hicbirini tasimaz, yani teste **elle** eklenmesi gerekti. Simdi
   dorduncu bayrak da suzgecte.
2. **Ekonomi dongusu agila isci almayi da reddetmeli.** Yalniz "uretme" dalini
   ayirmak yetmiyordu: `assignWorker` agila da isci atayabiliyordu, yani agilin
   `workerCapacity`'si - ki o **coban butcesi** - kapida bekleyen isciyle
   dolabiliyordu ve Faz 4'e coban kalmiyordu. Otomatik ve manuel atama, ikisi de
   `requiresLivestock` binada kapali; testle pinlendi.
3. **`requiresLivestock` uc toplayici bayrakla birlikte kullanilamaz.** §3.4'un
   olcumu tam olarak bu: iki uretim seklini ayni binada acmak, evcil inegi
   `localBuffer` uzerinden ete cevirmenin yolu. Validator artik dosya ve alan
   adiyla reddediyor.

Ayrica `perWorkerPerMinute` istege bagli olunca iki TS noktasi acikta kaldi:
toplama dongusunun giris kontrolu (alan yoksa artik `missingStatus` dondurur) ve
yenilenebilir dal (agil oraya hic ulasmaz, cunku ustte donuyor).

Kabul:

- [x] `npx tsc --noEmit`, `npm run verify:imports`, `vite build`,
  `verify:dist --strict` ve `npm run check:assets` yesil (0 hata; yeni Actor
  Avci Kulubesi ile **birebir ayni uyari profilinde**: yalniz thumbnail uyarisi).
- [x] Dort yeni engine testi gecti: veri sekli, validator sozlesmesi,
  yerlestirme (sigirin yaninda `valid`, uzaginda ve **geyik surusunun icinde**
  `missing-livestock`), ve bos penli agil (`missing-livestock`, sifir isci,
  `producerHasSource` false).
- [ ] `npm run test:engine` **suite olarak kirmizi**, ama Faz 3'ten degil: HEAD
  (`797f84f0`, birim maliyet ayari) `guard_placeholder.cost.wood`'u 0 yapmis ve
  "wood contributes to military production" iddiasi o yuzden dusuyor. Testin
  gectigi yer Faz 3'un tum kontrollerinden **sonra**. Karar kullanicinin: ya
  muhafiz yeniden odun yer, ya da iddia "bir askeri birim odun yer" seviyesine
  cekilir (okcu 10, kusatma 40 zaten odiyor).
- [x] **Gorsel kabul alindi (2026-08-03).** Kullanici `?rts` rotasinda dogruladi:
  Ekonomi kategorisinde Agil cikiyor, sigirin yaninda ghost gecerli, uzaginda
  gerekceli kirmizi; kurulan agil bos peniyle "Yakinda evcil hayvan yok" diyor.
  Yer tutucu model (`houses-firstage-2-level1`) oldugu gibi kabul edildi.

**Faz 3 tamamlandi (2026-08-03).**

### Faz 4 - Sahiplik ve gudme dongusu

- [x] `WildlifeAnimal.owner` yazilabilir; `huntable()` yalniz `wild` (§3.7).
  Yerlestirme tarafi da kapatildi: `huntableAnimalsNear` eklendi, cunku dolu bir
  penin yanina kurulan avci kulubesi aksi halde **gecerli** olup hemen
  `source-depleted` diyordu.
- [x] `PastureSystem`: bos isci cekme, `moving-to-animal -> calming -> driving ->
  penned` durum makinesi (`WorkerConstructionSystem` deseni).
- [x] Sakinlestirme `tameSeconds` surer; coban `work` pozunda durur
  (`setWorking`), hayvan **acikca** tutulur (`lead.follow = false`) -
  `CAUGHT_DISTANCE`'a guvenmek yetmiyordu (V1 Faz 5 dersi).
- [x] **Surulen hayvan nav grid'e hic sormaz**: cobanin *konumunu* takip eder,
  coban ise navigasyonla yol alir.
- [x] Agila varinca `tame()`: `owner` degisir, roam profili agil merkezli kucuk
  **halkaya** doner, kacis kapanir.
- [x] Sis: kendi hayvanin her zaman cizilir; rakibin hayvani hareket eden seyin
  kuralina uyar (`isWildlifeVisible` owner farkindaligi).
- [x] Coban olur/serbest birakilirsa rezervasyon ve surulen hayvan birakilir;
  hayvan yabani kalir ve yeniden avlanabilir/gudulebilir.
- [x] Ek: agil paneli artik "Cobanlar: n/N" ve "Agil: n/N hayvan" gosteriyor.
  Agilda "Isciler: 0/2" hem dogru hem ise yaramazdi.

**Planda yazmayan, uygulamanin cikardigi dort sey.**

1. **Pen bir daire degil, bir halka olmali.** Duz daire uniform alanla
   ornekleniyor, yani hayvanlarin bir kismi binanin *icinde* otluyor. Pen artik
   `roamInnerRadius` (binanin yari-kosegeni) ile `+3` arasinda bir halka ve
   geometri footprint'ten **turetiliyor**, ayarlanmiyor.
2. **Halka, yurume adiminin da kelepcelenmesini gerektirdi.** Hedef halkanin
   icinde olsa bile iki nokta arasindaki duz cizgi delikten - yani ahirin
   ustunden - geciyordu. `keepInHerdGround` artik yuruyuse de uygulaniyor (yabani
   surude no-op: disbukey dairede iki uc zaten icerde) ve hiz **gercekte alinan
   yoldan** hesaplaniyor. Testi kirmiziya donduren sey tam olarak buydu (3.63 <
   4.24).
3. **Surulen hayvan `walkClipSpeed` ile yurur, coban onden gider ve bekler.**
   Tasma (leash) denenmedi bile: inek 1.1 br/s, isci ~4-6 br/s, yani coban her
   birkac adimda duracak ve gudme bir titremeye donusecekti. Daha onemlisi
   herhangi bir yuksek hiz ya oynatma hizini kirpip ayaklari kaydirir ya da
   hayvani **dortnala** klibine atar. Bu yuzden varis **hayvanin** konumundan
   olculuyor, cobanin degil.
4. **Otomatik insaat kurtarmasi cobani calamaz.** `WorkerConstructionSystem`
   kilitlenmeyi acmak icin toplayici isci kapabiliyor; ayni sey cobana yapilirsa
   sakinlestirilmis hayvan tarlanin ortasinda kalirdi. Manuel (oyuncunun adiyla
   istedigi) emir hala cobani alir.

Kabul:

- [x] `npx tsc --noEmit`, `verify:imports`, `vite build`, `verify:dist --strict`,
  `check:assets` (0 hata) yesil.
- [x] Dort yeni engine testi: uctan uca gudme (§2'nin 3-6 adimlari; uc durumun
  da kostugu, pen kapasitesinde durdugu, hayvanin **avluda** - ahirda degil -
  otladigi), sahiplik (avci kulubesinin sayimindan tam kendi degeri kadar
  dusuyor, hicbir avci claim edemiyor, nufus saymiyor), coban olumu, ve sis.
- [x] `npm run test:engine`: **1230 check gecti** (suite bastan sona kosuyor).
- [x] **Gorsel kabul alindi (2026-08-03).** Kullanici dogruladi: coban hayvani
  kovaliyor, sakinlestiriyor, agila suruyor; pen dolunca cobanlar ayriliyor ve
  dort hayvan agilda kaliyor.

**Faz 4 tamamlandi (2026-08-03).**

**Faz 3'ten devreden engel kapatildi (kullanici karari, 2026-08-03).** HEAD'deki
`797f84f0` `guard_placeholder.cost.wood`'u 0 yapmisti ve "wood contributes to
military production" iddiasi tek bir birim id'sini pinledigi icin kirmiziya
donmustu - suite orada duruyor, sonraki ~230 kontrol hic kosmuyordu. Iddia
CLAUDE.md'nin balans kuralina uygun sekilde **genellestirildi**: odun asker
alir, ama illa *o* askeri degil (okcu 10, kusatma 40 zaten odiyor). Veri
degistirilmedi.

### Faz 5 - Agil uretimi ve cogalma

- [x] Ucuncu uretim sekli: cikti `perAnimalPerMinute * toplam(pastureYield)`,
  **isci sayisindan bagimsiz**. `EconomyProductionSystem` pen'i tanimaz; tek bir
  sayi sorar (`livestockYield` closure'i), yani gudme/sakinlestirme/sahiplik bu
  dongude hic gorunmez.
- [x] Et yol/depo zincirine akar (`localBuffer` + `withdrawBuffered`), agila ozel
  yol yoktur - `ProductionLogisticsSystem` zaten `economy` tasiyan her tamamlanmis
  yapiyi tariyor, yani agil kendiliginden girdi. Toplanmayan agil **tamponunu
  doldurup durur**, tarlanin geri-basincinin aynisi.
- [x] Cogalma: pen bos degilse `breedSeconds` dolunca +1 hayvan,
  `livestockCapacity` ile sinirli.
- [x] Pen doluyken cobanlar serbest birakilir (isciler bos beklemez).
- [x] Agil yikilirsa penindeki hayvanlar **yabaniye doner** (kaybolmaz):
  durduklari yeri merkez alan yeni bir yabani cember alirlar, yeniden avlanabilir
  ve yeniden gudulebilir olurlar.
- [x] Validator: `livestockCapacity` pozitif tamsayi ve `perAnimalPerMinute` > 0
  (Faz 3'te kondu); cogalmanin kapasiteyi asamamasi kod invaryanti, testle
  pinlendi.

**Planda yazmayan iki karar.**

1. **Cogalma tur basina isler.** `breedSeconds` tur tablosunda, yani tek bir
   ortak sayac iki turun ortalamasini almak zorunda kalirdi - hicbir tabloda
   olmayan bir sayi. Her pen, icindeki her tur icin ayri bir gebelik sayaci
   tutar; inek inek dogurur, boga boga. Bu ayni zamanda §4.4'un tur carpanini
   durust tutar: boga daha verimlidir ve daha yavas urer.
2. **Kapasite tavani "taahhut" uzerinden.** Sinir yalniz pendekiler degil,
   pendekiler **arti yolda olanlar**. Yalniz peni saymak, tarlanin yarisini
   gecmis bir gudmenin altindan son slotu cekerdi. Ucu de kapali: ise alim,
   dogum, ve pen'e sokma ani.

Kabul:

- [x] Gateler yesil; `npm run test:engine` **1233 check**.
- [x] Turetim testi: uretim `perAnimalPerMinute` ve `pastureYield`'den
  **hesaplanarak** dogrulaniyor (iki dakikalik banka, %2 tolerans), sifir isciyle.
- [x] Cogalma testi: iki hayvanla dolan pen kapasitede duruyor ve aradaki fark
  **dogumdan** geliyor (haritadaki toplam hayvan sayisi artiyor); bos pen hic
  uremiyor.
- [x] Yikim testi: agil yikilinca hayvanlar yok olmuyor, yabaniye donuyor ve
  `huntableAnimalsNear` onlari yeniden av olarak sayiyor.
- [x] **Gorsel kabul alindi (2026-08-03).** Kullanici `?rts` rotasinda dogruladi:
  agil penindeki hayvanlardan yiyecek uretiyor, sifir isciyle, ve uretim
  yol/depo zinciriyle merkeze akiyor.

**Faz 5 tamamlandi (2026-08-03).**

### Faz 6 - Boga karsilik verir

- [x] `animals.json` `retaliation: { damage, attacksPerMinute }` - yalniz boga
  (5 hasar, dakikada 20 vurus). Alan **istege bagli** ve `tameable`'dan
  bagimsiz: karsilik vermek bir evcillesme ozelligi degil, bir mizactir, ve
  V3'un yirticisi ayni blogu hic gudulemez oldugu halde isteyecek.
- [x] Sakinlestirilirken/avlanirken boga **rezerve eden isciye** hasar verir.
  Hedef edinme yok - iki yolun ikisinde de `reservedByWorkerId` zaten tam olarak
  "eli bu hayvanda olan isci"dir.
- [x] Sunumda `attacking` -> rol zinciri `attack`, `strikeCount` -> her vurusta
  bir `Attack_Headbutt`. Sidecar zaten `attack: "Attack_Headbutt"` tasiyordu
  (Faz 1'de Deer sablonundan geldi), yani varlik tarafinda is cikmadi.
- [x] Olen coban rezervasyonu birakir; agil isi yeni cobanla surer - Faz 4'un
  `dropInvalidAssignments` yolu, yeni bir yonden gelinerek testle pinlendi.
- [x] V1 §3.9 dogrulamasi asagida (**olculdu**).

**Yeni dosya: `src/game/rts/wildlife/wildlifeRetaliation.ts`.** Ne
`WildlifeSystem`'in ne de `PastureSystem`'in icine konabilirdi: ilki `Unit`
tanimaz, ikincisi **avi** tanimaz - vuruslarin yarisi avlanirken duser. Uc
sistemin de bildigi tek sey ortak: claim register.

**Planda yazmayan uc sey.**

1. **"Karsilik verir" degil, "hala tutulurken karsilik verir".** Dort kosul
   birden gerekti: **yasiyor ve hala yabani** (kesilmis govde vurmaz; evcil boga
   sahibini omur boyu suslemez), **claim'li**, **halde surulmuyor**
   (`lead.follow` sakinlestirmenin bittigi andir - yenilmis hayvan dovusmez), ve
   **`CAUGHT_DISTANCE` icinde**. Sonuncusu sart, cunku claim **menzili kasitli
   olarak asar** (V1 dersi: kovalamayi sonsuza kadar bastan baslatmamak icin) -
   yani temasi soyleyen sey claim degil, mesafedir.
2. **Vurus dongusu, tick basina tek vurus degil.** 8x oyun hizinda tek adim iki
   araligi kapsayabiliyor; oyun hizlandikca daha az vuran bir boga, kimsenin
   secmedigi bir zorluk ayari olurdu.
3. **Isci karsilik vermez, ve bu bir eksiklik degil olcum.** `retaliateAgainstAttack`
   **`Unit` tipinde bir saldirgan** ister ve yalnizca `resolveCombatHit`
   cagirir; hayvan ise `CombatTarget`'tir, `Unit` degildir. Dolayisiyla hicbir
   yaban vurusu `unitCombat.ts:60`'in aradigi `autoAcquired` bayragini
   kuramaz. Coban durur ve yer - §4.3'un istedigi tam olarak bu: risk boganin
   fiyatidir, isci-yaban savasinin acilisi degil. Testle pinlendi.

**Validator kasitli olarak susuyor - ve gerekcesi CLAUDE.md kurali.** Ilk
yazilan hali `damage x attacksPerMinute x tameSeconds < isci cani` sartini
kosuyordu ("her cobani olduren boga, verinin evcillesir dedigi ama oyunun asla
evcillestiremedigi turdur"). Geri alindi, cunku olculdu: bu carpim uniform
olcekte **s³** buyuyor, yani §8'in olcek supurgesini s≈1.63'ten s≈1.29'a
sikistiriyordu - tablodaki sayilari oynatmayi zorlastiran bir kontrol. Ustelik
§3.8'in "asla yakalanamaz" kuralindan farkli olarak gizli degil: her cobani
olduren bir boga, oyuncunun **ekranda izledigi** bir seydir, kirik yol bulma
gibi gorunen bir sey degil. Doğrulayici bu yuzden yalnizca **sekli** reddediyor:
blok varsa `damage > 0` ve `attacksPerMinute > 0`.

Kabul:

- [x] `npx tsc --noEmit`, `npm run verify:imports`, `vite build`,
  `verify:dist --strict`, `npm run check:assets` (0 hata) yesil.
- [x] `npm run test:engine`: **1237 check gecti.**
- [x] Iki yeni engine testi: gudulen boga cobani yaralar / inek yaralamaz
  (yara **tablodan hesaplanarak** dogrulanir: dusen vurus x `damage`), vuruslar
  yalniz `calming` sirasinda duser, evcil ya da surulen boga vurmaz, coban
  hicbir sey hedef almaz; ve boga cobani oldurunce kendini kurtarir, agil bir
  sonrakini yollar.
- [x] Testlerin kirmiziya donebildigi dogrulandi (uc ayri falsifikasyon:
  karsilik dali kapatildi, `lead.follow` suzgeci kaldirildi, `owner` suzgeci
  kaldirildi - ucu de ayri bir iddiayi dusurdu).
- [x] **Ayar bagimsizligi olculdu**, pinlenmedigi kanitlandi: `retaliation`
  `{1, 6}`'dan `{11, 37}`'ye (~10x yayilim) degistirilip suite uc kez kosuldu,
  ucunde de 1237 yesil. Oldurucu ayarda bile testler gecer, cunku "boga
  evcillestirilebilir" gibi bir ayar iddiasi tasimiyorlar.
- [x] **Gorsel kabul alindi (2026-08-03).** Kullanici dogruladi: boga
  sakinlestirilirken cobana vuruyor ve `Attack_Headbutt` oynuyor; coban duruyor,
  hasari yiyor ve karsilik vermiyor. Inekte hicbiri olmuyor. Ayar
  (5 hasar / dakikada 20 vurus) **oldugu gibi kabul edildi** - boga ilk cobanini
  oldurmuyor ama gorunur bir bedel odetiyor, yani §4.3'un "risk" tanimi tutuyor.

**Faz 6 tamamlandi (2026-08-03).**

### Faz 7 - AI uyumu, seviye icerigi ve kabul maci

- [x] `ai.json` `buildingTargets`: `pasture: 1` (hem Yerlesim hem Kasaba).
- [x] AI agil kurar. V1 Faz 6 dersi **yarim tuttu**: veri yetmedi, harita isi
  cikti (asagida). `buildOrder`'a tek satir kondu - avci kulubesinin yanina.
- [x] Agille beslenen AI ac sanilmaz. Bu gercekten bedavaydi:
  `resourceProducerCounts` `resourceId` okuyor ve `missing-livestock` zaten Faz
  3'te sourceless statuler arasina konmustu, yani AI'a tek kural yazilmadi.
  Avcilik testinin **ikizi** olarak pinlendi.
- [x] Harita: agil anchor'i + yol mahmuzu, blockout ve **iki Level'da da**
  (`RTS_CoreMatch` parite testiyle zorunlu, `RTS_GameplayProof` oyunun kostugu
  yer oldugu icin).
- [x] Tam mac: sigir surusu icin yaris, gudme, kalici gelir, tarlaya gerek
  kalmadan kasabaya gecis. **Kullanici gorsel kabulu verildi (2026-08-03).**

**Olculen bulgu 1 - agil, haritanin en dar yuvasi.** Uc kisit ayni anda
saglanmali: sigirin **tum** dolasma cemberi agilin 16 birimlik menzilinde
(yoksa pen yarida hiring'i keser), 6x6 ayak izinin **her hucresi** 28 birimlik
acilis kontrolunde (yoksa `outside-control`), ve komsu yuvalarla cakisma yok.
Cift sayili izgara taranarak olculdu: **tek bir hucre** gecer - `(22,-20)`,
0.79 birim payla. Bu darlik tasarimin kendisi: Faz 2 sigiri kasitli olarak
acilis yaricapinin **disina** koydu ("biraz genislersen senin olur"), yani agil
tanim geregi kralligin sinirindaki binadir. Oyuncu `(-22,20)`'de aynanin
aynisiyla karsilasir - yarisi adil yapan sey bu. Pay artik iki tablodan
**hesaplanan** bir testle korunuyor: `gatherRadius` 16'dan 15'e cekilince suite
"7.2 + roam 8 > 15" diyerek kiriliyor.

**Olculen bulgu 2 - yol mahmuzu icin tek koridor var.** z = -26 hattinda yuvalar
x = 23'ten (avci kulubesi) x = 47'ye (altin) kadar **kesintisiz duvar**: kulube,
tas ocagi, depo, altin yan yana. Yol hucresi ayak izine giremeyecegi icin
spine'dan kuzeye tek cikis kulubenin bati kenarindan, x = 22'den. Olculdu: 5 yeni
hucre, 20 odun, hicbir ayak iziyle cakisma yok, mevcut hicbir ureticinin yol
temasi degismiyor. Agil bu mahmuzun `(22,-24)` hucresine degiyor.

**Olculen bulgu 3 - AI cobani "bos isci" saniyordu.** `RtsApp`'te "bu isciyi
baskasi kullaniyor mu" sorusunun **dort** okuyucusu var; ucu (insaat, ekonomi,
agilin kendisi) Faz 4'te ogrendi, dorduncusu - AI blackboard'unun `isWorkerBusy`
closure'i - atlanmisti. Sonucu somut: `§19 IdleWorkerCount` `no-available-worker`
darbogazini besliyor, yani tum ekibi sigir gudmekte olan bir kralligi "tam
kadrolu" okuyup gudmenin maliyeti olan isciyi uretmeyi birakirdi. Duzeltildi;
`aiTestWorld` harness'i da ayni sekilde geride kalmisti ve RtsApp paritesine
cekildi (agil sistemi, `requiresLivestock` yerlestirme dali, `pennedYield`, ve
`requiresGame`'in `huntableAnimalsNear`'a gecmesi - sonuncusu Faz 4'ten kalan
bir kayma).

**Planda yazmayan karar - `buildOrder`'da adi geciyor.** §7 "muhtemelen yalniz
veri" diyordu; hedeflere eklemek fiilen yetiyordu (yedek dongu onu zaten hemen
hemen ayni yere koyuyordu), ama sirasinin **kaza eseri** belirlenmesi
istenmedi. Agil avci kulubesinin yanina kondu, gerekcesi kulubeninkinin daha
keskin hali: suru yalnizca kuculur, ve sigir bunun rakibin **kalici** olarak
alabildigi yarisidir - gec kurulan kulube daha kucuk bir kulubedir, gec kurulan
agil **hicbir seyin uzerine** kurulmus agildir.

Kabul:

- [x] `npx tsc --noEmit`, `verify:imports`, `vite build`, `verify:dist --strict`,
  `check:assets` (0 hata) yesil.
- [x] `npm run test:engine`: **1240 check gecti.**
- [x] Uc yeni engine testi: aclik teshisi (dolu pen besler, bos pen besleyemez ve
  tamir olarak tarlaya duser), anchor sozlesmesi (evcillestirilebilir surunun tum
  cemberi menzilde, ayak izinin her hucresi kontrol icinde, yol spine'ina degiyor,
  ve hicbir yol hucresi bir ayak izine girmiyor), ve **uctan uca AI maci**: AI
  agili authored anchor'a kuruyor, cobanlari sigiri surup peni dolduruyor,
  **sifir isciyle** yiyecek uretiyor ve uretim tampona degil kralliga ulasiyor.

## 8. Test ve Gate

CLAUDE.md kurali: **ayar degil sozlesme**. Hicbir test bir buyuklugu pinlemez.

- [x] **Klip varligi (Faz 1):** mevcut sidecar testi Cow/Bull'u kendiliginden
  kapsadi - `Animals/` altindaki her sidecar taraniyor.
- [x] **Veri sozlesmesi (Faz 1):** `tameable` her turden zorunlu; eksik/sifir
  taming alani ve evcillesmeyen turde tasinan taming alani dosya ve alan adiyla
  reddedilir.
- [x] **Harita adaleti (Faz 2):** iki kralligin gordugu yuruyus mesafeleri kumesi
  ayni; her sigir surusu iki baslangic yaricapinin da disinda. Mesafeler
  hesaplanir, pinlenmez.
- [x] **Menzil (Faz 3):** her evcillestirilebilir tur icin `roamRadius < pasture
  gatherRadius`, iki tablodan hesaplanarak.
- [x] **Yerellik (Faz 3):** agil `gatherRadius` < `RTS_WORLD_HALF_EXTENT / 2`.
  Mevcut testin dongusune **elle eklendi**: suzgec yalniz uc toplayici bayragi
  taniyordu (Faz 3 notu).
- [x] **Yerlestirme (Faz 3):** sigirin yaninda `valid`; sururun uzaginda ve
  geyik surusunun icinde `missing-livestock`.
- [x] **Bos pen (Faz 3):** tamamlanmis agil `missing-livestock` der, hicbir isci
  almaz (otomatik veya emirle), `producerHasSource` false doner.
- [x] **Nufus (Faz 4):** evcil hayvan da nufus saymaz (V1 testinin devami).
- [x] **Sahiplik (Faz 4):** evcillestirilen hayvan avci kulubesinin
  `remainingNear` sayimindan **tam kendi degeri kadar** cikar; hicbir avci onu
  claim edemez; `huntableAnimalsNear` yalniz yabani doner.
- [x] **Turetim (Faz 5):** agilin dakikalik ciktisi `perAnimalPerMinute` ve
  `pastureYield`'den **hesaplanarak** dogrulanir.
- [x] **Cogalma (Faz 5):** pen kapasitesini asmaz; bos pen cogalmaz.
- [x] **Sis (Faz 4):** kendi evcil hayvanin kesfedilmemis alanda bile cizilir;
  rakibin hayvani gorunmuyorsa cizilmez.
- [x] **Yikim (Faz 5):** agil yikilinca hayvanlar yabaniye doner ve yeniden
  avlanabilir.
- [x] **AI anchor'i (Faz 7):** agil yuvasi evcillestirilebilir surunun tum
  cemberini kapsar, her ayak izi hucresi acilis kontrolunde kalir, yol spine'ina
  deger, ve hicbir yol hucresi bir ayak izine girmez - hepsi tablolardan
  **hesaplanarak**.
- [x] **AI ekonomisi (Faz 7):** dolu pen kralligi besler, bos pen besleyemez ve
  tamir olarak tarlaya duser; uctan uca macta AI agili kurup peni doldurur ve
  sifir isciyle uretip merkeze aktarir.
- [x] **Boga (Faz 6):** gudulen boga cobanin canini azaltir, inek azaltmaz; yara
  `retaliation`'dan **hesaplanarak** dogrulanir, buyukluk pinlenmez.
- [x] **Karsilik sinirlari (Faz 6):** vurus yalniz sakinlestirme sirasinda duser
  - surulen, penlenmis ya da temastan cikmis hayvan vurmaz - ve vurulan isci
  hicbir sey hedef almaz (V1 §3.9).
- [x] **Validator:** `tameable` turde eksik `tameSeconds`/`pastureYield`,
  sifir/negatif `livestockCapacity`, yakalanamaz kacis ayari, ve sifir
  `retaliation.damage`/`attacksPerMinute` dosya ve alan adiyla reddedilir.
  Vurusun **ne kadar sert** oldugu kasitli olarak reddedilmez (Faz 6 notu).

Kapi: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
`npm run check:assets`. Olcek testi: `animals.json` ve `buildings.json`'daki her
buyukluk olceklenip suite yeniden kosulur; **yesil kalmalidir**.

Gorsel kabul kullanicidadir; otomatik kani uretilmez (CLAUDE.md).

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Gudme, toplama dongusune zorlanirsa evcil hayvan yiyecek olarak depoya gonderilir** (§3.4). | Gudme bir **is**tir; `PastureSystem` `WorkerConstructionSystem` desenini izler, `ResourceSource` degildir. |
| **Ucuncu uretim sekli `EconomyProductionSystem`'i sisirir.** | Dal tek bir `updateLivestockProducer` icinde durur ve toplama dongusune hic dokunmaz; iki sekil zaten ayrilmis durumda. |
| **Sonsuz gelir.** Cogalan pen + iscisiz uretim, oyunu yiyecek sorunundan tamamen cikarabilir. | Uretim pen kapasitesiyle **sert sinirli**; kapasite kademeye bagli; agil odun maliyeti ve gudme suresi onden odenir. Kabul macinda olculur. |
| **Coban hayvani haritanin disina surer** (V1'in kacis dersi). | Surulen hayvan cobanin konumunu takip eder; coban navigasyonla yurur, yani rota gecerlidir. Pen'e varista cember agil merkezine kilitlenir. |
| **Avci kulubesi kendi inegini avlar** (§3.7). | `huntable()` yalniz `owner === "wild"`; engine testiyle pinlenir. |
| **`perWorkerPerMinute` isteğe bagli olunca mevcut binalarda gevser.** | Alan yalniz `requiresLivestock === true` iken istege baglidir; digerlerinde zorunluluk aynen durur ve bu bir testle pinlenir. |
| **Boga hasari V3'un kurt tasarimini kilitler.** | Faz 6 yalnizca "rezerve eden isciye hasar" yolunu acar; hedef edinme/AI davranisi V3'e birakilir. |

## 10. Tamamlanma Kapisi

- [x] §2'deki 11 madde uctan uca calisir.
- [x] §8'deki tum sozlesme testleri gecer; olcek testi yesil kalir.
- [x] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil.
- [x] Kullanici gorsel kabulu verdi (2026-08-03, kabul maci).
- [x] §4.5 kapsam disi listesinden hicbir sey V2'ye sizmadi.
- [x] V1 dosyasinin §12'sinde V2 tamamlandi olarak isaretlendi ve sira V3'e
  gecti.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7.

Faz 3 (agil binasi) Faz 4'ten (gudme) once gelmelidir: bina olmadan gudmenin
hedefi yoktur. Faz 6 (boga) bagimsizdir ve gerekirse Faz 7'den sonraya
kaydirilabilir.

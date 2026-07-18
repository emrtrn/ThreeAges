# ThreeAges Cag ve Bina Seviye Ilerlemesi Plani

Olusturulma tarihi: 2026-07-17
Durum: Uygulandi (Faz 0-4 tamamlandi, 2026-07-18)
Kapsam: Cag (`settlement`/`town`) ve bina seviye (1->2->3) sistemlerinin
birbirinden ayrilmasi, SecondAge modellerinin devreye alinmasi, per-bina
seviye yukseltme ve cag atlaninca tum binalarin yeni cag Level1 modeline
gecmesi.

## 1. Amac

Su an oyunda cag atlama ("Kasaba Cagina Gec") ile bina seviyesi tek harekete
sikismis durumda: cag atlayinca `structure.level` 1'den 2'ye cikiyor ve model
`FirstAge_Level2` oluyor. SecondAge ve Level3 modelleri hic kullanilmiyor.

Hedeflenen calisma bicimi iki bagimsiz eksen:

- **Cag ekseni** (`settlement` -> `town`): Agir milestone olarak kalir
  (bina gereksinimi + kaynak + sure + merkez uretim durmasi). Tamamlaninca
  sahibin **tum binalari otomatik hedef cagin Level1 modeline** gecer ve bina
  seviyeleri 1'e sifirlanir.
- **Bina seviye ekseni** (Level 1 -> 2 -> 3): Bulunulan cag icinde, **her bina
  tek tek**, kendi panelinden, ayri maliyet + sure ile yukseltilir. Her seviye
  bir kazanim (can, tipe ozel bonus) verir ve modeli o cagin `Level{n}`
  varyantina cevirir.

Boylece `settlement` cagi FirstAge ailesine, `town` cagi SecondAge ailesine
esler ve arsivdeki SecondAge + Level3 modelleri ilk kez oyuna girer.

## 2. Mevcut Durum

- **Cag sistemi** (`src/game/rts/progression/ageSystem.ts`): `SettlementAge =
  "settlement" | "town"`. Tek yonlu gecis. `startTownUpgrade` bina/kaynak/sure
  ister; tamamlaninca sadece `commandCenter.applyTownUpgrade` cagrilir.
- **Bina seviyesi** (`src/game/rts/structures/structureUpgradeSystem.ts`):
  `level` 1 -> 2. Tip bazinda (owner+buildingId anahtarli) arastirma; bir kez
  bitince o tipteki tum binalar (sonradan yapilanlar dahil) T2 olur. `isTown`
  kapisi ile Kasaba cagina baglidir. Yalniz `house`, `depot`, `outpost`,
  `barracks` + `command_center` icin `upgrade` tanimi var.
- **Gorsel esleme** (`src/game/rts/structures/rtsBuildingVisuals.ts`): sabit
  `t1/t2` haritasi; `visualBuildingIdForBuildingId(id, level)` -> `level>=2 ?
  t2 : t1`. t1 = `FirstAge_Level1`, t2 = `FirstAge_Level2`. SecondAge ve Level3
  yok.
- **Balans** (`public/game-data/balance/buildings.json`): her binada tekil
  `upgrade` blogu (tek T1->T2 adimi). `public/game-data/balance/ages.json`
  yalniz `settlement` ve `town` tanimlar.
- **Arsiv** (`public/assets/ThreeAges/StaticMeshes`): 2 cag (FirstAge,
  SecondAge), her bina/cag icin Level1/2/3. ThirdAge modeli yok.

## 3. Kilit Kararlar

- **KR-01 - Per-bina seviye:** Seviye yukseltme tip bazinda degil, bina
  instance bazinda olur. Ayni tipteki binalar farkli seviyelerde olabilir.
- **KR-02 - 3 seviye:** Her cagda Level 1/2/3 (iki yukseltme adimi). Arsivdeki
  tum Level modelleri kullanilir.
- **KR-03 - Cag atlama agir milestone kalir:** Mevcut sart yapisi korunur;
  yalniz tamamlanma davranisina "tum binalari yeni cag Level1'ine cek + seviye
  sifirla" eklenir. Cag atlamaya seviye onsarti EKLENMEZ (ilk surumde).
- **KR-04 - Cag icinde seviye kapisi yok:** `isTown` sarti kalkar; Level
  yukseltme bulunulan cagda her zaman aciktir.
- **KR-05 - N-cag hazir, 2 cag bagli:** Sistem cag ailesini veriden cozer;
  ThirdAge modeli olmadigi icin simdilik yalniz 2 cag baglanir.
- **KR-06 - Cag basi stat olcekleme ertelenir:** Ilk surumde cag atlayinca
  statlar korunur (mevcut merkez town bonusu haric), kazanimi seviye adimlari
  tasir. Cag basi ayri stat olcegi ayri bir faz.

## 4. Model / Asset Esleme

Cag ailesi ve bina sanat adi eslemesi (gameplay id -> sanat taban adi):

| Gameplay id    | Sanat taban adi (age eki oncesi) | Not                               |
|----------------|----------------------------------|-----------------------------------|
| command_center | TownCenter                       |                                   |
| house          | Houses_..._1                     | Houses varyant secimi netlesecek  |
| depot          | Storage                          |                                   |
| outpost        | WatchTower                       |                                   |
| barracks       | Barracks                         |                                   |
| farm           | Farm (Wheat varyanti)            | Level bazli Wheat mesh mevcut     |
| quarry         | Mine                             | Cag/level varyanti yok - tek mesh |
| gold_mine      | Mine                             | Ayni                              |
| lumber_camp    | Resource_Tree_Group_Cut          | Kalici stand-in                   |

Cag -> aile eki: `settlement` -> `FirstAge`, `town` -> `SecondAge`.
Yol sablonu: `{TabanAd}_{AgeAilesi}_Level{n}.gltf` (istisnalar: Mine,
lumber_camp, ve cag/level'siz meshler yukaridaki tabloda isaretli).

Acik nokta: `quarry`/`gold_mine`/`lumber_camp` icin cag/level varyanti yok;
bunlar seviye atlayinca model degismez, yalniz stat kazanir (veya seviye
yukseltmesi bu binalarda kapali tutulur - Faz 2'de karara baglanacak).

## 5. Dosya Bazli Degisiklikler

- `src/game/data/gameDataTypes.ts`: Bina `upgrade: BuildingUpgrade` alanini
  `levels: BuildingLevelBalance[]` dizisine cevir (Level2, Level3 girisleri).
  Her giris: `cost`, `durationSeconds`, `maxHealth`, opsiyonel `territory`,
  `populationCapacity`, `economy` carpani.
- `public/game-data/balance/buildings.json`: Mevcut `upgrade` bloklarini
  `levels`'a tasi; tarla/tas ocagi/altin madeni/merkez icin Lv2/Lv3 tanimi
  ekle. (Validator allowlist gerekiyorsa `tools/saveValidator.ts` guncelle -
  balance JSON icin gecerliyse dogrula.)
- `src/game/rts/structures/structureUpgradeSystem.ts`: Anahtari
  instance bazina cevir; `isTown` kapisini kaldir; `start(structure)` sonraki
  seviyeye yukseltir; tamamlaninca `level++` + o seviyenin kazanimi + gorsel
  yenileme sinyali. Tip-geneli `completedUpgrades` semantigini kaldir.
- `src/game/rts/structures/rtsBuildingVisuals.ts`: `(age, buildingId, level)
  -> mesh` cozumleyici; her iki cag ailesini onden yukle; `createForStructure`
  ve `visualBuildingIdForStructure` imzalarina `age` ekle.
- `src/game/rts/structures/placedStructureSystem.ts`: Gerekiyorsa `level`'in
  1..3 araligini ve seviye basi bonus alanlarini destekle.
- `src/game/rts/structures/commandCenter.ts`: Merkez seviye/cag etkilesimini
  yeni modele uyarla (town bonusu + Level modeli birlikte).
- `src/game/rts/RtsApp.ts`: Cag tamamlanma handler'inda (satir ~822) sahibin
  tum binalarini Level1'e sifirla + yeni cag ailesiyle model yeniden kur +
  `structureUpgrades` durumunu sifirla. Structure-upgrade tamamlanma
  mesajlarini "Lv{n}" diline cevir. `applyStructureVisual` cari cagi gecirsin.
- `src/game/rts/ui/rtsSelectionView.ts`: "Tum ... T2 Yukselt" butonunu
  per-bina "Bu ...'yi Lv{n+1}'e Yukselt"e cevir; mevcut seviye + sonraki
  maliyet + kazanim goster; cag kapisi metnini kaldir.
- `src/game/rts/ai/aiUpgradeManager.ts`: Tip-bazli arastirmadan instance-bazli
  API'ye uyarla (veya AI icin gecici sadelestir; derleme ayakta kalsin).
- `tools/engine-tests.ts`: Eski upgrade API'sine dayanan testleri guncelle;
  yeni per-bina seviye ve cag-reset davranisi icin test ekle.

## 6. Uygulama Fazlari

### Faz 0 - Veri sozlesmesi ve model cozumleyici (gorsel-only) - TAMAMLANDI

- [x] `gameDataTypes.ts`: `BuildingLevelBalance` tipi ve `levels` alani eklendi.
- [x] `buildings.json`: mevcut `upgrade` -> `levels` (Lv2) tasindi; validator
      `levels`'i ayristirip legacy `upgrade`'i level-2 girisinden turetiyor
      (geriye donuk okuma korundu).
- [x] Yeni saf modul `src/game/rts/structures/rtsBuildingArt.ts`:
      `(age, id, level)` -> mesh yolu cozumleyici, Three.js bagimsiz/test edilebilir.
- [x] `rtsBuildingVisuals.ts` cozumleyiciyi kullaniyor; `allBuildingMeshPaths()`
      ile FirstAge + SecondAge aileleri (L1-3) onden yukleniyor; call site'lar
      cagi varsayilan `settlement` ile cagirdigi icin davranis degismedi.
- [x] Arsiv yazim hatasi duzeltildi: `Storage_FirstAge_Leve3.gltf` ->
      `Storage_FirstAge_Level3.gltf` (manifest.json referansi da guncellendi).
- [x] Gorsel esleme birim testleri eklendi (yol uretimi + dedup + disk mevcudiyeti).
- [x] `npx tsc --noEmit` temiz; Faz 0 engine testleri gecti; davranis degismedi.

> Not: Faz 0 sirasinda fark edilen, bu calismayla ilgisiz bir bayat test
> duzeltildi ("a raid on the base pulls the army home"). Kok neden: `61c12cc`
> harita blokout'unu koselere tasidi (`enemyStart` -> `{x:38,z:-38}`) ama AI
> raid testi raider'i eski sabit `(0,-24)` konumuna koyuyordu; yeni us
> `AI_BASE_THREAT_RADIUS` (24) disinda kaldigi icin `baseThreat=0` olup
> `defendBase` yerine `assaultTarget` donuyordu. Test artik raider'i
> `RTS_BLOCKOUT_MAP.enemyStart`'a gore koyuyor. Tum suite yesil (1025 check).

### Faz 1 - Per-bina seviye yukseltme (cag ici) - TAMAMLANDI

- [x] `structureUpgradeSystem.ts` instance bazli (`start/snapshot/isUpgrading`
      artik `PlacedStructure` aliyor, anahtar `structure.id`); `isTown` kapisi ve
      tip-geneli `completedUpgrades` semantigi kalkti. AI icin ince tip cephesi
      eklendi (`startForType` / `typeSnapshot`).
- [x] `level < 3` iken `nextStep` sonraki seviyeyi baslatiyor; bitince `promote`
      `level++` + kazanim (can, ev nufusu, karakol alani) uyguluyor.
- [x] Tamamlaninca `RtsApp` `applyStructureVisual` ile gorsel mevcut seviyenin
      `Level{n}` modeline yenileniyor (cag ailesi Faz 2'ye kadar FirstAge).
- [x] `buildings.json`: house/depot/outpost/barracks'a Level3, seviyesiz `farm`'a
      Lv2/Lv3 eklendi. quarry/gold_mine/lumber_camp bilincli olarak Faz 2'ye
      birakildi (level mesh'i yok - §4/§8 acik notu). `BuildingLevelBalance`'a
      `populationCapacity` alani + validator dogrulamasi eklendi.
- [x] Engine testleri instance-bazli akisa gore guncellendi (Faz 6 yukseltme
      blogu, AI §53, seçim paneli); Level2->3 ve `at-max-level`/`under-construction`
      sonuclari icin yeni assert'ler eklendi.
- [x] `tsc --noEmit` temiz; `test:engine` 1025 check yesil.

> Not: KR-04 geregi cag kapisi UI'dan da kalkti; secim panelindeki buton artik
> per-bina "Lv{n+1}'e Yükselt" (veya en ust seviyede devre disi) diyor ve
> `townUnlocked` alani `StructureUpgradeView`'dan cikarildi - Faz 3 UI diline
> onden bir adim. Detay basligindaki `T{level}` etiketi ("Ev T2") ve `farm`
> ekonomi carpani (level basi uretim) Faz 3 / sonraki fazlara birakildi.

### Faz 2 - Cag atlama -> tum binalar yeni cag Level1 - TAMAMLANDI

- [x] `RtsApp` cag-tamamlanma handler'i `rebuildForAge(owner)` ile sahibin tum
      binalarini Level1'e sifirliyor + yeni cag ailesiyle model yeniden kuruyor
      (tamamlanmislar bitmis model, insaattakiler yeni cag translucent modeli).
- [x] `structureUpgrades.resetOwner(owner)`: sahibin ucusundaki yukseltmeleri
      iade edip siliyor ve her binayi taban Level1'e (`demoteToBase`) cekiyor -
      can (`HealthComponent.setMax` ile asagi da inebiliyor), ev nufusu ve karakol
      alani taban degerlere donuyor.
- [x] Gorseller cag-duyarli: `applyStructureVisual` / `applyConstructionVisual` /
      `applyToCenter` / yerlestirme onizlemesi sahibin cari cagini geciriyor.
      `settlement` -> FirstAge, `town` -> SecondAge; SecondAge modelleri ilk kez
      sahaya cikiyor.
- [x] Cag/level varyanti olmayan binalar (quarry/gold_mine `Mine`, lumber_camp
      stand-in) `fixed` cozumleyici ile cag ve seviyeden bagimsiz tek mesh'te
      kaliyor; `levels` tanimlari olmadigi icin per-bina seviye butonlari da yok.
- [x] Yeni engine testleri: `resetOwner` taban-sifirlama + iade, `setMax`
      asagi/yukari sinir, ve cag->aile mesh cozumleme (SecondAge + sabit kamplar).
- [x] `tsc --noEmit` temiz; `test:engine` 1028 check yesil.

> Not: Merkez (CommandCenter) per-bina seviye sistemine dahil degil; `level`'i cag
> katmani (settlement=1, town=2) olarak kaliyor ve modeli `TownCenter_SecondAge_
> Level2` olarak cozuluyor (yine bir SecondAge modeli). Cag-up bildirim/panel
> metinleri ("T2 yükseltmeleri açıldı" vb.) hala eski dilde - Faz 3'e birakildi.

### Faz 3 - UI ve mesajlar - TAMAMLANDI

- [x] `rtsSelectionView`: per-bina "Lv{n+1}'e Yukselt" butonu artik seviye +
      maliyet + kazanimi birlikte gosteriyor. Yeni `UpgradeGain` view alani
      (`RtsApp.structureUpgradeGain` ile veriden hesaplanir) panele
      "Lv{n}: {can} can (+{delta})" satirini ve varsa nufus/kontrol yaricapi
      kazanimlarini ekliyor; en ust seviyede satir yok.
- [x] Bina paneli ve bildirim metinleri "Lv" diline gecti: detay basligi `T{n}`
      -> `Lv{n}` ("Ev Lv2"), kisla oz-yukseltme/uretim mesajlari "Seviye
      yukseltmesi ...", `startStructureUpgrade` iade/yetersiz mesajlari `Lv{n}`.
      Cag-tamamlanma bildirimi artik davranisi anlatiyor ("tum binalariniz yeni
      cag modeline gecti ve seviye 1'e dondu"). Build palette cag readout'u da
      cag-milestone davranisini anlatacak sekilde yeniden yazildi.
- [x] Cag kapisi metinleri kaldirildi: build palette "T2 ... icin Kasaba Cagi
      gerekir" yerine cag-milestone aciklamasi veriyor; kisla birim tier-kapisi
      `Kisla T{n} gerekir` -> `Kisla Lv{n} gerekir` (birim `requiredBuildingLevel`
      degerinden). KR-04 geregi cag ici seviye her zaman acik.
- [x] Elle oyun ici dogrulama (verify skill, `?rts`): ev kuruldu, panelde
      "Ev Lv2'e Yukselt · 70 Odun · 40 Tas" butonu + "Lv2: 450 can (+150) · 8
      nufus" kazanim satiri + cag-milestone metni + `Lv` dilli yetersiz-kaynak
      mesaji gercek DOM'da gozlendi.

> Not: Faz 3 sirasinda `tests/smoke/rts-building-placement.spec.ts` icindeki
> arsiver tier-kapisi iddiasi `T2` -> `Lv2` olarak guncellendi. Ayni smoke
> dosyasindaki arsiver testi, bu calismayla ilgisiz bir sekilde calisma
> agacindaki `rtsMapBlockout.ts` degisikliginin sabit kodlanmis insaat noktasini
> (950,660) kontrol alani disina kaydirmasi nedeniyle yerlestirme adiminda
> takiliyor (Faz 3 metnine ulasmadan); bu Faz 3 kapsaminda degil.

### Faz 4 - AI uyumu ve kapanis - TAMAMLANDI

- [x] `aiUpgradeManager` yeni API ile calisiyor: Faz 1'de eklenen ince tip cephesi
      (`startForType` / `typeSnapshot`) uzerinden instance-bazli sisteme baglaniyor.
      Tetikleyici hala veri kapisinin kendisi (`requires-barracks-upgrade`), yani
      tier kapisinin ikinci bir kopyasi AI'da yasamiyor.
- [x] AI cag atlaninca ayni model/level reset davranisini aliyor: `RtsApp` cag
      tamamlanma dongusunde `rebuildForAge(event.owner)` sahip ayrimi *oncesinde*
      cagriliyor, dolayisiyla AI'nin binalari da Level1'e donuyor ve yeni cag
      ailesiyle yeniden kuruluyor. Upgrade manager durumu canli `typeSnapshot`
      okudugu icin yeni cagda merdiveni bastan tirmaniyor (ayrica reset gerekmiyor).
- [x] `npm run build:verify` yesil (verify:imports + tsc + vite build +
      test:engine 1029 check + verify:dist --strict).
- [x] Bu dokuman "Durum: Uygulandi" olarak guncellendi.

> Ek (plan disi, kullanici istegi): Seviye yukseltmesi artik ilerleme cubugu ile
> gosteriliyor. `SelectionProgress` tipi + `SelectionPanelContent.progress` alani
> eklendi; `StructureUpgradeView.progress` (0..1) `RtsApp.structureUpgradeView`
> icinde adimin `durationSeconds` degeri ile `remainingSeconds`'tan hesaplaniyor.
> Panel `.rts-selection-progress` (etiket + kalan sn + dolan cubuk) render ediyor,
> yalnizca yukseltme surerken gorunur. Cubuk mekanizmasi genel: ileride insaat
> ilerlemesi de ayni alana baglanabilir.

## 7. Dogrulama Stratejisi

- Her faz sonunda `npx tsc --noEmit` ve `npm run test:engine`.
- Faz 4 kapanisinda `npm run build:verify` (tsc + vite build + test:engine +
  verify:dist --strict).
- Gorsel/oynanis dogrulamasi icin `verify` skill'i ile `?rts` rotasinda: bina
  kur -> cag ici Lv2/Lv3 yukselt (model degisir) -> Kasaba Cagina gec (tum
  modeller SecondAge Level1 olur, seviyeler sifirlanir) -> tekrar yukselt.

## 8. Riskler ve Notlar

- **ThirdAge yok:** Oyun adi "ThreeAges" olsa da arsivde 3. cag modeli yok.
  Sistem N-cag'a hazir kurulur; 3. cag ancak sanat kaynagi netlesince baglanir.
- **Seviyesiz binalar:** quarry/gold_mine/lumber_camp icin cag/level mesh
  varyanti yok. Bu binalarda seviye yukseltme modeli degistirmez; UI bunu durust
  yansitmali (yalniz stat kazanimi) ya da bu binalarda seviye kapali olmali.
- **AI kirilmasi:** `aiUpgradeManager` tip-bazli arastirmaya dayaniyor;
  instance-bazli gecis AI davranisini bozabilir - derleme ve AI cag-up akisi
  her fazda korunmali.
- **Validator allowlist:** Balance JSON balance loader'i (structured save
  degil) uzerinden okunuyorsa `tools/saveValidator.ts` degisikligi
  gerekmeyebilir; `levels` semasi eklenirken loader tarafi kontrol edilmeli.
- **Cag basi stat olcegi:** KR-06 geregi ilk surumde yok; ilerleme hissini
  guclendirmek icin sonradan ayri faz olarak eklenebilir.

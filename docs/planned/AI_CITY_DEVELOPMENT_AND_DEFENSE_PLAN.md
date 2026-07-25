# AI Şehir Gelişimi, Savunma ve Çağ Kapılı Saldırı Planı

Oluşturulma tarihi: 2026-07-25
Durum: **Uygulandı** (2026-07-25). Karar A1 (mevcut `outpost`, yeni bina yok) ve
B1 (`attackAgeGraceSeconds` emniyet supabı) seçildi. Gerçekleşen ile plan
arasındaki farklar §6'da.
Kapılar: `npx tsc --noEmit` yeşil, `npm run test:engine` 1101 check yeşil,
`npm run build:verify` yeşil, `npm run check:assets` PASS.
Kaynak istek: "AI gelişmiş bir şehir kursun, savunmayı ihmal etmesin, kasaba
çağına geçmeden saldırıya geçmesin."

İlgili dokümanlar: `GDD/07_ENEMY_AI_DESIGN_v0.2.md` (§24, §27, §30, §34, §40–§43,
§53–§55, §59, §62), `GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` §53 (4)
(mevcut saldırmazlık penceresi kaydı).

---

## 1. Teşhis — AI bugün neden asker basıp saldırıyor

Bunlar okunmuş koddan çıkan gerçekler, tahmin değil.

### 1.1 Saldırının tek kapısı zaman, çağ değil

`intentScorer.scoreAttack` (`src/game/rts/ai/intentScorer.ts:228`) yalnızca
`army.peaceSeconds` (bugün 600 sn) ile geciktiriliyor. Çağ kontrolü yok. Yani
10. maç dakikasından sonra AI **Yerleşim çağında** saldırmaya tam yetkili.

### 1.2 Saldırı skoru pratikte tavanı görüyor

`armyReadiness = (powerRatio - 0.9) / (2.0 - 0.9)`; `powerRatio` kendi ordu
gücünün *görülen* düşman ordu gücüne oranı. Oyuncu erken oyunda ekonomi
kurarken az asker tutuyorsa oran hızla 2.0'ı geçer → `armyReadiness = 1.0` →
`attack` skoru `1.0 × intentWeights.attack (1.0) = 1.0`.

Rakip niyetlerin gerçekçi tavanları bunun altında:

- `ageUp`: gereksinim eksikken `requirementProgress (0.3) × oran × 1.1` → en
  fazla ~0.33 (`intentScorer.ts:145`).
- `economy`: terimler toplamı; temel binalar dikildikten sonra `workerNeed`,
  `populationPressure` ve `recoveryNeed` sıfıra iner, geriye yalnız
  `incomeDeficit (0.3)` kalır.
- `expand`: `wood/400 × safety × 0.9` → en fazla 0.9.

Üstüne `KingdomDirector` histerezisi (%25, `kingdomDirector.ts:102`) bir kere
1.0'a oturmuş `attack`'ı devrilemez yapıyor: rakibin 1.25 puan alması gerekir,
bu imkânsız. Bu tam olarak `intentScorer.ts:258-266`'daki yorumun uyardığı
tuzağın çağ ekseninde tekrarı.

### 1.3 Asker üretimi hiçbir niyete bağlı değil

`AiProductionManager.update` (`aiProductionManager.ts:49`) `AiController`'ın
`economyDue` dalında **her zaman** çalışıyor (`aiController.ts:254`) — direktör
ne yapıyorsa yapsın. Sırası: pop tavanı doluysa çık → işçi hedefi (`settlement:
12`) dolana kadar işçi → sonra **kalan her şey orduya**, `populationShare: 0.55`
tavanına kadar. Yani "asker basma" AI'ın arka planda sürekli çalışan varsayılan
davranışı; strateji değil.

### 1.4 "Gelişmiş şehir" diye bir hedef yok

`buildOrder` (`aiEconomyManager.ts:74`) her bina için yalnız `count === 0`
kontrolü yapıyor. Harita da bunu pekiştiriyor: `enemyBaseAnchors`
(`src/game/rts/world/rtsMapBlockout.ts:198`) her binadan **birer** slot veriyor
(6 ev hariç). Sonuç: 8 bina + 6 ev dikildi mi `buildOrder` boş dönüyor, ekonomi
niyetinin yapacak işi kalmıyor, skoru düşüyor, `attack` sahayı devralıyor.

Ayrıca merkez seviyesi (Lv2/Lv3) kendi başına hedeflenmiyor:
`AiUpgradeManager.update` yalnızca üretim yöneticisi tier'a takıldığında
yatırım yapıyor (`aiUpgradeManager.ts:53`), `AiAgeManager` ise yalnız `ageUp`
niyeti koşarken Lv3'e tırmanıyor. Kasabaya geçen AI, Town Lv1'de takılı kalıyor.

### 1.5 Savunma repertuarı neredeyse boş

- `enemyBaseAnchors` içinde **hiç savunma yapısı slotu yok**. `outpost` yalnızca
  `enemyExpansions` içinde (`rtsMapBlockout.ts:250`, `:279`).
- `buildings.json`'da savunması olan tek yapı `outpost`
  (`defense.attackDamage: 10`, menzil 12, 2 ok). GDD §41 "Kule: kritik geçit
  veya karakol yakını" diyor ama `watchtower` binası veride yok.
- `army.minimumDefensePower: 2` — Muhafız gücü 1.0 olduğuna göre üste iki
  Muhafız bırakmak yeterli sayılıyor; üçüncü Muhafız sahaya çıkıyor
  (`armyManager.ts:206`).
- `scoreDefend` `responseAbility` ile çarpıyor, yani ordusuz AI ~0 skorluyor. Bu
  kasıtlı (§27) ve doğru; ama "savunmayı ihmal etmeme" bu skorla değil,
  garnizon + yapı ile çözülür.

### 1.6 Yan gerçek: outpost, Town'un ön koşulu

`ages.json` → `town.requiredBuildingIds` içinde `outpost` var. Bugün outpost
yalnız genişlemeden geldiği için **genişleme, Kasaba'nın zorunlu yolu**. Üsse
savunma karakolu eklemek bu bağı koparır. Bu, aşağıdaki A kararının konusu.

---

## 2. Tasarım hedefi (kabul kriterleri)

1. AI, Kasaba çağına geçmeden saldırı **başlatmaz**; kendisine yapılan saldırıya
   her zaman normal cevap verir.
2. AI, temel 8 binayı dikip durmaz: ikinci üretim binaları, ev hattı, market ve
   merkez seviyeleri dahil bir "şehir hedefi" tamamlar.
3. AI üste her zaman anlamlı bir garnizon + en az bir savunma yapısı tutar.
4. Bütün eşik ve sayılar `balance/ai.json` içinde veri olarak durur; formül
   *şekli* kodda kalır (mevcut `intentScorer` ilkesi).
5. Tek kopya kuralı: yeni kapı bir yerde durur (`intentScorer`), `armyManager`'a
   ikinci kopya konmaz — `intent !== "attack"` zaten `regroup`'a düşürüyor.

---

## 3. Karar noktaları (uygulamadan önce netleşmesi gerekenler)

### Karar A — Üs savunma yapısı hangi bina?

- **A1 (önerilen): mevcut `outpost`'u üste de anchor'la.** Kod işi yok, veri +
  harita işi. Bedeli: Town gereksinimi genişlemeden bağımsız karşılanabilir hale
  gelir; genişleme *ekonomik* bir tercih olur, zorunluluk olmaz.
- **A2: yeni `watchtower` binası ekle** (`buildings.json` + progression + ikon +
  görsel + validator). Outpost genişlemeye özel kalır, Town gereksinimi
  bozulmaz. Bedeli: yeni bina kimliği = art/UI/veri işi, plan uzar.

### Karar B — Kasaba'ya hiç geçemeyen AI

Çağ kapısı sert olursa, ekonomisi çökmüş bir AI hiç saldırmaz ve maç kilitlenir.

- **B1 (önerilen): geç emniyet supabı.** `army.attackAgeGraceSeconds` (örn.
  1800 sn); bu süre geçtiyse çağ kapısı kalkar. `0` = supap kapalı, yani sert
  kapı hâlâ ifade edilebilir.
- **B2: sert kapı.** Kasaba yoksa saldırı yok. Daha okunabilir, ama uzun maçta
  hareketsiz AI riski var.

---

## 4. Uygulama planı

Faz sırası kasıtlı: her faz kendi başına build-passing ve oynanabilir.

### Faz 1 — Çağ kapılı saldırı (hedef 1)

**Veri** — `public/game-data/balance/ai.json` → `army`:

```json
"attackMinimumAge": "town",
"attackAgeGraceSeconds": 1800
```

**Tip** — `src/game/data/gameDataTypes.ts` → `AiBalance.army`:
`attackMinimumAge: SettlementAge`, `attackAgeGraceSeconds: number`. Yorumda
nedeni yazılır (§24: çağ atlama ekonomi ile denge içinde olmalı).

**Doğrulama** — `src/game/data/validateGameData.ts` → `validateAiBalance`
(`:1113` civarı): `attackMinimumAge` iki geçerli çağ id'sinden biri olmalı;
`attackAgeGraceSeconds >= 0`.

**Kapı** — `intentScorer.scoreAttack`, mevcut `peaceSeconds` bloğunun **hemen
altına** (sıra önemli: iki kapı da zaman/çağ, mesaj sırası logta okunur kalsın):

```ts
// Kasaba çağına geçmeden saldırı başlatılmaz. Defend dokunulmaz.
if (bb.age !== balance.army.attackMinimumAge
  && (grace <= 0 || bb.now < grace)) return { rawScore: 0, reason: "..." };
```

Reason metni adıyla söylenmeli: `"kasaba çağına ulaşılmadı, saldırı yok"` /
supap açıldığında `"çağ kapısı zaman aşımıyla kalktı"`.

**Neden burada:** `armyManager.chooseMission` (`:202`) `intent !== "attack"`
iken `regroup` veriyor, dolayısıyla bastırılmış niyet hedef seçimini de bastırır
ve sürüklenecek ikinci pencere olmaz. Bu, `peaceSeconds` için verilmiş kararla
aynı gerekçe (GDD/13 §53 (4)).

**Not:** `SettlementAge` yalnız iki değer olduğu için `attackMinimumAge`
bugün "settlement" (kapı kapalı) veya "town" (kapı açık) demektir; alanın çağ
tipinde olması Kingdom çağı geldiğinde kod değişikliği gerektirmemesi için.

### Faz 2 — Saldırının gelişim çarpanı (hedef 1 + 4)

Faz 1 kapıyı Kasaba'ya kadar tutar; Kasaba'dan sonra §1.2'deki 1.0 tavanı geri
gelir. Bunun için `scoreAttack`'a §30 çarpanı olarak bir terim eklenir:

```text
Attack = ArmyReadiness × Opportunity × DevelopmentReadiness
```

`DevelopmentReadiness` = şehir hedeflerinin tamamlanma oranı (Faz 3'ün
`buildingTargets`'ından türetilir), `scoring.attack.developmentFloor` ile
tabanlanır (örn. 0.35 — yani yarım kalmış şehir saldırıyı kısar, sıfırlamaz).

Bu terim `ageUp`'ın `economyMaturity` teriminin aynadaki karşılığı: saldırı da
ekonomiye borçlu hale gelir.

### Faz 3 — Şehir hedefleri (hedef 2)

**Veri** — `ai.json` → `economy.buildingTargets`, çağ anahtarlı (mevcut
`army.composition` ve `economy.workerTarget` ile aynı şekil):

```json
"buildingTargets": {
  "settlement": { "house": 4, "farm": 1, "lumber_camp": 1, "quarry": 1,
                  "gold_mine": 1, "barracks": 1, "outpost": 1, "market": 1 },
  "town":       { "house": 8, "farm": 2, "lumber_camp": 2, "quarry": 1,
                  "gold_mine": 1, "barracks": 1, "archery_range": 1,
                  "outpost": 3, "market": 1 }
}
```

**Kod** — `aiEconomyManager.buildOrder`: `count === 0` kontrolleri
`count < target` olur. Sıra (tasarım) kodda kalır, sayılar (tuning) veriye
gider. Ev, mevcut nüfus baskısı kuralını korur *ve* hedefe kadar arka planda
istenir. `AI_WOOD_SAFETY_STOCK` mantığı aynen korunur.

**Harita** — `rtsMapBlockout.enemyBaseAnchors`: ikinci `farm`, ikinci
`lumber_camp`, ek `house` slotları ve (Karar A1 ise) üs savunma karakolu
slotları eklenir. Kritik kısıtlar aynen geçerli:

- Slot, çağın kontrol yarıçapı içinde olmalı (Yerleşim başlangıç 28).
- Footprint'ler ve yol hücreleri (`enemyBaseRoute`, genişleme koridorları) ile
  çakışma yasak.
- Quarry/gold_mine slotları düğüm bağımlı; onlara dokunulmaz.
- Oyuncu tarafında anchor yok (oyuncu serbest kurar), yani bu değişiklik
  simetriyi bozmaz.

**Merkez seviyesi** — `scoreAgeUp` bugün `bb.age === "town"` iken 0 dönüyor
(`intentScorer.ts:134`). Bunun yerine Town'da kalan `levelUpgrades` varsa skor
üretmeye devam etsin; `AiAgeManager` zaten `startLevelUpgrade` çağırabiliyor
(`aiAgeManager.ts:57`), yani yeni makine gerekmez — yalnız "Town'a vardık, iş
bitti" erken çıkışının kaldırılması ve reason metinlerinin güncellenmesi.

### Faz 4 — Savunma (hedef 3)

1. **Garnizonu çağa ölçekle.** `army.minimumDefensePower: 2` →
   `Record<SettlementAge, number>`, örn. `{ "settlement": 3, "town": 6 }`.
   Okuyucular: `intentScorer.scoreAttack:252`, `armyManager.chooseMission:206`,
   `armyManager.garrison` (bkz. `armyManager.ts` garrison seçimi). Üçü de aynı
   yardımcıdan okumalı ki eşik tek kopya kalsın.
2. **Savunma yapısı build order'da.** `buildOrder`'da savunma yapısı
   `barracks`'tan **sonra**, `quarry`'den **önce** istenir: §34'ün "askerî
   yapıdan önce taş kazma" uyarısına ters düşmez ve Town gereksinimini de erken
   karşılar.
3. **`populationShare` düşür.** `0.55` → `0.40`. Ev hedefi büyüdüğü için mutlak
   ordu boyutu düşmez, ama işçi/ordu dengesi ekonomiye kayar. `populationShare`
   yorumundaki PopulationBlocked gerekçesi hâlâ geçerli, tavan kalkmıyor.
4. **İşçi hedefi.** `workerTarget`: `settlement: 12 → 14`, `town: 16 → 22`.
   Sıralama önemli: bu değişiklik ev hedefi (Faz 3) yükselmeden yapılmamalı,
   yoksa nüfus kilidi acil durumu sıklaşır.

### Faz 5 — Görünürlük ve doğrulama

**Debug paneli** — `aiDebugView` yeni nedenleri gösterir: çağ kapısı durumu,
`DevelopmentReadiness` yüzdesi, şehir hedeflerinde eksik kalanlar. `?rts&debug`
ile bir maçı izlerken "neden saldırmıyor" sorusu panelden okunabilmeli (§82).

**Engine testleri** — `tools/engine-tests.ts` (mevcut `AI_TEST_BALANCE` /
`aiTestBlackboard` altyapısı kullanılır):

- Scorer: Yerleşim'de `now > peaceSeconds` iken `attack` skoru 0; aynı
  blackboard `age: "town"` ile > 0. Sınır: supap saniyesinde kapı kalkar.
- Scorer: `DevelopmentReadiness` düşükken `attack` skorunun kısıldığı, hedefler
  tamamlandığında tam skorladığı.
- `buildOrder`: hedef sayılarına uyduğu; bir hedef dolduğunda o binayı
  istemediği; ev nüfus baskısı kuralının hedefle çakışmadığı.
- Garnizon: `minimumDefensePower` çağa göre okunduğu ve `settlement` eşiğinin
  altında sahaya çıkılmadığı.
- Entegrasyon (headless maç): Yerleşim'de baskın bir ordu ile **her tikte**
  `assaultTarget`/`harassEconomy`'ye geçilmediği; Town'a geçince geçildiği.
  Kurulum tuzağı — GDD/13 §53 (4) kaydındaki iki hata tekrarlanmamalı: pop
  tavanını dolduran ordu `population-blocked` acilini tetikleyip direktörü
  Economy'ye kilitler, ve işçisiz krallıkta Economy zaten 1.0 skorlar; ikisi de
  kapıyı değil o yarışı ölçer.

**Kapılar** — `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`.

**Save-validator notu** — bu planın bütün veri alanları `balance/ai.json`,
`balance/ages.json` ve `balance/buildings.json` içinde. CLAUDE.md'nin üç
allowlist yüzeyi (layout / skeleton / effect) bu dosyalara uygulanmaz; doğru
yüzey `src/game/data/validateGameData.ts`. Karar A2 seçilirse `buildings.json`
şeması ve onun validator'ı da genişler.

**Oynanış doğrulaması** — `?rts&debug` ile en az 5 maç: AI Kasaba'ya geçiyor,
şehir hedeflerini tamamlıyor, üste karakol + garnizon tutuyor, saldırıyı Kasaba
sonrasında başlatıyor, ve rush'a karşı hâlâ savunma yapıyor. Sonuç
`GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` §53 kaydına yeni madde olarak
işlenir (mevcut 4. madde formatında).

---

## 5. Riskler

| Risk | Etki | Karşılık |
| --- | --- | --- |
| AI Kasaba'ya hiç geçemez, maç kilitlenir | Yüksek | Karar B1 supabı; ayrıca Faz 5 oynanış testinde açıkça aranır |
| Üs karakolu Town gereksinimini karşılayınca AI genişlemeyi bırakır | Orta | `expand` skoru ekonomik değere bağlı kalıyor; oynanışta izlenir. Kabul edilemezse Karar A2 |
| Yeni anchor'lar footprint/yol çakışması yaratır | Orta | Slotlar grid'e snap; `AiBuildManager` §43 kara listesi hatayı logta adıyla söyler |
| Ev + işçi hedefi büyürken nüfus kilidi sıklaşır | Orta | Faz 3 (ev) Faz 4.4'ten (işçi) önce; `populationShare` düşüşü headroom açar |
| Attack tavanı Faz 2'de fazla kısılır, AI hiç saldırmaz | Orta | `developmentFloor` veri; 0 = terim etkisiz, eski davranış ifade edilebilir |

---

## 6. Gerçekleşen — plandan sapmalar

Uygulama sırasında planın eksik veya yanlış olduğu yerler. Hepsi kasıtlı ve
gerekçeli:

1. **`scoring.economy.developmentNeed` planda yoktu, eklendi.** Faz 3 build
   order'ı uzatıyor ama *yalnızca* Economy niyeti bina diker
   (`aiController.update` → `if (currentIntent === "economy")`). Skorda "şehir
   eksik" diye bir terim olmadığı için AI'ın bu planı seçmek için hiçbir nedeni
   olmayacaktı — yani Faz 3 kod olarak var, davranış olarak ölü olurdu.
   `AiAttackScoring.developmentFloor`'un aynadaki karşılığı, ağırlık `0.45`.

2. **Üs karakolu slotu tek, ve sınırı kesiyor.** Karakol
   `canPlaceExpansion` ile doğrulanıyor ve footprint'inin içinde **nötr** hücre
   şart (`territoryControlSystem.ts:126`). Yani üsün göbeğine karakol
   dikilemiyor; slot kontrol kenarını kesmek zorunda —
   `atEnemyBase(-18, 24)`, tehdit gelen yön. İkinci bir üs karakolu da bu yüzden
   iptal: ilkinin 16 birim kontrol yarıçapı içindeki her slotta nötr hücre
   kalmıyor. Kasaba hedefi `outpost: 2` yine ulaşılabilir (üs 1 + genişleme 2).
   Bunu yakalayan şey yeni "her authored anchor yerleştirilebilir mi" testi.

3. **Grid snap tuzağı.** `snapToPlacementGrid` 2 birimlik ızgaraya yuvarlıyor,
   yani tek sayılı bir koordinat sessizce başka hücreye kayıyor. Bütün yeni
   offset'ler çift; test bunu artık her anchor için doğruluyor.

4. **İkinci `lumber_camp` doğuya kondu.** `requiresForest` + `gatherRadius: 20`,
   ve üsün kontrol yarıçapı içinde ağaç olan tek yön o.

5. **Yedinci ev slotu eklendi.** Mevcut altı slot Kasaba ev hedefinin tam
   kendisiydi, hiç pay bırakmıyordu — ve `(16,-6)` slotu gerçek oyunda
   `enemy-wood-8` ağacının üstünde duruyor (`liveTreeBlockers` yerleştirmeyi
   engelliyor, ağaçlar kesilene kadar o slot ölü).

6. **`RTS_CoreMatch.level.json` de güncellendi.** Level, blockout'un anchor
   listesinin birebir kopyası ve bir test bunu `deepEqual` ile karşılaştırıyor,
   yani yeni slotlar iki yere de yazılmak zorunda.

7. **Town'da `ageUp` artık merkez seviyesini puanlıyor.** Plan bunu "Faz 3"e
   sıkıştırmıştı; gerçekte `AiBlackboard`'a iki alan gerekti (`centerLevel`,
   `centerLevelUpgradeCost`) çünkü skorer merkez seviyesini hiç görmüyordu.

### Yol üstünde bulunan, bu işe ait olmayan kırıklar

`npm run test:engine` bu iş **başlamadan önce de kırmızıydı** ve ilk hatada
durduğu için arkasındaki ~1090 check hiç koşmuyordu. Kendi işimi doğrulayabilmek
için şu bayat iddiaları shipped veriye çektim (hiçbiri denge değişikliği değil,
testler veriyi yansıtmayı bırakmış):

- `barracks.cost.wood` 160 → 140, `house.cost.wood` 80 → 50 (`40b9112`).
- `resources.stone.safeNode.perWorkerPerMinute` 5 → 6,
  `gold.externalNode` 5 → 6 (`544e157`).
- `ages.town.cost` 600/350/150/150 → 500/500/200/100 ve
  `levelUpgrades[0].cost.stone` 120 → 60 (iki yerde).
- Muhafız yiyecek maliyeti 60 → 40 olduğu için kuyruk rezervasyonu 2700 → 2800.
- **Depo dayanıklılık sınıfı:** test "depo bir çiftlikten uzun yaşar" diyordu;
  centre-led progression (`be5d42d`) per-bina sağlık merdivenini kaldırdığından
  beri depo/çiftlik/kereste ocağı aynı 100 HP sınıfında. İddia *kaldırıldı*,
  veri **değiştirilmedi** — deponun hangi sınıfta olduğu bir denge kararı ve
  testin sessizce vereceği bir karar değil. GDD 04'te bu sıralamayı doğrulayan
  bir cümle de yok. **Karar senin:** deponun daha dayanıklı olması gerekiyorsa
  `buildings.json` → `depot.maxHealth` yükseltilmeli.
- **River Water strip foam:** test authored strip stamp'lerin ribbon'a foam
  bastığını iddia ediyordu; `riverWater.ts:141` "Strip Foam has been retired"
  diyor ve `foamMasks` artık sabit 0. Test kaldırılan davranışa göre
  güncellendi (legacy veri hâlâ *yüklenebiliyor*, sadece hiçbir şey basmıyor).

## 6.1 Oynanış bulgusu: "AI hiç level/çağ atlamıyor" (2026-07-25)

`?rts&preset=gameplay_proof` ile oynandı, AI hiç seviye ya da çağ atlamadı.
Headless olarak gerçekçi kaynakla (500/500/0/0 — preset'in düşmana verdiği) tekrar
üretildi. **Sebep §4'ün kapıları değil; iki ayrı şey:**

### (a) Test dünyasında hiç ağaç yoktu — düzeltildi

`aiTestWorld`, `EconomyProductionSystem`'e `ForestSystem` vermiyordu. Sonuç: her
kereste ocağı `missing-forest` raporluyor, **odun geliri yapısal olarak sıfır**.
AI'ın bütün ekonomi testleri bu yüzden 4000–6000 başlangıç odunu hediyesiyle
koşuyordu, yani "AI Kasaba'ya ulaşıyor" testi odun ekonomisini hiç sınamıyordu.

Harness'a haritanın gerçek koruları, gerçek `missing-forest` yerleştirme kuralı ve
gerçek `placementBlockers` (yol + ayakta ağaç) bağlandı. Bu bağlanınca AI 500/500
ile gerçekten gelişiyor: karakol → ev → taş ocağı → altın madeni → genişleme,
~24. dakikada Yerleşim **Lv2**, ~32. dakikada **Lv3**.

### (b) Kalan gerçek blocker: odun tükeniyor, Kasaba'ya para yetmiyor

Yerleşim Lv3'ten sonra AI takılıyor ve **niyeti `ageUp` olarak kalıyor** — yani
karar mantığı doğru çalışıyor, parası yetmiyor:

| t | çağ | F | W | S | G |
| --- | --- | --- | --- | --- | --- |
| 1920s | Lv3 | 339 | 330 | 300 | 89 |
| 4320s | Lv3 | 4619 | **330** | **300** | **107** |

Kasaba maliyeti 500/500/200/100. Taş ve altın yeterli, **odun 330'da donuyor** ve
yiyecek dışında hiçbir gelir kalmıyor: üs kereste ocağının 20 birim `gatherRadius`
içindeki koru (~1592 odun) ~32. dakikada tükeniyor, taş (300) ve altın yatakları da
bitiyor. Ondan sonra AI sonsuza kadar yiyecek biriktiriyor.

Yani sorun **AI kararı değil, haritanın AI tarafındaki kaynak arzı**: tek koru bir
maçı taşımıyor ve ikinci kereste ocağı slotu (`atEnemyBase(18, -14)`) *aynı* koruyu
tapıyor. Ele alınacak yer `08_MAP_AND_WORLD_DESIGN` / `03_ECONOMY_AND_RESOURCES`
tarafı, seçenekler:

1. Düşman tarafına ikinci bir koru author etmek (oyuncu tarafı simetrik olmalı),
2. `trees[].capacity`'yi yükseltmek (`denseForestTrees` zaten ikiye katlıyor),
3. Genişleme bölgelerinin üretim slotunu taze koruya taşımak,
4. AI'ın Market'i odun almak için kullanmasını `aiTradeManager`'a öğretmek
   (bugün yalnız çağ için eksik olan kaynağa ticaret yapıyor).

Bu bir denge/harita kararı, o yüzden veriyi kendi başıma değiştirmedim.

## 7. Sırada — oynanış doğrulaması (kod işi değil)

Faz 5'in son maddesi hâlâ açık: `?rts&debug` ile en az 5 maç. Panelde yeni iki
satır var (`çağ: town Lv2`, `şehir planı: %72 (saldırı çarpanı 0.81) · eksik …`)
ve `niyet puanları` altında saldırının nedeni artık adıyla okunuyor
(`çağ kapısı: town çağına ulaşılmadı`, `şehir gelişimi %60, güç oranı 1.40`).
Sonuç `GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` §53 kaydına, mevcut
4. madde formatında işlenmeli.

Denge için ilk bakılacak üç sayı:
`scoring.attack.developmentFloor` (0.35 — saldırının ne kadar kısıldığı),
`scoring.economy.developmentNeed` (0.45 — şehri bitirme baskısı),
`army.populationShare` (0.40 — ordu/ekonomi paylaşımı).

## 8. Kapsam dışı

- Ayrı baskın/kuşatma/savunma orduları (§51: AI-1 tek saha ordusu).
- Serbest biçimli şehir planlayıcı (§40: anchor tabanlı kalır).
- Yeni birim rolleri veya combat dengesi.
- Zorluk profilleri (`profiles`) — bu plan normal profili düzeltiyor; profil
  farklılaştırması ayrı iş.

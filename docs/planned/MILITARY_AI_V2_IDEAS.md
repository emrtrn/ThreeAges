# Üç Çağ: Sınır Krallıkları — Askerî AI v2 Planı

> **Belge türü:** AI davranış + teknik uygulama planı
> **Sürüm:** v2.0 (v1 fikir taslağının kod doğrulamasıyla revizyonu)
> **Kapsam:** AI ordusunun formasyon kullanımı, taktik faz, rol doktrinleri, geri
> çekilme ve lojistik temelli stratejik hedef seçimi
> **İlgili kod:** `src/game/rts/ai/`, `src/game/rts/units/formations/`,
> `src/game/rts/units/groupOrders.ts`, `public/game-data/balance/ai.json`
> **İlgili tasarım:** `GDD/07_ENEMY_AI_DESIGN_v0.2.md`,
> `docs/planned/FORMASYON_VE_TOPLU_SECIM_PANELI_TASARIM_PLANI.md`

---

## 0. Bu revizyonun dayanağı

v1 taslağı fikir olarak sağlamdı, fakat üç noktada mevcut kodla uyuşmuyordu.
Aşağıdaki tablo taslaktaki her ana iddianın kodda ne durumda olduğunu gösterir;
planın geri kalanı bu tabloya dayanır.

| v1 iddiası | Kodda durum | Sonuç |
| --- | --- | --- |
| "Mevcut formasyon sistemi AI için temel oluşturuyor" | Formasyonların **tek çağıranı oyuncu**: `commandSystem.ts:126`. `ArmyManager` birimlere tek tek emir veriyor | Önkoşul olarak **§2 grup-emri dikişi** eklendi |
| Geri çekilme sistemi kurulmalı (v1 §13) | **Zaten var**: `armyManager.ts` iki tetikleyici (`outmatched`/`attrition`), eşikler `ai.json`'da, panelde gerekçe yazılı | Yalnızca *geri çekilme hedefi* eksik → §11.4 |
| Formasyon hysteresis'i eklenmeli (v1 §7) | **Zaten var**: `ai.json` `evaluation.hysteresisMargin` + `minimumCommitmentSeconds` | Yeniden icat edilmeyecek, mevcut mekanizmaya bağlanacak |
| 8 etiketli slot taksonomisi gerekli (v1 §3) | `combatRoleGroups` zaten rol→derinlik bandı yapıyor; `square` topçuyu Chebyshev halka sıralamasıyla ortaya alıyor | Taksonomi **iptal**, mevcut bantlama genişletilecek → §4 |
| Topçu `navRadius`'u bütün formasyonu şişiriyor (v1 §4) | **Doğrulandı**: `groupOrders.ts:66` `max(navRadius*2)+0.6`, siege yarıçapı 1.5× | Aynen korundu, önceliği yükseltildi → §5 |
| `loose` topçuyu öne düşürüyor (v1 §5) | **Doğrulandı**: `loose`, rol-duyarlı dalları atlayan tek formasyon (`groupOrders.ts:122`) | Aynen korundu → §6 |
| Güç oranı eşikleri ayarlanmalı (v1 §12) | Eşikler zaten `ai.json`'da (`attackPowerRatio` 1.1 / risky 0.9 / retreat 0.8) | Kod işi değil, tuning. Yalnızca `matchupModifier` yeni → §13 |
| Topçu yapı hedeflemeli (v1 §9.3) | Kısmen var: `engagementSystem.ts:155` `prefersStructures` | Eksik olan *hangi* yapı → §10.3 |
| Pursuit leash gerekli (v1 §7) | Birim ölçeğinde var (`attack.chaseRange`, `engagementSystem.ts:94`) | Ordu ölçeğinde eksik → §10.4 |

**Ana sonuç:** AI şu an bir ordu değil, bir sürü. Formasyonla ilgili her fikrin
önkoşulu, AI'ın grup emri verebilmesidir.

---

## 1. Yaklaşım

AI'a mikro yönetim verilmeyecek. Hedef, hâlihazırda birbirinden bağımsız çalışan
şu kararları tek bir zincire bağlamak:

```text
niyet  →  görev (mission)  →  taktik faz  →  formasyon  →  hedef  →  rol davranışı
```

Üç değişmez ilke:

1. **AI ile oyuncu aynı emirleri kullanır.** `ArmyManager`'ın mevcut sözleşmesi
   budur (`setMovePath` / `setAttackTarget`) ve formasyon eklendiğinde de
   bozulmayacak: AI, oyuncunun sağ tıkının çağırdığı `assignGroupDestinations`'ı
   çağıracak, kendine ait paralel bir yerleştirme kodu yazmayacak.
2. **Karar mantığı saf ve veri-ayarlı olur.** `intentScorer.ts` ve
   `armyTargeting.ts` deseni: dünya erişimi yok, zaman yok, rastgelelik yok,
   ağırlıklar `ai.json`'da, her karar bir gerekçe string'i döndürür.
3. **AI yalnızca gördüğünü/hatırladığını kullanır.** `aiVisionFilter` disiplini
   yeni sistemlerde de geçerlidir (§17.2).

---

## 2. Önkoşul: AI'ın grup-emri dikişi

Bu, planın diğer her formasyon maddesinin bağlı olduğu tek teknik adımdır.

**Mevcut durum:** `ArmyManager.assault()` orduyu dolaşıp her birime en yakın
düşmanı verir. Ordu hiçbir zaman düzen almaz.

**Hedef:** `ArmyManager`, yürüyüş ve konuşlanma aşamalarında oyuncuyla aynı
yerleştirme yolunu kullansın:

```text
ArmyManager
  └─ assignGroupDestinations(army, point, navigation, [], formationId)
       └─ rtsFormationWorldSlots(...)   // oyuncuyla ortak
```

**Kritik ayrım — hangi fazda formasyon, hangi fazda serbest dövüş:**

| Faz | Emir kaynağı |
| --- | --- |
| `MARCH` / `APPROACH` / `DEPLOY` | Grup emri (formasyon slotları) |
| `ENGAGE` | Mevcut per-birim hedefleme (değişmez) |
| `REGROUP` | Grup emri (`loose`) |

Yani formasyon *temas öncesini* yönetir; temas anında mevcut savaş sistemi
devralır. Bu ayrım, `ENGAGE` sırasında formasyonu zorlamanın askerleri görünmez
lastiklerle slotlarına bağlaması riskini baştan ortadan kaldırır (§15).

**Performans şartı:** slot ataması O(birim × slot) çift üretir ve birim başına
bir `navigation.plan` çağırır. Ordu değerlendirmesi 0,75 sn'de bir koşuyor
(`ai.json` `evaluation.armySeconds`). Slotlar **her değerlendirmede değil**,
yalnızca şu üç durumda yeniden atanır:

- formasyon değiştiğinde,
- taktik faz değiştiğinde,
- kohezyon eşiği altına düştüğünde (§15).

---

## 3. Formasyon–taktik eşlemesi

| AI savaş niyeti | Tercih | İkinci seçenek |
| --- | --- | --- |
| Haritada ilerleme | `column` | `loose` |
| Açık alanda genel savaş | `line` | `crescent` |
| Menzilli ağırlıklı düşmana yaklaşma | `wedge` | `line` |
| Savunma / mevzi tutma | `square` | `line` |
| Topçuyu koruma | `square` | `line` |
| Düşmanı çevreleme | `crescent` | `line` |
| Dar yol / köprü / geçit | `column` | `line` |
| Yeniden gruplanma | `loose` | `column` |

**Temel kural:** `column` bir seyahat formasyonudur, savaş formasyonu değil.
Temas yaklaşırken AI mutlaka `line` / `wedge` / `crescent` / `square`'e geçer.
Bu geçiş oyuncuya AI'ın savaşa bilinçli hazırlandığı hissini veren tek en
görünür davranıştır.

---

## 4. Rol bantları (v1 §3'ün sadeleştirilmiş hâli)

v1'in sekiz etiketli slot taksonomisi (`front`, `front_flank`, `wing`,
`protected`, ...) uygulanmayacak. Gerekçe: `combatRoleGroups` zaten Muhafız →
Okçu → Topçu sırasını derinlik bandına çeviriyor ve `square` kırılgan birimleri
içeri alıyor. Taksonomi, çalışan bir çözümün üstüne ikinci bir kavram katmanı
koyar.

**Yapılacak:** mevcut bantlama iki noktada genişletilir.

1. `loose` bantlamaya dahil edilir (§6).
2. `wedge` bir "hücum kaması + destek kuyruğu" olarak ayrışır — bütün ordunun
   geometrik üçgen olması gerekmez:

```text
        G
      G G
    G G G
  G G G G      ← Muhafız kaması
    O O O
    O O O      ← destek hattı
      T T      ← topçu kuyruğu
```

---

## 5. Topçu kaynaklı aralık sorunu

**Doğrulanmış hata.** `groupOrders.ts:66`:

```text
spacing = max(birim.navRadius × 2) + 0.6
```

Siege yarıçapı diğer rollerin 1,5 katı (`unit.ts:187`). Tek bir topçu bütün
formasyonun aralığını açar.

**Çözüm — slot başına çarpışma aralığı:**

```text
Formasyon topolojisi
   ↓
Rol ataması
   ↓
Komşu slot çifti başına:  radiusA + radiusB + padding
```

Böylece topçunun yarıçapı yalnızca kendi bölgesini etkiler.

**Bu maddenin özel değeri:** formasyonlar bugün yalnızca oyuncu tarafında
kullanıldığı için bu düzeltme AI'a hiç dokunmadan, doğrudan oynanış kazancı
verir. Planın ilk işi olması bundandır.

---

## 6. `loose` formasyonunun rol-duyarlı hâle getirilmesi

**Doğrulanmış eksik.** `loose`, `assignFormationCombatDestinations` içinde
rol-duyarlı dalların tamamını atlayan tek formasyondur
(`groupOrders.ts:122-131`); `looseOffsets` saf bir index ızgarası + jitter'dır.
Sonuç: topçu öne düşebilir.

**Çözüm — üç görünmez bant:**

```text
Ön    %40  → ağırlıklı Muhafız
Orta  %35  → Muhafız + Okçu
Arka  %25  → Okçu + Topçu
```

Mevcut `1.9× spacing + deterministik jitter` mantığı bandın *içinde* korunur.
Dağınık görünüm kaybolmaz, taktik düzen rastgele olmaktan çıkar.

Jitter'ın deterministik kalması şarttır (§17.3).

---

## 7. Formasyon seçimi: utility skoru

`if/else` zinciri yerine puanlama. Bu, repoda zaten iki kez uygulanmış bir
desendir (`intentScorer.ts`, `armyTargeting.ts`), dolayısıyla yeni bir mimari
getirmez — yalnızca üçüncü bir kardeş modül ekler: `formationScorer.ts`.

```text
formationScore =
    missionFit      × w1
  + terrainFit      × w2
  + enemyFit        × w3
  + compositionFit  × w4
  + cohesionFit     × w5
  - transitionCost
```

Ağırlıklar `ai.json` → `army.formationWeights` altında yaşar (§17.1).

**Hysteresis yeniden yazılmaz.** `ai.json` `evaluation.hysteresisMargin` ve
`minimumCommitmentSeconds` zaten niyet seçiminde bu işi yapıyor; formasyon
seçimi aynı iki değeri kullanır. Ek bir "minimum kalma süresi" kavramı
tanımlanmayacak.

**Test kuralı:** örnek skorlar (kama 0,84 gibi) hiçbir teste sabitlenmez.
Testler *sözleşmeyi* doğrular: her formasyon puanlanabiliyor mu, ağırlık alanları
mevcut mu, hysteresis marjı altında geçiş oluyor mu (CLAUDE.md "contract, not
tuning").

---

## 8. Düşman kompozisyonu sınıfları

AI düşman ordusunu tek bir sınıfa indirger:

```text
MELEE_HEAVY · RANGED_HEAVY · SIEGE_HEAVY · BALANCED · WEAK · FORTIFIED
```

Bu sınıf `enemyFit` girdisidir:

| Düşman sınıfı | Yanıt |
| --- | --- |
| `RANGED_HEAVY` | `wedge` — Muhafız baskısı, okçu destek hattında, topçu arkada |
| `MELEE_HEAVY` (bizde menzil üstünlüğü varsa) | `crescent` |
| Çevrilme riski yüksek | `square` |
| `BALANCED`, açık alan | `line` |

Sınıflandırma yalnızca **görülen veya hatırlanan** birimlerden yapılır. Kaynak,
`ArmyManager`'ın halihazırda kullandığı `aiVisionFilter` + `enemyMemorySystem`
yoludur; yeni bir dünya erişimi açılmaz.

---

## 9. Taktik faz: mission'ın alt durumu

v1, mevcut `AiArmyMission` ile örtüşen ikinci bir durum makinesi öneriyordu. İki
state machine'i senkron tutmak sessizce bozulan türden bir borçtur. Bu planda
taktik faz **ayrı bir eksen değil**, saldırı görevlerinin alt durumudur.

```text
AiArmyMission (stratejik "neden" — mevcut, değişmez)
├─ defendBase
├─ contestObjective
├─ regroup            ← ASSEMBLE ve REGROUP'un karşılığı zaten burası
├─ harassEconomy  ┐
└─ assaultTarget  ┘── taktik faz (yeni, yalnızca bu ikisinin altında)
                       MARCH → APPROACH → DEPLOY → ENGAGE
                                            ↘ REPOSITION
```

- **`MARCH`** — hedefe seyahat, genellikle `column`.
- **`APPROACH`** — düşman eşiğe girdi; `enemyComposition`, `terrainWidth`,
  `friendlyComposition`, `powerRatio` okunur ve savaş formasyonu seçilir (§7).
- **`DEPLOY`** — temas öncesi düzen kurulur (`column → line` geçişi burada
  görünür).
- **`ENGAGE`** — formasyon serbest bırakılır; mevcut savaş sistemi devralır.
- **`REPOSITION`** — topçu ateş hattı kapandıysa, ordu bir engelin çevresinde
  sıkıştıysa veya formasyon yönü tehdit yönüyle uyumsuzsa.

`RETREAT` ve `PURSUE` yeni durum olarak eklenmez: geri çekilme zaten
`regroup` + `AiRetreatReason` ile modellenmiş (§0), takip ise §10.4'teki ordu
ölçeğinde leash'tir.

---

## 10. Rol doktrinleri

### 10.1 Muhafız — perdeleme

Muhafızın görevi yalnızca hasar vermek değil, topçu ve okçuyu perdelemektir.

```text
topçuyu tehdit eden düşman
  > okçuyu tehdit eden düşman
  > düşman ön hattı
  > diğer hedefler
```

### 10.2 Okçu — standoff

Okçu bir `standoff distance` korumaya çalışır. Düşman yaklaştığında her okçunun
bireysel kaçması yerine destek hattı **birlikte** geri taşınır — bu, §2'deki grup
emri dikişinin doğrudan bir kullanımıdır.

*Overkill limiter ertelendi.* `PendingImpactQueue` yalnızca havadaki mermileri
tutuyor; okçu vuruşları anlık çözüldüğü için `expectedIncomingDamage` girdisinin
bir kısmı henüz mevcut değil. Bu madde ancak anlık hasar da rezerve edilirse
uygulanabilir — kapsamı v1'de sanıldığından geniş, bu yüzden §19'a taşındı.

### 10.3 Topçu — mevzi ve hedef önceliği

```text
Hareket → mevziye ulaş → dur → ateş → yalnızca gerekirse yer değiştir
```

Topçunun yapı tercihi **zaten var** (`engagementSystem.ts:155`
`prefersStructures`). Eksik olan, hangi yapı olduğudur:

```text
Merkez > stratejik askerî yapı > Karakol > Depo > üretim yapısı
  > düşman topçusu > diğer birimler
```

Bu öncelik listesi yeni veri gerektirmez — `armyTargeting.ts` içindeki
`KIND_VALUE` tablosu aynı sınıfları zaten taşıyor.

### 10.4 Ordu ölçeğinde pursuit leash

Birim ölçeğinde leash var (`attack.chaseRange`). Eksik olan, ordunun tamamının
tek bir kaçan düşman peşinde güvenli bölgeden uzaklaşmasını engelleyen ordu
ölçeğinde bir sınırdır. Taktik faz `ENGAGE`'den çıkarken ordu centroid'i, görev
hedefinden belirli bir mesafeyi aşamaz.

---

## 11. Lojistik temelli stratejik hedef puanı

Planın en yüksek uzun vadeli değer taşıyan maddesi. Oyunun ayırt edici sistemi
(`Karakol + Depo + Yol + Dış Ekonomi`) AI'ın hedef seçimine girmediği sürece AI,
oyunun kendi kurallarını oynamıyor demektir.

### 11.1 Mevcut durum

`armyTargeting.ts` içindeki `KIND_VALUE` sınıf başına **statik** değer veriyor
(depo 0,8/0,6; karakol 0,3/0,9). Yani "depo değerlidir" biliniyor, "*bu* depo üç
üreticiyi besliyor" bilinmiyor.

### 11.2 Hedef

Mevcut skorlama şekli değişmeden `AiTargetCandidate`'e türetilmiş bir alan
eklenir:

```text
targetValue =
    militaryValue
  + economicDamage
  + logisticsDamage     ← yeni: bu hedefin kestiği akış
  + territoryDamage
  + victoryRelevance
  - travelRisk
```

Örnek etki (rakamlar tuning'dir, sözleşme değil):

| Hedef | Sınıf değeri | Lojistik etkisi | Toplam |
| --- | ---: | ---: | ---: |
| Ev | 20 | 0 | 20 |
| Tarla | 30 | 10 | 40 |
| Kışla | 60 | 0 | 60 |
| Depo | 40 | 80 | 120 |
| Karakol | 50 | 110 | 160 |

### 11.3 Veri kaynakları (hepsi mevcut)

- `DepotLogisticsSystem` — depoya bağlı üretici sayısı, yol bağlantısı
- `TerritoryControlSystem` — karakolun tuttuğu bölge
- `producerCaravanLanes` / `tradeSiteSystem` — kesilen kervan hattı

Yeni sistem yazılmaz; var olan sistemler salt-okunur sorgulanır.

### 11.4 Savunma tarafı ve geri çekilme hedefi

Aynı puan AI'ın kendi yapılarını savunmasında kullanılır: oyuncu aynı anda
Kışla ve Karakol'a baskı yapıyorsa ve Karakol'un düşmesi iki maden + bir depo +
bir yol koridoru kaybı demekse, AI Karakol'u savunur.

Aynı bilgi geri çekilme hedefini de belirler. Mevcut `moveToRally` yalnızca
merkezin düşman tarafına gidiyor; öncelik şu olmalı:

```text
yakın güvenli Karakol → takviye noktası → Kışla bölgesi → Merkez
```

Geri çekilme *tetikleyicileri* zaten var (§0); bu madde yalnızca *nereye*
sorusunu cevaplar.

---

## 12. Kohezyon

```text
cohesion = atanmış slotuna yeterince yakın birim oranı
```

Savaş dışındayken `cohesion` eşik altına düşerse `regroup` tetiklenir ve slotlar
yeniden atanır (§2'deki üç yeniden-atama koşulundan biri).

Faza göre disiplin:

```text
MARCH / DEPLOY → yüksek
ENGAGE         → disiplin yok (formasyon serbest)
REGROUP        → yüksek
```

---

## 13. Kompozisyona duyarlı güç oranı

Eşikler (`attackPowerRatio` 1.1 / `riskyAttackPowerRatio` 0.9 /
`retreatPowerRatio` 0.8) **zaten `ai.json`'da**. Bunları değiştirmek kod işi
değil, tuning'dir ve bu planın kapsamı dışındadır.

Kodda yeni olan tek şey `matchupModifier`'dır:

```text
effectivePower = unitPower × matchupModifier × healthRatio
```

`armyPower` bugün `rolePower × healthRatio` hesaplıyor; eklenecek olan, rol
karşılaşmalarının (ör. okçu ağırlıklı ordu karşısında muhafız ağırlıklı ordunun
değeri) tabloya girmesidir. Formasyon ve konum çarpanları (v1'in
`formationModifier` / `positionalModifier` önerisi) ilk sürümde eklenmez — tam
savaş simülasyonuna doğru kayma riski taşırlar.

---

## 14. Arazi farkındalığı

Nav/grid sisteminden iki değer yeterlidir:

```text
availableWidth · obstacleDensity
```

```text
dar arazi        → column
geniş açık arazi → line / crescent / wedge
```

Köprü akışı: `column → geç → konuşlanma alanı bul → line → engage`.

**Neden ertelendi:** bu iki değerin türetme maliyeti henüz ölçülmedi ve
`docs/planned/` altındaki kare maliyeti bulguları, navigasyon sorgularının
ucuz sanılıp pahalı çıkabildiğini gösteriyor. §7'deki `terrainFit` girdisi bu
madde gelene kadar sabit bir değerle beslenir; skorlayıcının şekli değişmez.

---

## 15. Formasyon disiplininin sınırı

Formasyon askerleri görünmez lastiklerle slotlarına bağlamamalıdır. Bu planda
riskin kaynağı yapısal olarak kesilmiştir: formasyon yalnızca temas öncesi
fazlarda emir üretir, `ENGAGE` sırasında hiç emir vermez (§2).

---

## 16. Debug paneli

`formatRtsAiDebug` saf bir formatlayıcıdır ve engine testi vardır; ekleme
ucuzdur.

```text
Askerî durum: ENGAGE          Görev: assaultTarget
Formasyon: WEDGE

Formasyon puanları:
  line 0.61 · column 0.12 · *wedge 0.84 · crescent 0.49 · square 0.38 · loose 0.22

Gerekçe: düşman menzilli oranı 0.56 · açık alan 0.82 · dost muhafız oranı 0.60
Güç oranı: 1.18 · Kohezyon: 0.87

Hedef: düşman okçu grubu — ön hat tehdidi + açıkta menzilli birlikler
```

Amaç tek bir soruya cevap verebilmek: **"AI neden bu kararı verdi?"**

---

## 17. Teknik kısıtlar

Bunlar v1'de yoktu ve atlanırsa sessiz hatalara yol açar.

### 17.1 `ai.json` alanları doğrulanmadan eklenmez

Yeni her ağırlık `src/game/data/validateGameData.ts` içindeki ilgili
`validateAi*` fonksiyonuna eklenmelidir (`validateAiTargetWeights` civarı).
Eklenmezse alan sessizce düşer. Ayrıca CLAUDE.md kuralı gereği anlamsız değerler
(negatif ağırlık, sıfır band) burada dosya ve alan adı verilerek reddedilir.

### 17.2 Fog disiplini

Lojistik grafiğini (§11) canlı sorgulamak, `aiVisionFilter`'ın koruduğu "AI
yalnızca gördüğünü bilir" kuralını sessizce deler. Bağlantı bilgisi de
`enemyMemorySystem` üzerinden geçmeli; görülmemiş bir depo bağlantısı hedef
puanını yükseltmemelidir.

### 17.3 Determinizm (GDD §80)

Her yeni sıralama — formasyon puanları, slot atamaları, hedef adayları —
deterministik bir tie-break taşımalıdır (id veya index). Mevcut kod bunu her
yerde yapıyor; yeni kod da yapmalı, yoksa hızlandırılmış maç testleri
kararsızlaşır.

### 17.4 Test tier'ı

AI karar kodu değişiklikleri `hızlı` tier'da bile
`npm run test:engine -- --filter "Faz 8"` gerektirir (CLAUDE.md). Bu planın 2-4.
fazları bu yavaş kontrollere düşecektir; buna göre plan yapılmalı.

### 17.5 Mevcut formasyon testleri

`tools/engine-tests.ts` içinde formasyon geometrisi ve slot ataması için
hâlihazırda kontroller var (~45117-45565 satır aralığı). §5 ve §6'daki geometri
değişiklikleri bu kontrollerle çakışabilir; sözleşme değişiyorsa test güncellenir,
tuning değişiyorsa test zaten sabit sayı tutmuyor olmalıdır.

### 17.6 İki taraf varsayımı yok

`retaliateAgainstAttack` yaban hayatı/avcı sistemi için genişletildi. Formasyon
ve hedefleme kodu "sahada yalnızca `player` ve `enemy` var" varsayamaz.

---

## 18. Faz planı

Sıra, bağımlılık ve erken görünür kazanca göre belirlendi.

> **Durum: Faz 0–4 uygulandı.** Aşağıdaki her madde kodda karşılığını buldu;
> sapmalar madde altında not edildi. Dosya haritası ve doğrulama §21'de.

### Faz 0 — Formasyon temizliği *(AI'a dokunmaz)* — ✅

- ✅ §5 topçu kaynaklı aralık sorunu (slot başına çarpışma aralığı)
- ✅ §6 `loose` rol bantları

Her ikisi de doğrulanmış hatadır ve formasyonlar bugün yalnızca oyuncu tarafında
kullanıldığı için **anında oynanış kazancı** verir. AI çalışmasının önkoşulu
değildir; bu yüzden en başta.

*Uygulama notu (§5):* çözüm iki parçalı. Izgara artık *tipik* birime göre
kuruluyor (`formationBaseSpacing`, üst medyan yarıçap — tek rollü bir grupta
eski davranışla bit düzeyinde aynı), komşu slot çiftleri ise gerçekten
gerektiğinde `relaxSlotSpacing` ile açılıyor. Rol bandı başına ayrı aralık
(`line` rütbeleri, `wedge` kuyruğu) doğrudan `radiusA + radiusB + padding`
kullanıyor.

*Uygulama notu (§6):* üç sabit yüzdelik bant yerine, `loose` slotları ileri
projeksiyona göre sıralanıp Muhafız → Okçu → Topçu sırasıyla dolduruluyor.
Sevkedilen kompozisyon oranında sonuç plandaki %40/%35/%25 bandına denk düşüyor,
fakat bant sınırı orduya göre kayıyor — 12 muhafız 2 topçuyla yürüdüğünde
"ön %40" kuralı topçuyu orta banda çekerdi. Jitter ve slot konumları
değişmedi (§17.3).

### Faz 1 — AI grup-emri dikişi — ✅

- ✅ §2 `ArmyManager` → `assignGroupDestinations`
- ✅ §9 taktik fazın iskeleti (`march` / `approach` / `deploy` / `engage` /
  `reposition`)
- ✅ §4 `wedge` kama + destek kuyruğu

Planın geri kalanının önkoşulu.

*Uygulama notu (§9):* `engage`, plandaki "düşman eşiğe girdi" koşuluna ek olarak
**hedefin kendisine varmakla** da tetikleniyor. Aksi hâlde savunmasız bir
tarlaya yürüyen ordu düzgün bir hat kurup ona hiç vurmuyordu.

*Uygulama notu (§2 performans):* slotlar formasyon / faz / ordu büyüklüğü /
hedef değiştiğinde yeniden kesiliyor; hedef `SLOT_TARGET_STEP` ile
kuantalanıyor. Kohezyon eşiği ayrıca bir tetikleyici ama en fazla
`COHESION_REASSIGN_SECONDS`'ta bir — ve kohezyon *durmuş* birimler üzerinden
ölçülüyor, yoksa her normal yürüyüş "dağıldı" okunup her değerlendirmede
yeniden plan yapardı.

### Faz 2 — Formasyon kararı — ✅

- ✅ §7 `formationScorer.ts` + `ai.json` ağırlıkları + mevcut hysteresis'e bağlama
- ✅ §8 düşman kompozisyon sınıfları
- ✅ §16 panel satırları

*Uygulama notu (§7):* `minimumCommitmentSeconds` bağlılığı **faza kapsamlı**.
Kol düzeninde yürüyen ordu konuşlanma halkasına girdiğinde hatta geçmesi
stratejiye ait bir sayaç yüzünden gecikmemeli — planın "en görünür davranış"
dediği geçiş tam olarak budur. Histerezis marjı çarpımsal değil toplamsal
uygulandı: negatif puanda `× (1 + marj)` *daha kötü* olanı kazandırır.

*Uygulama notu (§7 ağırlıkları):* `missionFit` 1.6'ya çekildi. 1.0'da §3'ün
"Kol bir seyahat formasyonudur" temel kuralı tutmuyordu — `enemyFit` yürüyüş
sırasında hattı öne geçiriyordu.

### Faz 3 — Lojistik zekâsı — ✅

- ✅ §11.2/11.3 `logisticsDamage` alanı ve veri kaynakları
- ✅ §11.4 savunma önceliği ve geri çekilme hedefi

Planın en yüksek uzun vadeli değeri burada.

*Uygulama notu (§11.3):* yeni sistem yazılmadı ve yeni bir dünya kaynağı
açılmadı — blackboard zaten `ProductionLogisticsSystem` okuyor, ordu da aynı
kaynaktan tek bir soruya daraltılmış bir görünüm alıyor
(`AiLogisticsWatch.producersServedBy`). Bölge değeri hedefin kendi balance
satırından (`territory.controlRadius`) geliyor: Karakol'u görmek zaten onun yer
tuttuğunu görmektir, dolayısıyla fazladan bilgi sızmıyor.

*Uygulama notu (§17.2):* üretici listesi `enemyMemorySystem`'in hatırladığı
küme ile kesiştiriliyor; görülmemiş bir üretici, hatırlanan deponun puanını
yükseltmiyor.

### Faz 4 — Doktrin ince ayarı — ✅

- ✅ §10.1 Muhafız perdeleme
- ✅ §10.2 Okçu standoff
- ✅ §10.3 Topçu yapı hedef önceliği
- ✅ §10.4 ordu ölçeğinde leash
- ✅ §12 kohezyon / regroup
- ✅ §13 `matchupModifier`

*Uygulama notu (§10.3):* yapı sınıflandırması artık tek bir yerde
(`structureRoleFor`) — stratejik hedef puanı ile sahadaki topçunun hedef seçimi
aynı tabloyu okuyor. `CombatTarget`'a isteğe bağlı `buildingStats` eklendi
(`stats` adı `Unit`'te zaten farklı bir tiple dolu). Yan etki: `archery_range`
artık `support` değil `military` sınıfında — §60 #4'ün "askerî üretim"
tanımıyla tutarlı.

*Uygulama notu (§12):* kohezyon **slot yeniden atama** tetikleyicisi olarak
uygulandı, `regroup` *görevini* tetiklemiyor. Uzun bir yürüyüşte gerilmiş ordu
görev seviyesinde geri çekilseydi, saldırıyı hiç tamamlayamazdı; plandaki
"REGROUP → grup emri (`loose`)" satırı ise aynen uygulandı.

*Uygulama notu (§13):* `matchupModifier`, blackboard'un §52 gücünü *değiştirmek*
yerine ona bir çarpan olarak uygulanıyor. Blackboard'un "ordum ne kadar büyük"
cevabı ekonomi ve nüfus tavanı tarafından da okunuyor; aynı ordu hakkında iki
farklı sayı üretmek, iki cevaptan herhangi birinden kötüdür. Görülen düşman
yoksa çarpan tam olarak 1.

*Ertelendi (§10.2):* okçu overkill limiter uygulanmadı — `PendingImpactQueue`
yalnızca havadaki mermileri tutuyor, anlık vuruşlar rezerve edilmiyor. §19'daki
gerekçe hâlâ geçerli.

---

## 19. Kapsam dışı / ertelenen

| Madde | Gerekçe |
| --- | --- |
| 8 etiketli slot taksonomisi (v1 §3) | Çalışan `combatRoleGroups` bantlamasının üstüne ikinci kavram katmanı; §4 ile karşılandı |
| Ayrı taktik durum makinesi (v1 §6) | `AiArmyMission` ile örtüşüyor; iki state machine senkron borcu üretir. §9 alt-durum olarak çözdü |
| Okçu overkill limiter (v1 §9.2) | Anlık hasar rezerve edilmiyor; `PendingImpactQueue` yalnızca havadaki mermileri tutuyor |
| Arazi farkındalığı (v1 §16) | Türetme maliyeti ölçülmedi; §7 sabit `terrainFit` ile çalışır (§14) |
| `formationModifier` / `positionalModifier` (v1 §12) | Tam savaş simülasyonuna kayma riski; §13 yalnızca `matchupModifier` alıyor |
| Güç oranı eşiklerinin değiştirilmesi (v1 §12) | Kod değil tuning; değerler zaten `ai.json`'da |
| Geri çekilme tetikleyicileri (v1 §13) | Zaten uygulanmış; yalnızca hedef seçimi eksikti (§11.4) |

---

## 20. Özet

Formasyonlar AI'ın savaşta daha iyi *görünmesini* sağlar. Ama AI'ı gerçek bir
rakip yapan şey şu cümleyi kurabilmesidir:

> "Bu Karakolu yok edersem rakibin iki madenini ekonomiden koparırım."

Faz 0 bugünkü oyunu düzeltir, Faz 1-2 AI'ı bir orduya çevirir, Faz 3 onu bu
oyunun rakibi yapar.

---

## 21. Uygulama haritası

### Yeni dosyalar

| Dosya | Madde |
| --- | --- |
| `src/game/rts/units/formations/slotSpacing.ts` | §5 slot başına çarpışma aralığı |
| `src/game/rts/ai/formationScorer.ts` | §7 formasyon puanı, §8 kompozisyon sınıfları |
| `src/game/rts/structures/structureRole.ts` | §10.3 + §60 için tek yapı sınıflandırması |

### Değişen dosyalar

| Dosya | Madde |
| --- | --- |
| `src/game/rts/units/groupOrders.ts` | §5, §6, §4 — geometri/rol/eşleme/aralık ayrımı |
| `src/game/rts/ai/armyManager.ts` | §2, §9, §10.1, §10.2, §10.4, §11.4, §12, §13 |
| `src/game/rts/ai/armyTargeting.ts` | §11.2 `logisticsDamage` |
| `src/game/rts/ai/aiBlackboard.ts` | §13 `matchupModifier`, `roleCounts` |
| `src/game/rts/ai/aiController.ts` | §11.3 lojistik görünümü, snapshot alanları |
| `src/game/rts/ai/aiDebugView.ts` | §16 panel satırları |
| `src/game/rts/ai/aiTypes.ts` | §9 `AiTacticalPhase` |
| `src/game/rts/ai/aiDecisionLog.ts` | §7 `army-formation` karar türü |
| `src/game/rts/combat/engagementSystem.ts`, `combatTarget.ts` | §10.3 |
| `src/game/data/gameDataTypes.ts`, `validateGameData.ts` | §17.1 |
| `public/game-data/balance/ai.json` | `army.formationWeights`, `army.tactics`, `targetWeights.logisticsValue` |

### Yeni `ai.json` alanları

Hepsi `validateAiBalance` üzerinden doğrulanıyor (§17.1) — eksik terim, bilinmeyen
terim, negatif ağırlık ve sırasız mesafe halkaları dosya + alan adı verilerek
reddediliyor.

```text
army.formationWeights   missionFit · terrainFit · enemyFit
                        compositionFit · cohesionFit · transitionCost
army.tactics            approachDistance · deployDistance · engageDistance
                        cohesionRadius · cohesionThreshold · pursuitLeash
                        archerStandoff
army.targetWeights      + logisticsValue
```

### Testler

`tools/engine-tests.ts` içinde 11 yeni kontrol, hepsi `Askerî AI v2` önekiyle
filtrelenebiliyor. CLAUDE.md kuralı gereği hiçbiri bir büyüklüğü sabitlemiyor:
ilişkiler (kama ucu Muhafızdır, akış taşıyan depo taşımayanı geçer), türetmeler
(slot aralığı birimlerin kendi `navRadius`'undan hesaplanıyor) ve sözleşmeler
(her formasyon puanlanabiliyor, her puan bir gerekçe taşıyor, her yeni alan
doğrulanıyor) test ediliyor.

Sözleşmesi değiştiği için güncellenen mevcut kontroller: §54 ve §60 artık
"birime saldırı emri verildi" yerine "grup emriyle hedefe yürüdü" ölçüyor —
§2'nin doğrudan sonucu.

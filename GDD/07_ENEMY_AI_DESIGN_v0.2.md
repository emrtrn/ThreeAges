# 07 — Enemy AI Design

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Düşman AI Tasarımı  
> **Sürüm:** 0.2  
> **Durum:** Kapsamı sadeleştirilmiş üretim taslağı  
> **Hedef:** Önce oynanış kanıtı, ardından tam vertical slice AI  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `03_ECONOMY_AND_RESOURCES.md`  
> - `04_BUILDINGS_AND_SETTLEMENT.md`  
> - `05_TERRITORY_LOGISTICS_AND_ROADS.md`  
> - `06_UNITS_AND_COMBAT.md`  
> - `08_MAP_AND_WORLD_DESIGN.md`  
> - `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`  
> - `12_BALANCE_AND_GAME_DATA.md`  
> - `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`

---

## 1. Dokümanın Amacı

Bu doküman, tek oyunculu maçtaki düşman krallığını yöneten AI sisteminin sadeleştirilmiş tasarımını tanımlar.

Ana amaç, mümkün olan en gelişmiş AI’ı üretmek değildir. Amaç:

> Oyunun ekonomi, yol, karakol, genişleme ve savaş döngülerini kullanarak baştan sona geçerli bir maç oynayabilen, davranışı anlaşılır ve teknik olarak güvenilir bir rakip üretmektir.

Bu belge şu sorulara cevap verir:

- AI hangi ana modüllerden oluşur?
- AI neden üç karar katmanıyla sınırlandırılmıştır?
- AI’ın yalnızca beş ana stratejik niyet arasında seçim yapması nasıl çalışır?
- Ekonomi, yapılaşma, çağ atlama ve genişleme nasıl sadeleştirilir?
- AI yol ve karakol kararlarını serbest arama yerine nasıl güvenilir biçimde verir?
- Tek saha ordusu yaklaşımı nasıl çalışır?
- AI ne zaman savunur, saldırır veya geri çekilir?
- Fog of war hangi üretim aşamasında devreye girer?
- İlk oynanış kanıtı ile final vertical slice AI arasındaki fark nedir?
- AI nasıl debug edilir, test edilir ve dengelenir?

Bu belge, önceki sürümdeki dört katmanlı ve çok sayıda eşzamanlı plan yürüten kapsamı bilinçli olarak daraltır.

---

## 2. Tasarım Kararı Özeti

Bu sürümde alınan ana kararlar:

1. AI üç katmana ayrılır:
   - Krallık Yöneticisi
   - Ordu Yöneticisi
   - Birim AI
2. Ayrı bir operasyonel karar katmanı kullanılmaz.
3. AI yalnızca beş ana stratejik niyet arasından seçim yapar:
   - Economy
   - AgeUp
   - Expand
   - Defend
   - Attack
4. AI aynı anda yalnızca bir ana stratejik plan yürütür.
5. Ekonomi, yapı ve lojistik alt sistemleri plan üretmez; ana planı uygulayan yöneticilerdir.
6. İlk sürümde tek bir saha ordusu kullanılır.
7. Ayrı baskın, kuşatma ve savunma orduları ilk kapsamda bulunmaz.
8. El yapımı haritada önceden tanımlı yapı alanları, genişleme bölgeleri ve yol rotaları kullanılır.
9. Serbest biçimli genel amaçlı yapı ve yol planlayıcı ilk vertical slice için zorunlu değildir.
10. Fog of war desteği oynanış kanıtından sonra eklenir.
11. Normal zorluk gizli kaynak bonusu kullanmaz.
12. Debug paneli, karar logları ve hızlandırılmış simülasyon zorunludur.

---

## 3. AI Tasarım Hedefi

AI rakip oyuncuya şu hissi vermelidir:

> “Rakibim kendi ekonomisini kuruyor, değerli bölgelere genişliyor, ordumu ve sınırlarımı dikkate alıyor ve açık verdiğimde harekete geçiyor.”

AI’ın başarılı kabul edilmesi için insan gibi oynaması gerekmez.

AI:

- güvenilir bir açılış yapmalı,
- kaynak darboğazlarını çözebilmeli,
- nüfus sınırında takılmamalı,
- geçerli alanlara bina kurmalı,
- karakol ve yol ile en az bir kez genişlemeli,
- çağ atlamalı,
- ordu üretmeli,
- merkezi veya dış ekonomiyi savunmalı,
- uygun durumda saldırmalı,
- ağır dezavantajda geri çekilmeli,
- askerî veya bölgesel zafer tehdidine tepki vermelidir.

AI’ın ilk hedefi “çok zeki” görünmek değil, tutarlı ve okunabilir görünmektir.

---

# BÖLÜM A — TASARIM İLKELERİ

## 4. Oyuncuyla Aynı Temel Kurallar

Normal zorlukta AI mümkün olduğunca oyuncuyla aynı kuralları kullanır:

- aynı kaynak türleri,
- aynı yapı ve birim maliyetleri,
- aynı üretim ve inşaat süreleri,
- aynı nüfus sınırı,
- aynı çağ gereksinimleri,
- aynı kontrol alanı kuralları,
- aynı yol ve lojistik bağlantı kuralları,
- aynı görüş ve fog of war kuralları,
- aynı zafer ve yenilgi koşulları.

AI’a özel araçlar yalnızca karar vermeyi kolaylaştırmak için kullanılabilir. Bu araçlar doğrudan ekonomik avantaj üretmemelidir.

Örnek:

- AI yapı alanı adaylarını harita verisinden okuyabilir.
- AI geçerli yol rotalarını hazır rota grafiğinden seçebilir.
- AI oyuncunun gizli kaynak stoğunu okuyamaz.

---

## 5. Okunabilir Davranış

Oyuncu AI’ın hesaplamalarını görmez; ancak eylemin nedenini anlayabilmelidir.

Okunabilir örnekler:

- altın ihtiyacı arttığında altın bölgesine genişlemesi,
- merkez saldırı altındayken ordusunu geri çağırması,
- nüfus sınırına yaklaşınca ev kurması,
- karakol bağlantısı kesilince yolu veya depoyu onarması,
- oyuncu bölgesel zafer sayacı başlatınca stratejik noktaya ilerlemesi,
- ağır kayıp sonrası saldırı yerine ekonomiye dönmesi.

Kaçınılacak davranışlar:

- görünür neden olmadan plan değiştirme,
- aynı noktaya art arda başarısız saldırı,
- tehdit yokken tüm ordunun üs içinde beklemesi,
- küçük bir saldırıya bütün ekonomiyi durdurarak cevap verme,
- yapı yeri bulunamadığında sonsuz tekrar.

---

## 6. Az Sayıda Güvenilir Karar

Vertical slice için AI’ın karar uzayı bilinçli olarak küçültülür.

AI:

- onlarca stratejik durum taşımaz,
- aynı anda çok sayıda bağımsız ordu yürütmez,
- geniş teknoloji ağını optimize etmez,
- oyuncu stilini uzun vadeli öğrenmez,
- karmaşık kıskaç veya sahte saldırı planlamaz.

Bunun yerine az sayıda kararın güvenilir biçimde uygulanması hedeflenir.

---

## 7. Plan Kararlılığı

AI her değerlendirmede plan değiştirmemelidir.

Her ana plan:

- minimum bağlılık süresine,
- tamamlanma veya başarısızlık koşuluna,
- kaynak rezervasyonuna,
- acil durum kesme kuralına

sahip olur.

Varsayılan karar:

```text
Yeni plan puanı, mevcut plan puanından en az %25 yüksek değilse
mevcut plan devam eder.
```

İstisnalar:

- merkez saldırı altında,
- bölgesel yenilgi sayacı kritik,
- ana ordu yok edildi,
- tüm yiyecek üretimi durmuş,
- nüfus tamamen kilitlenmiş.

---

## 8. Aşamalı Gerçekçilik

AI özellikleri tek seferde tamamlanmaz.

Üretim sırası:

```text
Oynanış Kanıtı AI
→ Çekirdek Rakip AI
→ Vertical Slice AI
→ Gelişmiş AI, gerekirse
```

Her aşama baştan sona oynanabilir maç üretmelidir.

---

# BÖLÜM B — AI KAPSAM AŞAMALARI

## 9. Aşama AI-0 — Teknik Hedef

Amaç:

- seçim,
- hareket,
- hasar,
- üretim,
- hedefe saldırı

sistemlerini doğrulamak.

Davranış:

```text
Pasif gelir al
→ Muhafız üret
→ Güç eşiğine ulaş
→ Sabit hedefe saldır
→ Kayıp sonrası yeniden üret
```

Bu aşama gerçek rakip olarak değerlendirilmez.

---

## 10. Aşama AI-1 — Oynanış Kanıtı

Amaç:

Yol, karakol, dış ekonomi ve savaş bağlantısının eğlenceli olup olmadığını erken doğrulamak.

Önerilen kapsam:

- iki kaynak: yiyecek ve odun,
- tek gelişim seviyesi veya sınırlı T1–T2 geçişi,
- merkez, ev, depo, üretim yapısı, kışla ve karakol,
- tek yol seviyesi,
- işçi ve muhafız,
- tek askerî zafer,
- fog of war yok,
- minimap yok,
- tek saha ordusu,
- tek genişleme bölgesi.

AI davranışı:

```text
Ekonomiyi kur
→ Nüfusu yönet
→ Karakolla bir kez genişle
→ Yol bağlantısı kur
→ Muhafız üret
→ Üssünü savun
→ Oyuncu merkezine saldır
```

AI-1 tamamlanmadan dört kaynaklı ve üç çağlı AI’a geçilmemelidir.

---

## 11. Aşama AI-2 — Çekirdek Rakip

Amaç:

Tam ekonomiye yakın, düzenli ve tekrar oynanabilir rakip üretmek.

Kapsam:

- dört kaynak,
- Yerleşim ve Kasaba,
- temel bina listesi,
- karakol ve yol ile en az bir genişleme,
- işçi, muhafız ve okçu,
- savunma ve saldırı,
- sınırlı geri çekilme,
- askerî zafer,
- basitleştirilmiş keşif bilgisi.

Bu aşamada:

- serbest fog of war zorunlu değildir,
- bölgesel zafer zorunlu değildir,
- ayrı baskın ordusu yoktur,
- süvari ve kuşatma opsiyoneldir.

---

## 12. Aşama AI-3 — Vertical Slice Rakibi

Final vertical slice hedefi:

- dört kaynak,
- üç gelişim seviyesi,
- tam temel bina kadrosu,
- karakol ve yol genişlemesi,
- muhafız, okçu ve kuşatma,
- süvari yalnız kapsam uygunsa,
- fog of war ve son bilinen bilgi,
- askerî zafer,
- bölgesel zafer tehdidine tepki,
- kolay, normal ve zor parametreleri,
- tam debug ve telemetri.

AI-3, AI-1 ve AI-2 üzerine eklenmelidir; ayrı bir sistem olarak yeniden yazılmamalıdır.

---

# BÖLÜM C — AI MİMARİSİ

## 13. Üç Katmanlı Mimari

AI üç karar katmanına ayrılır:

1. Krallık Yöneticisi
2. Ordu Yöneticisi
3. Birim AI

Ekonomi, yapı ve lojistik yöneticileri bağımsız stratejik katman değildir. Krallık Yöneticisinin seçtiği planı uygular.

---

## 14. Krallık Yöneticisi

`KingdomDirector`, AI’ın maç genelindeki tek ana karar merkezidir.

Sorumlulukları:

- mevcut durumu değerlendirmek,
- beş stratejik niyetten birini seçmek,
- hedef bütçeleri belirlemek,
- ana planı oluşturmak,
- ekonomi ve yapı yöneticilerine hedef vermek,
- Ordu Yöneticisine görev atamak,
- plan başarısını veya başarısızlığını değerlendirmek.

Karar sıklığı:

- normal değerlendirme: 3–6 saniye,
- önemli olaylarda: olay tabanlı,
- acil savunma: kısa gecikmeyle.

Krallık Yöneticisi tek tek birimlere komut vermez.

---

## 15. Ordu Yöneticisi

`ArmyController`, AI’ın saha ordusunu yönetir.

İlk kapsamta tek ana saha ordusu bulunur.

Sorumlulukları:

- uygun askerleri ana orduya toplamak,
- minimum üs savunmasını korumak,
- görev rotasını seçmek,
- hedefe ilerlemek,
- çatışmaya girme kararını vermek,
- hedef önceliklerini uygulamak,
- geri çekilmek,
- yeniden toplanmak.

Görev türleri:

```text
DefendBase
DefendExpansion
ContestObjective
HarassEconomy
AssaultTarget
Regroup
```

`HarassEconomy`, ayrı bir baskın ordusu anlamına gelmez. Ana ordunun kısa süreli görev türüdür.

---

## 16. Birim AI

`UnitAI`, yerel hareket ve savaş davranışını yürütür.

Sorumlulukları:

- verilen konuma hareket,
- saldırı menziline girme,
- yerel hedef seçimi,
- saldırı animasyonu ve hasar zamanı,
- yakın engelden kaçınma,
- kovalamayı bırakma,
- işçi görevini yürütme,
- tahliye noktasına gitme.

Birim AI:

- stratejik plan seçmez,
- kendi başına bölge değiştirmez,
- Krallık Yöneticisinin planını iptal etmez.

---

## 17. Uygulayıcı Yöneticiler

Aşağıdaki modüller karar katmanı değil, uygulama servisidir:

### EconomyManager

- işçi hedeflerini hesaplar,
- işçi atamalarını uygular,
- darboğaz bildirir,
- güvenlik stoğunu izler.

### BuildManager

- yapı kuyruğunu yürütür,
- aday yapı alanı seçer,
- inşaat işçisi atar,
- bloke planı raporlar.

### ExpansionManager

- bölge adaylarını puanlar,
- genişleme reçetesini yürütür,
- karakol ve yol bağlantısını kurar,
- başarısız bölgeyi geçici olarak kara listeye alır.

### ProductionManager

- işçi ve asker kuyruklarını yönetir,
- nüfus kilidini önler,
- ordu kompozisyon hedefine yaklaşır.

Bu yöneticiler aynı anda yeni stratejik hedef seçemez.

---

## 18. Katmanlar Arası Akış

```text
AIWorldModel
→ KingdomDirector stratejik niyet seçer
→ Plan ve bütçe oluşturulur
→ Uygulayıcı yöneticilere görev verilir
→ ArmyController saha görevini yürütür
→ UnitAI yerel komutları uygular
→ Sonuçlar ve hatalar WorldModel’e döner
```

---

# BÖLÜM D — DÜNYA MODELİ VE BİLGİ SINIRLARI

## 19. Minimal Blackboard

Blackboard yalnız karar için gerekli bilgileri taşımalıdır.

Önerilen alanlar:

```text
CurrentAge
ResourceStocks
ResourceIncomeRates
WorkerCount
IdleWorkerCount
Population
PopulationCap
BuildingCounts
DisconnectedBuildings
OwnedRegions
ActiveExpansion
KnownEnemyAge
KnownEnemyTargets
EnemyLastKnownArmyPower
OwnArmyPower
BaseThreat
ExpansionThreat
StrategicPointState
CurrentIntent
CurrentPlan
PlanStartTime
RecentPlanFailures
EmergencyFlags
```

İlk sürümde kullanılmayan veri blackboard’a eklenmemelidir.

---

## 20. Bilgi Kaynakları

AI bilgiye şu kaynaklardan ulaşır:

- kendi birimleri ve yapıları,
- kendi ekonomi raporları,
- görüş alanındaki düşmanlar,
- keşfedilmiş bölgeler,
- hasar ve saldırı olayları,
- stratejik nokta sahipliği,
- bağlantı kaybı olayları,
- genel maç duyuruları.

AI doğrudan şu bilgileri okuyamaz:

- oyuncunun görünmeyen birimleri,
- oyuncunun gerçek zamanlı kaynak stoğu,
- fog arkasındaki yeni yapıların konumu,
- görünmeyen ordunun kesin gücü.

---

## 21. Fog of War Üretim Kararı

Fog of war üç aşamada ele alınır.

### AI-1

- Fog kullanılmaz.
- Ama AI yine oyuncunun kaynak stoğunu veya üretim kuyruğunu okumaz.
- Amaç çekirdek oynanışı test etmektir.

### AI-2

- Bölge bazlı basit keşif durumu kullanılabilir.
- AI yalnız keşfedilmiş hedefleri planlar.
- Düşman yapılarının konumu son bilinen veri olarak saklanabilir.

### AI-3

Tam durumlar:

```text
Unknown
Explored
Visible
Stale
```

Son bilinen bilgi:

- konum,
- son görülme zamanı,
- tahmini güç,
- güven seviyesi

saklar.

Bilgi güveni zamanla düşer.

---

## 22. Bilgi Eskimesi

Örnek güven süreleri:

```text
0–30 sn: Yüksek güven
30–90 sn: Orta güven
90+ sn: Düşük güven
```

Kesin süreler veri dosyasından okunmalıdır.

Düşük güvenli hedef:

- ana saldırı için tek başına yeterli değildir,
- keşif veya yeniden doğrulama gerektirebilir,
- acil savunma kararında kullanılabilir.

---

# BÖLÜM E — BEŞ STRATEJİK NİYET

## 23. Genel Yaklaşım

AI aynı anda yalnızca bir ana stratejik niyet taşır:

1. Economy
2. AgeUp
3. Expand
4. Defend
5. Attack

Açılış, toparlanma ve maçı bitirme ayrı ana durum değildir:

- Açılış, maç başındaki sınırlı plan şablonudur.
- Toparlanma, Economy ve Defend niyetlerinin acil parametreleridir.
- Maçı bitirme, Attack niyeti içindeki hedef seçimidir.

Bu yaklaşım durum sayısını ve geçiş hatalarını azaltır.

---

## 24. Economy

Amaç:

- işçi sayısını artırmak,
- kaynak akışını dengelemek,
- nüfus kilidini önlemek,
- eksik temel yapıları kurmak,
- ekonomik hasarı onarmak.

Yüksek puan üretir:

- işçi sayısı hedefin altındaysa,
- temel gelir yetersizse,
- nüfus sınırı yaklaşmışsa,
- kritik yapı kaybedilmişse,
- aktif saldırı için ordu gücü yetersizse,
- ağır kayıp sonrası toparlanma gerekiyorsa.

Economy içinde iki profil vardır:

```text
Growth
Recovery
```

Recovery:

- daha güvenli kaynakları seçer,
- asker bütçesini geçici olarak azaltır,
- yalnız minimum savunma üretir,
- çağ atlamayı erteler.

---

## 25. AgeUp

Amaç:

- çağ koşullarını tamamlamak,
- kaynakları rezerve etmek,
- çağ yükseltmesini başlatmak,
- yükseltme sırasında minimum savunmayı korumak.

Yüksek puan üretir:

- ekonomi istikrarlıysa,
- çağ gereksinimlerinin çoğu tamamlandıysa,
- minimum savunma varsa,
- ciddi tehdit yoksa,
- yeni çağ önemli bir darboğazı çözecekse.

AgeUp iptal veya askıya alınır:

- merkez tehdit altındaysa,
- yiyecek veya odun geliri kritik düştüyse,
- nüfus kilidi oluştuysa,
- ana ordu yok edildiyse.

Kaynak rezervasyonu nedeniyle diğer yöneticiler çağ kaynaklarını kullanamaz.

---

## 26. Expand

Amaç:

- yeni kaynak bölgesine karakol kurmak,
- karakolu ana ağa bağlamak,
- depo ve üretim yapısını oluşturmak,
- bölgeyi kullanılabilir hale getirmek.

Yüksek puan üretir:

- güvenli kaynaklar tükeniyorsa,
- altın veya taş ihtiyacı artıyorsa,
- mevcut gelir çağ hedefini karşılamıyorsa,
- değerli ve savunulabilir bölge bulunuyorsa,
- oyuncunun genişlemesini engellemek önemliyse.

Expand planı tek bir reçete kullanır:

```text
Bölge seç
→ İnşaat işçisi ayır
→ Karakol kur
→ Hazır yol rotasını tamamla
→ Depo kur
→ Kaynak yapısı kur
→ İşçi ata
→ Planı tamamla
```

Bir adım sürekli başarısız olursa plan iptal edilir ve bölge geçici olarak kara listeye alınır.

---

## 27. Defend

Amaç:

- merkezi,
- ana ordu üretimini,
- kritik dış ekonomiyi,
- bölgesel zafer hedefini

korumaktır.

Defend çoğu durumda acil öncelik taşır.

Tetikleyiciler:

- merkez saldırı altında,
- düşman gücü kontrol alanında,
- kritik depo veya altın üretimi tehdit altında,
- oyuncunun bölgesel zafer sayacı başlamış,
- çağ yükseltmesi sırasında merkez tehdit edilmiş.

Savunma önceliği:

1. Merkez
2. Bölgesel yenilgi sayacını durdurma
3. Ana askerî üretim
4. Kritik altın veya yiyecek ekonomisi
5. Aktif karakol
6. Düşük değerli dış yapı

AI her küçük saldırıda tüm ordusunu geri çağırmamalıdır.

Savunma kuvveti hedef tehdide göre hesaplanır.

---

## 28. Attack

Amaç:

- oyuncunun dış ekonomisini bozmak,
- stratejik noktayı ele geçirmek,
- askerî üretimi zayıflatmak,
- uygun durumda merkezi yok etmek.

Attack görev türleri:

```text
HarassEconomy
ContestObjective
AssaultExpansion
AssaultBase
```

Aynı anda yalnızca biri aktiftir.

Yüksek puan üretir:

- ana ordu hazırsa,
- minimum üs savunması kalıyorsa,
- hedef bilgisi yeterince güncelse,
- saldırı rotası geçerliyse,
- güç oranı kabul edilebilirse,
- oyuncunun açık bir zayıflığı varsa.

Merkez saldırısı için kuşatma gereksinimi kullanılabilir.

---

# BÖLÜM F — UTILITY VE PLAN SEÇİMİ

## 29. Utility Ölçeği

Her stratejik niyet `0.0–1.0` arasında puan üretir.

Genel form:

```text
Utility = Need × Feasibility × Urgency × Confidence
          - Cost
          - Risk
```

Bütün girdiler mümkün olduğunca normalize edilmelidir.

---

## 30. Basit Puan Örnekleri

### Economy

```text
WorkerNeed
+ IncomeDeficit
+ PopulationPressure
+ RecoveryNeed
- ImmediateThreat
```

### AgeUp

```text
AgeReadiness
× EconomyStability
× DefenseReadiness
× UpgradeValue
```

### Expand

```text
ResourceNeed
× BestRegionValue
× RouteFeasibility
× Safety
```

### Defend

```text
ThreatLevel
× TargetImportance
× ResponseAbility
× Urgency
```

### Attack

```text
ArmyReadiness
× TargetValue
× InformationConfidence
× RouteSafety
× Opportunity
```

Kesin ağırlıklar `12_BALANCE_AND_GAME_DATA.md` içinde tutulmalıdır.

---

## 31. Plan Seçim Akışı

```text
Dünya durumunu güncelle
→ Acil durumları kontrol et
→ Beş niyetin utility değerini hesapla
→ Mevcut plan bağlılık süresini kontrol et
→ Hysteresis uygula
→ Gerekirse yeni plan oluştur
→ Kaynak ve birim bütçesini rezerve et
→ Uygulayıcı yöneticilere görev gönder
```

---

## 32. Plan Veri Yapısı

Önerilen yapı:

```ts
interface AIPlan {
  id: string;
  intent: "economy" | "ageUp" | "expand" | "defend" | "attack";
  targetId?: string;
  targetRegionId?: string;
  startedAt: number;
  minimumCommitmentSeconds: number;
  timeoutSeconds: number;
  reservedResources: ResourceCost;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  failureReason?: string;
  taskIds: string[];
}
```

---

## 33. Görev Durumları

Her görev:

```text
Pending
Running
Blocked
Succeeded
Failed
Cancelled
```

durumlarından birinde olur.

`Blocked` durumunda:

- görev belirli süre bekleyebilir,
- farklı aday deneyebilir,
- yöneticiden yardım isteyebilir,
- limit aşılırsa planı başarısız yapabilir.

---

# BÖLÜM G — AÇILIŞ VE EKONOMİ AI

## 34. Sınırlı Açılış Şablonu

Açılış tamamen utility tabanlı olmak zorunda değildir.

İlk 2–4 dakika için sınırlı bir build order kullanılabilir.

Örnek:

```text
Başlangıç işçilerini yiyecek ve oduna dağıt
→ İşçi üret
→ Nüfus yaklaşınca ev kur
→ Temel üretim yapılarını kur
→ Kışla kur
→ Minimum savunma üret
→ Serbest stratejik değerlendirmeye geç
```

Açılış şablonu:

- kaynak veya zemin nedeniyle uygulanamıyorsa alternatif kullanmalı,
- oyuncu saldırısı halinde kesilebilmeli,
- kesin saniyelere bağlı olmamalıdır.

---

## 35. İşçi Hedefleri

İşçi dağılımı sabit tek oran yerine hedef ihtiyaçlardan üretilir.

Öncelik sırası:

1. Nüfus ve işçi üretimi için yiyecek
2. Temel yapı ve yol için odun
3. Çağ ve savunma için taş
4. Gelişmiş içerik için altın

Çağa göre hedefler veri dosyasında tutulur.

Örnek veri:

```json
{
  "age_settlement": {
    "food": 0.45,
    "wood": 0.40,
    "stone": 0.10,
    "gold": 0.05
  }
}
```

Bu oranlar kesin emir değil, hedef dağılımdır.

---

## 36. Yeniden Atama

İşçiler her saniye yeniden dağıtılmamalıdır.

Yeniden atama tetikleyicileri:

- gelir hedefin belirgin altında,
- yeni üretim yapısı tamamlandı,
- kaynak düğümü tükendi,
- çağ planı başladı,
- kritik yapı maliyeti eksik,
- üretim alanı tehdit altında,
- Recovery profili başladı.

Minimum yeniden atama aralığı kullanılmalıdır.

---

## 37. Darboğaz Tespiti

Ekonomi yöneticisi şu darboğazları raporlar:

```text
FoodShortage
WoodShortage
StoneShortage
GoldShortage
PopulationBlocked
StorageFull
NoAvailableWorker
DisconnectedProduction
DepletedNode
```

Her darboğaz önerilen bir çözüm üretir.

Örnek:

```text
PopulationBlocked
→ Ev planını yüksek öncelikli yap
→ İşçi ve asker kuyruğunu geçici olarak durdurma
```

---

## 38. Güvenlik Stoğu

AI tüm kaynağını tek plana harcamamalıdır.

Güvenlik stoğu:

- en az bir ev,
- temel asker üretimi,
- kritik onarım veya yeniden inşa

için küçük rezerv tutar.

AgeUp planı bu rezervin üzerinde kaynak ayırır.

---

## 39. Ekonomik Toparlanma

Recovery profili şu durumlarda açılır:

- işçi sayısı kritik düşük,
- birden fazla üretim yapısı kaybedildi,
- ana kaynak gelirlerinden biri sıfıra yakın,
- ana ordu kaybedildi ve ekonomi zayıf,
- dış ekonominin tamamı kesildi.

Davranış:

```text
Çağ planını durdur
→ Güvenli kaynakları kullan
→ İşçi üretimini artır
→ Ev ve temel üretimi onar
→ Ucuz savunma üret
→ Gelir istikrara ulaşınca normal Economy profiline dön
```

---

# BÖLÜM H — YAPI AI

## 40. Harita Aday Alanları

İlk vertical slice için AI haritanın her noktasında serbest yapı araması yapmaz.

El yapımı harita aşağıdaki verileri sağlar:

- üs içi yapı bölgeleri,
- ekonomik yapı anchor’ları,
- askerî yapı bölgeleri,
- karakol adayları,
- depo adayları,
- kaynak yapısı konumları,
- yasak alanlar.

Bu yaklaşım:

- geçersiz yerleştirme döngülerini azaltır,
- AI görünümünü daha düzenli yapar,
- testleri tekrarlanabilir hale getirir,
- genel amaçlı şehir planlayıcı ihtiyacını erteler.

---

## 41. Yapı Konumu Seçimi

Aday konum puanı:

```text
PlacementScore = RoleFit
               + RoadAccess
               + Safety
               + ExpansionSupport
               - Threat
               - Congestion
```

Yapı türü öncelikleri:

- Ev: güvenli iç alan
- Depo: yol ve üretim bölgelerine yakın
- Kışla: merkez ile sınır arasında
- Kule: kritik geçit veya karakol yakını
- Kaynak yapısı: ilgili düğüm anchor’ı
- Karakol: seçilen genişleme bölgesi anchor’ı

---

## 42. Yapı Kuyruğu

AI aynı anda sınırsız bina planlamaz.

Önerilen sınırlar:

- bir aktif ana inşaat,
- bir bekleyen kritik yapı,
- çağ yükseltmesi ayrı rezervasyon.

Bu sınır:

- işçi dağılımını,
- kaynak rezervasyonunu,
- hata ayıklamayı

kolaylaştırır.

---

## 43. Yapı Başarısızlığı

Yapı konumu geçersizse:

1. sonraki aday denenir,
2. görev kısa bekleme süresine alınır,
3. adaylar biterse görev başarısız olur,
4. plan yöneticisine açık hata kodu gönderilir.

Aynı aday sonsuza kadar denenmez.

Örnek hata kodları:

```text
NoValidPlacement
InsufficientResources
NoBuilderAvailable
PathBlocked
TerritoryInvalid
RequiredNodeMissing
```

---

## 44. Yeniden İnşa

Yeniden inşa önceliği:

1. Merkez, özel kurala göre
2. Ev, nüfus kilidi varsa
3. Temel yiyecek üretimi
4. Depo veya kritik bağlantı
5. Kışla
6. Karakol
7. Düşük değerli ekonomik yapı

Yıkılan her yapı otomatik olarak yeniden kurulmaz.

---

# BÖLÜM I — BÖLGE, KARAKOL VE YOL AI

## 45. Bölge Verisi

Her genişleme bölgesi harita verisinde tanımlanır.

Örnek:

```ts
interface AIRegionDefinition {
  id: string;
  resourceValues: Record<string, number>;
  strategicValue: number;
  outpostAnchorId: string;
  storageAnchorIds: string[];
  resourceAnchorIds: string[];
  routeIds: string[];
  defenseAnchorIds: string[];
  minimumAge: string;
}
```

---

## 46. Bölge Puanlama

```text
RegionScore = ResourceNeed × ResourceValue
            + StrategicValue
            + DenialValue
            + Defensibility
            - RouteCost
            - Threat
            - RecentFailurePenalty
```

AI en yüksek puanlı geçerli bölgeyi seçer.

Aynı bölge:

- yol bulunamadıysa,
- karakol alanı bloke olduysa,
- art arda ağır kayıp yaşandıysa

geçici olarak kara listeye alınır.

---

## 47. Hazır Genişleme Reçetesi

Her genişleme aynı temel reçeteyi kullanır:

```text
1. Bölgeyi seç
2. Gerekirse keşif doğrulaması yap
3. İşçi veya inşaat ekibi ayır
4. Karakol kur
5. Bölgeye ait hazır yol rotasını seç
6. Yol bağlantısını tamamla
7. Depo kur
8. Öncelikli kaynak yapısını kur
9. İşçi ata
10. Bölge aktifse planı tamamla
```

Bu reçete bütün genişleme davranışını test edilebilir hale getirir.

---

## 48. Yol Planlama

İlk vertical slice için yol sistemi genel amaçlı serbest rota aramaz.

Harita:

- geçerli yol koridorları,
- alternatif koridorlar,
- köprü ve geçit düğümleri,
- ana ağ bağlantı düğümleri

sağlar.

AI uygun rota için şu puanı kullanır:

```text
RouteScore = LengthCost
           + ThreatCost
           + ConstructionCost
           + FailurePenalty
```

En düşük maliyetli geçerli rota seçilir.

---

## 49. Bağlantı Kesintisi

Bir dış ekonomi bağlantısını kaybederse AI:

1. bağlantı türünü belirler,
2. mevcut rotanın onarılabilirliğini kontrol eder,
3. güvenliyse onarım yapar,
4. varsa alternatif hazır rotayı seçer,
5. depo veya karakol kaybını yeniden inşa eder,
6. maliyet ve tehdit çok yüksekse bölgeyi terk eder.

AI aynı bağlantıyı sonsuza kadar onarmaya çalışmamalıdır.

---

## 50. Lojistik Düğüm Davranışı

Oyunda yollar doğrudan saldırılabilir değilse, AI şu kritik düğümleri savunabilir:

- karakol,
- depo,
- köprü başı,
- ana kavşak,
- kaynak alanı girişi.

Gelecekte yol işgal veya lojistik düğüm kesintisi eklenirse AI aynı tehdit sistemiyle tepki verebilir.

---

# BÖLÜM J — ORDU ÜRETİMİ VE KOMPOZİSYON

## 51. Tek Saha Ordusu

İlk vertical slice içinde AI yalnızca bir ana saha ordusu yönetir.

Ek olarak:

- üs çevresinde yeni üretilmiş birimler,
- kuleler,
- çok küçük acil savunma rezervi

bulunabilir.

Bağımsız ikinci saldırı, baskın veya kuşatma ordusu bulunmaz.

Bu karar:

- grup senkronizasyonunu,
- rota yönetimini,
- hedef seçimini,
- geri çekilmeyi,
- debug sürecini

sadeleştirir.

---

## 52. Ordu Gücü

İlk güç hesabı basit olmalıdır.

```text
ArmyPower = Σ(UnitBasePower × HealthRatio × RoleModifier)
```

Örnek göreli taban değerler:

- Muhafız: 1.0
- Okçu: 1.0
- Süvari: 1.5
- Kuşatma: 0.5 birim savaşı, daha yüksek yapı hedefi değeri

Kuşatma gücü hedef türüne göre ayrı değerlendirilmelidir.

---

## 53. Kompozisyon Hedefi

Kompozisyon, çağ ve bilinen düşman birimlerine göre belirlenir.

İlk yaklaşım:

```text
Yerleşim:
%100 Muhafız

Kasaba:
%60 Muhafız
%40 Okçu

Krallık:
%45 Muhafız
%35 Okçu
%20 Kuşatma veya süvari
```

Kesin oranlar veri dosyasında tutulur.

Tam karşı-kompozisyon sistemi ilk aşamada gerekli değildir.

Basit tepki yeterlidir:

- çok okçu görülürse muhafız veya süvari ağırlığı,
- çok yakın dövüş görülürse okçu ağırlığı,
- yapı saldırısı gerekiyorsa kuşatma.

---

## 54. Minimum Savunma

AI saldırıya çıkmadan önce üs için minimum savunma gücü bırakır.

Bu değer:

- çağ,
- görülen düşman gücü,
- merkez savunmaları,
- oyuncunun son saldırı sıklığı

ile değişebilir.

İlk uygulamada ayrı savunma grubu yerine yeni üretilmiş birkaç birim merkez çevresinde bekletilebilir.

---

## 55. Üretim Önceliği

```text
Nüfus kapasitesini güvence altına al
→ Minimum savunmayı tamamla
→ Ana ordu hedefini tamamla
→ Gerekiyorsa kuşatma ekle
→ Fazla ekonomi varsa yedek üret
```

AI üretim yapısı spam’i yapmamalıdır.

---

# BÖLÜM K — SAVUNMA AI

## 56. Tehdit Tespiti

Tehdit, görülen veya saldırı olayı üreten düşmanlardan hesaplanır.

Önerilen değerler:

```text
Threat = EnemyPower
       × TargetProximity
       × InformationConfidence
       × TargetImportance
```

Threat map final vertical slice için düşük çözünürlüklü grid olabilir.

AI-1 için hedef çevresindeki basit yarıçap hesabı yeterlidir.

---

## 57. Savunma Tepki Seviyeleri

### Seviye 1 — Yerel Uyarı

- az sayıda düşman,
- düşük değerli hedef,
- kule veya yerel birimler yeterli.

Ana ordu çağrılmaz.

### Seviye 2 — Önemli Tehdit

- dış ekonomi,
- karakol,
- askerî üretim

tehdit altında.

Ana ordu uygun mesafedeyse yönlendirilebilir.

### Seviye 3 — Acil Tehdit

- merkez,
- bölgesel yenilgi sayacı,
- çağ yükseltmesi sırasında ana üs

tehdit altında.

Ana plan kesilir ve Defend başlar.

---

## 58. İşçi Tahliyesi

İşçiler şu durumda güvenli anchor’a çekilir:

- düşman belirlenen tehdit yarıçapına girerse,
- işçi grubunun karşı koyma gücü yoksa,
- güvenli rota bulunuyorsa.

Tehdit sona erdiğinde:

- kısa gecikme uygulanır,
- önce güvenlik doğrulanır,
- işçiler önceki görevlerine döner.

İşçiler tehdit alanına sürekli gidip gelmemelidir.

---

# BÖLÜM L — SALDIRI VE TAKTİK AI

## 59. Saldırı Ön Koşulları

Attack planı için:

- ana ordu asgari güce ulaşmalı,
- üs savunması minimum değerin üzerinde olmalı,
- hedef bilgisi yeterli güvene sahip olmalı,
- rota geçerli olmalı,
- ekonomi saldırı sırasında tamamen durmamalı,
- hedef türüne uygun birlik bulunmalıdır.

---

## 60. Hedef Puanlama

```text
TargetScore = EconomicValue
            + StrategicValue
            + VictoryValue
            + Vulnerability
            + Proximity
            - DefenseStrength
            - RouteRisk
            - StaleInformationPenalty
```

Hedef öncelikleri duruma göre değişir.

Genel sıra:

1. Bölgesel yenilgi sayacını durduracak hedef
2. Savunmasız dış ekonomi
3. İzole karakol veya depo
4. Askerî üretim
5. Stratejik nokta
6. Oyuncu merkezi

Merkez her zaman en iyi hedef olmamalıdır.

---

## 61. Saldırı Aşamaları

```text
Assemble
→ Move
→ Engage
→ Evaluate
→ Continue veya Retreat
→ Regroup
```

Her aşamanın zaman aşımı ve hata koşulu olmalıdır.

Örnek:

- Ordu belirli sürede toplanamıyorsa eksik birimlerle plan yeniden değerlendirilir.
- Yol kalıcı biçimde kapanırsa alternatif rota aranır.
- Hedef artık mevcut değilse yeni hedef seçilir veya geri dönülür.

---

## 62. Çatışmaya Girme

İlk güç eşikleri:

```text
Saldır: Dost güç / tahmini düşman güç >= 1.10
Riskli saldırı: 0.90–1.10 ve hedef değeri çok yüksek
Geri çekil: < 0.80
```

Bu değerler başlangıç hipotezidir.

AI kusursuz hesap yapmamalıdır. Bilgi güveni ve zorluk seviyesi tahmin hatasını etkileyebilir.

---

## 63. Birim Rol Davranışı

### Muhafız

- ön hatta ilerler,
- okçu ve kuşatmayı korur,
- yakın tehditleri tutar.

### Okçu

- muhafızların arkasında kalır,
- yakın düşmandan mesafe açar,
- düşük sağlık veya hafif hedeflere öncelik verebilir.

### Süvari

- kapsam dahilindeyse menzilli hedeflere ulaşır,
- dar geçitte öne zorlanmaz.

### Kuşatma

- yapı hedeflerine öncelik verir,
- koruma yoksa ileri gönderilmez,
- birim çatışmasında geri hatta kalır.

İlk sürümde karmaşık formasyon gerekmez. Rol bazlı hedef ve durma mesafesi yeterlidir.

---

## 64. Fokus Ateşi

Bütün ordu tek düşük değerli hedefe kilitlenmemelidir.

Basit sınırlar:

- hedef başına saldırgan slotu,
- menzilli birliklerin birkaç hedefe dağıtılması,
- yapı hedeflerinde daha yüksek slot.

Karmaşık DPS optimizasyonu gerekli değildir.

---

## 65. Geri Çekilme

Geri çekilme tetikleyicileri:

- güç oranı eşik altına düştü,
- kuşatma korumasız kaldı,
- hedef takviyesi beklenenden güçlü,
- ana üs acil tehdit altında,
- rota kesildi,
- ordu sağlık ortalaması kritik.

Geri çekilme hedefi:

1. güvenli karakol,
2. dost kontrol alanı,
3. merkez çevresi.

Geri çekilen ordu yeni düşmanı gereksiz yere kovalamaz.

---

## 66. Yeniden Toplanma

Regroup sırasında:

- ordu güvenli alanda bekler,
- yeni üretilen birimler katılır,
- kayıp oranı değerlendirilir,
- yeni Attack veya Defend görevi beklenir.

Tam iyileşme sistemi yoksa belirli süre beklemek zorunlu değildir.

---

# BÖLÜM M — ZAFER DAVRANIŞI

## 67. Askerî Zafer

AI açık üstünlük kurduğunda merkez saldırısını değerlendirmelidir.

Merkez saldırısı için:

- hedef bilgisi güncel,
- ordu yeterli,
- gerekiyorsa kuşatma mevcut,
- üs savunması minimum düzeyde,
- rota geçerli

olmalıdır.

AI açık üstünlükte yalnızca dış yapıları sonsuza kadar hedeflememelidir.

---

## 68. Bölgesel Zafer

AI-3 aşamasında AI:

- stratejik noktaları puanlar,
- boş veya zayıf savunulan noktaya ilerler,
- kendi sayacı başladıysa uygun savunma görevi verir,
- oyuncu sayacı başladıysa Defend acil durumuyla tepki verir.

İlk vertical slice AI’ın bağımsız olarak kusursuz bölgesel zafer planlaması zorunlu değildir.

Zorunlu minimum:

- oyuncunun sayacını fark etmek,
- en az bir noktaya saldırmak,
- kendi kontrolündeki hedefi savunmak.

---

## 69. Maçı Bitirme Politikası

Attack içinde `AssaultBase` puanı artar:

- oyuncunun ordusu çok zayıfsa,
- oyuncu dış ekonomisini kaybetmişse,
- merkez savunması düşükse,
- AI belirgin güç üstünlüğündeyse.

Amaç, kazanılmış maçın gereksiz uzamasını önlemektir.

---

# BÖLÜM N — ZORLUK SEVİYELERİ

## 70. Zorluk Tasarım İlkesi

Zorluk öncelikle şu parametrelerle değişir:

- karar değerlendirme sıklığı,
- tepki gecikmesi,
- hedef bilgisi güveni,
- saldırı ve geri çekilme eşikleri,
- kompozisyon doğruluğu,
- plan başarısızlığı sonrası yeniden deneme kalitesi.

Kaynak bonusu ilk araç olmamalıdır.

---

## 71. Kolay

Önerilen davranış:

- daha uzun tepki gecikmesi,
- daha seyrek saldırı,
- daha basit hedef seçimi,
- geç geri çekilme veya daha erken vazgeçme,
- bölgesel hedeflere daha yavaş tepki,
- ekonomi çarpanı `0.90–1.00`.

Kolay AI kasıtlı olarak tamamen bozuk oynamamalıdır.

---

## 72. Normal

Normal adil temel deneyimdir.

```text
Ekonomi çarpanı: 1.00
Yapı maliyeti: 1.00
Üretim süresi: 1.00
Fog of war: Açık, AI-3 aşamasında
```

Normal AI gizli kaynak üretmez.

---

## 73. Zor

Zor AI:

- daha hızlı değerlendirme,
- daha iyi hedef seçimi,
- daha doğru geri çekilme,
- daha güvenilir kompozisyon,
- başarısız plan sonrası daha iyi alternatif

kullanır.

Ekonomik bonus yalnız testler gerektiğini gösterirse kullanılabilir.

Önerilen üst sınır:

```text
Ekonomi çarpanı: en fazla 1.05
```

Bonus kullanılırsa veri dosyasında açıkça görünmelidir.

---

## 74. Tek AI Kişiliği

Vertical slice yalnızca bir dengeli AI profili kullanır.

Ayrı:

- agresif,
- ekonomik,
- savunmacı,
- bölgesel

kişilikler kapsam dışıdır.

Davranış çeşitliliği niyet puanları ve maç durumu üzerinden doğal olarak oluşmalıdır.

---

# BÖLÜM O — TEKNİK MİMARİ

## 75. Önerilen Modüller

```text
/src/ai/
├── AIController.ts
├── world/
│   ├── AIWorldModel.ts
│   ├── AIKnowledgeBase.ts
│   └── ThreatService.ts
├── director/
│   ├── KingdomDirector.ts
│   ├── IntentScorer.ts
│   ├── PlanManager.ts
│   └── PlanTypes.ts
├── economy/
│   ├── AIEconomyManager.ts
│   ├── WorkerAllocator.ts
│   └── BottleneckDetector.ts
├── building/
│   ├── AIBuildManager.ts
│   ├── PlacementCandidateService.ts
│   └── BuildTemplates.ts
├── expansion/
│   ├── AIExpansionManager.ts
│   ├── RegionScorer.ts
│   └── RouteSelector.ts
├── military/
│   ├── ArmyController.ts
│   ├── ArmyPowerEvaluator.ts
│   ├── TargetScorer.ts
│   └── RetreatEvaluator.ts
├── unit/
│   └── UnitAI.ts
├── data/
│   ├── AIProfile.ts
│   └── AIDifficulty.ts
└── debug/
    ├── AIDebugPanel.ts
    ├── AIDecisionLog.ts
    └── AIOverlayRenderer.ts
```

---

## 76. AI Controller

`AIController` yalnızca modülleri oluşturur ve güncelleme döngüsünü yönetir.

Bütün mantık tek sınıfa yığılmamalıdır.

Sorumlulukları:

- servisleri başlatmak,
- event aboneliklerini kurmak,
- güncelleme sıklıklarını yönetmek,
- save/load verisini yönlendirmek,
- debug araçlarını açmak.

---

## 77. Event Tabanlı Güncelleme

AI yalnız polling kullanmamalıdır.

Önemli eventler:

```text
ResourceChanged
PopulationChanged
BuildingCompleted
BuildingDestroyed
ConnectionChanged
ResourceNodeDepleted
UnitSpotted
EnemyLostVision
BaseAttacked
StrategicPointChanged
AgeChanged
ArmyMissionCompleted
ArmyMissionFailed
```

Eventler blackboard’u günceller ve gerekirse erken değerlendirme ister.

---

## 78. Güncelleme Sıklıkları

Önerilen başlangıç değerleri:

| Sistem | Sıklık |
|---|---:|
| Birim yerel savaş | 0.2–0.5 sn |
| Ordu görevi değerlendirme | 0.5–1.0 sn |
| Tehdit güncelleme | 0.5–1.5 sn |
| Ekonomi yöneticisi | 1–3 sn |
| Krallık niyet değerlendirme | 3–6 sn |
| Bölge puanlama | 5–15 sn veya olay tabanlı |
| Tam bilgi eskimesi | 5–10 sn |

Bütün AI birimleri aynı karede güncellenmemelidir.

---

## 79. Zaman Dilimleme

- Birim değerlendirmeleri gruplara bölünür.
- Yapı adayları aynı karede tamamen taranmaz.
- Bölge puanları cache edilebilir.
- Threat grid yalnız değişen alanlarda güncellenebilir.
- Debug kapalıyken pahalı çizimler çalışmamalıdır.

---

## 80. Determinizm

Aynı seed ve aynı input ile AI mümkün olduğunca tekrar üretilebilir davranmalıdır.

Rastgelelik:

- adaylar yakın puandaysa seçim,
- saldırı zamanında küçük varyasyon,
- aynı değerdeki hedefler arasında tercih

için kullanılabilir.

Rastgelelik kritik hata davranışını gizlememelidir.

---

## 81. Save/Load

AI-1 oynanış kanıtında aktif planı save/load etmek zorunlu değildir.

AI-3 için kaydedilecekler:

- blackboard’un kalıcı alanları,
- mevcut stratejik niyet,
- aktif plan ve görev durumları,
- kaynak rezervasyonları,
- son bilinen düşman bilgisi,
- genişleme kara listesi,
- ana ordu görevi.

Yükleme sonrası:

- dünya referansları yeniden çözülür,
- geçersiz hedefler temizlenir,
- plan devam edemiyorsa kontrollü yeniden değerlendirme yapılır.

---

# BÖLÜM P — DEBUG VE TELEMETRİ

## 82. AI Debug Paneli

Panel en az şu bilgileri göstermelidir:

```text
CurrentIntent
CurrentPlan
PlanDuration
TopIntentScores
ResourceStocks
IncomeRates
WorkerTargets
ActiveBottlenecks
ReservedResources
ArmyPower
EstimatedEnemyPower
CurrentArmyMission
CurrentTarget
RetreatReason
SelectedExpansionRegion
RecentFailures
```

---

## 83. Karar Logları

Her plan değişimi açıklanmalıdır.

Örnek:

```text
[12:43] Intent changed: AgeUp → Defend
Reason: BaseThreat 0.88, TownCenter under attack
Previous score: 0.62
New score: 0.93
```

Başarısız görevler:

```text
[08:11] Expand failed
Region: east_gold
Reason: NoValidOutpostPlacement
Retry lock: 60s
```

---

## 84. Harita Debug Görünümleri

Gerekli overlay’ler:

- bölge kimlikleri,
- yapı aday alanları,
- karakol anchor’ları,
- yol rotaları,
- seçilen genişleme bölgesi,
- tehdit alanları,
- ana ordu rotası,
- saldırı hedef puanları,
- fog bilgi güveni, AI-3 aşamasında.

---

## 85. AI Zorlama Araçları

Test için:

- belirli niyeti zorla,
- kaynak ekle veya azalt,
- işçileri yok et,
- bağlantıyı kes,
- karakolu yık,
- belirli bölgeyi tehdit et,
- ordu gücünü değiştir,
- çağ atlamayı hazır hale getir,
- fog bilgisini eskit,
- planı başarısız yap

araçları bulunmalıdır.

---

## 86. Telemetri

Kaydedilecek temel değerler:

- ilk ev zamanı,
- ilk kışla zamanı,
- ilk karakol zamanı,
- ilk çağ yükseltme zamanı,
- ilk saldırı zamanı,
- işçi sayısı eğrisi,
- kaynak gelirleri,
- nüfus kilidinde geçen süre,
- bağlantısız yapı süresi,
- plan değişim sayısı,
- başarısız plan sayısı,
- saldırı kayıp oranı,
- geri çekilme sayısı,
- maç sonucu,
- maç süresi.

---

# BÖLÜM Q — HATA VE FALLBACK DAVRANIŞLARI

## 87. Genel Kural

AI bir görevi uygulayamadığında:

1. nedeni açık hata koduyla belirler,
2. sınırlı alternatif dener,
3. başarısız adımı kara listeye alır,
4. kaynak rezervasyonunu serbest bırakır,
5. ana plana kontrollü başarısızlık bildirir,
6. yeni niyet değerlendirmesine döner.

Sonsuz retry kullanılmaz.

---

## 88. Yapı Konumu Bulunamaması

```text
Sonraki adayı dene
→ Adaylar bittiyse daha düşük öncelikli bölge dene
→ Yine bulunamazsa planı başarısız yap
→ 30–90 sn yeniden deneme kilidi uygula
```

---

## 89. Yol Rotası Bulunamaması

```text
Alternatif hazır rotayı dene
→ Gerekirse başka depo anchor’ı seç
→ Bölgeyi kara listeye al
→ Expand planından Economy planına dön
```

---

## 90. Nüfus Kilidi

- Ev planı acil öncelik alır.
- Yeni asker ve işçi kuyruğu geçici olarak durur.
- Ev adayı bulunamazsa debug hatası üretilir.
- AI aynı kuyruğa sürekli başarısız üretim eklemez.

---

## 91. Tüm İşçilerin Kaybedilmesi

Merkez işçi üretebiliyorsa:

- diğer tüm planlar durur,
- acil işçi üretimi başlar,
- minimum yiyecek rezervi kullanılır.

İşçi üretimi mümkün değilse:

- AI fiilen yenilmiş sayılabilir,
- saldırı yapacak ordusu varsa son savunma veya saldırı görevi sürdürülebilir.

---

## 92. Ordu Grubunun Bölünmesi

- uzak kalan birimler kısa süre beklenir,
- yol bulamayanlar görevden çıkarılır,
- ana grup minimum güç altına düşerse saldırı iptal edilir,
- sürekli yeniden gruplanma döngüsü engellenir.

---

## 93. Eski Hedef Bilgisi

- hedef görünmüyorsa son bilinen konuma gidilebilir,
- hedef bulunamazsa kısa arama yapılır,
- bilgi düşük güvenliyse ana saldırı iptal edilir,
- hedef puanı stale cezası alır.

---

## 94. Çağ Planının Sürekli Kesilmesi

- art arda iptal sayısı tutulur,
- çağ planına geçici bekleme uygulanır,
- ekonomi ve savunma hedefleri tamamlanmadan tekrar denenmez,
- kaynaklar sonsuza kadar rezerve tutulmaz.

---

# BÖLÜM R — TEST PLANI

## 95. Test Yaklaşımı

AI testleri üç düzeyde yapılır:

1. Modül testi
2. Kontrollü senaryo testi
3. Tam maç simülasyonu

Her sistem için debug görünümü ve deterministik seed kullanılmalıdır.

---

## 96. AI-1 Oynanış Kanıtı Testleri

### Test 1 — Açılış

- AI işçi üretir.
- Ev ve kışla kurar.
- Nüfus sınırında takılmaz.

### Test 2 — Tek Genişleme

- AI karakol kurar.
- Hazır yol rotasını bağlar.
- Depo ve kaynak yapısı kurar.

### Test 3 — Savunma

- Merkez saldırı altındayken ana ordu geri döner.
- Küçük dış saldırıda bütün planı gereksiz yere kesmez.

### Test 4 — Saldırı

- AI güç eşiğine ulaşınca oyuncu hedefe saldırır.
- Hedef yok olursa plan tamamlanır veya yeni hedef seçilir.

### Test 5 — Bağlantı Kaybı

- Yol veya depo kaybı fark edilir.
- AI onarım, alternatif veya terk kararı verir.

AI-1 kabul edilmeden kapsam büyütülmez.

---

## 97. AI-2 Çekirdek Rakip Testleri

### Test 6 — Dört Kaynak

- AI kaynak darboğazlarını çözebilir.
- Tükenen düğüm sonrası yeni kaynak kullanır.

### Test 7 — Çağ Atlama

- AI koşulları tamamlar.
- Tehdit altında çağ planını erteler.
- Çağ sonrası yeni içeriği kullanır.

### Test 8 — Ordu Kompozisyonu

- Muhafız ve okçu üretir.
- Nüfus ve kaynak akışını tamamen bozmaz.

### Test 9 — Geri Çekilme

- Güç dezavantajında geri çekilir.
- Güvenli bölgede yeniden toplanır.

### Test 10 — Toparlanma

- İşçi veya yapı kaybından sonra temel ekonomiyi yeniden kurar.

---

## 98. AI-3 Vertical Slice Testleri

### Test 11 — Fog of War

- AI görünmeyen birimin kesin konumunu kullanmaz.
- Son bilinen bilgi zamanla eskir.

### Test 12 — Bölgesel Zafer Tepkisi

- Oyuncu sayacı başlatınca AI tepki verir.
- Kendi noktasını savunabilir.

### Test 13 — Kuşatma

- AI kuşatmayı korumasız ileri göndermez.
- Merkez saldırısında kuşatma kullanır.

### Test 14 — Maçı Bitirme

- Açık üstünlükte merkez saldırısını seçebilir.
- Kazanılmış maçı gereksiz uzatmaz.

### Test 15 — Save/Load

- Aktif plan yükleme sonrası geçerli kalır veya kontrollü yeniden değerlendirilir.

---

## 99. Uzun Süreli Simülasyon

Her önemli sürümde en az:

- 20 hızlandırılmış AI maçı,
- farklı seed’ler,
- ekonomi ve savaş istatistikleri,
- takılma ve sonsuz plan kontrolü

yapılmalıdır.

Alarm durumları:

- maçların %10’dan fazlası teknik olarak sonuçlanmıyor,
- AI açılışların %20’den fazlasında takılıyor,
- aynı plan art arda 3 kez aynı nedenle başarısız oluyor,
- AI 5 dakikadan uzun süre anlamlı plan üretmiyor,
- maçların %20’den fazlası 40 dakikayı aşıyor.

---

# BÖLÜM S — KAPSAM SINIRLARI

## 100. AI-1 İçin Zorunlu

- sınırlı açılış şablonu,
- iki kaynaklı ekonomi,
- işçi ve nüfus yönetimi,
- geçerli hazır alanlara yapı kurma,
- tek karakol genişlemesi,
- hazır yol rotası,
- tek saha ordusu,
- merkez savunması,
- temel saldırı,
- askerî zafer,
- debug paneli,
- karar logları.

---

## 101. Final Vertical Slice İçin Zorunlu

- dört kaynaklı ekonomi,
- üç çağ desteği,
- temel yapı kadrosu,
- birden fazla bölge adayı,
- karakol ve yol bağlantısı,
- bağlantı kaybına tepki,
- muhafız, okçu ve kuşatma,
- tek saha ordusu,
- savunma, saldırı ve geri çekilme,
- fog of war ve son bilinen bilgi,
- askerî zafer,
- bölgesel zafer tehdidine tepki,
- kolay, normal ve zor profilleri,
- debug, telemetri ve simülasyon testleri.

---

## 102. Ertelenebilecek Özellikler

- süvari,
- bağımsız baskın ordusu,
- çoklu eşzamanlı ordu,
- ayrı kuşatma grubu,
- gelişmiş formasyon,
- tam influence map,
- genel amaçlı serbest yol planlayıcı,
- genel amaçlı prosedürel yapı yerleşimi,
- çoklu AI kişiliği,
- dinamik oyuncu stiline uyum,
- pazar optimizasyonu,
- sahte saldırı,
- kıskaç hareketi,
- uzun vadeli öğrenme,
- kampanya hafızası.

---

## 103. Kapsam Kesme Sırası

AI geliştirme yükü artarsa şu sırayla kesilir:

1. Süvari kullanımı
2. Bölgesel zaferi bağımsız takip etme; yalnız tehdide tepki kalır
3. Fog bilgisinde ayrıntılı güven hesabı
4. Alternatif yol rotası; yalnız onarım veya bölgeyi terk etme kalır
5. Karşı-kompozisyon ayarı
6. HarassEconomy görev türü
7. Zor zorluk profili
8. Save/load sırasında aktif görev devamı; kontrollü yeniden planlama kullanılır

Kesilmemesi gereken çekirdek:

- ekonomi kurma,
- geçerli bina kurma,
- en az bir kez genişleme,
- ordu üretme,
- savunma,
- saldırı,
- maçı bitirme.

---

# BÖLÜM T — AÇIK KARARLAR

## 104. Tasarım Soruları

Aşağıdaki kararlar oynanış testleriyle kesinleştirilmelidir:

### Ekonomi

- AI-1 iki kaynakla ne kadar süre test edilmelidir?
- Çağa göre işçi hedef oranları ne olmalıdır?
- Güvenlik stoğu kaç saniyelik üretimi karşılamalıdır?

### Genişleme

- Her bölge için kaç hazır yol alternatifi gereklidir?
- Karakol kurmadan önce askerî eskort zorunlu olmalı mı?
- AI tehdit yüksekse bölgeyi ne kadar süre kara listeye almalı?

### Savaş

- Saldırı ve geri çekilme güç oranları doğru mu?
- Tek saha ordusu yeterli çeşitlilik üretiyor mu?
- Kuşatma olmadan merkez saldırısı tamamen engellenmeli mi?

### Fog of war

- Son bilinen yapı bilgisi ne kadar süre saklanmalı?
- Saldırı olayı görünmeyen saldırgan hakkında ne kadar yön bilgisi vermeli?

### Zorluk

- Zor AI için ekonomik bonus gerçekten gerekli mi?
- Kolay AI’ın ana farkı tepki süresi mi, hedef kalitesi mi olmalı?

---

## 105. Kilitlenmiş Kararlar

- AI üç katmanlı mimari kullanacaktır.
- Krallık Yöneticisi stratejik ve operasyonel kararları birleştirecektir.
- AI yalnızca beş ana stratejik niyet kullanacaktır.
- AI aynı anda bir ana stratejik plan yürütecektir.
- İlk kapsamta tek saha ordusu kullanılacaktır.
- Yapı yerleşimi harita aday alanlarından yapılacaktır.
- Yol planlama hazır rota koridorlarını kullanacaktır.
- Açılışta sınırlı build order kullanılabilecektir.
- Normal AI oyuncuyla aynı temel kuralları kullanacaktır.
- Fog of war oynanış kanıtından sonra eklenecektir.
- Debug paneli ve karar logları zorunludur.
- AI-1 tamamlanmadan AI-3 kapsamına geçilmeyecektir.

---

# BÖLÜM U — KABUL KRİTERLERİ

## 106. Tasarım Belgesi Kabul Kriterleri

- [ ] Üç katmanlı AI mimarisi kabul edildi.
- [ ] Beş stratejik niyet yeterli bulundu.
- [ ] Tek ana plan kuralı kabul edildi.
- [ ] Tek saha ordusu yaklaşımı kabul edildi.
- [ ] Harita aday alanları ve hazır rota yaklaşımı kabul edildi.
- [ ] AI-1, AI-2 ve AI-3 kapsamları ayrıldı.
- [ ] Fog of war’ın aşamalı eklenmesi kabul edildi.
- [ ] Normal zorlukta gizli ekonomik bonus bulunmaması kabul edildi.
- [ ] Debug ve telemetri zorunlu kabul edildi.
- [ ] Kapsam kesme sırası gerçekçi bulundu.

---

## 107. AI-1 Kabul Kriterleri

- [ ] AI 10 testin en az 9’unda açılışı tamamlıyor.
- [ ] AI nüfus sınırında kalıcı olarak takılmıyor.
- [ ] AI en az bir karakol kurup yol bağlayabiliyor.
- [ ] AI bağlantı kaybını fark ediyor.
- [ ] AI saldırı altında merkezi savunuyor.
- [ ] AI uygun güçte saldırı başlatıyor.
- [ ] AI aynı yapı veya yol görevini sonsuza kadar tekrarlamıyor.
- [ ] AI baştan sona geçerli bir maç oynayabiliyor.
- [ ] Karar logları davranışı açıklıyor.

---

## 108. Final Vertical Slice Kabul Kriterleri

- [ ] AI 20 simülasyonun en az 16’sında teknik hata olmadan tam maç tamamlıyor.
- [ ] AI dört kaynak ekonomisini sürdürüyor.
- [ ] AI iki kez çağ atlayabiliyor.
- [ ] AI en az bir dış ekonomi kuruyor.
- [ ] AI bağlantı kaybında onarım, alternatif veya terk kararı veriyor.
- [ ] AI savunma ve saldırı arasında anlaşılır seçim yapıyor.
- [ ] AI ağır dezavantajda geri çekilebiliyor.
- [ ] AI oyuncunun bölgesel zafer tehdidine tepki veriyor.
- [ ] AI açık üstünlükte maçı bitirmeye çalışıyor.
- [ ] Normal AI gizli bonus olmadan temel rekabet sunuyor.
- [ ] Maçların çoğu hedef süre aralığında sonuçlanıyor.
- [ ] AI kararları debug panelinden izlenebiliyor.

---

# BÖLÜM V — UYGULAMA KONTROL LİSTESİ

## 109. AI-0

- [ ] Basit üretim döngüsü
- [ ] Güç eşiği
- [ ] Sabit hedefe saldırı
- [ ] Yeniden üretim
- [ ] Temel log

## 110. AI-1

### Dünya modeli

- [ ] Minimal blackboard
- [ ] Resource ve population eventleri
- [ ] BaseThreat
- [ ] CurrentIntent ve CurrentPlan

### Krallık Yöneticisi

- [ ] Beş intent scorer
- [ ] Hysteresis
- [ ] Minimum plan süresi
- [ ] Kaynak rezervasyonu
- [ ] Açılış şablonu

### Ekonomi ve yapı

- [ ] İşçi hedefleri
- [ ] Nüfus kilidi çözümü
- [ ] Darboğaz tespiti
- [ ] Yapı aday alanları
- [ ] Yapı fallback davranışı

### Genişleme

- [ ] Tek bölge puanlama
- [ ] Karakol reçetesi
- [ ] Hazır yol rotası
- [ ] Depo ve kaynak yapısı
- [ ] Bağlantı kaybı tespiti

### Ordu

- [ ] Tek saha ordusu
- [ ] Güç hesabı
- [ ] DefendBase
- [ ] AssaultTarget
- [ ] Regroup

### Debug

- [ ] AI debug paneli
- [ ] Karar logları
- [ ] Yapı anchor overlay’i
- [ ] Ordu rota overlay’i

## 111. AI-2

- [ ] Dört kaynak hedefleri
- [ ] Tükenen kaynak tepkisi
- [ ] Yerleşimden Kasabaya geçiş
- [ ] Muhafız ve okçu kompozisyonu
- [ ] Geri çekilme
- [ ] Recovery profili
- [ ] Birden fazla genişleme adayı
- [ ] Eski hedef bilgisi

## 112. AI-3

- [ ] Krallık geçişi
- [ ] Kuşatma üretimi ve kullanımı
- [ ] Fog of war
- [ ] Son bilinen bilgi ve güven
- [ ] Bölgesel zafer tehdidi
- [ ] Kolay, Normal ve Zor profilleri
- [ ] Save/load
- [ ] 20 maç simülasyonu
- [ ] Telemetri raporu

---

# BÖLÜM W — REVİZYON NOTLARI

## 113. Sürüm 0.2

- Dört katmanlı mimari üç katmana indirildi.
- Stratejik ve operasyonel kararlar `KingdomDirector` altında birleştirildi.
- On iki ana durum yerine beş stratejik niyet tanımlandı.
- Bootstrap, Recover ve FinishGame bağımsız durum olmaktan çıkarıldı.
- Çoklu ordu grupları yerine tek saha ordusu benimsendi.
- Ayrı baskın ve kuşatma grupları ertelendi.
- Genel amaçlı yapı planlama yerine harita aday alanları kullanıldı.
- Genel amaçlı yol planlama yerine hazır rota koridorları kullanıldı.
- AI geliştirmesi AI-0, AI-1, AI-2 ve AI-3 aşamalarına ayrıldı.
- Fog of war oynanış kanıtından sonraya taşındı.
- Oynanış kanıtı için iki kaynaklı küçük tam maç tanımlandı.
- Kapsam kesme sırası eklendi.
- Kabul kriterleri prototip ve final vertical slice olarak ayrıldı.

---

## 114. Tasarımın Ana Koruma Kuralı

AI kapsamı azaltılırken şu deneyim korunmalıdır:

> Rakip kendi ekonomisini kurar, karakol ve yol ile büyür, dış ekonomisini savunur, oyuncunun açıklarını değerlendirir ve uygun olduğunda maçı bitirmeye çalışır.

Bu döngüyü güçlendirmeyen AI özelliği vertical slice için zorunlu değildir.

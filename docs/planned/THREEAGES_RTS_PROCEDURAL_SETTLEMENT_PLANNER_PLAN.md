# ThreeAges RTS — Prosedürel Yerleşim Planlayıcısı V1

Oluşturulma tarihi: 2026-08-05  
Durum: **Faz P0 + P1 + P2 + P3 tamamlandı — authored omurga kontrollü fallback olarak kalıyor; Faz P4 reaktif onarım bekliyor**

## 1. Amaç

AI bugün hangi binayı kuracağını oyun durumundan seçiyor, fakat o binanın
nerede kurulacağı `enemyBaseAnchors` içindeki sabit ve bina-kimlikli slotlara
bağlı. Bu yüzden her maç aynı yerleşim dizilimini üretir.

Bu planın hedefi, AI'ın her maç başlangıcında **deterministik bir yerleşim
taslağı** üretmesidir. Taslak;

- ev, kışla ve benzeri taban yapılarının konumunu tohumdan türetir,
- kaynak yapısını gerçek kaynak düğümü / orman / sürü yakınına bağlar,
- depo ve üreticiler için çalışır lojistik erişimini korur,
- yol, nehir, köprü, arazi sınırı, yapı çakışması ve kontrol alanı kurallarını
  asla delmez,
- oyuncunun baskısı, kaynak tükenmesi veya alan kaybı karşısında güvenli bir
  alternatif arar,
- aynı `matchSeed` ile aynı sonucu verir; böylece hata ayıklama ve test tekrar
  üretilebilir kalır.

Bu, sınırsız rastgelelik veya genel amaçlı bir şehir üreticisi değildir. Hedef,
oyuncuya her oturumda farklı görünen ama RTS ekonomisi ve authored harita
kuralları içinde güvenilir kalan bir AI yerleşimidir.

## 2. Mevcut Durum ve Problem Tanımı

Bugünkü sorumluluklar:

| Katman | Mevcut davranış | V1 sonrası |
| --- | --- | --- |
| `AiEconomyManager` | İhtiyaç / öncelik sırasını `buildOrder()` ile seçer. | Aynı kalır. Yer seçmez. |
| `AiBuildManager` | İstenen bina için authored `RtsBuildAnchor` listesini sırayla dener. | Sabit slot yerine planlayıcının adaylarını dener; geçişte authored fallback'i destekler. |
| `AiInfrastructureManager` | Taban depo slotu ve authored omurga yolunu zorunlu tutar. | Depo ve erişim yolunu planlayıcıdan alır; authored yol yalnız fallback olur. |
| `AiExpansionManager` | Outpost/depo/üretim tarifini authored bölge marker'larından yürütür. | V1'de aynı kalır. Genişleme, taban planlayıcısından ayrı bir fazdır. |
| Level marker'ları | Başlangıçlar, kaynaklar, blocker'lar, köprü/yürünebilir deck ve genişleme rotalarını taşır. | Oyun alanının otoritesi olmaya devam eder. |

Bu sınır önemlidir: `buildOrder()`ın sabit oluşu tek başına sorun değildir;
aynı ekonomik niyet farklı, geçerli fiziksel yerleşimlerle uygulanabilir. İlk
V1 bu ayrımı korur; ekonomi stratejisini ve seviye/çağ maliyetlerini yeniden
yazmaz.

## 3. Kararlar ve Kapsam Sınırı

### Karar 1 — Hibrit, deterministik planlayıcı

Her AI krallığı maç başında `matchSeed + owner + layoutVersion` ile kendi
`SettlementLayoutPlan`ını üretir. Tohumlu pseudo-random seçim, aynı maçın
tekrarında aynı planı verir; yeni maçta ise yapı mahalleleri değişebilir.
`Math.random()` kullanılmaz.

### Karar 2 — Oyun kuralları sert, görsel çeşitlilik yumuşak kısıttır

Bir aday aşağıdakilerden birini ihlal ederse seçilemez:

- harita ve bina yerleştirme sınırı,
- mevcut yapı, kaynak düğümü, ağaç, sürü, navigation blocker veya yol çakışması,
- krallığın kontrol alanı,
- yapı footprint'i ve worker'ın ulaşılabilirliği,
- üreticinin depo/merkez erişimi veya planlanabilir yol erişimi,
- kaynak yapısının geçerli kaynağa çalışma mesafesi.

Geçerli adaylar arasında puanlama yapılır. Merkeze makul mesafe, aynı türlerin
fazla üst üste binmemesi, konut kümesi, askerî yapıların merkez hattı ve kısa
yol maliyeti puanı etkiler. Bu puanlar estetik/stratejik tercihtir; sert
kuralları geçersiz kılamaz.

### Karar 3 — Authoring tamamen kalkmaz

Level, başlangıçlar, kaynaklar, blocker'lar, köprü deck'leri ve genişleme
marker'ları için tek otoritedir. V1'de:

- taban konut/askerî/lojistik konumları prosedüreldir,
- çiftlik, oduncu kampı, taş ocağı, altın madeni, av ve mera kaynak bağını
  gerçek map verisinden türetir,
- genişleme tarifi ve düşman tarafına geçiş kararı authored kalır,
- prosedürel aday üretimi başarısız olursa ilgili binanın legacy authored
  anchor'ı kontrollü fallback olur.

Dolayısıyla bu iş, GDD'de ertelenmiş olan “genel amaçlı serbest prosedürel yapı
yerleşimi”ni sınırsız biçimde açmaz; yalnızca mevcut iki krallıklı RTS haritası
için güvenilir bir V1 tanımlar.

### Kapsam dışı

- bağımsız yol ağını yeniden tasarlamak veya yol hücre kurallarını değiştirmek,
- genel amaçlı şehir/mahalle üretimi,
- haritadaki kaynak veya köprüleri maç sırasında taşımak,
- aynı anda çok sayıda inşaat ve çoklu AI ordusu,
- oyuncu stilini uzun dönem öğrenme,
- V1 içinde prosedürel genişleme rotaları.

## 4. Hedef Mimari

### 4.1 Yeni saf planlama katmanı

Önerilen yeni dosya: `src/game/rts/ai/settlementLayoutPlanner.ts`.

Bu modül renderer, `AiController` ve construction service olmadan saf çalışır.
Girdileri açıkça alır:

```ts
interface SettlementLayoutPlanningInput {
  readonly seed: number;
  readonly owner: UnitOwner;
  readonly center: RtsMapPoint;
  readonly territory: TerritorySnapshot;
  readonly map: RtsSpatialLayout;
  readonly buildings: BuildingBalance;
  readonly placement: PlacementRulesSnapshot;
}
```

Çıktı, bina kimliğine bağlanmış tek bir zorunlu koordinat değil, sıralı aday
akışlarıdır:

```ts
interface SettlementSiteCandidate {
  readonly key: string;             // seed'den türetilen kararlı kimlik
  readonly buildingId: string;
  readonly x: number;
  readonly z: number;
  readonly zone: "housing" | "logistics" | "military" | "resource";
  readonly sourceId?: string;       // kaynak/orman/sürü bağlı yapılar için
  readonly score: number;
}

interface SettlementLayoutPlan {
  readonly version: 1;
  readonly seed: number;
  readonly candidatesByBuilding: ReadonlyMap<string, readonly SettlementSiteCandidate[]>;
}
```

Planlayıcı yalnız aday üretir ve puanlar. `StructureConstructionService`,
placement'ın tek yazma kapısı olarak kalır; adayın gerçekten kurulabildiği
ancak orada doğrulanır.

### 4.2 Bölgeler

Başlangıç merkezinin çevresinde, tohumla döndürülmüş fakat kaynaklara göre
uyarlanmış dört bölge üretilir:

1. **Konut halkası:** Evler, merkezden kısa yürüyüş mesafesinde küçük kümeler
   halinde; yol/üretici footprint'leriyle çakışmadan.
2. **Lojistik halkası:** Depo, merkezin erişim yoluna yakın; üreticilerin
   mümkün olan en kısa yol ile bağlanacağı tarafta.
3. **Üretim / askerî kenar:** Kışla, pazar ve ileri savunma yapıları konut
   çekirdeğinin dışında, ana koridoru ve merkez erişimini kapatmayacak yönde.
4. **Kaynak cepleri:** Maden, oduncu kampı, çiftlik, av kampı ve mera gerçek
   kaynağın etrafında aranır. Bu yapılar dekoratif çeşitlilik uğruna kaynaktan
   uzaklaştırılamaz.

Her bölge, `RTS_PLACEMENT_GRID_SIZE` üzerinde örneklenir. İlk geçerli aday
yerleşim değildir: adaylar puanlanır, seed'in kararlı eşitlik bozucusuyla
sıralanır ve ilk N aday saklanır.

### 4.3 Aday puanlama

Önerilen ağırlıklar yeni `ai-layout` verisinde tutulur; V1 başlangıç değerleri
uygulama sırasında ölçülür, burada sabitlenmez.

| Ölçüt | Etki |
| --- | --- |
| Merkez / depo yolu | kısa bağlantı ve işçi yürüyüşü tercih edilir |
| Kaynak uygunluğu | kaynak yapısı için zorunlu yakınlık; puansız geçiş yok |
| Aynı türden uzaklık | evler/hizmet yapıları tek çizgiye dizilmez |
| Bölge uyumu | askeri ve konut rolleri kendi halkasını korur |
| Yol koridoru boşluğu | ana yol ve beklenen depo bağlantısı kapanmaz |
| Tehdit / sınır mesafesi | V2'de oyuncu yaklaşınca güvenli iç adaylara yön verir |
| Seed eşitlik bozucusu | eşit dereceli iki güvenli aday maçlar arasında değişir |

### 4.4 Çalışma zamanı entegrasyonu

`AiBuildManager.request(buildingId, now)` yeni bir `AiSiteProvider` bağımlılığı
alır. Provider sırasıyla şunları döndürür:

1. planlayıcının henüz işgal edilmemiş, karalisteye alınmamış adayları;
2. sadece V1 geçişi için aynı binaya ait legacy authored anchor'lar;
3. aday yoksa isimlendirilmiş `no-valid-placement` sonucu.

Başarısız aday, bugünkü üç deneme sınırının karşılığı olan kararlı `candidate.key`
üzerinden karalisteye alınır. Aynı adayın yeniden üretimde farklı anahtar alması
yasaktır.

`AiInfrastructureManager`, planın lojistik bölgesinden depo adayını ister ve
yol için mevcut `RoadConstructionService` / `RoadGraph` akışını kullanır.
Planlayıcı doğrudan yol hücresi yazmaz.

### 4.5 Yeniden planlama

Planın tamamı her AI tick'inde rastgele üretilmez. Yeniden planlama yalnız şu
olaylarda çalışır:

- planlı adayların tamamı geçersiz/karaliste ise,
- ilgili kaynak düğümü tükenmiş veya sahiplik kaybetmişse,
- depo veya merkez yıkılmış ve lojistik bağlantı yeniden kurulacaksa,
- genişleme sonrası yeni merkez/karakol çevresinde V2 bölgesi açılmışsa.

V1'de yeniden planlama, yalnız etkilenmiş bina türünün aday listesini yeniler;
tam yerleşimi taşımaya veya var olan binaları yıkmaya çalışmaz.

## 5. Veri, Kalıcılık ve Hata Ayıklama Sözleşmesi

### Veri

Yeni veri dosyası önerisi: `public/game-data/balance/ai-layout.json`.

Dosya yalnızca planlayıcının alan yarıçaplarını, aday sayısını, kaynak arama
mesafesini ve puan ağırlıklarını taşır. `ai.json`, niyet/economy/army dengesi
olarak kalır; yerleşim geometri ayarları onun içine karıştırılmaz. Validator
eksik/geçersiz değerleri reddeder ve en az bir fallback yolu bulunduğunu test
eder.

### Kalıcılık

Maç durumu şu an dışa aktarılıyorsa, en az `layoutVersion`, `layoutSeed`,
karaliste anahtarları ve yeniden planlanmış bina türleri saklanmalıdır. Maç
kalıcılığı yoksa V1 buna yeni bir save yüzeyi eklemez. İleride alan eklenirse
`tools/saveValidator.ts` ve ilgili yükleyici aynı turda güncellenir.

### Debug görünümü

`?rts&debug` altında AI paneline şu satırlar eklenir:

- plan seed / sürüm,
- etkin bölge ve seçilmiş aday anahtarı,
- bina başına kalan aday sayısı,
- fallback kullanıldı mı,
- son ret nedeni (`blocked`, `outside-control`, `source-missing`, vb.).

Bu bilgi yalnız debug içindir; oyuncu HUD'ına teknik aday listesi taşınmaz.

## 6. Uygulama Fazları

### Faz P0 — Sözleşme ve ölçüm

- [x] Mevcut `gameplay_proof` authored alanını, her bina footprint'i ve kaynak
  çalışma menziliyle ölç.
- [x] Legacy anchor'ların bugün karşıladığı minimum bina sayısını ve lojistik
  yolunu testte çıkar.
- [x] `ai-layout.json` şemasını, validator'ını ve varsayılanlarını ekle.
- [x] Aynı seed'in aynı aday listesini, farklı seed'lerin en az bir konut ve
  bir askerî adayda ayrıştığını gösteren saf test ekle.

Kabul: Henüz AI davranışı değişmeden planlayıcının girdileri, sınırları ve
deterministikliği test edilir.

### Faz P1 — Saf taban aday üretimi

- [x] Konut, lojistik ve askerî halkalar için grid tabanlı aday üret.
- [x] Footprint, blocker, sınır ve kontrol alanı filtrelerini saf katmana taşı.
- [x] Kaynak binaları için kaynak-etrafı aday üretimini ekle.
- [x] Skorlayıp her bina türü için sınırlı, sıralı aday listesi döndür.

Kabul: 10 sabit seed'in her birinde çiftlik, oduncu kampı, depo, ev ve kışla
için en az bir geçerli aday vardır; hiçbir aday harita engeline veya kaynağın
üstüne düşmez.

### Faz P2 — Taban inşaatına bağlama

- [x] `AiSiteProvider` arayüzünü ve `AiBuildManager` entegrasyonunu ekle.
- [x] Aday anahtarı bazlı karalisteyi uygula.
- [x] Yalnız taban yapılarında prosedürel adayları kullan; expansion recipe
  legacy marker'larda kalır.
- [x] Kontrollü authored fallback ve debug nedenini ekle.

Kabul: Aynı ekonomik build order, iki farklı seed'de en az iki yapıyı farklı
ama geçerli konuma kurar; tek seed tekrarında sonuç aynıdır.

### Faz P3 — Lojistik ve yol güvenliği

Başlatma notu (2026-08-06): Taban depo isteği artık prosedürel adayları legacy
fallback'ten önce kullanır. Authoring omurgası ana ağ fallback'i olarak korunur;
tamamlanan prosedürel depo ve üreticiler bu ağa mevcut, ücretli yol servisiyle
erişim kolu kurar. Bu dilim, gerçek depo/üretici yol bileşenini regression'da
kanıtlar. Depo adayları, merkez ağına yeni yol maliyeti ve planlı üreticilere
kalan yerel-aktarım mesafesiyle sıralanır; prosedürel footprint authored omurgayı
route edilemez kılıyorsa aday elenir ve sonraki aday denenir.

- [x] Depo adayını merkez ve üretici erişimiyle birlikte seç.
- [x] Planlı üretici/depo bağlantısını mevcut yol servisiyle doğrula.
- [x] Yol yapımı bir adayı kullanılamaz kılarsa sonraki adaya geç.
- [x] Yerel aktarım ve kervan kurallarının prosedürel yerleşimde değişmediğini
  regresyonla kanıtla.

Kabul: Taban kaynak üreticilerinin geliri cüzdana ulaşır; yol kesilince mevcut
lojistik hata/onarım davranışı korunur.

### Faz P4 — Reaktif yerleşim onarımı

- [ ] Kaynak tükenmesi, kaybedilmiş aday veya yıkılmış depo için dar kapsamlı
  yeniden planlama ekle.
- [ ] Oyuncu tehdidi altında dış halkayı değil daha güvenli adayı tercih et.
- [ ] Geçersiz adaylar bittikten sonra fallback veya açık failure reason üret.

Kabul: Bir kaynak yapısı/depoyu yok etmek AI'ı sonsuz denemeye sokmaz; başka
geçerli aday varsa ekonomi toparlanır.

### Faz P5 — Gözlemlenebilirlik ve kabul maçları

- [ ] Debug overlay ve karar günlüğüne plan satırlarını ekle.
- [ ] 10 seed'lik hızlandırılmış başsız maç matrisi oluştur.
- [ ] Mevcut “standart pasif açılış 18 dakika içinde Kasaba” regresyonunu koru.
- [ ] En az üç manuel maçta farklı yerleşim görünümü, Kasaba ilerlemesi ve
  oyuncu baskısına tepkiyi doğrula.

Kabul: 10/10 deterministik seed, blocker veya sonsuz yapı döngüsü olmadan
Kasaba yolunu tamamlar; manuel maçlar aynı yerleşim kopyasını tekrar etmez.

## 7. Test Matrisi

| Durum | Otomatik kanıt | Manuel kanıt |
| --- | --- | --- |
| Aynı seed | aday anahtarları, sırası ve koordinatları eşit | debug seed tekrarında aynı plan |
| Farklı seed | konut/askerî adaylardan en az biri farklı | iki yeni maçta görünür farklılık |
| Kaynak binası | geçerli kaynak menzilinde, kaynak üstünde değil | üretim ve lojistik etiketi çalışır |
| Yol / depo | producer bağlantısı ve teslim akışı | yol kesme/onarım davranışı |
| Engelli aday | sıradaki aday denenir, üç ret sonrası blacklist | debug nedeni okunur |
| Alan kaybı | `outside-control` aday seçilmez | oyuncu baskısında güvenli iç yer seçimi |
| Kasaba güvenilirliği | 10 seed ve standart pasif regresyon | en az üç pasif/baskılı maç |
| Legacy fallback | yalnız prosedürel aday bitince devreye girer | debug panelde görünür |

## 8. Riskler ve Önlemler

| Risk | Önlem |
| --- | --- |
| Çeşitlilik lojistiği kırar | lojistik erişimi sert kural; mevcut yol sistemi tek otorite |
| Seed farkı testleri flakey yapar | injected, kararlı RNG; `Math.random()` yasağı |
| Harita başına özel davranış görünmez olur | Level marker'ları ve kaynaklar giriş olarak kalır |
| Planlayıcı AI niyetlerini büyütür | yalnız yer seçer; `AiEconomyManager` / intent scorer değişmeden kalır |
| Fallback prosedüreli gizler | debug satırı ve test, fallback kullanımını sayar |
| Her tick yeniden arama performansı düşürür | plan maç başlangıcında kurulur; yalnız olay tabanlı dar yeniden planlama |

## 9. İlk Uygulanabilir Dilim

İlk kod dilimi **Faz P0 + P1'in saf çekirdeği** olmalıdır:

1. `ai-layout.json` ve validator,
2. seedlenmiş `SettlementLayoutPlanner`,
3. mevcut `gameplay_proof` spatial verisini girdi alan saf aday üretimi,
4. aynı/farklı seed, blocker, footprint ve kaynak mesafesi testleri,
5. henüz `AiBuildManager` veya canlı AI'a bağlamama.

Bu dilim, prosedürel planın gerçekten geçerli aday üretebildiğini kanıtlar;
ekonomiyi veya Kasaba güvenilirliğini riske atmadan bir sonraki fazın net
entegrasyon sınırını verir.

## 10. Tamamlanma Kriteri

Plan ancak aşağıdakiler birlikte sağlanınca tamamlanmış sayılır:

- AI, aynı seed ile tekrar üretilebilir; farklı seed'lerle görünür biçimde farklı
  taban yerleşimleri kurar.
- Hiçbir prosedürel yapı geçersiz yere, kaynak üstüne veya çalışmaz lojistik
  adasına kurulmaz.
- Kaynak tükenmesi/yıkım sonrası AI alternatif arar ya da açık, sonlu bir hata
  üretir.
- Standart `gameplay_proof` pasif açılışında Kasaba Çağı regresyonu korunur.
- 10 hızlandırılmış seed ve üç manuel maç kabulü, sonuçların sadece test
  fixture'ında değil gerçek oynanışta da güvenilir olduğunu gösterir.

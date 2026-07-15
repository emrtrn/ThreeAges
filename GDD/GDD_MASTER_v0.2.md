# GDD Master Index

> **Proje:** Üç Çağ: Sınır Krallıkları  
> **Tür:** Tek oyunculu, küçük ölçekli web RTS  
> **Geliştirme ortamı:** Forge + VS Code + Codex  
> **Belge sürümü:** 0.2  
> **Durum:** Ana GDD seti tamamlandı; sadeleştirilmiş oynanabilir dilim planı üretim kaynağı olarak etkin  
> **Ana hedef:** Tek harita ve tek AI rakiple 20–30 dakikalık oynanabilir vertical slice

---

## 1. Belgenin Amacı

Bu dosya proje içindeki tüm Game Design Document belgelerinin ana giriş noktasıdır.

Şu amaçlarla kullanılmalıdır:

- GDD belgeleri arasında doğru okuma sırasını göstermek,
- her sistemin ana kaynak belgesini belirtmek,
- proje genelinde alınmış temel kararları tek yerde toplamak,
- belgeler arasındaki çelişkileri önlemek,
- Codex görevlerinde hangi belgenin kaynak gösterileceğini belirlemek,
- üretimin hangi aşamada olduğunu takip etmek,
- açık kararları ve kapsam sınırlarını görünür tutmak.

Ayrıntılı mekanik açıklamaları bu belgeye kopyalanmamalıdır. Her sistemin ayrıntısı kendi kaynak belgesinde tutulur.

---

# 2. Yüksek Seviye Oyun Özeti

**Üç Çağ: Sınır Krallıkları**, oyuncunun küçük bir sınır yerleşimini üç gelişim aşamasından geçirerek krallığa dönüştürdüğü, ekonomi, bölge kontrolü, yol bağlantıları ve küçük ölçekli savaş üzerine kurulu tek oyunculu bir RTS oyunudur.

Oyuncu:

1. haritayı keşfeder,
2. dört temel kaynağı üretir,
3. yapılarını yollarla birbirine bağlar,
4. karakollarla yeni bölgeler açar,
5. yerleşimini üç çağ boyunca geliştirir,
6. küçük ama rol odaklı bir ordu kurar,
7. AI rakibin ekonomisini ve bölgesel planlarını bozar,
8. askerî veya bölgesel zafer kazanır.

Oyunu klasik RTS yapısından ayıran ana özellik:

> Ekonomi, yapılaşma ve genişlemenin yollar, karakollar, depolar ve kontrol alanlarından oluşan görünür bir lojistik ağa bağlı olmasıdır.

---

# 3. Ana Tasarım Sütunları

## 3.1 Görünür ve anlamlı gelişim

Yerleşim üç aşamadan geçer:

- Yerleşim
- Kasaba
- Krallık

Her aşama:

- yeni yapılar,
- yeni birlikler,
- yeni stratejik kararlar,
- görsel gelişim

sunmalıdır.

## 3.2 Ekonomi ve savaş bağlantısı

Savaş yalnız birimleri yok etmek için yapılmaz.

Askerî eylemler:

- işçileri kaçırır,
- karakolları düşürür,
- depoları izole eder,
- kaynak üretimini keser,
- çağ ilerlemesini geciktirir,
- stratejik bölgeleri ele geçirir.

## 3.3 Bölge, yol ve lojistik

Oyuncu:

- merkez ve karakollarla kontrol alanı oluşturur,
- yollarla üretim yapılarını depolara bağlar,
- alternatif rotalar kurar,
- dış ekonomisini savunur.

## 3.4 Okunabilir ve yönetilebilir RTS

Oyunda:

- küçük birim kadrosu,
- sınırlı yapı çeşitliliği,
- açık rol ayrımları,
- düşük mikro yönetim,
- tanıdık RTS kontrolleri

kullanılır.

## 3.5 Tepki veren fakat adil AI

AI:

- kendi ekonomisini kurar,
- aynı temel kuralları kullanır,
- fog of war sınırlarına uyar,
- genişler,
- baskın yapar,
- savunur,
- geri çekilir,
- zafer koşullarını takip eder.

---

# 4. Ana GDD Belgeleri

## 4.1 Vizyon ve Temel Tasarım

### [`00_GAME_VISION_AND_PILLARS.md`](./00_GAME_VISION_AND_PILLARS.md)

İçerik:

- yüksek konsept,
- oyuncu fantezisi,
- tasarım sütunları,
- hedef oyuncu,
- oyun kapsamı,
- vertical slice sınırı,
- genel başarı kriterleri.

**Bu belge şu konularda ana kaynaktır:**

- Proje neden var?
- Oyun hangi deneyimi sunmalı?
- Hangi özellikler projeye uygun değildir?
- Bir tasarım kararı ana vizyonla çelişiyor mu?

---

## 4.2 Çekirdek Oynanış Döngüsü

### [`01_CORE_GAMEPLAY_LOOP.md`](./01_CORE_GAMEPLAY_LOOP.md)

İçerik:

- anlık, taktik ve stratejik döngüler,
- erken, orta ve geç maç akışı,
- oyuncu eylemleri,
- sistemler arası bağlantılar,
- ilk 10 dakika örneği,
- prototip döngüsü.

**Ana kaynak olduğu konular:**

- Oyuncu sürekli olarak ne yapar?
- Sistemler hangi sırayla devreye girer?
- Bir mekanik çekirdek döngüye gerçekten katkı sağlıyor mu?

---

## 4.3 Maç Akışı ve İlerleme

### [`02_MATCH_FLOW_AND_PROGRESSION.md`](./02_MATCH_FLOW_AND_PROGRESSION.md)

İçerik:

- üç gelişim aşaması,
- maç fazları,
- çağ atlama gereksinimleri,
- açılan içerikler,
- tempo hedefleri,
- geri dönüş ve kartopu kontrolü.

**Ana kaynak olduğu konular:**

- Bir içerik hangi çağda açılır?
- Çağ atlama nasıl çalışır?
- Maç ne zaman hızlanmalı?
- Oyuncunun güç eğrisi nasıl ilerler?

---

## 4.4 Ekonomi ve Kaynaklar

### [`03_ECONOMY_AND_RESOURCES.md`](./03_ECONOMY_AND_RESOURCES.md)

İçerik:

- yiyecek, odun, taş ve altın,
- işçi üretimi ve ataması,
- yerel tampon,
- global stok,
- depolama,
- Refah,
- kaynak tükenmesi,
- ekonomi edge case’leri.

**Ana kaynak olduğu konular:**

- Kaynaklar nasıl üretilir?
- İşçiler fiziksel taşıma yapar mı?
- Bağlantı kesildiğinde üretim ne olur?
- Refah ne işe yarar?

---

## 4.5 Yapılar ve Yerleşim

### [`04_BUILDINGS_AND_SETTLEMENT.md`](./04_BUILDINGS_AND_SETTLEMENT.md)

İçerik:

- yapı kategorileri,
- vertical slice bina listesi,
- grid destekli yerleştirme,
- inşaat,
- yükseltme,
- hasar ve onarım,
- kontrol dışı yapı davranışı,
- AI yapı yerleşimi.

**Ana kaynak olduğu konular:**

- Hangi binalar oyunda yer alır?
- Bina nasıl yerleştirilir?
- Hangi binalar üç seviyelidir?
- Yapı yıkıldığında veya bağlantı dışında kaldığında ne olur?

---

## 4.6 Bölge, Lojistik ve Yollar

### [`05_TERRITORY_LOGISTICS_AND_ROADS.md`](./05_TERRITORY_LOGISTICS_AND_ROADS.md)

İçerik:

- kontrol alanı,
- karakollar,
- yol çizimi,
- lojistik graph,
- alternatif rotalar,
- stratejik noktalar,
- bölgesel genişleme,
- AI yol planlama.

**Ana kaynak olduğu konular:**

- Nerede yapı kurulabilir?
- Karakol nasıl yeni alan açar?
- Yollar neyi etkiler?
- Bir yapı bağlı mı, bağlantısız mı?
- Lojistik kesintisi nasıl oluşturulur?

---

## 4.7 Birimler ve Savaş

### [`06_UNITS_AND_COMBAT.md`](./06_UNITS_AND_COMBAT.md)

İçerik:

- İşçi, Muhafız, Okçu, Süvari ve Kuşatma rolleri,
- seçim ve komutlar,
- grup hareketi,
- pathfinding,
- yakın ve menzilli savaş,
- karşıtlık sistemi,
- geri çekilme,
- iyileşme,
- yapı saldırıları.

**Ana kaynak olduğu konular:**

- Birimler nasıl kontrol edilir?
- Hangi birim neye karşı güçlüdür?
- Savaş nasıl hesaplanır?
- Birimler ne zaman kovalamayı bırakır?
- Kuşatma neden gereklidir?

---

## 4.8 Düşman AI Tasarımı

### [`07_ENEMY_AI_DESIGN_v0.2.md`](./07_ENEMY_AI_DESIGN_v0.2.md)

İçerik:

- `KingdomDirector`, `ArmyController` ve yerel birim davranışlarından oluşan üç katmanlı yapı,
- `Economy`, `AgeUp`, `Expand`, `Defend` ve `Attack` ana niyetleri,
- `AI-0`, `AI-1`, `AI-2` ve `AI-3` geliştirme aşamaları,
- harita aday noktaları ve hazır genişleme reçeteleri,
- tek saha ordusu yaklaşımı,
- sınırlı blackboard ve utility değerlendirmesi,
- ekonomi, yapılaşma, genişleme, savunma ve saldırı,
- fallback davranışları,
- debug paneli, karar logları ve kabul testleri.

**Ana kaynak olduğu konular:**

- İlk oynanabilir AI hangi minimum davranışları kullanır?
- AI geliştirmesi hangi kapılarla genişletilir?
- AI ekonomi, genişleme, savunma ve saldırı arasında nasıl seçim yapar?
- AI’ın yapı ve yol araması nasıl sınırlandırılır?
- AI neden plan değiştirir veya mevcut planını korur?
- Gelişmiş fog, çoklu ordu ve zorluk özellikleri ne zaman eklenir?

---

## 4.9 Harita ve Dünya Tasarımı

### [`08_MAP_AND_WORLD_DESIGN.md`](./08_MAP_AND_WORLD_DESIGN.md)

İçerik:

- `İki Nehir Arası` haritası,
- başlangıç bölgeleri,
- güvenli ve riskli kaynaklar,
- nehir ve köprüler,
- ana ve yan saldırı rotaları,
- stratejik noktalar,
- fog of war,
- AI bölge grafiği,
- performans sınırları.

**Ana kaynak olduğu konular:**

- İlk haritanın düzeni nedir?
- Kaynaklar nerelere yerleştirilir?
- Çatışma hangi alanlarda oluşur?
- AI hangi rotaları kullanabilir?
- Harita nasıl doğrulanır?

---

## 4.10 Zafer, Yenilgi ve Zorluk

### [`09_VICTORY_DEFEAT_AND_DIFFICULTY.md`](./09_VICTORY_DEFEAT_AND_DIFFICULTY.md)

İçerik:

- askerî zafer,
- bölgesel zafer,
- stratejik nokta sayacı,
- yenilgi,
- teslim olma,
- geri dönüş,
- maç süresi,
- Kolay, Normal ve Zor profilleri,
- maç sonu ekranı.

**Ana kaynak olduğu konular:**

- Maç nasıl kazanılır?
- Maç nasıl kaybedilir?
- Bölgesel sayaç ne zaman başlar?
- Zorluk seviyesi neyi değiştirir?
- Maç ne zaman sona ermelidir?

---

## 4.11 Kamera, Kontroller ve UI

### [`10_CAMERA_CONTROLS_AND_UI.md`](./10_CAMERA_CONTROLS_AND_UI.md)

İçerik:

- RTS kamera,
- seçim,
- sağ tık komutları,
- yapı ve yol araçları,
- HUD,
- minimap,
- lojistik görünümü,
- bildirimler,
- menüler,
- erişilebilirlik,
- input context ve UI state.

**Ana kaynak olduğu konular:**

- Oyuncu oyunu nasıl kontrol eder?
- Bilgiler nerede gösterilir?
- Yapı ve yol nasıl yerleştirilir?
- Hangi uyarılar kritik kabul edilir?
- UI hangi teknik yapıyı kullanır?

---

## 4.12 Görsel Yön ve Assetler

### [`11_ART_ASSETS_AND_PRESENTATION.md`](./11_ART_ASSETS_AND_PRESENTATION.md)

İçerik:

- low-poly sanat yönü,
- Quaternius asset paketi kullanımı,
- bina seviyeleri,
- birim siluetleri,
- takım renkleri,
- animasyonlar,
- kaynak ve yol görselleri,
- VFX,
- UI ikonları,
- LOD ve instancing.

**Ana kaynak olduğu konular:**

- Hazır assetler hangi rolle kullanılacak?
- Yapı seviyeleri nasıl görünecek?
- Takım renkleri nereye uygulanacak?
- Hangi görsel içerikler vertical slice için zorunlu?
- Asset kabul kriterleri nelerdir?

---

## 4.13 Denge ve Oyun Verisi

### [`12_BALANCE_AND_GAME_DATA.md`](./12_BALANCE_AND_GAME_DATA.md)

İçerik:

- JSON veri mimarisi,
- tempo hedefleri,
- kaynak üretimi,
- yapı ve çağ maliyetleri,
- sağlık, hasar ve hareket aralıkları,
- AI zorluk katsayıları,
- presetler,
- telemetri,
- otomatik validasyon.

**Ana kaynak olduğu konular:**

- Sayısal değerler nerede tutulur?
- İlk denge değerleri ne olmalıdır?
- Maç süresi ve çağ zamanları hangi aralıktadır?
- Denge değişiklikleri nasıl test edilir?
- Hangi telemetri toplanır?

---

## 4.14 Vertical Slice Üretim Planı

### [`13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`](./13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md)

İçerik:

- teknik katmanlar yerine baştan sona oynanabilir ürün dilimleri,
- `Ürün A — Oynanış Kanıtı`, `Ürün B — Çekirdek Maç` ve `Ürün C — Sunulabilir Vertical Slice`,
- yeniden düzenlenmiş prototipleme ve üretim sırası,
- her faz için oynanabilir senaryo,
- üretim kapıları ve durdurma kararları,
- görev listeleri, teslimatlar ve kabul kriterleri,
- Codex görev yöntemi,
- riskler ve scope-cut sırası,
- milestone’lar ve Definition of Done.

**Ana kaynak olduğu konular:**

- En küçük baştan sona oynanış hangi sırayla kurulur?
- Oynanış Kanıtı ne zaman başarılı veya başarısız sayılır?
- Şu anda hangi ürün ve faz üzerinde çalışılmalıdır?
- Hangi özellikler çekirdek döngü kanıtlandıktan sonra eklenir?
- Bir faz ne zaman tamamlanmış sayılır?
- Takvim sıkışırsa hangi özellikler kesilir?
- Codex’e görev nasıl verilmelidir?

---

# 5. Önerilen Okuma Sırası

## 5.1 Projeyi ilk kez inceleyen kişi

1. `00_GAME_VISION_AND_PILLARS.md`
2. `01_CORE_GAMEPLAY_LOOP.md`
3. `02_MATCH_FLOW_AND_PROGRESSION.md`
4. `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`

Ardından çalışacağı sisteme ait kaynak belgeyi okumalıdır.

---

## 5.2 Oynanış programcısı

1. `01_CORE_GAMEPLAY_LOOP.md`
2. `03_ECONOMY_AND_RESOURCES.md`
3. `04_BUILDINGS_AND_SETTLEMENT.md`
4. `05_TERRITORY_LOGISTICS_AND_ROADS.md`
5. `06_UNITS_AND_COMBAT.md`
6. `12_BALANCE_AND_GAME_DATA.md`
7. `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`

---

## 5.3 AI geliştiricisi

1. `07_ENEMY_AI_DESIGN_v0.2.md`
2. `03_ECONOMY_AND_RESOURCES.md`
3. `04_BUILDINGS_AND_SETTLEMENT.md`
4. `05_TERRITORY_LOGISTICS_AND_ROADS.md`
5. `06_UNITS_AND_COMBAT.md`
6. `08_MAP_AND_WORLD_DESIGN.md`
7. `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
8. `12_BALANCE_AND_GAME_DATA.md`

---

## 5.4 Harita tasarımcısı

1. `08_MAP_AND_WORLD_DESIGN.md`
2. `05_TERRITORY_LOGISTICS_AND_ROADS.md`
3. `03_ECONOMY_AND_RESOURCES.md`
4. `06_UNITS_AND_COMBAT.md`
5. `07_ENEMY_AI_DESIGN_v0.2.md`
6. `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`

---

## 5.5 UI geliştiricisi

1. `10_CAMERA_CONTROLS_AND_UI.md`
2. `03_ECONOMY_AND_RESOURCES.md`
3. `04_BUILDINGS_AND_SETTLEMENT.md`
4. `05_TERRITORY_LOGISTICS_AND_ROADS.md`
5. `06_UNITS_AND_COMBAT.md`
6. `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
7. `11_ART_ASSETS_AND_PRESENTATION.md`

---

## 5.6 Görsel içerik üreticisi

1. `11_ART_ASSETS_AND_PRESENTATION.md`
2. `02_MATCH_FLOW_AND_PROGRESSION.md`
3. `04_BUILDINGS_AND_SETTLEMENT.md`
4. `06_UNITS_AND_COMBAT.md`
5. `08_MAP_AND_WORLD_DESIGN.md`
6. `10_CAMERA_CONTROLS_AND_UI.md`

---

# 6. Sistemler İçin Source of Truth Matrisi

| Konu | Ana kaynak belge | Destekleyici belgeler |
|---|---|---|
| Proje vizyonu | `00` | `01`, `13` |
| Oynanış döngüsü | `01` | `02`, `03`, `06` |
| Çağ ilerlemesi | `02` | `03`, `04`, `12` |
| Kaynak ekonomisi | `03` | `05`, `12` |
| Yapı kadrosu | `04` | `02`, `11`, `12` |
| Kontrol alanı | `05` | `04`, `08` |
| Yol ve lojistik | `05` | `03`, `10`, `12` |
| Birim rolleri | `06` | `11`, `12` |
| Savaş kuralları | `06` | `09`, `12` |
| AI davranışı | `07` | `03`–`09`, `12` |
| Harita düzeni | `08` | `05`, `07`, `09` |
| Zafer ve yenilgi | `09` | `05`, `07`, `08` |
| Kamera ve input | `10` | `06`, `08` |
| HUD ve arayüz | `10` | `03`–`09`, `11` |
| Sanat yönü | `11` | `04`, `06`, `08`, `10` |
| Sayısal değerler | `12` | Tüm sistem belgeleri |
| Üretim sırası | `13` | Tüm GDD seti |

Bir konuda belgeler arasında çelişki oluşursa:

1. ana kaynak belge dikkate alınır,
2. çelişki `TECH_DECISIONS.md` içine kaydedilir,
3. ilgili belgelerin sürümleri birlikte güncellenir.

---

# 7. Kilitlenmiş Ana Tasarım Kararları

Aşağıdaki kararlar vertical slice üretimi için varsayılan olarak kilitlenmiştir.

## 7.1 Oyun formatı

- Tek oyunculu
- Bir oyuncu ve bir AI rakip
- Tek el yapımı harita
- 20–30 dakika hedef maç süresi
- Masaüstü web
- Klavye ve fare

## 7.2 Gelişim

- Üç çağ: Yerleşim, Kasaba, Krallık
- Yapılar otomatik yükselmez
- Çağ atlama merkez binası üzerinden yapılır
- Refah çağ koşullarından biridir

## 7.3 Ekonomi

- Dört harcanabilir kaynak: Yiyecek, Odun, Taş, Altın
- Nüfus ve Refah harcanabilir kaynak değildir
- İşçiler üretim yapılarında çalışır
- İşçiler kaynakları fiziksel olarak depoya taşımaz
- Üretim yerel tamponda birikir
- Yol bağlantısı varsa global stoğa aktarılır
- Taş ve altın sonludur
- Yiyecek sürdürülebilirdir
- Odun ağırlıklı olarak sonludur

## 7.4 Yapılar

- Grid veya grid destekli yerleştirme
- 90 derece dönüş
- İnşaat işçiler tarafından yapılır
- Çoklu işçi azalan verimle hızlandırır
- Ana yapılar üç seviye kullanabilir
- Tam duvar ve kapı sistemi kapsam dışıdır

## 7.5 Bölge ve lojistik

- Normal yapılar yalnız kontrol alanında kurulur
- Karakol kontrol alanının hemen dışında kurulabilir
- Karakol tamamlanınca küçük alan açar
- Merkez yoluna bağlanınca tam alan açar
- Yol ağı ekonomik graph olarak çalışır
- Yol graph ile birim pathfinding ayrıdır
- Yol segmentleri vertical slice içinde doğrudan saldırılamaz
- Alternatif rota desteklenir
- İlk sürümde yol mesafesi üretim cezası oluşturmaz

## 7.6 Savaş

- Küçük ve rol odaklı birim kadrosu
- İşçi, Muhafız, Okçu ve Kuşatma zorunlu
- Süvari kapsam durumuna bağlı
- Yumuşak karşıtlık sistemi
- Saldırı-hareket zorunlu
- Yakın dövüş saldırı slotları
- Dost ateşi yok
- Karmaşık zırh sistemi yok
- Dost bölgede savaş dışı yavaş iyileşme
- Veteranlık ve moral kapsam dışıdır

## 7.7 AI

- İlk uygulama üç katman kullanır: `KingdomDirector`, `ArmyController`, yerel birim davranışları
- Stratejik ve operasyonel kararlar ilk vertical slice içinde tek yönetici altında birleşir
- İlk rakip beş ana niyet kullanır: Ekonomi, Çağ Atla, Genişle, Savun, Saldır
- `AI-1` tek ekonomi planı, tek genişleme ve tek saha ordusuyla Oynanış Kanıtı üretir
- `AI-2` dört kaynak, iki çağ, savunma ve sınırlı hedef değerlendirmesiyle Çekirdek Maçı destekler
- Çoklu ordu, gelişmiş keşif ve tam fog uyumu yalnız çekirdek maç kanıtlandıktan sonra değerlendirilir
- Oyuncuyla aynı temel ekonomi ve maliyetler kullanılır
- İlk hedef tek Normal profildir; Kolay ve Zor daha sonra parametre varyantı olarak eklenir
- Harita aday noktaları ve hazır genişleme reçeteleri serbest dünya aramasına tercih edilir
- Debug paneli, karar logları ve fallback davranışları zorunludur

## 7.8 Harita

- Harita çalışma adı: `İki Nehir Arası`
- Oyuncu güneybatıda
- AI kuzeydoğuda
- İki yan genişleme alanı
- Merkezi yüksek değerli kaynak
- İki ana geçit
- En az bir yan baskın rotası
- İki stratejik nokta
- Sabit köprüler
- Tek biyom
- Sabit gündüz

## 7.9 Zafer

- Ürün A ve Ürün B için zorunlu zafer: düşman ana merkezini yok et
- Tek ana merkez vardır ve merkez yeniden inşa edilmez
- Bölgesel zafer Ürün C içindeki koşullu stratejik sistemdir
- Bölgesel zafer yalnız harita kontrolü ve AI karşılığı yeterince güvenilir olduğunda eklenir
- Bölgesel zafer eklenirse ilk sayaç hedefi 180 saniyedir ve nokta kaybında sayaç geriler
- Teslim olma temel maç akışı tamamlandıktan sonra eklenebilir

## 7.10 Kamera ve UI

- Sabit yönlü RTS kamera
- WASD ve ekran kenarı hareketi
- Fare tekerleği zoom
- Sol tık seçim
- Sağ tık bağlamsal komut
- Kutu seçimi
- Ürün A’da yalnız gerekli ekonomi, bağlantı ve zafer bilgileri gösterilir
- Lojistik overlay, yol ve karakol kanıtı fazında eklenir
- Fog of war ve minimap Ürün C için koşullu sistemlerdir
- Gerçek pause sunulabilir vertical slice aşamasında değerlendirilebilir
- Mobil ve gamepad kapsam dışıdır

## 7.11 Görsel yön

- Stilize low-poly fantastik orta çağ
- Quaternius paketi ana asset kaynağı
- Kontrollü takım renkleri
- Seçim halkası
- Üç yapı hasar durumu
- Fizik tabanlı yıkım yok
- Kalıcı ceset yok
- LOD, instancing ve paylaşılan materyaller

## 7.12 Veri ve denge

- JSON oyun verisi
- JSON Schema doğrulaması
- TypeScript tipleri
- Sayısal değerler kod içine gömülmez
- Normal AI çarpanları 1.0
- Ürün A’da yalnız hedefli test kayıtları ve temel sayaçlar tutulur
- Denge sürümü ve changelog Çekirdek Maç aşamasında zorunlu hale gelir
- Otomatik ekonomi ve combat simülasyonu ihtiyaç ortaya çıktıkça küçük araçlarla eklenir
- Tam telemetri altyapısı oynanış kanıtının ön koşulu değildir

---

# 8. Prototipleme Stratejisi ve Scope Kapıları

Prototipleme sırası tek bir büyük vertical slice üretmeye çalışmaz. Her ürün seviyesi bağımsız olarak oynanabilir, test edilebilir ve durdurulabilir olmalıdır.

## 8.1 Ürün A — Oynanış Kanıtı

Amaç:

> Yol, karakol, dış ekonomi ve savaş arasındaki ilişkinin eğlenceli olup olmadığını en düşük maliyetle doğrulamak.

Zorunlu çekirdek:

- küçük blockout harita,
- Yiyecek, Odun ve Nüfus,
- İşçi ve Muhafız,
- Merkez, Ev, iki üretim yapısı, Depo, Kışla ve Karakol,
- seçim, hareket, yapı kurma ve basit savaş,
- Yol I, kontrol alanı ve tek dış ekonomi,
- `AI-1` rakip,
- askerî zafer,
- temel debug görünümü.

Bu aşamada bilinçli olarak bulunmaz:

- Taş ve Altın,
- ikinci ve üçüncü çağ,
- Okçu ve Kuşatma,
- Refah,
- fog of war ve minimap,
- bölgesel zafer,
- save/load,
- tam telemetri,
- görsel polish.

Ürün A başarısızsa Ürün B kapsamına geçilmez. Önce lojistik döngü değiştirilir, sadeleştirilir veya iptal edilir.

## 8.2 Ürün B — Çekirdek Maç Prototipi

Ürün A başarıyla tamamlandıktan sonra eklenir:

- Taş ve Altın,
- Yerleşim ve Kasaba seviyeleri,
- Okçu ve tek Kuşatma birimi,
- alternatif lojistik rota,
- `AI-2` rakip,
- çekirdek HUD ve maç akışı,
- 12–20 dakikalık tekrar oynanabilir maç.

Bu aşamanın hedefi içerik miktarı değil, baştan sona güvenilir bir RTS maçı üretmektir.

## 8.3 Ürün C — Sunulabilir Vertical Slice

Yalnız Ürün B dengeli ve teknik olarak güvenilir olduğunda değerlendirilir:

- Krallık seviyesi,
- maçı bitirici geç oyun içeriği,
- gerçek asset entegrasyonu,
- ses, VFX ve sunum,
- daha kapsamlı denge testleri.

Aşağıdaki sistemler bağımsız scope kararıdır ve otomatik olarak zorunlu sayılmaz:

- bölgesel zafer,
- fog of war,
- minimap,
- Refahın mekanik etkisi,
- save/load,
- Kolay ve Zor AI,
- gelişmiş telemetri,
- Yol II,
- kule,
- tam ayarlar ve erişilebilirlik paketi.

## 8.4 Scope Cut Sırası

Takvim veya teknik risk oluşursa özellikler aşağıdaki sırayla ertelenir:

1. Save/load.
2. Süvari.
3. Kolay ve Zor AI profilleri.
4. Bölgesel zafer.
5. Fog of war ve minimap.
6. Refahın mekanik etkisi.
7. Okçunun ayrı üretim binası.
8. Yol II ve yol yükseltmeleri.
9. Kule veya ek savunma yapısı.
10. Gelişmiş telemetri ve ayrıntılı maç sonu grafikleri.
11. Gelişmiş VFX ve çevresel polish.
12. Kontrol grupları ve ikincil RTS kolaylıkları.

Kesilmemesi gereken Ürün A çekirdeği:

- iki kaynaklı ekonomi,
- yapı kurma,
- karakol,
- yol bağlantısı,
- kontrol alanı,
- tek dış ekonomi,
- İşçi ve Muhafız,
- bir AI rakip,
- savaş,
- askerî zafer.

---

# 9. Ürün Kapılarında Kapatılacak Kararlar

Bütün kararların Faz 0’da kapanması gerekmez. Bir karar yalnızca ilgili ürün kapısına gelindiğinde zorunlu hale gelir.

## 9.1 Faz 0 öncesi

- [ ] Kamera temel olarak perspektif mi, ortografik mi kullanılacak?
- [ ] Yapı ve yol grid çözünürlükleri nedir?
- [ ] İlk test birimi için pathfinding yöntemi nedir?
- [ ] Oyun verisinin minimum JSON şeması nedir?

## 9.2 Ürün A öncesi

- [ ] Yiyecek üretimi tarla mı, sabit kaynak alanı mı kullanacak?
- [ ] Yol yapımı ilk prototipte anlık mı, kısa süreli mi olacak?
- [ ] Karakol bağlantısızken küçük alan üretme kuralı korunacak mı?
- [ ] Düşman lojistiğini bozma, karakol/depo yıkımıyla yeterince anlaşılır mı?
- [ ] AI-1 için kullanılacak tek genişleme adayı hangisidir?

## 9.3 Ürün B öncesi

- [ ] Okçu Kışla II içinde mi açılacak?
- [ ] Kuşatma birimi koçbaşı mı, mancınık mı olacak?
- [ ] Kasabaya geçiş maliyeti ve koşulları nedir?
- [ ] Alternatif lojistik rotalar nasıl seçilecektir?
- [ ] AI-2 savunma ve saldırı eşikleri nedir?

## 9.4 Ürün C öncesi

- [ ] Üçüncü çağ gerçekten maçı bitiren yeni bir karar üretiyor mu?
- [ ] Bölgesel zafer üretim kapsamına girecek mi?
- [ ] Fog of war ve minimap birlikte mi eklenecek?
- [ ] Refah yalnız bilgi göstergesi mi, mekanik koşul mu olacak?
- [ ] Save/load sunum hedefi için gerekli mi?

---

# 10. Başlangıç İçin Kilitlenmiş Prototip Kararları

İlk teknik uygulamayı hızlandırmak için:

- İlk oynanış yalnız Yiyecek, Odun ve Nüfus kullanır.
- İlk askerî kadro İşçi ve Muhafızdan oluşur.
- İlk maç yalnız düşman merkezini yok ederek biter.
- Süvari vertical slice kapsamından çıkarılmıştır.
- Okçu ayrı bina yerine Kışla II içinde açılır.
- İlk kuşatma adayı koçbaşıdır.
- Kamera yönü sabittir.
- İlk yol prototipi işçi gerektirmez.
- Yalnız Yol I ile başlanır.
- Karakol tamamlandığında küçük alan, bağlantı kurulduğunda tam alan açar.
- `AI-1` tek genişleme ve tek saha ordusu kullanır.
- Fog, minimap, Refah, save/load ve bölgesel zafer Ürün A dışında tutulur.
- Görsel polish, lojistik döngü eğlenceli bulunmadan başlamaz.

Bu kararlar yalnız test kanıtıyla değiştirilmelidir.

---

# 11. Üretim Durumu

## 11.1 GDD

- [x] Vizyon ve sütunlar
- [x] Çekirdek oynanış döngüsü
- [x] Maç akışı ve ilerleme
- [x] Ekonomi ve kaynaklar
- [x] Yapılar ve yerleşim
- [x] Bölge, lojistik ve yollar
- [x] Birimler ve savaş
- [x] Düşman AI
- [x] Harita ve dünya
- [x] Zafer, yenilgi ve zorluk
- [x] Kamera, kontroller ve UI
- [x] Görsel yön ve assetler
- [x] Denge ve oyun verisi
- [x] Vertical slice üretim planı
- [x] GDD ana indeks

## 11.2 Üretim öncesi belgeler

- [x] `TECH_DECISIONS.md` — oluşturuldu (`GDD/TECH_DECISIONS.md`): Forge hizalama kararları ve Sapma kayıtları
- [x] `SCOPE_LOG.md` — oluşturuldu (`GDD/SCOPE_LOG.md`): kapsam kararları ve kesinti kaydı (SL-001…SL-003)
- [ ] `ASSET_INVENTORY.md`
- [ ] `GAME_DATA_SCHEMA_PLAN.md`
- [ ] `TEST_STRATEGY.md`

## 11.3 Teknik uygulama — yeniden düzenlenmiş prototipleme sırası

### Ürün A — Oynanış Kanıtı

- [x] Faz 0 — Üretim temeli (feature flag + logger + hata yakalama + veri loader/validator + gameplay_proof/debug_fast preset + versiyon; `build:verify` yeşil)
- [ ] Faz 1 — Oynanabilir omurga
- [ ] Faz 2 — Küçük harita ve yapı kurma
- [ ] Faz 3 — İki kaynaklı ekonomi
- [ ] Faz 4 — Karakol, yol ve lojistik kanıtı
- [ ] Faz 5 — AI-1 oynanış kanıtı rakibi
- [ ] Ürün Kapısı A — Lojistik döngü eğlenceli ve anlaşılır mı?

### Ürün B — Çekirdek Maç Prototipi

- [ ] Faz 6 — Tam ekonomi ve iki çağ
- [ ] Faz 7 — Çekirdek savaş kadrosu
- [ ] Faz 8 — AI-2 çekirdek maç rakibi
- [ ] Faz 9 — Çekirdek maç UI ve akışı
- [ ] Ürün Kapısı B — 12–20 dakikalık maç güvenilir ve tekrar oynanabilir mi?

### Ürün C — Sunulabilir Vertical Slice

- [ ] Faz 10 — Üçüncü çağ ve maçı bitirme
- [ ] Faz 11 — Koşullu stratejik sistemler
- [ ] Faz 12 — Asset entegrasyonu ve sunum
- [ ] Faz 13 — Denge ve test
- [ ] Faz 14 — Polish ve release candidate
- [ ] Ürün Kapısı C — 20–30 dakikalık sunulabilir vertical slice hazır mı?

---

# 12. Codex İçin Belge Kullanım Kuralı

Her Codex görevi şu bilgileri içermelidir:

1. Ana GDD kaynak belgesi
2. Destekleyici GDD belgeleri
3. Mevcut teknik belge
4. Kapsam
5. Kapsam dışı
6. Değiştirilebilecek dosyalar
7. Veri gereksinimleri
8. Event ve durum gereksinimleri
9. Kabul kriterleri
10. Test komutları
11. Dokümantasyon güncellemesi

Örnek kaynak bölümü:

```markdown
## Kaynak Belgeler

Ana kaynak:
- GDD/05_TERRITORY_LOGISTICS_AND_ROADS.md

Destekleyici:
- GDD/03_ECONOMY_AND_RESOURCES.md
- GDD/04_BUILDINGS_AND_SETTLEMENT.md
- GDD/10_CAMERA_CONTROLS_AND_UI.md
- GDD/12_BALANCE_AND_GAME_DATA.md
```

---

# 13. Belge Güncelleme Kuralları

## 13.1 Tasarım kararı değiştiğinde

1. Ana kaynak belge güncellenir.
2. Bu master belgedeki kilit karar güncellenir.
3. Etkilenen diğer belgeler aranır.
4. Balance verisi etkileniyorsa changelog yazılır.
5. Teknik uygulama başladıysa `TECH_DECISIONS.md` güncellenir.
6. Revizyon notuna değişiklik eklenir.

## 13.2 Sayısal değer değiştiğinde

- Ana kaynak: `12_BALANCE_AND_GAME_DATA.md`
- Runtime kaynak: `/game-data/balance/`
- Kayıt: `balance_changelog.md`

GDD içindeki diğer belgelerde kesin sayılar mümkün olduğunca tekrar edilmemelidir.

## 13.3 Teknik uygulama GDD’den saparsa

Sapma sessizce bırakılmamalıdır.

Şu formatta kaydedilmelidir:

```markdown
## Sapma

GDD:
[Yazılı davranış]

Uygulama:
[Gerçek davranış]

Neden:
[Teknik veya tasarımsal gerekçe]

Karar:
- GDD güncellenecek
veya
- Uygulama düzeltilecek
```

---

# 14. Definition of Done Özeti

Vertical slice tamamlanmış sayılırsa (yetkili kaynak: `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` §107; **save/load kapsam dışıdır**, fog/minimap ve bölgesel zafer koşulludur):

- [ ] Tek haritada tam maç oynanabiliyor.
- [ ] AI kendi ekonomisini kuruyor.
- [ ] AI iki çağ atlıyor.
- [ ] AI karakol ve yollarla genişliyor.
- [ ] Dört kaynak çalışıyor.
- [ ] Yerel tampon ve global stok çalışıyor.
- [ ] Oyuncu üç çağdan geçebiliyor.
- [ ] En az dört çekirdek birim çalışıyor.
- [ ] Savaş ve geri çekilme çalışıyor.
- [ ] Askerî zafer çalışıyor (zorunlu ana zafer).
- [ ] Bölgesel zafer — yalnızca Ürün C kapsam kararında kabul edildiyse çalışıyor (koşullu; bkz. 13 v0.2 §58, §107).
- [ ] Fog of war ve minimap — koşullu sistemlerdir; yalnızca kabul edildiyse çalışır (bkz. 13 v0.2 §59–60, §107).
- [ ] Temel UI sistemleri açıklıyor.
- [ ] Quaternius assetleri entegre.
- [ ] Ortalama maç süresi hedefe yakın.
- [ ] Kritik blocker hata yok.
- [ ] Telemetri ve test raporu mevcut.
- [ ] GDD ile uygulama arasında büyük tutarsızlık yok.

---

# 15. Önerilen Sonraki Adım

GDD seti tamamlanmış, kapsam v0.2 (Ürün A/B/C) modeline hizalanmış ve `TECH_DECISIONS.md` oluşturulmuştur.

Sıradaki adım doğrudan üretim temelidir:

```text
13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md → Faz 0 (Üretim Temeli)
```

Ayrı bir `OPEN_QUESTIONS.md` belgesi tutulmayacaktır. Açık tasarım soruları:

- her sistem belgesinin kendi "Açık Tasarım Soruları" bölümünde,
- `TECH_DECISIONS.md` içindeki açık teknik kararlar listesinde,
- ve `13`'ün ürün kapıları (Kapı A/B/C) ile karar kapılarında (§9)

izlenir. Bir karar yalnızca ilgili ürün kapısına gelindiğinde zorunlu hale gelir.

---

# 16. Revizyon Notları

## Sürüm 0.2

- Ana üretim kaynağı `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` olarak güncellendi.
- AI ana kaynağı `07_ENEMY_AI_DESIGN_v0.2.md` olarak güncellendi.
- Eski teknik katman sırası, üç ürün kapısına bağlı oynanabilir dilimlerle değiştirildi.
- Ürün A, Ürün B ve Ürün C kapsamları ana indekste görünür hale getirildi.
- Dört kaynak, üç çağ, fog, minimap ve bölgesel zafer ilk prototip ön koşulu olmaktan çıkarıldı.
- AI özeti üç katmanlı ve aşamalı modele uyarlandı.
- Scope-cut sırası ve karar kapıları sadeleştirilmiş plana göre yenilendi.
- Teknik uygulama checklist’i Faz 0–14 sırasına güncellendi.

## Bakım — Kapsam Hizalaması ve Forge Teknik Kararları (2026-07-15)

- Kırık çapraz-bağlantılar düzeltildi: v0.1 sistem belgeleri artık `07_ENEMY_AI_DESIGN_v0.2.md` ve `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`’ye bağlanıyor.
- `/docs/gdd/` yol referansları gerçek konum `GDD/` ile düzeltildi (master §12, 00 §23, 13 Faz 0).
- v0.1 belgelerine (00–06, 08–12) **Kapsam Hizalaması (v0.2)** bannerı eklendi; üretim kapsamı kaynağı 13 v0.2 (Ürün A/B/C) olarak işaretlendi.
- §14 Definition of Done, 13 v0.2 §107 ile hizalandı: save/load kapsam dışı; fog/minimap ve bölgesel zafer koşullu.
- 00 §15.1 tam-oyun-hedefi olarak yeniden çerçevelendi; Ürün A/B/C aşamalandırması eklendi.
- `TECH_DECISIONS.md` oluşturuldu (Forge hizalaması: oyun kodu `src/game`, veri `public/game-data/`, mevcut kamera/seçim/VFX/asset altyapısının yeniden kullanımı; S-001/S-002 sapmaları).

## Sürüm 0.1

- Tüm ana GDD belgeleri tek indeks altında toplandı.
- Belge açıklamaları ve source-of-truth matrisi oluşturuldu.
- Kilitlenmiş ana tasarım kararları özetlendi.
- Scope cut sırası tekrar tanımlandı.
- Üretim öncesi açık kararlar listelendi.
- GDD ve teknik üretim durumu checklist’e dönüştürüldü.
- Codex belge kullanım ve güncelleme kuralları eklendi.
- Vertical slice Definition of Done özeti oluşturuldu.

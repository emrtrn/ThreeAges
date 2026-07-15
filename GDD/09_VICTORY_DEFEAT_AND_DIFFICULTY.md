# 09 — Victory, Defeat and Difficulty

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Zafer, Yenilgi ve Zorluk Sistemi  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `03_ECONOMY_AND_RESOURCES.md`  
> - `04_BUILDINGS_AND_SETTLEMENT.md`  
> - `05_TERRITORY_LOGISTICS_AND_ROADS.md`  
> - `06_UNITS_AND_COMBAT.md`  
> - `07_ENEMY_AI_DESIGN_v0.2.md`  
> - `08_MAP_AND_WORLD_DESIGN.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. Askerî zafer zorunludur; bölgesel zafer ve çoklu zorluk profilleri (Kolay/Zor) koşulludur, save/load kapsam dışıdır. Çelişki halinde 13 v0.2 esastır. Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman maçın nasıl kazanıldığını, hangi durumlarda kaybedildiğini, zorluk seviyelerinin neyi değiştirdiğini ve maç sonunun oyuncuya nasıl sunulduğunu tanımlar.

Belge şu sorulara cevap verir:

- Oyuncu hangi yollarla zafer kazanabilir?
- Askerî ve bölgesel zafer nasıl işler?
- Zafer koşulları birbirini nasıl tamamlar?
- Oyuncu hangi durumlarda yenilmiş sayılır?
- Oyuncunun toparlanma şansı hangi noktaya kadar korunur?
- Maçın gereksiz uzaması nasıl önlenir?
- Teslim olma sistemi gerekli midir?
- AI zafer ve yenilgi koşullarına nasıl tepki verir?
- Zorluk seviyeleri hangi parametreleri değiştirir?
- AI ekonomik bonus kullanacaksa sınırı ne olmalıdır?
- Maç sonu ekranında hangi veriler gösterilmelidir?
- Vertical slice için hangi zafer ve zorluk özellikleri zorunludur?

---

## 2. Tasarım Hedefi

Zafer sistemi oyuncuya yalnızca “düşmanın tüm binalarını yok et” hedefi vermemelidir.

Oyuncu şu hissi yaşamalıdır:

> “Ekonomik, askerî ve bölgesel üstünlüğümü anlaşılır bir hedefe dönüştürerek maçı bitirdim.”

Sistem:

- en az iki geçerli zafer yolu sunmalı,
- farklı oyun tarzlarını desteklemeli,
- pasif savunmaya kapanmayı cezalandırmalı,
- oyunu doğal biçimde sona erdirmeli,
- oyuncuya yaklaşan zafer veya yenilgiyi açıkça göstermeli,
- geri dönüş ihtimalini tamamen yok etmeden kartopu etkisini sınırlandırmalıdır.

---

## 3. Temel İlkeler

### 3.1 Zafer koşulları görünür olmalıdır

Oyuncu maç başından itibaren:

- hangi koşullarla kazanabileceğini,
- ne kadar ilerlediğini,
- AI’ın ne kadar yaklaştığını

görebilmelidir.

### 3.2 Tek yol zorunlu olmamalıdır

Askerî ve bölgesel zafer birlikte bulunmalıdır.

Oyuncu:

- düşman merkezini yıkabilir,
- stratejik noktaları kontrol ederek rakibi zorlayabilir.

### 3.3 Zafer koşulları oyun sistemlerini kullanmalıdır

Askerî zafer:

- ekonomi,
- birlik üretimi,
- kuşatma,
- lojistik

gerektirir.

Bölgesel zafer:

- keşif,
- karakol,
- yol,
- bölge kontrolü,
- savunma

gerektirir.

### 3.4 Yenilgi anlık ve şaşırtıcı olmamalıdır

Oyuncu:

- neden kaybettiğini,
- ne kadar zamanı kaldığını,
- nasıl engelleyebileceğini

anlayabilmelidir.

### 3.5 Maç bitişi ertelenmemelidir

Bir taraf açık üstünlük kurduğunda:

- AI maçı bitirmeye çalışmalı,
- bölgesel sayaç baskı yaratmalı,
- başlangıç kaynakları sonsuz savunmayı desteklememelidir.

---

# BÖLÜM A — ZAFER YOLLARI

## 4. Vertical Slice Zafer Koşulları

İlk vertical slice iki ana zafer koşulu kullanacaktır:

1. Askerî Zafer
2. Bölgesel Zafer

Gelecekte üçüncü bir ekonomik veya Refah zaferi eklenebilir.

---

## 5. Askerî Zafer

Askerî zaferin ana koşulu:

> Düşman Merkez Binası III veya mevcut ana merkez yapısını yok et.

Ancak merkez binasının yok edilmesi tek başına her zaman yeterli olmayabilir.

İki yaklaşım vardır.

### Seçenek A — Merkez yıkılırsa anlık zafer

Avantajları:

- açık,
- klasik,
- hızlı.

Dezavantajları:

- ikinci merkez veya geri dönüş sistemi varsa yetersiz,
- tek baskınla ani bitiş yaratabilir.

### Seçenek B — Merkez yıkımı + yeniden kurma kapasitesi yoksa zafer

Avantajları:

- geri dönüş imkânı,
- daha tutarlı yenilgi.

Dezavantajları:

- maçı uzatabilir.

**Önerilen vertical slice kararı:**  
Oyuncu ve AI yalnızca bir ana merkez binasına sahip olsun. Merkez yıkıldığında askerî zafer gerçekleşsin.

Bu karar kapsamı sade tutar.

---

## 6. Merkez Binası Yenilgi Önemi

Merkez binası:

- çağ atlama,
- işçi üretimi,
- ana kontrol alanı,
- başlangıç deposu,
- komuta merkezi

olduğu için yıkımı mantıklı bir son hedef oluşturur.

Merkez:

- erken oyunda kolayca yıkılmamalı,
- kuşatma desteği olmadan uzun süre dayanmalı,
- savunmasız bırakıldığında yine de yok edilebilir olmalıdır.

---

## 7. Askerî Zafer Akışı

```text
Düşman ekonomisini zayıflat
→ Karakol ve depo ağını boz
→ Ordu üstünlüğü kur
→ Kuşatma desteği hazırla
→ Merkez bölgeye ilerle
→ Ana merkezi yok et
→ Askerî zafer
```

---

## 8. Askerî Zaferin Riskleri

Askerî zafer:

- yüksek ordu maliyeti,
- uzun saldırı rotası,
- lojistik açık,
- karşı baskın ihtimali,
- savunma zayıflığı

yaratmalıdır.

Oyuncu tüm ordusunu saldırıya gönderdiğinde kendi stratejik noktalarını veya ekonomisini savunmasız bırakabilir.

---

## 9. Bölgesel Zafer

Bölgesel zaferin ana koşulu:

> Haritadaki iki ana stratejik noktayı aynı anda kontrol et ve belirli süre boyunca koru.

İlk harita iki stratejik nokta içerdiği için ikisinin de kontrol edilmesi önerilir.

---

## 10. Bölgesel Zafer Akışı

```text
Stratejik noktaları keşfet
→ Noktaları askerî güçle ele geçir
→ Yakınlarına karakol kur veya kontrol alanına bağla
→ Her iki noktayı aynı anda kontrol et
→ Zafer sayacını başlat
→ Süre boyunca savun
→ Bölgesel zafer
```

---

## 11. Bölgesel Zafer İçin Tam Kontrol

Bir stratejik noktanın tam kontrol altında sayılması için:

- oyuncuya ait olması,
- düşman biriminin ele geçirme alanında bulunmaması,
- dost kontrol alanı veya aktif karakol bağlantısı içinde olması

önerilir.

Geçici askerî işgal:

- ele geçirme hakkı sağlar,
- fakat bölgesel zafer sayacını başlatmayabilir.

Bu karar karakol ve lojistik sistemini zafer koşuluna bağlar.

---

## 12. Bölgesel Zafer Sayacı

Önerilen ilk hedef:

- 180 saniye

Bu değer geçicidir.

Sayaç:

- iki nokta tam kontrol edildiğinde başlar,
- oyuncuya ve AI’a görünür,
- bir nokta kaybedildiğinde durur,
- tartışmalı duruma geçtiğinde durur,
- rakibe geçerse sıfırlanır veya geriler.

---

## 13. Sayaç Davranışı Seçenekleri

### Seçenek A — Nokta kaybında sıfırlanır

Avantajı:

- anlaşılır,
- savunma baskısı yüksek.

Dezavantajı:

- maç uzayabilir.

### Seçenek B — Nokta kaybında geriler

Avantajı:

- ilerleme tamamen kaybolmaz,
- daha akıcı.

Dezavantajı:

- okunması daha karmaşık.

**Önerilen karar:**  
Sayaç nokta kaybında yavaşça gerilesin, düşman iki noktayı da ele geçirirse sıfırlansın.

---

## 14. Bölgesel Zaferin Tasarım Rolü

Bölgesel zafer:

- merkez savunmasına kapanmayı cezalandırır,
- harita ortasını değerli kılar,
- daha az kuşatma odaklı oyun tarzı sunar,
- AI’ı dışarı çıkmaya zorlar,
- geç oyun çıkmazını önler.

---

## 15. Zafer Yolları Arasında Geçiş

Oyuncu tek bir zafer yoluna kilitlenmemelidir.

Örnek:

- Bölgesel noktaları ele geçirirken AI ordusu dağıldı.
- Oyuncu sayacı savunmak yerine merkeze saldırabilir.

veya:

- Ana saldırı başarısız oldu.
- Oyuncu kalan ordusuyla stratejik noktaları tutabilir.

---

# BÖLÜM B — GELECEKTEKİ ZAFER TÜRLERİ

## 16. Refah Zaferi

Gelecekte değerlendirilebilecek koşul:

- Krallık seviyesine ulaş,
- yüksek Refah değerini koru,
- özel bir yönetim veya anıt yapısı kur,
- belirli süre savun.

İlk vertical slice için kapsam dışıdır.

---

## 17. Ekonomik Zafer

Olası gelecek koşulu:

- belirli toplam üretim,
- ticaret geliri,
- yüksek kaynak rezervi,
- pazar ağı.

Bu sistem oyunun savaş ve bölge temasını zayıflatabileceği için dikkatli değerlendirilmelidir.

---

## 18. Görev Bazlı Zafer

Senaryo modunda:

- kervanı koru,
- belirli kaleyi savun,
- süre dolana kadar hayatta kal,
- tarafsız bölgeyi ele geçir

gibi koşullar eklenebilir.

Vertical slice serbest çatışma formatında kalacaktır.

---

# BÖLÜM C — YENİLGİ KOŞULLARI

## 19. Ana Yenilgi Koşulları

Oyuncu şu durumlarda kaybeder:

1. Ana merkez binası yok edilirse
2. AI bölgesel zafer sayacını tamamlarsa
3. Oyuncu teslim olursa

---

## 20. Merkez Kaybı

Merkez binası yıkıldığında:

- üretim durur,
- ana kontrol alanı kaybolur,
- maç askerî yenilgiyle biter.

İlk vertical slice içinde:

- merkez yeniden inşa edilmez,
- ikinci merkez kurulmaz.

---

## 21. Bölgesel Yenilgi

AI iki stratejik noktayı tam kontrol eder ve sayacı tamamlarsa oyuncu kaybeder.

Sayaç boyunca oyuncu:

- kalan süreyi,
- kontrol edilen noktaları,
- en yakın hedefi

görebilmelidir.

---

## 22. Teslim Olma

Oyuncu maç sırasında teslim olabilir.

Teslim olma:

- onay penceresi gerektirir,
- mevcut ilerlemeyi sonlandırır,
- maç sonu ekranına götürür,
- yenilgi olarak kaydedilir.

Bu özellik, fiilen kaybedilmiş maçların gereksiz uzamasını önler.

---

## 23. Yumuşak Yenilgi Durumları

Aşağıdaki durumlar anlık yenilgi değildir:

- tüm ordunun kaybedilmesi,
- dış ekonominin kaybedilmesi,
- bir karakolun yıkılması,
- nüfus kapasitesinin düşmesi,
- çağ yarışında geri kalma,
- bir stratejik noktanın kaybedilmesi.

Oyuncu bu kayıplardan toparlanabilmelidir.

---

## 24. Ekonomik Kilitlenme

Oyuncu:

- işçi üretemiyor,
- kaynak kazanamıyor,
- merkezini onaramıyor,
- yeni yapı kuramıyor

duruma düşebilir.

İlk vertical slice içinde bu durum otomatik yenilgi sayılmamalıdır.

Ancak:

- merkez yıkılmaya açıksa AI bitirici saldırı yapmalıdır,
- oyuncuya teslim olma önerisi gösterilebilir.

---

## 25. Son İşçi Kaybı

Tüm işçiler kaybedildiğinde:

- merkez hâlâ işçi üretebiliyorsa maç devam eder,
- yeterli yiyecek yoksa oyuncu kilitlenebilir.

Önerilen güvenlik:

- merkez ilk işçi için düşük maliyetli acil üretim sunabilir,
- yalnızca bir kez kullanılabilir,
- oyuncuyu tamamen kurtarmak yerine yeniden başlama şansı verir.

Bu özellik vertical slice içinde opsiyoneldir.

---

# BÖLÜM D — GERİ DÖNÜŞ VE KARTOPU KONTROLÜ

## 26. Geri Dönüş Tasarım Hedefi

Başarılı oyuncu avantaj kazanmalıdır.

Ancak:

- tek küçük hata maçı bitirmemeli,
- gerideki oyuncunun en az bir anlamlı karşı hamlesi bulunmalıdır.

---

## 27. Geri Dönüş Araçları

### 27.1 Merkeze yakın güvenli kaynaklar

Düşük verimli fakat güvenli üretim sağlar.

### 27.2 Kısa savunma rotası

Savunan taraf birliklerini daha hızlı toplar.

### 27.3 Alternatif yol

Ana dış ekonomi kaybedilse bile başka rota kurulabilir.

### 27.4 Ucuz temel birlik

Gerideki oyuncu tamamen savunmasız kalmaz.

### 27.5 Karşı baskın

Rakip ordusu uzaktayken dış ekonomisi hedeflenebilir.

### 27.6 Bölgesel zafer tehdidi

Askerî olarak geride olan oyuncu stratejik noktalarla rakibi bölmeye zorlayabilir.

---

## 28. Savunmacı Avantajın Sınırı

Savunma:

- merkez yakınlığında güçlenmeli,
- fakat tamamen güvenli olmamalıdır.

Kule ve merkez:

- saldırıyı yavaşlatmalı,
- kuşatma gerektirmeli,
- tek başına sonsuz savunma sağlamamalıdır.

---

## 29. Catch-Up Bonusu

Doğrudan gizli kaynak bonusu önerilmez.

Gelecekte kullanılabilecek sınırlı araçlar:

- düşük nüfusta işçi üretim indirimi,
- yok edilen karakolu yeniden kurmada küçük maliyet indirimi,
- merkez yakınında yavaş iyileşme.

Bu sistemler açık ve simetrik olmalıdır.

---

## 30. Kartopu İşaretleri

Telemetride izlenmesi gereken durumlar:

- ilk büyük çatışmayı kazananın maç kazanma oranı,
- ilk karakolu kaybedenin maç kazanma oranı,
- çağ farkının maç sonucuna etkisi,
- ilk stratejik noktayı alanın kazanma oranı,
- işçi kaybı ile zafer ilişkisi.

Bir erken olay %80–90’dan fazla maç sonucunu belirliyorsa denge yeniden incelenmelidir.

---

# BÖLÜM E — MAÇI BİTİRME BASKISI

## 31. Geç Oyun Çıkmazı

İki taraf da savunmaya kapanırsa maç uzayabilir.

Bunu önlemek için:

- merkezi kaynaklar tükenebilir,
- bölgesel zafer aktif olur,
- Krallık seviyesinde kuşatma açılır,
- başlangıç kaynakları yetersiz kalır,
- stratejik noktalar açık alanda bulunur.

---

## 32. Sudden Death Kullanımı

İlk vertical slice için zorunlu değildir.

Gelecekte maç çok uzarsa:

- stratejik sayaç süresi kısalabilir,
- merkezi kaynak değeri artabilir,
- savunma yapıları bakım maliyeti alabilir.

Ancak bu sistemler yapay hissettirebilir.

Öneri:

Önce doğal harita ve kaynak baskısı denenmelidir.

---

## 33. Maksimum Hedef Maç Süresi

İdeal:

- 20–30 dakika.

Kabul edilebilir üst sınır:

- 40 dakika.

40 dakikayı aşan maç oranı yüksekse:

- bölgesel sayaç,
- kaynak dağılımı,
- yapı dayanıklılığı,
- kuşatma gücü

yeniden dengelenmelidir.

---

# BÖLÜM F — ZAFER VE YENİLGİ GERİ BİLDİRİMİ

## 34. Zafer İlerlemesi UI

Ekranda şu bilgiler bulunmalıdır:

- Askerî hedef: Düşman Merkez Sağlığı
- Bölgesel hedef: 0/2, 1/2 veya 2/2 nokta
- Bölgesel sayaç
- AI’ın sayaç ilerlemesi
- Stratejik nokta sahipliği

---

## 35. Bölgesel Sayaç Sunumu

Sayaç:

- ekran üstünde,
- minimap yakınında,
- stratejik nokta panelinde

gösterilebilir.

Kritik eşikler:

- sayaç başladı,
- yarılandı,
- 30 saniye kaldı,
- 10 saniye kaldı.

---

## 36. Merkez Sağlığı Uyarıları

Merkez:

- %75,
- %50,
- %25

eşiklerinde farklı uyarılar verebilir.

Kritik durumda:

- ekran kenarı uyarısı,
- minimap ping,
- ses bildirimi

kullanılmalıdır.

---

## 37. Zafer Sunumu

Zafer anında:

- oyun komutları durur veya yavaşlar,
- kısa kamera odağı,
- zafer başlığı,
- kullanılan zafer türü,
- kısa istatistik özeti

gösterilir.

Uzun sinematik gerekli değildir.

---

## 38. Yenilgi Sunumu

Yenilgide:

- açık neden,
- kaybedilen hedef,
- maç süresi,
- yeniden dene seçeneği,
- ana menü

gösterilmelidir.

---

# BÖLÜM G — MAÇ SONU EKRANI

## 39. Temel Maç Sonu Bilgileri

- Sonuç
- Zafer veya yenilgi türü
- Maç süresi
- Ulaşılan çağ
- Merkez sağlık durumu
- Kontrol edilen stratejik noktalar
- Toplam üretilen kaynak
- Toplam üretilen işçi
- Toplam üretilen asker
- Yok edilen düşman birimleri
- Kaybedilen birimler
- Kurulan karakol
- Kurulan yol uzunluğu

---

## 40. Ekonomik İstatistikler

- Toplam yiyecek
- Toplam odun
- Toplam taş
- Toplam altın
- En yüksek gelir hızı
- En yüksek işçi sayısı
- En uzun bağlantı kesintisi

---

## 41. Askerî İstatistikler

- Verilen toplam hasar
- Alınan toplam hasar
- Yok edilen yapılar
- En etkili birim türü
- En büyük ordu
- Başarılı baskın sayısı

---

## 42. Bölgesel İstatistikler

- İlk karakol zamanı
- En yüksek kontrol alanı
- Stratejik nokta kontrol süresi
- Kaybedilen karakollar
- Alternatif rota kullanımı

---

## 43. AI Karşılaştırması

Oyuncu ve AI yan yana karşılaştırılabilir.

Bu ekran:

- denge testini,
- oyuncunun kendi performansını anlamasını,
- AI davranış değerlendirmesini

kolaylaştırır.

---

# BÖLÜM H — ZORLUK SEVİYELERİ

## 44. Zorluk Tasarım İlkesi

Zorluk seviyeleri oyuncuya farklı bir oyun kural seti değil, daha iyi veya daha yavaş karar veren rakip sunmalıdır.

Öncelik sırası:

1. Karar gecikmesi
2. Hedef seçimi
3. Kaynak dağılımı
4. Saldırı sıklığı
5. Geri çekilme kalitesi
6. Keşif kalitesi
7. Sınırlı ekonomik bonus

---

## 45. Kolay

Hedef oyuncu:

- RTS sistemlerini öğrenen,
- haritayı ve ekonomiyi rahat incelemek isteyen.

AI davranışı:

- daha yavaş açılış,
- geç baskın,
- daha küçük ordu,
- daha uzun tepki süresi,
- zayıf karşı kompozisyon,
- daha sık planlama hatası,
- bölgesel zafer sayacına daha geç tepki.

Ekonomik bonus:

- yok.

---

## 46. Normal

Hedef oyuncu:

- tasarlanan temel deneyimi isteyen.

AI davranışı:

- dengeli ekonomi,
- düzenli genişleme,
- orta hızda çağ atlama,
- baskın,
- savunma,
- ana saldırı,
- geri çekilme,
- bölgesel zafer takibi.

Ekonomik bonus:

- yok veya sıfıra çok yakın.

---

## 47. Zor

Hedef oyuncu:

- sistemleri öğrenmiş,
- daha etkili ve az hata yapan rakip isteyen.

AI davranışı:

- hızlı tehdit değerlendirmesi,
- daha iyi hedef seçimi,
- daha iyi karşı kompozisyon,
- daha iyi işçi dağılımı,
- daha az idle süre,
- daha iyi alternatif rota,
- daha etkili geri çekilme,
- daha erken bitirici saldırı.

Ekonomik bonus:

- yalnızca testler gerekli gösterirse küçük oran.

---

## 48. Çok Zor / Geliştirici Modu

Vertical slice için zorunlu değildir.

Kullanım:

- performans testi,
- en iyi AI parametreleri,
- küçük ekonomik bonus,
- hızlı karar.

Oyuncuya normal zorluk olarak sunulmayabilir.

---

# BÖLÜM I — ZORLUK PARAMETRELERİ

## 49. Karar Gecikmesi

Örnek aralıklar:

| Zorluk | Stratejik değerlendirme |
|---|---|
| Kolay | Daha seyrek |
| Normal | Standart |
| Zor | Daha sık |

Kesin saniyeler performans testinde belirlenir.

---

## 50. Tepki Gecikmesi

AI bir baskını gördüğünde:

- Kolay: bilinçli gecikme
- Normal: doğal gecikme
- Zor: kısa fakat anlık olmayan gecikme

kullanmalıdır.

---

## 51. Hata Payı

Kolay AI:

- daha düşük değerli bölge seçebilir,
- saldırıyı biraz erken veya geç başlatabilir,
- kompozisyonu daha az iyi olabilir.

Ancak bilinçli olarak anlamsız hareket yapmamalıdır.

---

## 52. Ekonomik Verim Bonusu

Gerekirse:

- Zor: en fazla küçük yüzdeli bonus.

Önerilen üst sınır:

- yaklaşık %5–10.

Bu değer:

- çağ gereksinimlerini atlamamalı,
- ücretsiz birim veya yapı vermemeli,
- oyuncuya açıklanmalıdır.

---

## 53. Başlangıç Kaynağı Bonusu

İlk tercih değildir.

Kullanılırsa yalnızca:

- geliştirici testleri,
- özel meydan okuma modu

için önerilir.

---

## 54. Fog of War Avantajı

Hiçbir normal zorluk seviyesi AI’a tam harita görüşü vermemelidir.

Zor seviyede:

- daha sık keşif,
- daha iyi son bilgi değerlendirmesi

kullanılmalıdır.

---

## 55. Saldırganlık

Zorlukla birlikte:

- baskın sıklığı,
- ana saldırı hazırlığı,
- stratejik nokta baskısı

artabilir.

Ancak sürekli saldırı, ekonomik AI’ın bozulmasına yol açmamalıdır.

---

# BÖLÜM J — DİNAMİK ZORLUK

## 56. Dinamik Zorluk Kararı

İlk vertical slice içinde gizli dinamik zorluk önerilmez.

Neden:

- oyuncu başarısının cezalandırılması hissi,
- denge testini zorlaştırma,
- AI davranışını okunamaz hale getirme.

---

## 57. Kabul Edilebilir Yardımcı Sistemler

Eğitim veya kolay modda:

- daha fazla uyarı,
- daha uzun bölgesel sayaç,
- daha düşük AI saldırı sıklığı,
- öneri mesajları

kullanılabilir.

Bunlar gizli olmamalıdır.

---

# BÖLÜM K — AI ZAFER VE YENİLGİ DAVRANIŞI

## 58. AI Askerî Zafer Planı

AI oyuncunun merkezine saldırmak için:

- yeterli ordu gücü,
- kuşatma desteği,
- rota bilgisi,
- oyuncu savunma tahmini

gerektirir.

---

## 59. AI Bölgesel Zafer Planı

AI:

- iki noktayı kontrol etmeye çalışır,
- sayaç başladığında savunma grupları böler,
- merkezini tamamen boşaltmaz,
- oyuncunun hangi noktaya saldıracağını tahmin etmeye çalışır.

---

## 60. AI Yenilgiyi Önleme

Oyuncu sayaç başlattığında AI:

- ekonomik planları geçici olarak askıya alır,
- en yakın hedef noktaya birlik yollar,
- kuşatma üretimini durdurabilir,
- risk toleransını artırabilir.

---

## 61. AI Merkez Savunması

Merkez kritik sağlıkta:

- tüm uygun yakın gruplar savunmaya çağrılır,
- işçiler kaçırılır,
- saldırı planları askıya alınır,
- yeni savunma birimleri önceliklendirilir.

---

## 62. AI Teslim Olma

İlk vertical slice için AI teslim olma özelliği zorunlu değildir.

Ancak AI şu durumda bitirici saldırı beklemeden yenilgiyi kabul edebilir:

- merkez yok,
- zafer koşulu tamamlanmış.

Fiilen kaybedilmiş ama merkez ayaktaysa AI savaşmaya devam eder.

---

# BÖLÜM L — TEKNİK TASARIM

## 63. Maç Durumu

Önerilen durumlar:

```text
PreMatch
Running
VictoryPending
DefeatPending
Ended
Paused
```

---

## 64. Zafer Kontrol Sistemi

Zafer koşulları olay tabanlı değerlendirilmelidir.

Olaylar:

- merkez yıkıldı,
- stratejik nokta sahipliği değişti,
- sayaç güncellendi,
- oyuncu teslim oldu.

Her kare tüm koşullar yeniden taranmamalıdır.

---

## 65. Zafer Koşulu Veri Şeması

```yaml
victoryConditions:
  military:
    enabled: true
    targetType: main_headquarters

  territory:
    enabled: true
    requiredObjectives: 2
    holdDurationSeconds: TBD
    decayMode: gradual
    requiresTerritoryConnection: true
```

---

## 66. Zorluk Profili Veri Şeması

```yaml
difficulty:
  id: normal
  strategicThinkInterval: TBD
  tacticalThinkInterval: TBD
  reactionDelay: TBD
  aggression: 1.0
  retreatQuality: 1.0
  scoutingQuality: 1.0
  economyMultiplier: 1.0
  mistakeChance: TBD
```

---

## 67. Sayaç Güncellemesi

Bölgesel sayaç:

- sabit timestep,
- oyun duraklatıldığında durma,
- save/load ile korunma,
- sahiplik değişiminde doğru geçiş

kullanmalıdır.

---

## 68. Maç Sonu Kilitleme

Maç bittiğinde:

- yeni komutlar engellenir,
- AI güncellemeleri durur,
- zaman yavaşlatılabilir,
- sonuç ekranı açılır.

---

## 69. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- mevcut maç durumu,
- aktif zafer sayaçları,
- stratejik nokta sahipliği,
- merkez sağlık durumu,
- zorluk seviyesi,
- maç süresi,
- istatistik sayaçları.

---

## 70. İstatistik Toplayıcı

Maç boyunca olay bazlı veri toplanmalıdır:

- kaynak toplandı,
- birim üretildi,
- yapı kuruldu,
- birim öldü,
- yapı yıkıldı,
- karakol kuruldu,
- nokta ele geçirildi,
- çağ atlandı.

---

# BÖLÜM M — EDGE CASE'LER

## 71. Merkez Yıkılırken Bölgesel Sayaç Tamamlanırsa

Önerilen öncelik:

- aynı simülasyon adımında gerçekleşirse sonuç `Çifte Sonuç` yerine belirlenmiş öncelik kullanır.

Öneri:

- askerî merkez yıkımı öncelikli,
- ancak sonuç ekranında iki koşulun da aynı anda tamamlandığı belirtilir.

---

## 72. İki Tarafın Sayaçları Aynı Anda Çalışırsa

İki taraf iki noktayı aynı anda kontrol edemeyeceği için normalde mümkün değildir.

Gelecekte üç veya daha fazla nokta olursa:

- her tarafın bağımsız sayacı olabilir,
- ilk tamamlayan kazanır.

---

## 73. Nokta Son Saniyede Tartışmalı Olursa

- sayaç hemen durur,
- tamamlanma olayı yalnızca geçerli tam kontrolde işlenir.

---

## 74. Oyuncu Teslim Olurken Merkez Yıkılırsa

- tek sonuç kaydı oluşturulur,
- yenilgi nedeni öncelik sırasına göre belirlenir,
- çift ekran açılmaz.

---

## 75. Save Dosyası Sayaç Bitimine Çok Yakınsa

- yükleme sonrası sayaç doğru süreden devam eder,
- oyuncuya kısa giriş gecikmesi verilmemelidir,
- pause durumu net olmalıdır.

---

## 76. AI Merkezsiz Ama Sayaç Aktifse

Merkez yıkımı anlık askerî zafer olduğu için sayaç artık önemsizdir.

---

## 77. Nüfus Sınırı Üstünde Maç Sonu

İstatistik ekranı mevcut değerleri kaydeder; sonucu etkilemez.

---

# BÖLÜM N — TEST PLANI

## 78. Zafer Testleri

### Test 1 — Askerî zafer

- AI merkezi yıkılır.
- Maç tek kez sona erer.
- Doğru sonuç ekranı açılır.

### Test 2 — Bölgesel zafer

- İki nokta ele geçirilir.
- Sayaç başlar.
- Süre tamamlanınca zafer gerçekleşir.

### Test 3 — Sayaç durması

- Bir nokta tartışmalı olur.
- Sayaç durur.

### Test 4 — Sayaç gerilemesi

- Bir nokta kaybedilir.
- Sayaç belirlenen hızda geriler.

### Test 5 — AI tepki

- Oyuncu sayaç başlatır.
- AI ekonomik planı azaltır ve hedefe saldırır.

### Test 6 — Merkez kritik uyarısı

- Merkez sağlık eşikleri geçilir.
- UI ve ses uyarıları doğru çalışır.

### Test 7 — Teslim olma

- Oyuncu teslim olur.
- Onay sonrası maç yenilgiyle biter.

### Test 8 — Save/load sayaç

- Sayaç aktifken kayıt alınır.
- Yükleme sonrası süre korunur.

---

## 79. Zorluk Testleri

### Kolay

- AI oyuncuya öğrenme süresi verir.
- Yine de temel ekonomiyi ve saldırıyı tamamlar.

### Normal

- Tasarlanan temel tempo oluşur.
- AI hile olmadan rekabet eder.

### Zor

- AI daha iyi karar verir.
- Küçük bonus varsa hissedilir fakat haksız görünmez.

---

## 80. Uzun Süreli Testler

En az:

- 20 Kolay,
- 30 Normal,
- 20 Zor

AI simülasyonu önerilir.

İzlenecek sonuçlar:

- zafer türü dağılımı,
- maç süresi,
- çağ seviyesi,
- ilk büyük avantaj,
- geri dönüş oranı.

---

## 81. Hedef Kazanma Oranları

İlk kullanıcı testleri için kaba hedef:

- Kolay: oyuncu lehine yüksek kazanma oranı
- Normal: deneyimli olmayan oyuncu için dengeli ama erişilebilir
- Zor: AI lehine belirgin üstünlük

Kesin yüzdeler oyuncu profiline göre belirlenecektir.

---

## 82. Telemetri

İzlenecek değerler:

- zafer türü,
- yenilgi türü,
- maç süresi,
- bölgesel sayaç başlama sayısı,
- sayaç kesilme sayısı,
- merkez saldırı sayısı,
- merkez yıkım süresi,
- teslim olma zamanı,
- ilk büyük avantaj zamanı,
- geri dönüş yapılan maçlar,
- zorluk seviyesi,
- AI ekonomik bonusu,
- oyuncu ve AI çağ farkı,
- stratejik nokta kontrol süresi.

---

# BÖLÜM O — VERTICAL SLICE KAPSAMI

## 83. Zorunlu Özellikler

- Askerî zafer
- Bölgesel zafer
- İki stratejik nokta
- Bölgesel sayaç
- Sayaç durma ve gerileme
- Merkez yıkımıyla maç sonu
- Teslim olma
- Zafer ve yenilgi ekranı
- Maç sonu temel istatistikler
- Kolay, Normal ve Zor zorluk
- AI zafer takibi
- AI yenilgi önleme davranışı
- Save/load sayaç desteği
- Maç sonu olay kilitleme
- Debug komutları

---

## 84. Ertelenebilecek Özellikler

- Refah zaferi
- Ekonomik zafer
- Çoklu merkez
- Merkez yeniden inşası
- Dinamik zorluk
- Sudden death
- AI teslim olma
- Senaryo özel hedefleri
- Görev yıldız sistemi
- Ayrıntılı skor derecelendirmesi
- Online liderlik tablosu
- Başarımlar
- Kampanya meta ilerlemesi

---

## 85. İlk Teknik Prototip

İlk prototip:

```text
AI hedef yapısı
→ Oyuncu muhafızla saldırır
→ Yapı yıkılır
→ Zafer ekranı açılır
```

İkinci prototip:

```text
Tek stratejik nokta
→ Ele geçir
→ 30 saniye tut
→ Zafer
```

Üçüncü prototip:

```text
İki stratejik nokta
→ Sayaç başlat
→ AI karşı saldırı
→ Sayaç durma ve gerileme
```

---

# BÖLÜM P — AÇIK SORULAR VE KARARLAR

## 86. Açık Tasarım Soruları

### Askerî zafer

- Merkez binasının sağlık hedefi ne olmalı?
- Merkez kendini savunmalı mı?
- Kuşatma olmadan merkez yıkımı ne kadar sürmeli?
- Merkez yıkımından önce son uyarı süresi olmalı mı?

### Bölgesel zafer

- Sayaç 120, 180 veya 240 saniye mi olmalı?
- Nokta kaybında gerileme hızı ne olmalı?
- İki noktanın ikisi de zorunlu mu olmalı?
- Karakol bağlantısı kesilince sayaç hemen durmalı mı?

### Geri dönüş

- Acil işçi üretimi gerekli mi?
- Merkez yakınında savunma bonusu olmalı mı?
- Gerideki oyuncuya açık bir destek sistemi gerekli mi?
- İlk çağ farkı ne kadar güçlü olmalı?

### Zorluk

- Zor seviyede ekonomi bonusu gerçekten gerekli mi?
- Kolay seviyede AI bölgesel zaferi daha geç mi takip etmeli?
- Hata payı nasıl doğal gösterilmeli?
- Zorluk ayarları maç ortasında değiştirilebilir mi?

### Maç sonu

- Zafer anında oyun tamamen durmalı mı, yavaşlamalı mı?
- İstatistik grafikleri vertical slice içinde gerekli mi?
- “Tekrar oyna” aynı haritayı aynı seed ile mi başlatmalı?
- Maç tekrarı kaydı gerekli mi?

---

## 87. Şimdilik Alınmış Kararlar

- İlk vertical slice iki zafer türü kullanacaktır: askerî ve bölgesel.
- Askerî zafer düşmanın tek ana merkezini yıkmakla kazanılacaktır.
- İlk vertical slice içinde ikinci merkez veya merkez yeniden inşası olmayacaktır.
- Bölgesel zafer için iki stratejik noktanın aynı anda kontrolü gerekecektir.
- Tam bölgesel kontrol için stratejik nokta aktif dost kontrol alanında olmalıdır.
- Bölgesel sayaç geçici olarak 180 saniye hedefleyecektir.
- Bir nokta kaybedildiğinde sayaç yavaşça gerileyecektir.
- Düşman iki noktayı da ele geçirirse rakibin sayacı sıfırlanabilecektir.
- Oyuncu merkezini kaybettiğinde anlık askerî yenilgi gerçekleşecektir.
- Oyuncu teslim olabilecektir.
- Tüm ordu veya dış ekonomi kaybı anlık yenilgi olmayacaktır.
- Maçın ideal süresi 20–30 dakika, üst sınırı yaklaşık 40 dakika olacaktır.
- Dinamik gizli zorluk ilk vertical slice içinde kullanılmayacaktır.
- Kolay, Normal ve Zor seviyeleri bulunacaktır.
- Zorluk öncelikle AI karar kalitesi, tepki hızı ve hata payıyla değişecektir.
- Zor seviye için ekonomik bonus yalnızca gerekirse ve yaklaşık %5–10 sınırında kullanılacaktır.
- Normal zorluk adil temel kuralları kullanacaktır.
- Fog of war hiçbir normal zorlukta kaldırılmayacaktır.
- Zafer ve yenilgi koşulları olay tabanlı değerlendirilecektir.
- Maç sonu ekranı oyuncu ve AI karşılaştırmalı temel istatistikler gösterecektir.
- Save/load aktif bölgesel sayacı koruyacaktır.

---

## 88. Diğer Dokümanlarla Bağlantılar

- `10_CAMERA_CONTROLS_AND_UI.md`
  - zafer sayaçları,
  - kritik uyarılar,
  - teslim olma,
  - maç sonu ekranı.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - zafer ve yenilgi sunumu,
  - stratejik nokta görselleri,
  - merkez hasar aşamaları.

- `12_BALANCE_AND_GAME_DATA.md`
  - merkez sağlığı,
  - sayaç süresi,
  - sayaç gerilemesi,
  - zorluk parametreleri.

- `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`
  - zafer sistemi uygulama fazı,
  - AI tepki testleri,
  - maç sonu telemetrisi.

---

## 89. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Askerî zafer koşulu nettir.
- [ ] Bölgesel zafer koşulu nettir.
- [ ] İki stratejik nokta yaklaşımı kabul edilmiştir.
- [ ] Bölgesel sayaç ve gerileme davranışı onaylanmıştır.
- [ ] Yenilgi koşulları anlaşılırdır.
- [ ] Teslim olma sistemi kabul edilmiştir.
- [ ] Geri dönüş araçları yeterli bulunmuştur.
- [ ] Maç süresi hedefi kabul edilmiştir.
- [ ] Kolay, Normal ve Zor profilleri yeterince ayrışmaktadır.
- [ ] Ekonomik bonus sınırı kabul edilmiştir.
- [ ] Maç sonu ekranı kapsamı uygun bulunmuştur.
- [ ] Vertical slice kapsamı gerçekçidir.
- [ ] Açık sorular sonraki dokümanlara aktarılmıştır.

---

## 90. Kontrol Listesi

### Zafer

- [ ] Askerî zafer tanımlandı.
- [ ] Merkez yıkım kuralı tanımlandı.
- [ ] Bölgesel zafer tanımlandı.
- [ ] Tam kontrol gereksinimi tanımlandı.
- [ ] Bölgesel sayaç tanımlandı.
- [ ] Sayaç durma ve gerileme tanımlandı.
- [ ] Zafer yolları arasında geçiş tanımlandı.
- [ ] Gelecekteki zafer türleri ayrıldı.

### Yenilgi

- [ ] Merkez kaybı tanımlandı.
- [ ] Bölgesel yenilgi tanımlandı.
- [ ] Teslim olma tanımlandı.
- [ ] Yumuşak yenilgi durumları ayrıldı.
- [ ] Ekonomik kilitlenme değerlendirildi.
- [ ] Son işçi kaybı ele alındı.

### Geri dönüş ve tempo

- [ ] Geri dönüş araçları tanımlandı.
- [ ] Savunmacı avantaj sınırlandı.
- [ ] Catch-up bonusu yaklaşımı belirlendi.
- [ ] Kartopu telemetrisi tanımlandı.
- [ ] Geç oyun çıkmazı ele alındı.
- [ ] Maksimum maç süresi tanımlandı.

### Zorluk

- [ ] Kolay seviye tanımlandı.
- [ ] Normal seviye tanımlandı.
- [ ] Zor seviye tanımlandı.
- [ ] Karar gecikmesi tanımlandı.
- [ ] Tepki gecikmesi tanımlandı.
- [ ] Hata payı tanımlandı.
- [ ] Ekonomik bonus sınırı tanımlandı.
- [ ] Fog of war avantajı reddedildi.
- [ ] Dinamik zorluk ertelendi.

### UI ve teknik

- [ ] Zafer ilerleme UI'ı tanımlandı.
- [ ] Merkez sağlık uyarıları tanımlandı.
- [ ] Zafer sunumu tanımlandı.
- [ ] Yenilgi sunumu tanımlandı.
- [ ] Maç sonu istatistikleri tanımlandı.
- [ ] Maç durumu tanımlandı.
- [ ] Zafer veri şeması taslaklandı.
- [ ] Zorluk veri şeması taslaklandı.
- [ ] Save/load gereksinimleri tanımlandı.
- [ ] İstatistik toplayıcı tanımlandı.

### Test

- [ ] Askerî zafer testi tanımlandı.
- [ ] Bölgesel zafer testi tanımlandı.
- [ ] Sayaç durma testi tanımlandı.
- [ ] Sayaç gerileme testi tanımlandı.
- [ ] AI tepki testi tanımlandı.
- [ ] Teslim olma testi tanımlandı.
- [ ] Save/load testi tanımlandı.
- [ ] Zorluk testleri tanımlandı.
- [ ] Telemetri değerleri listelendi.

---

## 91. Revizyon Notları

### Sürüm 0.1

- Askerî ve bölgesel zafer koşulları detaylandırıldı.
- Merkez yıkımı ve stratejik nokta sayacı tanımlandı.
- Sayaç durma ve gerileme yaklaşımı seçildi.
- Yenilgi, teslim olma ve ekonomik kilitlenme durumları ele alındı.
- Geri dönüş ve kartopu kontrol araçları tanımlandı.
- Maç süresi ve geç oyun bitirme baskısı oluşturuldu.
- Kolay, Normal ve Zor AI profilleri tanımlandı.
- Ekonomik bonus ve fog of war sınırları belirlendi.
- Maç sonu ekranı, veri şemaları, edge case ve test planları eklendi.

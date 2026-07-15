# 03 — Economy and Resources

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Ekonomi ve Kaynaklar  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. "Vertical slice için zorunlu" ifadeleri tam oyun hedefini anlatır — bir özelliğin hangi üründe (A/B/C) açıldığı ya da koşullu/kapsam dışı olduğu konusunda 13 v0.2 esastır. Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman oyunun ekonomik omurgasını tanımlar.

Belge şu sorulara cevap verir:

- Oyunda hangi kaynaklar bulunur?
- Her kaynak hangi stratejik rolü üstlenir?
- İşçiler nasıl görevlendirilir?
- Kaynak üretimi nasıl hesaplanır?
- Depolar, yollar ve üretim yapıları nasıl bağlanır?
- Kaynak noktaları tükenir mi?
- Nüfus ve Refah sistemi nasıl çalışır?
- Ekonomi oyuncuya hangi kararları sunar?
- AI ekonomi sistemini hangi kurallarla kullanır?
- Vertical slice için hangi ekonomik özellikler zorunludur?

Bu belgede verilen sayılar ilk tasarım hedefleridir. Kesin denge değerleri `12_BALANCE_AND_GAME_DATA.md` içinde tutulacaktır.

---

## 2. Ekonominin Tasarım Hedefi

Ekonomi, oyuncunun askerî ve bölgesel gücünün temel kaynağıdır.

Ekonomik sistem:

- kolay öğrenilmeli,
- harita üzerinde görünür olmalı,
- yol ve bölge kontrolüyle doğrudan bağlantılı olmalı,
- oyuncuya gerçek fırsat maliyetleri sunmalı,
- aşırı mikro yönetim gerektirmemeli,
- AI tarafından aynı temel kurallarla kullanılabilmelidir.

Oyuncunun temel ekonomik sorusu şudur:

> “Sınırlı işçi, alan ve kaynakları; büyüme, savunma ve çağ atlama arasında nasıl dağıtmalıyım?”

---

## 3. Ekonominin Temel İlkeleri

### 3.1 Her kaynak farklı bir karar üretmelidir

Kaynaklar yalnızca farklı renkli para birimleri olmamalıdır.

Her kaynak:

- farklı bir harita konumuna,
- farklı bir kullanım alanına,
- farklı bir risk düzeyine,
- farklı bir maç aşamasına

bağlanmalıdır.

### 3.2 Üretim harita kontrolüne bağlıdır

Oyuncu güvenli merkez kaynaklarıyla maça başlayabilir; ancak gelişmek için daha uzak ve riskli bölgelere çıkmalıdır.

### 3.3 Yol bağlantısı ekonomik bir koşuldur

Üretim yapıları, depoya veya merkez binasına bağlı bir yol ağı üzerinden çalışır.

Yol sistemi dekoratif değildir.

### 3.4 Lojistik okunabilir olmalıdır

Oyun ağır bir taşıma simülasyonu olmayacaktır.

Oyuncu:

- hangi yapının bağlı olduğunu,
- nerede darboğaz oluştuğunu,
- hangi yolun kesildiğini,
- hangi deponun dolduğunu

tek bakışta anlayabilmelidir.

### 3.5 Küçük ekonomi, anlamlı kararlar

İlk vertical slice içinde onlarca kaynak veya vatandaş ihtiyacı bulunmayacaktır.

Dört ana kaynak, nüfus ve Refah değeri yeterlidir.

---

# BÖLÜM A — EKONOMİK DEĞERLER

## 4. Kaynak Kategorileri

Oyundaki ekonomik değerler üç kategoriye ayrılır.

### 4.1 Stoklanan kaynaklar

Oyuncunun harcayabildiği kaynaklar:

- Yiyecek
- Odun
- Taş
- Altın

### 4.2 Kapasite değerleri

Doğrudan harcanmayan sınırlar:

- Nüfus
- Depolama kapasitesi

### 4.3 Yerleşim durumu

Yerleşimin genel gelişimini temsil eden değer:

- Refah

---

## 5. Kaynak Özeti

| Kaynak | Ana rol | En önemli dönem | Harita davranışı |
|---|---|---|---|
| Yiyecek | İşçi ve temel birlik üretimi | Erken ve orta oyun | Güvenli üretimden büyüyebilir |
| Odun | Yapı, yol ve genişleme | Tüm maç | Ormanlara bağlı, genişleme ister |
| Taş | Savunma ve gelişmiş yapılar | Orta ve geç oyun | Daha sınırlı ve stratejik |
| Altın | Çağ atlama ve seçkin içerik | Orta ve geç oyun | Riskli ve değerli bölgelerde |
| Nüfus | Ordu ve ekonomi büyüklüğü | Tüm maç | Evler ve çağ sınırlarıyla artar |
| Refah | Gelişim uygunluğu ve yerleşim sağlığı | Orta ve geç oyun | Ekonomik düzen ve güvenlikten türetilir |

---

# BÖLÜM B — YİYECEK

## 6. Yiyeceğin Rolü

Yiyecek, nüfus büyümesinin temel kaynağıdır.

Ana kullanım alanları:

- işçi üretimi,
- temel asker üretimi,
- bazı birlik yükseltmeleri,
- çağ atlama gereksinimleri,
- Refah için gıda güvenliği.

Yiyecek erken oyunda oyuncunun temposunu belirler.

---

## 7. Yiyecek Kaynakları

Önerilen yiyecek kaynakları:

### 7.1 Başlangıç yiyecek kaynağı

- merkeze yakın,
- düşük riskli,
- sınırlı kapasite veya orta verim,
- oyuncuya ilk işçi üretimini başlatma imkânı verir.

Görsel karşılık:

- küçük tarla,
- meyve alanı,
- hayvan sürüsü,
- yiyecek sandıkları

asset setine göre seçilebilir.

### 7.2 Tarla

- oyuncu tarafından belirli uygun alanlara kurulur,
- yenilenebilir yiyecek üretir,
- yol bağlantısı gerektirir,
- işçi atamasıyla çalışır,
- baskınlara karşı savunmasızdır.

### 7.3 Gelişmiş tarım yapısı

Kasaba veya Krallık seviyesinde:

- daha fazla işçi kapasitesi,
- daha yüksek üretim,
- daha büyük yerel stok,
- Refah katkısı

sağlayabilir.

---

## 8. Yiyecek Tasarım Kararları

- Yiyecek tamamen tükenen tek bir doğal kaynağa bağlı olmamalıdır.
- Tarla sistemi oyuncuya uzun vadeli güvenli üretim sunmalıdır.
- Tarlalar sınırsız alana rastgele yerleştirilememelidir.
- Verimli toprak, kontrol alanı veya yapı limiti kullanılabilir.
- Yiyecek üretimi düşman baskınlarına açık olmalıdır.
- Merkez çevresinde sınırsız güvenli tarım yapılması önlenmelidir.

---

# BÖLÜM C — ODUN

## 9. Odunun Rolü

Odun, yerleşimin fiziksel büyüme kaynağıdır.

Ana kullanım alanları:

- evler,
- temel üretim yapıları,
- yollar,
- depolar,
- karakollar,
- temel askerî yapılar,
- bazı birimler.

Odun tüm maç boyunca önemini korumalıdır.

---

## 10. Odun Kaynakları

### 10.1 Orman alanları

- harita üzerinde kümeler halinde bulunur,
- merkeze yakın küçük ormanlar başlangıç sağlar,
- uzak büyük ormanlar daha uzun vadeli üretim sunar,
- oduncu yapısı orman kenarına kurulmalıdır.

### 10.2 Oduncu yapısı

- belirli bir yarıçap içindeki ağaçları kullanır,
- işçi kapasitesine sahiptir,
- yola bağlanır,
- yerel üretim tamponu kullanır,
- yakındaki ağaçlar tükendiğinde verimi düşer veya durur.

---

## 11. Ağaç Tükenmesi ve Yenilenme

Vertical slice için önerilen yaklaşım:

- ağaçlar tükenebilir,
- doğal yeniden büyüme ilk sürümde zorunlu değildir,
- haritada yeterli miktarda odun bulunmalıdır,
- bazı uzak ormanlar yüksek kapasiteye sahip olmalıdır.

Gelecekte:

- ormancılık yükseltmesi,
- yavaş ağaç yenilenmesi,
- yeniden dikim

eklenebilir.

---

## 12. Odun Tasarım Kararları

- Yol kurmak odun tükettiği için genişleme ile yapılaşma arasında fırsat maliyeti oluşmalıdır.
- Oyuncunun tüm odunu askerî yapılara harcaması lojistik büyümeyi yavaşlatmalıdır.
- Ormanlar aynı zamanda görüş ve hareket alanını etkileyebilir; ancak bu sistem ilk vertical slice için zorunlu değildir.

---

# BÖLÜM D — TAŞ

## 13. Taşın Rolü

Taş, kalıcı savunma ve gelişmiş yerleşim kaynağıdır.

Ana kullanım alanları:

- gelişmiş merkez binası,
- kule,
- gelişmiş karakol,
- savunma yapıları,
- Seviye II ve III yapı yükseltmeleri,
- bazı zafer yapıları.

Taş, erken oyunda sınırlı; orta oyunda önemli olmalıdır.

---

## 14. Taş Kaynakları

### 14.1 Taş yatakları

- belirli maden bölgelerinde bulunur,
- ormanlara göre daha az sayıdadır,
- genellikle merkezden daha uzaktadır,
- stratejik geçişlere yakın olabilir.

### 14.2 Taş ocağı

- taş yatağına yakın kurulmalıdır,
- sınırlı işçi kapasitesi vardır,
- yola ve depoya bağlanmalıdır,
- yüksek değerli askerî hedef olabilir.

---

## 15. Taş Tükenmesi

Taş yatakları tükenebilir olmalıdır.

Bu sayede:

- oyuncu yeni bölgelere genişlemek zorunda kalır,
- merkezi taş alanları stratejik önem kazanır,
- savunma yapılarını sınırsız kurmak zorlaşır,
- geç oyun doğal olarak hareketlenir.

Merkez yakınında küçük bir güvenli taş kaynağı bulunabilir; ancak Krallık gelişimi için yeterli olmamalıdır.

---

# BÖLÜM E — ALTIN

## 16. Altının Rolü

Altın, teknoloji ve seçkin güç kaynağıdır.

Ana kullanım alanları:

- Kasaba ve Krallık seviyesine geçiş,
- gelişmiş birlikler,
- süvari,
- kuşatma,
- üst seviye yükseltmeler,
- pazar işlemleri,
- zafer yapısı.

Altın, oyuncuyu riskli bölgelere çıkmaya zorlamalıdır.

---

## 17. Altın Kaynakları

### 17.1 Altın yatakları

- sınırlı sayıda,
- yüksek değerli,
- haritanın daha riskli alanlarında,
- çoğu zaman stratejik noktalara yakın

olmalıdır.

### 17.2 Altın madeni

- yatak üzerine veya yakınına kurulmalıdır,
- yol bağlantısı gerektirir,
- düşük işçi kapasitesiyle yüksek değer üretir,
- baskınlar için öncelikli hedeftir.

---

## 18. Altın Tasarım Kararları

- Oyuncunun yalnızca merkez çevresinde kalarak üçüncü çağa ulaşması zor olmalıdır.
- Altın kaybı doğrudan anlık yenilgi oluşturmamalıdır.
- Pazar dönüşümü bulunursa pahalı ve verimsiz olmalıdır.
- AI altın alanlarını stratejik hedef olarak değerlendirmelidir.

---

# BÖLÜM F — İŞÇİ SİSTEMİ

## 19. İşçinin Rolü

İşçi ekonominin ana aktif birimidir.

İşçiler:

- üretim yapılarına atanır,
- bina inşa eder,
- yapı onarır,
- yol kurar,
- karakol kurar,
- gerektiğinde yeni çalışma alanına taşınır.

İşçiler savaşta güçlü olmamalıdır.

---

## 20. Önerilen Üretim Modeli

İlk vertical slice için **üretim yapısı + yerel tampon + yol ağı** modeli önerilir.

Akış:

```text
Kaynak alanına üretim yapısı kur
→ İşçileri yapıya ata
→ İşçiler üretim döngüsünü çalıştır
→ Ürün yapının yerel tamponunda birikir
→ Yol bağlantısı varsa ürün depoya aktarılır
→ Global stok artar
```

Bu yaklaşım:

- yol bağlantısını önemli kılar,
- onlarca taşıyıcı birim simülasyonu gerektirmez,
- ekonomik kesintileri görünür yapar,
- web performansını korur,
- işçilerin sahada görünmesini sağlar.

---

## 21. Fiziksel Taşıma Kararı

İlk vertical slice içinde her işçinin kaynağı tek tek depoya taşıması önerilmez.

Nedenleri:

- pathfinding yükü,
- birim sıkışması,
- yüksek mikro yönetim,
- uzun rotalarda dengesiz üretim,
- AI uygulama maliyeti.

Bunun yerine:

- işçiler kaynak alanında çalışır,
- üretim yerel tamponda birikir,
- bağlantılı yol ağı soyut aktarımı temsil eder.

Gelecekte dekoratif taşıma arabaları veya görsel kervanlar eklenebilir.

---

## 22. İşçi Atama

Bir üretim yapısı seçildiğinde oyuncu:

- atanmış işçi sayısını,
- maksimum işçi kapasitesini,
- işçi başına üretimi,
- mevcut yerel tamponu,
- bağlantı durumunu

görebilmelidir.

Örnek:

```text
Taş Ocağı II

İşçiler: 3 / 4
Üretim: 18 taş / dakika
Yerel stok: 12 / 40
Bağlantı: Aktif
```

---

## 23. İşçi Kapasitesi

Her üretim yapısının sınırlı işçi kapasitesi olmalıdır.

Amaç:

- tek kaynağa tüm işçilerin yığılmasını önlemek,
- yeni üretim yapıları kurmayı anlamlı hale getirmek,
- alan ve yol planlamasını desteklemek.

Önerilen ilk aralıklar:

- Seviye I: 2–3 işçi
- Seviye II: 3–5 işçi
- Seviye III: 4–6 işçi

Kesin değerler denge dokümanında belirlenir.

---

## 24. İşçi Verimliliği

İlk vertical slice için işçi katkısı büyük ölçüde doğrusal olabilir.

Örnek:

```text
Toplam temel üretim
= İşçi sayısı × İşçi başına üretim
```

Daha sonra küçük azalan verim uygulanabilir:

```text
1. işçi: %100
2. işçi: %100
3. işçi: %90
4. işçi: %80
```

Ancak bu sistem oyuncuya açık gösterilmelidir.

---

## 25. İşçi Görev Durumları

İşçinin temel durumları:

```text
Idle
Moving
Assigned
Working
Building
Repairing
Retreating
Blocked
```

Ekonomik UI, boşta kalan işçi sayısını göstermelidir.

---

## 26. İşçi Yeniden Atama

Oyuncu işçileri üretim yapıları arasında taşıyabilir.

Yeniden atama:

- anlık ekonomik tepki sağlar,
- kaynak darboğazlarını çözmeye yarar,
- saldırı altındaki bölgeden işçi çekmeyi mümkün kılar.

İlk vertical slice içinde otomatik global işçi dağıtımı önerilmez.

---

# BÖLÜM G — ÜRETİM YAPILARI

## 27. Üretim Yapısı Türleri

Önerilen temel ekonomik yapılar:

- Tarla / çiftlik
- Oduncu kampı
- Taş ocağı
- Altın madeni
- Depo
- Pazar
- Merkez binası

Pazar vertical slice kapsamına göre ertelenebilir.

---

## 28. Üretim Yapısı Gereksinimleri

Bir üretim yapısının aktif olması için:

- oyuncunun kontrol alanı içinde bulunması,
- uygun kaynak veya araziye kurulması,
- en az bir işçiye sahip olması,
- bir yol ağına bağlanması,
- bağlı ağ üzerinde aktif depo veya merkez bulunması,
- yerel tamponunun dolu olmaması

gerekebilir.

---

## 29. Üretim Durumları

Üretim yapılarının okunabilir durumları:

### 29.1 Aktif

- işçi var,
- kaynak mevcut,
- yol bağlı,
- depolama alanı mevcut.

### 29.2 Düşük verim

- az işçi,
- uzun bağlantı,
- hasar,
- düşük Refah,
- düşük kaynak kalitesi.

### 29.3 Bağlantısız

- depo ağına ulaşamıyor,
- üretim yerel tamponla sınırlı.

### 29.4 Yerel stok dolu

- ürün aktarılamıyor,
- üretim duruyor.

### 29.5 Kaynak tükendi

- çalışma alanında kullanılabilir kaynak kalmadı.

### 29.6 Tehdit altında

- yakınında düşman birlikleri var,
- işçiler geri çekilebilir veya üretim düşebilir.

---

## 30. Yerel Tampon

Her üretim yapısının küçük bir yerel stok kapasitesi vardır.

Amaç:

- yol kesildiğinde üretimin anında sıfırlanmaması,
- oyuncuya tepki süresi vermek,
- lojistik kesintiyi görünür hale getirmek.

Örnek akış:

```text
Yol kesildi
→ Ürün yerel tamponda birikmeye devam etti
→ Tampon doldu
→ Üretim durdu
→ Oyuncu yolu onardı
→ Tampon global depoya aktarıldı
→ Üretim devam etti
```

---

# BÖLÜM H — DEPOLAMA

## 31. Global Stok

Oyuncunun teslim edilmiş kaynakları global olarak kullanılabilir.

Bir üretim yapısı yol ağı üzerinden herhangi bir aktif depoya bağlıysa, aktarılan kaynak global stoğa eklenir.

Bu yaklaşım:

- yapı kurmayı kolaylaştırır,
- her bölge için ayrı stok mikro yönetimini önler,
- lojistik bağın önemini korur.

---

## 32. Depolama Kapasitesi

Her kaynak için veya tüm kaynaklar için bir kapasite sınırı bulunabilir.

Önerilen vertical slice yaklaşımı:

- tek toplam kapasite yerine kaynak başına kapasite,
- merkez binası başlangıç kapasitesi sağlar,
- depolar kapasiteyi artırır,
- yapı seviyeleri kapasiteyi büyütür.

Örnek:

```text
Yiyecek: 340 / 500
Odun: 280 / 500
Taş: 120 / 300
Altın: 90 / 300
```

Kesin değerler daha sonra belirlenir.

---

## 33. Depo Rolü

Depo:

- global kapasiteyi artırır,
- yol ağında teslimat noktasıdır,
- uzak bölgelerin ekonomiye bağlanmasını sağlar,
- saldırılabilir bir lojistik hedeftir,
- belirli yarıçapta bağlantı bonusu verebilir.

Depo yalnızca “daha fazla kaynak saklama binası” olmamalıdır.

---

## 34. Depo Kaybı

Bir depo yok edildiğinde:

- bağlı üretim yapıları başka depoya rota arar,
- alternatif bağlantı yoksa yerel tampon moduna geçer,
- global stokun tamamı kaybolmaz,
- depolama kapasitesi düşer,
- kapasite üstündeki kaynaklar hemen silinmemelidir.

Önerilen kapasite aşımı davranışı:

- mevcut fazla stok korunur,
- yeni kaynak kabul edilmez,
- oyuncu kaynak harcadıkça değer tekrar sınır içine iner.

---

## 35. Depo Ele Geçirme ve Yağma

İlk vertical slice için:

- depo ele geçirme yok,
- doğrudan kaynak yağması yok,
- depo yok etmek lojistik ve kapasite kaybı yaratır.

Gelecekte sınırlı yağma eklenebilir.

---

# BÖLÜM I — YOL VE LOJİSTİK BAĞLANTISI

## 36. Ekonomik Bağlantı Grafiği

Yollar ve lojistik yapılar bir bağlantı ağı oluşturur.

Ağın düğümleri:

- merkez binası,
- depolar,
- üretim yapıları,
- karakollar,
- pazarlar.

Ağın bağlantıları:

- yol segmentleri.

Bir üretim yapısı, aktif bir depoya veya merkeze ulaşabiliyorsa bağlı kabul edilir.

---

## 37. Bağlantı Durumları

Önerilen bağlantı seviyeleri:

### 37.1 Tam bağlı

- aktif yol mevcut,
- depo erişilebilir,
- tam üretim ve aktarım.

### 37.2 Uzak bağlı

- rota uzun,
- aktarım çalışır,
- isteğe bağlı küçük verim cezası.

### 37.3 Alternatif bağlı

- ana rota kesilmiş,
- ikinci rota üzerinden çalışıyor.

### 37.4 Bağlantısız

- aktif depo rotası yok,
- yalnızca yerel tampon kullanılır.

---

## 38. Mesafe ve Verim

İlk vertical slice için iki seçenek vardır:

### Seçenek A — Bağlı / bağlantısız

- en basit model,
- bağlıysa tam verim,
- bağlantısızsa yerel tamponla sınırlı.

### Seçenek B — Mesafe etkili bağlantı

- rota uzadıkça küçük verim kaybı,
- depo yerleşimini daha önemli yapar,
- UI ve denge maliyeti daha yüksektir.

**Önerilen vertical slice kararı:**  
Önce Seçenek A uygulanmalıdır.

Mesafe etkisi daha sonra eklenebilir.

---

## 39. Yol Seviyeleri

### Yol I

- temel bağlantı,
- düşük maliyet,
- düşük dayanıklılık.

### Yol II

- daha yüksek bağlantı güvenliği,
- isteğe bağlı hareket hızı bonusu,
- daha yüksek maliyet.

### Yol III

- en yüksek dayanıklılık,
- kritik lojistik hatlar için,
- geç oyun maliyeti.

Yol seviyeleri `05_TERRITORY_LOGISTICS_AND_ROADS.md` içinde ayrıntılandırılacaktır.

---

# BÖLÜM J — NÜFUS

## 40. Nüfusun Rolü

Nüfus, oyuncunun aynı anda sahip olabileceği işçi ve asker sayısını sınırlar.

Amaç:

- web performansını kontrol etmek,
- ekonomi ve ordu arasında kapasite tercihi yaratmak,
- ev yapılarını anlamlı hale getirmek,
- sınırsız birim üretimini önlemek.

---

## 41. Nüfus Kullanımı

Önerilen geçici değerler:

| Birim | Nüfus kullanımı |
|---|---:|
| İşçi | 1 |
| Muhafız | 1 |
| Okçu | 1 |
| Süvari | 2 |
| Kuşatma birimi | 3 |

Kesin değerler daha sonra belirlenir.

---

## 42. Nüfus Kapasitesi

Nüfus kapasitesi:

- merkez binasından,
- evlerden,
- belirli yükseltmelerden

gelir.

Önerilen vertical slice üst sınırı:

- Yerleşim: yaklaşık 20
- Kasaba: yaklaşık 35
- Krallık: yaklaşık 50

Bu sınırlar performans testlerine göre değişebilir.

---

## 43. Nüfus Darboğazı

Nüfus sınırı dolduğunda:

- yeni birim üretimi başlamaz veya kuyrukta bekler,
- oyuncuya açık uyarı verilir,
- ev kurma veya yükseltme önerilir.

Üretim maliyeti sınır doluyken gereksiz yere harcanmamalıdır.

---

# BÖLÜM K — REFAH

## 44. Refah Sisteminin Rolü

Refah, yerleşimin genel düzenini ve gelişime hazır olma durumunu temsil eder.

Refah:

- doğrudan harcanan bir kaynak değildir,
- kısa süreli dalgalanmalardan çok yerleşimin genel durumunu gösterir,
- çağ atlama ve bazı yükseltmeler için koşul olabilir,
- oyuncuya ekonomisinin yalnızca büyüklüğünü değil sağlığını gösterir.

---

## 45. Refahın Önerilen Yapısı

Refah 0–100 arası bir değer olabilir.

Refah bileşenleri:

| Bileşen | Önerilen ağırlık |
|---|---:|
| Barınma yeterliliği | %25 |
| Yiyecek güvenliği | %25 |
| Bağlı ekonomik yapılar | %20 |
| Bölgesel güvenlik | %15 |
| Gelişmiş altyapı | %15 |

Ağırlıklar geçicidir.

---

## 46. Refah Kazanımı

Refah şu durumlarda artabilir:

- yeterli boş nüfus kapasitesi,
- pozitif yiyecek üretimi,
- üretim yapılarının yola bağlı olması,
- karakolların aktif olması,
- gelişmiş yollar,
- pazar veya yönetim yapıları,
- uzun süre saldırıya uğramama.

---

## 47. Refah Kaybı

Refah şu durumlarda düşebilir:

- nüfus kapasitesinin aşırı dolu olması,
- yiyecek üretiminin durması,
- çok sayıda bağlantısız yapı,
- karakol kaybı,
- merkez bölgesinde düşman varlığı,
- uzun süreli ekonomik kesinti.

---

## 48. Refahın Oynanış Etkisi

İlk vertical slice için Refah aşırı güçlü olmamalıdır.

Önerilen kullanım:

- Kasaba ve Krallık geçişi için eşik,
- belirli yapı yükseltmeleri için koşul,
- yerleşim sağlığı göstergesi,
- maç sonu puan bileşeni.

İlk vertical slice içinde önerilmeyen kullanım:

- sürekli büyük üretim bonusu,
- ağır üretim cezası,
- vatandaş isyanı,
- bina terk etme,
- asker moral çöküşü.

Bu özellikler sistemi gereksiz karmaşıklaştırır ve kartopu etkisini büyütür.

---

## 49. Refahın Güncellenmesi

Refah her karede değişmemelidir.

Önerilen yaklaşım:

- belirli aralıklarla değerlendirme,
- hedef değere yavaş yaklaşma,
- ani saldırılarda sınırlı geçici düşüş,
- UI üzerinde değişim nedenleri.

Örnek:

```text
Mevcut Refah: 58
Hedef Refah: 64

+ Yeterli barınma
+ Güvenli yiyecek üretimi
- 2 bağlantısız yapı
```

---

# BÖLÜM L — EKONOMİK MALİYETLER

## 50. Yapı Maliyeti İlkeleri

Yapılar farklı kaynak kombinasyonları kullanmalıdır.

Örnek roller:

- Ev: çoğunlukla odun
- Depo: odun + az taş
- Karakol: odun + taş
- Kule: yüksek taş
- Pazar: odun + altın
- Seviye III merkez: taş + altın

Amaç, tek bir kaynağın tüm kararları belirlemesini önlemektir.

---

## 51. Birim Maliyeti İlkeleri

- İşçi: ağırlıklı yiyecek
- Muhafız: yiyecek + az odun veya altın
- Okçu: yiyecek + odun
- Süvari: yiyecek + altın
- Kuşatma: odun + taş + altın

Kesin değerler denge dokümanında tutulacaktır.

---

## 52. Yükseltme Maliyeti İlkeleri

Yükseltmeler:

- yeni yapı kurmaktan farklı bir maliyet profiline sahip olmalıdır,
- genellikle alan tasarrufu ve verim avantajı sunmalıdır,
- ancak tek yapı kaybında daha büyük risk yaratmalıdır.

Örnek karar:

```text
İkinci bir Depo I kur
veya
Mevcut Depo I'i Depo II'ye yükselt
```

---

## 53. Maliyet Ödeme Zamanı

Önerilen yaklaşım:

### Yapı

- yerleştirme onaylandığında maliyet ayrılır,
- inşaat başlamadan iptal edilirse tam iade,
- inşaat başladıktan sonra ilerlemeye bağlı kısmi iade.

### Birim

- kuyruğa eklendiğinde maliyet alınır,
- üretim başlamadan iptal edilirse tam iade,
- üretim ilerlediyse kısmi iade değerlendirilebilir.

### Çağ atlama

- başladığında maliyet tamamen ödenir,
- iptal veya merkez kaybında kısmi iade olabilir.

---

# BÖLÜM M — KAYNAK DAĞILIMI

## 54. Başlangıç Bölgesi

Her tarafın başlangıç alanında:

- güvenli yiyecek,
- güvenli odun,
- küçük taş,
- küçük altın

bulunabilir.

Ancak başlangıç kaynakları tam bir Krallık ekonomisi kurmaya yetmemelidir.

---

## 55. Dış Kaynak Bölgeleri

Dış bölgeler:

- daha büyük kapasite,
- daha yüksek risk,
- karakol gereksinimi,
- uzun yol bağlantısı,
- düşman baskını ihtimali

sunmalıdır.

---

## 56. Merkezi Kaynak Bölgeleri

Haritanın ortasında:

- zengin altın,
- zengin taş,
- stratejik geçit,
- bölgesel zafer noktası

bir arada veya yakın konumda bulunabilir.

Bu alanlar maçın doğal çatışma merkezini oluşturur.

---

## 57. Güvenli ve Riskli Kaynak Dengesi

Önerilen dağılım:

- güvenli kaynaklar hayatta kalmayı sağlar,
- riskli kaynaklar üstünlük kurmayı sağlar,
- merkezi kaynaklar zafer hızını artırır.

Oyuncu tamamen risk almadan kazanamamalı; ancak tek bir erken kayıpla ekonomik olarak kilitlenmemelidir.

---

# BÖLÜM N — PAZAR VE DÖNÜŞÜM

## 58. Pazar Sistemi

Pazar, Kasaba seviyesinde açılabilir.

Olası işlevler:

- kaynak dönüştürme,
- küçük Refah katkısı,
- yol ağı merkezi,
- gelecekte ticaret rotası.

---

## 59. Kaynak Dönüşümü

Kaynak dönüşümü ana ekonomi yöntemi olmamalıdır.

Önerilen kurallar:

- verimsiz oran,
- artan işlem maliyeti,
- sınırlı kullanım,
- altın gereksinimi veya pazar koşulu.

Amaç:

- oyuncunun tamamen kilitlenmesini önlemek,
- kötü kaynak dağılımını sınırlı şekilde düzeltmek,
- harita kontrolünün önemini yok etmemek.

---

## 60. Vertical Slice Kararı

Pazar sistemi:

- temel ekonomi tamamlandıktan sonra eklenmelidir,
- kapsam baskısı oluşursa ertelenebilir,
- kaynak dönüşümü olmadan da maç tamamlanabilmelidir.

---

# BÖLÜM O — AI EKONOMİSİ

## 61. AI Ekonomik Hedefleri

AI:

- gerekli işçi sayısını korumalı,
- darboğaz kaynağını belirlemeli,
- yeni kaynak alanı aramalı,
- depo ve yol kurmalı,
- çağ atlama için kaynak ayırmalı,
- saldırı altında işçileri geri çekebilmeli,
- bağlantısı kesilen üretimi onarmalıdır.

---

## 62. AI İşçi Dağılımı

AI işçileri sabit oranlarla sonsuza kadar dağıtmamalıdır.

Değerlendireceği faktörler:

- mevcut stok,
- gelir hızı,
- sıradaki yapı maliyeti,
- çağ atlama hedefi,
- ordu üretim hedefi,
- tükenen kaynak,
- tehdit altındaki alan.

Örnek:

```text
Altın stoku düşük
+ Krallık çağ atlama hedefi aktif
→ Altın önceliğini artır
→ Yeni maden alanı ara
→ Uygunsa karakol kur
```

---

## 63. AI Ekonomik Durumları

Önerilen üst seviye durumlar:

```text
Bootstrap
ExpandWorkers
BalanceResources
PrepareAgeUp
ExpandTerritory
RecoverEconomy
SupportWar
EmergencyDefense
```

---

## 64. AI Kaynak Hileleri

AI mümkün olduğunca aynı üretim ve depolama kurallarını kullanmalıdır.

Zorluk seviyesine göre kabul edilebilir küçük değişiklikler:

- üretim verimi,
- yapı maliyeti,
- karar gecikmesi,
- başlangıç kaynağı.

Bunlar görünmez ve aşırı olmamalıdır.

---

# BÖLÜM P — UI VE GERİ BİLDİRİM

## 65. Üst Kaynak Çubuğu

Her kaynak için:

- mevcut miktar,
- kapasite,
- gelir hızı,
- artış veya azalış eğilimi

gösterilebilir.

Örnek:

```text
Yiyecek  340 / 500   +24/dk
Odun     280 / 500   +18/dk
Taş      120 / 300   +8/dk
Altın     90 / 300   +6/dk
Nüfus     26 / 35
Refah        58
```

---

## 66. Ekonomi Genel Görünümü

İsteğe bağlı ekonomi paneli:

- toplam işçi,
- boşta işçi,
- kaynak başına işçi,
- aktif üretim yapıları,
- bağlantısız yapılar,
- dolu depolar,
- tükenmek üzere olan kaynaklar.

---

## 67. Harita Üzeri Geri Bildirim

- bağlantısız yapı ikonu,
- dolu yerel tampon ikonu,
- tükenen kaynak göstergesi,
- tehlike altındaki işçi uyarısı,
- yol kesintisi işareti,
- depo kapasite uyarısı.

---

## 68. Uyarı Öncelikleri

### Kritik

- Yiyecek üretimi tamamen durdu
- Tüm depolar dolu
- Ana ekonomik yol kesildi
- Tüm işçiler kaybedildi

### Önemli

- Altın madeni tükendi
- Dış depo saldırı altında
- Nüfus sınırı doldu
- Refah çağ eşiğinin altına düştü

### Bilgi

- Yeni işçi üretildi
- Depo yükseltmesi tamamlandı
- Yeni kaynak alanı keşfedildi

---

# BÖLÜM Q — FORMÜLLER

## 69. Temel Üretim Formülü

Önerilen kavramsal formül:

```text
Üretim / dakika
= Temel işçi üretimi
× Aktif işçi sayısı
× Yapı seviye katsayısı
× Kaynak kalite katsayısı
× Bağlantı katsayısı
× Durum katsayısı
```

---

## 70. Örnek Katsayılar

Kesin olmayan örnekler:

```text
Bağlantı:
- Tam bağlı: 1.00
- Uzak bağlı: 0.90
- Bağlantısız: Yerel tamponla sınırlı

Durum:
- Normal: 1.00
- Hasarlı: 0.75
- Tehdit altında: 0.80
- Yerel stok dolu: 0.00
```

Bu değerler yalnızca tasarım niyetini gösterir.

---

## 71. Gelir Hızı

UI gelir hızını kısa bir hareketli ortalama üzerinden göstermelidir.

Örnek:

```text
Son 30 saniyede depoya teslim edilen kaynak
→ Dakikalık tahmini gelire dönüştür
```

Bu yöntem anlık üretim dalgalanmalarını daha okunabilir hale getirir.

---

# BÖLÜM R — VERTICAL SLICE KAPSAMI

## 72. Vertical Slice İçin Zorunlu Ekonomi

- Dört ana kaynak
- İşçi üretimi
- İşçi atama
- En az dört üretim yapısı
- Yerel üretim tamponu
- Yol bağlantısı
- Global stok
- Depolama kapasitesi
- Nüfus sınırı
- Basit Refah değeri
- Tükenen taş ve altın
- Yenilenebilir veya sürdürülebilir yiyecek
- AI kaynak toplama ve harcama
- Ekonomi UI
- Temel uyarılar

---

## 73. Ertelenebilecek Özellikler

- Gerçek taşıma arabaları
- Ticaret kervanları
- Pazar fiyat simülasyonu
- Kaynak yağması
- İşçi deneyimi
- Vatandaş ihtiyaçları
- Vergi sistemi
- Bakım maliyetleri
- Birim maaşı
- Yapı bakım giderleri
- Ağaç yeniden büyümesi
- Mevsim sistemi
- Ayrı bölgesel stoklar

---

## 74. İlk Teknik Prototip

İlk ekonomi prototipi:

- tek kaynak,
- tek üretim yapısı,
- 2–3 işçi,
- tek depo,
- yol bağlantısı,
- yerel tampon,
- global stok,
- bir yapı maliyeti

ile çalışabilir.

Başarı koşulu:

```text
İşçi üretim yapısında çalışır
→ Yerel tampon dolar
→ Yol bağlıysa global stok artar
→ Yol kesilirse aktarım durur
→ Yol onarılınca aktarım devam eder
```

---

# BÖLÜM S — EDGE CASE'LER

## 75. Tüm İşçilerin Kaybedilmesi

Önerilen yaklaşım:

- merkez binası en az bir işçi üretebilmelidir,
- işçi üretim maliyeti tamamen ulaşılamaz hale gelmemelidir,
- gerekirse tek seferlik acil işçi seçeneği değerlendirilebilir.

---

## 76. Depolama Kapasitesinin Düşmesi

Depo yok edildiğinde:

- mevcut fazla kaynak korunur,
- yeni teslimat durur,
- kaynak harcandıkça değer kapasite altına iner.

---

## 77. Kaynak Yapısının Kontrol Alanı Dışında Kalması

Karakol kaybı sonrası yapı:

- hemen yok olmaz,
- “kontrol dışı” duruma geçer,
- üretim veya aktarım durur,
- yeniden kontrol sağlanınca çalışmaya devam eder.

---

## 78. Yerel Tampon Doluyken Yol Açılması

- tampon kademeli veya hızlı şekilde global stoğa aktarılır,
- tek karede aşırı kaynak patlaması önlenebilir,
- UI geçici yüksek gelir gösterebilir.

---

## 79. Kaynak Noktasının Tükenmesi

- işçiler idle durumuna geçer,
- oyuncuya uyarı verilir,
- üretim yapısı “kaynak tükendi” durumuna girer,
- otomatik yakın kaynak arama ilk sürümde zorunlu değildir.

---

## 80. Yol Döngüsü veya Hatalı Ağ

- bağlantı grafiği döngüleri güvenli şekilde işleyebilmelidir,
- aynı yapı birden fazla depoya bağlıysa en uygun aktif rota seçilmelidir,
- yol segmenti silindiğinde ağ yeniden hesaplanmalıdır.

---

## 81. Kaynak Maliyeti Değişirken Üretim Kuyruğu

Denge veya yükseltme etkisiyle maliyet değişirse:

- kuyruktaki mevcut üretim eski maliyetle tamamlanır,
- yeni siparişler güncel maliyeti kullanır.

---

# BÖLÜM T — TEST PLANI

## 82. Ekonomi Test Senaryoları

### Test 1 — Temel üretim

- İşçi üretim yapısına atanır.
- Yol ve depo bağlıdır.
- Global stok düzenli artar.

### Test 2 — Yol kesintisi

- Yol segmenti kaldırılır.
- Ürün yerel tamponda birikir.
- Tampon dolunca üretim durur.
- Yol onarılınca aktarım yeniden başlar.

### Test 3 — Depo kaybı

- Uzak depo yok edilir.
- Yapılar alternatif depo arar.
- Alternatif yoksa bağlantısız duruma geçer.

### Test 4 — Kaynak tükenmesi

- Taş veya altın yatağı tüketilir.
- İşçiler boşta kalır.
- UI doğru uyarıyı verir.

### Test 5 — Nüfus sınırı

- Nüfus limiti doldurulur.
- Yeni üretim engellenir.
- Ev yükseltmesi sonrası kuyruk devam eder.

### Test 6 — Refah değişimi

- Yiyecek ve yol bağlantıları kesilir.
- Refah hedef değeri düşer.
- Sorunlar giderildiğinde yavaşça toparlanır.

### Test 7 — Ekonomik baskın

- AI dış kaynak alanına saldırır.
- İşçiler geri çekilir.
- Oyuncu alternatif kaynak veya yol kurabilir.

### Test 8 — AI toparlanması

- AI ana odun alanını kaybeder.
- Yeni orman alanı arar.
- Karakol ve oduncu yapısı kurar.

---

## 83. Telemetri

İzlenecek değerler:

- kaynak başına ortalama gelir,
- kaynak başına ortalama işçi sayısı,
- boşta işçi süresi,
- ilk depo zamanı,
- ilk dış kaynak yapısı zamanı,
- yol kesintisi sayısı,
- bağlantısız kalma süresi,
- yerel tampon doluluk süresi,
- ilk kaynak tükenme zamanı,
- kaynak kapasitesi taşma süresi,
- çağ atlama öncesi stok dağılımı,
- oyuncunun en sık yaşadığı darboğaz,
- AI’ın kaynak başına işçi dağılımı,
- maç sonunda harcanmamış kaynak miktarı.

---

# BÖLÜM U — AÇIK SORULAR VE KARARLAR

## 84. Açık Tasarım Soruları

### İşçi sistemi

- İşçiler üretim yapısına fiziksel olarak girip görünmez mi olacak, dışarıda mı çalışacak?
- Yapı hasar alınca işçiler otomatik kaçar mı?
- İşçiler bir üretim yapısından diğerine toplu atanabilir mi?
- Boşta işçiler otomatik olarak merkeze döner mi?

### Depolama

- Her kaynak için ayrı kapasite kesin olarak gerekli mi?
- Depolar yol ağı dışında menzil etkisi verecek mi?
- Çok uzun rota verim cezası alacak mı?
- Depo yükseltmesi yalnızca kapasite mi, bağlantı menzili de mi artıracak?

### Refah

- Kasaba ve Krallık için Refah eşikleri kaç olmalı?
- Refah yalnızca gereksinim mi, küçük bonus da vermeli mi?
- Düşman saldırısı Refahı doğrudan etkiler mi?
- Refah bileşenleri oyuncuya ayrıntılı gösterilecek mi?

### Kaynaklar

- Yiyecek alanları arazi uygunluğu kullanacak mı?
- Ormanlar yeniden büyüyecek mi?
- Altın ve taş tamamen tükenebilir mi?
- Merkezi kaynaklar her maç aynı konumda mı olacak?

### Maliyet

- Yapı iptalinde iade oranı ne olmalı?
- Birim üretim iptalinde kısmi iade gerekli mi?
- Onarım kaynak tüketmeli mi?
- Yol segmentleri tek tek maliyet mi kullanmalı?

---

## 85. Şimdilik Alınmış Kararlar

- Oyunda dört stoklanan kaynak bulunacaktır: yiyecek, odun, taş ve altın.
- Nüfus ve depolama kapasitesi ayrı ekonomik sınırlar olacaktır.
- Refah harcanan bir kaynak olmayacaktır.
- Refah ilk vertical slice içinde gelişim koşulu ve yerleşim sağlığı göstergesi olarak kullanılacaktır.
- İşçiler üretim yapılarına atanacaktır.
- İlk vertical slice içinde işçilerin kaynakları fiziksel olarak depoya taşıması gerekmeyecektir.
- Üretim yapıları yerel tampon kullanacaktır.
- Yol bağlantısı, yerel tampondaki kaynağın global stoğa aktarılmasını sağlayacaktır.
- Global stok oyuncunun tüm bağlı bölgeleri tarafından ortak kullanılacaktır.
- Depolar hem kapasite hem de lojistik bağlantı noktası olacaktır.
- Taş ve altın tükenebilir kaynaklar olacaktır.
- Yiyecek uzun vadede sürdürülebilir üretime sahip olacaktır.
- Odun büyük ölçüde tükenebilir olacak; yeniden büyüme ilk sürüm için zorunlu değildir.
- Yol mesafesi ilk vertical slice içinde üretim cezası oluşturmayacaktır.
- Bağlı/bağlantısız modeli önce uygulanacaktır.
- Pazar sistemi kapsam baskısı oluşursa ertelenecektir.
- Düzenli askerî bakım veya maaş sistemi ilk vertical slice içinde bulunmayacaktır.
- Ekonomi mümkün olduğunca veri tabanlı olacaktır.
- AI oyuncuyla aynı temel üretim ve depolama kurallarını kullanacaktır.

---

## 86. Diğer Dokümanlarla Bağlantılar

- `04_BUILDINGS_AND_SETTLEMENT.md`
  - ekonomik yapıların tam listesi,
  - yapı kapasiteleri,
  - yükseltmeler.

- `05_TERRITORY_LOGISTICS_AND_ROADS.md`
  - bağlantı grafiği,
  - yol durumları,
  - karakol ve kontrol alanı.

- `06_UNITS_AND_COMBAT.md`
  - birim maliyetleri,
  - nüfus kullanımı,
  - işçi savunma davranışları.

- `07_ENEMY_AI_DESIGN_v0.2.md`
  - AI işçi dağılımı,
  - ekonomik hedef seçimi,
  - toparlanma.

- `08_MAP_AND_WORLD_DESIGN.md`
  - kaynak dağılımı,
  - başlangıç güvenliği,
  - merkezi riskli bölgeler.

- `10_CAMERA_CONTROLS_AND_UI.md`
  - ekonomi paneli,
  - kaynak uyarıları,
  - bağlantı görünümü.

- `12_BALANCE_AND_GAME_DATA.md`
  - üretim hızları,
  - maliyetler,
  - kapasiteler,
  - Refah eşikleri.

---

## 87. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Dört ana kaynağın rolleri birbirinden ayrılmıştır.
- [ ] İşçi üretim modeli onaylanmıştır.
- [ ] Yerel tampon ve global stok yaklaşımı kabul edilmiştir.
- [ ] Yol bağlantısının ekonomik etkisi nettir.
- [ ] Depoların çift rolü onaylanmıştır.
- [ ] Kaynak tükenme yaklaşımı kabul edilmiştir.
- [ ] Nüfus sistemi ve hedef üst sınırlar gözden geçirilmiştir.
- [ ] Refahın harcanmayan durum değeri olduğu kabul edilmiştir.
- [ ] Pazarın vertical slice için opsiyonel olduğu kabul edilmiştir.
- [ ] AI ekonomi yaklaşımı onaylanmıştır.
- [ ] Vertical slice ekonomik kapsamı gerçekçi bulunmuştur.
- [ ] Açık sorular sonraki dokümanlara aktarılmıştır.

---

## 88. Kontrol Listesi

### Kaynaklar

- [ ] Yiyecek rolü tanımlandı.
- [ ] Odun rolü tanımlandı.
- [ ] Taş rolü tanımlandı.
- [ ] Altın rolü tanımlandı.
- [ ] Kaynak tükenme kuralları taslaklandı.
- [ ] Güvenli ve riskli kaynak dağılımı tanımlandı.

### İşçiler ve üretim

- [ ] İşçi rolleri tanımlandı.
- [ ] İşçi atama sistemi tanımlandı.
- [ ] Üretim yapısı modeli tanımlandı.
- [ ] Yerel tampon tanımlandı.
- [ ] Üretim durumları tanımlandı.
- [ ] Boşta işçi davranışı ele alındı.

### Depolama ve lojistik

- [ ] Global stok yaklaşımı tanımlandı.
- [ ] Depolama kapasitesi tanımlandı.
- [ ] Depo kaybı davranışı tanımlandı.
- [ ] Yol bağlantı grafiği tanımlandı.
- [ ] Bağlantı durumları tanımlandı.
- [ ] Mesafe etkisi ertelendi.

### Nüfus ve Refah

- [ ] Nüfus kullanımı tanımlandı.
- [ ] Çağlara göre nüfus hedefleri taslaklandı.
- [ ] Refah bileşenleri tanımlandı.
- [ ] Refah kazanım ve kayıp nedenleri tanımlandı.
- [ ] Refahın oynanış etkisi sınırlandırıldı.

### AI ve test

- [ ] AI kaynak hedefleri tanımlandı.
- [ ] AI işçi dağılımı tanımlandı.
- [ ] AI toparlanma durumu tanımlandı.
- [ ] Test senaryoları oluşturuldu.
- [ ] Telemetri değerleri listelendi.
- [ ] Edge case'ler incelendi.

---

## 89. Revizyon Notları

### Sürüm 0.1

- Dört kaynaklı ekonomi sistemi tanımlandı.
- İşçi atama ve üretim yapısı modeli oluşturuldu.
- Yerel tampon ve global stok yaklaşımı seçildi.
- Depo ve yol bağlantısının ekonomik rolleri tanımlandı.
- Kaynak tükenmesi ve harita dağılımı ele alındı.
- Nüfus ve Refah sistemleri oluşturuldu.
- Pazar sistemi opsiyonel kapsam olarak ayrıldı.
- AI ekonomi yaklaşımı eklendi.
- Formül, test, telemetri ve edge case bölümleri oluşturuldu.

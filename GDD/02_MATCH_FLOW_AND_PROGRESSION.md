# 02 — Match Flow and Progression

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Maç Akışı ve İlerleme  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. "Vertical slice için zorunlu" ifadeleri tam oyun hedefini anlatır — bir özelliğin hangi üründe (A/B/C) açıldığı ya da koşullu/kapsam dışı olduğu konusunda 13 v0.2 esastır. Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman, bir maçın başlangıçtan sona nasıl ilerlediğini ve oyuncunun üç gelişim seviyesi boyunca hangi yeni imkânları açtığını tanımlar.

Belge şu sorulara cevap verir:

- Maç hangi aşamalardan oluşur?
- Her çağın amacı ve oyuncudan beklediği kararlar nelerdir?
- Çağ atlama hangi koşullarla gerçekleşir?
- Çağ atlamanın fırsat maliyeti nedir?
- Hangi yapılar, birlikler ve sistemler hangi aşamada açılır?
- Yapıların üç görsel seviyesi nasıl kullanılacaktır?
- Oyuncunun erken, orta ve geç oyunda ne kadar güçlü olması beklenir?
- AI rakip, oyuncunun ilerlemesine nasıl tepki verir?
- Bir oyuncu geride kaldığında maça nasıl dönebilir?
- Vertical slice içinde ilerleme sistemi ne kadar ayrıntılı olmalıdır?

Bu belge kesin maliyetleri ve süreleri belirlemez. Sayısal denge değerleri daha sonra `12_BALANCE_AND_GAME_DATA.md` içinde tanımlanacaktır.

---

## 2. İlerleme Sisteminin Temel İlkesi

Oyundaki ilerleme yalnızca daha yüksek sayılara ulaşmak değildir.

Her gelişim seviyesi:

- yeni ekonomik kararlar,
- yeni askerî seçenekler,
- yeni bölgesel riskler,
- yeni yapı rolleri,
- yeni zafer baskıları

sunmalıdır.

Oyuncu çağ atladığında yalnızca “daha güçlü” hale gelmemeli; oyun alanını farklı şekilde kullanmaya başlamalıdır.

Temel ilerleme yapısı:

```text
Yerleşim
→ Temel ekonomi ve güvenli başlangıç
→ Kasaba
→ Genişleme, uzmanlaşma ve sınır mücadelesi
→ Krallık
→ Büyük ölçekli kararlar ve zafere yönelme
```

---

## 3. Maçın Genel Yapısı

Bir maç beş ana aşamaya ayrılır:

1. **Başlangıç ve yön bulma**
2. **Yerleşim kurma**
3. **Kasabaya geçiş**
4. **Sınır ve üstünlük mücadelesi**
5. **Krallık ve zafer baskısı**

Bu aşamalar kesin zaman duvarları değildir. Oyuncunun ekonomisi, AI baskısı ve harita kararları süreleri etkiler.

---

## 4. Hedef Zaman Çizelgesi

İdeal 20–30 dakikalık maç için hedef aralıklar:

| Aşama | Hedef süre | Ana odak |
|---|---:|---|
| Başlangıç | 0–2 dk | Çevreyi tanıma, ilk işçi dağılımı |
| Yerleşim | 2–8 dk | Temel ekonomi, ilk yol ve savunma |
| Kasabaya geçiş | 6–10 dk | Çağ atlama kararı |
| Kasaba | 8–20 dk | Genişleme, karakollar, düzenli savaş |
| Krallığa geçiş | 16–22 dk | Geç oyun yatırımı |
| Krallık | 20–30+ dk | Zafer koşulunu tamamlama |

Bu süreler denge testleriyle değişebilir.

---

## 5. Gelişim Seviyeleri

Oyunun üç ana gelişim seviyesi vardır:

1. **Yerleşim**
2. **Kasaba**
3. **Krallık**

Her seviye aşağıdaki alanları etkiler:

- merkez binasının görünümü,
- kullanılabilir yapı türleri,
- mevcut yapıların yükseltme sınırı,
- birlik kadrosu,
- nüfus kapasitesi,
- yol ve lojistik özellikleri,
- savunma gücü,
- karakol işlevleri,
- zafer koşullarına erişim.

---

# BÖLÜM A — YERLEŞİM SEVİYESİ

## 6. Yerleşim Seviyesi Kimliği

Yerleşim seviyesi, oyuncunun savunmasız ve sınırlı kaynaklarla başladığı temel aşamadır.

Ana kimlik:

- küçük ölçek,
- düşük üretim,
- sınırlı yapı çeşitliliği,
- az sayıda birlik,
- kısa lojistik hatları,
- yüksek keşif ihtiyacı,
- düşük savunma kapasitesi.

Oyuncunun ana sorusu:

> “İlk ekonomimi güvenli ve sürdürülebilir biçimde nasıl kurarım?”

---

## 7. Yerleşim Seviyesi Başlangıç Durumu

Önerilen başlangıç içeriği:

- Seviye I merkez binası
- 4–6 işçi
- 1 temel ev veya sınırlı başlangıç nüfusu
- Yakın yiyecek kaynağı
- Yakın odun kaynağı
- Görünür olmayan uzak taş ve altın alanları
- Kısa bir başlangıç yolu veya tamamen boş yol ağı
- Savunmasız veya çok sınırlı askerî güç

İlk teknik prototipte bu kapsam daha küçük tutulabilir.

---

## 8. Yerleşim Seviyesinde Açık Sistemler

### 8.1 Ekonomi

- Yiyecek toplama
- Odun toplama
- Sınırlı taş toplama
- Sınırlı altın toplama
- İşçi üretimi
- Nüfus kapasitesi
- Temel depo kullanımı

### 8.2 Yapılar

- Merkez binası I
- Ev I
- Depo I
- Tarla veya yiyecek üretim alanı I
- Oduncu yapısı veya odun toplama noktası I
- Temel askerî üretim yapısı I
- Gözcü veya basit karakol I
- Yol I

### 8.3 Birlikler

- İşçi
- Temel yakın dövüş birimi
- İsteğe bağlı hafif menzilli birim

### 8.4 Bölge ve lojistik

- Merkezin başlangıç kontrol alanı
- Kısa yol bağlantıları
- Temel karakol ile sınırlı genişleme
- Bağlantılı/bağlantısız yapı durumu

---

## 9. Yerleşim Seviyesinin Oyuncu Kararları

Oyuncu şu seçimlerle karşılaşmalıdır:

- daha fazla işçi mi, erken asker mi?
- ilk ev mi, ilk depo mu?
- yakındaki güvenli kaynak mı, daha uzaktaki zengin kaynak mı?
- ilk karakol savunma için mi, ekonomi için mi kurulmalı?
- erken çağ atlama mı, erken baskı mı?
- yol ağı kısa mı, güvenli mi kurulmalı?

---

## 10. Yerleşim Seviyesinin Başarı Koşulları

Oyuncunun Kasaba seviyesine geçmeye hazır olması için genel olarak:

- işleyen yiyecek ve odun ekonomisi,
- yeterli nüfus kapasitesi,
- en az bir askerî veya savunma yapısı,
- belirli sayıda aktif yapı,
- gerekli kaynak rezervi,
- çalışan bir yol veya depo bağlantısı

bulunmalıdır.

Kesin gereksinimler daha sonra dengelenecektir.

---

# BÖLÜM B — KASABA SEVİYESİ

## 11. Kasaba Seviyesi Kimliği

Kasaba seviyesi, oyuncunun temel ekonomiden bölgesel büyümeye geçtiği aşamadır.

Ana kimlik:

- uzmanlaşmış yapılar,
- daha güçlü yol ağı,
- düzenli asker üretimi,
- ileri karakollar,
- taş ve altın ekonomisinin önem kazanması,
- AI ile doğrudan sınır çatışması.

Oyuncunun ana sorusu:

> “Harita kontrolünü ele geçirmek için ekonomimi ne kadar riske atabilirim?”

---

## 12. Kasaba Seviyesinde Açılan Sistemler

### 12.1 Ekonomi

- Gelişmiş depo
- Daha yüksek işçi kapasitesi
- Taş ve altın üretiminde tam erişim
- Yol bağlantısı üzerinden daha yüksek verim
- İsteğe bağlı pazar veya ticaret yapısı
- Yapı uzmanlaşmaları

### 12.2 Yapılar

- Merkez binası II
- Ev II
- Depo II
- Gelişmiş üretim yapıları II
- Kışla II
- Okçu üretim yapısı
- Karakol II
- Gözcü kulesi
- Taş savunma yapıları
- Pazar veya ticaret yapısı
- Gelişmiş yol

### 12.3 Birlikler

- Gelişmiş yakın dövüş birimi
- Okçu
- Keşif veya hızlı birlik
- İsteğe bağlı hafif süvari

### 12.4 Bölge ve lojistik

- Daha geniş karakol kontrol alanı
- Yol verim bonusları
- İkinci depo hattı
- Uzak kaynak bölgeleri
- Stratejik nokta kontrolü

---

## 13. Kasaba Seviyesinin Oyuncu Kararları

Oyuncu şu kararları vermelidir:

- ikinci bir askerî üretim yapısı kurulmalı mı?
- yeni karakol merkezden ne kadar uzakta olmalı?
- mevcut binalar yükseltilmeli mi, yeni binalar mı kurulmalı?
- taş savunmaya mı, üçüncü çağ hazırlığına mı harcanmalı?
- AI’ın genişlemesi durdurulmalı mı, ekonomik yarış mı sürdürülmeli?
- merkezi yol ağı mı güçlendirilmeli, alternatif rota mı kurulmalı?

---

## 14. Kasaba Seviyesinin Oynanış Rolü

Kasaba aşaması maçın en uzun ve en yoğun bölümü olmalıdır.

Bu aşamada:

- oyuncu ve AI aynı stratejik alanlara yönelir,
- karakollar gerçek askerî hedef haline gelir,
- yol bağlantılarının değeri artar,
- ilk büyük çatışmalar yaşanır,
- oyuncu üçüncü çağ için kaynak ayırmak ile mevcut orduyu büyütmek arasında kalır.

Kasaba seviyesi başarısız tasarlanırsa oyun ya çok erken biter ya da geç oyun anlamsız hale gelir.

---

## 15. Kasabadan Krallığa Geçiş Hazırlığı

Krallık seviyesine geçiş için önerilen genel koşullar:

- Merkez binası II
- Belirli sayıda Seviye II yapı
- En az bir gelişmiş askerî yapı
- En az bir aktif ileri karakol
- Belirli miktarda taş ve altın
- Yeterli nüfus veya refah değeri
- Gerekirse belirli bir stratejik bölge kontrolü

Bu koşullar yalnızca kaynak biriktirmeyi değil, oyuncunun gerçekten gelişmiş bir kasaba kurduğunu doğrulamalıdır.

---

# BÖLÜM C — KRALLIK SEVİYESİ

## 16. Krallık Seviyesi Kimliği

Krallık seviyesi, oyuncunun ekonomik üstünlüğünü zafere dönüştürdüğü son aşamadır.

Ana kimlik:

- gelişmiş yapılar,
- güçlü savunma,
- yüksek maliyetli birlikler,
- büyük nüfus kapasitesi,
- geniş kontrol alanı,
- belirgin zafer baskısı,
- daha az fakat daha önemli karar.

Oyuncunun ana sorusu:

> “Kurduğum üstünlüğü kesin zafere nasıl dönüştürürüm?”

---

## 17. Krallık Seviyesinde Açılan Sistemler

### 17.1 Ekonomi

- En yüksek yapı verim seviyeleri
- Gelişmiş depolar
- Büyük nüfus kapasitesi
- Pazar veya ticaret bonusları
- Geç oyun ekonomi teknolojileri
- Uzak bölgelerde daha güvenli lojistik

### 17.2 Yapılar

- Merkez binası III / Kale
- Ev III
- Depo III
- Gelişmiş üretim yapıları III
- Kışla III
- Gelişmiş menzilli üretim yapısı
- Kuşatma atölyesi
- Kale veya büyük savunma yapıları
- Karakol III
- Zafer veya yönetim yapısı
- Gelişmiş yollar

### 17.3 Birlikler

- Seçkin yakın dövüş birimi
- Gelişmiş okçu
- Süvari
- Kuşatma birimi
- İsteğe bağlı destek birimi

### 17.4 Bölge ve lojistik

- Daha dayanıklı karakollar
- Daha yüksek yol verimi
- Kritik bağlantılar için savunma seçenekleri
- Bölgesel zafer sayacına tam erişim
- Geniş harita kontrolü

---

## 18. Krallık Seviyesinin Oyuncu Kararları

Oyuncu şu kararlarla karşılaşmalıdır:

- düşman merkezine doğrudan saldırı mı?
- stratejik bölgeleri tutarak zafer mi?
- seçkin birlik mi, daha fazla temel birlik mi?
- savunmalı yol ağı mı, hızlı saldırı rotası mı?
- son ekonomik yükseltme mi, bitirici ordu mu?
- kuşatma üretimi mi, düşman yollarına baskın mı?

---

## 19. Krallık Seviyesinin Maçı Bitirme Rolü

Krallık seviyesi yalnızca daha uzun süren bir büyüme dönemi olmamalıdır.

Bu seviyede:

- zafer koşulları daha erişilebilir hale gelir,
- AI daha saldırgan veya daha savunmacı tepki verir,
- büyük kaynak tüketimi ekonomik kararları keskinleştirir,
- oyuncu pasif kalırsa AI bölgesel üstünlük kazanabilir,
- maç doğal bir sonuca yaklaşır.

---

# BÖLÜM D — ÇAĞ ATLAMA SİSTEMİ

## 20. Çağ Atlama Temel Akışı

```text
Gerekli ekonomik koşulları oluştur
→ Gerekli yapıları tamamla
→ Gerekli bölgesel koşulları karşıla
→ Kaynak maliyetini biriktir
→ Merkez binasında çağ atlamayı başlat
→ Geçiş süresi boyunca savun
→ Yeni içerikleri aç
→ Öncelikli yapıları yükselt
```

---

## 21. Çağ Atlama Koşulları

Çağ atlama yalnızca bir kaynak ödemesi olmamalıdır.

Önerilen koşul grupları:

### 21.1 Ekonomik koşullar

- belirli yiyecek,
- belirli odun,
- belirli taş,
- belirli altın,
- minimum işçi sayısı,
- minimum nüfus kapasitesi.

### 21.2 Yapısal koşullar

- belirli sayıda ev,
- en az bir depo,
- en az bir askerî yapı,
- belirli çağ için özel bina,
- merkez binasının hasarsız veya aktif olması.

### 21.3 Bölgesel koşullar

İlk vertical slice için basit tutulmalıdır.

Olası koşullar:

- en az bir karakol,
- belirli büyüklükte kontrol alanı,
- en az bir dış kaynak bölgesi,
- en az bir stratejik nokta teması.

### 21.4 Refah koşulu

Refah sistemi kullanılırsa:

- belirli refah eşiği,
- kesintisiz yiyecek arzı,
- yeterli barınma,
- bağlı yol ağı

çağ atlama gereksinimi olabilir.

---

## 22. Çağ Atlama Fırsat Maliyeti

Çağ atlama güçlü bir karar olmalıdır.

Oyuncu çağ atlama sırasında:

- yüksek kaynak harcar,
- bir süre merkez üretimini kaybedebilir,
- asker üretimini azaltabilir,
- savunmasız hale gelebilir,
- yükseltme sonrası yeni yapı yatırımlarına ihtiyaç duyar.

Bu nedenle “mümkün olur olmaz çağ atlamak” her zaman doğru seçim olmamalıdır.

---

## 23. Çağ Atlama Süresi

Çağ atlama anlık olmamalıdır.

Önerilen yaklaşım:

- merkez binasında görünür ilerleme çubuğu,
- görsel dönüşüm veya inşaat aşaması,
- süreç sırasında merkez işlevlerinin bir kısmında azalma,
- tamamlandığında güçlü ses ve görsel geri bildirim.

Geçiş süresi:

- oyuncuya risk yaratmalı,
- ancak gereksiz bekleme hissi oluşturmamalıdır.

---

## 24. Çağ Atlama Sonrası İçerik Açılımı

Çağ tamamlandığında:

- yeni yapı türleri açılır,
- mevcut yapıların yeni seviye yükseltmeleri açılır,
- yeni birlik türleri açılır,
- nüfus sınırı potansiyeli artar,
- karakol ve yol yükseltmeleri açılır,
- yeni zafer seçenekleri kullanılabilir hale gelir.

Tüm yapılar otomatik yükseltilmez.

---

# BÖLÜM E — YAPI GELİŞİMİ

## 25. Yapıların Üç Seviye Kullanımı

Quaternius asset setindeki üç yapı gelişim seviyesi, oyun sistemine doğrudan bağlanmalıdır.

Önerilen yaklaşım:

- Seviye I yapı: Yerleşim
- Seviye II yapı: Kasaba
- Seviye III yapı: Krallık

Ancak her yapı üç seviyeye sahip olmak zorunda değildir.

### 25.1 Üç seviyeli olması önerilen yapılar

- Merkez binası
- Ev
- Depo
- Kışla
- Karakol
- Kule
- Temel üretim yapıları
- Pazar

### 25.2 Tek veya iki seviyeli olabilecek yapılar

- Özel kaynak yapısı
- Kuşatma atölyesi
- Zafer yapısı
- Geç oyun savunma yapısı
- Dekoratif veya yardımcı yapılar

---

## 26. Yapı Yükseltme Kuralları

Bir yapı yükseltildiğinde şunlardan biri veya birkaçı değişebilir:

- sağlık,
- üretim hızı,
- kapasite,
- işçi limiti,
- kontrol alanı,
- görüş mesafesi,
- yol verim bonusu,
- yeni üretim seçeneği,
- yeni pasif özellik,
- görsel model.

Yükseltme yalnızca sağlık ve üretim yüzdesi artışı olmamalıdır.

---

## 27. Yapı Yükseltme Kararları

Oyuncu her yapıyı hemen yükseltememelidir.

Örnek ikilemler:

- bir ev yükseltip nüfus kazanmak mı, yeni ev kurmak mı?
- mevcut kışlayı geliştirmek mi, ikinci kışla kurmak mı?
- karakolu güçlendirmek mi, yeni bölgeye karakol kurmak mı?
- depoyu büyütmek mi, yeni depo ile başka bölgeyi desteklemek mi?

---

## 28. Yapı Yükseltme Süreci

Önerilen akış:

```text
Yükseltilebilir yapıyı seç
→ Maliyet ve kazancı gör
→ Yükseltmeyi başlat
→ Yapı geçici olarak sınırlı çalışır veya durur
→ Görsel inşaat aşaması göster
→ Yeni model ve işlevleri etkinleştir
```

Yükseltme iptali ve kaynak iadesi sistemi daha sonra belirlenmelidir.

---

# BÖLÜM F — İLERLEME AÇILIM TABLOSU

## 29. Yüksek Seviye Açılım Tablosu

| Sistem | Yerleşim | Kasaba | Krallık |
|---|---|---|---|
| İşçi üretimi | Açık | Gelişmiş | En yüksek kapasite |
| Yiyecek | Temel | Gelişmiş | Optimize |
| Odun | Temel | Gelişmiş | Optimize |
| Taş | Sınırlı | Tam | Yüksek tüketim |
| Altın | Sınırlı | Tam | Kritik |
| Yol | Temel | Gelişmiş | En yüksek verim |
| Karakol | Basit | Gelişmiş | Güçlendirilmiş |
| Yakın dövüş | Temel | Gelişmiş | Seçkin |
| Menzilli | Sınırlı | Tam | Gelişmiş |
| Süvari | Kapalı | Opsiyonel | Açık |
| Kuşatma | Kapalı | Kapalı/ön hazırlık | Açık |
| Bölgesel zafer | Görünür olabilir | Aktif hazırlık | Tam erişim |
| Askerî zafer | Teorik olarak mümkün | Gerçekçi | Ana bitiriş yolu |

---

## 30. Önerilen Yapı Açılım Tablosu

| Yapı | Yerleşim | Kasaba | Krallık |
|---|---|---|---|
| Merkez | I | II | III |
| Ev | I | II | III |
| Depo | I | II | III |
| Tarla / yiyecek yapısı | I | II | III |
| Oduncu noktası | I | II | III |
| Taş ocağı desteği | Sınırlı | II | III |
| Altın madeni desteği | Sınırlı | II | III |
| Kışla | I | II | III |
| Okçu yapısı | Kapalı/temel | II | III |
| Süvari yapısı | Kapalı | Opsiyonel | III |
| Kuşatma atölyesi | Kapalı | Kapalı | III |
| Karakol | I | II | III |
| Kule | Basit | II | III |
| Pazar | Kapalı | II | III |
| Zafer yapısı | Kapalı | Kapalı | III |

Bu tablo kesin değildir; asset eşleştirmesi ve kapsam kontrolüyle daraltılacaktır.

---

## 31. Önerilen Birlik Açılım Tablosu

| Birlik | Yerleşim | Kasaba | Krallık |
|---|---|---|---|
| İşçi | Açık | İyileştirilmiş | İyileştirilmiş |
| Muhafız | Açık | Gelişmiş | Seçkin |
| Okçu | Sınırlı/Açık | Gelişmiş | Seçkin |
| Keşif birimi | Açık | Gelişmiş | Aynı rol |
| Süvari | Kapalı | Opsiyonel | Açık |
| Kuşatma | Kapalı | Kapalı | Açık |

Vertical slice için kadro küçültülebilir.

---

# BÖLÜM G — MAÇ TEMPOSU

## 32. İlerleme Hızının Hedefi

İlerleme çok hızlı olursa:

- erken oyun kararları anlamsızlaşır,
- yapı seviyeleri fark edilmez,
- lojistik sistem kurulmadan geçilir,
- oyuncu seçenekleri öğrenemeden yeni sistemler açılır.

İlerleme çok yavaş olursa:

- maç sürünür,
- oyuncu tekrar eden kaynak toplama döngüsüne sıkışır,
- AI baskısı haksız hissedilir,
- üçüncü çağa ulaşmak ödül yerine görev gibi görünür.

Hedef, her seviyenin kendi kimliğini gösterecek kadar uzun sürmesidir.

---

## 33. Tempo Eşik Noktaları

Maç içindeki önemli eşikler:

1. İlk ev
2. İlk askerî yapı
3. İlk karakol
4. İlk düşman teması
5. Kasaba seviyesine geçiş
6. İlk büyük çatışma
7. İlk stratejik bölge kontrolü
8. Krallık seviyesine geçiş
9. Zafer sayacının başlaması veya ana saldırı
10. Maç sonu

Bu eşiklerin telemetri ile ölçülmesi gerekir.

---

## 34. Oyuncunun Boşta Kalmasını Önleme

Çağ atlama veya yükseltme sırasında oyuncu tamamen beklememelidir.

Oyuncu aynı anda:

- keşif yapabilir,
- yol ağını düzenleyebilir,
- işçi dağılımını değiştirebilir,
- karakol savunabilir,
- küçük baskın yapabilir,
- yeni yapı alanı hazırlayabilir.

---

## 35. Kartopu Etkisini Kontrol Etme

RTS oyunlarında erken avantajın maçı otomatik kazanmasına “kartopu etkisi” denir.

Tamamen kaldırılmamalı; başarılı kararlar ödüllendirilmelidir. Ancak küçük bir erken hata maçı anında bitirmemelidir.

### 35.1 Kontrol araçları

- Merkeze yakın güvenli kaynaklar
- Ucuz temel savunma
- Karakol kaybında yapıların hemen yok olmaması
- Dış kaynakların daha yüksek fakat riskli verimi
- Gelişmiş birliklerin yüksek maliyeti
- Saldıran taraf için lojistik zorluk
- Savunana kısa mesafe avantajı
- Düşük seviyeli birimlerin tamamen işlevsiz hale gelmemesi

---

## 36. Geriden Gelen Oyuncu

Geride olan oyuncu şu yollarla geri dönebilmelidir:

- düşmanın uzak ordusuna karşı karşı baskın,
- alternatif kaynak alanı,
- daha kısa savunma hattı,
- ucuz savunma birimleri,
- karakol yeniden kurma,
- stratejik bölgeyi geçici ele geçirme,
- düşmanın lojistiğini kesme.

Geriden gelen oyuncuya doğrudan büyük kaynak hibesi vermek ilk tercih olmamalıdır.

---

# BÖLÜM H — AI İLERLEMESİ

## 37. AI Çağ Atlama Mantığı

AI çağ atlamayı şu faktörlere göre değerlendirmelidir:

- mevcut kaynak stoku,
- düzenli gelir,
- işçi sayısı,
- yapı gereksinimleri,
- oyuncunun askerî baskısı,
- kontrol ettiği bölge sayısı,
- mevcut ordu gücü,
- hedeflediği strateji.

AI yalnızca sabit dakikada çağ atlamamalıdır.

---

## 38. AI İlerleme Profilleri

İlk vertical slice tek ana profil kullanabilir. Gelecekte:

### 38.1 Ekonomik profil

- erken işçi ve yapı yatırımı,
- daha geç askerî baskı,
- hızlı çağ atlama,
- geniş kaynak ağı.

### 38.2 Agresif profil

- erken askerî üretim,
- gecikmiş çağ atlama,
- karakol ve işçi baskınları.

### 38.3 Savunmacı profil

- daha güçlü merkez savunması,
- kontrollü genişleme,
- geç oyun ordusu.

### 38.4 Bölgesel profil

- stratejik noktalara öncelik,
- çok sayıda karakol,
- bölgesel zafer takibi.

---

## 39. AI’ın Oyuncu İlerlemesine Tepkisi

AI şu durumlara tepki vermelidir:

- oyuncu erken çağ atlıyorsa baskı hazırlamak,
- oyuncu ordusuz büyüyorsa baskın yapmak,
- oyuncu savunmaya kapanıyorsa stratejik bölgeleri almak,
- oyuncu tek kaynak hattına bağımlıysa o hattı hedeflemek,
- oyuncu zafer sayacını başlatırsa saldırı önceliğini artırmak.

---

## 40. AI Hileleri

İlk hedef, AI’ın aynı temel kaynak ve yapı kurallarını kullanmasıdır.

Kabul edilebilir sınırlı kolaylıklar:

- daha düşük karar sıklığı maliyeti,
- görünmeyen fakat adil iç değerlendirme,
- küçük zorluk seviyesi bonusları,
- pathfinding için teknik yardım.

Kaçınılması gerekenler:

- sınırsız kaynak,
- görüş dışındaki oyuncu hareketlerini sürekli bilme,
- çağ gereksinimlerini atlama,
- anlık birlik üretme,
- yapı maliyetlerini tamamen yok sayma.

---

# BÖLÜM I — UI VE GERİ BİLDİRİM

## 41. Çağ Göstergesi

Arayüzde şu bilgiler görünmelidir:

- mevcut çağ,
- sonraki çağın adı,
- çağ atlama koşulları,
- eksik gereksinimler,
- ilerleme süresi,
- açılacak ana içerikler.

---

## 42. Yapı Seviye Göstergesi

Seçili yapıda:

- mevcut seviye,
- maksimum seviye,
- yükseltme maliyeti,
- yükseltme süresi,
- kazanılacak özellikler,
- yükseltme sırasında kapanacak işlevler

gösterilmelidir.

---

## 43. Çağ Atlama Geri Bildirimi

Çağ atlama başladığında:

- merkez üzerinde görsel inşaat durumu,
- ekran kenarında ilerleme çubuğu,
- kısa ses uyarısı,
- AI için görünür veya duyurulan bilgi,
- tamamlandığında belirgin görsel dönüşüm

kullanılmalıdır.

---

## 44. Açılım Bildirimleri

Yeni çağ tamamlandığında oyuncuya tüm ayrıntılarla büyük bir liste gösterilmemelidir.

Önerilen geri bildirim:

- 3–5 önemli açılım kartı,
- yeni yapı kategorisi vurgusu,
- yeni birlik üretim ikonu,
- kısa araç ipucu,
- bina panelinde yeni seçenek işareti.

---

# BÖLÜM J — VERTICAL SLICE KAPSAMI

## 45. Vertical Slice İçin Gerekli İlerleme

Vertical slice içinde mutlaka bulunmalıdır:

- üç çağ,
- iki çağ atlama süreci,
- merkez binasının üç görsel seviyesi,
- en az üç yapının seviye yükseltmesi,
- çağlara bağlı en az iki yeni birlik açılımı,
- çağlara bağlı karakol veya yol iyileştirmesi,
- AI’ın en az bir kez çağ atlaması,
- çağ atlama sırasında risk,
- geç oyunda aktif zafer baskısı.

---

## 46. Vertical Slice İçin Ertelenebilecek Özellikler

- Her yapının üç seviyeye sahip olması
- Karmaşık teknoloji ağacı
- Çoklu çağ atlama yolları
- Fraksiyona özel ilerleme
- Çağ atlama seçim ekranı
- Büyük refah sistemi
- Bina uzmanlaşma dalları
- Birden fazla AI kişiliği
- Çağ geriletme veya yapı ele geçirme

---

## 47. İlk Teknik Prototip Kapsamı

İlk teknik prototipte:

- iki gelişim seviyesi yeterlidir,
- merkez binası yükseltmesi,
- bir yapı yükseltmesi,
- bir yeni birlik açılımı,
- basit kaynak şartı,
- basit ilerleme çubuğu

uygulanabilir.

Amaç, tam ilerleme tasarımını değil altyapıyı doğrulamaktır.

---

# BÖLÜM K — TEKNİK GEREKSİNİMLER

## 48. Veri Tabanlı İlerleme

Çağ ve yapı seviyeleri kod içine sabit yazılmamalıdır.

Önerilen veri yapısı:

```yaml
ages:
  settlement:
    index: 1
    unlocks:
      buildings:
        - town_center_1
        - house_1
        - storage_1
        - barracks_1
      units:
        - worker
        - guard_1

  town:
    index: 2
    requirements:
      resources:
        food: TBD
        wood: TBD
        gold: TBD
      buildings:
        barracks_1: 1
        storage_1: 1
      outposts: 1
    unlocks:
      buildings:
        - town_center_2
        - house_2
        - archery_range_1
      units:
        - archer_1
```

Kesin şema teknik tasarım aşamasında belirlenmelidir.

---

## 49. İlerleme Durum Makinesi

Önerilen durumlar:

```text
Locked
→ Available
→ InProgress
→ Completed
```

Yapı yükseltmeleri için:

```text
Unavailable
→ UpgradeAvailable
→ Upgrading
→ Upgraded
```

Bu durumlar UI, save/load ve AI tarafından ortak kullanılmalıdır.

---

## 50. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- mevcut çağ,
- çağ atlama ilerlemesi,
- her yapının seviyesi,
- kilidi açılmış yapı ve birlikler,
- aktif yükseltmeler,
- harcanmış kaynaklar,
- AI’ın mevcut çağı,
- AI ilerleme hedefi.

---

## 51. Performans Gereksinimleri

Çağ atlama sırasında:

- tüm yapıların aynı karede ağır işlem yapması önlenmeli,
- model değişimleri kontrollü gerçekleştirilmelidir,
- görsel efektler web performans bütçesini aşmamalıdır,
- AI açılım değerlendirmeleri periyodik çalışmalıdır.

---

# BÖLÜM L — EDGE CASE'LER

## 52. Çağ Atlama Sırasında Merkez Yıkılırsa

Önerilen davranış:

- çağ atlama iptal edilir,
- kısmi kaynak iadesi yapılabilir,
- oyuncu başka merkez kurabiliyorsa devam eder,
- merkez kuramıyorsa yenilgi koşulu değerlendirilir.

Kesin iade oranı daha sonra belirlenmelidir.

---

## 53. Çağ Atlama Sırasında Kaynak Kaybı

Çağ atlama başladıktan sonra maliyet tamamen ödenmiş kabul edilmelidir.

Kaynak stoğunun sonradan azalması süreci iptal etmemelidir.

---

## 54. Yükseltme Sırasında Yapı Hasar Alırsa

Yapı:

- yükseltmeye devam edebilir,
- ağır hasarda süreç yavaşlayabilir,
- yıkılırsa yükseltme kaybedilir.

İlk vertical slice için en basit yaklaşım tercih edilmelidir.

---

## 55. Bağlantısız Yapı Yükseltmesi

Yol bağlantısı gerekli bir yapı:

- bağlantısızken yükseltme başlatamayabilir,
- yükseltme sırasında bağlantı kesilirse süreç yavaşlayabilir,
- tamamlandığında düşük verimle çalışabilir.

---

## 56. AI Çağ Atlarken Saldırıya Uğrarsa

AI:

- tehdidin büyüklüğünü değerlendirir,
- çağ atlamayı koruyabilir,
- gerekli durumda süreci iptal etmeyip savunma üretir,
- ağır tehditte yeni yatırımı durdurabilir.

---

# BÖLÜM M — TEST PLANI

## 57. İlerleme Test Senaryoları

### Test 1 — Normal ekonomik ilerleme

- Oyuncu saldırıya uğramadan gelişir.
- Her çağın hedef süresi ölçülür.
- Boşta bekleme olup olmadığı gözlenir.

### Test 2 — Erken askerî baskı

- AI erken saldırır.
- Oyuncunun çağ atlamayı geciktirip geciktirmediği ölçülür.
- Geri dönüş imkânı test edilir.

### Test 3 — Hızlı çağ atlama

- Oyuncu minimum orduyla gelişmeye çalışır.
- Stratejinin risk ve ödülü değerlendirilir.

### Test 4 — Çağ atlamadan saldırı

- Oyuncu ilk çağda büyük ordu kurar.
- Erken saldırının aşırı güçlü olup olmadığı test edilir.

### Test 5 — Yol kesintisi

- Çağ atlama öncesi veya sırasında lojistik bağlantı kesilir.
- Sistem geri bildirimi ve sonuçları doğrulanır.

### Test 6 — AI geride kalır

- AI bir dış kaynak alanını kaybeder.
- Ekonomik toparlanma ve çağ planı test edilir.

### Test 7 — Geç oyun çıkmazı

- Her iki taraf da güçlü savunmaya kapanır.
- Zafer koşullarının maçı bitirip bitirmediği test edilir.

---

## 58. Telemetri

İzlenecek ana değerler:

- Kasaba seviyesine ortalama geçiş süresi
- Krallık seviyesine ortalama geçiş süresi
- Çağ atlama başladığında ordu büyüklüğü
- Çağ atlama sırasında alınan hasar
- İlk yapı yükseltme zamanı
- Her çağda geçirilen süre
- Çağ atlamadan önceki kaynak stoku
- Oyuncu ile AI arasındaki çağ farkı
- Maçın hangi çağda bittiği
- En sık kullanılan yapı yükseltmeleri
- Hiç kullanılmayan açılımlar

---

# BÖLÜM N — AÇIK SORULAR VE KARARLAR

## 59. Açık Tasarım Soruları

### Çağ atlama

- Çağ atlama sırasında merkez işçi üretmeye devam edecek mi?
- Çağ atlama iptal edilebilir mi?
- İptalde kaynak iadesi olacak mı?
- Bölgesel koşul zorunlu mu olacak?

### Yapı yükseltme

- Her yapı seviyesini tek tek yükseltmek fazla mikro yönetim yaratır mı?
- Aynı tür yapılara toplu yükseltme seçeneği olacak mı?
- Yükseltme sırasında yapı tamamen kapanacak mı?
- Eski seviyedeki birlikler otomatik gelişecek mi?

### Birlik ilerlemesi

- Birlikler doğrudan yeni modelle mi üretilecek?
- Mevcut birlikler ücretle yükseltilebilecek mi?
- Düşük çağ birimleri geç oyunda hâlâ kullanılabilir olacak mı?
- Seçkin birimler nüfus maliyeti bakımından daha pahalı mı olacak?

### Tempo

- İlk çağ ne kadar sürmeli?
- Kasaba seviyesi maçın yüzde kaçını kapsamalı?
- Krallık seviyesine ulaşmadan askerî zafer mümkün olmalı mı?
- Çağ farkı ne kadar büyük avantaj sağlamalı?

### Görsel sunum

- Yapı modeli anlık mı değişmeli, inşaat animasyonuyla mı dönüşmeli?
- Takım renkleri üç model seviyesinde nasıl korunmalı?
- Çağ atlama dünya genelinde mi duyurulmalı?
- AI çağ seviyesi fog of war arkasında gizli mi kalmalı?

---

## 60. Şimdilik Alınmış Kararlar

- Oyunda üç gelişim seviyesi bulunacaktır.
- Gelişim seviyeleri Yerleşim, Kasaba ve Krallık olarak adlandırılacaktır.
- Çağ atlama yalnızca kaynak ödeme işleminden oluşmayacaktır.
- Çağ atlama için ekonomik ve yapısal koşullar bulunacaktır.
- Bölgesel koşullar ilk vertical slice için sınırlı tutulacaktır.
- Çağ atlama anlık olmayacaktır.
- Yapılar çağ atlandığında otomatik olarak tamamen yükselmeyecektir.
- Yapı yükseltmeleri tek tek oyuncu kararıyla yapılacaktır.
- Her yapı üç seviyeye sahip olmak zorunda değildir.
- Quaternius modellerindeki üç görsel aşama ana yapılarda doğrudan kullanılacaktır.
- Kasaba seviyesi maçın en uzun ve en yoğun aşaması olacaktır.
- Krallık seviyesi maçı bitirmeye yönelten sistemler açacaktır.
- AI sabit zamana göre değil, durum değerlendirmesine göre çağ atlamaya çalışacaktır.
- Düşük çağ birimleri geç oyunda tamamen işlevsiz hale gelmemelidir.
- Vertical slice içinde iki çağ atlama ve en az üç yapı yükseltmesi bulunacaktır.

---

## 61. Diğer Dokümanlarla Bağlantılar

- `03_ECONOMY_AND_RESOURCES.md`
  - çağ maliyetleri,
  - kaynak rolleri,
  - işçi ve gelir sistemi.

- `04_BUILDINGS_AND_SETTLEMENT.md`
  - bina listesi,
  - yükseltme işlevleri,
  - yapı seviye detayları.

- `05_TERRITORY_LOGISTICS_AND_ROADS.md`
  - karakol gereksinimleri,
  - yol seviyeleri,
  - bölgesel ilerleme.

- `06_UNITS_AND_COMBAT.md`
  - çağlara göre birlik açılımı,
  - mevcut birliklerin gelişimi.

- `07_ENEMY_AI_DESIGN_v0.2.md`
  - AI çağ atlama kararları,
  - AI ilerleme profilleri.

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - geç oyun baskısı,
  - çağ farkının zorluk üzerindeki etkisi.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - üç seviyeli model eşleştirmesi,
  - çağ geçişi görsel sunumu.

- `12_BALANCE_AND_GAME_DATA.md`
  - çağ maliyetleri,
  - süreler,
  - yükseltme değerleri.

---

## 62. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Üç gelişim seviyesinin kimliği nettir.
- [ ] Her seviyenin oyuncuya sunduğu yeni kararlar tanımlanmıştır.
- [ ] Çağ atlama koşulları üst düzeyde onaylanmıştır.
- [ ] Çağ atlamanın fırsat maliyeti yeterlidir.
- [ ] Yapıların üç görsel seviyesi oynanışla eşleştirilmiştir.
- [ ] Kasaba seviyesinin maçın ana çatışma aşaması olduğu kabul edilmiştir.
- [ ] Krallık seviyesinin maçı bitirmeye yönelttiği kabul edilmiştir.
- [ ] AI ilerleme yaklaşımı onaylanmıştır.
- [ ] Kartopu ve geri dönüş yaklaşımı kabul edilmiştir.
- [ ] Vertical slice ilerleme kapsamı gerçekçi bulunmuştur.
- [ ] Açık sorular sonraki dokümanlara aktarılmıştır.

---

## 63. Kontrol Listesi

### Maç akışı

- [ ] Maç aşamaları tanımlandı.
- [ ] Hedef zaman çizelgesi oluşturuldu.
- [ ] Erken oyun eşikleri tanımlandı.
- [ ] Orta oyun eşikleri tanımlandı.
- [ ] Geç oyun eşikleri tanımlandı.
- [ ] Zafer baskısı tanımlandı.

### Gelişim seviyeleri

- [ ] Yerleşim seviyesi tanımlandı.
- [ ] Kasaba seviyesi tanımlandı.
- [ ] Krallık seviyesi tanımlandı.
- [ ] Her seviyenin ana sorusu belirlendi.
- [ ] Yapı açılımları taslaklandı.
- [ ] Birlik açılımları taslaklandı.
- [ ] Lojistik açılımları taslaklandı.

### Çağ atlama

- [ ] Ekonomik koşullar tanımlandı.
- [ ] Yapısal koşullar tanımlandı.
- [ ] Bölgesel koşullar değerlendirildi.
- [ ] Çağ atlama süreci tanımlandı.
- [ ] Fırsat maliyeti tanımlandı.
- [ ] UI geri bildirimi tanımlandı.
- [ ] İptal ve yıkım edge case'leri listelendi.

### Yapı gelişimi

- [ ] Üç seviyeli yapılar belirlendi.
- [ ] Tek veya iki seviyeli yapı yaklaşımı tanımlandı.
- [ ] Yükseltme kararları tanımlandı.
- [ ] Yükseltme süreci tanımlandı.
- [ ] Toplu yükseltme açık soru olarak kaydedildi.

### AI ve test

- [ ] AI çağ atlama mantığı tanımlandı.
- [ ] AI tepki davranışları tanımlandı.
- [ ] AI hile sınırları belirlendi.
- [ ] Test senaryoları oluşturuldu.
- [ ] Telemetri değerleri listelendi.

---

## 64. Revizyon Notları

### Sürüm 0.1

- Maçın beş aşamalı genel akışı oluşturuldu.
- Yerleşim, Kasaba ve Krallık seviyeleri detaylandırıldı.
- Çağ atlama koşulları ve fırsat maliyeti tanımlandı.
- Yapıların üç seviyeli gelişim yaklaşımı oluşturuldu.
- Yapı ve birlik açılım tabloları eklendi.
- Kartopu etkisi ve geriden gelme yöntemleri tanımlandı.
- AI ilerleme ve tepki yaklaşımı eklendi.
- Vertical slice ve teknik prototip kapsamları ayrıldı.
- Test senaryoları ve telemetri başlıkları oluşturuldu.

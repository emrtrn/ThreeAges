# 05 — Territory, Logistics and Roads

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Bölge Kontrolü, Lojistik ve Yol Sistemi  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `03_ECONOMY_AND_RESOURCES.md`  
> - `04_BUILDINGS_AND_SETTLEMENT.md`

---

## 1. Dokümanın Amacı

Bu doküman oyunun ana ayırt edici sistemi olan bölge kontrolü, yol ağı ve lojistik bağlantı yapısını tanımlar.

Belge şu sorulara cevap verir:

- Oyuncu hangi alanlarda yapı kurabilir?
- Kontrol alanı nasıl oluşur ve nasıl genişler?
- Karakollar ne işe yarar?
- Yollar ekonomik üretimi nasıl etkiler?
- Yapılar lojistik ağa nasıl bağlanır?
- Yol kesilmesi ne sonuç doğurur?
- Düşman bölgesinde hangi eylemler yapılabilir?
- Stratejik bölgeler nasıl ele geçirilir?
- Oyuncu genişleme, güvenlik ve yol uzunluğu arasında nasıl seçim yapar?
- AI yol ve karakol planlamasını nasıl yapar?
- Sistem teknik olarak nasıl temsil edilmelidir?
- Vertical slice için hangi özellikler zorunludur?

Bu doküman, oyunu klasik üs kurma RTS yapısından ayıran ana tasarım katmanını içerir. Bu nedenle burada alınan kararlar ekonomi, bina, AI, harita, savaş ve kullanıcı arayüzü belgelerini doğrudan etkiler.

---

## 2. Sistemin Tasarım Hedefi

Bölge ve lojistik sistemi oyuncuya şu hissi vermelidir:

> “Krallığım yalnızca binalardan oluşmuyor; yollar, karakollar ve güvenli bağlantılarla ayakta duran bir ağ.”

Sistem:

- harita kontrolünü görünür hale getirmeli,
- yapı yerleştirmeyi sınırlamalı,
- yolları stratejik hedef yapmalı,
- saldırıya alternatif hedefler sunmalı,
- ekonomik büyümeyi bölgesel riskle bağlamalı,
- ağır simülasyon olmadan lojistik hissi vermeli,
- oyuncuya açık ve anlaşılır geri bildirim sunmalıdır.

---

## 3. Temel Tasarım İlkeleri

### 3.1 Yapı kurmak için alan kontrolü gerekir

Oyuncu yalnızca kendi kontrol alanı içinde yapı kurabilir.

İstisnalar:

- karakol inşaatı,
- geçici keşif işaretleri,
- bazı özel görev yapıları.

### 3.2 Genişleme karakollarla yapılır

Merkez binası başlangıç alanını oluşturur.

Yeni bölgelere açılmak için:

- alan keşfedilir,
- işçi veya asker gönderilir,
- karakol kurulur,
- karakol merkeze bağlanır,
- yeni yapı alanı açılır.

### 3.3 Yol ağı ekonomik omurgadır

Yol:

- üretim yapısını depoya bağlar,
- karakolları merkeze bağlar,
- alternatif rotalar oluşturur,
- birim hareketini iyileştirebilir,
- düşman saldırıları için hedef olur.

### 3.4 Lojistik bağlantı ağır taşıma simülasyonu değildir

İlk vertical slice içinde:

- bireysel taşıma arabaları zorunlu değildir,
- yol ağı bağlantı grafiği olarak çalışır,
- kaynak üretimi yerel tampon ve global stok üzerinden işler,
- bağlantı kesilmesi üretimi hemen değil, kademeli biçimde etkiler.

### 3.5 Kontrol alanı tek başına yeterli değildir

Bir yapı kontrol alanında olsa bile:

- yol bağlantısı yoksa,
- aktif depo erişimi yoksa,
- karakol merkeze bağlı değilse

tam verimle çalışmayabilir.

### 3.6 Yedek bağlantı stratejik değer taşır

Oyuncu tek bir kısa yol veya daha uzun güvenli alternatif arasında seçim yapabilmelidir.

---

# BÖLÜM A — BÖLGE KONTROLÜ

## 4. Kontrol Alanı Nedir?

Kontrol alanı, oyuncunun yapı kurabildiği ve yerleşim etkisini sürdürebildiği harita bölümüdür.

Kontrol alanı şu kaynaklardan oluşur:

- Merkez Binası
- Karakollar
- İsteğe bağlı yönetim yapıları
- Gelecekte özel bölgesel yapılar

Kontrol alanı:

- yapı yerleştirmeyi belirler,
- sahiplik görselleştirmesi sağlar,
- AI planlamasında alan değerini etkiler,
- düşman genişlemesini sınırlar,
- bölgesel zafer sistemine bağlanabilir.

---

## 5. Kontrol Alanı Kaynakları

### 5.1 Merkez Binası

- Başlangıçta en büyük ve en güvenli alanı oluşturur.
- Alanı yol bağlantısına bağlı olmadan aktiftir.
- Yıkılması, merkez bölgesinde büyük kontrol kaybı yaratır.
- Çağ yükseldikçe alanı büyüyebilir.

### 5.2 Karakol

- Yeni bölge açmanın ana aracıdır.
- Kontrol alanı merkezden küçüktür.
- Yol ağına bağlanmadan tam aktif olmayabilir.
- Yükseltildikçe alanı, görüşü ve dayanıklılığı artar.

### 5.3 Özel yapılar

İleride:

- kale,
- yönetim kulesi,
- bölgesel merkez

kontrol alanı oluşturabilir.

Vertical slice için Merkez + Karakol yeterlidir.

---

## 6. Önerilen Kontrol Alanı Modeli

Üç temel model vardır.

### Seçenek A — Dairesel alan

Her merkez veya karakol çevresinde yarıçap oluşturur.

Avantajları:

- kolay anlaşılır,
- kolay görselleştirilir,
- teknik olarak basit.

Dezavantajları:

- arazi şekline uymayabilir,
- keskin yol ve sınır davranışı üretmez.

### Seçenek B — Grid hücreleri

Kontrol alanı harita grid hücreleri üzerinden yayılır.

Avantajları:

- yapı sistemiyle uyumlu,
- sınırlar nettir,
- stratejik hücreler kolay hesaplanır.

Dezavantajları:

- daha yapay görünebilir,
- büyük gridlerde görsel karmaşa yaratabilir.

### Seçenek C — Bağlantı ve etki alanı hibriti

Merkez ve karakollar belirli yarıçap üretir; alan grid hücrelerinde tutulur.

Avantajları:

- teknik ve görsel denge,
- yapı snap sistemiyle uyum,
- sınır çakışmalarını çözme kolaylığı.

**Önerilen karar:**  
Vertical slice için Seçenek C kullanılmalıdır.

---

## 7. Kontrol Alanı Üretimi

Önerilen süreç:

```text
Merkez veya karakol aktif
→ Etki yarıçapı hesaplanır
→ Uygun grid hücreleri oyuncuya atanır
→ Arazi engelleri kontrol edilir
→ Sonuç görselleştirilir
```

Arazi engelleri ilk vertical slice içinde alanı tamamen kesmek zorunda değildir.

Ancak:

- nehir,
- uçurum,
- harita dışı alan

kontrol alanı görselleştirmesinde sınır olarak kullanılabilir.

---

## 8. Alanların Üst Üste Binmesi

Aynı oyuncunun kontrol alanları üst üste binebilir.

Faydaları:

- yedek kontrol,
- karakol kaybında tamamen kopmayan yerleşim,
- daha güvenli iç bölgeler.

İki rakibin alanları üst üste geldiğinde üç seçenek vardır.

### Seçenek A — Çakışma yok

Yeni alan rakip kontrolüne giremez.

### Seçenek B — Tartışmalı alan

İki etki eşitse alan nötr veya tartışmalı olur.

### Seçenek C — Güçlü etki kazanır

Daha yüksek kontrol gücü alanı ele geçirir.

**Önerilen vertical slice kararı:**  
Kontrol alanları düşman alanı içine doğrudan yayılmamalıdır. Düşman karakolu veya merkez yok edilmeden alan sahipliği değişmemelidir.

Bu yaklaşım daha okunabilir ve daha az dalgalıdır.

---

## 9. Kontrol Alanı Gücü

İlk vertical slice için sürekli “kontrol puanı” hesabı önerilmez.

Basit sahiplik durumu:

```text
Friendly
Enemy
Neutral
ContestedObjective
```

Stratejik hedef alanları ayrı ele geçirme sistemi kullanabilir.

---

## 10. Kontrol Alanı Görselleştirmesi

Oyuncu normal oynanışta sürekli kalın renkli sınırlar görmek zorunda kalmamalıdır.

Önerilen görünüm:

- yapı yerleştirirken güçlü vurgulama,
- karakol seçildiğinde yarıçap,
- lojistik görünümünde sınırlar,
- normal görünümde hafif zemin tonu veya ince sınır.

Takım renkleri:

- oyuncu için birincil renk,
- AI için karşıt renk,
- nötr alan için soluk gri,
- tartışmalı hedef için nötr vurgu.

---

# BÖLÜM B — KARAKOL SİSTEMİ

## 11. Karakolun Ana Rolü

Karakol oyunun en önemli stratejik yapılarından biridir.

Görevleri:

- kontrol alanı oluşturmak,
- ileri yapı kurulumunu açmak,
- görüş sağlamak,
- lojistik hattı sürdürmek,
- sınır savunmasını desteklemek,
- stratejik bölgeyi tutmak.

Karakol tek başına güçlü bir kale olmamalıdır.

---

## 12. Karakol Kurma Akışı

```text
Bölgeyi keşfet
→ Bölge değerini değerlendir
→ İşçi ve gerekirse asker gönder
→ Karakol önizlemesini yerleştir
→ Merkez bağlantısını doğrula
→ Karakolu inşa et
→ Kontrol alanı aç
→ Yol ve yapılarla bölgeyi geliştir
```

---

## 13. Karakol Yerleştirme Koşulları

Önerilen koşullar:

- keşfedilmiş alan,
- geçerli düz zemin,
- düşman merkezinden minimum mesafe,
- başka dost karakoldan minimum mesafe,
- mevcut kontrol alanının sınırına yakınlık veya bağlantı menzili,
- yeterli kaynak,
- inşaat işçisi erişimi.

Karakol, normal yapılardan farklı olarak kontrol alanının hemen dışında kurulabilir.

---

## 14. Karakol Bağlantı Kuralı

İki ana seçenek vardır.

### Seçenek A — Yol bağlantısı tamamlanınca aktif

- Karakol inşa edilebilir.
- Yol merkeze bağlanmadan alan üretmez.

### Seçenek B — Sınırlı alan hemen, tam alan bağlantıyla

- Karakol tamamlandığında küçük alan üretir.
- Merkez bağlantısı kurulunca tam alan açılır.

**Önerilen karar:**  
Seçenek B.

Bu yaklaşım:

- oyuncunun yeni bölgede yol yapabilmesini sağlar,
- bağlantı olmadan karakolu tamamen işlevsiz bırakmaz,
- lojistik bağlantıyı yine önemli tutar.

---

## 15. Karakol Seviyeleri

### Karakol I

- küçük kontrol alanı,
- düşük görüş,
- düşük sağlık,
- sınırlı lojistik düğüm.

### Karakol II

- orta kontrol alanı,
- daha yüksek görüş,
- küçük savunma yeteneği,
- daha yüksek bağlantı dayanıklılığı.

### Karakol III

- geniş kontrol alanı,
- güçlü görüş,
- yüksek sağlık,
- ileri savunma,
- stratejik bölge tutma bonusu değerlendirilebilir.

---

## 16. Karakol Minimum Mesafesi

Karakol zincirlerinin aşırı sık kurulması önlenmelidir.

Önerilen kural:

- her yeni karakol başka dost karakoldan belirli minimum uzaklıkta olmalıdır,
- merkez binası daha esnek olabilir,
- stratejik nokta çevresinde özel istisna uygulanabilir.

Amaç:

- karakol spam'ini azaltmak,
- yol uzunluğunu anlamlı kılmak,
- her karakolu gerçek yatırım haline getirmek.

---

## 17. Karakol Kaybı

Karakol yıkıldığında:

- kontrol alanı kapanır,
- bağlı yapılar `Kontrol Dışı` olur,
- yol ağı fiziksel olarak kalır,
- üretim ve yükseltmeler sınırlanır,
- alternatif kontrol alanı varsa yapı aktif kalır,
- oyuncu karakolu yeniden kurabilir.

Karakol kaybı bölgedeki tüm binaları anında yok etmemelidir.

---

## 18. Karakol Ele Geçirme

İlk vertical slice için karakol ele geçirme önerilmez.

Neden:

- sahiplik geçişi,
- çalışan işçiler,
- yol bağlantıları,
- bina sahipliği

karmaşıklığını artırır.

İlk sürümde:

- karakol yok edilir,
- alan nötrleşir,
- rakip yeni karakol kurar.

---

# BÖLÜM C — YOL SİSTEMİ

## 19. Yolun Temel Rolü

Yol ağı:

- üretim yapısını depoya bağlar,
- depoyu merkeze bağlar,
- karakolu ana yerleşime bağlar,
- alternatif lojistik rota oluşturur,
- birlik hareketini hızlandırabilir,
- düşmanın hedefleyebileceği altyapı oluşturur.

---

## 20. Yol Yerleştirme Akışı

```text
Yol aracını seç
→ Başlangıç düğümünü belirle
→ Rotayı çiz
→ Geçerli hücreleri önizle
→ Maliyeti göster
→ Onayla
→ Yol segmentlerini oluştur
→ Bağlantı grafiğini güncelle
```

---

## 21. Yol Grid'i

Yol sistemi yapı grid'inden daha küçük hücreler kullanabilir.

Önerilen yaklaşım:

- ortogonal veya 8 yönlü bağlantı,
- yumuşatılmış görsel spline,
- teknik olarak hücre tabanlı ağ,
- görsel model segmentleri otomatik seçilir.

Bağlantı türleri:

- düz,
- dönüş,
- T kavşağı,
- dört yol,
- son parça.

---

## 22. Yol Çizim Biçimi

İki yaklaşım mümkündür.

### Seçenek A — Hücre hücre yerleştirme

Avantajları:

- kesin kontrol,
- kolay hata ayıklama.

Dezavantajları:

- yavaş kullanım,
- fazla tıklama.

### Seçenek B — Sürükleyerek rota çizme

Avantajları:

- hızlı,
- oyuncu dostu.

Dezavantajları:

- rota çözümleme gerekir.

**Önerilen karar:**  
Oyuncu başlangıç ve bitiş noktası seçer; sistem geçerli en kısa rotayı önizler. Oyuncu gerekirse ara kontrol noktaları ekler.

---

## 23. Yol Geçerlilik Kuralları

Yol:

- harita sınırları içinde,
- aşırı eğimsiz,
- su veya geçilemez alan dışında,
- yapı temelleriyle çakışmadan,
- kapı veya giriş noktalarına bağlanarak

yerleştirilmelidir.

Yol bazı küçük dekoratif öğeleri kaldırabilir veya yok sayabilir.

---

## 24. Yol Maliyeti

Yol maliyeti segment uzunluğuna bağlıdır.

Önerilen ana kaynak:

- Odun

Gelişmiş yollar için:

- Odun + Taş

Amaç:

- uzak genişlemenin gerçek ekonomik maliyet yaratması,
- kısa yol ile güvenli yol arasında karar oluşturması.

---

## 25. Yol İnşası

İki seçenek vardır.

### Seçenek A — Anında oluşum

- düşük üretim maliyeti,
- hızlı prototip.

### Seçenek B — İşçilerle inşaat

- daha tutarlı dünya,
- saldırılabilir genişleme,
- ek geliştirme maliyeti.

**Önerilen vertical slice yaklaşımı:**  
Yol yerleştirmesi kaynak ödemesi sonrası kısa yapım süresi kullanabilir; işçi zorunluluğu ilk prototipte ertelenebilir.

Tam vertical slice içinde işçiyle yol yapımı değerlendirilebilir.

---

## 26. Yol Seviyeleri

### Yol I — Toprak Yol

- temel lojistik bağlantı,
- düşük maliyet,
- düşük dayanıklılık,
- küçük hareket bonusu veya bonus yok.

### Yol II — Güçlendirilmiş Yol

- daha yüksek dayanıklılık,
- birim hareket bonusu,
- gelişmiş lojistik statüsü.

### Yol III — Taş Yol

- yüksek maliyet,
- yüksek dayanıklılık,
- en yüksek hareket bonusu,
- Krallık aşamasında kritik hatlar.

İlk vertical slice için Yol I ve Yol II yeterli olabilir.

---

## 27. Yol Yükseltme

Oyuncu:

- tek segmenti,
- seçili yol hattını,
- iki düğüm arasındaki rotayı

yükseltebilir.

Toplu yol yükseltme aracı mikro yönetimi azaltmalıdır.

---

## 28. Yol Sağlığı

Yolların her segment için sağlık sistemi olması teknik ve UI yükü yaratır.

Üç seçenek:

### Seçenek A — Yol segmentleri saldırılamaz

Yol kesme, karakol veya depo yıkımıyla yapılır.

### Seçenek B — Yollar saldırılabilir

Her segment sağlık taşır.

### Seçenek C — Kritik yol düğümleri saldırılabilir

Yolun tamamı değil, köprü, kavşak veya kontrol noktaları hedeflenir.

**Önerilen vertical slice kararı:**  
İlk sürümde yollar doğrudan saldırılabilir olmasın. Lojistik kesintisi:

- depo yıkımı,
- karakol yıkımı,
- kritik yol düğümü,
- düşman bölge kontrolü

üzerinden sağlansın.

Bu karar pathfinding, hedefleme ve mikro yönetimi önemli ölçüde sadeleştirir.

---

## 29. Yol Üzerinde Düşman Varlığı

Yol fiziksel olarak yok edilmeden geçici kesinti yaratılabilir.

Önerilen mekanik:

- düşman birliği kritik yol düğümü yakınında belirli süre kalırsa rota `Tehdit Altında` olur,
- üretim hemen durmaz,
- birim hareket bonusu iptal olabilir,
- lojistik aktarımı yavaşlayabilir,
- oyuncuya uyarı gösterilir.

İlk vertical slice için bu mekanik opsiyoneldir.

---

## 30. Köprü ve Geçişler

Köprüler harita üzerinde sabit olabilir.

Görevleri:

- doğal darboğaz oluşturmak,
- yol ağını belirli rotalara yönlendirmek,
- stratejik savaş alanı yaratmak.

İlk vertical slice için:

- oyuncunun serbest köprü kurması önerilmez,
- 1–2 sabit geçiş noktası yeterlidir.

---

# BÖLÜM D — LOJİSTİK AĞ

## 31. Lojistik Ağ Düğümleri

Ağın ana düğümleri:

- Merkez Binası
- Depo
- Karakol
- Üretim Yapısı
- Askerî Üretim Yapısı
- Pazar
- Stratejik Nokta

Her düğümün rolü farklıdır.

---

## 32. Ana Ağ ve Yerel Ağ

### 32.1 Ana Ağ

Merkez binasına bağlı yol sistemi.

Özellikleri:

- global stok erişimi,
- tam lojistik durumu,
- çağ ve üretim desteği.

### 32.2 Yerel Ağ

Bir depo veya karakol çevresinde bulunan fakat merkeze tam bağlanmamış ağ.

Özellikleri:

- sınırlı yerel üretim,
- yerel tampon kullanımı,
- tam global stok erişimi yok,
- düşük veya sınırlı işlev.

İlk vertical slice içinde sistemi sade tutmak için yerel ağ yalnızca geçici bağlantısız durum olarak kullanılabilir.

---

## 33. Bağlantı Kontrolü

Bir yapı şu sorularla değerlendirilir:

1. En yakın yol girişine bağlı mı?
2. Yol üzerinden aktif depoya ulaşabiliyor mu?
3. Depo merkez ağına bağlı mı?
4. Yol veya düğüm kontrol altında mı?
5. Yapı kontrol alanı içinde mi?

Tüm koşullar sağlanıyorsa yapı tam bağlıdır.

---

## 34. Bağlantı Durumları

### Tam Bağlı

- kontrol alanında,
- yola bağlı,
- aktif depoya bağlı,
- ana ağa bağlı.

### Kısmi Bağlı

- yerel depoya bağlı,
- merkez bağlantısı zayıf veya yok.

### Bağlantısız

- yol erişimi yok,
- yalnızca yerel tampon.

### Kontrol Dışı

- fiziksel yol var,
- bölgesel sahiplik yok,
- üretim veya kullanım durur.

### Bloke

- rota teknik olarak var,
- kritik düğüm devre dışı.

---

## 35. Alternatif Rotalar

Aynı yapı birden fazla depoya bağlı olabilir.

Sistem:

- aktif ve geçerli rotaları bulur,
- en kısa veya öncelikli rotayı kullanır,
- ana rota kesilirse alternatif rotaya geçer,
- oyuncuya hangi rotanın aktif olduğunu gösterebilir.

Alternatif rota oluşturmak oyuncunun bilinçli savunma yatırımı olmalıdır.

---

## 36. Lojistik Dayanıklılığı

Önerilen üst seviye ölçüm:

```text
Lojistik Dayanıklılığı
= Aktif bağımsız rota sayısı
+ Korunan depo sayısı
+ Karakol seviye katkısı
```

Bu değeri oyuncuya doğrudan sayı olarak göstermek zorunlu değildir.

UI şu ifadeleri kullanabilir:

- Tek bağlantı
- Yedek bağlantı mevcut
- Güçlü ağ
- Kritik kesinti riski

---

## 37. Yerel Tamponla İlişki

Bağlantı kesildiğinde:

```text
Üretim devam eder
→ Yerel tampon dolar
→ Tampon dolunca üretim durur
```

Bağlantı geri geldiğinde:

```text
Yerel stok aktarılır
→ Global stok artar
→ Üretim normale döner
```

Bu davranış `03_ECONOMY_AND_RESOURCES.md` ile uyumludur.

---

## 38. Askerî Üretim ve Lojistik

Askerî yapılar da yol bağlantısından etkilenebilir.

Önerilen yaklaşım:

- yol bağlantısı yoksa üretim tamamen durmaz,
- üretim süresi uzar,
- gelişmiş birlikler üretilemez veya kaynak aktarımı kısıtlanır.

Ancak ilk vertical slice içinde:

- askerî yapılar kontrol alanında ve yola bağlı olmalıdır,
- bağlantı kesilirse aktif kuyruk tamamlanabilir,
- yeni kuyruk başlatılamayabilir.

---

# BÖLÜM E — STRATEJİK BÖLGELER

## 39. Stratejik Bölge Nedir?

Stratejik bölgeler haritada ekonomik kaynak dışında değer taşıyan alanlardır.

Örnekler:

- köprü geçidi,
- yol kavşağı,
- yüksek görüş noktası,
- merkezi meydan,
- kutsal alan,
- eski gözetleme kulesi,
- ticaret geçidi.

---

## 40. Stratejik Bölge İşlevleri

Bir stratejik bölge:

- görüş bonusu,
- küçük Refah bonusu,
- yol verim bonusu,
- bölgesel zafer puanı,
- çevre kontrol avantajı,
- kaynak erişimi

sağlayabilir.

İlk vertical slice için bölgelerin ana rolü bölgesel zafer olmalıdır.

---

## 41. Ele Geçirme Sistemi

Önerilen akış:

```text
Bölgeye birlik gönder
→ Düşman birliklerini temizle
→ Dost birlikleri alan içinde tut
→ Ele geçirme çubuğu ilerler
→ Bölge sahipliği değişir
```

Ele geçirme sırasında:

- işçiler sayılmayabilir veya düşük katkı sağlayabilir,
- askerî birimler ana etkiyi üretir,
- düşman varlığı ilerlemeyi durdurur,
- iki taraf varsa bölge tartışmalı olur.

---

## 42. Stratejik Bölge ve Karakol İlişkisi

İki seçenek:

### Seçenek A — Karakol gerekli

Bölgeyi kalıcı kontrol etmek için yakına karakol kurulmalıdır.

### Seçenek B — Askerî tutuş yeterli

Birlikler kaldığı sürece sahiplik korunur.

**Önerilen karar:**  
Ele geçirme birliklerle yapılır; kalıcı ve güvenli kullanım için karakol veya kontrol alanı gerekir.

Bu yaklaşım:

- savaş ile yerleşimi bağlar,
- sadece birlik bırakma stratejisini sınırlar,
- karakolların önemini artırır.

---

## 43. Bölgesel Zafer

Örnek koşul:

- Haritadaki 3 stratejik noktadan 2'sini kontrol et.
- Kontrolü belirli süre koru.
- Süre boyunca en az bir nokta kaybedilirse sayaç durur veya geriler.

Kesin süre `09_VICTORY_DEFEAT_AND_DIFFICULTY.md` içinde belirlenir.

---

# BÖLÜM F — DÜŞMAN BÖLGESİNDE OYNANIŞ

## 44. Düşman Kontrol Alanına Giriş

Birimler düşman bölgesine girebilir.

Düşman alanında:

- yapı kurulamaz,
- görüş riski artar,
- düşman savunmaları etkili olabilir,
- lojistik desteği yoktur,
- geri çekilme rotası önem kazanır.

---

## 45. Düşman Bölgesinde Karakol Kurma

Rakip kontrol alanı aktifken karakol kurulamaz.

Önce:

- düşman karakolu veya merkez etkisi kaldırılmalı,
- alan nötrleşmeli,
- sonra yeni karakol kurulmalıdır.

---

## 46. Baskın Hedefleri

Düşman bölgesinde öncelikli hedefler:

- dış depo,
- karakol,
- altın madeni,
- taş ocağı,
- askerî üretim yapısı,
- stratejik yol düğümü.

Amaç doğrudan merkez saldırısından önce ekonomik baskı yaratmaktır.

---

## 47. İleri Üsler

Oyuncu düşman sınırına yakın karakol kurabilir.

Kısıtlar:

- minimum düşman merkez mesafesi,
- yüksek saldırı riski,
- uzun lojistik hat,
- yüksek maliyet.

İleri üsler güçlü fakat kırılgan olmalıdır.

---

# BÖLÜM G — HAREKET VE YOLLAR

## 48. Yol Hareket Bonusu

Yolun birlik hareketini artırması sistemi daha görünür ve değerli kılar.

Önerilen bonuslar:

- Yol I: küçük bonus
- Yol II: orta bonus
- Yol III: yüksek bonus

Ancak:

- savaş sırasında yol üzerinde yığılma oluşmamalı,
- tüm birimler aynı bonusu almak zorunda değildir,
- kuşatma birimleri yolları daha çok önemseyebilir.

---

## 49. Yol Dışı Hareket

Birimler yol dışında da hareket edebilir.

Yol:

- zorunlu rota değil,
- hız ve lojistik avantajıdır.

Bu sayede:

- savaş hareketleri özgür kalır,
- pathfinding yalnızca yol ağına kilitlenmez,
- oyuncu orman veya açık alan üzerinden baskın yapabilir.

---

## 50. Arazi ve Hareket

İleride yol bonusuna ek olarak:

- orman yavaşlatma,
- çamur,
- su,
- tepe

etkileri eklenebilir.

İlk vertical slice için:

- geçilebilir,
- yavaş,
- geçilemez

olmak üzere üç arazi sınıfı yeterlidir.

---

# BÖLÜM H — UI VE GÖRSEL GERİ BİLDİRİM

## 51. Lojistik Görünümü

Oyuncu özel bir lojistik katmanını açabilmelidir.

Bu görünümde:

- yollar vurgulanır,
- aktif bağlantılar çizilir,
- depolar ve merkez düğümleri gösterilir,
- bağlantısız yapılar kırmızı veya uyarı rengiyle işaretlenir,
- alternatif rotalar gösterilir,
- kontrol sınırları görünür olur.

---

## 52. Yol Önizleme

Yol çizilirken:

- rota,
- maliyet,
- uzunluk,
- arazi engeli,
- bağlanacağı düğümler,
- açacağı bağlantılar

gösterilmelidir.

---

## 53. Kontrol Alanı Önizleme

Karakol yerleştirilirken:

- sınırlı ilk alan,
- bağlantı sonrası tam alan,
- düşman alanıyla çakışma,
- açılacak kaynaklar,
- stratejik bölge etkisi

gösterilmelidir.

---

## 54. Bağlantı İkonları

Yapılar üzerinde:

- tam bağlı,
- bağlantısız,
- kontrol dışı,
- yerel stok dolu,
- alternatif rota aktif,
- kritik bağlantı riski

ikonları kullanılabilir.

---

## 55. Uyarılar

### Kritik

- Ana lojistik ağ kesildi
- Merkez ile tüm dış bölgeler koptu
- Bölgesel zafer sayacı düşman lehine başladı

### Önemli

- Karakol bağlantısı kayboldu
- Bir dış depo devre dışı
- 3 yapı kontrol dışında
- Altın bölgesi bağlantısız

### Bilgi

- Alternatif rota devreye girdi
- Yeni stratejik bölge ele geçirildi
- Yol yükseltmesi tamamlandı

---

# BÖLÜM I — AI DAVRANIŞI

## 56. AI Bölge Değerlendirmesi

AI her potansiyel genişleme alanına puan verebilir.

Önerilen değerlendirme:

```text
Bölge Değeri
= Kaynak değeri
+ Stratejik nokta değeri
+ Düşmana yakınlık avantajı
+ Savunulabilirlik
- Yol maliyeti
- Tehdit seviyesi
- Karakol maliyeti
```

---

## 57. AI Karakol Kararı

AI şu durumlarda karakol kurmayı düşünür:

- yeni kaynak gerekiyor,
- stratejik nokta boş,
- oyuncunun genişlemesini engellemek istiyor,
- mevcut bölge tükeniyor,
- saldırı için ileri üs gerekiyor.

---

## 58. AI Yol Planlama

AI:

- merkez ile hedef bölge arasında geçerli rota bulmalı,
- mümkünse kısa rota kullanmalı,
- yüksek tehditli düğümlerden kaçınmalı,
- kritik bölgelere alternatif rota kurabilmeli,
- gereksiz yol halkaları oluşturmamalıdır.

---

## 59. AI Lojistik Onarımı

Bağlantı kesildiğinde AI:

1. Kesinti nedenini belirler.
2. Alternatif rota arar.
3. Mümkünse yol veya depo kurar.
4. Tehdit varsa birlik gönderir.
5. Bölge değersizse geçici olarak terk eder.

---

## 60. AI Baskın Hedefleme

AI oyuncunun:

- tek rotaya bağlı dış ekonomisini,
- savunmasız deposunu,
- düşük seviyeli karakolunu,
- yüksek değerli altın bölgesini,
- stratejik geçidini

öncelikli hedef yapabilir.

---

## 61. AI Bölgesel Zafer Davranışı

AI:

- boş stratejik noktaları ele geçirir,
- sahip olduğu noktaları savunur,
- oyuncu sayaç başlattığında saldırı önceliğini artırır,
- tüm ordusunu tek noktaya körü körüne göndermemelidir.

---

# BÖLÜM J — TEKNİK TASARIM

## 62. Veri Temsili

Önerilen ana veri yapıları:

```yaml
territory_source:
  owner: player_1
  sourceType: outpost
  radius: 12
  active: true
  connectedToMainNetwork: true

road_node:
  id: node_104
  worldPosition: [x, y, z]
  owner: player_1
  connectedEdges:
    - edge_22
    - edge_23

road_edge:
  id: edge_22
  from: node_104
  to: node_105
  level: 1
  active: true
  blocked: false
```

---

## 63. Kontrol Grid'i

Her hücre şu bilgileri tutabilir:

```text
Owner
TerritorySourceId
BuildAllowed
Contested
TerrainType
StrategicZoneId
```

Kontrol grid'i yol grid'inden daha büyük hücreler kullanabilir.

---

## 64. Yol Grafiği

Yol ağı:

- düğümler,
- kenarlar,
- yapı bağlantı noktaları

üzerinden temsil edilmelidir.

Grafik işlemleri:

- bağlantı arama,
- alternatif rota,
- ağ bileşeni bulma,
- kesinti sonrası yeniden hesaplama,
- ana ağa erişim kontrolü.

---

## 65. Olay Tabanlı Güncelleme

Ağ her karede tamamen taranmamalıdır.

Yeniden hesaplama olayları:

- yol eklendi,
- yol kaldırıldı,
- depo kuruldu,
- depo yıkıldı,
- karakol aktif oldu,
- karakol yıkıldı,
- yapı bağlantısı değişti,
- stratejik düğüm bloke oldu.

---

## 66. Bölgesel Güncelleme

Kontrol alanı yalnızca şu durumlarda yeniden hesaplanmalıdır:

- kaynak yapı kuruldu,
- kaynak yapı yıkıldı,
- seviye değişti,
- sahiplik değişti.

---

## 67. Pathfinding ile Ayrım

Yol grafiği ile birim pathfinding grafiği aynı sistem olmak zorunda değildir.

Öneri:

- yol ağı ekonomik bağlantı için ayrı grafik,
- birim hareketi navmesh veya grid pathfinding kullanır,
- yol bonusu hareket maliyetini etkiler.

Bu ayrım sistemi sadeleştirir.

---

## 68. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- kontrol alanı kaynakları,
- karakol seviyeleri,
- yol segmentleri,
- yol seviyeleri,
- yol bağlantı grafiği veya yeniden üretilebilir veri,
- stratejik bölge sahipliği,
- ele geçirme ilerlemesi,
- bağlantısız yapı durumları,
- aktif alternatif rotalar.

Grafik verisi yüklemede yeniden oluşturulabilir.

---

## 69. Debug Araçları

Forge içinde geliştirme için şu debug görünümleri gereklidir:

- kontrol grid'i,
- yol düğümleri,
- yol kenarları,
- ağ bileşenleri,
- yapı bağlantı hedefi,
- aktif depo rotası,
- karakol etki alanı,
- stratejik bölge durumu,
- AI bölge puanları.

Bu araçlar özellikle AI ve ağ hatalarını bulmak için kritiktir.

---

# BÖLÜM K — EDGE CASE'LER

## 70. Karakol Tamamlanır Ama Yol Kurulamazsa

- küçük geçici kontrol alanı aktif olur,
- tam alan açılmaz,
- yapı uyarı verir,
- oyuncu alternatif yol rotası kurabilir.

---

## 71. Yol Ağı Döngü Oluşturursa

- döngü geçerlidir,
- sistem en kısa aktif rotayı seçer,
- sonsuz arama önlenir,
- alternatif rota olarak değerlendirilebilir.

---

## 72. İki Depoya Eşit Mesafe

Öncelik:

1. aktif,
2. ana ağa bağlı,
3. daha düşük rota maliyeti,
4. daha yüksek seviye,
5. en eski bağlantı.

Kesin öncelik teknik tasarımda belirlenir.

---

## 73. Karakol Yıkılır Ama Alan Başka Kaynaktan Korunursa

- yapı aktif kalır,
- kontrol alanı kaybolmaz,
- yol bağlantısı yeniden değerlendirilir.

---

## 74. Yol Görseli Var Ama Grafik Bağlantısı Yoksa

- debug uyarısı oluşturulur,
- segment yeniden bağlanmaya çalışır,
- oyuncuya sahte bağlantı gösterilmemelidir.

---

## 75. Stratejik Bölge Kontrol Alanı Dışında Ele Geçirilirse

- geçici sahiplik kazanılır,
- kalıcı bonus sınırlı olur,
- sayaç veya tam kullanım için karakol gerekir.

---

## 76. Düşman Birimi Yol Düğümünde Takılırsa

- blokaj sistemi yalnızca geçerli tehdit durumunda çalışmalıdır,
- tek bir sıkışmış birim tüm ekonomiyi sonsuza kadar kesmemelidir,
- süre ve tehdit kontrolü gerekir.

---

## 77. Harita Bölünürse

Bir köprü veya kritik geçit kapandığında:

- ağ bileşenlere ayrılır,
- dış bölgeler yerel moda geçer,
- alternatif sabit geçiş varsa yeniden rota bulunur.

---

# BÖLÜM L — TEST PLANI

## 78. Test Senaryoları

### Test 1 — İlk karakol

- Oyuncu kontrol alanı sınırına karakol kurar.
- Küçük alan açılır.
- Yol bağlanınca tam alan etkinleşir.

### Test 2 — Yol bağlantısı

- Üretim yapısı depoya bağlanır.
- Global stok artar.
- Yol kesilince yerel tampon devreye girer.

### Test 3 — Alternatif rota

- İki farklı yol kurulur.
- Ana rota devre dışı kalır.
- Sistem ikinci rotayı kullanır.

### Test 4 — Karakol kaybı

- Karakol yıkılır.
- Bölgedeki yapılar kontrol dışı olur.
- Başka kontrol kaynağı varsa aktif kalırlar.

### Test 5 — Depo kaybı

- Dış depo yok edilir.
- Yapılar başka depo arar.
- Rota bulunamazsa bağlantısız duruma geçer.

### Test 6 — Stratejik bölge

- Oyuncu bölgeyi ele geçirir.
- Karakol kurmadan geçici sahiplik kazanır.
- Karakol sonrası kalıcı kullanım açılır.

### Test 7 — AI genişleme

- AI yüksek değerli bölgeyi seçer.
- Karakol ve yol kurar.
- Kaynak yapısını bağlar.

### Test 8 — AI lojistik onarımı

- AI yolu veya deposu kaybeder.
- Alternatif çözüm üretir.
- Bölgeyi gerektiğinde terk eder.

### Test 9 — Yol döngüsü

- Halka şeklinde yol kurulur.
- Sistem geçerli en kısa rotayı bulur.
- Performans sorunu oluşmaz.

### Test 10 — Save/load

- Karmaşık yol ve karakol ağı kaydedilir.
- Yükleme sonrası aynı bağlantılar yeniden oluşur.

---

## 79. Telemetri

İzlenecek değerler:

- maç başına karakol sayısı,
- ilk karakol zamanı,
- ortalama yol uzunluğu,
- toplam yol maliyeti,
- alternatif rota kullanan yapı sayısı,
- bağlantısız kalma süresi,
- karakol kaybı sayısı,
- yeniden bağlantı süresi,
- stratejik bölge sahiplik değişimi,
- oyuncunun tek rota bağımlılığı,
- AI başarısız yol kurma sayısı,
- AI terk ettiği bölge sayısı,
- bölgesel zafer sayacı başlama zamanı.

---

# BÖLÜM M — VERTICAL SLICE KAPSAMI

## 80. Zorunlu Özellikler

- Merkez kontrol alanı
- Karakol kontrol alanı
- Karakolun sınırlı ve tam bağlantı durumu
- Grid tabanlı sahiplik
- Yapı kurma sınırı
- Yol yerleştirme
- Yol bağlantı grafiği
- Depo ve merkez düğümleri
- Üretim yapısı bağlantı kontrolü
- Yerel tamponla kesinti davranışı
- Alternatif rota desteği
- En az iki stratejik bölge
- Bölgesel zafer bağlantısı
- AI karakol kurma
- AI yol kurma
- Lojistik debug görünümü

---

## 81. Ertelenebilecek Özellikler

- Doğrudan yol segmenti hasarı
- Serbest köprü inşası
- Yol bakım maliyeti
- Taşıma arabaları
- Yol yoğunluğu
- Trafik sistemi
- Karakol ele geçirme
- Karmaşık kontrol gücü
- Diplomatik sınırlar
- Yol vergisi
- Kervan ticareti
- Mevsimsel yol bozulması
- Tam duvar-kapı entegrasyonu

---

## 82. İlk Teknik Prototip

İlk prototip şu döngüyü doğrulamalıdır:

```text
Merkez alan üretir
→ Oyuncu sınır dışına karakol kurar
→ Karakol küçük alan açar
→ Yol merkeze bağlanır
→ Karakol tam alan açar
→ Üretim yapısı yeni alana kurulur
→ Depoya bağlanır
→ Yol kesilince üretim yerel tamponla sınırlanır
```

---

# BÖLÜM N — AÇIK SORULAR VE KARARLAR

## 83. Açık Tasarım Soruları

### Kontrol alanı

- Karakolun küçük ve tam alan yarıçapları ne kadar farklı olmalı?
- Kontrol alanı nehir ve uçurum tarafından kesilmeli mi?
- Aynı oyuncunun alanları birleşince özel bonus olmalı mı?
- Düşman kontrol alanları arasında nötr tampon bulunmalı mı?

### Karakol

- Karakol yol bağlantısı kesildiğinde tam alan hemen mi küçülmeli?
- Karakol savunma ateşi hangi seviyede açılmalı?
- Karakol kurulumu mevcut alan sınırından ne kadar uzakta olabilir?
- İleri karakol için ek maliyet gerekli mi?

### Yol

- Yol yapımı işçi gerektirecek mi?
- Yol I hareket bonusu vermeli mi?
- Yol segmentleri oyuncu tarafından kaldırılabilecek mi?
- Yol yükseltmesi tek hat mı, bölge seçimiyle mi yapılmalı?

### Lojistik

- Askerî yapılar bağlantısızken tamamen durmalı mı?
- Uzun yol gelecekte verim cezası almalı mı?
- Depoların maksimum bağlantı sayısı olmalı mı?
- Alternatif rota UI'da nasıl gösterilmeli?

### Stratejik bölgeler

- İlk haritada kaç stratejik nokta bulunmalı?
- Bölge ele geçirme için minimum birlik sayısı olmalı mı?
- Ele geçirme ilerlemesi düşman gidince geriye dönmeli mi?
- Karakol kurulmadan bölgesel zafer sayacı çalışmalı mı?

---

## 84. Şimdilik Alınmış Kararlar

- Kontrol alanı hibrit yarıçap + grid modeli kullanacaktır.
- Oyuncu normal yapıları yalnızca kontrol alanında kuracaktır.
- Karakol, kontrol alanının hemen dışında kurulabilen özel yapı olacaktır.
- Karakol tamamlandığında küçük alan; ana ağa bağlandığında tam alan açacaktır.
- Düşman kontrol alanı aktifken yeni karakol kurulamayacaktır.
- Karakollar ilk vertical slice içinde ele geçirilmeyecek, yok edilecektir.
- Yol ağı ekonomik bağlantı grafiği olarak çalışacaktır.
- Yol sistemi birim pathfinding sisteminden ayrı tutulacaktır.
- Yollar ilk vertical slice içinde doğrudan saldırılabilir olmayacaktır.
- Lojistik kesintisi karakol, depo veya kritik düğüm kaybıyla oluşacaktır.
- Üretim yapıları aktif depo veya merkeze bağlı olmalıdır.
- Alternatif rota desteği bulunacaktır.
- Yol mesafesi ilk vertical slice içinde üretim cezası yaratmayacaktır.
- Yol hareket bonusu bulunabilir; kesin değerler daha sonra belirlenecektir.
- Sabit köprü ve geçişler ilk haritada kullanılacaktır.
- Stratejik bölgeler birliklerle ele geçirilecek, kalıcı kullanım için kontrol alanı gerekecektir.
- Bölgesel zafer sistemi stratejik nokta kontrolüne dayanacaktır.
- AI bölge değerini kaynak, risk, yol maliyeti ve stratejik konuma göre değerlendirecektir.
- Sistem olay tabanlı ağ güncellemeleri kullanacaktır.
- Lojistik debug görünümü vertical slice için zorunludur.

---

## 85. Diğer Dokümanlarla Bağlantılar

- `06_UNITS_AND_COMBAT.md`
  - yol hareket bonusu,
  - baskınlar,
  - karakol ve depo saldırıları,
  - stratejik bölge ele geçirme.

- `07_ENEMY_AI_DESIGN.md`
  - AI genişleme,
  - yol planlama,
  - baskın hedefleri,
  - lojistik onarım.

- `08_MAP_AND_WORLD_DESIGN.md`
  - köprüler,
  - geçişler,
  - stratejik bölgeler,
  - kontrol alanına uygun harita yapısı.

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - bölgesel zafer,
  - sayaç,
  - karakol ve merkez kaybı.

- `10_CAMERA_CONTROLS_AND_UI.md`
  - lojistik görünümü,
  - yol çizim aracı,
  - kontrol sınırı,
  - uyarılar.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - yol modelleri,
  - karakol seviyeleri,
  - takım renkleri,
  - stratejik bölge görselleri.

- `12_BALANCE_AND_GAME_DATA.md`
  - yol maliyeti,
  - karakol yarıçapı,
  - hareket bonusu,
  - ele geçirme süresi.

---

## 86. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Kontrol alanının hibrit grid modeli kabul edilmiştir.
- [ ] Merkez ve karakol etki rolleri nettir.
- [ ] Karakolun küçük ve tam alan yaklaşımı onaylanmıştır.
- [ ] Yol ağının ekonomik grafik olduğu kabul edilmiştir.
- [ ] Yol ve birim pathfinding sistemlerinin ayrılması onaylanmıştır.
- [ ] Yolların doğrudan saldırılamaması kararı kabul edilmiştir.
- [ ] Alternatif rota sistemi gerekli bulunmuştur.
- [ ] Stratejik bölge ele geçirme yaklaşımı onaylanmıştır.
- [ ] Bölgesel zafer ile karakol ilişkisi nettir.
- [ ] AI bölge ve yol planlama yaklaşımı kabul edilmiştir.
- [ ] Vertical slice kapsamı gerçekçi bulunmuştur.
- [ ] Debug araçlarının zorunlu olduğu kabul edilmiştir.

---

## 87. Kontrol Listesi

### Bölge kontrolü

- [ ] Kontrol alanı tanımlandı.
- [ ] Merkez alanı tanımlandı.
- [ ] Karakol alanı tanımlandı.
- [ ] Hibrit grid yaklaşımı seçildi.
- [ ] Alan çakışma kuralları tanımlandı.
- [ ] Kontrol alanı görselleştirmesi tanımlandı.
- [ ] Kontrol kaybı davranışı tanımlandı.

### Karakollar

- [ ] Karakol kurma akışı tanımlandı.
- [ ] Yerleştirme koşulları tanımlandı.
- [ ] Küçük ve tam alan modeli tanımlandı.
- [ ] Karakol seviyeleri tanımlandı.
- [ ] Minimum mesafe yaklaşımı tanımlandı.
- [ ] Karakol kaybı ele alındı.
- [ ] Ele geçirme ertelendi.

### Yollar

- [ ] Yol yerleştirme akışı tanımlandı.
- [ ] Yol grid'i tanımlandı.
- [ ] Yol çizim yaklaşımı tanımlandı.
- [ ] Yol maliyeti tanımlandı.
- [ ] Yol seviyeleri tanımlandı.
- [ ] Yol yükseltme yaklaşımı tanımlandı.
- [ ] Yol saldırı kararı verildi.
- [ ] Sabit köprü yaklaşımı tanımlandı.

### Lojistik

- [ ] Ağ düğümleri tanımlandı.
- [ ] Ana ağ ve yerel ağ ayrıldı.
- [ ] Bağlantı kontrolü tanımlandı.
- [ ] Bağlantı durumları tanımlandı.
- [ ] Alternatif rota sistemi tanımlandı.
- [ ] Yerel tampon ilişkisi doğrulandı.
- [ ] Askerî üretim bağlantısı değerlendirildi.

### Stratejik bölgeler

- [ ] Stratejik bölge rolü tanımlandı.
- [ ] Ele geçirme sistemi tanımlandı.
- [ ] Karakol ilişkisi tanımlandı.
- [ ] Bölgesel zafer bağlantısı kuruldu.

### AI ve teknik

- [ ] AI bölge puanlaması tanımlandı.
- [ ] AI karakol kararı tanımlandı.
- [ ] AI yol planlama tanımlandı.
- [ ] AI lojistik onarımı tanımlandı.
- [ ] Kontrol grid veri yapısı tanımlandı.
- [ ] Yol grafiği tanımlandı.
- [ ] Olay tabanlı güncelleme tanımlandı.
- [ ] Save/load gereksinimleri tanımlandı.
- [ ] Debug araçları listelendi.

### Test

- [ ] İlk karakol testi tanımlandı.
- [ ] Yol bağlantısı testi tanımlandı.
- [ ] Alternatif rota testi tanımlandı.
- [ ] Karakol kaybı testi tanımlandı.
- [ ] Stratejik bölge testi tanımlandı.
- [ ] AI genişleme testi tanımlandı.
- [ ] Save/load testi tanımlandı.
- [ ] Telemetri listelendi.

---

## 88. Revizyon Notları

### Sürüm 0.1

- Hibrit kontrol alanı modeli seçildi.
- Merkez ve karakol etki sistemi tanımlandı.
- Karakolun sınırlı ve tam bağlantı durumu oluşturuldu.
- Yol yerleştirme, seviye ve maliyet yaklaşımı tanımlandı.
- Yol ağının ekonomik grafik olarak çalışması kararlaştırıldı.
- Alternatif rota ve lojistik dayanıklılığı eklendi.
- Stratejik bölgeler ve bölgesel zafer bağlantısı oluşturuldu.
- AI genişleme, yol planlama ve lojistik onarım davranışları tanımlandı.
- Teknik veri yapısı, olay tabanlı güncelleme ve debug gereksinimleri eklendi.
- Vertical slice kapsamı, test senaryoları ve telemetri oluşturuldu.

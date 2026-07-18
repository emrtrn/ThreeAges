# 06 — Units and Combat

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Birimler ve Savaş Sistemi  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `03_ECONOMY_AND_RESOURCES.md`  
> - `04_BUILDINGS_AND_SETTLEMENT.md`  
> - `05_TERRITORY_LOGISTICS_AND_ROADS.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. "Vertical slice için zorunlu" ifadeleri tam oyun hedefini anlatır — bir özelliğin hangi üründe (A/B/C) açıldığı ya da koşullu/kapsam dışı olduğu konusunda 13 v0.2 esastır. Süvari bu belgede tanımlıdır ancak vertical slice kapsamından çıkarılmıştır (13 v0.2). Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman oyundaki birim sistemini, savaş kurallarını, birim rollerini, hedef seçimini, hareket ve pathfinding davranışını, üretim ve yükseltme ilişkilerini ve askerî çatışmanın ekonomi ile bölge kontrolüne nasıl bağlandığını tanımlar.

Belge şu sorulara cevap verir:

- Oyunda hangi birim sınıfları bulunur?
- Her birimin temel rolü nedir?
- Birimler nasıl üretilir, seçilir ve komuta edilir?
- Yakın dövüş, menzilli savaş ve kuşatma nasıl işler?
- Birimler hangi hedefleri otomatik seçer?
- Birim karşıtlıkları nasıl kurulacaktır?
- Hasar, zırh ve sağlık nasıl hesaplanacaktır?
- Yol, arazi ve kontrol alanı hareketi nasıl etkiler?
- Birimler ne zaman geri çekilir veya kovalamayı bırakır?
- Birimlerin kalabalık hareketi ve sıkışması nasıl yönetilir?
- Savaş ekonomik ve bölgesel sonuçlar nasıl üretir?
- AI taktik kararları hangi kuralları kullanır?
- Vertical slice için minimum birim kadrosu nedir?

Bu dokümandaki sayısal değerler tasarım hedefidir. Kesin maliyetler, sağlık, hız, saldırı aralıkları ve hasar katsayıları `12_BALANCE_AND_GAME_DATA.md` içinde tutulacaktır.

---

## 2. Savaş Sisteminin Tasarım Hedefi

Savaş sistemi küçük ölçekli, okunabilir ve ekonomik kararlarla bağlantılı olmalıdır.

Oyuncunun askerî deneyimi şu hissi vermelidir:

> “Doğru birlikleri doğru hedefe, doğru zamanda ve doğru rotadan göndererek rakibin ekonomisini ve bölgesel planını bozuyorum.”

Savaş sistemi:

- az sayıda birim türüyle anlamlı kararlar üretmeli,
- aşırı mikro yönetim gerektirmemeli,
- birim rollerini açık biçimde göstermeli,
- ekonomik yatırımların sonucunu hissettirmeli,
- geri çekilmeyi geçerli bir seçenek yapmalı,
- karakol, depo ve kaynak alanlarını önemli hedeflere dönüştürmeli,
- web performansını korumalıdır.

---

## 3. Temel Savaş İlkeleri

### 3.1 Az birim, net rol

İlk vertical slice içinde çok sayıda benzer asker bulunmamalıdır.

Her askerî birim:

- farklı hedefe karşı güçlü,
- başka bir durumda zayıf,
- belirgin siluet ve davranışa sahip,
- anlaşılır maliyet yapısında

olmalıdır.

### 3.2 Savaş ekonomiyle bağlıdır

Bir çatışmanın sonucu yalnızca birim kaybı olmamalıdır.

Savaş şu sonuçlardan birini üretmelidir:

- işçi kaybı,
- üretim kesintisi,
- karakol kaybı,
- depo bağlantısının kesilmesi,
- bölgesel kontrol değişimi,
- çağ atlamanın gecikmesi,
- yeni savunma yatırımı zorunluluğu.

### 3.3 Her çatışma ölümüne savaş değildir

Oyuncu:

- baskın yapabilir,
- hedefi vurup geri çekilebilir,
- stratejik noktayı kısa süre tutabilir,
- düşmanı savunmaya zorlayabilir,
- ordusunu kaybetmeden alan kazanabilir.

### 3.4 Birim kontrolü okunabilir olmalıdır

Oyuncu şu durumları kolayca anlayabilmelidir:

- birim ne yapıyor,
- kimi hedefliyor,
- neden hareket edemiyor,
- neden saldırmıyor,
- hangi hedefe karşı güçlü veya zayıf,
- ne zaman geri çekilmesi gerekiyor.

### 3.5 Savaş temposu hızlı fakat kaotik olmamalıdır

Çatışmalar:

- tek saniyede bitmemeli,
- aşırı uzun sürmemeli,
- oyuncuya geri çekilme veya destek gönderme zamanı vermelidir.

---

# BÖLÜM A — BİRİM KATEGORİLERİ

## 4. Ana Birim Kategorileri

Oyundaki birimler beş ana kategoriye ayrılır:

1. Ekonomi birimleri
2. Yakın dövüş birimleri
3. Menzilli birimler
4. Hızlı hareket / süvari birimleri
5. Kuşatma birimleri

Gelecekte:

6. Destek birimleri
7. Kahraman veya özel birimler

eklenebilir; ancak vertical slice için gerekli değildir.

---

## 5. Ekonomi Birimleri

### 5.1 İşçi

Ana görevleri:

- üretim yapılarında çalışmak,
- bina inşa etmek,
- onarım yapmak,
- yol ve karakol kurmak,
- tehdit halinde geri çekilmek.

Savaş rolü:

- çok düşük hasar,
- düşük sağlık,
- askerî birime karşı zayıf,
- yalnızca çaresiz durumda savunma.

İşçinin ana değeri ekonomik olduğu için kaybı asker kaybından farklı bir sonuç yaratmalıdır.

---

## 6. Yakın Dövüş Birimleri

### 6.1 Muhafız

Vertical slice için temel yakın dövüş birimi.

Rolü:

- ön hat oluşturmak,
- menzilli birlikleri korumak,
- hızlı birimleri durdurmak,
- karakol ve kaynak alanı savunmak.

Güçlü yönleri:

- dengeli sağlık,
- yakın dövüş dayanıklılığı,
- düşük veya orta maliyet,
- güvenilir savunma.

Zayıf yönleri:

- düşük hareket hızı,
- menzilli saldırı altında yaklaşma sorunu,
- yapı hasarı sınırlı.

### 6.2 Seviye gelişimi

- Muhafız I — temel milis veya asker
- Muhafız II — zırhlı asker
- Muhafız III — seçkin muhafız

Görsel değişim:

- daha iyi silah,
- daha belirgin zırh,
- takım rengi vurgusu,
- daha güçlü siluet.

---

## 7. Menzilli Birimler

### 7.1 Okçu

Rolü:

- yakın dövüş birliklerine uzaktan hasar vermek,
- savunma hattı arkasında destek,
- işçi ve hafif hedef baskını,
- dar geçit kontrolü.

Güçlü yönleri:

- menzil,
- güvenli konumdan hasar,
- savunma yapıları arkasında etkinlik.

Zayıf yönleri:

- düşük sağlık,
- hızlı birliklere karşı savunmasızlık,
- yakın dövüşte düşük verim,
- yanlış konumda kolay kayıp.

### 7.2 Seviye gelişimi

- Okçu I — temel menzilli birim
- Okçu II — daha iyi menzil veya isabet
- Okçu III — seçkin okçu

---

## 8. Hızlı Birimler

### 8.1 Süvari

Rolü:

- okçulara baskın,
- işçi avlama,
- hızlı keşif,
- düşman geri çekilmesini cezalandırma,
- açık arazide yan saldırı.

Güçlü yönleri:

- yüksek hareket hızı,
- hızlı hedef değiştirme,
- menzilli birimlere erişim.

Zayıf yönleri:

- yüksek maliyet,
- muhafız veya mızrak benzeri birime karşı zayıflık,
- dar alanlarda düşük verim,
- yapı hasarı sınırlı.

### 8.2 Vertical slice kapsamı

Süvari:

- ayrı bina gerektirmeden Kışla III içinde açılabilir,
- ayrı model yoksa hızlı hafif piyade ile temsil edilebilir,
- kapsam baskısı oluşursa ertelenebilir.

---

## 9. Kuşatma Birimleri

### 9.1 Koçbaşı veya Hafif Kuşatma Aracı

Rolü:

- yapılara yüksek hasar,
- kule ve karakol yıkımı,
- merkez saldırısı.

Güçlü yönleri:

- yapı bonusu,
- yüksek sağlık veya yapı direnci.

Zayıf yönleri:

- yavaş hareket,
- birimlere karşı düşük hasar,
- pahalı üretim,
- koruma gereksinimi.

### 9.2 Vertical slice kapsamı

İlk vertical slice için tek kuşatma birimi yeterlidir.

---

## 10. Destek Birimleri

Vertical slice için zorunlu değildir.

Gelecekte:

- şifacı,
- sancaktar,
- mühendis,
- keşif uzmanı

eklenebilir.

Ancak destek birimleri:

- yeni UI,
- yeni AI davranışı,
- yeni hedef önceliği,
- yeni denge maliyeti

oluşturduğu için ilk sürümde önerilmez.

---

# BÖLÜM B — ÖNERİLEN BİRİM KADROSU

## 11. Vertical Slice Birim Listesi

Önerilen tam kadro:

1. İşçi
2. Muhafız
3. Okçu
4. Süvari
5. Kuşatma Birimi

Bu kadro hem ekonomi hem savaş hem de karşıtlık sistemini test etmek için yeterlidir.

---

## 12. Daraltılmış Kadro

Kapsam azaltılırsa:

1. İşçi
2. Muhafız
3. Okçu
4. Kuşatma Birimi

Süvari daha sonra eklenebilir.

---

## 13. İlk Teknik Prototip Kadrosu

İlk teknik prototip:

1. İşçi
2. Muhafız

ile çalışabilir.

Amaç:

- seçim,
- hareket,
- hedefleme,
- hasar,
- üretim,
- ölüm

omurgasını doğrulamaktır.

---

# BÖLÜM C — BİRİM ÜRETİMİ

## 14. Üretim Akışı

```text
Üretim yapısını seç
→ Birim türünü seç
→ Kaynak ve nüfus koşullarını kontrol et
→ Birimi kuyruğa ekle
→ Üretim süresini tamamla
→ Birimi çıkış noktasında oluştur
→ Rally point'e gönder
```

---

## 15. Üretim Gereksinimleri

Bir birimin üretilebilmesi için:

- doğru yapı,
- doğru çağ seviyesi,
- yeterli kaynak,
- yeterli nüfus kapasitesi,
- aktif yol ve kontrol durumu,
- yapının üretime açık olması

gerekir.

---

## 16. Üretim Kuyruğu

Önerilen kurallar:

- her askerî yapı sınırlı kuyruk taşır,
- aynı anda tek birim üretir,
- kuyruğa eklenen birimin maliyeti hemen ödenir,
- nüfus sınırı doluysa birim üretime başlamaz veya tamamlanınca bekler.

Vertical slice için en okunabilir yaklaşım:

- nüfus sınırı doluysa yeni birim kuyruğa eklenemez.

---

## 17. Üretim İptali

- üretim başlamadan iptal: tam iade,
- üretim devam ederken iptal: kısmi iade,
- yapı yıkılırsa: düşük veya sıfır iade.

Kesin oranlar daha sonra belirlenir.

---

## 18. Rally Point

Oyuncu askerî yapıya çıkış hedefi atayabilir.

Rally point:

- zemin,
- birim,
- karakol,
- savunma alanı

olabilir.

Üretilen birlik:

- güvenli ve geçerli konuma çıkmalı,
- yapı içinde sıkışmamalı,
- doğrudan düşman içine doğmamalıdır.

---

## 19. Üretim Yapısı Bağlantısı

Askerî yapı yol veya lojistik bağlantısını kaybederse:

- aktif üretim tamamlanabilir,
- yeni üretim kuyruğu başlatılamayabilir,
- alternatif olarak üretim süresi ağır biçimde uzayabilir.

**Önerilen vertical slice kararı:**  
Bağlantı kesildiğinde mevcut üretim tamamlanır; yeni sipariş verilemez.

---

# BÖLÜM D — SEÇİM VE KOMUTLAR

## 20. Tekli Seçim

Sol tık:

- bir birimi seçer,
- birim panelini açar,
- sağlık ve durum bilgisini gösterir.

---

## 21. Kutu ile Seçim

Sürükleyerek seçim:

- kutu içindeki dost birimleri seçer,
- yapıları varsayılan olarak seçmeyebilir,
- işçi ve asker karışımını destekler.

Büyük seçimlerde UI:

- grup özeti,
- birim türü dağılımı,
- toplam sağlık durumu

gösterebilir.

---

## 22. Seçim Filtreleri

Kısayollar:

- yalnızca askerler,
- yalnızca işçiler,
- aynı tür birimler,
- ekrandaki tüm askerler,
- kontrol grupları

gelecekte eklenebilir.

Vertical slice için en az:

- tekli seçim,
- kutu seçimi,
- aynı türü çift tıkla seçme

önerilir.

---

## 23. Temel Komutlar

Birim komutları:

- Hareket
- Saldır
- Saldırı-Hareket
- Dur
- Pozisyonu Koru
- Geri Çekil / Seçili konuma hareket
- Devriye, opsiyonel
- İnşa, işçi için
- Onar, işçi için

---

## 24. Sağ Tık Bağlamsal Komut

Sağ tık hedefe göre farklı davranır:

- boş zemin → hareket,
- düşman → saldır,
- dost hasarlı yapı → onar, işçi için,
- kaynak yapısı → görevlendir, işçi için,
- stratejik bölge → hareket veya ele geçirme,
- dost birim → takip, opsiyonel.

Bağlamsal komut oyuncuya açık imleç geri bildirimi vermelidir.

---

## 25. Saldırı-Hareket

Saldırı-hareket komutu:

- birimi hedef noktaya götürür,
- yolda düşman görürse saldırır,
- tehdit ortadan kalkınca rotaya devam eder.

Bu komut RTS oynanışının temelidir ve vertical slice için önerilir.

---

## 26. Pozisyonu Koru

Birim:

- bulunduğu konumdan sınırlı mesafede hedef seçer,
- uzak düşmanı kovalamaz,
- karakol ve kaynak savunmasında kullanılır.

---

## 27. Dur Komutu

Birim:

- mevcut emri iptal eder,
- bulunduğu konumda bekler,
- stance kurallarına göre yakın tehdide tepki verebilir.

---

## 28. Komut Kuyruğu

Shift ile komut kuyruğu gelecekte değerlendirilebilir.

Vertical slice için zorunlu değildir.

Ancak:

- yol noktaları,
- çoklu baskın rotası,
- keşif

için faydalıdır.

---

# BÖLÜM E — HAREKET VE PATHFINDING

## 29. Hareket Sistemi Hedefi

Birim hareketi:

- güvenilir,
- tahmin edilebilir,
- küçük gruplarda akıcı,
- büyük gruplarda sıkışmaya dayanıklı

olmalıdır.

---

## 30. Hareket Verisi

Her birim şu temel değerlere sahiptir:

- hareket hızı,
- dönüş hızı,
- birim yarıçapı,
- durma mesafesi,
- engel kaçınma ağırlığı,
- yol bonusu,
- arazi maliyeti.

---

## 31. Yol Kullanımı

Birimler yol dışında da hareket edebilir.

Yol:

- pathfinding maliyetini düşürür,
- hareket hızını artırabilir,
- özellikle kuşatma ve işçiler için değerli olabilir.

Birim, hedefe giden yol çok uzatıyorsa yolu kullanmak zorunda değildir.

---

## 32. Grup Hareketi

Bir grup hareket emri aldığında:

- grup merkezi hedefe gider,
- birimler hedef çevresinde dağıtılır,
- herkes aynı noktaya yığılmaz,
- birim türleri temel pozisyon koruyabilir.

Önerilen basit yerleşim:

- yakın dövüş önde,
- menzilli arkada,
- kuşatma geride,
- süvari kenarlarda.

Tam formasyon editörü vertical slice için gerekli değildir.

---

## 33. Yerel Kaçınma

Birimler:

- birbirinin içinden geçmemeli,
- küçük sapmalarla yol vermeli,
- dar kapılarda sonsuza kadar sıkışmamalıdır.

Önerilen teknik yaklaşım:

- global pathfinding,
- yerel kaçınma,
- hedef çevresi slot sistemi.

---

## 34. Hedef Slotları

Yakın dövüş birimleri aynı hedefin tek noktasına yığılmamalıdır.

Hedef çevresinde sınırlı saldırı slotları bulunabilir.

Faydaları:

- daha okunabilir yakın dövüş,
- çarpışma azaltma,
- doğal çevreleme görünümü.

---

## 35. Tıkanma Çözümü

Bir birim belirli süre ilerleyemiyorsa:

1. Yerel rota yeniden hesaplanır.
2. Hedef slot değiştirilir.
3. Grup düzeni gevşetilir.
4. Gerekirse kısa süreli geçiş önceliği verilir.
5. Hâlâ başarısızsa `Blocked` durumu gösterilir.

---

## 36. Hareket ve Bina Çıkışları

Askerî yapıların çevresinde:

- en az bir geçerli çıkış alanı,
- rally point bağlantısı,
- spawn rezerv alanı

bulunmalıdır.

Yapı tamamen çevriliyse yeni birim üretimi beklemeli veya yakın geçerli hücre aranmalıdır.

---

# BÖLÜM F — GÖRÜŞ VE HEDEF TESPİTİ

## 37. Görüş Alanı

Her birimin bir görüş yarıçapı vardır.

Görüş:

- fog of war açar,
- hedef tespitini belirler,
- AI bilgi erişimini sınırlar.

Önerilen rol farkları:

- İşçi: düşük görüş
- Muhafız: orta görüş
- Okçu: orta/yüksek görüş
- Süvari: yüksek görüş
- Kuşatma: düşük görüş

---

## 38. Hedef Tespit Alanı

Hedef tespit alanı görüş alanına eşit veya daha küçük olabilir.

Bir birim:

- görünmeyen düşmanı otomatik hedeflememeli,
- fog of war arkasındaki hedefi takip etmemeli,
- son görülen konuma kısa süre ilerleyebilir.

---

## 39. Hedef Kaybı

Hedef görüşten çıkarsa:

- birim kısa süre takip edebilir,
- kovalamaca sınırına ulaşınca geri döner,
- pozisyon koru modunda hemen veya kısa süre sonra geri döner.

---

# BÖLÜM G — SAVAŞ MODELİ

## 40. Temel Hasar Akışı

```text
Hedef seç
→ Menzile gir
→ Saldırı animasyonu başlat
→ Vuruş anında hasar uygula
→ Bekleme süresi
→ Hedef geçerliyse tekrarla
```

---

## 41. Yakın Dövüş

Yakın dövüş birimi:

- hedefe yaklaşır,
- saldırı slotu alır,
- menzile girince saldırır,
- hedef ölürse yeni hedef seçer.

Yakın dövüşte:

- vuruş kaçırma sistemi ilk sürümde gerekli değildir,
- saldırıların çoğu güvenilir olmalıdır.

---

## 42. Menzilli Savaş

Okçu:

- hedefi menzilde tutmaya çalışır,
- mermi veya basit vuruş sistemi kullanır,
- yakın tehdit geldiğinde pozisyonunu kaybedebilir.

İki teknik seçenek:

### Seçenek A — Anlık isabet

Vuruş anında hasar uygulanır.

### Seçenek B — Fiziksel mermi

Mermi hedefe gider ve sonra hasar verir.

**Önerilen vertical slice kararı:**  
Görsel mermi kullanılabilir; hasar hedefe ulaşınca uygulanır. Ancak balistik fizik karmaşık olmamalıdır.

---

## 43. Mermi Davranışı

Mermi:

- hedefin son bilinen konumuna gidebilir,
- hedef çok hızlı uzaklaşırsa kaçırabilir,
- ilk sürümde dost ateşi yaratmamalıdır.

Bu sistem okunabilir olmalı; aşırı rastlantı üretmemelidir.

---

## 44. Kuşatma Savaşı

Kuşatma birimi:

- yapılara karşı yüksek bonus alır,
- birimlere karşı düşük hasar verir,
- yavaş saldırı hızına sahiptir,
- koruma olmadan kolay kaybedilir.

Kuşatma saldırısı:

- belirgin hazırlık süresi,
- güçlü ses ve görsel geri bildirim,
- yüksek yapı hasarı

sunmalıdır.

---

## 45. Sağlık

Her birim:

- maksimum sağlık,
- mevcut sağlık,
- sağlık yüzdesi

değerlerine sahiptir.

Sağlık çubuğu:

- hasar alındığında görünür,
- seçili birimde sürekli görülebilir,
- tamamen doluyken gizlenebilir.

---

## 46. Zırh ve Hasar Türleri

İlk vertical slice için karmaşık zırh sistemi önerilmez.

Önerilen basit model:

### Hasar türleri

- Yakın Dövüş
- Menzilli
- Kuşatma

### Hedef sınıfları

- Hafif Birim
- Ağır Birim
- Yapı

Örnek karşıtlıklar:

- Muhafız → hızlı birime karşı iyi
- Okçu → yavaş yakın dövüşe karşı iyi
- Süvari → okçuya karşı iyi
- Kuşatma → yapıya karşı iyi

---

## 47. Basit Hasar Formülü

Kavramsal formül:

```text
Son Hasar
= Temel Hasar
× Hedef Sınıfı Katsayısı
× Seviye Katsayısı
× Durum Katsayısı
```

İlk sürümde sabit zırh çıkarımı yerine katsayı sistemi daha okunabilir olabilir.

---

## 48. Minimum Hasar

Aşırı direnç nedeniyle saldırının tamamen etkisiz kalması önerilmez.

Her geçerli vuruş:

- en az küçük bir hasar

vermelidir.

---

## 49. Saldırı Hızı

Saldırı hızı:

- hazırlık süresi,
- vuruş anı,
- toparlanma süresi

olarak ayrılabilir.

Animasyon ile gerçek hasar anı eşleşmelidir.

---

## 50. Birim Ölümü

Birimin sağlığı sıfıra indiğinde:

- saldırı ve hareket durur,
- kısa yenilme animasyonu oynar,
- seçimden çıkar,
- pathfinding engeli kısa sürede kalkar,
- nüfus kapasitesi serbest kalır.

Kalıcı ceset veya ragdoll sistemi ilk vertical slice için önerilmez.

---

# BÖLÜM H — BİRİM KARŞITLIKLARI

## 51. Temel Karşıtlık Döngüsü

Önerilen basit ilişki:

```text
Muhafız
→ Süvariyi durdurur

Süvari
→ Okçuya hızla ulaşır

Okçu
→ Muhafıza uzaktan baskı kurar

Kuşatma
→ Yapıları yıkar

Tüm askerler
→ Korumasız kuşatmayı etkili biçimde yok eder
```

Süvari ertelenirse:

```text
Muhafız
→ Okçuyu yakalarsa güçlü

Okçu
→ Muhafızı yaklaşmadan yıpratır

Kuşatma
→ Yapıya güçlü, birime zayıf
```

Bu durumda arazi ve pozisyon daha önemli hale gelir.

---

## 52. Sert Karşıtlık Yerine Yumuşak Karşıtlık

Bir birim karşıtına karşı tamamen kullanılamaz olmamalıdır.

Amaç:

- yanlış kompozisyonu cezalandırmak,
- ancak maçı tek seçimle kaybettirmemek.

Öneri:

- %20–50 arası bonus/ceza,
- çok yüksek 3x veya 4x katsayılarından kaçınmak.

---

## 53. Birim Kompozisyonu

Oyuncu yalnızca tek tip birlik üretmek yerine:

- ön hat,
- menzilli destek,
- hızlı baskın,
- kuşatma

dengesini düşünmelidir.

Birim kadrosu küçük olduğu için kompozisyon kararı basit fakat anlamlı olmalıdır.

---

# BÖLÜM I — STANCE VE OTOMATİK DAVRANIŞ

## 54. Önerilen Stance Türleri

### Agresif

- görüş alanındaki hedefi kovalar,
- geniş kovalamaca mesafesi.

### Savunmacı

- yakındaki tehdide tepki verir,
- sınırlı kovalamaca.

### Pozisyonu Koru

- bulunduğu alandan ayrılmaz,
- menzile giren hedefe saldırır.

Vertical slice için Savunmacı ve Pozisyonu Koru yeterli olabilir.

---

## 55. Varsayılan Davranış

Önerilen varsayılan:

- askerler Savunmacı,
- işçiler Kaçınmacı,
- kuşatma birimleri Savunmacı fakat düşük otomatik kovalamaca.

---

## 56. İşçi Kaçış Davranışı

İşçi yakınında düşman algılarsa:

- çalışma durur,
- en yakın güvenli merkez, depo veya karakola kaçar,
- oyuncuya uyarı verir,
- tehdit geçince otomatik dönme opsiyoneldir.

İlk vertical slice için:

- işçi güvenli noktaya kaçar,
- göreve otomatik dönmez,
- oyuncu yeniden atar.

Bu daha kontrollü ve okunabilirdir.

---

## 57. Kovalamaca Sınırı

Birim:

- başlangıç pozisyonundan belirli mesafe uzaklaşınca,
- hedef görünmez olunca,
- yeni tehdit önceliği oluşunca

kovalamayı bırakmalıdır.

---

# BÖLÜM J — HEDEF SEÇİMİ

## 58. Hedef Önceliği

Otomatik hedefleme için genel sıra:

1. Aktif olarak saldıran düşman
2. En yakın tehdit
3. Birime karşı zayıf hedef
4. Düşük sağlık hedef
5. Komut verilen hedef
6. Yapı

Ancak oyuncu komutu, otomatik hedeflemeden üstün olmalıdır.

---

## 59. Birim Türüne Göre Öncelik

### Muhafız

- yakın düşman,
- süvari,
- okçuya ulaşma,
- yapı son öncelik.

### Okçu

- düşük sağlık hedef,
- yakın dövüş birimi,
- işçi,
- yapı düşük öncelik.

### Süvari

- okçu,
- işçi,
- kuşatma,
- muhafız düşük öncelik.

### Kuşatma

- kule,
- karakol,
- askerî yapı,
- merkez,
- birimler çok düşük öncelik.

---

## 60. Oyuncu Hedef Emri

Oyuncu belirli hedefe saldır emri verdiğinde:

- birim mümkün olduğunca o hedefi korur,
- hedef geçersizse yakın tehdide geçer,
- çok uzak kovalamaca sınırı yine uygulanabilir.

---

## 61. Overkill Önleme

Çok sayıda menzilli birim aynı düşük sağlık hedefe gereksiz yere ateş etmemelidir.

İleri çözüm:

- beklenen hasar rezervasyonu,
- hedef dağılımı.

Vertical slice için basit yaklaşım:

- grup hedef dağıtımı,
- düşük sağlık hedefe maksimum saldırgan sayısı.

---

# BÖLÜM K — GERİ ÇEKİLME VE TOPARLANMA

## 62. Geri Çekilme

Oyuncu birlikleri güvenli alana çekebilir.

Geri çekilme sırasında:

- birimler saldırıyı bırakır,
- hedef noktaya öncelikli hareket eder,
- düşman kovalamaya devam edebilir,
- yol bonusu önemli hale gelir.

---

## 63. İyileşme

İlk vertical slice için üç seçenek vardır:

### Seçenek A — Pasif iyileşme yok

Birlikler yalnızca yeni üretimle yerine konur.

### Seçenek B — Dost kontrol alanında yavaş iyileşme

Savaş dışında ve dost bölgede küçük yenilenme.

### Seçenek C — Özel iyileştirme yapısı

Ek sistem maliyeti yüksek.

**Önerilen vertical slice kararı:**  
Dost Merkez veya Karakol yakınında, savaş dışında çok yavaş iyileşme.

Bu yöntem:

- geri çekilmeyi ödüllendirir,
- ayrı destek birimi gerektirmez,
- orduyu sonsuza kadar tam güçte tutmaz.

---

## 64. İyileşme Koşulları

- son birkaç saniye hasar almamış olmak,
- dost kontrol alanında bulunmak,
- düşman yakınında olmamak,
- hareket etmiyor veya yavaş hareket ediyor olmak.

---

## 65. Veteranlık

Birim deneyimi veya seviye sistemi ilk vertical slice için önerilmez.

Neden:

- ek UI,
- ek denge,
- kayıp birim acısını artıran kartopu etkisi,
- AI karmaşıklığı.

---

# BÖLÜM L — BÖLGE VE LOJİSTİKLE SAVAŞ

## 66. Karakol Savaşı

Karakol saldırıları:

- kontrol alanını daraltır,
- ileri üsleri izole eder,
- yeni yapı kurulumunu engeller,
- bölgesel zaferi etkiler.

Karakol:

- tek başına orduyu durdurmamalı,
- savunma desteği vermeli,
- yükseltildikçe daha uzun dayanmalıdır.

---

## 67. Depo Baskını

Depo saldırısı:

- bağlantı ağını bozar,
- üretim yapılarını yerel tampon moduna geçirir,
- oyuncuyu alternatif rota kurmaya zorlar,
- tüm global stoğu yok etmez.

---

## 68. İşçi Baskını

İşçi baskını:

- üretimi düşürür,
- yeniden işçi üretim maliyeti yaratır,
- kaynak dağılımını bozar.

İşçi baskını güçlü olmalı fakat tek baskınla maç bitirmemelidir.

---

## 69. Yol ve Geçit Savaşı

Yol segmentleri doğrudan saldırılamasa da:

- köprü,
- kavşak,
- karakol,
- depo

üzerinden yol kontrolü sağlanır.

Böylece savaş hedefleri okunabilir kalır.

---

## 70. Stratejik Bölge Çatışması

Stratejik alan içinde:

- düşman varsa ele geçirme durur,
- asker sayısı veya ağırlığı ilerlemeyi etkileyebilir,
- kuşatma ve işçi düşük katkı verir,
- alan kontrolü için gerçek askerî varlık gerekir.

---

# BÖLÜM M — YAPILARA SALDIRI

## 71. Yapı Hedefleme

Birimler yapılara saldırabilir.

Ancak:

- normal askerlerin yapı hasarı sınırlıdır,
- kuşatma birimleri belirgin üstünlük taşır,
- işçiler yapı saldırısında etkisizdir.

---

## 72. Yapı Savunma Etkisi

Kule veya Merkez saldırı yapabiliyorsa:

- hedef önceliği açık olmalı,
- menzil görünümü bulunmalı,
- saldırı gücü tek başına büyük orduyu durdurmamalıdır.

---

## 73. Bina Kuşatma Süresi

Yapılar:

- birkaç saniyede yok olmamalı,
- oyuncuya savunma birliği gönderme süresi vermeli,
- kuşatma birimi varsa daha hızlı yıkılmalıdır.

---

## 74. Yapı Yıkım Sonucu

Yapı yıkılınca:

- yol ağı yeniden hesaplanır,
- kontrol alanı değişebilir,
- üretim durur,
- birlik üretim kuyruğu iptal olur,
- AI stratejik değerlendirmesini günceller.

---

# BÖLÜM N — AI TAKTİK DAVRANIŞI

## 75. AI Savaş Hedefleri

AI şu amaçlardan birini seçebilir:

- keşif,
- işçi baskını,
- karakol yok etme,
- depo kesme,
- stratejik bölge ele geçirme,
- ana üs saldırısı,
- savunma,
- geri çekilme,
- kuşatma koruma.

---

## 76. AI Ordu Toplama

AI saldırıdan önce:

- minimum ordu gücü,
- birim kompozisyonu,
- hedef değeri,
- rota güvenliği,
- savunmada bırakılacak güç

değerlendirir.

---

## 77. AI Güç Değerlendirmesi

Önerilen basit formül:

```text
Ordu Gücü
= Birim sağlık toplamı
× Birim rol katsayısı
× Kompozisyon uyumu
× Yakın destek katsayısı
```

AI yalnızca birim sayısına bakmamalıdır.

---

## 78. AI Hedef Değeri

```text
Hedef Değeri
= Ekonomik etki
+ Bölgesel etki
+ Zafer etkisi
- Savunma gücü
- Uzaklık
- Lojistik riski
```

---

## 79. AI Geri Çekilme

AI şu durumlarda geri çekilebilir:

- güç oranı belirli eşik altına düştü,
- kuşatma birimleri korumasız kaldı,
- hedef değeri kayboldu,
- ana üs tehdit altında,
- ordu ciddi kayıp verdi.

AI tüm birlikleri ölümüne savaşmaya zorlamamalıdır.

---

## 80. AI Hedef Değiştirme

AI:

- her saniye hedef değiştirmemeli,
- kararına kısa süre bağlı kalmalı,
- kritik yeni tehditte planı güncellemelidir.

Bu davranış kararsız ve titreyen hareketi önler.

---

## 81. AI Baskın Davranışı

Baskın grubu:

- hızlı veya küçük birliklerden oluşur,
- dış işçi ve depoları hedefler,
- büyük ordu gelirse geri çekilir,
- merkez binasına saldırmaya çalışmaz.

---

## 82. AI Savunma Davranışı

AI:

- tehdit edilen bölge değerini ölçer,
- yakın birlikleri yönlendirir,
- gerekirse üretim önceliğini değiştirir,
- önemsiz dış yapıyı korumak için tüm ordusunu çekmemelidir.

---

# BÖLÜM O — UI VE GERİ BİLDİRİM

## 83. Birim Bilgi Paneli

Seçili birimde gösterilmesi gerekenler:

- isim,
- sınıf,
- sağlık,
- mevcut görev,
- saldırı değeri,
- saldırı hızı,
- menzil,
- hareket hızı,
- güçlü/zayıf hedefler,
- aktif stance,
- yükseltme seviyesi.

---

## 84. Grup Paneli

Çoklu seçimde:

- birim türü ikonları,
- sayı,
- sağlık özeti,
- aktif komut,
- grup stance

gösterilebilir.

---

## 85. Saldırı Geri Bildirimi

- hedef vurgusu,
- saldırı menzili,
- hasar animasyonu,
- sağlık değişimi,
- mermi izi,
- kuşatma etkisi,
- birim kaybı sesi.

---

## 86. Güçlü ve Zayıf Eşleşme

UI:

- araç ipucunda karşıtlık,
- hedef imlecinde küçük avantaj/dezavantaj işareti,
- eğitim mesajı

kullanabilir.

Aşırı renkli hasar sayıları zorunlu değildir.

---

## 87. Kritik Uyarılar

- İşçiler saldırı altında
- Karakol düşmek üzere
- Kuşatma birimi korumasız
- Ana merkez saldırı altında
- Bölgesel zafer alanı kaybediliyor

---

# BÖLÜM P — TEKNİK TASARIM

## 88. Veri Tabanlı Birim Tanımı

Örnek:

```yaml
unit:
  id: guard_1
  category: melee
  age: settlement
  cost:
    food: TBD
    wood: TBD
  population: 1
  stats:
    health: TBD
    moveSpeed: TBD
    attackDamage: TBD
    attackCooldown: TBD
    attackRange: TBD
    visionRange: TBD
  targetModifiers:
    light: 1.0
    heavy: 1.2
    building: 0.4
  production:
    building: barracks_1
    trainTime: TBD
  upgradeTo: guard_2
```

---

## 89. Birim Durum Makinesi

Önerilen durumlar:

```text
Idle
Moving
Following
Attacking
AttackMoving
Holding
Fleeing
Building
Repairing
Working
Blocked
Dead
```

---

## 90. Savaş Bileşenleri

Önerilen modüler bileşenler:

- UnitSelectionComponent
- UnitMovementComponent
- UnitCommandComponent
- HealthComponent
- VisionComponent
- TargetingComponent
- AttackComponent
- ProjectileComponent
- StanceComponent
- ProductionDataComponent
- WorkerTaskComponent
- HealingComponent

---

## 91. Komut Sistemi

Komutlar ortak veri biçimi kullanmalıdır.

Örnek:

```yaml
command:
  type: attack_move
  targetPosition: [x, y, z]
  issuedBy: player
  queued: false
```

---

## 92. Tick ve Güncelleme Sıklığı

Her sistem her kare çalışmamalıdır.

Öneri:

- hareket: kare bazlı,
- yerel kaçınma: kare bazlı veya düşük aralık,
- hedef arama: periyodik,
- AI taktik değerlendirme: daha düşük sıklık,
- iyileşme: periyodik,
- fog of war: optimize edilmiş aralık.

---

## 93. Object Pooling

Mermiler, seçim efektleri ve geçici savaş efektleri için object pooling kullanılmalıdır.

---

## 94. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- birim türü,
- seviye,
- sahip,
- konum,
- rotasyon,
- sağlık,
- mevcut komut,
- hedef,
- stance,
- üretim kaynağı,
- atanmış iş,
- iyileşme durumu,
- kontrol grubu, uygulanırsa.

Geçici mermilerin kaydedilmesi zorunlu değildir.

---

## 95. Debug Araçları

Geliştirme görünümü:

- pathfinding rotası,
- hedef seçimi,
- saldırı menzili,
- görüş alanı,
- kovalamaca sınırı,
- saldırı slotları,
- AI güç değeri,
- grup hedefi,
- blocked süresi.

---

# BÖLÜM Q — EDGE CASE'LER

## 96. Hedef Ölürken Mermi Yoldaysa

Önerilen davranış:

- mermi son konuma gider,
- hedef öldüyse hasar uygulanmaz,
- mermi görsel olarak kaybolur.

Alternatif hedefe yönelme önerilmez.

---

## 97. Birim Yapı İçinde Sıkışırsa

- en yakın geçerli hücre aranır,
- kısa süreli yeniden konumlandırma yapılır,
- oyuncuya görünmeden model teleport edilmemelidir; ancak teknik kurtarma gerekebilir.

---

## 98. Grup Dar Geçitten Geçemezse

- grup sütun halinde ilerler,
- hedef dağılımı geçici ertelenir,
- birimler geçit sonrası yeniden form olur.

---

## 99. Nüfus Kapasitesi Birim Üretilirken Düşerse

- üretim tamamlanabilir,
- birim spawn bekleyebilir,
- yeni üretim engellenir.

Önerilen vertical slice kararı:

- tamamlanan birim oluşturulur,
- nüfus geçici olarak limit üstüne çıkabilir,
- yeni üretim durur.

---

## 100. Rally Point Geçersiz Olursa

- en yakın geçerli konum seçilir,
- rally point görseli güncellenir,
- birim yapı çevresinde sıkışmamalıdır.

---

## 101. Hedef Fog of War İçine Girerse

- birim kısa süre son görülen konuma gider,
- hedef yeniden görünmezse komut sonlanır veya beklemeye geçer.

---

## 102. İki Birim Aynı Saldırı Slotunu İsterse

- slot rezervasyonu yapılır,
- ikinci birim alternatif slot arar,
- slot yoksa yakın bekleme pozisyonuna geçer.

---

## 103. İşçi İnşaatta Saldırıya Uğrarsa

- oyuncu komutu yoksa kaçış davranışı devreye girer,
- inşaat durur,
- başka işçi varsa devam eder.

---

## 104. Kuşatma Birimi Dar Alanda Dönemezse

- daha büyük nav yarıçapı,
- rota ön kontrolü,
- geçersiz hedefe yaklaşmayı engelleme

kullanılmalıdır.

---

# BÖLÜM R — TEST PLANI

## 105. Test Senaryoları

### Test 1 — Tekli hareket

- Birim farklı arazi ve yol üzerinde hareket eder.
- Hız ve rota doğru uygulanır.

### Test 2 — Grup hareketi

- Karışık birlik grubu hedefe gider.
- Birimler aynı noktaya yığılmaz.

### Test 3 — Yakın dövüş

- Muhafızlar hedef çevresinde slot alır.
- Çarpışma ve saldırı döngüsü çalışır.

### Test 4 — Menzilli savaş

- Okçu hedefe mermi yollar.
- Hedef hareket ederken mermi davranışı doğrulanır.

### Test 5 — Karşıtlık

- Muhafız, Okçu, Süvari ve Kuşatma eşleşmeleri test edilir.
- Hiçbir karşıtlık tamamen tek taraflı olmamalıdır.

### Test 6 — Geri çekilme

- Hasarlı birlikler dost alana çekilir.
- Kovalamaca sınırı ve iyileşme çalışır.

### Test 7 — İşçi baskını

- Düşman işçilere saldırır.
- İşçiler kaçar ve üretim durur.

### Test 8 — Karakol saldırısı

- Normal birlikler ve kuşatma birimi karşılaştırılır.
- Kuşatma belirgin fakat aşırı olmayan avantaj sağlamalıdır.

### Test 9 — Saldırı-hareket

- Grup hedefe giderken düşmanla karşılaşır.
- Çatışma sonrası rotaya devam eder.

### Test 10 — Tıkanma

- Büyük grup dar geçitten geçirilir.
- Kalıcı sıkışma oluşmamalıdır.

### Test 11 — AI geri çekilme

- AI zayıf çatışmaya girer.
- Eşik altında geri çekilir.

### Test 12 — Save/load

- Savaş öncesi durum kaydedilir.
- Yükleme sonrası birim konumu, sağlık ve komutlar korunur.

---

## 106. Telemetri

İzlenecek değerler:

- birim türü üretim oranı,
- birim türü ölüm oranı,
- ortalama çatışma süresi,
- birim başına verilen hasar,
- birim başına alınan hasar,
- en sık öldürülen hedef sınıfı,
- geri çekilme sonrası hayatta kalma oranı,
- blocked süresi,
- dar geçit sıkışma sayısı,
- saldırı-hareket kullanımı,
- işçi baskını başarı oranı,
- karakol yıkım süresi,
- kuşatma birimi kullanım oranı,
- AI geri çekilme oranı,
- maç sonu ordu kompozisyonu.

---

# BÖLÜM S — VERTICAL SLICE KAPSAMI

## 107. Zorunlu Özellikler

- İşçi birimi
- Muhafız
- Okçu
- En az bir hızlı veya kuşatma birimi
- Tekli seçim
- Kutu ile seçim
- Sağ tık hareket
- Saldırı
- Saldırı-hareket
- Dur
- Pozisyonu koru
- Grup hareketi
- Temel hedef seçimi
- Yakın dövüş slotları
- Menzilli mermi
- Basit hasar sınıfları
- Birim üretim kuyruğu
- Nüfus kullanımı
- Yol hareket bonusu
- Fog of war ile hedef görünürlüğü
- İşçi kaçışı
- Dost bölgede yavaş iyileşme
- AI saldırı, savunma ve geri çekilme
- Savaş debug görünümü

---

## 108. Ertelenebilecek Özellikler

- Gelişmiş formasyon editörü
- Veteranlık
- Moral
- Dost ateşi
- Karmaşık zırh türleri
- Kritik vuruş
- Durum etkileri
- Şifacı
- Kahraman birimleri
- Komut kuyruğu
- Devriye
- Fizik tabanlı ragdoll
- Kalıcı cesetler
- Gece görüş cezası
- Yüksek zemin bonusu
- Birim taşıma
- Garnizon sistemi

---

## 109. İlk Teknik Prototip

İlk prototip şu döngüyü doğrulamalıdır:

```text
Muhafız üret
→ Birimi seç
→ Hedefe hareket ettir
→ Düşman muhafıza saldır
→ Sağlık azalt
→ Birim ölür
→ Nüfus serbest kalır
```

İkinci prototip aşaması:

```text
Muhafız + Okçu grubu
→ Saldırı-hareket
→ Hedef seçimi
→ Yakın ve menzilli saldırı
→ Grup geri çekilmesi
```

---

# BÖLÜM T — AÇIK SORULAR VE KARARLAR

## 110. Açık Tasarım Soruları

### Birim kadrosu

- Süvari vertical slice içinde kesin olarak bulunacak mı?
- Kuşatma birimi koçbaşı mı, mancınık mı olmalı?
- ~~Okçu ayrı binada mı, Kışla II içinde mi açılmalı?~~ **Karar verildi:** ayrı
  bina — Okçuluk Alanı, yalnız Kasaba çağı (`02 §30.1`, `SL-007`).
- Keşif için özel birim gerekli mi?

### Hasar modeli

- Ağır/Hafif birim sınıfları yeterli mi?
- Yapılarda ayrı zırh sınıfı olacak mı?
- Menzilli mermiler hareketli hedefi kaçırabilmeli mi?
- Hasar rastgeleliği kullanılmalı mı?

### Hareket

- Yol hareket bonusu yüzde kaç olmalı?
- Birimler birbirinin içinden hiçbir durumda geçemeyecek mi?
- Formasyon yalnızca görsel mi, mekanik bonus da verecek mi?
- Kuşatma için farklı pathfinding yarıçapı yeterli mi?

### Geri çekilme

- Dost bölgede iyileşme hızı ne kadar olmalı?
- İyileşme kaynak tüketmeli mi?
- AI geri çekilme eşiği hangi güç oranında olmalı?
- İşçiler tehdit geçince otomatik işe dönmeli mi?

### Yapı savaşı

- Merkez binasının savunma saldırısı olacak mı?
- Kulelerin hedef önceliği oyuncu tarafından değiştirilebilecek mi?
- Kuşatma birimi olmadan yapı yıkmak ne kadar mümkün olmalı?
- Karakollar asker barındırabilecek mi?

---

## 111. Şimdilik Alınmış Kararlar

- Birim kadrosu küçük ve rol odaklı olacaktır.
- Vertical slice için İşçi, Muhafız, Okçu ve Kuşatma birimi zorunludur.
- Süvari kapsam durumuna göre dahil edilecektir.
- Tam formasyon sistemi ilk vertical slice içinde bulunmayacaktır.
- Grup hareketinde basit rol tabanlı dizilim kullanılacaktır.
- Saldırı-hareket komutu vertical slice için zorunludur.
- Birimler yol dışında hareket edebilecektir.
- Yol hareket avantajı sağlayacaktır.
- Birim pathfinding sistemi lojistik yol grafiğinden ayrı olacaktır.
- Yakın dövüşte hedef çevresi saldırı slotları kullanılacaktır.
- Menzilli saldırılar görsel mermi kullanacaktır.
- Dost ateşi olmayacaktır.
- Karmaşık zırh yerine basit hasar türleri ve hedef sınıfı katsayıları kullanılacaktır.
- Birim karşıtlıkları sert değil, yumuşak olacaktır.
- Varsayılan asker davranışı savunmacı olacaktır.
- İşçiler tehdit halinde güvenli noktaya kaçacaktır.
- İşçiler ilk vertical slice içinde otomatik olarak eski işlerine dönmeyecektir.
- Dost kontrol alanında savaş dışı yavaş iyileşme kullanılacaktır.
- Veteranlık ve moral ilk vertical slice içinde bulunmayacaktır.
- Kuşatma birimleri yapılara karşı belirgin bonus taşıyacaktır.
- AI saldırı, baskın, savunma ve geri çekilme davranışlarına sahip olacaktır.
- Savaş sistemi veri tabanlı ve bileşen tabanlı tasarlanacaktır.
- Savaş debug görünümü zorunludur.

---

## 112. Diğer Dokümanlarla Bağlantılar

- `07_ENEMY_AI_DESIGN_v0.2.md`
  - AI hedef seçimi,
  - ordu kompozisyonu,
  - saldırı ve geri çekilme,
  - baskın grupları.

- `08_MAP_AND_WORLD_DESIGN.md`
  - dar geçitler,
  - yol bonusları,
  - savaş alanları,
  - görüş ve fog of war.

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - ordu kaybı,
  - merkez yıkımı,
  - zorluk seviyeleri,
  - AI bonusları.

- `10_CAMERA_CONTROLS_AND_UI.md`
  - seçim,
  - komutlar,
  - grup paneli,
  - sağlık ve hedef göstergeleri.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - birim model eşleştirmesi,
  - takım renkleri,
  - saldırı animasyonları,
  - mermi ve hasar efektleri.

- `12_BALANCE_AND_GAME_DATA.md`
  - sağlık,
  - hasar,
  - hız,
  - menzil,
  - üretim süresi,
  - karşıtlık katsayıları.

---

## 113. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Birim kadrosu yeterince küçük ve anlaşılırdır.
- [ ] Muhafız, Okçu, Süvari ve Kuşatma rollerinin sınırları nettir.
- [ ] Vertical slice için zorunlu birimler kabul edilmiştir.
- [ ] Saldırı-hareket ve stance yaklaşımı onaylanmıştır.
- [ ] Grup hareketi ve saldırı slotları yaklaşımı kabul edilmiştir.
- [ ] Basit hasar sınıfı modeli onaylanmıştır.
- [ ] Yumuşak karşıtlık yaklaşımı kabul edilmiştir.
- [ ] İşçi kaçışı ve dost bölgede iyileşme onaylanmıştır.
- [ ] Yapılara saldırı ve kuşatma rolü nettir.
- [ ] AI saldırı, savunma ve geri çekilme yaklaşımı kabul edilmiştir.
- [ ] Vertical slice kapsamı gerçekçi bulunmuştur.
- [ ] Teknik bileşen ve debug yaklaşımı uygun bulunmuştur.

---

## 114. Kontrol Listesi

### Birim kadrosu

- [ ] İşçi tanımlandı.
- [ ] Muhafız tanımlandı.
- [ ] Okçu tanımlandı.
- [ ] Süvari tanımlandı.
- [ ] Kuşatma birimi tanımlandı.
- [ ] Daraltılmış kadro oluşturuldu.
- [ ] Teknik prototip kadrosu oluşturuldu.

### Üretim ve komutlar

- [ ] Birim üretim akışı tanımlandı.
- [ ] Üretim kuyruğu tanımlandı.
- [ ] Rally point tanımlandı.
- [ ] Tekli seçim tanımlandı.
- [ ] Kutu seçimi tanımlandı.
- [ ] Sağ tık bağlamsal komut tanımlandı.
- [ ] Saldırı-hareket tanımlandı.
- [ ] Pozisyonu koru tanımlandı.
- [ ] Dur komutu tanımlandı.

### Hareket ve pathfinding

- [ ] Birim hareket verileri tanımlandı.
- [ ] Yol kullanımı tanımlandı.
- [ ] Grup hareketi tanımlandı.
- [ ] Yerel kaçınma tanımlandı.
- [ ] Saldırı slotları tanımlandı.
- [ ] Tıkanma çözümü tanımlandı.
- [ ] Yapı çıkışları ele alındı.

### Savaş

- [ ] Görüş ve hedef tespiti tanımlandı.
- [ ] Yakın dövüş tanımlandı.
- [ ] Menzilli savaş tanımlandı.
- [ ] Mermi davranışı tanımlandı.
- [ ] Kuşatma savaşı tanımlandı.
- [ ] Sağlık sistemi tanımlandı.
- [ ] Hasar türleri tanımlandı.
- [ ] Karşıtlık döngüsü tanımlandı.
- [ ] Birim ölümü tanımlandı.

### Davranış

- [ ] Stance türleri tanımlandı.
- [ ] Varsayılan stance tanımlandı.
- [ ] İşçi kaçışı tanımlandı.
- [ ] Kovalamaca sınırı tanımlandı.
- [ ] Hedef öncelikleri tanımlandı.
- [ ] Overkill yaklaşımı değerlendirildi.
- [ ] Geri çekilme tanımlandı.
- [ ] İyileşme tanımlandı.

### AI ve teknik

- [ ] AI hedefleri tanımlandı.
- [ ] AI güç değerlendirmesi tanımlandı.
- [ ] AI geri çekilme tanımlandı.
- [ ] AI baskın davranışı tanımlandı.
- [ ] Veri tabanlı birim şeması taslaklandı.
- [ ] Durum makinesi tanımlandı.
- [ ] Bileşenler listelendi.
- [ ] Save/load gereksinimleri tanımlandı.
- [ ] Debug araçları listelendi.

### Test

- [ ] Tekli hareket testi tanımlandı.
- [ ] Grup hareketi testi tanımlandı.
- [ ] Yakın dövüş testi tanımlandı.
- [ ] Menzilli savaş testi tanımlandı.
- [ ] Karşıtlık testi tanımlandı.
- [ ] Geri çekilme testi tanımlandı.
- [ ] İşçi baskını testi tanımlandı.
- [ ] Karakol saldırısı testi tanımlandı.
- [ ] Tıkanma testi tanımlandı.
- [ ] AI geri çekilme testi tanımlandı.
- [ ] Save/load testi tanımlandı.
- [ ] Telemetri değerleri listelendi.

---

## 115. Revizyon Notları

### Sürüm 0.1

- Çekirdek birim kadrosu oluşturuldu.
- Birim üretimi, seçim ve komut sistemi tanımlandı.
- Grup hareketi, pathfinding ve saldırı slotları tasarlandı.
- Yakın dövüş, menzilli savaş ve kuşatma kuralları oluşturuldu.
- Basit hasar sınıfları ve yumuşak karşıtlık yaklaşımı seçildi.
- Stance, hedef önceliği, geri çekilme ve iyileşme tanımlandı.
- Savaşın karakol, depo, işçi ve stratejik bölgelerle ilişkisi kuruldu.
- AI saldırı, savunma, baskın ve geri çekilme davranışları eklendi.
- Teknik bileşenler, save/load, debug, edge case ve test planları oluşturuldu.

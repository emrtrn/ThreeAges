# 08 — Map and World Design

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Harita ve Dünya Tasarımı  
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

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. "Vertical slice için zorunlu" ifadeleri tam oyun hedefini anlatır — bir özelliğin hangi üründe (A/B/C) açıldığı ya da koşullu/kapsam dışı olduğu konusunda 13 v0.2 esastır. Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman ilk oynanabilir haritanın yapısını, kaynak dağılımını, stratejik bölgelerini, başlangıç alanlarını, geçitlerini, görüş düzenini ve dünya sunumunu tanımlar.

Belge şu sorulara cevap verir:

- İlk harita nasıl bir genel düzene sahip olmalıdır?
- Oyuncu ve AI nerede başlamalıdır?
- Kaynaklar güvenli, riskli ve merkezi bölgeler arasında nasıl dağıtılmalıdır?
- Nehir, orman, dağ ve geçitler oynanışı nasıl şekillendirmelidir?
- Karakol ve yol sistemi harita tasarımına nasıl bağlanmalıdır?
- Stratejik bölgeler nasıl konumlandırılmalıdır?
- Harita simetrik mi, asimetrik mi olmalıdır?
- Fog of war ve keşif nasıl ilerlemelidir?
- AI genişleme ve saldırı rotaları nasıl desteklenmelidir?
- Vertical slice için harita ne kadar büyük ve karmaşık olmalıdır?
- Harita hangi teknik ve performans sınırları içinde tasarlanmalıdır?

Bu belge ilk olarak tek bir vertical slice haritasına odaklanır. Gelecekteki ek haritalar için ortak prensipler de tanımlar.

---

## 2. Harita Tasarım Hedefi

İlk harita şu deneyimi üretmelidir:

> “Başlangıç alanım güvenli, fakat kazanmak için merkezden çıkmak; kaynak, yol ve stratejik bölgeler için risk almak zorundayım.”

Harita:

- oyuncuya güvenli bir açılış sunmalı,
- erken keşfi ödüllendirmeli,
- orta oyunda iki tarafı aynı alanlara yönlendirmeli,
- karakol ve yol kurulumunu anlamlı kılmalı,
- tek bir doğru saldırı rotası üretmemeli,
- savunmaya kapanmayı tamamen güvenli hale getirmemeli,
- AI için anlaşılır genişleme ve saldırı seçenekleri sunmalı,
- web performansına uygun büyüklükte olmalıdır.

---

## 3. Ana Harita İlkeleri

### 3.1 Güvenli başlangıç, riskli büyüme

Her taraf başlangıçta:

- temel yiyecek,
- temel odun,
- küçük taş,
- küçük altın

erişimine sahip olmalıdır.

Ancak bu kaynaklar üçüncü çağa ve son orduya ulaşmak için yeterli olmamalıdır.

### 3.2 Merkez bölgesi çatışma üretmelidir

Haritanın merkezi:

- daha zengin kaynaklar,
- stratejik bölgeler,
- geçiş yolları,
- görüş avantajı

sunmalıdır.

### 3.3 En az iki ana rota

Oyuncu ve AI arasında:

- doğrudan kısa rota,
- daha uzun yan rota

bulunmalıdır.

Tek geçitli harita erken savunma duvarını aşırı güçlendirebilir.

### 3.4 Doğal engeller karar üretmelidir

Nehir, orman ve yükseltiler:

- yalnızca dekoratif değil,
- hareket ve yol planlamasını etkileyen,
- saldırı rotalarını yönlendiren,
- savunma noktaları oluşturan

öğeler olmalıdır.

### 3.5 Harita okunabilir olmalıdır

Oyuncu kısa sürede şu alanları ayırt edebilmelidir:

- kendi başlangıç bölgesi,
- AI yönü,
- merkezi çatışma alanı,
- yan genişleme bölgeleri,
- geçitler,
- stratejik hedefler.

---

# BÖLÜM A — İLK HARİTA KONSEPTİ

## 4. Harita Çalışma Adı

**İki Nehir Arası**

Alternatif adlar:

- Sınır Vadisi
- Kırık Geçit
- Üç Köprü
- Kral Yolu
- Bereket Ovası

İlk taslakta `İki Nehir Arası` adı kullanılacaktır.

---

## 5. Yüksek Seviye Harita Özeti

Harita:

- güneybatıda oyuncu başlangıcı,
- kuzeydoğuda AI başlangıcı,
- ortada iki tarafın yarıştığı zengin kaynak bölgesi,
- haritayı çapraz bölen nehir,
- iki ana köprü,
- bir yan sığ geçit veya dar kara geçişi,
- iki stratejik bölge,
- iki yan genişleme alanı,
- merkezde yüksek değerli altın ve taş

içerir.

---

## 6. Önerilen Üstten Görünüş Şeması

```text
┌──────────────────────────────────────────────┐
│                  KUZEYDOĞU                   │
│                                              │
│        [AI Başlangıç Bölgesi]                │
│        Ev / Merkez / Güvenli Kaynaklar       │
│                   │                          │
│             [Doğu Yan Ormanı]                │
│                   │                          │
│       ───────── Köprü B ─────────            │
│              \      |      /                 │
│          [Stratejik Nokta 2]                 │
│                   │                          │
│      [Merkezi Altın + Taş Bölgesi]           │
│                   │                          │
│          [Stratejik Nokta 1]                 │
│              /      |      \                 │
│       ───────── Köprü A ─────────            │
│                   │                          │
│             [Batı Yan Ormanı]                │
│                   │                          │
│        [Oyuncu Başlangıç Bölgesi]            │
│                                              │
│                  GÜNEYBATI                   │
└──────────────────────────────────────────────┘
```

Bu şema yalnızca stratejik düzeni gösterir; gerçek harita daha organik ve asimetrik olabilir.

---

# BÖLÜM B — HARİTA BOYUTU

## 7. Hedef Harita Ölçeği

Vertical slice için harita:

- çok küçük olup erken saldırıyı zorunlu kılmamalı,
- çok büyük olup boşluk hissi yaratmamalıdır.

Önerilen hedef:

- Bir başlangıç merkezinden rakip merkeze normal piyade yürüyüşü: yaklaşık 2–3 dakika
- En yakın stratejik noktaya yürüyüş: yaklaşık 45–75 saniye
- İlk dış kaynak alanına yürüyüş: yaklaşık 30–60 saniye
- Haritanın bir uçtan diğer uca hızlı birlikle geçişi: yaklaşık 2 dakika

Kesin dünya birimleri Forge ölçeğine göre belirlenir.

---

## 8. Oynanabilir Alan Bütçesi

Harita alanı üç katmana ayrılır:

### 8.1 Aktif oynanış alanı

- başlangıç bölgeleri,
- yollar,
- kaynaklar,
- stratejik noktalar,
- geçitler.

### 8.2 Görsel tampon alanı

- arka plan ormanları,
- uzak kayalıklar,
- harita sınırı süsleri.

### 8.3 Erişilemez sınır alanı

- uçurum,
- yoğun orman,
- derin su,
- görünmez sınır.

Performans açısından aktif alan gereksiz büyütülmemelidir.

---

## 9. Harita Sınırı

Harita sınırı:

- görünmez duvar gibi hissedilmemeli,
- doğal çevreyle açıklanmalıdır.

Önerilen sınır öğeleri:

- yoğun orman,
- dik kayalık,
- derin su,
- dağ sırası,
- yüksek çit veya antik duvar.

---

# BÖLÜM C — BAŞLANGIÇ BÖLGELERİ

## 10. Başlangıç Bölgesi Hedefi

Başlangıç bölgesi oyuncuya:

- ekonomiyi anlamak,
- ilk yapılarını kurmak,
- ilk yolunu planlamak,
- erken saldırıya karşı tepki vermek

için yeterli alan sağlamalıdır.

---

## 11. Oyuncu Başlangıç İçeriği

Önerilen düzen:

- Merkez Binası
- 4–6 işçi
- Yakın yiyecek kaynağı
- Yakın küçük orman
- Küçük taş yatağı
- Küçük altın yatağı
- 2–3 uygun yapı alanı
- İlk karakol yönünü düşündüren açık rota

---

## 12. AI Başlangıç İçeriği

AI başlangıç alanı temel olarak oyuncuyla aynı ekonomik kapasiteye sahip olmalıdır.

Küçük farklılıklar:

- kaynakların birebir aynı koordinatta olmaması,
- farklı orman şekli,
- farklı yol yönü,
- farklı görsel çevre düzeni

olabilir.

---

## 13. Başlangıç Güvenliği

Başlangıç alanı:

- tek bir doğrudan girişe sahip olmamalı,
- ancak çevresi tamamen açık da olmamalıdır.

Önerilen yapı:

- bir ana giriş,
- bir yan yaklaşım,
- doğal savunma kenarı.

Bu düzen:

- erken baskını mümkün,
- ancak tamamen karşılıksız olmayan

hale getirir.

---

## 14. Başlangıç Kaynak Dengesi

Güvenli kaynaklar:

- oyuncuyu oyundan düşmekten korur,
- fakat uzun vadeli üstünlük sağlamaz.

Öneri:

- güvenli odun ve yiyecek → ilk 8–10 dakika için yeterli,
- güvenli taş ve altın → ilk çağ geçişine katkı,
- ikinci ve üçüncü çağ için dış kaynak zorunlu.

---

# BÖLÜM D — KAYNAK DAĞILIMI

## 15. Kaynak Katmanları

Kaynaklar üç risk katmanında dağıtılır:

1. Güvenli kaynaklar
2. Yan genişleme kaynakları
3. Merkezi yüksek değerli kaynaklar

---

## 16. Güvenli Kaynaklar

Her başlangıç bölgesinde:

- 1 sürdürülebilir yiyecek alanı,
- 1 küçük orman,
- 1 küçük taş yatağı,
- 1 küçük altın yatağı

bulunmalıdır.

Bu kaynaklar:

- kolay savunulur,
- kısa yol gerektirir,
- düşük veya orta kapasitelidir.

---

## 17. Yan Genişleme Kaynakları

Haritanın iki yan bölgesinde:

- büyük orman,
- orta taş yatağı,
- orta altın yatağı,
- uygun karakol alanı

bulunabilir.

Bu bölgeler:

- merkezi alan kadar riskli değildir,
- fakat ana üsse uzak olduğu için savunma ister,
- alternatif ekonomik strateji sunar.

---

## 18. Merkezi Kaynaklar

Harita merkezinde:

- en zengin altın,
- en zengin taş,
- stratejik nokta,
- yol kavşağı

birbirine yakın olmalıdır.

Amaç:

- iki tarafı aynı alana yönlendirmek,
- orta oyun çatışmasını hızlandırmak,
- bölgesel kontrolü ekonomik değere bağlamak.

---

## 19. Kaynak Simetrisi

Harita tamamen ayna simetrisi olmak zorunda değildir.

Ancak iki taraf için:

- toplam güvenli kaynak değeri,
- ilk dış kaynak mesafesi,
- stratejik noktaya ulaşım süresi,
- ana geçide erişim

yakın olmalıdır.

---

## 20. Kaynak Varyasyonu

Gelecekte aynı haritanın varyantlarında:

- yan orman yoğunluğu,
- merkezi altın konumu,
- küçük kaynak düğümleri

değişebilir.

Vertical slice için kaynaklar sabit olmalıdır. Bu, AI ve denge testini kolaylaştırır.

---

# BÖLÜM E — DOĞAL ENGELLER

## 21. Nehir

Nehir haritayı tamamen ikiye bölmemelidir.

Görevleri:

- saldırı rotalarını yönlendirmek,
- köprüleri stratejik hale getirmek,
- yol planlamasını etkilemek,
- görsel kimlik sağlamak.

---

## 22. Köprüler

İlk harita için önerilen:

- 2 ana köprü,
- 1 yan sığ geçit veya dar kara geçişi.

Köprüler:

- sabit,
- yıkılamaz,
- oyuncu tarafından inşa edilemez

olmalıdır.

Bu karar ilk vertical slice için pathfinding ve harita kontrolünü sadeleştirir.

---

## 23. Ormanlar

Ormanlar iki role sahiptir:

### Ekonomik rol

- odun kaynağı.

### Mekânsal rol

- görüşü veya hareketi sınırlayabilir,
- yol rotasını daraltabilir,
- baskın rotasını gizleyebilir.

İlk vertical slice için:

- orman içi geçiş mümkün,
- hareket hızı düşük,
- görüş sınırlı veya ağaç yoğunluğu nedeniyle zor

olabilir.

Ancak aşırı yoğun çarpışma ağacı kullanımı pathfinding maliyeti yaratmamalıdır.

---

## 24. Dağ ve Kayalıklar

Dağlar:

- geçilemez sınır,
- rota yönlendirici,
- doğal savunma

olarak kullanılmalıdır.

Yükselti savaşı ilk vertical slice içinde mekanik bonus vermek zorunda değildir.

---

## 25. Açık Arazi

Açık alan:

- büyük grup hareketi,
- süvari veya hızlı birlik,
- genişleme,
- kuşatma kullanımı

için uygundur.

Açık alanlar tamamen boş görünmemeli; düşük yoğunlukta dekor kullanılmalıdır.

---

## 26. Dar Geçitler

Dar geçitler:

- az sayıda,
- önemli,
- kuşatılabilir

olmalıdır.

Aşırı dar geçitler:

- birim sıkışması,
- AI hatası,
- savunma aşırılığı

yaratabilir.

Önerilen minimum genişlik:

- en az 4–6 yakın dövüş biriminin yan yana geçebileceği alan.

Kesin ölçü birim ölçeğine göre test edilir.

---

# BÖLÜM F — STRATEJİK BÖLGELER

## 27. Stratejik Nokta Sayısı

İlk harita için:

- 2 ana stratejik nokta

önerilir.

Gelecekte:

- 3 nokta

kullanılabilir.

İki nokta:

- vertical slice kapsamını sade tutar,
- iki farklı savaş alanı yaratır,
- bölgesel zaferi okunabilir kılar.

---

## 28. Stratejik Nokta 1 — Merkez Meydanı

Konum:

- haritanın merkezine yakın,
- ana köprülerden biriyle bağlantılı.

Değer:

- bölgesel zafer,
- görüş,
- yol kavşağı kontrolü.

Risk:

- iki tarafa da açık,
- uzun süre savunmak zor.

---

## 29. Stratejik Nokta 2 — Kuzey Geçidi

Konum:

- merkezi bölgenin biraz dışında,
- ikinci ana köprü veya yan rota üzerinde.

Değer:

- bölgesel zafer,
- yan genişleme erişimi,
- AI veya oyuncunun arka bölgesine rota.

---

## 30. Nokta Çevresi Tasarımı

Her stratejik noktanın çevresinde:

- ordu yerleştirme alanı,
- karakol kurma alanı,
- en az iki yaklaşım yönü,
- kule spam'ini önleyecek açık düzen

olmalıdır.

---

## 31. Ele Geçirme Alanı

Ele geçirme alanı:

- görünür sınır,
- yeterince geniş savaş alanı,
- tek küçük noktaya yığılmayı önleyen boyut

kullanmalıdır.

---

## 32. Stratejik Nokta Bonusları

Vertical slice için bonuslar sınırlı tutulmalıdır.

Önerilen:

- bölgesel zafer sayacı,
- küçük görüş bonusu.

Ekonomi bonusu ilk sürümde gerekli değildir.

---

# BÖLÜM G — YOL AĞI VE HARİTA

## 33. Doğal Yol Koridorları

Harita, yol çizimini tamamen serbest bırakmak yerine doğal koridorlarla yönlendirmelidir.

Koridorlar:

- açık ova,
- köprü yaklaşımı,
- orman arası açıklık,
- vadi tabanı

üzerinden oluşabilir.

---

## 34. Kısa ve Güvenli Rota Kararı

Her başlangıçtan merkeze:

- kısa fakat açık rota,
- uzun fakat daha korunaklı rota

bulunmalıdır.

Bu karar oyunun lojistik temasını güçlendirir.

---

## 35. Yan Ekonomi Rotaları

Yan kaynak bölgelerine:

- ana yoldan ayrılan kol,
- alternatif depo konumu,
- karakol zinciri

gerekmelidir.

---

## 36. Yol Düğümleri

Önerilen önemli düğümler:

- başlangıç merkez çıkışı,
- ilk karakol bölgesi,
- ana köprü girişi,
- merkezi kavşak,
- yan kaynak ayrımı.

Bu düğümler AI yol planlamasında işaretlenebilir.

---

## 37. Yol ve Görsel Dil

Yollar:

- zeminden net ayrılmalı,
- takım sahipliği göstermemeli,
- aynı zamanda dekoratif olarak dünyaya oturmalıdır.

Yol seviyeleri görsel olarak:

- toprak,
- sıkıştırılmış zemin,
- taş döşeme

şeklinde farklılaşabilir.

---

# BÖLÜM H — FOG OF WAR VE KEŞİF

## 38. Fog of War Katmanları

Önerilen üç durum:

```text
Bilinmeyen
Keşfedilmiş ama görünmeyen
Şu anda görünür
```

---

## 39. Bilinmeyen Alan

Oyuncu:

- kaynakları,
- düşman yapılarını,
- stratejik detayları

göremez.

Haritanın genel formu tamamen karanlık olabilir veya düşük detaylı kontur gösterilebilir.

---

## 40. Keşfedilmiş Alan

Daha önce görülen:

- arazi,
- kalıcı doğal öğeler,
- stratejik bölge konumu

görünür kalır.

Düşman birimleri görünmez.

Düşman yapıları:

- son görülen model veya hayalet işaret olarak kalabilir,
- bilgi eskidikçe doğruluk kaybedebilir.

---

## 41. Görüş Kaynakları

- Birimler
- Merkez
- Karakollar
- Kuleler
- Stratejik noktalar, opsiyonel

---

## 42. Görüş Dengesi

Karakollar:

- geniş görüş sağlamalı,
- ancak haritanın büyük bölümünü tek başına açmamalıdır.

Süvari veya keşif birimi:

- yüksek görüş,
- düşük savaş gücü veya yüksek risk

taşıyabilir.

---

## 43. Keşif Teşviki

Oyuncu keşif yaparak:

- zengin kaynak,
- AI genişlemesi,
- stratejik rota,
- savunmasız depo,
- boş karakol alanı

bulabilir.

Keşif yalnızca harita açma görevi olmamalıdır.

---

# BÖLÜM I — BÖLGESEL AKIŞ

## 44. Erken Oyun Akışı

Oyuncu başlangıçta:

- yakın kaynakları görür,
- ilk dış bölgenin yönünü tahmin eder,
- merkezi alanın tamamını görmez,
- AI konumunu doğrudan bilmeyebilir.

---

## 45. Orta Oyun Akışı

Oyuncu:

- ilk karakolunu kurar,
- köprü veya geçide ulaşır,
- stratejik noktayla karşılaşır,
- AI genişlemesini görür,
- yan kaynak veya merkez arasında seçim yapar.

---

## 46. Geç Oyun Akışı

Harita:

- daha büyük ordulara alan vermeli,
- ana saldırı rotalarını açmalı,
- merkezleri tamamen ulaşılamaz hale getirmemeli,
- bölgesel zafer için savunulabilir ama kırılabilir alanlar sunmalıdır.

---

# BÖLÜM J — OYUNCU VE AI ROTALARI

## 47. Ana Saldırı Rotası

En kısa rota:

- bir ana köprü,
- merkezi kavşak,
- rakip başlangıç bölgesi

üzerinden geçer.

Avantaj:

- kısa.

Dezavantaj:

- açık,
- tahmin edilebilir,
- savunulabilir.

---

## 48. Yan Saldırı Rotası

Yan rota:

- orman kenarı,
- ikinci köprü,
- yan kaynak bölgesi

üzerinden geçer.

Avantaj:

- sürpriz,
- dış ekonomiye erişim.

Dezavantaj:

- uzun,
- lojistik maliyeti yüksek.

---

## 49. Baskın Rotası

Hızlı birlikler için:

- orman geçişi,
- sığ geçit,
- tali yol

kullanılabilir.

Baskın rotası ana ordu için aşırı dar olmamalıdır.

---

## 50. Geri Çekilme Rotası

Her ileri bölgeden:

- en az bir ana geri çekilme yolu,
- mümkünse bir alternatif rota

bulunmalıdır.

Oyuncu tek hata sonrası ordusunu kaçınılmaz kaybetmemelidir.

---

# BÖLÜM K — DÜNYA SUNUMU

## 51. Dünya Teması

Hedef tema:

- stilize orta çağ/fantastik sınır vadisi,
- sıcak ve okunabilir renkler,
- düşük yoğunlukta çevresel hikâye,
- temiz low-poly sunum.

---

## 52. Biyom

İlk harita için tek ana biyom önerilir:

- yeşil ova,
- ılıman orman,
- taşlık sırtlar,
- berrak nehir.

Birden fazla biyom ilk vertical slice için gereksizdir.

---

## 53. Çevresel Hikâye

Küçük görsel öğeler:

- eski yol kalıntısı,
- terk edilmiş kamp,
- kırık gözetleme kulesi,
- taş işaretler,
- küçük çiftlik kalıntısı

kullanılabilir.

Bu öğeler oynanış alanını kapatmamalıdır.

---

## 54. Dekor Yoğunluğu

Dekor:

- başlangıç bölgelerinde düşük,
- harita sınırlarında yüksek,
- savaş alanlarında düşük,
- stratejik bölgelerde kontrollü

olmalıdır.

---

## 55. Renk ve Okunabilirlik

- Oyuncu ve AI takım renkleri çevreden ayrılmalı.
- Kaynaklar çevre içinde kaybolmamalı.
- Yol ve kontrol alanı görünümü zeminde okunmalı.
- Stratejik noktalar özel bayrak, taş halka veya totem ile işaretlenmeli.

---

## 56. Gün ve Gece

İlk vertical slice için sabit gündüz aydınlatması önerilir.

Neden:

- görünürlük,
- renk okunabilirliği,
- ek ışık ve AI görüş sistemi maliyetinden kaçınma.

Gece döngüsü gelecekte eklenebilir.

---

# BÖLÜM L — HARİTA ÜRETİM YÖNTEMİ

## 57. El Yapımı Harita

İlk harita tamamen el yapımı olmalıdır.

Avantajları:

- denge kontrolü,
- AI test kolaylığı,
- stratejik akışın doğrulanması,
- performans bütçesi yönetimi.

---

## 58. Procedural Varyasyon

İlk vertical slice içinde tam procedural harita önerilmez.

Gelecekte:

- kaynak varyasyonu,
- orman yoğunluğu,
- küçük dekor değişimi,
- stratejik nokta aktifliği

procedural olabilir.

---

## 59. Harita Katmanları

Önerilen üretim katmanları:

1. Oynanabilir sınır
2. Terrain
3. Geçilemez alanlar
4. Kaynak düğümleri
5. Yol koridorları
6. Stratejik bölgeler
7. Başlangıç alanları
8. Dekor
9. Fog of war verisi
10. AI bölge verisi
11. Navmesh/pathfinding
12. Lojistik düğümler

---

## 60. Bölge Etiketleri

Harita alanları veri olarak etiketlenmelidir.

Örnek:

```text
player_start
ai_start
center_gold
center_stone
west_forest
east_forest
bridge_a
bridge_b
objective_1
objective_2
flank_route_west
flank_route_east
```

Bu etiketler AI ve testlerde kullanılabilir.

---

# BÖLÜM M — AI HARİTA ENTEGRASYONU

## 61. AI Bölge Grafiği

Harita yalnızca fiziksel grid değil, üst seviye bölge grafiği de içermelidir.

Örnek düğümler:

- AI başlangıç
- Oyuncu başlangıç
- Batı yan kaynak
- Doğu yan kaynak
- Merkez
- Köprü A
- Köprü B
- Stratejik Nokta 1
- Stratejik Nokta 2

Kenarlar:

- ulaşım,
- rota maliyeti,
- tehdit,
- stratejik bağlantı

taşır.

---

## 62. AI Genişleme Adayları

Her genişleme alanı:

- kaynak değeri,
- savunulabilirlik,
- yol maliyeti,
- düşmana yakınlık,
- stratejik değer

ile önceden tanımlanabilir.

AI dinamik puanlama yapar; ancak geçerli aday seti tasarımcı tarafından hazırlanabilir.

---

## 63. AI Saldırı Rotaları

Harita üzerinde:

- ana rota,
- yan rota,
- baskın rotası

etiketlenebilir.

AI bunları doğrudan script gibi değil, rota adayları olarak kullanmalıdır.

---

## 64. AI Savunma Bölgeleri

Başlangıç alanında:

- merkez savunması,
- kaynak savunması,
- köprü savunması,
- karakol savunması

gibi alanlar tanımlanabilir.

---

## 65. AI İçin Harita Tuzaklarından Kaçınma

Harita:

- dar çıkmaz,
- tek birimlik geçit,
- görünmez engel,
- aşırı karmaşık bina alanı,
- çok küçük karakol alanı

içermemelidir.

---

# BÖLÜM N — TEKNİK TASARIM

## 66. Terrain ve Navigasyon

Harita verileri:

- terrain yüksekliği,
- geçilebilirlik,
- hareket maliyeti,
- yapı uygunluğu,
- yol uygunluğu,
- görüş engeli

içermelidir.

---

## 67. Navigasyon Katmanları

Önerilen katmanlar:

- Piyade
- Büyük/Kuşatma birimi
- İşçi
- Yapı yerleştirme
- Yol yerleştirme

Tüm birimler aynı nav yarıçapını kullanmamalıdır.

---

## 68. Harita Veri Şeması

Örnek:

```yaml
map:
  id: twin_rivers_01
  bounds:
    width: TBD
    height: TBD
  starts:
    player:
      position: [x, y, z]
      facing: northeast
    ai:
      position: [x, y, z]
      facing: southwest
  objectives:
    - id: objective_center
      type: control_point
      captureRadius: TBD
    - id: objective_north
      type: control_point
      captureRadius: TBD
  regions:
    - id: center_gold
      resourceValue: high
      strategicValue: high
      buildable: true
```

---

## 69. Kaynak Düğümü Verisi

Her kaynak düğümü:

- tür,
- kapasite,
- başlangıç miktarı,
- erişim yarıçapı,
- yapı bağlantı noktası,
- takım başlangıç dengesi etiketi

taşımalıdır.

---

## 70. Stratejik Nokta Verisi

```yaml
objective:
  id: objective_center
  captureRadius: TBD
  captureTime: TBD
  requiredMilitaryWeight: TBD
  requiresTerritoryForFullControl: true
  visionBonus: TBD
```

---

## 71. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- kaynak düğümü kalan miktarları,
- stratejik nokta sahipliği,
- ele geçirme ilerlemesi,
- fog of war keşif durumu,
- yol ağı,
- karakollar,
- değişen dekor veya yıkılmış çevre, uygulanırsa.

---

## 72. Performans Bütçesi

Harita için izlenecek başlıca alanlar:

- toplam aktif yapı,
- toplam aktif birim,
- görünür model sayısı,
- gölge atan nesne sayısı,
- fog of war maliyeti,
- navmesh/pathfinding karmaşıklığı,
- dekoratif obje sayısı,
- su shader maliyeti.

---

## 73. LOD ve Culling

- Uzak dekor düşük detay kullanmalı.
- Harita sınırı objeleri culling ile yönetilmeli.
- Aynı tür ağaç ve taşlar instancing kullanmalı.
- Küçük dekorlar uzak kamerada gizlenebilir.

---

## 74. Su ve Nehir

Nehir:

- düşük maliyetli shader,
- sınırlı yansıma,
- basit akış animasyonu

kullanmalıdır.

Gerçek fizik veya derin su simülasyonu gerekli değildir.

---

# BÖLÜM O — DEBUG VE EDITOR ARAÇLARI

## 75. Harita Debug Görünümleri

Gerekli debug katmanları:

- oynanabilir sınır,
- navmesh,
- yapı uygunluğu,
- yol uygunluğu,
- kontrol grid'i,
- fog of war,
- kaynak erişim alanı,
- stratejik bölge yarıçapı,
- AI bölge grafiği,
- tehdit haritası,
- saldırı rotaları.

---

## 76. Harita Doğrulama Aracı

Otomatik kontroller:

- başlangıç kaynakları var mı,
- iki tarafın kaynak değeri dengeli mi,
- tüm stratejik noktalar erişilebilir mi,
- kuşatma birimi tüm ana rotaları kullanabiliyor mu,
- karakol kurulabilir alanlar yeterli mi,
- köprüler navmesh'e bağlı mı,
- çıkmaz yol veya sıkışma alanı var mı.

---

## 77. Test Spawn Noktaları

Editor içinde:

- başlangıç,
- merkez,
- köprü,
- stratejik nokta,
- yan kaynak,
- AI üs önü

için test spawn noktaları bulunmalıdır.

---

# BÖLÜM P — EDGE CASE'LER

## 78. Başlangıç Kaynağı Yapılamaz Durumdaysa

- harita doğrulama hatası vermelidir,
- oyun başlamamalı veya fallback konum kullanılmalıdır.

---

## 79. Bir Stratejik Noktaya Yol Yoksa

- harita doğrulama aracı erişim testi yapmalıdır,
- kuşatma ve piyade için ayrı kontrol edilmelidir.

---

## 80. Karakol Alanı Eğim Nedeniyle Kullanılamıyorsa

- etki alanı çevresinde en az bir geçerli yapı bölgesi bulunmalıdır,
- tasarım aşamasında düzeltilmelidir.

---

## 81. Orman Tamamen Yok Edilirse

Odun hasadı ağaç modellerini kaldırıyorsa:

- navmesh güncellenebilir,
- yeni yol veya yapı alanı açılabilir.

İlk vertical slice için dinamik navmesh güncellemesi pahalıysa:

- ağaçlar kaynak kapasitesi düşse bile fiziksel olarak tamamen kaybolmayabilir,
- yalnızca görsel seyrelme uygulanabilir.

---

## 82. Köprüde Büyük Grup Sıkışırsa

- köprü yeterli genişlikte olmalı,
- grup hareketi sütun düzenine geçmeli,
- köprü başında yapı kurma engellenmelidir.

---

## 83. Oyuncu Merkezde Tam Savunmaya Kapanırsa

Harita:

- merkezi kaynakları değerli tutmalı,
- bölgesel zaferi aktif kılmalı,
- başlangıç kaynaklarını sınırlı tutmalıdır.

---

## 84. AI Yan Rotayı Hiç Kullanmazsa

- rota maliyeti ve tehdit puanları incelenir,
- AI bölge grafiği debug edilir,
- yan rota yeterince değerli hale getirilir.

---

# BÖLÜM Q — TEST PLANI

## 85. Harita Test Senaryoları

### Test 1 — Başlangıç dengesi

- Oyuncu ve AI kaynak erişim süreleri ölçülür.
- Büyük fark olmamalıdır.

### Test 2 — İlk genişleme

- Her taraf ilk dış kaynak alanına karakol ve yol kurar.
- Alan, yol ve yapı yerleşimi sorunsuz olmalıdır.

### Test 3 — Merkez çatışması

- İki taraf merkezi altın bölgesine yönelir.
- Alan yeterli savaş genişliği sağlamalıdır.

### Test 4 — Yan rota

- Küçük baskın grubu yan rotayı kullanır.
- Rota ana yoldan anlamlı biçimde farklı olmalıdır.

### Test 5 — Köprü savaşı

- Büyük grup köprüden geçer.
- Kalıcı sıkışma olmamalıdır.

### Test 6 — Bölgesel zafer

- İki stratejik nokta ele geçirilir.
- Savunma ve karşı saldırı mümkün olmalıdır.

### Test 7 — Karakol kaybı

- Dış bölge karakolu yıkılır.
- Yerleşim kontrol dışı duruma geçer.
- Yeniden ele geçirme mümkün olmalıdır.

### Test 8 — Fog of war

- Keşif, son bilinen bilgi ve karakol görüşü test edilir.

### Test 9 — AI rota seçimi

- AI ana ve yan rotaları farklı durumlarda kullanır.

### Test 10 — Save/load

- Kaynak, fog, stratejik bölge ve yol durumu korunur.

---

## 86. Uzun Süreli Harita Testleri

- 20+ AI simülasyonu
- farklı zorluklar
- farklı erken baskı durumları
- oyuncu savunmaya kapanma testi
- hızlı çağ atlama testi
- yalnız bölgesel zafer testi
- yalnız askerî zafer testi

uygulanmalıdır.

---

## 87. Telemetri

İzlenecek değerler:

- ilk dış bölgeye ulaşım süresi,
- ilk stratejik nokta teması,
- ilk köprü çatışması,
- kullanılan saldırı rotası dağılımı,
- yan rota kullanım oranı,
- merkezi kaynak kontrol süresi,
- başlangıçta kullanılmayan alanlar,
- karakol kurma noktaları,
- yol uzunlukları,
- sıkışma bölgeleri,
- fog altında kalma oranı,
- maç süresi,
- zafer türü,
- merkezde kapanma süresi,
- AI rota tekrarları.

---

# BÖLÜM R — VERTICAL SLICE KAPSAMI

## 88. Zorunlu Harita Özellikleri

- Tek el yapımı harita
- İki başlangıç alanı
- Güvenli kaynak setleri
- İki yan genişleme alanı
- Merkezi yüksek değerli kaynak
- İki stratejik nokta
- İki ana köprü veya geçit
- En az bir yan baskın rotası
- Fog of war
- Karakol kurulabilir alanlar
- Yol koridorları
- AI bölge grafiği
- Harita debug katmanları
- Performans culling
- Save/load desteği

---

## 89. Ertelenebilecek Özellikler

- Procedural harita
- Dinamik köprü inşası
- Yıkılabilir köprü
- Gün/gece döngüsü
- Hava durumu
- Çoklu biyom
- Yüksek zemin savaş bonusu
- Nehir akıntısı
- Dinamik arazi deformasyonu
- Gizli mağara veya tünel
- Tarafsız kamp
- Nötr NPC krallık
- Harita içi görev zinciri

---

## 90. İlk Teknik Test Haritası

İlk teknik harita:

- düz zemin,
- iki merkez,
- tek kaynak alanı,
- tek köprü,
- tek karakol alanı,
- tek stratejik nokta

ile başlayabilir.

Amaç:

- pathfinding,
- kontrol alanı,
- yol bağlantısı,
- AI rota seçimi

doğrulamaktır.

---

# BÖLÜM S — AÇIK SORULAR VE KARARLAR

## 91. Açık Tasarım Soruları

### Harita ölçeği

- Tam dünya ölçüsü ne olmalı?
- Rakip merkezler arası yürüyüş süresi kaç saniye olmalı?
- Haritanın aktif birim üst sınırı nedir?
- Kamera sınırı ne kadar dış tampon içermeli?

### Kaynaklar

- Başlangıç altını Kasaba çağına tek başına yetmeli mi?
- Merkezi kaynaklarda altın ve taş aynı bölgede mi olmalı?
- Yan bölgeler iki taraf için eşit değerli mi, farklı mı olmalı?
- Ormanlar tamamen tükenince yol açılmalı mı?

### Geçitler

- İki ana köprü + bir sığ geçit fazla mı?
- Köprüler aynı genişlikte mi olmalı?
- Yan geçit süvariye özel avantaj vermeli mi?
- Geçit çevresinde kule yerleşimi sınırlandırılmalı mı?

### Stratejik noktalar

- İki nokta mı, üç nokta mı kullanılmalı?
- Noktalar başlangıçta görünür mü olmalı?
- Nokta bonusu yalnız görüş mü olmalı?
- Bölgesel zafer için iki noktanın ikisi de mi gerekli olmalı?

### Fog of war

- Düşman yapıları son görüldüğü haliyle haritada kalmalı mı?
- Stratejik noktalar bilinmeyen alanda baştan görünür mü olmalı?
- AI çağ atlama bildirimi fog bağımsız mı olmalı?
- Keşfedilmiş kaynaklar minimap'te kalmalı mı?

---

## 92. Şimdilik Alınmış Kararlar

- İlk harita el yapımı olacaktır.
- Harita çalışma adı `İki Nehir Arası` olacaktır.
- Oyuncu güneybatıda, AI kuzeydoğuda başlayacaktır.
- Harita yaklaşık simetrik fakat birebir ayna olmayan yapıda olacaktır.
- Her taraf güvenli yiyecek, odun, küçük taş ve küçük altınla başlayacaktır.
- Başlangıç kaynakları tam geç oyun ekonomisine yetmeyecektir.
- Haritada iki yan genişleme bölgesi bulunacaktır.
- Merkezde yüksek değerli altın ve taş bulunacaktır.
- Harita iki ana geçit ve en az bir yan baskın rotası içerecektir.
- Sabit köprüler kullanılacaktır.
- Yıkılabilir veya oyuncu yapımı köprü ilk vertical slice içinde olmayacaktır.
- İki ana stratejik nokta kullanılacaktır.
- Stratejik noktaların ana bonusu bölgesel zafer ve görüş olacaktır.
- Karakol kurmak için stratejik noktaların çevresinde uygun alan bulunacaktır.
- Harita tek ana biyom kullanacaktır.
- Sabit gündüz aydınlatması kullanılacaktır.
- Fog of war üç durumlu olacaktır: bilinmeyen, keşfedilmiş, görünür.
- AI için üst seviye bölge grafiği hazırlanacaktır.
- Ana, yan ve baskın rotaları aday rota olarak etiketlenecektir.
- Harita doğrulama ve debug araçları vertical slice için zorunludur.
- Tam procedural harita ilk vertical slice içinde bulunmayacaktır.

---

## 93. Diğer Dokümanlarla Bağlantılar

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - stratejik nokta sayısı,
  - bölgesel zafer süresi,
  - harita tabanlı yenilgi baskısı.

- `10_CAMERA_CONTROLS_AND_UI.md`
  - minimap,
  - fog of war,
  - kontrol alanı görünümü,
  - stratejik nokta göstergeleri.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - biyom,
  - çevre model eşleştirmesi,
  - köprü, yol ve kaynak görselleri,
  - takım renkleri.

- `12_BALANCE_AND_GAME_DATA.md`
  - kaynak miktarları,
  - yürüyüş süreleri,
  - görüş yarıçapları,
  - ele geçirme alanları.

- `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`
  - blockout,
  - navmesh,
  - kaynak yerleşimi,
  - AI bölge grafiği,
  - harita test fazları.

---

## 94. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] İlk harita konsepti anlaşılırdır.
- [ ] Başlangıç bölgeleri ve kaynak dengesi yeterlidir.
- [ ] Merkezi ve yan kaynak katmanları kabul edilmiştir.
- [ ] İki ana rota ve yan baskın rotası yaklaşımı onaylanmıştır.
- [ ] Köprü ve doğal engel kullanımı nettir.
- [ ] Stratejik nokta sayısı ve rolleri kabul edilmiştir.
- [ ] Fog of war yaklaşımı onaylanmıştır.
- [ ] AI bölge grafiği ve rota etiketleri gerekli bulunmuştur.
- [ ] Harita performans bütçesi göz önüne alınmıştır.
- [ ] Vertical slice harita kapsamı gerçekçi bulunmuştur.
- [ ] Açık sorular sonraki dokümanlara aktarılmıştır.

---

## 95. Kontrol Listesi

### Genel yapı

- [ ] Harita konsepti tanımlandı.
- [ ] Çalışma adı belirlendi.
- [ ] Oyuncu başlangıcı tanımlandı.
- [ ] AI başlangıcı tanımlandı.
- [ ] Hedef harita ölçeği tanımlandı.
- [ ] Harita sınırı yaklaşımı tanımlandı.

### Kaynaklar

- [ ] Güvenli kaynaklar tanımlandı.
- [ ] Yan genişleme kaynakları tanımlandı.
- [ ] Merkezi kaynaklar tanımlandı.
- [ ] Kaynak simetrisi yaklaşımı tanımlandı.
- [ ] Sabit kaynak dağılımı kararı verildi.

### Doğal engeller

- [ ] Nehir rolü tanımlandı.
- [ ] Köprü sayısı tanımlandı.
- [ ] Orman rolü tanımlandı.
- [ ] Dağ ve kayalıklar tanımlandı.
- [ ] Açık arazi tanımlandı.
- [ ] Dar geçit genişliği değerlendirildi.

### Stratejik bölgeler

- [ ] Stratejik nokta sayısı belirlendi.
- [ ] Merkez noktası tanımlandı.
- [ ] Yan geçit noktası tanımlandı.
- [ ] Ele geçirme alanı tanımlandı.
- [ ] Bonuslar sınırlandırıldı.

### Yol ve rota

- [ ] Doğal yol koridorları tanımlandı.
- [ ] Kısa ve güvenli rota kararı tanımlandı.
- [ ] Yan ekonomi rotaları tanımlandı.
- [ ] Yol düğümleri listelendi.
- [ ] Ana saldırı rotası tanımlandı.
- [ ] Yan saldırı rotası tanımlandı.
- [ ] Baskın rotası tanımlandı.
- [ ] Geri çekilme rotası tanımlandı.

### Fog ve dünya sunumu

- [ ] Fog durumları tanımlandı.
- [ ] Son bilinen bilgi yaklaşımı değerlendirildi.
- [ ] Görüş kaynakları tanımlandı.
- [ ] Dünya teması tanımlandı.
- [ ] Biyom tanımlandı.
- [ ] Dekor yoğunluğu tanımlandı.
- [ ] Sabit gündüz kararı verildi.

### Teknik ve AI

- [ ] Harita katmanları tanımlandı.
- [ ] Bölge etiketleri tanımlandı.
- [ ] AI bölge grafiği tanımlandı.
- [ ] AI genişleme adayları tanımlandı.
- [ ] AI rota adayları tanımlandı.
- [ ] Terrain ve navigasyon verileri tanımlandı.
- [ ] Harita veri şeması taslaklandı.
- [ ] Save/load gereksinimleri tanımlandı.
- [ ] Performans bütçesi tanımlandı.
- [ ] Debug katmanları listelendi.
- [ ] Harita doğrulama aracı tanımlandı.

### Test

- [ ] Başlangıç dengesi testi tanımlandı.
- [ ] İlk genişleme testi tanımlandı.
- [ ] Merkez çatışması testi tanımlandı.
- [ ] Yan rota testi tanımlandı.
- [ ] Köprü savaşı testi tanımlandı.
- [ ] Bölgesel zafer testi tanımlandı.
- [ ] AI rota seçimi testi tanımlandı.
- [ ] Save/load testi tanımlandı.
- [ ] Telemetri değerleri listelendi.

---

## 96. Revizyon Notları

### Sürüm 0.1

- İlk vertical slice haritası `İki Nehir Arası` olarak tanımlandı.
- Oyuncu ve AI başlangıç bölgeleri oluşturuldu.
- Güvenli, yan ve merkezi kaynak dağılımı tasarlandı.
- Nehir, köprü, orman ve dar geçit rolleri tanımlandı.
- İki stratejik nokta ve bölgesel zafer bağlantısı oluşturuldu.
- Ana, yan ve baskın saldırı rotaları tanımlandı.
- Fog of war ve keşif sistemi oluşturuldu.
- Dünya teması, biyom ve dekor yoğunluğu belirlendi.
- AI bölge grafiği, rota adayları ve harita etiketleri tanımlandı.
- Teknik veri, performans, debug, edge case ve test bölümleri eklendi.

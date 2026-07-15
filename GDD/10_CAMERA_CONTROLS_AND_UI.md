# 10 — Camera, Controls and User Interface

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Kamera, Kontroller ve Kullanıcı Arayüzü  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:** `00_GAME_VISION_AND_PILLARS.md` – `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. Minimap, fog of war overlay'i ve gerçek pause koşulludur; çelişki halinde 13 v0.2 esastır. Forge'a özgü teknik hizalama (mevcut viewport kamera/seçim altyapısı) için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman oyuncunun oyunu nasıl gördüğünü, nasıl kontrol ettiğini ve oyun durumunu kullanıcı arayüzünden nasıl okuduğunu tanımlar.

Belge şu sorulara cevap verir:

- Kamera nasıl hareket eder ve hangi sınırlar içinde çalışır?
- Birimler ve yapılar nasıl seçilir?
- Sağ tık bağlamsal komutları nasıl davranır?
- Yapı yerleştirme ve yol çizme araçları nasıl kullanılır?
- Kaynak, nüfus, Refah, çağ ve zafer bilgileri nerede gösterilir?
- Lojistik ağı ve kontrol alanı nasıl görselleştirilir?
- Minimap ve fog of war nasıl çalışır?
- Uyarılar hangi önceliklerle sunulur?
- Hangi klavye kısayolları vertical slice için gereklidir?
- Web tarayıcısı ve farklı ekran çözünürlükleri nasıl ele alınır?

---

## 2. Tasarım Hedefi

Kamera ve arayüz oyuncuya şu hissi vermelidir:

> “Haritada olanları rahatça okuyabiliyorum, önemli tehditleri kaçırmıyorum ve istediğim komutu mümkün olduğunca az adımla verebiliyorum.”

Sistem:

- RTS oyuncularına tanıdık,
- yeni oyuncular için açıklayıcı,
- harita görünümünü gereksiz yere kapatmayan,
- lojistik ve bölge sistemlerini görünür kılan,
- farklı masaüstü çözünürlüklerinde çalışabilen,
- web tarayıcısında güvenilir

olmalıdır.

---

## 3. Ana Tasarım İlkeleri

### 3.1 Tanıdık RTS kontrol düzeni

- Sol tık seçim yapar.
- Sürükleme kutu seçimi yapar.
- Sağ tık bağlamsal komut verir.
- Fare tekerleği zoom yapar.
- WASD ve ekran kenarı kamera hareketi sağlar.

### 3.2 Bilgi önceliği

Arayüz üç katmana ayrılır:

1. Sürekli gerekli bilgiler
2. Seçime bağlı bilgiler
3. Kritik ve geçici uyarılar

### 3.3 Harita görünürlüğü önceliklidir

UI, savaş alanını ve yapı girişlerini kapatmamalıdır. Büyük sabit paneller yerine bağlamsal paneller tercih edilmelidir.

### 3.4 Sistem nedenlerini açıklamalıdır

Bir yapı çalışmıyorsa oyuncu nedenini görmelidir:

- bağlantısız,
- kontrol alanı dışında,
- işçi yok,
- kaynak tükendi,
- yerel stok dolu,
- çağ seviyesi yetersiz.

### 3.5 Uyarılar gruplanmalıdır

Aynı olay her saniye tekrar edilmemelidir. Benzer bildirimler tek başlık altında toplanmalıdır.

---

# BÖLÜM A — KAMERA

## 4. Kamera Türü

Oyun üstten eğimli bir RTS kamerası kullanacaktır.

Hedef görünüm:

- bina ön ve yan yüzleri okunabilir,
- birim siluetleri kaybolmaz,
- yol ve kontrol alanı görülebilir,
- yapı yerleştirme hassas yapılabilir.

Perspektif ile ortografik kamera Forge sahne testlerinde karşılaştırılacaktır. Başlangıç tercihi hafif perspektifli kameradır.

---

## 5. Kamera Açısı

Başlangıç açısı yaklaşık 45–60 derece eğimli olmalıdır.

Aşırı yatık kamera:

- yapıların birbirini kapatmasına,
- zemin planlamasının zorlaşmasına

neden olabilir.

Aşırı dik kamera ise asset setinin üç boyutlu okunabilirliğini azaltır.

---

## 6. Kamera Hareketi

Desteklenecek yöntemler:

- `WASD`
- Ok tuşları
- Ekran kenarı kaydırma
- Orta fare tuşuyla sürükleme, opsiyonel

Vertical slice için WASD ve ekran kenarı kaydırma zorunludur.

---

## 7. Kamera Hızı

Kamera hızı zoom seviyesine göre değişmelidir:

- yakında daha yavaş,
- uzakta daha hızlı.

Ayarlar menüsünde kamera hızı seçeneği bulunmalıdır.

---

## 8. Kamera Yumuşatma

Kısa hızlanma ve yavaşlama kullanılabilir. Aşırı kaygan hareketten kaçınılmalıdır.

Ayar:

- Kamera yumuşatma: Açık / Kapalı

---

## 9. Zoom

Fare tekerleği ile zoom yapılır.

Yakın sınır:

- tek birim ve yapı detaylarını göstermeli,
- model içine girmemelidir.

Uzak sınır:

- küçük bir bölgeyi göstermeli,
- tüm haritayı tek ekranda görünür hale getirmemelidir.

Zoom, fare imlecinin bulunduğu dünya noktasına doğru çalışmalıdır.

---

## 10. Kamera Dönüşü

İlk vertical slice içinde kamera yönü sabit olacaktır.

Bu karar:

- minimap yönünü sabit tutar,
- bina girişlerini daha okunabilir yapar,
- seçim ve yerleştirme hatalarını azaltır,
- geliştirme kapsamını sınırlar.

Gelecekte 90 derece adımlı dönüş değerlendirilebilir.

---

## 11. Kamera Sınırları

Kamera oynanabilir harita ve sınırlı görsel tampon içinde kalmalıdır.

Sınırda:

- sert sekme olmamalı,
- yumuşak durdurma kullanılmalıdır.

---

## 12. Kamera Odaklama

Desteklenecek yöntemler:

- Minimap tıklaması
- Uyarıya tıklama
- Seçili hedefe odaklama
- Kontrol grubuna çift basma, uygulanırsa

Oyuncunun kamerası savaş sırasında otomatik olarak zorla taşınmamalıdır.

---

## 13. Kamera Sallantısı

Yalnızca büyük kuşatma vuruşları ve merkez yıkımı gibi nadir olaylarda düşük seviyede kullanılabilir.

Ayarlar menüsünden kapatılabilmelidir.

---

# BÖLÜM B — GİRDİ SİSTEMİ

## 14. Girdi Önceliği

Önerilen öncelik:

1. Modal pencere
2. Aktif yapı veya yol yerleştirme modu
3. UI üzerindeki fare
4. Dünya seçimi ve komutları
5. Kamera kenar kaydırma

UI üzerine tıklamak dünya komutu oluşturmamalıdır.

---

## 15. Sol Tık

Sol tık:

- birim veya yapı seçer,
- yapı yerleştirmeyi onaylar,
- UI butonlarını çalıştırır,
- minimap üzerinde kamerayı taşır.

---

## 16. Sağ Tık

Sağ tık bağlama göre:

- boş zemin → hareket,
- düşman → saldırı,
- hasarlı dost yapı + işçi → onarım,
- üretim yapısı + işçi → görevlendirme,
- stratejik nokta → hareket veya ele geçirme,
- aktif yerleştirme modu → iptal

olarak çalışır.

---

## 17. Fare Tekerleği

Dünya üzerinde zoom yapar.

Bir UI listesi üzerindeyken paneli kaydırır; kamera zoom'u çalışmaz.

---

## 18. Tarayıcı Çakışmaları

Kontrol edilmesi gerekenler:

- sağ tık tarayıcı menüsü,
- orta tuş otomatik scroll,
- sayfa scroll'u,
- tarayıcı zoom kısayolları,
- pencere odağı kaybı,
- tam ekrandan çıkış.

Oyun alanında sağ tık tarayıcı menüsü engellenmelidir.

---

## 19. Pencere Odağı Kaybı

Tarayıcı odağı kaybettiğinde:

- oyun otomatik duraklatılabilir,
- basılı tuş durumları sıfırlanır,
- seçim kutusu iptal edilir,
- kamera hareketi durur.

---

# BÖLÜM C — SEÇİM SİSTEMİ

## 20. Tekli Seçim

Bir dost birim veya yapı sol tıkla seçilir.

Geri bildirim:

- seçim halkası,
- sağlık çubuğu,
- bilgi paneli,
- geçerli komutlar.

---

## 21. Seçimi Temizleme

Boş zemine sol tık mevcut seçimi temizler.

`Esc`:

- önce aktif komut veya yerleştirme modunu iptal eder,
- tekrar basılırsa seçimi temizleyebilir.

---

## 22. Kutu Seçimi

Sol tuşla sürükleme dost birimleri seçer.

Varsayılan olarak yapılar kutu seçimine dahil edilmez.

Vertical slice kararı:

- kutu içindeki tüm dost birimler seçilir,
- grup paneli türlere göre özet gösterir.

---

## 23. Shift ile Seçim

`Shift + sol tık`:

- birimi seçime ekler,
- seçili birimi seçimden çıkarır.

---

## 24. Çift Tıklama

Bir birime çift tıklamak ekranda görünen aynı tür birimleri seçer.

Tüm haritadaki birimleri seçmek ilk sürümde önerilmez.

---

## 25. Kontrol Grupları

Önerilen klasik düzen:

- `Ctrl + 1–9` → gruba ata
- `1–9` → grubu seç
- aynı rakama çift bas → kamerayı gruba odakla

Kapsam baskısı oluşursa son geliştirme fazına bırakılabilir.

---

## 26. Seçim Önceliği

Üst üste görünen nesnelerde:

- birim collider'ı,
- yapı taban collider'ı,
- görünür ekran konumu

kullanılarak en mantıklı hedef seçilmelidir.

---

# BÖLÜM D — BİRİM KOMUTLARI

## 27. Temel Komutlar

Vertical slice içinde:

- Hareket
- Saldır
- Saldırı-Hareket
- Dur
- Pozisyonu Koru
- İnşa, işçi için
- Onar, işçi için

bulunacaktır.

---

## 28. Saldırı-Hareket

Önerilen kısayol: `A`

Akış:

```text
A
→ saldırı-hareket imleci
→ hedef zemine sol tık
→ grup ilerler ve karşılaştığı düşmanlara saldırır
```

Sağ tık veya Esc modu iptal eder.

---

## 29. Dur

Önerilen kısayol: `S`

Birim mevcut komutu bırakır ve stance davranışına geçer.

---

## 30. Pozisyonu Koru

Önerilen kısayol: `H`

Birim uzak hedefi kovalamaz ve belirlenen alanı savunur.

---

## 31. Komut Geri Bildirimi

Dünya üzerinde kısa süreli işaretler:

- hareket,
- saldırı,
- onarım,
- geçersiz komut

kullanılmalıdır.

---

## 32. Rally Point

Askerî yapı seçildiğinde sağ tıkla rally point belirlenir.

Gösterilecek:

- yapıdan hedefe çizgi,
- dünya işareti,
- geçersiz hedef uyarısı.

---

# BÖLÜM E — YAPI YERLEŞTİRME

## 33. Yapı Menüsü

Yapı menüsü işçi seçildiğinde açılır.

Kategoriler:

- Ekonomi
- Konut
- Askerî
- Savunma
- Lojistik

---

## 34. Yapı Kartı

Her kart:

- ikon,
- isim,
- kaynak maliyeti,
- çağ gereksinimi,
- kısa görev açıklaması,
- kilit durumu

sunmalıdır.

---

## 35. Ghost Önizleme

Yerleştirme sırasında:

- yapı modeli veya sade ghost,
- footprint,
- yön,
- giriş noktası,
- kontrol alanı uygunluğu,
- zemin uygunluğu,
- yol bağlantısı,
- toplam maliyet

gösterilir.

---

## 36. Geçersiz Yerleştirme Nedenleri

Örnek mesajlar:

- Kontrol alanı dışında
- Zemin çok eğimli
- Kaynak düğümü gerekli
- Başka yapıyla çakışıyor
- Düşman alanına çok yakın
- Yetersiz kaynak
- Karakollar birbirine çok yakın

---

## 37. Döndürme

Önerilen kısayol: `R`

Yapılar 90 derece adımlarla döndürülür.

---

## 38. Yerleştirme Kontrolleri

- Sol tık → onayla
- Sağ tık / Esc → iptal
- Shift + sol tık → aynı yapıdan çoklu yerleştirme, opsiyonel

---

## 39. Karakol Önizlemesi

Karakol yerleştirilirken:

- bağlantısız küçük kontrol alanı,
- ana ağa bağlandığında oluşacak tam alan,
- düşman alanı çakışması,
- minimum mesafe,
- açılacak kaynaklar

gösterilmelidir.

---

# BÖLÜM F — YOL ÇİZME ARACI

## 40. Yol Aracına Erişim

Yol aracı:

- işçi yapı menüsünün lojistik kategorisinden,
- opsiyonel klavye kısayolundan

açılır.

---

## 41. Yol Çizim Akışı

```text
Yol aracını seç
→ başlangıç noktasına tıkla
→ imleci hareket ettir
→ otomatik rota önizle
→ bitiş noktasına tıkla
→ maliyeti onayla
```

---

## 42. Yol Önizlemesi

Gösterilecek:

- önerilen rota,
- segment sayısı,
- toplam maliyet,
- geçersiz segmentler,
- bağlanacak yapılar,
- aktif hale gelecek yapılar,
- yol seviyesi.

---

## 43. Ara Kontrol Noktaları

Vertical slice içinde başlangıç ve bitiş noktası yeterlidir.

Ara kontrol noktaları daha sonra eklenebilir.

---

## 44. Yol Silme

Yol silme işleminde bağlantı etkisi önceden gösterilir.

Örnek:

> Bu yolu kaldırmak 2 üretim yapısını bağlantısız bırakacak.

---

## 45. Yol Yükseltme

Vertical slice için iki düğüm arasındaki hattı toplu yükseltme önerilir.

Tek tek segment yükseltmek fazla mikro yönetim yaratabilir.

---

# BÖLÜM G — ANA HUD

## 46. Önerilen Yerleşim

### Üst sol

- Yiyecek
- Odun
- Taş
- Altın
- Nüfus
- Refah

### Üst orta

- Mevcut çağ
- Çağ atlama ilerlemesi
- Kritik olduğunda zafer sayacı

### Üst sağ

- Maç süresi
- Duraklatma
- Ayarlar

### Alt sol

- Minimap

### Alt orta

- Seçili birim veya yapı paneli
- Komutlar
- Üretim kuyruğu

### Alt sağ

- Yapı veya üretim seçenekleri

---

## 47. Kaynak Çubuğu

Örnek:

```text
Yiyecek  340  +24/dk
Odun     280  +18/dk
Taş      120   +8/dk
Altın     90   +6/dk
Nüfus     26/35
Refah        58 ↑
```

---

## 48. Gelir Hızı

Gelir hızı kısa hareketli ortalama üzerinden hesaplanır.

Sürekli gösterilebilir veya düşük çözünürlükte tooltip içine taşınabilir.

---

## 49. Nüfus Göstergesi

- Normal: nötr
- Sınıra yakın: uyarı tonu
- Dolu: kritik vurgu ve bildirim

Nüfus doluyken yeni birim üretiminin neden başlamadığı açıkça gösterilmelidir.

---

## 50. Refah Göstergesi

Refah:

- sayı,
- yükseliyor/düşüyor oku,
- durum ikonu

ile gösterilir.

Tooltip:

- olumlu nedenler,
- olumsuz nedenler,
- sonraki çağ eşiği.

---

## 51. Çağ Göstergesi

- Mevcut çağ adı
- Çağ ikonu
- Sonraki çağ gereksinimleri
- Aktif yükseltme süresi

sunulmalıdır.

---

# BÖLÜM H — SEÇİLİ NESNE PANELİ

## 52. Birim Paneli

Tek birim için:

- ikon veya portre,
- isim,
- seviye,
- sağlık,
- saldırı,
- menzil,
- hareket hızı,
- mevcut görev,
- stance,
- güçlü ve zayıf hedefler.

---

## 53. Yapı Paneli

Tek yapı için:

- isim ve seviye,
- sağlık,
- ana işlev,
- işçi sayısı,
- üretim hızı,
- yerel stok,
- yol bağlantısı,
- kontrol durumu,
- üretim kuyruğu,
- yükseltme,
- onarım,
- kaldırma.

---

## 54. Çoklu Birim Paneli

- Tür ikonları
- Tür başına sayı
- Grup sağlık özeti
- Ortak komutlar

Bir tür ikonuna tıklamak yalnızca o türü seçebilir.

---

## 55. Üretim Kuyruğu

Gösterilecek:

- aktif üretim,
- kalan süre,
- sıradaki siparişler,
- iptal butonu,
- nüfus veya kaynak engeli.

---

## 56. İşçi Atama Paneli

Üretim yapısında:

- çalışan işçi sayısı,
- maksimum kapasite,
- üretim hızı,
- boşta işçi bilgisi,
- `+` ve `-` atama kontrolleri

bulunabilir.

Doğrudan işçi seçip sağ tıklama yöntemi de korunacaktır.

---

# BÖLÜM I — MİNİMAP

## 57. Minimap Öğeleri

- oyuncu birimleri,
- oyuncu yapıları,
- görülen düşmanlar,
- stratejik noktalar,
- karakollar,
- ana merkezler,
- kamera görüş alanı,
- uyarı pingleri.

---

## 58. Fog of War

Minimap ana dünya ile aynı fog kurallarını kullanır.

Görünmeyen düşman birimleri gösterilmez.

Son görülen düşman yapıları soluk işaret olarak kalabilir.

---

## 59. Minimap Etkileşimi

Vertical slice için:

- sol tık → kamerayı taşı,
- sürükleme → kamerayı hareket ettir.

Sağ tıkla birlik gönderme sonraki faza bırakılabilir.

---

## 60. Minimap Renkleri

Takım ve durum ayrımı yalnızca renge bağlı olmamalıdır.

- Oyuncu: takım rengi + şekil
- AI: karşı renk + farklı şekil
- Nötr nokta: nötr simge
- Tartışmalı nokta: animasyon veya çift sınır
- Kritik olay: ping halkası

---

# BÖLÜM J — LOJİSTİK VE KONTROL GÖRÜNÜMÜ

## 61. Lojistik Overlay

Önerilen kısayol: `L`

Bu modda:

- yollar vurgulanır,
- merkez ve depolar düğüm olarak görünür,
- bağlantısız yapılar işaretlenir,
- seçili yapının ana rotası gösterilir,
- alternatif rota gösterilir,
- kontrol alanı görünür hale gelir.

---

## 62. Normal ve Teknik Görünüm Ayrımı

Normal görünüm temiz kalmalıdır.

Lojistik overlay:

- bağlantı çizgileri,
- düğüm durumları,
- kontrol sınırları,
- kesinti noktaları

gibi teknik bilgileri gösterir.

---

## 63. Kontrol Alanı

Kontrol alanı:

- yapı yerleştirirken otomatik,
- karakol seçildiğinde bağlamsal,
- lojistik modunda tam

görünmelidir.

---

## 64. Bağlantı Durumları

UI terimleri:

- Tam bağlı
- Yedek rota mevcut
- Bağlantısız
- Kontrol dışında
- Yerel stok dolu
- Kritik kesinti riski

---

## 65. Alternatif Rota

Seçili yapı için:

- ana rota düz çizgi,
- alternatif rota kesik çizgi

ile gösterilebilir.

---

# BÖLÜM K — UYARILAR

## 66. Kritik Uyarılar

- Ana merkez saldırı altında
- Bölgesel yenilgiye 30 saniye kaldı
- Tüm yiyecek üretimi durmuş
- Son işçiler saldırı altında

---

## 67. Önemli Uyarılar

- Karakol saldırı altında
- Dış depo yok edildi
- Nüfus sınırı doldu
- Altın madeni tükendi
- Ana yol bağlantısı kesildi

---

## 68. Bilgi Bildirimleri

- Çağ atlandı
- Yapı tamamlandı
- Yükseltme tamamlandı
- Yeni bölge ele geçirildi
- Yeni kaynak keşfedildi

---

## 69. Bildirim Sunumu

Bir bildirim:

- ikon,
- kısa metin,
- ses,
- minimap ping,
- tıklanabilir konum

kullanabilir.

---

## 70. Bildirim Kuyruğu

- Benzer bildirimler gruplanır.
- Kritik bildirimler öncelik alır.
- Eski bilgi bildirimleri otomatik kaybolur.
- Aynı durum belirli aralıktan daha sık tekrarlanmaz.

---

# BÖLÜM L — ZAFER VE MAÇ SONU UI

## 71. Zafer Hedef Paneli

Küçük bir hedef paneli:

- düşman merkez durumu,
- stratejik nokta kontrolü,
- bölgesel sayaç

gösterebilir.

---

## 72. Bölgesel Sayaç

Sayaç başladığında üst orta bölgede belirginleşir.

Gösterilecek:

- hangi tarafın sayacı,
- kalan süre,
- kontrol edilen noktalar,
- durdu veya geriliyor durumu.

---

## 73. Merkez Sağlık Uyarısı

Merkez kritik sağlık eşiklerinde:

- ekran kenarı uyarısı,
- sağlık yüzdesi,
- kamerayı merkeze taşı butonu,
- ses bildirimi

sunulur.

---

## 74. Teslim Olma

Duraklatma menüsünde bulunur ve onay ister.

---

## 75. Maç Sonu Ekranı

Gösterilecek:

- Zafer / Yenilgi
- Sonuç türü
- Maç süresi
- Ulaşılan çağ
- Toplanan kaynaklar
- Üretilen ve kaybedilen birimler
- Yıkılan yapılar
- Karakol sayısı
- Stratejik nokta kontrol süresi
- Oyuncu–AI karşılaştırması
- Yeniden Oyna
- Ana Menü

---

# BÖLÜM M — MENÜLER VE AYARLAR

## 76. Ana Menü

- Yeni Maç
- Ayarlar
- Krediler
- Çıkış veya ana sayfaya dönüş

---

## 77. Yeni Maç

- Harita bilgisi
- Zorluk
- Takım rengi, opsiyonel
- Başlat

Tek harita varsa seçim alanı bilgi amaçlı gösterilebilir.

---

## 78. Duraklatma Menüsü

- Devam Et
- Kaydet
- Yükle
- Ayarlar
- Teslim Ol
- Ana Menü

Tek oyunculu oyunda gerçek duraklatma kullanılacaktır.

---

## 79. Grafik Ayarları

- Çözünürlük ölçeği
- Gölge kalitesi
- Efekt kalitesi
- Kamera sallantısı
- Tam ekran

---

## 80. Ses Ayarları

- Ana ses
- Müzik
- Efekt
- UI sesleri

---

## 81. Kontrol Ayarları

- Kamera hızı
- Kenar kaydırma
- Kamera yumuşatma
- Zoom hassasiyeti
- Kısayol listesi

Tam kısayol yeniden atama vertical slice için ertelenebilir.

---

## 82. Arayüz Ayarları

- UI ölçeği
- Sağlık çubuğu görünürlüğü
- Tooltip gecikmesi
- Renk körlüğü seçeneği

---

# BÖLÜM N — KISAYOLLAR

## 83. Varsayılan Kısayol Tablosu

| İşlev | Kısayol |
|---|---|
| Kamera hareketi | WASD / Ok tuşları |
| Saldırı-Hareket | A |
| Dur | S |
| Pozisyonu Koru | H |
| Yapı döndür | R |
| Lojistik görünümü | L |
| İptal / seçim temizle | Esc |
| Kontrol grubu ata | Ctrl + 1–9 |
| Kontrol grubu seç | 1–9 |
| Duraklat | Space veya Esc menüsü |
| Ana merkeze odaklan | Home, opsiyonel |
| Boşta işçiyi seç | I veya `.`, opsiyonel |

---

## 84. Bağlamsal Kısayollar

Aynı tuş yalnız uygun modda çalışmalıdır.

Örnek:

- `R` yalnız yapı yerleştirme modunda döndürür.
- `A` birim seçiliyken saldırı-hareket açar.

---

# BÖLÜM O — TOOLTIP VE ÖĞRETİM

## 85. Tooltip İçeriği

- İsim
- Kısa açıklama
- Maliyet
- Kısayol
- Gereksinim
- Güçlü ve zayıf yön

---

## 86. Kilitli İçerik

Kilitli yapı veya birim:

- hangi çağda açıldığını,
- hangi yapının gerektiğini,
- eksik koşulu

göstermelidir.

---

## 87. İlk Maç İpuçları

Önerilen bağlamsal sıra:

1. İşçileri yiyecek ve oduna ata
2. Ev kur
3. Depo ve yol bağlantısı oluştur
4. Kışla kur
5. Karakolla genişle
6. Kasaba seviyesine geç
7. Stratejik noktaları keşfet

Tam tutorial ilk vertical slice için zorunlu değildir.

---

# BÖLÜM P — ERİŞİLEBİLİRLİK

## 88. UI Ölçekleme

Arayüz:

- farklı masaüstü çözünürlüklerinde ölçeklenmeli,
- ekran dışına taşmamalı,
- minimum okunabilir metin boyutunu korumalıdır.

---

## 89. Renk Dışı Ayrım

Takım ve durum ayrımı yalnız renge bağlı olmayacaktır.

Ek ayrımlar:

- ikon,
- desen,
- sınır şekli,
- bayrak biçimi,
- seçim halkası stili.

---

## 90. Ses Bağımsızlığı

Her kritik sesli uyarının:

- görsel bildirimi,
- minimap işareti veya metni

bulunmalıdır.

---

## 91. Kamera Konforu

- Kamera yumuşatma ayarı
- Kamera sallantısını kapatma
- Kenar kaydırmayı kapatma
- Zoom hassasiyeti

sunulmalıdır.

---

# BÖLÜM Q — TEKNİK MİMARİ

## 92. UI Katmanları

1. World-space göstergeler
2. Ana HUD
3. Bağlamsal paneller
4. Bildirimler
5. Modal pencereler
6. Debug UI

---

## 93. Merkezi UI Durumu

Önerilen state alanları:

```text
PlayerResources
Population
Prosperity
CurrentAge
Selection
ActiveCommandMode
ActivePlacementMode
Notifications
VictoryState
MinimapState
LogisticsOverlayState
```

---

## 94. Olay Tabanlı Güncelleme

UI şu olaylarla güncellenmelidir:

- kaynak değişti,
- seçim değişti,
- yapı durumu değişti,
- üretim kuyruğu değişti,
- çağ değişti,
- uyarı oluştu,
- stratejik nokta değişti,
- zafer sayacı değişti.

UI her kare tüm oyun nesnelerini taramamalıdır.

---

## 95. Input Context Sistemi

```text
Default
UnitCommand
BuildingPlacement
RoadPlacement
TargetSelection
Modal
Paused
Debug
```

Her context kabul ettiği girdileri açıkça tanımlar.

---

## 96. World-Space UI

- Sağlık çubuğu
- Seçim halkası
- Bağlantı ikonu
- İnşaat ilerlemesi
- Saldırı uyarısı

Uzaklığa göre bazı göstergeler gizlenebilir.

---

## 97. Veri Tabanlı Kısayollar

```yaml
input:
  attackMove: A
  stop: S
  holdPosition: H
  rotateBuilding: R
  logisticsOverlay: L
```

---

## 98. Save/Load UI

Kayıt slotu:

- slot adı,
- tarih ve saat,
- maç süresi,
- harita,
- zorluk,
- çağ seviyesi

gösterebilir.

Vertical slice için sınırlı slot ve hızlı kayıt yeterlidir.

---

## 99. Performans İlkeleri

- Minimap her kare tam yeniden çizilmemeli.
- Sağlık çubukları yalnız gerekli olduğunda görünmeli.
- Bildirim kuyruğu sınırlı tutulmalı.
- Çoklu seçimde her birim için ağır UI kartı oluşturulmamalı.
- Tooltip verileri önbelleklenebilir.
- Fog ve lojistik overlay ortak grid verisinden yararlanmalıdır.

---

# BÖLÜM R — DEBUG ARAÇLARI

## 100. UI Debug Paneli

Gösterilecek:

- aktif input context,
- seçili nesne sayısı,
- aktif komut modu,
- hover hedefi,
- son gönderilen komut,
- aktif modal,
- bildirim kuyruğu,
- minimap güncelleme süresi.

---

## 101. Kamera Debug

- kamera konumu,
- zoom seviyesi,
- hareket hızı,
- sınır durumu,
- odak hedefi.

---

## 102. Seçim Debug

- raycast sonucu,
- seçim collider'ı,
- seçim kutusunun dünya izdüşümü,
- filtre sonucu,
- grup bileşimi.

---

## 103. UI Test Komutları

- kaynak ekle/çıkar,
- nüfus sınırını doldur,
- yol bağlantısını kes,
- merkez saldırı uyarısı oluştur,
- bölgesel sayacı başlat,
- çağ atla,
- zafer veya yenilgi ekranını aç.

---

# BÖLÜM S — EDGE CASE'LER

## 104. UI Tıklaması Dünya Komutu Oluşturursa

UI girdi olayını tüketmeli ve dünya raycast'i çalışmamalıdır.

---

## 105. Seçili Birim Ölürse

- seçim listesinden çıkar,
- son seçili birimse panel kapanır,
- kalan grup komutuna devam eder.

---

## 106. Yerleştirme Sırasında Kaynak Azalırsa

- ghost geçersiz olur,
- onay engellenir,
- yetersiz kaynak mesajı gösterilir.

---

## 107. Çok Fazla Bildirim

- aynı tür gruplanır,
- yalnız yüksek öncelikli olanlar görünür,
- düşük öncelikliler geçmişe taşınır.

---

## 108. Düşük Çözünürlükte Taşma

- alt paneller sekmeli hale gelir,
- ikincil bilgiler tooltip'e taşınır,
- minimap küçülür fakat kaldırılmaz.

---

## 109. Odağı Kaybederken Fare Basılıysa

- seçim kutusu iptal edilir,
- basılı tuşlar sıfırlanır,
- kamera hareketi durur.

---

## 110. Modal Açıkken Maç Biterse

Zafer veya yenilgi ekranı öncelik alır ve yalnız tek sonuç ekranı açılır.

---

# BÖLÜM T — TEST PLANI

## 111. Kamera Testleri

- WASD ve kenar kaydırma
- Zoom sınırları
- İmlece doğru zoom
- Kamera sınırları
- Düşük ve yüksek çözünürlük

---

## 112. Seçim Testleri

- Tekli seçim
- Kutu seçimi
- Shift ile ekleme/çıkarma
- Çift tıklama
- Üst üste nesne seçimi
- Büyük grup performansı

---

## 113. Komut Testleri

- Sağ tık hareket
- Sağ tık saldırı
- Saldırı-hareket
- Dur
- Pozisyonu koru
- Rally point
- Geçersiz komut geri bildirimi

---

## 114. Yapı ve Yol Testleri

- Ghost geçerlilik durumları
- Yapı döndürme
- Karakol alan önizlemesi
- Yol rota önizlemesi
- Yol maliyeti
- Yol silme uyarısı
- Bağlantı sonrası UI güncellemesi

---

## 115. HUD Testleri

- Kaynak güncelleme
- Gelir hızı
- Nüfus sınırı
- Refah nedenleri
- Çağ ilerlemesi
- Üretim kuyruğu
- İşçi atama

---

## 116. Minimap ve Fog Testleri

- Dünya ve minimap fog eşleşmesi
- Kamera taşıma
- Uyarı pingleri
- Son görülen yapı işaretleri
- Stratejik nokta sahipliği

---

## 117. Zafer UI Testleri

- Bölgesel sayaç
- Sayaç durma ve gerileme
- Merkez sağlık uyarıları
- Teslim olma
- Maç sonu kilitleme

---

## 118. Erişilebilirlik Testleri

- UI ölçeği
- Renk dışı ayrım
- Ses kapalıyken kritik bilgi
- Kamera sallantısı kapalı
- Farklı ekran oranları

---

## 119. Telemetri

İzlenecek değerler:

- zoom kullanım sıklığı,
- WASD ve kenar kaydırma oranı,
- ortalama seçim grubu büyüklüğü,
- kutu seçimi sayısı,
- saldırı-hareket kullanımı,
- geçersiz yapı denemeleri,
- yol aracı iptal oranı,
- minimap tıklama sayısı,
- lojistik overlay kullanım süresi,
- bildirime tıklama oranı,
- kontrol grubu kullanımı,
- tooltip görüntüleme süresi,
- UI ölçeği ayarı.

---

# BÖLÜM U — VERTICAL SLICE KAPSAMI

## 120. Zorunlu Özellikler

- Sabit yönlü RTS kamera
- WASD hareketi
- Ekran kenarı kaydırma
- Fare tekerleği zoom
- Kamera sınırları
- Tekli seçim
- Kutu seçimi
- Shift ile seçim
- Sağ tık bağlamsal komut
- Saldırı-Hareket
- Dur
- Pozisyonu Koru
- İşçi yapı menüsü
- Yapı ghost önizlemesi
- Yapı döndürme
- Karakol alan önizlemesi
- Yol çizim aracı
- Kaynak HUD
- Nüfus ve Refah göstergesi
- Seçili nesne paneli
- Üretim kuyruğu
- Minimap
- Fog of war minimap
- Lojistik overlay
- Uyarı sistemi
- Bölgesel sayaç
- Zafer ve yenilgi ekranı
- Duraklatma menüsü
- Temel ayarlar
- UI debug paneli

---

## 121. Ertelenebilecek Özellikler

- Kamera döndürme
- Sürekli kamera takip modu
- Tam kısayol yeniden atama
- Çoklu yapı seçimi
- Komut kuyruğu
- Gelişmiş devriye
- Ayrıntılı bildirim geçmişi
- Sağ tık minimap komutu
- Gelişmiş formasyon UI
- Tam tutorial
- Mobil kontrol
- Gamepad desteği

---

## 122. İlk Teknik Prototip

```text
Kamerayı hareket ettir
→ birimi seç
→ sağ tıkla hareket ettir
→ kutu ile grup seç
→ düşmana saldır
→ kaynak HUD'ını güncelle
```

İkinci prototip:

```text
İşçi seç
→ yapı menüsünü aç
→ ghost yerleştir
→ döndür
→ inşa et
→ yapı panelini aç
```

Üçüncü prototip:

```text
Yol çiz
→ lojistik görünümünü aç
→ bağlantısız yapıyı gör
→ yolu bağla
→ minimap ve uyarıları test et
```

---

# BÖLÜM V — AÇIK SORULAR VE KARARLAR

## 123. Açık Tasarım Soruları

### Kamera

- Perspektif mi, ortografik kamera mı daha okunabilir olacak?
- Yakın ve uzak zoom sınırları ne olmalı?
- Orta fare sürükleme zorunlu mu olmalı?
- Kamera yumuşatma varsayılan açık mı olmalı?

### Seçim

- Kutu seçiminde asker varsa işçiler otomatik hariç tutulmalı mı?
- Kontrol grupları ilk sürümde zorunlu mu?
- Çift tıklama yalnız ekrandaki birimleri mi seçmeli?

### Yapı ve yol

- Yol yapımı mutlaka işçi gerektirecek mi?
- Yol çiziminde ara kontrol noktası gerekli mi?
- Ghost tam model mi, sade footprint mi kullanmalı?

### HUD

- Refah sürekli mi görünmeli?
- Gelir hızı sürekli mi, tooltip'te mi olmalı?
- Zafer paneli her zaman mı görünmeli?

### Minimap

- Sağ tıkla birlik gönderme desteklenecek mi?
- Kontrol alanı minimap'te gösterilecek mi?
- Stratejik noktalar fog arkasında baştan görünür mü olacak?

### Erişilebilirlik

- Kaç renk körlüğü preset'i gerekli?
- UI ölçek aralığı ne olmalı?
- Odağı kaybedince otomatik duraklatma varsayılan mı olmalı?

---

## 124. Şimdilik Alınmış Kararlar

- Üstten eğimli RTS kamera kullanılacaktır.
- Kamera yönü sabit olacaktır.
- WASD ve ekran kenarı kaydırma desteklenecektir.
- Zoom imlecin bulunduğu dünya noktasına doğru çalışacaktır.
- Tekli, kutu ve Shift seçimi bulunacaktır.
- Sağ tık bağlamsal komut kullanılacaktır.
- Saldırı-Hareket, Dur ve Pozisyonu Koru bulunacaktır.
- Yapı menüsü işçi seçimi üzerinden açılacaktır.
- Yapılar 90 derece adımlarla döndürülecektir.
- Ghost geçersizlik nedenlerini gösterecektir.
- Karakol ghost'u küçük ve tam kontrol alanını gösterecektir.
- Yol aracı başlangıç ve bitiş noktasıyla otomatik rota kullanacaktır.
- HUD kaynaklar, nüfus, Refah, çağ ve maç süresini gösterecektir.
- Minimap fog of war kurallarını paylaşacaktır.
- Lojistik görünümü ayrı overlay olacaktır.
- Bildirimler kritik, önemli ve bilgi olarak sınıflandırılacaktır.
- Tek oyunculu oyunda gerçek duraklatma desteklenecektir.
- Kritik bilgiler yalnız sesle iletilmeyecektir.
- UI masaüstü çözünürlüklerine ölçeklenecektir.
- Mobil ve gamepad desteği ilk vertical slice içinde olmayacaktır.
- UI olay tabanlı güncellenecek ve merkezi state store kullanacaktır.
- Input context sistemi kullanılacaktır.
- UI debug paneli zorunlu olacaktır.

---

## 125. Diğer Dokümanlarla Bağlantılar

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - HUD görsel dili,
  - ikonlar,
  - seçim halkaları,
  - takım renkleri.

- `12_BALANCE_AND_GAME_DATA.md`
  - kamera hızları,
  - zoom sınırları,
  - tooltip gecikmeleri,
  - bildirim tekrar süreleri.

- `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`
  - kamera ve input fazı,
  - HUD fazı,
  - minimap ve fog fazı,
  - UI testleri.

---

## 126. Kabul Kriterleri

- [ ] Kamera türü ve sabit yön kararı kabul edildi.
- [ ] Kamera hareketi ve zoom yaklaşımı yeterli bulundu.
- [ ] Seçim sistemi RTS beklentileriyle uyumlu.
- [ ] Bağlamsal sağ tık komutları net.
- [ ] Yapı ve yol yerleştirme akışı kabul edildi.
- [ ] HUD yerleşimi okunabilir.
- [ ] Minimap ve fog yaklaşımı onaylandı.
- [ ] Lojistik görünümü yeterli bulundu.
- [ ] Uyarı öncelikleri kabul edildi.
- [ ] Zafer ve maç sonu UI kapsamı uygun.
- [ ] Erişilebilirlik yaklaşımı yeterli.
- [ ] Vertical slice kapsamı gerçekçi.
- [ ] Teknik state ve input context yaklaşımı kabul edildi.

---

## 127. Kontrol Listesi

### Kamera

- [ ] Kamera türü tanımlandı.
- [ ] Kamera açısı tanımlandı.
- [ ] WASD hareketi tanımlandı.
- [ ] Kenar kaydırma tanımlandı.
- [ ] Kamera hızı tanımlandı.
- [ ] Zoom tanımlandı.
- [ ] Kamera dönüş kararı verildi.
- [ ] Kamera sınırları tanımlandı.
- [ ] Kamera odaklama tanımlandı.

### Seçim ve komutlar

- [ ] Tekli seçim tanımlandı.
- [ ] Kutu seçimi tanımlandı.
- [ ] Shift seçimi tanımlandı.
- [ ] Çift tıklama tanımlandı.
- [ ] Kontrol grupları değerlendirildi.
- [ ] Sağ tık komutları tanımlandı.
- [ ] Saldırı-Hareket tanımlandı.
- [ ] Dur tanımlandı.
- [ ] Pozisyonu Koru tanımlandı.
- [ ] Rally point tanımlandı.

### Yapı ve yol

- [ ] Yapı menüsü tanımlandı.
- [ ] Yapı kartı tanımlandı.
- [ ] Ghost önizleme tanımlandı.
- [ ] Geçersiz nedenler tanımlandı.
- [ ] Döndürme tanımlandı.
- [ ] Karakol önizlemesi tanımlandı.
- [ ] Yol çizim aracı tanımlandı.
- [ ] Yol silme uyarısı tanımlandı.
- [ ] Yol yükseltme yaklaşımı tanımlandı.

### HUD ve minimap

- [ ] Kaynak HUD tanımlandı.
- [ ] Gelir hızı tanımlandı.
- [ ] Nüfus göstergesi tanımlandı.
- [ ] Refah göstergesi tanımlandı.
- [ ] Çağ göstergesi tanımlandı.
- [ ] Birim paneli tanımlandı.
- [ ] Yapı paneli tanımlandı.
- [ ] Üretim kuyruğu tanımlandı.
- [ ] Minimap tanımlandı.
- [ ] Fog entegrasyonu tanımlandı.
- [ ] Lojistik overlay tanımlandı.

### Bildirim ve menüler

- [ ] Uyarı kategorileri tanımlandı.
- [ ] Bildirim gruplama tanımlandı.
- [ ] Bölgesel sayaç tanımlandı.
- [ ] Merkez uyarısı tanımlandı.
- [ ] Teslim olma tanımlandı.
- [ ] Maç sonu ekranı tanımlandı.
- [ ] Ana menü tanımlandı.
- [ ] Duraklatma menüsü tanımlandı.
- [ ] Ayarlar tanımlandı.

### Teknik ve test

- [ ] UI katmanları tanımlandı.
- [ ] Merkezi state tanımlandı.
- [ ] Olay tabanlı güncelleme tanımlandı.
- [ ] Input context tanımlandı.
- [ ] Save/load UI tanımlandı.
- [ ] Performans ilkeleri tanımlandı.
- [ ] Debug araçları tanımlandı.
- [ ] Kamera testleri tanımlandı.
- [ ] Seçim testleri tanımlandı.
- [ ] Yapı ve yol testleri tanımlandı.
- [ ] Minimap testleri tanımlandı.
- [ ] Erişilebilirlik testleri tanımlandı.
- [ ] Telemetri listelendi.

---

## 128. Revizyon Notları

### Sürüm 0.1

- Sabit yönlü RTS kamera yaklaşımı tanımlandı.
- Kamera hareketi, zoom, sınır ve odaklama davranışları oluşturuldu.
- Tekli, kutu, Shift ve çift tıklama seçimleri tanımlandı.
- Bağlamsal sağ tık ve temel birim komutları oluşturuldu.
- Yapı ve yol yerleştirme arayüzleri detaylandırıldı.
- Ana HUD, seçili nesne paneli, minimap ve lojistik görünümü tasarlandı.
- Fog of war, bildirim, zafer ve maç sonu arayüzleri tanımlandı.
- Menü, ayar, kısayol ve erişilebilirlik kapsamı oluşturuldu.
- UI state, input context, performans, debug ve test yaklaşımı eklendi.

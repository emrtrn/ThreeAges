# 11 — Art, Assets and Presentation

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Görsel Yön, Asset Kullanımı ve Sunum  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `04_BUILDINGS_AND_SETTLEMENT.md`  
> - `05_TERRITORY_LOGISTICS_AND_ROADS.md`  
> - `06_UNITS_AND_COMBAT.md`  
> - `08_MAP_AND_WORLD_DESIGN.md`  
> - `10_CAMERA_CONTROLS_AND_UI.md`

---

> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. Asset entegrasyonu ve görsel polish, oynanış kanıtı (Kapı A) geçilmeden başlamaz. Forge'a özgü teknik hizalama (mevcut Content Browser/manifest, glTF import, VFX sistemi) için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman oyunun görsel kimliğini, Quaternius Ultimate Fantasy RTS asset paketinin projede nasıl kullanılacağını, modellerin oynanış sistemleriyle nasıl eşleştirileceğini ve görsel sunumun teknik sınırlarını tanımlar.

Belge şu sorulara cevap verir:

- Oyunun ana görsel yönü nedir?
- Hazır asset paketi hangi ilkelerle kullanılacaktır?
- Bina modelleri üç gelişim seviyesiyle nasıl eşleştirilecektir?
- Birimlerin sınıfları ve seviyeleri görsel olarak nasıl ayrılacaktır?
- Takım renkleri hangi yüzeylerde kullanılacaktır?
- Kaynaklar, yollar, karakollar ve stratejik noktalar nasıl okunabilir hale getirilecektir?
- İnşaat, yükseltme, hasar ve yıkım nasıl sunulacaktır?
- Saldırı, mermi, seçim ve lojistik efektleri nasıl tasarlanacaktır?
- UI ikonları ve dünya içi göstergeler hangi görsel dili kullanacaktır?
- Animasyon ve VFX kapsamı nasıl kontrol edilecektir?
- Web performansı için LOD, instancing, materyal ve gölge bütçesi ne olacaktır?
- Vertical slice için hangi görsel içerikler zorunludur?

---

## 2. Görsel Yönün Özeti

Oyunun görsel yönü:

- stilize low-poly fantastik orta çağ,
- temiz ve okunabilir siluetler,
- sıcak ve doğal çevre renkleri,
- belirgin takım renkleri,
- düşük görsel gürültü,
- uzaktan okunabilen yapı seviyeleri,
- kontrollü ve sade VFX

üzerine kurulacaktır.

Hedef his:

> Küçük ama canlı bir sınır krallığının, basit bir yerleşimden gelişmiş bir krallığa dönüşmesini açıkça göstermek.

---

## 3. Ana Görsel İlkeler

### 3.1 Oynanış okunabilirliği estetikten önce gelir

Bir görsel öğe güzel görünse bile:

- birim seçimini zorlaştırıyorsa,
- yolu gizliyorsa,
- takım rengini belirsizleştiriyorsa,
- bina girişini kapatıyorsa,
- stratejik noktayı çevrede kaybettiriyorsa

değiştirilmelidir.

### 3.2 Siluetler uzaktan ayrılmalıdır

Oyuncu uzak kamera seviyesinde:

- İşçi
- Muhafız
- Okçu
- Süvari
- Kuşatma birimi

arasındaki farkı anlayabilmelidir.

Aynı kural binalar için de geçerlidir.

### 3.3 Seviye gelişimi yalnızca sayı değişimi olmamalıdır

Yerleşim, Kasaba ve Krallık seviyeleri:

- daha büyük kütle,
- daha gelişmiş malzeme,
- daha belirgin çatı ve kule,
- daha fazla savunma öğesi,
- daha zengin çevresel detay

ile ayrılmalıdır.

### 3.4 Takım rengi her önemli varlıkta görünmelidir

Takım rengi:

- bayrak,
- kumaş,
- kalkan,
- çatı şeridi,
- arma,
- seçim halkası

gibi kontrollü alanlarda kullanılmalıdır.

Tüm modelin takım rengine boyanması önerilmez.

### 3.5 Efektler kısa ve işlevsel olmalıdır

Efekt:

- eylemi açıklar,
- hasar anını bildirir,
- bağlantı veya sahiplik durumunu destekler.

Ekranı uzun süre kaplayan yoğun efektler kullanılmamalıdır.

---

# BÖLÜM A — ASSET PAKETİ KULLANIM STRATEJİSİ

## 4. Ana Asset Kaynağı

Vertical slice için ana 3B içerik kaynağı:

- Quaternius Ultimate Fantasy RTS paketi

olacaktır.

Paket şu amaçlarla kullanılacaktır:

- yapı modelleri,
- asker ve işçi karakterleri,
- çevre öğeleri,
- kaynak görselleri,
- yol ve savunma öğeleri,
- dekoratif props,
- bazı animasyonlar.

Kesin asset envanteri üretim başlamadan önce dosya bazında çıkarılmalıdır.

---

## 5. Asset-Led Design İlkesi

Oyun tasarımı tamamen asset paketinin sınırlarına teslim edilmeyecektir.

Ancak yeni içerik ihtiyacı doğduğunda şu sıra izlenmelidir:

1. Paket içinde uygun model ara.
2. Uygun modelin materyal veya ölçek varyantını kullan.
3. Mevcut modelleri modüler biçimde birleştir.
4. Basit yeni prop veya işaret üret.
5. Yalnız zorunluysa sıfırdan yeni ana model üret.

Bu yaklaşım vertical slice kapsamını korur.

---

## 6. Asset Envanteri Çıkarma

Üretim başlamadan önce bir envanter tablosu hazırlanmalıdır.

Önerilen alanlar:

| Alan | Açıklama |
|---|---|
| Asset ID | Proje içi benzersiz ad |
| Kaynak dosya | Orijinal model dosyası |
| Kategori | Bina, birim, prop, çevre |
| Oyun rolü | Hangi sistemde kullanılacağı |
| Çağ | Yerleşim, Kasaba, Krallık |
| Takım rengi | Var/Yok |
| Animasyon | Var/Yok |
| Collider | Hazır/Yeni |
| LOD | Hazır/Yeni |
| Durum | Kullanılacak, yedek, uygun değil |

---

## 7. Dosya Adlandırma Standardı

Önerilen yapı:

```text
assets/
├── buildings/
│   ├── town_center/
│   │   ├── town_center_t1.glb
│   │   ├── town_center_t2.glb
│   │   └── town_center_t3.glb
│   └── barracks/
├── units/
│   ├── worker/
│   ├── guard/
│   ├── archer/
│   └── siege/
├── environment/
├── resources/
├── roads/
├── props/
├── vfx/
└── ui/
```

Dosya adlarında:

- boşluk kullanılmamalı,
- seviye `t1`, `t2`, `t3` ile belirtilmeli,
- takım varyantı ayrı model yerine materyal parametresiyle çözülmelidir.

---

## 8. Pivot ve Ölçek Standardı

Tüm assetler Forge içine alınırken:

- dünya ölçeği tutarlı,
- pivot zeminde,
- ileri yön tutarlı,
- bina pivotu footprint merkezinde veya tanımlı giriş anchor'ında,
- birim pivotu ayak tabanında

olmalıdır.

Birim ve bina ölçekleri görsel gerçekçilikten çok oynanış okunabilirliğine göre ayarlanabilir.

---

# BÖLÜM B — BİNA GÖRSEL SİSTEMİ

## 9. Bina Kategorilerinin Görsel Dili

### Yönetim

- en büyük kütle,
- belirgin bayrak,
- güçlü merkez silueti,
- çağ yükseldikçe kule veya sur öğeleri.

### Ekonomi

- kaynak türünü anlatan prop,
- açık çalışma alanı,
- işçi animasyonlarının görülebileceği çevre.

### Konut

- daha küçük siluet,
- tekrar kullanılabilir varyasyon,
- yerleşimi canlı gösteren basit dekor.

### Askerî

- silah rafı,
- hedef kuklası,
- sancak,
- daha sert ve sağlam form.

### Savunma

- yüksek siluet,
- görüş ve saldırı yönü okunabilir,
- takım bayrağı belirgin.

### Lojistik

- sandık,
- araba,
- stok alanı,
- yol giriş noktası açık.

---

## 10. Üç Seviye Görsel Gelişim

### Seviye I — Yerleşim

- ahşap ağırlıklı,
- küçük kütle,
- basit çatı,
- düşük savunma hissi,
- az dekor,
- geçici yerleşim görünümü.

### Seviye II — Kasaba

- ahşap + taş karışımı,
- daha büyük kütle,
- ek kat veya kanat,
- daha düzenli çatı,
- belirgin işlevsel props.

### Seviye III — Krallık

- taş ağırlıklı,
- daha yüksek ve güçlü siluet,
- kule, arma veya gelişmiş çatı,
- daha kalıcı savunma öğeleri,
- zengin fakat kontrollü dekor.

---

## 11. Ana Bina Model Eşleştirmesi

Kesin modeller asset envanteri sonrası seçilecektir.

Önerilen eşleştirme tablosu:

| Oyun yapısı | T1 görsel yön | T2 görsel yön | T3 görsel yön |
|---|---|---|---|
| Merkez | Büyük ahşap salon | Kasaba merkezi | Kale / yönetim yapısı |
| Ev | Küçük kulübe | Taş-ahşap ev | Gelişmiş şehir evi |
| Depo | Basit ambar | Büyük depo | Taş destekli lojistik merkezi |
| Kışla | Eğitim alanı | Güçlendirilmiş kışla | Seçkin askerî yapı |
| Karakol | Ahşap gözcü | Taş tabanlı kule | Güçlendirilmiş ileri üs |
| Kule | Basit gözcü | Savunma kulesi | Güçlü taş kule |
| Tarla | Küçük tarım alanı | Düzenli çiftlik | Gelişmiş tarım kompleksi |

---

## 12. Bina Footprint ve Görsel Kütle

Model footprint'i ile oynanış footprint'i aynı olmak zorunda değildir; ancak büyük fark olmamalıdır.

Kurallar:

- model tabanı footprint dışına taşmamalı,
- çatı veya bayrak sınırlı taşabilir,
- giriş yönü görünür olmalı,
- birim çıkış alanı dekorla kapanmamalıdır.

---

## 13. Bina Girişleri

Yol bağlantısı gereken binalarda görsel giriş bulunmalıdır.

Giriş işaretleri:

- kapı,
- açık avlu,
- rampa,
- yol taşı,
- çit açıklığı.

Giriş anchor'ı teknik olarak tanımlanmalıdır.

---

## 14. İnşaat Görseli

Tam inşaat animasyon seti yoksa üç katman kullanılabilir:

1. Zemin işareti ve malzeme yığını
2. Basit iskele + yarı saydam ana model
3. Tam model

İnşaat sırasında:

- yalnızca modelin dikey ölçeğini sıfırdan büyütmek kullanılmamalıdır,
- bina zeminden “şişerek” çıkmamalıdır.

---

## 15. Yükseltme Görseli

Yükseltme sırasında:

- mevcut yapı korunur,
- iskele veya toz efekti eklenir,
- yeni seviye modeline kontrollü geçiş yapılır.

Tamamlandığında:

- kısa ışık veya bayrak açılma efekti,
- yükseltme sesi,
- yeni model silueti

kullanılabilir.

---

## 16. Hasar Görseli

Bina hasarı üç görsel seviyede sunulabilir:

### Sağlam

- normal model.

### Hasarlı

- hafif duman,
- kırık prop,
- koyu materyal lekesi.

### Kritik

- daha belirgin duman,
- küçük kıvılcım,
- kırık çatı veya ek parça.

Yeni özel hasarlı model üretmek zorunlu değildir.

---

## 17. Yıkım Görseli

Yıkım:

- kısa parçacık efekti,
- modelin kontrollü kaybolması,
- kısa süreli enkaz decal veya sade kalıntı

ile sunulabilir.

Fizik tabanlı büyük yıkım sistemi gerekli değildir.

---

# BÖLÜM C — BİRİM GÖRSEL SİSTEMİ

## 18. Birim Siluet İlkeleri

### İşçi

- alet,
- hafif kıyafet,
- küçük veya nötr siluet.

### Muhafız

- kalkan veya belirgin yakın dövüş silahı,
- daha geniş ön siluet.

### Okçu

- yay,
- sadak,
- daha ince gövde,
- menzilli duruş.

### Süvari

- at veya belirgin hızlı birlik silueti,
- diğerlerinden daha büyük hacim.

### Kuşatma

- büyük tekerlekli araç,
- yavaş ve ağır görünüm.

---

## 19. Birim Seviye Görseli

Birimler her çağda tamamen farklı model kullanmak zorunda değildir.

Önerilen gelişim:

- zırh parçası artışı,
- silah varyantı,
- kalkan şekli,
- başlık,
- takım renkli kumaş miktarı.

Vertical slice için iki yöntemden biri seçilebilir:

### Yöntem A — Ayrı model

Her çağ seviyesi için farklı model.

### Yöntem B — Aynı model + ekipman varyantı

Daha düşük asset ve animasyon maliyeti.

Paket içeriğine göre karar verilmelidir.

---

## 20. Takım Rengi Uygulaması

Birimlerde takım rengi için uygun alanlar:

- pelerin,
- omuz kumaşı,
- kalkan işareti,
- kemer şeridi,
- miğfer tüyü,
- seçim halkası.

Takım rengi:

- karakter teni,
- metal zırhın tamamı,
- tüm silah

üzerine uygulanmamalıdır.

---

## 21. Birim Animasyonları

Zorunlu animasyonlar:

- Idle
- Walk / Run
- Attack
- Hit reaction, kısa veya opsiyonel
- Death
- Work, işçi için
- Build, işçi için
- Repair, işçi için

Birim türüne göre:

- okçu için atış,
- kuşatma için hazırlık ve saldırı,
- süvari için koşu ve saldırı

gerekir.

---

## 22. Animasyon Geçişleri

Geçişler:

- kısa,
- gecikmesiz,
- komut tepkisini engellemeyen

olmalıdır.

Hasar anı animasyonla eşleşmelidir.

---

## 23. Birim Ölüm Sunumu

- kısa ölüm animasyonu,
- birimin seçimden çıkması,
- gövdenin kısa süre sonra kaybolması.

Kalıcı ceset:

- pathfinding,
- performans,
- görsel kalabalık

nedeniyle ilk vertical slice için kullanılmamalıdır.

---

# BÖLÜM D — KAYNAK VE ÜRETİM GÖRSELLERİ

## 24. Yiyecek

Olası görseller:

- tarla,
- meyve çalısı,
- tahıl çuvalları,
- küçük hayvan alanı.

Vertical slice için ana sürdürülebilir kaynak:

- tarla/çiftlik

olmalıdır.

---

## 25. Odun

- ağaç kümeleri,
- kesilmiş kütük,
- oduncu kampı,
- odun yığını.

Ağaç hasadı görsel olarak:

- ağaç yoğunluğunun azalması,
- kütük görünmesi,
- kaynak göstergesinin azalması

ile sunulabilir.

---

## 26. Taş

- belirgin açık gri kaya yatağı,
- kırılmış taş yığını,
- vinç veya çalışma alanı.

Taş yatağı çevredeki dekor kayalarından açıkça ayrılmalıdır.

---

## 27. Altın

- sarı damar,
- parlayan küçük kristal veya metal tonu,
- maden arabası,
- takım renginden bağımsız özel vurgu.

Altın aşırı parlak veya fantastik neon görünmemelidir.

---

## 28. Kaynak Durumu

Kaynak düğümleri için:

- seçildiğinde kalan miktar,
- tükenmeye yakın durum,
- tükendi durumu

görsel veya UI ile gösterilmelidir.

---

## 29. İşçi Çalışma Sunumu

İşçiler fiziksel taşıma yapmasa bile:

- odun kesme,
- taş kırma,
- tarla çalışma,
- maden çalışma

animasyonlarıyla üretim hissi vermelidir.

Yerel tampon dolduğunda:

- stok yığını artabilir,
- küçük doluluk ikonu gösterilebilir.

---

# BÖLÜM E — YOL, LOJİSTİK VE BÖLGE GÖRSELLERİ

## 30. Yol Seviyeleri

### Yol I

- toprak yol,
- düzensiz kenar,
- düşük kontrast ama okunabilir.

### Yol II

- sıkıştırılmış veya taş kenarlı yol,
- daha net sınır,
- daha düzenli yüzey.

### Yol III

- taş döşeme,
- belirgin dayanıklılık,
- Krallık seviyesi görünümü.

Vertical slice için Yol I ve Yol II yeterli olabilir.

---

## 31. Yol Segmentleri

Gerekli segmentler:

- düz,
- köşe,
- T kavşağı,
- dört yol,
- son parça,
- bina giriş bağlantısı,
- köprü bağlantısı.

Tekrarlı desenler uzaktan rahatsız edici olmamalıdır.

---

## 32. Lojistik Düğüm Görselleri

Merkez ve depo gibi düğümlerde:

- yol giriş noktası,
- küçük bağlantı simgesi,
- lojistik overlay'de düğüm halkası

kullanılabilir.

---

## 33. Bağlantı Durumu

### Tam bağlı

- normal görünüm,
- lojistik overlay'de parlak hat.

### Bağlantısız

- kırık zincir ikonu,
- soluk bina tonu,
- kesik çizgi.

### Alternatif rota

- overlay içinde ikinci kesik hat.

### Kontrol dışı

- soluk takım rengi,
- kırık kalkan.

---

## 34. Kontrol Alanı Görseli

Normal görünümde:

- hafif takım rengi zemin tonu veya ince sınır.

Lojistik görünümde:

- daha belirgin sınır,
- grid hücrelerinin sade vurgusu,
- karakol etki yarıçapı.

Alan rengi zemini tamamen kapatmamalıdır.

---

## 35. Karakol Tam Bağlantı Sunumu

Karakol:

- bağlantısızken küçük ve soluk etki çemberi,
- merkeze bağlanınca kısa etkinleşme efekti,
- tam alan sınırı

gösterebilir.

---

# BÖLÜM F — STRATEJİK NOKTALAR

## 36. Stratejik Nokta Silueti

Stratejik nokta çevredeki kaynak ve yapılardan ayrılmalıdır.

Önerilen görsel:

- taş halka,
- yüksek bayrak direği,
- eski totem,
- merkez platformu,
- takım bayrağı.

---

## 37. Sahiplik Durumu

### Nötr

- soluk veya beyaz bayrak.

### Oyuncu

- oyuncu takım rengi.

### AI

- AI takım rengi.

### Tartışmalı

- iki renkli veya yanıp sönen bayrak,
- capture çubuğu.

---

## 38. Ele Geçirme Efekti

- alan çemberi,
- ilerleme halkası,
- bayrak yükselmesi,
- kısa takım rengi dalgası.

Efekt savaş alanını kapatmamalıdır.

---

## 39. Bölgesel Sayaç Sunumu

Dünya içinde:

- stratejik nokta üzerinde küçük zaman göstergesi

opsiyoneldir.

Ana sayaç UI'da gösterilmelidir.

---

# BÖLÜM G — SAVAŞ VFX

## 40. VFX Tasarım İlkesi

Savaş efektleri:

- saldırının türünü anlatmalı,
- hasar anını göstermeli,
- hedefi kaybettirmemeli,
- düşük donanımda çalışmalıdır.

---

## 41. Yakın Dövüş Efekti

- küçük vurma kıvılcımı,
- kısa toz,
- metal veya ahşap ses.

Kan veya grafik hasar görseli kullanılmamalıdır.

---

## 42. Okçu Mermisi

- sade ok modeli,
- hafif iz,
- hedefte küçük darbe efekti.

Aşırı parlak büyülü iz kullanılmamalıdır.

---

## 43. Kuşatma Efekti

- büyük fakat kısa darbe,
- toz,
- taş parçası,
- düşük kamera sallantısı, ayarlanabilir.

---

## 44. Yapı Saldırı Efekti

- yüzeyde darbe,
- kısa duman,
- hasar aşamasına geçiş.

---

## 45. İyileşme Efekti

Dost bölgede yavaş iyileşme:

- sürekli yoğun aura yerine,
- aralıklı küçük simge veya hafif parçacık

kullanmalıdır.

---

## 46. Seçim ve Komut Efektleri

- seçim halkası,
- hareket tıklama işareti,
- saldırı tıklama işareti,
- saldırı-hareket işareti,
- onarım işareti,
- geçersiz komut işareti.

Bu efektler takım renginden bağımsız anlaşılır ikonlar kullanmalıdır.

---

# BÖLÜM H — IŞIKLANDIRMA VE RENK

## 47. Aydınlatma Hedefi

- sabit gündüz,
- yumuşak ana ışık,
- okunabilir gölgeler,
- aşırı karanlık alan yok,
- modellerin renkleri korunur.

---

## 48. Gölge Kullanımı

Gölgeler:

- model zemine oturuşunu destekler,
- birim yönünü ve bina kütlesini açıklar.

Ancak:

- çok uzun,
- çok koyu,
- UI ve takım rengini örten

gölgeler kullanılmamalıdır.

---

## 49. Gölge Bütçesi

Öneri:

- ana yapılarda dinamik veya kaliteli gölge,
- birimlerde düşük maliyetli gölge,
- küçük props için baked veya gölgesiz,
- uzak objelerde gölge kapatma.

---

## 50. Renk Paleti

### Çevre

- orta doygunlukta yeşiller,
- sıcak toprak,
- açık gri taş,
- temiz mavi su.

### Yapılar

- doğal ahşap,
- taş,
- kiremit,
- kontrollü takım rengi.

### UI ve takım

- çevreden net ayrılan,
- renk körlüğü desteğine uygun,
- ikinci şekil ve ikon desteği olan tonlar.

---

## 51. Takım Rengi Çiftleri

İlk vertical slice için önerilen örnek çift:

- Oyuncu: mavi
- AI: kırmızı

Alternatif erişilebilirlik setleri:

- mavi / turuncu
- mor / sarı

Takım farkı yalnız renge bağlı kalmamalıdır.

---

# BÖLÜM I — MATERYAL VE SHADER STRATEJİSİ

## 52. Materyal Sayısı

Assetler mümkün olduğunca:

- ortak atlas,
- paylaşılan materyal,
- materyal instancing

kullanmalıdır.

Her bina için ayrı ağır shader oluşturulmamalıdır.

---

## 53. Takım Rengi Shader'ı

Önerilen yöntem:

- mask texture veya vertex color,
- tek materyal parametresi,
- takım rengi yalnız belirli bölgelere uygulanır.

---

## 54. Seçim Vurgusu

Seçili nesnede:

- seçim halkası ana yöntemdir.

Opsiyonel:

- hafif outline.

Tam ekran post-process outline pahalıysa kullanılmamalıdır.

---

## 55. Ghost Materyali

Yapı önizlemesi:

- yarı saydam,
- geçerli ve geçersiz durum parametreli,
- z-depth sorunları olmayan,
- footprint ile birlikte çalışan

özel sade materyal kullanmalıdır.

---

## 56. Fog of War Shader'ı

Fog:

- bilinmeyen alanı kapatır,
- keşfedilmiş alanı soluklaştırır,
- görünür alanı normal gösterir.

Takım ve kaynak ikonları fog kurallarına uymalıdır.

---

## 57. Su Shader'ı

- düşük maliyet,
- basit normal hareketi,
- sınırlı yansıma,
- güçlü şeffaflık maliyetinden kaçınma.

---

# BÖLÜM J — UI GÖRSEL DİLİ

## 58. UI Teması

UI:

- fantastik orta çağ hissi,
- temiz geometrik paneller,
- ahşap/taş dokusunun çok hafif kullanımı,
- modern okunabilirlik

dengesini kurmalıdır.

Aşırı süslü çerçeveler oyun alanını daraltmamalıdır.

---

## 59. Panel Yapısı

Paneller:

- koyu yarı saydam arka plan,
- açık metin,
- sınırlı dekoratif kenar,
- net ikon alanı

kullanmalıdır.

---

## 60. İkon Stili

İkonlar:

- basit siluet,
- kalın okunabilir şekil,
- küçük boyutta anlaşılır,
- aynı ışık ve perspektif dili

kullanmalıdır.

3B model ekran görüntülerinden doğrudan ikon üretmek mümkündür; ancak tüm ikonlar aynı kamera ve arka plan standardını kullanmalıdır.

---

## 61. Kaynak İkonları

- Yiyecek: tahıl veya yiyecek sepeti
- Odun: kütük
- Taş: kaya bloğu
- Altın: sikke veya külçe
- Nüfus: insan silueti
- Refah: taç, ev veya güneş benzeri nötr sembol

---

## 62. Durum İkonları

Gerekli ikonlar:

- bağlantısız,
- kontrol dışı,
- işçi yok,
- yerel stok dolu,
- kaynak tükendi,
- saldırı altında,
- yükseltiliyor,
- onarılıyor,
- nüfus dolu.

---

## 63. Araç İpucu Görseli

Tooltip:

- başlık,
- kısa açıklama,
- maliyet satırı,
- gereksinim,
- kısayol

ile sınırlı ve düzenli olmalıdır.

---

## 64. Minimap Görseli

Minimap:

- sade arazi rengi,
- güçlü takım noktaları,
- stratejik hedef simgesi,
- fog katmanı,
- kamera çerçevesi

kullanmalıdır.

Detaylı 3B render minimap için gerekli değildir.

---

# BÖLÜM K — SES VE GÖRSEL SUNUM İLİŞKİSİ

## 65. Ses Tasarımının Görsel İşlevi

Her önemli görsel olayın ses desteği olabilir:

- seçim,
- hareket komutu,
- yapı yerleştirme,
- inşaat tamamlama,
- çağ atlama,
- saldırı,
- yapı yıkımı,
- stratejik nokta ele geçirme,
- zafer/yenilgi.

---

## 66. Birim Sesleri

Vertical slice için tam seslendirme zorunlu değildir.

Kullanılabilecek kısa tepkiler:

- seçildi,
- hareket,
- saldırı,
- yapı emri.

Aynı sesin aşırı tekrarı engellenmelidir.

---

## 67. Ortam Sesi

- rüzgâr,
- kuş,
- nehir,
- uzak yerleşim sesi

düşük seviyede kullanılabilir.

Ortam sesi kritik uyarıları maskelememelidir.

---

# BÖLÜM L — PERFORMANS VE OPTİMİZASYON

## 68. Hedef Platform

- masaüstü web tarayıcısı,
- orta seviye donanım,
- klavye ve fare.

---

## 69. Görsel Performans Hedefi

Kesin değer teknik testle belirlenecektir.

Öncelikli hedef:

- yoğun orta oyun çatışmasında kararlı kare hızı,
- büyük üs görünümünde düşük draw call,
- fog ve minimap açıkken kabul edilebilir performans.

---

## 70. LOD Seviyeleri

### Birimler

- LOD0: yakın
- LOD1: orta
- LOD2 veya basitleştirilmiş model: uzak

### Yapılar

- LOD0: yakın
- LOD1: orta
- uzak mesafede küçük detayları kaldırma

---

## 71. Instancing

Instancing için uygun öğeler:

- ağaçlar,
- taşlar,
- çitler,
- yol props,
- dekoratif sandıklar,
- aynı tip ev varyantları.

---

## 72. Texture Atlas

Mümkünse:

- birim materyalleri,
- bina kategorileri,
- props

atlas kullanmalıdır.

Takım renkleri atlas çoğaltmak yerine shader parametresiyle uygulanmalıdır.

---

## 73. VFX Bütçesi

- aynı anda aktif parçacık sayısı sınırlandırılmalı,
- uzak savaş efektleri azaltılmalı,
- object pooling kullanılmalı,
- uzun ömürlü duman sayısı kontrol edilmelidir.

---

## 74. Animasyon Bütçesi

- görünmeyen birim animasyonları düşük sıklık,
- uzaktaki birimlerde sade güncelleme,
- aynı iskelet paylaşımı,
- gereksiz blend ağacından kaçınma.

---

## 75. Occlusion ve Culling

- kamera dışında objeler güncellenmemeli,
- harita sınırı dekorları culling kullanmalı,
- küçük props uzak mesafede gizlenmeli,
- UI world-space göstergeleri mesafeyle azaltılmalıdır.

---

# BÖLÜM M — ASSET ÜRETİM VE ENTEGRASYON AKIŞI

## 76. Asset Kabul Akışı

```text
Asset seç
→ Lisans ve kaynak kaydını doğrula
→ Dosyayı standart adla kopyala
→ Ölçek ve pivot düzelt
→ Materyali standardize et
→ Takım rengi maskesi ekle
→ Collider oluştur
→ LOD oluştur
→ Forge içine aktar
→ Oynanış test sahnesinde doğrula
```

---

## 77. Asset Kabul Kriterleri

Bir asset kabul edilmeden önce:

- rolü anlaşılır,
- ölçeği tutarlı,
- pivotu doğru,
- materyali desteklenen,
- collider'ı uygun,
- takım rengi uygulanabilir,
- uzaktan okunabilir,
- performans bütçesine uygun

olmalıdır.

---

## 78. Model Varyasyonları

Aynı ev veya küçük prop için:

- rotasyon,
- çatı rengi,
- küçük prop farkı,
- ölçek sınırı

ile varyasyon üretilebilir.

Oynanış hitbox ve footprint değişmemelidir.

---

## 79. Eksik Asset Çözüm Sırası

Bir ihtiyaç paket içinde yoksa:

1. En yakın modeli farklı materyalle kullan.
2. Modüler iki modeli birleştir.
3. Basit prop ekleyerek rolü açıkla.
4. Blender ile küçük düzenleme yap.
5. Yeni model üretimini son seçenek olarak kullan.

---

## 80. Kaynak Dosya Koruma

Orijinal asset dosyaları değiştirilmemelidir.

Önerilen:

```text
assets_source/
assets_processed/
assets_runtime/
```

---

## 81. Blender İşleme Kuralları

Gerekli işlemler:

- apply transforms,
- pivot düzenleme,
- materyal sadeleştirme,
- gereksiz node kaldırma,
- LOD oluşturma,
- collider hazırlama,
- glTF/GLB export doğrulama.

---

## 82. glTF/GLB Export

Kontrol edilecek:

- materyal bağlantıları,
- normal map,
- alpha mask gerekiyorsa uygun mod,
- animasyon klipleri,
- iskelet,
- texture path,
- takım rengi maskesi,
- ölçek.

---

# BÖLÜM N — VERTICAL SLICE ASSET LİSTESİ

## 83. Zorunlu Bina Assetleri

- Merkez T1
- Merkez T2
- Merkez T3
- Ev T1
- Ev T2
- Ev T3
- Depo T1
- Depo T2
- Depo T3
- Tarla/Çiftlik
- Oduncu Kampı
- Taş Ocağı
- Altın Madeni
- Kışla T1
- Kışla T2
- Kışla T3
- Karakol T1
- Karakol T2
- Karakol T3
- Kule
- Kuşatma Atölyesi veya geç oyun askerî yapı

---

## 84. Zorunlu Birim Assetleri

- İşçi
- Muhafız
- Okçu
- Kuşatma birimi
- Süvari, kapsama dahil edilirse

Her birim için minimum:

- idle,
- movement,
- attack,
- death

animasyonu.

İşçi için ayrıca:

- work,
- build,
- repair.

---

## 85. Zorunlu Çevre Assetleri

- 2–4 ağaç türü
- 2–3 kaya türü
- nehir kenarı öğeleri
- köprü
- yol segmentleri
- çalı ve ot props
- sınır kayalıkları
- küçük dekor seti

---

## 86. Zorunlu Kaynak Assetleri

- yiyecek/tarla
- orman/kütük
- taş yatağı
- altın yatağı
- stok yığınları

---

## 87. Zorunlu VFX

- seçim halkası
- hareket işareti
- saldırı işareti
- yapı yerleştirme ghost
- inşaat tozu
- yükseltme tamamlanma
- yakın dövüş darbesi
- ok mermisi ve darbesi
- kuşatma darbesi
- yapı dumanı
- stratejik nokta ele geçirme
- zafer/yenilgi geçişi

---

## 88. Zorunlu UI Assetleri

- kaynak ikonları
- nüfus ve Refah ikonları
- yapı ikonları
- birim ikonları
- komut ikonları
- durum ikonları
- stratejik nokta ikonları
- zafer türü ikonları
- minimap işaretleri
- panel çerçeveleri
- imleç varyantları

---

# BÖLÜM O — ERTELENEBİLECEK GÖRSEL İÇERİK

## 89. Vertical Slice Sonrasına Bırakılabilecekler

- dört farklı biyom,
- gece aydınlatması,
- hava durumu,
- gelişmiş fizik yıkımı,
- birim veteranlık görselleri,
- kahraman modelleri,
- garnizon animasyonları,
- detaylı vatandaş yaşamı,
- hayvan sürüleri,
- gelişmiş pazar kalabalığı,
- tam duvar ve kapı seti,
- büyük sinematikler,
- yüz animasyonu,
- yoğun çevresel parçacıklar,
- birden fazla fraksiyon mimarisi.

---

# BÖLÜM P — TEKNİK VERİ VE KOMPONENTLER

## 90. Görsel Asset Tanımı

Örnek:

```yaml
visualAsset:
  id: town_center_t1
  model: buildings/town_center/town_center_t1.glb
  scale: 1.0
  pivotType: footprint_center
  teamColorMask: true
  lod:
    - distance: near
      model: town_center_t1_lod0.glb
    - distance: far
      model: town_center_t1_lod1.glb
  effects:
    damaged: building_smoke_small
    critical: building_smoke_large
```

---

## 91. Animasyon Haritası

```yaml
animationSet:
  id: guard_basic
  clips:
    idle: Idle
    move: Walk
    attack: Attack
    death: Death
```

Klip isimleri import sırasında standardize edilmelidir.

---

## 92. Takım Rengi Parametresi

```yaml
teamVisual:
  teamId: player
  primaryColor: "#..."
  secondaryColor: "#..."
  bannerPattern: crown
```

Renk kodları erişilebilirlik testinden sonra kesinleşir.

---

## 93. Görsel Durum Komponentleri

Önerilen:

- TeamColorComponent
- VisualStateComponent
- AnimationComponent
- DamageVisualComponent
- SelectionVisualComponent
- ConstructionVisualComponent
- UpgradeVisualComponent
- FogVisibilityComponent
- LODComponent

---

## 94. Olay Tabanlı Görsel Değişim

Görseller şu olaylarda güncellenir:

- takım değişti,
- seviye yükseldi,
- hasar eşiği geçildi,
- yapı tamamlandı,
- bağlantı durumu değişti,
- kontrol durumu değişti,
- birim komutu değişti,
- seçim değişti.

---

## 95. Save/Load Gereksinimleri

Görsel durumun çoğu oynanış verisinden yeniden üretilebilir.

Saklanması gerekenler:

- yapı seviyesi,
- hasar durumu,
- takım,
- inşaat/yükseltme ilerlemesi,
- seçili varyant,
- kaynak düğümü tükenme aşaması.

Geçici parçacıkların kaydedilmesi gerekmez.

---

# BÖLÜM Q — DEBUG VE KALİTE KONTROL

## 96. Görsel Debug Modları

- collider gösterimi
- pivot gösterimi
- footprint gösterimi
- takım rengi maskesi
- LOD geçiş mesafesi
- animasyon klip adı
- gölge atan objeler
- draw call sayısı
- aktif VFX sayısı
- fog görünürlük durumu

---

## 97. Asset Test Sahnesi

Tek bir test sahnesinde:

- tüm binalar,
- tüm seviyeler,
- tüm birimler,
- takım renkleri,
- gün ışığı,
- fog,
- hasar durumları,
- LOD mesafeleri

yan yana test edilmelidir.

---

## 98. Görsel Kabul Kontrolü

Her asset için:

- [ ] Ölçek doğru
- [ ] Pivot doğru
- [ ] Zemin teması doğru
- [ ] Takım rengi okunur
- [ ] Materyal hatası yok
- [ ] Normal map doğru
- [ ] Alpha mask doğru
- [ ] Animasyon klipleri doğru
- [ ] Collider uygun
- [ ] LOD geçişi kabul edilebilir
- [ ] Fog altında doğru gizleniyor
- [ ] Minimap ikonu doğru
- [ ] Performans bütçesine uygun

---

# BÖLÜM R — EDGE CASE'LER

## 99. Bina Seviyesi Model Boyutları Farklıysa

- footprint sabit kalabilir,
- yeni model çevre binalara taşmamalıdır,
- yükseltme öncesi çakışma kontrolü yapılmalıdır.

---

## 100. Takım Rengi Maskesi Olmayan Model

Çözüm sırası:

1. Mevcut materyalde uygun renk kanalı ara.
2. Ayrı basit mask texture üret.
3. Bayrak veya arma prop ekle.
4. Son çare model materyalini böl.

---

## 101. Animasyon Adları Tutarsızsa

Import sırasında:

- standart klip haritası,
- manuel eşleştirme,
- eksik animasyon fallback'i

kullanılmalıdır.

---

## 102. Birim Uzak Kamerada Ayırt Edilemiyorsa

- siluet ölçeği,
- silah boyutu,
- takım rengi alanı,
- seçim halkası,
- baş üstü sınıf ikonu

değerlendirilmelidir.

---

## 103. Yol Zemin İçinde Kayboluyorsa

- hafif yükseklik offset,
- decal,
- kenar taşları,
- terrain blend

kullanılabilir.

Z-fighting oluşmamalıdır.

---

## 104. Fog Altında Efekt Görünüyorsa

Tüm dünya VFX'leri:

- fog görünürlük kuralına,
- sahiplik ve görüş sistemine

uymalıdır.

---

## 105. Hasarlı Yapı Efekti Çok Yoğunsa

- parçacık sayısı,
- duman opaklığı,
- efekt menzili,
- aynı anda aktif yapı sayısı

sınırlandırılmalıdır.

---

# BÖLÜM S — TEST PLANI

## 106. Görsel Test Senaryoları

### Test 1 — Yapı seviyeleri

- T1, T2 ve T3 aynı kamera mesafesinde karşılaştırılır.
- Seviye farkı uzaktan anlaşılmalıdır.

### Test 2 — Takım renkleri

- Oyuncu ve AI aynı modelde test edilir.
- Birimler ve binalar karışmamalıdır.

### Test 3 — Seçim okunabilirliği

- Yoğun savaşta seçim halkası ve sağlık çubuğu test edilir.

### Test 4 — Kaynak okunabilirliği

- Taş, altın ve dekor kayaları aynı sahnede test edilir.
- Kaynak düğümleri ayırt edilmelidir.

### Test 5 — Yol seviyeleri

- Yol I ve Yol II farklı zeminlerde test edilir.
- Her ikisi de okunabilir olmalıdır.

### Test 6 — Fog

- görünür, keşfedilmiş ve bilinmeyen durumlar karşılaştırılır.
- Düşman efektleri fog arkasında görünmemelidir.

### Test 7 — Hasar

- yapı sağlam, hasarlı ve kritik durumda test edilir.
- efekt ekranı kapatmamalıdır.

### Test 8 — Büyük çatışma

- maksimum hedef birim sayısında animasyon ve VFX performansı ölçülür.

### Test 9 — LOD

- kamera zoom geçişlerinde model sıçraması ve materyal hatası kontrol edilir.

### Test 10 — Düşük kalite

- gölge ve efekt kalitesi düşürüldüğünde oynanış bilgisi korunmalıdır.

---

## 107. Telemetri ve Teknik Ölçümler

- draw call
- üçgen sayısı
- aktif animasyon sayısı
- aktif parçacık sayısı
- gölge maliyeti
- fog maliyeti
- materyal sayısı
- texture bellek kullanımı
- LOD geçiş sayısı
- model yükleme süresi
- ilk maç açılış süresi
- asset streaming hataları

---

# BÖLÜM T — VERTICAL SLICE KAPSAMI

## 108. Zorunlu Görsel Özellikler

- Tek tutarlı low-poly sanat yönü
- Üç çağın bina seviyeleri
- Beş çekirdek birim için ayırt edilebilir siluet
- Takım rengi sistemi
- Kaynak görselleri
- Yol I ve Yol II
- Karakol seviyeleri
- İki stratejik nokta görseli
- İnşaat ve yükseltme sunumu
- Hasar ve yıkım sunumu
- Seçim ve komut efektleri
- Temel savaş VFX
- Fog of war görseli
- HUD ikon seti
- Minimap ikon seti
- LOD ve culling
- Asset test sahnesi
- Görsel debug araçları

---

## 109. İlk Teknik Görsel Prototip

İlk prototip:

```text
Bir bina modeli içe aktar
→ Ölçek ve pivot düzelt
→ Takım rengi uygula
→ Seçim halkası ekle
→ Fog altında gizle
```

İkinci prototip:

```text
Bir işçi ve muhafız modeli içe aktar
→ Idle/Move/Attack bağla
→ Sağlık çubuğu ekle
→ Takım rengini test et
```

Üçüncü prototip:

```text
T1/T2/T3 merkez modelleri
→ Yükseltme geçişi
→ Hasar durumları
→ LOD ve gölge testi
```

---

# BÖLÜM U — AÇIK SORULAR VE KARARLAR

## 110. Açık Tasarım Soruları

### Asset eşleştirme

- Paket içindeki hangi modeller Merkez T1–T3 olacaktır?
- Her ana bina için üç uygun model bulunuyor mu?
- Süvari ve kuşatma modelleri vertical slice için yeterli mi?
- Eksik yapılarda modüler birleşim mi, yeni model mi kullanılmalı?

### Kamera ve okunabilirlik

- Perspektif veya ortografik kamera modelleri daha iyi gösteriyor mu?
- Uzak zoom seviyesinde birim ikonları gerekli mi?
- Bina takım renkleri ne kadar geniş alanda kullanılmalı?
- Stratejik nokta bayrağı ne kadar yüksek olmalı?

### Animasyon

- Paket animasyonları tüm birim rollerini karşılıyor mu?
- İşçi için yeterli çalışma animasyonu bulunuyor mu?
- Kuşatma saldırısı için özel klip gerekli mi?
- Hit reaction kullanılmalı mı?

### Materyal

- Takım rengi vertex color mı, mask texture mı kullanacak?
- Tek ortak shader tüm binaları kapsayabilir mi?
- Alpha mask kullanan materyaller performans sorunu yaratıyor mu?
- Mobil uyum düşünülmese bile texture boyutu sınırı ne olmalı?

### VFX

- Mermi fiziksel mi, yalnız görsel mi olacak?
- Bina dumanı hangi sağlık eşiğinde açılmalı?
- Seçim outline gerekli mi?
- Kamera sallantısı varsayılan açık mı olmalı?

---

## 111. Şimdilik Alınmış Kararlar

- Ana görsel yön stilize low-poly fantastik orta çağ olacaktır.
- Quaternius Ultimate Fantasy RTS paketi ana 3B asset kaynağı olacaktır.
- Tasarım asset-led çalışacak; ancak oynanış rolleri assetlere tamamen teslim edilmeyecektir.
- Asset envanteri ve oyun rolü eşleştirme tablosu üretim öncesinde hazırlanacaktır.
- Orijinal ve işlenmiş assetler ayrı klasörlerde tutulacaktır.
- Ana binalar mümkün olduğunca üç görsel seviye kullanacaktır.
- Her özel bina üç seviyeli olmak zorunda değildir.
- Takım renkleri kontrollü kumaş, bayrak, arma ve kalkan alanlarında kullanılacaktır.
- Seçim halkası ana seçim göstergesi olacaktır.
- Bina girişleri yol bağlantısı için görsel ve teknik anchor kullanacaktır.
- İnşaat zeminden ölçek büyütme animasyonu yerine iskele ve aşamalı görünüm kullanacaktır.
- Hasar üç görsel durumda sunulacaktır: sağlam, hasarlı, kritik.
- Fizik tabanlı büyük yıkım ilk vertical slice içinde olmayacaktır.
- Kalıcı cesetler kullanılmayacaktır.
- Birim animasyonları standart klip isimlerine eşlenecektir.
- Yol I ve Yol II vertical slice için yeterli kabul edilecektir.
- Kontrol alanı normal görünümde hafif, lojistik görünümünde belirgin olacaktır.
- Fog of war dünya VFX'lerini de gizleyecektir.
- UI ikonları basit siluet ve ortak perspektif kullanacaktır.
- Takım ayrımı yalnız renge bağlı olmayacaktır.
- Sabit gündüz aydınlatması kullanılacaktır.
- Paylaşılan materyal, atlas, instancing ve LOD kullanılacaktır.
- Object pooling savaş VFX'lerinde kullanılacaktır.
- Asset test sahnesi ve görsel debug araçları zorunlu olacaktır.
- Tam procedural görsel çeşitlilik, gelişmiş yıkım ve çoklu fraksiyon mimarisi ertelenecektir.

---

## 112. Diğer Dokümanlarla Bağlantılar

- `12_BALANCE_AND_GAME_DATA.md`
  - VFX süreleri,
  - LOD mesafeleri,
  - sağlık görsel eşikleri,
  - takım renk kodları,
  - animasyon hızları.

- `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`
  - asset envanteri,
  - model işleme,
  - animasyon entegrasyonu,
  - VFX ve UI üretim fazları,
  - performans testleri.

---

## 113. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Ana sanat yönü proje vizyonuyla uyumludur.
- [ ] Asset paketinin kullanım stratejisi nettir.
- [ ] Üç çağın görsel gelişimi anlaşılırdır.
- [ ] Bina ve birim okunabilirlik kuralları kabul edilmiştir.
- [ ] Takım rengi yaklaşımı yeterlidir.
- [ ] İnşaat, yükseltme ve hasar sunumu uygulanabilir bulunmuştur.
- [ ] Yol, lojistik ve stratejik nokta görsel dili nettir.
- [ ] VFX kapsamı performans hedefiyle uyumludur.
- [ ] UI ikon ve panel dili kabul edilmiştir.
- [ ] LOD, instancing ve materyal yaklaşımı yeterlidir.
- [ ] Vertical slice asset listesi gerçekçidir.
- [ ] Asset test sahnesi ve kalite kontrol süreci kabul edilmiştir.

---

## 114. Kontrol Listesi

### Sanat yönü

- [ ] Ana görsel yön tanımlandı.
- [ ] Okunabilirlik ilkeleri tanımlandı.
- [ ] Takım rengi ilkeleri tanımlandı.
- [ ] Renk ve aydınlatma yaklaşımı tanımlandı.
- [ ] Sabit gündüz kararı verildi.

### Asset yönetimi

- [ ] Ana asset kaynağı tanımlandı.
- [ ] Asset-led design sınırları tanımlandı.
- [ ] Envanter alanları tanımlandı.
- [ ] Dosya adlandırma standardı tanımlandı.
- [ ] Pivot ve ölçek standardı tanımlandı.
- [ ] Kaynak/işlenmiş/runtime klasörleri ayrıldı.
- [ ] Asset kabul akışı tanımlandı.

### Binalar

- [ ] Bina kategorilerinin görsel dili tanımlandı.
- [ ] T1/T2/T3 gelişim tanımlandı.
- [ ] Ana bina eşleştirme yaklaşımı oluşturuldu.
- [ ] Footprint kuralları tanımlandı.
- [ ] Giriş anchor yaklaşımı tanımlandı.
- [ ] İnşaat görseli tanımlandı.
- [ ] Yükseltme görseli tanımlandı.
- [ ] Hasar ve yıkım görseli tanımlandı.

### Birimler

- [ ] İşçi silueti tanımlandı.
- [ ] Muhafız silueti tanımlandı.
- [ ] Okçu silueti tanımlandı.
- [ ] Süvari silueti tanımlandı.
- [ ] Kuşatma silueti tanımlandı.
- [ ] Seviye varyasyonu tanımlandı.
- [ ] Animasyon gereksinimleri listelendi.
- [ ] Ölüm sunumu tanımlandı.

### Dünya ve sistem görselleri

- [ ] Kaynak görselleri tanımlandı.
- [ ] İşçi çalışma sunumu tanımlandı.
- [ ] Yol seviyeleri tanımlandı.
- [ ] Yol segmentleri listelendi.
- [ ] Lojistik bağlantı durumu tanımlandı.
- [ ] Kontrol alanı görünümü tanımlandı.
- [ ] Stratejik nokta görünümü tanımlandı.
- [ ] Ele geçirme efekti tanımlandı.

### VFX ve UI

- [ ] Yakın dövüş efekti tanımlandı.
- [ ] Ok mermisi tanımlandı.
- [ ] Kuşatma efekti tanımlandı.
- [ ] Yapı hasar efekti tanımlandı.
- [ ] Seçim ve komut efektleri tanımlandı.
- [ ] UI teması tanımlandı.
- [ ] İkon stili tanımlandı.
- [ ] Kaynak ve durum ikonları listelendi.
- [ ] Minimap görseli tanımlandı.

### Teknik ve performans

- [ ] Materyal paylaşımı tanımlandı.
- [ ] Takım rengi shader'ı tanımlandı.
- [ ] Ghost materyali tanımlandı.
- [ ] Fog shader ilişkisi tanımlandı.
- [ ] LOD yaklaşımı tanımlandı.
- [ ] Instancing listesi oluşturuldu.
- [ ] Texture atlas yaklaşımı tanımlandı.
- [ ] VFX bütçesi tanımlandı.
- [ ] Animasyon bütçesi tanımlandı.
- [ ] Culling yaklaşımı tanımlandı.
- [ ] Veri şemaları taslaklandı.
- [ ] Save/load gereksinimleri tanımlandı.

### Kalite kontrol

- [ ] Asset test sahnesi tanımlandı.
- [ ] Görsel debug modları listelendi.
- [ ] Asset kabul kontrolü oluşturuldu.
- [ ] Edge case'ler incelendi.
- [ ] Görsel test senaryoları oluşturuldu.
- [ ] Teknik ölçümler listelendi.
- [ ] Vertical slice asset listesi oluşturuldu.

---

## 115. Revizyon Notları

### Sürüm 0.1

- Ana sanat yönü ve okunabilirlik kuralları oluşturuldu.
- Quaternius asset paketi kullanım stratejisi tanımlandı.
- Asset envanteri, dosya standardı, pivot ve ölçek süreci oluşturuldu.
- Yapıların üç çağlık görsel gelişimi detaylandırıldı.
- Birim siluetleri, takım renkleri ve animasyon ihtiyaçları tanımlandı.
- Kaynak, yol, lojistik ve stratejik nokta görselleri oluşturuldu.
- Savaş VFX, UI ikon dili ve ses-görsel ilişkisi tanımlandı.
- Materyal, shader, LOD, instancing ve performans yaklaşımı eklendi.
- Asset entegrasyon akışı, debug, kalite kontrol ve test planları oluşturuldu.

# 04 — Buildings and Settlement

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Yapılar ve Yerleşim Sistemi  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Bağlı dokümanlar:**  
> - `00_GAME_VISION_AND_PILLARS.md`  
> - `01_CORE_GAMEPLAY_LOOP.md`  
> - `02_MATCH_FLOW_AND_PROGRESSION.md`  
> - `03_ECONOMY_AND_RESOURCES.md`

---

> **İlerleme Modeli Revizyonu (2026-07-18):** §31 yeniden yazıldı — yapı
> seviyeleri artık çağ ile sınırlandırılmaz; çağ ve seviye bağımsız iki eksendir
> (`02 §25`). §3.3 ve §5.1'e buna bağlı notlar eklendi. Uygulama kaydı:
> `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`.
>
> **Kapsam Hizalaması (v0.2):** Bu belgenin tasarım gövdesi 0.1 taslağıdır; **üretim kapsamı** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` (Ürün A/B/C kapıları) tarafından belirlenir. "Vertical slice için zorunlu" ifadeleri tam oyun hedefini anlatır — bir özelliğin hangi üründe (A/B/C) açıldığı ya da koşullu/kapsam dışı olduğu konusunda 13 v0.2 esastır. Forge'a özgü teknik hizalama için bkz. `TECH_DECISIONS.md`.

---

## 1. Dokümanın Amacı

Bu doküman oyundaki yapı sistemini, yerleşim kurallarını, bina seviyelerini, inşaat ve yükseltme süreçlerini, hasar ve onarım davranışlarını ve yapıların diğer oyun sistemleriyle ilişkisini tanımlar.

Belge şu sorulara cevap verir:

- Oyunda hangi yapı kategorileri bulunur?
- Her yapının rolü nedir?
- Yapılar hangi koşullarda yerleştirilebilir?
- Yapı inşası nasıl gerçekleşir?
- Yapı seviyeleri ve çağ ilerlemesi nasıl bağlanır?
- Her bina üç seviyeli olmak zorunda mıdır?
- Yapılar yol ve kontrol alanına nasıl bağlanır?
- Yapılar hasar aldığında, yıkıldığında veya kontrol dışı kaldığında ne olur?
- Yapı spam'i ve savunmaya kapanma nasıl sınırlandırılır?
- AI hangi yapı kararlarını nasıl verir?
- Vertical slice için hangi yapılar zorunludur?

Bu belge kesin maliyet, sağlık ve süre değerlerini sabitlemez. Sayısal veriler `12_BALANCE_AND_GAME_DATA.md` içinde tutulacaktır.

---

## 2. Yapı Sisteminin Tasarım Hedefi

Yapılar oyuncunun ekonomisini, savunmasını, askerî kapasitesini ve bölgesel gücünü harita üzerinde görünür hale getirir.

Yapı sistemi:

- okunabilir olmalı,
- her yapıya net bir rol vermeli,
- yerleşim kararlarını anlamlı kılmalı,
- yol ve bölge kontrolüyle bütünleşmeli,
- üç gelişim seviyesini görsel olarak desteklemeli,
- aşırı bina çeşitliliği yaratmamalı,
- web performansını korumalıdır.

Oyuncunun ana yapı sorusu şudur:

> “Bu yapıyı nereye, ne zaman ve hangi seviyede kurarsam yerleşimime en fazla stratejik faydayı sağlar?”

---

## 3. Temel Tasarım İlkeleri

### 3.1 Her yapı net bir işlev taşımalıdır

Bir yapı aşağıdaki rollerden en az birine sahip olmalıdır:

- kaynak üretmek,
- kaynak depolamak,
- nüfus kapasitesi sağlamak,
- birlik üretmek,
- yeni teknoloji açmak,
- kontrol alanı oluşturmak,
- bölgeyi savunmak,
- lojistik ağı desteklemek,
- zafer koşuluna katkı vermek.

Yalnızca görsel çeşitlilik sağlayan yapılar oynanış yapısı olarak kullanılmamalıdır.

### 3.2 Konum kararı önemlidir

Yapı konumu şu sonuçları etkileyebilir:

- üretim verimi,
- yol uzunluğu,
- savunma güvenliği,
- kontrol alanı,
- kaynak erişimi,
- düşman baskınına açıklık,
- birlik çıkış rotası.

### 3.3 Yapı seviyesi yeni rol açmalıdır

Yükseltme mümkün olduğunca sadece daha fazla sağlık veya üretim vermemelidir.

Örnek:

- Depo Lv2 yalnızca daha fazla stok değil, alternatif yol bağlantısı desteği sağlar.
- Karakol Lv2 yalnızca daha dayanıklı değil, daha geniş kontrol alanı üretir.
- Kışla Lv2 yalnızca daha hızlı üretmez, yeni birlik türü açar (Koçbaşı).

> **Not — birim kapısı çağ + seviye çiftidir.** §31 uyarınca seviye merdiveninin
> çağ kapısı yoktur, dolayısıyla `requiredBuildingLevel` tek başına bir çağ
> kapısı değildir. Birimler bu yüzden ayrıca `requiredAge` taşır: Koçbaşı
> *Kasaba çağı + Kışla Lv2* ister. Okçu ise Kışla'dan tamamen çıkarılıp kendi
> binasına (Okçuluk Alanı, Kasaba çağı) taşındı. Tablo: `02 §30.1`.

### 3.4 Her bina üç seviyeli olmak zorunda değildir

Üç görsel model bulunan yapılar ana sistemlerde kullanılmalıdır.

Ancak:

- geç açılan özel yapılar,
- zafer yapıları,
- kuşatma yapıları,
- tek görevli yardımcı yapılar

tek veya iki seviyeli olabilir.

### 3.5 Yerleşim düzeni okunabilir olmalıdır

Binalar birbirine aşırı sık yerleştirilmemelidir.

Oyuncu:

- yol ağını,
- üretim bölgelerini,
- askerî alanları,
- sınır karakollarını,
- merkez bölgesini

kolayca ayırt edebilmelidir.

---

# BÖLÜM A — YAPI KATEGORİLERİ

## 4. Ana Yapı Kategorileri

Oyundaki yapılar altı ana kategoriye ayrılır:

1. Yönetim yapıları
2. Ekonomik yapılar
3. Konut ve nüfus yapıları
4. Askerî üretim yapıları
5. Savunma ve bölge kontrolü yapıları
6. Lojistik ve destek yapıları

Ek olarak:

7. Zafer yapıları
8. Dekoratif çevre öğeleri

bulunabilir.

---

## 5. Yönetim Yapıları

Yönetim yapıları yerleşimin merkezini ve çağ ilerlemesini temsil eder.

### 5.1 Merkez Binası

Ana görevleri:

- başlangıç kontrol alanı oluşturmak,
- işçi üretmek,
- temel kaynak kapasitesi sağlamak,
- çağ atlama işlemini yürütmek,
- ana yerleşim merkezi olmak,
- oyuncunun ana yenilgi hedefi olmak.

Seviyeleri:

- Merkez I — Yerleşim Merkezi
- Merkez II — Kasaba Merkezi
- Merkez III — Kale / Krallık Merkezi

> **Merkez, per-bina seviye sisteminin dışındadır.** Diğer yapıların aksine
> Merkez'in ayrı bir Lv1→Lv2→Lv3 yükseltme düğmesi yoktur; `level`'ı doğrudan
> **çağ katmanını** taşır ve yalnızca çağ atlayınca değişir. Yukarıdaki üçlü,
> per-bina merdiven değil, üç çağın Merkez karşılığıdır.

### 5.2 Yönetim veya Refah Yapısı

Opsiyonel Kasaba veya Krallık yapısı.

Görevleri:

- Refah artırmak,
- bazı gelişim koşullarını kolaylaştırmak,
- yönetim teknolojileri açmak,
- zafer veya puan sistemine katkı sağlamak.

Vertical slice kapsam baskısı oluşursa ertelenebilir.

---

## 6. Ekonomik Yapılar

Ekonomik yapılar kaynak üretir veya üretimi destekler.

Ana yapılar:

- Tarla / Çiftlik
- Oduncu Kampı
- Taş Ocağı
- Altın Madeni
- Depo
- Pazar

Ayrıntılı kaynak davranışları `03_ECONOMY_AND_RESOURCES.md` içinde tanımlanmıştır.

---

## 7. Konut ve Nüfus Yapıları

### 7.1 Ev

Ana görevleri:

- nüfus kapasitesi sağlamak,
- Refah katkısı vermek,
- yerleşim gelişimini görsel olarak göstermek.

Seviyeleri:

- Ev I
- Ev II
- Ev III

Önerilen işlevsel gelişim:

| Seviye | Ana işlev |
|---|---|
| Ev I | Temel nüfus kapasitesi |
| Ev II | Daha yüksek nüfus + küçük Refah |
| Ev III | Yüksek nüfus + daha yüksek dayanıklılık + Refah |

### 7.2 Ev Spam'ini Önleme

Evlerin yalnızca en ucuz bina olarak haritayı doldurması önlenmelidir.

Olası araçlar:

- minimum aralık,
- yol bağlantısı,
- artan maliyet,
- yapı limiti,
- çağ seviyesi başına kapasite,
- Refah etkisinde azalan getiri.

Vertical slice için önerilen çözüm:

- yol bağlantısı,
- minimum yerleşim boşluğu,
- seviye yükseltmesini yeni ev kurmaya alternatif hale getirmek.

---

## 8. Askerî Üretim Yapıları

### 8.1 Kışla

Üretir:

- temel yakın dövüş birimi,
- gelişmiş yakın dövüş birimi,
- seçkin yakın dövüş birimi.

Seviye etkileri:

- yeni birlik açılımı,
- üretim hızı,
- kuyruk kapasitesi,
- yapı dayanıklılığı.

### 8.2 Okçuluk Alanı

Üretir:

- okçu,
- gelişmiş okçu,
- isteğe bağlı keşif birimi.

**Uygulandı** (`archery_range`): yalnız Kasaba çağında yerleştirilebilir
(`requiredAge: "town"`), 8×8 footprint, 160 Odun + 40 Taş, 55 sn, 600 sağlık;
kendi Lv1–3 merdiveni var (`02 §25.2`).

Bir dönem Okçu'nun ayrı bina yerine Kışla Lv2 içinde açılması planlanmıştı;
o karar geri alındı — gerekçe `02 §30.1`.

### 8.3 Süvari Yapısı

Krallık seviyesinde veya Kasaba sonlarında açılabilir.

Vertical slice kapsamına göre:

- ayrı yapı olabilir,
- gelişmiş kışla içinde açılabilir.

Kapsam kontrolü için ayrı bina yerine Kışla Lv3 içinde süvari üretimi değerlendirilebilir.

### 8.4 Kuşatma Atölyesi

Krallık seviyesinde açılır.

Üretir:

- tek temel kuşatma birimi.

İlk vertical slice için tek seviyeli olabilir.

### 8.5 Askerî Yapı Spam'ini Önleme

Olası yöntemler:

- yüksek maliyet,
- nüfus yerine yapı limiti,
- aynı tür yapı için artan maliyet,
- yol bağlantısı zorunluluğu,
- çağ seviyesi başına limit.

İlk vertical slice için önerilen yaklaşım:

- ekonomik maliyet,
- yol bağlantısı,
- kontrol alanı,
- üretim kuyruğu sınırı.

---

## 9. Savunma ve Bölge Kontrolü Yapıları

### 9.1 Karakol

Ana görevleri:

- kontrol alanını genişletmek,
- yeni bölgelerde yapı kurmayı mümkün kılmak,
- sınırlı görüş sağlamak,
- lojistik ağı desteklemek,
- sınır bölgesini savunmak.

Seviyeleri:

- Karakol I
- Karakol II
- Karakol III

Karakol, oyunun ayırt edici ana yapılarından biridir.

### 9.2 Gözcü Kulesi

Ana görevleri:

- görüş alanı,
- erken uyarı,
- sınırlı menzilli savunma.

Karakoldan farklı olarak:

- kontrol alanı oluşturmayabilir,
- daha ucuz olabilir,
- saldırı gücü veya görüş avantajı sunabilir.

### 9.3 Savunma Kulesi

Kasaba veya Krallık seviyesinde açılır.

Ana görevleri:

- dar geçitleri savunmak,
- karakolları korumak,
- yol bağlantılarına güvenlik sağlamak.

### 9.4 Duvar ve Kapı

İlk vertical slice için opsiyoneldir.

Riskleri:

- pathfinding karmaşıklığı,
- kapı davranışı,
- AI saldırı hedefleme maliyeti,
- harita sıkışması.

Öneri:

İlk vertical slice içinde tam duvar sistemi yerine:

- sınırlı savunma bariyerleri,
- taş bloklar,
- geçit kuleleri

kullanılabilir.

---

## 10. Lojistik ve Destek Yapıları

### 10.1 Depo

Görevleri:

- kaynak kapasitesi,
- lojistik bağlantı noktası,
- uzak üretim bölgelerini global stoğa bağlama,
- alternatif rota oluşturma.

### 10.2 Yol Düğümü

Ayrı bir yapı olmak zorunda değildir.

Yolların birleştiği alanlarda:

- küçük görsel kavşak,
- yön bilgisi,
- ağ düğümü

olarak sistem tarafından temsil edilebilir.

### 10.3 Pazar

Görevleri:

- kaynak dönüşümü,
- Refah katkısı,
- gelecekte ticaret,
- yerleşim merkezi rolü.

Vertical slice için opsiyoneldir.

### 10.4 Onarım Noktası

Ayrı yapı olarak önerilmez.

Onarım:

- işçiler,
- merkez,
- karakol

üzerinden yürütülmelidir.

---

## 11. Zafer Yapıları

Krallık seviyesinde açılabilecek tek bir özel yapı.

Olası işlevler:

- Refah zaferi,
- bölgesel zafer desteği,
- yüksek puan,
- maç sonu savunma hedefi.

İlk vertical slice için ana zafer koşulları:

- askerî zafer,
- bölgesel zafer.

Bu nedenle zafer yapısı ertelenebilir.

---

## 12. Dekoratif Yapılar

Dekoratif öğeler:

- fıçılar,
- çit parçaları,
- arabalar,
- bayraklar,
- sandıklar,
- küçük bahçeler,
- tabelalar

oynanışı etkilememelidir.

Kurallar:

- seçim yapılmamalı,
- pathfinding'i gereksiz bozmamalı,
- önemli yapı siluetlerini gizlememeli,
- performans bütçesi içinde kullanılmalıdır.

---

# BÖLÜM B — ÖNERİLEN VERTICAL SLICE YAPI LİSTESİ

## 13. Zorunlu Yapılar

İlk vertical slice için önerilen çekirdek yapı kadrosu:

1. Merkez Binası
2. Ev
3. Depo
4. Tarla / Çiftlik
5. Oduncu Kampı
6. Taş Ocağı
7. Altın Madeni
8. Kışla
9. Okçu Yapısı veya Kışla yükseltmesi
10. Karakol
11. Gözcü / Savunma Kulesi
12. Kuşatma Atölyesi veya tek geç oyun askerî yapısı

Bu liste 10–12 yapı hedefiyle uyumludur.

---

## 14. Kapsamı Daraltma Seçeneği

Geliştirme yükü artarsa:

- ~~Okçu yapısı Kışla Lv2 içine alınabilir.~~ **Geri alındı:** Okçu kendi
  binasına taşındı (Okçuluk Alanı, `requiredAge: town`) — gerekçe `02 §30.1`.
- Süvari ayrı bina yerine Kışla Lv3'te açılabilir.
- Kuşatma Atölyesi tek seviyeli olabilir.
- Pazar ertelenebilir.
- Gözcü ve Savunma Kulesi tek yapı altında birleşebilir.

Daraltılmış çekirdek liste:

1. Merkez
2. Ev
3. Depo
4. Tarla
5. Oduncu Kampı
6. Taş Ocağı
7. Altın Madeni
8. Kışla
9. Karakol
10. Kule

---

# BÖLÜM C — YAPI YERLEŞTİRME

## 15. Yerleştirme Akışı

```text
Yapı menüsünü aç
→ Yapıyı seç
→ Hayalet önizlemeyi göster
→ Konum geçerliliğini kontrol et
→ Yol ve kontrol alanını önizle
→ Yerleştirmeyi onayla
→ Kaynağı ayır
→ İnşaat emri oluştur
```

---

## 16. Geçerli Yerleştirme Koşulları

Bir yapının yerleştirilebilmesi için:

- yeterli kaynak bulunmalı,
- oyuncunun kontrol alanı içinde olmalı,
- zemin uygun olmalı,
- başka yapı veya engelle çakışmamalı,
- harita sınırları içinde olmalı,
- gerekli kaynak alanına yeterince yakın olmalı,
- minimum bina aralığını sağlamalı,
- gerekiyorsa yol erişimine sahip olmalı,
- çağ gereksinimi karşılanmalı.

---

## 17. Zemin Uygunluğu

Yapılar arazi türlerine göre sınırlandırılabilir.

Önerilen basit sınıflar:

- düz arazi,
- orman kenarı,
- maden yatağı,
- verimli toprak,
- yol kenarı,
- yasaklı arazi.

Örnek:

- Tarla: verimli veya düz arazi
- Oduncu Kampı: orman yakınlığı
- Taş Ocağı: taş yatağı
- Altın Madeni: altın yatağı
- Kule: düz veya hafif yükselti
- Merkez: büyük düz alan

---

## 18. Eğim Kuralları

İlk vertical slice için:

- yapı temeli belirli eğim sınırını aşamaz,
- aşırı arazi düzleştirme simülasyonu kullanılmaz,
- önizleme geçersiz alanı açıkça gösterir.

Gerekirse yapı yerleştirme sırasında:

- küçük temel düzleştirme,
- görsel platform

kullanılabilir.

---

## 19. Bina Aralığı

Yapılar arasında minimum boşluk bulunmalıdır.

Amaç:

- birim geçişini korumak,
- seçim kolaylığı,
- görsel okunabilirlik,
- pathfinding hatalarını azaltmak.

Minimum aralık yapı türüne göre değişebilir.

Örnek:

- Ev: küçük aralık
- Depo: orta aralık
- Kışla: orta/büyük aralık
- Merkez: büyük aralık
- Kule: küçük aralık

---

## 20. Yol Erişimi

Yol gerektiren yapılar:

- üretim yapıları,
- depo,
- askerî üretim yapıları,
- pazar,
- karakol.

Yerleştirme sırasında:

- en yakın yol bağlantısı vurgulanmalı,
- geçerli bağlantı noktası gösterilmeli,
- yol yoksa yapı yerleştirilebilir ama bağlantısız başlayabilir veya tamamen engellenebilir.

Vertical slice için önerilen yaklaşım:

- yapılar kontrol alanında yol olmadan yerleştirilebilir,
- ancak üretim ve işlev için yol bağlantısı gerekir.

Bu yaklaşım oyuncunun önce bina sonra yol veya önce yol sonra bina kurabilmesine izin verir.

---

## 21. Yapı Döndürme

Yapılar 90 derecelik adımlarla döndürülebilir.

Amaç:

- yol girişlerini hizalamak,
- birlik çıkışını düzenlemek,
- yerleşim okunabilirliğini artırmak.

Serbest dönüş:

- gerekli değildir,
- grid ve bağlantı hesaplarını zorlaştırabilir.

---

## 22. Grid Sistemi

Önerilen yaklaşım:

- görünmez yapı grid'i,
- yol için daha küçük hücre yapısı,
- yapı önizlemesinde snap,
- oyuncuya gerektiğinde grid görünümü.

Alternatif serbest yerleştirme daha doğal görünür; ancak pathfinding ve yol bağlantısı için daha pahalıdır.

Vertical slice için grid tabanlı veya grid destekli yerleştirme önerilir.

---

## 23. Yapı Yerleştirme Önizlemesi

Önizlemede gösterilmesi gerekenler:

- yapı hayaleti,
- geçerli/geçersiz durum,
- kapladığı alan,
- giriş yönü,
- en yakın yol bağlantısı,
- kontrol alanı,
- üretim veya savunma menzili,
- kaynak erişim yarıçapı.

---

# BÖLÜM D — İNŞAAT SİSTEMİ

## 24. İnşaat Akışı

```text
Yapı yerleştir
→ İnşaat alanı oluşur
→ Bir veya daha fazla işçi atanır
→ İnşaat ilerler
→ Model aşamalı görünür
→ Yapı tamamlanır
→ Yol ve sistem bağlantıları etkinleşir
```

---

## 25. İnşaat İşçileri

İlk vertical slice için:

- bir yapı en az bir işçiyle inşa edilir,
- birden fazla işçi süreci hızlandırabilir,
- azalan verim uygulanabilir.

Örnek:

```text
1. işçi: %100 hız
2. işçi: toplam %170
3. işçi: toplam %220
4. işçi: toplam %250
```

Kesin değerler daha sonra belirlenir.

---

## 26. İnşaat Modeli

Önerilen görsel yaklaşım:

- temel iskelet,
- yarım tamamlanmış model,
- tam yapı.

Quaternius paketinde doğrudan inşaat aşaması yoksa:

- ölçek animasyonu kullanılmamalı,
- basit iskele,
- malzeme yığını,
- şeffaf hayalet model,
- parçalı görünürlük

kullanılabilir.

---

## 27. Yapının Ne Zaman Aktif Olduğu

Varsayılan kural:

- yapı yalnızca %100 tamamlandığında tam aktif olur.

İstisnalar:

- inşaat alanı fiziksel engel sayılabilir,
- düşman tarafından hedef alınabilir,
- belirli oranda sağlık kazanabilir.

---

## 28. İnşaat Sağlığı

İnşaat halindeki yapı:

- tamamlanma oranına bağlı maksimum sağlığa sahip olabilir,
- saldırı altında daha kolay yıkılmalıdır.

Örnek:

```text
%40 inşaat
→ maksimum sağlığın %40'ı
```

---

## 29. İnşaat İptali

Önerilen iade yaklaşımı:

- işçi başlamadan iptal: %100
- düşük ilerleme: yüksek iade
- yüksek ilerleme: düşük iade
- saldırıyla yok edilme: iade yok

Kesin oranlar denge dokümanında tanımlanır.

---

## 30. İnşaat Engellenmesi

Bir işçi yapı alanına ulaşamazsa:

- görev `Blocked` durumuna geçer,
- alternatif yol aranır,
- oyuncuya uyarı gösterilir,
- yapı sonsuza kadar sessizce beklememelidir.

---

# BÖLÜM E — YAPI SEVİYELERİ

## 31. Seviye Sistemi

**Yapı seviyeleri çağ seviyesiyle sınırlandırılmaz.** Çağ ve seviye bağımsız
iki eksendir (`02 §25`).

```text
Her çağın içinde
→ Lv1 → Lv2 → Lv3 merdiveni her zaman açıktır
→ Yükseltme bina instance'ı başınadır, tür-geneli değildir
→ Aynı türden iki bina farklı seviyelerde olabilir

Çağ atlandığında
→ Sahibin bütün yapıları yeni çağın Lv1 modeline geçer
→ Seviyeler 1'e sıfırlanır, merdiven yeniden tırmanılır
```

Çağın seviye üzerindeki tek etkisi **hangi sanat ailesinin** kullanıldığıdır
(Yerleşim → `FirstAge`, Kasaba → `SecondAge`).

> **v0.1'den değişiklik.** Bu bölüm daha önce "Yerleşim → en fazla Seviye I,
> Kasaba → Seviye II açılır" diyordu. O kapı uygulanmadı ve kaldırıldı (`KR-04`);
> gerekçe, seviye merdivenini çağ beklemeden anlamlı bir karar haline
> getirmekti.

---

## 32. Yapı Yükseltme Akışı

```text
Yapıyı seç
→ Yükseltme seçeneğini gör
→ Maliyet ve faydayı incele
→ Yükseltmeyi başlat
→ Yapı geçici olarak sınırlı çalışır
→ Görsel dönüşüm tamamlanır
→ Yeni seviye özellikleri açılır
```

---

## 33. Yükseltme Sırasında İşlev

Yapı türüne göre:

### Tam kapanma

Uygun yapılar:

- Kışla
- Okçu Yapısı
- Pazar

### Kısmi çalışma

Uygun yapılar:

- Depo
- Ev
- Merkez

### Devam eden temel işlev

Uygun yapılar:

- Karakol
- Kule

Vertical slice için basitleştirme:

- tüm yapılar yükseltme sırasında ana işlevini geçici durdurabilir,
- ancak kontrol alanı ve nüfus gibi sistemleri aniden kapatmamak gerekir.

---

## 34. Mevcut Nüfus ve Ev Yükseltmesi

Ev yükseltme sırasında:

- mevcut nüfus kapasitesi düşmemelidir,
- yeni kapasite yalnızca tamamlandığında eklenmelidir.

Bu sayede oyuncu geçici olarak nüfus sınırının altına düşürülmez.

---

## 35. Depo Yükseltmesi

Depo yükseltme sırasında:

- mevcut kaynaklar korunur,
- bağlantı kesilmemelidir veya kısa süreli kesinti açıkça gösterilmelidir,
- yeni kapasite tamamlandığında etkinleşir.

---

## 36. Merkez Yükseltmesi

Merkez yükseltmesi çağ atlama ile bağlantılıdır.

Süreç:

- çağ gereksinimleri tamamlanır,
- merkez yükseltmesi başlatılır,
- işçi üretimi durabilir,
- merkez kontrol alanı korunur,
- süreç tamamlandığında yeni çağ açılır.

---

## 37. Yapı Yükseltme Faydaları

Yükseltme faydaları şu kategorilere ayrılır:

- kapasite artışı,
- üretim hızı,
- sağlık,
- kontrol alanı,
- görüş,
- yeni üretim seçeneği,
- daha fazla işçi limiti,
- lojistik dayanıklılık,
- Refah katkısı.

Her yapı en fazla 2–3 ana fayda almalıdır.

---

# BÖLÜM F — YAPI DETAYLARI

## 38. Merkez Binası

### Rol

- ana yönetim,
- işçi üretimi,
- çağ atlama,
- başlangıç deposu,
- başlangıç kontrol alanı,
- ana yenilgi hedefi.

### Seviye I

- düşük sağlık,
- temel işçi üretimi,
- küçük kontrol alanı,
- düşük depolama.

### Seviye II

- daha yüksek sağlık,
- daha geniş kontrol alanı,
- daha hızlı işçi üretimi,
- Kasaba yapıları açılımı.

### Seviye III

- kale görünümü,
- yüksek sağlık,
- gelişmiş kontrol alanı,
- Krallık yapıları açılımı,
- sınırlı savunma yeteneği değerlendirilebilir.

### Tasarım Notu

Merkez binasının saldırı gücü çok yüksek olmamalıdır. Aksi halde erken baskınlar anlamsızlaşır.

---

## 39. Ev

### Rol

- nüfus kapasitesi,
- küçük Refah katkısı,
- yerleşim görünümü.

### Seviye I

- düşük maliyet,
- düşük kapasite.

### Seviye II

- daha yüksek kapasite,
- Refah katkısı.

### Seviye III

- yüksek kapasite,
- daha yüksek sağlık,
- daha yüksek Refah.

### Tasarım Notu

Evler aktif üretim yapmadığı için seçim paneli sade olmalıdır.

---

## 40. Depo

### Rol

- kaynak kapasitesi,
- lojistik düğüm,
- dış üretim bağlantısı.

### Seviye I

- düşük kapasite,
- temel bağlantı.

### Seviye II

- daha yüksek kapasite,
- daha yüksek dayanıklılık,
- isteğe bağlı ikinci bağlantı avantajı.

### Seviye III

- yüksek kapasite,
- güçlü lojistik düğüm,
- kesintiye karşı daha dayanıklı.

---

## 41. Tarla / Çiftlik

### Rol

- sürdürülebilir yiyecek üretimi.

### Seviye I

- düşük işçi kapasitesi,
- temel verim.

### Seviye II

- daha fazla işçi,
- daha yüksek yerel tampon.

### Seviye III

- yüksek verim,
- küçük Refah bonusu.

### Yerleştirme

- düz veya verimli arazi,
- yol bağlantısı,
- kontrol alanı.

---

## 42. Oduncu Kampı

### Rol

- odun üretimi.

### Seviye I

- küçük çalışma yarıçapı,
- düşük işçi limiti.

### Seviye II

- daha geniş yarıçap,
- daha yüksek kapasite.

### Seviye III

- yüksek verim,
- tükenen yakın ormanlara karşı daha iyi erişim.

### Yerleştirme

- orman yakınlığı zorunlu.

---

## 43. Taş Ocağı

### Rol

- taş üretimi.

### Seviye I

- düşük işçi kapasitesi.

### Seviye II

- daha yüksek verim.

### Seviye III

- yüksek kapasite,
- gelişmiş yerel tampon.

### Yerleştirme

- taş yatağı yakınlığı veya üzerine.

---

## 44. Altın Madeni

### Rol

- altın üretimi.

### Seviye I

- düşük işçi kapasitesi,
- yüksek stratejik değer.

### Seviye II

- daha yüksek verim.

### Seviye III

- yüksek verim,
- yüksek maliyet,
- güçlü savunma ihtiyacı.

### Yerleştirme

- altın yatağına bağlı.

---

## 45. Kışla

### Rol

- yakın dövüş birimi üretimi,
- bazı askerî yükseltmeler.

### Seviye I

- temel muhafız.

### Seviye II

- gelişmiş muhafız,
- daha hızlı üretim.

### Seviye III

- seçkin muhafız,
- süvari veya ek birlik açılımı değerlendirilebilir.

---

## 46. Okçu Yapısı

### Rol

- menzilli birlik üretimi.

### Seviye I veya Kasaba başlangıcı

- temel okçu.

### Seviye II

- gelişmiş okçu.

### Seviye III

- seçkin okçu,
- daha hızlı üretim.

Kapsam daraltılırsa Kışla içinde birleşebilir.

---

## 47. Karakol

### Rol

- kontrol alanı,
- görüş,
- lojistik ara düğüm,
- sınır savunması.

### Seviye I

- küçük kontrol alanı,
- düşük sağlık,
- sınırlı görüş.

### Seviye II

- daha geniş alan,
- daha yüksek sağlık,
- küçük savunma.

### Seviye III

- güçlü sınır yapısı,
- geniş görüş,
- yüksek dayanıklılık.

### Kısıtlar

- başka karakollara minimum mesafe,
- yol bağlantısı,
- kontrol zinciri veya merkez bağlantısı.

---

## 48. Kule

### Rol

- savunma,
- görüş,
- dar geçit kontrolü.

### Seviye I

- gözcü rolü.

### Seviye II

- menzilli savunma.

### Seviye III

- daha yüksek menzil ve sağlık.

### Kısıtlar

- yoğun kule spam'i önlenmelidir,
- minimum aralık veya bölge başına limit kullanılabilir.

---

## 49. Kuşatma Atölyesi

### Rol

- bina karşıtı birim üretimi.

### Özellikler

- Krallık çağında açılır,
- yüksek maliyet,
- yavaş üretim,
- tek seviyeli olabilir.

---

# BÖLÜM G — HASAR, ONARIM VE YIKIM

## 50. Yapı Sağlığı

Her yapı:

- maksimum sağlık,
- mevcut sağlık,
- zırh veya hasar direnci,
- yapı sınıfı

değerlerine sahiptir.

İlk vertical slice için karmaşık zırh sistemi yerine:

- yapı hasar katsayısı,
- kuşatma bonusu

kullanılabilir.

---

## 51. Hasar Durumları

Önerilen eşikler:

- %100–61: Sağlam
- %60–31: Hasarlı
- %30–1: Kritik
- %0: Yıkılmış

Hasar görsel geri bildirimi:

- çatlak,
- duman,
- kırık parça,
- renk değişimi,
- sağlık çubuğu.

Grafik veya yoğun yıkım gerektirmez.

---

## 52. Hasarın İşlevsel Etkisi

İlk vertical slice için:

- %60 altı: küçük üretim cezası
- %30 altı: daha yüksek üretim cezası
- %0: yapı yok olur

Savunma yapıları için:

- düşük sağlıkta saldırı hızı düşebilir.

Kontrol alanı yapıları için:

- sağlık azaldığında kontrol alanı küçülmemelidir; bu okunabilirliği bozabilir.
- kontrol alanı ancak yapı yıkıldığında kaybolmalıdır.

---

## 53. Onarım

İşçiler yapıları onarabilir.

Onarım:

- kaynak tüketir,
- işçi zamanı kullanır,
- saldırı altında risklidir,
- aynı anda sınırlı işçi kabul eder.

Önerilen kaynak:

- yapının ana inşaat malzemesi.

Örnek:

- ahşap yapı → odun
- taş yapı → taş
- gelişmiş yapı → odun + taş

---

## 54. Otomatik Onarım

İlk vertical slice için otomatik onarım önerilmez.

Neden:

- kaynak tüketimini gizler,
- oyuncu kararını azaltır,
- saldırı sonuçlarını zayıflatır.

Karakol veya merkez için yavaş pasif onarım gelecekte değerlendirilebilir.

---

## 55. Yapı Yıkımı

Yapı yok olduğunda:

- model kaldırılır veya enkaz görünür,
- bağlantı ağı güncellenir,
- kontrol alanı değişir,
- üretim kuyruğu iptal olur,
- atanmış işçiler boşta kalır veya kaçar,
- nüfus kapasitesi etkilenebilir,
- bağlı yapılar yeni rota arar.

---

## 56. Enkaz

Enkaz sistemi opsiyoneldir.

Olası davranış:

- kısa süre görsel kalıntı,
- pathfinding engeli oluşturmaz,
- oyuncu veya işçi temizliği gerektirmez.

İlk vertical slice için kalıcı enkaz önerilmez.

---

## 57. Kendi Yapısını Yıkma

Oyuncu kendi yapısını kaldırabilir.

Kurallar:

- işlem onay gerektirir,
- inşa edilmemiş yapıda iade olabilir,
- tamamlanmış yapıda düşük veya sıfır iade,
- stratejik sistemleri etkileyebileceği için uyarı gösterilir.

Örnek uyarı:

> Bu depoyu kaldırmak 3 üretim yapısının bağlantısını kesecek.

---

# BÖLÜM H — KONTROL ALANI DIŞINDA KALMA

## 58. Kontrol Kaybı

Bir karakol veya merkez yıkıldığında bazı yapılar kontrol alanı dışında kalabilir.

Önerilen durum:

```text
Aktif
→ Kontrol dışı
→ Yeniden bağlandı veya terk edildi
```

---

## 59. Kontrol Dışı Yapı Davranışı

Kontrol dışı yapı:

- hemen yok olmaz,
- yeni üretim başlatamaz,
- yükseltilemez,
- üretim verimi ağır düşer veya durur,
- yol ağına bağlı olsa bile tam çalışamaz,
- yeniden kontrol sağlanınca normale döner.

Bu yaklaşım oyuncuya karşı saldırı için zaman verir.

---

## 60. Kontrol Dışı Süre

İlk vertical slice için yapılar süresiz kalabilir.

Alternatif:

- uzun süre kontrol dışında kalırsa harap olur.

Bu sistem ilk sürüm için gereksiz karmaşık olabilir.

---

# BÖLÜM I — SEÇİM VE YAPI ARAYÜZÜ

## 61. Yapı Bilgi Paneli

Seçili yapıda gösterilmesi gerekenler:

- yapı adı,
- seviye,
- sağlık,
- ana işlev,
- çalışan işçi sayısı,
- üretim durumu,
- yol bağlantısı,
- kontrol durumu,
- üretim kuyruğu,
- yükseltme seçeneği,
- onarım komutu,
- kaldırma komutu.

---

## 62. Durum İkonları

Önerilen ikonlar:

- bağlantısız,
- yerel stok dolu,
- işçi yok,
- kaynak tükendi,
- kontrol dışında,
- yükseltiliyor,
- saldırı altında,
- onarılıyor.

Aynı yapıda çok fazla ikon gösterilmemelidir.

---

## 63. Yapı Menüsü

Yapılar kategoriler halinde sunulmalıdır:

- Ekonomi
- Konut
- Askerî
- Savunma
- Lojistik

Kilitli yapı:

- çağ gereksinimini,
- gerekli yapıyı,
- eksik koşulu

göstermelidir.

---

## 64. Hızlı Yerleştirme

Yapı yerleştirildikten sonra:

- aynı yapıyı tekrar yerleştirme seçeneği,
- sağ tık veya Esc ile iptal,
- döndürme kısayolu,
- yol bağlantısı önerisi

sunulabilir.

---

# BÖLÜM J — AI YAPI DAVRANIŞI

## 65. AI Yapı Hedefleri

AI şu yapı ihtiyaçlarını değerlendirmelidir:

- nüfus kapasitesi,
- kaynak üretimi,
- depolama,
- askerî üretim,
- savunma,
- bölgesel genişleme,
- çağ atlama gereksinimi.

---

## 66. AI Yerleştirme İlkeleri

AI:

- kaynak yapısını uygun kaynağa yakın kurmalı,
- depoyu birden fazla üretim yapısını destekleyecek yere koymalı,
- kışlayı ana üs veya sınır arasında konumlandırmalı,
- karakolu stratejik bölgeye kurmalı,
- kuleyi geçit veya kritik yapı yakınına koymalı,
- yolları mümkün olduğunca kısa ve geçerli kurmalıdır.

---

## 67. AI Yapı Öncelik Durumları

```text
NeedHousing
NeedFood
NeedWood
NeedStorage
NeedMilitaryProduction
NeedDefense
NeedOutpost
PrepareAgeUp
RebuildCriticalStructure
```

---

## 68. AI Yeniden İnşa

AI kritik yapı kaybettiğinde:

- alternatif konumu değerlendirir,
- aynı yere körü körüne yeniden kurmaz,
- tehdit devam ediyorsa savunma ekler,
- ekonomik darboğaza göre öncelik verir.

---

## 69. AI Yapı Spam'ini Önleme

AI:

- yapı limiti,
- mevcut kapasite,
- aktif kuyruk,
- yol bağlantısı,
- kaynak durumu

kontrol etmelidir.

---

# BÖLÜM K — TEKNİK TASARIM İLKELERİ

## 70. Veri Tabanlı Yapı Tanımı

Her yapı veri üzerinden tanımlanmalıdır.

Örnek:

```yaml
building:
  id: storage_1
  category: logistics
  age: settlement
  footprint:
    width: 3
    height: 3
  placement:
    requiresControl: true
    requiresRoadForOperation: true
    allowedTerrain:
      - flat
  construction:
    time: TBD
    maxWorkers: 4
  economy:
    storage:
      food: TBD
      wood: TBD
      stone: TBD
      gold: TBD
  upgradeTo: storage_2
```

---

## 71. Yapı Durum Makinesi

Önerilen durumlar:

```text
Preview
Placed
UnderConstruction
Active
Upgrading
Damaged
Disabled
OutOfControl
Destroyed
```

Aynı yapı birden fazla alt duruma sahip olabilir:

- `Active + Disconnected`
- `Damaged + Upgrading`

Bu nedenle durumlar tek enum yerine bileşen tabanlı tutulabilir.

---

## 72. Yapı Bileşenleri

Önerilen modüler bileşenler:

- PlacementComponent
- ConstructionComponent
- HealthComponent
- ProductionComponent
- StorageComponent
- RoadConnectionComponent
- TerritoryEmitterComponent
- UnitTrainingComponent
- UpgradeComponent
- VisionComponent
- CombatComponent
- ProsperityComponent

Her yapı tüm bileşenlere sahip olmak zorunda değildir.

---

## 73. Model Değişimi

Yapı seviyesi değiştiğinde:

- eski model kaldırılır,
- yeni model aynı anchor üzerinde oluşturulur,
- sağlık oranı korunur,
- seçim durumu korunur,
- bağlantılar korunur,
- takım rengi yeniden uygulanır.

---

## 74. Save/Load Gereksinimleri

Kayıt sistemi şunları saklamalıdır:

- yapı türü,
- seviye,
- konum,
- rotasyon,
- sağlık,
- inşaat ilerlemesi,
- yükseltme ilerlemesi,
- atanmış işçiler,
- üretim kuyruğu,
- yerel stok,
- yol bağlantıları,
- kontrol durumu,
- takım sahipliği.

---

## 75. Performans Gereksinimleri

- Yapı durumları her karede tam taranmamalıdır.
- Yol bağlantısı olay bazlı güncellenmelidir.
- Üretim belirli aralıklarla hesaplanabilir.
- Hasar görsel efektleri sınırlı olmalıdır.
- Seçili olmayan yapılar düşük güncelleme sıklığı kullanabilir.
- Dekoratif öğeler mümkünse instancing kullanmalıdır.

---

# BÖLÜM L — EDGE CASE'LER

## 76. Yapı Alanı İnşaat Sırasında Kapanırsa

Örnek:

- başka bir yapı,
- birim kalabalığı,
- yol değişimi.

Çözüm:

- işçiler alternatif erişim arar,
- yapı alanı iptal edilmez,
- kalıcı erişim yoksa uyarı verilir.

---

## 77. Yol Bağlantısı İnşaat Bitmeden Kesilirse

- yapı tamamlanabilir,
- aktif olduktan sonra bağlantısız duruma geçer,
- üretim başlamaz.

---

## 78. Nüfus Yapısı Yıkılırsa

Mevcut nüfus sınırın üstüne çıkabilir.

Önerilen davranış:

- mevcut birimler ölmez,
- yeni birim üretimi durur,
- kapasite yeniden yeterli olana kadar kuyruk bekler.

---

## 79. Üretim Yapısı Yıkılırsa

- üretim kuyruğu iptal olur,
- kısmi kaynak iadesi verilmez veya düşük olur,
- atanmış işçiler boşta kalır,
- rally point silinir.

---

## 80. Karakol Yükselirken Yıkılırsa

- yükseltme kaybedilir,
- kontrol alanı yapı tamamen yıkıldığında kalkar,
- bağlı yapılar kontrol dışı duruma geçer.

---

## 81. Yapı Yükseltmesi Çağ Gerisinde Kalırsa

Çağ seviyesi düşürme sistemi olmadığı için sorun oluşmaz.

Mevcut yapı:

- kendi seviyesinde çalışmaya devam eder,
- oyuncu istediği zaman yükseltebilir.

---

## 82. Aynı Kaynak Alanına İki Yapı

Önerilen davranış:

- kaynak alanı yapı limitine sahip olur,
- aynı düğüme birden fazla üretim yapısı bağlanamaz veya verim bölünür.

Vertical slice için en basit çözüm:

- bir kaynak düğümü = bir ana üretim yapısı.

---

## 83. Yapı Seçimi ve Büyük Modeller

Büyük yapılar:

- görünür selection collider,
- taban seçim alanı,
- kamera arkasında kalan kısımlardan bağımsız seçim

kullanmalıdır.

---

# BÖLÜM M — TEST PLANI

## 84. Yapı Test Senaryoları

### Test 1 — Geçerli yerleştirme

- Yapı kontrol alanında, düz zeminde yerleştirilir.
- İnşaat başlar ve tamamlanır.

### Test 2 — Geçersiz arazi

- Maden yapısı yanlış zemine yerleştirilmeye çalışılır.
- Sistem açık neden gösterir.

### Test 3 — Kontrol alanı dışı

- Yapı sınır dışına yerleştirilir.
- Önizleme reddedilir.

### Test 4 — Yol bağlantısı

- Yapı tamamlanır fakat yol yoktur.
- Bağlantısız durum gösterilir.
- Yol bağlanınca yapı çalışır.

### Test 5 — Çoklu işçi inşaatı

- Birden fazla işçi atanır.
- İnşaat süresi hızlanır.
- Azalan verim doğru uygulanır.

### Test 6 — Yapı yükseltmesi

- Seviye I yapı Seviye II'ye yükseltilir.
- Model, sağlık, bağlantı ve seçim korunur.

### Test 7 — Karakol kaybı

- Karakol yıkılır.
- Bağlı yapılar kontrol dışı olur.
- Yeni karakol ile geri etkinleşir.

### Test 8 — Depo kaybı

- Depo yok edilir.
- Yol ağı yeni depo arar.
- Alternatif yoksa üretim yerel tampona geçer.

### Test 9 — Nüfus binası kaybı

- Ev yıkılır.
- Nüfus sınırı düşer.
- Mevcut birimler korunur.
- Yeni üretim engellenir.

### Test 10 — AI yeniden inşa

- AI kritik bir yapı kaybeder.
- Yeni ve geçerli konuma tekrar kurar.

---

## 85. Telemetri

İzlenecek değerler:

- maç başına kurulan yapı sayısı,
- yapı türü kullanım oranı,
- hiç kullanılmayan yapılar,
- ilk ev zamanı,
- ilk depo zamanı,
- ilk kışla zamanı,
- ilk karakol zamanı,
- yapı başına ortalama yükseltme süresi,
- yapı iptal oranı,
- geçersiz yerleştirme denemeleri,
- bağlantısız kalan yapı süresi,
- karakol kaybı sonrası toparlanma süresi,
- en sık yıkılan yapı,
- AI yapı yerleştirme başarısızlıkları,
- pathfinding nedeniyle tamamlanamayan inşaatlar.

---

# BÖLÜM N — AÇIK SORULAR VE KARARLAR

## 86. Açık Tasarım Soruları

### Yerleştirme

- Yapılar tam grid mi, yumuşak snap mi kullanacak?
- Yapı giriş yönü yol bağlantısını zorunlu olarak belirleyecek mi?
- Oyuncu bina yerleşimini inşaat başladıktan sonra taşıyabilecek mi?
- Aynı tür yapılar arasında minimum mesafe olmalı mı?

### İnşaat

- İşçiler yapının çevresinde görünür çalışacak mı?
- İnşaat sırasında işçi zarar alırsa süreç ne olur?
- Birden fazla işçi için maksimum hız artışı kaç olmalı?
- Yapı tamamlanmadan saldırı işlevi kazanabilir mi?

### Yükseltme

- Toplu yapı yükseltmesi olacak mı?
- Mevcut birimler askerî yapı yükseltmesinden yararlanacak mı?
- Yükseltme iptalinde kaynak iadesi olacak mı?
- Yapı yükseltme modeli için özel inşaat görseli üretilecek mi?

### Savunma

- Kuleler minimum mesafe kuralı kullanacak mı?
- Merkez binasının saldırı gücü olacak mı?
- Duvar sistemi tamamen ertelenecek mi?
- Yapılar yakınındaki düşmanı otomatik hedefleyecek mi?

### Kontrol alanı

- Karakol bağlantısı merkez yoluna bağlı olmak zorunda mı?
- Kontrol alanı üst üste binebilir mi?
- Karakol ele geçirilebilir mi, yalnızca yok mu edilir?
- Kontrol dışı yapı üretimi tamamen mi duracak?

---

## 87. Şimdilik Alınmış Kararlar

- Yapılar net işlev kategorilerine ayrılacaktır.
- Her yapı üç seviyeli olmak zorunda değildir.
- Merkez, Ev, Depo, Kışla ve Karakol üç seviyeli ana yapılardır.
- İlk vertical slice yaklaşık 10–12 işlevsel yapı hedefleyecektir.
- Kapsam gerekirse 10 çekirdek yapıya düşürülebilecektir.
- Yapı yerleştirme kontrol alanı içinde olacaktır.
- Grid veya grid destekli yerleştirme kullanılacaktır.
- Yapılar 90 derecelik adımlarla döndürülebilecektir.
- Yol bağlantısı üretim ve işlev için önemli olacaktır.
- Yapılar yol olmadan yerleştirilebilir; ancak bağlantı gerektiren işlevler çalışmayabilir.
- İnşaat işçiler tarafından yürütülecektir.
- Birden fazla işçi inşaatı azalan verimle hızlandıracaktır.
- Yapılar %100 tamamlanmadan tam işlev kazanmayacaktır.
- Yapı seviyeleri çağ seviyeleriyle sınırlandırılacaktır.
- Yapılar çağ atlandığında otomatik yükseltilmeyecektir.
- Kontrol alanı dışı kalan yapılar hemen yok olmayacaktır.
- Kontrol dışı yapıların üretimi duracak veya ağır biçimde sınırlanacaktır.
- Nüfus binası kaybında mevcut birimler yok olmayacaktır.
- Tam duvar ve kapı sistemi ilk vertical slice için opsiyonel veya ertelenmiş kabul edilecektir.
- Yapı sistemi veri tabanlı ve bileşen tabanlı tasarlanacaktır.
- AI aynı yerleştirme ve yapı gereksinimlerini kullanacaktır.

---

## 88. Diğer Dokümanlarla Bağlantılar

- `05_TERRITORY_LOGISTICS_AND_ROADS.md`
  - kontrol alanı,
  - karakol bağlantısı,
  - yol grafiği,
  - yapı erişimi.

- `06_UNITS_AND_COMBAT.md`
  - askerî üretim,
  - yapı hasarı,
  - kuşatma,
  - savunma kuleleri.

- `07_ENEMY_AI_DESIGN_v0.2.md`
  - AI yapı planlama,
  - yeniden inşa,
  - savunma yerleşimi.

- `08_MAP_AND_WORLD_DESIGN.md`
  - arazi uygunluğu,
  - kaynak düğümleri,
  - yapı alanları.

- `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
  - merkez kaybı,
  - zafer yapıları,
  - yapı dayanıklılığı.

- `10_CAMERA_CONTROLS_AND_UI.md`
  - yapı menüsü,
  - önizleme,
  - seçim paneli,
  - inşaat uyarıları.

- `11_ART_ASSETS_AND_PRESENTATION.md`
  - Quaternius model eşleştirmesi,
  - üç seviye görsel dönüşüm,
  - inşaat ve hasar görselleri.

- `12_BALANCE_AND_GAME_DATA.md`
  - maliyetler,
  - sağlık,
  - inşaat süreleri,
  - kapasite ve limitler.

---

## 89. Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Ana yapı kategorileri onaylanmıştır.
- [ ] Vertical slice yapı listesi gerçekçi bulunmuştur.
- [ ] Yapı yerleştirme kuralları nettir.
- [ ] Grid destekli yerleştirme yaklaşımı kabul edilmiştir.
- [ ] Yol gereksiniminin yapı işleviyle ilişkisi onaylanmıştır.
- [ ] İnşaat işçisi ve çoklu işçi yaklaşımı kabul edilmiştir.
- [ ] Yapı yükseltme davranışı nettir.
- [ ] Ana yapıların üç seviye rolleri tanımlanmıştır.
- [ ] Hasar, onarım ve yıkım yaklaşımı kabul edilmiştir.
- [ ] Kontrol dışı yapı davranışı onaylanmıştır.
- [ ] Duvar sisteminin kapsam durumu kabul edilmiştir.
- [ ] AI yapı davranışının temel ilkeleri onaylanmıştır.
- [ ] Teknik veri yapısı yaklaşımı uygun bulunmuştur.

---

## 90. Kontrol Listesi

### Yapı kadrosu

- [ ] Yönetim yapıları tanımlandı.
- [ ] Ekonomik yapılar tanımlandı.
- [ ] Konut yapıları tanımlandı.
- [ ] Askerî üretim yapıları tanımlandı.
- [ ] Savunma yapıları tanımlandı.
- [ ] Lojistik yapılar tanımlandı.
- [ ] Vertical slice yapı listesi oluşturuldu.
- [ ] Daraltılmış yapı listesi oluşturuldu.

### Yerleştirme

- [ ] Kontrol alanı koşulu tanımlandı.
- [ ] Arazi uygunluğu tanımlandı.
- [ ] Eğim kuralları tanımlandı.
- [ ] Bina aralığı tanımlandı.
- [ ] Yol erişimi tanımlandı.
- [ ] Döndürme yaklaşımı tanımlandı.
- [ ] Grid yaklaşımı tanımlandı.
- [ ] Önizleme bilgileri tanımlandı.

### İnşaat ve yükseltme

- [ ] İnşaat akışı tanımlandı.
- [ ] Çoklu işçi davranışı tanımlandı.
- [ ] İnşaat sağlığı tanımlandı.
- [ ] İptal yaklaşımı tanımlandı.
- [ ] Yükseltme akışı tanımlandı.
- [ ] Yükseltme sırasında işlev tanımlandı.
- [ ] Ana yapı seviye rolleri tanımlandı.

### Hasar ve kontrol

- [ ] Yapı sağlık sistemi tanımlandı.
- [ ] Hasar eşikleri tanımlandı.
- [ ] Onarım sistemi tanımlandı.
- [ ] Yıkım etkileri tanımlandı.
- [ ] Kontrol dışı yapı davranışı tanımlandı.
- [ ] Nüfus binası kaybı ele alındı.
- [ ] Depo ve karakol kaybı ele alındı.

### AI ve teknik

- [ ] AI yapı hedefleri tanımlandı.
- [ ] AI yerleştirme ilkeleri tanımlandı.
- [ ] AI yeniden inşa davranışı tanımlandı.
- [ ] Veri tabanlı yapı şeması taslaklandı.
- [ ] Yapı durumları tanımlandı.
- [ ] Modüler bileşenler listelendi.
- [ ] Save/load gereksinimleri tanımlandı.
- [ ] Performans gereksinimleri tanımlandı.

### Test

- [ ] Yerleştirme testleri tanımlandı.
- [ ] Yol bağlantısı testi tanımlandı.
- [ ] Yükseltme testi tanımlandı.
- [ ] Karakol kaybı testi tanımlandı.
- [ ] Nüfus kaybı testi tanımlandı.
- [ ] AI yeniden inşa testi tanımlandı.
- [ ] Telemetri değerleri listelendi.

---

## 91. Revizyon Notları

### Sürüm 0.1

- Yapı kategorileri ve çekirdek yapı listesi oluşturuldu.
- Vertical slice ve daraltılmış kapsam ayrıldı.
- Yerleştirme, grid, yol erişimi ve arazi kuralları tanımlandı.
- İnşaat ve çoklu işçi sistemi tasarlandı.
- Yapı yükseltmeleri ve üç seviye rolleri detaylandırıldı.
- Hasar, onarım, yıkım ve kontrol dışı durumlar tanımlandı.
- AI yapı planlama ilkeleri eklendi.
- Teknik bileşenler, save/load ve performans gereksinimleri oluşturuldu.
- Test senaryoları ve telemetri başlıkları eklendi.

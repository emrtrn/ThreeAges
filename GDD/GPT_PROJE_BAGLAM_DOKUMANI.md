# Üç Çağ: Sınır Krallıkları — GPT Proje Bağlam Dokümanı

> **Türkçe ad:** Üç Çağ: Sınır Krallıkları  
> **İngilizce ad:** Three Ages: Kingdoms of the Frontier  
> **Tür:** Tek oyunculu, küçük ölçekli, üs kurma ve lojistik odaklı gerçek zamanlı strateji  
> **Platform:** Masaüstü web tarayıcısı  
> **Teknoloji:** TypeScript, Three.js, Vite ve Forge oyun/editör altyapısı  
> **Kontrol:** Klavye ve fare  
> **Hedef maç süresi:** 20–30 dakika  
> **Belge amacı:** GPT Projects içinde projeyi sıfırdan anlatma ihtiyacını ortadan kaldıracak ana bağlam kaynağı  
> **Son doğrulama:** 26 Temmuz 2026

---

## 1. Bu Doküman Nasıl Kullanılmalı?

Bu belge, projeyle ilgili yeni bir GPT görüşmesinin ilk ve ana bağlam belgesidir.
Oyunun vizyonunu, tasarımını, bugün çalışan kapsamını, teknik mimarisini ve
gelecek hedeflerini tek başına anlaşılabilir biçimde özetler.

GPT bu projede çalışırken şu ayrımı korumalıdır:

- **Tasarım vizyonu**, oyunun ulaşmak istediği nihai deneyimi anlatır.
- **Mevcut uygulama**, depoda bugün gerçekten çalışan sistemleri anlatır.
- **Planlanan veya ertelenen kapsam**, henüz tamamlanmış kabul edilmemelidir.

Bu belgede açıkça “uygulandı” denmeyen bir özellik yalnızca tasarım hedefi
olabilir. Kod veya denge sayıları hakkında çelişki oluşursa çalışan kaynak
dosyaları ve `GDD/SCOPE_LOG.md`, eski GDD taslaklarındaki anlatımdan daha
yetkilidir.

### Kaynak önceliği

Bir konuda çelişki varsa şu sıra izlenmelidir:

1. Çalışan kod ve `public/game-data/` altındaki güncel oyun verisi
2. `GDD/SCOPE_LOG.md`
3. `GDD/TECH_DECISIONS.md`
4. `GDD/13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` içindeki güncel faz kayıtları
5. `GDD/GDD_MASTER_v0.2.md`
6. Sisteme özel `00`–`12` numaralı GDD belgeleri

Eski checklist işaretleri güncel kodla çelişebilir. Özellikle ana GDD indeksinin
üretim durumu bölümü, daha sonra tamamlanan birçok sistemi henüz yapılmamış
göstermektedir.

---

## 2. Tek Paragrafta Oyun

**Üç Çağ: Sınır Krallıkları**, oyuncunun savunmasız bir sınır yerleşimini
ekonomik, bölgesel ve askerî kararlarla büyüttüğü tek oyunculu bir web RTS
oyunudur. Oyuncu dört temel kaynağı üretir, işçilerini ve nüfusunu yönetir,
yapılarını yollarla depolara bağlar, karakollarla kontrol alanını genişletir ve
uzaktaki değerli kaynaklara ulaşır. Kurduğu ekonomi küçük fakat rol odaklı bir
orduyu besler. Rakip krallık da aynı temel kurallarla gelişir, çağ atlar,
genişler, savunur ve saldırır. Oyuncu rakibin merkezini yok ederek veya etkin
olduğu maçlarda stratejik noktaları yeterince uzun süre kontrol ederek kazanır.
Oyunun ayırt edici fikri, üs kurma ve savaşın görünür bir **yol, depo, karakol
ve kontrol alanı ağına** bağlanmasıdır.

### Kısa tanıtım cümlesi

> Küçük bir sınır köyünü yollar, karakollar ve savaşla büyüt; kırılgan lojistik
> ağını koru, rakibinin ağını parçala ve sınırların hâkimi ol.

### Oyuncuya verilen temel vaat

Oyuncu maç sonunda yalnızca “daha çok kaynak ürettim” veya “daha büyük ordu
kurdum” dememelidir. Şu duyguyu yaşamalıdır:

> “Krallığım büyüdü çünkü doğru bölgelere genişledim, üretim ağımı akıllıca
> bağladım, dış ekonomimi savundum ve rakibin planını doğru yerde bozdum.”

---

## 3. Proje Kimliği ve Ürün Çerçevesi

| Başlık | Karar |
|---|---|
| Ana tür | Gerçek zamanlı strateji |
| Alt türler | Üs kurma, kaynak yönetimi, bölge kontrolü, hafif lojistik |
| Oyun formatı | Maç tabanlı, tek oyuncu ve tek AI rakip |
| İlk ürün kapsamı | Tek el yapımı harita |
| Hedef platform | Masaüstü web |
| Birincil girdi | Klavye ve fare |
| Kamera | Sabit yönlü, üstten eğimli, hafif perspektifli RTS kamerası |
| Hedef maç süresi | İdeal 20–30 dakika; kabul edilebilir 15–40 dakika |
| Hedef ölçek | Küçük yerleşimler ve yaklaşık 25–40 birimlik okunabilir çatışmalar |
| Görsel yön | Stilize low-poly fantastik orta çağ |
| Geliştirme modeli | Tek geliştirici veya AI destekli küçük ekip |
| Dağıtım | Statik web build’i; editör üretim paketine girmez |

### Hedef oyuncu

Oyun şu oyunculara hitap eder:

- klasik üs kurmalı RTS döngüsünü seven,
- yüzlerce birimlik yüksek mikro yerine daha küçük ve okunabilir çatışmaları
  tercih eden,
- ekonomi ile savaş arasında doğrudan bağ görmek isteyen,
- harita kontrolü, genişleme rotaları ve tedarik hatlarıyla ilgilenen,
- 20–30 dakikada tamamlanabilen yoğun bir strateji maçı arayan oyuncular.

### Bilinçli kapsam dışı alanlar

- Çok oyunculu ağ kodu ve replikasyon
- Kampanya, anlatı görev zinciri ve kalıcı meta ilerleme
- Yüzlerce birimlik büyük ölçekli savaş
- Tam fiziksel kaynak taşıma simülasyonu
- İşçilerin tek tek elde mikro yönetilmesini gerektiren ağır ekonomi
- Tam duvar ve kapı sistemi
- Karmaşık zırh, moral ve veteranlık sistemleri
- Prosedürel harita üretimi
- Yerel mobil paketleme, VR ve AR
- İlk vertical slice içinde mobil ve gamepad odaklı kontrol
- Minimap; küçük harita ölçeği nedeniyle kalıcı olarak kapsamdan çıkarılmıştır

---

## 4. Oyuncu Fantezisi

Oyuncu aynı anda beş rol üstlenir:

1. **Yerleşim planlayıcısı:** Yapıları, üretim merkezlerini ve savunma
   noktalarını anlamlı bir düzende kurar.
2. **Ekonomi yöneticisi:** Yiyecek, odun, taş, altın ve nüfus arasında öncelik
   belirler.
3. **Lojistik ağı kurucusu:** Üretim yapılarını yollar ve depolar üzerinden ana
   ekonomiye bağlar.
4. **Sınır yöneticisi:** Karakollarla yeni alan açar ve dış ekonomiyi korur.
5. **Askerî komutan:** Küçük, rol odaklı birlik gruplarıyla savunma, baskın ve
   kuşatma kararları verir.

Gelişim yalnızca sayısal olmamalıdır. Oyuncunun yerleşimi haritada gözle görülür
şekilde büyümeli; yeni yollar, daha geniş kontrol alanları, gelişen bina
modelleri, yoğunlaşan üretim ve çeşitlenen ordu bu ilerlemeyi anlatmalıdır.

---

## 5. Tasarım Sütunları

### 5.1 Görünür ve anlamlı gelişim

Çağ ve bina yükseltmeleri yalnızca daha büyük sayılar vermemelidir. Yeni
birimler, yeni ekonomik seçenekler, daha geniş kapasite, farklı stratejik
hedefler ve belirgin görsel değişim sunmalıdır.

### 5.2 Ekonomi ile savaş arasında gerçek bağ

Askerî eylem yalnızca düşman birimlerini azaltmak için yapılmaz. Karakol,
depo, dış üretim alanı, işçi ve yol bağlantıları da değerli hedeflerdir.
Başarılı bir saldırı, rakibin üretim ve genişleme kararlarını değiştirmelidir.

### 5.3 Bölge, yol ve lojistik

Oyunun ana kimliği budur. Normal yapılar kontrol edilen alanda kurulur.
Karakollar sınırı genişletir. Üretim, yerel tamponlarda birikir ve geçerli bir
yol-depo bağlantısıyla global stoğa aktarılır. Bağlantının kesilmesi ekonomik
sonuç doğurur.

### 5.4 Okunabilir ve yönetilebilir RTS

Birim ve bina sayısı bilinçli olarak sınırlıdır. Her öğenin kolay anlaşılır bir
rolü, silueti ve UI açıklaması olmalıdır. Karmaşıklık, çok sayıda içerikten
değil sistemlerin birbirini etkilemesinden doğmalıdır.

### 5.5 Tepkisel fakat adil AI

Normal AI, oyuncuyla aynı temel ekonomi, maliyet, nüfus ve görüş kurallarını
kullanır. AI kararları debug görünümünde açıklanabilir olmalı; gizli bilgiye
dayanmamalı ve başarısız görevlerde sonsuz tekrar döngüsüne girmemelidir.

---

## 6. Çekirdek Oynanış Döngüsü

Oyuncunun tekrar eden ana döngüsü şöyledir:

```text
Haritayı ve ihtiyaçları değerlendir
→ İşçileri ve üretimi düzenle
→ Yapı kur veya mevcut yapıyı geliştir
→ Karakolla kontrol alanını genişlet
→ Yol ve depoyla dış ekonomiyi ana ağa bağla
→ Ordu üret ve stratejik alanı güvenceye al
→ Rakibin zayıf ekonomik veya bölgesel noktasına baskı yap
→ Kazanılan alan ve kaynaklarla yeni gelişim kararına dön
```

### Anlık kararlar

- Birim veya yapı seçmek
- Bir gruba hareket, saldırı, saldırı-hareket, dur veya pozisyonu koru emri vermek
- Bir üretim kuyruğu başlatmak veya iptal etmek
- İşçiyi inşaata ya da üretim yapısına yönlendirmek
- Yapı veya yol yerleştirmek
- Yerel bir tehdide cevap vermek

### Taktik kararlar

- Hangi dış ekonominin savunulacağı
- Karakol mu, üretim mi, ordu mu öncelikli
- Muhafız, Okçu ve Topçu oranı
- Rakibin ordusuna mı, işçilerine mi, deposuna mı, karakoluna mı saldırılacağı
- Savaşın sürdürülmesi veya geri çekilme

### Stratejik kararlar

- Ne zaman çağ atlanacağı
- Hangi koridordan genişleneceği
- Ana ve yedek lojistik rotalarının nasıl kurulacağı
- Harita merkezi ile güvenli üs ekonomisi arasında ne kadar risk alınacağı
- Askerî zafer mi, bölgesel baskı mı hedefleneceği

---

## 7. Maç Akışı

### 7.1 Erken oyun — Yerleşimi kur

Oyuncu sınırlı bir merkez, başlangıç işçileri ve temel kaynaklarla başlar.
Öncelikleri:

- sürdürülebilir yiyecek ve odun üretimi kurmak,
- nüfus kapasitesini Evlerle artırmak,
- ilk Kışla ve Muhafızları üretmek,
- yakın çevreyi tanımak,
- ilk Karakol ve yol rotası için hazırlık yapmak.

Erken oyun mümkün olduğunca güvenli olmalı fakat tamamen pasif olmamalıdır.
Rakibin anında bitirici saldırısı engellenir; iki tarafın da ekonomik kimliğini
kurmasına zaman tanınır.

### 7.2 Orta oyun — Genişle ve çatış

Oyuncu dış taş ve altın kaynaklarına yönelir, Karakol kurar, yeni alanı yol ve
Depo ile ana ekonomiye bağlar. Kasaba çağına geçiş hazırlanır. Okçu ve Topçu
gibi yeni roller açılır. Haritanın merkezi ve stratejik noktalar önem kazanır.

Bu fazın ana gerilimi şudur:

> Güvenli üssü geliştirmek mi, dış ekonomiyi büyütmek mi, yoksa rakibin dış
> ekonomisine saldırmak mı?

### 7.3 Geç oyun — Üstünlüğü zafere çevir

Gelişmiş binalar daha yüksek üretim, depolama, nüfus ve askerî kapasite sunar.
Topçu yapıları güvenli mesafeden tehdit eder. Ordular merkez saldırısı veya
stratejik nokta kontrolü için mücadele eder.

Geç oyunun tasarım hedefi kazanılmış üstünlüğü belirsiz süreyle biriktirmek
değil, maçı bitirecek baskıya çevirmektir. Bu alan hâlâ ana denge ve üretim
hedeflerinden biridir.

---

## 8. Ekonomi ve Kaynaklar

### 8.1 Harcanabilir kaynaklar

| Kaynak | Ana rol |
|---|---|
| Yiyecek | İşçi ve temel asker üretimi; çağ gelişimi |
| Odun | Yapıların, yolların ve birçok birimin ana inşa kaynağı |
| Taş | Gelişmiş yapılar, çağ ilerlemesi ve kuşatma ekonomisi |
| Altın | İleri gelişim, pazar ve gelişmiş askerî içerik |

Nüfus bir kapasitedir; harcanabilir kaynak değildir. Refah için teknik bir
feature flag ve basit hesap bulunur, ancak varsayılan maçta sert ilerleme kapısı
olarak kullanılmaz.

### 8.2 İşçi modeli

- İşçiler Merkezde üretilir.
- İnşaat yapar ve üretim yapılarında çalışır.
- Kaynağı fiziksel paketler halinde depoya taşımaz.
- Bir üretim yapısının işçi kapasitesi vardır.
- İşçi kaybı ekonomiyi doğrudan zayıflatır.
- İşçiler savaşçı değildir; yalnızca çok düşük öz savunma hasarına sahiptir.

### 8.3 Yerel tampon ve global stok

Üretim önce ilgili yapının yerel tamponunda birikir. Yapı:

- kontrol alanındaysa,
- yol ağına temas ediyorsa,
- aynı yol bileşeninde geçerli bir Depoya bağlıysa

tampondaki kaynağı global krallık stoğuna aktarabilir.

Bağlantı kesilirse üretim hemen yok olmaz; yerel tampon dolana kadar devam eder.
Tampon dolduğunda üretim durur. Yol veya Depo tekrar bağlandığında biriken
kaynak yeniden global stoğa aktarılır. Bu sistem, lojistik saldırının etkisini
görünür ve anlaşılır kılar.

### 8.4 Kaynakların tükenmesi

- Yiyecek sürdürülebilir üretime sahiptir.
- Odun orman varlığına bağlıdır ve ağırlıklı olarak sonludur.
- Taş ve altın düğümleri sınırlı kapasitelidir.
- Güvenli başlangıç yatakları küçüktür.
- Daha zengin dış yataklar oyuncuyu genişlemeye zorlar.

### 8.5 Pazar

Pazar yapısı ve ticaret sistemi uygulamada mevcuttur. Kaynaklar belirli lotlar
halinde altınla alınıp satılabilir; fiyat endeksi ve komisyon ticaretin sürekli
ve bedelsiz bir açık kapıya dönüşmesini engeller. Pazar ana ekonomi döngüsünün
yerine geçmemeli, darboğaz çözme ve dengeleme aracı olmalıdır.

---

## 9. Bölge, Karakol, Yol ve Lojistik

### 9.1 Kontrol alanı

- Merkez başlangıç kontrol alanını üretir.
- Normal yapılar yalnızca oyuncunun kontrol ettiği hücrelerde kurulabilir.
- Düşman kontrolündeki alana normal yapı yerleştirilemez.
- Kontrol alanı grid tabanlıdır ve yapı yerleştirme sistemiyle aynı mekânsal
  mantığı paylaşır.

### 9.2 Karakol

Karakol, sınır genişlemesinin temel aracıdır:

- mevcut kontrol alanının biraz dışında kurulabilir,
- tamamlandığında küçük bir kontrol alanı açar,
- ana yol ağına bağlandığında daha geniş tam kontrol alanına ulaşır,
- savunma ateşi ve yüksek görüş sağlar,
- yok edildiğinde ona bağlı dış ekonomi “kontrol dışı” kalabilir.

Karakol yol ağından bağımsız, bedava bölge üretmemelidir. Oyuncu genişleme
kararı verdiğinde hem yapıyı hem bağlantısını savunmalıdır.

### 9.3 Yol ağı

- Yollar hücre tabanlı ekonomik bir graph oluşturur.
- Birim pathfinding graph’ından ayrıdır.
- Yol aracı başlangıç ve bitiş arasında geçerli rota önizlemesi üretir.
- Yalnızca yeni yol hücreleri ücretlendirilir.
- Düz, köşe, T ve kavşak bağlantıları görselleştirilir.
- Yol segmentleri doğrudan saldırılabilir nesneler değildir.
- Ekonomik kesinti Karakol, Depo, kontrol veya bağlantı yapısı üzerinden oluşur.
- Alternatif rota varsa tek bir kesinti üretimi durdurmaz.

Bu sistemin tasarım amacı “yol çizme vergisi” yaratmak değildir. Oyuncuya
güvenli kısa rota, pahalı yedek rota ve savunulması gereken dar boğazlar arasında
karar sunmalıdır.

---

## 10. Yapılar

Güncel uygulamada aşağıdaki yapı kadrosu bulunur:

| Yapı | Rol | Temel açılım |
|---|---|---|
| Merkez | Krallığın kalbi, işçi üretimi, çağ atlama ve askerî zafer hedefi | Başlangıç |
| Ev | Nüfus kapasitesi | Yerleşim |
| Depo | Global stok kapasitesi ve lojistik teslim düğümü | Yerleşim |
| Karakol | Kontrol alanı, görüş ve sabit savunma | Yerleşim |
| Tarla | Sürdürülebilir yiyecek üretimi | Yerleşim |
| Oduncu Kampı | Ormana bağlı odun üretimi | Yerleşim |
| Taş Ocağı | Taş düğümüne bağlı üretim | Yerleşim |
| Altın Madeni | Altın düğümüne bağlı üretim | Yerleşim |
| Pazar | Kaynak alım-satımı ve ekonomi dengeleme | Veriyle belirlenir |
| Kışla | Muhafız ve Topçu üretimi | Yerleşim / Topçu Kasaba |
| Okçuluk Alanı | Okçu üretimi | Kasaba |

### Yapı kurma kuralları

- Yapılar grid destekli yerleştirilir.
- Ghost önizleme geçerli ve geçersiz konumu gösterir.
- Harita sınırı, kontrol alanı, arazi ve diğer footprint’lerle çakışma denetlenir.
- Maliyet yerleştirme anında güvenli biçimde rezerve edilir.
- İptal edilen inşaat bir kez iade edilir.
- İşçi inşa noktasına ulaşamazsa oyuncuya neden gösterilir.
- Birden fazla işçi inşaatı hızlandırabilir.
- Yapı tamamlanmadan ana işlevi açılmaz.
- Yapılar seçilebilir, yükseltilebilir ve iki adımlı onayla yıkılabilir.

### Yapı gelişimi

Ana yapılar her çağ ailesi içinde Lv1–Lv3 görsel ve sayısal gelişime sahiptir.
Seviye yükseltmesi yapı örneği başınadır; bütün bina türünü tek seferde
yükseltmez. Seviye artışı sağlık, kapasite, üretim, depolama veya savunma gibi
binaya özgü fayda sağlar.

---

## 11. Çağ ve İlerleme Sistemi

Bu projede **çağ** ile **bina seviyesi** iki ayrı eksendir:

- **Çağ**, genel sanat ailesini ve yeni yapı/birim açılımlarını belirler.
- **Bina seviyesi**, aynı çağ içinde tek bir yapının Lv1–Lv3 gelişimini belirler.

Çağ atlandığında sahibin mevcut binaları yeni çağın Lv1 görsel ailesine geçer
ve bireysel seviyeleri sıfırlanır. Böylece çağ atlama büyük bir dönüşüm, yapı
seviyesi ise çağ içindeki yerel yatırım olur.

### Bugün uygulanan çağlar

1. **Yerleşim / Settlement:** Temel ekonomi, İşçi, Muhafız, Karakol ve ilk
   lojistik ağ.
2. **Kasaba / Town:** Okçuluk Alanı, Okçu, Topçu, daha yüksek bina kapasiteleri
   ve tam çekirdek ordu.

### Üçüncü çağın durumu

Oyunun adı ve uzun vadeli vizyonu üç çağ üzerine kuruludur:

3. **Krallık / Kingdom:** Planlanan son gelişim ve maç bitirme aşaması.

Ancak üçüncü çağ bugün uygulanmış oynanabilir kapsam değildir. Kullanılan varlık
arşivinde uygun `ThirdAge` bina ailesi bulunmadığı için `SL-007` kararıyla sanat
kaynağına bağlı olarak ertelenmiştir. Güncel ürün kapsamı **iki çağ × her çağda
üç bina seviyesi** şeklindedir. GPT, üçüncü çağı tamamlanmış veya kesin içeriği
belirlenmiş gibi anlatmamalıdır.

---

## 12. Birimler ve Savaş

### 12.1 Güncel birim kadrosu

| Birim | Rol | Güçlü yanı | Temel zayıflığı |
|---|---|---|---|
| İşçi | Ekonomi ve inşaat | Üretim, yapı kurma | Savaşta çok zayıf |
| Muhafız | Ağır ön hat | Yakın dövüş, ağır hedeflere baskı | Yapılara düşük hasar, menzilli ateşe yaklaşma ihtiyacı |
| Okçu | Hafif menzilli destek | Hafif hedeflere ve korunan ateş hattına karşı etkili | Düşük sağlık, ağır hedeflere düşük verim |
| Topçu | Uzun menzilli kuşatma | Yapılara çok yüksek çarpan, savunma menzili dışından ateş | Yavaş, pahalı, birimlere karşı verimsiz ve korunmaya muhtaç |

Süvari vertical slice çekirdeğinde yoktur.

### 12.2 Güncel temel denge kimliği

- Muhafız: 110 sağlık, 12 hasar, yakın dövüş, 1 nüfus
- Okçu: 75 sağlık, 10 hasar, 7 menzil, 1 nüfus
- Topçu: 180 sağlık, 34 hasar, 15 menzil, 3 nüfus
- İşçi: 50 sağlık, sembolik yakın dövüş hasarı, 1 nüfus

Kesin sayılar `public/game-data/balance/units.json` dosyasından okunmalıdır.
GDD içindeki eski “Koçbaşı” referansları güncel değildir; kuşatma birimi
`SL-008` ile menzilli **Topçu** olarak değiştirilmiştir.

### 12.3 Savaş ilkeleri

- Sert taş-kâğıt-makas yerine yumuşak karşıtlık kullanılır.
- Hasar çarpanları hafif, ağır ve yapı hedef sınıflarına göre değişir.
- Dost ateşi yoktur.
- Birimler otomatik hedef edinir fakat kovalama menzilleri sınırlıdır.
- Pozisyonu koru emri gereksiz kovalamayı engeller.
- Saldırı-hareket, yol üzerindeki düşmanlara tepki verir.
- Topçu, yapıyı askerî hedeflerden daha yüksek önceliklendirebilir.
- Mermi, ateş topu ve top güllesi için ayrı görsel sistemler bulunur.
- Sağlık çubukları, seçim halkaları, takım rengi ve saldırı işaretleri
  okunabilirliği destekler.
- Kalıcı cesetler ve fizik tabanlı büyük yıkım yoktur.

### 12.4 Grup hareketi

Birimlere küçük grup hedef dağılımı uygulanır. Grid navigasyonu, dar geçitler,
yapı engelleri, sıkışma fallback’i ve hareket sonrası birim ayrımı bulunur.
Hedef yüzlerce birim değil, 25–40 birimlik okunabilir ve teknik olarak güvenilir
çatışmalardır.

---

## 13. AI Rakip

AI sırayla çalışan sabit bir saldırı dalgası değildir. Kendi ekonomisini kuran,
alan açan ve maçı kazanmayı hedefleyen bir rakip krallıktır.

### 13.1 Mimari

AI üç katmanlıdır:

1. **KingdomDirector:** Ekonomi, çağ, genişleme, savunma ve saldırı arasında
   stratejik niyet seçer.
2. **Ordu yönetimi:** Tek ana saha ordusunun hedefini, savunmasını, saldırısını,
   geri çekilmesini ve stratejik nokta tepkisini yönetir.
3. **Yerel birim davranışı:** Hareket, hedef edinme, menzil, saldırı ve
   çarpışma gibi anlık davranışları yürütür.

### 13.2 Beş ana niyet

- **Economy:** İşçi, üretim, nüfus ve kritik yapı ihtiyaçlarını karşıla.
- **AgeUp:** Gereksinimler ve güvenlik uygunsa çağ yükseltmesine hazırlan.
- **Expand:** Karakol, yol, Depo ve dış üretim reçetesi uygula.
- **Defend:** Üs veya dış ekonomiye yönelik tehdide cevap ver.
- **Attack:** Uygun güç oranında ekonomik, stratejik veya merkez hedefe saldır.

AI aynı anda tek ana stratejik plan yürütür. Minimum plan süresi ve hysteresis,
her değerlendirmede fikir değiştirmesini engeller. Acil üs savunması mevcut
planı kesebilir.

### 13.3 Adalet ve bilgi

- Normal AI için ekonomi çarpanı `1.0`’dır.
- Aynı yapı ve birim maliyetlerini öder.
- Aynı nüfus kurallarını kullanır.
- Fog etkinse görünmeyen düşmanın gerçek konumunu kullanamaz.
- Son görülen yapılar için eskimiş hafıza tutabilir.
- Serbest ve pahalı dünya araması yerine haritada tanımlı yapı alanları ve
  genişleme reçetileri kullanır.

### 13.4 Zorluk profilleri

Veride Kolay, Normal ve Zor profilleri vardır. Temel farklar tepki gecikmesi ve
sınırlı ekonomi çarpanıdır. Normal adil temel profildir; Zor profilin mevcut
veri çarpanı `1.05` düzeyindedir. Bu profillerin nihai oyuncu deneyimi kapsamlı
denge testine tabidir.

### 13.5 Açıklanabilirlik

`?rts&debug` görünümü aktif niyeti, niyet puanlarını, kaynak hedeflerini, yapı
planını, ordu gücünü, hedefi, geri çekilme nedenini ve son kararları gösterir.
AI görevi başarısız olduğunda sınırlı alternatif dener, geçersiz adayı geçici
olarak kara listeye alır, rezervasyonu serbest bırakır ve kontrollü biçimde
yeniden planlar.

---

## 14. Harita ve Dünya

### 14.1 Tasarım vizyonu

İlk haritanın çalışma adı **İki Nehir Arası**dır. Tasarım hedefi:

> “Başlangıç alanım güvenli, fakat kazanmak için merkezden çıkmak; kaynak, yol
> ve stratejik bölgeler için risk almak zorundayım.”

Planlanan yüksek seviye yerleşim:

- oyuncu başlangıcı güneybatıda,
- AI başlangıcı kuzeydoğuda,
- merkezde zengin taş ve altın,
- iki ana yaklaşım koridoru,
- yan genişleme alanları,
- doğal engeller, köprü/geçit kararları,
- iki stratejik nokta,
- tek biyom ve sabit gündüz.

### 14.2 Güncel uygulama

Çekirdek maç, karşılıklı iki üs ve merkezi engelin iki yanından geçen iki flank
rotası kullanan bir blockout düzeniyle kanıtlanmıştır. Authored RTS level hattı
da mevcuttur:

- `RTS_CoreMatch.level.json`
- `RTS_GameplayProof.level.json`

Landscape tabanlı sunulabilir harita, nehir, köprü, yol ve dekor çalışması devam
eden üretim alanıdır. Tasarım vizyonundaki tüm organik dünya öğeleri bugünkü
oynanabilir haritada tamamlanmış kabul edilmemelidir.

### 14.3 Harita tasarım ilkeleri

- Başlangıç güvenli, büyüme riskli olmalıdır.
- Tek geçit savunmasını aşırı güçlendirmemek için en az iki rota olmalıdır.
- Güvenli kaynaklar tam maçı finanse etmemelidir.
- Merkez, daha yüksek değer ve daha yüksek çatışma üretmelidir.
- Doğal engeller yalnız dekor değil hareket ve savunma kararı üretmelidir.
- Oyuncu başlangıç, merkez, yan genişleme ve rakip yönünü kısa sürede
  okuyabilmelidir.

---

## 15. Zafer, Yenilgi, Fog ve Stratejik Noktalar

### 15.1 Askerî zafer

Ana ve zorunlu zafer koşulu rakibin tek ana Merkezini yok etmektir. Merkez
yeniden inşa edilmez. Oyuncunun Merkezi yok edilirse yenilgi oluşur. Teslim ol,
duraklatma, sonuç ekranı ve yeniden başlatma akışları uygulanmıştır.

### 15.2 Bölgesel zafer

Bölgesel zafer sistemi uygulanmış fakat koşullu feature flag arkasındadır.
Haritadaki iki stratejik noktanın ikisini de kontrol eden tarafın sayacı ilerler.
İlk hedef süre 180 simülasyon saniyesidir. Kontrol kaybedildiğinde sayaç durur
veya geriler; UI yaklaşan sonucu açıkça gösterir. AI oyuncunun bölgesel zafer
tehdidine cevap verebilir.

Etkinleştirme örneği:

```text
?rts&preset=gameplay_proof&flags=regionalVictory
```

### 15.3 Fog of war

Fog sistemi de uygulanmış fakat varsayılan maçta koşullu flag arkasındadır:

- görünmeyen alan,
- daha önce keşfedilmiş alan,
- şu anda görünür alan,
- son görülen düşman yapısının hayalet bilgisi,
- oyuncu ve AI için simetrik görüş kuralları,
- debug görünümü.

Etkinleştirme örneği:

```text
?rts&preset=gameplay_proof&flags=fogOfWar
```

### 15.4 Minimap kararı

Minimap yapılmayacaktır. Küçük sahne ölçeğinde kapladığı ekran alanı ve fog
senkronizasyon maliyeti faydasını aşmıştır. Yerine:

- tıklanabilir kritik bildirimler,
- world-space ve ekran kenarı işaretleri,
- stratejik nokta etiketleri,
- kamera odaklama,
- lojistik ve kontrol overlay’leri

kullanılmalıdır. GPT yeni bir özellik önerirken minimap’i varsayılan çözüm
olarak geri getirmemelidir.

---

## 16. Kamera, Kontroller ve UI

### 16.1 Kamera

- Üstten eğimli, sabit yönlü RTS kamera
- `WASD` ile hareket
- Fare tekerleği ile zoom
- Harita sınırları
- Ayarlanabilir kamera hızı ve yumuşatma
- Opsiyonel ekran kenarı kaydırma
- Kamera oyuncunun savaş odağını zorla değiştirmez

### 16.2 Seçim ve temel komutlar

- Sol tık: tekli seçim
- Sol sürükleme: kutu seçimi
- Çift tık: ekrandaki aynı tür savaş birimlerini seçme
- Sağ tık boş zemin: hareket
- Sağ tık düşman: saldırı
- `F`: saldırı-hareket
- `X`: dur
- `H`: pozisyonu koru
- Askerî yapıda toplanma/rally noktası

UI üzerindeki tıklama dünya komutu üretmez. Pencere odağı kaybolduğunda basılı
tuşlar ve sürükleme durumu temizlenir.

### 16.3 Yapı ve yol araçları

- Kategorili yapı paleti
- Maliyet ve kilit durumları
- Geçerli/geçersiz ghost
- Kontrol alanı ve Karakol yarıçapı önizlemesi
- Yol zinciri, rota ve maliyet önizlemesi
- Açıklanabilir hata nedenleri

### 16.4 HUD

Ana HUD şunları gösterir:

- dört kaynak ve gelir hızları,
- mevcut/kullanılabilir nüfus,
- mevcut çağ ve yükseltme durumu,
- boşta işçi,
- maç süresi,
- kritik lojistik durumu,
- bildirim akışı,
- stratejik hedef sayacı etkinse hedef durumu.

Seçim paneli birime veya yapıya göre değişir. İşçi, üretim yapısı, Depo,
Karakol, askerî yapı, Merkez ve karışık birim grubu için farklı bilgi ve
eylemler sunar.

### 16.5 Bildirimler ve akış

Bildirim sistemi nüfus dolması, kaynak tükenmesi, bağlantı kesilmesi, Karakol
ve Merkez saldırısı, çağ tamamlanması ve AI çağ atlaması gibi olayları
gruplayarak gösterir. Aynı uyarının her kare spam üretmesi engellenir.

Maç akışı:

```text
Başlatma ekranı
→ Aktif maç
→ Gerçek pause / teslim ol
→ Zafer veya yenilgi sonucu
→ Yeniden başlat
```

---

## 17. Görsel Yön, Assetler ve Animasyon

### 17.1 Sanat yönü

- Stilize low-poly fantastik orta çağ
- Uzak RTS kamerasından okunabilir güçlü siluetler
- Oyuncu ve düşman için kontrollü takım renkleri
- Yapı türü, çağ ve seviyenin görsel olarak ayırt edilmesi
- Seçim halkaları ve sağlık çubuklarıyla net geri bildirim
- Tek biyom ve sabit gündüzle kontrollü vertical slice kapsamı

Ana 3B kaynak olarak Quaternius Ultimate Fantasy RTS içeriği kullanılmıştır.
Asset-led çalışma tercih edilir; ancak oynanış rolleri hazır assetlerin
sınırlamalarına bütünüyle teslim edilmez.

### 17.2 Bina sunumu

Merkez, Ev, Depo, Karakol, Tarla, Pazar, Kışla ve Okçuluk Alanı için iki çağ ve
Lv1–Lv3 Actor eşlemeleri büyük ölçüde mevcuttur. Oduncu Kampı, Taş Ocağı ve
Altın Madeni bazı seviyelerde tek model/stand-in kullanabilir.

İnşaat placeholder’ı, çağ/seviye model geçişi, takım halkası, seçim göstergesi
ve yıkımda simülasyondan temizleme uygulanmıştır. Ayrıntılı hasar durumu,
inşaat VFX’i ve çevresel polish henüz tamamlanmış kabul edilmemelidir.

### 17.3 Birim sunumu

Oyuncu ve düşman için İşçi, Muhafız, Okçu ve Topçu Actor tanımları bulunur.
Skeletal animasyon hattı idle, hareket, saldırı ve ölüm kliplerini runtime
durumlarına bağlar. Topçu için teker dönüşü ve gülle atışı gibi role özgü sunum
eklenmiştir. İşçi çalışma/inşa animasyonu, bütün rol varyasyonları ve nihai
tarayıcı doğrulaması devam eden polish alanlarıdır.

### 17.4 VFX ve ses durumu

Mermi, ateş topu ve top güllesi gibi savaş sunumları vardır. Tam ses paketi,
ortam/müzik, UI sesleri, gelişmiş inşaat tozu, yapı hasar dumanı ve merkez yıkım
polish’i henüz tamamlanmış ürün kapsamı değildir.

---

## 18. Teknik Mimari

### 18.1 Forge ilişkisi

Oyun, Three.js tabanlı yeniden kullanılabilir Forge platformunun bir proje
uyarlamasıdır. Forge’un motor ve editör kodu genel tutulur; Üç Çağ’a özgü
kurallar `src/game` ve proje verilerinde yaşar.

Ana sınırlar:

- `engine/`: Oyundan bağımsız motor modülleri
- `src/editor/`: Yalnız geliştirme zamanında yüklenen genel editör
- `src/scene/`: Runtime ve editör sahne kabukları
- `src/game/`: Üç Çağ’a özgü oyun kuralları ve RTS sistemleri
- `public/game-data/`: Salt okunur denge ve preset JSON’ları
- `public/assets/ThreeAges/`: Oyun Actor, Level, model ve diğer içerikleri
- `GDD/`: Tasarım, kapsam ve üretim kararları

### 18.2 Runtime rotaları

```text
/?rts&preset=gameplay_proof
```

Güncel çekirdek RTS maçını açar.

```text
/?rts&preset=gameplay_proof&flags=levelAssets
```

Authored oynanış kanıtı level’ını açar.

```text
/?rts&preset=siege_test
```

Kasaba Lv1 ve Topçu odaklı test senaryosunu açar.

```text
/?rts&preset=gameplay_proof&debug
```

RTS debug panelleriyle maçı açar.

```text
/?editor
```

Geliştirme editörünü açar. Editör production build’e dahil edilmez.

### 18.3 Veri odaklı tasarım

Sayısal denge kod içine gömülmemelidir. Ana dosyalar:

- `public/game-data/balance/units.json`
- `public/game-data/balance/buildings.json`
- `public/game-data/balance/resources.json`
- `public/game-data/balance/ages.json`
- `public/game-data/balance/roads.json`
- `public/game-data/balance/ai.json`
- `public/game-data/presets/*.json`
- `public/game-data/content/rts-content.json`

Loader ve saf doğrulama katmanı, eksik alanları, geçersiz ID’leri ve hatalı
referansları açık hata olarak üretir.

### 18.4 Level ve Actor yaklaşımı

Görsel sunum kod içine sabitlenmiş ikinci bir art path kullanmaz. RTS içerik
kataloğu, gameplay ID’lerini authored Actor dosyalarına bağlar. Oyuncu ve düşman
için owner’a özgü Actor eşlemeleri desteklenir. Level editörde yazılır,
runtime’da doğrulanır ve gerekli RTS marker’ları yoksa sessiz siyah ekran yerine
açıklanabilir fallback uygulanır.

### 18.5 Editör ilkesi

Editör aynı projenin `?editor` modudur. Level, Actor, Static Mesh, collision,
material, skeleton, VFX, UI ve diğer içerik araçlarını sağlar. Editör çekirdeği
Üç Çağ kurallarını doğrudan import etmez; oyun kataloğu composition root
üzerinden enjekte edilir.

Yeni layout veya environment alanları eklenirse `tools/saveValidator.ts`
allowlist’i güncellenmelidir; aksi halde alan kayıtta sessizce düşebilir.

---

## 19. Test ve Kalite Kapıları

TypeScript değişikliklerinden sonra zorunlu temel kontrol:

```bash
npx tsc --noEmit
```

PowerShell shim engeli varsa:

```bash
npx.cmd tsc --noEmit
```

Engine/runtime değişiklikleri için tercih edilen tam yerel kapı:

```bash
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

Tarayıcı doğrulaması için Playwright smoke testleri vardır. RTS’ye özel
testlerden bazıları:

- bina yerleştirme,
- authored level ile Play akışı,
- fog of war,
- bölgesel zafer,
- Actor/asset sunum tabanı.

Önemli UI, Three.js render, picking, level-route veya görsel sunum
değişikliklerinde TypeScript ve engine testlerine ek olarak Playwright
doğrulaması yapılmalıdır.

### Güvenlik notu

Dev-server endpoint’leri, kayıt doğrulama, asset alımı, script çalıştırma veya
izin sınırları değiştirilecekse Codex Security taraması önerilmelidir. Güvenlik
taraması kullanıcı istemeden veya onaylamadan sessizce çalıştırılmamalıdır.

---

## 20. Güncel Üretim Durumu

### Uygulandı veya güçlü biçimde kanıtlandı

- RTS kamera, seçim, kutu seçimi ve bağlamsal komutlar
- Grid navigasyonu, grup hedef dağılımı, dar geçit fallback’i ve birim ayrımı
- Yapı ghost’u, maliyet rezervasyonu, inşa, iptal ve çoklu işçi
- Dört kaynak, işçi üretimi, nüfus ve kaynak tükenmesi
- Yerel tampon, global stok, Depo bağlantısı ve lojistik kesinti
- Kontrol alanı, Karakol, yol graph’ı ve alternatif rota
- İki çağ ve çağ başına Lv1–Lv3 bina ilerlemesi
- İşçi, Muhafız, Okçu ve Topçu
- Yakın/menzilli savaş, yapı hasarı, mermi ve top güllesi
- Beş niyetli AI ekonomisi, gelişimi, genişlemesi, savunması ve saldırısı
- HUD, seçim panelleri, bildirimler, pause, teslim ol ve sonuç ekranı
- Askerî zafer
- Feature flag arkasında bölgesel zafer
- Feature flag arkasında fog of war ve AI görüş uyumu
- Authored Level ve Actor tabanlı RTS içerik hattı
- İki çağ için geniş bina Actor eşlemesi
- Oyuncu/düşman birim Actor’ları, takım rengi ve temel skeletal animasyon
- TypeScript, engine, build ve hedefli browser test altyapısı

### Devam eden veya eksik üretim alanları

- Geç Kasaba temposu ve maçı 20–30 dakikada güvenilir bitirme dengesi
- Yeterli sayıda otomatik ve manuel tam maç testi
- Landscape tabanlı nihai harita, nehir, köprü, kaynak ve dekor sunumu
- Yol ve dünya görsellerinin nihai asset/polish seviyesi
- Tam birim animasyon kapsamı ve bütün browser koşullarında görsel doğrulama
- İşçi çalışma/inşa sunumu
- Yapı hasar durumları, gelişmiş VFX ve tam ses paketi
- Performans bütçelerinin release adayı koşullarında ölçümü
- Oyuncu yönlendirmesi, erişilebilirlik ve kör oyuncu testleri
- Denge changelog’u ve kapsamlı telemetri raporu

### Ertelendi veya kapsam dışı

| Özellik | Durum |
|---|---|
| Krallık / üçüncü çağ | Uygun ThirdAge sanat ailesine bağlı olarak ertelendi |
| Minimap | Kalıcı kapsam dışı |
| Save/load | RTS vertical slice için ertelendi/kapsam dışı |
| Süvari | Vertical slice dışında |
| Tam duvar/kapı | Kapsam dışı |
| Çoklu AI orduları | Kapsam dışı |
| Gelişmiş formasyon | Kapsam dışı |
| Multiplayer | Ürün kapsamı dışı |
| Mobil/gamepad önceliği | İlk ürün dışında |
| Refahın sert mekanik etkisi | Varsayılan olarak kapalı |

---

## 21. Ana Tasarım ve Üretim Riskleri

### 21.1 Üç çağ adı ile iki çağlık güncel kapsam

Ürün adı üçüncü çağı vaat ederken mevcut oynanabilir kapsam iki çağdır. Bu,
gelecekte sanat kaynağı ve gerçek yeni karar üreten geç oyun tasarımıyla
çözülmelidir. Yalnızca üçüncü bir model seti ve daha yüksek sayılar eklemek
yeterli değildir.

### 21.2 Geç oyun bitirme baskısı

Ekonomik üstünlük her zaman hızlı zafere dönüşmeyebilir. Topçu erişimi, dış
kaynak zorunluluğu, AI bitirme davranışı ve gelişmiş üretim temposu birlikte
test edilmelidir.

### 21.3 Harita ekonomisi ve simetri

Dış taş ve altın erişimi iki taraf için karşılaştırılmalıdır. Eski blockout
yerleşimlerinde AI’ın dış yataklara erişimi oyuncudan daha kötü olabilmiştir.
Yeni authored harita bu farkı ölçmeli ve bilinçli tasarlamalıdır.

### 21.4 Lojistiğin angaryaya dönüşmesi

Yol ve Depo sistemi ilginç rota/savunma kararları üretmezse yalnızca ek tıklama
maliyetine dönüşebilir. Her yeni lojistik özelliği “hangi yeni karar doğuyor?”
sorusunu cevaplamalıdır.

### 21.5 AI ve tam maç güvenilirliği

Tekil headless testlerin geçmesi, 20–30 dakikalık gerçek maçların dengeli olduğu
anlamına gelmez. Takılma, plan döngüsü, erken rush, geç bitirememe ve kaynak
kilidi hızlandırılmış seri maçlarla ölçülmelidir.

### 21.6 Web performansı

Fog, pathfinding, skeletal animasyon, gölgeler, VFX ve çok sayıda Actor aynı
anda çalışır. Draw call, aktif animasyon, texture belleği, yükleme süresi ve
frame süresi release kapsamından önce ölçülmelidir.

---

## 22. GPT İçin Proje Çalışma Kuralları

Bu projeye öneri veya kod üreten GPT şu kuralları uygulamalıdır:

1. Oyunu genel bir “Age of Empires klonu” gibi ele alma. Ayırt edici çekirdek
   yol, Karakol, Depo, kontrol alanı ve dış ekonomi ilişkisidir.
2. Mevcut Forge motor/editör kodunu oyun kuralıyla kirletme. Projeye özel
   davranış `src/game` veya oyun verisinde kalmalıdır.
3. Denge sayılarını TypeScript içine gömme; `public/game-data/balance/` kullan.
4. Minimap’i geri önermeden önce `SCOPE_LOG SL-006` kararını dikkate al.
5. Üçüncü çağı uygulanmış sayma. Yeni üçüncü çağ önerisi gerçek yeni karar,
   sanat ailesi ve bitirme baskısı içermelidir.
6. Eski “Koçbaşı” anlatımını kullanma; güncel kuşatma birimi menzilli Topçudur.
7. Normal AI’a açıklanmayan hile vermeyi varsayılan çözüm yapma.
8. Yüzlerce birim, çoklu ordu veya karmaşık formasyonla kapsamı büyütme.
9. UI’da bir sistem çalışmadığında yalnız sonucu değil nedeni göster.
10. Yeni özellik önerirken ekonomi, AI, UI, veri, test ve harita etkisini birlikte
    değerlendir.
11. Her özellik küçük, oynanabilir ve doğrulanabilir bir dikey dilim olarak
    planlanmalıdır.
12. Yeni layout/environment alanlarında save-validator allowlist’ini kontrol et.
13. TypeScript sonrası `npx tsc --noEmit`; engine/runtime değişikliğinde mümkünse
    tam yerel gate çalıştır.
14. UI ve render değişikliğinde browser doğrulamasını yalnız headless engine
    testleriyle ikame etme.
15. Güvenlik taramasını sessizce başlatma; kapsamı öner ve kullanıcı onayı bekle.

### Yeni özellik karar filtresi

Her öneri şu sorulara cevap vermelidir:

- Hangi oyuncu kararını yaratıyor veya güçlendiriyor?
- Beş tasarım sütunundan hangisini destekliyor?
- Yol/lojistik çekirdeğiyle ilişkisi var mı?
- Yeni UI ve AI yükü nedir?
- Veriyle ayarlanabilir mi?
- En küçük oynanabilir sürümü nedir?
- Başarı ve kesme kriteri nedir?
- Mevcut iki çağlık kapsamı mı güçlendiriyor, yoksa gereksizce büyütüyor mu?

---

## 23. Proje Dizin Rehberi

| Dizin/dosya | İçerik |
|---|---|
| `src/game/rts/` | RTS runtime ve bütün oyun sistemleri |
| `src/game/rts/RtsApp.ts` | RTS composition root |
| `src/game/rts/ai/` | Krallık ve ordu AI’ı |
| `src/game/rts/economy/` | Kaynak, üretim, pazar ve lojistik |
| `src/game/rts/structures/` | Yapılar, placement, inşa ve üretim |
| `src/game/rts/roads/` | Yol graph’ı, yerleştirme ve bağlantı |
| `src/game/rts/territory/` | Kontrol alanı |
| `src/game/rts/units/` | Birim, hareket, savaş ve animasyon |
| `src/game/rts/vision/` | Fog, görüş ve düşman hafızası |
| `src/game/rts/objectives/` | Stratejik noktalar ve bölgesel zafer |
| `src/game/rts/ui/` | HUD, seçim panelleri ve bildirimler |
| `src/game/data/` | Oyun verisi tipleri, loader ve doğrulama |
| `public/game-data/` | Denge, preset, sürüm ve içerik katalogları |
| `public/assets/ThreeAges/` | Oyun Level, Actor ve görsel assetleri |
| `docs/planned/` | Aktif veya planlanmış üretim işleri |
| `GDD/` | Tasarım ve kapsam belgeleri |
| `tools/engine-tests.ts` | Geniş engine ve RTS sözleşme testleri |
| `tests/smoke/` | Playwright browser smoke testleri |

---

## 24. Ana GDD Kaynakları

| Belge | Ana konusu |
|---|---|
| `00_GAME_VISION_AND_PILLARS.md` | Vizyon, oyuncu fantezisi ve tasarım sütunları |
| `01_CORE_GAMEPLAY_LOOP.md` | Çekirdek döngü |
| `02_MATCH_FLOW_AND_PROGRESSION.md` | Maç fazları, çağ ve seviye |
| `03_ECONOMY_AND_RESOURCES.md` | Kaynaklar ve üretim |
| `04_BUILDINGS_AND_SETTLEMENT.md` | Yapılar ve yerleşim |
| `05_TERRITORY_LOGISTICS_AND_ROADS.md` | Kontrol, yollar ve lojistik |
| `06_UNITS_AND_COMBAT.md` | Birimler ve savaş |
| `07_ENEMY_AI_DESIGN_v0.2.md` | AI tasarımı |
| `08_MAP_AND_WORLD_DESIGN.md` | Harita ve dünya |
| `09_VICTORY_DEFEAT_AND_DIFFICULTY.md` | Zafer, yenilgi ve zorluk |
| `10_CAMERA_CONTROLS_AND_UI.md` | Kamera, kontroller ve UI |
| `11_ART_ASSETS_AND_PRESENTATION.md` | Sanat ve sunum |
| `12_BALANCE_AND_GAME_DATA.md` | Denge ve veri |
| `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md` | Üretim fazları ve kabul kapıları |
| `GDD_MASTER_v0.2.md` | GDD indeksi ve ana karar matrisi |
| `SCOPE_LOG.md` | Güncel kapsam sapmaları ve kesintiler |
| `TECH_DECISIONS.md` | Teknik kararlar ve Forge hizalaması |

---

## 25. Terimler Sözlüğü

| Terim | Anlam |
|---|---|
| Actor | Forge içinde görsel ve bileşen tabanlı authored oyun nesnesi |
| Çağ | Genel sanat ailesi ve içerik açılım katmanı |
| Bina seviyesi | Aynı çağ içindeki tek yapı örneğinin Lv1–Lv3 gelişimi |
| Kontrol alanı | Normal yapı kurulabilen krallık bölgesi |
| Karakol | Sınırı genişleten, görüş ve savunma sağlayan yapı |
| Yol graph’ı | Yapıların ekonomik bağlantısını temsil eden hücre ağı |
| Yerel tampon | Üretimin global stoğa aktarılmadan önce biriktiği yapı içi stok |
| Global stok | Krallığın harcayabildiği ortak kaynak havuzu |
| Dış ekonomi | Başlangıç güvenli alanı dışındaki değerli üretim ağı |
| Askerî zafer | Rakip Merkezini yok ederek kazanma |
| Bölgesel zafer | İki stratejik noktayı sayaç boyunca kontrol ederek kazanma |
| Oynanış Kanıtı / Ürün A | Lojistik çekirdeğini en küçük kapsamda doğrulayan ürün |
| Çekirdek Maç / Ürün B | Dört kaynak, iki çağ, tam savaş ve AI içeren prototip |
| Vertical Slice / Ürün C | Sunum, denge ve kalite hedeflerine yaklaşan tek haritalık ürün |
| Feature flag | Koşullu veya tamamlanmamış sistemi varsayılan maçtan ayıran çalışma anahtarı |
| Forge | Oyunun kullandığı genel Three.js motor ve editör platformu |

---

## 26. Son Özet

Üç Çağ: Sınır Krallıkları’nın özü, küçük bir yerleşimi yalnız üretim ve savaşla
değil, **savunulabilir bir lojistik ağ kurarak** büyütmektir. Oyunun başarılı
olması için oyuncu yolları, Karakolları, Depoları ve dış kaynak alanlarını
yalnızca zorunlu yapı parçaları olarak değil, stratejik planının fiziksel
haritası olarak görmelidir. Savaş bu haritayı bozmalı; ekonomi de ordunun ne
zaman ve nerede savaşabileceğini belirlemelidir.

Bugün proje, bu çekirdeğin büyük bölümünü çalışan bir web RTS olarak
kanıtlamıştır: dört kaynak, iki çağ, üç bina seviyesi, yol ve lojistik,
rol odaklı savaş, gelişen AI, kapsamlı UI, askerî zafer ve koşullu stratejik
sistemler mevcuttur. Önündeki ana iş daha fazla mekanik eklemek değil; geç oyunu
bitirici hale getirmek, authored dünyayı tamamlamak, görsel/ses sunumunu
olgunlaştırmak ve yeterli sayıda tam maçla denge ve güvenilirliği kanıtlamaktır.

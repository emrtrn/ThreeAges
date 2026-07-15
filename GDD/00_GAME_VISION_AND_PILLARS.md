# 00 — Game Vision and Design Pillars

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Game Design Document — Vizyon ve Tasarım Sütunları  
> **Sürüm:** 0.1  
> **Durum:** İlk taslak  
> **Hedef proje:** Forge editörü ile geliştirilecek küçük ölçekli, tek oyunculu RTS vertical slice  
> **Referans asset seti:** [Ultimate Fantasy RTS — Quaternius](https://quaternius.com/packs/ultimatefantasyrts.html)

---

## 1. Dokümanın Amacı

Bu doküman oyunun temel kimliğini, oyuncuya sunacağı ana deneyimi, tasarım sütunlarını, hedef kapsamını ve kapsam dışı özellikleri tanımlar.

Bu dosyada alınan kararlar, ileride hazırlanacak ekonomi, bina, lojistik, savaş, AI, harita, kullanıcı arayüzü ve üretim planı dokümanları için üst seviye referans kabul edilir.

Bu dokümanın amacı ayrıntılı sistem değerleri belirlemek değildir. Aşağıdaki sorulara net cevap vermektir:

- Bu oyun tam olarak nedir?
- Oyuncu hangi rolü üstlenir?
- Oyuncu maç boyunca ne yapar?
- Oyunu benzer RTS oyunlarından ayıran ana özellik nedir?
- İlk oynanabilir sürümde hangi özellikler bulunur?
- Hangi özellikler bilinçli olarak kapsam dışında tutulur?
- Projenin başarılı kabul edilmesi için ne göstermesi gerekir?

---

## 2. Yüksek Konsept

**Üç Çağ: Sınır Krallıkları**, oyuncunun küçük bir yerleşimi üç gelişim aşamasından geçirerek bir krallığa dönüştürdüğü, ekonomisini yollar ve lojistik bağlantılar üzerinden yönettiği ve harita kontrolü için AI tarafından yönetilen rakip bir krallıkla mücadele ettiği tek oyunculu bir gerçek zamanlı strateji oyunudur.

Oyuncu yalnızca kaynak toplayıp ordu üretmez. Yerleşiminin büyüyebilmesi için:

- yeni bölgeleri kontrol altına alır,
- üretim yapılarını yol ağına bağlar,
- kaynakların güvenli şekilde taşınmasını sağlar,
- sınır karakolları kurar,
- ekonomik ve askerî gelişim arasında denge kurar,
- düşmanın tedarik ve genişleme planlarını bozar.

Oyunun temel farkı, klasik RTS yapılarını **bölge kontrolü, yol bağlantısı ve lojistik verimlilik** sistemleriyle birleştirmesidir.

---

## 3. Tür ve Oyun Formatı

### 3.1 Ana tür

- Gerçek zamanlı strateji
- Üs kurma
- Kaynak yönetimi
- Bölge kontrolü
- Hafif lojistik yönetimi
- Tek oyunculu çatışma

### 3.2 Oyun formatı

- Bir oyuncu
- Bir AI rakip
- Tek harita ile başlayan vertical slice
- Maç tabanlı oynanış
- Gerçek zamanlı simülasyon
- Duraklatma desteği değerlendirilebilir
- Sabit veya sınırlı hız seçenekleri gelecekte eklenebilir

### 3.3 Hedef maç süresi

İlk vertical slice için hedef:

- **Minimum:** 15 dakika
- **İdeal:** 20–30 dakika
- **Üst sınır:** 40 dakika

Maç, oyuncunun ilk ekonomik kararlarını hızlı biçimde vermesini sağlamalı; ancak üçüncü gelişim aşamasına ulaşmak ve stratejik kararların sonuçlarını görmek için yeterli süre sunmalıdır.

---

## 4. Oyuncu Fantezisi

Oyuncunun temel fantezisi şudur:

> Küçük ve savunmasız bir sınır yerleşimini planlı, üretken ve güçlü bir krallığa dönüştürmek; yollar, karakollar ve ordular aracılığıyla haritayı kontrol etmek.

Oyuncu kendisini yalnızca bir komutan olarak değil, aynı zamanda:

- yerleşim planlayıcısı,
- ekonomik yönetici,
- lojistik ağı kurucusu,
- sınır savunucusu,
- askerî stratejist

olarak hissetmelidir.

Oyuncunun verdiği kararların haritada görsel karşılığı bulunmalıdır. Küçük ahşap yapılar zamanla daha gelişmiş yapılara dönüşmeli, yollar yerleşimi birbirine bağlamalı, sınır karakolları bölgesel büyümeyi göstermeli ve ordular ekonomik kapasitenin sonucu olarak ortaya çıkmalıdır.

---

## 5. Temel Deneyim Hedefi

Oyuncu her maçta şu deneyimi yaşamalıdır:

1. Küçük bir başlangıç yerleşimini tanır.
2. Yakındaki kaynakları keşfeder.
3. İşçileri temel üretim alanlarına dağıtır.
4. İlk yol ve depo bağlantılarını kurar.
5. Yerleşimin kontrol alanını karakollarla genişletir.
6. Rakip AI’ın gelişimini ve hareketlerini gözlemler.
7. Ekonomi, savunma ve teknoloji arasında seçim yapar.
8. İkinci ve üçüncü gelişim seviyelerine ulaşır.
9. Haritanın stratejik bölgeleri için mücadele eder.
10. Askerî veya bölgesel bir zafer hedefini tamamlar.

Oyuncu, maç sonunda şu hissi edinmelidir:

> “Krallığım büyüdü çünkü kaynakları doğru yönettim, doğru bölgelere genişledim ve düşmanın planını zamanında bozabildim.”

---

## 6. Tasarım Sütunları

Oyunun tüm sistemleri aşağıdaki beş tasarım sütununu desteklemelidir.

---

### 6.1 Görünür ve Anlamlı Gelişim

Oyuncunun ilerlemesi yalnızca sayısal değerlerle değil, haritada açıkça görülmelidir.

Gelişim şu yollarla görünür olmalıdır:

- yapıların üç görsel seviyeye yükselmesi,
- yerleşimin kapladığı alanın büyümesi,
- yol ağının genişlemesi,
- savunma hatlarının güçlenmesi,
- daha gelişmiş askerlerin açılması,
- merkez binasının küçük yerleşimden kaleye dönüşmesi.

Her gelişim aşaması yeni kararlar ve yeni imkânlar sunmalıdır. Çağ atlamak yalnızca daha güçlü birim üretme izni vermemelidir.

**Tasarım kuralı:**  
Bir yükseltme oyuncuya yalnızca daha yüksek sayı vermemeli; mümkün olduğunca yeni bir kullanım, rol veya stratejik tercih açmalıdır.

---

### 6.2 Ekonomi ile Savaş Arasında Gerçek Bağ

Ordu, ekonomiden bağımsız çalışan ayrı bir sistem olmamalıdır.

Askerî güç aşağıdaki ekonomik unsurlara bağlı olmalıdır:

- düzenli kaynak üretimi,
- yeterli nüfus kapasitesi,
- güvenli taşıma rotaları,
- aktif depo ve yol bağlantıları,
- gelişmiş üretim yapıları,
- sürdürülebilir altın ve yiyecek akışı.

Düşmana zarar vermenin tek yolu doğrudan merkez binasına saldırmak olmamalıdır. Oyuncu şu hedefleri de seçebilmelidir:

- kaynak işçilerini baskı altına almak,
- yol bağlantılarını kesmek,
- uzak karakolları yok etmek,
- merkezi kaynak bölgelerini ele geçirmek,
- yeni çağ gelişimini geciktirmek.

**Tasarım kuralı:**  
Başarılı bir askerî hamle, düşmanın ekonomik kararlarını etkilemelidir.

---

### 6.3 Bölge Kontrolü ve Lojistik

Oyunun ana ayırt edici sistemi bölge kontrolü ile lojistik bağlantının birleşimidir.

Temel yaklaşım:

- Oyuncu yalnızca kendi kontrol alanı içinde yapı kurabilir.
- Merkez binası başlangıç kontrol alanını oluşturur.
- Karakollar ve gelişmiş yapılar kontrol alanını genişletir.
- Üretim yapıları yol ve depo bağlantısından verim bonusu alır.
- Uzak üretim noktaları daha kırılgan fakat daha değerli olabilir.
- Düşman, yolları veya karakolları hedef alarak ekonomiyi bozabilir.

Lojistik sistemi ağır bir taşıma simülasyonuna dönüşmemelidir. Okunabilir, anlaşılır ve stratejik olmalıdır.

**Tasarım kuralı:**  
Oyuncu bir yapının neden verimli veya verimsiz çalıştığını tek bakışta anlayabilmelidir.

---

### 6.4 Okunabilir ve Yönetilebilir RTS Deneyimi

Oyun küçük ölçekli bir vertical slice olarak tasarlanmalıdır. Amaç yüzlerce birim yönetmek değil, az sayıdaki birim ve yapıyla anlamlı kararlar vermektir.

Okunabilirliği destekleyen ilkeler:

- sınırlı birim çeşidi,
- belirgin birim rolleri,
- güçlü renk ve siluet ayrımı,
- açık seçim göstergeleri,
- net yol ve kontrol alanı görselleştirmesi,
- anlaşılır uyarılar,
- sınırlı ama önemli teknoloji seçimleri.

**Tasarım kuralı:**  
Bir sistem oyuncuya ilginç karar sunmuyorsa veya okunabilirliği ciddi biçimde azaltıyorsa kapsamdan çıkarılmalıdır.

---

### 6.5 Tepkisel ve Anlaşılır AI Rakip

AI yalnızca belirli aralıklarla birlik gönderen bir saldırı üreticisi olmamalıdır.

AI şu davranışları gösterebilmelidir:

- kaynak ihtiyacını değerlendirme,
- işçi üretme,
- yapı kurma,
- çağ atlama,
- yeni bölgelere genişleme,
- tehdit altındaki alanları savunma,
- zayıf hedeflere baskın yapma,
- ordu toplama,
- başarısız saldırıdan sonra geri çekilme,
- farklı zafer hedeflerine tepki verme.

Oyuncu AI’ın kararlarını tamamen görmemelidir; ancak davranışını anlayabilmelidir.

Örnek geri bildirimler:

- düşmanın yeni karakol kurması,
- sınırda ordu toplaması,
- stratejik bir bölgeye yönelmesi,
- yeni bir gelişim seviyesine ulaşması.

**Tasarım kuralı:**  
AI güçlü görünmek için gizli ekonomik hilelere mümkün olduğunca az başvurmalı; başarısını okunabilir kararlarla göstermelidir.

---

## 7. Oyunu Benzerlerinden Ayıran Özellikler

Oyun klasik üs kurma RTS yapısından yararlanır; ancak aşağıdaki özelliklerle farklılaşır.

### 7.1 Yol tabanlı ekonomik verim

Yol ağı yalnızca dekoratif değildir. Üretim, taşıma ve yerleşim bütünlüğünü etkiler.

### 7.2 Karakol tabanlı genişleme

Yeni bölgelere yapı kurmak için doğrudan kontrol alanı oluşturmak gerekir.

### 7.3 Görsel olarak üç aşamalı yerleşim gelişimi

Asset setindeki üç gelişim seviyesi, oyunun çağ ve yapı yükseltme sisteminin merkezine yerleştirilir.

### 7.4 Ekonomik hedeflere yönelik savaş

Oyuncu ordusunu yalnızca düşman merkezini yok etmek için değil, kaynak akışını ve bölgesel bağlantıları bozmak için kullanır.

### 7.5 Küçük ölçekli fakat tam RTS döngüsü

Proje, devasa içerik miktarı yerine sınırlı sistemlerle tam bir maç deneyimi sunmayı hedefler.

---

## 8. Temel Oynanış Döngüsü

Yüksek seviyeli döngü:

```text
Keşfet
→ Kaynakları değerlendir
→ İşçileri dağıt
→ Yapı ve yol kur
→ Kontrol alanını genişlet
→ Ekonomiyi geliştir
→ Birlik üret
→ AI hamlelerine tepki ver
→ Stratejik hedefleri ele geçir
→ Bir üst gelişim seviyesine ulaş
→ Zafer koşulunu tamamla
```

### 8.1 Kısa vadeli döngü

Yaklaşık 10–60 saniyelik kararlar:

- işçi seçme ve görevlendirme,
- bina yerleştirme,
- yol uzatma,
- saldırı hedefi seçme,
- birlikleri geri çekme,
- üretim kuyruğu oluşturma.

### 8.2 Orta vadeli döngü

Yaklaşık 1–5 dakikalık kararlar:

- yeni kaynak alanına genişleme,
- karakol kurma,
- askerî üretim başlatma,
- savunma hattı oluşturma,
- düşmanın zayıf yönünü belirleme,
- bir sonraki çağ için kaynak biriktirme.

### 8.3 Uzun vadeli döngü

Maçın tamamını etkileyen kararlar:

- ekonomik veya askerî gelişime öncelik verme,
- hangi stratejik bölgenin kontrol edileceğine karar verme,
- yol ağını güvenli veya kısa rota üzerinden kurma,
- zafer koşulunu seçme,
- düşmanın büyümesini yavaşlatma veya kendi gelişimini hızlandırma.

---

## 9. Üç Gelişim Aşaması

Bu dokümanda gelişim seviyeleri yalnızca üst düzey olarak tanımlanır. Ayrıntılar `02_MATCH_FLOW_AND_PROGRESSION.md` dosyasında ele alınacaktır.

### 9.1 Seviye I — Yerleşim

Temel kimlik:

- küçük,
- kırılgan,
- kaynak odaklı,
- düşük nüfuslu,
- sınırlı savunmalı.

Oyuncunun ana sorusu:

> “İlk ekonomimi nasıl güvenli ve verimli biçimde kurarım?”

### 9.2 Seviye II — Kasaba

Temel kimlik:

- genişleyen,
- uzmanlaşan,
- yollarla bağlanan,
- bölge kontrolüne başlayan,
- düzenli asker üreten.

Oyuncunun ana sorusu:

> “Ekonomimi büyütürken düşmanın genişlemesini nasıl sınırlarım?”

### 9.3 Seviye III — Krallık

Temel kimlik:

- güçlü,
- savunmalı,
- yüksek üretim kapasiteli,
- gelişmiş birliklere sahip,
- zafer hedefini tamamlamaya hazır.

Oyuncunun ana sorusu:

> “Kurmuş olduğum üstünlüğü kesin zafere nasıl dönüştürürüm?”

---

## 10. Hedef Oyuncu Profili

Oyun şu oyunculara hitap eder:

- klasik RTS oyunlarının temel döngüsünü seven,
- büyük ölçekli rekabetçi RTS baskısı istemeyen,
- tek oyunculu strateji deneyimlerinden hoşlanan,
- üs kurma ve ekonomik gelişimi önemseyen,
- 20–30 dakikalık tamamlanabilir maçlar arayan,
- okunabilir ve stilize görsel sunumu tercih eden oyuncular.

Oyun ilk aşamada rekabetçi veya yüksek beceri tavanına sahip bir e-spor RTS’si olarak tasarlanmaz.

---

## 11. Platform ve Kontrol Hedefleri

### 11.1 Ana platform

- Web tarayıcısı
- Masaüstü bilgisayar
- Klavye ve fare

### 11.2 Temel kontrol yaklaşımı

- Sol tık ile seçim
- Sürükleyerek kutu seçimi
- Sağ tık ile hareket veya etkileşim komutu
- Fare tekerleği ile zoom
- Klavye veya ekran kenarı ile kamera hareketi
- Kısayol tuşlarıyla yapı ve birim üretimi
- Seçim grupları gelecekte değerlendirilebilir

### 11.3 Mobil kapsamı

Mobil ve dokunmatik kontrol ilk vertical slice kapsamında değildir.

---

## 12. Görsel Yön

Ana görsel kaynak Quaternius Ultimate Fantasy RTS asset setidir.

Görsel hedefler:

- stilize low-poly 3D sunum,
- açık ve okunabilir siluetler,
- oyuncu ile AI arasında belirgin takım rengi farkı,
- üç gelişim seviyesinin görsel olarak kolay anlaşılması,
- uzaktan okunabilen yapı işlevleri,
- yoğun olmayan çevre yerleşimi,
- performans dostu sahne yapısı.

### 12.1 Görsel öncelikler

1. Seçilebilir nesnelerin okunabilirliği
2. Bina seviyelerinin ayırt edilebilirliği
3. Takım aidiyetinin anlaşılması
4. Yol ve kontrol alanlarının görünürlüğü
5. Kaynak noktalarının hızlı tanınması
6. Dekoratif çevrenin oynanış alanını gizlememesi

### 12.2 Asset eşleştirme yaklaşımı

Her model doğrudan oyunda kullanılmak zorunda değildir. Paket içeriği şu şekilde sınıflandırılmalıdır:

- oynanış yapıları,
- gelişim seviyesi varyantları,
- kaynak yapıları,
- savunma yapıları,
- dekoratif çevre,
- harita sınırı nesneleri,
- kullanılmayacak veya ileride değerlendirilecek modeller.

Bu eşleştirme `11_ART_ASSETS_AND_PRESENTATION.md` içinde ayrıntılandırılacaktır.

---

## 13. Ses ve Müzik Yönü

İlk vertical slice için ses sistemi sınırlı fakat işlevsel olmalıdır.

Gerekli temel ses grupları:

- seçim ve komut sesleri,
- bina yerleştirme,
- inşaat,
- kaynak toplama,
- saldırı ve hasar,
- bina yıkımı,
- çağ atlama,
- uyarılar,
- zafer ve yenilgi,
- düşük yoğunluklu arka plan müziği,
- çevresel ambiyans.

Ses tasarımının amacı sinematik yoğunluk değil, oyuncu geri bildirimini güçlendirmektir.

---

## 14. Ton ve Dünya

Oyun dünyası karanlık veya gerçekçi savaş anlatısı üzerine kurulmaz.

Hedef ton:

- keşif ve gelişim hissi,
- hafif fantastik orta çağ atmosferi,
- stratejik rekabet,
- okunabilir çatışma,
- stilize ve erişilebilir sunum.

Şiddet:

- grafik olmayan,
- stilize,
- uzak kamera açısından gösterilen,
- birimlerin kaybolması veya basit yenilme animasyonlarıyla sunulan yapıdadır.

İlk vertical slice için kapsamlı hikâye anlatımı planlanmaz.

---

## 15. Vertical Slice Kapsamı

İlk oynanabilir sürüm, oyunun tamamını değil ana fikrinin çalıştığını kanıtlamalıdır.

### 15.1 Dahil edilmesi hedeflenen içerik

- Tek oynanabilir harita
- Tek oyuncu fraksiyonu
- Aynı temel kuralları kullanan tek AI rakip
- Üç gelişim seviyesi
- Dört ana kaynak:
  - yiyecek,
  - odun,
  - taş,
  - altın
- Nüfus kapasitesi
- Basit refah veya yerleşim gelişim değeri
- İşçi birimi
- En az üç askerî birim
- Yaklaşık 8–12 işlevsel yapı
- Yapı yükseltme
- Yol sistemi
- Kontrol alanı
- Karakol ile genişleme
- Kaynak toplama ve depolama
- Birim üretme
- Temel savaş
- Fog of war
- Bir AI ekonomi ve savaş döngüsü
- Askerî zafer
- Bölgesel zafer
- Maç sonu ekranı
- Temel save/load desteği, teknik uygunluğa göre

### 15.2 İlk prototip alt kapsamı

Vertical slice öncesindeki ilk oynanabilir prototip daha küçük olabilir:

- tek harita,
- bir kaynak türü,
- bir işçi,
- bir merkez bina,
- bir üretim binası,
- bir asker türü,
- basit AI hedefi,
- bir zafer koşulu.

Bu alt kapsam yalnızca temel teknik sistemleri doğrulamak için kullanılır.

---

## 16. Kapsam Dışı Özellikler

Aşağıdaki özellikler ilk vertical slice içinde yer almayacaktır:

- çok oyunculu mod,
- eşli oynanış,
- rekabetçi sıralama,
- birden fazla oynanabilir fraksiyon,
- kapsamlı senaryo veya hikâye modu,
- kahraman birimleri,
- büyü sistemi,
- diplomasi,
- tarafsız krallıklarla ittifak,
- deniz savaşı,
- hava birimleri,
- ayrıntılı ticaret simülasyonu,
- bireysel vatandaş ihtiyaçları,
- karmaşık moral sistemi,
- yüzlerce birimlik ordular,
- procedural kampanya,
- rastgele üretilen tam haritalar,
- mobil kontrol,
- mod desteği,
- kapsamlı teknoloji ağacı,
- sinematik ara sahneler.

Bu özelliklerden bazıları gelecekte değerlendirilebilir; ancak ilk sürümün başarısı için gerekli değildir.

---

## 17. Ana Tasarım Kısıtları

### 17.1 Asset paketi merkezli geliştirme

Oyun tasarımı, mevcut asset setinin güçlü yönlerini kullanmalıdır. Eksik içerik nedeniyle çok sayıda özel model üretme zorunluluğu doğuran sistemlerden kaçınılmalıdır.

### 17.2 Web performansı

Oyun, web tarayıcısında çalışacağı için:

- aktif birim sayısı sınırlı tutulmalı,
- pathfinding maliyeti kontrol edilmeli,
- gereksiz fizik simülasyonu kullanılmamalı,
- model ve materyal sayısı optimize edilmeli,
- AI kararları her karede çalıştırılmamalı,
- görünmeyen nesneler için güncelleme maliyeti azaltılmalı.

### 17.3 Geliştirme aracı olarak Forge

Projenin ikincil amacı Forge editörünün aşağıdaki alanlardaki yeterliliğini ölçmektir:

- glTF model içe aktarma,
- sahne oluşturma,
- RTS kamera,
- seçim sistemleri,
- pathfinding,
- yapı yerleştirme,
- kaynak toplama,
- veri tabanlı yapı ve birimler,
- AI karar sistemleri,
- fog of war,
- UI,
- save/load,
- performans yönetimi.

### 17.4 Küçük ekip yaklaşımı

Tasarım, tek geliştirici veya AI destekli küçük üretim düzenine uygun olmalıdır.

---

## 18. Başarı Kriterleri

Vertical slice aşağıdaki durumlarda başarılı kabul edilir.

### 18.1 Oynanış başarısı

- Oyuncu yardım almadan temel hedefi anlayabilir.
- İlk beş dakika içinde kaynak toplama ve yapı kurma döngüsü çalışır.
- Üç gelişim seviyesi anlamlı farklar yaratır.
- Yol ve kontrol alanı sistemi oyuncunun kararlarını etkiler.
- Ekonomi ile askerî üretim arasında hissedilir bağ bulunur.
- AI üs kurar, genişler, savunur ve saldırır.
- Maç geçerli bir zafer veya yenilgi durumuyla tamamlanır.

### 18.2 Teknik başarı

- Oyun hedef web tarayıcılarında kararlı çalışır.
- Birim hareketleri kabul edilebilir şekilde pathfinding yapar.
- Çoklu seçim ve komut sistemi güvenilir çalışır.
- Yapı yerleştirme kuralları tutarlıdır.
- Oyun durumu kaydedilip geri yüklenebilir veya bu özellik için uygulanabilir teknik plan doğrulanır.
- Hedef donanımda kabul edilebilir kare hızı korunur.

### 18.3 Sunum başarısı

- Oyuncu ve AI birlikleri kolayca ayırt edilir.
- Yapı gelişim seviyeleri açıkça görülür.
- Kaynaklar, yollar ve stratejik alanlar okunabilir durumdadır.
- Kullanıcı arayüzü temel bilgileri karmaşa oluşturmadan gösterir.

---

## 19. Tasarım İlkeleri

Geliştirme sırasında aşağıdaki ilkeler karar verme filtresi olarak kullanılmalıdır.

1. **Önce oynanabilir döngü, sonra içerik miktarı.**
2. **Yeni sistem, en az bir anlamlı karar üretmelidir.**
3. **Görsel gelişim oynanış gelişimiyle eşleşmelidir.**
4. **AI oyuncuyla aynı temel kuralları mümkün olduğunca paylaşmalıdır.**
5. **Lojistik anlaşılır olmalı, mikro yönetim yüküne dönüşmemelidir.**
6. **Her birim ve bina net bir role sahip olmalıdır.**
7. **Denge değerleri koddan ayrılarak veri tabanlı tutulmalıdır.**
8. **Vertical slice kapsamı, gelecekteki tam oyun hayali uğruna büyütülmemelidir.**
9. **Web performansı tasarım kararlarının başından itibaren dikkate alınmalıdır.**
10. **Oyuncu geri bildirimi her sistemin ayrılmaz parçası olmalıdır.**

---

## 20. Ana Riskler

### 20.1 Kapsamın kontrolsüz büyümesi

RTS türü çok sayıda birbirine bağlı sistem gerektirir. Her yeni kaynak, birim veya bina; AI, UI, denge ve kayıt sistemi yükünü artırır.

**Azaltma yaklaşımı:**  
Her sistem önce minimum işlevsel sürümle uygulanmalıdır.

### 20.2 AI geliştirme maliyeti

Ekonomi kurabilen ve askerî karar verebilen AI, projenin en zor alanlarından biridir.

**Azaltma yaklaşımı:**  
AI katmanlara ayrılmalı ve önce script tabanlı kararlarla başlanmalıdır.

### 20.3 Pathfinding ve kalabalık hareketi

Dar yollar, bina çevreleri ve çoklu birlik hareketi sıkışmalara yol açabilir.

**Azaltma yaklaşımı:**  
Birim sayısı sınırlı tutulmalı; test haritalarında darboğaz senaryoları erken denenmelidir.

### 20.4 Lojistik sisteminin fazla karmaşıklaşması

Taşıma ve bağlantı sistemi ağır bir simülasyona dönüşürse oyuncu için okunması zor olabilir.

**Azaltma yaklaşımı:**  
İlk sürümde gerçek taşıyıcı simülasyonu yerine bağlantı ve mesafe temelli verim sistemi tercih edilebilir.

### 20.5 Asset setinin oynanış ihtiyaçlarını tam karşılamaması

Bina varyantları güçlü olsa da birim, animasyon veya belirli işlevsel yapı eksikleri oluşabilir.

**Azaltma yaklaşımı:**  
Eksik öğeler basit placeholder modeller, renk varyantları veya sınırlı özel üretimle çözülmelidir.

### 20.6 Web performansı

AI, pathfinding, fog of war ve çok sayıda animasyon eş zamanlı çalıştığında performans düşebilir.

**Azaltma yaklaşımı:**  
Performans bütçeleri üretim planının başında belirlenmelidir.

---

## 21. Açık Tasarım Soruları

Aşağıdaki konular sonraki dokümanlarda karara bağlanacaktır.

### 21.1 Ekonomi

- Refah doğrudan harcanan bir kaynak mı, yoksa koşul/değer mi olacak?
- Kaynaklar sınırlı ve tükenebilir mi olacak?
- İşçiler kaynakları fiziksel olarak depoya taşıyacak mı?
- Yol bağlantısı üretimi yüzde olarak mı artıracak?

### 21.2 Gelişim

- Çağ atlama merkez binası üzerinden mi yapılacak?
- Yapılar otomatik mi, tek tek mi yükseltilecek?
- Her bina üç seviyeye sahip olmak zorunda mı?
- Çağ atlamak için yalnızca kaynak mı, yoksa yapı ve bölge koşulları da mı gerekecek?

### 21.3 Bölge ve lojistik

- Kontrol alanı dairesel, grid tabanlı veya bağlantı tabanlı mı olacak?
- Karakollar ele geçirilebilir mi, yalnızca yok edilebilir mi?
- Yol kesilmesi üretimi tamamen mi durduracak, yoksa verimi mi azaltacak?
- Bir yapının birden fazla depoya bağlanması mümkün mü?

### 21.4 Savaş

- Askerler otomatik karşılık verecek mi?
- Birimler formasyon kullanacak mı?
- Dost ateşi olacak mı?
- Bina ele geçirme sistemi bulunacak mı?

### 21.5 AI

- İlk AI tek davranış profiline mi sahip olacak?
- AI oyuncuyla aynı kaynak kurallarını tamamen paylaşabilecek mi?
- Zorluk seviyesi karar kalitesiyle mi, ekonomik bonusla mı değişecek?
- AI farklı zafer koşullarını aktif olarak takip edecek mi?

### 21.6 Harita

- Harita tamamen sabit mi olacak?
- Kaynakların bazıları her maçta farklı konumlanacak mı?
- Stratejik bölgeler baştan görünür mü olacak?
- Nehir ve geçiş noktaları ilk haritada zorunlu mu olacak?

---

## 22. Şimdilik Alınmış Kararlar

- Oyun tek oyunculu bir RTS olacaktır.
- Maçta bir oyuncu ve bir AI rakip bulunacaktır.
- Oyun üç gelişim seviyesine sahip olacaktır.
- Ekonomi, savaş ve bölge kontrolü birbirine bağlı olacaktır.
- Yol ve lojistik sistemi oyunun ayırt edici mekaniği olacaktır.
- Oyuncu yalnızca kontrol ettiği bölgelerde yapı kuracaktır.
- Karakollar genişleme sisteminin temel öğesi olacaktır.
- İlk vertical slice tek harita içerecektir.
- İlk vertical slice çok oyunculu olmayacaktır.
- Asset setindeki üç seviyeli modeller oynanış ilerlemesiyle eşleştirilecektir.
- Bir maç yaklaşık 20–30 dakika hedefleyecektir.
- Birim ve bina çeşitliliği bilinçli olarak sınırlı tutulacaktır.
- İlk sürümde askerî ve bölgesel zafer koşulları hedeflenecektir.
- Forge editörünün teknik yeteneklerini sınamak projenin ana amaçlarından biridir.

---

## 23. Sonraki Dokümanlar

Planlanan GDD yapısı:

```text
/docs/gdd/
├── GDD_MASTER.md
├── 00_GAME_VISION_AND_PILLARS.md
├── 01_CORE_GAMEPLAY_LOOP.md
├── 02_MATCH_FLOW_AND_PROGRESSION.md
├── 03_ECONOMY_AND_RESOURCES.md
├── 04_BUILDINGS_AND_SETTLEMENT.md
├── 05_TERRITORY_LOGISTICS_AND_ROADS.md
├── 06_UNITS_AND_COMBAT.md
├── 07_ENEMY_AI_DESIGN.md
├── 08_MAP_AND_WORLD_DESIGN.md
├── 09_VICTORY_DEFEAT_AND_DIFFICULTY.md
├── 10_CAMERA_CONTROLS_AND_UI.md
├── 11_ART_ASSETS_AND_PRESENTATION.md
├── 12_BALANCE_AND_GAME_DATA.md
└── 13_VERTICAL_SLICE_PRODUCTION_PLAN.md
```

Bir sonraki önerilen doküman:

**`01_CORE_GAMEPLAY_LOOP.md`**

Bu dosyada:

- oyuncunun saniyelik, dakikalık ve maçlık döngüleri,
- oyuncu eylemleri,
- sistemler arası bağlantılar,
- erken, orta ve geç oyun kararları,
- başarısızlık ve geri kazanım döngüleri

detaylandırılacaktır.

---

## 24. Doküman Kabul Kriterleri

Bu doküman aşağıdaki koşullar karşılandığında onaylanmış kabul edilir:

- [ ] Oyunun çalışma adı kabul edildi veya değiştirildi.
- [ ] Yüksek konsept oyun hedefini doğru anlatıyor.
- [ ] Hedef maç süresi onaylandı.
- [ ] Beş tasarım sütunu onaylandı.
- [ ] Yol ve lojistik sisteminin ana ayırt edici mekanik olduğu kabul edildi.
- [ ] Üç gelişim seviyesi yaklaşımı kabul edildi.
- [ ] Vertical slice kapsamı gerçekçi bulundu.
- [ ] Kapsam dışı özellikler kabul edildi.
- [ ] Başarı kriterleri kabul edildi.
- [ ] Ana riskler gözden geçirildi.
- [ ] Açık tasarım soruları sonraki dokümanlara aktarıldı.
- [ ] Bu dosya sonraki GDD belgeleri için üst seviye referans olarak onaylandı.

---

## 25. Revizyon Notları

### Sürüm 0.1

- İlk oyun vizyonu oluşturuldu.
- Yüksek konsept tanımlandı.
- Beş tasarım sütunu belirlendi.
- Vertical slice kapsamı oluşturuldu.
- Kapsam dışı özellikler tanımlandı.
- Ana riskler ve açık sorular listelendi.
